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

    const industryLabel = sanitizeField(c.industry, 60) || 'home services';

    let ctx = `=== WHO YOU ARE ===
You are ItsPosting AI — a dual expert who combines:
- 20+ years of hands-on experience working IN the ${industryLabel} trade (you know every technique, material, tool, seasonal challenge, and homeowner fear from the inside)
- 30+ years of social media strategy, copywriting, and content design (you know exactly what hooks stop the scroll, what stories drive comments, what formats convert followers into customers)

You write for LOCAL SERVICE BUSINESSES. Your posts must sound like they were written by the actual business owner — a real tradesperson who knows their craft, loves their community, and speaks plainly. Never corporate. Never generic. Never AI-sounding.

The test for every post: could a homeowner read this and think "this was written by a real plumber / roofer / HVAC tech who knows their stuff and cares about their customers"? If not, rewrite it until it passes that test.

=== BUSINESS CONTEXT ===
Business name: ${sanitizeField(c.business_name, 100) || 'a local service business'}
Industry: ${industryLabel}
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
      expertise += `\n\nReal customer pain points — this is how your audience ACTUALLY feels and talks. Reference their language verbatim, don't paraphrase:`;
      k.customerPainPoints.slice(0, 6).forEach(p => { expertise += `\n- "${p}"`; });
    }

    // Trade terminology — makes copy sound like a real professional wrote it
    if (k.tradeTerminology?.length > 0) {
      expertise += `\n\nTrade terminology to use naturally (these words signal authenticity to homeowners):`;
      expertise += `\n${k.tradeTerminology.slice(0, 12).join(', ')}`;
      expertise += `\nUse 2-3 of these per post where they fit naturally. Never force them.`;
    }

    // Content angle — match to wizard trigger by type (works for ALL industries)
    if (k.contentAngles?.length > 0 && this.wizardTrigger) {
      // Maps trigger → the angle types that perform best for it.
      // Using type (not angle ID) so this works across every industry in industryKnowledge.js.
      // Covers all angle types found across all 17 industries in the knowledge base.
      const triggerTypeMap = {
        share_tip:     ['educational', 'safety_warning', 'safety_educational', 'engagement'],
        finished_job:  ['before_after', 'job_reveal', 'customer_story', 'behind_scenes', 'process_transparency', 'project_showcase', 'capability_showcase', 'service_showcase'],
        got_review:    ['team_story', 'social_proof', 'customer_story', 'emotional_educational'],
        faq:           ['faq', 'educational', 'engagement'],
        seasonal:      ['seasonal_warning', 'seasonal', 'seasonal_urgency', 'seasonal_event', 'safety_warning', 'educational', 'targeted_urgent'],
        community:     ['community', 'educational', 'values_content', 'b2b_targeting'],
        team_spotlight: ['team_spotlight', 'team_story', 'behind_scenes'],
        team_spotlight: ['team_spotlight', 'team_story', 'social_proof', 'emotional_educational'],
        behind_scenes:  ['behind_scenes', 'process_transparency', 'process_video', 'service_showcase', 'team_story', 'team_spotlight'],
        promotion:     ['promotional', 'social_proof', 'values_content', 'capability_showcase', 'targeted_urgent', 'b2b_targeting', 'educational'],
      };
      const engagementOrder = { very_high: 0, high: 1, medium_high: 2, medium: 3 };
      const relevantTypes = triggerTypeMap[this.wizardTrigger] || null;
      let matchedAngle;
      if (relevantTypes) {
        // Pick the highest-engagement angle matching this trigger's content types
        matchedAngle = k.contentAngles
          .filter(a => relevantTypes.includes(a.type))
          .sort((a, b) => (engagementOrder[a.engagementLevel] ?? 99) - (engagementOrder[b.engagementLevel] ?? 99))[0];
      } else {
        // custom or unknown trigger: use the overall highest-engagement angle for this industry
        matchedAngle = k.contentAngles.slice()
          .sort((a, b) => (engagementOrder[a.engagementLevel] ?? 99) - (engagementOrder[b.engagementLevel] ?? 99))[0];
      }
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
      expertise += `\n\nProven hook formulas for this industry — use a DIFFERENT one for each variation (A, B, C must each have a completely different opening energy):`;
      k.hookFormulas.slice(0, 6).forEach((h, i) => {
        expertise += `\n${i + 1}. "${h.replace(/\[city\]/g, loc)}"`;
      });
      expertise += `\nAdapt these hooks to the specific details provided — don't copy them word for word.`;
    }

    if (k.ctaVariations?.length > 0) {
      const loc = this.customer.location || 'your city';
      expertise += `\n\nEffective CTAs for this industry:`;
      k.ctaVariations.slice(0, 4).forEach(cta => { expertise += `\n- ${cta.replace(/\[city\]/g, loc)}`; });
    }

    if (k.contentThemes?.length > 0) {
      expertise += `\n\nContent formats that consistently perform BEST for this industry (lean toward these):`;
      k.contentThemes.forEach(theme => {
        expertise += `\n- ${theme.replace(/_/g, ' ')}`;
      });
    }

    return expertise;
  }

  // ── Section 3: Platform-Specific Writing Rules ────────────────────────────
  _section3_platformRules() {
    const loc = this.customer.location || 'your city';
    const industry = this.customer.industry || 'home_services';
    const cityTag = loc.replace(/\s+/g, '');

    // Industry → core hashtag seeds (high-performing, non-generic)
    const industrySeedTags = {
      plumbing:          ['Plumber', 'Plumbing', 'PlumbingLife', 'PlumbingTips', 'EmergencyPlumber', 'DrainCleaning', 'WaterHeater', 'LeakRepair', 'PipeFix', 'HomeRepair'],
      hvac:              ['HVAC', 'HVACTech', 'HVACLife', 'AirConditioning', 'ACRepair', 'HeatingAndCooling', 'FurnaceRepair', 'HVACService', 'IndoorAirQuality', 'HomeComfort'],
      roofing:           ['Roofing', 'RoofRepair', 'RoofReplacement', 'Roofer', 'RoofingContractor', 'NewRoof', 'RoofInspection', 'StormDamage', 'RoofingLife', 'HomeImprovement'],
      concrete:          ['Concrete', 'ConcreteWork', 'ConcreteDriveway', 'ConcreteContractor', 'ConcreteLife', 'DrivewayConcrete', 'FoundationRepair', 'ConcretePatio', 'ConcreteFloor', 'MasonryWork'],
      landscaping:       ['Landscaping', 'LandscapeDesign', 'LawnCare', 'LawnMaintenance', 'Landscaper', 'GardenDesign', 'OutdoorLiving', 'CurbAppeal', 'LandscapingLife', 'YardTransformation'],
      electrical:        ['Electrician', 'ElectricalWork', 'ElectricalContractor', 'ElectricalRepair', 'ElectricalLife', 'HomeElectrical', 'CircuitBreaker', 'PanelUpgrade', 'WiringRepair', 'ElectricianLife'],
      painting:          ['PaintingContractor', 'HousePainting', 'InteriorPainting', 'ExteriorPainting', 'Painter', 'PaintLife', 'HomeRenovation', 'FreshPaint', 'WallPainting', 'PaintTransformation'],
      pest_control:      ['PestControl', 'PestManagement', 'Exterminator', 'PestFree', 'BugControl', 'TermiteControl', 'PestRemoval', 'HomeProtection', 'PestControlLife', 'PestSolutions'],
      general_contractor:['GeneralContractor', 'HomeRenovation', 'Remodeling', 'Contractor', 'HomeImprovement', 'Construction', 'RemodelLife', 'ContractorLife', 'HomeRemodel', 'BuildingContractor'],
      cleaning:          ['CleaningService', 'HouseCleaning', 'ProfessionalCleaning', 'HomeCleaning', 'CleanHome', 'DeepCleaning', 'MaidService', 'CleaningBusiness', 'SpotlessHome', 'CleaningLife'],
    };
    const seeds = industrySeedTags[industry] || industrySeedTags.general_contractor;

    // Cross-industry community tags (trades culture) — rotate, don't use all
    const communityTags = ['HomeImprovement', 'TradesLife', 'SkilledTrades', 'BlueCollar', 'TradesTok', 'FixItFriday', 'HomeOwner', 'HomeOwnerLife', 'DIYorHireAPro', 'SkillsPayBills'];

    const hashtagGuide = `
HASHTAG STRATEGY — follow this tiered system for every post:

Industry seed tags to draw from (pick the most relevant for each post): ${seeds.map(t => '#' + t).join(', ')}
Local tags to always include: #${cityTag}${seeds[0]}, #${cityTag}HomeRepair, #${cityTag}Homes, #${cityTag}HomeServices
Community/trades tags to rotate in: ${communityTags.slice(0, 6).map(t => '#' + t).join(', ')}

TIER RULES (critical for reach):
• Tier 1 — MEGA (1 tag): Single-word industry tag with millions of posts. Gets you into the main feed.
  e.g. #${seeds[0]} or #HomeImprovement
• Tier 2 — VOLUME (2-3 tags): Compound industry terms, 100K–1M posts. Less competition, still big.
  e.g. #${seeds[1]}, #${seeds[2]}
• Tier 3 — NICHE (3-4 tags): Specific service performed in THIS post, 10K–100K posts. Highest relevance.
  e.g. #${seeds[4]}, #${seeds[6]} — describe exactly what happened
• Tier 4 — LOCAL (3-4 tags): ALWAYS include. Local homeowners actively search these.
  #${cityTag}${seeds[0]}, #${cityTag}HomeRepair, #${cityTag}Homes (NO spaces in city hashtags)
• Tier 5 — COMMUNITY (1-2 tags): Trades culture tags. Builds brand affinity.
  #TradesLife or #SkilledTrades

HARD RULES:
- NEVER use generic lifestyle tags (#home, #love, #life, #happy, #instagood) — they bury your post instantly
- City name in hashtags: remove all spaces (Austin TX → #AustinTX, not #Austin TX)
- Each variation (A, B, C) MUST use a DIFFERENT set of hashtags — rotate which tiers you emphasise
- Match hashtags to the post content: if the post is about drain cleaning, use #DrainCleaning not just #Plumber
- Seasonal posts get seasonal hashtags: winter → #FrozenPipes, spring → #SpringCleaning, etc.`;

    const rules = {
      facebook: `Platform: FACEBOOK
- Length: 150-300 words
- Tone: conversational, like talking to a neighbour
- Hashtags: 2-3 only — 1 local (#${cityTag}${seeds[0]}) + 1-2 broad industry (#${seeds[0]} or #HomeImprovement)
- Emojis: 1-2 max — subtle, not overdone
- MUST end with a direct question to drive comments
- Reference the local area or city naturally
- Personal stories and community connection work best`,

      instagram: `Platform: INSTAGRAM
- Length: 100-150 words in caption
- First line MUST be a scroll-stopping hook (only line visible before "more")
- Tone: visual-first — write as if describing something beautiful or satisfying to watch
- Hashtags: 12-15 total using the 5-tier system above (Mega + Volume + Niche + Local + Community)
- Emojis: 3-5 per post — welcome and expected
- Always end with an engagement question
- Language: "Look at this..." "See how..." "Can you believe..."`,

      google_business: `Platform: GOOGLE BUSINESS PROFILE
- Length: 100-200 words
- Tone: professional, keyword-rich, trust-building
- Hashtags: NONE — use keywords naturally in the text instead (${loc} [service type])
- Include the city and service type naturally at least once
- Must include a hard CTA: phone number reference or "call us today"
- Every post should boost local search rankings
- Use phrases customers actually search: "${loc} [service]"`,

      linkedin: `Platform: LINKEDIN
- Length: 150-300 words
- Tone: professional, business-focused, thought leadership
- Hashtags: 3-5 — mix of industry (#${seeds[0]}, #HomeImprovement) + professional (#SmallBusiness, #Entrepreneurship, #Trades)
- Emojis: minimal (0-2 max) — keep it credible
- End with a thought-provoking question to drive professional discussion
- Showcase expertise, credibility, and business results`,

      tiktok: `Platform: TIKTOK
- Length: 50-80 words (video-first platform — caption is secondary)
- Hook in the first 3 words — must grab instantly
- Tone: casual, energetic, authentic, relatable
- Hashtags: 6-8 — 1 mega + 2 niche + 2 local + 1-2 community (#TradesTok, #BlueCollar, #FixItFriday)
- Emojis: 3-5 energetic emojis
- Direct CTA: Follow, Comment, or Share focused
- Write as if the viewer just paused their scroll`,

      all: `Platform: ALL PLATFORMS (Facebook + Instagram + Google Business)
Generate 3 separate, fully-written variations — one per platform:
- Variation A: Facebook — conversational, 150-200 words, 2-3 hashtags (#${cityTag}${seeds[0]} + 1-2 broad), question at end
- Variation B: Instagram — visual-first hook, 100-150 words, 12-15 hashtags using 5-tier system above, 3-5 emojis
- Variation C: Google Business — keyword-rich, 100-200 words, ZERO hashtags, hard CTA with city name`,
    };

    return `=== PLATFORM RULES ===${hashtagGuide}\n\n${rules[this.platform] || rules.all}`;
  }

  // ── Section 4: Content Type Rules ────────────────────────────────────────
  _section4_contentTypeRules() {
    const triggerRules = {
      custom: `Content trigger: CUSTOM / FREE-FORM IDEA
The business owner has their own specific idea for this post — it does NOT fit a standard template.
Structure: Interpret their idea → craft the best possible hook → deliver the message → end with engagement question
IMPORTANT: Honour the intent of their idea exactly. Do not substitute a generic template.
Tone: match the tone they selected; make it sound genuinely human and local`,

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

      team_spotlight: `Content trigger: TEAM SPOTLIGHT
Structure: Introduce the person or milestone → What makes them stand out (specific skill, years, achievement) → A real moment or story → CTA
Include: First name only, years of experience, a specific detail that makes them human and memorable
Tone: warm and proud — this is about the person, not the sale. The business is the supporting character.
End: a question that invites the audience to share their own experience with the team or a memory of great service`,

      behind_scenes: `Content trigger: BEHIND THE SCENES
Structure: Set the scene → What's happening and why it matters → The craft or effort involved → CTA
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

    // Inject FAQ pairs — always inject for context; inject more when trigger is FAQ
    const k = this.knowledge;
    if (k.faqPairs?.length > 0) {
      const isFaqTrigger = this.wizardTrigger === 'faq' || this.contentType === 'static';
      const count = isFaqTrigger ? 4 : 2;
      const label = isFaqTrigger
        ? 'Real customer questions from this industry (use one as the basis, or let the customer\'s own question override):'
        : 'Top customer questions in this industry (use this as context to make the post sharper and more useful):';
      rules += `\n\n${label}`;
      k.faqPairs.slice(0, count).forEach(pair => {
        // Handle both {q, a} and legacy {question, answer} formats
        const q = pair.q || pair.question;
        const a = pair.a || pair.answer;
        if (q && a) rules += `\nQ: ${q}\nA: ${a}\n`;
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
    let voice = `=== BRAND VOICE & WRITING STANDARDS ===
Tone for this post: ${effectiveTone}
Writing style: ${c.visual_style === 'bold' ? 'punchy and direct — short sentences, sharp impact' : c.visual_style === 'minimal' ? 'clean and concise — no filler, every word earns its place' : 'warm and conversational — like a neighbor who happens to be the best in the trade'}

ItsPosting AI writing rules (non-negotiable):
- Sound like a real tradesperson, not a marketing department. Use the language of the job site.
- Specificity beats generality every single time. "We replaced 18 feet of galvanized pipe with PEX" beats "We completed a plumbing repair."
- Show the work. Real details create credibility. Vague claims destroy it.
- Address the homeowner directly. They are scared, frustrated, or excited. Meet them where they are.
- NEVER use: "delve", "synergy", "leverage", "utilize", "optimize", "robust", "holistic", "paradigm", "comprehensive", "streamlined", "transform your", "unlock", "empower" — these are instant AI-content giveaways that destroy trust with trade customers
- NEVER start with "Are you looking for..." or "As a [industry] professional..." — these are dead giveaways of AI-generated content
- NEVER use exclamation marks more than once per post
- Every post ends with a single, specific engagement question — not a generic "What do you think?" but something that makes the reader check their own home or remember a real experience
- The business owner should read it and say: "This sounds exactly like me talking to a customer I actually like"`;

    if (this.wizardTone) {
      voice += `\n\nTone override: The customer selected "${this.wizardTone}" for this post — this overrides their profile default. Make the shift unmistakably intentional in the writing energy.`;
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

    const isPhoto = !isCarousel && !isVideo && !isStatic;

    const photoCardDesignBrief = isPhoto ? `
=== PHOTO CARD DESIGN BRIEF — READ THIS BEFORE WRITING imagePrompt ===
You are a world-class graphic designer. The AI-generated photo will be used as a FULL-BLEED background
canvas (1080×1350px). Brand overlays float on top. The photo is ALWAYS fully visible — no half-panels.
Your job: choose the best template, write headline/eyebrow/subtext to perfection, and direct the photo
composition so the subject is in exactly the right position for the chosen template.

TEMPLATE A — "Left Fade Pro":
  Dark cinematic scrim covers left 68% (fades to transparent right). Subject CLEARLY visible on right side. Brand-colored accent bar on far left edge. Text anchored on left over dark area.
  Best for: job finished, before/after reveals, authentic professional content.
  → imagePrompt: "Subject positioned center-right 45–60% of frame clearly visible, dramatic side lighting, left side of frame darker/simpler for text overlay"

TEMPLATE B — "Angular Impact":
  Diagonal dark triangle covers upper-left. Subject fully visible on right side. Huge headline.
  Best for: educational tips, FAQ, community content, emergency/urgent tone.
  → imagePrompt: "Subject in right 45–55% of frame, looking toward camera, dynamic angle"

TEMPLATE C — "Top Card Window":
  Brand card covers top 54% with angled bottom edge. Photo shows in lower 45% like a window.
  Best for: testimonials, service overview, team spotlights, trust-building posts.
  → imagePrompt: "Subject in lower 50–60% of frame, candid/natural, top of frame shows setting/background"

TEMPLATE D — "Brand Immersion":
  Solid brand-color tint covers the ENTIRE canvas at ~62% opacity. Subject visible through the tint. White pill CTA button. Secondary-color bullet points. This makes every pixel feel branded.
  Best for: promotions, seasonal pushes, milestone posts, price offers.
  → imagePrompt: "Subject anywhere in frame — full tint covers evenly. Rich color and contrast so subject reads through brand color overlay. Cinematic quality, authentic."

TEMPLATE E — "Social Proof":
  Dark frosted panel covers bottom 55% with a SHARP edge (no gradient) — the Canva/Envato testimonial signature. Massive decorative open-quote mark (") in secondary color as ghost watermark behind the text. Gold 5-star rating. Quote text (headline) large, white, natural case. Attribution (subtext) in secondary color with em-dash prefix.
  Best for: reviews, testimonials, got_review content type.
  → imagePrompt: "Happy homeowner OR completed job result in UPPER 44% of frame. Lower 55% will be covered by dark testimonial panel — keep it clean. Warm authentic lighting, candid, NOT stock photo."
  → headline: Write as a direct quote from a customer — natural case, 8-14 words, in quotation marks: "They fixed our burst pipe in under an hour. Amazing service."
  → subtext: Customer attribution only — "Sarah K., Dallas Homeowner" or "Mike T., Google Review"
  → eyebrow: "VERIFIED [CITY] REVIEW" or "5-STAR GOOGLE REVIEW"

TEMPLATE F — "Bold Number":
  Left-dark cinematic gradient + ENORMOUS ghost number (the count/stat from eyebrow) behind the text area at 9% opacity. Services render as NUMBERED checklist items — filled brand-color circle badge with number inside + white text. This is the Canva/Envato tip-post signature.
  Best for: share_tip, faq, educational how-to content ("3 Signs You Need a Plumber").
  → imagePrompt: "Subject in RIGHT 45-55% of frame, dynamic angle, professional trade work in progress. Left side darker for gradient overlay."
  → eyebrow: START with the number — "3 Signs Your Pipes Are Failing" or "5 HVAC Tips Every Homeowner Needs"
  → services: Write 3-4 numbered tips as short bullets (max 6 words each) — these become the numbered checklist items on the card
  → headline: The tip topic title (what the list is about)

TEMPLATE RECOMMENDATION RULES:
  ALWAYS recommend "A" — the system auto-assigns the right template for each content type:
  - got_review → Template E (Social Proof panel)
  - share_tip / faq → Template F (Bold Number checklist)
  - promotion / seasonal → Template D (Brand Immersion)
  - team_spotlight → Template C (Top Card Window)
  - job_finished → Template A (Left Fade Pro)
  You do not need to choose — just write the right content for the content type.

HEADLINE STYLE — choose uppercase carefully:
  - urgent, promotional, emergency content → uppercase: true ("DRAIN CLEARED IN 45 MIN")
  - testimonial, tip, community, friendly → uppercase: false ("Your lawn, transformed.")
  Mixed-case with weight feels modern and premium for softer content types.

EYEBROW TEXT: Small text above main headline. Always hyper-local and credibility-building.
  Examples: "LICENSED PLUMBER · DALLAS TX", "YOUR EXPERT ROOFER", "SERVING DALLAS SINCE 2010"
  Never generic. Always reference the business location or a trust signal.

SERVICES LIST — write these like a Canva/Envato ad designer would:
  - For promotions: include prices or savings ("Drain Cleaning — $10 Off", "Free Estimate — Book Today")
  - For job reveals: include specific work done ("PEX Repiping", "Sump Pump Install", "Roof Replacement")
  - For seasonal: include urgency items ("Emergency Call-Out", "24/7 Response", "Same-Day Service")
  - For tips/educational: include benefit statements ("Prevents $4,000 in damage", "Lasts 20+ years")
  - Always write in the customer's voice. Max 5 words per bullet. 3-4 bullets is the sweet spot.

PROFESSIONAL DESIGN PRINCIPLES (from Canva/Figma/Envato template DNA — apply to ALL overlays):
  Typography: headline should feel like it fills the left 55% of the card. 4-6 words maximum.
              Use sentence fragments that pack meaning: "Solved Right" > "We Solved It Right For You"
  Hierarchy:  eyebrow (small, colored) → headline (massive, white) → divider → subtext → bullets → CTA
              Each layer must earn its space. Cut anything generic or redundant.
  Contrast:   every text element must pop against both light and dark backgrounds simultaneously.
              Write text that works on any photo — avoid references to specific visual elements.
  CTA copy:   2-4 words, action-first. "Book Today" > "Click Here to Book". Verb always comes first.
  Badge copy: The trust badge (top-right pill) should be the single most compelling credential.
              Examples: "AVAILABLE 24/7", "5-STAR RATED", "LICENSED & INSURED", "FREE ESTIMATES"
              Never use: "CLICK HERE", "LEARN MORE", "CONTACT US"

=== CONTENT-TYPE DESIGN BLUEPRINTS ===
Every content type has its own visual language. Canva/Envato templates that work never mix these up.
Write cardOverlay fields to match the blueprint for this specific content type:

JOB_FINISHED / BEFORE_AFTER → Template A (Left Fade Pro):
  The reveal is everything. Show the transformation, not the sale.
  → headline: The outcome, specific — "Drain Cleared in 45 Min" / "Roof Fixed, Leak Gone" / "Lawn Transformed Today"
  → eyebrow: "JUST COMPLETED · [CITY]" or "[BUSINESS NAME] · [MONTH]"
  → subtext: One sentence — what was done and for whom. Real detail, not generic.
  → cta: "Call for Same-Day Service" or "Get Your Free Quote"
  → badge: "LICENSED & INSURED" or "AVAILABLE 24/7" or "SAME-DAY SERVICE"
  → services: Specific work actually done — ["PEX Repiping", "Leak Detection", "Full Replacement"] (not generic service names)
  IF the post describes a visible before/after transformation (old vs new, broken vs fixed, dirty vs clean):
    → imagePrompt MUST be a SPLIT-CANVAS: left 50% = the problem state (dark, damaged, before), right 50% = the result (clean, repaired, after), separated by a thin diagonal slash line. Example: "Split-canvas image: left half shows corroded, leaking pipe joint — rusty and dark; right half shows gleaming new copper fittings, bright and clean. Diagonal divider line between halves. Professional trade photography, dramatic side lighting." If there is NO clear before/after transformation (e.g. a general job completion post), write a standard single-scene imagePrompt instead.

GOT_REVIEW → Template E (Social Proof):
  The customer's words are more powerful than yours. Put them front and center.
  → headline: A DIRECT CUSTOMER QUOTE in natural case, 8-14 words — "They fixed our burst pipe in under an hour. Incredible."
  → eyebrow: "5-STAR GOOGLE REVIEW · [CITY]" or "VERIFIED [CITY] CUSTOMER"
  → subtext: Customer attribution ONLY — "— Sarah K., [Neighborhood] Homeowner" or "— Mike T., [City]"
  → cta: "Read All Our Reviews" or "Join [X]+ Happy Customers"
  → badge: "GOOGLE ★ 5.0" or "[X]-STAR RATED" or "[X]+ REVIEWS"
  → services: The specific things the customer praised — ["Same-day arrival", "Clean & professional", "Honest pricing"]

SHARE_TIP / FAQ → Template F (Bold Number):
  Authority through giving. Teach something real that helps homeowners.
  → eyebrow: START WITH THE NUMBER — "3 Signs Your Pipes Are Failing" or "5 Things to Check Before Winter"
  → headline: The tip topic title — "Warning Signs Homeowners Miss" or "Before You Call a Plumber, Check This"
  → subtext: One sentence establishing authority — "After [X] years fixing [city]'s [trade] problems, here's what we see every week."
  → cta: "DM Us Any Question" or "More Tips on Our Page"
  → badge: "[X] YEARS EXPERIENCE" or "CERTIFIED [TRADE]"
  → services: THE ACTUAL NUMBERED TIPS — 3-4 items, max 6 words each, real and specific:
              ["Slow drain = partial blockage forming", "Discolored water = pipe corrosion", "Low pressure = hidden leak"]

PROMOTION / SEASONAL → Template D (Brand Immersion):
  Scarcity + specificity = action. Give them ONE reason to act NOW.
  → headline: The offer, bold and specific — "$50 Off This Month" / "Free Inspection — Book Now" / "Storm Season? We're Ready"
  → eyebrow: "LIMITED TIME · [MONTH] [YEAR]" or "STORM SEASON SPECIAL · [CITY]"
  → subtext: Urgency + conditions — "Book before [date] and save. Only [X] slots left this month."
  → cta: "Call Now" or "Book Online Today" — immediate action always
  → badge: "SAVE $[X]" or "[X]% OFF" — specific savings always, never vague
  → services: What's included — ["$50 off service call", "Free filter check included", "Same-day booking available"]

TEAM_SPOTLIGHT / COMMUNITY → Template C (Top Card Window):
  Humans buy from humans. Show the face behind the business.
  → headline: Name the moment — "Meet [First Name]" / "10 Years. Still Going." / "Your [City] Neighbors Trust Us"
  → eyebrow: "[BUSINESS NAME] TEAM · [CITY]" or "FAMILY-OWNED SINCE [YEAR]"
  → subtext: A real credential or human detail — "[Name] has been fixing [City]'s [trade] problems for [X] years."
  → cta: "Come Meet Our Team" or "Call Us Anytime"
  → badge: "FAMILY-OWNED" or "[X] YEARS IN [CITY]"
  → services: Real credentials — ["Master [Trade] License", "[X] Years with [Company]", "[City] Local Since [Year]"]

PHOTO QUALITY BRIEF for imagePrompt: Cinematic lighting, shallow depth-of-field background blur,
professional editorial photography style, modern color grading. NOT stock photo look.
Shoot as if for a Canva Pro template — intentional negative space, strong subject isolation,
natural authentic feel (tradesperson actually working, not posed). Rich contrast so the subject
reads clearly through a color overlay. Include specific composition instruction for the content type's template.
MANDATORY: The imagePrompt must explicitly state "no text, logos, business names, or brand marks on clothing, uniforms, vehicles, or equipment — plain workwear only." This is non-negotiable — the image generator will hallucinate fictional company names otherwise.
` : '';

    return `=== OUTPUT FORMAT (CRITICAL — ALWAYS FOLLOW THIS EXACTLY) ===
Return ONLY valid JSON. No markdown, no backticks, no explanation before or after. First character: { Last character: }
${photoCardDesignBrief}
${imageGuidance}
{
  "imagePrompt": "${isPhoto ? 'CRAFT THIS based on the PHOTO CARD DESIGN BRIEF above. Include: exact subject position for the CHOSEN template, cinematic editorial lighting, professional photography style. One paragraph, specific and vivid.' : 'A SINGLE shared image prompt for ALL 3 variations. Include: subject, setting, lighting, style, mood, composition.'}",${isPhoto ? `
  "cardOverlay": {
    "headline": "4-7 word headline — punchy and specific to THIS business and post (e.g. Drain Cleared Fast, Storm Damage Fixed Right)",
    "eyebrow": "Small text above headline, hyper-local + trust signal (e.g. LICENSED PLUMBER · DALLAS TX). Max 6 words.",
    "subtext": "One supporting sentence, max 15 words. Plain language, benefit-focused. Not generic.",
    "cta": "2-4 word call-to-action (e.g. Call Today, Get Free Quote, Book Now)",
    "badge": "2-4 word trust badge for top-right pill (e.g. AVAILABLE 24/7, 5-STAR RATED, FREE ESTIMATES)",
    "services": ["Specific service 1", "Specific service 2", "Specific service 3"],
    "uppercase": true,
    "recommended": "Always 'A' — the system assigns the right visual template automatically"
  },` : ''}${isCarousel ? `
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
        custom:          'They have their own specific idea for this post (see "Post idea" below)',
        finished_job:    'They just finished a job',
        share_tip:       'They want to share a helpful tip',
        got_review:      'They received a great customer review',
        promotion:       'They are running a promotion or special offer',
        seasonal:        `Seasonal content for ${this._getMonthName(this.currentMonth)}`,
        faq:             'They want to answer a common customer question (FAQ or myth-bust)',
        team_spotlight:  'Spotlight on a team member or company milestone',
        behind_scenes:   'Behind-the-scenes look at their work',
        community:       'Community or local event content',
      };
      prompt += `\nContent type: ${triggerLabels[this.wizardTrigger] || this.wizardTrigger}`;
    }

    if (Object.keys(answers).length > 0) {
      prompt += '\n\nSpecific details provided by the business owner:';
      if (answers.custom_topic) prompt += `\n- Post idea (honour this exactly): ${answers.custom_topic}`;
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
