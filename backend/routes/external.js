/**
 * ItsPosting External API — v1
 * Mounted at /api/v1 in server.js
 *
 * All routes require API key authentication via Authorization: Bearer itspost_...
 * Each route enforces a specific scope via requireScope().
 *
 * Deliberately separate from internal routes — no changes to existing route files.
 */

'use strict';

const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const Anthropic = require('@anthropic-ai/sdk');
const { authenticateApiKey, requireScope } = require('../middleware/apiKey');
const { getBillingCustomerId } = require('../middleware/auth');
const SystemPromptBuilder = require('../services/SystemPromptBuilder');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|webm|avi/i;
    if (allowed.test(file.originalname) && /image|video/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: JPG, PNG, GIF, WebP, MP4, MOV, WebM, AVI'));
    }
  },
});

function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) reject(err); else resolve(result);
    });
    stream.end(buffer);
  });
}

module.exports = (pool) => {
  const router = express.Router();
  const authMiddleware = authenticateApiKey(pool);

  // All routes on this router require API key auth
  router.use(authMiddleware);

  // ─── POSTS ────────────────────────────────────────────────────────────────

  // GET /api/v1/posts
  router.get('/posts', requireScope('posts:read'), async (req, res) => {
    try {
      const { status, platform, limit = 50, offset = 0 } = req.query;
      const safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
      const safeOffset = Math.max(parseInt(offset) || 0, 0);

      let query = `SELECT id, caption, media_url, content_type, status, platform, platforms,
                          scheduled_date, scheduled_timezone, posted_at, engagement,
                          performance_score, source, created_at, updated_at
                   FROM posts WHERE customer_id = $1`;
      const params = [req.customerId];
      let p = 1;

      if (status) { p++; query += ` AND status = $${p}`; params.push(status); }
      if (platform) { p++; query += ` AND platform = $${p}`; params.push(platform); }

      query += ` ORDER BY scheduled_date DESC NULLS LAST, created_at DESC LIMIT $${p + 1} OFFSET $${p + 2}`;
      params.push(safeLimit, safeOffset);

      const { rows } = await pool.query(query, params);
      res.json({ posts: rows, limit: safeLimit, offset: safeOffset });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/v1/posts/:id
  router.get('/posts/:id', requireScope('posts:read'), async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, caption, media_url, content_type, status, platform, platforms,
                scheduled_date, scheduled_timezone, posted_at, engagement,
                performance_score, source, created_at, updated_at
         FROM posts WHERE id = $1 AND customer_id = $2`,
        [req.params.id, req.customerId]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Post not found' });
      res.json({ post: rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/v1/posts — create a draft post
  router.post('/posts', requireScope('posts:write'), async (req, res) => {
    try {
      const { caption, platform, platforms, contentType = 'photo', scheduledDate, mediaUrl } = req.body;

      if (!caption?.trim()) return res.status(400).json({ error: 'caption is required' });
      if (caption.length > 5000) return res.status(400).json({ error: 'caption too long (max 5000 characters)' });

      const status = scheduledDate ? 'scheduled' : 'draft';

      const { rows } = await pool.query(
        `INSERT INTO posts
           (customer_id, caption, platform, platforms, content_type,
            scheduled_date, status, media_url, source, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'api', NOW(), NOW())
         RETURNING id, caption, platform, platforms, content_type, status,
                   scheduled_date, media_url, source, created_at`,
        [
          req.customerId,
          caption.trim(),
          platform || null,
          platforms ? JSON.stringify(platforms) : null,
          contentType,
          scheduledDate || null,
          status,
          mediaUrl || null,
        ]
      );

      res.status(201).json({ post: rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/v1/posts/:id
  router.patch('/posts/:id', requireScope('posts:write'), async (req, res) => {
    try {
      const { caption, status, scheduledDate, platform, platforms } = req.body;

      if (caption !== undefined && caption.length > 5000) {
        return res.status(400).json({ error: 'caption too long (max 5000 characters)' });
      }

      const { rows } = await pool.query(
        `UPDATE posts SET
           caption = COALESCE($1, caption),
           status = COALESCE($2, status),
           scheduled_date = COALESCE($3, scheduled_date),
           platform = COALESCE($4, platform),
           platforms = COALESCE($5, platforms),
           updated_at = NOW()
         WHERE id = $6 AND customer_id = $7
         RETURNING id, caption, platform, platforms, content_type, status,
                   scheduled_date, media_url, created_at, updated_at`,
        [
          caption ?? null,
          status ?? null,
          scheduledDate ?? null,
          platform ?? null,
          platforms ? JSON.stringify(platforms) : null,
          req.params.id,
          req.customerId,
        ]
      );

      if (!rows[0]) return res.status(404).json({ error: 'Post not found' });
      res.json({ post: rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── AI GENERATION ────────────────────────────────────────────────────────

  // POST /api/v1/generate
  // Generates a single AI caption and saves it as a draft post.
  // Uses 1 credit (same as a static text post).
  router.post('/generate', requireScope('generate:write'), async (req, res) => {
    try {
      const { topic, contentType = 'photo', platform = 'instagram', tone } = req.body;
      if (!topic?.trim()) return res.status(400).json({ error: 'topic is required' });

      const billingId = getBillingCustomerId(req);

      // Credit check + deduction (SELECT FOR UPDATE)
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows: [cust] } = await client.query(
          'SELECT credits_balance, plan, business_name, industry, location FROM customers WHERE id = $1 FOR UPDATE',
          [billingId]
        );

        if (!cust) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Account not found' }); }
        if (cust.credits_balance < 1) {
          await client.query('ROLLBACK');
          return res.status(402).json({ error: 'Insufficient credits. Please top up your account.' });
        }

        const newBalance = cust.credits_balance - 1;
        await client.query('UPDATE customers SET credits_balance = $1, updated_at = NOW() WHERE id = $2', [newBalance, billingId]);
        await client.query(
          `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
           VALUES ($1, 'debit', 1, $2, 'API generate — text caption')`,
          [billingId, newBalance]
        );

        // Build a concise system prompt
        let systemPrompt = `You are PostCore, an AI social media expert for local service businesses.
Generate a single social media post caption for ${cust.business_name || 'a local business'} (${cust.industry || 'trades'} industry${cust.location ? `, based in ${cust.location}` : ''}).

Platform: ${platform}
Content type: ${contentType}
Topic: ${topic.trim()}${tone ? `\nTone: ${tone}` : ''}

Platform guidelines:
- instagram: 100-150 words, 8-15 hashtags, 3-5 emojis, end with engagement question
- facebook: 150-250 words, 2-3 hashtags, conversational, end with engagement question
- google_business: 100-200 words, include location, no hashtags, hard CTA

Respond ONLY with valid JSON in this exact format:
{"caption":"...","hashtags":["tag1","tag2"],"engagementQuestion":"..."}`;

        let caption = '';
        let hashtags = [];
        try {
          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            messages: [{ role: 'user', content: systemPrompt }],
          });
          const raw = message.content[0]?.text?.replace(/```json|```/g, '').trim() || '{}';
          const parsed = JSON.parse(raw);
          caption = parsed.caption || '';
          hashtags = parsed.hashtags || [];
        } catch (aiErr) {
          console.error('[external] generate AI error:', aiErr.message);
          await client.query('ROLLBACK');
          return res.status(500).json({ error: 'AI generation failed. Credits were not deducted.' });
        }

        // Save as draft post
        const { rows: [post] } = await client.query(
          `INSERT INTO posts (customer_id, caption, platform, content_type, status, source, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'draft', 'api', NOW(), NOW())
           RETURNING id, caption, platform, content_type, status, source, created_at`,
          [req.customerId, caption, platform, contentType]
        );

        await client.query('COMMIT');

        res.status(201).json({ post, hashtags, creditsRemaining: newBalance });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[external] generate error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── ANALYTICS ────────────────────────────────────────────────────────────

  // GET /api/v1/analytics/summary
  router.get('/analytics/summary', requireScope('analytics:read'), async (req, res) => {
    try {
      const { period = '30' } = req.query;
      const safePeriod = [7, 14, 30, 90, 365].includes(parseInt(period)) ? parseInt(period) : 30;

      const { rows: [summary] } = await pool.query(
        `SELECT
           COUNT(*) AS total_posts,
           COUNT(*) FILTER (WHERE status = 'posted') AS posted_count,
           COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled_count,
           COUNT(*) FILTER (WHERE status = 'draft') AS draft_count,
           COALESCE(SUM((engagement->>'likes')::int), 0) AS total_likes,
           COALESCE(SUM((engagement->>'comments')::int), 0) AS total_comments,
           COALESCE(SUM((engagement->>'shares')::int), 0) AS total_shares,
           COALESCE(AVG(performance_score), 0)::numeric(5,2) AS avg_performance_score
         FROM posts
         WHERE customer_id = $1
           AND created_at > NOW() - ($2 || ' days')::INTERVAL`,
        [req.customerId, safePeriod]
      );

      res.json({ summary, period: safePeriod });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/v1/analytics/posts
  router.get('/analytics/posts', requireScope('analytics:read'), async (req, res) => {
    try {
      const { sort = 'recent', limit = 50 } = req.query;
      const safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
      const ORDER_MAP = { best: 'performance_score DESC NULLS LAST', recent: 'created_at DESC' };
      const orderBy = ORDER_MAP[sort] || ORDER_MAP.recent;

      const { rows } = await pool.query(
        `SELECT id, caption, content_type, platform, status,
                scheduled_date, posted_at, engagement, performance_score, created_at
         FROM posts
         WHERE customer_id = $1
         ORDER BY ${orderBy}
         LIMIT $2`,
        [req.customerId, safeLimit]
      );

      res.json({ posts: rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── MEDIA ────────────────────────────────────────────────────────────────

  // POST /api/v1/media/upload
  router.post('/media/upload', requireScope('media:write'), upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'file is required (multipart/form-data)' });

      const isVideo = req.file.mimetype.startsWith('video/');
      const folder = `itsposting/customer_${req.customerId}`;

      const result = await uploadToCloudinary(req.file.buffer, {
        folder,
        resource_type: isVideo ? 'video' : 'image',
        transformation: isVideo ? [] : [{ width: 2000, height: 2000, crop: 'limit', quality: 85 }],
      });

      const sizeBytes = req.file.size;

      const { rows: [media] } = await pool.query(
        `INSERT INTO media_library
           (customer_id, file_name, file_url, thumbnail_url, file_type, file_size_bytes,
            cloudinary_public_id, width, height, source, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'api_upload', NOW())
         RETURNING id, file_name, file_url, thumbnail_url, file_type, file_size_bytes, created_at`,
        [
          req.customerId,
          req.file.originalname,
          result.secure_url,
          isVideo ? (result.secure_url.replace('/upload/', '/upload/so_0/') ) : result.secure_url,
          isVideo ? 'video' : 'image',
          sizeBytes,
          result.public_id,
          result.width || null,
          result.height || null,
        ]
      );

      // Update storage_used_bytes
      pool.query(
        'UPDATE customers SET storage_used_bytes = COALESCE(storage_used_bytes, 0) + $1 WHERE id = $2',
        [sizeBytes, req.customerId]
      ).catch(() => {});

      res.status(201).json({ media });
    } catch (err) {
      console.error('[external] media upload error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── CONTACTS ─────────────────────────────────────────────────────────────

  // GET /api/v1/contacts
  router.get('/contacts', requireScope('contacts:read'), async (req, res) => {
    try {
      const { search, leadStatus, limit = 25, offset = 0 } = req.query;
      const safeLimit = Math.min(Math.max(parseInt(limit) || 25, 1), 200);
      const safeOffset = Math.max(parseInt(offset) || 0, 0);

      const conditions = ['customer_id = $1', 'is_blocked = false'];
      const params = [req.customerId];
      let p = 1;

      if (search) {
        p++;
        conditions.push(`(name ILIKE $${p} OR email ILIKE $${p} OR phone ILIKE $${p})`);
        params.push(`%${search}%`);
      }
      if (leadStatus) { p++; conditions.push(`lead_status = $${p}`); params.push(leadStatus); }

      const where = conditions.join(' AND ');
      const { rows } = await pool.query(
        `SELECT id, name, email, phone, notes, tags, lead_status, job_type,
                estimated_job_value, source, last_contact_at, created_at
         FROM contacts WHERE ${where}
         ORDER BY last_contact_at DESC NULLS LAST, created_at DESC
         LIMIT $${p + 1} OFFSET $${p + 2}`,
        [...params, safeLimit, safeOffset]
      );

      const { rows: [cnt] } = await pool.query(
        `SELECT COUNT(*) FROM contacts WHERE ${where}`,
        params
      );

      res.json({ contacts: rows, total: parseInt(cnt.count), limit: safeLimit, offset: safeOffset });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/v1/contacts
  router.post('/contacts', requireScope('contacts:write'), async (req, res) => {
    try {
      const { name, email, phone, notes, tags, leadStatus, jobType, estimatedJobValue } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

      const { rows: [contact] } = await pool.query(
        `INSERT INTO contacts
           (customer_id, name, email, phone, notes, tags, lead_status, job_type,
            estimated_job_value, source, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, 'api', NOW(), NOW())
         RETURNING id, name, email, phone, notes, tags, lead_status, job_type,
                   estimated_job_value, source, created_at`,
        [
          req.customerId, name.trim(), email || null, phone || null, notes || null,
          JSON.stringify(tags || []),
          leadStatus || 'new', jobType || null, estimatedJobValue || null,
        ]
      );

      res.status(201).json({ contact });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/v1/contacts/:id
  router.patch('/contacts/:id', requireScope('contacts:write'), async (req, res) => {
    try {
      const { name, email, phone, notes, tags, leadStatus, jobType, estimatedJobValue } = req.body;

      const { rows } = await pool.query(
        `UPDATE contacts SET
           name = COALESCE($1, name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           notes = COALESCE($4, notes),
           tags = COALESCE($5, tags),
           lead_status = COALESCE($6, lead_status),
           job_type = COALESCE($7, job_type),
           estimated_job_value = COALESCE($8, estimated_job_value),
           updated_at = NOW()
         WHERE id = $9 AND customer_id = $10
         RETURNING id, name, email, phone, notes, tags, lead_status, job_type,
                   estimated_job_value, created_at, updated_at`,
        [
          name || null, email || null, phone || null, notes || null,
          tags != null ? JSON.stringify(tags) : null,
          leadStatus || null, jobType || null, estimatedJobValue || null,
          req.params.id, req.customerId,
        ]
      );

      if (!rows[0]) return res.status(404).json({ error: 'Contact not found' });
      res.json({ contact: rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── KNOWLEDGE BASE ───────────────────────────────────────────────────────

  // GET /api/v1/knowledge
  router.get('/knowledge', requireScope('knowledge:write'), async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, knowledge_type, title, content, sort_order, created_at, updated_at
         FROM business_knowledge
         WHERE customer_id = $1 AND is_active = true
         ORDER BY knowledge_type, sort_order, created_at`,
        [req.customerId]
      );
      res.json({ items: rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/v1/knowledge
  router.post('/knowledge', requireScope('knowledge:write'), async (req, res) => {
    try {
      const { knowledgeType, title, content } = req.body;
      if (!knowledgeType || !title || !content) {
        return res.status(400).json({ error: 'knowledgeType, title, and content are required' });
      }

      const ALLOWED_TYPES = ['services', 'reviews', 'differentiators', 'faqs', 'team', 'files'];
      if (!ALLOWED_TYPES.includes(knowledgeType)) {
        return res.status(400).json({ error: `knowledgeType must be one of: ${ALLOWED_TYPES.join(', ')}` });
      }

      // Sanitise (same pattern as existing sanitizeKb)
      const safeTitle = title.replace(/[<>`]/g, '').substring(0, 255);
      const safeContent = content.replace(/[<>`]/g, '').substring(0, 600);

      const { rows: [entry] } = await pool.query(
        `INSERT INTO business_knowledge (customer_id, knowledge_type, title, content, sort_order)
         VALUES ($1, $2, $3, $4,
           (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM business_knowledge WHERE customer_id=$1 AND knowledge_type=$2)
         ) RETURNING id, knowledge_type, title, content, sort_order, created_at`,
        [req.customerId, knowledgeType, safeTitle, safeContent]
      );

      res.status(201).json({ entry });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/v1/knowledge/:id
  router.patch('/knowledge/:id', requireScope('knowledge:write'), async (req, res) => {
    try {
      const { title, content } = req.body;
      if (!title && !content) return res.status(400).json({ error: 'title or content is required' });

      const safeTitle = title ? title.replace(/[<>`]/g, '').substring(0, 255) : undefined;
      const safeContent = content ? content.replace(/[<>`]/g, '').substring(0, 600) : undefined;

      const { rows } = await pool.query(
        `UPDATE business_knowledge SET
           title = COALESCE($1, title),
           content = COALESCE($2, content),
           updated_at = NOW()
         WHERE id = $3 AND customer_id = $4 AND is_active = true
         RETURNING id, knowledge_type, title, content, sort_order, updated_at`,
        [safeTitle ?? null, safeContent ?? null, req.params.id, req.customerId]
      );

      if (!rows[0]) return res.status(404).json({ error: 'Knowledge entry not found' });
      res.json({ entry: rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/v1/knowledge/:id
  router.delete('/knowledge/:id', requireScope('knowledge:write'), async (req, res) => {
    try {
      await pool.query(
        `UPDATE business_knowledge SET is_active = false WHERE id = $1 AND customer_id = $2`,
        [req.params.id, req.customerId]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── API INFO ─────────────────────────────────────────────────────────────

  router.get('/', (req, res) => {
    res.json({
      api: 'ItsPosting External API',
      version: 'v1',
      authenticated_as: req.customerId,
      scopes: req.apiKeyScopes,
      endpoints: {
        posts: ['GET /api/v1/posts', 'GET /api/v1/posts/:id', 'POST /api/v1/posts', 'PATCH /api/v1/posts/:id'],
        generate: ['POST /api/v1/generate'],
        analytics: ['GET /api/v1/analytics/summary', 'GET /api/v1/analytics/posts'],
        media: ['POST /api/v1/media/upload'],
        contacts: ['GET /api/v1/contacts', 'POST /api/v1/contacts', 'PATCH /api/v1/contacts/:id'],
        knowledge: ['GET /api/v1/knowledge', 'POST /api/v1/knowledge', 'PATCH /api/v1/knowledge/:id', 'DELETE /api/v1/knowledge/:id'],
      },
    });
  });

  return router;
};
