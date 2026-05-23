const express = require('express');
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate } = require('../middleware/auth');
const industryKnowledge = require('../data/industryKnowledge');

const CLAUDE_MODEL = 'claude-sonnet-4-6';

// Map idea content_type → wizard step-3 theme id
const CONTENT_TYPE_TO_THEME = {
  educational_tip:      'share_tip',
  seasonal:             'seasonal',
  customer_testimonial: 'got_review',
  promotional:          'running_promo',
  before_after:         'just_finished_job',
  community:            'community',
  faq:                  'faq',
  team_spotlight:       'team_spotlight',
};

async function generateIdeasForCustomer(customer) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const industry = customer.industry || 'general_contractor';
  const knowledge = industryKnowledge[industry] || industryKnowledge.general_contractor;
  const month = new Date().getMonth() + 1;
  const seasonal = knowledge.seasonalContent?.[month] || {};
  const hooks = (knowledge.hookFormulas || []).slice(0, 3);
  const painPoints = (knowledge.customerPainPoints || []).slice(0, 5);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const businessName = customer.business_name || 'this business';
  const location = customer.location || 'your area';

  const systemPrompt = `You are PostCore, an expert social media strategist for local service businesses.

BUSINESS PROFILE:
- Name: ${businessName}
- Industry: ${industry}
- Location: ${location}
- Tone preference: ${customer.tone || 'professional'}

INDUSTRY INTELLIGENCE FOR ${industry.toUpperCase()}:
- This month's urgent topic: ${seasonal.urgencyTopic || 'general service excellence'}
- This month's tip opportunity: ${seasonal.tipTopic || 'how-to tips'}
- Seasonal promotion angle: ${seasonal.promotionAngle || 'seasonal special offer'}
- Top customer pain points: ${painPoints.join('; ')}
- Proven hook formulas: ${hooks.join(' | ')}

Your job is to generate 6 post ideas that are immediately actionable for a local ${industry} business. Each idea must feel specific, timely, and directly useful — not generic.

CONTENT MIX RULES (non-negotiable):
- 3 ideas: category = "educational"
- 1 idea: category = "seasonal"
- 1 idea: category = "social_proof"
- 1 idea: category = "promotional"

RESPONSE FORMAT: Return a JSON array of exactly 6 objects. No markdown, no explanation, just the raw JSON array.

Each object:
{
  "id": "<unique UUID v4>",
  "title": "<compelling 4-8 word title>",
  "category": "<educational|seasonal|social_proof|promotional>",
  "urgency": "<high|medium|low>",
  "why_now": "<1 sentence: why this specific idea is relevant today/this week/this season>",
  "hook": "<a single scroll-stopping opening line — specific, not generic>",
  "caption_preview": "<first 120 characters of the ideal caption>",
  "content_type": "<educational_tip|seasonal|customer_testimonial|promotional|before_after|community|faq|team_spotlight>",
  "platform": "<facebook|instagram|both|google>",
  "hashtags": ["<3-5 relevant hashtags without #>"],
  "used": false
}`;

  const userMessage = `Generate 6 post ideas for ${businessName} (${industry} business in ${location}) for ${today}.
Make each idea specific to the season, the industry, and what local homeowners/customers are thinking about right now.
Return only the JSON array.`;

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const raw = response.content[0].text;
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  let ideas;
  try {
    ideas = JSON.parse(cleaned);
  } catch (parseErr) {
    console.error('[Ideas] Claude returned invalid JSON:', cleaned.slice(0, 200));
    throw new Error('AI returned malformed response. Please try again.');
  }

  // Ensure each idea has a valid UUID and wizardTheme
  return ideas.map(idea => ({
    ...idea,
    id: idea.id || crypto.randomUUID(),
    wizardTheme: CONTENT_TYPE_TO_THEME[idea.content_type] || 'share_tip',
  }));
}

