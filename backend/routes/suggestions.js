/**
 * ItsPosting — Content Suggestions Route
 * backend/routes/suggestions.js
 *
 * Proactive PostCore suggestions shown on the dashboard.
 * 4 suggestion types: seasonal / streak / gap / milestone
 *
 * Register in server.js:
 *   const suggestionsRoutes = require('./routes/suggestions');
 *   app.use('/api/suggestions', suggestionsRoutes(pool));
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const industryKnowledge = require('../data/industryKnowledge');

module.exports = (pool) => {
  const router = express.Router();

  // ── GET /api/suggestions ──────────────────────────────────────────────────
  // Returns active, non-expired, non-dismissed suggestions for the customer.
  // Called on every dashboard load.
  router.get('/', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT *
         FROM content_suggestions
         WHERE customer_id = $1
           AND is_dismissed = false
           AND is_used = false
           AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 5`,
        [req.customerId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error('[suggestions] GET /:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/suggestions/count ────────────────────────────────────────────
  // Quick count for the red dot badge on the Create nav item.
  // NOTE: must be registered BEFORE /:id routes to avoid route conflict.
  router.get('/count', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) AS unseen
         FROM content_suggestions
         WHERE customer_id = $1
           AND is_dismissed = false
           AND is_used = false
           AND expires_at > NOW()`,
        [req.customerId]
      );
      res.json({ unseen: parseInt(result.rows[0].unseen, 10) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/suggestions/generate ───────────────────────────────────────
  // Generate fresh suggestions for this customer based on:
  //   - their industry + current month → seasonal
  //   - posting streak / last_posted_at → streak/milestone
  //   - recent post content_type distribution → gap
  // Called by the 8am daily cron AND on first dashboard load if empty.
  router.post('/generate', authenticate, async (req, res) => {
    try {
      const customerResult = await pool.query(
        `SELECT id, business_name, industry, location, plan,
                posting_streak, last_posted_at, total_posts_this_month,
                content_preferences
         FROM customers
         WHERE id = $1`,
        [req.customerId]
      );

      if (customerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      const customer = customerResult.rows[0];
      const knowledge = industryKnowledge[customer.industry] || industryKnowledge.general_contractor;
      const currentMonth = new Date().getMonth() + 1; // 1–12
      const seasonal = knowledge.seasonalContent?.[currentMonth];

      const suggestions = [];

      // ── 1. SEASONAL SUGGESTION ─────────────────────────────────────────────
      if (seasonal) {
        const hook = knowledge.hookFormulas?.[0] || '';
        const caption = buildSeasonalCaption(customer, seasonal, hook);

        suggestions.push({
          customer_id: customer.id,
          suggestion_type: 'seasonal',
          title: `It's ${getMonthName(currentMonth)} — ${seasonal.urgencyTopic}`,
          reason: `I noticed it's ${getMonthName(currentMonth)}, which is peak season for "${seasonal.urgencyTopic}" in your industry. Posts like this get 3x more engagement this time of year for ${customer.industry} businesses.`,
          pre_generated_caption: caption,
          pre_generated_hashtags: (knowledge.localKeywords || [])
            .slice(0, 5)
            .map(k => k.replace('[city]', customer.location || 'your city').replace(/\s+/g, '')),
          platform: 'all',
          content_type: 'photo',
          industry_context: {
            month: currentMonth,
            seasonal_topic: seasonal.urgencyTopic,
            tip_topic: seasonal.tipTopic,
            promotion_angle: seasonal.promotionAngle,
            hook_used: hook,
          },
          expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        });
      }

      // ── 2. STREAK SUGGESTION ──────────────────────────────────────────────
      const daysSincePost = customer.last_posted_at
        ? Math.floor((Date.now() - new Date(customer.last_posted_at).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      if (daysSincePost !== null && daysSincePost >= 3) {
        suggestions.push({
          customer_id: customer.id,
          suggestion_type: 'streak',
          title: `You haven't posted in ${daysSincePost} day${daysSincePost !== 1 ? 's' : ''}`,
          reason: `I noticed ${daysSincePost} days have passed since your last post. Accounts that post consistently get up to 5x more engagement. Here's something quick you can publish right now — it'll take 10 seconds.`,
          pre_generated_caption: buildStreakCaption(customer, knowledge, seasonal),
          pre_generated_hashtags: (knowledge.localKeywords || []).slice(0, 4).map(k =>
            k.replace('[city]', customer.location || 'your city').replace(/\s+/g, '')
          ),
          platform: 'facebook',
          content_type: 'static',
          industry_context: { days_since_post: daysSincePost, streak: customer.posting_streak },
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
      } else if (customer.posting_streak >= 3) {
        suggestions.push({
          customer_id: customer.id,
          suggestion_type: 'streak',
          title: `🔥 ${customer.posting_streak}-day posting streak — keep it going!`,
          reason: `You're on a ${customer.posting_streak}-day streak! Consistency is what the algorithm rewards. Here's today's suggested post to maintain your momentum.`,
          pre_generated_caption: buildStreakCaption(customer, knowledge, seasonal),
          pre_generated_hashtags: [],
          platform: 'all',
          content_type: 'photo',
          industry_context: { streak: customer.posting_streak },
          expires_at: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
        });
      }

      // ── 3. CONTENT GAP SUGGESTION ─────────────────────────────────────────
      const recentPostsResult = await pool.query(
        `SELECT content_type, source
         FROM posts
         WHERE customer_id = $1
           AND created_at > NOW() - INTERVAL '30 days'
           AND status NOT IN ('failed')
         ORDER BY created_at DESC
         LIMIT 15`,
        [req.customerId]
      );

      const recentPosts = recentPostsResult.rows;

      if (recentPosts.length >= 3) {
        // Simple heuristic: if more than 15% of recent posts are promotional, suggest educational
        const promotionalCount = recentPosts.filter((_, i) => i % 5 === 4).length;
        const gapType = promotionalCount > Math.floor(recentPosts.length * 0.15)
          ? 'educational'
          : null;

        if (gapType) {
          const tip = knowledge.seasonalContent?.[currentMonth]?.tipTopic || 'a helpful maintenance tip';
          suggestions.push({
            customer_id: customer.id,
            suggestion_type: 'gap',
            title: 'Time for an educational post',
            reason: `I noticed most of your recent posts have been promotional. Educational posts get 3x more engagement for ${customer.industry} businesses and build the trust that converts followers into customers. Here's one ready to go.`,
            pre_generated_caption: buildEducationalCaption(customer, knowledge, tip),
            pre_generated_hashtags: (knowledge.localKeywords || []).slice(0, 5).map(k =>
              k.replace('[city]', customer.location || 'your city').replace(/\s+/g, '')
            ),
            platform: 'all',
            content_type: 'photo',
            industry_context: { gap_type: gapType, recent_post_count: recentPosts.length },
            expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          });
        }
      }

      // ── 4. MILESTONE SUGGESTION ───────────────────────────────────────────
      const milestones = [1, 10, 25, 50, 100];
      const totalThisMonth = customer.total_posts_this_month || 0;
      if (milestones.includes(totalThisMonth + 1)) {
        const next = totalThisMonth + 1;
        suggestions.push({
          customer_id: customer.id,
          suggestion_type: 'milestone',
          title: `Your ${formatOrdinal(next)} post this month is coming up!`,
          reason: `You're about to hit your ${formatOrdinal(next)} post this month — a milestone worth celebrating. Keep the momentum going.`,
          pre_generated_caption: buildStreakCaption(customer, knowledge, seasonal),
          pre_generated_hashtags: [],
          platform: 'all',
          content_type: 'photo',
          industry_context: { milestone: next },
          expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        });
      }

      // ── Save all suggestions (clear stale ones first, then insert fresh) ──
      await pool.query(
        `DELETE FROM content_suggestions
         WHERE customer_id = $1
           AND is_dismissed = false
           AND is_used = false
           AND expires_at > NOW()`,
        [req.customerId]
      );

      const inserted = [];
      for (const s of suggestions) {
        const r = await pool.query(
          `INSERT INTO content_suggestions
             (customer_id, suggestion_type, title, reason,
              pre_generated_caption, pre_generated_hashtags,
              platform, content_type, industry_context, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            s.customer_id, s.suggestion_type, s.title, s.reason,
            s.pre_generated_caption, s.pre_generated_hashtags,
            s.platform, s.content_type, JSON.stringify(s.industry_context),
            s.expires_at,
          ]
        );
        inserted.push(r.rows[0]);
      }

      res.json({ generated: inserted.length, suggestions: inserted });
    } catch (err) {
      console.error('[suggestions] POST /generate:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/suggestions/:id/use ─────────────────────────────────────────
  // Customer clicked "✅ Use This" — mark as used, optionally link post_id
  router.post('/:id/use', authenticate, async (req, res) => {
    try {
      const { postId } = req.body;
      await pool.query(
        `UPDATE content_suggestions
         SET is_used = true, used_at = NOW(), used_in_post_id = $1
         WHERE id = $2 AND customer_id = $3`,
        [postId || null, req.params.id, req.customerId]
      );
      res.json({ success: true });
    } catch (err) {
      console.error('[suggestions] POST /:id/use:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/suggestions/:id/dismiss ─────────────────────────────────────
  // Customer clicked "✕ Skip"
  router.post('/:id/dismiss', authenticate, async (req, res) => {
    try {
      await pool.query(
        `UPDATE content_suggestions
         SET is_dismissed = true, dismissed_at = NOW()
         WHERE id = $1 AND customer_id = $2`,
        [req.params.id, req.customerId]
      );
      res.json({ success: true });
    } catch (err) {
      console.error('[suggestions] POST /:id/dismiss:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};

// ── Caption builders ──────────────────────────────────────────────────────────
// PostCore voice rules: explains WHY first, plain language, ends with a question.

function buildSeasonalCaption(customer, seasonal, hook) {
  const loc = customer.location || 'the local area';
  return `${hook.replace('[city]', loc).replace('{location}', loc) || `It's that time of year again in ${loc}!`}

${seasonal.urgencyTopic} is on a lot of homeowners' minds right now — and for good reason.

${seasonal.tipTopic}. This is one of the most common things we help with this time of year, and the fix is usually simpler than people expect.

${seasonal.promotionAngle ? seasonal.promotionAngle + '.' : ''}

If you have any questions about this, drop them in the comments below — we read and reply to every one. 👇`;
}

function buildStreakCaption(customer, knowledge, seasonal) {
  const loc = customer.location || 'the local area';
  const hookIndex = Math.floor(Math.random() * (knowledge.hookFormulas?.length || 1));
  const hook = knowledge.hookFormulas?.[hookIndex] || '';
  return `${hook.replace('[city]', loc) || `Quick tip from our team in ${loc}:`}

${seasonal?.tipTopic || knowledge.contentThemes?.[0] || 'We help local homeowners with the jobs they don\'t have time to deal with themselves.'}

This is the kind of work we do every day — and we love every minute of it.

Have a question? Drop it in the comments and we'll answer it today. 👇`;
}

function buildEducationalCaption(customer, knowledge, tip) {
  const loc = customer.location || 'the local area';
  return `💡 Pro tip for ${loc} homeowners:

${tip}

Most people don't know this until it's too late — and the cost of fixing it after the fact is usually 3-5x what it would have been to catch it early.

If you've been wondering about this, or have a question about your home, drop it in the comments below. We answer every one.

What's the #1 question you have about your home? 👇`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMonthName(month) {
  return ['January','February','March','April','May','June',
          'July','August','September','October','November','December'][month - 1];
}

function formatOrdinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
