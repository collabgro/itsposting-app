const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { authenticate } = require('../middleware/auth');

const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|webm|avi/;
    const ext = allowed.test(file.originalname.toLowerCase());
    const mime = /image|video/.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Unsupported file type. Allowed: JPG, PNG, GIF, WebP, MP4, MOV, WebM, AVI'));
  },
});

function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    stream.end(buffer);
  });
}

module.exports = (pool) => {
  const router = express.Router();

  // GET /api/media/quota
  router.get('/quota', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT storage_used_bytes, storage_quota_bytes,
          (SELECT COUNT(*) FROM media_library WHERE customer_id = $1) AS file_count
         FROM customers WHERE id = $1`,
        [req.customerId]
      );
      const row = result.rows[0];
      const used = parseInt(row.storage_used_bytes) || 0;
      const quota = parseInt(row.storage_quota_bytes) || STORAGE_QUOTA_BYTES;
      res.json({
        usedBytes: used,
        quotaBytes: quota,
        availableBytes: quota - used,
        usedFormatted: formatBytes(used),
        quotaFormatted: formatBytes(quota),
        percentUsed: ((used / quota) * 100).toFixed(1),
        fileCount: parseInt(row.file_count),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/media/folders
  router.get('/folders', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT folder, COUNT(*) as count FROM media_library WHERE customer_id = $1 GROUP BY folder ORDER BY folder`,
        [req.customerId]
      );
      const total = result.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
      res.json([{ folder: 'all', count: total }, ...result.rows.filter((r) => r.folder !== 'all')]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/media
  router.get('/', authenticate, async (req, res) => {
    try {
      const { type, folder, search, limit = 50, offset = 0 } = req.query;
      let query = 'SELECT * FROM media_library WHERE customer_id = $1';
      const params = [req.customerId];
      let p = 1;
      if (type && type !== 'all') { p++; query += ` AND file_type = $${p}`; params.push(type); }
      if (folder && folder !== 'all') { p++; query += ` AND folder = $${p}`; params.push(folder); }
      if (search) { p++; query += ` AND file_name ILIKE $${p}`; params.push(`%${search}%`); }
      query += ` ORDER BY uploaded_at DESC LIMIT $${p + 1} OFFSET $${p + 2}`;
      params.push(parseInt(limit), parseInt(offset));
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/media/upload
  router.post('/upload', authenticate, upload.array('files', 20), async (req, res) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(503).json({ error: 'Media storage not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.' });
    }

    const client = await pool.connect();
    try {
      if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

      const folder = req.body.folder || 'all';
      const totalUploadSize = req.files.reduce((sum, f) => sum + f.size, 0);

      const quotaResult = await client.query(
        'SELECT storage_used_bytes, storage_quota_bytes FROM customers WHERE id = $1',
        [req.customerId]
      );
      const used = parseInt(quotaResult.rows[0].storage_used_bytes) || 0;
      const quota = parseInt(quotaResult.rows[0].storage_quota_bytes) || STORAGE_QUOTA_BYTES;

      if (used + totalUploadSize > quota) {
        return res.status(413).json({
          error: 'Storage quota exceeded',
          available: formatBytes(quota - used),
          required: formatBytes(totalUploadSize),
        });
      }

      await client.query('BEGIN');
      const uploaded = [];

      for (const file of req.files) {
        const isVideo = file.mimetype.startsWith('video/');
        const resourceType = isVideo ? 'video' : 'image';

        const cloudResult = await uploadToCloudinary(file.buffer, {
          folder: `itsposting/${req.customerId}`,
          resource_type: resourceType,
          use_filename: true,
          unique_filename: true,
        });

        const dbResult = await client.query(
          `INSERT INTO media_library
            (customer_id, cloudinary_public_id, url, thumbnail_url, file_name, file_type,
             mime_type, file_size_bytes, width, height, folder)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [
            req.customerId,
            cloudResult.public_id,
            cloudResult.secure_url,
            isVideo
              ? cloudinary.url(cloudResult.public_id, { resource_type: 'video', format: 'jpg', transformation: [{ width: 400, height: 400, crop: 'fill' }] })
              : cloudinary.url(cloudResult.public_id, { transformation: [{ width: 400, height: 400, crop: 'fill', quality: 80 }] }),
            file.originalname,
            resourceType,
            file.mimetype,
            cloudResult.bytes,
            cloudResult.width || null,
            cloudResult.height || null,
            folder,
          ]
        );
        uploaded.push(dbResult.rows[0]);
      }

      if (uploaded.length === 0) {
        await client.query('ROLLBACK');
        return res.status(500).json({ error: 'No files were successfully uploaded' });
      }

      const totalUploaded = uploaded.reduce((sum, f) => sum + parseInt(f.file_size_bytes), 0);
      await client.query(
        'UPDATE customers SET storage_used_bytes = storage_used_bytes + $1 WHERE id = $2',
        [totalUploaded, req.customerId]
      );
      await client.query('COMMIT');

      console.log(`[Media] ${req.customerId} uploaded ${uploaded.length} file(s) (${formatBytes(totalUploaded)})`);
      res.json({ success: true, uploaded: uploaded.length, files: uploaded, totalSizeUploaded: formatBytes(totalUploaded) });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[Media] Upload error:', error.message);
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  // DELETE /api/media/:id
  router.delete('/:id', authenticate, async (req, res) => {
    const client = await pool.connect();
    try {
      const fileResult = await client.query(
        'SELECT * FROM media_library WHERE id = $1 AND customer_id = $2',
        [req.params.id, req.customerId]
      );
      if (fileResult.rows.length === 0) return res.status(404).json({ error: 'File not found' });

      const file = fileResult.rows[0];

      await client.query('BEGIN');
      await client.query('DELETE FROM media_library WHERE id = $1', [req.params.id]);
      await client.query(
        'UPDATE customers SET storage_used_bytes = GREATEST(0, storage_used_bytes - $1) WHERE id = $2',
        [file.file_size_bytes, req.customerId]
      );
      await client.query('COMMIT');

      // Delete from Cloudinary after DB commit (non-fatal)
      if (file.cloudinary_public_id) {
        const resourceType = file.file_type === 'video' ? 'video' : 'image';
        cloudinary.uploader.destroy(file.cloudinary_public_id, { resource_type: resourceType })
          .catch(err => console.error('[Media] Cloudinary delete error:', err.message));
      }

      res.json({ success: true, freedBytes: parseInt(file.file_size_bytes) });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  // POST /api/media/:id/use
  router.post('/:id/use', authenticate, async (req, res) => {
    try {
      await pool.query(
        'UPDATE media_library SET used_in_posts = used_in_posts + 1, last_used_at = NOW() WHERE id = $1 AND customer_id = $2',
        [req.params.id, req.customerId]
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
