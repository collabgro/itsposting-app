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
const gmbMessagesRoutes = require('./routes/gmb-messages');
const ideasRoutes = require('./routes/ideas');

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
  ssl: process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.includes('localhost') &&
    !process.env.DATABASE_URL.includes('127.0.0.1')
    ? { rejectUnauthorized: false, ciphers: 'DEFAULT:@SECLEVEL=0' }
    : false,
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
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS workspace_role VARCHAR(20) DEFAULT 'editor'`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS workspace_permissions JSONB DEFAULT NULL`,
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
    `ALTER TABLE studio_creations ADD COLUMN IF NOT EXISTS canvas_json JSONB`,
    `ALTER TABLE studio_creations ADD COLUMN IF NOT EXISTS media_library_id INTEGER REFERENCES media_library(id) ON DELETE SET NULL`,
    `ALTER TABLE studio_creations ADD COLUMN IF NOT EXISTS creation_type VARCHAR(20) DEFAULT 'image'`,
    `ALTER TABLE studio_creations ADD COLUMN IF NOT EXISTS video_json JSONB`,
    `ALTER TABLE studio_creations ADD COLUMN IF NOT EXISTS render_status VARCHAR(20) DEFAULT 'none'`,
    `ALTER TABLE studio_creations ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC(8,2)`,
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
    // AI Receptionist — track which DM messages were AI-auto-handled
    `ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS ai_handled BOOLEAN DEFAULT false`,
    `ALTER TABLE dm_conversations ADD COLUMN IF NOT EXISTS external_conversation_id VARCHAR(255)`,
    // Phase 2 — unique constraint for dm_conversations GMB upsert
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_convs_unique ON dm_conversations(customer_id, platform, external_conversation_id)`,
    // Billing columns
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS plan_changed_at TIMESTAMP`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'monthly'`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP`,
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
    // Workspace invitations — proper token-based invite system
    `CREATE TABLE IF NOT EXISTS workspace_invitations (
      id          SERIAL PRIMARY KEY,
      inviter_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      email       VARCHAR(255) NOT NULL,
      token_hash  VARCHAR(64) NOT NULL UNIQUE,
      role        VARCHAR(20) NOT NULL DEFAULT 'editor',
      permissions JSONB DEFAULT NULL,
      status      VARCHAR(20) NOT NULL DEFAULT 'pending',
      expires_at  TIMESTAMPTZ NOT NULL,
      accepted_at TIMESTAMPTZ DEFAULT NULL,
      accepted_by INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_invitations_inviter ON workspace_invitations(inviter_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_invitations_hash    ON workspace_invitations(token_hash)`,
    `CREATE INDEX IF NOT EXISTS idx_invitations_email   ON workspace_invitations(email, status)`,
    // Platform admins — separate role-aware table, decoupled from the customers billing row
    `CREATE TABLE IF NOT EXISTS platform_admins (
      id                   SERIAL PRIMARY KEY,
      customer_id          INTEGER NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
      admin_role           VARCHAR(30) NOT NULL DEFAULT 'support'
                             CHECK (admin_role IN ('super_admin', 'support', 'finance')),
      granted_by           INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      granted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at           TIMESTAMPTZ DEFAULT NULL,
      notes                TEXT,
      last_admin_action_at TIMESTAMPTZ DEFAULT NULL,
      created_at           TIMESTAMPTZ DEFAULT NOW(),
      updated_at           TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_admins_active
       ON platform_admins(customer_id) WHERE revoked_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS idx_platform_admins_role
       ON platform_admins(admin_role) WHERE revoked_at IS NULL`,
    // Backfill existing is_admin customers into platform_admins (idempotent)
    `INSERT INTO platform_admins (customer_id, admin_role, notes, granted_at)
     SELECT id,
       CASE WHEN role = 'super_admin' THEN 'super_admin'
            WHEN role = 'finance'     THEN 'finance'
            ELSE 'support' END,
       'Migrated from customers.is_admin flag',
       COALESCE(created_at, NOW())
     FROM customers WHERE is_admin = true
     ON CONFLICT (customer_id) DO NOTHING`,
    // Workspace members — proper many-to-many join table for invited team members
    // Replaces the overloaded parent_customer_id pattern for real invited users
    `CREATE TABLE IF NOT EXISTS workspace_members (
      id           SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      member_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      owner_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      role         VARCHAR(20) NOT NULL DEFAULT 'editor'
                     CHECK (role IN ('manager', 'editor', 'viewer')),
      permissions  JSONB DEFAULT NULL,
      invited_by   INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at   TIMESTAMPTZ DEFAULT NULL,
      revoked_by   INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (workspace_id, member_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_workspace_members_member
       ON workspace_members(member_id) WHERE revoked_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS idx_workspace_members_owner
       ON workspace_members(owner_id) WHERE revoked_at IS NULL`,
    // Backfill existing real-user invited members into workspace_members (idempotent)
    // Type A rows (fake workspace emails) are intentionally excluded
    `INSERT INTO workspace_members (workspace_id, member_id, owner_id, role, permissions, joined_at)
     SELECT c.parent_customer_id, c.id, c.parent_customer_id,
            COALESCE(c.workspace_role, 'editor'), c.workspace_permissions, c.created_at
     FROM customers c
     WHERE c.parent_customer_id IS NOT NULL
       AND c.email NOT LIKE 'workspace-%@internal.itsposting.com'
       AND c.status != 'inactive'
     ON CONFLICT (workspace_id, member_id) DO NOTHING`,
    // workspace_id on invitations — lets owner invite someone to a specific sub-workspace
    `ALTER TABLE workspace_invitations
       ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES customers(id) ON DELETE SET NULL`,
    // Clear stale legacy columns from Type B rows now tracked in workspace_members.
    // Type A rows (fake workspace emails) are excluded — they still need parent_customer_id.
    `UPDATE customers
     SET parent_customer_id    = NULL,
         workspace_role        = NULL,
         workspace_permissions = NULL,
         updated_at            = NOW()
     WHERE parent_customer_id IS NOT NULL
       AND email NOT LIKE 'workspace-%@internal.itsposting.com'
       AND status != 'inactive'`,
    // Multi-account social: drop old single-account-per-platform constraint
    `ALTER TABLE social_accounts DROP CONSTRAINT IF EXISTS social_accounts_customer_id_platform_key`,
    // Multi-account social: new constraint allows multiple pages/accounts per platform
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_accounts_customer_platform_account_key')
       THEN ALTER TABLE social_accounts ADD CONSTRAINT social_accounts_customer_platform_account_key
            UNIQUE (customer_id, platform, account_id);
       END IF;
     END $$`,
    // Profile groups: named bundles of social accounts for quick selection
    `CREATE TABLE IF NOT EXISTS social_account_groups (
       id          SERIAL PRIMARY KEY,
       customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
       name        VARCHAR(100) NOT NULL,
       created_at  TIMESTAMP DEFAULT NOW()
     )`,
    `CREATE TABLE IF NOT EXISTS social_account_group_members (
       group_id          INTEGER NOT NULL REFERENCES social_account_groups(id) ON DELETE CASCADE,
       social_account_id INTEGER NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
       PRIMARY KEY (group_id, social_account_id)
     )`,
    // Per-platform caption customization
    `ALTER TABLE posts ADD COLUMN IF NOT EXISTS platform_captions JSONB DEFAULT '{}'`,
    // Location tagging for FB/IG posts
    `ALTER TABLE posts ADD COLUMN IF NOT EXISTS location_name VARCHAR(255)`,
    `ALTER TABLE posts ADD COLUMN IF NOT EXISTS location_id   VARCHAR(255)`,
    // Daily AI-researched post ideas per customer
    `CREATE TABLE IF NOT EXISTS post_ideas (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      ideas JSONB NOT NULL DEFAULT '[]',
      generated_date DATE NOT NULL,
      refreshed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(customer_id, generated_date)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_post_ideas_customer_date ON post_ideas(customer_id, generated_date)`,
    // ItsPosting curated canvas templates (industry-specific, admin-managed)
    `CREATE TABLE IF NOT EXISTS canvas_templates (
      id             SERIAL PRIMARY KEY,
      name           VARCHAR(255) NOT NULL,
      industry       VARCHAR(100) DEFAULT 'general',
      category       VARCHAR(100),
      canvas_json    JSONB NOT NULL DEFAULT '{}',
      thumbnail_url  TEXT,
      canvas_width   INTEGER DEFAULT 1080,
      canvas_height  INTEGER DEFAULT 1350,
      sort_order     INTEGER DEFAULT 0,
      is_active      BOOLEAN DEFAULT true,
      created_at     TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_canvas_templates_industry ON canvas_templates(industry, is_active)`,
  ];
  for (const sql of migrations) {
    try { await pool.query(sql); }
    catch (e) { console.warn('[Migration] Skipped:', e.message.substring(0, 80)); }
  }

  // Seed canvas templates — idempotent: inserts each template only if name not already present
  try {
    const TEAL = '#00C4CC', PURPLE = '#7C5CFC', GOLD = '#FFB800', RED = '#ef4444', NAVY = '#0f3460', DARK = '#1a1a2e';
    const mkPage = (bgColor, elements) => ({ activePage: 0, pages: [{ id: 'p1', bgType: 'color', bgColor, lockedIds: [], hiddenIds: [], duration: 5, elements }] });
    const t = (id, c, props) => ({ id, type: 'text', ...props });
    const r = (id, c, props) => ({ id, type: 'rect', cornerRadius: 0, strokeWidth: 0, ...props });

    const ALL_TEMPLATES = [
      // ── BEFORE & AFTER ────────────────────────────────────────────────────────
      { name: 'Before & After — Split Dark', industry: 'general', category: 'before-after', sort_order: 10,
        canvas_json: mkPage('#2d2d2d', [
          r('e1',null,{ x:0,y:0,width:540,height:1350,fill:'#2d2d2d' }),
          r('e2',null,{ x:540,y:0,width:540,height:1350,fill:'#f0f9f0' }),
          r('e3',null,{ x:535,y:0,width:10,height:1350,fill:'#ffffff' }),
          t('e4',null,{ x:40,y:60,width:460,height:60,content:'BEFORE',fontFamily:'Inter',fontSize:28,fontWeight:'800',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e5',null,{ x:580,y:60,width:460,height:60,content:'AFTER',fontFamily:'Inter',fontSize:28,fontWeight:'800',fill:TEAL,align:'left',verticalAlign:'middle' }),
          t('e6',null,{ x:40,y:560,width:460,height:200,content:'Add your\nBefore photo',fontFamily:'Inter',fontSize:34,fontWeight:'400',fill:'rgba(255,255,255,0.3)',align:'center',verticalAlign:'middle',lineHeight:1.4 }),
          t('e7',null,{ x:580,y:560,width:460,height:200,content:'Add your\nAfter photo',fontFamily:'Inter',fontSize:34,fontWeight:'400',fill:'rgba(0,100,0,0.3)',align:'center',verticalAlign:'middle',lineHeight:1.4 }),
          t('e8',null,{ x:80,y:1160,width:920,height:120,content:'See the difference we make — Business Name',fontFamily:'Inter',fontSize:30,fontWeight:'600',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
        ]) },
      { name: 'Before & After — Clean Light', industry: 'general', category: 'before-after', sort_order: 11,
        canvas_json: mkPage('#f8f8f8', [
          r('e1',null,{ x:0,y:0,width:1080,height:8,fill:TEAL }),
          t('e2',null,{ x:80,y:60,width:920,height:80,content:'TRANSFORMATION',fontFamily:'Inter',fontSize:36,fontWeight:'900',fill:TEAL,align:'center',verticalAlign:'middle' }),
          r('e3',null,{ x:0,y:168,width:535,height:900,fill:'#e8e8e8' }),
          r('e4',null,{ x:545,y:168,width:535,height:900,fill:'#d4f4f4' }),
          t('e5',null,{ x:40,y:200,width:240,height:50,content:'BEFORE',fontFamily:'Inter',fontSize:22,fontWeight:'800',fill:'#999999',align:'left',verticalAlign:'middle' }),
          t('e6',null,{ x:590,y:200,width:240,height:50,content:'AFTER',fontFamily:'Inter',fontSize:22,fontWeight:'800',fill:TEAL,align:'left',verticalAlign:'middle' }),
          r('e7',null,{ x:536,y:168,width:8,height:900,fill:'#ffffff' }),
          t('e8',null,{ x:80,y:1120,width:920,height:60,content:'Your Business Name • Call (555) 000-0000',fontFamily:'Inter',fontSize:24,fontWeight:'600',fill:'#333333',align:'center',verticalAlign:'middle' }),
          t('e9',null,{ x:80,y:1210,width:920,height:80,content:'Quality work guaranteed. Every time.',fontFamily:'Inter',fontSize:30,fontWeight:'700',fill:TEAL,align:'center',verticalAlign:'middle' }),
        ]) },
      { name: 'Before & After — Results', industry: 'trades', category: 'before-after', sort_order: 12,
        canvas_json: mkPage(DARK, [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:DARK }),
          r('e2',null,{ x:80,y:80,width:920,height:4,fill:TEAL }),
          t('e3',null,{ x:80,y:120,width:920,height:100,content:'Real Results.\nReal Customers.',fontFamily:'Inter',fontSize:52,fontWeight:'900',fill:'#ffffff',align:'center',verticalAlign:'top',lineHeight:1.15 }),
          r('e4',null,{ x:80,y:360,width:920,height:500,fill:'rgba(255,255,255,0.04)',cornerRadius:12 }),
          t('e5',null,{ x:160,y:420,width:360,height:60,content:'BEFORE',fontFamily:'Inter',fontSize:22,fontWeight:'800',fill:'rgba(255,255,255,0.4)',align:'center',verticalAlign:'middle' }),
          t('e6',null,{ x:580,y:420,width:360,height:60,content:'AFTER',fontFamily:'Inter',fontSize:22,fontWeight:'800',fill:TEAL,align:'center',verticalAlign:'middle' }),
          r('e7',null,{ x:530,y:380,width:2,height:480,fill:'rgba(255,255,255,0.12)' }),
          t('e8',null,{ x:80,y:920,width:920,height:60,content:'★ ★ ★ ★ ★  "Best decision we ever made"',fontFamily:'Inter',fontSize:26,fontWeight:'500',fill:GOLD,align:'center',verticalAlign:'middle' }),
          t('e9',null,{ x:80,y:1010,width:920,height:200,content:'Replace with what you did, how fast, and what the customer said afterward.',fontFamily:'Inter',fontSize:34,fontWeight:'400',fill:'rgba(255,255,255,0.7)',align:'center',verticalAlign:'top',lineHeight:1.5 }),
          t('e10',null,{ x:80,y:1260,width:920,height:60,content:'Business Name • yourwebsite.com',fontFamily:'Inter',fontSize:22,fontWeight:'500',fill:'rgba(255,255,255,0.4)',align:'center',verticalAlign:'middle' }),
        ]) },
      { name: 'Before & After — Stats', industry: 'trades', category: 'before-after', sort_order: 13,
        canvas_json: mkPage('#ffffff', [
          r('e1',null,{ x:0,y:0,width:1080,height:14,fill:PURPLE }),
          r('e2',null,{ x:0,y:14,width:1080,height:6,fill:TEAL }),
          t('e3',null,{ x:80,y:80,width:920,height:120,content:'Before & After',fontFamily:'Inter',fontSize:64,fontWeight:'900',fill:'#111111',align:'left',verticalAlign:'top',lineHeight:1.1 }),
          r('e4',null,{ x:80,y:230,width:120,height:6,fill:TEAL,cornerRadius:3 }),
          t('e5',null,{ x:80,y:270,width:920,height:120,content:'Replace this text with the specific problem you fixed — make it concrete and visual.',fontFamily:'Inter',fontSize:34,fontWeight:'400',fill:'#444444',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          r('e6',null,{ x:80,y:560,width:920,height:400,fill:'#f4f4f4',cornerRadius:12 }),
          t('e7',null,{ x:100,y:590,width:260,height:340,content:'98%',fontFamily:'Inter',fontSize:90,fontWeight:'900',fill:TEAL,align:'center',verticalAlign:'middle' }),
          t('e8',null,{ x:100,y:720,width:260,height:60,content:'Satisfied',fontFamily:'Inter',fontSize:22,fontWeight:'600',fill:'#666666',align:'center',verticalAlign:'middle' }),
          r('e9',null,{ x:370,y:600,width:2,height:320,fill:'#dddddd' }),
          t('e10',null,{ x:390,y:590,width:260,height:340,content:'100+',fontFamily:'Inter',fontSize:90,fontWeight:'900',fill:PURPLE,align:'center',verticalAlign:'middle' }),
          t('e11',null,{ x:390,y:720,width:260,height:60,content:'Jobs Done',fontFamily:'Inter',fontSize:22,fontWeight:'600',fill:'#666666',align:'center',verticalAlign:'middle' }),
          r('e12',null,{ x:660,y:600,width:2,height:320,fill:'#dddddd' }),
          t('e13',null,{ x:680,y:590,width:280,height:340,content:'5★',fontFamily:'Inter',fontSize:90,fontWeight:'900',fill:GOLD,align:'center',verticalAlign:'middle' }),
          t('e14',null,{ x:680,y:720,width:280,height:60,content:'Avg Rating',fontFamily:'Inter',fontSize:22,fontWeight:'600',fill:'#666666',align:'center',verticalAlign:'middle' }),
          t('e15',null,{ x:80,y:1000,width:920,height:80,content:'Business Name — Serving Your City Since [Year]',fontFamily:'Inter',fontSize:28,fontWeight:'600',fill:'#333333',align:'center',verticalAlign:'middle' }),
        ]) },

      // ── CUSTOMER REVIEWS / SOCIAL PROOF ──────────────────────────────────────
      { name: 'Customer Review — Classic', industry: 'general', category: 'social-proof', sort_order: 20,
        canvas_json: mkPage('#ffffff', [
          r('e1',null,{ x:0,y:0,width:1080,height:12,fill:PURPLE }),
          t('e2',null,{ x:60,y:100,width:200,height:200,content:'"',fontFamily:'Georgia',fontSize:200,fontWeight:'700',fill:TEAL,align:'left',verticalAlign:'top',lineHeight:1 }),
          t('e3',null,{ x:80,y:280,width:920,height:60,content:'★ ★ ★ ★ ★',fontFamily:'Inter',fontSize:44,fontWeight:'400',fill:GOLD,align:'left',verticalAlign:'middle' }),
          t('e4',null,{ x:80,y:370,width:920,height:480,content:'"Paste your customer review here. Keep the most impactful sentence — the one that would make someone hire you on the spot."',fontFamily:'Georgia',fontSize:38,fontWeight:'400',fill:'#333333',align:'left',verticalAlign:'top',lineHeight:1.55 }),
          t('e5',null,{ x:80,y:900,width:920,height:70,content:'— Customer Name, City',fontFamily:'Inter',fontSize:28,fontWeight:'600',fill:'#555555',align:'left',verticalAlign:'middle' }),
          r('e6',null,{ x:80,y:990,width:920,height:2,fill:'#eeeeee',cornerRadius:1 }),
          t('e7',null,{ x:80,y:1020,width:920,height:60,content:'Your Business Name',fontFamily:'Inter',fontSize:26,fontWeight:'700',fill:PURPLE,align:'left',verticalAlign:'middle' }),
        ]) },
      { name: '5-Star Spotlight', industry: 'general', category: 'social-proof', sort_order: 21,
        canvas_json: mkPage(DARK, [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:DARK }),
          t('e2',null,{ x:80,y:120,width:920,height:200,content:'★★★★★',fontFamily:'Inter',fontSize:120,fontWeight:'400',fill:GOLD,align:'center',verticalAlign:'middle' }),
          r('e3',null,{ x:340,y:340,width:400,height:4,fill:TEAL,cornerRadius:2 }),
          t('e4',null,{ x:80,y:380,width:920,height:500,content:'"Replace this with your customer\'s exact words. The most powerful reviews are specific — they mention the problem, the solution, and how they feel now."',fontFamily:'Georgia',fontSize:40,fontWeight:'400',fill:'#ffffff',align:'center',verticalAlign:'top',lineHeight:1.5 }),
          t('e5',null,{ x:80,y:920,width:920,height:80,content:'— Customer Name',fontFamily:'Inter',fontSize:32,fontWeight:'600',fill:TEAL,align:'center',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:1020,width:920,height:60,content:'Verified Customer',fontFamily:'Inter',fontSize:22,fontWeight:'400',fill:'rgba(255,255,255,0.4)',align:'center',verticalAlign:'middle' }),
          r('e7',null,{ x:80,y:1160,width:920,height:80,fill:TEAL,cornerRadius:8 }),
          t('e8',null,{ x:80,y:1160,width:920,height:80,content:'Business Name — City',fontFamily:'Inter',fontSize:26,fontWeight:'700',fill:'#000000',align:'center',verticalAlign:'middle' }),
        ]) },
      { name: 'Testimonial — Minimal', industry: 'general', category: 'social-proof', sort_order: 22,
        canvas_json: mkPage('#f9f9f9', [
          r('e1',null,{ x:80,y:80,width:6,height:1200,fill:TEAL,cornerRadius:3 }),
          t('e2',null,{ x:130,y:120,width:870,height:80,content:'★ ★ ★ ★ ★',fontFamily:'Inter',fontSize:40,fontWeight:'400',fill:GOLD,align:'left',verticalAlign:'middle' }),
          t('e3',null,{ x:130,y:240,width:870,height:560,content:'"This is where your customer review goes. Real words from a real person who was in the same situation as your next customer."',fontFamily:'Georgia',fontSize:44,fontWeight:'400',fill:'#222222',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          t('e4',null,{ x:130,y:850,width:870,height:80,content:'— Customer Name, Neighborhood',fontFamily:'Inter',fontSize:28,fontWeight:'700',fill:'#444444',align:'left',verticalAlign:'middle' }),
          r('e5',null,{ x:130,y:970,width:500,height:3,fill:'#dddddd',cornerRadius:2 }),
          t('e6',null,{ x:130,y:1000,width:870,height:60,content:'Business Name',fontFamily:'Inter',fontSize:26,fontWeight:'800',fill:TEAL,align:'left',verticalAlign:'middle' }),
          t('e7',null,{ x:130,y:1070,width:870,height:50,content:'Trusted by 200+ homeowners in [City]',fontFamily:'Inter',fontSize:22,fontWeight:'400',fill:'#888888',align:'left',verticalAlign:'middle' }),
        ]) },
      { name: 'Trust & Credibility', industry: 'general', category: 'social-proof', sort_order: 23,
        canvas_json: mkPage('#ffffff', [
          r('e1',null,{ x:0,y:0,width:1080,height:10,fill:TEAL }),
          t('e2',null,{ x:80,y:80,width:920,height:120,content:'Why Homeowners\nChoose Us',fontFamily:'Inter',fontSize:60,fontWeight:'900',fill:'#111111',align:'center',verticalAlign:'top',lineHeight:1.15 }),
          r('e3',null,{ x:80,y:280,width:920,height:140,fill:'#f0fdfe',cornerRadius:10 }),
          t('e4',null,{ x:100,y:280,width:880,height:140,content:'✓  Licensed & Insured  •  [N] Years Experience',fontFamily:'Inter',fontSize:30,fontWeight:'600',fill:'#333333',align:'left',verticalAlign:'middle' }),
          r('e5',null,{ x:80,y:440,width:920,height:140,fill:'#f0fdfe',cornerRadius:10 }),
          t('e6',null,{ x:100,y:440,width:880,height:140,content:'✓  Same-Day Service Available',fontFamily:'Inter',fontSize:30,fontWeight:'600',fill:'#333333',align:'left',verticalAlign:'middle' }),
          r('e7',null,{ x:80,y:600,width:920,height:140,fill:'#f0fdfe',cornerRadius:10 }),
          t('e8',null,{ x:100,y:600,width:880,height:140,content:'✓  Upfront Pricing. No Surprises.',fontFamily:'Inter',fontSize:30,fontWeight:'600',fill:'#333333',align:'left',verticalAlign:'middle' }),
          r('e9',null,{ x:80,y:760,width:920,height:140,fill:'#f0fdfe',cornerRadius:10 }),
          t('e10',null,{ x:100,y:760,width:880,height:140,content:'✓  100% Satisfaction Guaranteed',fontFamily:'Inter',fontSize:30,fontWeight:'600',fill:'#333333',align:'left',verticalAlign:'middle' }),
          t('e11',null,{ x:80,y:960,width:920,height:80,content:'★ ★ ★ ★ ★   Rated 5 Stars on Google',fontFamily:'Inter',fontSize:30,fontWeight:'600',fill:GOLD,align:'center',verticalAlign:'middle' }),
          r('e12',null,{ x:80,y:1080,width:920,height:3,fill:'#eeeeee',cornerRadius:2 }),
          t('e13',null,{ x:80,y:1110,width:920,height:80,content:'Business Name • (555) 000-0000',fontFamily:'Inter',fontSize:28,fontWeight:'700',fill:TEAL,align:'center',verticalAlign:'middle' }),
          t('e14',null,{ x:80,y:1210,width:920,height:60,content:'Serving [City] and surrounding areas',fontFamily:'Inter',fontSize:22,fontWeight:'400',fill:'#888888',align:'center',verticalAlign:'middle' }),
        ]) },

      // ── SEASONAL / URGENT ─────────────────────────────────────────────────────
      { name: 'Seasonal Alert — Urgent', industry: 'general', category: 'seasonal', sort_order: 30,
        canvas_json: mkPage(NAVY, [
          r('e1',null,{ x:80,y:200,width:300,height:56,fill:RED,cornerRadius:28 }),
          t('e2',null,{ x:80,y:200,width:300,height:56,content:'⚠ SEASONAL ALERT',fontFamily:'Inter',fontSize:20,fontWeight:'800',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e3',null,{ x:80,y:300,width:920,height:340,content:"It's That\nTime of Year",fontFamily:'Inter',fontSize:90,fontWeight:'900',fill:'#ffffff',align:'left',verticalAlign:'top',lineHeight:1.1 }),
          t('e4',null,{ x:80,y:680,width:920,height:220,content:'Replace with your seasonal message — frozen pipes, storm damage, spring AC check — whatever is most urgent right now.',fontFamily:'Inter',fontSize:34,fontWeight:'400',fill:'rgba(255,255,255,0.85)',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          r('e5',null,{ x:80,y:960,width:500,height:80,fill:TEAL,cornerRadius:8 }),
          t('e6',null,{ x:80,y:960,width:500,height:80,content:'Call Now: (555) 000-0000',fontFamily:'Inter',fontSize:30,fontWeight:'700',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e7',null,{ x:80,y:1240,width:920,height:60,content:'Business Name — Your City',fontFamily:'Inter',fontSize:26,fontWeight:'600',fill:'rgba(255,255,255,0.6)',align:'left',verticalAlign:'middle' }),
        ]) },
      { name: 'Winter Ready — Cold Alert', industry: 'general', category: 'seasonal', sort_order: 31,
        canvas_json: mkPage('#0a1628', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#0a1628' }),
          t('e2',null,{ x:80,y:100,width:920,height:120,content:'❄ WINTER ALERT ❄',fontFamily:'Inter',fontSize:48,fontWeight:'900',fill:'#90d5f5',align:'center',verticalAlign:'middle' }),
          r('e3',null,{ x:80,y:240,width:920,height:6,fill:'rgba(144,213,245,0.3)',cornerRadius:3 }),
          t('e4',null,{ x:80,y:290,width:920,height:260,content:'Protect Your Home\nThis Winter',fontFamily:'Inter',fontSize:88,fontWeight:'900',fill:'#ffffff',align:'center',verticalAlign:'top',lineHeight:1.1 }),
          t('e5',null,{ x:80,y:600,width:920,height:280,content:'Cold weather puts your pipes, heating system, and roof at risk. Don\'t wait for an emergency — schedule your check-up today.',fontFamily:'Inter',fontSize:36,fontWeight:'400',fill:'rgba(255,255,255,0.8)',align:'center',verticalAlign:'top',lineHeight:1.5 }),
          r('e6',null,{ x:140,y:940,width:800,height:90,fill:'rgba(144,213,245,0.15)',cornerRadius:10 }),
          t('e7',null,{ x:140,y:940,width:800,height:90,content:'LIMITED WINTER SPOTS',fontFamily:'Inter',fontSize:28,fontWeight:'800',fill:'#90d5f5',align:'center',verticalAlign:'middle' }),
          r('e8',null,{ x:80,y:1080,width:920,height:80,fill:'#90d5f5',cornerRadius:8 }),
          t('e9',null,{ x:80,y:1080,width:920,height:80,content:'Book Now: (555) 000-0000',fontFamily:'Inter',fontSize:30,fontWeight:'700',fill:'#0a1628',align:'center',verticalAlign:'middle' }),
          t('e10',null,{ x:80,y:1220,width:920,height:60,content:'Business Name • City',fontFamily:'Inter',fontSize:24,fontWeight:'500',fill:'rgba(255,255,255,0.4)',align:'center',verticalAlign:'middle' }),
        ]) },
      { name: 'Summer Service Special', industry: 'general', category: 'seasonal', sort_order: 32,
        canvas_json: mkPage('#ff6b35', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#ff6b35' }),
          r('e2',null,{ x:0,y:0,width:1080,height:1350,fill:'rgba(0,0,0,0.15)' }),
          t('e3',null,{ x:80,y:80,width:920,height:120,content:'☀ SUMMER SPECIAL',fontFamily:'Inter',fontSize:44,fontWeight:'800',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          r('e4',null,{ x:240,y:220,width:600,height:6,fill:'rgba(255,255,255,0.4)',cornerRadius:3 }),
          t('e5',null,{ x:80,y:270,width:920,height:320,content:'Beat the\nHeat Before\nIt Hits',fontFamily:'Inter',fontSize:92,fontWeight:'900',fill:'#ffffff',align:'center',verticalAlign:'top',lineHeight:1.05 }),
          t('e6',null,{ x:80,y:650,width:920,height:200,content:'Schedule your AC tune-up, roof check, or outdoor service before the summer rush. We book up fast.',fontFamily:'Inter',fontSize:34,fontWeight:'400',fill:'rgba(255,255,255,0.9)',align:'center',verticalAlign:'top',lineHeight:1.5 }),
          r('e7',null,{ x:140,y:920,width:800,height:100,fill:'rgba(255,255,255,0.2)',cornerRadius:12 }),
          t('e8',null,{ x:140,y:920,width:800,height:100,content:'BOOK BEFORE [DATE] — SAVE $50',fontFamily:'Inter',fontSize:28,fontWeight:'800',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          r('e9',null,{ x:80,y:1080,width:920,height:90,fill:'#ffffff',cornerRadius:8 }),
          t('e10',null,{ x:80,y:1080,width:920,height:90,content:'Call: (555) 000-0000',fontFamily:'Inter',fontSize:32,fontWeight:'700',fill:'#ff6b35',align:'center',verticalAlign:'middle' }),
          t('e11',null,{ x:80,y:1230,width:920,height:60,content:'Business Name • Serving [City]',fontFamily:'Inter',fontSize:22,fontWeight:'500',fill:'rgba(255,255,255,0.6)',align:'center',verticalAlign:'middle' }),
        ]) },
      { name: 'Storm Season — Act Now', industry: 'trades', category: 'seasonal', sort_order: 33,
        canvas_json: mkPage('#1a0a0a', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#1a0a0a' }),
          r('e2',null,{ x:0,y:0,width:6,height:1350,fill:RED }),
          t('e3',null,{ x:80,y:80,width:920,height:80,content:'⚡ STORM SEASON WARNING ⚡',fontFamily:'Inter',fontSize:32,fontWeight:'800',fill:RED,align:'center',verticalAlign:'middle' }),
          t('e4',null,{ x:80,y:220,width:920,height:380,content:'Is Your\nProperty\nReady?',fontFamily:'Inter',fontSize:110,fontWeight:'900',fill:'#ffffff',align:'left',verticalAlign:'top',lineHeight:1.05 }),
          t('e5',null,{ x:80,y:660,width:920,height:280,content:'Every year, storm damage costs homeowners thousands that could have been prevented. Don\'t be caught unprepared.',fontFamily:'Inter',fontSize:36,fontWeight:'400',fill:'rgba(255,255,255,0.8)',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          r('e6',null,{ x:80,y:1000,width:920,height:100,fill:RED,cornerRadius:8 }),
          t('e7',null,{ x:80,y:1000,width:920,height:100,content:'FREE INSPECTION — CALL NOW',fontFamily:'Inter',fontSize:32,fontWeight:'800',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e8',null,{ x:80,y:1140,width:920,height:60,content:'(555) 000-0000',fontFamily:'Inter',fontSize:40,fontWeight:'700',fill:TEAL,align:'center',verticalAlign:'middle' }),
          t('e9',null,{ x:80,y:1240,width:920,height:60,content:'Business Name • Licensed & Insured',fontFamily:'Inter',fontSize:22,fontWeight:'500',fill:'rgba(255,255,255,0.4)',align:'center',verticalAlign:'middle' }),
        ]) },

      // ── JOB SHOWCASE ─────────────────────────────────────────────────────────
      { name: 'Job Complete — Dark', industry: 'trades', category: 'showcase', sort_order: 40,
        canvas_json: mkPage('#111111', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#111111' }),
          r('e2',null,{ x:80,y:80,width:4,height:80,fill:TEAL }),
          t('e3',null,{ x:110,y:80,width:880,height:80,content:'JOB COMPLETE',fontFamily:'Inter',fontSize:44,fontWeight:'900',fill:TEAL,align:'left',verticalAlign:'middle' }),
          r('e4',null,{ x:80,y:200,width:920,height:600,fill:'#1e1e1e',cornerRadius:12 }),
          t('e5',null,{ x:80,y:200,width:920,height:600,content:'📸 Add your photo here',fontFamily:'Inter',fontSize:32,fontWeight:'400',fill:'rgba(255,255,255,0.2)',align:'center',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:860,width:920,height:100,content:'Service Type — Location',fontFamily:'Inter',fontSize:42,fontWeight:'800',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e7',null,{ x:80,y:980,width:920,height:160,content:'Brief description of the job, how long it took, and what the customer needed. Keep it real and specific.',fontFamily:'Inter',fontSize:32,fontWeight:'400',fill:'rgba(255,255,255,0.65)',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          t('e8',null,{ x:80,y:1180,width:920,height:60,content:'✓ Licensed   ✓ Insured   ✓ Guaranteed',fontFamily:'Inter',fontSize:24,fontWeight:'600',fill:TEAL,align:'left',verticalAlign:'middle' }),
          t('e9',null,{ x:80,y:1270,width:920,height:60,content:'Business Name • (555) 000-0000',fontFamily:'Inter',fontSize:22,fontWeight:'500',fill:'rgba(255,255,255,0.4)',align:'left',verticalAlign:'middle' }),
        ]) },
      { name: 'Project Highlight — Light', industry: 'trades', category: 'showcase', sort_order: 41,
        canvas_json: mkPage('#fafafa', [
          r('e1',null,{ x:0,y:0,width:1080,height:10,fill:PURPLE }),
          t('e2',null,{ x:80,y:60,width:500,height:70,content:'PROJECT SPOTLIGHT',fontFamily:'Inter',fontSize:26,fontWeight:'800',fill:PURPLE,align:'left',verticalAlign:'middle' }),
          t('e3',null,{ x:80,y:170,width:920,height:160,content:'[Type of Job]\nIn [Neighborhood]',fontFamily:'Inter',fontSize:68,fontWeight:'900',fill:'#111111',align:'left',verticalAlign:'top',lineHeight:1.1 }),
          r('e4',null,{ x:80,y:380,width:920,height:500,fill:'#e8e8e8',cornerRadius:12 }),
          t('e5',null,{ x:80,y:380,width:920,height:500,content:'📸 Add job photo',fontFamily:'Inter',fontSize:28,fontWeight:'400',fill:'rgba(0,0,0,0.2)',align:'center',verticalAlign:'middle' }),
          r('e6',null,{ x:80,y:920,width:280,height:80,fill:TEAL,cornerRadius:8 }),
          t('e7',null,{ x:80,y:920,width:280,height:80,content:'1 Day Job',fontFamily:'Inter',fontSize:26,fontWeight:'700',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          r('e8',null,{ x:380,y:920,width:280,height:80,fill:PURPLE,cornerRadius:8 }),
          t('e9',null,{ x:380,y:920,width:280,height:80,content:'100% Done',fontFamily:'Inter',fontSize:26,fontWeight:'700',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          r('e10',null,{ x:680,y:920,width:320,height:80,fill:'#111111',cornerRadius:8 }),
          t('e11',null,{ x:680,y:920,width:320,height:80,content:'★ 5/5 Review',fontFamily:'Inter',fontSize:26,fontWeight:'700',fill:GOLD,align:'center',verticalAlign:'middle' }),
          t('e12',null,{ x:80,y:1040,width:920,height:160,content:'What the job involved and why the customer is happy.',fontFamily:'Inter',fontSize:34,fontWeight:'400',fill:'#555555',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          t('e13',null,{ x:80,y:1240,width:920,height:70,content:'Business Name • Call (555) 000-0000',fontFamily:'Inter',fontSize:26,fontWeight:'600',fill:TEAL,align:'left',verticalAlign:'middle' }),
        ]) },
      { name: 'Quick Job Card', industry: 'trades', category: 'showcase', sort_order: 42,
        canvas_json: mkPage(TEAL, [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:TEAL }),
          r('e2',null,{ x:0,y:600,width:1080,height:750,fill:'rgba(0,0,0,0.7)' }),
          r('e3',null,{ x:80,y:60,width:200,height:56,fill:'rgba(255,255,255,0.25)',cornerRadius:28 }),
          t('e4',null,{ x:80,y:60,width:200,height:56,content:'✓ DONE',fontFamily:'Inter',fontSize:22,fontWeight:'800',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e5',null,{ x:80,y:160,width:920,height:380,content:'Another\nHappy\nCustomer',fontFamily:'Inter',fontSize:110,fontWeight:'900',fill:'#ffffff',align:'left',verticalAlign:'top',lineHeight:1.05 }),
          t('e6',null,{ x:80,y:640,width:920,height:80,content:'Service Type — Neighborhood, City',fontFamily:'Inter',fontSize:32,fontWeight:'700',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e7',null,{ x:80,y:750,width:920,height:200,content:'"Replace with what the customer said after the job was done. One sentence of genuine praise works better than a paragraph."',fontFamily:'Georgia',fontSize:36,fontWeight:'400',fill:'rgba(255,255,255,0.85)',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          t('e8',null,{ x:80,y:990,width:920,height:70,content:'— Customer Name',fontFamily:'Inter',fontSize:28,fontWeight:'600',fill:'rgba(255,255,255,0.7)',align:'left',verticalAlign:'middle' }),
          r('e9',null,{ x:80,y:1100,width:920,height:3,fill:'rgba(255,255,255,0.3)',cornerRadius:2 }),
          t('e10',null,{ x:80,y:1130,width:920,height:80,content:'Business Name • (555) 000-0000',fontFamily:'Inter',fontSize:26,fontWeight:'700',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
        ]) },

      // ── EDUCATIONAL TIPS ──────────────────────────────────────────────────────
      { name: 'Pro Tip Card', industry: 'general', category: 'educational', sort_order: 50,
        canvas_json: mkPage('#ffffff', [
          r('e1',null,{ x:80,y:120,width:260,height:60,fill:TEAL,cornerRadius:8 }),
          t('e2',null,{ x:80,y:120,width:260,height:60,content:'PRO TIP',fontFamily:'Inter',fontSize:26,fontWeight:'800',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e3',null,{ x:80,y:220,width:920,height:140,content:'Did You Know?',fontFamily:'Inter',fontSize:72,fontWeight:'800',fill:DARK,align:'left',verticalAlign:'top',lineHeight:1.1 }),
          r('e4',null,{ x:80,y:380,width:120,height:5,fill:TEAL,cornerRadius:3 }),
          t('e5',null,{ x:80,y:420,width:920,height:480,content:'Tap here and replace this with your tip or advice. Share something genuinely useful that helps your customers.',fontFamily:'Inter',fontSize:42,fontWeight:'400',fill:'#333333',align:'left',verticalAlign:'top',lineHeight:1.55 }),
          t('e6',null,{ x:80,y:1200,width:920,height:80,content:'Follow for more tips — Business Name',fontFamily:'Inter',fontSize:28,fontWeight:'500',fill:'#888888',align:'left',verticalAlign:'middle' }),
        ]) },
      { name: '3 Warning Signs', industry: 'trades', category: 'educational', sort_order: 51,
        canvas_json: mkPage('#fff8f8', [
          r('e1',null,{ x:0,y:0,width:8,height:1350,fill:RED }),
          t('e2',null,{ x:80,y:80,width:920,height:80,content:'⚠ WARNING SIGNS',fontFamily:'Inter',fontSize:36,fontWeight:'900',fill:RED,align:'left',verticalAlign:'middle' }),
          t('e3',null,{ x:80,y:200,width:920,height:160,content:'3 Signs You Need\n[Service] NOW',fontFamily:'Inter',fontSize:64,fontWeight:'900',fill:'#111111',align:'left',verticalAlign:'top',lineHeight:1.15 }),
          r('e4',null,{ x:80,y:400,width:920,height:120,fill:'#ffeeee',cornerRadius:10 }),
          t('e5',null,{ x:100,y:400,width:880,height:120,content:'1. Replace with warning sign #1',fontFamily:'Inter',fontSize:30,fontWeight:'700',fill:'#cc2200',align:'left',verticalAlign:'middle' }),
          r('e6',null,{ x:80,y:540,width:920,height:120,fill:'#fff0e0',cornerRadius:10 }),
          t('e7',null,{ x:100,y:540,width:880,height:120,content:'2. Replace with warning sign #2',fontFamily:'Inter',fontSize:30,fontWeight:'700',fill:'#cc6600',align:'left',verticalAlign:'middle' }),
          r('e8',null,{ x:80,y:680,width:920,height:120,fill:'#fff8e0',cornerRadius:10 }),
          t('e9',null,{ x:100,y:680,width:880,height:120,content:'3. Replace with warning sign #3',fontFamily:'Inter',fontSize:30,fontWeight:'700',fill:'#886600',align:'left',verticalAlign:'middle' }),
          t('e10',null,{ x:80,y:860,width:920,height:200,content:'If you\'re seeing any of these, don\'t wait. Small problems become expensive problems fast.',fontFamily:'Inter',fontSize:34,fontWeight:'400',fill:'#444444',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          r('e11',null,{ x:80,y:1110,width:920,height:80,fill:RED,cornerRadius:8 }),
          t('e12',null,{ x:80,y:1110,width:920,height:80,content:'Call Today: (555) 000-0000',fontFamily:'Inter',fontSize:30,fontWeight:'700',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e13',null,{ x:80,y:1240,width:920,height:60,content:'Business Name — Licensed & Insured',fontFamily:'Inter',fontSize:22,fontWeight:'500',fill:'#888888',align:'center',verticalAlign:'middle' }),
        ]) },
      { name: 'How It Works — 3 Steps', industry: 'general', category: 'educational', sort_order: 52,
        canvas_json: mkPage(DARK, [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:DARK }),
          t('e2',null,{ x:80,y:80,width:920,height:120,content:'How It Works',fontFamily:'Inter',fontSize:64,fontWeight:'900',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          r('e3',null,{ x:440,y:220,width:200,height:4,fill:TEAL,cornerRadius:2 }),
          r('e4',null,{ x:80,y:280,width:920,height:280,fill:'rgba(255,255,255,0.05)',cornerRadius:12 }),
          r('e5',null,{ x:110,y:310,width:80,height:80,fill:TEAL,cornerRadius:40 }),
          t('e6',null,{ x:110,y:310,width:80,height:80,content:'1',fontFamily:'Inter',fontSize:38,fontWeight:'900',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e7',null,{ x:220,y:310,width:750,height:60,content:'You Call or Book Online',fontFamily:'Inter',fontSize:28,fontWeight:'700',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e8',null,{ x:220,y:390,width:750,height:120,content:'Replace with step 1 details — what happens when the customer first contacts you.',fontFamily:'Inter',fontSize:24,fontWeight:'400',fill:'rgba(255,255,255,0.6)',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          r('e9',null,{ x:80,y:580,width:920,height:280,fill:'rgba(255,255,255,0.05)',cornerRadius:12 }),
          r('e10',null,{ x:110,y:610,width:80,height:80,fill:PURPLE,cornerRadius:40 }),
          t('e11',null,{ x:110,y:610,width:80,height:80,content:'2',fontFamily:'Inter',fontSize:38,fontWeight:'900',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e12',null,{ x:220,y:610,width:750,height:60,content:'We Show Up & Get It Done',fontFamily:'Inter',fontSize:28,fontWeight:'700',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e13',null,{ x:220,y:690,width:750,height:120,content:'Replace with step 2 — what your team does, how fast, what equipment you bring.',fontFamily:'Inter',fontSize:24,fontWeight:'400',fill:'rgba(255,255,255,0.6)',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          r('e14',null,{ x:80,y:880,width:920,height:280,fill:'rgba(255,255,255,0.05)',cornerRadius:12 }),
          r('e15',null,{ x:110,y:910,width:80,height:80,fill:GOLD,cornerRadius:40 }),
          t('e16',null,{ x:110,y:910,width:80,height:80,content:'3',fontFamily:'Inter',fontSize:38,fontWeight:'900',fill:'#000000',align:'center',verticalAlign:'middle' }),
          t('e17',null,{ x:220,y:910,width:750,height:60,content:'You\'re Happy. Guaranteed.',fontFamily:'Inter',fontSize:28,fontWeight:'700',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e18',null,{ x:220,y:990,width:750,height:120,content:'Replace with your guarantee and what you do if anything isn\'t right.',fontFamily:'Inter',fontSize:24,fontWeight:'400',fill:'rgba(255,255,255,0.6)',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          t('e19',null,{ x:80,y:1220,width:920,height:80,content:'Business Name • (555) 000-0000',fontFamily:'Inter',fontSize:28,fontWeight:'700',fill:TEAL,align:'center',verticalAlign:'middle' }),
        ]) },

      // ── PROMOTIONAL ──────────────────────────────────────────────────────────
      { name: 'Promo Offer — Bold', industry: 'general', category: 'promotional', sort_order: 60,
        canvas_json: mkPage(PURPLE, [
          r('e1',null,{ x:300,y:140,width:480,height:480,fill:GOLD,cornerRadius:240 }),
          t('e2',null,{ x:300,y:220,width:480,height:180,content:'20%',fontFamily:'Inter',fontSize:130,fontWeight:'900',fill:DARK,align:'center',verticalAlign:'top',lineHeight:1 }),
          t('e3',null,{ x:300,y:400,width:480,height:80,content:'OFF',fontFamily:'Inter',fontSize:60,fontWeight:'900',fill:DARK,align:'center',verticalAlign:'top' }),
          t('e4',null,{ x:80,y:680,width:920,height:100,content:'LIMITED TIME OFFER',fontFamily:'Inter',fontSize:42,fontWeight:'800',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e5',null,{ x:80,y:800,width:920,height:200,content:'Describe your service offer here — what the customer gets, and why they should act now.',fontFamily:'Inter',fontSize:34,fontWeight:'400',fill:'rgba(255,255,255,0.75)',align:'center',verticalAlign:'top',lineHeight:1.45 }),
          t('e6',null,{ x:80,y:1040,width:920,height:60,content:'Offer expires: [Date]  •  Limited spots available',fontFamily:'Inter',fontSize:26,fontWeight:'400',fill:'rgba(255,255,255,0.55)',align:'center',verticalAlign:'middle' }),
          r('e7',null,{ x:240,y:1130,width:600,height:3,fill:TEAL,cornerRadius:2 }),
          t('e8',null,{ x:80,y:1160,width:920,height:80,content:'Book now — Business Name',fontFamily:'Inter',fontSize:32,fontWeight:'700',fill:TEAL,align:'center',verticalAlign:'middle' }),
        ]) },
      { name: 'New Service Launch', industry: 'general', category: 'promotional', sort_order: 61,
        canvas_json: mkPage('#0a0a0a', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#0a0a0a' }),
          r('e2',null,{ x:80,y:80,width:260,height:56,fill:TEAL,cornerRadius:28 }),
          t('e3',null,{ x:80,y:80,width:260,height:56,content:'✦ NEW SERVICE',fontFamily:'Inter',fontSize:20,fontWeight:'800',fill:'#000000',align:'center',verticalAlign:'middle' }),
          t('e4',null,{ x:80,y:200,width:920,height:380,content:'Introducing\n[Service\nName]',fontFamily:'Inter',fontSize:110,fontWeight:'900',fill:'#ffffff',align:'left',verticalAlign:'top',lineHeight:1.05 }),
          r('e5',null,{ x:80,y:620,width:920,height:4,fill:TEAL,cornerRadius:2 }),
          t('e6',null,{ x:80,y:660,width:920,height:280,content:'Describe your new service — what it solves, who it\'s for, and why you\'re the right people to do it.',fontFamily:'Inter',fontSize:36,fontWeight:'400',fill:'rgba(255,255,255,0.75)',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          r('e7',null,{ x:80,y:1000,width:520,height:80,fill:TEAL,cornerRadius:8 }),
          t('e8',null,{ x:80,y:1000,width:520,height:80,content:'Book Your First Appointment',fontFamily:'Inter',fontSize:26,fontWeight:'700',fill:'#000000',align:'center',verticalAlign:'middle' }),
          t('e9',null,{ x:80,y:1130,width:920,height:60,content:'(555) 000-0000',fontFamily:'Inter',fontSize:38,fontWeight:'700',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e10',null,{ x:80,y:1240,width:920,height:60,content:'Business Name • yourwebsite.com',fontFamily:'Inter',fontSize:22,fontWeight:'400',fill:'rgba(255,255,255,0.35)',align:'left',verticalAlign:'middle' }),
        ]) },
      { name: 'Grand Opening', industry: 'general', category: 'promotional', sort_order: 62,
        canvas_json: mkPage(GOLD, [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:GOLD }),
          r('e2',null,{ x:0,y:0,width:1080,height:1350,fill:'rgba(0,0,0,0.08)' }),
          t('e3',null,{ x:80,y:80,width:920,height:120,content:'🎉 NOW OPEN 🎉',fontFamily:'Inter',fontSize:48,fontWeight:'900',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          r('e4',null,{ x:80,y:220,width:920,height:6,fill:'rgba(255,255,255,0.5)',cornerRadius:3 }),
          t('e5',null,{ x:80,y:270,width:920,height:340,content:'[Business\nName]',fontFamily:'Inter',fontSize:110,fontWeight:'900',fill:'#ffffff',align:'center',verticalAlign:'top',lineHeight:1.05 }),
          r('e6',null,{ x:80,y:640,width:920,height:6,fill:'rgba(255,255,255,0.5)',cornerRadius:3 }),
          t('e7',null,{ x:80,y:680,width:920,height:200,content:'[Your trade / service type] now serving [City] and surrounding areas. We\'re ready to help.',fontFamily:'Inter',fontSize:36,fontWeight:'400',fill:'rgba(255,255,255,0.9)',align:'center',verticalAlign:'top',lineHeight:1.5 }),
          r('e8',null,{ x:140,y:960,width:800,height:100,fill:'rgba(255,255,255,0.25)',cornerRadius:12 }),
          t('e9',null,{ x:140,y:960,width:800,height:100,content:'OPENING SPECIAL — MENTION THIS POST',fontFamily:'Inter',fontSize:26,fontWeight:'800',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          r('e10',null,{ x:80,y:1110,width:920,height:90,fill:'rgba(0,0,0,0.25)',cornerRadius:8 }),
          t('e11',null,{ x:80,y:1110,width:920,height:90,content:'Call: (555) 000-0000',fontFamily:'Inter',fontSize:32,fontWeight:'700',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e12',null,{ x:80,y:1250,width:920,height:60,content:'Business Name • Serving [City]',fontFamily:'Inter',fontSize:22,fontWeight:'600',fill:'rgba(0,0,0,0.4)',align:'center',verticalAlign:'middle' }),
        ]) },

      // ── TEAM & BRAND ─────────────────────────────────────────────────────────
      { name: 'Team Spotlight', industry: 'general', category: 'team', sort_order: 70,
        canvas_json: mkPage('#ffffff', [
          r('e1',null,{ x:0,y:0,width:1080,height:10,fill:TEAL }),
          t('e2',null,{ x:80,y:60,width:920,height:70,content:'MEET THE TEAM',fontFamily:'Inter',fontSize:32,fontWeight:'900',fill:TEAL,align:'left',verticalAlign:'middle' }),
          r('e3',null,{ x:80,y:170,width:300,height:300,fill:'#f0f0f0',cornerRadius:150 }),
          t('e4',null,{ x:80,y:170,width:300,height:300,content:'📸',fontFamily:'Inter',fontSize:80,fontWeight:'400',fill:'rgba(0,0,0,0.2)',align:'center',verticalAlign:'middle' }),
          t('e5',null,{ x:420,y:200,width:580,height:80,content:'Team Member Name',fontFamily:'Inter',fontSize:42,fontWeight:'800',fill:'#111111',align:'left',verticalAlign:'middle' }),
          t('e6',null,{ x:420,y:300,width:580,height:60,content:'Role / Job Title',fontFamily:'Inter',fontSize:28,fontWeight:'500',fill:TEAL,align:'left',verticalAlign:'middle' }),
          t('e7',null,{ x:420,y:380,width:580,height:60,content:'[N] Years Experience',fontFamily:'Inter',fontSize:24,fontWeight:'400',fill:'#888888',align:'left',verticalAlign:'middle' }),
          r('e8',null,{ x:80,y:520,width:920,height:4,fill:'#eeeeee',cornerRadius:2 }),
          t('e9',null,{ x:80,y:560,width:920,height:400,content:'"Replace this with a quote from your team member — why they love this work, what they\'re best at, or something that shows their personality."',fontFamily:'Georgia',fontSize:38,fontWeight:'400',fill:'#333333',align:'left',verticalAlign:'top',lineHeight:1.55 }),
          t('e10',null,{ x:80,y:1020,width:920,height:60,content:'Specialties: [list a few things they do well]',fontFamily:'Inter',fontSize:26,fontWeight:'500',fill:'#666666',align:'left',verticalAlign:'middle' }),
          r('e11',null,{ x:80,y:1130,width:920,height:4,fill:'#eeeeee',cornerRadius:2 }),
          t('e12',null,{ x:80,y:1170,width:920,height:80,content:'Business Name — Your City',fontFamily:'Inter',fontSize:28,fontWeight:'700',fill:PURPLE,align:'left',verticalAlign:'middle' }),
        ]) },
      { name: "We're Hiring", industry: 'general', category: 'team', sort_order: 71,
        canvas_json: mkPage(PURPLE, [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:PURPLE }),
          t('e2',null,{ x:80,y:100,width:920,height:160,content:'🚀',fontFamily:'Inter',fontSize:120,fontWeight:'400',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e3',null,{ x:80,y:300,width:920,height:280,content:"We're\nHiring!",fontFamily:'Inter',fontSize:110,fontWeight:'900',fill:'#ffffff',align:'center',verticalAlign:'top',lineHeight:1.05 }),
          r('e4',null,{ x:240,y:620,width:600,height:4,fill:'rgba(255,255,255,0.4)',cornerRadius:2 }),
          t('e5',null,{ x:80,y:660,width:920,height:80,content:'[Job Title / Role]',fontFamily:'Inter',fontSize:38,fontWeight:'700',fill:TEAL,align:'center',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:770,width:920,height:240,content:'Replace with the role, what you\'re looking for, and why someone would love working with your team.',fontFamily:'Inter',fontSize:34,fontWeight:'400',fill:'rgba(255,255,255,0.85)',align:'center',verticalAlign:'top',lineHeight:1.5 }),
          r('e7',null,{ x:140,y:1070,width:800,height:90,fill:'rgba(255,255,255,0.15)',cornerRadius:10 }),
          t('e8',null,{ x:140,y:1070,width:800,height:90,content:'DM us or email [your@email.com]',fontFamily:'Inter',fontSize:26,fontWeight:'700',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          r('e9',null,{ x:80,y:1210,width:920,height:4,fill:'rgba(255,255,255,0.2)',cornerRadius:2 }),
          t('e10',null,{ x:80,y:1240,width:920,height:70,content:'Business Name • yourwebsite.com',fontFamily:'Inter',fontSize:24,fontWeight:'500',fill:'rgba(255,255,255,0.5)',align:'center',verticalAlign:'middle' }),
        ]) },
      { name: 'Our Promise — Values', industry: 'general', category: 'team', sort_order: 72,
        canvas_json: mkPage('#ffffff', [
          r('e1',null,{ x:0,y:0,width:14,height:1350,fill:TEAL }),
          r('e2',null,{ x:0,y:0,width:1080,height:10,fill:TEAL }),
          t('e3',null,{ x:80,y:60,width:920,height:100,content:'Our Promise\nTo You',fontFamily:'Inter',fontSize:58,fontWeight:'900',fill:DARK,align:'left',verticalAlign:'top',lineHeight:1.2 }),
          r('e4',null,{ x:80,y:200,width:920,height:4,fill:'#eeeeee',cornerRadius:2 }),
          t('e5',null,{ x:80,y:240,width:80,height:80,content:'🤝',fontFamily:'Inter',fontSize:48,fontWeight:'400',fill:'#000000',align:'center',verticalAlign:'middle' }),
          t('e6',null,{ x:180,y:240,width:800,height:80,content:'Honest pricing. Always.',fontFamily:'Inter',fontSize:32,fontWeight:'700',fill:'#111111',align:'left',verticalAlign:'middle' }),
          t('e7',null,{ x:180,y:340,width:800,height:60,content:'We quote upfront — no hidden charges at the end.',fontFamily:'Inter',fontSize:24,fontWeight:'400',fill:'#666666',align:'left',verticalAlign:'middle' }),
          r('e8',null,{ x:80,y:440,width:920,height:2,fill:'#eeeeee',cornerRadius:1 }),
          t('e9',null,{ x:80,y:480,width:80,height:80,content:'⚡',fontFamily:'Inter',fontSize:48,fontWeight:'400',fill:'#000000',align:'center',verticalAlign:'middle' }),
          t('e10',null,{ x:180,y:480,width:800,height:80,content:'Fast response. Every time.',fontFamily:'Inter',fontSize:32,fontWeight:'700',fill:'#111111',align:'left',verticalAlign:'middle' }),
          t('e11',null,{ x:180,y:580,width:800,height:60,content:'We reply within the hour and arrive when we say we will.',fontFamily:'Inter',fontSize:24,fontWeight:'400',fill:'#666666',align:'left',verticalAlign:'middle' }),
          r('e12',null,{ x:80,y:680,width:920,height:2,fill:'#eeeeee',cornerRadius:1 }),
          t('e13',null,{ x:80,y:720,width:80,height:80,content:'✅',fontFamily:'Inter',fontSize:48,fontWeight:'400',fill:'#000000',align:'center',verticalAlign:'middle' }),
          t('e14',null,{ x:180,y:720,width:800,height:80,content:'Satisfaction guaranteed.',fontFamily:'Inter',fontSize:32,fontWeight:'700',fill:'#111111',align:'left',verticalAlign:'middle' }),
          t('e15',null,{ x:180,y:820,width:800,height:60,content:'If something\'s not right, we fix it. Simple as that.',fontFamily:'Inter',fontSize:24,fontWeight:'400',fill:'#666666',align:'left',verticalAlign:'middle' }),
          r('e16',null,{ x:80,y:940,width:920,height:4,fill:'#eeeeee',cornerRadius:2 }),
          r('e17',null,{ x:80,y:980,width:920,height:80,fill:TEAL,cornerRadius:8 }),
          t('e18',null,{ x:80,y:980,width:920,height:80,content:'Business Name • (555) 000-0000',fontFamily:'Inter',fontSize:28,fontWeight:'700',fill:'#000000',align:'center',verticalAlign:'middle' }),
          t('e19',null,{ x:80,y:1100,width:920,height:100,content:'Serving [City] and surrounding areas.\nLicensed • Insured • Trusted',fontFamily:'Inter',fontSize:26,fontWeight:'500',fill:'#888888',align:'center',verticalAlign:'top',lineHeight:1.4 }),
        ]) },

      // ── GENERAL ANNOUNCEMENTS ─────────────────────────────────────────────────
      { name: 'Bold Headline Post', industry: 'general', category: 'announcement', sort_order: 80,
        canvas_json: mkPage(DARK, [
          r('e1',null,{ x:0,y:0,width:1080,height:10,fill:TEAL }),
          t('e2',null,{ x:80,y:400,width:920,height:260,content:'Your Headline\nGoes Here',fontFamily:'Inter',fontSize:80,fontWeight:'800',fill:'#ffffff',align:'center',verticalAlign:'middle',lineHeight:1.15 }),
          t('e3',null,{ x:80,y:700,width:920,height:120,content:'Add your key message here — keep it short',fontFamily:'Inter',fontSize:34,fontWeight:'400',fill:'rgba(255,255,255,0.65)',align:'center',verticalAlign:'top',lineHeight:1.4 }),
          t('e4',null,{ x:80,y:1240,width:920,height:60,content:'Your Business Name • City',fontFamily:'Inter',fontSize:24,fontWeight:'500',fill:TEAL,align:'center',verticalAlign:'middle' }),
        ]) },
      { name: 'Milestone Celebration', industry: 'general', category: 'announcement', sort_order: 81,
        canvas_json: mkPage('#fff8e6', [
          r('e1',null,{ x:0,y:0,width:1080,height:12,fill:GOLD }),
          t('e2',null,{ x:80,y:80,width:920,height:100,content:'🎉 MILESTONE 🎉',fontFamily:'Inter',fontSize:44,fontWeight:'900',fill:GOLD,align:'center',verticalAlign:'middle' }),
          t('e3',null,{ x:80,y:230,width:920,height:320,content:'[Number]\nCustomers\nServed!',fontFamily:'Inter',fontSize:100,fontWeight:'900',fill:DARK,align:'center',verticalAlign:'top',lineHeight:1.05 }),
          r('e4',null,{ x:240,y:600,width:600,height:4,fill:GOLD,cornerRadius:2 }),
          t('e5',null,{ x:80,y:640,width:920,height:200,content:'We\'re grateful for every customer who trusted us with their home. This milestone is yours as much as ours.',fontFamily:'Inter',fontSize:34,fontWeight:'400',fill:'#555555',align:'center',verticalAlign:'top',lineHeight:1.5 }),
          t('e6',null,{ x:80,y:890,width:920,height:200,content:'"Replace with a quote from a long-time customer or something genuine about why you love this work."',fontFamily:'Georgia',fontSize:32,fontWeight:'400',fill:'#777777',align:'center',verticalAlign:'top',lineHeight:1.55 }),
          r('e7',null,{ x:80,y:1140,width:920,height:90,fill:GOLD,cornerRadius:8 }),
          t('e8',null,{ x:80,y:1140,width:920,height:90,content:'THANK YOU from Business Name',fontFamily:'Inter',fontSize:28,fontWeight:'700',fill:'#000000',align:'center',verticalAlign:'middle' }),
          t('e9',null,{ x:80,y:1270,width:920,height:60,content:'Serving [City] since [Year]',fontFamily:'Inter',fontSize:22,fontWeight:'500',fill:'#888888',align:'center',verticalAlign:'middle' }),
        ]) },
    ];

    let inserted = 0;
    for (const tmpl of ALL_TEMPLATES) {
      await pool.query(
        `INSERT INTO canvas_templates (name, industry, category, canvas_json, canvas_width, canvas_height, sort_order)
         SELECT $1, $2, $3, $4, $5, $6, $7
         WHERE NOT EXISTS (SELECT 1 FROM canvas_templates WHERE name = $1)`,
        [tmpl.name, tmpl.industry, tmpl.category, JSON.stringify(tmpl.canvas_json), 1080, 1350, tmpl.sort_order]
      );
      inserted++;
    }
    // Remove the old generic seed templates that got replaced with better versions
    await pool.query(`DELETE FROM canvas_templates WHERE name IN ('Bold Social Post','Educational Tip','Before & After','Customer Review','Seasonal Alert','Promo Offer') AND thumbnail_url IS NULL AND sort_order < 10`);
    console.log(`[Seed] canvas_templates: ensured ${ALL_TEMPLATES.length} ItsPosting templates`);
  } catch (e) { console.warn('[Seed] canvas_templates skipped:', e.message.substring(0, 80)); }
})();

app.use(helmet());
app.use(compression());

// General API: 1000 req/15min per IP — prevents scraping while not blocking active users.
// Auth routes get a tighter limit to resist credential stuffing (10 failures/15min).
// Generation routes are capped at 50/hour to protect AI API costs.
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, message: 'Too many requests, please try again later.', standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many authentication attempts. Try again in 15 minutes.', skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false });
const passwordResetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3, message: 'Too many password reset attempts. Try again in 1 hour.', standardHeaders: true, legacyHeaders: false });
const generationLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 50, message: { error: 'Generation limit reached — wait an hour or upgrade your plan' }, standardHeaders: true, legacyHeaders: false });

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', passwordResetLimiter);
app.use('/api/wizard/generate', generationLimiter);
app.use('/api/wizard/refresh', generationLimiter);
app.use('/api/wizard/regenerate-image', generationLimiter);
app.use('/api/content/generate', generationLimiter);
app.use('/api/v1/generate', generationLimiter);

const corsMiddleware = cors({
  origin: (origin, cb) => {
    const allowed = (process.env.FRONTEND_URL || 'http://localhost:5000').split(',').map(s => s.trim());
    if (!origin) {
      // In production require an Origin header; allow curl/tools locally
      if (process.env.NODE_ENV === 'production') return cb(new Error('Origin header required'));
      return cb(null, true);
    }
    // In development, allow any localhost port so devs aren't blocked by FRONTEND_URL mismatches
    if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(origin)) {
      return cb(null, true);
    }
    if (allowed.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
});
// OAuth callbacks are browser GET redirects from OAuth providers — no Origin header, skip CORS
app.use((req, res, next) => {
  if (req.path.startsWith('/api/social/callback/')) return next();
  corsMiddleware(req, res, next);
});
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
app.use('/api/api-keys', apiKeysRoutes(pool));
app.use('/api/v1', externalRoutes(pool));
app.use('/api/gmb', gmbMessagesRoutes(pool));
app.use('/api/ideas', ideasRoutes(pool));


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
pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(64)').catch(() => {});
pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ').catch(() => {});

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
