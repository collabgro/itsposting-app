/**
 * ItsPosting — Twilio Inbound Webhook Routes
 * backend/routes/twilio.js
 *
 * Mounted at /api/twilio in server.js
 *
 * POST /api/twilio/sms/inbound       — inbound SMS from Twilio
 * POST /api/twilio/whatsapp/inbound  — inbound WhatsApp from Twilio
 *
 * Each customer uses their own Twilio account. Credentials are stored in
 * receptionist_config and fetched per-request to identify the customer and
 * verify the webhook signature.
 */

const express = require('express');
const TwilioService = require('../services/TwilioService');
const ReceptionistService = require('../services/ReceptionistService');

module.exports = function twilioRoutes(pool) {
  const router = express.Router();
  const receptionistSvc = new ReceptionistService(pool);

  // Shared normaliser (no credentials needed for this)
  const normaliser = new TwilioService();

  async function handleInbound(req, res, platform) {
    // Twilio expects a 200 TwiML response immediately
    res.set('Content-Type', 'text/xml');
    res.send('<Response/>');

    const { contactPhone, contactName, messageText } = normaliser.normaliseInbound(req.body);
    if (!contactPhone || !messageText) return;

    try {
      // Find which customer owns this Twilio number via receptionist_config
      const phoneCol = platform === 'whatsapp' ? 'twilio_whatsapp_number' : 'twilio_phone_number';
      const toNumber = (req.body.To || '').replace('whatsapp:', '');

      const cfgRes = await pool.query(
        `SELECT customer_id, twilio_account_sid, twilio_auth_token
         FROM receptionist_config WHERE ${phoneCol} = $1 LIMIT 1`,
        [toNumber]
      );

      if (!cfgRes.rows[0]) {
        console.warn(`[Twilio] No customer found for ${platform} number ${toNumber}`);
        return;
      }

      const { customer_id: customerId, twilio_account_sid: accountSid, twilio_auth_token: authToken } = cfgRes.rows[0];

      // Verify webhook signature using the customer's own auth token
      if (process.env.NODE_ENV === 'production') {
        const customerTwilio = new TwilioService({ accountSid, authToken });
        if (!customerTwilio.verifyWebhookSignature(req)) {
          console.warn('[Twilio] Invalid webhook signature — ignoring');
          return;
        }
      }

      // Upsert SMS/WhatsApp conversation
      const convResult = await pool.query(
        `INSERT INTO sms_conversations (customer_id, platform, contact_phone, contact_name, last_message_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (customer_id, platform, contact_phone) DO UPDATE SET
           last_message_at = NOW(),
           contact_name = COALESCE(EXCLUDED.contact_name, sms_conversations.contact_name)
         RETURNING id`,
        [customerId, platform, contactPhone, contactName]
      );

      const conversationId = convResult.rows[0].id;

      // Store the inbound message
      await pool.query(
        `INSERT INTO sms_messages (conversation_id, direction, body, sent_at, ai_handled)
         VALUES ($1, 'in', $2, NOW(), false)`,
        [conversationId, messageText]
      );

      // Hand off to receptionist service
      await receptionistSvc.handleIncomingSMS(platform, conversationId, messageText, customerId);

    } catch (err) {
      console.error(`[Twilio] Error handling inbound ${platform}:`, err.message);
    }
  }

  router.post('/sms/inbound', (req, res) => handleInbound(req, res, 'sms'));
  router.post('/whatsapp/inbound', (req, res) => handleInbound(req, res, 'whatsapp'));

  return router;
};
