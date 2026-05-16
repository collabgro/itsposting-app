'use strict';

const express             = require('express');
const { authenticate }    = require('../middleware/auth');
const ReceptionistService = require('../services/ReceptionistService');
const OutboundQueue       = require('../services/OutboundQueue');

function getDefaultAutomations() {
  return [
    { type: 'follow_up',      enabled: true,  label: 'Lead follow-up',    description: "Sent to leads who haven't replied after the delay window.", delay_hours: 48, channel: 'sms', message_template: "Hi {name}! Just checking in from {business_name}. Did you get a chance to sort out your inquiry? We have openings this week if you're still looking." },
    { type: 'review_request', enabled: true,  label: 'Review request',    description: 'Sent after you mark a job as completed.',                   delay_hours: 4,  channel: 'sms', message_template: "Hi {name}! Glad we could help today. Would you mind leaving us a quick Google review? It really helps small businesses like ours. {booking_link}" },
    { type: 'noshow',         enabled: true,  label: 'No-show follow-up', description: 'Sent when a customer misses their appointment.',            delay_hours: 2,  channel: 'sms', message_template: "Hi {name}, we missed you today! Would you like to reschedule? Here's our booking link: {booking_link}" },
    { type: 'seasonal',       enabled: false, label: 'Seasonal campaign', description: 'Broadcast to past customers — configure before enabling.',  delay_hours: 0,  channel: 'sms', message_template: "Hi {name}, just a seasonal update from {business_name}. {booking_link}" },
  ];
}

