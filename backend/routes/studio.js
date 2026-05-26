const express = require('express');
const sharp = require('sharp');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate, getBillingCustomerId } = require('../middleware/auth');
const { fetchImageAsBuffer, uploadToCloudinary } = require('../services/ImageResizer');
const VideoComposer = require('../services/VideoComposer');
const VideoService = require('../services/VideoService');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Helpers ─────────────────────────────────────────────────────────────────

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text, maxChars) {
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (candidate.length > maxChars && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function buildOverlaySVG(title, subtitle, style, width, height, overlayColor, textColor, opacity) {
  const titleLines = wrapText(escapeXml(title), 22);
  const subLines = subtitle ? wrapText(escapeXml(subtitle), 38) : [];
  const lineH = 52;
  const subLineH = 30;

  if (style === 'banner') {
    const barH = 80 + titleLines.length * lineH + (subLines.length ? 16 + subLines.length * subLineH : 0);
    const titleY = 50;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect x="0" y="0" width="${width}" height="${barH}" fill="${overlayColor}" opacity="${opacity}"/>
      ${titleLines.map((l, i) =>
        `<text x="${width / 2}" y="${titleY + i * lineH}" font-family="Arial,sans-serif" font-size="46" font-weight="700" fill="${textColor}" text-anchor="middle" dominant-baseline="hanging">${l}</text>`
      ).join('\n      ')}
      ${subLines.map((l, i) =>
        `<text x="${width / 2}" y="${titleY + titleLines.length * lineH + 16 + i * subLineH}" font-family="Arial,sans-serif" font-size="26" font-weight="400" fill="${textColor}" text-anchor="middle" dominant-baseline="hanging" opacity="0.9">${l}</text>`
      ).join('\n      ')}
    </svg>`;
  }

  if (style === 'bottom_bar') {
    const barH = 80 + titleLines.length * lineH + (subLines.length ? 16 + subLines.length * subLineH : 0);
    const barY = height - barH;
    const titleY = barY + 50;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect x="0" y="${barY}" width="${width}" height="${barH}" fill="${overlayColor}" opacity="${opacity}"/>
      ${titleLines.map((l, i) =>
        `<text x="${width / 2}" y="${titleY + i * lineH}" font-family="Arial,sans-serif" font-size="46" font-weight="700" fill="${textColor}" text-anchor="middle" dominant-baseline="hanging">${l}</text>`
      ).join('\n      ')}
      ${subLines.map((l, i) =>
        `<text x="${width / 2}" y="${titleY + titleLines.length * lineH + 16 + i * subLineH}" font-family="Arial,sans-serif" font-size="26" font-weight="400" fill="${textColor}" text-anchor="middle" dominant-baseline="hanging" opacity="0.9">${l}</text>`
      ).join('\n      ')}
    </svg>`;
  }

  if (style === 'center') {
    const boxW = Math.floor(width * 0.85);
    const contentH = titleLines.length * lineH + (subLines.length ? 16 + subLines.length * subLineH : 0);
    const boxH = contentH + 80;
    const boxX = Math.floor((width - boxW) / 2);
    const boxY = Math.floor((height - boxH) / 2);
    const titleY = boxY + 40;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="14" fill="${overlayColor}" opacity="${opacity}"/>
      ${titleLines.map((l, i) =>
        `<text x="${width / 2}" y="${titleY + i * lineH}" font-family="Arial,sans-serif" font-size="46" font-weight="700" fill="${textColor}" text-anchor="middle" dominant-baseline="hanging">${l}</text>`
      ).join('\n      ')}
      ${subLines.map((l, i) =>
        `<text x="${width / 2}" y="${titleY + titleLines.length * lineH + 16 + i * subLineH}" font-family="Arial,sans-serif" font-size="26" font-weight="400" fill="${textColor}" text-anchor="middle" dominant-baseline="hanging" opacity="0.9">${l}</text>`
      ).join('\n      ')}
    </svg>`;
  }

  // full_overlay
  const contentH = titleLines.length * lineH + (subLines.length ? 16 + subLines.length * subLineH : 0);
  const startY = Math.floor((height - contentH) / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="0" y="0" width="${width}" height="${height}" fill="${overlayColor}" opacity="${Math.min(opacity * 0.65, 0.75)}"/>
    ${titleLines.map((l, i) =>
      `<text x="${width / 2}" y="${startY + i * lineH}" font-family="Arial,sans-serif" font-size="52" font-weight="800" fill="${textColor}" text-anchor="middle" dominant-baseline="hanging">${l}</text>`
    ).join('\n    ')}
    ${subLines.map((l, i) =>
      `<text x="${width / 2}" y="${startY + titleLines.length * lineH + 16 + i * subLineH}" font-family="Arial,sans-serif" font-size="28" font-weight="400" fill="${textColor}" text-anchor="middle" dominant-baseline="hanging" opacity="0.9">${l}</text>`
    ).join('\n    ')}
  </svg>`;
}

// ── Routes ───────────────────────────────────────────────────────────────────

module.exports = (pool) => {
  const router = express.Router();

  // GET /api/studio/photos
  router.get('/photos', authenticate, async (req, res) => {
    try {
      const { rows: [customer] } = await pool.query('SELECT industry FROM customers WHERE id = $1', [req.customerId]);
      const industry = req.query.industry || customer?.industry || 'general';
      const category = req.query.category || null;
      const search = req.query.search ? `%${req.query.search}%` : null;
      const limit = Math.min(parseInt(req.query.limit) || 30, 60);
      const offset = parseInt(req.query.offset) || 0;

      const industryParam = industry !== 'all' ? industry : null;
      const cleanParams = [];
      const cleanConditions = ['is_active = true'];
      let p = 1;
      if (industryParam) {
        cleanConditions.push(`(industry = $${p} OR industry = 'general')`);
        cleanParams.push(industryParam);
        p++;
      }
      if (category && category !== 'all') {
        cleanConditions.push(`category = $${p}`);
        cleanParams.push(category);
        p++;
      }
      if (search) {
        cleanConditions.push(`(title ILIKE $${p})`);
        cleanParams.push(search);
        p++;
      }
      const limitIdx = p; const offsetIdx = p + 1;
      cleanParams.push(limit, offset);

      const orderBy = industryParam
        ? `ORDER BY (industry = $1) DESC, usage_count DESC`
        : `ORDER BY usage_count DESC`;

      const sql = `SELECT id, industry, category, tags, url, thumbnail_url, title, width, height, usage_count, created_at
                   FROM stock_photos
                   WHERE ${cleanConditions.join(' AND ')}
                   ${orderBy}
                   LIMIT $${limitIdx} OFFSET $${offsetIdx}`;

      const countSql = `SELECT COUNT(*) FROM stock_photos WHERE ${cleanConditions.join(' AND ')}`;

      const [{ rows: stockPhotos }, { rows: countRows }, { rows: myMedia }] = await Promise.all([
        pool.query(sql, cleanParams),
        pool.query(countSql, cleanParams.slice(0, cleanParams.length - 2)),
        pool.query(
          `SELECT id, url, thumbnail_url, file_name AS title, width, height, uploaded_at AS created_at
           FROM media_library
           WHERE customer_id = $1 AND file_type = 'image'
           ORDER BY uploaded_at DESC LIMIT 50`,
          [req.customerId]
        ),
      ]);

      const stockWithSource = stockPhotos.map(p => ({ ...p, source: 'stock' }));
      const myWithSource = myMedia.map(p => ({ ...p, source: 'mine', usage_count: 0 }));

      res.json({ photos: [...stockWithSource, ...myWithSource], total: parseInt(countRows[0].count) + myWithSource.length });
    } catch (err) {
      console.error('[Studio] GET /photos:', err.message);
      res.status(500).json({ error: 'Failed to fetch photos' });
    }
  });

  // GET /api/studio/photos/:id
  router.get('/photos/:id', authenticate, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, industry, category, tags, url, thumbnail_url, title, description, width, height, usage_count
         FROM stock_photos WHERE id = $1 AND is_active = true`,
        [parseInt(req.params.id)]
      );
      if (!rows.length) return res.status(404).json({ error: 'Photo not found' });
      res.json({ photo: rows[0] });
    } catch (err) {
      console.error('[Studio] GET /photos/:id:', err.message);
      res.status(500).json({ error: 'Failed to fetch photo' });
    }
  });

  // POST /api/studio/format  (1 credit — PostCore formats the overlay text)
  router.post('/format', authenticate, async (req, res) => {
    try {
      const billingId = getBillingCustomerId(req);
      const { stockPhotoId, prompt, style } = req.body;

      if (!stockPhotoId || !prompt?.trim()) {
        return res.status(400).json({ error: 'stockPhotoId and prompt are required' });
      }

      // Credit check
      const { rows: [billing] } = await pool.query(
        'SELECT credits_balance FROM customers WHERE id = $1',
        [billingId]
      );
      if ((billing?.credits_balance || 0) < 1) {
        return res.status(402).json({ error: 'You need at least 1 credit to use PostCore formatting. Please purchase more credits.' });
      }

      // Load customer + photo context
      const [{ rows: [customer] }, { rows: [photo] }] = await Promise.all([
        pool.query('SELECT business_name, industry, location, brand_colors FROM customers WHERE id = $1', [req.customerId]),
        pool.query('SELECT title, description, industry, category, tags FROM stock_photos WHERE id = $1', [stockPhotoId]),
      ]);
      if (!photo) return res.status(404).json({ error: 'Stock photo not found' });

      let brandColorHint = '';
      if (customer?.brand_colors) {
        try {
          const bc = typeof customer.brand_colors === 'string' ? JSON.parse(customer.brand_colors) : customer.brand_colors;
          const primary = bc.primary || bc.brand || bc.main;
          if (primary) brandColorHint = `\nBrand primary color: ${primary} — prefer this for the overlay if it provides enough contrast.`;
        } catch {}
      }

      const systemPrompt = `You are PostCore, the AI advisor for ItsPosting — a social media platform for local trade businesses.
The customer wants to create a social media graphic using a stock photo.
Your job is to format their request into clean, professional text overlay that goes ON TOP of the photo.

Business: ${customer?.business_name || 'Local Trade Business'}
Industry: ${customer?.industry || photo.industry}
Location: ${customer?.location || ''}
Photo context: ${photo.title || ''} — category: ${photo.category}, tags: ${(photo.tags || []).join(', ')}${brandColorHint}

Rules:
- Title: maximum 8 words. Bold, punchy, scroll-stopping. This is the big text.
- Subtitle: maximum 20 words. Adds context or a soft CTA. This is smaller text below the title. Can be omitted if not needed.
- Both lines must work visually overlaid on a photo — keep it short and clean.
- Match the industry tone. A plumber sounds different from a landscaper.
- Never use: "delve", "synergy", "leverage", "optimize", "utilize"
- If the prompt is vague, use industry context to make it specific.
- For overlay color, prefer the customer's brand color if provided; otherwise suggest a dark shade that contrasts with typical outdoor/trade photos.

Return ONLY valid JSON (no markdown fences):
{
  "title": "Short punchy title here",
  "subtitle": "Optional subtitle with more context",
  "suggestedOverlayColor": "#1a5c2a",
  "suggestedTextColor": "#ffffff",
  "suggestedStyle": "banner"
}`;

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{ role: 'user', content: `Customer prompt: "${prompt.trim()}"` }],
        system: systemPrompt,
      });

      let parsed;
      try {
        const raw = message.content[0].text.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(raw);
      } catch {
        return res.status(500).json({ error: 'PostCore returned an unexpected response. Please try again.' });
      }

      // Deduct 1 credit
      await pool.query('UPDATE customers SET credits_balance = credits_balance - 1 WHERE id = $1', [billingId]);
      await pool.query(
        `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
         VALUES ($1, 'usage', -1, $2, 'Photo Studio — PostCore text formatting')`,
        [billingId, (billing.credits_balance || 0) - 1]
      );

      res.json({
        title: parsed.title || '',
        subtitle: parsed.subtitle || '',
        overlayColor: parsed.suggestedOverlayColor || '#1a5c2a',
        textColor: parsed.suggestedTextColor || '#ffffff',
        style: parsed.suggestedStyle || style || 'banner',
        stockPhotoUrl: photo.url,
      });
    } catch (err) {
      console.error('[Studio] POST /format:', err.message);
      res.status(500).json({ error: 'Failed to format overlay text' });
    }
  });

  // POST /api/studio/generate  (0 credits — Sharp composite, no AI)
  router.post('/generate', authenticate, async (req, res) => {
    try {
      const {
        stockPhotoId, title, subtitle = '',
        style = 'banner', overlayColor = '#1a5c2a', textColor = '#ffffff',
        opacity = 0.85, outputWidth = 1080, outputHeight = 1350,
      } = req.body;

      if (!stockPhotoId || !title?.trim()) {
        return res.status(400).json({ error: 'stockPhotoId and title are required' });
      }

      const { rows: [photo] } = await pool.query(
        'SELECT id, url FROM stock_photos WHERE id = $1 AND is_active = true',
        [parseInt(stockPhotoId)]
      );
      if (!photo) return res.status(404).json({ error: 'Stock photo not found' });

      // 1. Download original photo
      const photoBuffer = await fetchImageAsBuffer(photo.url);

      // 2. Resize to target dimensions
      const resizedBuffer = await sharp(photoBuffer)
        .rotate()
        .resize(outputWidth, outputHeight, { fit: 'cover', position: 'centre' })
        .toBuffer();

      // 3. Build SVG overlay
      const svgString = buildOverlaySVG(
        title.trim(), subtitle?.trim() || '', style,
        outputWidth, outputHeight, overlayColor, textColor, parseFloat(opacity)
      );
      const svgBuffer = Buffer.from(svgString);

      // 4. Composite SVG onto photo
      const finalBuffer = await sharp(resizedBuffer)
        .composite([{ input: svgBuffer, top: 0, left: 0 }])
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();

      // 5. Upload to Cloudinary
      const publicId = `itsposting/studio/${req.customerId}/${Date.now()}`;
      const outputUrl = await uploadToCloudinary(finalBuffer, publicId);

      // 6. Save creation
      const { rows: [creation] } = await pool.query(
        `INSERT INTO studio_creations
           (customer_id, stock_photo_id, overlay_title, overlay_subtitle, overlay_style,
            overlay_color, text_color, overlay_opacity, output_url, output_cloudinary_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'created')
         RETURNING id, output_url, overlay_title, overlay_subtitle, overlay_style, created_at`,
        [
          req.customerId, photo.id, title.trim(), subtitle?.trim() || null,
          style, overlayColor, textColor, parseFloat(opacity), outputUrl, publicId,
        ]
      );

      // 7. Increment usage count
      await pool.query('UPDATE stock_photos SET usage_count = usage_count + 1 WHERE id = $1', [photo.id]);

      res.json({
        creation: {
          id: creation.id,
          outputUrl: creation.output_url,
          title: creation.overlay_title,
          subtitle: creation.overlay_subtitle,
          style: creation.overlay_style,
          createdAt: creation.created_at,
        },
      });
    } catch (err) {
      console.error('[Studio] POST /generate:', err.message);
      res.status(500).json({ error: 'Failed to generate studio graphic' });
    }
  });

  // GET /api/studio/creations
  router.get('/creations', authenticate, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 20, 50);
      const offset = parseInt(req.query.offset) || 0;

      const { rows } = await pool.query(
        `SELECT sc.id, sc.output_url, sc.overlay_title, sc.overlay_subtitle,
                sc.overlay_style, sc.overlay_color, sc.status, sc.created_at,
                sp.title AS photo_title, sp.industry AS photo_industry
         FROM studio_creations sc
         LEFT JOIN stock_photos sp ON sp.id = sc.stock_photo_id
         WHERE sc.customer_id = $1
         ORDER BY sc.created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.customerId, limit, offset]
      );

      res.json({ creations: rows });
    } catch (err) {
      console.error('[Studio] GET /creations:', err.message);
      res.status(500).json({ error: 'Failed to fetch creations' });
    }
  });

  // GET /api/studio/creations/:id  (single creation, includes canvas_json for editing)
  router.get('/creations/:id', authenticate, async (req, res) => {
    try {
      const { rows: [creation] } = await pool.query(
        `SELECT sc.*, sp.title AS photo_title, sp.industry AS photo_industry
         FROM studio_creations sc
         LEFT JOIN stock_photos sp ON sp.id = sc.stock_photo_id
         WHERE sc.id = $1 AND sc.customer_id = $2`,
        [parseInt(req.params.id), req.customerId]
      );
      if (!creation) return res.status(404).json({ error: 'Creation not found' });
      res.json({ creation });
    } catch (err) {
      console.error('[Studio] GET /creations/:id:', err.message);
      res.status(500).json({ error: 'Failed to fetch creation' });
    }
  });

  // POST /api/studio/save  (0 credits — client-side export for images; metadata-only for videos)
  router.post('/save', authenticate, async (req, res) => {
    try {
      const { imageDataUrl, canvasJson, videoJson, creationType = 'image', title = 'Untitled', id: existingId, backgroundSource = null, backgroundId = null } = req.body;

      // ── Video save (no image upload — just persist JSON) ──────────────────
      if (creationType === 'video') {
        if (existingId) {
          const { rows: [updated] } = await pool.query(
            `UPDATE studio_creations SET overlay_title = $1, video_json = $2
             WHERE id = $3 AND customer_id = $4
             RETURNING id, overlay_title, output_url, created_at`,
            [title.trim(), JSON.stringify(videoJson || {}), parseInt(existingId), req.customerId]
          );
          if (!updated) return res.status(404).json({ error: 'Creation not found' });
          return res.json({ creation: { id: updated.id, title: updated.overlay_title, outputUrl: updated.output_url, createdAt: updated.created_at } });
        }
        const { rows: [creation] } = await pool.query(
          `INSERT INTO studio_creations (customer_id, overlay_title, video_json, creation_type, render_status, status)
           VALUES ($1, $2, $3, 'video', 'none', 'created')
           RETURNING id, overlay_title, output_url, created_at`,
          [req.customerId, title.trim(), JSON.stringify(videoJson || {})]
        );
        return res.json({ creation: { id: creation.id, title: creation.overlay_title, outputUrl: creation.output_url, createdAt: creation.created_at } });
      }

      // ── Image save (upload DataURL to Cloudinary) ─────────────────────────
      if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Valid imageDataUrl is required' });
      }

      const base64Data = imageDataUrl.split(',')[1];
      if (!base64Data) return res.status(400).json({ error: 'Invalid image data' });

      const buffer = Buffer.from(base64Data, 'base64');
      const publicId = `itsposting/studio/${req.customerId}/${Date.now()}`;
      const outputUrl = await uploadToCloudinary(buffer, publicId);

      const stockPhotoId = backgroundSource === 'stock' ? (parseInt(backgroundId) || null) : null;
      const mediaLibraryId = backgroundSource === 'mine' ? (parseInt(backgroundId) || null) : null;

      const { rows: [creation] } = await pool.query(
        `INSERT INTO studio_creations
           (customer_id, stock_photo_id, media_library_id, overlay_title, canvas_json,
            output_url, output_cloudinary_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'created')
         RETURNING id, output_url, overlay_title, created_at`,
        [req.customerId, stockPhotoId, mediaLibraryId, title.trim(), canvasJson ? JSON.stringify(canvasJson) : null, outputUrl, publicId]
      );

      res.json({
        creation: {
          id: creation.id,
          outputUrl: creation.output_url,
          title: creation.overlay_title,
          createdAt: creation.created_at,
        },
      });
    } catch (err) {
      console.error('[Studio] POST /save:', err.message);
      res.status(500).json({ error: 'Failed to save template' });
    }
  });

  // POST /api/studio/creations/:id/post  (0 credits)
  router.post('/creations/:id/post', authenticate, async (req, res) => {
    try {
      const creationId = parseInt(req.params.id);
      const { caption = '', hashtags = [], platforms = [], scheduleMode = 'draft', scheduledDate = null } = req.body;

      const { rows: [creation] } = await pool.query(
        'SELECT * FROM studio_creations WHERE id = $1 AND customer_id = $2',
        [creationId, req.customerId]
      );
      if (!creation) return res.status(404).json({ error: 'Creation not found' });

      const fullCaption = [caption, ...(Array.isArray(hashtags) ? hashtags.map(t => `#${t.replace(/^#/, '')}`) : [])].filter(Boolean).join('\n\n');
      const scheduledAt = scheduleMode === 'schedule' && scheduledDate ? new Date(scheduledDate) : null;
      const postStatus = scheduleMode === 'now' ? 'published' : scheduleMode === 'schedule' ? 'scheduled' : 'draft';

      const { rows: [post] } = await pool.query(
        `INSERT INTO posts (customer_id, content, media_url, status, source, platforms, scheduled_at, uploaded_by_user)
         VALUES ($1, $2, $3, $4, 'studio', $5, $6, false)
         RETURNING id, status, created_at`,
        [req.customerId, fullCaption, creation.output_url, postStatus, JSON.stringify(platforms), scheduledAt]
      );

      await pool.query(
        `UPDATE studio_creations SET post_id = $1, status = $2 WHERE id = $3`,
        [post.id, postStatus === 'published' ? 'posted' : 'scheduled', creationId]
      );

      res.json({ post: { id: post.id, status: post.status, createdAt: post.created_at } });
    } catch (err) {
      console.error('[Studio] POST /creations/:id/post:', err.message);
      res.status(500).json({ error: 'Failed to create post from studio creation' });
    }
  });

  // ── Video render helpers ─────────────────────────────────────────────────────

  function calculateDuration(videoJson) {
    if (!videoJson.clips?.length) return 0;
    const last = videoJson.clips[videoJson.clips.length - 1];
    return (last.trackStart || 0) + (last.duration || 0);
  }

  // POST /api/studio/video-render — start server-side MP4 export job
  router.post('/video-render', authenticate, async (req, res) => {
    try {
      const { videoJson, title = 'Untitled Video', quality = '720p' } = req.body;
      if (!videoJson || !Array.isArray(videoJson.clips) || videoJson.clips.length === 0) {
        return res.status(400).json({ error: 'videoJson with at least one clip is required' });
      }
      if (!['720p', '1080p'].includes(quality)) {
        return res.status(400).json({ error: 'quality must be 720p or 1080p' });
      }

      const { rows: [creation] } = await pool.query(
        `INSERT INTO studio_creations
           (customer_id, overlay_title, video_json, creation_type, render_status, status)
         VALUES ($1, $2, $3, 'video', 'rendering', 'created')
         RETURNING id`,
        [req.customerId, title.slice(0, 255), JSON.stringify(videoJson)]
      );

      res.json({ jobId: creation.id });

      setImmediate(async () => {
        try {
          const outputUrl = await VideoComposer.renderVideo(videoJson, req.customerId, quality);
          const durSec = calculateDuration(videoJson);
          await pool.query(
            `UPDATE studio_creations
             SET render_status = 'completed', output_url = $1, duration_seconds = $2, status = 'created'
             WHERE id = $3`,
            [outputUrl, durSec, creation.id]
          );
        } catch (err) {
          console.error('[Studio] video-render background failed:', err.message);
          await pool.query(
            `UPDATE studio_creations SET render_status = 'failed' WHERE id = $1`,
            [creation.id]
          );
        }
      });
    } catch (err) {
      console.error('[Studio] POST /video-render:', err.message);
      res.status(500).json({ error: 'Failed to start video render' });
    }
  });

  // GET /api/studio/video-render/:jobId — poll render status
  router.get('/video-render/:jobId', authenticate, async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      if (!jobId) return res.status(400).json({ error: 'Invalid jobId' });
      const { rows: [c] } = await pool.query(
        `SELECT render_status, output_url, duration_seconds FROM studio_creations
         WHERE id = $1 AND customer_id = $2`,
        [jobId, req.customerId]
      );
      if (!c) return res.status(404).json({ error: 'Render job not found' });
      res.json({ status: c.render_status, outputUrl: c.output_url || null, duration: c.duration_seconds || null });
    } catch (err) {
      console.error('[Studio] GET /video-render/:jobId:', err.message);
      res.status(500).json({ error: 'Failed to check render status' });
    }
  });

  // POST /api/studio/ai-clip — generate an AI video clip (5 credits)
  router.post('/ai-clip', authenticate, async (req, res) => {
    try {
      const { prompt, aspectRatio = '9:16', durationSeconds = 7 } = req.body;
      if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt is required' });

      const billingId = await getBillingCustomerId(req);

      // Atomic credit deduction (5 credits)
      const COST = 5;
      const { rows: [updated] } = await pool.query(
        `UPDATE customers SET credits_balance = credits_balance - $1
         WHERE id = $2 AND credits_balance >= $1
         RETURNING credits_balance`,
        [COST, billingId]
      );
      if (!updated) {
        return res.status(402).json({ error: `Insufficient credits. Generating an AI clip costs ${COST} credits.` });
      }

      await pool.query(
        `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
         VALUES ($1, 'deduct', $2, $3, 'AI video clip generation')`,
        [billingId, COST, updated.credits_balance]
      );

      const { rows: [customer] } = await pool.query('SELECT * FROM customers WHERE id = $1', [req.customerId]);

      const result = await VideoService.generate(customer, prompt.trim().slice(0, 500), {
        videoType: 'services',
        imagePrompt: prompt.trim().slice(0, 500),
        aspectRatio,
        durationSeconds: Math.min(Math.max(parseInt(durationSeconds) || 7, 3), 15),
      });

      res.json({
        clip: {
          url: result.url,
          provider: result.provider,
          duration: parseInt(durationSeconds) || 7,
          type: 'video',
        },
        creditsRemaining: updated.credits_balance,
      });
    } catch (err) {
      console.error('[Studio] POST /ai-clip:', err.message);
      res.status(500).json({ error: 'Failed to generate AI clip' });
    }
  });

  // ── GET /api/studio/templates — curated templates list ─────────────────────
  router.get('/templates', authenticate, async (req, res) => {
    try {
      const { industry, category, limit = 30 } = req.query;
      const conditions = ['is_active = true'];
      const params = [];

      if (industry && industry !== 'all') {
        // Show templates for the selected industry + general-purpose templates (visible to all)
        conditions.push(`(industry = $${params.length + 1} OR industry = 'general')`);
        params.push(industry);
      }
      // No industry param or industry='all' → return everything (no filter added)
      if (category) {
        conditions.push(`category = $${params.length + 1}`);
        params.push(category);
      }
      params.push(Math.min(parseInt(limit) || 30, 100));

      const result = await pool.query(
        `SELECT id, name, industry, category, thumbnail_url, canvas_json, canvas_width, canvas_height, sort_order
         FROM canvas_templates
         WHERE ${conditions.join(' AND ')}
         ORDER BY sort_order ASC, created_at DESC
         LIMIT $${params.length}`,
        params
      );
      res.json({ templates: result.rows });
    } catch (err) {
      console.error('[Studio] GET /templates:', err.message);
      res.status(500).json({ error: 'Failed to load templates' });
    }
  });

  // ── PATCH /api/studio/templates/:id — admin: update template content ────────
  router.patch('/templates/:id', authenticate, async (req, res) => {
    try {
      const { rows: [cust] } = await pool.query('SELECT is_admin FROM customers WHERE id = $1', [req.customerId]);
      if (!cust?.is_admin) return res.status(403).json({ error: 'Admin only' });

      const { name, category, industry, tags, canvas_json } = req.body;
      const sets = [];
      const params = [];
      if (name && typeof name === 'string') { sets.push(`name = $${params.length + 1}`); params.push(name.slice(0, 200)); }
      if (category && typeof category === 'string') { sets.push(`category = $${params.length + 1}`); params.push(category); }
      if (industry && typeof industry === 'string') { sets.push(`industry = $${params.length + 1}`); params.push(industry); }
      if (tags) { sets.push(`tags = $${params.length + 1}`); params.push(JSON.stringify(tags)); }
      if (canvas_json && typeof canvas_json === 'object') { sets.push(`canvas_json = $${params.length + 1}`); params.push(JSON.stringify(canvas_json)); }
      if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });

      params.push(req.params.id);
      await pool.query(
        `UPDATE canvas_templates SET ${sets.join(', ')} WHERE id = $${params.length} AND is_active = true`,
        params
      );
      res.json({ success: true });
    } catch (err) {
      console.error('[Studio] PATCH /templates/:id:', err.message);
      res.status(500).json({ error: 'Failed to update template' });
    }
  });

  // ── GET /api/studio/templates/:id — full canvas_json ──────────────────────
  router.get('/templates/:id', authenticate, async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM canvas_templates WHERE id = $1 AND is_active = true',
        [req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Template not found' });
      res.json({ template: rows[0] });
    } catch (err) {
      console.error('[Studio] GET /templates/:id:', err.message);
      res.status(500).json({ error: 'Failed to load template' });
    }
  });

  // ── POST /api/studio/templates/:id/thumbnail — admin: save screenshot as thumbnail ──
  router.post('/templates/:id/thumbnail', authenticate, async (req, res) => {
    try {
      const { rows: [cust] } = await pool.query('SELECT is_admin FROM customers WHERE id = $1', [req.customerId]);
      if (!cust?.is_admin) return res.status(403).json({ error: 'Admin only' });

      const { dataUrl } = req.body;
      if (!dataUrl || !dataUrl.startsWith('data:image/')) return res.status(400).json({ error: 'Valid dataUrl required' });

      const cloudinary = require('cloudinary').v2;
      const result = await cloudinary.uploader.upload(dataUrl, {
        folder: 'itsposting/template-thumbs',
        resource_type: 'image',
        transformation: [{ width: 540, height: 675, crop: 'fill', quality: 85, format: 'jpg' }],
      });

      await pool.query('UPDATE canvas_templates SET thumbnail_url = $1 WHERE id = $2', [result.secure_url, req.params.id]);
      res.json({ url: result.secure_url });
    } catch (err) {
      console.error('[Studio] POST /templates/:id/thumbnail:', err.message);
      res.status(500).json({ error: 'Thumbnail save failed' });
    }
  });

  // ── GET /api/studio/stock-search — Pexels royalty-free stock photos ─────────
  router.get('/stock-search', authenticate, async (req, res) => {
    try {
      const { q = 'home services', page = 1, per_page = 24 } = req.query;
      const apiKey = process.env.PEXELS_API_KEY;
      if (!apiKey) return res.status(503).json({ error: 'Stock photos not configured' });

      const resp = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${Math.min(parseInt(per_page) || 24, 40)}&page=${parseInt(page) || 1}`,
        { headers: { Authorization: apiKey } }
      );
      if (!resp.ok) return res.status(resp.status).json({ error: 'Pexels API error' });
      const data = await resp.json();

      const photos = (data.photos || []).map(p => ({
        id: p.id,
        url: p.src.large2x,
        thumbUrl: p.src.medium,
        photographer: p.photographer,
        width: p.width,
        height: p.height,
      }));
      res.json({ photos, totalResults: data.total_results, page: data.page });
    } catch (err) {
      console.error('[Studio] GET /stock-search:', err.message);
      res.status(500).json({ error: 'Stock photo search failed' });
    }
  });

  // POST /api/studio/remove-background — kept for backward compatibility; client now handles this via @imgly/background-removal
  router.post('/remove-background', authenticate, async (req, res) => {
    res.status(501).json({ error: 'Background removal is handled client-side' });
  });

  // POST /api/studio/extract-element
  // Uses Replicate SAM 2 to segment and extract an element from an image.
  // pointX, pointY are normalized (0-1) coordinates of the user's click on the image.
  router.post('/extract-element', authenticate, async (req, res) => {
    try {
      const { imageUrl, pointX, pointY } = req.body;
      if (!imageUrl || pointX == null || pointY == null) {
        return res.status(400).json({ error: 'imageUrl, pointX, pointY required' });
      }

      const replicateToken = process.env.REPLICATE_API_TOKEN;
      if (!replicateToken) return res.status(503).json({ error: 'Element extraction not configured' });

      // Fetch original image to get dimensions
      const imgBuffer = await fetchImageAsBuffer(imageUrl);
      const { width, height } = await sharp(imgBuffer).metadata();
      const absX = Math.round(pointX * width);
      const absY = Math.round(pointY * height);

      // Call SAM 2 via Replicate
      const startRes = await fetch('https://api.replicate.com/v1/models/meta/sam-2/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${replicateToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait',
        },
        body: JSON.stringify({
          input: {
            image: imageUrl,
            point_coords: `[[${absX}, ${absY}]]`,
            point_labels: '[1]',
          },
        }),
      });
      if (!startRes.ok) {
        const errText = await startRes.text();
        console.error('[Studio] SAM 2 start error:', errText);
        return res.status(502).json({ error: 'Element extraction failed to start' });
      }
      const prediction = await startRes.json();

      // Poll if Replicate didn't finish synchronously
      let output = prediction.output;
      if (!output && prediction.id) {
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
            headers: { 'Authorization': `Bearer ${replicateToken}` },
          });
          const poll = await pollRes.json();
          if (poll.status === 'succeeded') { output = poll.output; break; }
          if (poll.status === 'failed') {
            console.error('[Studio] SAM 2 failed:', poll.error);
            return res.status(502).json({ error: 'Element extraction failed' });
          }
        }
      }
      if (!output) return res.status(502).json({ error: 'Element extraction timed out' });

      // SAM 2 can return { masks: [...] } or an array of mask URLs
      let maskUrl;
      if (Array.isArray(output)) {
        maskUrl = output[0];
      } else if (output.masks && Array.isArray(output.masks)) {
        maskUrl = output.masks[0];
      } else if (typeof output === 'string') {
        maskUrl = output;
      }
      if (!maskUrl) return res.status(502).json({ error: 'No mask returned from SAM 2' });

      // Download mask, resize to image dimensions, extract as grayscale (white=keep)
      const maskBuffer = await fetchImageAsBuffer(maskUrl);
      const { data: alphaData } = await sharp(maskBuffer)
        .resize(width, height)
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Get original image as raw RGBA
      const { data: rgbaData } = await sharp(imgBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Replace every pixel's alpha channel with the corresponding mask value
      for (let i = 0; i < width * height; i++) {
        rgbaData[i * 4 + 3] = alphaData[i];
      }

      // Encode as PNG (preserves transparency)
      const resultBuffer = await sharp(rgbaData, {
        raw: { width, height, channels: 4 },
      }).png().toBuffer();

      // Upload transparent PNG to Cloudinary
      const cloudinary = require('cloudinary').v2;
      const result = await cloudinary.uploader.upload(
        `data:image/png;base64,${resultBuffer.toString('base64')}`,
        { folder: 'itsposting/extracted', resource_type: 'image' }
      );

      res.json({ url: result.secure_url, width, height });
    } catch (err) {
      console.error('[Studio] extract-element:', err.message);
      res.status(500).json({ error: 'Element extraction failed' });
    }
  });

  // POST /api/studio/extract-elements
  // Uses Claude vision to detect all visual elements — resizes to 1024px max before sending to avoid timeouts
  router.post('/extract-elements', authenticate, async (req, res) => {
    try {
      const { imageUrl } = req.body;
      if (!imageUrl) return res.status(400).json({ error: 'imageUrl required' });

      const imageResp = await fetch(imageUrl);
      if (!imageResp.ok) return res.status(400).json({ error: 'Could not fetch image' });
      const rawBuffer = Buffer.from(await imageResp.arrayBuffer());

      // Resize to max 1024px so base64 payload stays small and Claude responds reliably
      const resizedBuffer = await sharp(rawBuffer)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      const base64 = resizedBuffer.toString('base64');

      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            { type: 'text', text: `Detect all distinct visual elements in this image.
Return ONLY a valid JSON object. No markdown, no explanation, nothing before or after the JSON.

{
  "elements": [
    {
      "id": "el_bg",
      "type": "background",
      "label": "background",
      "dominantColor": "#1a1a2e"
    },
    {
      "id": "el_1",
      "type": "object",
      "label": "person standing",
      "boundingBox": { "xPercent": 20, "yPercent": 10, "widthPercent": 60, "heightPercent": 80 },
      "dominantColor": "#3a2a1e"
    },
    {
      "id": "el_2",
      "type": "text",
      "label": "headline",
      "content": "Actual text found in image",
      "boundingBox": { "xPercent": 5, "yPercent": 5, "widthPercent": 90, "heightPercent": 15 },
      "textColor": "#ffffff",
      "estimatedFontSize": 48
    }
  ],
  "totalElements": 3,
  "hasText": true
}

Rules:
- type must be exactly: "background" | "object" | "text"
- Always include exactly one "background" element (no boundingBox needed)
- boundingBox values are percentages (0-100) of image dimensions, tight around each element
- dominantColor must be a valid hex color string
- For text type: include the actual visible text string in "content"
- Detect every distinct visual group: people, logos, shapes, text blocks, objects` }
          ]
        }]
      });

      const raw = message.content.filter(b => b.type === 'text').map(b => b.text).join('');
      // Extract the JSON object even if Claude wraps it in extra text
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in Claude response');
      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.elements || !Array.isArray(parsed.elements)) throw new Error('Invalid elements structure');
      res.json(parsed);
    } catch (err) {
      console.error('[Studio] extract-elements:', err.message);
      res.status(500).json({ error: 'Element extraction failed' });
    }
  });

  // ── GET /api/studio/stock-videos — Pexels royalty-free stock videos ─────────
  router.get('/stock-videos', authenticate, async (req, res) => {
    try {
      const { q = 'home services professional', page = 1, per_page = 12 } = req.query;
      const apiKey = process.env.PEXELS_API_KEY;
      if (!apiKey) return res.status(503).json({ error: 'Stock videos not configured' });

      const resp = await fetch(
        `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=${Math.min(parseInt(per_page) || 12, 20)}&page=${parseInt(page) || 1}`,
        { headers: { Authorization: apiKey } }
      );
      if (!resp.ok) return res.status(resp.status).json({ error: 'Pexels video API error' });
      const data = await resp.json();

      const videos = (data.videos || []).map(v => ({
        id: v.id,
        thumbnail_url: v.image,
        pexels_url: v.url,
        duration: v.duration,
        width: v.width,
        height: v.height,
        video_url: v.video_files?.find(f => f.quality === 'hd')?.link
          || v.video_files?.find(f => f.quality === 'sd')?.link
          || v.video_files?.[0]?.link,
      }));
      res.json({ videos, total: data.total_results, page: data.page });
    } catch (err) {
      console.error('[Studio] GET /stock-videos:', err.message);
      res.status(500).json({ error: 'Stock video search failed' });
    }
  });

  // POST /api/studio/rewrite-text — AI Improve for canvas text elements
  router.post('/rewrite-text', authenticate, async (req, res) => {
    const { text, platform = 'instagram', tone = 'friendly' } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length < 3) {
      return res.status(400).json({ error: 'Text is required' });
    }
    const sanitized = text.replace(/[<>`]/g, '').trim().slice(0, 500);
    try {
      const { rows } = await pool.query(
        'SELECT industry, business_name FROM customers WHERE id = $1',
        [req.customerId]
      );
      const customer = rows[0] || {};
      const industry = customer.industry || 'general_contractor';
      const Anthropic = require('@anthropic-ai/sdk');
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Rewrite this canvas text to be more engaging for a ${industry} business posting on ${platform} in a ${tone} tone. Keep it short (under 15 words if possible). Return ONLY the improved text, no quotes, no explanation.\n\nOriginal: ${sanitized}`,
        }],
      });
      const improved = msg.content[0]?.text?.trim() || sanitized;
      res.json({ improved });
    } catch (err) {
      console.error('[studio/rewrite-text]', err.message);
      res.status(500).json({ error: 'AI rewrite failed' });
    }
  });

  return router;
};
