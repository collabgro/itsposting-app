/**
 * ItsPosting — Claude Service (v2 — upgraded with SystemPromptBuilder)
 * backend/services/ClaudeService.js
 *
 * Key upgrades:
 *  - Uses SystemPromptBuilder for rich, industry-aware prompts
 *  - Always generates 3 variations (A, B, C) — never just 1
 *  - Saves variations to post_variations table
 *  - Correct model: claude-sonnet-4-20250514 (not haiku)
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
    this.model = 'claude-sonnet-4-20250514';
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
  // Returns variation_a as primary + full `variations` object for saving.
  async generateCaption(customer, prompt, contentType = 'photo', platform = 'instagram') {
    if (!this.client) throw new Error('Claude not configured. Set ANTHROPIC_API_KEY.');

    const builder = new SystemPromptBuilder(customer, {
      platform,
      contentType,
      counterAnswers: { custom: prompt }, // user's typed prompt flows as context
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
      throw new Error(`Caption generation failed: ${err.message}`);
    }
  }

  // ── Plan a 5-slide carousel ───────────────────────────────────────────────
  async planCarousel(customer, prompt, counterAnswers = {}) {
    if (!this.client) throw new Error('Claude not configured');

    const builder = new SystemPromptBuilder(customer, {
      platform: 'instagram',
      contentType: 'carousel',
      counterAnswers,
    });
    const { systemPrompt } = builder.build();

    const userPrompt = `Create a 5-slide carousel post about: ${prompt}

Return ONLY valid JSON:
{
  "main_caption": "the post caption",
  "hashtags": ["tag1", "tag2"],
  "slides": [
    { "slide_number": 1, "title": "Hook", "overlay_text": "max 8 words", "image_prompt": "description" },
    { "slide_number": 2, "title": "Point 1", "overlay_text": "max 8 words", "image_prompt": "description" },
    { "slide_number": 3, "title": "Point 2", "overlay_text": "max 8 words", "image_prompt": "description" },
    { "slide_number": 4, "title": "Point 3", "overlay_text": "max 8 words", "image_prompt": "description" },
    { "slide_number": 5, "title": "CTA", "overlay_text": "max 8 words", "image_prompt": "description" }
  ]
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
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
    const builder = new SystemPromptBuilder(customer, { platform: 'all', contentType: 'video' });
    const { systemPrompt } = builder.build();

    const userPrompt = `Write a ${durationSeconds}-second video script about: ${prompt}
Target word count: ${wordCount} words

Return ONLY valid JSON:
{
  "script": "the spoken script",
  "caption": "post caption when sharing",
  "hashtags": ["tag1", "tag2"]
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1500,
        system: systemPrompt,
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
}

module.exports = ClaudeService;
