'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const industryKnowledge = require('../data/industryKnowledge');
let NotificationService;
try { NotificationService = require('./NotificationService'); } catch { NotificationService = null; }

const CLAUDE_MODEL = 'claude-sonnet-4-6';

const SUGGESTION_TYPES = {
  SEASONAL:    'seasonal',
  STREAK:      'streak',
  CONTENT_GAP: 'content_gap',
  MILESTONE:   'milestone',
};

const GAP_THRESHOLDS = {
  PROMOTIONAL_OVERLOAD:  0.60,
  NO_TESTIMONIALS_DAYS:  30,
  NO_BEFORE_AFTER_DAYS:  30,
};

const STREAK = {
  INACTIVE_DAYS:  2,
  ENCOURAGE_MIN:  5,
};

const MAX_SUGGESTIONS_PER_RUN = 3;

const TYPE_PRIORITY = [
  SUGGESTION_TYPES.STREAK,
  SUGGESTION_TYPES.SEASONAL,
  SUGGESTION_TYPES.CONTENT_GAP,
  SUGGESTION_TYPES.MILESTONE,
];

function getCurrentMonth() { return new Date().getMonth() + 1; }
function getCurrentYear()  { return new Date().getFullYear(); }

function getMonthName(month) {
  return ['January','February','March','April','May','June',
          'July','August','September','October','November','December'][month - 1];
}

function daysBetween(dateA, dateB) {
  const msA = dateA instanceof Date ? dateA.getTime() : new Date(dateA).getTime();
  const msB = dateB instanceof Date ? dateB.getTime() : new Date(dateB).getTime();
  return Math.abs(Math.round((msB - msA) / (1000 * 60 * 60 * 24)));
}

function endOfCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
}

function getKnowledge(industry) {
  if (!industry) return industryKnowledge.general_contractor;
  const key = industry.toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_');
  return industryKnowledge[key] || industryKnowledge.general_contractor;
}

function weekOfYear() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.ceil((((now - start) / 86400000) + start.getDay() + 1) / 7);
}

class SuggestionsEngine {
  constructor(pool) {
    this.pool   = pool;
    this.client = process.env.ANTHROPIC_API_KEY
      ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      : null;
  }

  async generateForCustomer(customerId) {
    let customer;
    try {
      customer = await this._fetchCustomer(customerId);
    } catch (err) {
      console.error('[SuggestionsEngine] Failed to fetch customer:', customerId, err.message);
      return;
    }

    if (!customer) {
      console.warn('[SuggestionsEngine] Customer not found:', customerId);
      return;
    }

    const candidates = [];

    try {
      const seasonal = await this._buildSeasonalSuggestion(customer);
      if (seasonal) candidates.push(seasonal);
    } catch (err) {
      console.error('[SuggestionsEngine] Seasonal check failed:', err.message);
    }

    try {
      const streak = await this._buildStreakSuggestion(customer);
      if (streak) candidates.push(streak);
    } catch (err) {
      console.error('[SuggestionsEngine] Streak check failed:', err.message);
    }

    try {
      const gaps = await this._buildContentGapSuggestions(customer);
      candidates.push(...gaps);
    } catch (err) {
      console.error('[SuggestionsEngine] Gap check failed:', err.message);
    }

    try {
      const milestone = await this._buildMilestoneSuggestion(customer);
      if (milestone) candidates.push(milestone);
    } catch (err) {
      console.error('[SuggestionsEngine] Milestone check failed:', err.message);
    }

    if (candidates.length === 0) return;

    candidates.sort((a, b) =>
      TYPE_PRIORITY.indexOf(a.type) - TYPE_PRIORITY.indexOf(b.type)
    );
    const toProcess = candidates.slice(0, MAX_SUGGESTIONS_PER_RUN);

    for (const suggestion of toProcess) {
      try {
        suggestion.pre_generated_caption = await this._generateCaption(customer, suggestion);
      } catch (err) {
        console.error('[SuggestionsEngine] Caption generation failed for', suggestion.reference_key, err.message);
        suggestion.pre_generated_caption = null;
      }

      try {
        await this._upsertSuggestion(customerId, suggestion);
      } catch (err) {
        console.error('[SuggestionsEngine] Upsert failed for', suggestion.reference_key, err.message);
      }
    }

    console.log(`[SuggestionsEngine] ${toProcess.length} suggestion(s) upserted for customer ${customerId}`);

    // Fire one in-app + push notification per customer so they open the app
    if (toProcess.length > 0 && NotificationService) {
      try {
        const ns = new NotificationService(this.pool);
        ns.newSuggestion(customerId);
      } catch (err) {
        console.error('[SuggestionsEngine] Notification dispatch failed:', err.message);
      }
    }
  }