module.exports = (pool) => {
  const router = express.Router();

  // GET /api/ideas/today — return today's ideas, auto-generate if none exist
  router.get('/today', authenticate, async (req, res) => {
    try {
      const existing = await pool.query(
        `SELECT ideas, refreshed_at FROM post_ideas
         WHERE customer_id = $1 AND generated_date = CURRENT_DATE`,
        [req.customerId]
      );

      if (existing.rows.length > 0) {
        return res.json({
          ideas: existing.rows[0].ideas,
          refreshed_at: existing.rows[0].refreshed_at,
          cached: true,
        });
      }

      // None yet — fetch customer profile and generate
      const customerRes = await pool.query(
        `SELECT business_name, industry, location, tone FROM customers WHERE id = $1`,
        [req.customerId]
      );
      if (!customerRes.rows.length) return res.status(404).json({ error: 'Customer not found' });

      const ideas = await generateIdeasForCustomer(customerRes.rows[0]);

      await pool.query(
        `INSERT INTO post_ideas (customer_id, ideas, generated_date)
         VALUES ($1, $2, CURRENT_DATE)
         ON CONFLICT (customer_id, generated_date) DO UPDATE SET ideas = EXCLUDED.ideas`,
        [req.customerId, JSON.stringify(ideas)]
      );

      res.json({ ideas, cached: false });
    } catch (err) {
      console.error('[Ideas/today]', err.message);
      res.status(500).json({ error: 'Failed to load ideas. Please try again.' });
    }
  });

  // POST /api/ideas/refresh — force regenerate (max 1×/hour)
  router.post('/refresh', authenticate, async (req, res) => {
    try {
      const existing = await pool.query(
        `SELECT refreshed_at FROM post_ideas
         WHERE customer_id = $1 AND generated_date = CURRENT_DATE`,
        [req.customerId]
      );

      if (existing.rows.length > 0 && existing.rows[0].refreshed_at) {
        const diffMs = Date.now() - new Date(existing.rows[0].refreshed_at).getTime();
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 60) {
          const waitMin = 60 - diffMin;
          return res.status(429).json({
            error: `You can refresh once per hour. Try again in ${waitMin} minute${waitMin !== 1 ? 's' : ''}.`,
            nextRefreshIn: waitMin,
          });
        }
      }

      const customerRes = await pool.query(
        `SELECT business_name, industry, location, tone FROM customers WHERE id = $1`,
        [req.customerId]
      );
      if (!customerRes.rows.length) return res.status(404).json({ error: 'Customer not found' });

      const ideas = await generateIdeasForCustomer(customerRes.rows[0]);
      const now = new Date();

      await pool.query(
        `INSERT INTO post_ideas (customer_id, ideas, generated_date, refreshed_at)
         VALUES ($1, $2, CURRENT_DATE, $3)
         ON CONFLICT (customer_id, generated_date) DO UPDATE
           SET ideas = EXCLUDED.ideas, refreshed_at = EXCLUDED.refreshed_at`,
        [req.customerId, JSON.stringify(ideas), now]
      );

      res.json({ ideas, refreshed_at: now });
    } catch (err) {
      console.error('[Ideas/refresh]', err.message);
      res.status(500).json({ error: 'Failed to refresh ideas. Please try again.' });
    }
  });

  // POST /api/ideas/:ideaId/use — mark idea as used, return wizard pre-fill data
  router.post('/:ideaId/use', authenticate, async (req, res) => {
    try {
      const { ideaId } = req.params;

      const row = await pool.query(
        `SELECT ideas FROM post_ideas WHERE customer_id = $1 AND generated_date = CURRENT_DATE`,
        [req.customerId]
      );
      if (!row.rows.length) return res.status(404).json({ error: 'No ideas found for today' });

      const ideas = row.rows[0].ideas;
      const idx = ideas.findIndex(i => i.id === ideaId);
      if (idx === -1) return res.status(404).json({ error: 'Idea not found' });

      const idea = ideas[idx];
      ideas[idx] = { ...idea, used: true };

      await pool.query(
        `UPDATE post_ideas SET ideas = $1 WHERE customer_id = $2 AND generated_date = CURRENT_DATE`,
        [JSON.stringify(ideas), req.customerId]
      );

      res.json({
        wizardTheme:   idea.wizardTheme || 'share_tip',
        hook:          idea.hook,
        title:         idea.title,
        contentType:   idea.content_type,
      });
    } catch (err) {
      console.error('[Ideas/use]', err.message);
      res.status(500).json({ error: 'Failed to mark idea as used' });
    }
  });

  // POST /api/ideas/generate-daily — cron endpoint
  router.post('/generate-daily', async (req, res) => {
    const secret = req.headers['x-cron-secret'];
    if (!secret || secret !== process.env.CRON_SECRET) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      const customers = await pool.query(
        `SELECT c.id, c.business_name, c.industry, c.location, c.tone
         FROM customers c
         WHERE c.suspended = false
           AND c.plan != 'trial'
           AND NOT EXISTS (
             SELECT 1 FROM post_ideas pi
             WHERE pi.customer_id = c.id AND pi.generated_date = CURRENT_DATE
           )
         LIMIT 200`
      );

      let generated = 0;
      for (const customer of customers.rows) {
        try {
          const ideas = await generateIdeasForCustomer(customer);
          await pool.query(
            `INSERT INTO post_ideas (customer_id, ideas, generated_date)
             VALUES ($1, $2, CURRENT_DATE)
             ON CONFLICT (customer_id, generated_date) DO NOTHING`,
            [customer.id, JSON.stringify(ideas)]
          );
          generated++;
        } catch (e) {
          console.error(`[Ideas/cron] Failed for customer ${customer.id}:`, e.message);
        }
      }

      console.log(`[Ideas/cron] Generated ideas for ${generated}/${customers.rows.length} customers`);
      res.json({ generated, total: customers.rows.length });
    } catch (err) {
      console.error('[Ideas/cron]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
