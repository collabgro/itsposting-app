/**
 * ItsPosting — Content Calendar Plans Routes
 * backend/routes/calendarPlans.js
 *
 * Mounted at /api/calendar-plans in server.js
 *
 * GET    /api/calendar-plans              ?start=&end=  — get plans for date range
 * POST   /api/calendar-plans              — create plan entry
 * PATCH  /api/calendar-plans/:id          — update plan
 * DELETE /api/calendar-plans/:id          — delete plan
 * POST   /api/calendar-plans/ai-generate  — PostCore generates rich plan content (no DB save)
 * POST   /api/calendar-plans/bulk-save    — save approved plans + deduct 1 credit each
 * POST   /api/calendar-plans/ai-fill      — legacy / simple fill (kept for backwards compat)
 * POST   /api/calendar-plans/:id/generate — marks plan as 'briefed' + returns wizard context
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate, getBillingCustomerId } = require('../middleware/auth');
const industryKnowledge = require('../data/industryKnowledge');

// 10 AI-generate calls per hour per IP — prevents Claude cost abuse
const aiFillLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI calendar fill limit reached — please wait an hour before generating again.' },
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_TYPES     = ['photo_post', 'carousel', 'video', 'text_card', 'story'];
const VALID_PLATFORMS = ['facebook', 'instagram', 'google_business', 'linkedin', 'tiktok'];
const VALID_COLORS    = ['purple', 'blue', 'green', 'orange', 'red', 'pink'];
const MONTH_NAMES     = ['January','February','March','April','May','June','July','August','September','October','November','December'];

module.exports = function calendarPlansRoutes(pool) {
  const router = express.Router();

  // ──────────────────────────────────────────────
  // GET /api/calendar-plans  — list plans by range
  // ──────────────────────────────────────────────
  router.get('/', authenticate, async (req, res) => {
    try {
      const { start, end } = req.query;

      if (!start || !end) {
        return res.status(400).json({ error: 'start and end date params are required (YYYY-MM-DD)' });
      }

      const result = await pool.query(
        `SELECT cp.*,
          p.status AS post_status,
          p.scheduled_date,
          p.media_url
         FROM content_calendar_plans cp
         LEFT JOIN posts p ON p.id = cp.post_id
         WHERE cp.customer_id = $1
           AND cp.plan_date BETWEEN $2 AND $3
         ORDER BY cp.plan_date ASC, cp.created_at ASC`,
        [req.customerId, start, end]
      );

      res.json({ plans: result.rows });
    } catch (err) {
      console.error('[CalendarPlans] GET error:', err);
      res.status(500).json({ error: 'Failed to load calendar plans' });
    }
  });

  // ──────────────────────────────────────────────
  // POST /api/calendar-plans  — create a plan entry
  // ──────────────────────────────────────────────
  router.post('/', authenticate, async (req, res) => {
    try {
      const { plan_date, title, content_type, platforms, notes, color, ai_suggested } = req.body;

      if (!plan_date) return res.status(400).json({ error: 'plan_date is required' });

      const result = await pool.query(
        `INSERT INTO content_calendar_plans
          (customer_id, plan_date, title, content_type, platforms, notes, color, ai_suggested)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          req.customerId,
          plan_date,
          (title || '').substring(0, 200),
          content_type || 'photo_post',
          platforms || [],
          (notes || '').substring(0, 5000),
          color || 'purple',
          ai_suggested || false,
        ]
      );

      res.status(201).json({ plan: result.rows[0] });
    } catch (err) {
      console.error('[CalendarPlans] POST error:', err);
      res.status(500).json({ error: 'Failed to create plan' });
    }
  });

  // ──────────────────────────────────────────────
  // PATCH /api/calendar-plans/:id  — update a plan
  // ──────────────────────────────────────────────
  router.patch('/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { plan_date, title, content_type, platforms, notes, color, status, post_id } = req.body;

      const existing = await pool.query(
        'SELECT id FROM content_calendar_plans WHERE id = $1 AND customer_id = $2',
        [id, req.customerId]
      );
      if (!existing.rows.length) return res.status(404).json({ error: 'Plan not found' });

      const updates = [];
      const params = [];
      let idx = 1;

      const addField = (col, val) => { updates.push(`${col} = $${idx++}`); params.push(val); };

      if (plan_date !== undefined) addField('plan_date', plan_date);
      if (title !== undefined) addField('title', title.substring(0, 200));
      if (content_type !== undefined) addField('content_type', content_type);
      if (platforms !== undefined) addField('platforms', platforms);
      if (notes !== undefined) addField('notes', notes.substring(0, 5000));
      if (color !== undefined) addField('color', color);
      if (status !== undefined) addField('status', status);
      if (post_id !== undefined) addField('post_id', post_id);

      if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

      addField('updated_at', new Date());
      params.push(id);

      const result = await pool.query(
        `UPDATE content_calendar_plans SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
      );

      res.json({ plan: result.rows[0] });
    } catch (err) {
      console.error('[CalendarPlans] PATCH error:', err);
      res.status(500).json({ error: 'Failed to update plan' });
    }
  });

  // ──────────────────────────────────────────────
  // DELETE /api/calendar-plans/:id
  // ──────────────────────────────────────────────
  router.delete('/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        'DELETE FROM content_calendar_plans WHERE id = $1 AND customer_id = $2 RETURNING id',
        [id, req.customerId]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Plan not found' });
      res.json({ deleted: true });
    } catch (err) {
      console.error('[CalendarPlans] DELETE error:', err);
      res.status(500).json({ error: 'Failed to delete plan' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/calendar-plans/ai-generate
  //
  // PostCore generates a full set of rich post plans for a date range.
  // Does NOT save to DB and does NOT deduct credits — that happens in bulk-save.
  // Rate-limited: 10 generates/hour/IP.
  //
  // Body: { start, end, mix: { photo_post, text_card, carousel, video },
  //         platforms: [...] }
  // Returns: { plans: [...], totalPosts }
  // ──────────────────────────────────────────────────────────────────────────
  router.post('/ai-generate', aiFillLimiter, authenticate, async (req, res) => {
    try {
      const {
        start,
        end,
        mix = { photo_post: 2, text_card: 2, carousel: 1, video: 0 },
        platforms = ['facebook', 'instagram'],
      } = req.body;

      if (!start || !end) return res.status(400).json({ error: 'start and end are required (YYYY-MM-DD)' });

      const { rows: [customer] } = await pool.query(
        `SELECT id, business_name, industry, location, tone
         FROM customers WHERE id = $1`,
        [req.customerId]
      );
      if (!customer) return res.status(404).json({ error: 'Customer not found' });

      // ── Resolve post assignments ─────────────────────────────────────────
      const rangeStart = new Date(start + 'T00:00:00');
      const rangeEnd   = new Date(end   + 'T00:00:00');
      const daysDiff   = Math.round((rangeEnd - rangeStart) / 86400000) + 1;

      // Build flat list of types from mix counts
      const postTypes = [];
      const validMixKeys = ['photo_post', 'text_card', 'carousel', 'video'];
      validMixKeys.forEach(k => {
        const count = Math.max(0, Math.min(10, parseInt(mix[k]) || 0));
        for (let i = 0; i < count; i++) postTypes.push(k);
      });

      if (postTypes.length === 0) {
        return res.status(400).json({ error: 'Please add at least one post to generate' });
      }
      const totalPosts = Math.min(postTypes.length, 28);

      // Shuffle types for variety
      for (let i = postTypes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [postTypes[i], postTypes[j]] = [postTypes[j], postTypes[i]];
      }

      // Spread posts across date range
      const allDates = [];
      const cur = new Date(rangeStart);
      while (cur <= rangeEnd) {
        allDates.push(cur.toISOString().split('T')[0]);
        cur.setDate(cur.getDate() + 1);
      }

      // Distribute evenly; prefer Mon/Wed/Fri where possible
      const postDates = [];
      if (totalPosts >= allDates.length) {
        // More posts than days — use all days
        for (let i = 0; i < totalPosts && i < allDates.length; i++) postDates.push(allDates[i]);
      } else {
        const step = allDates.length / totalPosts;
        for (let i = 0; i < totalPosts; i++) {
          postDates.push(allDates[Math.min(Math.floor(i * step), allDates.length - 1)]);
        }
      }
      postDates.sort();

      const postAssignments = postDates.slice(0, totalPosts).map((date, i) => ({
        date,
        type: postTypes[i] || 'photo_post',
      }));

      // ── Industry knowledge ───────────────────────────────────────────────
      const knowledge = industryKnowledge[customer.industry] || industryKnowledge.general_contractor || {};
      const month     = rangeStart.getMonth() + 1;
      const seasonal  = knowledge.seasonalContent?.[month] || {};

      const topAngles = (knowledge.contentAngles || [])
        .sort((a, b) => {
          const ord = { very_high: 0, high: 1, medium: 2, low: 3 };
          return (ord[a.engagementLevel] || 2) - (ord[b.engagementLevel] || 2);
        })
        .slice(0, 5);

      const hookFormulas  = (knowledge.hookFormulas  || []).slice(0, 6);
      const painPoints    = (knowledge.customerPainPoints || []).slice(0, 6);
      const faqPairs      = (knowledge.faqPairs      || []).slice(0, 3);
      const trustSignals  = (knowledge.trustSignals  || []).slice(0, 3);

      // ── Platform writing rules ───────────────────────────────────────────
      const hasFB = platforms.includes('facebook');
      const hasIG = platforms.includes('instagram');
      const hasGB = platforms.includes('google_business');

      const platformRules = [
        hasFB && 'Facebook: 150-250 words, conversational, 2-3 hashtags max, end with question.',
        hasIG && 'Instagram: 80-130 words, visual-first language, 10-15 hashtags, 3-5 emojis.',
        hasGB && 'Google Business: 100-200 words, keyword-rich location references, hard CTA (call today), no hashtags.',
      ].filter(Boolean).join(' | ');

      // ── Build Claude prompt ──────────────────────────────────────────────
      const prompt = `You are PostCore, ItsPosting's AI social media advisor for local service businesses.

BUSINESS PROFILE:
- Name: ${customer.business_name}
- Industry: ${customer.industry}
- Location: ${customer.location || 'local area'}
- Brand tone: ${customer.tone || 'professional and friendly'}

SEASONAL INTELLIGENCE (${MONTH_NAMES[month - 1]}):
- Urgency topic: ${seasonal.urgencyTopic || 'general service'}
- Tip of the month: ${seasonal.tipTopic || 'maintenance tips'}
- Emotional context: ${seasonal.emotionalContext || 'homeowners want reliability and peace of mind'}
- Proven post idea: ${seasonal.postIdea || 'share a helpful seasonal tip'}
- Best engagement hook: ${seasonal.engagementHook || 'ask a local seasonal question'}

HIGH-ENGAGEMENT CONTENT ANGLES for ${customer.industry}:
${topAngles.map(a => `• ${a.angle}: ${a.why} [${a.engagementLevel} engagement]`).join('\n')}

PROVEN SCROLL-STOPPING HOOKS (adapt naturally — don't copy verbatim):
${hookFormulas.map((h, i) => `${i + 1}. "${h}"`).join('\n')}

REAL CUSTOMER PAIN POINTS to address:
${painPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

TRUST SIGNALS to weave in:
${trustSignals.map(s => `• ${s}`).join('\n')}

FAQ ANGLES:
${faqPairs.map(f => `Q: ${f.question}`).join('\n')}

PLATFORM WRITING RULES: ${platformRules || 'Facebook + Instagram standard rules apply.'}

THE 70/20/10 RULE (enforce across the full set):
- 70% educational / value-giving (tips, how-to, myth-busting, FAQs)
- 20% social proof (before/after jobs, customer results, testimonials)
- 10% promotional (special offers, seasonal deals, urgency)

POSTS TO GENERATE:
${postAssignments.map((p, i) => `${i + 1}. ${p.date} — ${p.type}`).join('\n')}

CONTENT TYPE GUIDANCE:
• photo_post: Hook → transformation story or visual result → local reference → engagement question
• text_card: Bold hook → 3 punchy tips OR mini-story → soft CTA → engagement question
• carousel: "X reasons..." or "Before → Process → After" multi-slide concept → CTA on last slide
• video: Process reveal or quick tip demo → strong visual opener → what to look for

QUALITY RULES — every post MUST:
1. Open with one adapted hook formula (the first sentence must stop the scroll)
2. Mention ${customer.location || 'the local area'} naturally (not forced)
3. Address at least one real customer pain point
4. End with a compelling engagement question that makes homeowners want to comment
5. Sound like it was written by a real business owner, NOT generic AI copy
6. Have platform-appropriate length (see platform rules above)

WOW TEST: Before finalising each post, ask: "Would a homeowner in ${customer.location || 'this area'} share this?" If no, rewrite.

Respond ONLY with a valid JSON array of exactly ${totalPosts} objects. No markdown, no extra text:
[
  {
    "plan_date": "YYYY-MM-DD",
    "content_type": "photo_post|text_card|carousel|video",
    "platforms": ${JSON.stringify(platforms.filter(p => VALID_PLATFORMS.includes(p)))},
    "title": "Short content idea title — max 80 chars",
    "caption": "Full platform-optimised caption including hook, content, local reference, and engagement question at the end",
    "hashtags": ["tag1", "tag2"],
    "engagement_question": "The specific question that ends the caption",
    "content_angle": "educational|social_proof|promotional",
    "hook": "The exact first sentence (scroll-stopper)"
  }
]`;

      const aiResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 6000,
        messages: [{ role: 'user', content: prompt }],
      });

      let rawPlans = [];
      try {
        const raw = aiResponse.content[0].text.replace(/```json|```/g, '').trim();
        rawPlans = JSON.parse(raw);
        if (!Array.isArray(rawPlans)) throw new Error('Not an array');
      } catch (parseErr) {
        console.error('[CalendarPlans] ai-generate parse error:', parseErr);
        console.error('[CalendarPlans] Raw AI response:', aiResponse.content[0].text.substring(0, 500));
        return res.status(500).json({ error: 'PostCore had trouble formatting the plan. Please try again.' });
      }

      // Validate + clean each plan
      const validAngles = ['educational', 'social_proof', 'promotional'];
      const cleaned = rawPlans.slice(0, totalPosts).map(p => ({
        plan_date:          typeof p.plan_date === 'string' ? p.plan_date : start,
        content_type:       VALID_TYPES.includes(p.content_type) ? p.content_type : 'photo_post',
        platforms:          Array.isArray(p.platforms) ? p.platforms.filter(x => VALID_PLATFORMS.includes(x)) : platforms,
        title:              (p.title || 'Content idea').substring(0, 200),
        caption:            (p.caption || '').substring(0, 3000),
        hashtags:           Array.isArray(p.hashtags) ? p.hashtags.slice(0, 20) : [],
        engagement_question:(p.engagement_question || '').substring(0, 300),
        content_angle:      validAngles.includes(p.content_angle) ? p.content_angle : 'educational',
        hook:               (p.hook || '').substring(0, 300),
      }));

      return res.json({ plans: cleaned, totalPosts: cleaned.length });
    } catch (err) {
      console.error('[CalendarPlans] ai-generate error:', err);
      return res.status(500).json({ error: 'Failed to generate plan. Please try again.' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/calendar-plans/bulk-save
  //
  // Saves the plans the customer approved in the review modal.
  // Deducts 1 credit per post saved (atomic SELECT FOR UPDATE transaction).
  //
  // Body: { plans: [{ plan_date, content_type, platforms, title, caption,
  //                   hashtags, engagement_question, content_angle, hook }] }
  // Returns: { plans: savedRows, creditsCost, creditsRemaining }
  // ──────────────────────────────────────────────────────────────────────────
  router.post('/bulk-save', authenticate, async (req, res) => {
    const { plans } = req.body;
    if (!Array.isArray(plans) || plans.length === 0) {
      return res.status(400).json({ error: 'plans array is required and must not be empty' });
    }

    const plansToSave = plans.slice(0, 28);
    const creditCost  = plansToSave.length; // 1 credit per post
    const billingId   = getBillingCustomerId(req);

    // ── Atomic credit deduction ──────────────────────────────────────────
    const client = await pool.connect();
    let newBalance;
    try {
      await client.query('BEGIN');

      const { rows: [billing] } = await client.query(
        'SELECT credits_balance, status FROM customers WHERE id = $1 FOR UPDATE',
        [billingId]
      );
      if (!billing) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Billing account not found' });
      }
      if (billing.status === 'suspended') {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Account is suspended. Contact support.' });
      }
      if (billing.credits_balance < creditCost) {
        await client.query('ROLLBACK');
        return res.status(402).json({
          error: `Not enough credits. You need ${creditCost} credits to save ${plansToSave.length} posts.`,
          creditsRequired: creditCost,
          creditsBalance: billing.credits_balance,
        });
      }

      const { rows: [updated] } = await client.query(
        'UPDATE customers SET credits_balance = credits_balance - $1 WHERE id = $2 RETURNING credits_balance',
        [creditCost, billingId]
      );
      newBalance = updated.credits_balance;
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      console.error('[CalendarPlans] bulk-save transaction error:', txErr);
      return res.status(500).json({ error: 'Failed to process credits. Please try again.' });
    } finally {
      client.release();
    }

    // ── Insert plans to DB ───────────────────────────────────────────────
    const savedPlans = [];
    try {
      for (const plan of plansToSave) {
        // Store rich AI content as JSON in notes field
        const notesJson = JSON.stringify({
          caption:            (plan.caption || '').substring(0, 2800),
          hashtags:           Array.isArray(plan.hashtags) ? plan.hashtags.slice(0, 20) : [],
          engagement_question:(plan.engagement_question || '').substring(0, 300),
          content_angle:      plan.content_angle || 'educational',
          hook:               (plan.hook || '').substring(0, 300),
        });

        const { rows: [saved] } = await pool.query(
          `INSERT INTO content_calendar_plans
            (customer_id, plan_date, title, content_type, platforms, notes, ai_suggested, status, color)
           VALUES ($1, $2, $3, $4, $5, $6, true, 'planned', $7)
           RETURNING *`,
          [
            req.customerId,
            plan.plan_date,
            (plan.title || 'Content idea').substring(0, 200),
            VALID_TYPES.includes(plan.content_type) ? plan.content_type : 'photo_post',
            Array.isArray(plan.platforms) ? plan.platforms.filter(x => VALID_PLATFORMS.includes(x)) : ['facebook','instagram'],
            notesJson,
            plan.content_angle === 'promotional' ? 'orange' : plan.content_type === 'video' ? 'red' : plan.content_type === 'carousel' ? 'purple' : plan.content_angle === 'social_proof' ? 'green' : 'blue',
          ]
        );
        savedPlans.push(saved);
      }

      // Audit trail
      await pool.query(
        `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
         VALUES ($1, 'debit', $2, $3, $4)`,
        [billingId, -creditCost, newBalance, `AI Calendar Fill — ${creditCost} post${creditCost !== 1 ? 's' : ''} planned`]
      );

      return res.json({
        plans:            savedPlans,
        creditsCost:      creditCost,
        creditsRemaining: newBalance,
      });
    } catch (saveErr) {
      console.error('[CalendarPlans] bulk-save insert error:', saveErr);
      // Refund credits
      try {
        await pool.query(
          'UPDATE customers SET credits_balance = credits_balance + $1 WHERE id = $2',
          [creditCost, billingId]
        );
        await pool.query(
          `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
           VALUES ($1, 'refund', $2, $3, $4)`,
          [billingId, creditCost, newBalance + creditCost, 'Refund: calendar plan save failed']
        );
      } catch (refundErr) {
        console.error('[CalendarPlans] refund error:', refundErr);
      }
      return res.status(500).json({ error: 'Failed to save plans. Your credits have been refunded.' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/calendar-plans/ai-fill  — legacy simple fill (kept for compat)
  // Accepts: { start, end, postsPerWeek } and returns suggestions (not saved)
  // ──────────────────────────────────────────────────────────────────────────
  router.post('/ai-fill', aiFillLimiter, authenticate, async (req, res) => {
    try {
      const { month, year, startDate, endDate, postsPerWeek = 3 } = req.body;

      const customerResult = await pool.query(
        'SELECT business_name, industry, location, tone FROM customers WHERE id = $1',
        [req.customerId]
      );
      if (!customerResult.rows.length) return res.status(404).json({ error: 'Customer not found' });

      const customer = customerResult.rows[0];

      let rangeStart, rangeEnd;
      if (startDate && endDate) {
        rangeStart = new Date(startDate + 'T00:00:00');
        rangeEnd   = new Date(endDate   + 'T00:00:00');
      } else {
        const targetMonth = parseInt(month) || new Date().getMonth() + 1;
        const targetYear  = parseInt(year)  || new Date().getFullYear();
        rangeStart = new Date(targetYear, targetMonth - 1, 1);
        rangeEnd   = new Date(targetYear, targetMonth,     0);
      }

      const daysDiff     = Math.round((rangeEnd - rangeStart) / (1000 * 60 * 60 * 24)) + 1;
      const weeksInRange = Math.max(1, Math.ceil(daysDiff / 7));
      const totalPosts   = Math.min(weeksInRange * parseInt(postsPerWeek), 28);

      const startMonth = rangeStart.getMonth() + 1;
      const knowledge  = industryKnowledge[customer.industry] || industryKnowledge.general_contractor;
      const seasonal   = knowledge.seasonalContent?.[startMonth] || {};
      const startStr   = rangeStart.toISOString().split('T')[0];
      const endStr     = rangeEnd.toISOString().split('T')[0];

      const prompt = `You are PostCore, ItsPosting's AI advisor for local service businesses.

Customer: ${customer.business_name} | Industry: ${customer.industry} | Location: ${customer.location || ''}
Planning: ${startStr} to ${endStr} | Seasonal focus: ${seasonal.urgencyTopic || 'general service'}

Generate a content calendar plan. Total posts: ${totalPosts} (~${postsPerWeek}/week).
Mix: 70% educational, 20% social proof, 10% promotional.

Respond ONLY with a valid JSON array of exactly ${totalPosts} objects:
[{
  "plan_date": "YYYY-MM-DD",
  "title": "Short idea title (max 80 chars)",
  "content_type": "photo_post|carousel|text_card|video",
  "platforms": ["facebook","instagram"],
  "notes": "2-3 sentence content brief — what to show, say, and why",
  "color": "purple|blue|green|orange|red|pink"
}]

Spread across ${startStr} to ${endStr}. Mon/Wed/Fri pattern preferred.`;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      });

      let suggestions = [];
      try {
        const raw = response.content[0].text.replace(/```json|```/g, '').trim();
        suggestions = JSON.parse(raw);
        if (!Array.isArray(suggestions)) throw new Error('Not array');
      } catch (parseErr) {
        console.error('[CalendarPlans] ai-fill parse error:', parseErr);
        return res.status(500).json({ error: 'Failed to parse AI suggestions. Please try again.' });
      }

      const cleaned = suggestions.slice(0, 28).map(s => ({
        plan_date:    s.plan_date,
        title:        (s.title || 'Content idea').substring(0, 200),
        content_type: VALID_TYPES.includes(s.content_type) ? s.content_type : 'photo_post',
        platforms:    Array.isArray(s.platforms) ? s.platforms.filter(p => VALID_PLATFORMS.includes(p)) : ['facebook','instagram'],
        notes:        (s.notes || '').substring(0, 2000),
        color:        VALID_COLORS.includes(s.color) ? s.color : 'purple',
        ai_suggested: true,
      }));

      res.json({ suggestions: cleaned, totalPosts, dateRange: { start: startStr, end: endStr } });
    } catch (err) {
      console.error('[CalendarPlans] ai-fill error:', err);
      res.status(500).json({ error: 'Failed to generate suggestions' });
    }
  });

  // ──────────────────────────────────────────────
  // POST /api/calendar-plans/:id/generate
  // Returns wizard pre-fill context from this plan
  // ──────────────────────────────────────────────
  router.post('/:id/generate', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        'SELECT * FROM content_calendar_plans WHERE id = $1 AND customer_id = $2',
        [id, req.customerId]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Plan not found' });

      const plan = result.rows[0];

      await pool.query(
        "UPDATE content_calendar_plans SET status = 'briefed', updated_at = NOW() WHERE id = $1",
        [id]
      );

      // Parse notes JSON if present
      let notesData = {};
      try { notesData = JSON.parse(plan.notes || '{}'); } catch {}

      res.json({
        planId: plan.id,
        wizardContext: {
          contentType:   plan.content_type,
          platforms:     plan.platforms,
          notes:         notesData.caption || plan.notes || '',
          title:         plan.title,
          scheduledDate: plan.plan_date,
        },
      });
    } catch (err) {
      console.error('[CalendarPlans] generate error:', err);
      res.status(500).json({ error: 'Failed to prepare plan for generation' });
    }
  });

  return router;
};
