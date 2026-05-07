'use strict';

const express          = require('express');
const { authenticate } = require('../middleware/auth');

module.exports = (pool) => {
  const router = express.Router();
  router.use(authenticate);

  // ── GET /api/knowledge ────────────────────────────────────────────────────
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT * FROM business_knowledge
         WHERE customer_id = $1 AND is_active = true
         ORDER BY knowledge_type, sort_order, created_at`,
        [req.customerId]
      );
      res.json({ items: result.rows });
    } catch (err) {
      console.error('[knowledge] GET /:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/knowledge/save ──────────────────────────────────────────────
  router.post('/save', async (req, res) => {
    const client = await pool.connect();
    try {
      const { services = [], reviews, differentiators, faqs = [], team = [] } = req.body;

      await client.query('BEGIN');
      await client.query('DELETE FROM business_knowledge WHERE customer_id = $1', [req.customerId]);

      const insertItem = (type, title, content, order = 0) =>
        client.query(
          `INSERT INTO business_knowledge (customer_id, knowledge_type, title, content, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [req.customerId, type, title, content, order]
        );

      for (let i = 0; i < services.length; i++) {
        const s = services[i];
        if (s.name?.trim()) await insertItem('services', s.name, JSON.stringify(s), i);
      }

      if (reviews?.trim()) await insertItem('reviews', 'Customer Reviews', reviews.trim());
      if (differentiators?.trim()) await insertItem('differentiators', 'What Makes Us Different', differentiators.trim());

      for (let i = 0; i < faqs.length; i++) {
        if (faqs[i]?.trim()) await insertItem('faqs', `FAQ ${i + 1}`, faqs[i].trim(), i);
      }

      for (let i = 0; i < team.length; i++) {
        const m = team[i];
        if (m.name?.trim()) await insertItem('team', m.name, JSON.stringify(m), i);
      }

      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[knowledge] POST /save:', err.message);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  return router;
};
