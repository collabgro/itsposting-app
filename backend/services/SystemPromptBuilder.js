/**
 * ItsPosting — System Prompt Builder
 * backend/services/SystemPromptBuilder.js
 *
 * THE BRAIN of every Claude API call.
 * Assembles a rich, 6-section system prompt from:
 *   1. Business context (customer record)
 *   2. Industry expertise (industryKnowledge.js)
 *   3. Platform-specific writing rules
 *   4. Content type rules
 *   5. Brand voice + few-shot examples
 *   6. Output format (always 3 variations: A, B, C)
 *
 * Usage:
 *   const builder = new SystemPromptBuilder(customer, options);
 *   const { systemPrompt, userPrompt } = builder.build();
 */

const industryKnowledge = require('../data/industryKnowledge');

// Strip content that could break prompt structure or inject new sections.
// Allows normal business text; removes === headers and control chars.
function sanitizeField(val, maxLen = 120) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/={2,}/g, '')          // strip === section header markers
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip non-printable control chars
    .substring(0, maxLen)
    .trim();
}

class SystemPromptBuilder {
  /**
   * @param {Object} customer  — full customer row from DB
   * @param {Object} options
   * @param {string} options.platform        — 'facebook' | 'instagram' | 'google_business' | 'all'
   * @param {string} options.contentType     — 'static' | 'photo' | 'carousel' | 'video'
   * @param {string} options.wizardTrigger   — 'finished_job' | 'share_tip' | 'got_review' | etc.
   * @param {Object} options.counterAnswers  — { location, cta, unique, before_state, ... }
   * @param {Array}  options.businessKnowledge — rows from business_knowledge table
   */
  constructor(customer, options = {}) {
    this.customer = customer;
    this.platform = options.platform || 'all';
    this.contentType = options.contentType || 'photo';
    this.wizardTrigger = options.wizardTrigger || null;
    this.counterAnswers = options.counterAnswers || {};
    this.businessKnowledge = options.businessKnowledge || [];
    this.wizardTone = options.wizardTone || null;

    // Resolve industry knowledge — fall back to general_contractor if unknown
    this.knowledge = industryKnowledge[customer.industry] || industryKnowledge.general_contractor || {};

    // Current month (1–12) for seasonal context
    this.currentMonth = new Date().getMonth() + 1;
    this.seasonal = this.knowledge.seasonalContent?.[this.currentMonth] || null;
  }

  // ── Main build method ─────────────────────────────────────────────────────
  build() {
    const sections = [
      this._section1_businessContext(),
      this._section2_industryExpertise(),
      this._section3_platformRules(),
      this._section4_contentTypeRules(),
      this._section5_brandVoice(),
      this._section6_outputFormat(),
    ];

    return {
      systemPrompt: sections.join('\n\n'),
      userPrompt: this._buildUserPrompt(),
    };
  }

  // ── Section 1: Business Context ───────────────────────────────────────────
  _section1_businessContext() {
    const c = this.customer;
    const services = this._extractServices();

    let ctx = `=== BUSINESS CONTEXT ===
You are writing social media content for:
Business name: ${sanitizeField(c.business_name, 100) || 'a local service business'}
Industry: ${sanitizeField(c.industry, 60) || 'home services'}
Location: ${sanitizeField(c.location, 100) || 'local area'}
Brand tone: ${sanitizeField(c.tone, 80) || 'professional and approachable'}
Visual style: ${sanitizeField(c.visual_style, 80) || 'modern and clean'}`;

    if (services.length > 0) {
      ctx += `\n\nActual services this business offers (scraped from their website — reference these specifically):`;
      services.slice(0, 10).forEach(s => { ctx += `\n- ${s}`; });
    }

    if (c.website_about) {
      ctx += `\n\nAbout this business:\n${c.website_about.substring(0, 400)}`;
    }

    if (c.brand_colors) {
      const colors = Array.isArray(c.brand_colors) ? c.brand_colors.join(', ') : c.brand_colors;
      if (colors) ctx += `\n\nBrand colors: ${colors} — reference these in image prompts where relevant.`;
    }

    return ctx;
  }

