const express = require('express');
const { authenticate } = require('../middleware/auth');
const WebPushService = require('../services/WebPushService');

module.exports = (pool) => {
  const router = express.Router();
  router.use(authenticate);

  // GET /api/notifications — list for current user
  router.get('/', async (req, res) => {
    try {
      const { limit = 30 } = req.query;
      const safeLimit = Math.min(parseInt(limit) || 30, 100);
      const [rows, unread] = await Promise.all([
        pool.query(
          `SELECT id, type, title, message, read, created_at FROM notifications
           WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2`,
          [req.customerId, safeLimit]
        ),
        pool.query(
          `SELECT COUNT(*) FROM notifications WHERE customer_id = $1 AND read = false`,
          [req.customerId]
        ),
      ]);
      res.json({ notifications: rows.rows, unread: parseInt(unread.rows[0].count) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // PATCH /api/notifications/:id/read
  router.patch('/:id/read', async (req, res) => {
    try {
      await pool.query(
        `UPDATE notifications SET read = true WHERE id = $1 AND customer_id = $2`,
        [req.params.id, req.customerId]
      );
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // PATCH /api/notifications/read-all
  router.patch('/read-all', async (req, res) => {
    try {
      await pool.query(
        `UPDATE notifications SET read = true WHERE customer_id = $1 AND read = false`,
        [req.customerId]
      );
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // DELETE /api/notifications/:id
  router.delete('/:id', async (req, res) => {
    try {
      await pool.query(
        'DELETE FROM notifications WHERE id = $1 AND customer_id = $2',
        [req.params.id, req.customerId]
      );
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── WEB PUSH SUBSCRIPTION ──

  // GET /api/notifications/push/public-key — returns VAPID public key (or null if not configured)
  router.get('/push/public-key', (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
  });

  // POST /api/notifications/push/subscribe — save push subscription
  router.post('/push/subscribe', async (req, res) => {
    try {
      const { subscription } = req.body;
      if (!subscription || !subscription.endpoint) return res.status(400).json({ error: 'Invalid subscription object' });
      const sub = JSON.stringify(subscription);
      await pool.query(
        `INSERT INTO push_subscriptions (customer_id, subscription, endpoint)
         VALUES ($1, $2, $3)
         ON CONFLICT (endpoint) DO UPDATE SET customer_id = $1, subscription = $2, updated_at = NOW()`,
        [req.customerId, sub, subscription.endpoint]
      );
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // DELETE /api/notifications/push/subscribe — remove push subscription
  router.delete('/push/subscribe', async (req, res) => {
    try {
      const { endpoint } = req.body || {};
      if (endpoint) {
        await pool.query('DELETE FROM push_subscriptions WHERE customer_id = $1 AND endpoint = $2', [req.customerId, endpoint]);
      } else {
        await pool.query('DELETE FROM push_subscriptions WHERE customer_id = $1', [req.customerId]);
      }
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
};
