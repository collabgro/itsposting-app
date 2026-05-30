const express = require('express');
const { authenticate } = require('../middleware/auth');
const ContentMixTracker = require('../services/ContentMixTracker');
const { PDFDocument, rgb, StandardFonts, PageSizes } = require('pdf-lib');

module.exports = (pool) => {
  const router = express.Router();
  router.use(authenticate);

  // GET /api/analytics/overview
  router.get('/overview', async (req, res) => {
    try {
      const { period = '30' } = req.query;
      const days = Math.min(Math.max(parseInt(period) || 30, 1), 365);

      const result = await pool.query(`
        SELECT
          COUNT(*) AS total_posts,
          COUNT(*) FILTER (WHERE status = 'posted') AS posted,
          COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled,
          COALESCE(SUM((engagement->>'likes')::int), 0) AS total_likes,
          COALESCE(SUM((engagement->>'comments')::int), 0) AS total_comments,
          COALESCE(SUM((engagement->>'shares')::int), 0) AS total_shares,
          COALESCE(AVG(performance_score), 0) AS avg_performance,
          COUNT(DISTINCT DATE(posted_at)) AS active_days
        FROM posts
        WHERE customer_id = $1 AND created_at > NOW() - ($2 || ' days')::INTERVAL
      `, [req.customerId, days]);

      const topPosts = await pool.query(`
        SELECT id, caption, media_url, content_type, performance_score, engagement, posted_at
        FROM posts
        WHERE customer_id = $1 AND status = 'posted'
        ORDER BY performance_score DESC NULLS LAST
        LIMIT 5
      `, [req.customerId]);

      res.json({ summary: result.rows[0], topPosts: topPosts.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/analytics/posts
  router.get('/posts', async (req, res) => {
    try {
      const { sort = 'recent', platform, contentType, limit = 50 } = req.query;
      const safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);

      let orderBy = 'p.created_at DESC';
      if (sort === 'best') orderBy = 'p.performance_score DESC NULLS LAST';

      let query = `
        SELECT p.id, p.content_type, p.caption, p.media_url, p.status,
               p.scheduled_date, p.posted_at, p.engagement,
               p.engagement_by_platform, p.performance_score, p.platforms,
               p.source, p.created_at, p.credits_used
        FROM posts p
        WHERE p.customer_id = $1
      `;
      const params = [req.customerId];
      let pIdx = 1;

      if (contentType) { pIdx++; query += ` AND p.content_type = $${pIdx}`; params.push(contentType); }

      query += ` ORDER BY ${orderBy} LIMIT $${pIdx + 1}`;
      params.push(safeLimit);

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/analytics/posts/:id
  router.get('/posts/:id', async (req, res) => {
    try {
      const postRes = await pool.query(
        'SELECT * FROM posts WHERE id = $1 AND customer_id = $2',
        [req.params.id, req.customerId]
      );
      if (postRes.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
      const post = postRes.rows[0];

      const [snapshotsRes, avgRes] = await Promise.all([
        pool.query(
          `SELECT platform, likes, comments, shares, saves, reach, impressions, clicks, video_views, snapshot_at
           FROM post_engagement_snapshots WHERE post_id = $1 ORDER BY snapshot_at ASC`,
          [req.params.id]
        ),
        pool.query(
          `SELECT
            COALESCE(AVG((engagement->>'likes')::int), 0) AS avg_likes,
            COALESCE(AVG((engagement->>'comments')::int), 0) AS avg_comments,
            COALESCE(AVG((engagement->>'shares')::int), 0) AS avg_shares,
            COALESCE(AVG(performance_score), 0) AS avg_score
           FROM posts
           WHERE customer_id = $1 AND status = 'posted' AND id != $2`,
          [req.customerId, req.params.id]
        ),
      ]);

      let slides = [];
      if (post.content_type === 'carousel') {
        const slidesRes = await pool.query(
          'SELECT * FROM post_carousel_slides WHERE post_id = $1 ORDER BY slide_number',
          [post.id]
        );
        slides = slidesRes.rows;
      }

      // Build per-platform breakdown
      const platformList = (() => {
        try { return Array.isArray(post.platforms) ? post.platforms : JSON.parse(post.platforms || '[]'); }
        catch { return []; }
      })();

      const platformMetrics = {};
      if (snapshotsRes.rows.length > 0) {
        const latestByPlatform = {};
        for (const snap of snapshotsRes.rows) {
          if (!latestByPlatform[snap.platform] || new Date(snap.snapshot_at) > new Date(latestByPlatform[snap.platform].snapshot_at)) {
            latestByPlatform[snap.platform] = snap;
          }
        }
        Object.assign(platformMetrics, latestByPlatform);
      } else {
        for (const pl of platformList) {
          platformMetrics[pl] = { platform: pl, likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, note: 'Connect social accounts to sync real metrics.' };
        }
      }

      const eng = post.engagement || {};
      const totalEngagement = (parseInt(eng.likes) || 0) + (parseInt(eng.comments) || 0) + (parseInt(eng.shares) || 0);
      const avg = avgRes.rows[0];

      const comparison = {
        likes: { value: parseInt(eng.likes) || 0, avg: Math.round(avg.avg_likes), diff: (((parseInt(eng.likes) || 0) - avg.avg_likes) / Math.max(1, avg.avg_likes)) * 100 },
        comments: { value: parseInt(eng.comments) || 0, avg: Math.round(avg.avg_comments), diff: (((parseInt(eng.comments) || 0) - avg.avg_comments) / Math.max(1, avg.avg_comments)) * 100 },
        shares: { value: parseInt(eng.shares) || 0, avg: Math.round(avg.avg_shares), diff: (((parseInt(eng.shares) || 0) - avg.avg_shares) / Math.max(1, avg.avg_shares)) * 100 },
      };

      const captionLen = (post.caption || '').length;
      const hashtagCount = (() => { try { return Array.isArray(post.hashtags) ? post.hashtags.length : JSON.parse(post.hashtags || '[]').length; } catch { return 0; } })();
      const postHour = post.posted_at ? new Date(post.posted_at).getHours() : null;

      const insights = [];
      if (captionLen > 0) {
        insights.push({ type: 'caption_length', label: 'Caption length', value: `${captionLen} characters`, assessment: captionLen >= 80 && captionLen <= 200 ? 'good' : captionLen < 80 ? 'short' : 'long' });
      }
      if (hashtagCount > 0) {
        insights.push({ type: 'hashtag_count', label: 'Hashtags used', value: `${hashtagCount} tags`, assessment: hashtagCount >= 3 && hashtagCount <= 8 ? 'good' : hashtagCount < 3 ? 'few' : 'many' });
      }
      if (postHour !== null) {
        insights.push({ type: 'time', label: 'Posted at', value: `${postHour}:00 (${postHour >= 9 && postHour <= 18 ? 'business hours' : 'off-hours'})`, assessment: postHour >= 9 && postHour <= 21 ? 'good' : 'consider_better_time' });
      }

      res.json({
        post: { ...post, slides },
        platformMetrics: Object.values(platformMetrics),
        timeline: snapshotsRes.rows,
        totalEngagement,
        comparison,
        insights,
        accountAverage: { likes: Math.round(avg.avg_likes), comments: Math.round(avg.avg_comments), shares: Math.round(avg.avg_shares), performanceScore: parseFloat(avg.avg_score) },
      });
    } catch (err) {
      console.error('Post analytics error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/analytics/optimal-times
  // Returns a DOW × hour engagement grid + top recommended slots
  router.get('/optimal-times', async (req, res) => {
    try {
      // Pull all posts that have a date AND engagement data
      const result = await pool.query(`
        SELECT
          EXTRACT(DOW  FROM COALESCE(posted_at, scheduled_date))::int   AS dow,
          EXTRACT(HOUR FROM COALESCE(posted_at, scheduled_date))::int   AS hour,
          COUNT(*)                                                        AS post_count,
          COALESCE(AVG(
            COALESCE((engagement->>'likes')::numeric, 0)
            + COALESCE((engagement->>'comments')::numeric, 0) * 2
            + COALESCE((engagement->>'shares')::numeric, 0) * 3
          ), 0) AS avg_score
        FROM posts
        WHERE customer_id = $1
          AND (posted_at IS NOT NULL OR scheduled_date IS NOT NULL)
        GROUP BY dow, hour
        ORDER BY avg_score DESC
      `, [req.customerId]);

      const rows = result.rows;
      const hasRealData = rows.some(r => parseFloat(r.avg_score) > 0);

      // Build a flat lookup: "dow-hour" → avg_score
      const grid = {};
      let maxScore = 0;
      for (const r of rows) {
        const key = `${r.dow}-${r.hour}`;
        const score = parseFloat(r.avg_score);
        grid[key] = { score, count: parseInt(r.post_count) };
        if (score > maxScore) maxScore = score;
      }

      // Best-practice defaults (used when no real engagement data exists)
      const DEFAULTS = [
        { dow: 2, hour: 9,  label: 'Tue 9am',  reason: 'High open-rate morning window' },
        { dow: 3, hour: 12, label: 'Wed 12pm', reason: 'Mid-week lunch engagement peak' },
        { dow: 4, hour: 17, label: 'Thu 5pm',  reason: 'End-of-day browsing spike' },
        { dow: 2, hour: 18, label: 'Tue 6pm',  reason: 'Post-work prime time' },
        { dow: 1, hour: 10, label: 'Mon 10am', reason: 'Monday momentum catch-up' },
      ];

      let recommendations;
      if (!hasRealData || rows.length < 3) {
        recommendations = DEFAULTS.map(d => ({ ...d, score: null, isDefault: true }));
      } else {
        // Top scored slots with enough posts
        const sorted = rows
          .filter(r => parseInt(r.post_count) >= 1)
          .sort((a, b) => parseFloat(b.avg_score) - parseFloat(a.avg_score))
          .slice(0, 5);

        const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const fmtHour = h => {
          const ampm = h >= 12 ? 'pm' : 'am';
          const h12  = h % 12 === 0 ? 12 : h % 12;
          return `${h12}${ampm}`;
        };

        recommendations = sorted.map(r => ({
          dow:    parseInt(r.dow),
          hour:   parseInt(r.hour),
          label:  `${DAYS[parseInt(r.dow)]} ${fmtHour(parseInt(r.hour))}`,
          score:  parseFloat(r.avg_score),
          count:  parseInt(r.post_count),
          reason: `Based on your ${r.post_count} post${r.post_count > 1 ? 's' : ''} — avg engagement ${Math.round(r.avg_score)}`,
          isDefault: false,
        }));

        // Pad with defaults if fewer than 3 recommendations
        if (recommendations.length < 3) {
          for (const d of DEFAULTS) {
            if (recommendations.length >= 5) break;
            const alreadyPresent = recommendations.some(r => r.dow === d.dow && r.hour === d.hour);
            if (!alreadyPresent) recommendations.push({ ...d, score: null, isDefault: true });
          }
        }
      }

      res.json({ grid, maxScore, recommendations, hasRealData, totalDataPoints: rows.length });
    } catch (err) {
      console.error('optimal-times error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/analytics/content-performance
  router.get('/content-performance', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          content_type,
          COUNT(*)                                                          AS total,
          COUNT(*) FILTER (WHERE status = 'posted')                        AS posted,
          COALESCE(AVG((engagement->>'likes')::numeric)    FILTER (WHERE status = 'posted'), 0) AS avg_likes,
          COALESCE(AVG((engagement->>'comments')::numeric) FILTER (WHERE status = 'posted'), 0) AS avg_comments,
          COALESCE(AVG((engagement->>'shares')::numeric)   FILTER (WHERE status = 'posted'), 0) AS avg_shares,
          COALESCE(AVG(performance_score)                  FILTER (WHERE status = 'posted'), 0) AS avg_score,
          COALESCE(SUM(credits_used), 0)                                   AS total_credits
        FROM posts
        WHERE customer_id = $1
        GROUP BY content_type
        ORDER BY avg_score DESC
      `, [req.customerId]);

      // Day-of-week posting distribution
      const dowResult = await pool.query(`
        SELECT
          EXTRACT(DOW FROM COALESCE(posted_at, scheduled_date, created_at))::int AS dow,
          COUNT(*) AS count
        FROM posts
        WHERE customer_id = $1
          AND (posted_at IS NOT NULL OR scheduled_date IS NOT NULL OR created_at IS NOT NULL)
        GROUP BY dow
        ORDER BY dow
      `, [req.customerId]);

      res.json({
        byType: result.rows,
        byDow:  dowResult.rows,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/analytics/posts/:id/snapshot
  router.post('/posts/:id/snapshot', async (req, res) => {
    try {
      const { platform, likes = 0, comments = 0, shares = 0, reach = 0, impressions = 0 } = req.body;
      if (!platform) return res.status(400).json({ error: 'platform required' });

      const ownerCheck = await pool.query('SELECT id FROM posts WHERE id = $1 AND customer_id = $2', [req.params.id, req.customerId]);
      if (ownerCheck.rows.length === 0) return res.status(404).json({ error: 'Not found' });

      await pool.query(
        'INSERT INTO post_engagement_snapshots (post_id, platform, likes, comments, shares, reach, impressions) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [req.params.id, platform, likes, comments, shares, reach, impressions]
      );

      const newTotal = parseInt(likes) + parseInt(comments) + parseInt(shares);
      await pool.query(
        'UPDATE posts SET engagement = $1::jsonb, performance_score = $2, last_metrics_sync = NOW() WHERE id = $3 AND customer_id = $4',
        [JSON.stringify({ likes, comments, shares }), newTotal, req.params.id, req.customerId]
      );

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/analytics/content-health
  router.get('/content-health', async (req, res) => {
    try {
      const tracker = new ContentMixTracker(pool);
      const data = await tracker.getContentHealth(req.customerId);
      res.json(data);
    } catch (err) {
      console.error('[ContentMixTracker] content-health error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/analytics/content-mix
  router.get('/content-mix', async (req, res) => {
    try {
      const tracker = new ContentMixTracker(pool);
      const data = await tracker.analyzeContentMix(req.customerId);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/analytics/streak
  router.get('/streak', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT posting_streak, last_posted_at FROM customers WHERE id = $1`,
        [req.customerId]
      );
      const row    = result.rows[0];
      const streak = row?.posting_streak || 0;
      res.json({
        streak,
        lastPostedAt: row?.last_posted_at || null,
        isOnFire:     streak >= 7,
        label:        streak === 1 ? '1 day' : `${streak} days`,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/analytics/streak/update
  router.post('/streak/update', async (req, res) => {
    try {
      const tracker = new ContentMixTracker(pool);
      const data = await tracker.updatePostingStreak(req.customerId);
      res.json(data);
    } catch (err) {
      console.error('[ContentMixTracker] streak update error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/analytics/monthly-stats
  router.get('/monthly-stats', async (req, res) => {
    try {
      const tracker = new ContentMixTracker(pool);
      const data = await tracker.getMonthlyStats(req.customerId);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/analytics/sync-metrics
  // Fetches real engagement data from Facebook/Instagram Graph API and writes to DB.
  // Body: { postIds?: number[] } — if omitted, syncs recent 30-day posts.
  router.post('/sync-metrics', async (req, res) => {
    try {
      const MetricsSyncService = require('../services/MetricsSyncService');
      const syncService = new MetricsSyncService(pool);
      const { postIds } = req.body || {};
      let result;
      if (Array.isArray(postIds) && postIds.length) {
        const capped = postIds.slice(0, 50);
        const results = await Promise.all(
          capped.map(id => syncService.syncPost(id, req.customerId).catch(e => ({ synced: false, error: e.message })))
        );
        result = { synced: results.filter(r => r.synced).length, total: capped.length };
      } else {
        result = await syncService.syncRecentPosts(req.customerId);
      }
      res.json(result);
    } catch (err) {
      console.error('[analytics] sync-metrics error:', err);
      res.status(500).json({ error: 'Sync failed' });
    }
  });

  // GET /api/analytics/variation-stats
  // Returns A/B/C pick distribution + preferred caption style for the PostCore style insight card.
  router.get('/variation-stats', async (req, res) => {
    try {
      // Count how many times each variation label was chosen
      const countRes = await pool.query(
        `SELECT chosen_variation, COUNT(*) AS count
         FROM posts
         WHERE customer_id = $1 AND chosen_variation IS NOT NULL
         GROUP BY chosen_variation
         ORDER BY count DESC`,
        [req.customerId]
      );

      const total = countRes.rows.reduce((s, r) => s + parseInt(r.count), 0);
      if (total < 3) {
        return res.json({ hasData: false, total, choices: [] });
      }

      const choices = countRes.rows.map(r => ({
        label: r.chosen_variation,
        count: parseInt(r.count),
        pct: Math.round((parseInt(r.count) / total) * 100),
      }));

      // Avg word count of chosen captions vs. all captions for those posts
      let styleInsight = null;
      try {
        const styleRes = await pool.query(
          `SELECT
            AVG(array_length(regexp_split_to_array(trim(pv_chosen.caption), '\\s+'), 1)) AS chosen_avg,
            AVG(array_length(regexp_split_to_array(trim(pv_all.caption),    '\\s+'), 1)) AS overall_avg
           FROM posts p
           JOIN post_variations pv_chosen ON pv_chosen.post_id = p.id AND pv_chosen.variation_label = p.chosen_variation
           JOIN post_variations pv_all    ON pv_all.post_id    = p.id
           WHERE p.customer_id = $1 AND p.chosen_variation IS NOT NULL`,
          [req.customerId]
        );
        const chosenAvg  = parseFloat(styleRes.rows[0]?.chosen_avg)  || 0;
        const overallAvg = parseFloat(styleRes.rows[0]?.overall_avg) || 0;
        if (overallAvg > 0) {
          const ratio = chosenAvg / overallAvg;
          if (ratio >= 1.12) {
            styleInsight = 'You tend to pick longer, more detailed captions. PostCore will generate those first.';
          } else if (ratio <= 0.88) {
            styleInsight = 'You tend to pick shorter, punchier captions. PostCore will lead with those.';
          } else {
            styleInsight = 'You pick evenly across all caption styles — PostCore keeps showing you variety.';
          }
        }
      } catch (styleErr) {
        // post_variations may be empty — safe to skip insight
      }

      const preferred = choices[0];
      res.json({ hasData: true, total, choices, preferredLabel: preferred?.label, styleInsight });
    } catch (err) {
      console.error('[analytics] variation-stats error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/analytics/leaderboard
   * Returns anonymized industry benchmarks + this customer's relative ranking.
   * No PII exposed — only anonymized percentile data and per-industry stats.
   */
  router.get('/leaderboard', authenticate, async (req, res) => {
    try {
      // Get this customer's industry + their 30-day stats
      const custRes = await pool.query(
        `SELECT c.industry,
                COALESCE(COUNT(p.id), 0)::int AS post_count,
                COALESCE(AVG((p.engagement->>'likes')::numeric + (p.engagement->>'comments')::numeric * 2 + (p.engagement->>'shares')::numeric * 3), 0)::numeric(8,2) AS avg_engagement
         FROM customers c
         LEFT JOIN posts p ON p.customer_id = c.id
           AND p.status = 'posted'
           AND p.created_at > NOW() - INTERVAL '30 days'
         WHERE c.id = $1
         GROUP BY c.industry`,
        [req.customerId]
      );

      if (!custRes.rows.length) return res.json({ hasData: false });

      const { industry, post_count, avg_engagement } = custRes.rows[0];
      const myEngagement = parseFloat(avg_engagement) || 0;
      const myPosts = parseInt(post_count) || 0;

      // Aggregate anonymized stats for this industry (all active customers, 30 days)
      const industryRes = await pool.query(
        `SELECT
           COUNT(DISTINCT c.id)::int AS total_accounts,
           COALESCE(AVG(sub.avg_eng), 0)::numeric(8,2) AS industry_avg_engagement,
           COALESCE(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY sub.avg_eng), 0)::numeric(8,2) AS p90,
           COALESCE(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY sub.avg_eng), 0)::numeric(8,2) AS p75,
           COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sub.avg_eng), 0)::numeric(8,2) AS p50,
           COALESCE(AVG(sub.post_count), 0)::numeric(6,2) AS avg_posts_per_month
         FROM customers c
         JOIN (
           SELECT p.customer_id,
                  COUNT(p.id) AS post_count,
                  COALESCE(AVG((p.engagement->>'likes')::numeric + (p.engagement->>'comments')::numeric * 2 + (p.engagement->>'shares')::numeric * 3), 0) AS avg_eng
           FROM posts p
           WHERE p.status = 'posted'
             AND p.created_at > NOW() - INTERVAL '30 days'
           GROUP BY p.customer_id
           HAVING COUNT(p.id) >= 1
         ) sub ON sub.customer_id = c.id
         WHERE c.industry = $1 AND c.status = 'active'`,
        [industry]
      );

      const industryStats = industryRes.rows[0];
      const totalAccounts = parseInt(industryStats.total_accounts) || 0;
      const p90 = parseFloat(industryStats.p90) || 0;
      const p75 = parseFloat(industryStats.p75) || 0;
      const p50 = parseFloat(industryStats.p50) || 0;
      const industryAvg = parseFloat(industryStats.industry_avg_engagement) || 0;
      const industryAvgPosts = parseFloat(industryStats.avg_posts_per_month) || 0;

      // Calculate percentile bucket
      let percentileLabel = 'Bottom 25%';
      let percentileColor = '#6B7280';
      let percentileNum = 75;
      if (myEngagement >= p90) { percentileLabel = 'Top 10%'; percentileColor = '#30D158'; percentileNum = 10; }
      else if (myEngagement >= p75) { percentileLabel = 'Top 25%'; percentileColor = '#34C759'; percentileNum = 25; }
      else if (myEngagement >= p50) { percentileLabel = 'Top 50%'; percentileColor = '#FFD60A'; percentileNum = 50; }

      // Build anonymized top performers (no names, just city hints)
      const topRes = await pool.query(
        `SELECT
           COALESCE(SUBSTRING(c.location FROM '([A-Za-z ]+)'), 'a local area') AS city_hint,
           COALESCE(AVG((p.engagement->>'likes')::numeric + (p.engagement->>'comments')::numeric * 2 + (p.engagement->>'shares')::numeric * 3), 0)::numeric(8,2) AS avg_engagement,
           COUNT(p.id)::int AS post_count
         FROM customers c
         JOIN posts p ON p.customer_id = c.id
           AND p.status = 'posted'
           AND p.created_at > NOW() - INTERVAL '30 days'
         WHERE c.industry = $1 AND c.status = 'active' AND c.id != $2
         GROUP BY c.id, c.location
         HAVING COUNT(p.id) >= 2
         ORDER BY avg_engagement DESC
         LIMIT 3`,
        [industry, req.customerId]
      );

      // Industry-specific tips for what top performers do
      const INDUSTRY_LABELS = {
        plumbing: 'Plumbing', hvac: 'HVAC', roofing: 'Roofing', concrete: 'Concrete',
        landscaping: 'Landscaping', electrical: 'Electrical', painting: 'Painting',
        pest_control: 'Pest Control', general_contractor: 'Contracting', cleaning: 'Cleaning',
      };
      const industryLabel = INDUSTRY_LABELS[industry] || industry;

      const topTips = [
        `Top ${industryLabel} accounts post ${Math.round(industryAvgPosts * 1.5)}+ times per month`,
        'Before & after photos get 2.3× more engagement than text posts in this industry',
        'Posts with a direct engagement question get 40% more comments on average',
      ];

      // Compute next tier target
      let nextTier = null;
      let nextTierScore = null;
      if (percentileNum > 10) {
        if (percentileNum >= 75) { nextTier = 'Top 25%'; nextTierScore = parseFloat(p75.toFixed(1)); }
        else if (percentileNum >= 50) { nextTier = 'Top 25%'; nextTierScore = parseFloat(p75.toFixed(1)); }
        else if (percentileNum >= 25) { nextTier = 'Top 10%'; nextTierScore = parseFloat(p90.toFixed(1)); }
        else { nextTier = 'Top 25%'; nextTierScore = parseFloat(p75.toFixed(1)); }
      }

      res.set('Cache-Control', 'private, max-age=1800, stale-while-revalidate=3600');
      res.json({
        hasData: totalAccounts >= 3,
        industry: industryLabel,
        myScore: myEngagement,
        myPosts,
        percentileBucket: percentileLabel,
        percentileColor,
        percentileNum,
        industryAvg,
        industryAvgPosts: Math.round(industryAvgPosts),
        totalAccounts,
        nextTier,
        nextTierScore,
        topPerformers: topRes.rows.map((r, i) => ({
          rank: i + 1,
          city: r.city_hint.trim().split(/\s+/).slice(0, 2).join(' '),
          avg_score: parseFloat(r.avg_engagement),
          postCount: r.post_count,
        })),
        topTips,
      });
    } catch (err) {
      console.error('[analytics] leaderboard error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/analytics/export-pdf?year=2025&month=4
  router.get('/export-pdf', async (req, res) => {
    try {
      const year  = parseInt(req.query.year)  || new Date().getFullYear();
      const month = parseInt(req.query.month); // 0-indexed
      const safeMonth = isNaN(month) ? new Date().getMonth() : Math.max(0, Math.min(11, month));
      const startDate = new Date(year, safeMonth, 1);
      const endDate   = new Date(year, safeMonth + 1, 0, 23, 59, 59);
      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const monthLabel = `${monthNames[safeMonth]} ${year}`;

      // Fetch data
      const [profileRes, postsRes] = await Promise.all([
        pool.query('SELECT business_name, industry, location, brand_colors FROM customers WHERE id=$1', [req.customerId]),
        pool.query(
          `SELECT id, content_type, caption, media_url, status, posted_at,
                  COALESCE((engagement->>'likes')::int, 0)       AS likes,
                  COALESCE((engagement->>'comments')::int, 0)    AS comments,
                  COALESCE((engagement->>'shares')::int, 0)      AS shares,
                  COALESCE((engagement->>'reach')::int, 0)       AS reach,
                  COALESCE((engagement->>'impressions')::int, 0) AS impressions,
                  performance_score, engagement
           FROM posts
           WHERE customer_id=$1 AND status='posted'
             AND posted_at BETWEEN $2 AND $3
           ORDER BY (COALESCE((engagement->>'likes')::int,0)+COALESCE((engagement->>'comments')::int,0)+COALESCE((engagement->>'shares')::int,0)) DESC`,
          [req.customerId, startDate, endDate]
        ),
      ]);

      const profile   = profileRes.rows[0] || {};
      const posts     = postsRes.rows;
      const bizName   = profile.business_name || 'Your Business';

      const totalEng   = posts.reduce((s, p) => s + (p.likes || 0) + (p.comments || 0) + (p.shares || 0), 0);
      const totalReach = posts.reduce((s, p) => s + (parseInt((p.engagement || {}).reach) || 0), 0);
      const topPosts  = posts.slice(0, 3);

      const typeCounts = {};
      posts.forEach(p => { typeCounts[p.content_type || 'photo'] = (typeCounts[p.content_type || 'photo'] || 0) + 1; });

      // ── Build PDF ─────────────────────────────────────────────────────────
      const pdfDoc = await PDFDocument.create();
      const fontB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontR  = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const W = 595, H = 842; // A4 portrait
      const PURPLE = rgb(0.486, 0.361, 0.988); // #7C5CFC
      const TEAL   = rgb(0,     0.769, 0.8);   // #00C4CC
      const DARK   = rgb(0.102, 0.102, 0.133); // #1a1a22
      const GREY   = rgb(0.502, 0.502, 0.600);
      const WHITE  = rgb(1, 1, 1);
      const LIGHT  = rgb(0.96, 0.96, 0.98);

      // Helper: wrap text to max width
      function wrapText(text, font, size, maxW) {
        const words = String(text || '').split(' ');
        const lines = [];
        let cur = '';
        for (const w of words) {
          const test = cur ? `${cur} ${w}` : w;
          if (font.widthOfTextAtSize(test, size) > maxW) {
            if (cur) lines.push(cur);
            cur = w;
          } else {
            cur = test;
          }
        }
        if (cur) lines.push(cur);
        return lines;
      }

      // ── PAGE 1: Cover ──────────────────────────────────────────────────────
      const cover = pdfDoc.addPage([W, H]);

      // Purple gradient header (approximated as solid)
      cover.drawRectangle({ x: 0, y: H - 220, width: W, height: 220, color: PURPLE });

      // Decorative circle
      cover.drawCircle({ x: W - 60, y: H - 40, size: 110, color: rgb(1,1,1,0.05), borderColor: rgb(1,1,1,0.1), borderWidth: 1 });
      cover.drawCircle({ x: 40, y: H - 180, size: 70, color: rgb(1,1,1,0.04), borderColor: rgb(1,1,1,0.08), borderWidth: 1 });

      // ItsPosting wordmark
      cover.drawText('ItsPosting', { x: 40, y: H - 60, size: 28, font: fontB, color: WHITE });
      cover.drawText('AI Social Media Report', { x: 40, y: H - 85, size: 13, font: fontR, color: rgb(1,1,1,0.75) });

      // Month label
      cover.drawText(monthLabel, { x: 40, y: H - 140, size: 36, font: fontB, color: WHITE });
      cover.drawText(bizName, { x: 40, y: H - 168, size: 14, font: fontR, color: rgb(1,1,1,0.8) });

      // Teal accent line
      cover.drawLine({ start: { x: 40, y: H - 220 }, end: { x: W - 40, y: H - 220 }, thickness: 2, color: TEAL, opacity: 0.6 });

      // Stats strip on cover
      const stats = [
        { label: 'Posts Published', value: String(posts.length) },
        { label: 'Total Engagement', value: String(totalEng) },
        { label: 'Est. Total Reach', value: totalReach > 999 ? `~${(totalReach/1000).toFixed(1)}k` : `~${totalReach}` },
        { label: 'Top Content Type', value: Object.entries(typeCounts).sort((a,b) => b[1]-a[1])[0]?.[0] || '—' },
      ];
      const sw = (W - 80) / 4;
      stats.forEach((s, i) => {
        const sx = 40 + i * sw;
        const sy = H - 310;
        cover.drawRectangle({ x: sx, y: sy, width: sw - 10, height: 70, color: LIGHT, borderColor: rgb(0.9,0.9,0.95), borderWidth: 1 });
        cover.drawText(s.value, { x: sx + 10, y: sy + 44, size: 22, font: fontB, color: PURPLE });
        cover.drawText(s.label, { x: sx + 10, y: sy + 12, size: 9, font: fontR, color: GREY });
      });

      // "Generated by" footer
      cover.drawLine({ start: { x: 40, y: 80 }, end: { x: W - 40, y: 80 }, thickness: 0.5, color: rgb(0.85,0.85,0.9) });
      cover.drawText(`Generated by ItsPosting — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, {
        x: 40, y: 60, size: 9, font: fontR, color: GREY,
      });
      cover.drawText('app.itsposting.com', { x: W - 140, y: 60, size: 9, font: fontR, color: PURPLE });

      // ── PAGE 2: Top Posts ─────────────────────────────────────────────────
      const postsPage = pdfDoc.addPage([W, H]);
      postsPage.drawRectangle({ x: 0, y: H - 60, width: W, height: 60, color: PURPLE });
      postsPage.drawText(`${monthLabel} — Top Posts`, { x: 40, y: H - 38, size: 16, font: fontB, color: WHITE });
      postsPage.drawText('ItsPosting', { x: W - 100, y: H - 38, size: 11, font: fontB, color: rgb(1,1,1,0.6) });

      let py = H - 90;
      if (topPosts.length === 0) {
        postsPage.drawText('No posts published this month.', { x: 40, y: py, size: 13, font: fontR, color: GREY });
      } else {
        topPosts.forEach((p, i) => {
          const cardH = 100;
          postsPage.drawRectangle({ x: 40, y: py - cardH, width: W - 80, height: cardH, color: LIGHT, borderColor: rgb(0.9,0.9,0.95), borderWidth: 1 });
          // Rank badge
          postsPage.drawCircle({ x: 60, y: py - 30, size: 14, color: PURPLE });
          postsPage.drawText(String(i + 1), { x: 55, y: py - 35, size: 10, font: fontB, color: WHITE });
          // Caption preview
          const captionLines = wrapText(p.caption || 'No caption', fontR, 9, W - 160);
          captionLines.slice(0, 3).forEach((line, li) => {
            postsPage.drawText(line, { x: 82, y: py - 18 - li * 12, size: 9, font: fontR, color: DARK });
          });
          // Date
          const dateStr = p.posted_at ? new Date(p.posted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
          postsPage.drawText(dateStr, { x: 82, y: py - 62, size: 8, font: fontR, color: GREY });
          // Engagement
          const eng = (p.likes || 0) + (p.comments || 0) + (p.shares || 0);
          postsPage.drawText(`${eng} engagements · ${p.likes || 0} likes · ${p.comments || 0} comments`, { x: 82, y: py - 74, size: 8, font: fontR, color: GREY });
          // Score bar
          const barW = 120;
          const score = Math.min(1, (parseFloat(p.performance_score) || 0) / 100);
          postsPage.drawRectangle({ x: W - 180, y: py - 40, width: barW, height: 8, color: rgb(0.88,0.88,0.93) });
          if (score > 0) postsPage.drawRectangle({ x: W - 180, y: py - 40, width: Math.round(barW * score), height: 8, color: PURPLE });
          postsPage.drawText(`Score: ${Math.round((parseFloat(p.performance_score) || 0))}`, { x: W - 180, y: py - 55, size: 8, font: fontR, color: GREY });
          py -= (cardH + 14);
        });
      }

      // Content mix section
      py -= 20;
      postsPage.drawText('Content Mix', { x: 40, y: py, size: 14, font: fontB, color: DARK });
      postsPage.drawLine({ start: { x: 40, y: py - 4 }, end: { x: W - 40, y: py - 4 }, thickness: 0.5, color: rgb(0.85,0.85,0.9) });
      py -= 24;
      const typeLabels = { static: 'Text Card', photo: 'Photo Post', carousel: 'Carousel', video: 'Video' };
      const maxCount = Math.max(...Object.values(typeCounts), 1);
      Object.entries(typeCounts).forEach(([type, count]) => {
        const barW = Math.round(((W - 220) * count) / maxCount);
        postsPage.drawText((typeLabels[type] || type).padEnd(12), { x: 40, y: py, size: 10, font: fontR, color: DARK });
        postsPage.drawRectangle({ x: 145, y: py - 4, width: W - 220, height: 12, color: rgb(0.9,0.9,0.95) });
        if (barW > 0) postsPage.drawRectangle({ x: 145, y: py - 4, width: barW, height: 12, color: PURPLE });
        postsPage.drawText(String(count), { x: W - 65, y: py, size: 10, font: fontB, color: PURPLE });
        py -= 24;
      });

      // ── PAGE 3: Recommendations ───────────────────────────────────────────
      const recPage = pdfDoc.addPage([W, H]);
      recPage.drawRectangle({ x: 0, y: H - 60, width: W, height: 60, color: PURPLE });
      recPage.drawText('PostCore Recommendations', { x: 40, y: H - 38, size: 16, font: fontB, color: WHITE });
      recPage.drawText('ItsPosting', { x: W - 100, y: H - 38, size: 11, font: fontB, color: rgb(1,1,1,0.6) });

      // Generate recommendations based on data
      const recs = [];
      if (posts.length < 8) recs.push({ title: 'Post more consistently', body: `You published ${posts.length} post${posts.length !== 1 ? 's' : ''} this month. Businesses that post 3+ times per week see 5× more engagement. Try using the Post Wizard daily.` });
      else recs.push({ title: 'Great posting frequency!', body: `${posts.length} posts this month puts you ahead of most businesses. Keep the momentum going next month.` });

      const hasVideo = (typeCounts.video || 0) > 0;
      if (!hasVideo) recs.push({ title: 'Add video content', body: 'Video posts generate 2–3× more engagement than photos for local service businesses. Try the Video Wizard for a quick AI-generated video.' });

      const hasCarousel = (typeCounts.carousel || 0) > 0;
      if (!hasCarousel) recs.push({ title: 'Try carousel posts', body: 'Carousels get 109% more reach than single images on Instagram. Use the Post Wizard to create a tips carousel about your services.' });

      if (totalEng === 0) recs.push({ title: 'Boost engagement by asking questions', body: 'Every post should end with a question to your audience. PostCore automatically adds engagement questions — make sure to respond to comments you receive.' });
      else recs.push({ title: 'Respond to your comments', body: `You received ${totalEng} engagements this month. Responding to every comment can increase your reach by up to 42% — it signals activity to the algorithm.` });

      recs.push({ title: 'Use seasonal content', body: 'PostCore automatically detects what month it is and generates industry-specific seasonal content for your area. Use the suggestion cards on your dashboard for instant ideas.' });

      let ry = H - 90;
      recs.forEach((rec, i) => {
        const iconR = 14;
        // Number circle
        recPage.drawCircle({ x: 55, y: ry - 10, size: iconR, color: PURPLE });
        recPage.drawText(String(i + 1), { x: i < 9 ? 51 : 48, y: ry - 14, size: 11, font: fontB, color: WHITE });
        // Title
        recPage.drawText(rec.title, { x: 80, y: ry, size: 12, font: fontB, color: DARK });
        ry -= 18;
        // Body — wrapped
        const bodyLines = wrapText(rec.body, fontR, 10, W - 130);
        bodyLines.forEach(line => {
          recPage.drawText(line, { x: 80, y: ry, size: 10, font: fontR, color: GREY });
          ry -= 14;
        });
        ry -= 16;
        if (ry < 120) return; // Safety stop
      });

      // Footer on all pages
      for (const page of pdfDoc.getPages()) {
        page.drawLine({ start: { x: 40, y: 60 }, end: { x: W - 40, y: 60 }, thickness: 0.5, color: rgb(0.85,0.85,0.9) });
        page.drawText(`${bizName} — ${monthLabel} Social Media Report`, { x: 40, y: 40, size: 8, font: fontR, color: GREY });
        page.drawText('app.itsposting.com', { x: W - 130, y: 40, size: 8, font: fontR, color: PURPLE });
      }

      const pdfBytes = await pdfDoc.save();
      const filename = `ItsPosting-Report-${year}-${String(safeMonth + 1).padStart(2,'0')}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBytes.length);
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      console.error('[analytics] export-pdf error:', err.message);
      res.status(500).json({ error: 'PDF generation failed: ' + err.message });
    }
  });

  return router;
};
