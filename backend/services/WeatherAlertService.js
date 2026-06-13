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
  }

  /**
   * Run the full pipeline for one customer:
   * 1. Get weather forecast for their city
   * 2. Detect signals relevant to their industry
   * 3. Generate 3 deeply-personalised post options via Claude
   * 4. Save to weather_alerts table
   */
  async checkAndCreateForCustomer(customer) {
    const city = customer.location;
    if (!city) return null;

    const industry = customer.industry || 'general_contractor';
    const today    = new Date().toISOString().split('T')[0];

    // Skip if alert already exists for today
    const existing = await this.pool.query(
      `SELECT id FROM weather_alerts WHERE customer_id = $1 AND alert_date = $2`,
      [customer.id, today]
    );
    if (existing.rows.length > 0) return null;

    // Skip suspended / trial with 0 credits
    if (customer.suspended || customer.status === 'suspended') return null;
    if (customer.plan === 'trial' && (customer.credits_balance || 0) <= 0) return null;

    // Get forecast
    const forecast = await this.weather.getForecast(city);
    if (!forecast) return null;

    const signals = this.weather.detectSignals(forecast);
    if (!signals.length) return null;

    // Pick the most severe signal relevant to this industry
    const signal = signals.find(s => this.weather.isRelevantForIndustry(s.type, industry));
    if (!signal) return null;

    // Load business knowledge for personalisation
    const kbEntries = await this._loadKnowledge(customer.id);

    // Generate 3 unique post options
    const postOptions = await this._generatePostOptions(customer, signal, forecast, kbEntries);
    if (!postOptions?.length) return null;

    // Save alert
    await this.pool.query(
      `INSERT INTO weather_alerts (customer_id, alert_date, city, signal_type, signal_severity,
        weather_summary, post_options, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (customer_id, alert_date) DO NOTHING`,
      [
        customer.id, today, city, signal.type, signal.severity,
        signal.headline,
        JSON.stringify(postOptions),
      ]
    );

    console.log(`[WeatherAlert] Created ${signal.type} alert for customer ${customer.id} (${customer.business_name}) in ${city}`);
    return { signal, postOptions };
  }

  /**
   * Generate 3 post options using Claude with deep business personalisation.
   * Each option targets a different content type (text, photo, video).
   * The primary ANGLE for all 3 is derived from customer.id % 6 — ensuring
   * businesses in the same city/industry get fundamentally different approaches.
   */
  async _generatePostOptions(customer, signal, forecast, kbEntries) {
    const industry       = customer.industry || 'general_contractor';
    const knowledge      = industryKnowledge[industry] || industryKnowledge.general_contractor;
    const month          = new Date().getMonth() + 1;
    const seasonal       = knowledge.seasonalContent?.[month] || {};
    const angleIndex     = (customer.id || 0) % POST_ANGLES.length;
    const primaryAngle   = POST_ANGLES[angleIndex];
    const costs          = WEATHER_COSTS[signal.type] || [];
    const costIndex      = costs.length ? (customer.id || 0) % costs.length : -1;
    const costAnchor     = costIndex >= 0 ? costs[costIndex] : null;
    const hooks          = knowledge.hookFormulas || [];
    const hookIndex      = hooks.length ? (customer.id || 0) % hooks.length : -1;
    const chosenHook     = hookIndex >= 0 ? hooks[hookIndex] : null;
    const businessAngle  = (SIGNAL_BUSINESS_ANGLE[industry] || {})[signal.type] || {
      outcome: 'bookings and emergency service calls',
      cta:     'Call us today',
    };

    const businessName = customer.business_name || 'our business';
    const city         = customer.location || 'your area';
    const tone         = customer.tone || 'professional';
    const pastPosts    = (customer.past_post_examples || []).slice(0, 2);

    const kbSnippet = kbEntries.length
      ? kbEntries.slice(0, 3).map(e => `[${e.knowledge_type}] ${e.title}: ${(e.content || '').slice(0, 200)}`).join('\n')
      : '';

    const prompt = `You are generating 3 weather-triggered social media posts for a SPECIFIC local business.
This post MUST sound like it was written BY this business owner personally — not by any AI or marketing tool.

=== THE BUSINESS ===
Business name: ${businessName}
Industry: ${industry.replace(/_/g, ' ')}
City/area: ${city}
Business tone: ${tone}
${kbSnippet ? `\nBusiness-specific knowledge:\n${kbSnippet}` : ''}
${pastPosts.length ? `\nPast posts this business has written (match this voice):\n${pastPosts.map(p => `"${p}"`).join('\n')}` : ''}

=== WEATHER EVENT (happening RIGHT NOW in ${city}) ===
Signal: ${signal.headline}
Detail: ${signal.detail}
Severity: ${signal.severity}

=== YOUR PRIMARY STORYTELLING APPROACH ===
For ALL 3 variations, use this angle: ${primaryAngle.desc}
This angle was assigned specifically to THIS business — other businesses in ${city} are getting different angles,
so this business's posts will stand out from any competitor's weather posts.

=== WHAT THIS BUSINESS NEEDS FROM THIS POST ===
Business outcome: ${businessAngle.outcome}
Call-to-action style: ${businessAngle.cta}

=== COST ANCHOR (use this specific number in at least ONE variation) ===
${costAnchor ? `"${costAnchor.problem}": ${costAnchor.fix}` : 'Use a real industry-specific repair cost range from memory.'}

=== HOOK TO ADAPT (make it specific to ${city} and this weather) ===
${chosenHook ? `Opening formula: "${chosenHook}"` : 'Use a strong, specific opening line.'}

=== SEASONAL CONTEXT ===
This month's industry focus: ${seasonal.urgencyTopic || 'seasonal readiness'}

=== NON-NEGOTIABLE WRITING RULES ===
1. SPECIFICITY: Include exactly ONE specific dollar amount or number (costs, years, hours, degrees)
2. LOCAL: Reference a REAL specific neighbourhood, suburb, or district of ${city} — NOT just the city name
3. BINARY QUESTION: End every post with a yes/no or one-word-answer question (NOT "What do you think?")
4. CONSEQUENCE FIRST: State the worst-case cost/outcome BEFORE the solution
5. VOICE: Write as if the business owner is texting this themselves. NEVER say: "we understand", "look no further", "your trusted", "as a professional". Sound human, not corporate.
6. BUSINESS NAME: Use ${businessName} naturally in at least one variation

=== BANNED WORDS/PHRASES ===
synergy, leverage, optimize, utilize, delve, comprehensive, empower, seamless, tailored, bespoke,
"as a trusted", "look no further", "your go-to", "we understand your needs", "reach out to us"

=== OUTPUT FORMAT ===
Return a JSON object with exactly this structure:
{
  "option_a": {
    "contentType": "static",
    "contentTypeLabel": "Text Card",
    "credits": 1,
    "caption": "Full caption text (150-300 words for Facebook)",
    "hashtags": ["tag1", "tag2", "tag3"],
    "engagementQuestion": "Binary yes/no question to end the post",
    "previewText": "First 120 characters of the caption for banner preview",
    "wizardTopic": "One-sentence topic description for wizard pre-fill"
  },
  "option_b": {
    "contentType": "photo",
    "contentTypeLabel": "Photo Post",
    "credits": 3,
    "caption": "Full caption (100-200 words, visual-first language)",
    "hashtags": ["tag1", "tag2", ..., "tag10"],
    "engagementQuestion": "Binary yes/no question",
    "imagePrompt": "Detailed image generation prompt for NanoBanana (NO logos, NO text overlays, NO business names in image). Describe: location, lighting, subject, mood, industry context. Professional photography style.",
    "previewText": "First 120 characters of the caption",
    "wizardTopic": "One-sentence topic description"
  },
  "option_c": {
    "contentType": "video",
    "contentTypeLabel": "Animated Reel",
    "credits": 10,
    "caption": "Video caption (60-100 words, hook-first, matches reel energy)",
    "hashtags": ["tag1", "tag2", ..., "tag8"],
    "engagementQuestion": "Binary yes/no question",
    "videoScript": "3-slide reel script: slide 1 headline | slide 2 key point | slide 3 CTA",
    "videoImagePrompts": ["Slide 1 image prompt", "Slide 2 image prompt", "Slide 3 image prompt"],
    "previewText": "First 120 characters of the caption",
    "wizardTopic": "One-sentence topic description"
  }
}

Generate the 3 options now. Make them DISTINCTLY different from each other in tone and angle.
Respond with ONLY the JSON, no explanation, no markdown fences.`;

    try {
      const response = await this.claude.messages.create({
        model:      CLAUDE_MODEL,
        max_tokens: 2400,
        messages:   [{ role: 'user', content: prompt }],
      });

      const raw = response.content[0]?.text?.trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      const parsed = JSON.parse(raw);
      const options = [parsed.option_a, parsed.option_b, parsed.option_c].filter(Boolean);
      return options.length ? options : null;
    } catch (err) {
      console.error('[WeatherAlert] Claude generation failed for customer', customer.id, ':', err.message);
      return null;
    }
  }

  async _loadKnowledge(customerId) {
    try {
      const { rows } = await this.pool.query(
        `SELECT knowledge_type, title, content FROM business_knowledge
         WHERE customer_id = $1 AND is_active = true
         ORDER BY knowledge_type, sort_order LIMIT 5`,
        [customerId]
      );
      return rows;
    } catch (_) { return []; }
  }

  /**
   * Generate alerts for all active customers due for a morning alert
   * in their local timezone (between 5:30am and 7:00am local time).
   * Weather data is shared across customers in the same city.
   * Claude calls run per-customer for guaranteed individuation.
   */
  async generateForAllDue() {
    let customers;
    try {
      const { rows } = await this.pool.query(
        `SELECT c.id, c.business_name, c.industry, c.location, c.timezone,
                c.plan, c.credits_balance, c.status, c.suspended,
                c.tone, c.past_post_examples, c.brand_colors
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

    console.log(`[WeatherAlert] Processing ${customers.length} customers due for morning alert`);
    let alertsCreated = 0;

    // Process in batches of 10 with a 500ms gap (respectful to Claude rate limits)
    const BATCH_SIZE = 10;
    for (let i = 0; i < customers.length; i += BATCH_SIZE) {
      const batch = customers.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(customer => this.checkAndCreateForCustomer(customer)
          .then(result => { if (result) alertsCreated++; })
          .catch(err => console.error(`[WeatherAlert] Failed for customer ${customer.id}:`, err.message))
        )
      );
      if (i + BATCH_SIZE < customers.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log(`[WeatherAlert] Done — ${alertsCreated} alerts created out of ${customers.length} customers processed`);
    return { processed: customers.length, alerts: alertsCreated };
  }
}

module.exports = WeatherAlertService;
