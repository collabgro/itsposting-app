'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const EmailQueue = require('./EmailQueue');
let NotificationService;
try { NotificationService = require('./NotificationService'); } catch { NotificationService = null; }

class PostCoreAdvisor {
  constructor(pool) {
    this.pool       = pool;
    this.client     = process.env.ANTHROPIC_API_KEY
      ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      : null;
    this.emailQueue = new EmailQueue(pool);
  }

  async generateWeeklyBriefing(customerId) {
    const [customerRes, weekPostsRes, bestTypeRes] = await Promise.all([
      this.pool.query(
        `SELECT business_name, industry, location, posting_streak,
                last_posted_at, content_preferences, credits_balance
         FROM customers WHERE id = $1`,
        [customerId]
      ),
      this.pool.query(
        `SELECT content_type, wizard_trigger, posted_at,
                COALESCE((engagement->>'likes')::int, 0)    AS likes,
                COALESCE((engagement->>'comments')::int, 0) AS comments,
                COALESCE((engagement->>'shares')::int, 0)   AS shares,
                COALESCE((engagement->>'reach')::int, 0)    AS reach
         FROM posts
         WHERE customer_id = $1
           AND posted_at >= NOW() - INTERVAL '7 days'
           AND status = 'posted'`,
        [customerId]
      ),
      this.pool.query(
        `SELECT content_type,
                SUM((engagement->>'likes')::int + (engagement->>'comments')::int) AS total_eng,
                COUNT(*) AS cnt
         FROM posts
         WHERE customer_id = $1
           AND posted_at >= NOW() - INTERVAL '30 days'
           AND status = 'posted'
         GROUP BY content_type
         ORDER BY total_eng DESC NULLS LAST
         LIMIT 1`,
        [customerId]
      ),
    ]);

    const customer = customerRes.rows[0];
    if (!customer) throw new Error('Customer not found');

    const weekPosts  = weekPostsRes.rows;
    const postCount  = weekPosts.length;
    const totalReach = weekPosts.reduce((s, p) => s + (parseInt(p.reach) || 0), 0);
    const bestType   = bestTypeRes.rows[0]?.content_type || 'photo';

    let seasonal = null;
    try {
      const ik = require('../data/industryKnowledge');
      const k  = ik[customer.industry] || ik.general_contractor || {};
      seasonal = k.seasonalContent?.[new Date().getMonth() + 1] || null;
    } catch { /* ignore */ }

    const systemPrompt = `You are ItsPosting AI, the AI social media advisor for ItsPosting.
You help local service businesses grow through social media.
Voice: knowledgeable, friendly, direct — like a trusted advisor talking to a tradesperson.
Never use marketing jargon. Maximum 3 recommendations. Always explain WHY before WHAT.
Use "I noticed..." not "The system detected...".
Never say: "delve", "synergy", "leverage", "utilize", "optimize".
Return ONLY valid JSON — no markdown, no backticks.`;

    const userPrompt = `Generate a Monday morning briefing for:
Business: ${customer.business_name}
Industry: ${customer.industry}
Location: ${customer.location || 'local area'}
Last 7 days: ${postCount} posts, ~${totalReach} total reach
Posting streak: ${customer.posting_streak || 0} days
Best performing content type recently: ${bestType}
${seasonal ? `This month's seasonal opportunity: ${seasonal.urgencyTopic}` : ''}
Credits remaining: ${customer.credits_balance || 0}

Return this exact JSON structure:
{
  "greeting": "Good morning, [name].",
  "weekSummary": "Last week you posted X times and reached an estimated Y people.",
  "sections": [
    {
      "type": "working",
      "title": "What's working",
      "observation": "...",
      "whyItMatters": "...",
      "action": "...",
      "actionLabel": "Generate Similar Post",
      "actionType": "generate"
    },
    {
      "type": "opportunity",
      "title": "This week's opportunity",
      "observation": "...",
      "whyItMatters": "...",
      "action": "...",
      "actionLabel": "Create This Post",
      "actionType": "generate"
    }
  ],
  "closingNote": "One sentence of genuine encouragement."
}`;

    let briefingData;

    if (this.client) {
      try {
        const response = await this.client.messages.create({
          model:      'claude-sonnet-4-6',
          max_tokens: 1200,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: userPrompt }],
        });
        const text  = response.content[0].text;
        const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        briefingData = JSON.parse(clean);
      } catch (err) {
        console.error('[PostCoreAdvisor] Claude error:', err.message);
        briefingData = this._fallbackBriefing(customer, postCount, totalReach, seasonal);
      }
    } else {
      briefingData = this._fallbackBriefing(customer, postCount, totalReach, seasonal);
    }

    // Monday of current week
    const weekOf = new Date();
    weekOf.setHours(0, 0, 0, 0);
    weekOf.setDate(weekOf.getDate() - weekOf.getDay() + 1);

    const result = await this.pool.query(
      `INSERT INTO postcore_briefings (customer_id, briefing_data, week_of, is_read)
       VALUES ($1, $2, $3, false)
       ON CONFLICT (customer_id, week_of)
       DO UPDATE SET briefing_data = EXCLUDED.briefing_data, is_read = false
       RETURNING *`,
      [customerId, JSON.stringify(briefingData), weekOf.toISOString().split('T')[0]]
    );

    // Queue weekly briefing email (non-blocking)
    this.emailQueue.notifyPostCoreBriefing(customer, briefingData).catch(err =>
      console.error('[PostCoreAdvisor] Failed to queue briefing email:', err.message)
    );

    // Fire push + in-app notification for the briefing (non-blocking)
    if (NotificationService) {
      try {
        const ns = new NotificationService(this.pool);
        ns.create(customerId, 'system',
          'Your weekly ItsPosting AI briefing is ready',
          briefingData.weekSummary || 'ItsPosting AI has insights from last week and a plan for this week.'
        );
      } catch (err) {
        console.error('[PostCoreAdvisor] Notification dispatch failed:', err.message);
      }
    }

    return result.rows[0];
  }

  async getLatestBriefing(customerId) {
    const result = await this.pool.query(
      `SELECT * FROM postcore_briefings
       WHERE customer_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [customerId]
    );
    return result.rows[0] || null;
  }

  async markRead(briefingId, customerId) {
    await this.pool.query(
      `UPDATE postcore_briefings SET is_read = true
       WHERE id = $1 AND customer_id = $2`,
      [briefingId, customerId]
    );
  }

  _fallbackBriefing(customer, postCount, totalReach, seasonal) {
    return {
      greeting:    `Good morning, ${customer.business_name || 'there'}.`,
      weekSummary: `Last week you published ${postCount} post${postCount !== 1 ? 's' : ''} and reached an estimated ${totalReach} people.`,
      sections: [
        ...(postCount > 0 ? [{
          type: 'working', title: "What's working",
          observation:   'You are posting consistently — that is the single most important factor.',
          whyItMatters: 'Consistent posting builds the algorithm familiarity that grows organic reach.',
          action:        'Keep publishing at least 3 times this week.',
          actionLabel:   "Create This Week's Posts", actionType: 'navigate',
        }] : []),
        ...(seasonal ? [{
          type: 'opportunity', title: "This week's opportunity",
          observation:   `It is peak season for ${seasonal.urgencyTopic}.`,
          whyItMatters: 'Seasonal posts get significantly more engagement because they match what homeowners are searching for right now.',
          action:        `Create a post about ${seasonal.urgencyTopic} before the week is over.`,
          actionLabel:   'Generate Seasonal Post', actionType: 'generate',
        }] : []),
      ],
      closingNote: 'Every post you publish puts your business in front of local homeowners who need exactly what you do.',
    };
  }
}

module.exports = PostCoreAdvisor;
