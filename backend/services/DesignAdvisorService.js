/**
 * DesignAdvisorService — Claude-powered design evolution engine.
 *
 * Once a month, Claude analyses current social media design trends and
 * generates a fresh set of template parameter overrides stored in the DB.
 * PhotoCardService merges these on top of per-customer fingerprints so
 * the visual output evolves without developer code changes.
 *
 * Table: design_advisor_params
 *   id SERIAL PK, generated_at TIMESTAMP, active BOOLEAN, params JSONB
 *
 * Params shape:
 * {
 *   overlayOpacityBase: 0.82,      // replaces fingerprint fallback
 *   headlineFontWeight: '900',     // 800 | 900
 *   accentBarThickness: 7,         // px
 *   cornerRadiusMd: 16,            // mid-size radius (cards, pills)
 *   cornerRadiusLg: 28,            // large radius
 *   gradientStyle: 'hard',         // 'soft' | 'hard' | 'angled'
 *   decorStyle: 'circles',         // 'circles' | 'dots' | 'lines' | 'none'
 *   colorSaturationBoost: 0,       // 0-15 (applies to HSL S channel)
 *   currentTrends: ['frosted glass panels', 'bold serif typography', ...]
 * }
 */

const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-sonnet-4-6';

// Defaults used when no active design_advisor_params row exists
const FALLBACK_PARAMS = {
  overlayOpacityBase:    0.86,
  headlineFontWeight:    '900',
  accentBarThickness:    7,
  cornerRadiusMd:        18,
  cornerRadiusLg:        24,
  gradientStyle:         'soft',
  decorStyle:            'circles',
  colorSaturationBoost:  0,
  currentTrends:         [],
};

class DesignAdvisorService {
  constructor(pool) {
    this.pool         = pool;
    this.client       = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this._tableReady  = false;   // CREATE TABLE IF NOT EXISTS runs once per instance
    this._paramsCache = null;    // in-memory cache — params change monthly, not per-request
    this._cacheAt     = 0;
  }

  // ── Ensure table exists — guarded so it runs at most once per server process ─
  async ensureTable() {
    if (this._tableReady) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS design_advisor_params (
        id           SERIAL PRIMARY KEY,
        generated_at TIMESTAMP DEFAULT NOW(),
        active       BOOLEAN   DEFAULT FALSE,
        params       JSONB     NOT NULL
      )
    `);
    this._tableReady = true;
  }

  // ── Get current active params — 1-hour in-memory cache ─────────────────────
  async getActiveParams() {
    try {
      if (this._paramsCache && Date.now() - this._cacheAt < 3_600_000) {
        return this._paramsCache;
      }
      await this.ensureTable();
      const result = await this.pool.query(
        `SELECT params FROM design_advisor_params WHERE active = TRUE ORDER BY generated_at DESC LIMIT 1`
      );
      const params = result.rows.length > 0
        ? { ...FALLBACK_PARAMS, ...result.rows[0].params }
        : FALLBACK_PARAMS;
      this._paramsCache = params;
      this._cacheAt     = Date.now();
      return params;
    } catch {
      return FALLBACK_PARAMS;
    }
  }

  // ── Monthly refresh — called by cron endpoint ──────────────────────────────
  async runMonthlyRefresh() {
    await this.ensureTable();

    const month = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const prompt = `You are a world-class social media visual design expert analysing ${month} design trends.

Your job: produce a JSON parameter object that drives the visual style of social media post templates
for LOCAL SERVICE BUSINESSES (plumbers, HVAC, roofers, electricians, landscapers, painters, pest control).

These are NOT fashion brands or tech startups. The aesthetic must be:
- Trustworthy and professional
- Bold and readable on mobile
- Clean — never cluttered
- Modern but not experimental

Return ONLY valid JSON with EXACTLY these fields:
{
  "overlayOpacityBase": <number 0.78–0.95>,
  "headlineFontWeight": "<800 or 900>",
  "accentBarThickness": <integer 4–12>,
  "cornerRadiusMd": <integer 12–24>,
  "cornerRadiusLg": <integer 20–36>,
  "gradientStyle": "<soft|hard|angled>",
  "decorStyle": "<circles|dots|lines|none>",
  "colorSaturationBoost": <integer 0–12>,
  "currentTrends": [<array of 3–5 short trend strings relevant to service business social posts in ${month}>]
}

Base your parameter choices on what converts for local service businesses in ${month}.
Think: what visual style would make a plumber's Facebook post stand out right now?
Return ONLY the JSON object — no prose, no markdown fences.`;

    let params = FALLBACK_PARAMS;
    try {
      const response = await this.client.messages.create({
        model:      MODEL,
        max_tokens: 400,
        messages:   [{ role: 'user', content: prompt }],
      });
      const raw = response.content[0]?.text || '';
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      // Validate required fields
      const required = ['overlayOpacityBase', 'headlineFontWeight', 'accentBarThickness',
                        'cornerRadiusMd', 'cornerRadiusLg', 'gradientStyle', 'decorStyle',
                        'colorSaturationBoost', 'currentTrends'];
      const valid = required.every(k => Object.prototype.hasOwnProperty.call(parsed, k));
      if (!valid) throw new Error('Claude response missing required fields');

      params = parsed;
      console.log('[DesignAdvisor] New design params generated for', month, '— trends:', params.currentTrends);
    } catch (err) {
      console.error('[DesignAdvisor] Claude call failed — using fallback params:', err.message);
    }

    // Deactivate all previous rows, insert new active one
    await this.pool.query(`UPDATE design_advisor_params SET active = FALSE`);
    await this.pool.query(
      `INSERT INTO design_advisor_params (generated_at, active, params) VALUES (NOW(), TRUE, $1)`,
      [JSON.stringify(params)]
    );

    // Bust the in-memory cache so next getActiveParams() reads the new row
    this._paramsCache = params;
    this._cacheAt     = Date.now();

    return params;
  }
}

module.exports = DesignAdvisorService;
