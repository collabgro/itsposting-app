const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { authenticate } = require('../middleware/auth');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|webm/;
    const ext = allowed.test(file.originalname.toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Only images and videos allowed (jpg, png, gif, webp, mp4, mov, webm)'));
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

  const uploadToCloudinary = (buffer, mimetype) => {
    const isVideo = mimetype.startsWith('video/');
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: isVideo ? 'video' : 'image', folder: 'itsposting/uploads', quality: 'auto:best' },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(buffer);
    });
  };

  router.post('/media', authenticate, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const result = await uploadToCloudinary(req.file.buffer, req.file.mimetype);
      res.json({
        url: result.secure_url,
        publicId: result.public_id,
        type: req.file.mimetype.startsWith('video/') ? 'video' : 'image',
        width: result.width,
        height: result.height,
        duration: result.duration || null,
        size: req.file.size,
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/carousel', authenticate, upload.array('files', 10), async (req, res) => {
    try {
      if (!req.files || req.files.length < 2)
        return res.status(400).json({ error: 'Carousel requires at least 2 files' });
      const uploads = await Promise.all(req.files.map((f) => uploadToCloudinary(f.buffer, f.mimetype)));
      res.json({
        slides: uploads.map((u, idx) => ({ slideNumber: idx + 1, url: u.secure_url, publicId: u.public_id })),
        count: uploads.length,
      });
    } catch (error) {
      console.error('Carousel upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/post', authenticate, async (req, res) => {
    const client = await pool.connect();
    try {
      const { contentType, mediaUrl, mediaUrls, caption, hashtags, platforms, scheduledDate, timezone } = req.body;
      if (!contentType || !caption) return res.status(400).json({ error: 'contentType and caption required' });
      if (contentType !== 'carousel' && !mediaUrl) return res.status(400).json({ error: 'mediaUrl required' });
      if (contentType === 'carousel' && (!mediaUrls || mediaUrls.length < 2))
        return res.status(400).json({ error: 'Carousel requires at least 2 mediaUrls' });

      await client.query('BEGIN');
      const status = scheduledDate ? 'scheduled' : 'draft';
      const postResult = await client.query(
        `INSERT INTO posts (customer_id, content_type, caption, hashtags, media_url, media_urls,
          platforms, scheduled_date, timezone, status, source, uploaded_by_user, credits_used, generation_method)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [
          req.customerId, contentType, caption, JSON.stringify(hashtags || []),
          contentType !== 'carousel' ? mediaUrl : (mediaUrls?.[0] || null),
          JSON.stringify(contentType === 'carousel' ? mediaUrls : [mediaUrl]),
          JSON.stringify(platforms || []), scheduledDate || null,
          timezone || 'America/New_York', status, 'manual_upload', true, 0, 'manual_upload',
        ]
      );
      const post = postResult.rows[0];

      if (contentType === 'carousel' && mediaUrls?.length > 0) {
        for (let i = 0; i < mediaUrls.length; i++) {
          await client.query(
            `INSERT INTO post_carousel_slides (post_id, slide_number, media_url, caption) VALUES ($1,$2,$3,$4)`,
            [post.id, i + 1, mediaUrls[i], null]
          );
        }
      }
      await client.query('COMMIT');
      res.json({
        success: true, post,
        message: scheduledDate ? `Scheduled for ${new Date(scheduledDate).toLocaleString()}` : 'Saved as draft (ready to post)',
        creditsUsed: 0,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Manual post error:', error);
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  return router;
};