module.exports = (pool) => {
  const router = express.Router();
  const receptionistSvc = new ReceptionistService(pool);
  const outboundQueue = new OutboundQueue(pool);
  router.use(authenticate);

  // ── GET /api/receptionist/config ─────────────────────────────────
  router.get('/config', async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM receptionist_config WHERE customer_id=$1`, [req.customerId]
      );
      if (!rows[0]) return res.json({ config: null });

      const cfg = rows[0];
      // Never expose raw secrets — return masked booleans instead
      res.json({
        config: {
          ...cfg,
          twilio_auth_token: undefined,
          calcom_api_key: undefined,
          mailgun_api_key: undefined,
          meta_wa_access_token: undefined,
          has_twilio_configured: !!(cfg.twilio_account_sid && cfg.twilio_auth_token && cfg.twilio_phone_number),
          has_calcom_configured: !!cfg.calcom_api_key,
          has_mailgun_configured: !!(cfg.mailgun_api_key && cfg.mailgun_domain),
          has_meta_wa_configured: !!(cfg.meta_wa_phone_number_id && cfg.meta_wa_access_token),
          // Expose non-secret fields for pre-filling configure forms
          twilio_account_sid: cfg.twilio_account_sid || null,
          twilio_phone_number: cfg.twilio_phone_number || null,
          twilio_whatsapp_number: cfg.twilio_whatsapp_number || null,
          booking_link: cfg.booking_link || null,
          mailgun_domain: cfg.mailgun_domain || null,
          mailgun_from_email: cfg.mailgun_from_email || null,
          meta_wa_phone_number_id: cfg.meta_wa_phone_number_id || null,
          meta_wa_business_id: cfg.meta_wa_business_id || null,
          automation_config: cfg.automation_config || getDefaultAutomations(),
        },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/receptionist/config ────────────────────────────────
  // Create or update (upsert) receptionist config
  router.post('/config', async (req, res) => {
    try {
      const {
        enabled, autoHandle, activePlatforms, tone,
        escalateKeywords, bookingLink,
        businessHoursStart, businessHoursEnd, timezone, afterHoursMessage,
        // Per-customer credentials
        twilioAccountSid, twilioAuthToken, twilioPhoneNumber, twilioWhatsappNumber,
        calcomApiKey,
        mailgunApiKey, mailgunDomain, mailgunFromEmail,
        automationConfig,
        // Meta WhatsApp Business API credentials
        metaWaPhoneNumberId, metaWaAccessToken, metaWaBusinessId,
      } = req.body;

      const { rows } = await pool.query(
        `INSERT INTO receptionist_config
           (customer_id, enabled, auto_handle, active_platforms, tone,
            escalate_keywords, booking_link,
            business_hours_start, business_hours_end, timezone, after_hours_message,
            twilio_account_sid, twilio_auth_token, twilio_phone_number, twilio_whatsapp_number,
            calcom_api_key, mailgun_api_key, mailgun_domain, mailgun_from_email,
            automation_config,
            meta_wa_phone_number_id, meta_wa_access_token, meta_wa_business_id,
            created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,NOW(),NOW())
         ON CONFLICT (customer_id) DO UPDATE SET
           enabled = COALESCE(EXCLUDED.enabled, receptionist_config.enabled),
           auto_handle = COALESCE(EXCLUDED.auto_handle, receptionist_config.auto_handle),
           active_platforms = COALESCE(EXCLUDED.active_platforms, receptionist_config.active_platforms),
           tone = COALESCE(EXCLUDED.tone, receptionist_config.tone),
           escalate_keywords = COALESCE(EXCLUDED.escalate_keywords, receptionist_config.escalate_keywords),
           booking_link = COALESCE(EXCLUDED.booking_link, receptionist_config.booking_link),
           business_hours_start = COALESCE(EXCLUDED.business_hours_start, receptionist_config.business_hours_start),
           business_hours_end = COALESCE(EXCLUDED.business_hours_end, receptionist_config.business_hours_end),
           timezone = COALESCE(EXCLUDED.timezone, receptionist_config.timezone),
           after_hours_message = COALESCE(EXCLUDED.after_hours_message, receptionist_config.after_hours_message),
           twilio_account_sid = COALESCE(EXCLUDED.twilio_account_sid, receptionist_config.twilio_account_sid),
           twilio_auth_token = COALESCE(EXCLUDED.twilio_auth_token, receptionist_config.twilio_auth_token),
           twilio_phone_number = COALESCE(EXCLUDED.twilio_phone_number, receptionist_config.twilio_phone_number),
           twilio_whatsapp_number = COALESCE(EXCLUDED.twilio_whatsapp_number, receptionist_config.twilio_whatsapp_number),
           calcom_api_key = COALESCE(EXCLUDED.calcom_api_key, receptionist_config.calcom_api_key),
           mailgun_api_key = COALESCE(EXCLUDED.mailgun_api_key, receptionist_config.mailgun_api_key),
           mailgun_domain = COALESCE(EXCLUDED.mailgun_domain, receptionist_config.mailgun_domain),
           mailgun_from_email = COALESCE(EXCLUDED.mailgun_from_email, receptionist_config.mailgun_from_email),
           automation_config = COALESCE(EXCLUDED.automation_config, receptionist_config.automation_config),
           meta_wa_phone_number_id = COALESCE(EXCLUDED.meta_wa_phone_number_id, receptionist_config.meta_wa_phone_number_id),
           meta_wa_access_token = COALESCE(EXCLUDED.meta_wa_access_token, receptionist_config.meta_wa_access_token),
           meta_wa_business_id = COALESCE(EXCLUDED.meta_wa_business_id, receptionist_config.meta_wa_business_id),
           updated_at = NOW()
         RETURNING *`,
        [
          req.customerId,
          enabled ?? null,
          autoHandle ?? null,
          activePlatforms ? JSON.stringify(activePlatforms) : null,
          tone || null,
          escalateKeywords ? JSON.stringify(escalateKeywords) : null,
          bookingLink || null,
          businessHoursStart || null,
          businessHoursEnd || null,
          timezone || null,
          afterHoursMessage || null,
          twilioAccountSid || null,
          twilioAuthToken || null,
          twilioPhoneNumber || null,
          twilioWhatsappNumber || null,
          calcomApiKey || null,
          mailgunApiKey || null,
          mailgunDomain || null,
          mailgunFromEmail || null,
          automationConfig ? JSON.stringify(automationConfig) : null,
          metaWaPhoneNumberId || null,
          metaWaAccessToken || null,
          metaWaBusinessId || null,
        ]
      );

      const cfg = rows[0];
      res.json({
        success: true,
        config: {
          ...cfg,
          twilio_auth_token: undefined,
          calcom_api_key: undefined,
          mailgun_api_key: undefined,
          meta_wa_access_token: undefined,
          has_twilio_configured: !!(cfg.twilio_account_sid && cfg.twilio_auth_token && cfg.twilio_phone_number),
          has_calcom_configured: !!cfg.calcom_api_key,
          has_mailgun_configured: !!(cfg.mailgun_api_key && cfg.mailgun_domain),
          has_meta_wa_configured: !!(cfg.meta_wa_phone_number_id && cfg.meta_wa_access_token),
          twilio_account_sid: cfg.twilio_account_sid || null,
          twilio_phone_number: cfg.twilio_phone_number || null,
          twilio_whatsapp_number: cfg.twilio_whatsapp_number || null,
          booking_link: cfg.booking_link || null,
          mailgun_domain: cfg.mailgun_domain || null,
          mailgun_from_email: cfg.mailgun_from_email || null,
          meta_wa_phone_number_id: cfg.meta_wa_phone_number_id || null,
          meta_wa_business_id: cfg.meta_wa_business_id || null,
          automation_config: cfg.automation_config || getDefaultAutomations(),
        },
      });
    } catch (err) {
      console.error('[receptionist] config upsert:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/receptionist/stats ──────────────────────────────────
  router.get('/stats', async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [dmStats, escalated, pending, smsStats] = await Promise.all([
        pool.query(
          `SELECT COUNT(*) AS ai_handled_today
           FROM dm_messages dm
           JOIN dm_conversations dc ON dc.id = dm.conversation_id
           WHERE dc.customer_id=$1 AND dm.ai_handled=true
             AND dm.sent_at::date = $2::date`,
          [req.customerId, today]
        ),
        pool.query(
          `SELECT COUNT(*) AS escalated
           FROM dm_conversations WHERE customer_id=$1 AND status='escalated'`,
          [req.customerId]
        ),
        pool.query(
          `SELECT COUNT(*) AS pending
           FROM dm_conversations WHERE customer_id=$1 AND status='open' AND is_read=false`,
          [req.customerId]
        ),
        pool.query(
          `SELECT COUNT(*) AS sms_handled
           FROM sms_messages sm
           JOIN sms_conversations sc ON sc.id=sm.conversation_id
           WHERE sc.customer_id=$1 AND sm.ai_handled=true
             AND sm.sent_at::date=$2::date`,
          [req.customerId, today]
        ).catch(() => ({ rows: [{ sms_handled: 0 }] })),
      ]);

      res.json({
        aiHandledToday: parseInt(dmStats.rows[0]?.ai_handled_today || 0) + parseInt(smsStats.rows[0]?.sms_handled || 0),
        escalatedOpen: parseInt(escalated.rows[0]?.escalated || 0),
        pendingUnread: parseInt(pending.rows[0]?.pending || 0),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/receptionist/conversations ─────────────────────────
  // Unified view: DMs + SMS (Phase 2 adds SMS)
  router.get('/conversations', async (req, res) => {
    try {
      const { status, platform, page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const conditions = ['dc.customer_id=$1'];
      const params = [req.customerId];
      let idx = 2;

      if (status) { conditions.push(`dc.status=$${idx}`); params.push(status); idx++; }
      if (platform) { conditions.push(`dc.platform=$${idx}`); params.push(platform); idx++; }

      const { rows } = await pool.query(
        `SELECT dc.*, dm.message_text AS last_message, dm.sent_at AS last_message_at_msg,
                dm.ai_handled AS last_ai_handled
         FROM dm_conversations dc
         LEFT JOIN LATERAL (
           SELECT message_text, sent_at, ai_handled
           FROM dm_messages WHERE conversation_id=dc.id
           ORDER BY COALESCE(sent_at, created_at) DESC LIMIT 1
         ) dm ON true
         WHERE ${conditions.join(' AND ')}
         ORDER BY dc.last_message_at DESC NULLS LAST
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, parseInt(limit), offset]
      );

      const count = await pool.query(
        `SELECT COUNT(*) FROM dm_conversations dc WHERE ${conditions.join(' AND ')}`,
        params
      );

      res.json({ conversations: rows, total: parseInt(count.rows[0].count), page: parseInt(page) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/receptionist/test ──────────────────────────────────
  // Test the AI receptionist brain with a message (no actual DM sent)
  router.post('/test', async (req, res) => {
    try {
      const { message } = req.body;
      if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

      if (!receptionistSvc.anthropic) {
        return res.status(503).json({ error: 'AI is not configured. Ensure ANTHROPIC_API_KEY is set in your environment.' });
      }

      const systemPrompt = await receptionistSvc.buildSystemPrompt(req.customerId);
      const intent = receptionistSvc.classifyIntent(message);

      const response = await receptionistSvc.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        temperature: 0.4,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      });

      const reply = response.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
      const configRes = await pool.query(
        `SELECT escalate_keywords FROM receptionist_config WHERE customer_id=$1`, [req.customerId]
      );
      const escalateKw = configRes.rows[0]?.escalate_keywords || [];

      res.json({
        reply,
        intent,
        wouldEscalate: receptionistSvc.shouldEscalate(intent, message, escalateKw),
      });
    } catch (err) {
      console.error('[receptionist] test:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── PATCH /api/receptionist/conversations/:id/stage ──────────────
  // Update receptionist_stage on a contact linked to a conversation
  router.patch('/conversations/:id/stage', async (req, res) => {
    try {
      const { stage } = req.body;
      const validStages = ['new', 'contacted', 'qualified', 'booked', 'completed', 'review_requested', 'reviewed'];
      if (!validStages.includes(stage)) return res.status(400).json({ error: 'Invalid stage' });

      // Link conversation → contact via phone/sender_id
      await pool.query(
        `UPDATE contacts SET receptionist_stage=$1, updated_at=NOW()
         WHERE customer_id=$2 AND id=(
           SELECT c.id FROM contacts c
           JOIN dm_conversations dc ON dc.sender_id = c.platform_id
           WHERE dc.id=$3 AND c.customer_id=$2 LIMIT 1
         )`,
        [stage, req.customerId, req.params.id]
      ).catch(() => {}); // Non-fatal if no linked contact

      // Auto-schedule review request when job marked as completed
      if (stage === 'completed') {
        const contactRes = await pool.query(
          `SELECT c.id FROM contacts c
           JOIN dm_conversations dc ON dc.sender_id = c.platform_id
           WHERE dc.id=$1 AND c.customer_id=$2 LIMIT 1`,
          [req.params.id, req.customerId]
        ).catch(() => ({ rows: [] }));
        const contactId = contactRes.rows[0]?.id;
        if (contactId) {
          outboundQueue.scheduleReviewRequest(contactId, req.customerId).catch(err =>
            console.warn('[receptionist] review request schedule:', err.message)
          );
        }
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/receptionist/leads ──────────────────────────────────
  // Contacts with a receptionist_stage set
  router.get('/leads', async (req, res) => {
    try {
      const { stage, page = 1, limit = 30 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const conditions = ['customer_id=$1', 'receptionist_stage IS NOT NULL'];
      const params = [req.customerId];
      let idx = 2;

      if (stage) { conditions.push(`receptionist_stage=$${idx}`); params.push(stage); idx++; }

      const { rows } = await pool.query(
        `SELECT id, name, email, phone, receptionist_stage, appointment_at, last_ai_summary,
                created_at, updated_at
         FROM contacts
         WHERE ${conditions.join(' AND ')}
         ORDER BY updated_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, parseInt(limit), offset]
      );

      const count = await pool.query(
        `SELECT receptionist_stage, COUNT(*) FROM contacts WHERE customer_id=$1 AND receptionist_stage IS NOT NULL GROUP BY receptionist_stage`,
        [req.customerId]
      );

      const stageCounts = {};
      count.rows.forEach(r => { stageCounts[r.receptionist_stage] = parseInt(r.count); });

      res.json({ leads: rows, stageCounts });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/receptionist/review-actions ────────────────────────
  // Returns unread review notifications; creates them for new reviews found in knowledge base
  router.get('/review-actions', async (req, res) => {
    try {
      // Find recent 4-5 star reviews in business_knowledge that don't yet have a notification
      const { rows: reviews } = await pool.query(
        `SELECT id, title, content, created_at FROM business_knowledge
         WHERE customer_id=$1 AND knowledge_type='reviews' AND is_active=true
           AND created_at > NOW() - INTERVAL '30 days'
           AND id NOT IN (
             SELECT (message::json->>'knowledge_id')::int
             FROM notifications
             WHERE customer_id=$1 AND type='new_review'
               AND message LIKE '%"knowledge_id"%'
           )
         ORDER BY created_at DESC LIMIT 5`,
        [req.customerId]
      );

      // Create notifications for each unnotified review
      for (const review of reviews) {
        const excerpt = typeof review.content === 'string'
          ? review.content.replace(/[{}"\\]/g, '').substring(0, 120)
          : String(review.content).substring(0, 120);
        await pool.query(
          `INSERT INTO notifications (customer_id, type, title, message)
           VALUES ($1, 'new_review', $2, $3)
           ON CONFLICT DO NOTHING`,
          [
            req.customerId,
            `New review: "${review.title}"`,
            JSON.stringify({ knowledge_id: review.id, excerpt }),
          ]
        ).catch(() => {});
      }

      // Return unread review notifications
      const { rows: notifs } = await pool.query(
        `SELECT id, title, message, created_at FROM notifications
         WHERE customer_id=$1 AND type='new_review' AND read=false
         ORDER BY created_at DESC LIMIT 10`,
        [req.customerId]
      );

      const actions = notifs.map(n => {
        let data = {};
        try { data = JSON.parse(n.message); } catch (_) {}
        return {
          id: n.id,
          title: n.title,
          excerpt: data.excerpt || '',
          knowledgeId: data.knowledge_id,
          createdAt: n.created_at,
        };
      });

      res.json({ actions });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/receptionist/review-actions/:id/skip ───────────────
  // Mark a review notification as read (user dismissed it)
  router.post('/review-actions/:id/skip', async (req, res) => {
    try {
      await pool.query(
        `UPDATE notifications SET read=true WHERE id=$1 AND customer_id=$2 AND type='new_review'`,
        [req.params.id, req.customerId]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/receptionist/test-twilio ───────────────────────────
  router.post('/test-twilio', async (req, res) => {
    try {
      const { accountSid, authToken } = req.body;
      if (!accountSid || !authToken) return res.json({ success: false, error: 'Account SID and Auth Token required' });
      const twilio = require('twilio');
      const client = twilio(accountSid, authToken);
      const account = await client.api.accounts(accountSid).fetch();
      res.json({ success: true, detail: `Connected as "${account.friendlyName}" (${account.status})` });
    } catch (err) {
      res.json({ success: false, error: err.message || 'Invalid Twilio credentials' });
    }
  });

  // ── POST /api/receptionist/test-mailgun ──────────────────────────
  router.post('/test-mailgun', async (req, res) => {
    try {
      const { apiKey, domain } = req.body;
      if (!apiKey || !domain) return res.json({ success: false, error: 'API key and domain required' });
      const axios = require('axios');
      const resp = await axios.get(`https://api.mailgun.net/v3/domains/${domain}`, {
        auth: { username: 'api', password: apiKey },
        timeout: 10000,
      });
      const state = resp.data?.state || 'active';
      res.json({ success: true, detail: `Domain "${domain}" is ${state}` });
    } catch (err) {
      const status = err.response?.status;
      const msg = status === 401 ? 'Invalid API key'
        : status === 404 ? `Domain "${req.body.domain}" not found in Mailgun`
        : err.message;
      res.json({ success: false, error: msg });
    }
  });

  // ── POST /api/receptionist/test-whatsapp ─────────────────────────
  router.post('/test-whatsapp', async (req, res) => {
    try {
      const { phoneNumberId, accessToken } = req.body;
      if (!phoneNumberId || !accessToken) return res.json({ success: false, error: 'Phone Number ID and Access Token required' });
      const axios = require('axios');
      const resp = await axios.get(`https://graph.facebook.com/v21.0/${phoneNumberId}`, {
        params: { access_token: accessToken },
        timeout: 10000,
      });
      const name = resp.data?.display_phone_number || resp.data?.verified_name || phoneNumberId;
      res.json({ success: true, detail: `Connected — WhatsApp number: ${name}` });
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Invalid credentials';
      res.json({ success: false, error: msg });
    }
  });

  // ── POST /api/receptionist/test-calcom ───────────────────────────
  router.post('/test-calcom', async (req, res) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey) return res.json({ success: false, error: 'API key required' });
      const axios = require('axios');
      const resp = await axios.get('https://api.cal.com/v1/me', {
        params: { apiKey },
        timeout: 10000,
      });
      const user = resp.data?.user;
      res.json({ success: true, detail: `Connected as ${user?.name || user?.email || 'Cal.com user'}` });
    } catch (err) {
      const msg = err.response?.status === 401 ? 'Invalid API key' : err.message;
      res.json({ success: false, error: msg });
    }
  });

  return router;
};
