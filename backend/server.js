require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const postRoutes = require('./routes/posts');
const contentRoutes = require('./routes/content');
const socialRoutes = require('./routes/social');
const scraperRoutes = require('./routes/scraper');
const uploadRoutes = require('./routes/upload');
const billingRoutes = require('./routes/billing');
const mediaRoutes = require('./routes/media');
const adminRoutes = require('./routes/admin');
const analyticsRoutes = require('./routes/analytics');
const notificationRoutes = require('./routes/notifications');
const suggestionsRoutes = require('./routes/suggestions');
const wizardRoutes = require('./routes/wizard');
const dmsRoutes = require('./routes/dms');
const contactsRoutes = require('./routes/contacts');
const intelligenceRoutes = require('./routes/intelligence');
const inboxRoutes = require('./routes/inbox');
const knowledgeRoutes = require('./routes/knowledge');
const webhookRoutes = require('./routes/webhooks');
const workspaceRoutes = require('./routes/workspaces');
const geoRoutes = require('./routes/geo');
const studioRoutes = require('./routes/studio');
const receptionistRoutes = require('./routes/receptionist');
const apiKeysRoutes = require('./routes/apiKeys');
const externalRoutes = require('./routes/external');
const twilioRoutes = require('./routes/twilio');
const gmbMessagesRoutes = require('./routes/gmb-messages');
const GeoAuditService = require('./services/GeoAuditService');
const AutoPostScheduler = require('./services/AutoPostScheduler');
const EmailWorker = require('./services/EmailWorker');
const SuggestionsEngine = require('./services/SuggestionsEngine');
const DMPollingService = require('./services/DMPollingService');
const cron = require('node-cron');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/socialmedia',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('❌ Database connection error:', err.message);
  else console.log('✅ Database connected at', res.rows[0].now);
});

// Give authenticate middleware access to pool for token revocation checks
const { setPool: setAuthPool } = require('./middleware/auth');
setAuthPool(pool);

// Startup diagnostics
console.log('\n═══════════════════════════════════════════');
console.log('🚀 ItsPosting Backend Startup Diagnostics');
console.log('═══════════════════════════════════════════');
console.log('Environment: NODE_ENV =', process.env.NODE_ENV || 'development');
console.log('Services configured:');
console.log('  🖼️  Image generation:', process.env.GOOGLE_AI_API_KEY ? '✓ NanoBanana' : '✗ Not configured');
console.log('  🖼️  Premium images:', process.env.REPLICATE_API_TOKEN ? '✓ Midjourney' : '✗ Not configured');
console.log('  🎥 Video — Veo 3.1 Fast (primary):', process.env.VEO_ENABLED === 'true' && process.env.GOOGLE_AI_API_KEY ? '✓ Enabled' : '✗ Set VEO_ENABLED=true + GOOGLE_AI_API_KEY');
console.log('  🎥 Video — Runway Gen-4 (fallback #1):', process.env.RUNWAY_API_KEY ? '✓ Configured' : '✗ RUNWAY_API_KEY not set');
console.log('  🎥 Video — Pika 2.2 (fallback #2):', process.env.PIKA_API_KEY ? '✓ Configured' : '✗ PIKA_API_KEY not set');
console.log('  🎥 Video — HeyGen (avatar / final fallback):', process.env.HEYGEN_API_KEY ? '✓ Configured' : '✗ HEYGEN_API_KEY not set');
if (process.env.HEYGEN_API_KEY) {
  console.log('     - Voice ID:', process.env.HEYGEN_VOICE_ID ? '✓ Pre-configured' : '⚠️  Will auto-fetch from API');
  console.log('     - Avatar ID:', process.env.HEYGEN_AVATAR_ID ? '✓ Pre-configured' : '⚠️  Will auto-fetch from API');
  console.log('     - Test mode:', process.env.HEYGEN_TEST_MODE === 'true' ? '✓ ON (watermarked videos)' : 'OFF (real credits used)');
}
console.log('  ☁️  Storage:', process.env.CLOUDINARY_CLOUD_NAME ? '✓ Cloudinary' : '✗ Not configured');
console.log('═══════════════════════════════════════════\n');

