'use strict';

const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { authenticate } = require('../middleware/auth');
const ImageResizer = require('../services/ImageResizer');
const { convertToUTC, isValidTimezone } = require('../utils/timezone');
const SocialPublisher = require('../services/SocialPublisher');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|webm|heic|heif/;
    const extOk = allowed.test(file.originalname.toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    if (extOk && mimeOk) cb(null, true);
    else cb(new Error('Only images and videos allowed (jpg, png, gif, webp, heic, mp4, mov, webm)'));
  },
});

module.exports = (pool) => {
  const router = express.Router();

  if (process.env.CLOUDINARY_CLOUD_NAME) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  // Ensure post_images table exists (non-blocking, best-effort)
  pool.query(`
    CREATE TABLE IF NOT EXISTS post_images (
      id SERIAL PRIMARY KEY,
      post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      platform VARCHAR(50) NOT NULL,
      url TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      format VARCHAR(10),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(post_id, platform)
    )
  `).catch(() => {});

  const uploadVideoToCloudinary = (buffer, mimetype) =>
    new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { resource_type: 'video', folder: 'itsposting/uploads', quality: 'auto:best' },
        (err, result) => (err ? reject(err) : resolve(result))
      ).end(buffer);
    });

  // ── POST /api/upload/media ────────────────────────────────────────────────
  // Single file upload. Images get auto-resized for all platforms.
  router.post('/media', authenticate, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      // Quota check — same guard as /carousel
      try {
        const quotaRes = await pool.query(
          'SELECT storage_used_bytes, storage_quota_bytes FROM customers WHERE id=$1',
          [req.customerId]
        );
        const qRow = quotaRes.rows[0];
        if (qRow) {
          const used = parseInt(qRow.storage_used_bytes) || 0;
          const quota = parseInt(qRow.storage_quota_bytes) || (10 * 1024 * 1024 * 1024);
          if (used + req.file.size > quota) {
            return res.status(413).json({ error: 'Storage quota exceeded' });
          }
        }
      } catch { /* quota columns may not exist — allow upload */ }

      const isVideo = req.file.mimetype.startsWith('video/');

      if (isVideo) {
        const result = await uploadVideoToCloudinary(req.file.buffer, req.file.mimetype);
        return res.json({
          url: result.secure_url,
          publicId: result.public_id,
          type: 'video',
          width: result.width,
          height: result.height,
          duration: result.duration || null,
          size: req.file.size,
          variants: null,
        });
      }

      // Image: validate then resize for all platforms
      const validation = await ImageResizer.validateImageDimensions(req.file.buffer);
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Image quality too low',
          details: validation.warnings,
          recommendation: validation.recommendation,
        });
      }

      const pathId = `upload_${req.customerId}_${Date.now()}`;
      const variants = await ImageResizer.uploadResizedImages(
        req.file.buffer,
        pathId,
        req.customerId,
        ['facebook_feed', 'instagram_feed', 'google_business', 'universal_feed']
      );

      // Primary URL: universal_feed (1080x1350) works everywhere
      const primaryUrl = variants.universal_feed || variants.instagram_feed || variants.original;

      res.json({
        url: primaryUrl,
        originalUrl: variants.original,
        type: 'image',
        size: req.file.size,
        variants: {
          facebook_feed:   variants.facebook_feed,
          instagram_feed:  variants.instagram_feed,
          google_business: variants.google_business,
          universal_feed:  variants.universal_feed,
        },
        validation: {
          warnings: validation.warnings,
          originalSize: `${validation.fileSizeMB}MB`,
          originalDimensions: `${validation.width}x${validation.height}px`,
        },
        platformsGenerated: variants.platformsGenerated,
        message: `Image processed for ${variants.platformsGenerated.length} platforms`,
      });
    } catch (error) {
      console.error('[Upload] Media error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── POST /api/upload/carousel ─────────────────────────────────────────────
  // Multi-file carousel upload. Each image resized to square (best for carousels).
  router.post('/carousel', authenticate, upload.array('files', 10), async (req, res) => {
    try {
      if (!req.files || req.files.length < 2)
        return res.status(400).json({ error: 'Carousel requires at least 2 files' });

      const totalBytes = req.files.reduce((sum, f) => sum + f.size, 0);
      if (totalBytes > 200 * 1024 * 1024)
        return res.status(413).json({ error: 'Total upload size exceeds 200 MB' });

      const slides = await Promise.all(req.files.map(async (file, idx) => {
        const slideNumber = idx + 1;
        try {
          const pathId = `carousel_${req.customerId}_${Date.now()}_${slideNumber}`;
          const variants = await ImageResizer.uploadResizedImages(
            file.buffer,
            pathId,
            req.customerId,
            ['instagram_square', 'facebook_square', 'universal_feed']
          );
          const url = variants.instagram_square || variants.universal_feed || variants.original;
          return { slideNumber, url, publicId: pathId, variants: { instagram_square: variants.instagram_square, facebook_square: variants.facebook_square, universal_feed: variants.universal_feed } };
        } catch (err) {
          console.error(`[Upload] Carousel slide ${slideNumber} error:`, err.message);
          return null;
        }
      }));

      const successful = slides.filter(Boolean);
      if (successful.length < 2)
        return res.status(500).json({ error: 'Not enough slides processed successfully (need at least 2)' });

      res.json({
        slides: successful,
        count: successful.length,
      });
    } catch (error) {
      console.error('[Upload] Carousel error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── POST /api/upload/post ─────────────────────────────────────────────────
  // Create post record from uploaded media. Backward compatible.
  router.post('/post', authenticate, async (req, res) => {
    const client = await pool.connect();
    try {
      const {
        contentType, mediaUrl, mediaUrls, caption, hashtags, platforms, accountIds,
        platform_captions, location_id, location_name, scheduledDate, timezone, publishNow,
        status: requestedStatus,
        fbPostFormat, igPostFormat, igCollaborator, optimizeMedia, fbTextBackground, followUpComment,
      } = req.body;
      if (!contentType || !caption) return res.status(400).json({ error: 'contentType and caption required' });
      if (contentType === 'carousel' && (!mediaUrls || mediaUrls.length < 2))
        return res.status(400).json({ error: 'Carousel requires at least 2 mediaUrls' });

      // Convert scheduled time from customer's local timezone to UTC before storing
      let utcScheduledDate = null;
      const resolvedTz = isValidTimezone(timezone) ? timezone : 'America/New_York';
      if (scheduledDate) {
        const utcIso = convertToUTC(scheduledDate, resolvedTz);
        utcScheduledDate = utcIso ? new Date(utcIso) : new Date(scheduledDate);
      }

      await client.query('BEGIN');
      let status;
      if (requestedStatus === 'pending_approval') {
        status = 'pending_approval';
      } else if (scheduledDate) {
        status = 'scheduled';
      } else if (publishNow === true || publishNow === 'true') {
        status = 'scheduled';
        utcScheduledDate = new Date();
      } else {
        status = 'draft';
      }
      const postResult = await client.query(
        `INSERT INTO posts (customer_id, content_type, caption, hashtags, media_url, media_urls,
          platforms, scheduled_date, scheduled_timezone, status, source, uploaded_by_user, credits_used,
          generation_method, platform_captions, location_id, location_name,
          fb_post_format, ig_post_format, ig_collaborator, optimize_media, fb_text_background, follow_up_comment)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING *`,
        [
          req.customerId, contentType, caption, JSON.stringify(hashtags || []),
          contentType !== 'carousel' ? mediaUrl : (mediaUrls?.[0] || null),
          JSON.stringify(contentType === 'carousel' ? mediaUrls : [mediaUrl]),
          JSON.stringify(platforms || []), utcScheduledDate,
          resolvedTz, status, 'manual_upload', true, 0, 'manual_upload',
          platform_captions ? JSON.stringify(platform_captions) : null,
          location_id || null, location_name || null,
          fbPostFormat || 'feed', igPostFormat || 'feed',
          igCollaborator?.trim() || null,
          optimizeMedia !== false,
          fbTextBackground || null,
          followUpComment?.trim() || null,
        ]
      );
      const post = postResult.rows[0];

      if (contentType === 'carousel' && mediaUrls?.length > 0) {
        for (let i = 0; i < mediaUrls.length; i++) {
          await client.query(
            'INSERT INTO post_carousel_slides (post_id, slide_number, media_url, caption) VALUES ($1,$2,$3,$4)',
            [post.id, i + 1, mediaUrls[i], null]
          );
        }
      }
      await client.query('COMMIT');

      // Immediately publish when publishNow=true — don't wait for the 5-min cron
      // Never publish pending_approval posts — they need manual approval first
      let publishResult = null;
      if ((publishNow === true || publishNow === 'true') && status !== 'pending_approval') {
        try {
          const publisher = new SocialPublisher(pool);
          const postForPublish = { ...post, customer_id: req.customerId };
          const selectedAccountIds = Array.isArray(accountIds) && accountIds.length ? accountIds : null;
          const selectedPlatforms = Array.isArray(platforms) && platforms.length ? platforms : null;

          const result = selectedAccountIds
            ? await publisher.publishToAccounts(postForPublish, selectedAccountIds)
            : selectedPlatforms
              ? await publisher.publishToPlatforms(postForPublish, selectedPlatforms)
              : await publisher.publishPost(postForPublish);

          const succeeded = Object.keys(result.platformPostIds);
          if (succeeded.length > 0) {
            await pool.query(
              `UPDATE posts SET status = 'posted', posted_at = NOW(),
               platform_post_ids = $1, updated_at = NOW() WHERE id = $2`,
              [JSON.stringify(result.platformPostIds), post.id]
            );
            post.status = 'posted';
            try {
              const ContentMixTracker = require('../services/ContentMixTracker');
              await new ContentMixTracker(pool).updatePostingStreak(req.customerId);
            } catch (streakErr) {
              console.warn('[upload] streak update failed:', streakErr.message);
            }
          } else if (result.errors.length > 0) {
            await pool.query(
              `UPDATE posts SET status = 'failed',
               error_message = $1, updated_at = NOW() WHERE id = $2`,
              [result.errors.map(e => `${e.platform}: ${e.message}`).join('; '), post.id]
            );
            post.status = 'failed';
          }
          publishResult = result;
        } catch (pubErr) {
          console.error('[Upload] Immediate publish error:', pubErr.message);
          // Post stays scheduled — cron will retry
        }
      }

      const isPublishNow = publishNow === true || publishNow === 'true';
      res.json({
        success: true,
        post,
        publishResult,
        message: scheduledDate
          ? `Scheduled for ${new Date(scheduledDate).toLocaleString()}`
          : isPublishNow
            ? `Posted to ${publishResult ? [...new Set(Object.keys(publishResult.platformPostIds).map(k => k.replace(/_\d+$/, '')))].join(', ') || 'platforms' : 'platforms'}!`
            : 'Saved as draft (ready to post)',
        creditsUsed: 0,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[Upload] Post creation error:', error);
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  // ── GET /api/upload/post-images/:postId ───────────────────────────────────
  // Returns all platform image variants stored for a post.
  router.get('/post-images/:postId', authenticate, async (req, res) => {
    try {
      const { postId } = req.params;
      const postResult = await pool.query(
        'SELECT id, media_url FROM posts WHERE id = $1 AND customer_id = $2',
        [postId, req.customerId]
      );
      if (!postResult.rows[0]) return res.status(404).json({ error: 'Post not found' });

      const imagesResult = await pool.query(
        'SELECT platform, url, width, height, format FROM post_images WHERE post_id = $1 ORDER BY platform',
        [postId]
      ).catch(() => ({ rows: [] }));

      const variants = {};
      imagesResult.rows.forEach(img => {
        variants[img.platform] = { url: img.url, width: img.width, height: img.height, format: img.format };
      });

      res.json({
        postId: parseInt(postId),
        original: postResult.rows[0].media_url,
        variants,
        platformsAvailable: Object.keys(variants),
        safeZones: Object.keys(variants).reduce((acc, p) => { acc[p] = ImageResizer.getImageSafeZone(p); return acc; }, {}),
      });
    } catch (error) {
      console.error('[Upload] Get post images error:', error);
      res.status(500).json({ error: 'Failed to get image variants' });
    }
  });

  // ── GET /api/upload/platform-specs ───────────────────────────────────────
  // Platform specs and safe zones (for frontend preview UI).
  router.get('/platform-specs', authenticate, (req, res) => {
    res.json({
      specs: ImageResizer.getPlatformSpecs(),
      safeZones: ImageResizer.getAllSafeZones(),
      defaultPlatforms: ImageResizer.DEFAULT_PLATFORMS,
    });
  });

  return router;
};