  // ── Section 2: Industry Expertise ────────────────────────────────────────
  _section2_industryExpertise() {
    const k = this.knowledge;

    let expertise = `=== INDUSTRY EXPERTISE (${this.customer.industry?.toUpperCase() || 'GENERAL'}) ===
You have deep knowledge of this industry. Use this to make every post feel specific and credible.`;

    if (this.seasonal) {
      expertise += `\n\nCurrent seasonal context (${this._getMonthName(this.currentMonth)}):
- Most urgent topic right now: ${this.seasonal.urgencyTopic}
- Best tip to share: ${this.seasonal.tipTopic}
- Promotion angle: ${this.seasonal.promotionAngle}`;
      if (this.seasonal.emotionalContext) {
        expertise += `\n- Emotional temperature of your audience: ${this.seasonal.emotionalContext}`;
      }
      if (this.seasonal.postIdea) {
        expertise += `\n- Proven post idea for this month: ${this.seasonal.postIdea}`;
      }
      if (this.seasonal.engagementHook) {
        expertise += `\n- High-engagement question to use: ${this.seasonal.engagementHook}`;
      }
      expertise += `\nIMPORTANT: Weave seasonal urgency naturally into the post — don't force it.`;
    }

    if (k.customerPainPoints?.length > 0) {
      const selected = k.customerPainPoints.slice(0, 4);
      expertise += `\n\nReal customer pain points to reference naturally (use their exact language):`;
      selected.forEach(p => { expertise += `\n- "${p}"`; });
    }

    // Trade terminology — makes copy sound like a real professional wrote it
    if (k.tradeTerminology?.length > 0) {
      expertise += `\n\nTrade terminology to use naturally (these words signal authenticity to homeowners):`;
      expertise += `\n${k.tradeTerminology.slice(0, 12).join(', ')}`;
      expertise += `\nUse 2-3 of these per post where they fit naturally. Never force them.`;
    }

    // Content angle — match to wizard trigger if one is provided
    if (k.contentAngles?.length > 0 && this.wizardTrigger) {
      const triggerAngleMap = {
        share_tip: ['water_bill_detective', 'flushable_wipes_myth', 'water_quality', 'diy_warning', 'emergency_prevention'],
        finished_job: ['job_reveal', 'team_story'],
        got_review: ['team_story'],
        faq: ['tankless_debate', 'water_heater_age', 'water_bill_detective'],
        seasonal: ['emergency_prevention', 'slab_leak_warning'],
      };
      const relevantAngles = triggerAngleMap[this.wizardTrigger] || [];
      const matchedAngle = k.contentAngles.find(a => relevantAngles.includes(a.angle));
      if (matchedAngle) {
        expertise += `\n\nHigh-performing content angle for this post type:`;
        expertise += `\n- Hook: "${matchedAngle.hook}"`;
        expertise += `\n- Why it works: ${matchedAngle.why}`;
        expertise += `\nUse this angle as inspiration — adapt it to the specific details provided.`;
      }
    }

    if (k.trustSignals?.length > 0) {
      expertise += `\n\nTrust signals to weave in naturally (pick 1-2 that fit):`;
      k.trustSignals.slice(0, 4).forEach(s => { expertise += `\n- ${s}`; });
    }

    if (k.localKeywords?.length > 0) {
      const loc = this.customer.location || 'your city';
      expertise += `\n\nLocal SEO phrases (replace [city] with "${loc}"):`;
      k.localKeywords.slice(0, 4).forEach(kw => { expertise += `\n- ${kw.replace(/\[city\]/g, loc)}`; });
    }

    if (k.hookFormulas?.length > 0) {
      const loc = this.customer.location || 'your city';
      expertise += `\n\nProven hook formulas — use a DIFFERENT one for each variation:`;
      k.hookFormulas.slice(0, 5).forEach((h, i) => {
        expertise += `\n${i + 1}. "${h.replace(/\[city\]/g, loc)}"`;
      });
    }

    if (k.ctaVariations?.length > 0) {
      const loc = this.customer.location || 'your city';
      expertise += `\n\nEffective CTAs for this industry:`;
      k.ctaVariations.slice(0, 4).forEach(cta => { expertise += `\n- ${cta.replace(/\[city\]/g, loc)}`; });
    }

    return expertise;
  }

