/**
 * ItsPosting — Google My Business Messages Webhook Route
 * backend/routes/gmb-messages.js
 *
 * Mounted at /api/gmb in server.js
 *
 * POST /api/gmb/messages/webhook   — Google Business Messages inbound webhook
 * GET  /api/gmb/messages/webhook   — Google webhook verification challenge
 */

const express = require('express');
const GMBMessagesService = require('../services/GMBMessagesService');
const ReceptionistService = require('../services/ReceptionistService');

module.exports = function gmbMessagesRoutes(pool) {
  const router = express.Router();
  const gmbSvc = new GMBMessagesService();
  const receptionistSvc = new ReceptionistService(pool);

  // ── Webhook verification (GET) ────────────────────────────────────
  router.get('/messages/webhook', (req, res) => {
    // Google sends a challenge to verify the endpoint
    const { secret, clientToken } = req.query;
    const expectedSecret = process.env.GMB_WEBHOOK_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      return res.status(403).send('Forbidden');
    }
    // Echo back clientToken to confirm endpoint ownership
    res.status(200).json({ clientToken: clientToken || '' });
  });

  // ── Inbound message (POST) ────────────────────────────────────────
  router.post('/messages/webhook', async (req, res) => {
    // Acknowledge immediately
    res.status(200).json({ status: 'ok' });

    if (!gmbSvc.verifyWebhookSignature(req)) {
      console.warn('[GMBMessages] Invalid webhook signature — ignoring');
      return;
    }

    const { conversationId, messageText, userDisplayName, googlePlaceId } = gmbSvc.normaliseInbound(req.body);
    if (!conversationId || !messageText) return;

    try {
      // Find which customer owns this Google Business location
      const custResult = await pool.query(
        `SELECT c.id FROM customers c
         INNER JOIN social_accounts sa ON sa.customer_id = c.id AND sa.platform = 'google'
         WHERE sa.external_id = $1 AND c.suspended = false
         LIMIT 1`,
        [googlePlaceId || '']
      );

      if (!custResult.rows[0]) {
        console.warn(`[GMBMessages] No customer found for place ID ${googlePlaceId}`);
        return;
      }

      const customerId = custResult.rows[0].id;

      // Upsert a DM conversation record for GMB
      const convResult = await pool.query(
        `INSERT INTO dm_conversations
           (customer_id, platform, external_conversation_id, sender_name, status, last_message_at)
         VALUES ($1, 'google', $2, $3, 'open', NOW())
         ON CONFLICT (customer_id, platform, external_conversation_id) DO UPDATE SET
           last_message_at = NOW(),
           sender_name = COALESCE(EXCLUDED.sender_name, dm_conversations.sender_name)
         RETURNING id`,
        [customerId, conversationId, userDisplayName || 'GMB User']
      );

      const dmConvId = convResult.rows[0]?.id;
      if (!dmConvId) return;

      // Store the inbound message
      await pool.query(
        `INSERT INTO dm_messages (conversation_id, direction, message_text, sent_at)
         VALUES ($1, 'incoming', $2, NOW())`,
        [dmConvId, messageText]
      );

      // Hand off to receptionist service
      const result = await receptionistSvc.handleIncoming('google', dmConvId, messageText, customerId);

      // If auto_handle sent a reply — also push it to GMB
      if (result?.autoSent && result?.reply) {
        await gmbSvc.sendMessage(conversationId, result.reply).catch(err =>
          console.error('[GMBMessages] Send error:', err.message)
        );
      }

    } catch (err) {
      console.error('[GMBMessages] Webhook error:', err.message);
    }
  });

  return router;
};
