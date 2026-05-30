'use strict';

const express              = require('express');
const { authenticate }     = require('../middleware/auth');
const BusinessIntelligence = require('../services/BusinessIntelligence');
const PostCoreAdvisor      = require('../services/PostCoreAdvisor');
const IndustryBenchmarks   = require('../services/IndustryBenchmarks');

module.exports = (pool) => {
  const router = express.Router();
  router.use(authenticate);

  const bi    = new BusinessIntelligence(pool);
  const pca   = new PostCoreAdvisor(pool);
  const bench = new IndustryBenchmarks(pool);

  // ── GET /api/intelligence/metrics ────────────────────────────────────────
  router.get('/metrics', async (req, res) => {
    const period = req.query.period || '30days';
    try {
      // Return cached result if still fresh (1-hour TTL)
      try {
        const cached = await pool.query(
          `SELECT metrics FROM customer_metrics_cache
            WHERE customer_id = $1 AND period = $2 AND expires_at > NOW()`,
          [req.customerId, period]
        );
        if (cached.rows.length) return res.json(cached.rows[0].metrics);
      } catch (_) { /* cache table may not exist yet — skip */ }

      const data = await bi.getBusinessMetrics(req.customerId, period);

      // Upsert cache — fire and forget
      pool.query(
        `INSERT INTO customer_metrics_cache (customer_id, period, metrics, computed_at, expires_at)
         VALUES ($1, $2, $3::jsonb, NOW(), NOW() + INTERVAL '1 hour')
         ON CONFLICT (customer_id, period) DO UPDATE
           SET metrics = EXCLUDED.metrics, computed_at = NOW(), expires_at = NOW() + INTERVAL '1 hour'`,
        [req.customerId, period, JSON.stringify(data)]
      ).catch(() => {});

      res.json(data);
    } catch (err) {
      console.error('[intelligence] GET /metrics:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/intelligence/trend ───────────────────────────────────────────
  router.get('/trend', async (req, res) => {
    try {
      const data = await bi.getEngagementTrend(req.customerId, parseInt(req.query.weeks) || 8);
      res.json(data);
    } catch (err) {
      console.error('[intelligence] GET /trend:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/intelligence/best-post ──────────────────────────────────────
  router.get('/best-post', async (req, res) => {
    try {
      const data = await bi.getBestPerformingPost(req.customerId, req.query.period || '30days');
      res.json(data || null);
    } catch (err) {
      console.error('[intelligence] GET /best-post:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/intelligence/content-mix ────────────────────────────────────
  router.get('/content-mix', async (req, res) => {
    try {
      const data = await bi.getContentMixAnalysis(req.customerId);
      res.json(data);
    } catch (err) {
      console.error('[intelligence] GET /content-mix:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/intelligence/content-health ─────────────────────────────────
  // Alias for dashboard backward compatibility
  router.get('/content-health', async (req, res) => {
    try {
      const data = await bi.getContentMixAnalysis(req.customerId);
      res.json(data);
    } catch (err) {
      console.error('[intelligence] GET /content-health:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/intelligence/briefing ───────────────────────────────────────
  router.get('/briefing', async (req, res) => {
    try {
      const data = await pca.getLatestBriefing(req.customerId);
      res.json(data || null);
    } catch (err) {
      console.error('[intelligence] GET /briefing:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/intelligence/briefing/generate ─────────────────────────────
  router.post('/briefing/generate', async (req, res) => {
    try {
      const data = await pca.generateWeeklyBriefing(req.customerId);
      res.json(data);
    } catch (err) {
      console.error('[intelligence] POST /briefing/generate:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── PATCH /api/intelligence/briefing/:id/read ────────────────────────────
  router.patch('/briefing/:id/read', async (req, res) => {
    try {
      await pca.markRead(req.params.id, req.customerId);
      res.json({ success: true });
    } catch (err) {
      console.error('[intelligence] PATCH /briefing/:id/read:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/intelligence/benchmarks ─────────────────────────────────────
  router.get('/benchmarks', async (req, res) => {
    try {
      const data = await bench.compareToIndustry(req.customerId);
      res.json(data);
    } catch (err) {
      console.error('[intelligence] GET /benchmarks:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/intelligence/best-times ─────────────────────────────────────
  router.get('/best-times', async (req, res) => {
    try {
      const data = await bench.getBestTimeToPost(req.customerId);
      res.json(data);
    } catch (err) {
      console.error('[intelligence] GET /best-times:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