// Startup schema migrations — safe to re-run (IF NOT EXISTS / IF NOT column already)
(async () => {
  const migrations = [
    `ALTER TABLE posts ADD COLUMN IF NOT EXISTS video_job_id VARCHAR(255)`,
    `CREATE TABLE IF NOT EXISTS trial_ip_registrations (
      id SERIAL PRIMARY KEY,
      ip_address VARCHAR(45) NOT NULL,
      customer_id INTEGER REFERENCES customers(id),
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_trial_ip ON trial_ip_registrations(ip_address)`,
    `CREATE TABLE IF NOT EXISTS post_engagement_snapshots (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      platform VARCHAR(50),
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      saves INTEGER DEFAULT 0,
      reach INTEGER DEFAULT 0,
      impressions INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      video_views INTEGER DEFAULT 0,
      snapshot_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_snapshots_post ON post_engagement_snapshots(post_id)`,
    `CREATE INDEX IF NOT EXISTS idx_snapshots_at ON post_engagement_snapshots(snapshot_at)`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS website_testimonials JSONB DEFAULT '[]'`,
    `CREATE TABLE IF NOT EXISTS business_knowledge (
      id             SERIAL PRIMARY KEY,
      customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      knowledge_type VARCHAR(50)  NOT NULL,
      title          VARCHAR(255) NOT NULL,
      content        TEXT         NOT NULL,
      sort_order     INTEGER  DEFAULT 0,
      is_active      BOOLEAN  DEFAULT true,
      created_at     TIMESTAMP DEFAULT NOW(),
      updated_at     TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_knowledge_customer ON business_knowledge(customer_id, knowledge_type, is_active)`,
    `CREATE TABLE IF NOT EXISTS wizard_sessions (
      id         VARCHAR(36)  PRIMARY KEY,
      customer_id INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      data       JSONB        NOT NULL,
      expires_at TIMESTAMP    NOT NULL,
      created_at TIMESTAMP    DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_wizard_sessions_customer ON wizard_sessions(customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_wizard_sessions_expires  ON wizard_sessions(expires_at)`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS parent_customer_id INTEGER REFERENCES customers(id)`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS workspace_display_name VARCHAR(100)`,
    `CREATE INDEX IF NOT EXISTS idx_customers_parent ON customers(parent_customer_id)`,
    `CREATE TABLE IF NOT EXISTS admin_audit_log (
      id          SERIAL PRIMARY KEY,
      admin_id    INTEGER REFERENCES customers(id),
      admin_email VARCHAR(255),
      action      VARCHAR(100) NOT NULL,
      target_type VARCHAR(50),
      target_id   INTEGER,
      details     JSONB,
      ip_address  VARCHAR(45),
      user_agent  TEXT,
      created_at  TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_audit_log_admin  ON admin_audit_log(admin_id)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_log_target ON admin_audit_log(target_type, target_id)`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id          SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      type        VARCHAR(50)  NOT NULL,
      title       VARCHAR(255) NOT NULL,
      message     TEXT,
      read        BOOLEAN DEFAULT false,
      created_at  TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_customer ON notifications(customer_id, read)`,
    `ALTER TABLE posts ADD COLUMN IF NOT EXISTS video_render_status VARCHAR(20) DEFAULT 'none'`,
    `ALTER TABLE posts ADD COLUMN IF NOT EXISTS video_provider VARCHAR(50)`,
    // GEO Audit tables
    `CREATE TABLE IF NOT EXISTS geo_audits (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'pending',
      geo_score INTEGER DEFAULT 0,
      citations_found INTEGER DEFAULT 0,
      total_queries INTEGER DEFAULT 45,
      industry VARCHAR(100),
      location VARCHAR(255),
      report_data JSONB,
      is_free BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      completed_at TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_geo_audits_customer ON geo_audits(customer_id, created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS geo_citations (
      id SERIAL PRIMARY KEY,
      audit_id INTEGER REFERENCES geo_audits(id) ON DELETE CASCADE,
      engine VARCHAR(20),
      query_text TEXT,
      response_excerpt TEXT,
      business_mentioned BOOLEAN DEFAULT false,
      mention_position INTEGER,
      competitors_mentioned TEXT[],
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_geo_citations_audit ON geo_citations(audit_id)`,
    `CREATE TABLE IF NOT EXISTS geo_tracking_scores (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      geo_score INTEGER,
      citations_found INTEGER,
      week_start DATE,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_geo_tracking_customer ON geo_tracking_scores(customer_id, week_start DESC)`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS geo_score INTEGER DEFAULT 0`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_geo_audit_at TIMESTAMP`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS free_geo_audit_used BOOLEAN DEFAULT false`,
    // Photo Studio tables
    `CREATE TABLE IF NOT EXISTS stock_photos (
      id                    SERIAL PRIMARY KEY,
      industry              VARCHAR(100) NOT NULL,
      category              VARCHAR(100) NOT NULL,
      tags                  TEXT[] DEFAULT '{}',
      url                   TEXT NOT NULL,
      thumbnail_url         TEXT,
      cloudinary_public_id  VARCHAR(500),
      title                 VARCHAR(255),
      description           TEXT,
      width                 INTEGER,
      height                INTEGER,
      file_size_bytes       BIGINT,
      is_active             BOOLEAN DEFAULT true,
      usage_count           INTEGER DEFAULT 0,
      created_at            TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_stock_photos_industry ON stock_photos(industry, category, is_active)`,
    `CREATE INDEX IF NOT EXISTS idx_stock_photos_tags ON stock_photos USING GIN(tags)`,
    `CREATE TABLE IF NOT EXISTS studio_creations (
      id                    SERIAL PRIMARY KEY,
      customer_id           INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      stock_photo_id        INTEGER REFERENCES stock_photos(id) ON DELETE SET NULL,
      prompt                TEXT,
      overlay_title         VARCHAR(255),
      overlay_subtitle      TEXT,
      overlay_style         VARCHAR(50)   DEFAULT 'banner',
      overlay_color         VARCHAR(20)   DEFAULT '#1a5c2a',
      text_color            VARCHAR(20)   DEFAULT '#ffffff',
      overlay_opacity       NUMERIC(3,2)  DEFAULT 0.85,
      output_url            TEXT,
      output_cloudinary_id  VARCHAR(500),
      post_id               INTEGER REFERENCES posts(id) ON DELETE SET NULL,
      status                VARCHAR(50)   DEFAULT 'created',
      created_at            TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_studio_customer ON studio_creations(customer_id, created_at DESC)`,
    // AI Receptionist — crawler job tracking
    `CREATE TABLE IF NOT EXISTS crawl_jobs (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      mode VARCHAR(20) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      pages_found INTEGER DEFAULT 0,
      pages_crawled INTEGER DEFAULT 0,
      pages_failed INTEGER DEFAULT 0,
      result_summary JSONB,
      error TEXT,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_crawl_jobs_customer ON crawl_jobs(customer_id, created_at DESC)`,
    // AI Receptionist — per-customer settings
    `CREATE TABLE IF NOT EXISTS receptionist_config (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
      enabled BOOLEAN DEFAULT false,
      auto_handle BOOLEAN DEFAULT false,
      active_platforms TEXT[] DEFAULT '{}',
      tone VARCHAR(30) DEFAULT 'friendly',
      escalate_keywords TEXT[] DEFAULT '{"legal","lawsuit","refund","scam","terrible"}',
      booking_link TEXT,
      business_hours_start TIME DEFAULT '08:00',
      business_hours_end TIME DEFAULT '18:00',
      timezone VARCHAR(100) DEFAULT 'UTC',
      after_hours_message TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    // AI Receptionist — extend contacts for receptionist pipeline
    `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS receptionist_stage VARCHAR(30)`,
    `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS appointment_at TIMESTAMP`,
    `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS cal_event_id VARCHAR(255)`,
    `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_ai_summary TEXT`,
    // AI Receptionist — SMS / WhatsApp conversations (Phase 2)
    `CREATE TABLE IF NOT EXISTS sms_conversations (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      platform VARCHAR(20) NOT NULL,
      contact_phone VARCHAR(30) NOT NULL,
      contact_name VARCHAR(255),
      status VARCHAR(20) DEFAULT 'open',
      last_message_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sms_convs_customer ON sms_conversations(customer_id, last_message_at DESC)`,
    `CREATE TABLE IF NOT EXISTS sms_messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER REFERENCES sms_conversations(id) ON DELETE CASCADE,
      direction VARCHAR(10) NOT NULL,
      body TEXT NOT NULL,
      sent_at TIMESTAMP DEFAULT NOW(),
      ai_handled BOOLEAN DEFAULT false
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sms_msgs_conv ON sms_messages(conversation_id, sent_at)`,
    // AI Receptionist — outbound job tracking (Phase 3)
    `CREATE TABLE IF NOT EXISTS outbound_jobs (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      contact_id INTEGER,
      job_type VARCHAR(50) NOT NULL,
      platform VARCHAR(20),
      scheduled_for TIMESTAMP NOT NULL,
      sent_at TIMESTAMP,
      status VARCHAR(20) DEFAULT 'pending',
      payload JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_outbound_jobs_customer ON outbound_jobs(customer_id, status, scheduled_for)`,
    // AI Receptionist — track which DM messages were AI-auto-handled
    `ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS ai_handled BOOLEAN DEFAULT false`,
    // Phase 2 — Twilio phone numbers on customers
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS twilio_phone_number VARCHAR(30)`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS twilio_whatsapp_number VARCHAR(50)`,
    // Phase 2 — unique constraint for sms_conversations upsert
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_convs_unique ON sms_conversations(customer_id, platform, contact_phone)`,
    // Phase 2 — unique constraint for dm_conversations GMB upsert
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_convs_unique ON dm_conversations(customer_id, platform, external_conversation_id)`,
    // Per-customer credentials — stored in receptionist_config, not server env vars
    `ALTER TABLE receptionist_config ADD COLUMN IF NOT EXISTS twilio_account_sid TEXT`,
    `ALTER TABLE receptionist_config ADD COLUMN IF NOT EXISTS twilio_auth_token TEXT`,
    `ALTER TABLE receptionist_config ADD COLUMN IF NOT EXISTS twilio_phone_number VARCHAR(30)`,
    `ALTER TABLE receptionist_config ADD COLUMN IF NOT EXISTS twilio_whatsapp_number VARCHAR(50)`,
    `ALTER TABLE receptionist_config ADD COLUMN IF NOT EXISTS calcom_api_key TEXT`,
    `ALTER TABLE receptionist_config ADD COLUMN IF NOT EXISTS mailgun_api_key TEXT`,
    `ALTER TABLE receptionist_config ADD COLUMN IF NOT EXISTS mailgun_domain VARCHAR(255)`,
    `ALTER TABLE receptionist_config ADD COLUMN IF NOT EXISTS mailgun_from_email VARCHAR(255)`,
    `ALTER TABLE receptionist_config ADD COLUMN IF NOT EXISTS automation_config JSONB`,
    `ALTER TABLE receptionist_config ADD COLUMN IF NOT EXISTS meta_wa_phone_number_id TEXT`,
    `ALTER TABLE receptionist_config ADD COLUMN IF NOT EXISTS meta_wa_access_token TEXT`,
    `ALTER TABLE receptionist_config ADD COLUMN IF NOT EXISTS meta_wa_business_id TEXT`,
    // Social publishing
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS auto_post_enabled BOOLEAN DEFAULT true`,
    `ALTER TABLE posts ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0`,
    `ALTER TABLE posts ADD COLUMN IF NOT EXISTS error_message TEXT`,
    `ALTER TABLE posts ADD COLUMN IF NOT EXISTS platform_post_ids JSONB`,
    `ALTER TABLE posts ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP`,
    `ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS account_username VARCHAR(255)`,
    `ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS refresh_token TEXT`,
    `ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS connected_at TIMESTAMP DEFAULT NOW()`,
    // Developer API keys
    `CREATE TABLE IF NOT EXISTS api_keys (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      key_prefix VARCHAR(20) NOT NULL,
      key_hash VARCHAR(64) NOT NULL UNIQUE,
      scopes TEXT[] NOT NULL DEFAULT '{}',
      expires_at TIMESTAMPTZ,
      last_used_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_api_keys_customer ON api_keys(customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`,
  ];
  for (const sql of migrations) {
    try { await pool.query(sql); }
    catch (e) { console.warn('[Migration] Skipped:', e.message.substring(0, 80)); }
  }
})();

app.use(helmet());
app.use(compression());

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: 'Too many requests, please try again later.', standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many authentication attempts. Try again in 15 minutes.', skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false });
const passwordResetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3, message: 'Too many password reset attempts. Try again in 1 hour.', standardHeaders: true, legacyHeaders: false });
const generationLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, message: { error: 'Generation limit reached — wait an hour or upgrade your plan' }, standardHeaders: true, legacyHeaders: false });

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', passwordResetLimiter);
app.use('/api/wizard/generate', generationLimiter);
app.use('/api/wizard/refresh', generationLimiter);
app.use('/api/wizard/regenerate-image', generationLimiter);
app.use('/api/content/generate', generationLimiter);
app.use('/api/v1/generate', generationLimiter);

app.use(cors({
  origin: (origin, cb) => {
    const allowed = (process.env.FRONTEND_URL || 'http://localhost:5000').split(',').map(s => s.trim());
    if (!origin) {
      // In production require an Origin header; allow curl/tools locally
      if (process.env.NODE_ENV === 'production') return cb(new Error('Origin header required'));
      return cb(null, true);
    }
    if (allowed.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
// Webhooks must be registered BEFORE express.json() — they need raw body for HMAC verification
app.use('/api/webhooks', webhookRoutes(pool));
// Upload/media routes use multer (no JSON body) — keep 10mb only for urlencoded (base64 previews).
// All JSON routes are capped at 1mb to prevent memory-exhaustion via oversized payloads.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (res.statusCode >= 400 || duration > 1000) {
      console.log(JSON.stringify({ timestamp: new Date().toISOString(), method: req.method, path: req.path, status: res.statusCode, durationMs: duration, ip: req.ip, userId: req.customerId || null }));
    }
  });
  next();
});

app.use('/api/auth', authRoutes(pool));
app.use('/api/customers', customerRoutes(pool));
app.use('/api/posts', postRoutes(pool));
app.use('/api/content', contentRoutes(pool));
app.use('/api/social', socialRoutes(pool));
app.use('/api/scraper', scraperRoutes(pool));
app.use('/api/upload', uploadRoutes(pool));
app.use('/api/billing', billingRoutes(pool));
app.use('/api/media', mediaRoutes(pool));
app.use('/api/admin', adminRoutes(pool));
app.use('/api/analytics', analyticsRoutes(pool));
app.use('/api/notifications', notificationRoutes(pool));
app.use('/api/suggestions', suggestionsRoutes(pool));
app.use('/api/wizard', wizardRoutes(pool));
app.use('/api/dms', dmsRoutes(pool));
app.use('/api/contacts', contactsRoutes(pool));
app.use('/api/intelligence', intelligenceRoutes(pool));
app.use('/api/inbox', inboxRoutes(pool));
app.use('/api/knowledge', knowledgeRoutes(pool));
app.use('/api/workspaces', workspaceRoutes(pool));
app.use('/api/geo', geoRoutes(pool));
app.use('/api/studio', studioRoutes(pool));
app.use('/api/receptionist', receptionistRoutes(pool));
app.use('/api/twilio', twilioRoutes(pool));
app.use('/api/gmb', gmbMessagesRoutes(pool));
app.use('/api/api-keys', apiKeysRoutes(pool));
app.use('/api/v1', externalRoutes(pool));

// Mailgun inbound email webhook — respond 200 immediately, process async
app.post('/api/mailgun/inbound', express.urlencoded({ extended: true, limit: '5mb' }), async (req, res) => {
  res.sendStatus(200);
  try {
    const recipient = req.body.recipient || '';
    const domain = recipient.split('@')[1];
    if (!domain) return;
    const { rows } = await pool.query(
      `SELECT customer_id FROM receptionist_config WHERE mailgun_domain=$1 AND mailgun_api_key IS NOT NULL`,
      [domain]
    );
    if (!rows.length) return;
    const ReceptionistService = require('./services/ReceptionistService');
    const svc = new ReceptionistService(pool);
    await svc.handleIncomingEmail(rows[0].customer_id, req.body);
  } catch (err) {
    console.error('[Mailgun inbound]', err.message);
  }
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString(), database: 'connected', version: '2.1.0' });
  } catch (error) {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

app.get('/', (req, res) => {
  res.json({
    name: 'Its Posting API',
    version: '2.1.0',
    docs: '/health',
    endpoints: { auth: '/api/auth/*', customers: '/api/customers/*', posts: '/api/posts/*', content: '/api/content/*', admin: '/api/admin/*', analytics: '/api/analytics/*' },
  });
});

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, next) => {
  const errorId = Math.random().toString(36).substring(7);
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', errorId, message: err.message, method: req.method, path: req.path, userId: req.customerId || null, ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }) }));
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

async function runTrialExpiry() {
  try {
    const result = await pool.query(`
      UPDATE customers
      SET suspended = true, status = 'suspended', updated_at = NOW()
      WHERE plan = 'trial'
        AND suspended = false
        AND trial_ends_at IS NOT NULL
        AND trial_ends_at < NOW()
      RETURNING id, email, business_name
    `);
    if (result.rows.length > 0) {
      console.log(`[TrialExpiry] Suspended ${result.rows.length} expired trial account(s)`);
      for (const customer of result.rows) {
        try {
          await pool.query(
            `INSERT INTO email_queue (to_email, template_name, template_data, scheduled_at)
             VALUES ($1, $2, $3, NOW())`,
            [customer.email, 'account_suspended', JSON.stringify({ businessName: customer.business_name || 'there', reason: 'Your 7-day free trial has ended. Please upgrade to continue using Its Posting.' })]
          );
        } catch (emailErr) {
          console.error(`[TrialExpiry] Failed to queue email for ${customer.email}:`, emailErr.message);
        }
      }
    }
  } catch (err) {
    console.error('[TrialExpiry] Error:', err.message);
  }
}

runTrialExpiry();
setInterval(runTrialExpiry, 60 * 60 * 1000);

const scheduler = new AutoPostScheduler(pool);
scheduler.start();

const emailWorker = new EmailWorker(pool);
emailWorker.start();

const suggestionsEngine = new SuggestionsEngine(pool);
cron.schedule('0 8 * * *', async () => {
  console.log('[SuggestionsEngine] 8am daily run starting...');
  await suggestionsEngine.generateForAllCustomers();
});
cron.schedule('5 0 * * *', async () => {
  await suggestionsEngine.cleanupExpired();
});
console.log('💡 SuggestionsEngine cron scheduled (8am daily + midnight cleanup)');

const PostCoreAdvisor = require('./services/PostCoreAdvisor');
const postCoreAdvisor = new PostCoreAdvisor(pool);
cron.schedule('0 7 * * 1', async () => {
  console.log('[cron] Generating PostCore weekly briefings...');
  try {
    const customers = await pool.query(
      `SELECT id FROM customers WHERE status IN ('active','trial') AND (suspended = false OR suspended IS NULL) LIMIT 200`
    );
    let done = 0, fail = 0;
    for (const c of customers.rows) {
      try { await postCoreAdvisor.generateWeeklyBriefing(c.id); done++; }
      catch (e) { fail++; console.error(`[cron] briefing failed for ${c.id}:`, e.message); }
    }
    console.log(`[cron] Briefings: ${done} done, ${fail} failed`);
  } catch (e) { console.error('[cron] Briefings cron error:', e.message); }
});
console.log('📋 PostCoreAdvisor cron scheduled (Monday 7am UTC)');

const geoAuditService = new GeoAuditService(pool);
// Monday 6am UTC — re-audit Pro/Premium customers for weekly GEO tracking
cron.schedule('0 6 * * 1', async () => {
  console.log('[GeoAudit cron] Weekly tracking run starting...');
  try {
    const { rows } = await pool.query(
      `SELECT id, business_name, industry, location FROM customers
       WHERE plan IN ('professional','premium') AND (suspended = false OR suspended IS NULL)
         AND free_geo_audit_used = true AND location IS NOT NULL`
    );
    console.log(`[GeoAudit cron] Re-auditing ${rows.length} Pro/Premium customers`);
    for (const c of rows) {
      try {
        const { rows: [audit] } = await pool.query(
          `INSERT INTO geo_audits (customer_id, industry, location, is_free, status)
           VALUES ($1, $2, $3, false, 'running') RETURNING id`,
          [c.id, c.industry, c.location]
        );
        await geoAuditService.runAudit(c, audit.id);
      } catch (e) {
        console.error(`[GeoAudit cron] Failed for customer ${c.id}:`, e.message);
      }
    }
    console.log('[GeoAudit cron] Weekly tracking complete');
  } catch (e) {
    console.error('[GeoAudit cron] Error:', e.message);
  }
});
console.log('🔍 GeoAudit cron scheduled (Monday 6am UTC — Pro/Premium weekly tracking)');

const PLAN_MONTHLY_CREDITS = { starter: 50, professional: 100, premium: 150 };

async function runMonthlyCredits() {
  try {
    // Allocate credits to customers whose next_billing_date has arrived
    const due = await pool.query(`
      SELECT id, plan, credits_balance, billing_cycle
      FROM customers
      WHERE status = 'active' AND (suspended = false OR suspended IS NULL)
        AND next_billing_date IS NOT NULL
        AND next_billing_date <= NOW()
        AND plan IN ('starter','professional','premium')
    `);
    for (const c of due.rows) {
      const credits = PLAN_MONTHLY_CREDITS[c.plan] || 0;
      if (!credits) continue;
      const newBalance = (c.credits_balance || 0) + credits;
      const nextDate = new Date(Date.now() + 30 * 24 * 3600 * 1000);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE customers SET credits_balance=$1, credits_used_this_month=0,
           next_billing_date=$2, updated_at=NOW() WHERE id=$3`,
          [newBalance, nextDate, c.id]
        );
        await client.query(
          `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
           VALUES ($1,'bonus',$2,$3,$4)`,
          [c.id, credits, newBalance, `Monthly ${c.plan} plan credits (+${credits} credits, rolled over)`]
        );
        await client.query('COMMIT');
        console.log(`[MonthlyCredits] +${credits} credits for customer ${c.id} (${c.plan})`);
      } catch (e) {
        await client.query('ROLLBACK');
        console.error(`[MonthlyCredits] Error for customer ${c.id}:`, e.message);
      } finally {
        client.release();
      }
    }

    // Safety net: revoke access for plans that have expired (Whop also sends membership.deactivated)
    // Includes status='cancelled' so cancelled customers also lose access at plan_expires_at
    const expired = await pool.query(`
      SELECT id, email, business_name FROM customers
      WHERE (status = 'active' OR status = 'cancelled') AND (suspended = false OR suspended IS NULL)
        AND plan_expires_at IS NOT NULL
        AND plan_expires_at < NOW()
        AND plan IN ('starter','professional','premium')
    `);
    for (const c of expired.rows) {
      await pool.query(
        `UPDATE customers SET status='inactive', suspended=true, updated_at=NOW() WHERE id=$1`,
        [c.id]
      );
      try {
        await pool.query(
          `INSERT INTO email_queue (to_email, template_name, template_data, scheduled_at)
           VALUES ($1,'account_suspended',$2,NOW())`,
          [c.email, JSON.stringify({ businessName: c.business_name || 'there', reason: 'Your subscription has expired. Please renew your plan to continue using ItsPosting.' })]
        );
      } catch (emailErr) {
        console.error(`[MonthlyCredits] Email error for ${c.email}:`, emailErr.message);
      }
      console.log(`[MonthlyCredits] Revoked access for customer ${c.id} (plan expired)`);
    }
  } catch (err) {
    console.error('[MonthlyCredits] Cron error:', err.message);
  }
}

runMonthlyCredits();
cron.schedule('0 1 * * *', runMonthlyCredits);
console.log('💳 MonthlyCredits cron scheduled (daily 1am UTC)');

// Purge expired wizard sessions from DB daily at 2am
cron.schedule('0 2 * * *', async () => {
  try {
    const r = await pool.query(`DELETE FROM wizard_sessions WHERE expires_at < NOW()`);
    if (r.rowCount > 0) console.log(`[cron] Cleaned up ${r.rowCount} expired wizard session(s)`);
  } catch (e) { console.warn('[cron] wizard_sessions cleanup failed:', e.message); }
});

const dmPollingService = new DMPollingService(pool);
dmPollingService.start();

// ── AI Receptionist — Outbound Queue (Phase 3) ─────────────────────────────
const OutboundQueue = require('./services/OutboundQueue');
const outboundQueue = new OutboundQueue(pool);

// Start BullMQ worker (no-op if REDIS_URL not set)
outboundQueue.startWorker();

// Cron fallback: poll DB for overdue outbound jobs every 15 min when Redis absent
cron.schedule('*/15 * * * *', () => outboundQueue.processPendingJobs().catch(e => console.error('[OutboundQueue cron]', e.message)));
console.log('📤 OutboundQueue cron scheduled (15-min fallback)');

// Weekly re-crawl: every Monday 8am UTC for customers with receptionist enabled
cron.schedule('0 8 * * 1', async () => {
  console.log('[Receptionist] Weekly knowledge re-crawl starting...');
  try {
    const CrawlerService = require('./services/CrawlerService');
    const crawler = new CrawlerService(pool);
    const { rows } = await pool.query(
      `SELECT rc.customer_id, c.plan, cj.url
       FROM receptionist_config rc
       INNER JOIN customers c ON c.id = rc.customer_id
       LEFT JOIN LATERAL (
         SELECT url FROM crawl_jobs WHERE customer_id = rc.customer_id ORDER BY created_at DESC LIMIT 1
       ) cj ON true
       WHERE rc.enabled = true AND cj.url IS NOT NULL
         AND (c.suspended = false OR c.suspended IS NULL)`
    );
    for (const row of rows) {
      try {
        await crawler.crawl(row.customer_id, row.url, 'domain', row.plan || 'professional');
        console.log(`[Receptionist] Re-crawl started for customer ${row.customer_id}`);
      } catch (e) {
        console.error(`[Receptionist] Re-crawl failed for ${row.customer_id}:`, e.message);
      }
    }
  } catch (e) { console.error('[Receptionist] Weekly re-crawl error:', e.message); }
});
console.log('🕷️ Receptionist weekly re-crawl cron scheduled (Monday 8am UTC)');

// Schema migrations — non-blocking, safe to run on every startup
pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ').catch(() => {});

// Purge stale password reset tokens (expired > 1 hour ago) — runs at startup and daily
async function purgeExpiredResetTokens() {
  try {
    const r = await pool.query(
      "UPDATE customers SET password_reset_token = NULL, password_reset_expires = NULL WHERE password_reset_expires < NOW()"
    );
    if (r.rowCount > 0) console.log(`[cron] Cleared ${r.rowCount} expired password reset token(s)`);
  } catch (e) { /* ignore — table may not have column yet */ }
}
purgeExpiredResetTokens();
cron.schedule('0 3 * * *', purgeExpiredResetTokens);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   🚀 Its Posting API Server v2.1.0        ║
║                                           ║
║   📊 Port: ${PORT}                            ║
║   🌍 Env: ${(process.env.NODE_ENV || 'development').padEnd(11)}                    ║
║                                           ║
║   Routes: auth, customers, posts,         ║
║           content, social, scraper,       ║
║           upload, billing, media,         ║
║           admin, analytics,               ║
║           suggestions, dms, contacts      ║
║                                           ║
║   Services:                               ║
║   ${process.env.GOOGLE_AI_API_KEY ? '✅' : '⚠️ '} Image One                           ║
║   ${process.env.REPLICATE_API_TOKEN ? '✅' : '⚠️ '} Image Two                           ║
║   ${process.env.HEYGEN_API_KEY ? '✅' : '⚠️ '} Video                               ║
║   ${process.env.CLOUDINARY_CLOUD_NAME ? '✅' : '⚠️ '} Cloudinary                         ║
║   ${process.env.RESEND_API_KEY ? '✅' : '⚠️ '} Email                               ║
║                                           ║
╚═══════════════════════════════════════════╝
  `);
});

const SHUTDOWN_TIMEOUT = 10000;
async function gracefulShutdown(signal) {
  console.log(`${signal} received, shutting down gracefully...`);
  const forced = setTimeout(() => { console.error('[Shutdown] Forced exit after timeout'); process.exit(1); }, SHUTDOWN_TIMEOUT);
  forced.unref();
  try { await pool.end(); } catch (e) { console.warn('[Shutdown] Pool close warning:', e.message); }
  process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// Prevent unhandled rejections from crashing the process (Node.js 15+ fatal by default)
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Promise Rejection:', reason?.message || reason, '| Promise:', promise);
});
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err.message, err.stack);
});

module.exports = { pool };