  async generateForAllCustomers() {
    let customers;
    try {
      const result = await this.pool.query(
        `SELECT id FROM customers
         WHERE status NOT IN ('suspended','cancelled')
           AND suspended IS NOT TRUE
         ORDER BY id`
      );
      customers = result.rows;
    } catch (err) {
      console.error('[SuggestionsEngine] Failed to fetch customer list:', err.message);
      return;
    }

    console.log(`[SuggestionsEngine] Running for ${customers.length} customer(s)`);
    for (const { id } of customers) {
      await this.generateForCustomer(id);
      await new Promise(r => setTimeout(r, 500));
    }
    console.log('[SuggestionsEngine] Daily run complete');
  }

  async _buildSeasonalSuggestion(customer) {
    const month      = getCurrentMonth();
    const year       = getCurrentYear();
    const monthName  = getMonthName(month);
    const knowledge  = getKnowledge(customer.industry);
    const seasonal   = knowledge.seasonalContent?.[month];

    if (!seasonal) return null;

    const existingPost = await this.pool.query(
      `SELECT id FROM posts
       WHERE customer_id = $1
         AND theme = 'seasonal'
         AND status = 'posted'
         AND DATE_TRUNC('month', posted_at) = DATE_TRUNC('month', NOW())
       LIMIT 1`,
      [customer.id]
    );
    if (existingPost.rows.length > 0) return null;

    const referenceKey = `seasonal_${year}_${String(month).padStart(2, '0')}`;
    const existing = await this._findExistingSuggestion(customer.id, referenceKey);
    if (existing) return null;

    return {
      type:          SUGGESTION_TYPES.SEASONAL,
      reference_key: referenceKey,
      title:         `${monthName} is the perfect time to post about ${seasonal.urgencyTopic}`,
      reason:        `I noticed you haven't posted about ${seasonal.urgencyTopic} yet this month. ${monthName} is when your customers are most likely searching for this — it's the right time to show up.`,
      platform:      'facebook',
      content_type:  'seasonal',
      expires_at:    endOfCurrentMonth(),
      _promptContext: {
        urgencyTopic:   seasonal.urgencyTopic,
        tipTopic:       seasonal.tipTopic,
        promotionAngle: seasonal.promotionAngle,
        month:          monthName,
      },
    };
  }

  async _buildStreakSuggestion(customer) {
    const lastPostedAt  = customer.last_posted_at ? new Date(customer.last_posted_at) : null;
    const postingStreak = customer.posting_streak || 0;
    const now           = new Date();

    if (postingStreak >= STREAK.ENCOURAGE_MIN) {
      const referenceKey = `streak_encourage_${postingStreak}`;
      const existing = await this._findExistingSuggestion(customer.id, referenceKey);
      if (existing) return null;

      return {
        type:          SUGGESTION_TYPES.STREAK,
        reference_key: referenceKey,
        title:         `Keep your ${postingStreak}-day posting streak going!`,
        reason:        `I noticed you've posted ${postingStreak} days in a row — that's incredible consistency. Accounts that post regularly get up to 5x more engagement. Let's keep it going.`,
        platform:      'facebook',
        content_type:  'educational_tip',
        expires_at:    null,
        _promptContext: { streakDays: postingStreak },
      };
    }

    if (lastPostedAt) {
      const daysSince = daysBetween(lastPostedAt, now);
      if (daysSince > STREAK.INACTIVE_DAYS) {
        const referenceKey = `streak_inactive_${getCurrentYear()}_w${weekOfYear()}`;
        const existing = await this._findExistingSuggestion(customer.id, referenceKey);
        if (existing) return null;

        return {
          type:          SUGGESTION_TYPES.STREAK,
          reference_key: referenceKey,
          title:         `You haven't posted in ${daysSince} days — let's fix that`,
          reason:        `I noticed it's been ${daysSince} days since your last post. Businesses that post consistently get seen more by the same local homeowners. A quick tip or project photo takes 30 seconds with ItsPosting.`,
          platform:      'facebook',
          content_type:  'educational_tip',
          expires_at:    null,
          _promptContext: { daysSince },
        };
      }
    }

    return null;
  }

