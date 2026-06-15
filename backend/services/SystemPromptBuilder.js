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

// ── Real-world cost data injected into every warning/educational post ─────────
// Source: industry repair/remediation averages. Tells Claude exactly what dollar
// anchors to use so posts always answer "what does ignoring this actually cost?"
const CONSEQUENCE_COSTS = {
  plumbing: [
    { problem: 'burst pipe (ignored slow leak or failed winterization)', cost: '$5,000–$70,000 in structural water damage depending on location and detection speed' },
    { problem: 'collapsed drain line (ignored slow/recurring clog)', cost: '$3,000–$8,000 main line replacement vs. $150–$300 annual maintenance' },
    { problem: 'water heater tank failure (no maintenance)', cost: '$800–$1,500 replacement + $2,000–$8,000 if tank floods before detected' },
    { problem: 'sump pump failure during storm', cost: '$10,000–$100,000 in basement flooding depending on whether finished' },
    { problem: 'tree root intrusion left untreated in sewer line', cost: '$1,500–$12,000 for rooter service or full pipe replacement' },
    { problem: 'dripping faucet ignored for a year', cost: '$200–$400 wasted water + $800–$1,500 if valve seat damage spreads' },
  ],
  hvac: [
    { problem: 'skipped annual tune-up leading to compressor failure', cost: '$1,500–$2,500 compressor replacement vs. $89–$150 tune-up' },
    { problem: 'dirty filter cracking heat exchanger', cost: '$1,000–$3,500 repair + CO leak risk — a $20 filter every 90 days prevents it' },
    { problem: 'refrigerant leak left until compressor burnout', cost: '$2,000–$5,000 vs. $200–$400 recharge-and-repair when caught early' },
    { problem: 'ductwork leaking 25–30% of conditioned air', cost: '$400–$900/year in wasted energy bills — sealing pays for itself in 12 months' },
    { problem: 'full system failure in peak summer', cost: '$8,000–$15,000 emergency replacement + emergency-rate premium on installation' },
  ],
  roofing: [
    { problem: 'small leak left through one season', cost: '$300–$800 patch becomes $5,000–$25,000 in deck rot, attic mold, and interior damage' },
    { problem: 'missing shingles after storm, not replaced', cost: '$200 shingle repair becomes $8,000–$40,000 in structural water damage' },
    { problem: 'ice dam damage not addressed in spring', cost: '$5,000–$20,000 in interior water damage, insulation replacement, and structural rot' },
    { problem: 'gutters blocked causing fascia rot and foundation water', cost: '$2,000–$10,000 in fascia, soffit, and foundation repair from $200 gutter cleaning' },
    { problem: 'full roof replacement delayed 5+ years past life expectancy', cost: '$15,000–$45,000 replacement + avoidable interior damage during delay years' },
  ],
  electrical: [
    { problem: 'outdated 100-amp panel not upgraded', cost: '$3,000–$8,000 panel upgrade vs. $20,000–$100,000+ house fire risk' },
    { problem: 'aluminum wiring not addressed in older home', cost: '$8,000–$25,000 remediation vs. fire and insurance loss' },
    { problem: 'burning smell from outlet ignored', cost: '$150–$300 repair becomes $10,000–$50,000 in fire damage' },
    { problem: 'overloaded circuit tripping repeatedly, not fixed', cost: '$400–$700 circuit upgrade vs. $2,000–$15,000 electrical fire' },
    { problem: 'missing GFCI outlets near water sources', cost: '$150 per outlet vs. $1M+ liability if electrocution occurs' },
  ],
  concrete: [
    { problem: 'hairline driveway cracks left unrepaired', cost: '$150–$300 crack fill becomes $4,000–$12,000 full replacement in 3–5 years' },
    { problem: 'foundation crack with water entry ignored', cost: '$500 seal becomes $10,000–$100,000 in structural repair if water enters basement' },
    { problem: 'sunken concrete walkway trip hazard not lifted', cost: '$400–$800 mudjacking vs. $3,000–$8,000 lawsuit + full replacement' },
    { problem: 'garage floor spalling left untreated', cost: '$1,500 coating becomes $6,000–$15,000 replacement when deterioration continues' },
  ],
  landscaping: [
    { problem: 'drainage problem causing yard pooling near foundation', cost: '$500–$2,000 grading fix vs. $5,000–$20,000 foundation and basement damage' },
    { problem: 'diseased or dead tree left standing near structure', cost: '$2,000–$8,000 preventive removal vs. $15,000–$100,000 emergency storm damage' },
    { problem: 'tree roots growing toward foundation or plumbing', cost: '$500 root pruning vs. $10,000–$50,000 foundation and pipe damage' },
    { problem: 'irrigation system left running inefficiently', cost: '$300–$600/year in wasted water bills — proper scheduling pays for itself in months' },
  ],
  painting: [
    { problem: 'peeling exterior paint left through a second winter', cost: '$800–$2,000 repaint becomes $5,000–$15,000 when wood rot sets in underneath' },
    { problem: 'bathroom moisture damage not repainted promptly', cost: '$300 repaint becomes $2,000–$8,000 mold remediation if left to spread' },
    { problem: 'stucco cracks left unpainted and unsealed', cost: '$400 repair becomes $3,000–$12,000 when water infiltrates the structure' },
    { problem: 'lead paint left unaddressed in pre-1978 home being sold', cost: '$1,000–$5,000 encapsulation vs. $10,000–$30,000 full abatement required at closing' },
  ],
  pest_control: [
    { problem: 'termite infestation ignored for a full season', cost: '$3,000–$8,000 annual treatment vs. $10,000–$30,000 in structural wood repair' },
    { problem: 'rodent entry points not sealed after first sighting', cost: '$200 seal-and-bait vs. $2,000–$10,000 in chewed wiring and contamination cleanup' },
    { problem: 'bed bugs treated late after spreading to multiple rooms', cost: '$500 early treatment becomes $2,500–$5,000 whole-house heat treatment' },
    { problem: 'carpenter ants in wall void left untreated', cost: '$150 early treatment becomes $3,000–$8,000 when structural wood is damaged' },
  ],
  general_contractor: [
    { problem: 'roof leak that damages structural framing', cost: '$500 patch becomes $20,000–$80,000 in framing, insulation, and interior damage' },
    { problem: 'foundation crack left past the hairline stage', cost: '$3,000 early repair becomes $20,000–$100,000 structural remediation' },
    { problem: 'renovation delayed 3+ years — materials and labor inflation', cost: 'Every year of delay adds 8–12% in material costs on average since 2022' },
    { problem: 'unpermitted addition discovered during home sale', cost: '$5,000–$30,000 retroactive fees, fines, and potential forced teardown' },
  ],
  cleaning: [
    { problem: 'kitchen grease buildup reaching exhaust fan and ductwork', cost: '$200 professional clean vs. $10,000–$50,000 kitchen fire damage' },
    { problem: 'carpets not professionally cleaned for 2+ years', cost: '$200–$400 cleaning vs. $3,000–$8,000 premature full replacement' },
    { problem: 'bathroom tile grout mold left untreated', cost: '$150 professional clean becomes $2,000–$8,000 mold remediation' },
    { problem: 'air ducts not cleaned for 5+ years', cost: '$400–$700 cleaning vs. $500–$1,200/year wasted HVAC efficiency + allergen health costs' },
  ],
  tree_service: [
    { problem: 'dead tree left standing within strike distance of structure', cost: '$2,000–$8,000 removal vs. $15,000–$100,000 storm damage to home or vehicle' },
    { problem: 'large branch over roof not trimmed before storm season', cost: '$300–$600 trim vs. $8,000–$25,000 roof and interior damage if branch falls' },
    { problem: 'tree disease spreading to neighboring trees', cost: '$800–$2,500 treatment vs. $3,000–$10,000 per additional tree lost' },
  ],
  pressure_washing: [
    { problem: 'oil stains left on concrete driveway', cost: '$150 pressure wash vs. $4,000–$12,000 driveway replacement when stain penetrates' },
    { problem: 'mold and algae on wood deck left for 2+ seasons', cost: '$200–$400 cleaning vs. $3,000–$12,000 deck replacement' },
    { problem: 'painted surfaces not washed before repainting', cost: '$200 wash prevents $1,500–$4,000 premature paint failure and recoat within 2 years' },
  ],
  pool_spa: [
    { problem: 'chemistry imbalance left for 2+ weeks', cost: '$50–$150 chemical rebalance vs. $2,000–$8,000 plaster, liner, or equipment damage' },
    { problem: 'crack in plaster or liner left through winter', cost: '$300–$800 patch vs. $8,000–$25,000 full replaster or liner replacement' },
    { problem: 'pump or filter not serviced annually', cost: '$150–$300 service vs. $800–$2,500 premature equipment failure' },
  ],
  handyman: [
    { problem: 'small roof flashing gap not sealed', cost: '$150 repair vs. $3,000–$15,000 water damage to interior and structure' },
    { problem: 'door or window seal failure left in place', cost: '$50–$200 re-seal vs. $300–$600/year in energy loss + $2,000–$8,000 frame rot' },
    { problem: 'cracked grout in shower left unaddressed', cost: '$100–$200 regrout vs. $2,000–$6,000 when water reaches substrate and subfloor' },
  ],
  flooring: [
    { problem: 'water-damaged subfloor not replaced before new flooring install', cost: 'Skipping subfloor repair means $3,000–$10,000 reinstall when flooring buckles within 2 years' },
    { problem: 'hardwood floors left unfinished or with worn finish', cost: '$800–$1,500 refinish vs. $6,000–$18,000 full replacement when moisture penetrates bare wood' },
    { problem: 'tile grout cracking in high-traffic area', cost: '$200–$400 regrout vs. $3,000–$8,000 tile replacement when subfloor is compromised' },
  ],
  junk_removal: [
    { problem: 'hazardous materials disposed of incorrectly', cost: '$200–$500 professional disposal vs. $1,000–$10,000 in EPA fines for improper disposal' },
    { problem: 'hoarding situation left until estate sale', cost: '$2,000–$6,000 full cleanout vs. $500–$1,500 for regular annual junk removal' },
  ],
  solar: [
    { problem: 'panels not cleaned annually in dusty climates', cost: '10–25% reduction in energy output — cleaning pays for itself in months' },
    { problem: 'inverter fault alarm ignored', cost: '$200–$500 inverter repair vs. $2,000–$5,000 if panels are damaged without inverter protection' },
    { problem: 'delaying solar install another year', cost: 'Average $1,200–$2,400/year in utility bills during the delay — plus incentive programs reducing annually' },
  ],
  gutter_cleaning: [
    { problem: 'gutters blocked through fall and winter', cost: '$150–$250 cleaning vs. $2,000–$10,000 in fascia rot, ice dam damage, and foundation water' },
    { problem: 'downspout disconnected from foundation drain', cost: '$50 reconnect vs. $5,000–$20,000 in basement flooding and foundation damage' },
    { problem: 'gutter guards installed incorrectly trapping debris', cost: '$200–$400 correction vs. $800–$2,000 in overflow damage per rain season' },
  ],
};

