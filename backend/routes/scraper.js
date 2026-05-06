const express = require('express');
const { authenticate } = require('../middleware/auth');
const ScraperService = require('../services/ScraperService');

module.exports = (pool) => {
  const router = express.Router();
  const scraper = new ScraperService();

  router.post('/scrape', authenticate, async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: 'URL is required' });

      const customer = await pool.query(
        'SELECT scraped_data, scraped_at, website FROM customers WHERE id = $1',
        [req.customerId]
      );
      if (customer.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });

      const cached = customer.rows[0];
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (cached.scraped_data && cached.scraped_at && new Date(cached.scraped_at) > sevenDaysAgo && cached.website === url) {
        console.log('📦 Returning cached scrape data');
        return res.json({ cached: true, data: cached.scraped_data, scrapedAt: cached.scraped_at });
      }

      const data = await scraper.scrapeWebsite(url);
      await pool.query(
        `UPDATE customers SET website=$1, scraped_data=$2, scraped_at=NOW(), website_services=$3, website_about=$4, updated_at=NOW() WHERE id=$5`,
        [url, JSON.stringify(data), JSON.stringify(data.services), data.about || null, req.customerId]
      );

      res.json({ cached: false, data, message: `Scrape complete. Found ${data.services.length} services!` });
    } catch (error) {
      console.error('Scrape error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/data', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT website, scraped_data, scraped_at, website_services, website_about FROM customers WHERE id=$1',
        [req.customerId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
      const data = result.rows[0];
      if (!data.scraped_data) return res.json({ hasData: false });
      res.json({ hasData: true, website: data.website, scrapedAt: data.scraped_at, services: data.website_services, about: data.website_about, fullData: data.scraped_data });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/data', authenticate, async (req, res) => {
    try {
      await pool.query(
        `UPDATE customers SET scraped_data=NULL, scraped_at=NULL, website_services='[]'::jsonb, website_about=NULL WHERE id=$1`,
        [req.customerId]
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
