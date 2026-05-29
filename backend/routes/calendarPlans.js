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
 * POST   /api/calendar-plans/ai-fill      — PostCore suggests a month of content (free)
 * POST   /api/calendar-plans/:id/generate — marks plan as 'briefed' + returns wizard context
 */

const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate } = require('../middleware/auth');
const industryKnowledge = require('../data/industryKnowledge');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
          p.image_url
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
          (notes || '').substring(0, 2000),
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
      if (notes !== undefined) addField('notes', notes.substring(0, 2000));
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

  // ──────────────────────────────────────────────
  // POST /api/calendar-plans/ai-fill
  // PostCore suggests content for a date range (FREE — no credit deduction)
  // Accepts: { startDate, endDate, postsPerWeek }
  //   OR legacy: { month, year }
  // ──────────────────────────────────────────────
  router.post('/ai-fill', authenticate, async (req, res) => {
    try {
      const { month, year, startDate, endDate, postsPerWeek = 3 } = req.body;

      const customerResult = await pool.query(
        'SELECT business_name, industry, city, state, tone FROM customers WHERE id = $1',
        [req.customerId]
      );
      if (!customerResult.rows.length) return res.status(404).json({ error: 'Customer not found' });

      const customer = customerResult.rows[0];

      // Resolve date range
      let rangeStart, rangeEnd;
      if (startDate && endDate) {
        rangeStart = new Date(startDate + 'T00:00:00');
        rangeEnd = new Date(endDate + 'T00:00:00');
      } else {
        const targetMonth = parseInt(month) || new Date().getMonth() + 1;
        const targetYear = parseInt(year) || new Date().getFullYear();
        rangeStart = new Date(targetYear, targetMonth - 1, 1);
        rangeEnd = new Date(targetYear, targetMonth, 0);
      }

      // Calculate number of posts to generate based on range + frequency
      const daysDiff = Math.round((rangeEnd - rangeStart) / (1000 * 60 * 60 * 24)) + 1;
      const weeksInRange = Math.max(1, Math.ceil(daysDiff / 7));
      const totalPosts = Math.min(weeksInRange * parseInt(postsPerWeek), 28); // max 28 posts

      const startMonth = rangeStart.getMonth() + 1;
      const knowledge = industryKnowledge[customer.industry] || industryKnowledge.general_contractor;
      const seasonal = knowledge.seasonalContent?.[startMonth] || {};

      const monthNames = ['January','February','March','April','May','June',
                          'July','August','September','October','November','December'];

      const startStr = rangeStart.toISOString().split('T')[0];
      const endStr = rangeEnd.toISOString().split('T')[0];

      const prompt = `You are PostCore, ItsPosting's AI social media advisor for local service businesses.

Customer: ${customer.business_name}
Industry: ${customer.industry}
Location: ${customer.city || ''}, ${customer.state || ''}
Planning period: ${startStr} to ${endStr} (${daysDiff} days)
Seasonal focus: ${seasonal.urgencyTopic || 'general service promotion'}
Seasonal tip: ${seasonal.tipTopic || 'maintenance tips'}

Generate a content calendar plan for this business.
Total posts needed: ${totalPosts} (approximately ${postsPerWeek} per week).
Mix: 70% educational/value-giving, 20% social proof, 10% promotional.

Respond ONLY with a valid JSON array of exactly ${totalPosts} objects:
[
  {
    "plan_date": "YYYY-MM-DD",
    "title": "Short content idea title (max 80 chars)",
    "content_type": "photo_post|carousel|text_card|video",
    "platforms": ["facebook","instagram"],
    "notes": "2-3 sentences of context — what to show, what to say, why it works",
    "color": "purple|blue|green|orange|red|pink"
  }
]

Spread posts across ${startStr} to ${endStr}. Use a Mon/Wed/Fri pattern where possible.
Content type mix: mostly photo_post and text_card, 1-2 carousels, 1 video per 10 posts.
Color by category: educational=blue, social_proof=green, promotional=orange, video=red, carousel=purple, tips=pink.
All dates must be within the range ${startStr} to ${endStr}.`;

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
        console.error('[CalendarPlans] AI fill parse error:', parseErr);
        return res.status(500).json({ error: 'Failed to parse AI suggestions. Please try again.' });
      }

      const VALID_TYPES = ['photo_post', 'carousel', 'video', 'text_card', 'story'];
      const VALID_COLORS = ['purple', 'blue', 'green', 'orange', 'red', 'pink'];
      const VALID_PLATFORMS = ['facebook', 'instagram', 'google_business', 'linkedin', 'tiktok'];

      const cleaned = suggestions.slice(0, 28).map(s => ({
        plan_date: s.plan_date,
        title: (s.title || 'Content idea').substring(0, 200),
        content_type: VALID_TYPES.includes(s.content_type) ? s.content_type : 'photo_post',
        platforms: Array.isArray(s.platforms)
          ? s.platforms.filter(p => VALID_PLATFORMS.includes(p))
          : ['facebook', 'instagram'],
        notes: (s.notes || '').substring(0, 2000),
        color: VALID_COLORS.includes(s.color) ? s.color : 'purple',
        ai_suggested: true,
      }));

      res.json({ suggestions: cleaned, totalPosts, dateRange: { start: startStr, end: endStr } });
    } catch (err) {
      console.error('[CalendarPlans] AI fill error:', err);
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

      // Mark as briefed
      await pool.query(
        "UPDATE content_calendar_plans SET status = 'briefed', updated_at = NOW() WHERE id = $1",
        [id]
      );

      // Return the context needed to pre-fill the wizard
      res.json({
        planId: plan.id,
        wizardContext: {
          contentType: plan.content_type,
          platforms: plan.platforms,
          notes: plan.notes,
          title: plan.title,
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
