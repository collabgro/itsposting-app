'use strict';

const express              = require('express');
const axios                = require('axios');
const { authenticate }     = require('../middleware/auth');
const Anthropic            = require('@anthropic-ai/sdk');

module.exports = (pool) => {
  const router = express.Router();
  const claude = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

  router.use(authenticate);

  // ── GET /api/inbox ────────────────────────────────────────────────────────
  router.get('/', async (req, res) => {
    try {
      const { platform, read } = req.query;
      let q = `
        SELECT m.*, p.caption AS post_caption, p.media_url AS post_media_url
        FROM inbox_messages m
        LEFT JOIN posts p ON m.post_id = p.id
        WHERE m.customer_id = $1
      `;
      const params = [req.customerId];
      let i = 1;
      if (platform && platform !== 'all') { i++; q += ` AND m.platform = $${i}`; params.push(platform); }
      if (read === 'false') { q += ` AND m.is_read = false`; }
      q += ` ORDER BY m.received_at DESC LIMIT 100`;

      const [messages, unread] = await Promise.all([
        pool.query(q, params),
        pool.query('SELECT COUNT(*) FROM inbox_messages WHERE customer_id = $1 AND is_read = false', [req.customerId]),
      ]);

      res.json({ messages: messages.rows, unreadCount: parseInt(unread.rows[0].count) });
    } catch (err) {
      console.error('[inbox] GET /:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/inbox/sync ──────────────────────────────────────────────────
  router.post('/sync', async (req, res) => {
    try {
      const accounts = await pool.query(
        `SELECT platform, access_token, account_id
         FROM social_accounts
         WHERE customer_id = $1 AND enabled = true`,
        [req.customerId]
      );

      let newCount = 0;

      for (const account of accounts.rows) {
        try {
          if (account.platform === 'facebook' && account.access_token) {
            newCount += await syncFacebookComments(pool, req.customerId, account);
          }
        } catch (syncErr) {
          console.error(`[inbox] sync error for ${account.platform}:`, syncErr.message);
        }
      }

      res.json({ success: true, newMessages: newCount });
    } catch (err) {
      console.error('[inbox] POST /sync:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── PATCH /api/inbox/:id/read ─────────────────────────────────────────────
  router.patch('/:id/read', async (req, res) => {
    try {
      await pool.query(
        'UPDATE inbox_messages SET is_read = true WHERE id = $1 AND customer_id = $2',
        [req.params.id, req.customerId]
      );
      res.json({ success: true });
    } catch (err) {
      console.error('[inbox] PATCH /:id/read:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/inbox/:id/reply ─────────────────────────────────────────────
  router.post('/:id/reply', async (req, res) => {
    try {
      const { replyText } = req.body;
      if (!replyText?.trim()) return res.status(400).json({ error: 'replyText required' });

      await pool.query(
        `UPDATE inbox_messages
         SET reply_text = $1, replied_at = NOW(), is_read = true
         WHERE id = $2 AND customer_id = $3`,
        [replyText, req.params.id, req.customerId]
      );
      res.json({ success: true });
    } catch (err) {
      console.error('[inbox] POST /:id/reply:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/inbox/ai-reply ──────────────────────────────────────────────
  router.post('/ai-reply', async (req, res) => {
    try {
      const { messageId, tone = 'friendly' } = req.body;
      if (!messageId) return res.status(400).json({ error: 'messageId required' });

      const [msgRes, custRes] = await Promise.all([
        pool.query('SELECT * FROM inbox_messages WHERE id = $1 AND customer_id = $2', [messageId, req.customerId]),
        pool.query('SELECT business_name, industry, tone FROM customers WHERE id = $1', [req.customerId]),
      ]);

      if (!msgRes.rows.length) return res.status(404).json({ error: 'Message not found' });

      const msg      = msgRes.rows[0];
      const customer = custRes.rows[0];

      if (!claude) {
        return res.json({ suggestedReply: 'Thank you for your comment! We appreciate you reaching out. Please give us a call and we would be happy to help.' });
      }

      const response = await claude.messages.create({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 300,
        system:     `You are a reply assistant for ${customer.business_name || 'a local service business'} in the ${customer.industry || 'home services'} industry. Write a ${tone} reply to this social media comment. Be genuine and brief (1-3 sentences max). Never use marketing jargon. Sound like a real local business owner.`,
        messages:   [{ role: 'user', content: `Write a reply to this comment: "${msg.message_text}"` }],
      });

      res.json({ suggestedReply: response.content[0].text });
    } catch (err) {
      console.error('[inbox] POST /ai-reply:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};

async function syncFacebookComments(pool, customerId, account) {
  let newCount = 0;
  try {
    const pagesRes = await axios.get(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${account.access_token}`
    );
    for (const page of (pagesRes.data.data || []).slice(0, 3)) {
      const feedRes = await axios.get(
        `https://graph.facebook.com/v18.0/${page.id}/feed?fields=id,message,comments{message,from,created_time}&access_token=${page.access_token}&limit=10`
      );
      for (const post of (feedRes.data.data || [])) {
        for (const comment of (post.comments?.data || [])) {
          try {
            await pool.query(
              `INSERT INTO inbox_messages
                 (customer_id, platform, platform_message_id, sender_name,
                  message_text, received_at, is_read, message_type)
               VALUES ($1, $2, $3, $4, $5, $6, false, 'comment')
               ON CONFLICT (platform_message_id) DO NOTHING`,
              [customerId, 'facebook', comment.id, comment.from?.name || 'Someone',
               comment.message, comment.created_time]
            );
            newCount++;
          } catch { /* duplicate — ignore */ }
        }
      }
    }
  } catch (err) {
    console.error('[inbox] Facebook sync error:', err.message);
  }
  return newCount;
}
