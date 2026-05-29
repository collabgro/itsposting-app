const express = require('express');
const { authenticate } = require('../middleware/auth');
const ContentMixTracker = require('../services/ContentMixTracker');

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
           AND p.status = 'published'
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
           WHERE p.status = 'published'
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
           AND p.status = 'published'
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

  return router;
};
