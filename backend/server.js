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
const templateRoutes = require('./routes/templates');
const ideasRoutes = require('./routes/ideas');
const calendarPlansRoutes = require('./routes/calendarPlans');
const referralsRoutes = require('./routes/referrals');

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
    `ALTER TABLE studio_creations ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES canvas_templates(id) ON DELETE SET NULL`,
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
    // A/B/C caption variations per generated post
    `CREATE TABLE IF NOT EXISTS post_variations (
      id               SERIAL PRIMARY KEY,
      post_id          INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      variation_label  VARCHAR(1) NOT NULL CHECK (variation_label IN ('A','B','C')),
      caption          TEXT NOT NULL,
      hashtags         JSONB DEFAULT '[]'::jsonb,
      image_prompt     TEXT,
      engagement_question TEXT,
      hook_formula_used TEXT,
      engagement_score INTEGER DEFAULT 0,
      platform         VARCHAR(50) DEFAULT 'all',
      created_at       TIMESTAMP DEFAULT NOW(),
      UNIQUE(post_id, variation_label)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_variations_post ON post_variations(post_id)`,
    // Record which variation (A/B/C) the customer chose to publish
    `ALTER TABLE posts ADD COLUMN IF NOT EXISTS chosen_variation VARCHAR(1) CHECK (chosen_variation IN ('A','B','C'))`,
    // User-saved post templates (content type, tone, platforms, notes)
    `CREATE TABLE IF NOT EXISTS post_templates (
      id           SERIAL PRIMARY KEY,
      customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      name         VARCHAR(100) NOT NULL,
      settings     JSONB DEFAULT '{}'::jsonb,
      usage_count  INTEGER DEFAULT 0,
      created_at   TIMESTAMP DEFAULT NOW(),
      updated_at   TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_post_templates_customer ON post_templates(customer_id)`,
    // Saved hashtag sets per customer: [{id, name, tags[], usage_count}]
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS hashtag_sets JSONB DEFAULT '[]'::jsonb`,
    // PostCore Brain — LLM training data collection
    `CREATE TABLE IF NOT EXISTS post_training_data (
      id                SERIAL PRIMARY KEY,
      post_id           INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      input_payload     JSONB NOT NULL,
      output_payload    JSONB NOT NULL,
      variation_selected CHAR(1),
      was_edited        BOOLEAN DEFAULT FALSE,
      edit_distance     INTEGER,
      post_reach        INTEGER,
      post_engagement   INTEGER,
      quality_score     NUMERIC(3,1),
      model_used        VARCHAR(50) DEFAULT 'claude-sonnet-4-6',
      created_at        TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_training_data_model ON post_training_data(model_used, created_at DESC)`,
    // PostCore Brain — model version registry
    `CREATE TABLE IF NOT EXISTS llm_model_versions (
      id                  SERIAL PRIMARY KEY,
      version_name        VARCHAR(100) NOT NULL,
      base_model          VARCHAR(100) NOT NULL,
      lora_weights_url    TEXT,
      replicate_model_id  TEXT,
      training_examples   INTEGER DEFAULT 0,
      eval_bleu           NUMERIC(4,3),
      eval_human_score    NUMERIC(3,1),
      status              VARCHAR(30) DEFAULT 'training',
      traffic_pct         INTEGER DEFAULT 0,
      trained_at          TIMESTAMP,
      promoted_at         TIMESTAMP,
      created_at          TIMESTAMP DEFAULT NOW()
    )`,
    // PostCore Brain — A/B experiment log
    `CREATE TABLE IF NOT EXISTS llm_ab_experiments (
      id                    SERIAL PRIMARY KEY,
      model_version_id      INTEGER REFERENCES llm_model_versions(id),
      started_at            TIMESTAMP DEFAULT NOW(),
      ended_at              TIMESTAMP,
      traffic_pct           INTEGER DEFAULT 0,
      calls_total           INTEGER DEFAULT 0,
      user_selection_rate   NUMERIC(4,3),
      edit_rate             NUMERIC(4,3),
      avg_reach             NUMERIC(10,2),
      result                VARCHAR(20),
      notes                 TEXT
    )`,
    // PostCore Brain — human-curated gold examples
    `CREATE TABLE IF NOT EXISTS llm_curated_examples (
      id             SERIAL PRIMARY KEY,
      industry       VARCHAR(50) NOT NULL,
      content_type   VARCHAR(50) NOT NULL,
      input_payload  JSONB NOT NULL,
      ideal_output   JSONB NOT NULL,
      quality_score  NUMERIC(3,1) NOT NULL,
      annotated_by   VARCHAR(100),
      created_at     TIMESTAMP DEFAULT NOW()
    )`,
    // Content Calendar — strategic planning layer
    `CREATE TABLE IF NOT EXISTS content_calendar_plans (
      id              SERIAL PRIMARY KEY,
      customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      plan_date       DATE NOT NULL,
      title           VARCHAR(200),
      content_type    VARCHAR(50) DEFAULT 'photo_post',
      platforms       TEXT[] DEFAULT '{}',
      notes           TEXT,
      status          VARCHAR(20) DEFAULT 'planned',
      post_id         INTEGER REFERENCES posts(id) ON DELETE SET NULL,
      ai_suggested    BOOLEAN DEFAULT false,
      color           VARCHAR(20) DEFAULT 'purple',
      created_at      TIMESTAMP DEFAULT NOW(),
      updated_at      TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_calendar_plans_customer ON content_calendar_plans(customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_calendar_plans_date ON content_calendar_plans(plan_date)`,
    // Profile: avatar + tagline
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar_url TEXT`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS tagline VARCHAR(200)`,

    // Phase 5.5 — Database performance indexes
    `CREATE INDEX IF NOT EXISTS idx_posts_customer_id ON posts(customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status)`,
    `CREATE INDEX IF NOT EXISTS idx_posts_scheduled_date ON posts(scheduled_date)`,
    `CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_posts_source ON posts(source)`,
    `CREATE INDEX IF NOT EXISTS idx_engagement_snapshots_post_id ON post_engagement_snapshots(post_id)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_customer_id ON notifications(customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(customer_id, is_read)`,
    `CREATE INDEX IF NOT EXISTS idx_business_knowledge_customer_id ON business_knowledge(customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_social_accounts_customer ON social_accounts(customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_dm_conversations_customer ON dm_conversations(customer_id)`,

    // Phase 3.1 — Referral program
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS referred_by VARCHAR(20)`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_credits_earned INTEGER DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS referral_awards (
      id SERIAL PRIMARY KEY,
      referrer_customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      referred_customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      referral_code VARCHAR(20) NOT NULL,
      credits INTEGER NOT NULL DEFAULT 20,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      released_at TIMESTAMP,
      released_by_admin_id INTEGER,
      rejection_reason TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_referral_awards_referrer ON referral_awards(referrer_customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_referral_awards_status ON referral_awards(status)`,

    // Phase 2.9 — Smart scheduling (optimal times stored per customer)
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS optimal_posting_times JSONB DEFAULT NULL`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS optimal_times_updated_at TIMESTAMP`,
    // Phase 4.6 — Inbox approval queue: pending AI drafts on conversations
    `ALTER TABLE dm_conversations ADD COLUMN IF NOT EXISTS pending_draft TEXT`,
    `ALTER TABLE dm_conversations ADD COLUMN IF NOT EXISTS pending_draft_intent VARCHAR(100)`,
    `ALTER TABLE dm_conversations ADD COLUMN IF NOT EXISTS pending_draft_sentiment VARCHAR(20)`,
    `ALTER TABLE dm_conversations ADD COLUMN IF NOT EXISTS pending_draft_urgency VARCHAR(20)`,
    `ALTER TABLE dm_conversations ADD COLUMN IF NOT EXISTS pending_draft_created_at TIMESTAMP`,
    `CREATE INDEX IF NOT EXISTS idx_dm_convs_pending ON dm_conversations(customer_id) WHERE pending_draft IS NOT NULL`,

    // Phase 6.3 — Email onboarding sequence
    `CREATE TABLE IF NOT EXISTS onboarding_email_log (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      day_number INTEGER NOT NULL,
      sent_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (customer_id, day_number)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_onboarding_email_log_customer ON onboarding_email_log(customer_id)`,
    // Testimonial Machine: metadata column on posts + source index
    `ALTER TABLE posts ADD COLUMN IF NOT EXISTS metadata JSONB`,
    `CREATE INDEX IF NOT EXISTS idx_posts_source_testimonial ON posts(customer_id, source) WHERE source='auto_testimonial'`,
    // Webhook event log for audit trail + replay
    `CREATE TABLE IF NOT EXISTS webhook_events (
      id SERIAL PRIMARY KEY,
      source VARCHAR(50) NOT NULL,
      event_type VARCHAR(100),
      payload JSONB,
      processed_at TIMESTAMP DEFAULT NOW(),
      status VARCHAR(20) DEFAULT 'received',
      error_message TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_webhook_events_source ON webhook_events(source, processed_at DESC)`,
    // Team Post Approval Workflow
    `ALTER TABLE posts ADD COLUMN IF NOT EXISTS approval_status VARCHAR(30)`,
    `ALTER TABLE posts ADD COLUMN IF NOT EXISTS approval_history JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE posts ADD COLUMN IF NOT EXISTS approval_note TEXT`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS require_post_approval BOOLEAN DEFAULT FALSE`,
    `CREATE INDEX IF NOT EXISTS idx_posts_approval ON posts(customer_id, approval_status) WHERE approval_status IS NOT NULL`,
    // Media library AI tagging
    `ALTER TABLE media_library ADD COLUMN IF NOT EXISTS ai_tags TEXT[] DEFAULT '{}'`,
    `CREATE INDEX IF NOT EXISTS idx_media_ai_tags ON media_library USING gin(ai_tags)`,
    // High-frequency customer lookups
    `CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)`,
    `CREATE INDEX IF NOT EXISTS idx_customers_whop_membership ON customers(whop_membership_id) WHERE whop_membership_id IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_customers_referral_code ON customers(referral_code) WHERE referral_code IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_customers_status_plan ON customers(status, plan)`,
    // Media library
    `CREATE INDEX IF NOT EXISTS idx_media_library_customer ON media_library(customer_id, uploaded_at DESC)`,
    // Credit transactions
    `CREATE INDEX IF NOT EXISTS idx_credit_transactions_customer ON credit_transactions(customer_id, created_at DESC)`,
    // Phase 9.1 Brand Kit — fonts stored per customer for editor auto-apply
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS brand_fonts JSONB DEFAULT '{}'`,
    // Phase 9.1 Brand Kit — extended brand colors (up to 6 named hex values)
    // brand_colors already exists; brand_fonts is new
    // Phase 11 — LLM training tables (passive data collection)
    `CREATE TABLE IF NOT EXISTS post_training_data (
      id                 SERIAL PRIMARY KEY,
      post_id            INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      input_payload      JSONB NOT NULL,
      output_payload     JSONB NOT NULL,
      variation_selected CHAR(1),
      was_edited         BOOLEAN DEFAULT FALSE,
      edit_distance      INTEGER,
      post_reach         INTEGER,
      post_engagement    INTEGER,
      quality_score      NUMERIC(3,1),
      model_used         VARCHAR(50) DEFAULT 'claude-sonnet-4-6',
      created_at         TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_post_training_data_post ON post_training_data(post_id)`,
    `CREATE TABLE IF NOT EXISTS llm_model_versions (
      id                 SERIAL PRIMARY KEY,
      version_name       VARCHAR(100) NOT NULL,
      modality           VARCHAR(20) NOT NULL DEFAULT 'text',
      base_model         VARCHAR(100) NOT NULL,
      weights_url        TEXT,
      replicate_model_id TEXT,
      training_examples  INTEGER,
      eval_score         NUMERIC(6,3),
      eval_human_score   NUMERIC(3,1),
      status             VARCHAR(30) DEFAULT 'training',
      traffic_pct        INTEGER DEFAULT 0,
      trained_at         TIMESTAMP,
      promoted_at        TIMESTAMP,
      created_at         TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS llm_ab_experiments (
      id                   SERIAL PRIMARY KEY,
      model_version_id     INTEGER REFERENCES llm_model_versions(id),
      modality             VARCHAR(20) NOT NULL DEFAULT 'text',
      started_at           TIMESTAMP DEFAULT NOW(),
      ended_at             TIMESTAMP,
      traffic_pct          INTEGER,
      calls_total          INTEGER DEFAULT 0,
      keep_rate            NUMERIC(4,3),
      edit_rate            NUMERIC(4,3),
      avg_reach            NUMERIC(10,2),
      result               VARCHAR(20),
      notes                TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS llm_curated_examples (
      id             SERIAL PRIMARY KEY,
      industry       VARCHAR(50) NOT NULL,
      content_type   VARCHAR(50) NOT NULL,
      input_payload  JSONB NOT NULL,
      ideal_output   JSONB NOT NULL,
      quality_score  NUMERIC(3,1) NOT NULL,
      annotated_by   VARCHAR(100),
      created_at     TIMESTAMP DEFAULT NOW()
    )`,
  ];
  for (const sql of migrations) {
    try { await pool.query(sql); }
    catch (e) { console.warn('[Migration] Skipped:', e.message.substring(0, 80)); }
  }

  // Fix any canvas_templates rows whose industry was stored as 'general' but whose name
  // clearly identifies them as industry-specific. Runs on every startup — safe/idempotent.
  try {
    const namePrefixFix = [
      ['plumbing', 'Plumbing —'],
      ['hvac',     'HVAC —'],
      ['hvac',     'Heating & Cooling —'],
      ['roofing',  'Roofing —'],
      ['electrical', 'Electrical —'],
      ['painting', 'Painting —'],
      ['landscaping', 'Landscaping —'],
      ['concrete', 'Concrete —'],
      ['pest_control', 'Pest Control —'],
      ['cleaning', 'Cleaning —'],
    ];
    for (const [industry, prefix] of namePrefixFix) {
      await pool.query(
        `UPDATE canvas_templates SET industry = $1 WHERE name LIKE $2 AND industry != $1`,
        [industry, `${prefix}%`]
      );
    }
    console.log('[Migration] canvas_templates industry correction applied');
  } catch (e) { console.warn('[Migration] canvas_templates industry fix skipped:', e.message.substring(0, 80)); }

  // Seed canvas templates — idempotent: inserts each template only if name not already present
  try {
    const TEAL = '#00C4CC', PURPLE = '#7C5CFC', GOLD = '#FFB800', RED = '#ef4444', NAVY = '#0f3460', DARK = '#1a1a2e';
    const mkPage = (bgColor, elements) => ({ activePage: 0, pages: [{ id: 'p1', bgType: 'color', bgColor, lockedIds: [], hiddenIds: [], duration: 5, elements }] });
    // t() maps 'content' → 'text' so elements render correctly in the Konva canvas
    const t = (id, c, props) => { const { content, ...rest } = props; return { id, type: 'text', text: content !== undefined ? content : rest.text, ...rest }; };
    const r = (id, c, props) => ({ id, type: 'rect', cornerRadius: 0, strokeWidth: 0, ...props });
    // Photo-zone placeholder: renders as a dashed drop-zone in the editor; user fills with their own photo
    const img = (id, c, props) => ({ id, type: 'image', src: '', opacity: 1, flipH: false, flipV: false, cornerRadius: 0, rotation: 0, frameType: 'none', ...props });

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
          t('e2',null,{ x:80,y:80,width:920,height:100,text:'🎉 MILESTONE 🎉',fontFamily:'Inter',fontSize:44,fontStyle:'bold',fill:GOLD,align:'center',verticalAlign:'middle' }),
          t('e3',null,{ x:80,y:230,width:920,height:320,text:'[Number]\nCustomers\nServed!',fontFamily:'Inter',fontSize:100,fontStyle:'bold',fill:DARK,align:'center',verticalAlign:'top',lineHeight:1.05 }),
          r('e4',null,{ x:240,y:600,width:600,height:4,fill:GOLD,cornerRadius:2 }),
          t('e5',null,{ x:80,y:640,width:920,height:200,text:'We\'re grateful for every customer who trusted us with their home. This milestone is yours as much as ours.',fontFamily:'Inter',fontSize:34,fill:'#555555',align:'center',verticalAlign:'top',lineHeight:1.5 }),
          t('e6',null,{ x:80,y:890,width:920,height:200,text:'"Replace with a quote from a long-time customer or something genuine about why you love this work."',fontFamily:'Georgia',fontSize:32,fill:'#777777',align:'center',verticalAlign:'top',lineHeight:1.55 }),
          r('e7',null,{ x:80,y:1140,width:920,height:90,fill:GOLD,cornerRadius:8 }),
          t('e8',null,{ x:80,y:1140,width:920,height:90,text:'THANK YOU from Business Name',fontFamily:'Inter',fontSize:28,fontStyle:'bold',fill:'#000000',align:'center',verticalAlign:'middle' }),
          t('e9',null,{ x:80,y:1270,width:920,height:60,text:'Serving [City] since [Year]',fontFamily:'Inter',fontSize:22,fill:'#888888',align:'center',verticalAlign:'middle' }),
        ]) },

      // ── PLUMBING INDUSTRY TEMPLATES ──────────────────────────────────────────
      { name: 'Plumbing — Frozen Pipe Winter Alert', industry: 'plumbing', category: 'seasonal', sort_order: 100,
        canvas_json: mkPage('#0a1020', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#0a1020' }),
          r('e2',null,{ x:0,y:0,width:1080,height:8,fill:'#7dd3f8' }),
          r('e3',null,{ x:80,y:58,width:360,height:52,fill:'rgba(125,211,248,0.1)',cornerRadius:26 }),
          t('e4',null,{ x:80,y:58,width:360,height:52,text:'❄  FREEZE SEASON ALERT',fontFamily:'Inter',fontSize:17,fontStyle:'bold',fill:'#7dd3f8',align:'center',verticalAlign:'middle' }),
          t('e5',null,{ x:80,y:165,width:920,height:380,text:'Are Your\nPipes\nFreezing?',fontFamily:'Inter',fontSize:118,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'top',lineHeight:1.0 }),
          r('e6',null,{ x:80,y:572,width:920,height:3,fill:'rgba(125,211,248,0.2)',cornerRadius:2 }),
          t('e7',null,{ x:80,y:600,width:920,height:155,text:'Frozen pipes can burst and cause thousands in water damage. Don\'t wait until it\'s an emergency — act now.',fontFamily:'Inter',fontSize:31,fill:'rgba(255,255,255,0.7)',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          r('e8',null,{ x:80,y:808,width:260,height:58,fill:'rgba(125,211,248,0.1)',cornerRadius:8 }),
          t('e9',null,{ x:80,y:808,width:260,height:58,text:'⚡ Same Day',fontFamily:'Inter',fontSize:19,fontStyle:'bold',fill:'#7dd3f8',align:'center',verticalAlign:'middle' }),
          r('e10',null,{ x:360,y:808,width:260,height:58,fill:'rgba(125,211,248,0.1)',cornerRadius:8 }),
          t('e11',null,{ x:360,y:808,width:260,height:58,text:'🔒 Insured',fontFamily:'Inter',fontSize:19,fontStyle:'bold',fill:'#7dd3f8',align:'center',verticalAlign:'middle' }),
          r('e12',null,{ x:640,y:808,width:360,height:58,fill:'rgba(125,211,248,0.1)',cornerRadius:8 }),
          t('e13',null,{ x:640,y:808,width:360,height:58,text:'📞 24/7 On Call',fontFamily:'Inter',fontSize:19,fontStyle:'bold',fill:'#7dd3f8',align:'center',verticalAlign:'middle' }),
          r('e14',null,{ x:80,y:935,width:920,height:78,fill:'#7dd3f8',cornerRadius:10 }),
          t('e15',null,{ x:80,y:935,width:920,height:78,text:'CALL NOW — Emergency Response',fontFamily:'Inter',fontSize:27,fontStyle:'bold',fill:'#0a1020',align:'center',verticalAlign:'middle' }),
          t('e16',null,{ x:80,y:1068,width:920,height:70,text:'(555) 000-0000',fontFamily:'Inter',fontSize:48,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          r('e17',null,{ x:240,y:1190,width:600,height:2,fill:'rgba(255,255,255,0.08)',cornerRadius:1 }),
          t('e18',null,{ x:80,y:1210,width:920,height:52,text:'Your Business Name  •  Licensed & Insured  •  [City]',fontFamily:'Inter',fontSize:21,fill:'rgba(255,255,255,0.3)',align:'center',verticalAlign:'middle' }),
        ]) },

      { name: 'Plumbing — Before & After Reveal', industry: 'plumbing', category: 'before-after', sort_order: 101,
        canvas_json: mkPage('#111111', [
          r('e1',null,{ x:0,y:0,width:540,height:1350,fill:'#111111' }),
          r('e2',null,{ x:540,y:0,width:540,height:1350,fill:'#f2f8f8' }),
          r('e3',null,{ x:534,y:0,width:12,height:1350,fill:'#ffffff' }),
          r('e4',null,{ x:40,y:50,width:180,height:48,fill:'rgba(255,255,255,0.08)',cornerRadius:24 }),
          t('e5',null,{ x:40,y:50,width:180,height:48,text:'BEFORE',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'rgba(255,255,255,0.5)',align:'center',verticalAlign:'middle' }),
          r('e6',null,{ x:600,y:50,width:180,height:48,fill:'rgba(0,196,204,0.12)',cornerRadius:24 }),
          t('e7',null,{ x:600,y:50,width:180,height:48,text:'AFTER',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'#00C4CC',align:'center',verticalAlign:'middle' }),
          r('e8',null,{ x:40,y:140,width:460,height:460,fill:'#1e1e1e',cornerRadius:12 }),
          t('e9',null,{ x:40,y:140,width:460,height:460,text:'📸\nAdd your\nBEFORE photo',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.2)',align:'center',verticalAlign:'middle',lineHeight:1.6 }),
          r('e10',null,{ x:580,y:140,width:460,height:460,fill:'#e0f5f5',cornerRadius:12 }),
          t('e11',null,{ x:580,y:140,width:460,height:460,text:'📸\nAdd your\nAFTER photo',fontFamily:'Inter',fontSize:22,fill:'rgba(0,0,0,0.2)',align:'center',verticalAlign:'middle',lineHeight:1.6 }),
          t('e12',null,{ x:40,y:640,width:460,height:180,text:'What the problem was — describe what the customer was dealing with before you arrived.',fontFamily:'Inter',fontSize:23,fill:'rgba(255,255,255,0.55)',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          t('e13',null,{ x:580,y:640,width:460,height:180,text:'The result — how it looks and works now, how fast the job was done, happy customer.',fontFamily:'Inter',fontSize:23,fill:'rgba(0,0,0,0.5)',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          r('e14',null,{ x:0,y:1180,width:1080,height:170,fill:'#00C4CC' }),
          t('e15',null,{ x:80,y:1200,width:920,height:70,text:'Same-Day Plumbing You Can Count On',fontFamily:'Inter',fontSize:32,fontStyle:'bold',fill:'#000000',align:'center',verticalAlign:'middle' }),
          t('e16',null,{ x:80,y:1288,width:920,height:48,text:'Business Name  •  (555) 000-0000  •  [City]',fontFamily:'Inter',fontSize:22,fill:'rgba(0,0,0,0.6)',align:'center',verticalAlign:'middle' }),
        ]) },

      { name: 'Plumbing — 5-Star Customer Review', industry: 'plumbing', category: 'social-proof', sort_order: 102,
        canvas_json: mkPage('#ffffff', [
          r('e1',null,{ x:0,y:0,width:1080,height:10,fill:'#00C4CC' }),
          r('e2',null,{ x:0,y:0,width:10,height:1350,fill:'#00C4CC' }),
          t('e3',null,{ x:80,y:60,width:600,height:55,text:'⭐ CUSTOMER REVIEW',fontFamily:'Inter',fontSize:24,fontStyle:'bold',fill:'#00C4CC',align:'left',verticalAlign:'middle' }),
          t('e4',null,{ x:80,y:135,width:500,height:65,text:'★ ★ ★ ★ ★',fontFamily:'Inter',fontSize:44,fill:GOLD,align:'left',verticalAlign:'middle' }),
          t('e5',null,{ x:800,y:50,width:240,height:180,text:'"',fontFamily:'Georgia',fontSize:180,fill:'rgba(0,196,204,0.12)',align:'right',verticalAlign:'top' }),
          t('e6',null,{ x:80,y:240,width:920,height:500,text:'"Replace this with a real customer review. The more specific it is — the neighbourhood, the problem, the outcome — the more it will resonate with your next customer."',fontFamily:'Georgia',fontSize:44,fill:'#1a1a1a',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          r('e7',null,{ x:80,y:790,width:500,height:3,fill:'#e0e0e0',cornerRadius:2 }),
          t('e8',null,{ x:80,y:820,width:600,height:60,text:'— Customer Name, [Neighbourhood]',fontFamily:'Inter',fontSize:26,fontStyle:'bold',fill:'#333333',align:'left',verticalAlign:'middle' }),
          r('e9',null,{ x:80,y:900,width:220,height:42,fill:'rgba(0,196,204,0.1)',cornerRadius:21 }),
          t('e10',null,{ x:80,y:900,width:220,height:42,text:'✓ Verified Customer',fontFamily:'Inter',fontSize:17,fontStyle:'bold',fill:'#00C4CC',align:'center',verticalAlign:'middle' }),
          r('e11',null,{ x:80,y:1040,width:920,height:3,fill:'#eeeeee',cornerRadius:2 }),
          r('e12',null,{ x:80,y:1080,width:920,height:80,fill:'#f8fffe',cornerRadius:10 }),
          t('e13',null,{ x:80,y:1080,width:920,height:80,text:'Business Name  •  Rated 5 Stars on Google',fontFamily:'Inter',fontSize:26,fontStyle:'bold',fill:'#111111',align:'center',verticalAlign:'middle' }),
          t('e14',null,{ x:80,y:1200,width:920,height:55,text:'(555) 000-0000  •  Licensed & Insured  •  Serving [City]',fontFamily:'Inter',fontSize:22,fill:'#888888',align:'center',verticalAlign:'middle' }),
        ]) },

      { name: 'Plumbing — Drain Cleaning Promo', industry: 'plumbing', category: 'promotional', sort_order: 103,
        canvas_json: mkPage('#0d1117', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#0d1117' }),
          r('e2',null,{ x:0,y:0,width:1080,height:6,fill:TEAL }),
          r('e3',null,{ x:80,y:60,width:280,height:52,fill:TEAL,cornerRadius:8 }),
          t('e4',null,{ x:80,y:60,width:280,height:52,text:'SPECIAL OFFER',fontFamily:'Inter',fontSize:20,fontStyle:'bold',fill:'#000000',align:'center',verticalAlign:'middle' }),
          t('e5',null,{ x:80,y:160,width:580,height:260,text:'$99',fontFamily:'Inter',fontSize:200,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'top',lineHeight:1.0 }),
          t('e6',null,{ x:660,y:210,width:360,height:180,text:'Drain\nCleaning\nService',fontFamily:'Inter',fontSize:44,fontStyle:'bold',fill:TEAL,align:'left',verticalAlign:'top',lineHeight:1.15 }),
          t('e7',null,{ x:80,y:435,width:500,height:55,text:'Regular price: $180',fontFamily:'Inter',fontSize:26,fill:'rgba(255,255,255,0.35)',align:'left',verticalAlign:'middle' }),
          r('e8',null,{ x:80,y:522,width:920,height:3,fill:'rgba(255,255,255,0.08)',cornerRadius:2 }),
          t('e9',null,{ x:80,y:558,width:920,height:50,text:'What\'s included:',fontFamily:'Inter',fontSize:24,fontStyle:'bold',fill:'rgba(255,255,255,0.8)',align:'left',verticalAlign:'middle' }),
          t('e10',null,{ x:80,y:622,width:920,height:155,text:'✓  Camera inspection of main drain\n✓  High-pressure water jetting\n✓  Same-day service available',fontFamily:'Inter',fontSize:26,fill:'rgba(255,255,255,0.65)',align:'left',verticalAlign:'top',lineHeight:1.65 }),
          r('e11',null,{ x:80,y:832,width:920,height:60,fill:'rgba(255,80,80,0.1)',cornerRadius:8 }),
          t('e12',null,{ x:80,y:832,width:920,height:60,text:'⏰  Limited spots — offer expires [Date]',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'#ff6b6b',align:'center',verticalAlign:'middle' }),
          r('e13',null,{ x:80,y:960,width:920,height:82,fill:TEAL,cornerRadius:10 }),
          t('e14',null,{ x:80,y:960,width:920,height:82,text:'Book Your Spot — (555) 000-0000',fontFamily:'Inter',fontSize:30,fontStyle:'bold',fill:'#000000',align:'center',verticalAlign:'middle' }),
          t('e15',null,{ x:80,y:1110,width:920,height:55,text:'Business Name  •  Licensed & Insured  •  [City]',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.3)',align:'center',verticalAlign:'middle' }),
          t('e16',null,{ x:80,y:1192,width:920,height:50,text:'Mention this post when booking to claim the discount.',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.2)',align:'center',verticalAlign:'middle' }),
        ]) },

      { name: 'Plumbing — 24/7 Emergency Service', industry: 'plumbing', category: 'announcement', sort_order: 104,
        canvas_json: mkPage('#100505', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#100505' }),
          r('e2',null,{ x:0,y:0,width:8,height:1350,fill:RED }),
          r('e3',null,{ x:0,y:0,width:1080,height:6,fill:RED }),
          r('e4',null,{ x:80,y:58,width:280,height:52,fill:RED,cornerRadius:8 }),
          t('e5',null,{ x:80,y:58,width:280,height:52,text:'⚡ EMERGENCY',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:165,width:920,height:380,text:'Plumbing\nEmergency?\nWe\'re Ready.',fontFamily:'Inter',fontSize:100,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'top',lineHeight:1.05 }),
          t('e7',null,{ x:80,y:590,width:920,height:130,text:'Burst pipes. Sewage backup. Gas leak. Whatever the crisis — we answer 24 hours a day, 7 days a week.',fontFamily:'Inter',fontSize:30,fill:'rgba(255,255,255,0.7)',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          r('e8',null,{ x:80,y:775,width:920,height:80,fill:'rgba(239,68,68,0.12)',cornerRadius:10 }),
          t('e9',null,{ x:80,y:775,width:920,height:80,text:'Average response time: Under 60 minutes',fontFamily:'Inter',fontSize:26,fontStyle:'bold',fill:'#ff8080',align:'center',verticalAlign:'middle' }),
          r('e10',null,{ x:80,y:922,width:920,height:100,fill:RED,cornerRadius:10 }),
          t('e11',null,{ x:80,y:922,width:920,height:100,text:'CALL 24/7: (555) 000-0000',fontFamily:'Inter',fontSize:38,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e12',null,{ x:80,y:1088,width:920,height:140,text:'Burst pipes  •  Blocked drains\nHot water  •  Gas leaks',fontFamily:'Inter',fontSize:26,fill:'rgba(255,255,255,0.45)',align:'center',verticalAlign:'top',lineHeight:1.6 }),
          r('e13',null,{ x:80,y:1272,width:920,height:2,fill:'rgba(255,255,255,0.05)',cornerRadius:1 }),
          t('e14',null,{ x:80,y:1286,width:920,height:50,text:'Business Name  •  Licensed, Insured & Bonded  •  [City]',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.25)',align:'center',verticalAlign:'middle' }),
        ]) },

      { name: 'Plumbing — How It Works 3 Steps', industry: 'plumbing', category: 'educational', sort_order: 105,
        canvas_json: mkPage('#ffffff', [
          r('e1',null,{ x:0,y:0,width:1080,height:10,fill:TEAL }),
          t('e2',null,{ x:80,y:60,width:920,height:120,text:'How Our Process\nWorks',fontFamily:'Inter',fontSize:62,fontStyle:'bold',fill:'#111111',align:'left',verticalAlign:'top',lineHeight:1.15 }),
          t('e3',null,{ x:80,y:212,width:920,height:58,text:'Simple, stress-free plumbing from first call to final fix.',fontFamily:'Inter',fontSize:28,fill:'#777777',align:'left',verticalAlign:'middle' }),
          r('e4',null,{ x:80,y:318,width:920,height:238,fill:'#f5feff',cornerRadius:14 }),
          r('e5',null,{ x:110,y:358,width:80,height:80,fill:TEAL,cornerRadius:40 }),
          t('e6',null,{ x:110,y:358,width:80,height:80,text:'1',fontFamily:'Inter',fontSize:38,fontStyle:'bold',fill:'#000000',align:'center',verticalAlign:'middle' }),
          t('e7',null,{ x:215,y:358,width:755,height:55,text:'You Call — We Pick Up',fontFamily:'Inter',fontSize:30,fontStyle:'bold',fill:'#111111',align:'left',verticalAlign:'middle' }),
          t('e8',null,{ x:215,y:432,width:755,height:105,text:'Available 24/7 for emergencies. We ask a few quick questions, then confirm your appointment — often same day.',fontFamily:'Inter',fontSize:23,fill:'#555555',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          r('e9',null,{ x:80,y:590,width:920,height:238,fill:'#f5feff',cornerRadius:14 }),
          r('e10',null,{ x:110,y:630,width:80,height:80,fill:TEAL,cornerRadius:40 }),
          t('e11',null,{ x:110,y:630,width:80,height:80,text:'2',fontFamily:'Inter',fontSize:38,fontStyle:'bold',fill:'#000000',align:'center',verticalAlign:'middle' }),
          t('e12',null,{ x:215,y:630,width:755,height:55,text:'We Diagnose & Quote Upfront',fontFamily:'Inter',fontSize:30,fontStyle:'bold',fill:'#111111',align:'left',verticalAlign:'middle' }),
          t('e13',null,{ x:215,y:705,width:755,height:105,text:'Our licensed plumber assesses on-site, explains exactly what needs doing, and gives you a fixed price before we start.',fontFamily:'Inter',fontSize:23,fill:'#555555',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          r('e14',null,{ x:80,y:862,width:920,height:238,fill:'#f5feff',cornerRadius:14 }),
          r('e15',null,{ x:110,y:902,width:80,height:80,fill:TEAL,cornerRadius:40 }),
          t('e16',null,{ x:110,y:902,width:80,height:80,text:'3',fontFamily:'Inter',fontSize:38,fontStyle:'bold',fill:'#000000',align:'center',verticalAlign:'middle' }),
          t('e17',null,{ x:215,y:902,width:755,height:55,text:'Fixed. Cleaned Up. Guaranteed.',fontFamily:'Inter',fontSize:30,fontStyle:'bold',fill:'#111111',align:'left',verticalAlign:'middle' }),
          t('e18',null,{ x:215,y:976,width:755,height:105,text:'We do the work, leave your home clean, and back every repair. If anything\'s not right — we come back at no charge.',fontFamily:'Inter',fontSize:23,fill:'#555555',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          r('e19',null,{ x:80,y:1142,width:920,height:3,fill:'#e0e0e0',cornerRadius:2 }),
          t('e20',null,{ x:80,y:1172,width:920,height:70,text:'Business Name  •  (555) 000-0000',fontFamily:'Inter',fontSize:30,fontStyle:'bold',fill:TEAL,align:'center',verticalAlign:'middle' }),
          t('e21',null,{ x:80,y:1262,width:920,height:55,text:'Licensed & Insured  •  Serving [City] & Surrounds',fontFamily:'Inter',fontSize:21,fill:'#aaaaaa',align:'center',verticalAlign:'middle' }),
        ]) },

      { name: 'Plumbing — Water Heater Service', industry: 'plumbing', category: 'educational', sort_order: 106,
        canvas_json: mkPage('#0e0b04', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#0e0b04' }),
          r('e2',null,{ x:0,y:0,width:1080,height:8,fill:GOLD }),
          r('e3',null,{ x:80,y:58,width:320,height:52,fill:'rgba(255,184,0,0.12)',cornerRadius:8 }),
          t('e4',null,{ x:80,y:58,width:320,height:52,text:'🔥 WATER HEATER SERVICE',fontFamily:'Inter',fontSize:18,fontStyle:'bold',fill:GOLD,align:'center',verticalAlign:'middle' }),
          t('e5',null,{ x:80,y:155,width:920,height:250,text:'No Hot Water?\nWe Fix It Fast.',fontFamily:'Inter',fontSize:90,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'top',lineHeight:1.08 }),
          t('e6',null,{ x:80,y:440,width:920,height:105,text:'From pilot light issues to full replacements — our licensed plumbers handle all brands and makes.',fontFamily:'Inter',fontSize:29,fill:'rgba(255,255,255,0.65)',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          r('e7',null,{ x:80,y:600,width:440,height:90,fill:'rgba(255,184,0,0.06)',cornerRadius:10 }),
          t('e8',null,{ x:80,y:600,width:440,height:90,text:'🔧 Repairs & Servicing',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'rgba(255,255,255,0.8)',align:'center',verticalAlign:'middle' }),
          r('e9',null,{ x:560,y:600,width:440,height:90,fill:'rgba(255,184,0,0.06)',cornerRadius:10 }),
          t('e10',null,{ x:560,y:600,width:440,height:90,text:'♻️ Full Replacements',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'rgba(255,255,255,0.8)',align:'center',verticalAlign:'middle' }),
          r('e11',null,{ x:80,y:712,width:440,height:90,fill:'rgba(255,184,0,0.06)',cornerRadius:10 }),
          t('e12',null,{ x:80,y:712,width:440,height:90,text:'⚡ Same-Day Install',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'rgba(255,255,255,0.8)',align:'center',verticalAlign:'middle' }),
          r('e13',null,{ x:560,y:712,width:440,height:90,fill:'rgba(255,184,0,0.06)',cornerRadius:10 }),
          t('e14',null,{ x:560,y:712,width:440,height:90,text:'💧 Tankless Units',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'rgba(255,255,255,0.8)',align:'center',verticalAlign:'middle' }),
          r('e15',null,{ x:80,y:858,width:920,height:3,fill:'rgba(255,255,255,0.06)',cornerRadius:2 }),
          t('e16',null,{ x:80,y:888,width:920,height:60,text:'★ ★ ★ ★ ★   Hundreds of satisfied customers in [City]',fontFamily:'Inter',fontSize:25,fontStyle:'bold',fill:GOLD,align:'center',verticalAlign:'middle' }),
          r('e17',null,{ x:80,y:1015,width:920,height:82,fill:GOLD,cornerRadius:10 }),
          t('e18',null,{ x:80,y:1015,width:920,height:82,text:'Call for a Free Quote — (555) 000-0000',fontFamily:'Inter',fontSize:28,fontStyle:'bold',fill:'#000000',align:'center',verticalAlign:'middle' }),
          t('e19',null,{ x:80,y:1155,width:920,height:55,text:'Business Name  •  All brands & makes  •  Licensed',fontFamily:'Inter',fontSize:21,fill:'rgba(255,255,255,0.3)',align:'center',verticalAlign:'middle' }),
          t('e20',null,{ x:80,y:1235,width:920,height:55,text:'Serving [City] and surrounding areas',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.18)',align:'center',verticalAlign:'middle' }),
        ]) },

      { name: 'Plumbing — Why Choose Us', industry: 'plumbing', category: 'social-proof', sort_order: 107,
        canvas_json: mkPage('#f7f9fc', [
          r('e1',null,{ x:0,y:0,width:1080,height:10,fill:TEAL }),
          r('e2',null,{ x:0,y:0,width:10,height:1350,fill:TEAL }),
          t('e3',null,{ x:60,y:60,width:960,height:120,text:'Why [City] Homeowners\nChoose Us',fontFamily:'Inter',fontSize:58,fontStyle:'bold',fill:'#111111',align:'left',verticalAlign:'top',lineHeight:1.15 }),
          t('e4',null,{ x:60,y:210,width:920,height:55,text:'We\'re not just plumbers — we\'re your neighbours.',fontFamily:'Inter',fontSize:26,fill:'#666666',align:'left',verticalAlign:'middle' }),
          r('e5',null,{ x:60,y:290,width:920,height:3,fill:'#e0e0e0',cornerRadius:2 }),
          r('e6',null,{ x:60,y:318,width:920,height:130,fill:'#ffffff',cornerRadius:12 }),
          t('e7',null,{ x:90,y:338,width:70,height:70,text:'⚡',fontFamily:'Inter',fontSize:42,fill:'#111111',align:'center',verticalAlign:'middle' }),
          t('e8',null,{ x:180,y:338,width:780,height:40,text:'Same-day & emergency service, 24/7',fontFamily:'Inter',fontSize:26,fontStyle:'bold',fill:'#111111',align:'left',verticalAlign:'middle' }),
          t('e9',null,{ x:180,y:388,width:780,height:44,text:'We pick up the phone and show up when we say we will — every time.',fontFamily:'Inter',fontSize:21,fill:'#666666',align:'left',verticalAlign:'middle' }),
          r('e10',null,{ x:60,y:468,width:920,height:130,fill:'#ffffff',cornerRadius:12 }),
          t('e11',null,{ x:90,y:490,width:70,height:70,text:'💰',fontFamily:'Inter',fontSize:42,fill:'#111111',align:'center',verticalAlign:'middle' }),
          t('e12',null,{ x:180,y:490,width:780,height:40,text:'Upfront pricing — no surprise bills',fontFamily:'Inter',fontSize:26,fontStyle:'bold',fill:'#111111',align:'left',verticalAlign:'middle' }),
          t('e13',null,{ x:180,y:540,width:780,height:44,text:'You see the full quote before we touch a single pipe. No extras added at the end.',fontFamily:'Inter',fontSize:21,fill:'#666666',align:'left',verticalAlign:'middle' }),
          r('e14',null,{ x:60,y:618,width:920,height:130,fill:'#ffffff',cornerRadius:12 }),
          t('e15',null,{ x:90,y:640,width:70,height:70,text:'🔒',fontFamily:'Inter',fontSize:42,fill:'#111111',align:'center',verticalAlign:'middle' }),
          t('e16',null,{ x:180,y:640,width:780,height:40,text:'Licensed, insured & background-checked',fontFamily:'Inter',fontSize:26,fontStyle:'bold',fill:'#111111',align:'left',verticalAlign:'middle' }),
          t('e17',null,{ x:180,y:690,width:780,height:44,text:'Every plumber on our team is fully licensed and vetted. Your home is in safe hands.',fontFamily:'Inter',fontSize:21,fill:'#666666',align:'left',verticalAlign:'middle' }),
          r('e18',null,{ x:60,y:768,width:920,height:130,fill:'#ffffff',cornerRadius:12 }),
          t('e19',null,{ x:90,y:790,width:70,height:70,text:'✅',fontFamily:'Inter',fontSize:42,fill:'#111111',align:'center',verticalAlign:'middle' }),
          t('e20',null,{ x:180,y:790,width:780,height:40,text:'100% satisfaction guarantee',fontFamily:'Inter',fontSize:26,fontStyle:'bold',fill:'#111111',align:'left',verticalAlign:'middle' }),
          t('e21',null,{ x:180,y:840,width:780,height:44,text:'Not happy? We come back and fix it at no extra charge. That\'s our promise.',fontFamily:'Inter',fontSize:21,fill:'#666666',align:'left',verticalAlign:'middle' }),
          t('e22',null,{ x:60,y:1002,width:920,height:65,text:'★ ★ ★ ★ ★   Rated 5 Stars — 200+ Google Reviews',fontFamily:'Inter',fontSize:28,fontStyle:'bold',fill:GOLD,align:'center',verticalAlign:'middle' }),
          r('e23',null,{ x:60,y:1110,width:920,height:80,fill:TEAL,cornerRadius:10 }),
          t('e24',null,{ x:60,y:1110,width:920,height:80,text:'Business Name  •  (555) 000-0000',fontFamily:'Inter',fontSize:28,fontStyle:'bold',fill:'#000000',align:'center',verticalAlign:'middle' }),
          t('e25',null,{ x:60,y:1228,width:920,height:55,text:'Serving [City] and surrounding areas',fontFamily:'Inter',fontSize:22,fill:'#888888',align:'center',verticalAlign:'middle' }),
        ]) },

      { name: 'Plumbing — Spring Maintenance Checklist', industry: 'plumbing', category: 'seasonal', sort_order: 108,
        canvas_json: mkPage('#0a2010', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#0a2010' }),
          r('e2',null,{ x:0,y:0,width:1080,height:8,fill:'#22c55e' }),
          r('e3',null,{ x:80,y:58,width:330,height:52,fill:'rgba(34,197,94,0.12)',cornerRadius:8 }),
          t('e4',null,{ x:80,y:58,width:330,height:52,text:'🌿 SPRING CHECKLIST',fontFamily:'Inter',fontSize:19,fontStyle:'bold',fill:'#22c55e',align:'center',verticalAlign:'middle' }),
          t('e5',null,{ x:80,y:158,width:920,height:210,text:'Your Home\'s\nSpring Plumbing\nCheck-Up',fontFamily:'Inter',fontSize:72,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'top',lineHeight:1.08 }),
          t('e6',null,{ x:80,y:395,width:920,height:60,text:'5 things to check before summer — or call us to handle it all.',fontFamily:'Inter',fontSize:25,fill:'rgba(255,255,255,0.6)',align:'left',verticalAlign:'middle' }),
          r('e7',null,{ x:80,y:480,width:920,height:3,fill:'rgba(34,197,94,0.2)',cornerRadius:2 }),
          r('e8',null,{ x:80,y:512,width:30,height:30,fill:'#22c55e',cornerRadius:15 }),
          t('e9',null,{ x:128,y:508,width:872,height:52,text:'Inspect outdoor taps & hose bibs for frost damage',fontFamily:'Inter',fontSize:26,fontStyle:'bold',fill:'rgba(255,255,255,0.85)',align:'left',verticalAlign:'middle' }),
          r('e10',null,{ x:80,y:586,width:30,height:30,fill:'#22c55e',cornerRadius:15 }),
          t('e11',null,{ x:128,y:582,width:872,height:52,text:'Test your sump pump before the rainy season hits',fontFamily:'Inter',fontSize:26,fontStyle:'bold',fill:'rgba(255,255,255,0.85)',align:'left',verticalAlign:'middle' }),
          r('e12',null,{ x:80,y:660,width:30,height:30,fill:'#22c55e',cornerRadius:15 }),
          t('e13',null,{ x:128,y:656,width:872,height:52,text:'Check under sinks for slow leaks you may have missed',fontFamily:'Inter',fontSize:26,fontStyle:'bold',fill:'rgba(255,255,255,0.85)',align:'left',verticalAlign:'middle' }),
          r('e14',null,{ x:80,y:734,width:30,height:30,fill:'#22c55e',cornerRadius:15 }),
          t('e15',null,{ x:128,y:730,width:872,height:52,text:'Flush your hot water heater to clear sediment buildup',fontFamily:'Inter',fontSize:26,fontStyle:'bold',fill:'rgba(255,255,255,0.85)',align:'left',verticalAlign:'middle' }),
          r('e16',null,{ x:80,y:808,width:30,height:30,fill:'#22c55e',cornerRadius:15 }),
          t('e17',null,{ x:128,y:804,width:872,height:52,text:'Run all drains — note any gurgling or slow drainage',fontFamily:'Inter',fontSize:26,fontStyle:'bold',fill:'rgba(255,255,255,0.85)',align:'left',verticalAlign:'middle' }),
          r('e18',null,{ x:80,y:938,width:920,height:130,fill:'rgba(34,197,94,0.1)',cornerRadius:12 }),
          t('e19',null,{ x:80,y:958,width:920,height:55,text:'Want us to handle this for you?',fontFamily:'Inter',fontSize:26,fontStyle:'bold',fill:'#22c55e',align:'center',verticalAlign:'middle' }),
          t('e20',null,{ x:80,y:1020,width:920,height:42,text:'Spring maintenance visit from $89 — book before spots fill up.',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.6)',align:'center',verticalAlign:'middle' }),
          r('e21',null,{ x:80,y:1148,width:920,height:78,fill:'#22c55e',cornerRadius:10 }),
          t('e22',null,{ x:80,y:1148,width:920,height:78,text:'Book Now — (555) 000-0000',fontFamily:'Inter',fontSize:30,fontStyle:'bold',fill:'#000000',align:'center',verticalAlign:'middle' }),
          t('e23',null,{ x:80,y:1272,width:920,height:52,text:'Business Name  •  Licensed & Insured  •  [City]',fontFamily:'Inter',fontSize:21,fill:'rgba(255,255,255,0.25)',align:'center',verticalAlign:'middle' }),
        ]) },

      { name: 'Plumbing — New Customer Discount', industry: 'plumbing', category: 'promotional', sort_order: 109,
        canvas_json: mkPage('#0d0d1a', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#0d0d1a' }),
          r('e2',null,{ x:0,y:0,width:1080,height:8,fill:PURPLE }),
          r('e3',null,{ x:0,y:0,width:8,height:1350,fill:PURPLE }),
          r('e4',null,{ x:80,y:58,width:380,height:52,fill:'rgba(124,92,252,0.15)',cornerRadius:8 }),
          t('e5',null,{ x:80,y:58,width:380,height:52,text:'🎉  FIRST-TIME CUSTOMER OFFER',fontFamily:'Inter',fontSize:17,fontStyle:'bold',fill:'#a78bfa',align:'center',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:162,width:920,height:210,text:'$30 OFF',fontFamily:'Inter',fontSize:158,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle',lineHeight:1.0 }),
          t('e7',null,{ x:80,y:385,width:920,height:65,text:'Your First Plumbing Service',fontFamily:'Inter',fontSize:38,fontStyle:'bold',fill:'#a78bfa',align:'center',verticalAlign:'middle' }),
          r('e8',null,{ x:240,y:475,width:600,height:3,fill:'rgba(124,92,252,0.3)',cornerRadius:2 }),
          t('e9',null,{ x:80,y:510,width:920,height:120,text:'New customer? We want to earn your trust. Use this offer on any repair, installation, or maintenance visit.',fontFamily:'Inter',fontSize:29,fill:'rgba(255,255,255,0.7)',align:'center',verticalAlign:'top',lineHeight:1.5 }),
          r('e10',null,{ x:80,y:690,width:280,height:62,fill:'rgba(124,92,252,0.1)',cornerRadius:8 }),
          t('e11',null,{ x:80,y:690,width:280,height:62,text:'🔧 Repairs',fontFamily:'Inter',fontSize:21,fontStyle:'bold',fill:'#a78bfa',align:'center',verticalAlign:'middle' }),
          r('e12',null,{ x:380,y:690,width:320,height:62,fill:'rgba(124,92,252,0.1)',cornerRadius:8 }),
          t('e13',null,{ x:380,y:690,width:320,height:62,text:'⚙️ Installs',fontFamily:'Inter',fontSize:21,fontStyle:'bold',fill:'#a78bfa',align:'center',verticalAlign:'middle' }),
          r('e14',null,{ x:720,y:690,width:280,height:62,fill:'rgba(124,92,252,0.1)',cornerRadius:8 }),
          t('e15',null,{ x:720,y:690,width:280,height:62,text:'🛠 Maintenance',fontFamily:'Inter',fontSize:21,fontStyle:'bold',fill:'#a78bfa',align:'center',verticalAlign:'middle' }),
          t('e16',null,{ x:80,y:810,width:920,height:45,text:'Valid for new customers only. Mention this post when booking.',fontFamily:'Inter',fontSize:21,fill:'rgba(255,255,255,0.3)',align:'center',verticalAlign:'middle' }),
          r('e17',null,{ x:80,y:918,width:920,height:72,fill:'rgba(255,255,255,0.04)',cornerRadius:10 }),
          t('e18',null,{ x:80,y:918,width:920,height:72,text:'Licensed & Insured  •  5-Star Rated  •  No Call-Out Fee',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'rgba(255,255,255,0.5)',align:'center',verticalAlign:'middle' }),
          r('e19',null,{ x:80,y:1060,width:920,height:82,fill:PURPLE,cornerRadius:10 }),
          t('e20',null,{ x:80,y:1060,width:920,height:82,text:'Claim Your Discount — (555) 000-0000',fontFamily:'Inter',fontSize:28,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e21',null,{ x:80,y:1202,width:920,height:55,text:'Business Name  •  [City] & Surrounding Areas',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.28)',align:'center',verticalAlign:'middle' }),
          t('e22',null,{ x:80,y:1280,width:920,height:48,text:'www.yourbusiness.com',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.15)',align:'center',verticalAlign:'middle' }),
        ]) },

      // ── ROOFING ───────────────────────────────────────────────────────────────
      { name: 'Roofing — Storm Damage Alert', industry: 'roofing', category: 'seasonal', sort_order: 200,
        canvas_json: mkPage('#1A1A1A', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#1A1A1A' }),
          r('e2',null,{ x:0,y:0,width:1080,height:22,fill:'#FF6B35' }),
          r('e3',null,{ x:0,y:1328,width:1080,height:22,fill:'#FF6B35' }),
          t('e4',null,{ x:80,y:68,width:920,height:180,text:'⛈',fontFamily:'Inter',fontSize:140,fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e5',null,{ x:80,y:268,width:920,height:58,text:'⚠️  STORM DAMAGE ALERT  ⚠️',fontFamily:'Inter',fontSize:34,fontStyle:'bold',fill:'#FF6B35',align:'center',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:348,width:920,height:138,text:'IS YOUR',fontFamily:'Inter',fontSize:118,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e7',null,{ x:80,y:480,width:920,height:175,text:'ROOF',fontFamily:'Inter',fontSize:158,fontStyle:'bold',fill:'#FF6B35',align:'center',verticalAlign:'middle' }),
          t('e8',null,{ x:80,y:650,width:920,height:138,text:'OKAY?',fontFamily:'Inter',fontSize:118,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          r('e9',null,{ x:240,y:858,width:600,height:2,fill:'#FF6B35',cornerRadius:1 }),
          t('e10',null,{ x:80,y:878,width:920,height:48,text:'Free post-storm roof inspection',fontFamily:'Inter',fontSize:30,fill:'#FF6B35',align:'center',verticalAlign:'middle' }),
          t('e11',null,{ x:80,y:932,width:920,height:42,text:'for [City] homeowners — this week only',fontFamily:'Inter',fontSize:26,fill:'rgba(255,255,255,0.6)',align:'center',verticalAlign:'middle' }),
          t('e12',null,{ x:80,y:1018,width:920,height:108,text:'(555) 000-0000',fontFamily:'Inter',fontSize:78,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e13',null,{ x:80,y:1150,width:920,height:36,text:'CALL OR TEXT — WE RESPOND SAME DAY',fontFamily:'Inter',fontSize:17,fill:'rgba(255,255,255,0.32)',align:'center',verticalAlign:'middle' }),
          r('e14',null,{ x:80,y:1228,width:920,height:1,fill:'rgba(255,255,255,0.08)' }),
          t('e15',null,{ x:80,y:1248,width:920,height:52,text:'Business Name  •  Licensed & Insured',fontFamily:'Inter',fontSize:21,fill:'rgba(255,255,255,0.32)',align:'center',verticalAlign:'middle' }),
        ]) },

      { name: 'Roofing — Before & After Showcase', industry: 'roofing', category: 'before-after', sort_order: 201,
        canvas_json: mkPage('#2C2C2C', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#2C2C2C' }),
          r('e2',null,{ x:0,y:0,width:12,height:1350,fill:'#C0392B' }),
          t('e3',null,{ x:80,y:88,width:840,height:30,text:'REAL JOB  ·  REAL RESULT  ·  [CITY]',fontFamily:'Inter',fontSize:17,fontStyle:'bold',fill:'#C0392B',align:'left',verticalAlign:'middle' }),
          t('e4',null,{ x:80,y:148,width:920,height:128,text:'OLD ROOF.',fontFamily:'Inter',fontSize:112,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e5',null,{ x:80,y:274,width:920,height:128,text:'NEW ROOF.',fontFamily:'Inter',fontSize:112,fontStyle:'bold',fill:'#C0392B',align:'left',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:400,width:920,height:128,text:'SPOT THE',fontFamily:'Inter',fontSize:112,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e7',null,{ x:80,y:522,width:920,height:98,text:'DIFFERENCE.',fontFamily:'Inter',fontSize:80,fontStyle:'bold',fill:'#F39C12',align:'left',verticalAlign:'middle' }),
          r('e8',null,{ x:80,y:668,width:920,height:190,fill:'rgba(255,255,255,0.05)',cornerRadius:14 }),
          t('e9',null,{ x:120,y:690,width:840,height:28,text:'THE JOB',fontFamily:'Inter',fontSize:15,fontStyle:'bold',fill:'#F39C12',align:'left',verticalAlign:'middle' }),
          t('e10',null,{ x:120,y:728,width:840,height:68,text:'Full roof replacement — architectural shingles',fontFamily:'Inter',fontSize:40,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e11',null,{ x:120,y:814,width:250,height:34,text:'2 day job',fontFamily:'Inter',fontSize:24,fill:'rgba(255,255,255,0.55)',align:'left',verticalAlign:'middle' }),
          t('e12',null,{ x:400,y:814,width:260,height:34,text:'30yr warranty',fontFamily:'Inter',fontSize:24,fill:'rgba(255,255,255,0.55)',align:'left',verticalAlign:'middle' }),
          t('e13',null,{ x:688,y:814,width:260,height:34,text:'★ 5.0 rated',fontFamily:'Inter',fontSize:24,fill:'#F39C12',align:'left',verticalAlign:'middle' }),
          r('e14',null,{ x:80,y:906,width:680,height:66,fill:'#C0392B',cornerRadius:33 }),
          t('e15',null,{ x:80,y:906,width:680,height:66,text:'Swipe to see the full transformation →',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          r('e16',null,{ x:80,y:1022,width:920,height:200,fill:'rgba(255,255,255,0.03)',cornerRadius:10 }),
          t('e17',null,{ x:80,y:1022,width:920,height:200,text:'📸  Add your Before & After\nphotos here',fontFamily:'Inter',fontSize:32,fill:'rgba(255,255,255,0.12)',align:'center',verticalAlign:'middle',lineHeight:1.5 }),
          r('e18',null,{ x:80,y:1252,width:920,height:1,fill:'rgba(255,255,255,0.08)' }),
          t('e19',null,{ x:80,y:1274,width:920,height:48,text:'Business Name  •  [City]  •  (555) 000-0000',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.30)',align:'left',verticalAlign:'middle' }),
        ]) },

      { name: 'Roofing — 5-Star Review Spotlight', industry: 'roofing', category: 'social-proof', sort_order: 202,
        canvas_json: mkPage('#1C1C1E', [
          r('e1',null,{ x:0,y:0,width:1080,height:900,fill:'#1C1C1E' }),
          r('e2',null,{ x:0,y:900,width:1080,height:450,fill:'#1A1208' }),
          r('e3',null,{ x:0,y:0,width:1080,height:8,fill:'#E67E22' }),
          t('e4',null,{ x:60,y:52,width:240,height:220,text:'"',fontFamily:'Inter',fontSize:220,fontStyle:'bold',fill:'rgba(230,126,34,0.09)',align:'left',verticalAlign:'top' }),
          t('e5',null,{ x:80,y:136,width:920,height:70,text:'★★★★★',fontFamily:'Inter',fontSize:54,fill:'#F1C40F',align:'left',verticalAlign:'middle' }),
          r('e6',null,{ x:80,y:226,width:190,height:44,fill:'rgba(230,126,34,0.18)',cornerRadius:22 }),
          t('e7',null,{ x:80,y:226,width:190,height:44,text:'Google Review',fontFamily:'Inter',fontSize:15,fontStyle:'bold',fill:'#E67E22',align:'center',verticalAlign:'middle' }),
          t('e8',null,{ x:80,y:288,width:920,height:560,text:'"Replace with your best customer review. The most powerful reviews mention the specific problem, what you did, and how the customer feels now. Real words convert best."',fontFamily:'Inter',fontSize:38,fill:'#ffffff',align:'left',verticalAlign:'top',lineHeight:1.55 }),
          r('e9',null,{ x:0,y:900,width:1080,height:1,fill:'rgba(230,126,34,0.18)' }),
          r('e10',null,{ x:80,y:936,width:88,height:88,fill:'#E67E22',cornerRadius:44 }),
          t('e11',null,{ x:80,y:936,width:88,height:88,text:'JD',fontFamily:'Inter',fontSize:30,fontStyle:'bold',fill:'#1C1C1E',align:'center',verticalAlign:'middle' }),
          t('e12',null,{ x:188,y:948,width:700,height:38,text:'James D.',fontFamily:'Inter',fontSize:27,fontStyle:'bold',fill:'#F1C40F',align:'left',verticalAlign:'middle' }),
          t('e13',null,{ x:188,y:994,width:700,height:34,text:'[City]  ·  Full Roof Replacement',fontFamily:'Inter',fontSize:21,fill:'rgba(255,255,255,0.42)',align:'left',verticalAlign:'middle' }),
          r('e14',null,{ x:80,y:1058,width:80,height:3,fill:'#E67E22',cornerRadius:2 }),
          t('e15',null,{ x:80,y:1080,width:920,height:44,text:'We work directly with your insurance company.',fontFamily:'Inter',fontSize:24,fill:'#F1C40F',align:'left',verticalAlign:'middle' }),
          r('e16',null,{ x:80,y:1200,width:920,height:1,fill:'rgba(255,255,255,0.06)' }),
          t('e17',null,{ x:80,y:1222,width:920,height:42,text:'Business Name  ·  [City]',fontFamily:'Inter',fontSize:22,fill:'rgba(230,126,34,0.55)',align:'left',verticalAlign:'middle' }),
          t('e18',null,{ x:80,y:1280,width:920,height:42,text:'(555) 000-0000  ·  Licensed & Insured',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.22)',align:'left',verticalAlign:'middle' }),
        ]) },

      { name: 'Roofing — 5 Warning Signs', industry: 'roofing', category: 'educational', sort_order: 203,
        canvas_json: mkPage('#2D2D2D', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#2D2D2D' }),
          r('e2',null,{ x:0,y:0,width:1080,height:10,fill:'#E74C3C' }),
          t('e3',null,{ x:80,y:188,width:920,height:148,text:'5 SIGNS',fontFamily:'Inter',fontSize:126,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e4',null,{ x:80,y:334,width:920,height:148,text:'YOUR ROOF',fontFamily:'Inter',fontSize:126,fontStyle:'bold',fill:'#E74C3C',align:'center',verticalAlign:'middle' }),
          t('e5',null,{ x:80,y:480,width:920,height:148,text:'IS TELLING',fontFamily:'Inter',fontSize:126,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:626,width:920,height:96,text:'YOU SOMETHING. 🏚',fontFamily:'Inter',fontSize:70,fontStyle:'bold',fill:'rgba(236,240,241,0.88)',align:'center',verticalAlign:'middle' }),
          r('e7',null,{ x:80,y:790,width:920,height:3,fill:'rgba(231,76,60,0.28)',cornerRadius:2 }),
          t('e8',null,{ x:80,y:816,width:920,height:48,text:'🏠  Curling shingles   ·   🔧  Granules in gutters',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.48)',align:'center',verticalAlign:'middle' }),
          t('e9',null,{ x:80,y:872,width:920,height:48,text:'☀  Daylight in attic   ·   ⚠  Sagging roofline',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.48)',align:'center',verticalAlign:'middle' }),
          t('e10',null,{ x:80,y:928,width:920,height:48,text:'📅  Roof is 20+ years old',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.48)',align:'center',verticalAlign:'middle' }),
          r('e11',null,{ x:215,y:1048,width:650,height:66,fill:'#E74C3C',cornerRadius:33 }),
          t('e12',null,{ x:215,y:1048,width:650,height:66,text:'Free inspection — call (555) 000-0000',fontFamily:'Inter',fontSize:23,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e13',null,{ x:80,y:1170,width:920,height:46,text:'Business Name  ·  [City]  ·  Licensed & Insured',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.26)',align:'center',verticalAlign:'middle' }),
        ]) },

      { name: 'Roofing — Free Estimate Offer', industry: 'roofing', category: 'promotional', sort_order: 204,
        canvas_json: mkPage('#1E272E', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#1E272E' }),
          t('e2',null,{ x:-60,y:10,width:1200,height:480,text:'FREE',fontFamily:'Inter',fontSize:390,fontStyle:'bold',fill:'rgba(249,202,36,0.04)',align:'left',verticalAlign:'middle' }),
          r('e3',null,{ x:80,y:80,width:420,height:50,fill:'rgba(249,202,36,0.12)',cornerRadius:25 }),
          t('e4',null,{ x:80,y:80,width:420,height:50,text:'NO OBLIGATION  ·  NO PRESSURE',fontFamily:'Inter',fontSize:16,fontStyle:'bold',fill:'#F9CA24',align:'center',verticalAlign:'middle' }),
          t('e5',null,{ x:80,y:172,width:920,height:116,text:'GET YOUR',fontFamily:'Inter',fontSize:94,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:282,width:920,height:168,text:'FREE',fontFamily:'Inter',fontSize:158,fontStyle:'bold',fill:'#F9CA24',align:'left',verticalAlign:'middle' }),
          t('e7',null,{ x:80,y:444,width:920,height:108,text:'ROOF',fontFamily:'Inter',fontSize:94,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e8',null,{ x:80,y:548,width:920,height:108,text:'ESTIMATE.',fontFamily:'Inter',fontSize:94,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e9',null,{ x:80,y:712,width:920,height:28,text:'YOUR ESTIMATE INCLUDES:',fontFamily:'Inter',fontSize:15,fontStyle:'bold',fill:'rgba(249,202,36,0.62)',align:'left',verticalAlign:'middle' }),
          t('e10',null,{ x:80,y:754,width:920,height:44,text:'✓  Full roof inspection — inside and out',fontFamily:'Inter',fontSize:27,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e11',null,{ x:80,y:812,width:920,height:44,text:'✓  Written cost breakdown — no surprises',fontFamily:'Inter',fontSize:27,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e12',null,{ x:80,y:870,width:920,height:44,text:'✓  Insurance claim guidance included',fontFamily:'Inter',fontSize:27,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e13',null,{ x:80,y:928,width:920,height:44,text:'✓  Zero obligation — ever',fontFamily:'Inter',fontSize:27,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          r('e14',null,{ x:80,y:1042,width:920,height:108,fill:'#F9CA24',cornerRadius:14 }),
          t('e15',null,{ x:80,y:1042,width:920,height:108,text:'(555) 000-0000',fontFamily:'Inter',fontSize:70,fontStyle:'bold',fill:'#1E272E',align:'center',verticalAlign:'middle' }),
          t('e16',null,{ x:80,y:1172,width:920,height:40,text:'Call or text to book your free estimate',fontFamily:'Inter',fontSize:22,fill:'rgba(249,202,36,0.55)',align:'center',verticalAlign:'middle' }),
          r('e17',null,{ x:80,y:1248,width:920,height:1,fill:'rgba(255,255,255,0.08)' }),
          t('e18',null,{ x:80,y:1268,width:920,height:52,text:'Business Name  •  [City]',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.28)',align:'left',verticalAlign:'middle' }),
        ]) },

      // ── ROOFING batch 2 ───────────────────────────────────────────────────────

      { name: 'Roofing — Meet the Crew', industry: 'roofing', category: 'team', sort_order: 205,
        canvas_json: mkPage('#17263C', [
          // ── Photo zone ──────────────────────────────────────────────────────
          r('e1',null,{ x:0,y:0,width:1080,height:820,fill:'#0D1B2E' }),
          r('e2',null,{ x:0,y:0,width:1080,height:820,fill:'#000000',opacity:0.30 }),
          t('e3',null,{ x:80,y:330,width:920,height:160,text:'📸  Add your crew photo here\n1080 × 820 px',fontFamily:'Inter',fontSize:30,fill:'rgba(255,255,255,0.14)',align:'center',verticalAlign:'middle',lineHeight:1.6 }),
          // gradient fade effect — two stacked rects
          r('e4',null,{ x:0,y:600,width:1080,height:120,fill:'#17263C',opacity:0.55 }),
          r('e5',null,{ x:0,y:720,width:1080,height:100,fill:'#17263C',opacity:0.90 }),
          // ── Info panel ──────────────────────────────────────────────────────
          r('e6',null,{ x:0,y:820,width:1080,height:530,fill:'#17263C' }),
          // Name tag pill
          r('e7',null,{ x:80,y:756,width:580,height:64,fill:'#FFC107',cornerRadius:10 }),
          t('e8',null,{ x:80,y:756,width:580,height:64,text:'Mike Torres  ·  Lead Roofer',fontFamily:'Inter',fontSize:26,fontStyle:'bold',fill:'#17263C',align:'center',verticalAlign:'middle' }),
          // Headline
          t('e9',null,{ x:80,y:864,width:920,height:72,text:'The people protecting',fontFamily:'Inter',fontSize:56,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e10',null,{ x:80,y:934,width:920,height:72,text:'your home. 🏠',fontFamily:'Inter',fontSize:56,fontStyle:'bold',fill:'#FFC107',align:'left',verticalAlign:'middle' }),
          // Stats bar bg
          r('e11',null,{ x:80,y:1038,width:920,height:108,fill:'rgba(255,255,255,0.05)',cornerRadius:12 }),
          // Stat: Years
          t('e12',null,{ x:80,y:1052,width:280,height:54,text:'15+',fontFamily:'Inter',fontSize:46,fontStyle:'bold',fill:'#FFC107',align:'center',verticalAlign:'middle' }),
          t('e13',null,{ x:80,y:1108,width:280,height:28,text:'Years',fontFamily:'Inter',fontSize:18,fill:'rgba(255,255,255,0.45)',align:'center',verticalAlign:'middle' }),
          r('e14',null,{ x:372,y:1056,width:1,height:88,fill:'#ffffff',opacity:0.10 }),
          // Stat: Roofs
          t('e15',null,{ x:400,y:1052,width:280,height:54,text:'800+',fontFamily:'Inter',fontSize:46,fontStyle:'bold',fill:'#FFC107',align:'center',verticalAlign:'middle' }),
          t('e16',null,{ x:400,y:1108,width:280,height:28,text:'Roofs Done',fontFamily:'Inter',fontSize:18,fill:'rgba(255,255,255,0.45)',align:'center',verticalAlign:'middle' }),
          r('e17',null,{ x:694,y:1056,width:1,height:88,fill:'#ffffff',opacity:0.10 }),
          // Stat: Rating
          t('e18',null,{ x:720,y:1052,width:280,height:54,text:'5.0 ⭐',fontFamily:'Inter',fontSize:46,fontStyle:'bold',fill:'#FFC107',align:'center',verticalAlign:'middle' }),
          t('e19',null,{ x:720,y:1108,width:280,height:28,text:'Rating',fontFamily:'Inter',fontSize:18,fill:'rgba(255,255,255,0.45)',align:'center',verticalAlign:'middle' }),
          // Bio
          t('e20',null,{ x:80,y:1188,width:920,height:76,text:'12 years installing roofs across the region. Dad, coffee fanatic, and genuinely proud to serve this community.',fontFamily:'Inter',fontSize:25,fill:'#FFC107',align:'left',verticalAlign:'top',lineHeight:1.5,opacity:0.85 }),
          // Footer
          r('e21',null,{ x:80,y:1278,width:920,height:1,fill:'#ffffff',opacity:0.10 }),
          t('e22',null,{ x:80,y:1298,width:680,height:42,text:'Peak Roofing Co.  ·  Licensed & Insured',fontFamily:'Inter',fontSize:21,fill:'rgba(255,255,255,0.42)',align:'left',verticalAlign:'middle' }),
          t('e23',null,{ x:800,y:1298,width:200,height:42,text:'GAF Elite',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.22)',align:'right',verticalAlign:'middle' }),
        ]) },

      { name: 'Roofing — Insurance Claim Help', industry: 'roofing', category: 'educational', sort_order: 206,
        canvas_json: mkPage('#1F3A5F', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#1F3A5F' }),
          // Green top banner
          r('e2',null,{ x:0,y:0,width:1080,height:110,fill:'#43B97F' }),
          t('e3',null,{ x:0,y:0,width:1080,height:110,text:'INSURANCE CLAIM HELP',fontFamily:'Inter',fontSize:38,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          // Big headline stacked
          t('e4',null,{ x:80,y:148,width:920,height:112,text:'YOUR INSURANCE',fontFamily:'Inter',fontSize:92,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e5',null,{ x:80,y:258,width:920,height:112,text:'SHOULD PAY',fontFamily:'Inter',fontSize:92,fontStyle:'bold',fill:'#43B97F',align:'left',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:368,width:920,height:112,text:'FOR THAT.',fontFamily:'Inter',fontSize:92,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          // Body copy
          t('e7',null,{ x:80,y:502,width:920,height:156,text:'Most homeowners end up paying out of pocket for something insurance should cover. We\'ve helped hundreds of [City] families get their roof replaced through insurance.',fontFamily:'Inter',fontSize:26,fill:'rgba(255,255,255,0.72)',align:'left',verticalAlign:'top',lineHeight:1.55 }),
          // Steps label
          t('e8',null,{ x:80,y:686,width:920,height:36,text:'HOW IT WORKS',fontFamily:'Inter',fontSize:15,fontStyle:'bold',fill:'#43B97F',align:'left',verticalAlign:'middle' }),
          // Step 1
          r('e9',null,{ x:80,y:738,width:56,height:56,fill:'rgba(67,185,127,0.18)',cornerRadius:28 }),
          t('e10',null,{ x:80,y:738,width:56,height:56,text:'01',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'#43B97F',align:'center',verticalAlign:'middle' }),
          t('e11',null,{ x:150,y:738,width:850,height:56,text:'Free inspection — we document everything for your claim',fontFamily:'Inter',fontSize:26,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          // Step 2
          r('e12',null,{ x:80,y:812,width:56,height:56,fill:'rgba(67,185,127,0.18)',cornerRadius:28 }),
          t('e13',null,{ x:80,y:812,width:56,height:56,text:'02',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'#43B97F',align:'center',verticalAlign:'middle' }),
          t('e14',null,{ x:150,y:812,width:850,height:56,text:'We meet your adjuster on-site and advocate for you',fontFamily:'Inter',fontSize:26,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          // Step 3
          r('e15',null,{ x:80,y:886,width:56,height:56,fill:'rgba(67,185,127,0.18)',cornerRadius:28 }),
          t('e16',null,{ x:80,y:886,width:56,height:56,text:'03',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'#43B97F',align:'center',verticalAlign:'middle' }),
          t('e17',null,{ x:150,y:886,width:850,height:56,text:'Full roof replacement — start to finish, no surprises',fontFamily:'Inter',fontSize:26,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          // Step 4
          r('e18',null,{ x:80,y:960,width:56,height:56,fill:'rgba(67,185,127,0.18)',cornerRadius:28 }),
          t('e19',null,{ x:80,y:960,width:56,height:56,text:'04',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'#43B97F',align:'center',verticalAlign:'middle' }),
          t('e20',null,{ x:150,y:960,width:850,height:56,text:'You enjoy a brand-new roof — insurer handles the bill',fontFamily:'Inter',fontSize:26,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          // Phone
          t('e21',null,{ x:80,y:1072,width:920,height:96,text:'(555) 000-0000',fontFamily:'Inter',fontSize:70,fontStyle:'bold',fill:'#43B97F',align:'center',verticalAlign:'middle' }),
          t('e22',null,{ x:80,y:1182,width:920,height:44,text:'DM us \'CLAIM\' for a free damage assessment',fontFamily:'Inter',fontSize:24,fill:'rgba(255,255,255,0.50)',align:'center',verticalAlign:'middle' }),
          // Footer
          r('e23',null,{ x:80,y:1258,width:920,height:1,fill:'#ffffff',opacity:0.08 }),
          t('e24',null,{ x:80,y:1280,width:920,height:50,text:'Business Name  ·  [City]  ·  Licensed & Insured',fontFamily:'Inter',fontSize:21,fill:'rgba(255,255,255,0.35)',align:'left',verticalAlign:'middle' }),
        ]) },

      { name: 'Roofing — Reel Hook', industry: 'roofing', category: 'video', sort_order: 207,
        canvas_json: mkPage('#000000', [
          // Dark cinematic background
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#0A1628' }),
          r('e2',null,{ x:0,y:0,width:1080,height:1350,fill:'#000000',opacity:0.50 }),
          // Bottom vignette
          r('e3',null,{ x:0,y:700,width:1080,height:650,fill:'#000000',opacity:0.72 }),
          // Video placeholder label (center zone)
          t('e4',null,{ x:80,y:200,width:920,height:200,text:'🎬  Add your best job-site\naction shot or video frame here',fontFamily:'Inter',fontSize:32,fill:'rgba(255,255,255,0.12)',align:'center',verticalAlign:'middle',lineHeight:1.5 }),
          // POV badge (yellow)
          r('e5',null,{ x:80,y:80,width:138,height:56,fill:'#F5C518',cornerRadius:8 }),
          t('e6',null,{ x:80,y:80,width:138,height:56,text:'POV',fontFamily:'Inter',fontSize:26,fontStyle:'bold',fill:'#0A2342',align:'center',verticalAlign:'middle' }),
          // Duration badge (dark glass)
          r('e7',null,{ x:840,y:80,width:162,height:56,fill:'rgba(0,0,0,0.62)',cornerRadius:8 }),
          t('e8',null,{ x:840,y:80,width:162,height:56,text:'0:27 · Reel',fontFamily:'Inter',fontSize:20,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          // Hook text — 3-line punch
          t('e9',null,{ x:80,y:420,width:920,height:98,text:'This 25-year-old roof',fontFamily:'Inter',fontSize:74,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e10',null,{ x:80,y:516,width:920,height:98,text:'got completely replaced',fontFamily:'Inter',fontSize:74,fontStyle:'bold',fill:'#F5C518',align:'center',verticalAlign:'middle' }),
          t('e11',null,{ x:80,y:612,width:920,height:98,text:'in under 2 days. 🤯',fontFamily:'Inter',fontSize:74,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          // Play button (yellow circle + triangle)
          r('e12',null,{ x:450,y:748,width:180,height:180,fill:'#F5C518',cornerRadius:90,opacity:0.92 }),
          t('e13',null,{ x:450,y:748,width:180,height:180,text:'▶',fontFamily:'Inter',fontSize:70,fill:'#0A2342',align:'center',verticalAlign:'middle' }),
          // Scene bars label
          t('e14',null,{ x:80,y:988,width:920,height:26,text:'SCENES',fontFamily:'Inter',fontSize:13,fontStyle:'bold',fill:'rgba(255,255,255,0.32)',align:'left',verticalAlign:'middle' }),
          // Scene bar 1 — full (active)
          r('e15',null,{ x:80,y:1022,width:920,height:5,fill:'#F5C518',cornerRadius:3 }),
          t('e16',null,{ x:80,y:1036,width:540,height:22,text:'Arrival shot',fontFamily:'Inter',fontSize:16,fill:'rgba(255,255,255,0.45)',align:'left',verticalAlign:'middle' }),
          t('e17',null,{ x:620,y:1036,width:380,height:22,text:'0:00 – 0:04',fontFamily:'Inter',fontSize:16,fill:'rgba(255,255,255,0.28)',align:'right',verticalAlign:'middle' }),
          // Scene bar 2
          r('e18',null,{ x:80,y:1068,width:700,height:5,fill:'#F5C518',cornerRadius:3,opacity:0.75 }),
          r('e19',null,{ x:780,y:1068,width:220,height:5,fill:'rgba(255,255,255,0.10)',cornerRadius:3 }),
          t('e20',null,{ x:80,y:1082,width:920,height:22,text:'Old roof — wide shot',fontFamily:'Inter',fontSize:16,fill:'rgba(255,255,255,0.45)',align:'left',verticalAlign:'middle' }),
          // Scene bar 3
          r('e21',null,{ x:80,y:1114,width:440,height:5,fill:'#F5C518',cornerRadius:3,opacity:0.50 }),
          r('e22',null,{ x:524,y:1114,width:476,height:5,fill:'rgba(255,255,255,0.10)',cornerRadius:3 }),
          t('e23',null,{ x:80,y:1128,width:920,height:22,text:'Tear-off timelapse',fontFamily:'Inter',fontSize:16,fill:'rgba(255,255,255,0.45)',align:'left',verticalAlign:'middle' }),
          // Scene bar 4
          r('e24',null,{ x:80,y:1160,width:200,height:5,fill:'#F5C518',cornerRadius:3,opacity:0.28 }),
          r('e25',null,{ x:284,y:1160,width:716,height:5,fill:'rgba(255,255,255,0.10)',cornerRadius:3 }),
          t('e26',null,{ x:80,y:1174,width:920,height:22,text:'New shingles install',fontFamily:'Inter',fontSize:16,fill:'rgba(255,255,255,0.45)',align:'left',verticalAlign:'middle' }),
          // Scene bar 5
          r('e27',null,{ x:80,y:1206,width:80,height:5,fill:'#F5C518',cornerRadius:3,opacity:0.14 }),
          r('e28',null,{ x:164,y:1206,width:836,height:5,fill:'rgba(255,255,255,0.10)',cornerRadius:3 }),
          t('e29',null,{ x:80,y:1220,width:920,height:22,text:'Final reveal + brand card',fontFamily:'Inter',fontSize:16,fill:'rgba(255,255,255,0.45)',align:'left',verticalAlign:'middle' }),
          // Business name + handle
          t('e30',null,{ x:80,y:1290,width:920,height:40,text:'Peak Roofing Co.  ·  @peakroofing',fontFamily:'Inter',fontSize:20,fontStyle:'bold',fill:'rgba(255,255,255,0.55)',align:'right',verticalAlign:'middle' }),
        ]) },

      { name: 'Roofing — Financing Available', industry: 'roofing', category: 'promotional', sort_order: 208,
        canvas_json: mkPage('#0F2027', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#0F2027' }),
          // Subtle bg gradient variation
          r('e2',null,{ x:0,y:0,width:1080,height:700,fill:'#203A43',opacity:0.50 }),
          // Green glow (large faint ellipse top-right)
          r('e3',null,{ x:600,y:-100,width:700,height:700,fill:'#43EA80',opacity:0.04,cornerRadius:350 }),
          // Ghost "FREE" watermark
          t('e4',null,{ x:-80,y:20,width:1200,height:460,text:'FREE',fontFamily:'Inter',fontSize:370,fontStyle:'bold',fill:'rgba(67,234,128,0.04)',align:'left',verticalAlign:'middle' }),
          // Financing badge
          r('e5',null,{ x:80,y:80,width:480,height:60,fill:'rgba(67,234,128,0.10)',cornerRadius:30 }),
          t('e6',null,{ x:80,y:80,width:480,height:60,text:'💳  FINANCING AVAILABLE',fontFamily:'Inter',fontSize:20,fontStyle:'bold',fill:'#43EA80',align:'center',verticalAlign:'middle' }),
          // Headline stacked
          t('e7',null,{ x:80,y:192,width:920,height:118,text:'A NEW ROOF',fontFamily:'Inter',fontSize:100,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e8',null,{ x:80,y:308,width:920,height:118,text:'WITHOUT THE',fontFamily:'Inter',fontSize:100,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e9',null,{ x:80,y:424,width:920,height:118,text:'STICKER SHOCK.',fontFamily:'Inter',fontSize:100,fontStyle:'bold',fill:'#43EA80',align:'left',verticalAlign:'middle' }),
          // Body copy
          t('e10',null,{ x:80,y:572,width:920,height:160,text:'We offer flexible financing for [City] homeowners so you can stop patching and start protecting your family. Approved on credit — ask us today.',fontFamily:'Inter',fontSize:26,fill:'rgba(255,255,255,0.65)',align:'left',verticalAlign:'top',lineHeight:1.55 }),
          // Offer label
          t('e11',null,{ x:80,y:764,width:920,height:36,text:'CURRENT OFFER',fontFamily:'Inter',fontSize:15,fontStyle:'bold',fill:'rgba(67,234,128,0.70)',align:'left',verticalAlign:'middle' }),
          // Big offer text
          t('e12',null,{ x:80,y:800,width:920,height:92,text:'0% interest for 18 months',fontFamily:'Inter',fontSize:64,fontStyle:'bold',fill:'#43EA80',align:'left',verticalAlign:'middle' }),
          // Terms
          t('e13',null,{ x:80,y:904,width:920,height:62,text:'On approved credit. Full replacements over $3,000. [City] residents.',fontFamily:'Inter',fontSize:21,fill:'rgba(255,255,255,0.42)',align:'left',verticalAlign:'top',lineHeight:1.4 }),
          // Divider
          r('e14',null,{ x:80,y:978,width:920,height:1,fill:'#43EA80',opacity:0.18 }),
          // Phone button (dark glass)
          r('e15',null,{ x:80,y:1012,width:920,height:118,fill:'rgba(255,255,255,0.08)',cornerRadius:16 }),
          t('e16',null,{ x:80,y:1012,width:920,height:118,text:'(555) 000-0000',fontFamily:'Inter',fontSize:74,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          // Sub label
          t('e17',null,{ x:80,y:1158,width:920,height:44,text:'Ask about financing — [City] residents',fontFamily:'Inter',fontSize:24,fill:'rgba(67,234,128,0.55)',align:'center',verticalAlign:'middle' }),
          // Footer
          r('e18',null,{ x:80,y:1244,width:920,height:1,fill:'#ffffff',opacity:0.08 }),
          t('e19',null,{ x:80,y:1266,width:920,height:52,text:'Business Name  ·  [City]',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.32)',align:'left',verticalAlign:'middle' }),
        ]) },

      // ── PLUMBING batch 1 ─────────────────────────────────────────────────────

      { name: 'Plumbing — Emergency Burst Pipe', industry: 'plumbing', category: 'promotional', sort_order: 210,
        canvas_json: mkPage('#0B2545', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#0B2545' }),
          // Orange left brand stripe — hazard signal + identity
          r('e2',null,{ x:0,y:0,width:14,height:1350,fill:'#F4A722' }),
          // Danger red top strip
          r('e3',null,{ x:0,y:0,width:1080,height:6,fill:'#C0392B' }),
          // 🚨 Large emergency icon — scroll-stopper
          t('e4',null,{ x:80,y:68,width:920,height:168,text:'🚨',fontFamily:'Inter',fontSize:138,fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          // Red emergency badge — immediately signals urgency before reading
          r('e5',null,{ x:160,y:256,width:760,height:60,fill:'#C0392B',cornerRadius:6 }),
          t('e6',null,{ x:160,y:256,width:760,height:60,text:'⚠️  EMERGENCY SERVICE  ⚠️',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          // Giant stacked headline — pattern interrupt at every scroll speed
          t('e7',null,{ x:80,y:336,width:920,height:196,text:'BURST',fontFamily:'Inter',fontSize:174,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e8',null,{ x:80,y:530,width:920,height:196,text:'PIPE?',fontFamily:'Inter',fontSize:174,fontStyle:'bold',fill:'#F4A722',align:'center',verticalAlign:'middle' }),
          // Reassuring sub — emotional relief after the fear hook
          t('e9',null,{ x:80,y:734,width:920,height:60,text:'We\'re on our way. Right now.',fontFamily:'Inter',fontSize:40,fill:'rgba(255,255,255,0.85)',align:'center',verticalAlign:'middle' }),
          // Speed row — addresses the 3 key objections in one line
          t('e10',null,{ x:80,y:806,width:920,height:46,text:'Same-day  ·  24/7  ·  No extra charge',fontFamily:'Inter',fontSize:26,fontStyle:'bold',fill:'#F4A722',align:'center',verticalAlign:'middle',opacity:0.80 }),
          // Accent divider
          r('e11',null,{ x:240,y:878,width:600,height:2,fill:'#F4A722',opacity:0.35 }),
          // Full-width phone CTA button — the ONLY action that matters
          r('e12',null,{ x:80,y:906,width:920,height:120,fill:'#F4A722',cornerRadius:16 }),
          t('e13',null,{ x:80,y:906,width:920,height:120,text:'(555) 000-0000',fontFamily:'Inter',fontSize:74,fontStyle:'bold',fill:'#0B2545',align:'center',verticalAlign:'middle' }),
          // CTA sub-label
          t('e14',null,{ x:80,y:1044,width:920,height:46,text:'Call or text — we answer 24 hours',fontFamily:'Inter',fontSize:26,fill:'rgba(232,244,253,0.60)',align:'center',verticalAlign:'middle' }),
          // Trust row — final objection removal
          t('e15',null,{ x:80,y:1198,width:920,height:40,text:'Licensed  ·  Insured  ·  Background-checked',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.38)',align:'center',verticalAlign:'middle' }),
          // Footer
          r('e16',null,{ x:80,y:1292,width:920,height:1,fill:'#ffffff',opacity:0.08 }),
          t('e17',null,{ x:200,y:1308,width:760,height:32,text:'Joe\'s Plumbing  ·  Austin, TX',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.30)',align:'left',verticalAlign:'middle' }),
        ]) },

      { name: 'Plumbing — Meet the Plumber', industry: 'plumbing', category: 'team', sort_order: 211,
        canvas_json: mkPage('#0D1F38', [
          // ── Photo zone ──────────────────────────────────────────────────────
          r('e1',null,{ x:0,y:0,width:1080,height:780,fill:'#071223' }),
          r('e2',null,{ x:0,y:0,width:1080,height:780,fill:'#000000',opacity:0.28 }),
          t('e3',null,{ x:80,y:290,width:920,height:200,text:'📸  Add your photo here\n1080 × 780 px',fontFamily:'Inter',fontSize:30,fill:'rgba(255,255,255,0.12)',align:'center',verticalAlign:'middle',lineHeight:1.6 }),
          // gradient fade
          r('e4',null,{ x:0,y:580,width:1080,height:120,fill:'#0D1F38',opacity:0.55 }),
          r('e5',null,{ x:0,y:700,width:1080,height:80,fill:'#0D1F38',opacity:0.90 }),
          // ── Info panel ──────────────────────────────────────────────────────
          r('e6',null,{ x:0,y:780,width:1080,height:570,fill:'#0D1F38' }),
          // Name tag pill (orange — plumbing brand colour)
          r('e7',null,{ x:80,y:720,width:560,height:62,fill:'#F4A722',cornerRadius:10 }),
          t('e8',null,{ x:80,y:720,width:560,height:62,text:'Joe Martinez  ·  Master Plumber',fontFamily:'Inter',fontSize:24,fontStyle:'bold',fill:'#0D1F38',align:'center',verticalAlign:'middle' }),
          // Headline
          t('e9',null,{ x:80,y:828,width:920,height:68,text:'The person fixing',fontFamily:'Inter',fontSize:54,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e10',null,{ x:80,y:894,width:920,height:68,text:'your plumbing. 🔧',fontFamily:'Inter',fontSize:54,fontStyle:'bold',fill:'#F4A722',align:'left',verticalAlign:'middle' }),
          // Stats bar
          r('e11',null,{ x:80,y:994,width:920,height:108,fill:'rgba(255,255,255,0.05)',cornerRadius:12 }),
          t('e12',null,{ x:80,y:1008,width:280,height:54,text:'18+',fontFamily:'Inter',fontSize:44,fontStyle:'bold',fill:'#F4A722',align:'center',verticalAlign:'middle' }),
          t('e13',null,{ x:80,y:1064,width:280,height:28,text:'Years',fontFamily:'Inter',fontSize:17,fill:'rgba(255,255,255,0.42)',align:'center',verticalAlign:'middle' }),
          r('e14',null,{ x:372,y:1012,width:1,height:88,fill:'#ffffff',opacity:0.10 }),
          t('e15',null,{ x:400,y:1008,width:280,height:54,text:'2,400+',fontFamily:'Inter',fontSize:44,fontStyle:'bold',fill:'#F4A722',align:'center',verticalAlign:'middle' }),
          t('e16',null,{ x:400,y:1064,width:280,height:28,text:'Jobs Done',fontFamily:'Inter',fontSize:17,fill:'rgba(255,255,255,0.42)',align:'center',verticalAlign:'middle' }),
          r('e17',null,{ x:694,y:1012,width:1,height:88,fill:'#ffffff',opacity:0.10 }),
          t('e18',null,{ x:720,y:1008,width:280,height:54,text:'5.0 ⭐',fontFamily:'Inter',fontSize:44,fontStyle:'bold',fill:'#F4A722',align:'center',verticalAlign:'middle' }),
          t('e19',null,{ x:720,y:1064,width:280,height:28,text:'Rating',fontFamily:'Inter',fontSize:17,fill:'rgba(255,255,255,0.42)',align:'center',verticalAlign:'middle' }),
          // Bio
          t('e20',null,{ x:80,y:1146,width:920,height:72,text:'Licensed master plumber for 18 years. From burst pipes at 2am to full bathroom remodels — I show up and I fix it right.',fontFamily:'Inter',fontSize:24,fill:'#F4A722',align:'left',verticalAlign:'top',lineHeight:1.5,opacity:0.85 }),
          // Footer
          r('e21',null,{ x:80,y:1238,width:920,height:1,fill:'#ffffff',opacity:0.10 }),
          t('e22',null,{ x:80,y:1258,width:680,height:42,text:'Business Name  ·  Licensed & Insured',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.40)',align:'left',verticalAlign:'middle' }),
          t('e23',null,{ x:800,y:1258,width:200,height:42,text:'[City]',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.22)',align:'right',verticalAlign:'middle' }),
        ]) },

      { name: 'Plumbing — Hard Water Warning Signs', industry: 'plumbing', category: 'educational', sort_order: 212,
        canvas_json: mkPage('#13243A', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#13243A' }),
          r('e2',null,{ x:0,y:0,width:1080,height:10,fill:'#2ECC71' }),
          // Ghost "H2O" watermark
          t('e3',null,{ x:-40,y:80,width:1160,height:400,text:'H₂O',fontFamily:'Inter',fontSize:340,fontStyle:'bold',fill:'rgba(46,204,113,0.04)',align:'left',verticalAlign:'middle' }),
          // Headline stack
          t('e4',null,{ x:80,y:144,width:920,height:108,text:'IS YOUR',fontFamily:'Inter',fontSize:92,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e5',null,{ x:80,y:250,width:920,height:108,text:'WATER HARD?',fontFamily:'Inter',fontSize:92,fontStyle:'bold',fill:'#2ECC71',align:'left',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:378,width:920,height:52,text:'4 signs every [City] homeowner should know',fontFamily:'Inter',fontSize:28,fill:'rgba(255,255,255,0.55)',align:'left',verticalAlign:'middle' }),
          // Divider
          r('e7',null,{ x:80,y:454,width:920,height:1,fill:'rgba(46,204,113,0.22)' }),
          // Sign 1
          r('e8',null,{ x:80,y:476,width:56,height:56,fill:'rgba(46,204,113,0.16)',cornerRadius:28 }),
          t('e9',null,{ x:80,y:476,width:56,height:56,text:'1',fontFamily:'Inter',fontSize:24,fontStyle:'bold',fill:'#2ECC71',align:'center',verticalAlign:'middle' }),
          t('e10',null,{ x:152,y:476,width:848,height:56,text:'Chalky white residue on taps and showers',fontFamily:'Inter',fontSize:26,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          // Sign 2
          r('e11',null,{ x:80,y:556,width:56,height:56,fill:'rgba(46,204,113,0.16)',cornerRadius:28 }),
          t('e12',null,{ x:80,y:556,width:56,height:56,text:'2',fontFamily:'Inter',fontSize:24,fontStyle:'bold',fill:'#2ECC71',align:'center',verticalAlign:'middle' }),
          t('e13',null,{ x:152,y:556,width:848,height:56,text:'Water heater making popping or banging sounds',fontFamily:'Inter',fontSize:26,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          // Sign 3
          r('e14',null,{ x:80,y:636,width:56,height:56,fill:'rgba(46,204,113,0.16)',cornerRadius:28 }),
          t('e15',null,{ x:80,y:636,width:56,height:56,text:'3',fontFamily:'Inter',fontSize:24,fontStyle:'bold',fill:'#2ECC71',align:'center',verticalAlign:'middle' }),
          t('e16',null,{ x:152,y:636,width:848,height:56,text:'Dry skin and hair — even after a long shower',fontFamily:'Inter',fontSize:26,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          // Sign 4
          r('e17',null,{ x:80,y:716,width:56,height:56,fill:'rgba(46,204,113,0.16)',cornerRadius:28 }),
          t('e18',null,{ x:80,y:716,width:56,height:56,text:'4',fontFamily:'Inter',fontSize:24,fontStyle:'bold',fill:'#2ECC71',align:'center',verticalAlign:'middle' }),
          t('e19',null,{ x:152,y:716,width:848,height:56,text:'Pipes clogging faster than they should',fontFamily:'Inter',fontSize:26,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          // Divider
          r('e20',null,{ x:80,y:800,width:920,height:1,fill:'rgba(46,204,113,0.16)' }),
          // Offer banner
          r('e21',null,{ x:80,y:834,width:920,height:110,fill:'rgba(46,204,113,0.10)',cornerRadius:14 }),
          t('e22',null,{ x:80,y:846,width:920,height:48,text:'Free water quality test — [City] homes',fontFamily:'Inter',fontSize:28,fontStyle:'bold',fill:'#2ECC71',align:'center',verticalAlign:'middle' }),
          t('e23',null,{ x:80,y:896,width:920,height:38,text:'We check hardness, pH, and mineral levels at no cost',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.42)',align:'center',verticalAlign:'middle' }),
          // Phone CTA
          r('e24',null,{ x:80,y:982,width:920,height:116,fill:'#2ECC71',cornerRadius:16 }),
          t('e25',null,{ x:80,y:982,width:920,height:116,text:'(555) 000-0000',fontFamily:'Inter',fontSize:72,fontStyle:'bold',fill:'#13243A',align:'center',verticalAlign:'middle' }),
          t('e26',null,{ x:80,y:1116,width:920,height:44,text:'Call to book your free water test',fontFamily:'Inter',fontSize:24,fill:'rgba(255,255,255,0.40)',align:'center',verticalAlign:'middle' }),
          // Footer
          r('e27',null,{ x:80,y:1270,width:920,height:1,fill:'#ffffff',opacity:0.08 }),
          t('e28',null,{ x:80,y:1290,width:920,height:48,text:'Business Name  ·  [City]  ·  Licensed & Insured',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.28)',align:'left',verticalAlign:'middle' }),
        ]) },

      { name: 'Plumbing — 5 Signs of a Hidden Leak', industry: 'plumbing', category: 'educational', sort_order: 213,
        canvas_json: mkPage('#1A0A0A', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#1A0A0A' }),
          r('e2',null,{ x:0,y:0,width:1080,height:10,fill:'#E74C3C' }),
          // Giant headline stacked
          t('e3',null,{ x:80,y:108,width:920,height:148,text:'5 SIGNS',fontFamily:'Inter',fontSize:126,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e4',null,{ x:80,y:254,width:920,height:148,text:'OF A',fontFamily:'Inter',fontSize:126,fontStyle:'bold',fill:'rgba(255,255,255,0.70)',align:'center',verticalAlign:'middle' }),
          t('e5',null,{ x:80,y:400,width:920,height:148,text:'HIDDEN',fontFamily:'Inter',fontSize:126,fontStyle:'bold',fill:'#E74C3C',align:'center',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:542,width:920,height:80,text:'WATER LEAK 💧',fontFamily:'Inter',fontSize:62,fontStyle:'bold',fill:'rgba(236,240,241,0.86)',align:'center',verticalAlign:'middle' }),
          // Divider
          r('e7',null,{ x:80,y:688,width:920,height:3,fill:'rgba(231,76,60,0.28)',cornerRadius:2 }),
          // Signs list
          t('e8',null,{ x:80,y:714,width:920,height:48,text:'💸  Your water bill jumped for no reason',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.50)',align:'center',verticalAlign:'middle' }),
          t('e9',null,{ x:80,y:770,width:920,height:48,text:'🤢  Musty smell near walls or under floors',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.50)',align:'center',verticalAlign:'middle' }),
          t('e10',null,{ x:80,y:826,width:920,height:48,text:'🎨  Staining, peeling, or bubbling on walls',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.50)',align:'center',verticalAlign:'middle' }),
          t('e11',null,{ x:80,y:882,width:920,height:48,text:'📉  Low water pressure that appeared suddenly',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.50)',align:'center',verticalAlign:'middle' }),
          t('e12',null,{ x:80,y:938,width:920,height:48,text:'🌿  Wet patches or lush patches in your yard',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.50)',align:'center',verticalAlign:'middle' }),
          // CTA button
          r('e13',null,{ x:180,y:1048,width:720,height:68,fill:'#E74C3C',cornerRadius:34 }),
          t('e14',null,{ x:180,y:1048,width:720,height:68,text:'Free leak detection — (555) 000-0000',fontFamily:'Inter',fontSize:24,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e15',null,{ x:80,y:1154,width:920,height:44,text:'Catch it early — before it becomes a $10,000 problem',fontFamily:'Inter',fontSize:22,fill:'rgba(231,76,60,0.65)',align:'center',verticalAlign:'middle' }),
          // Footer
          r('e16',null,{ x:80,y:1258,width:920,height:1,fill:'rgba(255,255,255,0.08)' }),
          t('e17',null,{ x:80,y:1280,width:920,height:42,text:'Business Name  ·  [City]  ·  Licensed & Insured',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.26)',align:'center',verticalAlign:'middle' }),
        ]) },

      { name: 'Plumbing — Google Review Ask', industry: 'plumbing', category: 'social-proof', sort_order: 214,
        canvas_json: mkPage('#0A1628', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#0A1628' }),
          // Radial glow (faint blue behind stars)
          r('e2',null,{ x:190,y:280,width:700,height:700,fill:'#4285F4',opacity:0.05,cornerRadius:350 }),
          // Decorative oversized "G" letterform
          t('e3',null,{ x:180,y:40,width:720,height:800,text:'G',fontFamily:'Inter',fontSize:760,fontStyle:'bold',fill:'rgba(66,133,244,0.05)',align:'center',verticalAlign:'top' }),
          // 5 gold stars
          t('e4',null,{ x:80,y:200,width:920,height:100,text:'⭐⭐⭐⭐⭐',fontFamily:'Inter',fontSize:76,fill:'#FBBC04',align:'center',verticalAlign:'middle' }),
          // Headline
          t('e5',null,{ x:80,y:360,width:920,height:108,text:'Did we fix it',fontFamily:'Inter',fontSize:88,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:466,width:920,height:108,text:'for you? 🔧',fontFamily:'Inter',fontSize:88,fontStyle:'bold',fill:'#FBBC04',align:'center',verticalAlign:'middle' }),
          // Short gold accent divider
          r('e7',null,{ x:440,y:618,width:200,height:2,fill:'#FBBC04',opacity:0.32 }),
          // Body copy
          t('e8',null,{ x:80,y:660,width:920,height:52,text:'Your review helps [City] homeowners',fontFamily:'Inter',fontSize:35,fill:'#FBBC04',align:'center',verticalAlign:'middle',opacity:0.90 }),
          t('e9',null,{ x:80,y:714,width:920,height:52,text:'find a plumber they can actually trust.',fontFamily:'Inter',fontSize:35,fill:'#FBBC04',align:'center',verticalAlign:'middle',opacity:0.90 }),
          t('e10',null,{ x:80,y:810,width:920,height:50,text:'It takes 60 seconds — and it means everything to us.',fontFamily:'Inter',fontSize:26,fill:'rgba(255,255,255,0.42)',align:'center',verticalAlign:'middle' }),
          t('e11',null,{ x:80,y:878,width:920,height:44,text:'We recently completed: your plumbing repair.',fontFamily:'Inter',fontSize:23,fill:'rgba(255,255,255,0.28)',align:'center',verticalAlign:'middle' }),
          // Google blue CTA button (rounded pill)
          r('e12',null,{ x:80,y:966,width:920,height:120,fill:'#4285F4',cornerRadius:60 }),
          t('e13',null,{ x:80,y:966,width:920,height:120,text:'Leave a Google Review →',fontFamily:'Inter',fontSize:38,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          // Link note
          t('e14',null,{ x:80,y:1126,width:920,height:44,text:'Link in bio  ·  Takes 60 seconds',fontFamily:'Inter',fontSize:24,fill:'rgba(255,255,255,0.28)',align:'center',verticalAlign:'middle' }),
          // Footer
          r('e15',null,{ x:80,y:1238,width:920,height:1,fill:'#ffffff',opacity:0.08 }),
          t('e16',null,{ x:80,y:1260,width:920,height:52,text:'Business Name  ·  [City]  ·  Licensed & Insured',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.35)',align:'left',verticalAlign:'middle' }),
        ]) },

      { name: 'Roofing — Google Review Ask', industry: 'roofing', category: 'social-proof', sort_order: 209,
        canvas_json: mkPage('#1B2838', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#1B2838' }),
          // Radial glow (large faint circle centred behind stars/headline)
          r('e2',null,{ x:190,y:320,width:700,height:700,fill:'#4285F4',opacity:0.05,cornerRadius:350 }),
          // Decorative oversized "G" letterform (recognition without using Google's logo)
          t('e3',null,{ x:180,y:40,width:720,height:800,text:'G',fontFamily:'Inter',fontSize:760,fontStyle:'bold',fill:'rgba(66,133,244,0.05)',align:'center',verticalAlign:'top' }),
          // 5 gold stars
          t('e4',null,{ x:80,y:224,width:920,height:100,text:'⭐⭐⭐⭐⭐',fontFamily:'Inter',fontSize:76,fill:'#FBBC04',align:'center',verticalAlign:'middle' }),
          // Headline
          t('e5',null,{ x:80,y:386,width:920,height:108,text:'Did we do',fontFamily:'Inter',fontSize:88,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:492,width:920,height:108,text:'a great job?',fontFamily:'Inter',fontSize:88,fontStyle:'bold',fill:'#FBBC04',align:'center',verticalAlign:'middle' }),
          // Short gold accent divider
          r('e7',null,{ x:440,y:644,width:200,height:2,fill:'#FBBC04',opacity:0.32 }),
          // Body copy — warm, human, not pushy
          t('e8',null,{ x:80,y:686,width:920,height:52,text:'Your review helps [City] families',fontFamily:'Inter',fontSize:35,fill:'#FBBC04',align:'center',verticalAlign:'middle',opacity:0.90 }),
          t('e9',null,{ x:80,y:740,width:920,height:52,text:'find a roofer they can actually trust.',fontFamily:'Inter',fontSize:35,fill:'#FBBC04',align:'center',verticalAlign:'middle',opacity:0.90 }),
          t('e10',null,{ x:80,y:832,width:920,height:50,text:'It takes 60 seconds — and it means everything to us.',fontFamily:'Inter',fontSize:26,fill:'rgba(255,255,255,0.42)',align:'center',verticalAlign:'middle' }),
          t('e11',null,{ x:80,y:900,width:920,height:44,text:'We recently completed: your full roof replacement.',fontFamily:'Inter',fontSize:23,fill:'rgba(255,255,255,0.30)',align:'center',verticalAlign:'middle' }),
          // Google blue CTA button (rounded pill)
          r('e12',null,{ x:80,y:988,width:920,height:120,fill:'#4285F4',cornerRadius:60 }),
          t('e13',null,{ x:80,y:988,width:920,height:120,text:'Leave a Google Review →',fontFamily:'Inter',fontSize:38,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          // Link note below button
          t('e14',null,{ x:80,y:1142,width:920,height:44,text:'Link in bio  ·  Takes 60 seconds',fontFamily:'Inter',fontSize:24,fill:'rgba(255,255,255,0.30)',align:'center',verticalAlign:'middle' }),
          // Footer
          r('e15',null,{ x:80,y:1238,width:920,height:1,fill:'#ffffff',opacity:0.08 }),
          t('e16',null,{ x:80,y:1260,width:920,height:52,text:'Business Name  ·  Licensed & Insured',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.35)',align:'left',verticalAlign:'middle' }),
        ]) },

      // ── HVAC ─────────────────────────────────────────────────────────────────

      { name: 'HVAC — AC Tune-Up Summer Special', industry: 'hvac', category: 'seasonal', sort_order: 300,
        canvas_json: mkPage('#0A1628', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#0A1628' }),
          // Cool blue top bar
          r('e2',null,{ x:0,y:0,width:1080,height:10,fill:'#00AEEF' }),
          // Ghost snowflake watermark
          t('e3',null,{ x:-80,y:60,width:1200,height:500,text:'❄',fontFamily:'Inter',fontSize:540,fill:'rgba(0,174,239,0.04)',align:'left',verticalAlign:'middle' }),
          // Season badge
          r('e4',null,{ x:80,y:80,width:360,height:56,fill:'rgba(0,174,239,0.14)',cornerRadius:28 }),
          t('e5',null,{ x:80,y:80,width:360,height:56,text:'❄  SUMMER SPECIAL',fontFamily:'Inter',fontSize:19,fontStyle:'bold',fill:'#00AEEF',align:'center',verticalAlign:'middle' }),
          // Giant stacked headline
          t('e6',null,{ x:80,y:182,width:920,height:128,text:'AC TUNE-UP',fontFamily:'Inter',fontSize:108,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e7',null,{ x:80,y:308,width:920,height:128,text:'BEFORE THE',fontFamily:'Inter',fontSize:108,fontStyle:'bold',fill:'rgba(255,255,255,0.60)',align:'left',verticalAlign:'middle' }),
          t('e8',null,{ x:80,y:434,width:920,height:128,text:'HEAT HITS.',fontFamily:'Inter',fontSize:108,fontStyle:'bold',fill:'#00AEEF',align:'left',verticalAlign:'middle' }),
          // Body copy
          t('e9',null,{ x:80,y:592,width:920,height:130,text:'A $99 tune-up now prevents a $2,000 breakdown in July. Keep your family cool all summer — book while slots last.',fontFamily:'Inter',fontSize:27,fill:'rgba(255,255,255,0.62)',align:'left',verticalAlign:'top',lineHeight:1.55 }),
          // Checklist
          t('e10',null,{ x:80,y:756,width:920,height:40,text:'TUNE-UP INCLUDES:',fontFamily:'Inter',fontSize:15,fontStyle:'bold',fill:'rgba(0,174,239,0.70)',align:'left',verticalAlign:'middle' }),
          t('e11',null,{ x:80,y:806,width:920,height:40,text:'✓  Coil cleaning + refrigerant check',fontFamily:'Inter',fontSize:25,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e12',null,{ x:80,y:856,width:920,height:40,text:'✓  Thermostat calibration + filter swap',fontFamily:'Inter',fontSize:25,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e13',null,{ x:80,y:906,width:920,height:40,text:'✓  Full system safety inspection',fontFamily:'Inter',fontSize:25,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          // CTA button
          r('e14',null,{ x:80,y:998,width:920,height:116,fill:'#00AEEF',cornerRadius:16 }),
          t('e15',null,{ x:80,y:998,width:920,height:116,text:'(555) 000-0000',fontFamily:'Inter',fontSize:72,fontStyle:'bold',fill:'#0A1628',align:'center',verticalAlign:'middle' }),
          t('e16',null,{ x:80,y:1132,width:920,height:44,text:'Book your AC tune-up — [City] same week',fontFamily:'Inter',fontSize:24,fill:'rgba(0,174,239,0.60)',align:'center',verticalAlign:'middle' }),
          // Footer
          r('e17',null,{ x:80,y:1262,width:920,height:1,fill:'#ffffff',opacity:0.08 }),
          t('e18',null,{ x:80,y:1282,width:920,height:48,text:'Business Name  ·  [City]  ·  Licensed & Insured',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.28)',align:'left',verticalAlign:'middle' }),
        ]) },

      { name: 'HVAC — Furnace Check Before Winter', industry: 'hvac', category: 'seasonal', sort_order: 301,
        canvas_json: mkPage('#1A0F0A', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#1A0F0A' }),
          // Warm orange top bar
          r('e2',null,{ x:0,y:0,width:1080,height:10,fill:'#FF6B35' }),
          // Ghost flame watermark
          t('e3',null,{ x:100,y:-60,width:880,height:580,text:'🔥',fontFamily:'Inter',fontSize:480,fill:'rgba(255,107,53,0.05)',align:'center',verticalAlign:'middle' }),
          // Urgency badge
          r('e4',null,{ x:80,y:80,width:420,height:56,fill:'rgba(255,107,53,0.14)',cornerRadius:28 }),
          t('e5',null,{ x:80,y:80,width:420,height:56,text:'🔥  DON\'T WAIT UNTIL IT\'S COLD',fontFamily:'Inter',fontSize:17,fontStyle:'bold',fill:'#FF6B35',align:'center',verticalAlign:'middle' }),
          // Headline stacked
          t('e6',null,{ x:80,y:180,width:920,height:118,text:'GET YOUR',fontFamily:'Inter',fontSize:98,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e7',null,{ x:80,y:296,width:920,height:118,text:'FURNACE',fontFamily:'Inter',fontSize:98,fontStyle:'bold',fill:'#FF6B35',align:'left',verticalAlign:'middle' }),
          t('e8',null,{ x:80,y:412,width:920,height:118,text:'READY NOW.',fontFamily:'Inter',fontSize:98,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          // Sub
          t('e9',null,{ x:80,y:558,width:920,height:82,text:'Every year in [City], families wake up to a cold house because they skipped the fall furnace check. Don\'t let that be you.',fontFamily:'Inter',fontSize:26,fill:'rgba(255,255,255,0.58)',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          // What we check
          t('e10',null,{ x:80,y:676,width:920,height:34,text:'WHAT WE CHECK:',fontFamily:'Inter',fontSize:14,fontStyle:'bold',fill:'rgba(255,107,53,0.70)',align:'left',verticalAlign:'middle' }),
          t('e11',null,{ x:80,y:724,width:920,height:40,text:'✓  Heat exchanger for cracks (carbon monoxide risk)',fontFamily:'Inter',fontSize:24,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e12',null,{ x:80,y:776,width:920,height:40,text:'✓  Igniter, burner, and gas pressure',fontFamily:'Inter',fontSize:24,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e13',null,{ x:80,y:828,width:920,height:40,text:'✓  Blower motor + belt + lubrication',fontFamily:'Inter',fontSize:24,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e14',null,{ x:80,y:880,width:920,height:40,text:'✓  Thermostat accuracy check',fontFamily:'Inter',fontSize:24,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          // CTA
          r('e15',null,{ x:80,y:978,width:920,height:114,fill:'#FF6B35',cornerRadius:16 }),
          t('e16',null,{ x:80,y:978,width:920,height:114,text:'(555) 000-0000',fontFamily:'Inter',fontSize:70,fontStyle:'bold',fill:'#1A0F0A',align:'center',verticalAlign:'middle' }),
          t('e17',null,{ x:80,y:1110,width:920,height:44,text:'Book your fall furnace check — [City]',fontFamily:'Inter',fontSize:24,fill:'rgba(255,107,53,0.60)',align:'center',verticalAlign:'middle' }),
          // Footer
          r('e18',null,{ x:80,y:1262,width:920,height:1,fill:'#ffffff',opacity:0.08 }),
          t('e19',null,{ x:80,y:1282,width:920,height:48,text:'Business Name  ·  [City]  ·  Licensed & Insured',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.28)',align:'left',verticalAlign:'middle' }),
        ]) },

      { name: 'HVAC — Before & After Air Quality', industry: 'hvac', category: 'before-after', sort_order: 302,
        canvas_json: mkPage('#141414', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#141414' }),
          r('e2',null,{ x:0,y:0,width:12,height:1350,fill:'#00AEEF' }),
          t('e3',null,{ x:80,y:88,width:840,height:30,text:'REAL JOB  ·  REAL RESULT  ·  [CITY]',fontFamily:'Inter',fontSize:17,fontStyle:'bold',fill:'#00AEEF',align:'left',verticalAlign:'middle' }),
          // Bold split headline
          t('e4',null,{ x:80,y:148,width:920,height:128,text:'DIRTY DUCTS.',fontFamily:'Inter',fontSize:108,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e5',null,{ x:80,y:274,width:920,height:128,text:'CLEAN AIR.',fontFamily:'Inter',fontSize:108,fontStyle:'bold',fill:'#00AEEF',align:'left',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:400,width:920,height:80,text:'SEE THE DIFFERENCE. 🌬',fontFamily:'Inter',fontSize:60,fontStyle:'bold',fill:'rgba(236,240,241,0.86)',align:'left',verticalAlign:'middle' }),
          // Job card
          r('e7',null,{ x:80,y:522,width:920,height:190,fill:'rgba(255,255,255,0.04)',cornerRadius:14 }),
          t('e8',null,{ x:120,y:546,width:840,height:28,text:'THE JOB',fontFamily:'Inter',fontSize:14,fontStyle:'bold',fill:'#00AEEF',align:'left',verticalAlign:'middle' }),
          t('e9',null,{ x:120,y:582,width:840,height:68,text:'Full duct cleaning + air handler service',fontFamily:'Inter',fontSize:38,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e10',null,{ x:120,y:664,width:240,height:34,text:'3 hr job',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.50)',align:'left',verticalAlign:'middle' }),
          t('e11',null,{ x:380,y:664,width:260,height:34,text:'Before photos',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.50)',align:'left',verticalAlign:'middle' }),
          t('e12',null,{ x:660,y:664,width:280,height:34,text:'★ 5.0 rated',fontFamily:'Inter',fontSize:22,fill:'#00AEEF',align:'left',verticalAlign:'middle' }),
          // Photo placeholder
          r('e13',null,{ x:80,y:760,width:920,height:200,fill:'rgba(255,255,255,0.03)',cornerRadius:10 }),
          t('e14',null,{ x:80,y:760,width:920,height:200,text:'📸  Add your before & after\nduct / filter photos here',fontFamily:'Inter',fontSize:30,fill:'rgba(255,255,255,0.10)',align:'center',verticalAlign:'middle',lineHeight:1.5 }),
          // Swipe CTA pill
          r('e15',null,{ x:80,y:1006,width:720,height:66,fill:'#00AEEF',cornerRadius:33 }),
          t('e16',null,{ x:80,y:1006,width:720,height:66,text:'Swipe to see the full clean →',fontFamily:'Inter',fontSize:24,fontStyle:'bold',fill:'#141414',align:'center',verticalAlign:'middle' }),
          // Trust line
          t('e17',null,{ x:80,y:1114,width:920,height:44,text:'The average home has 6 lbs of dust in its ducts. 😬',fontFamily:'Inter',fontSize:24,fill:'rgba(0,174,239,0.65)',align:'center',verticalAlign:'middle' }),
          // Footer
          r('e18',null,{ x:80,y:1260,width:920,height:1,fill:'rgba(255,255,255,0.08)' }),
          t('e19',null,{ x:80,y:1282,width:920,height:46,text:'Business Name  •  [City]  •  (555) 000-0000',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.28)',align:'left',verticalAlign:'middle' }),
        ]) },

      { name: 'HVAC — 5-Star Customer Review', industry: 'hvac', category: 'social-proof', sort_order: 303,
        canvas_json: mkPage('#0C1A2E', [
          r('e1',null,{ x:0,y:0,width:1080,height:900,fill:'#0C1A2E' }),
          r('e2',null,{ x:0,y:900,width:1080,height:450,fill:'#071022' }),
          r('e3',null,{ x:0,y:0,width:1080,height:8,fill:'#00AEEF' }),
          // Giant opening quote
          t('e4',null,{ x:60,y:52,width:240,height:220,text:'"',fontFamily:'Inter',fontSize:220,fontStyle:'bold',fill:'rgba(0,174,239,0.08)',align:'left',verticalAlign:'top' }),
          t('e5',null,{ x:80,y:136,width:920,height:70,text:'★★★★★',fontFamily:'Inter',fontSize:54,fill:'#00AEEF',align:'left',verticalAlign:'middle' }),
          r('e6',null,{ x:80,y:226,width:210,height:44,fill:'rgba(0,174,239,0.16)',cornerRadius:22 }),
          t('e7',null,{ x:80,y:226,width:210,height:44,text:'Google Review',fontFamily:'Inter',fontSize:15,fontStyle:'bold',fill:'#00AEEF',align:'center',verticalAlign:'middle' }),
          // Review body
          t('e8',null,{ x:80,y:288,width:920,height:560,text:'"Replace with your best customer review. The strongest HVAC reviews mention the temperature problem, how fast you came, and how comfortable the home feels now. Real words convert best."',fontFamily:'Inter',fontSize:38,fill:'#ffffff',align:'left',verticalAlign:'top',lineHeight:1.55 }),
          // Reviewer section
          r('e9',null,{ x:0,y:900,width:1080,height:1,fill:'rgba(0,174,239,0.16)' }),
          r('e10',null,{ x:80,y:936,width:88,height:88,fill:'#00AEEF',cornerRadius:44 }),
          t('e11',null,{ x:80,y:936,width:88,height:88,text:'SM',fontFamily:'Inter',fontSize:30,fontStyle:'bold',fill:'#0C1A2E',align:'center',verticalAlign:'middle' }),
          t('e12',null,{ x:188,y:948,width:700,height:38,text:'Sarah M.',fontFamily:'Inter',fontSize:27,fontStyle:'bold',fill:'#00AEEF',align:'left',verticalAlign:'middle' }),
          t('e13',null,{ x:188,y:994,width:700,height:34,text:'[City]  ·  AC Replacement',fontFamily:'Inter',fontSize:21,fill:'rgba(255,255,255,0.40)',align:'left',verticalAlign:'middle' }),
          r('e14',null,{ x:80,y:1058,width:80,height:3,fill:'#00AEEF',cornerRadius:2 }),
          t('e15',null,{ x:80,y:1080,width:920,height:44,text:'24/7 emergency service — we\'re never far.',fontFamily:'Inter',fontSize:24,fill:'#00AEEF',align:'left',verticalAlign:'middle' }),
          // Footer
          r('e16',null,{ x:80,y:1200,width:920,height:1,fill:'rgba(255,255,255,0.06)' }),
          t('e17',null,{ x:80,y:1222,width:920,height:42,text:'Business Name  ·  [City]',fontFamily:'Inter',fontSize:22,fill:'rgba(0,174,239,0.55)',align:'left',verticalAlign:'middle' }),
          t('e18',null,{ x:80,y:1280,width:920,height:42,text:'(555) 000-0000  ·  Licensed & Insured',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.22)',align:'left',verticalAlign:'middle' }),
        ]) },

      { name: 'HVAC — 5 Warning Signs Your AC Is Failing', industry: 'hvac', category: 'educational', sort_order: 304,
        canvas_json: mkPage('#0F1923', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#0F1923' }),
          r('e2',null,{ x:0,y:0,width:1080,height:10,fill:'#00AEEF' }),
          // Stacked headline
          t('e3',null,{ x:80,y:108,width:920,height:148,text:'5 SIGNS',fontFamily:'Inter',fontSize:126,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e4',null,{ x:80,y:254,width:920,height:148,text:'YOUR AC',fontFamily:'Inter',fontSize:126,fontStyle:'bold',fill:'#00AEEF',align:'center',verticalAlign:'middle' }),
          t('e5',null,{ x:80,y:400,width:920,height:148,text:'IS CRYING',fontFamily:'Inter',fontSize:126,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:542,width:920,height:80,text:'FOR HELP. 🌡',fontFamily:'Inter',fontSize:62,fontStyle:'bold',fill:'rgba(236,240,241,0.86)',align:'center',verticalAlign:'middle' }),
          r('e7',null,{ x:80,y:694,width:920,height:3,fill:'rgba(0,174,239,0.22)',cornerRadius:2 }),
          // Warning signs
          t('e8',null,{ x:80,y:720,width:920,height:48,text:'🌬  Weak airflow from vents',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.50)',align:'center',verticalAlign:'middle' }),
          t('e9',null,{ x:80,y:776,width:920,height:48,text:'💧  Moisture or pooling water near the unit',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.50)',align:'center',verticalAlign:'middle' }),
          t('e10',null,{ x:80,y:832,width:920,height:48,text:'🔊  Banging, hissing, or clicking noises',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.50)',align:'center',verticalAlign:'middle' }),
          t('e11',null,{ x:80,y:888,width:920,height:48,text:'📈  Energy bill jumped for no reason',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.50)',align:'center',verticalAlign:'middle' }),
          t('e12',null,{ x:80,y:944,width:920,height:48,text:'🌡  Room never reaches set temperature',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.50)',align:'center',verticalAlign:'middle' }),
          // CTA pill
          r('e13',null,{ x:180,y:1048,width:720,height:66,fill:'#00AEEF',cornerRadius:33 }),
          t('e14',null,{ x:180,y:1048,width:720,height:66,text:'Free diagnostic — call (555) 000-0000',fontFamily:'Inter',fontSize:23,fontStyle:'bold',fill:'#0F1923',align:'center',verticalAlign:'middle' }),
          t('e15',null,{ x:80,y:1152,width:920,height:44,text:'Catch it early — before you need a full replacement',fontFamily:'Inter',fontSize:22,fill:'rgba(0,174,239,0.60)',align:'center',verticalAlign:'middle' }),
          // Footer
          r('e16',null,{ x:80,y:1260,width:920,height:1,fill:'rgba(255,255,255,0.08)' }),
          t('e17',null,{ x:80,y:1282,width:920,height:42,text:'Business Name  ·  [City]  ·  Licensed & Insured',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.26)',align:'center',verticalAlign:'middle' }),
        ]) },

      { name: 'HVAC — How Often to Change Your Filter', industry: 'hvac', category: 'educational', sort_order: 305,
        canvas_json: mkPage('#122233', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#122233' }),
          r('e2',null,{ x:0,y:0,width:1080,height:10,fill:'#00AEEF' }),
          // Hook headline
          t('e3',null,{ x:80,y:90,width:920,height:60,text:'THE #1 THING HOMEOWNERS FORGET',fontFamily:'Inter',fontSize:28,fontStyle:'bold',fill:'#00AEEF',align:'center',verticalAlign:'middle' }),
          t('e4',null,{ x:80,y:170,width:920,height:160,text:'CHANGE YOUR',fontFamily:'Inter',fontSize:132,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e5',null,{ x:80,y:326,width:920,height:160,text:'AIR FILTER.',fontFamily:'Inter',fontSize:132,fontStyle:'bold',fill:'#00AEEF',align:'center',verticalAlign:'middle' }),
          // Divider
          r('e6',null,{ x:80,y:510,width:920,height:2,fill:'rgba(0,174,239,0.22)' }),
          // Schedule label
          t('e7',null,{ x:80,y:546,width:920,height:34,text:'REPLACEMENT SCHEDULE BY HOME TYPE',fontFamily:'Inter',fontSize:14,fontStyle:'bold',fill:'rgba(0,174,239,0.62)',align:'left',verticalAlign:'middle' }),
          // Row 1
          r('e8',null,{ x:80,y:596,width:920,height:72,fill:'rgba(255,255,255,0.04)',cornerRadius:10 }),
          t('e9',null,{ x:100,y:596,width:560,height:72,text:'No pets, no allergies',fontFamily:'Inter',fontSize:26,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e10',null,{ x:700,y:596,width:280,height:72,text:'Every 90 days',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'#00AEEF',align:'right',verticalAlign:'middle' }),
          // Row 2
          r('e11',null,{ x:80,y:680,width:920,height:72,fill:'rgba(255,255,255,0.03)',cornerRadius:10 }),
          t('e12',null,{ x:100,y:680,width:560,height:72,text:'1 pet in the home',fontFamily:'Inter',fontSize:26,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e13',null,{ x:700,y:680,width:280,height:72,text:'Every 60 days',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'#00AEEF',align:'right',verticalAlign:'middle' }),
          // Row 3
          r('e14',null,{ x:80,y:764,width:920,height:72,fill:'rgba(255,255,255,0.04)',cornerRadius:10 }),
          t('e15',null,{ x:100,y:764,width:560,height:72,text:'Multiple pets / allergies',fontFamily:'Inter',fontSize:26,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e16',null,{ x:700,y:764,width:280,height:72,text:'Every 30 days',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'#00AEEF',align:'right',verticalAlign:'middle' }),
          // Row 4
          r('e17',null,{ x:80,y:848,width:920,height:72,fill:'rgba(255,255,255,0.03)',cornerRadius:10 }),
          t('e18',null,{ x:100,y:848,width:560,height:72,text:'Asthma / severe allergies',fontFamily:'Inter',fontSize:26,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e19',null,{ x:700,y:848,width:280,height:72,text:'Every 20 days',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'rgba(0,174,239,0.80)',align:'right',verticalAlign:'middle' }),
          // Callout
          r('e20',null,{ x:80,y:962,width:920,height:88,fill:'rgba(0,174,239,0.08)',cornerRadius:14 }),
          t('e21',null,{ x:80,y:962,width:920,height:88,text:'A dirty filter makes your AC work 15% harder\nand shortens the system\'s life by years.',fontFamily:'Inter',fontSize:25,fill:'#00AEEF',align:'center',verticalAlign:'middle',lineHeight:1.45,opacity:0.88 }),
          // CTA
          r('e22',null,{ x:80,y:1098,width:920,height:108,fill:'#00AEEF',cornerRadius:14 }),
          t('e23',null,{ x:80,y:1098,width:920,height:108,text:'(555) 000-0000',fontFamily:'Inter',fontSize:66,fontStyle:'bold',fill:'#122233',align:'center',verticalAlign:'middle' }),
          t('e24',null,{ x:80,y:1224,width:920,height:40,text:'Call us — we also sell filters for every system size',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.36)',align:'center',verticalAlign:'middle' }),
          // Footer
          r('e25',null,{ x:80,y:1296,width:920,height:1,fill:'#ffffff',opacity:0.08 }),
          t('e26',null,{ x:80,y:1316,width:920,height:28,text:'Business Name  ·  [City]',fontFamily:'Inter',fontSize:18,fill:'rgba(255,255,255,0.25)',align:'left',verticalAlign:'middle' }),
        ]) },

      { name: 'HVAC — Emergency No Heat No AC', industry: 'hvac', category: 'announcement', sort_order: 306,
        canvas_json: mkPage('#0A0A14', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#0A0A14' }),
          // Dual top stripes (hot + cold signal)
          r('e2',null,{ x:0,y:0,width:540,height:8,fill:'#FF6B35' }),
          r('e3',null,{ x:540,y:0,width:540,height:8,fill:'#00AEEF' }),
          // Left brand stripe
          r('e4',null,{ x:0,y:0,width:12,height:1350,fill:'#00AEEF' }),
          // Emergency badge
          r('e5',null,{ x:160,y:74,width:760,height:58,fill:'rgba(231,76,60,0.90)',cornerRadius:8 }),
          t('e6',null,{ x:160,y:74,width:760,height:58,text:'⚠️  EMERGENCY SERVICE  ⚠️',fontFamily:'Inter',fontSize:23,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          // Giant headline
          t('e7',null,{ x:80,y:168,width:920,height:186,text:'NO',fontFamily:'Inter',fontSize:178,fontStyle:'bold',fill:'#FF6B35',align:'center',verticalAlign:'middle' }),
          t('e8',null,{ x:80,y:352,width:920,height:186,text:'HEAT?',fontFamily:'Inter',fontSize:178,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e9',null,{ x:80,y:538,width:920,height:100,text:'NO AC?',fontFamily:'Inter',fontSize:86,fontStyle:'bold',fill:'#00AEEF',align:'center',verticalAlign:'middle' }),
          // Reassurance
          t('e10',null,{ x:80,y:660,width:920,height:60,text:'We\'re on the way. Day or night.',fontFamily:'Inter',fontSize:38,fill:'rgba(255,255,255,0.82)',align:'center',verticalAlign:'middle' }),
          t('e11',null,{ x:80,y:732,width:920,height:46,text:'Same-day service  ·  No overtime charge  ·  24/7',fontFamily:'Inter',fontSize:25,fontStyle:'bold',fill:'#00AEEF',align:'center',verticalAlign:'middle',opacity:0.80 }),
          // Divider
          r('e12',null,{ x:240,y:802,width:600,height:2,fill:'#00AEEF',opacity:0.28 }),
          // Phone CTA
          r('e13',null,{ x:80,y:830,width:920,height:122,fill:'#00AEEF',cornerRadius:16 }),
          t('e14',null,{ x:80,y:830,width:920,height:122,text:'(555) 000-0000',fontFamily:'Inter',fontSize:76,fontStyle:'bold',fill:'#0A0A14',align:'center',verticalAlign:'middle' }),
          t('e15',null,{ x:80,y:970,width:920,height:46,text:'Call or text — we answer 24 hours',fontFamily:'Inter',fontSize:26,fill:'rgba(210,232,248,0.55)',align:'center',verticalAlign:'middle' }),
          // Trust row
          t('e16',null,{ x:80,y:1200,width:920,height:40,text:'Licensed  ·  Insured  ·  Background-checked',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.35)',align:'center',verticalAlign:'middle' }),
          // Footer
          r('e17',null,{ x:80,y:1296,width:920,height:1,fill:'#ffffff',opacity:0.08 }),
          t('e18',null,{ x:200,y:1312,width:760,height:30,text:'Business Name  ·  [City]',fontFamily:'Inter',fontSize:19,fill:'rgba(255,255,255,0.28)',align:'left',verticalAlign:'middle' }),
        ]) },

      { name: 'HVAC — New System Financing', industry: 'hvac', category: 'promotional', sort_order: 307,
        canvas_json: mkPage('#0C1E12', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#0C1E12' }),
          r('e2',null,{ x:0,y:0,width:1080,height:700,fill:'#162D1C',opacity:0.60 }),
          // Green glow top-right
          r('e3',null,{ x:580,y:-120,width:700,height:700,fill:'#27AE60',opacity:0.05,cornerRadius:350 }),
          // Ghost "FREE" watermark
          t('e4',null,{ x:-80,y:30,width:1200,height:440,text:'FREE',fontFamily:'Inter',fontSize:370,fontStyle:'bold',fill:'rgba(39,174,96,0.04)',align:'left',verticalAlign:'middle' }),
          // Financing badge
          r('e5',null,{ x:80,y:80,width:460,height:60,fill:'rgba(39,174,96,0.12)',cornerRadius:30 }),
          t('e6',null,{ x:80,y:80,width:460,height:60,text:'💳  HVAC FINANCING AVAILABLE',fontFamily:'Inter',fontSize:19,fontStyle:'bold',fill:'#27AE60',align:'center',verticalAlign:'middle' }),
          // Headline
          t('e7',null,{ x:80,y:192,width:920,height:116,text:'A NEW HVAC',fontFamily:'Inter',fontSize:98,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e8',null,{ x:80,y:306,width:920,height:116,text:'SYSTEM —',fontFamily:'Inter',fontSize:98,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e9',null,{ x:80,y:420,width:920,height:116,text:'$0 TODAY.',fontFamily:'Inter',fontSize:98,fontStyle:'bold',fill:'#27AE60',align:'left',verticalAlign:'middle' }),
          // Body copy
          t('e10',null,{ x:80,y:568,width:920,height:150,text:'Stop sweating the cost. We offer flexible financing for [City] homeowners — approved in minutes, installed this week.',fontFamily:'Inter',fontSize:26,fill:'rgba(255,255,255,0.62)',align:'left',verticalAlign:'top',lineHeight:1.55 }),
          // Offer label
          t('e11',null,{ x:80,y:752,width:920,height:34,text:'CURRENT OFFER',fontFamily:'Inter',fontSize:14,fontStyle:'bold',fill:'rgba(39,174,96,0.70)',align:'left',verticalAlign:'middle' }),
          t('e12',null,{ x:80,y:788,width:920,height:90,text:'0% interest for 24 months',fontFamily:'Inter',fontSize:62,fontStyle:'bold',fill:'#27AE60',align:'left',verticalAlign:'middle' }),
          t('e13',null,{ x:80,y:890,width:920,height:58,text:'On approved credit. Full HVAC installs over $2,500. [City] residents.',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.40)',align:'left',verticalAlign:'top',lineHeight:1.4 }),
          // Divider
          r('e14',null,{ x:80,y:960,width:920,height:1,fill:'#27AE60',opacity:0.18 }),
          // Phone CTA
          r('e15',null,{ x:80,y:994,width:920,height:116,fill:'rgba(255,255,255,0.07)',cornerRadius:16 }),
          t('e16',null,{ x:80,y:994,width:920,height:116,text:'(555) 000-0000',fontFamily:'Inter',fontSize:72,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e17',null,{ x:80,y:1128,width:920,height:44,text:'Ask about financing — [City] residents',fontFamily:'Inter',fontSize:24,fill:'rgba(39,174,96,0.55)',align:'center',verticalAlign:'middle' }),
          // Footer
          r('e18',null,{ x:80,y:1246,width:920,height:1,fill:'#ffffff',opacity:0.08 }),
          t('e19',null,{ x:80,y:1268,width:920,height:52,text:'Business Name  ·  [City]',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.30)',align:'left',verticalAlign:'middle' }),
        ]) },

      { name: 'HVAC — Meet the Tech', industry: 'hvac', category: 'team', sort_order: 308,
        canvas_json: mkPage('#0B1E30', [
          // ── Photo zone ──────────────────────────────────────────────────────
          r('e1',null,{ x:0,y:0,width:1080,height:780,fill:'#071422' }),
          r('e2',null,{ x:0,y:0,width:1080,height:780,fill:'#000000',opacity:0.26 }),
          t('e3',null,{ x:80,y:290,width:920,height:200,text:'📸  Add your tech photo here\n1080 × 780 px',fontFamily:'Inter',fontSize:30,fill:'rgba(255,255,255,0.12)',align:'center',verticalAlign:'middle',lineHeight:1.6 }),
          r('e4',null,{ x:0,y:580,width:1080,height:120,fill:'#0B1E30',opacity:0.55 }),
          r('e5',null,{ x:0,y:700,width:1080,height:80,fill:'#0B1E30',opacity:0.90 }),
          // ── Info panel ──────────────────────────────────────────────────────
          r('e6',null,{ x:0,y:780,width:1080,height:570,fill:'#0B1E30' }),
          // Name tag pill (blue — HVAC brand colour)
          r('e7',null,{ x:80,y:722,width:580,height:62,fill:'#00AEEF',cornerRadius:10 }),
          t('e8',null,{ x:80,y:722,width:580,height:62,text:'Chris Park  ·  Senior HVAC Technician',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'#0B1E30',align:'center',verticalAlign:'middle' }),
          // Headline
          t('e9',null,{ x:80,y:830,width:920,height:68,text:'The tech keeping',fontFamily:'Inter',fontSize:54,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e10',null,{ x:80,y:896,width:920,height:68,text:'your home comfortable. ❄🔥',fontFamily:'Inter',fontSize:46,fontStyle:'bold',fill:'#00AEEF',align:'left',verticalAlign:'middle' }),
          // Stats bar
          r('e11',null,{ x:80,y:996,width:920,height:108,fill:'rgba(255,255,255,0.04)',cornerRadius:12 }),
          t('e12',null,{ x:80,y:1010,width:280,height:54,text:'12+',fontFamily:'Inter',fontSize:44,fontStyle:'bold',fill:'#00AEEF',align:'center',verticalAlign:'middle' }),
          t('e13',null,{ x:80,y:1066,width:280,height:28,text:'Years',fontFamily:'Inter',fontSize:17,fill:'rgba(255,255,255,0.42)',align:'center',verticalAlign:'middle' }),
          r('e14',null,{ x:372,y:1014,width:1,height:88,fill:'#ffffff',opacity:0.10 }),
          t('e15',null,{ x:400,y:1010,width:280,height:54,text:'3,100+',fontFamily:'Inter',fontSize:44,fontStyle:'bold',fill:'#00AEEF',align:'center',verticalAlign:'middle' }),
          t('e16',null,{ x:400,y:1066,width:280,height:28,text:'Systems Serviced',fontFamily:'Inter',fontSize:15,fill:'rgba(255,255,255,0.42)',align:'center',verticalAlign:'middle' }),
          r('e17',null,{ x:694,y:1014,width:1,height:88,fill:'#ffffff',opacity:0.10 }),
          t('e18',null,{ x:720,y:1010,width:280,height:54,text:'NATE',fontFamily:'Inter',fontSize:38,fontStyle:'bold',fill:'#00AEEF',align:'center',verticalAlign:'middle' }),
          t('e19',null,{ x:720,y:1066,width:280,height:28,text:'Certified',fontFamily:'Inter',fontSize:17,fill:'rgba(255,255,255,0.42)',align:'center',verticalAlign:'middle' }),
          // Bio
          t('e20',null,{ x:80,y:1148,width:920,height:72,text:'NATE-certified tech with 12 years in residential HVAC. Fast, clean, and honest — I treat your home like mine.',fontFamily:'Inter',fontSize:24,fill:'#00AEEF',align:'left',verticalAlign:'top',lineHeight:1.5,opacity:0.85 }),
          // Footer
          r('e21',null,{ x:80,y:1240,width:920,height:1,fill:'#ffffff',opacity:0.10 }),
          t('e22',null,{ x:80,y:1260,width:680,height:42,text:'Business Name  ·  Licensed & Insured',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.40)',align:'left',verticalAlign:'middle' }),
          t('e23',null,{ x:800,y:1260,width:200,height:42,text:'[City]',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.22)',align:'right',verticalAlign:'middle' }),
        ]) },

      { name: 'HVAC — Google Review Ask', industry: 'hvac', category: 'social-proof', sort_order: 309,
        canvas_json: mkPage('#0A1422', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#0A1422' }),
          r('e2',null,{ x:190,y:280,width:700,height:700,fill:'#4285F4',opacity:0.05,cornerRadius:350 }),
          t('e3',null,{ x:180,y:40,width:720,height:800,text:'G',fontFamily:'Inter',fontSize:760,fontStyle:'bold',fill:'rgba(66,133,244,0.05)',align:'center',verticalAlign:'top' }),
          // 5 gold stars
          t('e4',null,{ x:80,y:200,width:920,height:100,text:'⭐⭐⭐⭐⭐',fontFamily:'Inter',fontSize:76,fill:'#FBBC04',align:'center',verticalAlign:'middle' }),
          // Headline
          t('e5',null,{ x:80,y:360,width:920,height:108,text:'Happy with your',fontFamily:'Inter',fontSize:84,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:466,width:920,height:108,text:'comfort level? ❄🔥',fontFamily:'Inter',fontSize:72,fontStyle:'bold',fill:'#FBBC04',align:'center',verticalAlign:'middle' }),
          // Accent divider
          r('e7',null,{ x:440,y:622,width:200,height:2,fill:'#FBBC04',opacity:0.32 }),
          // Body copy
          t('e8',null,{ x:80,y:664,width:920,height:52,text:'Your review helps [City] homeowners',fontFamily:'Inter',fontSize:34,fill:'#FBBC04',align:'center',verticalAlign:'middle',opacity:0.90 }),
          t('e9',null,{ x:80,y:718,width:920,height:52,text:'find an HVAC company they can trust.',fontFamily:'Inter',fontSize:34,fill:'#FBBC04',align:'center',verticalAlign:'middle',opacity:0.90 }),
          t('e10',null,{ x:80,y:812,width:920,height:50,text:'It takes 60 seconds — and it means everything to us.',fontFamily:'Inter',fontSize:26,fill:'rgba(255,255,255,0.40)',align:'center',verticalAlign:'middle' }),
          t('e11',null,{ x:80,y:876,width:920,height:44,text:'We recently completed: your HVAC service.',fontFamily:'Inter',fontSize:23,fill:'rgba(255,255,255,0.28)',align:'center',verticalAlign:'middle' }),
          // Google blue CTA
          r('e12',null,{ x:80,y:962,width:920,height:120,fill:'#4285F4',cornerRadius:60 }),
          t('e13',null,{ x:80,y:962,width:920,height:120,text:'Leave a Google Review →',fontFamily:'Inter',fontSize:38,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e14',null,{ x:80,y:1120,width:920,height:44,text:'Link in bio  ·  Takes 60 seconds',fontFamily:'Inter',fontSize:24,fill:'rgba(255,255,255,0.28)',align:'center',verticalAlign:'middle' }),
          // Footer
          r('e15',null,{ x:80,y:1238,width:920,height:1,fill:'#ffffff',opacity:0.08 }),
          t('e16',null,{ x:80,y:1260,width:920,height:52,text:'Business Name  ·  [City]  ·  Licensed & Insured',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.35)',align:'left',verticalAlign:'middle' }),
        ]) },

      // ── LANDSCAPING ───────────────────────────────────────────────────────────

      { name: 'Landscaping — Spring Lawn Revival', industry: 'landscaping', category: 'seasonal', sort_order: 400,
        canvas_json: mkPage('#0B2014', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#0B2014' }),
          r('e2',null,{ x:0,y:0,width:1080,height:10,fill:'#52B788' }),
          // Ghost leaf watermark
          t('e3',null,{ x:200,y:-40,width:880,height:520,text:'🌿',fontFamily:'Inter',fontSize:480,fill:'rgba(82,183,136,0.05)',align:'center',verticalAlign:'middle' }),
          // Season badge
          r('e4',null,{ x:80,y:80,width:340,height:56,fill:'rgba(82,183,136,0.16)',cornerRadius:28 }),
          t('e5',null,{ x:80,y:80,width:340,height:56,text:'🌱  SPRING IS HERE',fontFamily:'Inter',fontSize:20,fontStyle:'bold',fill:'#52B788',align:'center',verticalAlign:'middle' }),
          // Headline stacked
          t('e6',null,{ x:80,y:184,width:920,height:128,text:'WAKE YOUR',fontFamily:'Inter',fontSize:108,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e7',null,{ x:80,y:310,width:920,height:128,text:'LAWN UP.',fontFamily:'Inter',fontSize:108,fontStyle:'bold',fill:'#52B788',align:'left',verticalAlign:'middle' }),
          // Sub
          t('e8',null,{ x:80,y:468,width:920,height:112,text:'Spring is the most important time for your lawn. One good treatment now pays back all summer. [City] homeowners — we have openings this week.',fontFamily:'Inter',fontSize:26,fill:'rgba(255,255,255,0.60)',align:'left',verticalAlign:'top',lineHeight:1.55 }),
          // What we do label
          t('e9',null,{ x:80,y:614,width:920,height:32,text:'SPRING REVIVAL INCLUDES:',fontFamily:'Inter',fontSize:14,fontStyle:'bold',fill:'rgba(82,183,136,0.70)',align:'left',verticalAlign:'middle' }),
          t('e10',null,{ x:80,y:660,width:920,height:40,text:'✓  Aeration + overseeding — thick healthy growth',fontFamily:'Inter',fontSize:25,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e11',null,{ x:80,y:712,width:920,height:40,text:'✓  Pre-emergent weed control — stop them early',fontFamily:'Inter',fontSize:25,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e12',null,{ x:80,y:764,width:920,height:40,text:'✓  Slow-release fertiliser — feeds for 8 weeks',fontFamily:'Inter',fontSize:25,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e13',null,{ x:80,y:816,width:920,height:40,text:'✓  Free lawn health assessment included',fontFamily:'Inter',fontSize:25,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          // CTA
          r('e14',null,{ x:80,y:912,width:920,height:116,fill:'#52B788',cornerRadius:16 }),
          t('e15',null,{ x:80,y:912,width:920,height:116,text:'(555) 000-0000',fontFamily:'Inter',fontSize:72,fontStyle:'bold',fill:'#0B2014',align:'center',verticalAlign:'middle' }),
          t('e16',null,{ x:80,y:1046,width:920,height:44,text:'Book your spring lawn revival — [City]',fontFamily:'Inter',fontSize:24,fill:'rgba(82,183,136,0.60)',align:'center',verticalAlign:'middle' }),
          // Footer
          r('e17',null,{ x:80,y:1264,width:920,height:1,fill:'#ffffff',opacity:0.08 }),
          t('e18',null,{ x:80,y:1284,width:920,height:48,text:'Business Name  ·  [City]  ·  Fully Insured',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.28)',align:'left',verticalAlign:'middle' }),
        ]) },

      { name: 'Landscaping — Before & After Transformation', industry: 'landscaping', category: 'before-after', sort_order: 401,
        canvas_json: mkPage('#1A2A1A', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#1A2A1A' }),
          r('e2',null,{ x:0,y:0,width:12,height:1350,fill:'#52B788' }),
          t('e3',null,{ x:80,y:88,width:840,height:30,text:'REAL JOB  ·  REAL RESULT  ·  [CITY]',fontFamily:'Inter',fontSize:17,fontStyle:'bold',fill:'#52B788',align:'left',verticalAlign:'middle' }),
          // Split headline
          t('e4',null,{ x:80,y:148,width:920,height:128,text:'OVERGROWN.',fontFamily:'Inter',fontSize:108,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e5',null,{ x:80,y:274,width:920,height:128,text:'STUNNING.',fontFamily:'Inter',fontSize:108,fontStyle:'bold',fill:'#52B788',align:'left',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:400,width:920,height:72,text:'SPOT THE DIFFERENCE. 🌳',fontFamily:'Inter',fontSize:54,fontStyle:'bold',fill:'rgba(236,240,241,0.86)',align:'left',verticalAlign:'middle' }),
          // Job card
          r('e7',null,{ x:80,y:518,width:920,height:190,fill:'rgba(255,255,255,0.04)',cornerRadius:14 }),
          t('e8',null,{ x:120,y:540,width:840,height:28,text:'THE JOB',fontFamily:'Inter',fontSize:14,fontStyle:'bold',fill:'#52B788',align:'left',verticalAlign:'middle' }),
          t('e9',null,{ x:120,y:578,width:840,height:68,text:'Full yard cleanup + fresh mulch + edging',fontFamily:'Inter',fontSize:38,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e10',null,{ x:120,y:660,width:240,height:34,text:'1 day job',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.50)',align:'left',verticalAlign:'middle' }),
          t('e11',null,{ x:380,y:660,width:260,height:34,text:'3-man crew',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.50)',align:'left',verticalAlign:'middle' }),
          t('e12',null,{ x:660,y:660,width:280,height:34,text:'★ 5.0 rated',fontFamily:'Inter',fontSize:22,fill:'#52B788',align:'left',verticalAlign:'middle' }),
          // Photo placeholder
          r('e13',null,{ x:80,y:756,width:920,height:200,fill:'rgba(255,255,255,0.03)',cornerRadius:10 }),
          t('e14',null,{ x:80,y:756,width:920,height:200,text:'📸  Add your before & after\nyard photos here',fontFamily:'Inter',fontSize:30,fill:'rgba(255,255,255,0.10)',align:'center',verticalAlign:'middle',lineHeight:1.5 }),
          // Swipe CTA
          r('e15',null,{ x:80,y:1002,width:720,height:66,fill:'#52B788',cornerRadius:33 }),
          t('e16',null,{ x:80,y:1002,width:720,height:66,text:'Swipe to see the full transformation →',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'#1A2A1A',align:'center',verticalAlign:'middle' }),
          // Hook fact
          t('e17',null,{ x:80,y:1112,width:920,height:44,text:'Curb appeal adds up to 10% to your home\'s value. 🏡',fontFamily:'Inter',fontSize:23,fill:'rgba(82,183,136,0.70)',align:'center',verticalAlign:'middle' }),
          // Footer
          r('e18',null,{ x:80,y:1256,width:920,height:1,fill:'rgba(255,255,255,0.08)' }),
          t('e19',null,{ x:80,y:1278,width:920,height:46,text:'Business Name  •  [City]  •  (555) 000-0000',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.28)',align:'left',verticalAlign:'middle' }),
        ]) },

      { name: 'Landscaping — 5-Star Customer Review', industry: 'landscaping', category: 'social-proof', sort_order: 402,
        canvas_json: mkPage('#0F1F0F', [
          r('e1',null,{ x:0,y:0,width:1080,height:900,fill:'#0F1F0F' }),
          r('e2',null,{ x:0,y:900,width:1080,height:450,fill:'#0A160A' }),
          r('e3',null,{ x:0,y:0,width:1080,height:8,fill:'#52B788' }),
          t('e4',null,{ x:60,y:52,width:240,height:220,text:'"',fontFamily:'Inter',fontSize:220,fontStyle:'bold',fill:'rgba(82,183,136,0.08)',align:'left',verticalAlign:'top' }),
          t('e5',null,{ x:80,y:136,width:920,height:70,text:'★★★★★',fontFamily:'Inter',fontSize:54,fill:'#FFC300',align:'left',verticalAlign:'middle' }),
          r('e6',null,{ x:80,y:226,width:210,height:44,fill:'rgba(82,183,136,0.16)',cornerRadius:22 }),
          t('e7',null,{ x:80,y:226,width:210,height:44,text:'Google Review',fontFamily:'Inter',fontSize:15,fontStyle:'bold',fill:'#52B788',align:'center',verticalAlign:'middle' }),
          t('e8',null,{ x:80,y:288,width:920,height:560,text:'"Replace with your best customer review. The strongest landscaping reviews mention what the yard looked like before, how professional the crew was, and how the neighbours reacted. Real words convert best."',fontFamily:'Inter',fontSize:37,fill:'#ffffff',align:'left',verticalAlign:'top',lineHeight:1.55 }),
          r('e9',null,{ x:0,y:900,width:1080,height:1,fill:'rgba(82,183,136,0.16)' }),
          r('e10',null,{ x:80,y:936,width:88,height:88,fill:'#52B788',cornerRadius:44 }),
          t('e11',null,{ x:80,y:936,width:88,height:88,text:'TR',fontFamily:'Inter',fontSize:30,fontStyle:'bold',fill:'#0F1F0F',align:'center',verticalAlign:'middle' }),
          t('e12',null,{ x:188,y:948,width:700,height:38,text:'Tom R.',fontFamily:'Inter',fontSize:27,fontStyle:'bold',fill:'#FFC300',align:'left',verticalAlign:'middle' }),
          t('e13',null,{ x:188,y:994,width:700,height:34,text:'[City]  ·  Full Yard Makeover',fontFamily:'Inter',fontSize:21,fill:'rgba(255,255,255,0.40)',align:'left',verticalAlign:'middle' }),
          r('e14',null,{ x:80,y:1058,width:80,height:3,fill:'#52B788',cornerRadius:2 }),
          t('e15',null,{ x:80,y:1080,width:920,height:44,text:'We show up on time and clean up every last leaf.',fontFamily:'Inter',fontSize:24,fill:'#52B788',align:'left',verticalAlign:'middle' }),
          r('e16',null,{ x:80,y:1200,width:920,height:1,fill:'rgba(255,255,255,0.06)' }),
          t('e17',null,{ x:80,y:1222,width:920,height:42,text:'Business Name  ·  [City]',fontFamily:'Inter',fontSize:22,fill:'rgba(82,183,136,0.55)',align:'left',verticalAlign:'middle' }),
          t('e18',null,{ x:80,y:1280,width:920,height:42,text:'(555) 000-0000  ·  Fully Insured',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.22)',align:'left',verticalAlign:'middle' }),
        ]) },

      { name: 'Landscaping — 5 Signs Your Lawn Needs Help', industry: 'landscaping', category: 'educational', sort_order: 403,
        canvas_json: mkPage('#111D11', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#111D11' }),
          r('e2',null,{ x:0,y:0,width:1080,height:10,fill:'#52B788' }),
          t('e3',null,{ x:80,y:108,width:920,height:148,text:'5 SIGNS',fontFamily:'Inter',fontSize:126,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e4',null,{ x:80,y:254,width:920,height:148,text:'YOUR LAWN',fontFamily:'Inter',fontSize:126,fontStyle:'bold',fill:'#52B788',align:'center',verticalAlign:'middle' }),
          t('e5',null,{ x:80,y:400,width:920,height:148,text:'IS STRUGGLING.',fontFamily:'Inter',fontSize:96,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:544,width:920,height:80,text:'(And how to fix it.) 🌱',fontFamily:'Inter',fontSize:54,fontStyle:'bold',fill:'rgba(236,240,241,0.82)',align:'center',verticalAlign:'middle' }),
          r('e7',null,{ x:80,y:686,width:920,height:3,fill:'rgba(82,183,136,0.22)',cornerRadius:2 }),
          t('e8',null,{ x:80,y:712,width:920,height:48,text:'🟡  Patchy yellow or brown spots in grass',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.52)',align:'center',verticalAlign:'middle' }),
          t('e9',null,{ x:80,y:768,width:920,height:48,text:'🌿  Weeds taking over entire sections',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.52)',align:'center',verticalAlign:'middle' }),
          t('e10',null,{ x:80,y:824,width:920,height:48,text:'💧  Water pooling after every rain',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.52)',align:'center',verticalAlign:'middle' }),
          t('e11',null,{ x:80,y:880,width:920,height:48,text:'🪲  Grubs, moles, or lawn pests visible',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.52)',align:'center',verticalAlign:'middle' }),
          t('e12',null,{ x:80,y:936,width:920,height:48,text:'🌑  Thatch so thick grass can\'t breathe',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.52)',align:'center',verticalAlign:'middle' }),
          r('e13',null,{ x:180,y:1042,width:720,height:68,fill:'#52B788',cornerRadius:34 }),
          t('e14',null,{ x:180,y:1042,width:720,height:68,text:'Free lawn assessment — (555) 000-0000',fontFamily:'Inter',fontSize:24,fontStyle:'bold',fill:'#111D11',align:'center',verticalAlign:'middle' }),
          t('e15',null,{ x:80,y:1148,width:920,height:44,text:'Most lawn problems are fixable in one treatment.',fontFamily:'Inter',fontSize:22,fill:'rgba(82,183,136,0.65)',align:'center',verticalAlign:'middle' }),
          r('e16',null,{ x:80,y:1256,width:920,height:1,fill:'rgba(255,255,255,0.08)' }),
          t('e17',null,{ x:80,y:1278,width:920,height:42,text:'Business Name  ·  [City]  ·  Fully Insured',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.26)',align:'center',verticalAlign:'middle' }),
        ]) },

      { name: 'Landscaping — Fall Cleanup Special', industry: 'landscaping', category: 'seasonal', sort_order: 404,
        canvas_json: mkPage('#1C1004', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#1C1004' }),
          r('e2',null,{ x:0,y:0,width:1080,height:10,fill:'#E67E22' }),
          // Ghost leaf watermark
          t('e3',null,{ x:100,y:-30,width:880,height:520,text:'🍂',fontFamily:'Inter',fontSize:460,fill:'rgba(230,126,34,0.05)',align:'center',verticalAlign:'middle' }),
          // Badge
          r('e4',null,{ x:80,y:80,width:360,height:56,fill:'rgba(230,126,34,0.16)',cornerRadius:28 }),
          t('e5',null,{ x:80,y:80,width:360,height:56,text:'🍂  FALL CLEANUP TIME',fontFamily:'Inter',fontSize:19,fontStyle:'bold',fill:'#E67E22',align:'center',verticalAlign:'middle' }),
          // Headline
          t('e6',null,{ x:80,y:184,width:920,height:128,text:'PROTECT YOUR',fontFamily:'Inter',fontSize:108,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e7',null,{ x:80,y:310,width:920,height:128,text:'LAWN THIS',fontFamily:'Inter',fontSize:108,fontStyle:'bold',fill:'rgba(255,255,255,0.62)',align:'left',verticalAlign:'middle' }),
          t('e8',null,{ x:80,y:436,width:920,height:128,text:'WINTER.',fontFamily:'Inter',fontSize:108,fontStyle:'bold',fill:'#E67E22',align:'left',verticalAlign:'middle' }),
          // Body
          t('e9',null,{ x:80,y:594,width:920,height:110,text:'Leaves left on the lawn through winter kill the grass beneath. Book your fall cleanup now — [City] slots are filling fast.',fontFamily:'Inter',fontSize:26,fill:'rgba(255,255,255,0.58)',align:'left',verticalAlign:'top',lineHeight:1.55 }),
          // Checklist
          t('e10',null,{ x:80,y:736,width:920,height:32,text:'CLEANUP INCLUDES:',fontFamily:'Inter',fontSize:14,fontStyle:'bold',fill:'rgba(230,126,34,0.70)',align:'left',verticalAlign:'middle' }),
          t('e11',null,{ x:80,y:782,width:920,height:40,text:'✓  Full leaf removal + haul-away',fontFamily:'Inter',fontSize:25,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e12',null,{ x:80,y:834,width:920,height:40,text:'✓  Final mow + edge trim',fontFamily:'Inter',fontSize:25,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e13',null,{ x:80,y:886,width:920,height:40,text:'✓  Bed cleanup + mulch topdress',fontFamily:'Inter',fontSize:25,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          // CTA
          r('e14',null,{ x:80,y:982,width:920,height:116,fill:'#E67E22',cornerRadius:16 }),
          t('e15',null,{ x:80,y:982,width:920,height:116,text:'(555) 000-0000',fontFamily:'Inter',fontSize:72,fontStyle:'bold',fill:'#1C1004',align:'center',verticalAlign:'middle' }),
          t('e16',null,{ x:80,y:1116,width:920,height:44,text:'Book your fall cleanup — [City]',fontFamily:'Inter',fontSize:24,fill:'rgba(230,126,34,0.60)',align:'center',verticalAlign:'middle' }),
          r('e17',null,{ x:80,y:1264,width:920,height:1,fill:'#ffffff',opacity:0.08 }),
          t('e18',null,{ x:80,y:1284,width:920,height:48,text:'Business Name  ·  [City]  ·  Fully Insured',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.28)',align:'left',verticalAlign:'middle' }),
        ]) },

      { name: 'Landscaping — Free Estimate Offer', industry: 'landscaping', category: 'promotional', sort_order: 405,
        canvas_json: mkPage('#0D1F0D', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#0D1F0D' }),
          // Ghost "FREE" watermark
          t('e2',null,{ x:-80,y:30,width:1200,height:440,text:'FREE',fontFamily:'Inter',fontSize:370,fontStyle:'bold',fill:'rgba(82,183,136,0.04)',align:'left',verticalAlign:'middle' }),
          // Badge
          r('e3',null,{ x:80,y:80,width:420,height:50,fill:'rgba(82,183,136,0.12)',cornerRadius:25 }),
          t('e4',null,{ x:80,y:80,width:420,height:50,text:'NO OBLIGATION  ·  NO PRESSURE',fontFamily:'Inter',fontSize:16,fontStyle:'bold',fill:'#52B788',align:'center',verticalAlign:'middle' }),
          // Headline
          t('e5',null,{ x:80,y:172,width:920,height:116,text:'GET YOUR',fontFamily:'Inter',fontSize:94,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:286,width:920,height:168,text:'FREE',fontFamily:'Inter',fontSize:158,fontStyle:'bold',fill:'#52B788',align:'left',verticalAlign:'middle' }),
          t('e7',null,{ x:80,y:448,width:920,height:108,text:'LANDSCAPE',fontFamily:'Inter',fontSize:84,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e8',null,{ x:80,y:550,width:920,height:108,text:'ESTIMATE.',fontFamily:'Inter',fontSize:84,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          // What's included
          t('e9',null,{ x:80,y:698,width:920,height:28,text:'YOUR ESTIMATE INCLUDES:',fontFamily:'Inter',fontSize:15,fontStyle:'bold',fill:'rgba(82,183,136,0.62)',align:'left',verticalAlign:'middle' }),
          t('e10',null,{ x:80,y:740,width:920,height:44,text:'✓  Full property walk — front, back, and sides',fontFamily:'Inter',fontSize:27,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e11',null,{ x:80,y:798,width:920,height:44,text:'✓  Written plan with photos and pricing',fontFamily:'Inter',fontSize:27,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e12',null,{ x:80,y:856,width:920,height:44,text:'✓  Seasonal maintenance recommendations',fontFamily:'Inter',fontSize:27,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e13',null,{ x:80,y:914,width:920,height:44,text:'✓  Zero obligation — ever',fontFamily:'Inter',fontSize:27,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          // CTA
          r('e14',null,{ x:80,y:1018,width:920,height:108,fill:'#52B788',cornerRadius:14 }),
          t('e15',null,{ x:80,y:1018,width:920,height:108,text:'(555) 000-0000',fontFamily:'Inter',fontSize:68,fontStyle:'bold',fill:'#0D1F0D',align:'center',verticalAlign:'middle' }),
          t('e16',null,{ x:80,y:1144,width:920,height:40,text:'Call or text to book your free estimate',fontFamily:'Inter',fontSize:22,fill:'rgba(82,183,136,0.55)',align:'center',verticalAlign:'middle' }),
          r('e17',null,{ x:80,y:1248,width:920,height:1,fill:'#ffffff',opacity:0.08 }),
          t('e18',null,{ x:80,y:1268,width:920,height:52,text:'Business Name  •  [City]',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.28)',align:'left',verticalAlign:'middle' }),
        ]) },

      { name: 'Landscaping — Weekly Maintenance Program', industry: 'landscaping', category: 'promotional', sort_order: 406,
        canvas_json: mkPage('#0A1A0A', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#0A1A0A' }),
          r('e2',null,{ x:0,y:0,width:1080,height:10,fill:'#52B788' }),
          // Hook headline
          t('e3',null,{ x:80,y:90,width:920,height:58,text:'STOP DOING IT YOURSELF.',fontFamily:'Inter',fontSize:42,fontStyle:'bold',fill:'#52B788',align:'center',verticalAlign:'middle' }),
          t('e4',null,{ x:80,y:178,width:920,height:158,text:'WEEKLY',fontFamily:'Inter',fontSize:138,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e5',null,{ x:80,y:334,width:920,height:158,text:'LAWN CARE',fontFamily:'Inter',fontSize:118,fontStyle:'bold',fill:'#52B788',align:'center',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:488,width:920,height:88,text:'from $49/visit.',fontFamily:'Inter',fontSize:70,fontStyle:'bold',fill:'rgba(255,255,255,0.78)',align:'center',verticalAlign:'middle' }),
          // Divider
          r('e7',null,{ x:80,y:598,width:920,height:2,fill:'rgba(82,183,136,0.22)' }),
          // Program features
          t('e8',null,{ x:80,y:634,width:920,height:34,text:'EVERY VISIT INCLUDES:',fontFamily:'Inter',fontSize:14,fontStyle:'bold',fill:'rgba(82,183,136,0.62)',align:'left',verticalAlign:'middle' }),
          // Features 2-col grid
          t('e9',null,{ x:80,y:684,width:420,height:40,text:'🌿  Mow + edge',fontFamily:'Inter',fontSize:24,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e10',null,{ x:580,y:684,width:420,height:40,text:'🍂  Blow + cleanup',fontFamily:'Inter',fontSize:24,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e11',null,{ x:80,y:736,width:420,height:40,text:'✂  Trim shrubs',fontFamily:'Inter',fontSize:24,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e12',null,{ x:580,y:736,width:420,height:40,text:'📋  Photo report',fontFamily:'Inter',fontSize:24,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e13',null,{ x:80,y:788,width:920,height:40,text:'💧  Irrigation check — every visit',fontFamily:'Inter',fontSize:24,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          // Perks banner
          r('e14',null,{ x:80,y:866,width:920,height:100,fill:'rgba(82,183,136,0.10)',cornerRadius:14 }),
          t('e15',null,{ x:80,y:878,width:920,height:44,text:'No contracts  ·  Pause any time  ·  Insured crew',fontFamily:'Inter',fontSize:26,fontStyle:'bold',fill:'#52B788',align:'center',verticalAlign:'middle' }),
          t('e16',null,{ x:80,y:926,width:920,height:34,text:'First visit FREE when you sign up this week',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.45)',align:'center',verticalAlign:'middle' }),
          // CTA
          r('e17',null,{ x:80,y:1014,width:920,height:114,fill:'#52B788',cornerRadius:16 }),
          t('e18',null,{ x:80,y:1014,width:920,height:114,text:'(555) 000-0000',fontFamily:'Inter',fontSize:70,fontStyle:'bold',fill:'#0A1A0A',align:'center',verticalAlign:'middle' }),
          t('e19',null,{ x:80,y:1146,width:920,height:44,text:'Text "WEEKLY" to get your first visit free',fontFamily:'Inter',fontSize:24,fill:'rgba(82,183,136,0.55)',align:'center',verticalAlign:'middle' }),
          r('e20',null,{ x:80,y:1266,width:920,height:1,fill:'#ffffff',opacity:0.08 }),
          t('e21',null,{ x:80,y:1286,width:920,height:48,text:'Business Name  ·  [City]  ·  Fully Insured',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.28)',align:'left',verticalAlign:'middle' }),
        ]) },

      { name: 'Landscaping — Lawn Care How It Works', industry: 'landscaping', category: 'educational', sort_order: 407,
        canvas_json: mkPage('#0C1C0C', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#0C1C0C' }),
          r('e2',null,{ x:0,y:0,width:1080,height:10,fill:'#52B788' }),
          // Headline
          t('e3',null,{ x:80,y:90,width:920,height:58,text:'HOW IT WORKS',fontFamily:'Inter',fontSize:42,fontStyle:'bold',fill:'#52B788',align:'center',verticalAlign:'middle' }),
          t('e4',null,{ x:80,y:168,width:920,height:148,text:'FROM CALL',fontFamily:'Inter',fontSize:126,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e5',null,{ x:80,y:314,width:920,height:148,text:'TO CURB',fontFamily:'Inter',fontSize:126,fontStyle:'bold',fill:'#52B788',align:'center',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:460,width:920,height:80,text:'APPEAL. 🏡',fontFamily:'Inter',fontSize:62,fontStyle:'bold',fill:'rgba(236,240,241,0.84)',align:'center',verticalAlign:'middle' }),
          r('e7',null,{ x:80,y:568,width:920,height:2,fill:'rgba(82,183,136,0.22)' }),
          // Steps
          r('e8',null,{ x:80,y:592,width:56,height:56,fill:'rgba(82,183,136,0.16)',cornerRadius:28 }),
          t('e9',null,{ x:80,y:592,width:56,height:56,text:'01',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'#52B788',align:'center',verticalAlign:'middle' }),
          t('e10',null,{ x:152,y:592,width:848,height:56,text:'You call or text — we respond within the hour',fontFamily:'Inter',fontSize:26,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          r('e11',null,{ x:80,y:670,width:56,height:56,fill:'rgba(82,183,136,0.16)',cornerRadius:28 }),
          t('e12',null,{ x:80,y:670,width:56,height:56,text:'02',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'#52B788',align:'center',verticalAlign:'middle' }),
          t('e13',null,{ x:152,y:670,width:848,height:56,text:'Free walk-through — we assess and quote on the spot',fontFamily:'Inter',fontSize:26,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          r('e14',null,{ x:80,y:748,width:56,height:56,fill:'rgba(82,183,136,0.16)',cornerRadius:28 }),
          t('e15',null,{ x:80,y:748,width:56,height:56,text:'03',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'#52B788',align:'center',verticalAlign:'middle' }),
          t('e16',null,{ x:152,y:748,width:848,height:56,text:'You approve — we schedule and show up on time',fontFamily:'Inter',fontSize:26,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          r('e17',null,{ x:80,y:826,width:56,height:56,fill:'rgba(82,183,136,0.16)',cornerRadius:28 }),
          t('e18',null,{ x:80,y:826,width:56,height:56,text:'04',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'#52B788',align:'center',verticalAlign:'middle' }),
          t('e19',null,{ x:152,y:826,width:848,height:56,text:'We do the work + clean up every scrap',fontFamily:'Inter',fontSize:26,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          r('e20',null,{ x:80,y:904,width:56,height:56,fill:'rgba(82,183,136,0.16)',cornerRadius:28 }),
          t('e21',null,{ x:80,y:904,width:56,height:56,text:'05',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'#52B788',align:'center',verticalAlign:'middle' }),
          t('e22',null,{ x:152,y:904,width:848,height:56,text:'You enjoy the best-looking yard on the block',fontFamily:'Inter',fontSize:26,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          // CTA
          r('e23',null,{ x:80,y:1014,width:920,height:114,fill:'#52B788',cornerRadius:16 }),
          t('e24',null,{ x:80,y:1014,width:920,height:114,text:'(555) 000-0000',fontFamily:'Inter',fontSize:70,fontStyle:'bold',fill:'#0C1C0C',align:'center',verticalAlign:'middle' }),
          t('e25',null,{ x:80,y:1146,width:920,height:44,text:'Free estimate — [City] same week',fontFamily:'Inter',fontSize:24,fill:'rgba(82,183,136,0.55)',align:'center',verticalAlign:'middle' }),
          r('e26',null,{ x:80,y:1268,width:920,height:1,fill:'#ffffff',opacity:0.08 }),
          t('e27',null,{ x:80,y:1288,width:920,height:48,text:'Business Name  ·  [City]  ·  Fully Insured',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.28)',align:'left',verticalAlign:'middle' }),
        ]) },

      { name: 'Landscaping — Meet the Crew', industry: 'landscaping', category: 'team', sort_order: 408,
        canvas_json: mkPage('#0E1E0E', [
          r('e1',null,{ x:0,y:0,width:1080,height:780,fill:'#071407' }),
          r('e2',null,{ x:0,y:0,width:1080,height:780,fill:'#000000',opacity:0.26 }),
          t('e3',null,{ x:80,y:290,width:920,height:200,text:'📸  Add your crew photo here\n1080 × 780 px',fontFamily:'Inter',fontSize:30,fill:'rgba(255,255,255,0.12)',align:'center',verticalAlign:'middle',lineHeight:1.6 }),
          r('e4',null,{ x:0,y:580,width:1080,height:120,fill:'#0E1E0E',opacity:0.55 }),
          r('e5',null,{ x:0,y:700,width:1080,height:80,fill:'#0E1E0E',opacity:0.90 }),
          r('e6',null,{ x:0,y:780,width:1080,height:570,fill:'#0E1E0E' }),
          // Name pill (yellow — earthy contrast on green)
          r('e7',null,{ x:80,y:720,width:560,height:62,fill:'#FFC300',cornerRadius:10 }),
          t('e8',null,{ x:80,y:720,width:560,height:62,text:'Carlos V.  ·  Lead Landscaper',fontFamily:'Inter',fontSize:24,fontStyle:'bold',fill:'#0E1E0E',align:'center',verticalAlign:'middle' }),
          // Headline
          t('e9',null,{ x:80,y:828,width:920,height:68,text:'The hands behind',fontFamily:'Inter',fontSize:54,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('e10',null,{ x:80,y:894,width:920,height:68,text:'your dream yard. 🌳',fontFamily:'Inter',fontSize:54,fontStyle:'bold',fill:'#52B788',align:'left',verticalAlign:'middle' }),
          // Stats bar
          r('e11',null,{ x:80,y:994,width:920,height:108,fill:'rgba(255,255,255,0.04)',cornerRadius:12 }),
          t('e12',null,{ x:80,y:1008,width:280,height:54,text:'10+',fontFamily:'Inter',fontSize:44,fontStyle:'bold',fill:'#52B788',align:'center',verticalAlign:'middle' }),
          t('e13',null,{ x:80,y:1064,width:280,height:28,text:'Years',fontFamily:'Inter',fontSize:17,fill:'rgba(255,255,255,0.42)',align:'center',verticalAlign:'middle' }),
          r('e14',null,{ x:372,y:1012,width:1,height:88,fill:'#ffffff',opacity:0.10 }),
          t('e15',null,{ x:400,y:1008,width:280,height:54,text:'1,200+',fontFamily:'Inter',fontSize:44,fontStyle:'bold',fill:'#52B788',align:'center',verticalAlign:'middle' }),
          t('e16',null,{ x:400,y:1064,width:280,height:28,text:'Yards Done',fontFamily:'Inter',fontSize:17,fill:'rgba(255,255,255,0.42)',align:'center',verticalAlign:'middle' }),
          r('e17',null,{ x:694,y:1012,width:1,height:88,fill:'#ffffff',opacity:0.10 }),
          t('e18',null,{ x:720,y:1008,width:280,height:54,text:'5.0 ⭐',fontFamily:'Inter',fontSize:44,fontStyle:'bold',fill:'#52B788',align:'center',verticalAlign:'middle' }),
          t('e19',null,{ x:720,y:1064,width:280,height:28,text:'Rating',fontFamily:'Inter',fontSize:17,fill:'rgba(255,255,255,0.42)',align:'center',verticalAlign:'middle' }),
          t('e20',null,{ x:80,y:1148,width:920,height:72,text:'10 years transforming [City] yards. Takes pride in every edge, every detail — and always leaves the site cleaner than I found it.',fontFamily:'Inter',fontSize:24,fill:'#52B788',align:'left',verticalAlign:'top',lineHeight:1.5,opacity:0.85 }),
          r('e21',null,{ x:80,y:1240,width:920,height:1,fill:'#ffffff',opacity:0.10 }),
          t('e22',null,{ x:80,y:1260,width:680,height:42,text:'Business Name  ·  Fully Insured',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.40)',align:'left',verticalAlign:'middle' }),
          t('e23',null,{ x:800,y:1260,width:200,height:42,text:'[City]',fontFamily:'Inter',fontSize:20,fill:'rgba(255,255,255,0.22)',align:'right',verticalAlign:'middle' }),
        ]) },

      { name: 'Landscaping — Google Review Ask', industry: 'landscaping', category: 'social-proof', sort_order: 409,
        canvas_json: mkPage('#0A1A0C', [
          r('e1',null,{ x:0,y:0,width:1080,height:1350,fill:'#0A1A0C' }),
          r('e2',null,{ x:190,y:280,width:700,height:700,fill:'#4285F4',opacity:0.05,cornerRadius:350 }),
          t('e3',null,{ x:180,y:40,width:720,height:800,text:'G',fontFamily:'Inter',fontSize:760,fontStyle:'bold',fill:'rgba(66,133,244,0.05)',align:'center',verticalAlign:'top' }),
          t('e4',null,{ x:80,y:200,width:920,height:100,text:'⭐⭐⭐⭐⭐',fontFamily:'Inter',fontSize:76,fill:'#FFC300',align:'center',verticalAlign:'middle' }),
          t('e5',null,{ x:80,y:360,width:920,height:108,text:'Love what we',fontFamily:'Inter',fontSize:88,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e6',null,{ x:80,y:466,width:920,height:108,text:'did to your yard? 🌿',fontFamily:'Inter',fontSize:78,fontStyle:'bold',fill:'#52B788',align:'center',verticalAlign:'middle' }),
          r('e7',null,{ x:440,y:624,width:200,height:2,fill:'#52B788',opacity:0.32 }),
          t('e8',null,{ x:80,y:666,width:920,height:52,text:'Your review helps [City] homeowners',fontFamily:'Inter',fontSize:34,fill:'#52B788',align:'center',verticalAlign:'middle',opacity:0.90 }),
          t('e9',null,{ x:80,y:720,width:920,height:52,text:'find a landscaper they can trust.',fontFamily:'Inter',fontSize:34,fill:'#52B788',align:'center',verticalAlign:'middle',opacity:0.90 }),
          t('e10',null,{ x:80,y:816,width:920,height:50,text:'It takes 60 seconds — and it means everything to us.',fontFamily:'Inter',fontSize:26,fill:'rgba(255,255,255,0.40)',align:'center',verticalAlign:'middle' }),
          t('e11',null,{ x:80,y:880,width:920,height:44,text:'We recently completed: your yard transformation.',fontFamily:'Inter',fontSize:23,fill:'rgba(255,255,255,0.28)',align:'center',verticalAlign:'middle' }),
          r('e12',null,{ x:80,y:966,width:920,height:120,fill:'#4285F4',cornerRadius:60 }),
          t('e13',null,{ x:80,y:966,width:920,height:120,text:'Leave a Google Review →',fontFamily:'Inter',fontSize:38,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('e14',null,{ x:80,y:1124,width:920,height:44,text:'Link in bio  ·  Takes 60 seconds',fontFamily:'Inter',fontSize:24,fill:'rgba(255,255,255,0.28)',align:'center',verticalAlign:'middle' }),
          r('e15',null,{ x:80,y:1238,width:920,height:1,fill:'#ffffff',opacity:0.08 }),
          t('e16',null,{ x:80,y:1260,width:920,height:52,text:'Business Name  ·  [City]  ·  Fully Insured',fontFamily:'Inter',fontSize:22,fill:'rgba(255,255,255,0.35)',align:'left',verticalAlign:'middle' }),
        ]) },

      // ── PHOTO-ZONE TEMPLATES (Canva-style — real photo placeholders) ──────────

      { name: 'Plumbing — Photo Hero Card', industry: 'plumbing', category: 'promotional', sort_order: 215,
        canvas_json: mkPage('#1E3689', [
          // Right-side plumber photo — the dominant visual anchor
          img('p1',null,{ x:480,y:0,width:600,height:1080,placeholder:'Add plumber photo',placeholderFill:'rgba(10,18,55,0.65)' }),
          // Left dark overlay for text legibility
          r('ov',null,{ x:0,y:0,width:540,height:1080,fill:'rgba(10,20,80,0.45)' }),
          // Brand badge top-left
          r('badge',null,{ x:40,y:52,width:310,height:52,fill:'rgba(255,255,255,0.12)',cornerRadius:26 }),
          t('brandtxt',null,{ x:40,y:52,width:310,height:52,text:'⚙  Business Name',fontFamily:'Inter',fontSize:17,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          // Headline
          t('h1',null,{ x:40,y:152,width:430,height:56,text:'PROFESSIONAL',fontFamily:'Inter',fontSize:44,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('h2',null,{ x:40,y:208,width:430,height:148,text:'PLUMBING',fontFamily:'Inter',fontSize:124,fontStyle:'bold',fill:'#FFC107',align:'left',verticalAlign:'middle' }),
          t('h3',null,{ x:40,y:354,width:430,height:112,text:'SERVICES',fontFamily:'Inter',fontSize:92,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          // Three circular service photo zones
          img('c1',null,{ x:42,y:506,width:152,height:152,frameType:'circle',placeholder:'Pipes',placeholderFill:'rgba(255,255,255,0.10)' }),
          img('c2',null,{ x:212,y:506,width:152,height:152,frameType:'circle',placeholder:'Drains',placeholderFill:'rgba(255,255,255,0.10)' }),
          img('c3',null,{ x:382,y:506,width:152,height:152,frameType:'circle',placeholder:'Water heater',placeholderFill:'rgba(255,255,255,0.10)' }),
          // White footer strip
          r('foot',null,{ x:0,y:1080,width:1080,height:270,fill:'#EEF2FF' }),
          // 24 / EMERGENCY SERVICES block (left)
          t('e24',null,{ x:40,y:1098,width:110,height:80,text:'24',fontFamily:'Inter',fontSize:76,fontStyle:'bold',fill:'#1E3689',align:'left',verticalAlign:'middle' }),
          t('emrg',null,{ x:152,y:1106,width:220,height:64,text:'EMERGENCY\nSERVICES',fontFamily:'Inter',fontSize:20,fontStyle:'bold',fill:'#1E3689',align:'left',verticalAlign:'middle',lineHeight:1.25 }),
          r('div',null,{ x:398,y:1108,width:2,height:100,fill:'rgba(30,54,137,0.18)' }),
          // CALL NOW + phone (right of divider)
          t('callnow',null,{ x:416,y:1108,width:260,height:36,text:'CALL NOW!',fontFamily:'Inter',fontSize:21,fontStyle:'bold',fill:'#1E3689',align:'left',verticalAlign:'middle' }),
          t('phone',null,{ x:416,y:1150,width:280,height:44,text:'(555) 000-0000',fontFamily:'Inter',fontSize:32,fontStyle:'bold',fill:'#1E3689',align:'left',verticalAlign:'middle' }),
          // Book Now pill button
          r('btn',null,{ x:726,y:1098,width:314,height:84,fill:'#FFC107',cornerRadius:42 }),
          t('btntxt',null,{ x:726,y:1098,width:314,height:84,text:'BOOK NOW →',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'#1E3689',align:'center',verticalAlign:'middle' }),
          // Footer label
          t('ftlbl',null,{ x:40,y:1218,width:1000,height:36,text:'Licensed & Insured  ·  [City]',fontFamily:'Inter',fontSize:17,fill:'rgba(30,54,137,0.42)',align:'center',verticalAlign:'middle' }),
        ]) },

      { name: 'Plumbing — Clean Split Card', industry: 'plumbing', category: 'social-proof', sort_order: 216,
        canvas_json: mkPage('#ffffff', [
          // Right photo zone — plumber in action
          img('p1',null,{ x:540,y:0,width:540,height:860,placeholder:'Plumber photo',placeholderFill:'rgba(50,80,160,0.18)' }),
          // Subtle right-panel tint for photo readability
          r('tint',null,{ x:540,y:0,width:540,height:860,fill:'rgba(30,54,137,0.08)' }),
          // Brand logo badge (top right)
          r('badge',null,{ x:730,y:42,width:270,height:52,fill:'rgba(30,54,137,0.90)',cornerRadius:26 }),
          t('brand',null,{ x:730,y:42,width:270,height:52,text:'⚙  LARANA CO.',fontFamily:'Inter',fontSize:17,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          // Left content
          t('h1',null,{ x:40,y:100,width:480,height:128,text:'Plumbing',fontFamily:'Inter',fontSize:106,fontStyle:'bold',fill:'#1a1a2e',align:'left',verticalAlign:'middle' }),
          t('h2',null,{ x:40,y:228,width:480,height:108,text:'Solutions',fontFamily:'Inter',fontSize:90,fontStyle:'bold',fill:'#2563EB',align:'left',verticalAlign:'middle' }),
          t('h3',null,{ x:40,y:334,width:480,height:108,text:'Specialists',fontFamily:'Inter',fontSize:90,fontStyle:'bold',fill:'#1a1a2e',align:'left',verticalAlign:'middle' }),
          // Service list card (dark pill)
          r('scard',null,{ x:40,y:484,width:480,height:310,fill:'rgba(15,20,40,0.88)',cornerRadius:18 }),
          t('s1',null,{ x:68,y:506,width:200,height:40,text:'🔧  Pipe Installation',fontFamily:'Inter',fontSize:19,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('s2',null,{ x:68,y:554,width:200,height:40,text:'🚿  Shower Install',fontFamily:'Inter',fontSize:19,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('s3',null,{ x:68,y:602,width:200,height:40,text:'🪠  Blocked Drains',fontFamily:'Inter',fontSize:19,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('s4',null,{ x:300,y:506,width:200,height:40,text:'🌊  Drain Cleaning',fontFamily:'Inter',fontSize:19,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('s5',null,{ x:300,y:554,width:200,height:40,text:'❄  Frozen Pipes',fontFamily:'Inter',fontSize:19,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('s6',null,{ x:300,y:602,width:200,height:40,text:'⚡  Emergency',fontFamily:'Inter',fontSize:19,fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          r('div2',null,{ x:68,y:654,width:424,height:1,fill:'rgba(255,255,255,0.12)' }),
          t('slbl',null,{ x:68,y:664,width:424,height:36,text:'24/7 · Licensed & Insured · Background Checked',fontFamily:'Inter',fontSize:14,fill:'rgba(255,255,255,0.42)',align:'center',verticalAlign:'middle' }),
          // Dark bottom bar
          r('bbar',null,{ x:0,y:860,width:1080,height:490,fill:'#1B2A5E' }),
          // Contact button
          r('ctabtn',null,{ x:40,y:894,width:340,height:74,fill:'#E86F2C',cornerRadius:37 }),
          t('ctatxt',null,{ x:40,y:894,width:340,height:74,text:'CONTACT US  →',fontFamily:'Inter',fontSize:24,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          // Discount badge
          r('disc',null,{ x:450,y:882,width:168,height:100,fill:'#E74C3C',cornerRadius:10 }),
          t('dpct',null,{ x:450,y:888,width:168,height:56,text:'35%\nOFF',fontFamily:'Inter',fontSize:30,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle',lineHeight:1.1 }),
          r('salebadge',null,{ x:450,y:958,width:168,height:32,fill:'rgba(0,0,0,0.30)',cornerRadius:6 }),
          t('saletxt',null,{ x:450,y:958,width:168,height:32,text:'SALE!',fontFamily:'Inter',fontSize:15,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('formemb',null,{ x:634,y:894,width:260,height:88,text:'FOR NEW\nMEMBER',fontFamily:'Inter',fontSize:28,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle',lineHeight:1.2 }),
          // Contact row
          r('ctrow',null,{ x:0,y:1240,width:1080,height:110,fill:'rgba(0,0,0,0.25)' }),
          t('ph2',null,{ x:40,y:1255,width:300,height:40,text:'📱  (555) 000-0000',fontFamily:'Inter',fontSize:19,fill:'rgba(255,255,255,0.72)',align:'left',verticalAlign:'middle' }),
          t('ig',null,{ x:390,y:1255,width:300,height:40,text:'📷  @businessname',fontFamily:'Inter',fontSize:19,fill:'rgba(255,255,255,0.72)',align:'left',verticalAlign:'middle' }),
          t('web',null,{ x:740,y:1255,width:300,height:40,text:'🌐  yoursite.com',fontFamily:'Inter',fontSize:19,fill:'rgba(255,255,255,0.72)',align:'left',verticalAlign:'middle' }),
        ]) },

      { name: 'Plumbing — Expert Banner Card', industry: 'plumbing', category: 'announcement', sort_order: 217,
        canvas_json: mkPage('#3B82F6', [
          // Full-width photo zone (top ~55%) — plumber portrait or job shot
          img('p1',null,{ x:0,y:0,width:1080,height:740,placeholder:'Add plumber / job photo',placeholderFill:'rgba(20,40,100,0.55)' }),
          // Orange header strip across top (brand identity bar)
          r('topbar',null,{ x:0,y:0,width:1080,height:100,fill:'#F97316' }),
          t('brandtag',null,{ x:0,y:0,width:600,height:100,text:'⚙  Wardiere Inc.',fontFamily:'Inter',fontSize:28,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle',x:40 }),
          // Main title block overlaid on photo bottom
          r('tblock',null,{ x:0,y:600,width:700,height:140,fill:'#F97316' }),
          t('main1',null,{ x:20,y:608,width:680,height:62,text:'YOUR GO-TO',fontFamily:'Inter',fontSize:52,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          t('main2',null,{ x:20,y:668,width:680,height:72,text:'PLUMBING EXPERTS',fontFamily:'Inter',fontSize:52,fontStyle:'bold',fill:'#ffffff',align:'left',verticalAlign:'middle' }),
          // Blue info band
          r('blueband',null,{ x:0,y:740,width:1080,height:200,fill:'#3B82F6' }),
          t('body',null,{ x:40,y:754,width:1000,height:100,text:'From quick repairs to full installations, we\'re your go-to plumbing experts you can count on anytime.',fontFamily:'Inter',fontSize:28,fill:'rgba(255,255,255,0.88)',align:'left',verticalAlign:'middle',lineHeight:1.45 }),
          // 4 service icon circles
          r('irow',null,{ x:0,y:940,width:1080,height:270,fill:'rgba(20,50,140,0.90)' }),
          r('ic1bg',null,{ x:80,y:970,width:180,height:180,fill:'#F97316',cornerRadius:90 }),
          t('ic1',null,{ x:80,y:970,width:180,height:180,text:'⚙',fontFamily:'Inter',fontSize:80,fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('ic1l',null,{ x:60,y:1158,width:220,height:38,text:'Leak Repair',fontFamily:'Inter',fontSize:19,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          r('ic2bg',null,{ x:300,y:970,width:180,height:180,fill:'#F97316',cornerRadius:90 }),
          t('ic2',null,{ x:300,y:970,width:180,height:180,text:'🔧',fontFamily:'Inter',fontSize:80,fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('ic2l',null,{ x:280,y:1158,width:220,height:38,text:'Drain Clearing',fontFamily:'Inter',fontSize:19,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          r('ic3bg',null,{ x:520,y:970,width:180,height:180,fill:'#F97316',cornerRadius:90 }),
          t('ic3',null,{ x:520,y:970,width:180,height:180,text:'🚿',fontFamily:'Inter',fontSize:80,fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('ic3l',null,{ x:500,y:1158,width:220,height:38,text:'Water Heater',fontFamily:'Inter',fontSize:19,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          r('ic4bg',null,{ x:740,y:970,width:180,height:180,fill:'#F97316',cornerRadius:90 }),
          t('ic4',null,{ x:740,y:970,width:180,height:180,text:'🪠',fontFamily:'Inter',fontSize:80,fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          t('ic4l',null,{ x:720,y:1158,width:220,height:38,text:'Pipe Upgrades',fontFamily:'Inter',fontSize:19,fontStyle:'bold',fill:'#ffffff',align:'center',verticalAlign:'middle' }),
          // Footer contact bar
          r('ftbar',null,{ x:0,y:1210,width:1080,height:140,fill:'rgba(10,20,70,0.90)' }),
          t('ftph',null,{ x:40,y:1230,width:280,height:40,text:'📞  (555) 000-0000',fontFamily:'Inter',fontSize:19,fill:'rgba(255,255,255,0.70)',align:'left',verticalAlign:'middle' }),
          t('ftweb',null,{ x:390,y:1230,width:300,height:40,text:'🌐  yoursite.com',fontFamily:'Inter',fontSize:19,fill:'rgba(255,255,255,0.70)',align:'left',verticalAlign:'middle' }),
          t('ftem',null,{ x:750,y:1230,width:290,height:40,text:'✉  hello@business.com',fontFamily:'Inter',fontSize:17,fill:'rgba(255,255,255,0.70)',align:'left',verticalAlign:'middle' }),
          t('city',null,{ x:40,y:1278,width:1000,height:36,text:'Business Name  ·  [City]  ·  Licensed & Insured',fontFamily:'Inter',fontSize:18,fill:'rgba(255,255,255,0.32)',align:'center',verticalAlign:'middle' }),
        ]) },

      { name: 'Plumbing — Diagonal Services Card', industry: 'plumbing', category: 'educational', sort_order: 218,
        canvas_json: mkPage('#ffffff', [
          // Navy diagonal band (rotated rect — creates the angular split)
          r('diag',null,{ x:-200,y:480,width:1000,height:700,fill:'#1B2A5E',rotation:-18 }),
          // Top right: circular photo zone (plumber portrait)
          img('p1',null,{ x:560,y:30,width:460,height:460,frameType:'circle',placeholder:'Your photo',placeholderFill:'rgba(30,50,140,0.20)' }),
          // Yellow dot grid decoration (top right corner)
          t('dot',null,{ x:890,y:40,width:160,height:160,text:'· · · ·\n· · · ·\n· · · ·\n· · · ·',fontFamily:'Inter',fontSize:24,fill:'rgba(30,54,137,0.18)',align:'left',verticalAlign:'top',lineHeight:1.8 }),
          // Left: big headline on white
          t('h1',null,{ x:40,y:60,width:500,height:60,text:'WE ARE EXPERTS IN THE FIELD',fontFamily:'Inter',fontSize:22,fontStyle:'bold',fill:'rgba(30,54,137,0.60)',align:'left',verticalAlign:'middle' }),
          t('h2',null,{ x:40,y:134,width:500,height:148,text:'PLUMBING',fontFamily:'Inter',fontSize:122,fontStyle:'bold',fill:'#1B2A5E',align:'left',verticalAlign:'middle' }),
          t('h3',null,{ x:40,y:278,width:500,height:108,text:'SERVICES',fontFamily:'Inter',fontSize:90,fontStyle:'bold',fill:'#FFC107',align:'left',verticalAlign:'middle' }),
          // White checklist panel on right (overlaid on diagonal)
          r('chkpanel',null,{ x:560,y:640,width:480,height:380,fill:'rgba(255,255,255,0.97)',cornerRadius:16 }),
          t('chkhdr',null,{ x:580,y:660,width:440,height:36,text:'WHAT WE OFFER',fontFamily:'Inter',fontSize:16,fontStyle:'bold',fill:'#1B2A5E',align:'left',verticalAlign:'middle' }),
          r('chkdiv',null,{ x:580,y:702,width:440,height:1,fill:'rgba(30,54,137,0.12)' }),
          t('ck1',null,{ x:580,y:714,width:440,height:44,text:'Pipe Installation Services   ✅',fontFamily:'Inter',fontSize:21,fill:'#1B2A5E',align:'left',verticalAlign:'middle' }),
          t('ck2',null,{ x:580,y:762,width:440,height:44,text:'Plumbing Repair Solutions   ✅',fontFamily:'Inter',fontSize:21,fill:'#1B2A5E',align:'left',verticalAlign:'middle' }),
          t('ck3',null,{ x:580,y:810,width:440,height:44,text:'24/7 Emergency Plumbing   ✅',fontFamily:'Inter',fontSize:21,fill:'#1B2A5E',align:'left',verticalAlign:'middle' }),
          t('ck4',null,{ x:580,y:858,width:440,height:44,text:'Drain & Sewer Services   ✅',fontFamily:'Inter',fontSize:21,fill:'#1B2A5E',align:'left',verticalAlign:'middle' }),
          r('chkbtm',null,{ x:580,y:906,width:440,height:1,fill:'rgba(30,54,137,0.10)' }),
          t('chkft',null,{ x:580,y:918,width:440,height:36,text:'Licensed  ·  Insured  ·  Background Checked',fontFamily:'Inter',fontSize:14,fill:'rgba(30,54,137,0.45)',align:'center',verticalAlign:'middle' }),
          // Phone CTA bar (bottom left — on the diagonal)
          r('phonebar',null,{ x:40,y:1062,width:480,height:88,fill:'#FFC107',cornerRadius:14 }),
          t('phonetxt',null,{ x:40,y:1062,width:480,height:88,text:'📞  CONTACT US   (555) 000-0000',fontFamily:'Inter',fontSize:24,fontStyle:'bold',fill:'#1B2A5E',align:'center',verticalAlign:'middle' }),
          // Address footer
          r('addrbar',null,{ x:0,y:1280,width:1080,height:70,fill:'rgba(27,42,94,0.06)' }),
          t('addr',null,{ x:40,y:1295,width:1000,height:40,text:'📍  123 Anywhere St., [City]  ·  yoursite.com',fontFamily:'Inter',fontSize:18,fill:'rgba(30,54,137,0.55)',align:'center',verticalAlign:'middle' }),
        ]) },

      { name: 'Plumbing — Emergency Yellow Bold', industry: 'plumbing', category: 'announcement', sort_order: 219,
        canvas_json: mkPage('#FFC300', [
          // Navy blob decorations (organic rounded rects, slightly rotated)
          r('blob1',null,{ x:700,y:-120,width:580,height:580,fill:'#1B2A5E',cornerRadius:290,rotation:20,opacity:0.90 }),
          r('blob2',null,{ x:820,y:900,width:400,height:400,fill:'#1B2A5E',cornerRadius:200,rotation:-15,opacity:0.85 }),
          // Large rectangular photo zone — top section
          img('p1',null,{ x:40,y:40,width:620,height:440,placeholder:'Add job site photo',placeholderFill:'rgba(20,40,100,0.22)',cornerRadius:14 }),
          // Circular photo zone — mid right (service close-up)
          img('p2',null,{ x:700,y:260,width:320,height:320,frameType:'circle',placeholder:'Service photo',placeholderFill:'rgba(20,40,100,0.22)' }),
          // Big editorial headline
          t('h1',null,{ x:40,y:520,width:660,height:130,text:'Emergency',fontFamily:'Inter',fontSize:110,fontStyle:'bold',fill:'#1B2A5E',align:'left',verticalAlign:'middle' }),
          t('h2',null,{ x:40,y:648,width:660,height:130,text:'Plumbing',fontFamily:'Inter',fontSize:110,fontStyle:'bold',fill:'#1B2A5E',align:'left',verticalAlign:'middle' }),
          t('h3',null,{ x:40,y:776,width:660,height:108,text:'Services',fontFamily:'Inter',fontSize:90,fontStyle:'bold',fill:'#1B2A5E',align:'left',verticalAlign:'middle' }),
          // Sub-copy
          t('body',null,{ x:40,y:904,width:620,height:100,text:'Count on us for immediate assistance with any plumbing emergency, day or night, to restore comfort to your home.',fontFamily:'Inter',fontSize:23,fill:'rgba(27,42,94,0.70)',align:'left',verticalAlign:'top',lineHeight:1.5 }),
          // Plumber icon (decorative)
          t('icon',null,{ x:40,y:1070,width:80,height:80,text:'🔧',fontFamily:'Inter',fontSize:64,fill:'rgba(27,42,94,0.55)',align:'center',verticalAlign:'middle' }),
          t('dots',null,{ x:40,y:1040,width:80,height:26,text:'+ + +',fontFamily:'Inter',fontSize:18,fill:'rgba(27,42,94,0.38)',align:'center',verticalAlign:'middle' }),
          // Call for details block (right side lower)
          r('callbox',null,{ x:720,y:636,width:320,height:130,fill:'rgba(27,42,94,0.08)',cornerRadius:12 }),
          t('callhdr',null,{ x:730,y:650,width:300,height:36,text:'📞  CALL FOR DETAILS',fontFamily:'Inter',fontSize:17,fontStyle:'bold',fill:'#1B2A5E',align:'left',verticalAlign:'middle' }),
          t('callph',null,{ x:730,y:694,width:300,height:40,text:'(555) 000-0000',fontFamily:'Inter',fontSize:28,fontStyle:'bold',fill:'#1B2A5E',align:'left',verticalAlign:'middle' }),
          // Location block
          r('locbox',null,{ x:720,y:784,width:320,height:110,fill:'rgba(27,42,94,0.08)',cornerRadius:12 }),
          t('lochdr',null,{ x:730,y:798,width:300,height:36,text:'📍  BUSINESS NAME',fontFamily:'Inter',fontSize:17,fontStyle:'bold',fill:'#1B2A5E',align:'left',verticalAlign:'middle' }),
          t('locaddr',null,{ x:730,y:840,width:300,height:44,text:'123 Main St., [City]',fontFamily:'Inter',fontSize:20,fill:'rgba(27,42,94,0.65)',align:'left',verticalAlign:'middle' }),
          // Footer
          t('ftlbl',null,{ x:40,y:1290,width:1000,height:40,text:'Licensed & Insured  ·  Background Checked  ·  24/7',fontFamily:'Inter',fontSize:18,fill:'rgba(27,42,94,0.50)',align:'center',verticalAlign:'middle' }),
        ]) },

    ];

    let inserted = 0;
    for (const tmpl of ALL_TEMPLATES) {
      const existing = await pool.query('SELECT id FROM canvas_templates WHERE name = $1', [tmpl.name]);
      if (existing.rows.length === 0) {
        await pool.query(
          `INSERT INTO canvas_templates (name, industry, category, canvas_json, canvas_width, canvas_height, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [tmpl.name, tmpl.industry, tmpl.category, JSON.stringify(tmpl.canvas_json), 1080, 1350, tmpl.sort_order]
        );
        inserted++;
      } else {
        // Always sync industry/category/sort_order so stale DB rows from old seeds get corrected
        await pool.query(
          `UPDATE canvas_templates SET industry = $1, category = $2, sort_order = $3 WHERE name = $4`,
          [tmpl.industry, tmpl.category, tmpl.sort_order, tmpl.name]
        );
      }
    }
    // Remove the old generic seed templates that got replaced with better versions
    await pool.query(`DELETE FROM canvas_templates WHERE name IN ('Bold Social Post','Educational Tip','Before & After','Customer Review','Seasonal Alert','Promo Offer') AND thumbnail_url IS NULL AND sort_order < 10`);
    // Fix legacy templates that stored text content under 'content' key instead of 'text' key (Konva renders el.text)
    try {
      await pool.query(`UPDATE canvas_templates SET canvas_json = replace(canvas_json::text, '"content":', '"text":')::jsonb WHERE canvas_json::text LIKE '%"content":%'`);
    } catch (e) { console.warn('[Seed] canvas_templates content→text migration skipped:', e.message.substring(0, 80)); }
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
const uploadLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: 'Too many uploads — please slow down.' }, standardHeaders: true, legacyHeaders: false });
const geoLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { error: 'Too many AI Visibility checks — wait an hour before running another.' }, standardHeaders: true, legacyHeaders: false });
const inviteLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: { error: 'Too many invites sent — wait an hour.' }, standardHeaders: true, legacyHeaders: false });
const publishLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, message: { error: 'Too many publish attempts — please slow down.' }, standardHeaders: true, legacyHeaders: false });
const studioLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, message: { error: 'Studio generation limit reached — wait an hour.' }, standardHeaders: true, legacyHeaders: false });
const adminBroadcastLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { error: 'Broadcast rate limit — max 5 per hour.' }, standardHeaders: true, legacyHeaders: false });

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', passwordResetLimiter);
app.use('/api/wizard/generate', generationLimiter);
app.use('/api/wizard/refresh', generationLimiter);
app.use('/api/wizard/regenerate-image', generationLimiter);
app.use('/api/content/generate', generationLimiter);
app.use('/api/v1/generate', generationLimiter);
app.use('/api/media/upload', uploadLimiter);
app.use('/api/customers/upload-asset', uploadLimiter);
app.use('/api/geo/audit', geoLimiter);
app.use('/api/customers/invite', inviteLimiter);
app.use('/api/social/publish', publishLimiter);
app.use('/api/studio/generate', studioLimiter);
app.use('/api/studio/remove-background', studioLimiter);
app.use('/api/admin/broadcast', adminBroadcastLimiter);

