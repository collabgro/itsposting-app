const express = require('express');
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate, getBillingCustomerId } = require('../middleware/auth');
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

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Replace [CITY] and [BUSINESS] placeholders in all text fields of every idea
function personalise(ideas, customer) {
  const city = customer.location || 'your area';
  const biz  = customer.business_name || 'our team';
  const sub  = (str) => (str || '').replace(/\[CITY\]/gi, city).replace(/\[BUSINESS\]/gi, biz);
  return ideas.map(idea => ({
    ...idea,
    id: crypto.randomUUID(), // new UUID per customer so used-state is independent
    title:          sub(idea.title),
    why_now:        sub(idea.why_now),
    hook:           sub(idea.hook),
    caption_preview: sub(idea.caption_preview),
    hashtags:       (idea.hashtags || []).map(h => h.replace(/\[city\]/gi, city.toLowerCase().replace(/[\s,]+/g,''))),
  }));
}

// Deterministic fallback when Claude is unavailable — uses [CITY]/[BUSINESS] placeholders
function generateFallbackIdeas(industry) {
  const knowledge = industryKnowledge[industry] || industryKnowledge.general_contractor;
  const month = new Date().getMonth() + 1;
  const monthName = MONTH_NAMES[month - 1];
  const seasonal = knowledge.seasonalContent?.[month] || {};
  const location = '[CITY]';
  const businessName = '[BUSINESS]';
  const industryLabel = industry.replace(/_/g, ' ');
  const locationSlug = '[city]';
  const industrySlug = industry.replace(/_/g, '');

  // Pick the highest-engagement angles for education posts
  const vhAngles = (knowledge.contentAngles || []).filter(a => a.engagementLevel === 'very_high');
  const highAngles = (knowledge.contentAngles || []).filter(a => a.engagementLevel === 'high');
  const eduPool = [...vhAngles, ...highAngles];
  const faqPool = knowledge.faqPairs || [];
  const hookFormulas = knowledge.hookFormulas || [];

  // Replace [city] placeholder in hook templates
  const localise = (str) => (str || '').replace(/\[city\]/gi, location);

  const ideas = [];

  // ── Educational #1 — highest engagement angle, adapted for location
  const angle1 = eduPool[0];
  ideas.push({
    id: crypto.randomUUID(),
    title: angle1
      ? angle1.hook.replace(/\[city\]/gi, location).split('.')[0].slice(0, 65)
      : `The ${monthName} ${industryLabel} mistake that costs homeowners`,
    category: 'educational',
    urgency: 'high',
    why_now: angle1
      ? `${angle1.why} — especially relevant for ${location} homeowners right now.`
      : `${location} homeowners are making this mistake every ${monthName} — be the expert who stops it.`,
    hook: localise(angle1?.hook || hookFormulas[0] || `Most ${location} homeowners don't realise this about their ${industryLabel} system — until it costs them.`),
    caption_preview: `Here's what we see constantly in ${location} homes — and why it matters more than most people think.`,
    content_type: 'educational_tip',
    platform: 'facebook',
    hashtags: [`${industrySlug}tips`, locationSlug, 'homeownertips', 'localtrade', monthName.toLowerCase()],
    used: false,
    wizardTheme: 'share_tip',
  });

  // ── Educational #2 — FAQ angle (Q&A format performs very well)
  const faq1 = faqPool[0];
  ideas.push({
    id: crypto.randomUUID(),
    title: faq1
      ? faq1.q.replace(/\?$/, '').slice(0, 60)
      : `The question ${location} homeowners keep asking us`,
    category: 'educational',
    urgency: 'medium',
    why_now: `This is one of the most common questions we get from ${location} homeowners — answering it publicly builds trust.`,
    hook: faq1
      ? `"${faq1.q}" — we get this question every week. Here's the honest answer.`
      : localise(hookFormulas[1] || `Every ${location} homeowner should know this before calling any ${industryLabel} company.`),
    caption_preview: faq1
      ? faq1.a.slice(0, 130)
      : `The honest answer most ${industryLabel} companies won't tell you — because it might mean you don't need to call them today.`,
    content_type: 'faq',
    platform: 'both',
    hashtags: [`${industrySlug}faq`, locationSlug, 'homeowner', `${industrySlug}advice`, 'localbusiness'],
    used: false,
    wizardTheme: 'share_tip',
  });

  // ── Educational #3 — second high-engagement angle or second FAQ
  const angle2 = eduPool[1] || eduPool[0];
  const faq2 = faqPool[1];
  ideas.push({
    id: crypto.randomUUID(),
    title: angle2
      ? angle2.hook.replace(/\[city\]/gi, location).split('.')[0].slice(0, 65)
      : (faq2 ? faq2.q.replace(/\?$/, '').slice(0, 60) : `Warning signs ${location} homeowners miss`),
    category: 'educational',
    urgency: 'medium',
    why_now: angle2
      ? `${angle2.why} Posting this in ${monthName} positions you as the go-to ${industryLabel} expert in ${location}.`
      : `${location} homeowners rarely know this — the first company to tell them wins their trust.`,
    hook: localise(angle2?.hook || faq2?.q && `"${faq2.q}" Here is the real answer.` || hookFormulas[2] || `If you own a home in ${location}, you need to know this.`),
    caption_preview: faq2 && !angle2
      ? faq2.a.slice(0, 130)
      : `What we found in a ${location} home this week — and the warning sign that was there for months before anyone noticed.`,
    content_type: angle2?.type === 'before_after' ? 'before_after' : 'educational_tip',
    platform: 'instagram',
    hashtags: [`${industrySlug}`, locationSlug, 'beforeandafter', 'homeimprovement', `${industrySlug}expert`],
    used: false,
    wizardTheme: 'share_tip',
  });

  // ── Seasonal — use the rich postIdea + engagementHook from seasonalContent
  ideas.push({
    id: crypto.randomUUID(),
    title: seasonal.urgencyTopic
      ? seasonal.urgencyTopic.split('—')[0].trim().slice(0, 60)
      : `What ${location} homeowners need to do this ${monthName}`,
    category: 'seasonal',
    urgency: 'high',
    why_now: seasonal.emotionalContext
      ? seasonal.emotionalContext
      : `It's ${monthName} — this is the #1 ${industryLabel} issue in ${location} right now.`,
    hook: seasonal.engagementHook
      ? localise(seasonal.engagementHook)
      : localise(hookFormulas[0] || `It's ${monthName}. Here's the one ${industryLabel} thing ${location} homeowners need to do before it's too late.`),
    caption_preview: seasonal.postIdea
      ? localise(seasonal.postIdea).slice(0, 130)
      : `${seasonal.tipTopic || `${monthName} maintenance`} — what we're telling every ${location} homeowner this week.`,
    content_type: 'seasonal',
    platform: 'facebook',
    hashtags: [monthName.toLowerCase(), `${industrySlug}`, locationSlug, 'seasonal', 'homeowner'],
    used: false,
    wizardTheme: 'seasonal',
  });

  // ── Social proof — real job reveal (most authentic content type)
  const jobAngle = (knowledge.contentAngles || []).find(a => a.type === 'before_after' || a.type === 'job_reveal');
  ideas.push({
    id: crypto.randomUUID(),
    title: `Real job in ${location}: what we found this week`,
    category: 'social_proof',
    urgency: 'medium',
    why_now: `Authentic before/after content from real local jobs builds more trust than any ad. ${location} homeowners want to see real work, not stock photos.`,
    hook: localise(jobAngle?.hook || `What we found behind this wall in ${location} this week. The homeowner had no idea.`),
    caption_preview: `No stock photos. No staged shots. This is a real job we completed in ${location} — here's what the customer called us about, and what we actually found.`,
    content_type: 'before_after',
    platform: 'instagram',
    hashtags: [`${industrySlug}`, locationSlug, 'beforeandafter', 'realjob', `${locationSlug}${industrySlug}`],
    used: false,
    wizardTheme: 'just_finished_job',
  });

  // ── Promotional — seasonal angle with urgency and scarcity
  ideas.push({
    id: crypto.randomUUID(),
    title: seasonal.promotionAngle
      ? seasonal.promotionAngle.slice(0, 60)
      : `${monthName} special — limited spots for ${location} homeowners`,
    category: 'promotional',
    urgency: 'high',
    why_now: `${monthName} is the right time to promote this — homeowners are actively thinking about ${seasonal.urgencyTopic?.split('—')[0]?.trim() || `${industryLabel} maintenance`} and budgeting for it.`,
    hook: seasonal.promotionAngle
      ? `${location} homeowners — this ${monthName} offer expires when our schedule fills. Here's what's included.`
      : `We only take on a limited number of jobs each ${monthName} in ${location}. Here's our current availability.`,
    caption_preview: seasonal.promotionAngle
      ? `${localise(seasonal.promotionAngle)} — this is what's included and how to book before spots run out.`
      : `${monthName} is our busiest month in ${location}. If you've been putting off your ${industryLabel} work, this is the time to book.`,
    content_type: 'promotional',
    platform: 'both',
    hashtags: [`${industrySlug}deal`, locationSlug, 'localservice', monthName.toLowerCase(), `${locationSlug}homes`],
    used: false,
    wizardTheme: 'running_promo',
  });

  return ideas;
}

