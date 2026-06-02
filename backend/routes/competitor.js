const express = require('express');
const rateLimit = require('express-rate-limit');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate, getBillingCustomerId } = require('../middleware/auth');
const ScraperService = require('../services/ScraperService');
const industryKnowledge = require('../data/industryKnowledge');

const MAX_COMPETITORS = 3;
const ANALYZE_CREDIT_COST = 1;

// 5 analyze calls per 15 minutes per IP
const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many analysis requests. Please wait 15 minutes before analyzing again.' },
});

module.exports = (pool) => {
  const router = express.Router();
  const scraper = new ScraperService();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // DB migration — run once at startup
  (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS competitor_profiles (
          id            SERIAL PRIMARY KEY,
          customer_id   INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          name          VARCHAR(200),
          website       TEXT,
          scraped_at    TIMESTAMP,
          scraped_data  JSONB,
          analysis      JSONB,
          created_at    TIMESTAMP DEFAULT NOW(),
          updated_at    TIMESTAMP DEFAULT NOW()
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_competitor_profiles_customer ON competitor_profiles(customer_id)
      `);
    } catch (err) {
      console.error('[Competitor] migration error:', err.message);
    }
  })();

  // GET /api/competitor — list all competitors for this customer
  router.get('/', authenticate, async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM competitor_profiles WHERE customer_id = $1 ORDER BY created_at ASC',
        [req.customerId]
      );
      res.json({ competitors: rows });
    } catch (err) {
      console.error('[Competitor] list error:', err.message);
      res.status(500).json({ error: 'Failed to load competitors' });
    }
  });

  // POST /api/competitor — add a competitor (max 3)
  router.post('/', authenticate, async (req, res) => {
    try {
      const customerId = req.customerId;
      const { name, website } = req.body;
      if (!website) return res.status(400).json({ error: 'Website URL is required' });

      // Enforce max 3 competitors
      const { rows: existing } = await pool.query(
        'SELECT COUNT(*) FROM competitor_profiles WHERE customer_id = $1',
        [customerId]
      );
      if (parseInt(existing[0].count) >= MAX_COMPETITORS) {
        return res.status(400).json({ error: `Maximum ${MAX_COMPETITORS} competitors allowed. Remove one to add another.` });
      }

      // Normalise URL
      let url = website.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`;

      const { rows } = await pool.query(
        `INSERT INTO competitor_profiles (customer_id, name, website) VALUES ($1, $2, $3) RETURNING *`,
        [customerId, (name || '').trim() || null, url]
      );
      res.json({ competitor: rows[0] });
    } catch (err) {
      console.error('[Competitor] add error:', err.message);
      res.status(500).json({ error: 'Failed to add competitor' });
    }
  });

  // PATCH /api/competitor/:id — update name/website
  router.patch('/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, website } = req.body;
      const { rows } = await pool.query(
        `UPDATE competitor_profiles SET name = COALESCE($1, name), website = COALESCE($2, website), updated_at = NOW()
         WHERE id = $3 AND customer_id = $4 RETURNING *`,
        [name || null, website || null, id, req.customerId]
      );
      if (!rows.length) return res.status(404).json({ error: 'Competitor not found' });
      res.json({ competitor: rows[0] });
    } catch (err) {
      console.error('[Competitor] update error:', err.message);
      res.status(500).json({ error: 'Failed to update competitor' });
    }
  });

  // DELETE /api/competitor/:id — remove competitor
  router.delete('/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query(
        'DELETE FROM competitor_profiles WHERE id = $1 AND customer_id = $2',
        [id, req.customerId]
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('[Competitor] delete error:', err.message);
      res.status(500).json({ error: 'Failed to delete competitor' });
    }
  });

  // POST /api/competitor/:id/analyze — scrape + AI analysis
  router.post('/:id/analyze', analyzeLimiter, authenticate, async (req, res) => {
    const client = await pool.connect();
    let creditDeducted = false;
    const billingId = getBillingCustomerId(req);
    try {
      const { id } = req.params;
      const customerId = req.customerId;

      // Fetch competitor and customer
      const [compRes, custRes] = await Promise.all([
        pool.query('SELECT * FROM competitor_profiles WHERE id = $1 AND customer_id = $2', [id, customerId]),
        pool.query('SELECT * FROM customers WHERE id = $1', [customerId]),
      ]);
      if (!compRes.rows.length) return res.status(404).json({ error: 'Competitor not found' });
      if (!custRes.rows.length) return res.status(404).json({ error: 'Customer not found' });

      const comp = compRes.rows[0];
      const customer = custRes.rows[0];

      // Credit deduction (SELECT FOR UPDATE)
      await client.query('BEGIN');
      const { rows: billing } = await client.query(
        'SELECT credits_balance FROM customers WHERE id = $1 FOR UPDATE',
        [billingId]
      );
      if (!billing.length || billing[0].credits_balance < ANALYZE_CREDIT_COST) {
        await client.query('ROLLBACK');
        return res.status(402).json({ error: `Insufficient credits. Analyzing a competitor costs ${ANALYZE_CREDIT_COST} credit.` });
      }
      await client.query(
        'UPDATE customers SET credits_balance = credits_balance - $1 WHERE id = $2',
        [ANALYZE_CREDIT_COST, billingId]
      );
      await client.query(
        `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description) VALUES ($1, 'debit', $2, $3, $4)`,
        [billingId, ANALYZE_CREDIT_COST, billing[0].credits_balance - ANALYZE_CREDIT_COST, `Competitor analysis: ${comp.name || comp.website}`]
      );
      await client.query('COMMIT');
      creditDeducted = true;

      // Scrape competitor website
      let scrapedData = null;
      let scrapeError = null;
      try {
        scrapedData = await scraper.scrapeWebsite(comp.website);
      } catch (err) {
        scrapeError = err.message;
        console.error('[Competitor] scrape error:', err.message);
      }

      // Build Claude analysis prompt
      const knowledge = industryKnowledge[customer.industry] || industryKnowledge.general_contractor;
      const month = new Date().getMonth() + 1;
      const seasonal = knowledge.seasonalContent?.[month] || {};

      const competitorInfo = scrapedData
        ? `
Competitor website: ${comp.website}
Competitor name: ${scrapedData.businessName || comp.name || 'Unknown'}
Services they offer: ${(scrapedData.services || []).slice(0, 15).join(', ') || 'Could not determine'}
Their description: ${(scrapedData.description || '').substring(0, 400)}
Their keywords: ${(scrapedData.keywords || []).slice(0, 20).join(', ')}
Testimonials found: ${(scrapedData.testimonials || []).length}
Social links: ${Object.keys(scrapedData.socialLinks || {}).join(', ') || 'None found'}
`
        : `Competitor website: ${comp.website}\nNote: Could not scrape website — ${scrapeError || 'access denied'}`;

      const customerInfo = `
My business: ${customer.business_name || 'My business'}
Industry: ${customer.industry || 'general contractor'}
Location: ${customer.location || 'local area'}
My services: ${(customer.scraped_services || []).join(', ') || 'Not specified'}
Tone preference: ${customer.tone || 'professional'}
`;

      const prompt = `You are ItsPosting AI, an AI social media advisor for local service businesses.

My customer's business:
${customerInfo}

Their competitor:
${competitorInfo}

Current month context: Month ${month}. ${seasonal.urgencyTopic ? `This month's priority: ${seasonal.urgencyTopic}` : ''}

Analyze this competitor from a social media and content marketing perspective. Be specific, practical, and write like a trusted advisor.

Return ONLY valid JSON with this exact structure:
{
  "competitorName": "the competitor's actual business name if found, or their website domain",
  "headline": "one powerful sentence summarizing their positioning (max 15 words)",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "gaps": ["gap or weakness 1", "gap or weakness 2", "gap or weakness 3"],
  "contentOpportunities": [
    {
      "angle": "Short content angle title (5-7 words)",
      "why": "Why this beats the competitor (1 sentence)",
      "wizardHint": "What to type in the wizard to create this post"
    },
    {
      "angle": "Second content angle",
      "why": "Why this works",
      "wizardHint": "Wizard hint"
    },
    {
      "angle": "Third content angle",
      "why": "Why this works",
      "wizardHint": "Wizard hint"
    }
  ],
  "pricingSignal": "Any pricing signals found (e.g. 'No pricing visible — opportunity to be transparent') — 1 sentence",
  "reviewSignal": "Testimonial/review observations (e.g. '2 testimonials found — you could outshine them with Google reviews') — 1 sentence",
  "socialSignal": "Social media presence observation (e.g. 'They have Facebook but no Instagram — Instagram gap you can own') — 1 sentence",
  "overallVerdict": "Your 2-sentence honest verdict: where they're strong and your #1 differentiator opportunity"
}`;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = response.content[0]?.text || '';
      let analysis = null;
      try {
        analysis = JSON.parse(raw.replace(/```json|```/g, '').trim());
      } catch {
        // fallback minimal analysis
        analysis = {
          competitorName: comp.name || comp.website,
          headline: 'Analysis could not be parsed',
          overallVerdict: 'Please try again.',
        };
      }

      // Save analysis + scraped data
      const { rows: updated } = await pool.query(
        `UPDATE competitor_profiles SET scraped_data = $1, analysis = $2, scraped_at = NOW(), name = COALESCE($3, name), updated_at = NOW()
         WHERE id = $4 RETURNING *`,
        [
          scrapedData ? JSON.stringify(scrapedData) : null,
          JSON.stringify(analysis),
          analysis.competitorName || null,
          id,
        ]
      );

      res.json({ competitor: updated[0], analysis, creditsUsed: ANALYZE_CREDIT_COST });
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      // If credits were already committed but analysis failed, refund automatically
      if (creditDeducted) {
        pool.query(
          `UPDATE customers SET credits_balance = credits_balance + $1 WHERE id = $2
           RETURNING credits_balance`,
          [ANALYZE_CREDIT_COST, billingId]
        ).then(r => pool.query(
          `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
           VALUES ($1, 'refund', $2, $3, 'Competitor analysis failed — credit refunded')`,
          [billingId, ANALYZE_CREDIT_COST, r.rows[0]?.credits_balance ?? 0]
        )).catch(refundErr => console.error('[Competitor] credit refund failed:', refundErr.message));
      }
      console.error('[Competitor] analyze error:', err.message);
      res.status(500).json({ error: 'Analysis failed: ' + err.message });
    } finally {
      client.release();
    }
  });

  return router;
};
