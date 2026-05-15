const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const industryKnowledge = require('../data/industryKnowledge');

const SERVICE_NAMES = {
  plumbing:           'plumber',
  hvac:               'HVAC contractor',
  roofing:            'roofer',
  concrete:           'concrete contractor',
  landscaping:        'landscaper',
  electrical:         'electrician',
  painting:           'painter',
  pest_control:       'pest control company',
  general_contractor: 'general contractor',
  cleaning:           'cleaning service',
};

const TRUST_SIGNALS = [
  'licensed', 'insured', 'bonded', 'certified', 'background check',
  'reviews', 'rating', 'bbb', 'years in business', 'warranty',
  'guarantee', '24/7', 'emergency', 'free estimate', 'family owned',
  'locally owned', 'background-checked',
];

const PLATFORMS = [
  'yelp', 'angi', 'angie', 'homeadvisor', 'google', 'nextdoor',
  'thumbtack', 'houzz', 'bark', 'porch', 'taskrabbit', 'facebook',
  'bbb', 'better business bureau', 'bing',
];

const PLATFORM_URLS = {
  yelp: 'https://biz.yelp.com',
  angi: 'https://pro.angi.com',
  angie: 'https://pro.angi.com',
  homeadvisor: 'https://www.homeadvisor.com/welcome/',
  google: 'https://business.google.com',
  nextdoor: 'https://business.nextdoor.com',
  thumbtack: 'https://www.thumbtack.com/pro',
  houzz: 'https://www.houzz.com/for-professionals',
  bark: 'https://www.bark.com',
  porch: 'https://porch.com/for-pros',
  taskrabbit: 'https://www.taskrabbit.com/become-a-tasker',
  facebook: 'https://www.facebook.com/business',
  bbb: 'https://www.bbb.org/all-categories',
};

class GeoAuditService {
  constructor(pool) {
    this.pool = pool;

    this.openai = process.env.OPENAI_API_KEY
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : null;

    this.perplexity = process.env.PERPLEXITY_API_KEY
      ? new OpenAI({ apiKey: process.env.PERPLEXITY_API_KEY, baseURL: 'https://api.perplexity.ai' })
      : null;

    this.anthropic = process.env.ANTHROPIC_API_KEY
      ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      : null;
  }

  buildQuestions(customer, options = {}) {
    const city = (customer.location || 'your city').trim();
    const svc = SERVICE_NAMES[customer.industry] || 'contractor';
    const month = new Date().getMonth() + 1;
    const knowledge = industryKnowledge[customer.industry] || industryKnowledge.general_contractor;
    const seasonalTopic = knowledge.seasonalContent?.[month]?.urgencyTopic || `${svc} services`;
    const serviceFocus = options.serviceFocus || 'all';

    const focusLabel = serviceFocus === 'emergency' ? 'emergency'
      : serviceFocus === 'commercial' ? 'commercial'
      : 'residential';

    return [
      // Group A — Brand visibility (5 questions)
      `Who is the best ${svc} in ${city}?`,
      `Emergency ${svc} services in ${city} — who should I call?`,
      `Recommend a licensed ${svc} near ${city}`,
      `Top-rated ${svc} companies in ${city} — who should I hire?`,
      `${city} residents: who do you recommend for ${svc} work?`,

      // Group B — Competitive intel (5 questions)
      `What are the top ${svc} companies in ${city}?`,
      `Which ${svc} in ${city} has the best online reviews?`,
      `Best ${svc} for ${focusLabel} work in ${city}`,
      `Most trusted ${svc} in ${city} — who do locals use?`,
      `Who handles ${seasonalTopic} in ${city}?`,

      // Group C — Trust signal extraction (3 questions)
      `What should I look for when hiring a ${svc} in ${city}?`,
      `How do I know if a ${svc} in ${city} is trustworthy?`,
      `What questions should I ask a ${svc} before hiring them in ${city}?`,

      // Group D — Platform intelligence (2 questions)
      `Where can I find reliable ${svc} reviews in ${city}?`,
      `What websites or apps help people find a good ${svc} near ${city}?`,
    ];
  }

