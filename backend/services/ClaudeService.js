/**
 * ItsPosting — Claude Service (v2 — upgraded with SystemPromptBuilder)
 * backend/services/ClaudeService.js
 *
 * Key upgrades:
 *  - Uses SystemPromptBuilder for rich, industry-aware prompts
 *  - Always generates 3 variations (A, B, C) — never just 1
 *  - Saves variations to post_variations table
 *  - Correct model: claude-sonnet-4-6 (not haiku)
 *  - Every post ends with an engagement question
 *  - Pulls business_knowledge for few-shot context
 */

const Anthropic = require('@anthropic-ai/sdk');
const SystemPromptBuilder = require('./SystemPromptBuilder');

class ClaudeService {
  constructor(pool) {
    this.pool = pool;
    this.apiKey = process.env.ANTHROPIC_API_KEY;

    if (!this.apiKey) {
      console.warn('[ClaudeService] ⚠️  ANTHROPIC_API_KEY not set');
    }

    this.client = this.apiKey ? new Anthropic({ apiKey: this.apiKey }) : null;

    // ALWAYS use sonnet — never haiku for production post generation
    this.model = 'claude-sonnet-4-6';
  }

  // ── Main: generate 3 variations for a post ───────────────────────────────
  /**
   * @param {number} customerId
   * @param {string} contentType  — 'static' | 'photo' | 'carousel' | 'video'
   * @param {string} wizardTrigger — from Step 1 of the wizard
   * @param {string} platform     — 'facebook' | 'instagram' | 'google_business' | 'all'
   * @param {Object} counterAnswers — answers from counter-query step
   * @returns {Object} { variation_a, variation_b, variation_c }
   */
  async generateVariations(customerId, contentType, wizardTrigger, platform = 'all', counterAnswers = {}) {
    if (!this.client) throw new Error('Claude not configured. Set ANTHROPIC_API_KEY.');

    const [customerResult, knowledgeResult] = await Promise.all([
      this.pool.query('SELECT * FROM customers WHERE id = $1', [customerId]),
      this.pool.query(
        'SELECT * FROM business_knowledge WHERE customer_id = $1 AND is_active = true ORDER BY knowledge_type, created_at DESC',
        [customerId]
      ),
    ]);

    if (customerResult.rows.length === 0) throw new Error('Customer not found');

    const customer = customerResult.rows[0];
    const businessKnowledge = knowledgeResult.rows;

    const builder = new SystemPromptBuilder(customer, {
      platform,
      contentType,
      wizardTrigger,
      counterAnswers,
      businessKnowledge,
      customerId,
    });

    const { systemPrompt, userPrompt } = builder.build();

    let rawText = '';
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 3000,
        temperature: 0.8,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      rawText = response.content[0].text;
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (!parsed.variation_a || !parsed.variation_b || !parsed.variation_c) {
        throw new Error('Claude returned incomplete variations — missing A, B, or C');
      }

      console.log(`[ClaudeService] Generated 3 variations for customer ${customerId} (${contentType} / ${platform})`);
      return parsed;

    } catch (err) {
      console.error('[ClaudeService] generateVariations error:', err.message);
      if (rawText) console.error('[ClaudeService] Raw response:', rawText.substring(0, 500));
      throw new Error(`Post generation failed: ${err.message}`);
    }
  }

  // ── Save variations to DB ─────────────────────────────────────────────────
  /**
   * After a post is created, save the A/B/C variations to post_variations.
   * @param {number} postId
   * @param {Object} variations — { variation_a, variation_b, variation_c }
   */
  async saveVariations(postId, variations) {
    const labels = { variation_a: 'A', variation_b: 'B', variation_c: 'C' };
    const platformMap = { variation_a: 'facebook', variation_b: 'instagram', variation_c: 'google_business' };
    const results = [];

    for (const [key, label] of Object.entries(labels)) {
      const v = variations[key];
      if (!v) continue;

      try {
        const result = await this.pool.query(
          `INSERT INTO post_variations
             (post_id, variation_label, caption, hashtags,
              image_prompt, engagement_question, hook_formula_used, engagement_score, platform)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (post_id, variation_label)
           DO UPDATE SET
             caption = EXCLUDED.caption,
             hashtags = EXCLUDED.hashtags,
             image_prompt = EXCLUDED.image_prompt,
             engagement_question = EXCLUDED.engagement_question,
             hook_formula_used = EXCLUDED.hook_formula_used,
             engagement_score = EXCLUDED.engagement_score
           RETURNING *`,
          [
            postId,
            label,
            v.caption,
            JSON.stringify(v.hashtags || []),
            v.imagePrompt || null,
            v.engagementQuestion || null,
            v.hookFormulaUsed || null,
            v.engagementScore || 0,
            platformMap[key],
          ]
        );
        results.push(result.rows[0]);
      } catch (err) {
        console.error(`[ClaudeService] saveVariations error for ${label}:`, err.message);
      }
    }

    return results;
  }

  // ── generateCaption: prompt-driven 3-variation generation ────────────────
  // Used by ManualContentGenerator for the content API (/api/content/generate).
  // Routes the user's typed prompt through counterAnswers.custom so
  // SystemPromptBuilder includes it as "additional context" in the user message.
  // wizardTrigger activates industry-specific content type rules + content angles.
  // Returns variation_a as primary + full `variations` object for saving.
  async generateCaption(customer, prompt, contentType = 'photo', platform = 'instagram', wizardTrigger = null) {
    if (!this.client) throw new Error('Claude not configured. Set ANTHROPIC_API_KEY.');

    let businessKnowledge = [];
    try {
      const knowledgeResult = await this.pool.query(
        'SELECT * FROM business_knowledge WHERE customer_id = $1 AND is_active = true ORDER BY knowledge_type, created_at DESC',
        [customer.id]
      );
      businessKnowledge = knowledgeResult.rows;
    } catch (_) {}

    const builder = new SystemPromptBuilder(customer, {
      platform,
      contentType,
      wizardTrigger,                  // activates content-type rules + industry content angles
      counterAnswers: { custom: prompt },
      businessKnowledge,
      customerId: customer.id,
    });
    const { systemPrompt, userPrompt } = builder.build(); // 3-variation format from section 6

    let rawText = '';
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2500, // 3 full variations need more tokens than 1
        temperature: 0.8,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      rawText = response.content[0].text;
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      // variation_a = Facebook-optimised per SystemPromptBuilder section 6
      const best = parsed.variation_a || parsed.variation_b || parsed.variation_c || {};

      console.log(`[ClaudeService] generateCaption generated 3 variations for ${customer.business_name || 'customer'} (${contentType}/${platform})`);

      return {
        caption: best.caption || '',
        hashtags: best.hashtags || [],
        overlay_text: best.caption
          ? best.caption.split(/[.!?]/)[0].split(/\s+/).slice(0, 8).join(' ')
          : '',
        imagePrompt: best.imagePrompt || '',
        engagementQuestion: best.engagementQuestion || '',
        model: this.model,
        variations: parsed, // all 3 returned — ManualContentGenerator saves them
      };
    } catch (err) {
      console.error('[ClaudeService] generateCaption error:', err.message);
      if (rawText) console.error('[ClaudeService] Raw (first 500):', rawText.substring(0, 500));
      // Never leak raw API error details — translate to clean internal signals
      const isAuthErr = err.status === 401 || (err.message || '').includes('authentication_error') || (err.message || '').includes('api-key') || (err.message || '').includes('API key');
      const isOverload = err.status === 529 || (err.message || '').includes('overloaded');
      const isRateLimit = err.status === 429;
      if (isAuthErr)   throw new Error('AI_AUTH_ERROR');
      if (isOverload)  throw new Error('AI_OVERLOADED');
      if (isRateLimit) throw new Error('AI_RATE_LIMITED');
      throw new Error('AI_GENERATION_FAILED');
    }
  }

  // ── Plan a carousel with the proven Hook→Problem→Solution→Result→CTA arc ────
  // Research (Buffer 2026, 52M+ posts): Carousels get +109% more engagement than Reels.
  // "SWIPE ➜" on slide 1 lifts completion 12%. Variable 3/5/6 slide count auto-set
  // by Claude based on topic depth. Each image_prompt is vivid + industry-specific
  // so NanaBanana generates relevant imagery rather than generic stock-style scenes.
  async planCarousel(customer, prompt, counterAnswers = {}) {
    if (!this.client) throw new Error('Claude not configured');

    const industryKnowledge = require('../data/industryKnowledge');
    const knowledge  = industryKnowledge[customer.industry] || industryKnowledge.general_contractor || {};
    const currMonth  = new Date().getMonth() + 1;
    const seasonal   = knowledge.seasonalContent?.[currMonth] || {};
    const painPoints = (knowledge.customerPainPoints || []).slice(0, 3).join('; ');
    const hooks      = (knowledge.hookFormulas || []).slice(0, 3).join(' | ');

    const builder = new SystemPromptBuilder(customer, {
      platform: 'instagram',
      contentType: 'carousel',
      counterAnswers,
      customerId: customer.id,
    });
    const { systemPrompt } = builder.build();

    const industryCtx = `Industry: ${customer.industry || 'home services'} · Location: ${customer.city || 'local area'}
Current month urgency: ${seasonal.urgencyTopic || 'quality service year-round'}
Top homeowner pain points: ${painPoints || 'cost, reliability, timing'}
Proven hook starters for this industry: ${hooks || 'Did you know... | X signs you need... | Never do this if...'}`;

    // Research-backed slide count rules (Buffer 2026 — 52M+ posts):
    // 5-6 slides → 3× more saves than 3-4 slides. Each swipe = 1 engagement signal.
    // Slide 1 must create an "information gap" — viewer must swipe to resolve curiosity.
    const userPrompt = `You are writing a high-engagement Instagram carousel for a LOCAL ${customer.industry || 'home service'} business.

${industryCtx}

Customer's topic: "${prompt}"

SLIDE COUNT — choose based on content type:
- Educational / Myth-busting / Tips: 6 slides — each tip or myth gets its own slide (6 slides → 3× more saves, Buffer 2026)
- Step-by-step / Job showcase: 5 slides — cover + 3 steps + CTA
- Before & After / Testimonial: 4 slides — setup → before → after → result + CTA
- Promotional / Seasonal offer: 3 slides — hook + offer + CTA
Return EXACTLY that many slides — no more, no fewer.

SLIDE 1 — THE INFORMATION GAP (most important):
Create a "curiosity gap" that forces the swipe. Options:
• Challenge a belief: "You're cleaning your gutters wrong."
• Tease a number: "5 signs your roof is failing right now."
• Surprising claim: "This $5 fix stops a $2,000 leak."
Slide 1 overlay_text MUST end with "SWIPE ➜"

MANDATORY RULES:
1. overlay_text: max 8 words per slide — bold, readable on a 4-inch screen in under 1 second
2. Each slide has ONE clear message — never cram 2 ideas into one slide
3. image_prompt: vivid, industry-specific, photorealistic — NOT generic
   GOOD: "Licensed HVAC technician in branded blue uniform replacing rusted condenser coil on rooftop AC unit, golden afternoon light, suburban neighbourhood in background"
   BAD: "HVAC worker doing maintenance"
4. main_caption: Instagram style — hook as FIRST LINE (visible before 'more'), value body, engagement question at end, 10-14 hashtags (3 broad + 5 niche + 4 local + 2 brand)
5. Caption must feel HYPER-LOCAL — mention their city/neighbourhood naturally, not forced
6. CTA slide (always last): clear single action — phone call, website visit, or DM — never multiple options

Return ONLY valid JSON (no markdown fences):
{
  "main_caption": "Full Instagram caption with hashtags",
  "hashtags": ["tag1","tag2"],
  "slide_count": 5,
  "slides": [
    {
      "slide_number": 1,
      "arc_role": "Hook",
      "title": "short internal title",
      "overlay_text": "Curiosity-gap statement or question  SWIPE ➜",
      "image_prompt": "Vivid scene of the homeowner problem — relatable suburban setting, photorealistic, no text"
    },
    {
      "slide_number": 2,
      "arc_role": "Problem",
      "title": "short internal title",
      "overlay_text": "The painful reality (≤8 words)",
      "image_prompt": "Close-up of the problem: damage, failure, or frustration — realistic, not staged, no text"
    },
    {
      "slide_number": 3,
      "arc_role": "Solution",
      "title": "short internal title",
      "overlay_text": "The fix, plain language (≤8 words)",
      "image_prompt": "Professional tradesperson actively solving the problem, quality tools visible, branded uniform, no text"
    },
    {
      "slide_number": 4,
      "arc_role": "Result",
      "title": "short internal title",
      "overlay_text": "The outcome in 6 words or fewer",
      "image_prompt": "Beautiful finished result or satisfied homeowner — warm natural lighting, no text"
    },
    {
      "slide_number": 5,
      "arc_role": "CTA",
      "title": "short internal title",
      "overlay_text": "Free quote. Call us today.",
      "image_prompt": "Friendly business owner or small team in branded uniform, approachable smile, phone or clipboard, no text"
    }
  ]
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const text = response.content[0].text;
      return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch (err) {
      console.error('[ClaudeService] planCarousel error:', err.message);
      throw new Error(`Carousel planning failed: ${err.message}`);
    }
  }

  // ── Generate video script ─────────────────────────────────────────────────
  async generateVideoScript(customer, prompt, durationSeconds = 30) {
    if (!this.client) throw new Error('Claude not configured');

    const wordCount = Math.floor((durationSeconds * 2.5) - 5);
    const industryKnowledge = require('../data/industryKnowledge');
    const knowledge = industryKnowledge[customer.industry] || industryKnowledge.general_contractor || {};
    const currentMonth = new Date().getMonth() + 1;
    const seasonal = knowledge.seasonalContent?.[currentMonth] || null;
    const tradeTerms = knowledge.tradeTerminology?.slice(0, 8).join(', ') || '';
    const hookFormula = knowledge.hookFormulas?.[Math.floor(Math.random() * Math.min(5, knowledge.hookFormulas?.length || 1))] || '';
    const builder = new SystemPromptBuilder(customer, { platform: 'all', contentType: 'video', customerId: customer.id });
    const { systemPrompt } = builder.build();

    // Industry-specific voice guidance injected into the system prompt
    const tradeVoiceAddendum = `
=== VIDEO SCRIPT VOICE RULES (NON-NEGOTIABLE) ===
This script will be spoken by a real business owner to their local community.

SPEAK LIKE A REAL ${(customer.industry || 'tradesperson').toUpperCase()}:
- Start with the PROBLEM or SITUATION, never with "Hi I'm [name] from..."
- Use natural speech with pauses: "..." indicates a natural pause
- Use real trade terms where they fit naturally: ${tradeTerms}
- Mention the city/area (${customer.location || 'your area'}) at least once
- One clear action at the end — not multiple options
${seasonal ? `- It is ${new Date().toLocaleString('default', { month: 'long' })} — weave in: "${seasonal.urgencyTopic}" if relevant` : ''}
${hookFormula ? `- Proven hook to adapt: "${hookFormula}"` : ''}

WHAT GREAT LOCAL TRADE VIDEO SCRIPTS SOUND LIKE:
✓ "If you are on [city] and your water bill jumped this month — chances are you have a slow leak running 24 hours a day. Here is how to check before you call us..."
✓ "It is January in [city]. Pipes freeze when temperatures hit 20 degrees. Last week we had three burst pipe calls in one morning. Here is the one thing that prevents most of them..."
✗ NEVER: "Hello! I am excited to share some amazing tips about our incredible services today!"
✗ NEVER: "As a valued member of our community, we want to leverage our expertise to synergize..."

The script should be conversational, direct, and sound exactly like a trusted local expert talking to a neighbor — not a sales pitch.`;

    const fullSystemPrompt = systemPrompt + tradeVoiceAddendum;

    const userPrompt = `Write a ${durationSeconds}-second video script about: ${prompt}
Target word count: ${wordCount} words (this is what fits naturally in ${durationSeconds} seconds of comfortable speech)

Return ONLY valid JSON:
{
  "script": "the spoken script — written exactly as it will be spoken aloud, with ... for natural pauses",
  "visualDescription": "a 1-2 sentence description of what should be SHOWN on screen (for video generation — separate from what is spoken)",
  "caption": "the social media post caption to accompany this video",
  "hashtags": ["tag1", "tag2", "tag3"]
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1500,
        system: fullSystemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const text = response.content[0].text;
      return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch (err) {
      console.error('[ClaudeService] generateVideoScript error:', err.message);
      throw new Error(`Script generation failed: ${err.message}`);
    }
  }

  // ── Generate weekly content plan ──────────────────────────────────────────
  async generateWeekPlan(customer) {
    if (!this.client) throw new Error('Claude not configured');

    const industryKnowledge = require('../data/industryKnowledge');
    const knowledge = industryKnowledge[customer.industry] || industryKnowledge.general_contractor || {};
    const currentMonth = new Date().getMonth() + 1;
    const seasonal = knowledge.seasonalContent?.[currentMonth] || null;

    const systemPrompt = `You are a social media strategist for ${customer.business_name || 'a local business'}.
Industry: ${customer.industry}. Location: ${customer.location}.
${seasonal ? `This month's seasonal topic: ${seasonal.urgencyTopic}` : ''}
Enforce the 70/20/10 rule: 70% educational, 20% social proof, 10% promotional.`;

    const userPrompt = `Create a 7-day social media content plan.
Daily themes: Mon=educational_tip, Tue=project_showcase, Wed=educational_tip, Thu=before_after, Fri=customer_value, Sat=seasonal, Sun=faq

Return ONLY valid JSON:
{
  "week_plan": [
    {
      "day": 1, "day_name": "Monday", "theme": "educational_tip",
      "content_type": "photo", "wizard_trigger": "share_tip",
      "caption": "...", "image_prompt": "...", "hashtags": ["..."],
      "engagement_question": "..."
    }
  ]
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const text = response.content[0].text;
      return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch (err) {
      console.error('[ClaudeService] generateWeekPlan error:', err.message);
      throw new Error(`Week plan generation failed: ${err.message}`);
    }
  }

  getCaptionLength(platform) {
    const lengths = {
      instagram: '100-150 words',
      facebook: '150-300 words',
      google_business: '100-200 words',
    };
    return lengths[platform] || '100-150 words';
  }

  async generateDMReply({ customerProfile, conversationHistory = [], lastMessage, tone = 'friendly' }) {
    if (!this.client) throw new Error('Claude not configured. Set ANTHROPIC_API_KEY.');
    const bizName = customerProfile.business_name || 'Local Business';
    const industry = customerProfile.industry || 'general_contractor';
    const toneMap = {
      professional: 'professional and trustworthy',
      friendly: 'warm and friendly',
      casual: 'casual and conversational',
      urgent: 'prompt and action-oriented',
    };
    const toneDesc = toneMap[tone] || 'warm and friendly';
    const context = conversationHistory.slice(-4)
      .map(m => `${m.direction === 'incoming' ? 'Customer' : 'Business'}: ${m.message_text || m.text || ''}`)
      .join('\n');
    const prompt = `You are replying on behalf of ${bizName}, a ${industry} business.\nTone: ${toneDesc}. Keep it SHORT (2-4 sentences). Include a clear next step.\n${context ? `Recent conversation:\n${context}\n\n` : ''}Customer's latest message: "${lastMessage}"\nWrite a reply:`;
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 250,
        messages: [{ role: 'user', content: prompt }],
      });
      return response.content[0].text.trim();
    } catch (err) {
      console.error('[ClaudeService] generateDMReply error:', err.message);
      throw new Error(`DM reply generation failed: ${err.message}`);
    }
  }
}

module.exports = ClaudeService;