  async _buildContentGapSuggestions(customer) {
    const result = await this.pool.query(
      `SELECT content_type, theme, created_at
       FROM posts
       WHERE customer_id = $1
         AND status IN ('posted', 'scheduled', 'draft')
       ORDER BY created_at DESC
       LIMIT 10`,
      [customer.id]
    );

    const posts = result.rows;
    if (posts.length < 3) return [];

    const suggestions = [];

    const promotional = posts.filter(p =>
      p.content_type === 'promotional' || p.theme === 'seasonal' || p.theme === 'promotion'
    ).length;

    const testimonials = posts.filter(p =>
      p.content_type === 'customer_testimonial' || p.theme === 'testimonial'
    ).length;

    const beforeAfters = posts.filter(p =>
      p.content_type === 'before_after' || p.theme === 'project_showcase'
    ).length;

    if (promotional / posts.length > GAP_THRESHOLDS.PROMOTIONAL_OVERLOAD) {
      const referenceKey = `gap_promotional_${getCurrentYear()}_${String(getCurrentMonth()).padStart(2, '0')}`;
      const existing = await this._findExistingSuggestion(customer.id, referenceKey);
      if (!existing) {
        suggestions.push({
          type:          SUGGESTION_TYPES.CONTENT_GAP,
          reference_key: referenceKey,
          title:         'Time for an educational post — your audience will love it',
          reason:        `I noticed ${promotional} of your last ${posts.length} posts have been promotional. The 70/20/10 rule says 70% of posts should give value — not sell. An educational tip right now will build more trust and reach more people.`,
          platform:      'facebook',
          content_type:  'educational_tip',
          expires_at:    null,
          _promptContext: { gapType: 'too_promotional', promotionalCount: promotional, totalPosts: posts.length },
        });
      }
    }

    if (testimonials === 0) {
      const testimonialsResult = await this.pool.query(
        `SELECT id FROM posts
         WHERE customer_id = $1
           AND (content_type = 'customer_testimonial' OR theme = 'testimonial')
           AND created_at > NOW() - INTERVAL '30 days'
         LIMIT 1`,
        [customer.id]
      );
      if (testimonialsResult.rows.length === 0) {
        const referenceKey = `gap_testimonial_${getCurrentYear()}_${String(getCurrentMonth()).padStart(2, '0')}`;
        const existing = await this._findExistingSuggestion(customer.id, referenceKey);
        if (!existing) {
          suggestions.push({
            type:          SUGGESTION_TYPES.CONTENT_GAP,
            reference_key: referenceKey,
            title:         'A customer story this week could double your engagement',
            reason:        `I noticed you haven't shared a customer testimonial in over 30 days. Social proof is the #1 trust builder for local service businesses — real stories from real customers convert better than any ad.`,
            platform:      'facebook',
            content_type:  'customer_testimonial',
            expires_at:    null,
            _promptContext: { gapType: 'no_testimonials' },
          });
        }
      }
    }

    if (beforeAfters === 0 && suggestions.length < 2) {
      const baResult = await this.pool.query(
        `SELECT id FROM posts
         WHERE customer_id = $1
           AND (content_type = 'before_after' OR theme = 'project_showcase')
           AND created_at > NOW() - INTERVAL '30 days'
         LIMIT 1`,
        [customer.id]
      );
      if (baResult.rows.length === 0) {
        const referenceKey = `gap_before_after_${getCurrentYear()}_${String(getCurrentMonth()).padStart(2, '0')}`;
        const existing = await this._findExistingSuggestion(customer.id, referenceKey);
        if (!existing) {
          suggestions.push({
            type:          SUGGESTION_TYPES.CONTENT_GAP,
            reference_key: referenceKey,
            title:         'A before & after post could be your best performer this month',
            reason:        `I noticed you haven't shared a before & after project this month. The contrast is what grabs attention — it consistently outperforms standard posts for trades businesses. Got a recent job? This takes 2 minutes.`,
            platform:      'instagram',
            content_type:  'before_after',
            expires_at:    null,
            _promptContext: { gapType: 'no_before_after' },
          });
        }
      }
    }

    return suggestions.slice(0, 2);
  }

