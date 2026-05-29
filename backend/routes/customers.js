const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { authenticate } = require('../middleware/auth');
const EmailService = require('../services/EmailService');

const storage = multer.memoryStorage();
const uploadAssetMiddleware = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

const emailService = new EmailService();

module.exports = (pool) => {
  const router = express.Router();

  if (process.env.CLOUDINARY_CLOUD_NAME) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  /**
   * GET /api/customers/profile
   */
  router.get('/profile', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, email, business_name, industry, location, phone, website,
                logo_url, favicon_url, brand_colors, brand_fonts, visual_style, tone, avatar_id, voice_id,
                preferred_image_provider, plan, status, credits_balance,
                credits_used_this_month, trial_ends_at, auto_post_enabled,
                auto_post_frequency, posting_times, timezone,
                is_admin, role, suspended, posting_streak,
                last_posted_at, total_posts_this_month, parent_customer_id,
                free_geo_audit_used, avatar_url, tagline, white_label_config, created_at
         FROM customers WHERE id = $1`,
        [req.customerId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      const profile = result.rows[0];
      if (profile.parent_customer_id) {
        const parentRow = await pool.query(
          `SELECT credits_balance, free_geo_audit_used FROM customers WHERE id = $1`,
          [profile.parent_customer_id]
        );
        if (parentRow.rows.length) {
          profile.credits_balance = parentRow.rows[0].credits_balance;
          profile.free_geo_audit_used = parentRow.rows[0].free_geo_audit_used;
          profile.is_sub_account = true;
        }
      }
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PATCH /api/customers/profile
   */
  router.patch('/profile', authenticate, async (req, res) => {
    try {
      const {
        businessName,
        industry,
        location,
        phone,
        website,
        brandColors,
        brandFonts,
        visualStyle,
        tone,
        avatarId,
        voiceId,
        preferredImageProvider,
        autoPostEnabled,
        autoPostFrequency,
        postingTimes,
        timezone,
        logoUrl,
        faviconUrl,
        notificationPreferences,
        avatarUrl,
        tagline,
      } = req.body;

      const MAX_LENGTHS = { businessName: 100, location: 200, phone: 30, website: 500, tone: 50, visualStyle: 100, tagline: 200 };
      for (const [field, max] of Object.entries(MAX_LENGTHS)) {
        const val = req.body[field];
        if (val && String(val).length > max) {
          return res.status(400).json({ error: `${field} too long (max ${max} characters)` });
        }
      }

      const result = await pool.query(
        `UPDATE customers SET
          business_name = COALESCE($1, business_name),
          industry = COALESCE($2, industry),
          location = COALESCE($3, location),
          phone = COALESCE($4, phone),
          website = COALESCE($5, website),
          brand_colors = COALESCE($6, brand_colors),
          brand_fonts = COALESCE($22, brand_fonts),
          visual_style = COALESCE($7, visual_style),
          tone = COALESCE($8, tone),
          avatar_id = COALESCE($9, avatar_id),
          voice_id = COALESCE($10, voice_id),
          preferred_image_provider = COALESCE($11, preferred_image_provider),
          auto_post_enabled = COALESCE($12, auto_post_enabled),
          auto_post_frequency = COALESCE($13, auto_post_frequency),
          posting_times = COALESCE($14, posting_times),
          timezone = COALESCE($15, timezone),
          logo_url = CASE WHEN $16::text IS NOT NULL THEN $16::text ELSE logo_url END,
          favicon_url = CASE WHEN $17::text IS NOT NULL THEN $17::text ELSE favicon_url END,
          content_preferences = CASE WHEN $18::text IS NOT NULL
            THEN COALESCE(content_preferences, '{}'::jsonb) || jsonb_build_object('notifications', $18::jsonb)
            ELSE content_preferences END,
          avatar_url = CASE WHEN $20::text IS NOT NULL THEN $20::text ELSE avatar_url END,
          tagline = COALESCE($21, tagline),
          updated_at = NOW()
        WHERE id = $19
        RETURNING *`,
        [
          businessName, industry, location, phone, website,
          brandColors ? JSON.stringify(brandColors) : null,
          visualStyle, tone, avatarId, voiceId, preferredImageProvider,
          autoPostEnabled, autoPostFrequency,
          postingTimes ? JSON.stringify(postingTimes) : null,
          timezone,
          logoUrl !== undefined ? logoUrl : null,
          faviconUrl !== undefined ? faviconUrl : null,
          notificationPreferences ? JSON.stringify(notificationPreferences) : null,
          req.customerId,
          avatarUrl !== undefined ? avatarUrl : null,
          tagline,
          brandFonts ? JSON.stringify(brandFonts) : null,
        ]
      );

      const customer = result.rows[0];
      delete customer.password_hash;
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/customers/upload-asset
   * Uploads a brand asset (logo or favicon) to Cloudinary.
   * Does NOT write to media_library.
   */
  router.post('/upload-asset', authenticate, uploadAssetMiddleware.single('asset'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const url = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            resource_type: 'image',
            folder: `itsposting/brand-assets/${req.customerId}`,
            quality: 'auto:best',
            fetch_format: 'auto',
          },
          (err, result) => (err ? reject(err) : resolve(result.secure_url))
        ).end(req.file.buffer);
      });

      res.json({ url });
    } catch (error) {
      console.error('[customers] upload-asset error:', error.message);
      res.status(500).json({ error: 'Upload failed: ' + error.message });
    }
  });

  /**
   * POST /api/customers/invite
   * Sends a signup invitation email. Invitee's account will be linked
   * as a workspace sub-account via the ?ref= query param on the signup page.
   */
  router.post('/invite', authenticate, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });

      const customerRes = await pool.query(
        'SELECT business_name FROM customers WHERE id = $1',
        [req.customerId]
      );
      const bizName = customerRes.rows[0]?.business_name || 'A business';
      const frontendUrl = process.env.FRONTEND_URL || 'https://app.itsposting.com';
      const link = `${frontendUrl}/signup?ref=${req.customerId}&email=${encodeURIComponent(email.trim())}`;

      await emailService.send({
        to: email.trim(),
        subject: `You've been invited to join ${bizName} on ItsPosting`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:540px;margin:40px auto;background:#16161D;border:1px solid #26262F;border-radius:12px;overflow:hidden">
            <div style="padding:28px 32px;background:linear-gradient(135deg,#7C5CFC 0%,#5B3FF0 100%)">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff">ItsPosting</h1>
              <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7)">AI Social Media Automation</p>
            </div>
            <div style="padding:28px 32px">
              <p style="font-size:14px;line-height:1.7;color:#A0A0B0;margin:0 0 16px"><strong style="color:#E2E2E8">${bizName}</strong> has invited you to help manage their social media on ItsPosting.</p>
              <a href="${link}" style="display:inline-block;margin:20px 0;padding:12px 24px;background:#7C5CFC;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">Accept invitation →</a>
              <p style="font-size:12px;color:#555;margin:16px 0 0">This link pre-fills your email. You choose your own password. Once registered, you'll appear as a workspace member under ${bizName}.</p>
            </div>
          </div>`,
        text: `${bizName} has invited you to join ItsPosting. Sign up here: ${link}`,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('[customers] invite error:', error.message);
      res.status(500).json({ error: 'Failed to send invite' });
    }
  });

  /**
   * GET /api/customers/social-accounts
   */
  router.get('/social-accounts', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, platform, account_username, account_name, profile_image_url,
                enabled, auto_post, connected_at
         FROM social_accounts WHERE customer_id = $1`,
        [req.customerId]
      );

      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/customers/hashtag-sets
   */
  router.get('/hashtag-sets', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT COALESCE(hashtag_sets, '[]'::jsonb) AS hashtag_sets FROM customers WHERE id = $1`,
        [req.customerId]
      );
      res.json(result.rows[0]?.hashtag_sets || []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * PATCH /api/customers/hashtag-sets
   * Replaces the entire hashtag_sets array.
   */
  router.patch('/hashtag-sets', authenticate, async (req, res) => {
    try {
      const { sets } = req.body;
      if (!Array.isArray(sets)) return res.status(400).json({ error: 'sets must be an array' });
      if (sets.length > 30) return res.status(400).json({ error: 'Max 30 hashtag sets allowed' });

      const sanitised = sets.map(s => ({
        id: String(s.id || Date.now()),
        name: String(s.name || '').substring(0, 60),
        tags: Array.isArray(s.tags) ? s.tags.map(t => String(t).replace(/[^a-zA-Z0-9_]/g, '').substring(0, 50)).filter(Boolean).slice(0, 30) : [],
        usage_count: parseInt(s.usage_count) || 0,
      }));

      await pool.query(
        `UPDATE customers SET hashtag_sets = $1 WHERE id = $2`,
        [JSON.stringify(sanitised), req.customerId]
      );
      res.json(sanitised);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/customers/white-label ───────────────────────────────────────
  router.get('/white-label', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT white_label_config, plan FROM customers WHERE id = $1`,
        [req.customerId]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
      const { white_label_config, plan } = result.rows[0];
      res.json({ config: white_label_config || {}, plan });
    } catch (err) {
      console.error('[white-label GET]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── PATCH /api/customers/white-label ─────────────────────────────────────
  router.patch('/white-label', authenticate, async (req, res) => {
    try {
      const planRes = await pool.query(`SELECT plan FROM customers WHERE id = $1`, [req.customerId]);
      if (!planRes.rows.length) return res.status(404).json({ error: 'Not found' });
      if (planRes.rows[0].plan !== 'agency') {
        return res.status(403).json({ error: 'White-label branding requires the Agency plan.' });
      }

      const { agencyName, logo, primaryColor, hidePoweredBy, customDomain } = req.body;

      const config = {};
      if (agencyName !== undefined)   config.agencyName   = String(agencyName || '').substring(0, 80);
      if (logo !== undefined)         config.logo         = String(logo || '').substring(0, 500);
      if (primaryColor !== undefined) config.primaryColor = /^#[0-9A-Fa-f]{6}$/.test(primaryColor) ? primaryColor : null;
      if (hidePoweredBy !== undefined) config.hidePoweredBy = Boolean(hidePoweredBy);
      if (customDomain !== undefined) config.customDomain = String(customDomain || '').substring(0, 200).toLowerCase().replace(/[^a-z0-9.-]/g, '');

      const result = await pool.query(
        `UPDATE customers
            SET white_label_config = COALESCE(white_label_config, '{}'::jsonb) || $1::jsonb,
                updated_at = NOW()
          WHERE id = $2
          RETURNING white_label_config`,
        [JSON.stringify(config), req.customerId]
      );
      res.json({ config: result.rows[0].white_label_config });
    } catch (err) {
      console.error('[white-label PATCH]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── PATCH /api/customers/preferences ─────────────────────────────────────
  // Merges arbitrary key-value pairs into content_preferences JSONB.
  // Used for feature toggles like auto_testimonial_enabled.
  router.patch('/preferences', authenticate, async (req, res) => {
    try {
      const updates = req.body;
      if (!updates || typeof updates !== 'object') return res.status(400).json({ error: 'Invalid body' });

      // Allowlist of safe preference keys
      const ALLOWED = new Set([
        'auto_testimonial_enabled',
        'notifications',
        'content_ratio_warning',
        'suggestion_dismissed_types',
      ]);
      const filtered = Object.fromEntries(Object.entries(updates).filter(([k]) => ALLOWED.has(k)));
      if (Object.keys(filtered).length === 0) return res.status(400).json({ error: 'No valid preferences provided' });

      const jsonPatch = Object.entries(filtered)
        .map(([k, v]) => `jsonb_build_object('${k}', ${typeof v === 'boolean' ? `'${v}'` : `'${String(v).substring(0, 200)}'`})`)
        .join(' || ');

      const result = await pool.query(
        `UPDATE customers
            SET content_preferences = COALESCE(content_preferences, '{}'::jsonb) || (${jsonPatch})
          WHERE id=$1
          RETURNING content_preferences`,
        [req.customerId]
      );
      res.json({ content_preferences: result.rows[0]?.content_preferences });
    } catch (err) {
      console.error('[customers/preferences]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
