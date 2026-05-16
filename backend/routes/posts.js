const express = require('express');
const { authenticate } = require('../middleware/auth');
const ContentMixTracker = require('../services/ContentMixTracker');
const { convertToUTC, isValidTimezone } = require('../utils/timezone');

module.exports = (pool) => {
  const router = express.Router();

  /**
   * GET /api/posts
   */
  router.get('/', authenticate, async (req, res) => {
    try {
      const { status, platform, contentType, search, limit = 50, offset = 0 } = req.query;
      const safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
      const safeOffset = Math.max(parseInt(offset) || 0, 0);

      let query = 'SELECT * FROM posts WHERE customer_id = $1';
      const params = [req.customerId];
      let paramCount = 1;

      if (status) {
        paramCount++;
        query += ` AND status = $${paramCount}`;
        params.push(status);
      }

      if (platform) {
        paramCount++;
        query += ` AND platform = $${paramCount}`;
        params.push(platform);
      }

      if (contentType) {
        paramCount++;
        query += ` AND content_type = $${paramCount}`;
        params.push(contentType);
      }

      if (search?.trim()) {
        paramCount++;
        query += ` AND caption ILIKE $${paramCount}`;
        params.push(`%${search.trim()}%`);
      }

      query += ` ORDER BY scheduled_date DESC NULLS LAST, created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(safeLimit, safeOffset);

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/posts/upcoming
   */
  router.get('/upcoming', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT * FROM posts 
         WHERE customer_id = $1 
         AND scheduled_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
         AND status IN ('scheduled', 'draft')
         ORDER BY scheduled_date ASC`,
        [req.customerId]
      );

      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/posts/analytics/summary
   */
  router.get('/analytics/summary', authenticate, async (req, res) => {
    try {
      const { period = '30' } = req.query;
      const safePeriod = [7, 14, 30, 90, 365].includes(parseInt(period)) ? parseInt(period) : 30;

      const result = await pool.query(
        `SELECT
          COUNT(*) as total_posts,
          COUNT(*) FILTER (WHERE status = 'posted') as posted_count,
          COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled_count,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
          COUNT(*) FILTER (WHERE content_type = 'video') as video_count,
          COUNT(*) FILTER (WHERE content_type = 'carousel') as carousel_count,
          COALESCE(SUM((engagement->>'likes')::int), 0) as total_likes,
          COALESCE(SUM((engagement->>'comments')::int), 0) as total_comments,
          COALESCE(SUM((engagement->>'shares')::int), 0) as total_shares,
          COALESCE(AVG((engagement->>'likes')::int), 0)::int as avg_likes,
          COALESCE(AVG((engagement->>'comments')::int), 0)::int as avg_comments
        FROM posts
        WHERE customer_id = $1
        AND created_at > NOW() - ($2 || ' days')::INTERVAL`,
        [req.customerId, safePeriod]
      );

      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/posts/:id
   */
  router.get('/:id', authenticate, async (req, res) => {
    try {
      const postResult = await pool.query(
        'SELECT * FROM posts WHERE id = $1 AND customer_id = $2',
        [req.params.id, req.customerId]
      );

      if (postResult.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const post = postResult.rows[0];

      if (post.content_type === 'carousel') {
        const slidesResult = await pool.query(
          'SELECT * FROM post_carousel_slides WHERE post_id = $1 ORDER BY slide_number',
          [post.id]
        );
        post.slides = slidesResult.rows;
      }

      res.json(post);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PATCH /api/posts/:id
   */
  router.patch('/:id', authenticate, async (req, res) => {
    try {
      const { caption, scheduledDate, timezone, platform, platforms, status } = req.body;

      if (caption !== undefined && caption.length > 5000) {
        return res.status(400).json({ error: 'Caption too long (max 5000 characters)' });
      }

      let utcScheduledDate = null;
      let resolvedTimezone = null;

      if (scheduledDate) {
        // Resolve timezone: request body > customer profile > UTC
        if (timezone && isValidTimezone(timezone)) {
          resolvedTimezone = timezone;
        } else {
          const tzRes = await pool.query(
            'SELECT timezone FROM customers WHERE id = $1',
            [req.customerId]
          );
          resolvedTimezone = tzRes.rows[0]?.timezone || 'UTC';
        }
        const utcIso = convertToUTC(scheduledDate, resolvedTimezone);
        utcScheduledDate = utcIso ? new Date(utcIso) : null;
      }

      const result = await pool.query(
        `UPDATE posts SET
          caption = COALESCE($1, caption),
          scheduled_date = COALESCE($2, scheduled_date),
          scheduled_timezone = COALESCE($3, scheduled_timezone),
          platform = COALESCE($4, platform),
          platforms = COALESCE($5, platforms),
          status = COALESCE($6, status),
          posted_at = CASE WHEN $6 = 'posted' AND status != 'posted' THEN NOW() ELSE posted_at END,
          updated_at = NOW()
        WHERE id = $7 AND customer_id = $8
        RETURNING *`,
        [
          caption,
          utcScheduledDate,
          resolvedTimezone,
          platform,
          platforms ? JSON.stringify(platforms) : null,
          status,
          req.params.id,
          req.customerId,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const updatedPost = result.rows[0];

      if (status === 'posted' && updatedPost.status === 'posted') {
        try {
          const tracker = new ContentMixTracker(pool);
          await tracker.updatePostingStreak(req.customerId);
        } catch (streakErr) {
          console.error('[ContentMixTracker] streak update failed:', streakErr.message);
        }
      }

      res.json(updatedPost);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/posts/:id
   */
  router.delete('/:id', authenticate, async (req, res) => {
    try {
      // Verify ownership before deleting
      const check = await pool.query(
        'SELECT id FROM posts WHERE id = $1 AND customer_id = $2',
        [req.params.id, req.customerId]
      );
      if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }

      // Clean up carousel slides before deleting the post
      await pool.query('DELETE FROM post_carousel_slides WHERE post_id = $1', [req.params.id]);

      await pool.query('DELETE FROM posts WHERE id = $1 AND customer_id = $2', [req.params.id, req.customerId]);

      res.json({ success: true, deletedId: parseInt(req.params.id) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