// 6 structural storytelling angles — assigned per customer by (customerId % 6).
// Every business in the same city/industry posting about the same topic gets a
// DIFFERENT structural approach, so no two posts sound like they came from the same tool.
const POST_ANGLES = [
  {
    id: 'story_opener',
    label: 'STORY OPENER',
    mandate: `Structure every variation as a first-person job story. Open with: "I was at a [specific location type] in [neighbourhood] on [day] when [something specific happened]." Then: what was found → the consequence → the fix → the lesson for the reader. This humanises the business and stops the scroll because it sounds unmistakably like a real person who was there — no AI writes this way.`,
  },
  {
    id: 'consequence_first',
    label: 'CONSEQUENCE FIRST',
    mandate: `Lead every variation with the WORST-CASE COST of ignoring this problem. State the dollar damage BEFORE offering any solution. Structure: "A [problem] costs $X–$Y to fix. Here's what causes it — and the $Z fix that prevents it." The homeowner must feel the financial pain before they value the solution. The cost anchor is your first sentence.`,
  },
  {
    id: 'expert_checklist',
    label: 'EXPERT CHECKLIST',
    mandate: `Structure every variation as a numbered expert checklist. Open with: "[Number] things every [city] homeowner should [check/know/do] right now:" → numbered items, each with a real trade detail → end with a direct action. Checklists drive saves and shares because people screenshot them to send to their spouse or neighbour.`,
  },
  {
    id: 'myth_buster',
    label: 'MYTH BUSTER',
    mandate: `Open every variation by naming and destroying a common myth. Structure: "Most [city] homeowners believe [wrong belief]. Here's the truth:" → the real fact (with a specific number or trade detail) → why the myth is dangerous → what to do instead. Myth-busting posts drive comments because people tag friends who believe the same myth.`,
  },
  {
    id: 'behind_scenes',
    label: 'BEHIND THE SCENES',
    mandate: `Take the reader inside a real moment from the job. Structure: describe the scene as it actually happened → what was discovered and why it mattered → the craft or decision-making involved → the outcome for the homeowner. Write as if narrating a time-lapse video of the work. Authenticity is the entire hook — no selling, just showing.`,
  },
  {
    id: 'community_anchor',
    label: 'COMMUNITY ANCHOR',
    mandate: `Open every variation with a hyper-local reference that only someone who lives in this city would recognise. Name a specific neighbourhood, a known local seasonal pattern, or a common local housing type. Structure: local reference → the problem or tip → expert insight → soft CTA. Creates a "this post was written for ME specifically" feeling that drives saves and shares within the local community.`,
  },
];

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

    // Customer ID drives angle + cost + hook rotation — ensures every business gets
    // a structurally different post from others in the same city/industry.
    this.customerId = options.customerId || customer.id || null;

    // Resolve industry knowledge — fall back to general_contractor if unknown
    this.knowledge = industryKnowledge[customer.industry] || industryKnowledge.general_contractor || {};

    // Current month (1–12) for seasonal context
    this.currentMonth = new Date().getMonth() + 1;
    this.seasonal = this.knowledge.seasonalContent?.[this.currentMonth] || null;

    // Assign deterministic storytelling angle per customer (never changes for same customer)
    this.storyAngle = this.customerId != null
      ? POST_ANGLES[Math.abs(this.customerId) % POST_ANGLES.length]
      : POST_ANGLES[0]; // safe fallback when customerId is null/undefined
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
      const colors = Array.isArray(c.brand_colors) ? c.brand_colors.filter(Boolean).join(', ') : c.brand_colors;
      if (colors && colors.trim()) {
        ctx += `\n\nBrand colors: ${colors} — reference these in image prompts where relevant.`;
      } else {
        ctx += `\n\nBrand colors: Not set — use professional industry-standard colors that suit ${c.industry || 'home services'}.`;
      }
    } else {
      ctx += `\n\nBrand colors: Not set — use professional industry-standard colors that suit ${c.industry || 'home services'}.`;
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
      const hooks = k.hookFormulas;
      expertise += `\n\nProven hook formulas for this industry:`;
      if (this.customerId != null && hooks.length > 0) {
        const primaryIdx = this.customerId % hooks.length;
        expertise += `\nASSIGNED STARTING HOOK for Variation A (use this exact structure, adapted to your topic):`;
        expertise += `\n→ "${hooks[primaryIdx].replace(/\[city\]/g, loc)}"`;
        expertise += `\n\nAdditional hooks for Variations B and C — choose two DIFFERENT ones:`;
        hooks.filter((_, i) => i !== primaryIdx).slice(0, 5).forEach((h, i) => {
          expertise += `\n${i + 1}. "${h.replace(/\[city\]/g, loc)}"`;
        });
      } else {
        expertise += ` — use a DIFFERENT one for each variation (A, B, C must each have a completely different opening energy):`;
        hooks.slice(0, 6).forEach((h, i) => {
          expertise += `\n${i + 1}. "${h.replace(/\[city\]/g, loc)}"`;
        });
      }
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

    // Inject real-world cost anchors so Claude always has dollar data available.
    // Rotate the PRIMARY anchor by customerId — 10 plumbers in Dallas each get a
    // different lead dollar figure so their warning posts never open identically.
    const costs = CONSEQUENCE_COSTS[this.customer.industry] || CONSEQUENCE_COSTS.general_contractor || [];
    if (costs.length > 0) {
      expertise += `\n\n=== REAL COST ANCHORS — USE THESE IN WARNING / EDUCATIONAL POSTS ===
These are real-world industry repair averages. When writing any post that warns about a risk, recommends maintenance, or explains why acting now beats waiting — include the matching cost anchor.
State it as a fact the homeowner deserves to know. Never as a scare tactic.`;
      if (this.customerId != null) {
        const primaryIdx = this.customerId % costs.length;
        const primaryCost = costs[primaryIdx];
        expertise += `\n\nPRIMARY cost anchor for this business (use this as your main dollar figure — it makes warning posts unique across businesses in the same area):`;
        expertise += `\n★ "${primaryCost.problem}": ${primaryCost.cost}`;
        expertise += `\n\nSupporting anchors (use if post topic matches):`;
        costs.filter((_, i) => i !== primaryIdx).slice(0, 3).forEach(c => {
          expertise += `\n• "${c.problem}": ${c.cost}`;
        });
      } else {
        costs.slice(0, 5).forEach(c => {
          expertise += `\n• "${c.problem}": ${c.cost}`;
        });
      }
      expertise += `\n\nRULE: Weave the PRIMARY cost anchor into the post naturally. "A burst pipe costs $5,000–$70,000 to remediate" is a fact that saves homeowners money. Say it plainly.`;
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
      carousel: `Content format: CAROUSEL — a swipeable mini-article. Research shows 5-6 slides get 3x more saves and shares than 3-4 slides. Build it right.

SLIDE COUNT RULES (critical):
- Myth-busting / FAQ / Educational tips: 6 slides — each myth or tip gets its own slide
- Step-by-step guides / Job showcase: 5 slides — cover + 3 steps + CTA
- Before & After / Testimonial: 4 slides — setup + before + after + result/CTA
- Promotional / Seasonal offer: 3 slides — hook + offer + CTA
- Default if unclear: 5 slides

SLIDE ROLES:

SLIDE 1 — SCROLL-STOPPER (the hook)
The single most important slide. Must create an "information gap" — tease a surprising fact, challenge a belief, or promise a specific useful outcome. Viewer must think "I need to swipe to find out."
- Headline: 3-5 bold words (e.g. "You're Doing This Wrong", "Stop Paying Too Much", "This Costs You $400/Year")
- Subtext: ONE sentence that widens the curiosity gap — do NOT reveal the answer yet
- Image: bold, high-contrast, single subject — readable on a 4-inch screen in 0.5 seconds
- NO bullet points on slide 1

MID SLIDES — DELIVER THE VALUE (one idea per slide)
Each body slide = exactly ONE tip, myth, step, or fact. Never two ideas on one slide.
- Headline: 3-5 words naming the specific tip/myth/step
- Bullets: 2-3 short punchy points (max 6 words each) — real, specific, trade-language
- Subtext: one brief explanatory sentence — make the reader feel smarter
- Image: shows the relevant work, tool, or scenario

SECOND-TO-LAST SLIDE — SOFT CTA (mid-carousel nudge)
A gentle "if this helped, save it" moment before the hard close.
- Headline: "Save This Slide" or "Share With Someone Who Needs This"
- Can also be a strong data point or stat that validates everything so far

LAST SLIDE — HARD CTA (drive action)
- Ask one specific action: call, book, or share with a friend
- Frame: "Know someone dealing with [problem]? Send this to them" — shares beat follows
- Include the business name naturally
- NO generic "contact us" — be specific about the outcome they'll get`,
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

    voice += `

=== THE 4 POWER RULES — WHAT MAKES A LOCAL SERVICE POST ACTUALLY CONVERT ===
These rules are the difference between a post that gets scrolled past and one that generates calls.
Apply all 4 to every post you write.

POWER RULE 1 — THE SPECIFICITY NUMBER
Every post must contain exactly ONE specific number that proves real expertise.
Good: "$11,000 in water damage" / "fixed in 47 minutes" / "18 years repiping [city] homes" / "327 jobs this year"
Bad: "expensive repairs" / "fast turnaround" / "years of experience" / "many satisfied customers"
Specific numbers are the #1 trust signal that separates real businesses from generic content.
The number can be a cost, timeframe, count, measurement, or year — but there must be one.

POWER RULE 2 — THE STORY ANCHOR (required in at least ONE of the 3 variations)
Variation A, B, or C must open with this exact structure:
"I was at a house in [specific neighbourhood / suburb] on [day of week] when [specific thing happened]."
Then: what was found → the consequence → the fix → the lesson for the reader.
Example: "I was at a house in Frisco last Tuesday when the homeowner showed me their water heater. 14 years old. No maintenance. We checked the anode rod — completely dissolved. Three weeks later it would have flooded their utility room."
This format stops the scroll because it sounds unmistakably human and local. No AI sounds like this.

POWER RULE 3 — CONSEQUENCE BEFORE SOLUTION
For ANY post that warns about risk, recommends maintenance, or explains why acting now is smarter:
ALWAYS write the CONSEQUENCE + COST FIRST, then the solution.
Wrong: "Here's how to maintain your drain so it doesn't clog."
Right: "A collapsed main drain line costs $3,000–$8,000 to replace. The $150 annual maintenance call that prevents it takes 20 minutes."
The homeowner must feel the pain before they value the fix. Cost anchor from Rule 1 belongs here.

POWER RULE 4 — THE BINARY ENGAGEMENT QUESTION
End every post with a question answerable in 1–3 words. Never open-ended.
Do NOT ask: "What are your thoughts on home maintenance?"
DO ask:
- "Does every adult in your house know where the main water shutoff is? YES or NO below."
- "When did you last have your [service] checked? Type the year."
- "Have you ever dealt with this? Drop a 🙋 if yes."
Binary or single-word-answer questions get 8–12× more comments than open-ended ones.
Comments = algorithm reach = more homeowners seeing this post = more calls.`;

    // Hard structural mandate — unique per customer, applied to ALL 3 variations.
    // This is the primary uniqueness guarantee: 10 businesses in the same city/industry
    // posting on the same day WILL produce structurally different posts because each
    // has a different assigned angle that Claude must follow.
    if (this.storyAngle) {
      const loc = sanitizeField(this.customer.location, 80) || 'your city';
      const industry = sanitizeField(this.customer.industry, 60) || 'home services';
      voice += `

=== STRUCTURAL MANDATE — APPLIES TO ALL 3 VARIATIONS (NON-NEGOTIABLE) ===
ASSIGNED ANGLE: ${this.storyAngle.label}

${this.storyAngle.mandate}

WHY THIS MATTERS: Multiple ${industry} businesses in ${loc} may generate posts about similar topics using ItsPosting on the same day. Each business is permanently assigned a different structural angle (STORY OPENER, CONSEQUENCE FIRST, EXPERT CHECKLIST, MYTH BUSTER, BEHIND THE SCENES, COMMUNITY ANCHOR). This is how every business sounds like it has a completely different human writing for them — not a shared tool.

YOUR MANDATE: All 3 variations (A, B, and C) must open using the ${this.storyAngle.label} structure. You MAY vary the specific story, number, or scenario between variations — but the structural opening must always match this angle. Do not default to a generic intro. Do not mix angles between variations.`;
    }

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
  "mediaSpec": {
    "searchKeywords": ["2-word trade term", "generic scene noun", "optional 3rd term"],
    "mustMatchScene": "One plain sentence: what must this photo show? e.g. a plumber working under a kitchen sink with visible pipe and tools"
  },` : ''}${isPhoto ? `
  "cardOverlay": {
    "headline": "4-6 word COMPLETE headline — must make sense standalone, not a fragment. Good: 'Drain Cleared Same Day', 'Storm Damage Fixed Right', 'Frozen Pipes? We Fix That'. Bad: 'What You Need To', '5 Signs Your Roof'.",
    "eyebrow": "Small text above headline, hyper-local + trust signal (e.g. LICENSED PLUMBER · DALLAS TX). Max 6 words.",
    "subtext": "One supporting sentence, max 15 words. Plain language, benefit-focused. Not generic.",
    "cta": "2-4 word call-to-action (e.g. Call Today, Get Free Quote, Book Now)",
    "badge": "2-4 word trust badge for top-right pill (e.g. AVAILABLE 24/7, 5-STAR RATED, FREE ESTIMATES)",
    "services": ["Specific service 1", "Specific service 2", "Specific service 3"],
    "uppercase": true,
    "recommended": "Always 'A' — the system assigns the right visual template automatically"
  },` : ''}${isCarousel ? `
  "carouselSlides": [
    {
      "slideNumber": 1,
      "slideType": "cover",
      "overlayText": "3-5 word scroll-stopping hook — creates curiosity gap, makes them NEED to swipe. Good: 'You Are Doing This Wrong', 'Stop Paying Too Much', 'This Costs $400 Yearly'. NOT a fragment. NOT generic.",
      "subtext": "ONE sentence that widens the information gap — do NOT answer yet, tease what is coming",
      "bullets": [],
      "description": "High-contrast bold image — single subject clearly visible, dramatic lighting, readable at thumbnail size on mobile"
    },
    {
      "slideNumber": 2,
      "slideType": "body",
      "overlayText": "3-5 word COMPLETE topic title for this specific point — e.g. 'Myth: Wipes Are Safe', 'Sign One: Slow Drains', 'Step One: Turn Off Water'",
      "subtext": "One clear sentence explaining this specific point — make the reader feel smarter, max 12 words",
      "bullets": ["Specific real point max 6 words", "Specific real point max 6 words", "Optional third point max 6 words"],
      "description": "Visual showing this specific tip or step in action — trade professional, real work environment"
    },
    {
      "slideNumber": 3,
      "slideType": "body",
      "overlayText": "3-5 word COMPLETE topic title for this specific point",
      "subtext": "One clear sentence, max 12 words",
      "bullets": ["Specific real point max 6 words", "Specific real point max 6 words"],
      "description": "Visual for this specific point"
    },
    {
      "slideNumber": 4,
      "slideType": "cta",
      "overlayText": "2-4 word COMPLETE call to action. Good: 'Call Us Today', 'Book Free Quote', 'Save This Post'. NOT generic.",
      "subtext": "Frame as: 'Know someone dealing with [problem]? Send this to them.' OR direct booking nudge — max 12 words",
      "bullets": [],
      "description": "Friendly professional shot — plumber/tech smiling, finished job, or branded vehicle. Inviting not salesy."
    }
  ],
  "carouselSlideCount": "How many slides you chose and why (e.g. '4 — promotion keeps it punchy' or '6 — myth-busting needs one slide per myth')",` : ''}
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
- NEVER output the same hashtag set for multiple variations${isPhoto ? `
- mediaSpec.searchKeywords: 2-3 GENERIC trade terms for a stock photo library search (NOT the detailed imagePrompt). Example: ["plumber","pipe repair","kitchen sink"] — never a full sentence
- mediaSpec.mustMatchScene: ONE plain sentence describing what the ideal stock photo shows — used to validate search results visually` : ''}${isCarousel ? `
- Carousel slide count: follow the SLIDE COUNT RULES above (3–6 slides based on topic). slideType must be "cover" (slide 1), "body" (middle), or "cta" (last). Cover has bold 3-5 word headline + one curiosity-gap subtext, no bullets. Body has short title + 2-3 bullets + subtext. CTA has hook question + single action nudge, no bullets.` : ''}

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
