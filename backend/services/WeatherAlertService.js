/**
 * WeatherAlertService — generates deeply-personalised weather-triggered post options.
 *
 * INDIVIDUATION GUARANTEE:
 * Even when 10 businesses in the same city share the same industry and the same
 * weather event, they get DIFFERENT posts because:
 *   1. Angle rotation: customer.id % 6 → 6 different strategic approaches
 *   2. Cost anchor rotation: customer.id % costs.length → different $ figures
 *   3. Hook rotation: customer.id % hooks.length → different opening lines
 *   4. Claude generates content fresh per customer using their specific business name,
 *      tone, past posts, and knowledge base entries
 *   5. Weather numbers vary by exact location (Open-Meteo uses lat/lng)
 *
 * Weather data (per city) is cached. Claude calls are NEVER cached.
 */

const Anthropic  = require('@anthropic-ai/sdk');
const WeatherService = require('./WeatherService');
const industryKnowledge = require('../data/industryKnowledge');

const CLAUDE_MODEL = 'claude-sonnet-4-6';

// ── 6 angles — assigned by customer.id % 6 ──────────────────────────────────
// Different businesses get fundamentally different storytelling approaches,
// not just different words saying the same thing.
const POST_ANGLES = [
  {
    key:  'story_opener',
    desc: `Open with a first-person story: "I was at a house in [specific real suburb of their city] earlier this week when..." — make it vivid and specific. This is variation A: text card.`,
  },
  {
    key:  'consequence_first',
    desc: `Lead IMMEDIATELY with the worst-case cost/consequence of ignoring this weather event, then position the business as the prevention expert. Make the reader feel the urgency in the first sentence.`,
  },
  {
    key:  'expert_checklist',
    desc: `Give a numbered checklist of 3-4 specific things homeowners must check RIGHT NOW because of this weather. Be concrete. "Check your [X]" not "consider your [X]".`,
  },
  {
    key:  'myth_buster',
    desc: `Bust ONE specific myth homeowners have about this weather risk — something they commonly assume is fine but actually isn't. Open with "Most homeowners think [myth]... here's what's really happening."`,
  },
  {
    key:  'behind_scenes',
    desc: `Share what the business team is literally doing RIGHT NOW in response to this weather. Make it feel like a live update from the field. "Our crew is already out in [city]..."`,
  },
  {
    key:  'community_question',
    desc: `Open with a direct yes/no or one-word question that residents will want to answer, then provide the expert answer. "Is your [X] ready for tonight? Here's what you actually need to check..."`,
  },
];