  // ── Section 3: Platform-Specific Writing Rules ────────────────────────────
  _section3_platformRules() {
    const rules = {
      facebook: `Platform: FACEBOOK
- Length: 150-300 words
- Tone: conversational, like talking to a neighbour
- Hashtags: 2-3 maximum, broad + local only
- Emojis: 1-2 max — subtle, not overdone
- MUST end with a direct question to drive comments
- Reference the local area or city naturally
- Personal stories and community connection work best`,

      instagram: `Platform: INSTAGRAM
- Length: 100-150 words in caption
- First line MUST be a scroll-stopping hook (only line visible before "more")
- Tone: visual-first — write as if describing something beautiful or satisfying to watch
- Hashtags: 8-15 (3 broad + 5 niche + 4 local + 3 industry-specific)
- Emojis: 3-5 per post — welcome and expected
- Always end with an engagement question
- Language: "Look at this..." "See how..." "Can you believe..."`,

      google_business: `Platform: GOOGLE BUSINESS PROFILE
- Length: 100-200 words
- Tone: professional, keyword-rich, trust-building
- Hashtags: NONE — use keywords naturally instead
- Include the city and service type naturally at least once
- Must include a hard CTA: phone number reference or "call us today"
- Every post should boost local search rankings
- Use phrases customers actually search: "[city] [service]"`,

      linkedin: `Platform: LINKEDIN
- Length: 150-300 words
- Tone: professional, business-focused, thought leadership
- Hashtags: 3-5 relevant professional/industry hashtags
- Emojis: minimal (0-2 max) — keep it credible
- End with a thought-provoking question to drive professional discussion
- Showcase expertise, credibility, and business results
- Focus on business value and professional insights`,

      tiktok: `Platform: TIKTOK
- Length: 50-80 words (video-first platform — caption is secondary)
- Hook in the first 3 words — must grab instantly
- Tone: casual, energetic, authentic, relatable
- Hashtags: 5-8 hashtags mixing trending, niche, and local tags
- Emojis: 3-5 energetic emojis
- Direct CTA: Follow, Comment, or Share focused
- Write as if the viewer just paused their scroll`,

      all: `Platform: ALL PLATFORMS (Facebook + Instagram + Google Business)
Generate 3 separate, fully-written variations — one per platform:
- Variation A: Facebook — conversational, 150-200 words, 2-3 hashtags, question at end
- Variation B: Instagram — visual-first hook, 100-150 words, 8-15 hashtags, 3-5 emojis
- Variation C: Google Business — keyword-rich, 100-200 words, no hashtags, hard CTA with city name`,
    };

    return `=== PLATFORM RULES ===\n${rules[this.platform] || rules.all}`;
  }

