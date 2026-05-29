const express = require('express');
const { authenticate } = require('../middleware/auth');

const HANDLE_RE = /^[a-z0-9_-]{3,50}$/;

module.exports = (pool) => {
  const router = express.Router();

  // GET /api/public/:handle — public profile, no auth required
  router.get('/:handle', async (req, res) => {
    try {
      const handle = (req.params.handle || '').toLowerCase().trim();
      if (!HANDLE_RE.test(handle)) return res.status(404).json({ error: 'Not found' });

      const profileRes = await pool.query(
        `SELECT business_name, industry, city, state, avatar_url, website_url, tagline, public_handle
         FROM customers
         WHERE public_handle = $1 AND suspended = FALSE`,
        [handle]
      );
      if (profileRes.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
      const profile = profileRes.rows[0];

      const customerId = (await pool.query(
        'SELECT id FROM customers WHERE public_handle = $1',
        [handle]
      )).rows[0]?.id;

      const postsRes = await pool.query(
        `SELECT id, caption, image_url, platforms, performance_score, created_at
         FROM posts
         WHERE customer_id = $1
           AND status = 'published'
           AND image_url IS NOT NULL
           AND caption IS NOT NULL
         ORDER BY COALESCE(performance_score, 0) DESC, created_at DESC
         LIMIT 3`,
        [customerId]
      );

      const socialRes = await pool.query(
        `SELECT platform, profile_name, profile_url FROM social_accounts
         WHERE customer_id = $1 AND is_active = TRUE`,
        [customerId]
      );

      res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      res.json({
        profile,
        posts: postsRes.rows,
        socialAccounts: socialRes.rows,
      });
    } catch (err) {
      console.error('[Public] Profile error:', err.message);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // PATCH /api/public/handle — set/update public handle (authenticated)
  router.patch('/handle', authenticate, async (req, res) => {
    try {
      const { handle } = req.body;
      if (!handle && handle !== '') {
        return res.status(400).json({ error: 'handle is required' });
      }

      // Clearing handle
      if (!handle) {
        await pool.query('UPDATE customers SET public_handle = NULL WHERE id = $1', [req.customerId]);
        return res.json({ success: true, handle: null });
      }

      const clean = String(handle).toLowerCase().replace(/[^a-z0-9_-]/g, '').substring(0, 50);
      if (!HANDLE_RE.test(clean)) {
        return res.status(400).json({ error: 'Handle must be 3–50 characters using a–z, 0–9, hyphens, or underscores' });
      }

      // Check it's not a reserved path
      const RESERVED = ['admin', 'api', 'login', 'signup', 'dashboard', 'wizard', 'billing', 'settings', 'profile', 'media', 'analytics', 'calendar', 'history', 'inbox', 'contacts'];
      if (RESERVED.includes(clean)) {
        return res.status(400).json({ error: 'That handle is reserved' });
      }

      const result = await pool.query(
        'UPDATE customers SET public_handle = $1 WHERE id = $2 RETURNING public_handle',
        [clean, req.customerId]
      );
      res.json({ success: true, handle: result.rows[0].public_handle });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'That handle is already taken' });
      console.error('[Public] Handle update error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