  async _buildMilestoneSuggestion(customer) {
    const totalPosts    = customer.total_posts_this_month || 0;
    const postingStreak = customer.posting_streak || 0;

    if (totalPosts === 0) {
      const referenceKey = `milestone_first_${getCurrentYear()}_${String(getCurrentMonth()).padStart(2, '0')}`;
      const existing = await this._findExistingSuggestion(customer.id, referenceKey);
      if (!existing) {
        return {
          type:          SUGGESTION_TYPES.MILESTONE,
          reference_key: referenceKey,
          title:         `Start ${getMonthName(getCurrentMonth())} strong — first post of the month`,
          reason:        `A new month, a fresh start. Businesses that post in the first week of the month consistently build stronger monthly reach. Let's kick ${getMonthName(getCurrentMonth())} off right.`,
          platform:      'facebook',
          content_type:  'educational_tip',
          expires_at:    new Date(new Date().setDate(7)),
          _promptContext: { milestone: 'first_of_month', month: getMonthName(getCurrentMonth()) },
        };
      }
    }

    if (totalPosts === 9) {
      const referenceKey = `milestone_10th_${getCurrentYear()}_${String(getCurrentMonth()).padStart(2, '0')}`;
      const existing = await this._findExistingSuggestion(customer.id, referenceKey);
      if (!existing) {
        return {
          type:          SUGGESTION_TYPES.MILESTONE,
          reference_key: referenceKey,
          title:         `You're building real momentum — post #10 this month`,
          reason:        `You're about to hit 10 posts this month — that puts you in the top tier of businesses your size for consistency. Accounts posting 10+ times per month see 5x more engagement than sporadic posters. One more to go!`,
          platform:      'instagram',
          content_type:  'project_showcase',
          expires_at:    null,
          _promptContext: { milestone: '10th_post' },
        };
      }
    }

    const roundStreaks = [10, 14, 21, 30, 60, 90];
    if (roundStreaks.includes(postingStreak)) {
      const referenceKey = `milestone_streak_${postingStreak}_${getCurrentYear()}`;
      const existing = await this._findExistingSuggestion(customer.id, referenceKey);
      if (!existing) {
        return {
          type:          SUGGESTION_TYPES.MILESTONE,
          reference_key: referenceKey,
          title:         `${postingStreak}-day posting streak — you're in rare company`,
          reason:        `A ${postingStreak}-day posting streak puts you ahead of 95% of local service businesses on social media. This is what consistent growth looks like — keep going.`,
          platform:      'facebook',
          content_type:  'team_spotlight',
          expires_at:    null,
          _promptContext: { milestone: 'round_streak', streakDays: postingStreak },
        };
      }
    }

    return null;
  }

  async _generateCaption(customer, suggestion) {
    if (!this.client) {
      console.warn('[SuggestionsEngine] ANTHROPIC_API_KEY not set — skipping caption generation');
      return null;
    }

    const knowledge = getKnowledge(customer.industry);
    const month     = getCurrentMonth();
    const seasonal  = knowledge.seasonalContent?.[month] || {};
    const ctx       = suggestion._promptContext || {};

    const systemPrompt = `You are PostCore, ItsPosting's AI social media advisor.
You write social media posts for ${customer.business_name || 'a local service business'}, a ${customer.industry || 'home service'} business in ${customer.location || 'the local area'}.
Brand tone: ${customer.tone || 'professional'}.

Write ONE short, engaging post caption that:
- Sounds like a real local business owner, not an AI
- Is appropriate for ${suggestion.platform}
- Matches the content type: ${suggestion.content_type}
- Ends with a genuine engagement question
- Does NOT use: "synergy", "leverage", "delve", "look no further", or any corporate jargon
- NEVER mentions ItsPosting

${customer.industry ? `Industry seasonal context: ${seasonal.urgencyTopic || ''}` : ''}
${customer.location ? `Location: naturally reference ${customer.location} if it fits` : ''}

Return ONLY valid JSON — no markdown, no preamble:
{
  "caption": "the full post text including engagement question",
  "hashtags": ["tag1", "tag2"],
  "imagePrompt": "detailed image description for AI image generation, min 20 words"
}`;

    const contentBrief = this._buildCaptionBrief(suggestion, ctx, customer);

    try {
      const response = await this.client.messages.create({
        model:      CLAUDE_MODEL,
        max_tokens: 1024,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: contentBrief }],
      });