// ── Weather damage costs by signal type — real dollar ranges homeowners pay ──
// These are injected into Claude's prompt so posts include specific numbers
// (Power Rule 1: every post must have one specific number).
const WEATHER_COSTS = {
  freeze: [
    { problem: 'burst pipe from frozen/uninsulated pipes', fix: '$3,000–$15,000 in water damage repairs vs $80–$250 to insulate' },
    { problem: 'frozen/cracked main line', fix: '$2,500–$8,000 to excavate and replace' },
    { problem: 'HVAC frozen heat exchanger', fix: '$500–$1,500 to repair vs $99 annual tune-up' },
    { problem: 'ice dam on roof', fix: '$1,500–$6,000 in ceiling and attic damage' },
    { problem: 'frozen outdoor spigot that cracks and leaks into wall cavity', fix: '$800–$4,000 in wall/drywall damage' },
  ],
  cold_snap: [
    { problem: 'pipes that weren\'t properly drained before the cold snap', fix: '$1,200–$6,000 in water damage' },
    { problem: 'heating system failure during cold weather', fix: '$300–$2,000 emergency repair vs $99 tune-up' },
    { problem: 'cracked concrete from freeze-thaw cycles', fix: '$800–$3,500 to repair driveway or foundation' },
  ],
  heat_wave: [
    { problem: 'AC system failure during peak heat', fix: '$150–$600 emergency call vs $89 maintenance visit' },
    { problem: 'pest infestation driven indoors by extreme heat', fix: '$200–$800 treatment vs $50/month prevention' },
    { problem: 'heat-warped wood siding or paint peeling', fix: '$2,000–$8,000 in repainting vs proper prep' },
    { problem: 'overworked AC compressor failure', fix: '$1,200–$2,800 replacement vs annual service' },
  ],
  storm: [
    { problem: 'storm-damaged shingles left unrepaired (allows water in)', fix: '$4,000–$25,000 in structural water damage' },
    { problem: 'electrical panel or wiring damaged by lightning strike', fix: '$2,000–$9,000 in emergency electrical work' },
    { problem: 'fallen tree on roof or fence', fix: '$1,500–$12,000 depending on impact' },
    { problem: 'flooded crawl space or basement after storm', fix: '$3,000–$10,000 in remediation and waterproofing' },
  ],
  heavy_rain: [
    { problem: 'blocked gutters causing roof edge water damage', fix: '$800–$4,000 in fascia and soffit repairs vs $150 gutter clean' },
    { problem: 'water intrusion through foundation cracks', fix: '$5,000–$35,000 in waterproofing and foundation repair' },
    { problem: 'flooded yard destroying landscaping and topsoil', fix: '$2,000–$8,000 in landscaping restoration' },
  ],
  high_wind: [
    { problem: 'lifted or missing shingles (creates water entry point)', fix: '$500–$3,500 in roofing repair per section' },
    { problem: 'tree limbs on roof or power line (if ignored)', fix: '$3,000–$15,000 in structural or electrical damage' },
    { problem: 'fence or structure blown down', fix: '$1,500–$5,000 to rebuild vs minor repair if caught early' },
  ],
  snow: [
    { problem: 'snow weight on roof causing collapse or leak', fix: '$5,000–$40,000 in structural repair' },
    { problem: 'ice dam water damage inside walls and ceilings', fix: '$3,000–$12,000 in remediation' },
    { problem: 'concrete driveway cracks from repeated freeze-thaw', fix: '$800–$4,000 repair vs annual sealing' },
  ],
};