const corsMiddleware = cors({
  origin: (origin, cb) => {
    const allowed = (process.env.FRONTEND_URL || 'http://localhost:5000').split(',').map(s => s.trim());
    if (!origin) {
      // In production require an Origin header; allow curl/tools locally
      if (process.env.NODE_ENV === 'production') return cb(new Error('Origin header required'));
      return cb(null, true);
    }
    // Always allow any localhost port — real production servers never receive localhost origins from browsers
    if (/^http:\/\/localhost:\d+$/.test(origin)) {
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
app.use('/api/templates', templateRoutes(pool));
app.use('/api/geo', geoRoutes(pool));
app.use('/api/studio', studioRoutes(pool));
app.use('/api/receptionist', receptionistRoutes(pool));
app.use('/api/api-keys', apiKeysRoutes(pool));
app.use('/api/v1', externalRoutes(pool));
app.use('/api/gmb', gmbMessagesRoutes(pool));
app.use('/api/ideas', ideasRoutes(pool));
app.use('/api/calendar-plans', calendarPlansRoutes(pool));
app.use('/api/referrals', referralsRoutes(pool));


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

// Onboarding email sequence — runs daily at 9am UTC
const OnboardingEmailService = require('./services/OnboardingEmailService');
const onboardingEmailService = new OnboardingEmailService(pool);
cron.schedule('0 9 * * *', async () => {
  console.log('[Onboarding] Daily email sequence run starting...');
  try { await onboardingEmailService.runDailySequence(); }
  catch (e) { console.error('[Onboarding] Daily sequence error:', e.message); }
});
console.log('📧 Onboarding email sequence cron scheduled (daily 9am UTC)');

// Testimonial Machine — runs every Monday and Thursday at 10am UTC
const TestimonialMachine = require('./services/TestimonialMachine');
const testimonialMachine = new TestimonialMachine(pool);
cron.schedule('0 10 * * 1,4', async () => {
  console.log('[TestimonialMachine] Running biweekly testimonial generation...');
  try { await testimonialMachine.runForAllEligible(); }
  catch (e) { console.error('[TestimonialMachine] Error:', e.message); }
});
console.log('⭐ Testimonial Machine cron scheduled (Mon+Thu 10am UTC)');

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
