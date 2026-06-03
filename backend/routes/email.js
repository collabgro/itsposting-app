/**
 * Email routes — unsubscribe handling + Resend bounce/complaint webhook.
 *
 * GET  /api/email/unsubscribe       — browser click from List-Unsubscribe header
 * POST /api/email/unsubscribe       — RFC 8058 one-click (email client auto-posts)
 * POST /api/email/resend-webhook    — Resend bounce/complaint events
 *
 * Setup in Resend dashboard:
 *   Endpoint: POST https://api.itsposting.com/api/email/resend-webhook
 *   Events: email.bounced, email.complained, email.delivered (optional)
 *   Copy the signing secret and set RESEND_WEBHOOK_SECRET=whsec_xxxxx in Railway env
 */

const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();

const APP_URL = process.env.FRONTEND_URL || 'https://app.itsposting.com';

function unsubToken(email) {
  const secret = process.env.JWT_SECRET || 'itsposting-unsub-fallback';
  return crypto.createHmac('sha256', secret).update(email.toLowerCase().trim()).digest('hex').slice(0, 24);
}

const UNSUB_PAGE = (email) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Unsubscribed — ItsPosting</title>
  <style>
    *{box-sizing:border-box;}
    body{margin:0;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F5F3FF;min-height:100vh;display:flex;align-items:center;justify-content:center;}
    .card{background:#fff;border-radius:12px;padding:48px 40px;max-width:440px;width:100%;text-align:center;border:1px solid #EDE9FE;}
    .icon{width:52px;height:52px;background:#D1FAE5;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:22px;}
    h1{margin:0 0 12px;font-size:22px;font-weight:800;color:#111827;}
    p{margin:0 0 24px;font-size:15px;color:#6B7280;line-height:1.6;}
    a{color:#7C5CFC;text-decoration:none;font-size:14px;font-weight:500;}
    a:hover{text-decoration:underline;}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>You're unsubscribed</h1>
    <p>We've removed <strong style="color:#111827;">${email}</strong> from ItsPosting marketing emails. You'll still receive transactional emails like receipts and security alerts.</p>
    <a href="${APP_URL}/settings">Manage email preferences →</a>
  </div>
</body>
</html>`;

module.exports = function emailRoutes(pool) {

  // ── GET /api/email/unsubscribe ───────────────────────────────────────────────
  // Browser click from List-Unsubscribe header — renders confirmation page.
  router.get('/unsubscribe', async (req, res) => {
    const { email, t } = req.query;
    if (!email || !t) {
      return res.status(400).send('Invalid unsubscribe link — the link may have expired.');
    }
    if (t !== unsubToken(email)) {
      return res.status(400).send('This unsubscribe link is invalid or has expired.');
    }
    try {
      await pool.query(
        `UPDATE customers SET marketing_emails_opt_out = TRUE WHERE LOWER(email) = LOWER($1)`,
        [email]
      );
      res.send(UNSUB_PAGE(email));
    } catch (err) {
      console.error('[EmailUnsub] DB error:', err.message);
      res.status(500).send('Something went wrong. Please try again or contact support@itsposting.com');
    }
  });

  // ── POST /api/email/unsubscribe ──────────────────────────────────────────────
  // RFC 8058 one-click unsubscribe — email client auto-submits this POST.
  // Must return 2xx within a few seconds; no redirect required.
  router.post('/unsubscribe', express.urlencoded({ extended: false }), async (req, res) => {
    const { email, t } = req.query;
    if (!email || !t || t !== unsubToken(email)) {
      return res.status(400).json({ error: 'Invalid or expired unsubscribe token' });
    }
    try {
      await pool.query(
        `UPDATE customers SET marketing_emails_opt_out = TRUE WHERE LOWER(email) = LOWER($1)`,
        [email]
      );
      res.json({ unsubscribed: true });
    } catch (err) {
      console.error('[EmailUnsub] DB error:', err.message);
      res.status(500).json({ error: 'Server error — please try again' });
    }
  });

  // ── POST /api/email/resend-webhook ───────────────────────────────────────────
  // Resend webhook events (bounce, complaint, delivered, etc.).
  // Uses Svix signing — configure RESEND_WEBHOOK_SECRET in Railway env.
  // Setup: Resend dashboard → Webhooks → Add endpoint → select email.bounced + email.complained
  router.post('/resend-webhook', express.json({ type: 'application/json' }), async (req, res) => {
    const secret = process.env.RESEND_WEBHOOK_SECRET;

    if (secret) {
      const svixId        = req.headers['svix-id'];
      const svixTimestamp = req.headers['svix-timestamp'];
      const svixSig       = req.headers['svix-signature'];

      if (!svixId || !svixTimestamp || !svixSig) {
        return res.status(401).json({ error: 'Missing Svix signature headers' });
      }

      // Reject requests older than 5 minutes (replay attack protection)
      const ts = parseInt(svixTimestamp, 10);
      if (Math.abs(Date.now() / 1000 - ts) > 300) {
        return res.status(401).json({ error: 'Webhook timestamp too old' });
      }

      try {
        const rawBody      = JSON.stringify(req.body);
        const signedString = `${svixId}.${svixTimestamp}.${rawBody}`;
        const secretBytes  = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
        const computed     = crypto.createHmac('sha256', secretBytes).update(signedString).digest('base64');
        const provided     = svixSig.split(' ').map(s => s.split(',').pop()).filter(Boolean);
        if (!provided.includes(computed)) {
          return res.status(401).json({ error: 'Webhook signature mismatch' });
        }
      } catch {
        return res.status(401).json({ error: 'Signature verification failed' });
      }
    }

    // Acknowledge immediately — process async (Resend retries on non-2xx)
    res.json({ received: true });

    const { type, data } = req.body || {};
    if (!type || !data) return;

    const toEmail = Array.isArray(data.to) ? data.to[0] : (data.to || data.email);
    if (!toEmail || typeof toEmail !== 'string') return;

    try {
      if (type === 'email.bounced') {
        // Hard bounce — never send to this address again; also opts out marketing
        await pool.query(
          `UPDATE customers
           SET email_hard_bounced = TRUE,
               email_bounce_at    = NOW(),
               marketing_emails_opt_out = TRUE
           WHERE LOWER(email) = LOWER($1)`,
          [toEmail]
        );
        console.log(`[ResendWebhook] Hard bounce suppressed: ${toEmail}`);
      } else if (type === 'email.complained') {
        // Spam complaint — opt out of all marketing emails immediately
        await pool.query(
          `UPDATE customers SET marketing_emails_opt_out = TRUE WHERE LOWER(email) = LOWER($1)`,
          [toEmail]
        );
        console.log(`[ResendWebhook] Spam complaint — opted out: ${toEmail}`);
      }
    } catch (err) {
      console.error('[ResendWebhook] DB error:', err.message);
    }
  });

  return router;
};
