/**
 * Webhooks — inbound event handlers from third-party services
 *
 * IMPORTANT: This router must be registered BEFORE express.json() in server.js
 * so that req.body is the raw Buffer needed for HMAC signature verification.
 *
 * Current webhooks:
 *   POST /api/webhooks/heygen  — video completion / failure from HeyGen
 *   OPTIONS /api/webhooks/heygen  — HeyGen validates your endpoint within 1s
 */

const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const NotificationService = require('../services/NotificationService');
const DMPollingService = require('../services/DMPollingService');

const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const FACEBOOK_WEBHOOK_VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;

module.exports = (pool) => {
  const router = express.Router();
  const notifier = new NotificationService(pool);

  // ─────────────────────────────────────────────────────────────
  // OPTIONS — HeyGen pings this to verify the endpoint is alive
  // Must respond within 1 second or HeyGen marks registration as failed
  // ─────────────────────────────────────────────────────────────
  router.options('/heygen', (req, res) => res.sendStatus(200));

  // ─────────────────────────────────────────────────────────────
  // POST /api/webhooks/heygen
  // HeyGen fires this when a video completes or fails.
  //
  // Event types we handle:
  //   avatar_video.success  →  { event_data: { video_id, url } }
  //   avatar_video.fail     →  { event_data: { video_id, msg } }
  //
  // Signature verification (if HEYGEN_WEBHOOK_SECRET is set):
  //   Header: Signature  (hex-encoded HMAC-SHA256 of raw body)
  // ─────────────────────────────────────────────────────────────
  router.post('/heygen', express.raw({ type: '*/*' }), async (req, res) => {
    // Always ACK immediately — HeyGen retries if response takes > 20s
    res.sendStatus(200);

    try {
      // ── Signature verification ──────────────────────────────
      const secret = process.env.HEYGEN_WEBHOOK_SECRET;
      if (!secret) {
        console.warn('[HeyGen Webhook] HEYGEN_WEBHOOK_SECRET not set — payload ignored for security. Set this env var to enable webhook processing.');
        return;
      }
      const sig = req.headers['signature'];
      if (!sig) {
        console.warn('[HeyGen Webhook] Missing Signature header — ignoring payload');
        return;
      }
      const expected = crypto
        .createHmac('sha256', secret)
        .update(req.body)
        .digest('hex');
      if (expected !== sig) {
        console.warn('[HeyGen Webhook] Signature mismatch — ignoring payload');
        return;
      }

      // ── Parse payload ───────────────────────────────────────
      let body;
      try {
        body = JSON.parse(req.body.toString('utf8'));
      } catch {
        console.warn('[HeyGen Webhook] Non-JSON body received');
        return;
      }

      const { event_type, event_data } = body;
      const videoId = event_data?.video_id;
      console.log('[HeyGen Webhook] event:', event_type, '| video_id:', videoId);

      // ── avatar_video.success ────────────────────────────────
      if (event_type === 'avatar_video.success' && videoId) {
        // HeyGen sends the URL in either 'url' or 'video_url' depending on version
        const videoUrl = event_data?.url || event_data?.video_url;
        if (!videoUrl) {
          console.warn('[HeyGen Webhook] Success event but no video URL in payload:', JSON.stringify(event_data));
          return;
        }
        console.log('[HeyGen Webhook] Video ready:', videoId, '->', videoUrl);

        try {
          const result = await pool.query(
            `UPDATE posts
             SET media_url = $1, status = 'draft', updated_at = NOW()
             WHERE video_job_id = $2
             RETURNING id, customer_id`,
            [videoUrl, videoId]
          );
          if (result.rowCount > 0) {
            const { id: postId, customer_id: customerId } = result.rows[0];
            console.log('[HeyGen Webhook] Saved media_url to post', postId);
            // Light up the notification bell
            await notifier.create(
              customerId,
              'system',
              'Your video is ready!',
              'Your AI avatar video has finished rendering and is ready to review and publish.'
            );
          } else {
            console.warn('[HeyGen Webhook] No post found for video_job_id:', videoId);
          }
        } catch (dbErr) {
          console.error('[HeyGen Webhook] DB update failed:', dbErr.message);
        }
        return;
      }

      // ── avatar_video.fail ───────────────────────────────────
      if (event_type === 'avatar_video.fail') {
        const errMsg = event_data?.msg || event_data?.message || 'Unknown error';
        console.warn('[HeyGen Webhook] Video failed:', videoId, '|', errMsg);

        try {
          const result = await pool.query(
            `UPDATE posts
             SET status = 'video_failed', updated_at = NOW()
             WHERE video_job_id = $1
             RETURNING id, customer_id`,
            [videoId]
          );
          if (result.rowCount > 0) {
            const { id: postId, customer_id: customerId } = result.rows[0];
            console.log('[HeyGen Webhook] Marked post', postId, 'as video_failed');
            await notifier.create(
              customerId,
              'system',
              'Video generation failed',
              'Your video could not be generated. Please try again or contact support.'
            );
          }
        } catch (dbErr) {
          console.error('[HeyGen Webhook] DB update for failure failed:', dbErr.message);
        }
        return;
      }

      // Unhandled event type — log and ignore
      console.log('[HeyGen Webhook] Unhandled event type:', event_type);
    } catch (err) {
      console.error('[HeyGen Webhook] Processing error:', err.message);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/webhooks/heygen/register
  // One-time call to register your webhook URL with HeyGen.
  // Call this once from Railway shell or curl:
  //   curl -X POST https://your-backend.railway.app/api/webhooks/heygen/register \
  //        -H "x-admin-secret: <ADMIN_SECRET>"
  // The response contains the webhook secret — save it as HEYGEN_WEBHOOK_SECRET in Railway.
  // ─────────────────────────────────────────────────────────────
  router.post('/heygen/register', express.json(), async (req, res) => {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) return res.status(503).json({ error: 'ADMIN_SECRET not configured on this server' });
    const provided = req.headers['x-admin-secret'] || req.body?.adminSecret;
    if (provided !== adminSecret) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'HEYGEN_API_KEY not set' });

    const backendUrl = process.env.BACKEND_URL || process.env.RAILWAY_STATIC_URL;
    if (!backendUrl) return res.status(400).json({ error: 'BACKEND_URL env var not set — add your Railway backend public URL' });

    const webhookUrl = `${backendUrl.replace(/\/$/, '')}/api/webhooks/heygen`;

    try {
      const response = await axios.post(
        'https://api.heygen.com/v1/webhook/endpoint.add',
        {
          url: webhookUrl,
          events: ['avatar_video.success', 'avatar_video.fail'],
        },
        {
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      const secret = response.data?.data?.secret;
      console.log('[HeyGen Webhook] Registered:', webhookUrl, '| secret:', secret ? '***' : 'none');

      res.json({
        success: true,
        webhookUrl,
        secret,
        instruction: secret
          ? `Add HEYGEN_WEBHOOK_SECRET=${secret} to your Railway environment variables`
          : 'No secret returned — check HeyGen dashboard',
        raw: response.data,
      });
    } catch (err) {
      const detail = err.response?.data;
      console.error('[HeyGen Webhook] Registration failed:', JSON.stringify(detail));
      res.status(500).json({ error: 'Registration failed', detail });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/webhooks/facebook  — Meta webhook verification challenge
  // Facebook calls this once when you register the webhook URL in the App dashboard.
  // Set FACEBOOK_WEBHOOK_VERIFY_TOKEN in Railway to any string you choose,
  // then copy that same string into Facebook App → Webhooks → Verify Token.
  // ─────────────────────────────────────────────────────────────
  router.get('/facebook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === FACEBOOK_WEBHOOK_VERIFY_TOKEN) {
      console.log('[MetaWebhook] Verification challenge accepted');
      return res.status(200).send(challenge);
    }
    console.warn('[MetaWebhook] Verification failed — token mismatch or wrong mode');
    res.sendStatus(403);
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/webhooks/facebook  — Meta real-time message events
  // Handles Facebook Messenger (object: "page") and Instagram (object: "instagram").
  // ACKs immediately then processes async — Meta retries if response > 20s.
  // ─────────────────────────────────────────────────────────────
  router.post('/facebook', express.raw({ type: 'application/json' }), async (req, res) => {
    res.sendStatus(200);

    try {
      if (FACEBOOK_APP_SECRET) {
        const sig = req.headers['x-hub-signature-256'];
        if (!sig) {
          console.warn('[MetaWebhook] Missing X-Hub-Signature-256 header — ignoring');
          return;
        }
        const expected = 'sha256=' + crypto.createHmac('sha256', FACEBOOK_APP_SECRET).update(req.body).digest('hex');
        if (expected !== sig) {
          console.warn('[MetaWebhook] Signature mismatch — ignoring payload');
          return;
        }
      }

      let body;
      try {
        body = JSON.parse(req.body.toString('utf8'));
      } catch {
        console.warn('[MetaWebhook] Non-JSON body received');
        return;
      }

      const { object, entry } = body;
      if (!entry || !Array.isArray(entry)) return;

      const platform = object === 'instagram' ? 'instagram' : object === 'page' ? 'facebook' : null;
      if (!platform) {
        console.log('[MetaWebhook] Unhandled object type:', object);
        return;
      }

      const dmService = new DMPollingService(pool);

      for (const pageEntry of entry) {
        const pageId = pageEntry.id;
        const messagingEvents = pageEntry.messaging || [];

        for (const event of messagingEvents) {
          if (!event.message || event.message.is_echo) continue;

          const senderId = event.sender?.id;
          const messageId = event.message?.mid;
          const messageText = event.message?.text || '';
          const timestamp = event.timestamp || Date.now();

          if (!senderId || !messageId) continue;

          await dmService.processWebhookEvent({ pageId, platform, senderId, senderName: null, messageId, messageText, timestamp });
        }
      }
    } catch (err) {
      console.error('[MetaWebhook] Processing error:', err.message);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/webhooks/tiktok  — TikTok endpoint ownership verification
  // TikTok sends timestamp, nonce, client_token query params.
  // Server must return HMAC-SHA256(sorted(nonce, timestamp), TIKTOK_APP_SECRET).
  // If TIKTOK_APP_SECRET is not set, always accepts (safe for local testing).
  // ─────────────────────────────────────────────────────────────
  router.get('/tiktok', (req, res) => {
    const { timestamp, nonce, client_token } = req.query;
    const secret = process.env.TIKTOK_APP_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[TikTokWebhook] TIKTOK_APP_SECRET not set in production — rejecting verification');
        return res.sendStatus(403);
      }
      console.log('[TikTokWebhook] Verification accepted (no TIKTOK_APP_SECRET set — dev mode only)');
      return res.sendStatus(200);
    }
    if (!timestamp || !nonce) return res.sendStatus(403);
    const sigStr = [nonce, timestamp].sort().join('\n');
    const expected = crypto.createHmac('sha256', secret).update(sigStr).digest('hex');
    if (client_token !== expected) {
      console.warn('[TikTokWebhook] Verification failed — signature mismatch');
      return res.sendStatus(403);
    }
    console.log('[TikTokWebhook] Verification challenge accepted');
    return res.status(200).send(expected);
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/webhooks/tiktok  — TikTok Business Messaging real-time events
  // Requires TikTok Business Messaging Partner Program approval.
  // Event type handled: messaging.message (inbound message from TikTok user)
  // ─────────────────────────────────────────────────────────────
  router.post('/tiktok', express.raw({ type: 'application/json' }), async (req, res) => {
    res.sendStatus(200);

    try {
      const secret = process.env.TIKTOK_APP_SECRET;
      if (!secret && process.env.NODE_ENV === 'production') {
        console.error('[TikTokWebhook] TIKTOK_APP_SECRET not set in production — ignoring payload');
        return;
      }
      if (secret) {
        const sig = req.headers['x-tiktok-signature'];
        const ts = req.headers['x-tiktok-timestamp'] || '';
        if (!sig) {
          console.warn('[TikTokWebhook] Missing x-tiktok-signature header — ignoring');
          return;
        }
        const expected = crypto.createHmac('sha256', secret).update(ts + req.body.toString()).digest('hex');
        if (expected !== sig) {
          console.warn('[TikTokWebhook] Signature mismatch — ignoring payload');
          return;
        }
      }

      let body;
      try {
        body = JSON.parse(req.body.toString('utf8'));
      } catch {
        console.warn('[TikTokWebhook] Non-JSON body received');
        return;
      }

      const { event, data } = body;
      if (event !== 'messaging.message' || !data) {
        console.log('[TikTokWebhook] Unhandled event type:', event);
        return;
      }

      const {
        business_id: pageId,
        conversation_id: convId,
        sender_open_id: senderId,
        message_id: messageId,
        create_time: ts,
        content,
      } = data;
      const messageText = content?.body?.text || content?.text || '';
      if (!pageId || !convId || !messageId) return;

      const dmService = new DMPollingService(pool);
      await dmService.processWebhookEvent({
        pageId,
        platform: 'tiktok',
        senderId: senderId || convId,
        senderName: null,
        messageId,
        messageText,
        timestamp: ts ? ts * 1000 : Date.now(),
        threadId: convId, // TikTok canonical thread = conversation_id
      });
    } catch (err) {
      console.error('[TikTokWebhook] Processing error:', err.message);
    }
  });

  return router;
};
