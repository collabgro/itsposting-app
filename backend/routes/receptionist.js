'use strict';

const express             = require('express');
const { authenticate }    = require('../middleware/auth');
const ReceptionistService = require('../services/ReceptionistService');

module.exports = (pool) => {
  const router = express.Router();
  const receptionistSvc = new ReceptionistService(pool);
  router.use(authenticate);

  // ── GET /api/receptionist/config ─────────────────────────────────
  router.get('/config', async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM receptionist_config WHERE customer_id=$1`, [req.customerId]
      );
      if (!rows[0]) return res.json({ config: null });

      const cfg = rows[0];
      res.json({
        config: {
          ...cfg,
          booking_link: cfg.booking_link || null,
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
      } = req.body;

      const { rows } = await pool.query(
        `INSERT INTO receptionist_config
           (customer_id, enabled, auto_handle, active_platforms, tone,
            escalate_keywords, booking_link,
            business_hours_start, business_hours_end, timezone, after_hours_message,
            created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
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
        ]
      );

      const cfg = rows[0];
      res.json({
        success: true,
        config: {
          ...cfg,
          booking_link: cfg.booking_link || null,
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

      const [dmStats, escalated, pending] = await Promise.all([
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
      ]);

      res.json({
        aiHandledToday: parseInt(dmStats.rows[0]?.ai_handled_today || 0),
        escalatedOpen: parseInt(escalated.rows[0]?.escalated || 0),
        pendingUnread: parseInt(pending.rows[0]?.pending || 0),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/receptionist/conversations ─────────────────────────
  router.get('/conversations', async (req, res) => {
    try {
      const { status, platform, page = 1, limit = 20 } = req.query;
      const safeLimit = Math.min(parseInt(limit) || 20, 100);
      const offset = (parseInt(page) - 1) * safeLimit;

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
        [...params, safeLimit, offset]
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

  return router;
};