      const raw     = response.content[0].text;
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed  = JSON.parse(cleaned);

      return JSON.stringify({
        caption:     parsed.caption     || '',
        hashtags:    parsed.hashtags    || [],
        imagePrompt: parsed.imagePrompt || '',
      });
    } catch (err) {
      console.error('[SuggestionsEngine] Caption API error:', err.message);
      return null;
    }
  }

  _buildCaptionBrief(suggestion, ctx, customer) {
    const month = getMonthName(getCurrentMonth());

    const briefs = {
      [SUGGESTION_TYPES.SEASONAL]: `Write a ${suggestion.content_type} post for ${month}.
Topic: ${ctx.urgencyTopic || suggestion.title}
Tip angle: ${ctx.tipTopic || ''}
The post should feel timely and urgent for this time of year.`,

      [SUGGESTION_TYPES.STREAK]: ctx.daysSince
        ? `Write a friendly, motivating educational tip post to re-engage this business on social media after ${ctx.daysSince} days off.`
        : `Write an engaging educational tip post to keep this business's ${ctx.streakDays}-day posting streak going. Make it feel celebratory but useful.`,

      [SUGGESTION_TYPES.CONTENT_GAP]: ({
        too_promotional: `Write an educational tip post that gives genuine value to homeowners. This business has been posting too many promotional posts — this one should be 100% helpful with no direct selling.`,
        no_testimonials:  `Write a customer testimonial/social proof post. Tell a story about a homeowner problem that was solved. Make it relatable and end with a trust-building question.`,
        no_before_after:  `Write a before & after post. Describe a recent project transformation — the messy before, the satisfying after. Make the reader feel the contrast.`,
      })[ctx.gapType] || 'Write an educational tip post.',

      [SUGGESTION_TYPES.MILESTONE]: ({
        first_of_month: `Write an engaging educational tip post to kick off ${month} strong. Make it relevant to this season and ${customer.industry || 'home services'}.`,
        '10th_post':    `Write a project showcase post celebrating this business's consistency and great work this month.`,
        round_streak:   `Write a team spotlight or educational post. Keep it warm and proud — this is a milestone.`,
      })[ctx.milestone] || 'Write a motivating educational tip post.',
    };

    return briefs[suggestion.type] || `Write a ${suggestion.content_type} post for ${suggestion.title}.`;
  }

  async _fetchCustomer(customerId) {
    const result = await this.pool.query(
      `SELECT id, business_name, industry, location, tone, phone,
              website_services, website_about, custom_instructions,
              past_post_examples, posting_streak, last_posted_at,
              total_posts_this_month, plan, status, suspended
       FROM customers
       WHERE id = $1`,
      [customerId]
    );
    return result.rows[0] || null;
  }

  async _upsertSuggestion(customerId, suggestion) {
    await this.pool.query(
      `INSERT INTO content_suggestions
         (customer_id, type, title, reason, pre_generated_caption,
          platform, content_type, reference_key, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
       ON CONFLICT (customer_id, reference_key)
       DO UPDATE SET
         title                 = EXCLUDED.title,
         reason                = EXCLUDED.reason,
         pre_generated_caption = COALESCE(EXCLUDED.pre_generated_caption, content_suggestions.pre_generated_caption),
         updated_at            = NOW()
       WHERE content_suggestions.status = 'pending'`,
      [
        customerId,
        suggestion.type,
        suggestion.title,
        suggestion.reason,
        suggestion.pre_generated_caption || null,
        suggestion.platform,
        suggestion.content_type,
        suggestion.reference_key,
        suggestion.expires_at || null,
      ]
    );
  }

  async _findExistingSuggestion(customerId, referenceKey) {
    const result = await this.pool.query(
      `SELECT id, status FROM content_suggestions
       WHERE customer_id = $1
         AND reference_key = $2
         AND status != 'expired'
       LIMIT 1`,
      [customerId, referenceKey]
    );
    return result.rows[0] || null;
  }

  async cleanupExpired() {
    const result = await this.pool.query(
      `UPDATE content_suggestions
       SET status = 'expired', updated_at = NOW()
       WHERE expires_at < NOW()
         AND status = 'pending'
       RETURNING id`
    );
    const count = result.rows.length;
    if (count > 0) console.log(`[SuggestionsEngine] Marked ${count} suggestion(s) as expired`);
    return count;
  }
}

module.exports = SuggestionsEngine;
