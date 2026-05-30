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
      const { status, platform, contentType, search, from, to, limit = 50, offset = 0 } = req.query;
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

      if (from) {
        const fromDate = new Date(from);
        if (!isNaN(fromDate)) {
          paramCount++;
          query += ` AND COALESCE(scheduled_date, created_at) >= $${paramCount}`;
          params.push(fromDate.toISOString());
        }
      }

      if (to) {
        const toDate = new Date(to);
        if (!isNaN(toDate)) {
          paramCount++;
          query += ` AND COALESCE(scheduled_date, created_at) <= $${paramCount}`;
          params.push(toDate.toISOString());
        }
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
   * GET /api/posts/schedule-conflicts
   * Returns posts already scheduled within ±60 min of the requested datetime on overlapping platforms.
   * Query params: date (ISO), platforms (comma-separated), excludeId (optional post to exclude)
   */
  router.get('/schedule-conflicts', authenticate, async (req, res) => {
    try {
      const { date, platforms, excludeId } = req.query;
      if (!date || !platforms) {
        return res.status(400).json({ error: 'date and platforms are required' });
      }
      const targetDate = new Date(date);
      if (isNaN(targetDate)) {
        return res.status(400).json({ error: 'invalid date' });
      }
      const platformList = platforms.split(',').map(p => p.trim()).filter(Boolean).slice(0, 10);
      const windowMinutes = 60;

      const params = [
        req.customerId,
        new Date(targetDate.getTime() - windowMinutes * 60000).toISOString(),
        new Date(targetDate.getTime() + windowMinutes * 60000).toISOString(),
      ];
      let excludeClause = '';
      if (excludeId) {
        const safeExclude = parseInt(excludeId);
        if (!isNaN(safeExclude)) {
          params.push(safeExclude);
          excludeClause = ` AND id != $${params.length}`;
        }
      }

      const result = await pool.query(
        `SELECT id, caption, platform, platforms, scheduled_date
         FROM posts
         WHERE customer_id = $1
           AND status = 'scheduled'
           AND scheduled_date BETWEEN $2 AND $3
           ${excludeClause}
         ORDER BY scheduled_date ASC
         LIMIT 5`,
        params
      );

      // Filter to overlapping platforms
      const conflicts = result.rows.filter(post => {
        const postPlatforms = post.platforms
          ? (Array.isArray(post.platforms) ? post.platforms : JSON.parse(post.platforms))
          : [post.platform];
        return platformList.some(p => postPlatforms.includes(p));
      });

      res.json({ conflicts });
    } catch (error) {
      console.error('[posts] schedule-conflicts error:', error.message);
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

  // ── GET /api/posts/pending-approval ─────────────────────────────────────────
  // MUST be before /:id to avoid Express capturing it as an ID param.
  router.get('/pending-approval', authenticate, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT p.id, p.customer_id, p.content_type, p.caption, p.media_url, p.platforms,
                p.approval_status, p.approval_note, p.approval_history, p.created_at,
                c.business_name, c.workspace_display_name
           FROM posts p
           JOIN customers c ON c.id = p.customer_id
          WHERE (c.id = $1 OR c.parent_customer_id = $1)
            AND p.approval_status = 'pending'
          ORDER BY p.created_at ASC
          LIMIT 50`,
        [req.customerId]
      );
      res.json(rows);
    } catch (err) {
      console.error('[posts/pending-approval]', err.message);
      res.status(500).json({ error: err.message });
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
      const { caption, scheduledDate, timezone, platform, platforms, status, chosenVariation } = req.body;

      if (caption !== undefined && caption.length > 5000) {
        return res.status(400).json({ error: 'Caption too long (max 5000 characters)' });
      }
      if (chosenVariation !== undefined && chosenVariation !== null && !['A', 'B', 'C'].includes(chosenVariation)) {
        return res.status(400).json({ error: 'chosenVariation must be A, B, or C' });
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
          chosen_variation = COALESCE($9, chosen_variation),
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
          chosenVariation || null,
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

        // Sync real engagement metrics 5 minutes after publish (gives platforms time to process)
        const postIds = updatedPost.platform_post_ids;
        if (postIds && Object.keys(postIds).length) {
          setTimeout(() => {
            const MetricsSyncService = require('../services/MetricsSyncService');
            new MetricsSyncService(pool).syncPost(req.params.id, req.customerId).catch(err =>
              console.warn(`[posts] Delayed metrics sync failed for post ${req.params.id}:`, err.message)
            );
          }, 5 * 60 * 1000);
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

  // ── POST /api/posts/:id/submit-approval ──────────────────────────────────────
  // Sub-account submits a draft post for manager approval.
  router.post('/:id/submit-approval', authenticate, async (req, res) => {
    try {
      const postId = parseInt(req.params.id);

      // Verify ownership
      const check = await pool.query(
        `SELECT p.id, p.status, c.parent_customer_id
           FROM posts p JOIN customers c ON c.id = p.customer_id
          WHERE p.id=$1 AND p.customer_id=$2`,
        [postId, req.customerId]
      );
      if (!check.rows[0]) return res.status(404).json({ error: 'Post not found' });
      if (check.rows[0].status !== 'draft') return res.status(400).json({ error: 'Only drafts can be submitted for approval' });

      const historyEntry = JSON.stringify({ action: 'submitted', by: req.customerId, at: new Date().toISOString() });
      await pool.query(
        `UPDATE posts
            SET approval_status = 'pending',
                approval_history = COALESCE(approval_history, '[]'::jsonb) || $1::jsonb
          WHERE id=$2`,
        [`[${historyEntry}]`, postId]
      );
      res.json({ success: true, approvalStatus: 'pending' });
    } catch (err) {
      console.error('[posts/submit-approval]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/posts/:id/approve ──────────────────────────────────────────────
  // Manager approves a pending post — moves it back to draft (ready to schedule/publish).
  router.post('/:id/approve', authenticate, async (req, res) => {
    try {
      const postId = parseInt(req.params.id);

      const check = await pool.query(
        `SELECT p.id, p.approval_status, c.parent_customer_id, c.id AS post_owner
           FROM posts p JOIN customers c ON c.id = p.customer_id
          WHERE p.id=$1 AND (c.id=$2 OR c.parent_customer_id=$2)`,
        [postId, req.customerId]
      );
      if (!check.rows[0]) return res.status(404).json({ error: 'Post not found' });
      if (check.rows[0].approval_status !== 'pending') return res.status(400).json({ error: 'Post is not pending approval' });

      const historyEntry = JSON.stringify({ action: 'approved', by: req.customerId, at: new Date().toISOString() });
      await pool.query(
        `UPDATE posts
            SET approval_status = 'approved',
                status = 'draft',
                approval_history = COALESCE(approval_history, '[]'::jsonb) || $1::jsonb
          WHERE id=$2`,
        [`[${historyEntry}]`, postId]
      );
      res.json({ success: true, approvalStatus: 'approved' });
    } catch (err) {
      console.error('[posts/approve]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/posts/:id/request-changes ─────────────────────────────────────
  // Manager requests changes — post stays as draft with a note.
  router.post('/:id/request-changes', authenticate, async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      const { note = '' } = req.body;

      const check = await pool.query(
        `SELECT p.id, p.approval_status, c.parent_customer_id
           FROM posts p JOIN customers c ON c.id = p.customer_id
          WHERE p.id=$1 AND (c.id=$2 OR c.parent_customer_id=$2)`,
        [postId, req.customerId]
      );
      if (!check.rows[0]) return res.status(404).json({ error: 'Post not found' });
      if (check.rows[0].approval_status !== 'pending') return res.status(400).json({ error: 'Post is not pending approval' });

      const historyEntry = JSON.stringify({ action: 'changes_requested', by: req.customerId, note: note.substring(0, 400), at: new Date().toISOString() });
      await pool.query(
        `UPDATE posts
            SET approval_status = 'changes_requested',
                approval_note = $1,
                approval_history = COALESCE(approval_history, '[]'::jsonb) || $2::jsonb
          WHERE id=$3`,
        [note.substring(0, 400), `[${historyEntry}]`, postId]
      );
      res.json({ success: true, approvalStatus: 'changes_requested' });
    } catch (err) {
      console.error('[posts/request-changes]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/posts/:id/reject-approval ─────────────────────────────────────
  // ── POST / — create a draft/scheduled post directly (used by calendar) ──────
  router.post('/', authenticate, async (req, res) => {
    try {
      const {
        caption = '', content_type = 'photo_post', platform = 'facebook',
        platforms = [], status = 'draft', scheduled_date, scheduled_timezone,
        media_url, source = 'manual_upload',
      } = req.body;

      if (!caption && !media_url) return res.status(400).json({ error: 'Caption or media is required' });

      const result = await pool.query(
        `INSERT INTO posts (customer_id, caption, content_type, platform, platforms, status,
                            scheduled_date, scheduled_timezone, media_url, source,
                            uploaded_by_user, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,NOW(),NOW())
         RETURNING *`,
        [
          req.customerId,
          caption.substring(0, 3000),
          content_type,
          platform,
          Array.isArray(platforms) ? platforms : [platform],
          status,
          scheduled_date || null,
          scheduled_timezone || null,
          media_url || null,
          source,
        ]
      );
      res.status(201).json({ post: result.rows[0] });
    } catch (err) {
      console.error('[posts POST /]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/reject-approval', authenticate, async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      const { note = '' } = req.body;

      const check = await pool.query(
        `SELECT p.id, p.approval_status, c.parent_customer_id
           FROM posts p JOIN customers c ON c.id = p.customer_id
          WHERE p.id=$1 AND (c.id=$2 OR c.parent_customer_id=$2)`,
        [postId, req.customerId]
      );
      if (!check.rows[0]) return res.status(404).json({ error: 'Post not found' });
      if (check.rows[0].approval_status !== 'pending') return res.status(400).json({ error: 'Post is not pending approval' });

      const historyEntry = JSON.stringify({ action: 'rejected', by: req.customerId, note: note.substring(0, 400), at: new Date().toISOString() });
      await pool.query(
        `UPDATE posts
            SET approval_status = 'rejected',
                approval_note = $1,
                approval_history = COALESCE(approval_history, '[]'::jsonb) || $2::jsonb
          WHERE id=$3`,
        [note.substring(0, 400), `[${historyEntry}]`, postId]
      );
      res.json({ success: true, approvalStatus: 'rejected' });
    } catch (err) {
      console.error('[posts/reject-approval]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