  async queryEngine(engine, question) {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 10000)
    );

    try {
      let call;
      if (engine === 'chatgpt') {
        if (!this.openai) return '';
        call = this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: question }],
          max_tokens: 400,
          temperature: 0.7,
        }).then(r => r.choices[0]?.message?.content || '');
      } else if (engine === 'perplexity') {
        if (!this.perplexity) return '';
        call = this.perplexity.chat.completions.create({
          model: 'llama-3.1-sonar-large-128k-online',
          messages: [{ role: 'user', content: question }],
          max_tokens: 400,
          temperature: 0.7,
        }).then(r => r.choices[0]?.message?.content || '');
      } else {
        // claude
        if (!this.anthropic) return '';
        call = this.anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 400,
          messages: [{ role: 'user', content: question }],
        }).then(r => r.content[0]?.text || '');
      }

      return await Promise.race([call, timeout]);
    } catch (err) {
      if (err.message !== 'timeout') {
        console.error(`[GeoAudit] ${engine} query failed:`, err.message);
      }
      return '';
    }
  }

  parseResponse(businessName, text) {
    if (!text || !businessName) return { mentioned: false, position: null };
    const lower = text.toLowerCase();
    const nameLower = businessName.toLowerCase();
    const idx = lower.indexOf(nameLower);
    return { mentioned: idx !== -1, position: idx !== -1 ? idx : null };
  }

  // Extract which known competitors appear in the response
  parseCompetitorMentions(text, knownCompetitors = []) {
    if (!text || !knownCompetitors.length) return [];
    const lower = text.toLowerCase();
    return knownCompetitors.filter(name => lower.includes(name.toLowerCase()));
  }

  // Scan response for trust signal keywords
  extractTrustSignals(text) {
    if (!text) return [];
    const lower = text.toLowerCase();
    return TRUST_SIGNALS.filter(signal => lower.includes(signal));
  }

  // Scan response for platform mentions
  extractPlatforms(text) {
    if (!text) return [];
    const lower = text.toLowerCase();
    return PLATFORMS.filter(p => lower.includes(p));
  }

  async extractCompetitors(text, ownBusinessName) {
    if (!text || !this.anthropic) return [];
    try {
      const res = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `Extract the names of any businesses or companies mentioned in the text below. Return ONLY a JSON array of strings (business names), max 5 items. Exclude "${ownBusinessName}". If none, return [].

Text: ${text.substring(0, 600)}`,
        }],
      });
      const raw = res.content[0]?.text?.replace(/```json|```/g, '').trim() || '[]';
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
    } catch {
      return [];
    }
  }

  // New composite scoring model
  computeScore(citations, uniqueCompetitorCount) {
    if (!citations.length) return 0;

    const brandMentions = citations.filter(c => c.business_mentioned).length;
    // brand mentions counted across Group A (first 5 questions = 15 citations)
    const groupACitations = citations.slice(0, 15);
    const groupAMentions = groupACitations.filter(c => c.business_mentioned).length;

    const brandScore = Math.round((groupAMentions / Math.max(groupACitations.length, 1)) * 40);

    // fewer competitors = less crowded market = better opportunity
    const competitorScore = Math.max(0, 30 - (uniqueCompetitorCount * 5));

    // trust signal richness — more signals = better intel quality
    const allSignals = new Set(citations.flatMap(c => c.trust_signals || []));
    const trustScore = Math.round((Math.min(allSignals.size, 8) / 8) * 30);

    const total = Math.min(100, brandScore + competitorScore + trustScore);
    console.log(`[GeoAudit] Score breakdown: brand=${brandScore} competitor=${competitorScore} trust=${trustScore} total=${total}`);
    return total;
  }

  async synthesizeReport(customer, citations, options = {}) {
    if (!this.anthropic) {
      return this._fallbackReport(customer, citations, options);
    }

    const uniqueCompetitors = [...new Set(citations.flatMap(c => c.competitors_mentioned || []))];
    const score = this.computeScore(citations, uniqueCompetitors.length);
    const citationsFound = citations.filter(c => c.business_mentioned).length;

    // Aggregate competitor appearances
    const competitorMap = {};
    citations.forEach(c => {
      (c.competitors_mentioned || []).forEach(name => {
        competitorMap[name] = (competitorMap[name] || 0) + 1;
      });
    });
    const topCompetitorNames = Object.entries(competitorMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => `${name} (appeared ${count} times)`);

    // Aggregate trust signals with counts
    const trustSignalMap = {};
    citations.forEach(c => {
      (c.trust_signals || []).forEach(signal => {
        trustSignalMap[signal] = (trustSignalMap[signal] || 0) + 1;
      });
    });
    const topTrustSignals = Object.entries(trustSignalMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([signal, count]) => `"${signal}" (${count}/${citations.length} searches)`);

    // Aggregate platform mentions with counts
    const platformMap = {};
    citations.forEach(c => {
      (c.platform_mentions || []).forEach(p => {
        platformMap[p] = (platformMap[p] || 0) + 1;
      });
    });
    const topPlatforms = Object.entries(platformMap)
      .sort((a, b) => b[1] - a[1])
      .map(([p, count]) => `${p} (${count} mentions)`);

    // Build query grid summary
    const questions = [...new Set(citations.map(c => c.query_text))];
    const gridSummary = questions.map(q => {
      const rows = citations.filter(c => c.query_text === q);
      const byEngine = {};
      rows.forEach(r => { byEngine[r.engine] = r.business_mentioned; });
      return `Q: "${q}" → chatgpt:${byEngine.chatgpt ? '✓' : '✗'} claude:${byEngine.claude ? '✓' : '✗'} perplexity:${byEngine.perplexity ? '✓' : '✗'}`;
    }).join('\n');

    const knownCompetitorResults = (options.competitors || []).map(name => {
      const appeared = citations.some(c => (c.competitors_mentioned || []).includes(name));
      return `${name}: ${appeared ? 'appeared in searches' : 'NOT found in searches'}`;
    }).join(', ');

    const prompt = `You are PostCore, the AI advisor for ItsPosting — a platform for local service businesses.
Generate a GEO audit report for ${customer.business_name || 'this business'} (${customer.industry}, ${customer.location}).

AUDIT DATA:
- GEO Score: ${score}/100 (composite: brand mentions + market competition + trust signal richness)
- Brand appeared in ${citationsFound} of ${citations.length} AI searches
- Service focus audited: ${options.serviceFocus || 'all'}
- Top competitors AI cited: ${topCompetitorNames.length ? topCompetitorNames.join(', ') : 'none detected'}
- Known competitors checked: ${knownCompetitorResults || 'none specified'}
- Trust signals AI uses: ${topTrustSignals.join(', ') || 'none detected'}
- Platforms AI recommends: ${topPlatforms.join(', ') || 'none detected'}

QUERY RESULTS (Group A=brand visibility, B=competitive intel, C=trust criteria, D=platforms):
${gridSummary}

PostCore voice rules: plain language a tradesperson understands, explain WHY before WHAT,
maximum 5 recommendations, never say "leverage/synergy/optimize/utilize",
each recommendation MUST reference a specific gap found above (not generic advice).

Return ONLY valid JSON:
{
  "summary": "One honest sentence: what the score means for this specific business",
  "verdict": "low" or "medium" or "high",
  "topCompetitors": [{ "name": "...", "appearances": N, "gap": "One sentence on why they rank higher and what this business can do" }],
  "trustSignalSummary": [{ "signal": "...", "count": N, "total": ${citations.length}, "isGap": true/false }],
  "platformSummary": [{ "platform": "...", "count": N, "url": "signup URL" }],
  "recommendations": [
    { "priority": 1, "action": "Specific action referencing a real gap found", "impact": "high|medium|low", "effort": "high|medium|low", "wizardCta": "Short button label", "wizardParams": { "contentType": "educational_tip|before_after|customer_testimonial|seasonal|promotion", "platform": "all|facebook|instagram" } }
  ],
  "queryGrid": [{ "question": "...", "chatgpt": true/false, "claude": true/false, "perplexity": true/false }]
}

Include exactly 5 recommendations. queryGrid must include all ${questions.length} questions.`;

    try {
      const res = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      });
      const raw = res.content[0]?.text?.replace(/```json|```/g, '').trim() || '{}';
      const parsed = JSON.parse(raw);
      // Attach URL data to platforms if missing
      if (Array.isArray(parsed.platformSummary)) {
        parsed.platformSummary = parsed.platformSummary.map(p => ({
          ...p,
          url: p.url || PLATFORM_URLS[p.platform?.toLowerCase()] || null,
        }));
      }
      return parsed;
    } catch (err) {
      console.error('[GeoAudit] synthesizeReport failed:', err.message);
      return this._fallbackReport(customer, citations, options);
    }
  }

  _fallbackReport(customer, citations, options = {}) {
    const uniqueCompetitors = [...new Set(citations.flatMap(c => c.competitors_mentioned || []))];
    const score = this.computeScore(citations, uniqueCompetitors.length);
    const found = citations.filter(c => c.business_mentioned).length;
    const verdict = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';

    const platformMap = {};
    citations.forEach(c => {
      (c.platform_mentions || []).forEach(p => {
        platformMap[p] = (platformMap[p] || 0) + 1;
      });
    });

    const trustSignalMap = {};
    citations.forEach(c => {
      (c.trust_signals || []).forEach(s => {
        trustSignalMap[s] = (trustSignalMap[s] || 0) + 1;
      });
    });

    return {
      summary: `${customer.business_name || 'Your business'} appeared in ${found} of ${citations.length} AI searches. GEO Score: ${score}/100.`,
      verdict,
      topCompetitors: [],
      trustSignalSummary: Object.entries(trustSignalMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([signal, count]) => ({ signal, count, total: citations.length, isGap: count < citations.length * 0.5 })),
      platformSummary: Object.entries(platformMap)
        .sort((a, b) => b[1] - a[1])
        .map(([platform, count]) => ({ platform, count, url: PLATFORM_URLS[platform] || null })),
      recommendations: [
        { priority: 1, action: 'Get listed on Yelp and Angi — AI engines recommend these platforms in most local service searches', impact: 'high', effort: 'low', wizardCta: 'Generate Profile Bio', wizardParams: { contentType: 'educational_tip', platform: 'all' } },
        { priority: 2, action: 'Publish educational articles proving you\'re licensed and insured — AI looks for this in 80%+ of searches', impact: 'high', effort: 'medium', wizardCta: 'Generate Trust Post', wizardParams: { contentType: 'educational_tip', platform: 'facebook' } },
        { priority: 3, action: 'Create before/after posts showcasing completed jobs — builds the content footprint AI trains on', impact: 'high', effort: 'low', wizardCta: 'Create Before/After', wizardParams: { contentType: 'before_after', platform: 'facebook' } },
        { priority: 4, action: 'Share customer testimonials with location specifics — "Austin homeowner" signals you\'re local and trusted', impact: 'medium', effort: 'low', wizardCta: 'Generate Testimonial', wizardParams: { contentType: 'customer_testimonial', platform: 'all' } },
        { priority: 5, action: 'Post consistently 3-4x per week — content volume directly increases the chance AI cites your business', impact: 'high', effort: 'medium', wizardCta: 'Create Post', wizardParams: { contentType: 'educational_tip', platform: 'all' } },
      ],
      queryGrid: [...new Set(citations.map(c => c.query_text))].map(q => {
        const rows = citations.filter(c => c.query_text === q);
        const byEngine = {};
        rows.forEach(r => { byEngine[r.engine] = r.business_mentioned; });
        return { question: q, chatgpt: !!byEngine.chatgpt, claude: !!byEngine.claude, perplexity: !!byEngine.perplexity };
      }),
    };
  }

  async runAudit(customer, auditId, options = {}) {
    try {
      const questions = this.buildQuestions(customer, options);
      const engines = ['chatgpt', 'claude', 'perplexity'];
      const citations = [];

      for (const question of questions) {
        const results = await Promise.all(
          engines.map(engine => this.queryEngine(engine, question))
        );

        for (let i = 0; i < engines.length; i++) {
          const engine = engines[i];
          const responseText = results[i];
          const { mentioned, position } = this.parseResponse(customer.business_name, responseText);
          const trustSignals = this.extractTrustSignals(responseText);
          const platformMentions = this.extractPlatforms(responseText);
          const competitorsMentioned = responseText
            ? await this.extractCompetitors(responseText, customer.business_name)
            : [];
          const knownCompetitorMatches = this.parseCompetitorMentions(responseText, options.competitors || []);

          // Merge known competitors into competitors_mentioned
          const allCompetitors = [...new Set([...competitorsMentioned, ...knownCompetitorMatches])];

          citations.push({
            engine,
            query_text: question,
            response_excerpt: responseText.substring(0, 500),
            business_mentioned: mentioned,
            mention_position: position,
            competitors_mentioned: allCompetitors,
            trust_signals: trustSignals,
            platform_mentions: platformMentions,
          });
        }
      }

      // Bulk insert citations
      for (const c of citations) {
        await this.pool.query(
          `INSERT INTO geo_citations (audit_id, engine, query_text, response_excerpt, business_mentioned, mention_position, competitors_mentioned)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [auditId, c.engine, c.query_text, c.response_excerpt, c.business_mentioned, c.mention_position, c.competitors_mentioned]
        );
      }

      const uniqueCompetitors = [...new Set(citations.flatMap(c => c.competitors_mentioned || []))];
      const score = this.computeScore(citations, uniqueCompetitors.length);
      const citationsFound = citations.filter(c => c.business_mentioned).length;
      const reportData = await this.synthesizeReport(customer, citations, options);

      await this.pool.query(
        `UPDATE geo_audits
         SET status = 'complete', geo_score = $1, citations_found = $2, report_data = $3, completed_at = NOW()
         WHERE id = $4`,
        [score, citationsFound, JSON.stringify(reportData), auditId]
      );

      await this.pool.query(
        `UPDATE customers SET geo_score = $1, last_geo_audit_at = NOW() WHERE id = $2`,
        [score, customer.id]
      );

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      await this.pool.query(
        `INSERT INTO geo_tracking_scores (customer_id, geo_score, citations_found, week_start)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [customer.id, score, citationsFound, weekStart.toISOString().split('T')[0]]
      );

      console.log(`[GeoAudit] Audit ${auditId} complete — score ${score}/100, ${citationsFound}/${citations.length} citations`);
    } catch (err) {
      console.error('[GeoAudit] runAudit failed:', err.message);
      await this.pool.query(
        `UPDATE geo_audits SET status = 'failed' WHERE id = $1`,
        [auditId]
      );
      throw err;
    }
  }
}

module.exports = GeoAuditService;