  // ── Section 4: Content Type Rules ────────────────────────────────────────
  _section4_contentTypeRules() {
    const triggerRules = {
      finished_job: `Content trigger: FINISHED A JOB
Structure: Situation → What was done → The result → Customer outcome → CTA
Include: Job type, location (from answers), any unique detail
Tone: proud and craftsman-like, not boastful`,

      share_tip: `Content trigger: SHARING A TIP (Educational — 70% of content should be this)
Structure: Hook (pain point or surprising fact) → Tip → Why it matters → Soft CTA
Tone: expert friend giving free advice — never preachy
End: engagement question asking about their experience`,

      got_review: `Content trigger: GOT A GREAT REVIEW
Structure: Customer story → The outcome they experienced → Quote or paraphrase → Social proof CTA
Never: invent quotes. Use placeholder [Customer Name] if not provided.
Tone: genuinely grateful, warm`,

      promotion: `Content trigger: RUNNING A PROMOTION
Structure: What the offer is → The value → Why now → Hard CTA
Keep: promotional tone to 10% of overall content mix
Urgency: time-bound if possible`,

      seasonal: `Content trigger: SEASONAL CONTENT
Structure: Seasonal urgency → What it means for homeowners → What to do → CTA
Must: reference current month's urgency topic from industry knowledge`,

      faq: `Content trigger: FAQ / MYTH-BUSTING (Educational)
Structure: Question (as headline) → Common myth → The truth → Why it matters → CTA
Format: Q&A works well here — "Q: [question] A: [expert answer]"`,

      behind_scenes: `Content trigger: BEHIND THE SCENES / TEAM SPOTLIGHT
Structure: Introduce the moment → What's happening → The skill or effort involved → CTA
Tone: human, real, relatable — this is where authenticity wins`,

      community: `Content trigger: COMMUNITY / LOCAL EVENT
Structure: Event or place → Connection to business → Community value → CTA
Keep: local focus tight — neighbourhood level, not just city`,
    };

    const contentTypeRules = {
      static: 'Content format: TEXT CARD — write only the caption text. No image description needed.',
      photo: 'Content format: PHOTO POST — include an imagePrompt for each variation describing what the AI image should look like. Be specific: lighting, angle, subject, style.',
      carousel: `Content format: CAROUSEL (5 slides)
In addition to the main caption, provide slide text:
Slide 1: Hook — stops the scroll
Slide 2: Point 1 / Step 1
Slide 3: Point 2 / Step 2
Slide 4: Point 3 / Step 3
Slide 5: CTA — what to do next
Keep each slide text to 8 words or fewer (fits on image).`,
      video: `Content format: VIDEO SCRIPT
Write a 20-30 second spoken script in addition to the post caption.
Structure: Hook (0-3s) → Core message (4-20s) → CTA (21-30s)
Spoken language: natural, not scripted-sounding — conversational`,
    };

    const triggerRule = this.wizardTrigger
      ? (triggerRules[this.wizardTrigger] || '')
      : '';

    let rules = `=== CONTENT TYPE RULES ===
${triggerRule ? triggerRule + '\n\n' : ''}${contentTypeRules[this.contentType] || contentTypeRules.photo}`;

    // Inject real FAQ pairs when the trigger is FAQ content
    const k = this.knowledge;
    if ((this.wizardTrigger === 'faq' || this.contentType === 'static') && k.faqPairs?.length > 0) {
      rules += `\n\nReal FAQ pairs from this industry (use one as the basis for the post, or let the customer's question override):`;
      k.faqPairs.slice(0, 4).forEach(pair => {
        rules += `\nQ: ${pair.q}\nA: ${pair.a}\n`;
      });
    }

    const prefs = this.customer.content_preferences;
    if (prefs && typeof prefs === 'object' && !Array.isArray(prefs)) {
      const edu = prefs.educational ?? 70;
      const social = prefs.social_proof ?? 20;
      const promo = prefs.promotional ?? 10;
      rules += `\n\nThis customer's content mix target: ${edu}% educational, ${social}% social proof, ${promo}% promotional. Ensure this post fits within their chosen balance.`;
    }

    return rules;
  }