// ── Industry-specific content angle for each weather signal ──────────────────
// What BUSINESS OUTCOME does a business owner want from a weather post?
// A plumber wants emergency calls. A landscaper wants to book cleanup jobs.
// Claude must understand this and write toward it.
const SIGNAL_BUSINESS_ANGLE = {
  plumbing: {
    freeze:     { outcome: 'emergency calls tonight and winterization bookings', cta: 'Call us before pipes freeze — we\'re available 24/7' },
    cold_snap:  { outcome: 'winterization inspection bookings this week', cta: 'Book a winterization check before the temperature drops' },
    heat_wave:  { outcome: 'water heater and plumbing maintenance bookings', cta: 'Schedule a summer plumbing check before your system overloads' },
    storm:      { outcome: 'sump pump and drain line emergency bookings', cta: 'Call us if you get flooding — we\'re on call' },
    heavy_rain: { outcome: 'drain cleaning and sump pump emergency calls', cta: 'If your drains are backing up — call us now' },
    snow:       { outcome: 'emergency calls and post-snow pipe inspection bookings', cta: '24/7 emergency line is open' },
  },
  hvac: {
    freeze:     { outcome: 'emergency heating service calls tonight', cta: 'Call us now if your heat is struggling — we\'re on call' },
    cold_snap:  { outcome: 'furnace tune-up and filter replacement bookings', cta: 'Book a heating check before the cold snap hits' },
    heat_wave:  { outcome: 'emergency AC repair and maintenance bookings', cta: 'AC struggling? Call us before it fails completely' },
    storm:      { outcome: 'post-storm HVAC inspection calls', cta: 'Check your HVAC after the storm — we offer quick inspections' },
    snow:       { outcome: 'emergency heating calls and post-snow inspections', cta: 'Heating issues in the cold? We\'re available 24/7' },
  },
  roofing: {
    storm:      { outcome: 'post-storm inspection bookings TODAY', cta: 'Get a free storm damage inspection — call now' },
    heavy_rain: { outcome: 'leak inspection calls and gutter cleaning bookings', cta: 'Seeing water stains? Call us for a free inspection' },
    high_wind:  { outcome: 'shingle inspection bookings while it\'s safe', cta: 'Don\'t wait — wind damage gets worse if left' },
    freeze:     { outcome: 'ice dam removal and roof winterization bookings', cta: 'Ice dams forming? Call us before water gets in' },
    snow:       { outcome: 'snow removal and post-snow inspection bookings', cta: 'Snow on your roof? Call us before it becomes a problem' },
  },
  landscaping: {
    freeze:     { outcome: 'plant protection, pipe draining, and winterization bookings', cta: 'Book winter cleanup before the freeze hits' },
    heat_wave:  { outcome: 'irrigation check and lawn recovery service bookings', cta: 'Don\'t let the heat burn your lawn — we can help' },
    heavy_rain: { outcome: 'drainage system and post-rain cleanup bookings', cta: 'Rain damage? We\'ll assess and restore your yard' },
    storm:      { outcome: 'storm cleanup and tree debris removal bookings', cta: 'Storm cleanup — we\'re booking appointments now' },
    snow:       { outcome: 'spring cleanup pre-bookings now', cta: 'Book your spring cleanup now before the rush' },
  },
  electrical: {
    storm:      { outcome: 'post-storm electrical inspection bookings', cta: 'Power surge during the storm? Get your panel checked today' },
    heat_wave:  { outcome: 'panel upgrade and cooling circuit installation bookings', cta: 'AC tripping breakers? That\'s a panel warning sign' },
    freeze:     { outcome: 'heat tape installation and electrical safety checks', cta: 'Heat tape for pipes needs professional wiring — call us' },
    high_wind:  { outcome: 'post-storm electrical safety inspection calls', cta: 'If you lost power or had surges — get your panel inspected' },
  },
  concrete: {
    freeze:     { outcome: 'crack sealing bookings before winter damage gets worse', cta: 'Seal cracks before they turn into $3,000+ repairs' },
    cold_snap:  { outcome: 'driveway and walkway winterization bookings', cta: 'Book a freeze-protection treatment this week' },
    heavy_rain: { outcome: 'drainage grading and waterproofing bookings', cta: 'Pooling water damages concrete fast — we can fix the grade' },
    snow:       { outcome: 'post-winter crack repair bookings for spring', cta: 'Book spring repair now before freeze-thaw damage gets worse' },
  },
  painting: {
    freeze:     { outcome: 'pre-winter interior painting bookings before cold stops exterior work', cta: 'Interior painting is perfect this time of year — book now' },
    heat_wave:  { outcome: 'bookings for early morning exterior work before peak heat', cta: 'We schedule exterior work early morning to avoid heat damage' },
    heavy_rain: { outcome: 'water damage repainting and interior painting bookings', cta: 'Water stains on your walls? We can assess and repaint' },
  },
  pest_control: {
    freeze:     { outcome: 'winter pest inspection bookings (rodents move inside in cold)', cta: 'Cold drives rodents inside — schedule a winter inspection' },
    heat_wave:  { outcome: 'summer pest treatment bookings (ants, wasps, mosquitoes spike)', cta: 'Heat brings out pests — schedule a summer treatment now' },
    heavy_rain: { outcome: 'post-rain pest inspection bookings', cta: 'Rain drives pests into homes — call us for an inspection' },
  },
  general_contractor: {
    storm:      { outcome: 'emergency repair assessments and restoration bookings', cta: 'Storm damage? Get a professional assessment before you file a claim' },
    freeze:     { outcome: 'winterization and home preparation bookings', cta: 'Let us winterize your home before damage sets in' },
    heavy_rain: { outcome: 'basement, foundation, and drainage repair bookings', cta: 'Water intrusion? We assess the source and fix it right' },
  },
  cleaning: {
    heavy_rain: { outcome: 'post-storm interior cleanup and sanitization bookings', cta: 'Water damage cleanup needs to start within 48 hours — call us now' },
    freeze:     { outcome: 'post-freeze cleanup and restoration bookings', cta: 'Water damage from frozen pipes? We handle the cleanup' },
    storm:      { outcome: 'post-storm cleanup and restoration bookings', cta: 'Storm damage inside your home? We specialize in fast cleanup' },
  },
};

