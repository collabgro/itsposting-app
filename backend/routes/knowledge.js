'use strict';

const express          = require('express');
const multer           = require('multer');
const { authenticate } = require('../middleware/auth');
const CrawlerService   = require('../services/CrawlerService');

const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

module.exports = (pool) => {
  const router = express.Router();
  const crawler = new CrawlerService(pool);
  router.use(authenticate);

  // ── GET /api/knowledge/scrape-preview ────────────────────────────────────
  // Returns scraped website data formatted for the knowledge form.
  // The client merges this into existing form state — nothing is saved here.
  router.get('/scrape-preview', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT website_services, website_about, website, website_testimonials FROM customers WHERE id = $1`,
        [req.customerId]
      );
      const row = result.rows[0];
      if (!row) return res.status(404).json({ error: 'Not found' });

      const rawServices = row.website_services;
      if (!rawServices && !row.website_about) {
        return res.json({ hasData: false });
      }

      const serviceList = Array.isArray(rawServices)
        ? rawServices
        : JSON.parse(rawServices || '[]');

      const services = serviceList
        .filter(s => s && String(s).trim())
        .map(s => ({ name: String(s).trim(), description: '', priceRange: '' }));

      let testimonials = [];
      try {
        const raw = row.website_testimonials;
        testimonials = Array.isArray(raw) ? raw : JSON.parse(raw || '[]');
      } catch { testimonials = []; }

      res.json({
        hasData: services.length > 0 || !!row.website_about,
        website: row.website,
        services,
        differentiators: (row.website_about || '').substring(0, 400),
        testimonials,
      });
    } catch (err) {
      console.error('[knowledge] scrape-preview:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/knowledge ────────────────────────────────────────────────────
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT * FROM business_knowledge
         WHERE customer_id = $1 AND is_active = true
         ORDER BY knowledge_type, sort_order, created_at`,
        [req.customerId]
      );
      res.json({ items: result.rows });
    } catch (err) {
      console.error('[knowledge] GET /:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/knowledge/save ──────────────────────────────────────────────
  router.post('/save', async (req, res) => {
    const client = await pool.connect();
    try {
      const { services = [], reviews, differentiators, faqs = [], team = [] } = req.body;

      await client.query('BEGIN');
      await client.query('DELETE FROM business_knowledge WHERE customer_id = $1', [req.customerId]);

      const insertItem = (type, title, content, order = 0) =>
        client.query(
          `INSERT INTO business_knowledge (customer_id, knowledge_type, title, content, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [req.customerId, type, title, content, order]
        );

      for (let i = 0; i < services.length; i++) {
        const s = services[i];
        if (s.name?.trim()) await insertItem('services', s.name, JSON.stringify(s), i);
      }

      if (reviews?.trim()) await insertItem('reviews', 'Customer Reviews', reviews.trim());
      if (differentiators?.trim()) await insertItem('differentiators', 'What Makes Us Different', differentiators.trim());

      for (let i = 0; i < faqs.length; i++) {
        if (faqs[i]?.trim()) await insertItem('faqs', `FAQ ${i + 1}`, faqs[i].trim(), i);
      }

      for (let i = 0; i < team.length; i++) {
        const m = team[i];
        if (m.name?.trim()) await insertItem('team', m.name, JSON.stringify(m), i);
      }

      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[knowledge] POST /save:', err.message);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // ── POST /api/knowledge/entry ────────────────────────────────────────────
  // Create a single knowledge entry
  router.post('/entry', async (req, res) => {
    try {
      const { knowledgeType, title, content } = req.body;
      if (!knowledgeType || !title || !content) {
        return res.status(400).json({ error: 'knowledgeType, title, content are required' });
      }
      const { rows } = await pool.query(
        `INSERT INTO business_knowledge (customer_id, knowledge_type, title, content, sort_order)
         VALUES ($1, $2, $3, $4,
           (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM business_knowledge WHERE customer_id=$1 AND knowledge_type=$2)
         ) RETURNING *`,
        [req.customerId, knowledgeType, title, content]
      );
      res.json({ entry: rows[0] });
    } catch (err) {
      console.error('[knowledge] POST /entry:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/knowledge/import-website ───────────────────────────────────
  // Uses cached scrape data if available, otherwise triggers a fresh scrape.
  // Returns the same shape as scrape-preview so the frontend can call applyImportData directly.
  router.post('/import-website', async (req, res) => {
    try {
      const row = (await pool.query(
        `SELECT website, website_services, website_about, website_testimonials FROM customers WHERE id = $1`,
        [req.customerId]
      )).rows[0];

      if (!row?.website) return res.json({ noWebsite: true });

      // Return cached data without re-scraping
      if (row.website_services || row.website_about) {
        const serviceList = (() => {
          try { const r = row.website_services; return Array.isArray(r) ? r : JSON.parse(r || '[]'); }
          catch { return []; }
        })();
        const services = serviceList.filter(s => s && String(s).trim()).map(s => ({ name: String(s).trim(), description: '', priceRange: '' }));
        let testimonials = [];
        try { const r = row.website_testimonials; testimonials = Array.isArray(r) ? r : JSON.parse(r || '[]'); } catch {}
        return res.json({ hasData: true, website: row.website, services, differentiators: (row.website_about || '').substring(0, 400), testimonials });
      }

      // No cached data — trigger a fresh scrape
      const ScraperService = require('../services/ScraperService');
      const scraper = new ScraperService();
      const data = await scraper.scrapeWebsite(row.website);

      await pool.query(
        `UPDATE customers SET scraped_data=$1, scraped_at=NOW(), website_services=$2, website_about=$3, website_testimonials=$4, updated_at=NOW() WHERE id=$5`,
        [JSON.stringify(data), JSON.stringify(data.services || []), data.about || null, JSON.stringify(data.testimonials || []), req.customerId]
      );

      const services = (data.services || []).filter(s => s?.trim()).map(s => ({ name: String(s).trim(), description: '', priceRange: '' }));
      let testimonials = [];
      try { testimonials = data.testimonials || []; } catch {}
      res.json({ hasData: services.length > 0 || !!data.about, website: row.website, services, differentiators: (data.about || '').substring(0, 400), testimonials });
    } catch (err) {
      console.error('[knowledge] import-website:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── DB migrations for auto-refresh columns ──────────────────────
  ;(async () => {
    try {
      await pool.query(`ALTER TABLE crawl_jobs ADD COLUMN IF NOT EXISTS auto_refresh BOOLEAN DEFAULT FALSE`);
      await pool.query(`ALTER TABLE crawl_jobs ADD COLUMN IF NOT EXISTS refresh_interval VARCHAR(20)`);
      await pool.query(`ALTER TABLE crawl_jobs ADD COLUMN IF NOT EXISTS next_refresh_at TIMESTAMP`);
    } catch (err) {
      console.error('[knowledge] auto-refresh migration:', err.message);
    }
  })();

  // ── POST /api/knowledge/crawl ─────────────────────────────────────
  // Start a new crawl job. Returns jobId for polling.
  router.post('/crawl', async (req, res) => {
    try {
      const { url, mode = 'domain' } = req.body;
      if (!url) return res.status(400).json({ error: 'url is required' });

      const customer = (await pool.query(
        'SELECT plan FROM customers WHERE id=$1', [req.customerId]
      )).rows[0];
      const plan = customer?.plan || 'starter';

      const jobId = await crawler.crawl(req.customerId, url, mode, plan);
      res.json({ success: true, jobId });
    } catch (err) {
      console.error('[knowledge] crawl start:', err.message);
      res.status(400).json({ error: err.message });
    }
  });

  // ── GET /api/knowledge/crawls ─────────────────────────────────────
  // List all crawl jobs for this customer (for Web Crawler tab table)
  router.get('/crawls', async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, url, mode, status, pages_crawled, pages_found,
                auto_refresh, refresh_interval, next_refresh_at,
                created_at, completed_at
         FROM crawl_jobs WHERE customer_id=$1 ORDER BY created_at DESC`,
        [req.customerId]
      );
      res.json({ jobs: rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── PATCH /api/knowledge/crawl/:jobId/refresh ─────────────────────
  // Set auto-refresh schedule for a crawl job
  router.patch('/crawl/:jobId/refresh', async (req, res) => {
    try {
      const { auto_refresh, refresh_interval } = req.body;
      const enabled = Boolean(auto_refresh);

      // Calculate next refresh time based on interval
      let nextRefreshExpr = 'NULL';
      if (enabled && refresh_interval) {
        const intervalMap = { daily: '1 day', weekly: '7 days', monthly: '30 days' };
        const pg = intervalMap[refresh_interval];
        if (pg) nextRefreshExpr = `NOW() + INTERVAL '${pg}'`;
      }

      const { rows } = await pool.query(
        `UPDATE crawl_jobs
         SET auto_refresh=$1, refresh_interval=$2,
             next_refresh_at=${enabled && refresh_interval ? `NOW() + INTERVAL '1 ${refresh_interval === 'daily' ? 'day' : refresh_interval === 'weekly' ? 'week' : 'month'}'` : 'NULL'}
         WHERE id=$3 AND customer_id=$4 RETURNING id, auto_refresh, refresh_interval, next_refresh_at`,
        [enabled, enabled ? (refresh_interval || null) : null, req.params.jobId, req.customerId]
      );
      if (!rows.length) return res.status(404).json({ error: 'Job not found' });
      res.json({ job: rows[0] });
    } catch (err) {
      console.error('[knowledge] PATCH refresh:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── PUT /api/knowledge/crawl/:jobId/data ──────────────────────────
  // Save edited scraped text back to the crawl job (overrides auto-extracted content)
  router.put('/crawl/:jobId/data', async (req, res) => {
    try {
      const { editedText } = req.body;
      if (typeof editedText !== 'string') return res.status(400).json({ error: 'editedText is required' });

      // Store edited_text inside result_summary so it survives re-crawls as an override
      const { rows } = await pool.query(
        `UPDATE crawl_jobs
         SET result_summary = COALESCE(result_summary, '{}'::jsonb) || jsonb_build_object('edited_text', $1::text)
         WHERE id=$2 AND customer_id=$3 RETURNING id`,
        [editedText.substring(0, 50000), req.params.jobId, req.customerId]
      );
      if (!rows.length) return res.status(404).json({ error: 'Job not found' });
      res.json({ ok: true });
    } catch (err) {
      console.error('[knowledge] PUT data:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/knowledge/crawl/:jobId ──────────────────────────────
  router.get('/crawl/:jobId', async (req, res) => {
    try {
      const job = await crawler.getJob(parseInt(req.params.jobId), req.customerId);
      if (!job) return res.status(404).json({ error: 'Crawl job not found' });
      res.json({ job });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/knowledge/crawl/:jobId/import ───────────────────────
  // Import selected page URLs from a completed crawl into business_knowledge
  router.post('/crawl/:jobId/import', async (req, res) => {
    const client = await pool.connect();
    try {
      const { selectedUrls = [] } = req.body;
      if (!selectedUrls.length) return res.status(400).json({ error: 'No pages selected' });

      const content = await crawler.importPages(parseInt(req.params.jobId), req.customerId, selectedUrls);

      // Merge into business_knowledge (append — don't delete existing)
      await client.query('BEGIN');

      const insertItem = (type, title, c, order = 0) =>
        client.query(
          `INSERT INTO business_knowledge (customer_id, knowledge_type, title, content, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [req.customerId, type, title, c, order]
        );

      for (let i = 0; i < content.services.length; i++) {
        const s = content.services[i];
        await insertItem('services', s.slice(0, 250), JSON.stringify({ name: s, description: '', priceRange: '' }), 1000 + i);
      }
      for (let i = 0; i < content.faqs.length; i++) {
        const f = content.faqs[i];
        if (f.q) await insertItem('faqs', f.q.slice(0, 250), JSON.stringify(f), 1000 + i);
      }
      if (content.about?.trim()) {
        await insertItem('differentiators', 'About (from website)', content.about.trim().substring(0, 400), 1000);
      }
      for (let i = 0; i < (content.testimonials || []).length; i++) {
        const t = content.testimonials[i];
        if (t) await insertItem('reviews', `Review ${i + 1}`, t.substring(0, 300), 1000 + i);
      }

      // Store pricing and hours in a dedicated knowledge entry
      if (content.pricing?.length) {
        await insertItem('services', 'Pricing (from website)', JSON.stringify({ pricing: content.pricing }), 999);
      }
      if (content.hours) {
        await insertItem('differentiators', 'Business Hours', content.hours, 998);
      }

      await client.query('COMMIT');
      res.json({ success: true, imported: { services: content.services.length, faqs: content.faqs.length } });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[knowledge] crawl import:', err.message);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // ── DELETE /api/knowledge/crawl/:jobId ───────────────────────────
  router.delete('/crawl/:jobId', async (req, res) => {
    try {
      await pool.query(
        `DELETE FROM crawl_jobs WHERE id=$1 AND customer_id=$2`,
        [req.params.jobId, req.customerId]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/knowledge/prices ────────────────────────────────────
  // Save structured pricing table as a knowledge entry
  router.post('/prices', async (req, res) => {
    try {
      const { items = [] } = req.body; // [{service, priceRange, notes}]
      if (!items.length) return res.status(400).json({ error: 'No pricing items provided' });

      await pool.query(
        `DELETE FROM business_knowledge WHERE customer_id=$1 AND knowledge_type='services' AND title LIKE 'Price:%'`,
        [req.customerId]
      );
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.service?.trim()) {
          await pool.query(
            `INSERT INTO business_knowledge (customer_id, knowledge_type, title, content, sort_order)
             VALUES ($1, 'services', $2, $3, $4)`,
            [req.customerId, `Price: ${item.service.trim()}`, JSON.stringify(item), 500 + i]
          );
        }
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/knowledge/upload-file ──────────────────────────────────────
  // Upload a TXT or PDF file and store extracted text as a knowledge entry
  router.post('/upload-file', memUpload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'No file uploaded' });

      const ext = file.originalname.split('.').pop().toLowerCase();
      let content = '';

      if (ext === 'txt' || ext === 'md') {
        content = file.buffer.toString('utf8');
      } else if (ext === 'pdf') {
        try {
          const pdfParse = require('pdf-parse');
          const data = await pdfParse(file.buffer);
          content = data.text;
        } catch (pdfErr) {
          return res.status(422).json({ error: 'Could not parse PDF: ' + pdfErr.message });
        }
      } else {
        return res.status(400).json({ error: 'Only TXT, MD, and PDF files are supported' });
      }

      if (!content.trim()) return res.status(422).json({ error: 'File appears to be empty or contains no readable text' });

      const { rows } = await pool.query(
        `INSERT INTO business_knowledge (customer_id, knowledge_type, title, content, sort_order)
         VALUES ($1, 'files', $2, $3,
           (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM business_knowledge WHERE customer_id=$1 AND knowledge_type='files')
         ) RETURNING *`,
        [req.customerId, file.originalname, content.trim()]
      );
      res.json({ entry: rows[0] });
    } catch (err) {
      console.error('[knowledge] upload-file:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── PUT /api/knowledge/:id ────────────────────────────────────────────────
  // Update a single entry's title and content
  router.put('/:id', async (req, res) => {
    try {
      const { title, content } = req.body;
      const { rows } = await pool.query(
        `UPDATE business_knowledge SET title=$1, content=$2, updated_at=NOW()
         WHERE id=$3 AND customer_id=$4 AND is_active=true RETURNING *`,
        [title, content, req.params.id, req.customerId]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Entry not found' });
      res.json({ entry: rows[0] });
    } catch (err) {
      console.error('[knowledge] PUT /:id:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── DELETE /api/knowledge/:id ─────────────────────────────────────────────
  // Soft-delete a single entry
  router.delete('/:id', async (req, res) => {
    try {
      await pool.query(
        `UPDATE business_knowledge SET is_active=false WHERE id=$1 AND customer_id=$2`,
        [req.params.id, req.customerId]
      );
      res.json({ success: true });
    } catch (err) {
      console.error('[knowledge] DELETE /:id:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
