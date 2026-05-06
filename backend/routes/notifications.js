const express = require('express');
const { authenticate } = require('../middleware/auth');

module.exports = (pool) => {
  const router = express.Router();
  router.use(authenticate);

  // GET /api/notifications — list for current user
  router.get('/', async (req, res) => {
    try {
      const { limit = 30 } = req.query;
      const [rows, unread] = await Promise.all([
        pool.query(
          `SELECT id, type, title, message, read, created_at FROM notifications
           WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2`,
          [req.customerId, parseInt(limit)]
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

  return router;
};