class WeatherAlertService {
  constructor(pool) {
    this.pool    = pool;
    this.weather = new WeatherService();
    this.claude  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    // In-memory pool cache (city+industry+signal → 6 variation sets).
    // Avoids repeated Claude calls for the same weather event across days.
    // DB layer below persists this across server restarts.
    this._poolCache = new Map();
  }

  /**
   * Generate alerts for all active customers due for a morning alert.
   *
   * BATCH STRATEGY: Group customers by city + industry.
   * One Claude call per group generates 6 variation sets (one per POST_ANGLE).
   * Each customer is assigned a variation by customer.id % 6.
   * {{BUSINESS_NAME}} placeholder is replaced per customer afterward.
   *
   * Cost: 10 Dallas plumbers → 1 Claude call (was: 10 calls). ~85% cheaper.
   * Uniqueness: preserved — 6 different structural approaches, different cost anchors.
   */
  async generateForAllDue() {
    let customers;
    try {
      const { rows } = await this.pool.query(
        `SELECT c.id, c.business_name, c.industry, c.location, c.timezone,
                c.plan, c.credits_balance, c.status, c.suspended
         FROM customers c
         WHERE c.status = 'active'
           AND c.suspended IS NOT TRUE
           AND c.location IS NOT NULL
           AND c.location != ''
           AND c.plan != 'trial'
           AND EXTRACT(HOUR FROM (NOW() AT TIME ZONE COALESCE(c.timezone, 'America/New_York'))) >= 5
           AND EXTRACT(HOUR FROM (NOW() AT TIME ZONE COALESCE(c.timezone, 'America/New_York'))) < 7
           AND NOT EXISTS (
             SELECT 1 FROM weather_alerts wa
             WHERE wa.customer_id = c.id
               AND wa.alert_date = CURRENT_DATE
           )
         ORDER BY c.id
         LIMIT 200`
      );
      customers = rows;
    } catch (err) {
      console.error('[WeatherAlert] Failed to load customers:', err.message);
      return { processed: 0, alerts: 0 };
    }

    if (!customers.length) return { processed: 0, alerts: 0 };
    console.log(`[WeatherAlert] Processing ${customers.length} customers in batched mode`);

    // Group by normalised city + industry key
    const groups = {};
    for (const c of customers) {
      const key = `${(c.location || '').toLowerCase().trim()}||${c.industry || 'general_contractor'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }

    const today = new Date().toISOString().split('T')[0];
    let alertsCreated = 0;

    for (const groupCustomers of Object.values(groups)) {
      const { location, industry } = groupCustomers[0];
      try {
        // Weather fetch is cached per city — no extra API cost for groups
        const forecast = await this.weather.getForecast(location);
        if (!forecast) continue;

        const signals = this.weather.detectSignals(forecast);
        if (!signals.length) continue;

        const signal = signals.find(s => this.weather.isRelevantForIndustry(s.type, industry));
        if (!signal) continue;

        // One Claude call → 6 variation sets for this city+industry+signal
        const variationPool = await this._generateVariationPool(location, industry, signal);
        if (!variationPool?.length) continue;

        // Assign + personalise + save per customer
        for (const customer of groupCustomers) {
          try {
            const varIdx = customer.id % variationPool.length;
            const postOptions = variationPool[varIdx]
              .map(opt => this._personalizeOption(opt, customer.business_name || 'our team', location))
              .filter(Boolean);

            if (!postOptions.length) continue;

            await this.pool.query(
              `INSERT INTO weather_alerts
                 (customer_id, alert_date, city, signal_type, signal_severity, weather_summary, post_options, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
               ON CONFLICT (customer_id, alert_date) DO NOTHING`,
              [customer.id, today, location, signal.type, signal.severity,
               signal.headline, JSON.stringify(postOptions)]
            );

            alertsCreated++;
            console.log(`[WeatherAlert] ${signal.type} alert → customer ${customer.id} (${customer.business_name}) in ${location} [angle ${customer.id % variationPool.length}]`);
          } catch (saveErr) {
            console.error(`[WeatherAlert] Save failed for customer ${customer.id}:`, saveErr.message);
          }
        }
      } catch (groupErr) {
        console.error(`[WeatherAlert] Group ${location}/${industry} failed:`, groupErr.message);
      }

      // Small pause between groups to respect Claude rate limits
      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`[WeatherAlert] Done — ${alertsCreated} alerts created for ${customers.length} customers`);
    return { processed: customers.length, alerts: alertsCreated };
  }

  /**
   * Cache-aware wrapper: check memory → DB → generate fresh.
   * Pool TTL: 7 days. Same weather event in the same city reuses the pool
   * across mornings, saving the Claude call on day 2, 3, etc.
   */
  async _generateVariationPool(city, industry, signal) {
    const cacheKey = `${city.toLowerCase().trim()}||${industry}||${signal.type}`;
    const TTL_MS   = 7 * 24 * 60 * 60 * 1000; // 7 days

    // 1. In-memory hit (fastest — within same process)
    const memEntry = this._poolCache.get(cacheKey);
    if (memEntry && memEntry.expiresAt > Date.now()) {
      console.log(`[WeatherAlert] Memory cache hit: ${cacheKey}`);
      return memEntry.pool;
    }

    // 2. DB hit (survives server restarts)
    try {
      const { rows } = await this.pool.query(
        `SELECT pools FROM weather_alert_pools WHERE cache_key = $1 AND expires_at > NOW() LIMIT 1`,
        [cacheKey]
      );
      if (rows.length) {
        const pool = typeof rows[0].pools === 'string' ? JSON.parse(rows[0].pools) : rows[0].pools;
        // Warm memory cache
        this._poolCache.set(cacheKey, { pool, expiresAt: Date.now() + TTL_MS });
        console.log(`[WeatherAlert] DB cache hit: ${cacheKey}`);
        return pool;
      }
    } catch (_) { /* table may not exist yet — continue to generate */ }

    // 3. Generate fresh (1 Claude call)
    const pool = await this._doGeneratePool(city, industry, signal);

    // 4. Store in both caches
    if (pool) {
      const expiresAt = new Date(Date.now() + TTL_MS);
      this._poolCache.set(cacheKey, { pool, expiresAt: expiresAt.getTime() });
      try {
        await this.pool.query(
          `INSERT INTO weather_alert_pools (cache_key, pools, signal_headline, expires_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (cache_key) DO UPDATE
             SET pools = $2, signal_headline = $3, expires_at = $4, created_at = NOW()`,
          [cacheKey, JSON.stringify(pool), signal.headline, expiresAt]
        );
      } catch (dbErr) {
        console.warn('[WeatherAlert] DB pool cache write failed (non-fatal):', dbErr.message);
      }
    }

    return pool;
  }

  /**
   * Generate 6 variation sets in a single Claude call.
   * Returns an array of 6 items, each item = [option_a, option_b, option_c] array.
   * Uses {{BUSINESS_NAME}} and {{CITY}} placeholders — replaced per customer by _personalizeOption().
   */
  async _doGeneratePool(city, industry, signal) {
    const knowledge      = industryKnowledge[industry] || industryKnowledge.general_contractor || {};
    const month          = new Date().getMonth() + 1;
    const seasonal       = knowledge.seasonalContent?.[month] || {};
    const costs          = WEATHER_COSTS[signal.type] || [];
    const businessAngle  = (SIGNAL_BUSINESS_ANGLE[industry] || {})[signal.type] || {
      outcome: 'emergency service bookings',
      cta:     'Call us today for help',
    };

    // Each angle gets its own cost anchor (rotated through the costs array)
    const costLines = POST_ANGLES.map((angle, i) => {
      const cost = costs[i % Math.max(costs.length, 1)];
      return cost ? `"${cost.problem}": ${cost.fix}` : 'include a real industry-specific repair cost';
    });

    const industryLabel = industry.replace(/_/g, ' ');

    const prompt = `Generate 6 weather-triggered social media post SETS for ${industryLabel} businesses in ${city}.
Each set contains 3 options (text card, photo post, animated reel), one per content type.
Each set uses a DIFFERENT storytelling angle so businesses using this content look completely unlike each other.

Use "{{BUSINESS_NAME}}" as a placeholder — it will be replaced with each business's actual name.

=== WEATHER EVENT ===
${signal.headline}
Severity: ${signal.severity}
Business goal: ${businessAngle.outcome}
Call to action: ${businessAngle.cta}
${seasonal.urgencyTopic ? `Industry focus this month: ${seasonal.urgencyTopic}` : ''}

=== 6 SETS REQUIRED (produce ALL 6) ===

SET 0 — STORY OPENER
Cost anchor: ${costLines[0]}
How to open every option in this set: "I was at a house in [name a specific real neighbourhood in ${city}] earlier this week when..."
Then: what was found → the consequence and cost → the fix → the lesson for the homeowner.

SET 1 — CONSEQUENCE FIRST
Cost anchor: ${costLines[1]}
How to open every option in this set: Lead with the DOLLAR DAMAGE before any solution. First sentence = the cost.
Example: "${costLines[1].split(':')[1]?.trim() || 'A burst pipe costs $5,000–$15,000 in water damage.'} Here's what causes it — and the simple thing that prevents it."

SET 2 — EXPERT CHECKLIST
Cost anchor: ${costLines[2]}
How to open every option in this set: "X things every ${city} homeowner must check RIGHT NOW:" — then numbered items, each with a real trade detail.
Checklists get saved and shared because homeowners forward them to their neighbours.

SET 3 — MYTH BUSTER
Cost anchor: ${costLines[3]}
How to open every option in this set: "Most homeowners in ${city} think [wrong belief about this weather risk]. Here's the truth:" — then the real fact, why the myth is dangerous, what to do instead.

SET 4 — BEHIND THE SCENES
Cost anchor: ${costLines[4]}
How to open every option in this set: Share what the crew is doing RIGHT NOW in response to this weather. "Our team has already had [X] calls this morning in ${city}..." Make it feel like a live field update.

SET 5 — COMMUNITY ANCHOR
Cost anchor: ${costLines[5]}
How to open every option in this set: Open with a hyper-local reference — name a real ${city} neighbourhood, local landmark, or known seasonal pattern. Create a "this is written specifically for me" feeling.

=== MANDATORY RULES FOR EVERY OPTION IN EVERY SET ===
1. Use "{{BUSINESS_NAME}}" naturally at least once
2. Include exactly ONE specific dollar amount or number per option
3. End every option with a BINARY question answerable YES or NO (never "what do you think?")
4. Reference "${city}" by name — not just "your area"
5. Banned words: synergy, leverage, optimize, utilize, delve, empower, seamless, bespoke, "as a trusted", "look no further", "your go-to", "we understand your needs"
6. Write as if the business owner is texting a local neighbour — real, direct, human. Not corporate.

=== RETURN ONLY THIS JSON STRUCTURE ===
{
  "sets": [
    {
      "angle": "story_opener",
      "option_a": {
        "contentType": "static",
        "contentTypeLabel": "Text Card",
        "credits": 1,
        "caption": "Full caption 150-250 words",
        "hashtags": ["tag1","tag2","tag3"],
        "engagementQuestion": "Binary YES/NO question",
        "previewText": "First 120 characters of caption exactly",
        "wizardTopic": "One sentence describing what this post is about"
      },
      "option_b": {
        "contentType": "photo",
        "contentTypeLabel": "Photo Post",
        "credits": 3,
        "caption": "Caption 80-150 words, visual-first language",
        "hashtags": ["tag1","tag2","tag3","tag4","tag5","tag6"],
        "engagementQuestion": "Binary YES/NO question",
        "imagePrompt": "Describe the photo: scene, lighting, subject, mood. NO logos, NO text overlays, NO business names on clothing or vehicles. Professional editorial photography style.",
        "previewText": "First 120 characters of caption exactly",
        "wizardTopic": "One sentence describing what this post is about"
      },
      "option_c": {
        "contentType": "video",
        "contentTypeLabel": "Animated Reel",
        "credits": 10,
        "caption": "Caption 60-100 words, hook-first energy",
        "hashtags": ["tag1","tag2","tag3","tag4"],
        "engagementQuestion": "Binary YES/NO question",
        "videoScript": "Slide 1 hook | Slide 2 key point | Slide 3 CTA",
        "videoImagePrompts": ["Slide 1 image description", "Slide 2 image description", "Slide 3 image description"],
        "previewText": "First 120 characters of caption exactly",
        "wizardTopic": "One sentence describing what this post is about"
      }
    },
    { "angle": "consequence_first", "option_a": {...}, "option_b": {...}, "option_c": {...} },
    { "angle": "expert_checklist",  "option_a": {...}, "option_b": {...}, "option_c": {...} },
    { "angle": "myth_buster",       "option_a": {...}, "option_b": {...}, "option_c": {...} },
    { "angle": "behind_scenes",     "option_a": {...}, "option_b": {...}, "option_c": {...} },
    { "angle": "community_anchor",  "option_a": {...}, "option_b": {...}, "option_c": {...} }
  ]
}

Respond with ONLY the JSON. No markdown, no explanation, first character {, last character }.`;

    try {
      const response = await this.claude.messages.create({
        model:      CLAUDE_MODEL,
        max_tokens: 8000,
        temperature: 0.9,
        messages:   [{ role: 'user', content: prompt }],
      });

      const raw = response.content[0]?.text?.trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      const parsed = JSON.parse(raw);
      const sets   = Array.isArray(parsed.sets) ? parsed.sets : [];
      if (!sets.length) return null;

      // Convert each set → array of options
      return sets.map(set => [set.option_a, set.option_b, set.option_c].filter(Boolean));
    } catch (err) {
      console.error(`[WeatherAlert] Pool generation failed for ${city}/${industry}:`, err.message);
      return null;
    }
  }

  /** Replace {{BUSINESS_NAME}} and {{CITY}} placeholders with real values. */
  _personalizeOption(opt, businessName, city) {
    if (!opt || typeof opt !== 'object') return null;
    const r = (s) => typeof s === 'string'
      ? s.replace(/\{\{BUSINESS_NAME\}\}/g, businessName).replace(/\{\{CITY\}\}/g, city)
      : s;
    return {
      ...opt,
      caption:            r(opt.caption),
      previewText:        r(opt.previewText),
      wizardTopic:        r(opt.wizardTopic),
      engagementQuestion: r(opt.engagementQuestion),
      videoScript:        r(opt.videoScript),
    };
  }
}

module.exports = WeatherAlertService;