async function generateIdeasForCustomer(customer) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[Ideas] ANTHROPIC_API_KEY not set — using fallback ideas');
    return personalise(generateFallbackIdeas(customer.industry || 'general_contractor'), customer);
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const industry = customer.industry || 'general_contractor';
  const knowledge = industryKnowledge[industry] || industryKnowledge.general_contractor;
  const month = new Date().getMonth() + 1;
  const seasonal = knowledge.seasonalContent?.[month] || {};
  const businessName = customer.business_name || 'this business';
  const location = customer.location || 'your area';

  // Pull the richest data sources available
  const topAngles = (knowledge.contentAngles || [])
    .filter(a => a.engagementLevel === 'very_high' || a.engagementLevel === 'high')
    .slice(0, 5);
  const hookFormulas = (knowledge.hookFormulas || []).slice(0, 5);
  const painPoints = (knowledge.customerPainPoints || []).slice(0, 8);
  const faqPairs = (knowledge.faqPairs || []).slice(0, 4);
  const tradeTerms = (knowledge.tradeTerminology || []).slice(0, 8);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const anglesBlock = topAngles.length > 0
    ? topAngles.map(a => `  • "${a.hook}"\n    WHY IT WORKS: ${a.why}`).join('\n')
    : '';

  const faqBlock = faqPairs.length > 0
    ? faqPairs.map(f => `  Q: ${f.q}\n  A: ${f.a}`).join('\n').slice(0, 800)
    : '';

  const systemPrompt = `You are ItsPosting AI, the world's best social media strategist for local trade businesses. Your ideas make business owners say "wow, that's exactly what I needed to post."

BUSINESS PROFILE:
- Name: ${businessName}
- Industry: ${industry.replace(/_/g, ' ')}
- Location: ${location}
- Tone: ${customer.tone || 'professional but approachable'}

═══ THIS MONTH'S INTELLIGENCE (${today}) ═══

SEASONAL CONTEXT:
- Urgent topic right now: ${seasonal.urgencyTopic || 'quality and reliability'}
- Best tip to share this month: ${seasonal.tipTopic || 'maintenance best practices'}
- Promotion angle that converts: ${seasonal.promotionAngle || 'seasonal special'}
- Emotional context: ${seasonal.emotionalContext || 'Homeowners want a trusted local expert they can rely on.'}
- Winning post idea this month: ${seasonal.postIdea || 'Share a real job story from this week.'}
- Engagement hook that gets comments: ${seasonal.engagementHook || 'Ask a question that makes homeowners think.'}

TOP CUSTOMER PAIN POINTS (real fears, not marketing speak):
${painPoints.map((p, i) => `  ${i + 1}. ${p}`).join('\n')}

PROVEN HIGH-ENGAGEMENT ANGLES (use these as inspiration, adapt freely):
${anglesBlock}

HOOK FORMULAS THAT STOP THE SCROLL:
${hookFormulas.map(h => `  • ${h}`).join('\n')}

INDUSTRY TERMS TO USE NATURALLY (shows expertise):
${tradeTerms.join(', ')}

${faqBlock ? `REAL FAQs LOCAL CUSTOMERS ASK (ideal for FAQ posts):\n${faqBlock}` : ''}

═══ WHAT MAKES A "WOW" IDEA ═══

Every idea must pass this test:
✓ SPECIFIC — contains a real number, dollar amount, timeframe, or local reference (not "save money" but "save $300 before June")
✓ SURPRISING — challenges a common belief, reveals something hidden, or shows a consequence most people don't expect
✓ IMMEDIATELY ACTIONABLE — the homeowner can do something or feel something right now
✓ LOCAL — mentions ${location} or feels written for exactly this city
✓ EMOTIONAL — connects to a real fear, frustration, or aspiration homeowners actually have

WHAT TO AVOID:
✗ Generic hooks like "Did you know..." or "Tip of the day..."
✗ Vague benefits like "save money" or "stay safe"
✗ Corporate language — write like a trusted neighbour, not a company
✗ Recycled ideas that every trade business posts

CONTENT MIX (non-negotiable):
- 3 ideas: category = "educational" (teach something surprising or counterintuitive)
- 1 idea: category = "seasonal" (directly tied to this month's urgency — use the seasonal context above)
- 1 idea: category = "social_proof" (real job story, review, before/after — specific outcome)
- 1 idea: category = "promotional" (offer with a reason to act NOW — scarcity, season, price window)

RESPONSE FORMAT: Return a JSON array of exactly 6 objects. No markdown, no explanation, just the raw JSON array.

Each object:
{
  "id": "<UUID v4>",
  "title": "<punchy 4-8 word title that makes them want to read — no generic titles>",
  "category": "<educational|seasonal|social_proof|promotional>",
  "urgency": "<high|medium|low>",
  "why_now": "<1 sharp sentence: the specific reason this idea is gold right now for ${location} homeowners>",
  "hook": "<the single most important line — must be specific, surprising, or emotionally charged — this is what stops the scroll>",
  "caption_preview": "<first 130 characters of the ideal caption — pull the reader in immediately, no warm-up>",
  "content_type": "<educational_tip|seasonal|customer_testimonial|promotional|before_after|community|faq|team_spotlight>",
  "platform": "<facebook|instagram|both|google>",
  "hashtags": ["<4-5 relevant hashtags without # — mix local + niche + broad>"],
  "used": false
}`;

  const userMessage = `Generate 6 post ideas for ${businessName}, a ${industry.replace(/_/g,' ')} business serving ${location}. Today is ${today}.

Each idea must feel like it was researched specifically for this business, this city, and this exact week — not copy-pasted from a template. The hooks especially must be magnetic and specific.

Return only the JSON array.`;

  let response;
  try {
    response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
  } catch (claudeErr) {
    console.error('[Ideas] Claude API error — using fallback:', claudeErr.message);
    return personalise(generateFallbackIdeas(customer.industry || 'general_contractor'), customer);
  }

  const raw = response.content[0].text;
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  let ideas;
  try {
    ideas = JSON.parse(cleaned);
  } catch (parseErr) {
    console.error('[Ideas] Claude returned invalid JSON — using fallback:', cleaned.slice(0, 200));
    return personalise(generateFallbackIdeas(customer.industry || 'general_contractor'), customer);
  }

  // Ensure each idea has a valid UUID and wizardTheme
  return ideas.map(idea => ({
    ...idea,
    id: idea.id || crypto.randomUUID(),
    wizardTheme: CONTENT_TYPE_TO_THEME[idea.content_type] || 'share_tip',
  }));
}

