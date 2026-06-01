const express = require('express');
const { authenticate } = require('../middleware/auth');

const HANDLE_RE = /^[a-z0-9_-]{3,50}$/;

module.exports = (pool) => {
  const router = express.Router();

  // GET /api/public/agency-branding — returns white-label config for a given domain or handle
  // Used by login.js to detect agency branding on page load (no auth required).
  router.get('/agency-branding', async (req, res) => {
    try {
      const { domain, handle } = req.query;
      if (!domain && !handle) return res.status(400).json({ error: 'domain or handle required' });

      let row = null;

      if (domain) {
        // Normalize: strip port, lowercase
        const cleanDomain = String(domain).toLowerCase().replace(/:\d+$/, '').substring(0, 200);
        // Skip localhost / Railway internal — never a custom domain
        if (cleanDomain === 'localhost' || cleanDomain.endsWith('.railway.app') || cleanDomain.endsWith('.itsposting.com')) {
          return res.status(404).json({ error: 'No agency branding for this domain' });
        }
        const result = await pool.query(
          `SELECT business_name, white_label_config
           FROM customers
           WHERE white_label_config->>'customDomain' = $1
             AND plan = 'agency'
             AND (suspended = FALSE OR suspended IS NULL)
           LIMIT 1`,
          [cleanDomain]
        );
        row = result.rows[0] || null;
      } else if (handle) {
        const cleanHandle = String(handle).toLowerCase().replace(/[^a-z0-9_-]/g, '').substring(0, 50);
        const result = await pool.query(
          `SELECT business_name, white_label_config
           FROM customers
           WHERE public_handle = $1
             AND plan = 'agency'
             AND (suspended = FALSE OR suspended IS NULL)
           LIMIT 1`,
          [cleanHandle]
        );
        row = result.rows[0] || null;
      }

      if (!row) return res.status(404).json({ error: 'No agency branding found' });

      const wl = row.white_label_config || {};
      res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
      res.json({
        agencyName:    wl.agencyName    || row.business_name || null,
        logo:          wl.logo          || null,
        primaryColor:  wl.primaryColor  || null,
        hidePoweredBy: wl.hidePoweredBy || false,
      });
    } catch (err) {
      console.error('[Public] Agency branding error:', err.message);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // GET /api/public/showcase — must be BEFORE /:handle to avoid being swallowed
  router.get('/showcase', async (req, res) => {
    try {
      const page = Math.max(0, parseInt(req.query.page) || 0);
      const limit = Math.min(24, parseInt(req.query.limit) || 12);
      const offset = page * limit;
      const industry = req.query.industry ? String(req.query.industry).substring(0, 50) : null;

      const whereExtra = industry ? `AND c.industry = $3` : '';
      const params = industry ? [limit, offset, industry] : [limit, offset];

      const result = await pool.query(
        `SELECT c.business_name, c.industry, c.location, c.avatar_url, c.tagline, c.public_handle,
                COUNT(p.id)::int AS post_count,
                MAX(p.created_at) AS last_posted_at
         FROM customers c
         LEFT JOIN posts p ON p.customer_id = c.id AND p.status = 'posted'
         WHERE c.public_handle IS NOT NULL
           AND (c.suspended = FALSE OR c.suspended IS NULL)
           ${whereExtra}
         GROUP BY c.id
         HAVING COUNT(p.id) > 0
         ORDER BY COUNT(p.id) DESC, c.created_at DESC
         LIMIT $1 OFFSET $2`,
        params
      );

      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS total FROM customers
         WHERE public_handle IS NOT NULL AND (suspended = FALSE OR suspended IS NULL)
           ${industry ? `AND industry = $1` : ''}`,
        industry ? [industry] : []
      );

      res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      res.json({
        businesses: result.rows,
        total: countRes.rows[0]?.total || 0,
        page,
        limit,
      });
    } catch (err) {
      console.error('[Public] Showcase error:', err.message);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // GET /api/public/:handle — public profile, no auth required
  router.get('/:handle', async (req, res) => {
    try {
      const handle = (req.params.handle || '').toLowerCase().trim();
      if (!HANDLE_RE.test(handle)) return res.status(404).json({ error: 'Not found' });

      const profileRes = await pool.query(
        `SELECT business_name, industry, location, avatar_url, website_url, tagline, public_handle
         FROM customers
         WHERE public_handle = $1 AND (suspended = FALSE OR suspended IS NULL)`,
        [handle]
      );
      if (profileRes.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
      const profile = profileRes.rows[0];

      const customerId = (await pool.query(
        'SELECT id FROM customers WHERE public_handle = $1',
        [handle]
      )).rows[0]?.id;

      const postsRes = await pool.query(
        `SELECT id, caption, media_url, platforms, performance_score, created_at
         FROM posts
         WHERE customer_id = $1
           AND status = 'posted'
           AND media_url IS NOT NULL
           AND caption IS NOT NULL
         ORDER BY COALESCE(performance_score, 0) DESC, created_at DESC
         LIMIT 3`,
        [customerId]
      );

      const socialRes = await pool.query(
        `SELECT platform, account_name AS profile_name, account_username FROM social_accounts
         WHERE customer_id = $1 AND enabled = TRUE`,
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
      const RESERVED = ['admin', 'api', 'login', 'signup', 'dashboard', 'wizard', 'billing', 'settings', 'profile', 'media', 'analytics', 'calendar', 'history', 'inbox', 'contacts', 'showcase', 'handle'];
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
