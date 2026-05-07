-- ============================================================
-- ItsPosting — Combined Safe Migration
-- Paste this entire file into Railway → Postgres → Data tab.
-- 100% idempotent: safe to run even if some tables already exist.
-- Covers: contacts, dm tables, business_knowledge,
--         postcore_briefings (create or upgrade from old schema),
--         inbox_messages (create or upgrade from old schema)
-- ============================================================

BEGIN;

-- ── SECTION 1: DM Conversations ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dm_conversations (
  id                              SERIAL PRIMARY KEY,
  customer_id                     INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  platform                        VARCHAR(50)  NOT NULL,
  platform_thread_id              VARCHAR(255) NOT NULL,
  sender_platform_id              VARCHAR(255),
  sender_name                     VARCHAR(255),
  sender_profile_pic              TEXT,
  status                          VARCHAR(50)  DEFAULT 'open',
  last_message_at                 TIMESTAMP,
  last_message_preview            TEXT,
  last_message_direction          VARCHAR(20),
  window_expires_at               TIMESTAMP,
  human_agent_window_expires_at   TIMESTAMP,
  is_read                         BOOLEAN      DEFAULT false,
  is_starred                      BOOLEAN      DEFAULT false,
  auto_reply_sent                 BOOLEAN      DEFAULT false,
  intent                          VARCHAR(100),
  urgency                         VARCHAR(20)  DEFAULT 'normal',
  contact_id                      INTEGER,
  created_at                      TIMESTAMP    DEFAULT NOW(),
  updated_at                      TIMESTAMP    DEFAULT NOW(),
  UNIQUE(customer_id, platform, platform_thread_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_conversations_customer
  ON dm_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_dm_conversations_platform
  ON dm_conversations(platform);
CREATE INDEX IF NOT EXISTS idx_dm_conversations_unread
  ON dm_conversations(customer_id, is_read)
  WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_dm_conversations_status
  ON dm_conversations(customer_id, status);

-- ── SECTION 2: DM Messages ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dm_messages (
  id                   SERIAL PRIMARY KEY,
  conversation_id      INTEGER REFERENCES dm_conversations(id) ON DELETE CASCADE,
  customer_id          INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  platform_message_id  VARCHAR(255) UNIQUE,
  direction            VARCHAR(20)  NOT NULL,
  message_text         TEXT,
  attachments          JSONB        DEFAULT '[]'::jsonb,
  status               VARCHAR(50)  DEFAULT 'delivered',
  reply_type           VARCHAR(50),
  ai_generated         BOOLEAN      DEFAULT false,
  ai_draft             TEXT,
  sent_at              TIMESTAMP,
  delivered_at         TIMESTAMP,
  read_at              TIMESTAMP,
  created_at           TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_messages_conversation
  ON dm_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_customer
  ON dm_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_platform_id
  ON dm_messages(platform_message_id);

-- ── SECTION 3: Contacts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id                    SERIAL PRIMARY KEY,
  customer_id           INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  name                  VARCHAR(255),
  email                 VARCHAR(255),
  phone                 VARCHAR(50),
  facebook_psid         VARCHAR(255),
  instagram_igsid       VARCHAR(255),
  profile_pic_url       TEXT,
  source                VARCHAR(50)    DEFAULT 'manual',
  source_platform       VARCHAR(50),
  notes                 TEXT,
  tags                  JSONB          DEFAULT '[]'::jsonb,
  lead_status           VARCHAR(50)    DEFAULT 'new',
  estimated_job_value   DECIMAL(10,2),
  job_type              VARCHAR(100),
  first_contact_at      TIMESTAMP      DEFAULT NOW(),
  last_contact_at       TIMESTAMP,
  total_conversations   INTEGER        DEFAULT 0,
  is_customer           BOOLEAN        DEFAULT false,
  is_blocked            BOOLEAN        DEFAULT false,
  do_not_contact        BOOLEAN        DEFAULT false,
  created_at            TIMESTAMP      DEFAULT NOW(),
  updated_at            TIMESTAMP      DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_customer
  ON contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_status
  ON contacts(customer_id, lead_status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_facebook
  ON contacts(customer_id, facebook_psid)
  WHERE facebook_psid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_instagram
  ON contacts(customer_id, instagram_igsid)
  WHERE instagram_igsid IS NOT NULL;

-- ── SECTION 4: DM Auto Reply Rules ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dm_auto_reply_rules (
  id               SERIAL PRIMARY KEY,
  customer_id      INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  trigger_type     VARCHAR(50) NOT NULL,
  keywords         JSONB       DEFAULT '[]'::jsonb,
  intent           VARCHAR(100),
  reply_text       TEXT        NOT NULL,
  is_active        BOOLEAN     DEFAULT true,
  delay_seconds    INTEGER     DEFAULT 0,
  send_only_once   BOOLEAN     DEFAULT true,
  times_triggered  INTEGER     DEFAULT 0,
  created_at       TIMESTAMP   DEFAULT NOW(),
  updated_at       TIMESTAMP   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_reply_customer
  ON dm_auto_reply_rules(customer_id);
CREATE INDEX IF NOT EXISTS idx_auto_reply_active
  ON dm_auto_reply_rules(customer_id, is_active)
  WHERE is_active = true;

-- ── SECTION 5: DM Sync Log ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dm_sync_log (
  id              SERIAL PRIMARY KEY,
  customer_id     INTEGER   REFERENCES customers(id) ON DELETE CASCADE,
  platform        VARCHAR(50) NOT NULL,
  last_synced_at  TIMESTAMP   DEFAULT NOW(),
  messages_found  INTEGER     DEFAULT 0,
  sync_status     VARCHAR(50) DEFAULT 'success',
  error_message   TEXT,
  UNIQUE(customer_id, platform)
);

-- FK from dm_conversations to contacts (safe — uses ADD COLUMN IF NOT EXISTS)
ALTER TABLE dm_conversations
  ADD COLUMN IF NOT EXISTS contact_id_fk INTEGER REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dm_conversations_contact
  ON dm_conversations(contact_id_fk)
  WHERE contact_id_fk IS NOT NULL;

-- ── SECTION 6: postcore_briefings ────────────────────────────────────────────
-- Creates fresh if absent. If migration 005 already created this table with
-- a different schema (briefing_date, briefing_text, briefing_json columns),
-- the CREATE is a no-op and the ALTER TABLE lines below add the missing columns.
CREATE TABLE IF NOT EXISTS postcore_briefings (
  id            SERIAL PRIMARY KEY,
  customer_id   INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  briefing_data JSONB   NOT NULL DEFAULT '{}'::jsonb,
  week_of       DATE    NOT NULL,
  is_read       BOOLEAN DEFAULT false,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Add columns that the code needs (no-op if they already exist)
ALTER TABLE postcore_briefings
  ADD COLUMN IF NOT EXISTS briefing_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE postcore_briefings
  ADD COLUMN IF NOT EXISTS week_of DATE;
ALTER TABLE postcore_briefings
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Unique index on (customer_id, week_of) — used by ON CONFLICT in PostCoreAdvisor
-- Partial index so existing NULL week_of rows from old schema don't block creation
CREATE UNIQUE INDEX IF NOT EXISTS uq_briefings_customer_week
  ON postcore_briefings(customer_id, week_of)
  WHERE week_of IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_briefings_customer
  ON postcore_briefings(customer_id, is_read, created_at DESC);

-- ── SECTION 7: inbox_messages ─────────────────────────────────────────────────
-- Creates fresh if absent. If migration 005 already created this table with
-- a different schema (no platform_message_id, no received_at), the CREATE is
-- a no-op and the ALTER TABLE lines below add the missing columns.
CREATE TABLE IF NOT EXISTS inbox_messages (
  id                  SERIAL PRIMARY KEY,
  customer_id         INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  platform            VARCHAR(50)  NOT NULL,
  platform_message_id VARCHAR(500),
  post_id             INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  message_type        VARCHAR(50)  DEFAULT 'comment',
  sender_name         VARCHAR(255),
  sender_platform_id  VARCHAR(255),
  message_text        TEXT,
  reply_text          TEXT,
  replied_at          TIMESTAMP,
  is_read             BOOLEAN      DEFAULT false,
  received_at         TIMESTAMP    DEFAULT NOW(),
  created_at          TIMESTAMP    DEFAULT NOW()
);

-- Add columns the route code uses (no-op if they already exist)
ALTER TABLE inbox_messages
  ADD COLUMN IF NOT EXISTS platform_message_id VARCHAR(500);
ALTER TABLE inbox_messages
  ADD COLUMN IF NOT EXISTS sender_platform_id VARCHAR(255);
ALTER TABLE inbox_messages
  ADD COLUMN IF NOT EXISTS reply_text TEXT;
ALTER TABLE inbox_messages
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMP DEFAULT NOW();

-- Backfill received_at from created_at for any existing rows
UPDATE inbox_messages
  SET received_at = created_at
  WHERE received_at IS NULL AND created_at IS NOT NULL;

-- Unique index on platform_message_id — required for ON CONFLICT in sync route
CREATE UNIQUE INDEX IF NOT EXISTS uq_inbox_platform_message_id
  ON inbox_messages(platform_message_id)
  WHERE platform_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inbox_customer_unread
  ON inbox_messages(customer_id, is_read, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_platform
  ON inbox_messages(customer_id, platform);

-- ── SECTION 8: business_knowledge ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business_knowledge (
  id             SERIAL PRIMARY KEY,
  customer_id    INTEGER      NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  knowledge_type VARCHAR(50)  NOT NULL,
  title          VARCHAR(255) NOT NULL,
  content        TEXT         NOT NULL,
  sort_order     INTEGER      DEFAULT 0,
  is_active      BOOLEAN      DEFAULT true,
  created_at     TIMESTAMP    DEFAULT NOW(),
  updated_at     TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_customer
  ON business_knowledge(customer_id, knowledge_type, is_active);

-- ── SECTION 9: monthly_reports ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monthly_reports (
  id               SERIAL PRIMARY KEY,
  customer_id      INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  report_month     DATE    NOT NULL,
  posts_published  INTEGER DEFAULT 0,
  total_reach      INTEGER DEFAULT 0,
  total_engagement INTEGER DEFAULT 0,
  best_post_id     INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  report_json      JSONB,
  email_sent_at    TIMESTAMP,
  created_at       TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_id, report_month)
);

-- ── SECTION 10: posting_analytics ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posting_analytics (
  id             SERIAL PRIMARY KEY,
  customer_id    INTEGER  NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  platform       VARCHAR(50) NOT NULL,
  hour_of_day    SMALLINT    NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  day_of_week    SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  avg_engagement NUMERIC(10,4) DEFAULT 0,
  post_count     INTEGER       DEFAULT 0,
  last_updated   TIMESTAMP     DEFAULT NOW(),
  UNIQUE(customer_id, platform, hour_of_day, day_of_week)
);

-- ── SECTION 11: hashtag_performance ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hashtag_performance (
  id             SERIAL PRIMARY KEY,
  customer_id    INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  hashtag        VARCHAR(150) NOT NULL,
  platform       VARCHAR(50)  NOT NULL,
  times_used     INTEGER      DEFAULT 1,
  total_likes    INTEGER      DEFAULT 0,
  total_comments INTEGER      DEFAULT 0,
  avg_engagement NUMERIC(10,4) DEFAULT 0,
  last_used_at   TIMESTAMP    DEFAULT NOW(),
  created_at     TIMESTAMP    DEFAULT NOW(),
  UNIQUE(customer_id, hashtag, platform)
);

CREATE INDEX IF NOT EXISTS idx_hashtag_perf_customer
  ON hashtag_performance(customer_id, avg_engagement DESC);

-- ── SECTION 12: Missing columns on existing tables ────────────────────────────

-- posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS wizard_trigger       VARCHAR(50);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS content_theme        VARCHAR(100);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS scheduled_timezone   VARCHAR(100) DEFAULT 'UTC';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS source               VARCHAR(50)  DEFAULT 'ai_generated';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS uploaded_by_user     BOOLEAN      DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS engagement_by_platform JSONB      DEFAULT '{}'::jsonb;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS performance_score    NUMERIC;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS last_metrics_sync    TIMESTAMP;

-- customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS timezone                     VARCHAR(100) DEFAULT 'UTC';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS posting_streak               INTEGER      DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_posted_at               TIMESTAMP;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_posts_this_month       INTEGER      DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS past_post_examples           TEXT[]       DEFAULT '{}';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS content_preferences          JSONB        DEFAULT '{}'::jsonb;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_admin                     BOOLEAN      DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS role                         VARCHAR(50)  DEFAULT 'customer';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS suspended                    BOOLEAN      DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS suspension_reason            TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lemon_squeezy_customer_id    VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lemon_squeezy_subscription_id VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS plan_expires_at              TIMESTAMP;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS trial_ends_at                TIMESTAMP;

-- content_suggestions (created by migration 002 — add columns 005 expected)
ALTER TABLE content_suggestions ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT false;

-- ── SECTION 13: Backfill + indexes ───────────────────────────────────────────

UPDATE customers SET posting_streak = 0 WHERE posting_streak IS NULL;

UPDATE customers c
  SET last_posted_at = (
    SELECT MAX(posted_at)
    FROM posts p
    WHERE p.customer_id = c.id
      AND p.status = 'posted'
      AND p.posted_at IS NOT NULL
  )
  WHERE c.last_posted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_streak
  ON customers(posting_streak DESC);
CREATE INDEX IF NOT EXISTS idx_posts_content_theme
  ON posts(content_theme);
CREATE INDEX IF NOT EXISTS idx_posts_customer_created
  ON posts(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_pending_notify
  ON content_suggestions(customer_id, created_at DESC)
  WHERE status = 'pending';

-- ── SECTION: Email Queue ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_queue (
  id             SERIAL PRIMARY KEY,
  to_email       VARCHAR(255) NOT NULL,
  subject        VARCHAR(255),
  body_html      TEXT,
  body_text      TEXT,
  template_name  VARCHAR(100),
  template_data  JSONB        DEFAULT '{}'::jsonb,
  status         VARCHAR(50)  DEFAULT 'pending',
  attempts       INTEGER      DEFAULT 0,
  last_error     TEXT,
  scheduled_at   TIMESTAMP    DEFAULT NOW(),
  sent_at        TIMESTAMP,
  created_at     TIMESTAMP    DEFAULT NOW(),
  updated_at     TIMESTAMP    DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_queue_status
  ON email_queue(status, scheduled_at);

-- ── SECTION: Whop Billing Columns ────────────────────────────────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS whop_customer_id    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS whop_membership_id  VARCHAR(255);

-- ── SECTION: Media Library ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media_library (
  id                  SERIAL PRIMARY KEY,
  customer_id         INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  cloudinary_public_id VARCHAR(500),
  url                 TEXT NOT NULL,
  thumbnail_url       TEXT,
  file_name           VARCHAR(255),
  file_type           VARCHAR(50),
  mime_type           VARCHAR(100),
  file_size_bytes     BIGINT    DEFAULT 0,
  width               INTEGER,
  height              INTEGER,
  duration_seconds    NUMERIC,
  folder              VARCHAR(100) DEFAULT 'all',
  used_in_posts       INTEGER   DEFAULT 0,
  last_used_at        TIMESTAMP,
  uploaded_at         TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_library_customer
  ON media_library(customer_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_library_folder
  ON media_library(customer_id, folder);

-- Storage quota columns on customers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS storage_used_bytes  BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_quota_bytes BIGINT DEFAULT 10737418240;

-- ── SECTION: Post Variations ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_variations (
  id             SERIAL PRIMARY KEY,
  post_id        INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  variation_key  VARCHAR(10) NOT NULL,
  caption        TEXT,
  hashtags       JSONB DEFAULT '[]'::jsonb,
  image_prompt   TEXT,
  engagement_question TEXT,
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_variations_post
  ON post_variations(post_id);

COMMIT;

SELECT 'Combined migration complete' AS status;

-- Verify key tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'contacts', 'dm_conversations', 'dm_messages',
    'dm_auto_reply_rules', 'dm_sync_log',
    'postcore_briefings', 'inbox_messages',
    'business_knowledge', 'monthly_reports',
    'posting_analytics', 'hashtag_performance',
    'email_queue', 'media_library', 'post_variations'
  )
ORDER BY table_name;