  // ── Section 5: Brand Voice + Few-Shot ────────────────────────────────────
  _section5_brandVoice() {
    const c = this.customer;
    const effectiveTone = this.wizardTone || c.tone || 'professional and approachable';
    let voice = `=== BRAND VOICE ===
Tone: ${effectiveTone}
Writing style: ${c.visual_style === 'bold' ? 'punchy and direct' : c.visual_style === 'minimal' ? 'clean and concise' : 'warm and conversational'}

PostCore voice rules (non-negotiable):
- Write like a trusted local expert, not a corporate marketing team
- Never use: "delve", "synergy", "leverage", "utilize", "optimize"
- Plain language a tradesperson would use and be proud of
- The business owner should read it and think "that sounds exactly like me"
- Every post ends with an engagement question — this is non-negotiable`;

    if (this.wizardTone) {
      voice += `\nIMPORTANT: The customer specifically selected "${this.wizardTone}" as the tone for THIS post — this overrides their default profile tone. Make the tone shift noticeable and intentional.`;
    }

    if (c.past_post_examples?.length > 0) {
      voice += `\n\nExamples of this business's best past posts (match this style and voice exactly):`;
      c.past_post_examples.slice(0, 3).forEach((ex, i) => {
        voice += `\n\nExample ${i + 1}:\n"${ex}"`;
      });
    }

    if (this.businessKnowledge.length > 0) {
      voice += `\n\nBusiness knowledge base (injected by the owner — use this to ground every post in their reality):`;
      this.businessKnowledge.forEach(k => {
        const label = k.title ? `[${k.knowledge_type.toUpperCase()}] ${k.title}` : `[${k.knowledge_type.toUpperCase()}]`;
        const content = typeof k.content === 'string' ? k.content : JSON.stringify(k.content);
        voice += `\n\n${label}:\n${content.substring(0, 300)}`;
      });
    }

    const testimonials = (() => {
      try {
        const raw = this.customer.website_testimonials;
        if (!raw) return [];
        return Array.isArray(raw) ? raw : JSON.parse(raw);
      } catch { return []; }
    })();

    if (testimonials.length > 0) {
      voice += `\n\nReal customer testimonials from this business's website (mirror how their customers talk about them — use this language and these outcomes in your writing):`;
      testimonials.slice(0, 2).forEach((t, i) => {
        voice += `\n${i + 1}. "${t.text}"${t.author ? ` — ${t.author}` : ''}`;
      });
    }

    return voice;
  }

  // ── Section 6: Output Format ──────────────────────────────────────────────
  _section6_outputFormat() {
    const isCarousel = this.contentType === 'carousel';
    const isVideo = this.contentType === 'video';
    const isStatic = this.contentType === 'static';

    const imageGuidance = this._buildImagePromptGuidance();

    return `=== OUTPUT FORMAT (CRITICAL — ALWAYS FOLLOW THIS EXACTLY) ===
Return ONLY valid JSON. No markdown, no backticks, no explanation before or after. First character: { Last character: }

${imageGuidance}
{
  "imagePrompt": "A SINGLE shared image prompt used for ALL 3 variations. Must be universal — not tailored to any specific variation. Include: subject, setting, lighting, style, mood, composition. Be specific enough to generate a professional photo. Use the IMAGE PROMPT GUIDANCE above.",${isCarousel ? `
  "carouselSlides": [
    { "slideNumber": 1, "overlayText": "max 8 words", "description": "what this slide shows visually" },
    { "slideNumber": 2, "overlayText": "max 8 words", "description": "what this slide shows visually" },
    { "slideNumber": 3, "overlayText": "max 8 words", "description": "what this slide shows visually" }
  ],` : ''}
  "variation_a": {
    "caption": "Full caption text for variation A",
    "hashtags": ["tag1", "tag2", "tag3"],
    "engagementQuestion": "The question at the end of the caption (extracted separately for UI display)",
    "hookFormulaUsed": "Which hook formula from the industry knowledge was used",
    "engagementScore": 75${isVideo ? `,
    "videoScript": "The 20-30 second spoken script"` : ''}
  },
  "variation_b": {
    "caption": "Full caption text for variation B — different hook, same quality",
    "hashtags": ["tag1", "tag2"],
    "engagementQuestion": "Different engagement question",
    "hookFormulaUsed": "Which hook formula was used",
    "engagementScore": 68
  },
  "variation_c": {
    "caption": "Full caption text for variation C — different tone or angle",
    "hashtags": ["tag1", "tag2"],
    "engagementQuestion": "Different engagement question",
    "hookFormulaUsed": "Which hook formula was used",
    "engagementScore": 71
  }
}

Rules for all 3 variations:
- Each variation MUST use a different hook formula from the industry knowledge
- Each variation MUST end with a different engagement question
- engagementScore is 0-100 — your honest assessment of predicted engagement
- Variation A is for Facebook, B for Instagram, C for Google Business (even if platform = 'all')
- imagePrompt MUST work for ALL three variations — it is shared and generated once (saves cost)
- NEVER output the same hashtag set for multiple variations${isCarousel ? `
- Carousel: Include 3-7 slides in carouselSlides. Decide count based on topic complexity: simple tips = 3, step-by-step processes = 5-6, complex how-tos = 7. Keep each overlayText under 8 words.` : ''}

CRITICAL JSON SAFETY RULES (violations cause parse errors):
- Do NOT put quotation marks inside string values — write: John said it was amazing. NOT: John said "it was amazing."
- Use \\n only for intentional line breaks inside strings, never raw newline characters
- Every string value must be complete and properly closed with a matching double-quote
- No trailing commas after the last property in any object or array
- The FIRST character of your entire response must be { and the LAST must be }`;

  }

