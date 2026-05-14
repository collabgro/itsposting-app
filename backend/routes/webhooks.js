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
    const adminSecret = process.env.ADMIN_SECRET || process.env.JWT_SECRET;
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
      console.log('[HeyGen Webhook] Registered:', webhookUrl, '| secret:', secret);

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

  return router;
};
