'use strict';

const crypto            = require('crypto');
const express           = require('express');
const { authenticate }  = require('../middleware/auth');
const SuggestionsEngine = require('../services/SuggestionsEngine');

module.exports = (pool) => {
  const router = express.Router();
  const engine = new SuggestionsEngine(pool);

  // ── POST /api/suggestions/generate-daily (cron endpoint — no JWT) ──────────
  // Called at 8am UTC by the server-side cron job.
  // Protected by x-cron-secret header.
  router.post('/generate-daily', async (req, res) => {
    const cronSecret = req.headers['x-cron-secret'] || '';
    const expected = process.env.CRON_SECRET || '';
    if (!expected || cronSecret.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(cronSecret), Buffer.from(expected))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const customers = await pool.query(`
        SELECT id, business_name, industry, location, plan,
               posting_streak, last_posted_at, total_posts_this_month
        FROM customers
        WHERE (status IN ('active', 'trial') OR plan != 'none')
          AND (suspended = false OR suspended IS NULL)
          AND id NOT IN (
            SELECT DISTINCT customer_id FROM content_suggestions
            WHERE DATE(created_at) = CURRENT_DATE AND status = 'pending'
          )
        ORDER BY id LIMIT 500
      `);

      let generated = 0;
      let errors = 0;

      for (const customer of customers.rows) {
        try {
          await engine.generateForCustomer(customer.id);
          generated++;
        } catch (customerErr) {
          console.error(`[suggestions] generate-daily failed for ${customer.id}:`, customerErr.message);
          errors++;
        }
      }

      console.log(`[suggestions] Daily generation: ${generated} created, ${errors} errors`);
      res.json({ success: true, generated, errors, total: customers.rows.length });
    } catch (err) {
      console.error('[suggestions] POST /generate-daily:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  router.use(authenticate);

  // ── GET /api/suggestions ─────────────────────────────────────────────────
  // Returns top 3 pending non-expired suggestions for the logged-in customer.
  // Lazy-generates if none exist yet.
  router.get('/', async (req, res) => {
    try {
      let rows = await _fetchPendingSuggestions(pool, req.customerId);

      let generated = false;
      if (rows.length === 0) {
        try {
          await engine.generateForCustomer(req.customerId);
          generated = true;
          rows = await _fetchPendingSuggestions(pool, req.customerId);
        } catch (genErr) {
          console.error('[suggestions] Lazy generation failed:', genErr.message);
        }
      }

      res.json({ suggestions: rows.map(formatSuggestion), generated });
    } catch (err) {
      console.error('[suggestions] GET / error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/suggestions/count ────────────────────────────────────────────
  // Returns count of pending suggestions (for notification badge).
  router.get('/count', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) AS count
         FROM content_suggestions
         WHERE customer_id = $1
           AND status = 'pending'
           AND (expires_at IS NULL OR expires_at > NOW())`,
        [req.customerId]
      );
      res.json({ count: parseInt(result.rows[0].count, 10) });
    } catch (err) {
      console.error('[suggestions] GET /count error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/suggestions/:id/dismiss ────────────────────────────────────
  router.post('/:id/dismiss', async (req, res) => {
    try {
      const suggestionId = parseInt(req.params.id, 10);
      if (isNaN(suggestionId)) return res.status(400).json({ error: 'Invalid suggestion ID' });

      const result = await pool.query(
        `UPDATE content_suggestions
         SET status = 'dismissed', updated_at = NOW()
         WHERE id = $1
           AND customer_id = $2
           AND status = 'pending'
         RETURNING id`,
        [suggestionId, req.customerId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Suggestion not found, not yours, or already actioned' });
      }

      res.json({ success: true });
    } catch (err) {
      console.error('[suggestions] POST /:id/dismiss error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/suggestions/:id/use ────────────────────────────────────────
  // Marks as used and returns the pre-generated draft for the wizard.
  router.post('/:id/use', async (req, res) => {
    try {
      const suggestionId = parseInt(req.params.id, 10);
      if (isNaN(suggestionId)) return res.status(400).json({ error: 'Invalid suggestion ID' });

      const fetchResult = await pool.query(
        `SELECT id, type, title, reason, pre_generated_caption,
                platform, content_type, reference_key, status
         FROM content_suggestions
         WHERE id = $1 AND customer_id = $2`,
        [suggestionId, req.customerId]
      );

      if (fetchResult.rows.length === 0) {
        return res.status(404).json({ error: 'Suggestion not found or not yours' });
      }

      const suggestion = fetchResult.rows[0];

      if (suggestion.status === 'pending') {
        await pool.query(
          `UPDATE content_suggestions
           SET status = 'used', updated_at = NOW()
           WHERE id = $1 AND customer_id = $2`,
          [suggestionId, req.customerId]
        );
      }

      let draft = { caption: '', hashtags: [], imagePrompt: '' };
      if (suggestion.pre_generated_caption) {
        try {
          draft = JSON.parse(suggestion.pre_generated_caption);
        } catch {
          draft = { caption: suggestion.pre_generated_caption, hashtags: [], imagePrompt: '' };
        }
      }

      res.json({
        success: true,
        suggestion: {
          id:          suggestion.id,
          type:        suggestion.type,
          title:       suggestion.title,
          platform:    suggestion.platform,
          contentType: suggestion.content_type,
        },
        draft,
      });
    } catch (err) {
      console.error('[suggestions] POST /:id/use error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/suggestions/generate ───────────────────────────────────────
  // Force-generate suggestions for the current customer (e.g. after onboarding).
  router.post('/generate', async (req, res) => {
    try {
      await engine.generateForCustomer(req.customerId);
      const rows = await _fetchPendingSuggestions(pool, req.customerId);
      res.json({ success: true, suggestions: rows.map(formatSuggestion) });
    } catch (err) {
      console.error('[suggestions] POST /generate error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── DELETE /api/suggestions/expired ──────────────────────────────────────
  // Cleanup expired suggestions (called by cron, also available to admins).
  router.delete('/expired', async (req, res) => {
    try {
      const cleaned = await engine.cleanupExpired();
      res.json({ success: true, cleaned });
    } catch (err) {
      console.error('[suggestions] DELETE /expired error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/suggestions/today ────────────────────────────────────────────
  // Returns the single highest-priority pending suggestion for the dashboard banner.
  // Priority: streak > seasonal > content_gap > milestone
  router.get('/today', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, type, title, reason, pre_generated_caption,
                platform, content_type, expires_at
         FROM content_suggestions
         WHERE customer_id = $1
           AND status = 'pending'
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY
           CASE type
             WHEN 'streak'      THEN 1
             WHEN 'seasonal'    THEN 2
             WHEN 'content_gap' THEN 3
             WHEN 'milestone'   THEN 4
             ELSE 5
           END,
           created_at DESC
         LIMIT 1`,
        [req.customerId]
      );

      if (result.rows.length === 0) return res.json(null);

      const row = result.rows[0];
      let captionPreview = null;
      if (row.pre_generated_caption) {
        try {
          const parsed = JSON.parse(row.pre_generated_caption);
          captionPreview = parsed.caption || row.pre_generated_caption;
        } catch {
          captionPreview = row.pre_generated_caption;
        }
      }

      res.json({
        id:                    row.id,
        suggestion_type:       row.type,
        title:                 row.title,
        reason:                row.reason,
        pre_generated_caption: captionPreview,
        platform:              row.platform,
        expires_at:            row.expires_at,
      });
    } catch (err) {
      console.error('[suggestions] GET /today:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};

async function _fetchPendingSuggestions(pool, customerId) {
  const result = await pool.query(
    `SELECT id, type, title, reason, pre_generated_caption,
            platform, content_type, reference_key, expires_at, created_at
     FROM content_suggestions
     WHERE customer_id = $1
       AND status = 'pending'
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY
       CASE type
         WHEN 'streak'      THEN 1
         WHEN 'seasonal'    THEN 2
         WHEN 'content_gap' THEN 3
         WHEN 'milestone'   THEN 4
         ELSE 5
       END,
       created_at DESC
     LIMIT 3`,
    [customerId]
  );
  return result.rows;
}

function formatSuggestion(row) {
  let preGeneratedCaption = null;
  if (row.pre_generated_caption) {
    try {
      preGeneratedCaption = JSON.parse(row.pre_generated_caption);
    } catch {
      preGeneratedCaption = { caption: row.pre_generated_caption, hashtags: [], imagePrompt: '' };
    }
  }

  return {
    id:                  row.id,
    type:                row.type,
    title:               row.title,
    reason:              row.reason,
    preGeneratedCaption,
    platform:            row.platform,
    contentType:         row.content_type,
    expiresAt:           row.expires_at || null,
  };
}