  // ── User Prompt (the actual request) ─────────────────────────────────────
  _buildUserPrompt() {
    const answers = this.counterAnswers;
    const loc = this.customer.location || 'local area';

    let prompt = `Generate 3 social media post variations for ${this.customer.business_name || 'this business'}.`;

    if (this.wizardTrigger) {
      const triggerLabels = {
        finished_job: 'They just finished a job',
        share_tip: 'They want to share a helpful tip',
        got_review: 'They received a great customer review',
        promotion: 'They are running a promotion or special offer',
        seasonal: `Seasonal content for ${this._getMonthName(this.currentMonth)}`,
        faq: 'They want to answer a common customer question',
        behind_scenes: 'Behind-the-scenes look at their work',
        community: 'Community or local event content',
      };
      prompt += `\nContent type: ${triggerLabels[this.wizardTrigger] || this.wizardTrigger}`;
    }

    if (Object.keys(answers).length > 0) {
      prompt += '\n\nSpecific details provided by the business owner:';
      if (answers.location) prompt += `\n- Location / neighbourhood: ${answers.location}`;
      if (answers.job_description) prompt += `\n- Job description: ${answers.job_description}`;
      if (answers.neighborhood) prompt += `\n- Neighbourhood: ${answers.neighborhood}`;
      if (answers.customer_reaction) prompt += `\n- Customer reaction: ${answers.customer_reaction}`;
      if (answers.tip_topic) prompt += `\n- Tip topic: ${answers.tip_topic}`;
      if (answers.tip_audience) prompt += `\n- Tip audience: ${answers.tip_audience}`;
      if (answers.review_text) prompt += `\n- Customer review: ${answers.review_text}`;
      if (answers.customer_name) prompt += `\n- Customer name: ${answers.customer_name}`;
      if (answers.job_type) prompt += `\n- Job type: ${answers.job_type}`;
      if (answers.promo_offer) prompt += `\n- Promotion offer: ${answers.promo_offer}`;
      if (answers.promo_deadline) prompt += `\n- Offer deadline: ${answers.promo_deadline}`;
      if (answers.promo_reason) prompt += `\n- Reason for promotion: ${answers.promo_reason}`;
      if (answers.seasonal_angle) prompt += `\n- Seasonal angle: ${answers.seasonal_angle}`;
      if (answers.community_event) prompt += `\n- Community event: ${answers.community_event}`;
      if (answers.why_it_matters) prompt += `\n- Why it matters: ${answers.why_it_matters}`;
      if (answers.question) prompt += `\n- Customer question to answer: ${answers.question}`;
      if (answers.myth) prompt += `\n- Myth to bust: ${answers.myth}`;
      if (answers.spotlight_subject) prompt += `\n- Spotlight subject: ${answers.spotlight_subject}`;
      if (answers.fun_fact) prompt += `\n- Fun fact: ${answers.fun_fact}`;
      if (answers.before_state) prompt += `\n- Before state / problem: ${answers.before_state}`;
      if (answers.transformation) prompt += `\n- Transformation level: ${answers.transformation}`;
      if (answers.unique) prompt += `\n- Unique detail about this job: ${answers.unique}`;
      if (answers.challenge) prompt += `\n- Technical challenge: ${answers.challenge}`;
      if (answers.cta) prompt += `\n- Preferred call to action: ${answers.cta}`;
      if (answers.emergency) prompt += `\n- Was this an emergency?: ${answers.emergency}`;
      if (answers.pain_point) prompt += `\n- Customer main pain point: ${answers.pain_point}`;
      if (answers.custom) prompt += `\n- Additional context: ${answers.custom}`;
    }

    prompt += `\n\nPlatform target: ${this.platform}`;
    prompt += `\nContent format: ${this.contentType}`;
    prompt += `\nBusiness location: ${loc}`;
    prompt += '\n\nRespond with ONLY the JSON object. Start with { and end with }. No markdown, no backticks, no explanation. Never put quotation marks inside a string value.';

    return prompt;
  }