// Generate ideas with [CITY] / [BUSINESS] placeholders for a whole industry — called once per industry per day
async function generateSharedIdeas(industry) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateFallbackIdeas(industry);
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const knowledge = industryKnowledge[industry] || industryKnowledge.general_contractor;
  const month = new Date().getMonth() + 1;
  const seasonal = knowledge.seasonalContent?.[month] || {};
  const topAngles = (knowledge.contentAngles || [])
    .filter(a => a.engagementLevel === 'very_high' || a.engagementLevel === 'high')
    .slice(0, 5);
  const hookFormulas = (knowledge.hookFormulas || []).slice(0, 5);
  const painPoints = (knowledge.customerPainPoints || []).slice(0, 8);
  const faqPairs = (knowledge.faqPairs || []).slice(0, 4);
  const tradeTerms = (knowledge.tradeTerminology || []).slice(0, 8);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const industryLabel = industry.replace(/_/g, ' ');
  const anglesBlock = topAngles.map(a => `  • "${a.hook}"\n    WHY IT WORKS: ${a.why}`).join('\n');
  const faqBlock = faqPairs.map(f => `  Q: ${f.q}\n  A: ${f.a}`).join('\n').slice(0, 800);

  const systemPrompt = `You are ItsPosting AI, the world's best social media strategist for local trade businesses. Your ideas make business owners say "wow, that's exactly what I needed to post."

INDUSTRY: ${industryLabel}
DATE: ${today}

IMPORTANT: Use [CITY] as a placeholder wherever you'd reference the business's city, and [BUSINESS] wherever you'd reference the business name. These will be personalised for each customer before they see the ideas.

═══ THIS MONTH'S INTELLIGENCE ═══

SEASONAL CONTEXT:
- Urgent topic right now: ${seasonal.urgencyTopic || 'quality and reliability'}
- Best tip to share this month: ${seasonal.tipTopic || 'maintenance best practices'}
- Promotion angle that converts: ${seasonal.promotionAngle || 'seasonal special'}
- Emotional context: ${seasonal.emotionalContext || 'Homeowners want a trusted local expert they can rely on.'}
- Winning post idea this month: ${seasonal.postIdea || 'Share a real job story from this week.'}
- Engagement hook: ${seasonal.engagementHook || 'Ask a question that makes homeowners think.'}

TOP CUSTOMER PAIN POINTS:
${painPoints.map((p, i) => `  ${i + 1}. ${p}`).join('\n')}

PROVEN HIGH-ENGAGEMENT ANGLES (adapt, don't copy verbatim):
${anglesBlock}

HOOK FORMULAS THAT STOP THE SCROLL:
${hookFormulas.map(h => `  • ${h}`).join('\n')}

TRADE TERMS TO USE NATURALLY:
${tradeTerms.join(', ')}

${faqBlock ? `REAL FAQs CUSTOMERS ASK:\n${faqBlock}` : ''}

═══ WHAT MAKES A "WOW" IDEA ═══

✓ SPECIFIC — real number, dollar amount, timeframe (not "save money" but "save $300 before June")
✓ SURPRISING — challenges a belief, reveals something hidden, shows an unexpected consequence
✓ IMMEDIATELY ACTIONABLE — the homeowner can do or feel something right now
✓ LOCAL — naturally references [CITY] or "local homeowners in [CITY]"
✓ EMOTIONAL — connects to a real fear, frustration, or aspiration

✗ No "Did you know..." or "Tip of the day..."
✗ No vague benefits like "stay safe" or "save money"
✗ No corporate language

CONTENT MIX:
- 3 ideas: category = "educational" (teach something surprising or counterintuitive)
- 1 idea: category = "seasonal" (tied to this month's urgency above)
- 1 idea: category = "social_proof" (real job story, before/after — specific outcome)
- 1 idea: category = "promotional" (offer with a reason to act NOW)

RESPONSE FORMAT: Raw JSON array of exactly 6 objects, no markdown, no explanation.

Each object:
{
  "id": "<UUID v4>",
  "title": "<punchy 4-8 word title — no generic titles, mention [CITY] where natural>",
  "category": "<educational|seasonal|social_proof|promotional>",
  "urgency": "<high|medium|low>",
  "why_now": "<1 sharp sentence — why this idea is gold right now>",
  "hook": "<single most important line — specific, surprising, or emotionally charged — use [CITY] naturally>",
  "caption_preview": "<first 130 chars of ideal caption — pull them in, no warm-up, use [CITY] and [BUSINESS] where natural>",
  "content_type": "<educational_tip|seasonal|customer_testimonial|promotional|before_after|community|faq|team_spotlight>",
  "platform": "<facebook|instagram|both|google>",
  "hashtags": ["<4-5 hashtags without # — mix [city] slug + niche + broad>"],
  "used": false
}`;

  let response;
  try {
    response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Generate 6 post ideas for a ${industryLabel} business serving [CITY] for ${today}. Use [CITY] and [BUSINESS] as placeholders. Return only the JSON array.` }],
    });
  } catch (claudeErr) {
    console.error('[Ideas/shared] Claude API error — using fallback:', claudeErr.message);
    return generateFallbackIdeas(industry);
  }

  const raw = response.content[0].text;
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    const ideas = JSON.parse(cleaned);
    return ideas.map(idea => ({
      ...idea,
      id: idea.id || crypto.randomUUID(),
      wizardTheme: CONTENT_TYPE_TO_THEME[idea.content_type] || 'share_tip',
    }));
  } catch {
    console.error('[Ideas/shared] Claude returned invalid JSON — using fallback');
    return generateFallbackIdeas(industry);
  }
}

// Look up today's shared ideas for an industry; generate + cache if not found
async function getOrCreateSharedIdeas(industry, pool) {
  const existing = await pool.query(
    `SELECT ideas FROM shared_industry_ideas WHERE industry = $1 AND generated_date = CURRENT_DATE`,
    [industry]
  );
  if (existing.rows.length > 0) {
    console.log(`[Ideas] Serving shared cache for industry=${industry}`);
    return existing.rows[0].ideas;
  }
  console.log(`[Ideas] Generating shared ideas for industry=${industry}`);
  const ideas = await generateSharedIdeas(industry);
  await pool.query(
    `INSERT INTO shared_industry_ideas (industry, ideas, generated_date)
     VALUES ($1, $2, CURRENT_DATE)
     ON CONFLICT (industry, generated_date) DO UPDATE SET ideas = EXCLUDED.ideas`,
    [industry, JSON.stringify(ideas)]
  );
  return ideas;
}

// Exported for server.js daily cron — pre-warms shared industry cache then personalises per customer
async function generateForAll(pool) {
  const { rows: industryRows } = await pool.query(
    `SELECT DISTINCT industry FROM customers
     WHERE (suspended = false OR suspended IS NULL)
       AND plan != 'trial'
       AND parent_customer_id IS NULL
       AND industry IS NOT NULL`
  );

  for (const { industry } of industryRows) {
    try { await getOrCreateSharedIdeas(industry, pool); }
    catch (e) { console.error(`[Ideas/cron] Shared generation failed for ${industry}:`, e.message); }
  }

  const { rows: customers } = await pool.query(
    `SELECT c.id, c.business_name, c.industry, c.location, c.tone
     FROM customers c
     WHERE (c.suspended = false OR c.suspended IS NULL)
       AND c.plan != 'trial'
       AND c.parent_customer_id IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM post_ideas pi
         WHERE pi.customer_id = c.id AND pi.generated_date = CURRENT_DATE
       )
     LIMIT 500`
  );

  let generated = 0;
  for (const customer of customers) {
    try {
      const shared = await getOrCreateSharedIdeas(customer.industry || 'general_contractor', pool);
      const ideas = personalise(shared, customer);
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
  console.log(`[Ideas/cron] Personalised for ${generated}/${customers.length} customers across ${industryRows.length} industries`);
  return { generated, total: customers.length };
}

module.exports = (pool) => {
  const router = express.Router();

  // GET /api/ideas/today — 3-layer lookup: customer cache → industry shared cache → Claude (once per industry/day)
  router.get('/today', authenticate, async (req, res) => {
    try {
      // Layer 1 — customer already has personalised ideas for today (or refreshed)
      const existing = await pool.query(
        `SELECT ideas, refreshed_at FROM post_ideas
         WHERE customer_id = $1 AND generated_date = CURRENT_DATE`,
        [req.customerId]
      );
      if (existing.rows.length > 0) {
        return res.json({ ideas: existing.rows[0].ideas, refreshed_at: existing.rows[0].refreshed_at, cached: true });
      }

      // Need customer profile to personalise
      const customerRes = await pool.query(
        `SELECT business_name, industry, location, tone FROM customers WHERE id = $1`,
        [req.customerId]
      );
      if (!customerRes.rows.length) return res.status(404).json({ error: 'Customer not found' });
      const customer = customerRes.rows[0];
      const industry = customer.industry || 'general_contractor';

      // Layer 2+3 — get or generate shared industry ideas (1 Claude call per industry per day)
      const sharedTemplate = await getOrCreateSharedIdeas(industry, pool);

      // Personalise: replace [CITY] / [BUSINESS] with this customer's values
      const ideas = personalise(sharedTemplate, customer);

      // Save to customer's own post_ideas so used-state + refresh-state are tracked per-customer
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

  // POST /api/ideas/refresh — force regenerate (1 credit, max 1×/hour)
  router.post('/refresh', authenticate, async (req, res) => {
    const billingId = getBillingCustomerId(req);
    const CREDIT_COST = 1;

    try {
    // ── Rate-limit check (fast, no transaction) ──────────────────────────
    const existing = await pool.query(
      `SELECT refreshed_at FROM post_ideas WHERE customer_id = $1 AND generated_date = CURRENT_DATE`,
      [req.customerId]
    );
    if (existing.rows.length > 0 && existing.rows[0].refreshed_at) {
      const diffMin = Math.floor((Date.now() - new Date(existing.rows[0].refreshed_at)) / 60000);
      if (diffMin < 60) {
        const waitMin = 60 - diffMin;
        return res.status(429).json({
          error: `You can refresh once per hour. Try again in ${waitMin} minute${waitMin !== 1 ? 's' : ''}.`,
          nextRefreshIn: waitMin,
        });
      }
    }

    // ── Atomic credit deduction (SELECT FOR UPDATE prevents race conditions) ─
    const client = await pool.connect();
    let newBalance;
    try {
      await client.query('BEGIN');

      const { rows: [billing] } = await client.query(
        `SELECT credits_balance, plan, status FROM customers WHERE id = $1 FOR UPDATE`,
        [billingId]
      );

      if (!billing) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Billing account not found' });
      }
      if (billing.status === 'suspended') {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Account suspended' });
      }
      if (billing.credits_balance < CREDIT_COST) {
        await client.query('ROLLBACK');
        return res.status(402).json({ error: 'Not enough credits. Top up to refresh ideas.', creditsRequired: CREDIT_COST, creditsBalance: billing.credits_balance });
      }

      const { rows: [updated] } = await client.query(
        `UPDATE customers SET credits_balance = credits_balance - $1 WHERE id = $2 RETURNING credits_balance`,
        [CREDIT_COST, billingId]
      );
      newBalance = updated.credits_balance;

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      console.error('[Ideas/refresh] Credit transaction failed:', txErr.message);
      return res.status(500).json({ error: 'Failed to process credit deduction. Please try again.' });
    } finally {
      client.release();
    }

    // ── Generate fresh ideas with customer's specific location/name ──────
    try {
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

      // Audit trail
      try {
        await pool.query(
          `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
           VALUES ($1, 'debit', $2, $3, 'Refreshed Post Ideas')`,
          [billingId, -CREDIT_COST, newBalance]
        );
      } catch (auditErr) {
        console.warn('[Ideas/refresh] credit_transactions insert failed:', auditErr.message);
      }

      return res.json({ ideas, refreshed_at: now, creditsRemaining: newBalance });
    } catch (err) {
      // Generation failed — refund the credit
      console.error('[Ideas/refresh] Generation failed — refunding credit:', err.message);
      try {
        const { rows: [refunded] } = await pool.query(
          `UPDATE customers SET credits_balance = credits_balance + $1 WHERE id = $2 RETURNING credits_balance`,
          [CREDIT_COST, billingId]
        );
        await pool.query(
          `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
           VALUES ($1, 'refund', $2, $3, 'Post Ideas refresh failed — credit refunded')`,
          [billingId, CREDIT_COST, refunded?.credits_balance ?? newBalance + CREDIT_COST]
        );
      } catch (refundErr) {
        console.error('[Ideas/refresh] Refund failed:', refundErr.message);
      }
      return res.status(500).json({ error: 'Failed to refresh ideas. Your credit has been refunded.' });
    }
    } catch (outerErr) {
      console.error('[Ideas/refresh] Unexpected error:', outerErr.message);
      return res.status(500).json({ error: 'Failed to refresh ideas. Please try again.' });
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

  // POST /api/ideas/generate-daily — cron: pre-warm shared industry cache, then fan out to customers
  router.post('/generate-daily', async (req, res) => {
    const secret = req.headers['x-cron-secret'] || '';
    const expected = process.env.CRON_SECRET || '';
    if (!expected || secret.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(expected))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      // Step 1 — find all active industries (1 Claude call each, deduped)
      const { rows: industryRows } = await pool.query(
        `SELECT DISTINCT industry FROM customers
         WHERE (suspended = false OR suspended IS NULL)
           AND plan != 'trial'
           AND parent_customer_id IS NULL
           AND industry IS NOT NULL`
      );

      let industriesGenerated = 0;
      for (const { industry } of industryRows) {
        try {
          await getOrCreateSharedIdeas(industry, pool);
          industriesGenerated++;
        } catch (e) {
          console.error(`[Ideas/cron] Failed to generate shared ideas for ${industry}:`, e.message);
        }
      }

      // Step 2 — fan out: personalise + save to each customer who doesn't have ideas yet today
      const { rows: customers } = await pool.query(
        `SELECT c.id, c.business_name, c.industry, c.location, c.tone
         FROM customers c
         WHERE (c.suspended = false OR c.suspended IS NULL)
           AND c.plan != 'trial'
           AND c.parent_customer_id IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM post_ideas pi
             WHERE pi.customer_id = c.id AND pi.generated_date = CURRENT_DATE
           )
         LIMIT 500`
      );

      let personalisedCount = 0;
      for (const customer of customers) {
        try {
          const industry = customer.industry || 'general_contractor';
          const shared = await getOrCreateSharedIdeas(industry, pool); // hits cache now
          const ideas = personalise(shared, customer);
          await pool.query(
            `INSERT INTO post_ideas (customer_id, ideas, generated_date)
             VALUES ($1, $2, CURRENT_DATE)
             ON CONFLICT (customer_id, generated_date) DO NOTHING`,
            [customer.id, JSON.stringify(ideas)]
          );
          personalisedCount++;
        } catch (e) {
          console.error(`[Ideas/cron] Failed to personalise for customer ${customer.id}:`, e.message);
        }
      }

      console.log(`[Ideas/cron] Generated shared ideas for ${industriesGenerated} industries, personalised for ${personalisedCount} customers`);
      res.json({ industries: industriesGenerated, customers: personalisedCount });
    } catch (err) {
      console.error('[Ideas/cron]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};

module.exports.generateForAll = generateForAll;
