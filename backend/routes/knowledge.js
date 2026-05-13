'use strict';

const express          = require('express');
const { authenticate } = require('../middleware/auth');

module.exports = (pool) => {
  const router = express.Router();
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

  return router;
};