  // ── Image prompt guidance from industry imageVisuals ──────────────────────
  _buildImagePromptGuidance() {
    const iv = this.knowledge.imageVisuals;
    if (!iv || this.contentType === 'static') return '';

    const season = this._getCurrentSeason();
    const seasonalVisual = iv.seasonalVisuals?.[season] || '';
    const brandColors = (() => {
      const c = this.customer;
      if (!c.brand_colors) return '';
      const colors = Array.isArray(c.brand_colors) ? c.brand_colors.join(', ') : c.brand_colors;
      return colors ? `If incorporating branded elements, the business brand colors are: ${colors}.` : '';
    })();

    let guidance = `=== IMAGE PROMPT GUIDANCE FOR THIS INDUSTRY ===
When writing the imagePrompt, follow these industry-specific visual rules exactly:

`;
    if (iv.keyElements?.length > 0) {
      guidance += `Authentic visual elements to include (choose the most relevant 3-4):
${iv.keyElements.map(e => `- ${e}`).join('\n')}

`;
    }
    if (iv.authenticScenes?.length > 0) {
      guidance += `Authentic scene types that perform best for this industry (pick one as the setting):
${iv.authenticScenes.slice(0, 4).map(s => `- ${s}`).join('\n')}

`;
    }
    if (iv.moodAndLighting) {
      guidance += `Mood and lighting: ${iv.moodAndLighting}

`;
    }
    if (iv.composition) {
      guidance += `Composition guidance: ${iv.composition}

`;
    }
    if (iv.colorPalette) {
      guidance += `Natural color palette for this industry: ${iv.colorPalette}

`;
    }
    if (seasonalVisual) {
      guidance += `Seasonal visual context for ${season}: ${seasonalVisual}

`;
    }
    if (iv.avoidCliches?.length > 0) {
      guidance += `NEVER use these generic clichés (they make the image look like stock photography):
${iv.avoidCliches.map(a => `- ${a}`).join('\n')}

`;
    }
    if (brandColors) {
      guidance += `${brandColors}

`;
    }
    guidance += `The imagePrompt must feel like a real job-site photo, not a studio shoot or stock photo. Specificity = credibility.`;

    return guidance;
  }

  _getCurrentSeason() {
    const m = this.currentMonth;
    if (m >= 3 && m <= 5) return 'spring';
    if (m >= 6 && m <= 8) return 'summer';
    if (m >= 9 && m <= 11) return 'fall';
    return 'winter';
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  _extractServices() {
    const c = this.customer;
    if (!c.website_services) return [];
    try {
      const services = typeof c.website_services === 'string'
        ? JSON.parse(c.website_services)
        : c.website_services;
      if (!Array.isArray(services)) return [];
      return services.map(s => (typeof s === 'string' ? s : s.name || s.service || JSON.stringify(s)));
    } catch {
      return [];
    }
  }

  _getMonthName(month) {
    return ['January','February','March','April','May','June',
            'July','August','September','October','November','December'][month - 1];
  }
}

module.exports = SystemPromptBuilder;
