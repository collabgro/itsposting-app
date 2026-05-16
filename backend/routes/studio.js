const express = require('express');
const sharp = require('sharp');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate, getBillingCustomerId } = require('../middleware/auth');
const { fetchImageAsBuffer, uploadToCloudinary } = require('../services/ImageResizer');

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

      const [{ rows: photos }, { rows: countRows }] = await Promise.all([
        pool.query(sql, cleanParams),
        pool.query(countSql, cleanParams.slice(0, cleanParams.length - 2)),
      ]);

      res.json({ photos, total: parseInt(countRows[0].count) });
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

  return router;
};
