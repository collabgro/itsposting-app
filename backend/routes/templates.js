const express = require('express');
const { authenticate } = require('../middleware/auth');

module.exports = (pool) => {
  const router = express.Router();
  router.use(authenticate);

  // GET /api/templates
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, name, settings, usage_count, created_at
         FROM post_templates
         WHERE customer_id = $1
         ORDER BY usage_count DESC, created_at DESC
         LIMIT 20`,
        [req.customerId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/templates
  router.post('/', async (req, res) => {
    try {
      const { name, settings } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
      if (name.trim().length > 100) return res.status(400).json({ error: 'name too long (max 100 chars)' });

      // Limit to 20 templates per customer
      const countRes = await pool.query(
        'SELECT COUNT(*) FROM post_templates WHERE customer_id = $1',
        [req.customerId]
      );
      if (parseInt(countRes.rows[0].count) >= 20) {
        return res.status(400).json({ error: 'Template limit reached (max 20). Delete an old template first.' });
      }

      const result = await pool.query(
        `INSERT INTO post_templates (customer_id, name, settings, usage_count, created_at)
         VALUES ($1, $2, $3, 0, NOW())
         RETURNING *`,
        [req.customerId, name.trim(), settings ? JSON.stringify(settings) : '{}']
      );
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/templates/:id — rename
  router.patch('/:id', async (req, res) => {
    try {
      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
      const result = await pool.query(
        `UPDATE post_templates SET name = $1, updated_at = NOW()
         WHERE id = $2 AND customer_id = $3 RETURNING *`,
        [name.trim().substring(0, 100), req.params.id, req.customerId]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Template not found' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/templates/:id/use — increment usage counter
  router.post('/:id/use', async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE post_templates SET usage_count = usage_count + 1
         WHERE id = $1 AND customer_id = $2
         RETURNING id, name, settings, usage_count`,
        [req.params.id, req.customerId]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Template not found' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/templates/:id
  router.delete('/:id', async (req, res) => {
    try {
      const result = await pool.query(
        'DELETE FROM post_templates WHERE id = $1 AND customer_id = $2 RETURNING id',
        [req.params.id, req.customerId]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Template not found' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
