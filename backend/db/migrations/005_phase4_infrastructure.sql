-- ============================================================
-- Migration 005: Phase 4 Infrastructure
-- backend/db/migrations/005_phase4_infrastructure.sql
--
-- Run ONCE against Railway PostgreSQL.
-- Safe to re-run: all statements use IF NOT EXISTS / DO blocks.
-- ============================================================

-- ── Upgrade scheduled_date to TIMESTAMPTZ (idempotent) ───────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts'
      AND column_name = 'scheduled_date'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE posts
      ALTER COLUMN scheduled_date TYPE TIMESTAMPTZ
      USING scheduled_date AT TIME ZONE 'UTC';
  END IF;
END
$$;

-- Store the customer's IANA timezone at scheduling time (so the display
-- is always correct even if the customer later changes their timezone)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS scheduled_timezone VARCHAR(100) DEFAULT 'UTC';

-- ── Ensure timezone column exists on customers ────────────────────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'UTC';

-- ── content_suggestions: add status column before creating index ──────────────
ALTER TABLE content_suggestions
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';

ALTER TABLE content_suggestions
  ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_suggestions_pending_notify
  ON content_suggestions (customer_id, created_at DESC)
  WHERE status = 'pending';

-- ── inbox_messages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inbox_messages (
  id              SERIAL PRIMARY KEY,
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  post_id         INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  platform        VARCHAR(50) NOT NULL,
  message_type    VARCHAR(50) NOT NULL DEFAULT 'comment', -- comment | reply | mention
  sender_name     VARCHAR(255),
  sender_id       VARCHAR(255),
  message_text    TEXT,
  is_read         BOOLEAN DEFAULT false,
  replied_at      TIMESTAMP,
  external_id     VARCHAR(255),
  raw_payload     JSONB,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_customer_unread
  ON inbox_messages (customer_id, is_read, created_at DESC);

-- ── posting_analytics (best time to post data) ────────────────────────────────
CREATE TABLE IF NOT EXISTS posting_analytics (
  id              SERIAL PRIMARY KEY,
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  platform        VARCHAR(50) NOT NULL,
  hour_of_day     SMALLINT NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  day_of_week     SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  avg_engagement  NUMERIC(10,4) DEFAULT 0,
  post_count      INTEGER DEFAULT 0,
  last_updated    TIMESTAMP DEFAULT NOW(),
  UNIQUE (customer_id, platform, hour_of_day, day_of_week)
);

-- ── hashtag_performance ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hashtag_performance (
  id              SERIAL PRIMARY KEY,
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  hashtag         VARCHAR(150) NOT NULL,
  platform        VARCHAR(50) NOT NULL,
  times_used      INTEGER DEFAULT 1,
  total_likes     INTEGER DEFAULT 0,
  total_comments  INTEGER DEFAULT 0,
  avg_engagement  NUMERIC(10,4) DEFAULT 0,
  last_used_at    TIMESTAMP DEFAULT NOW(),
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE (customer_id, hashtag, platform)
);

CREATE INDEX IF NOT EXISTS idx_hashtag_perf_customer
  ON hashtag_performance (customer_id, avg_engagement DESC);

-- ── monthly_reports ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monthly_reports (
  id              SERIAL PRIMARY KEY,
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  report_month    DATE NOT NULL,               -- first day of the month
  posts_published INTEGER DEFAULT 0,
  total_reach     INTEGER DEFAULT 0,
  total_engagement INTEGER DEFAULT 0,
  best_post_id    INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  report_json     JSONB,
  email_sent_at   TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE (customer_id, report_month)
);

-- ── postcore_briefings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS postcore_briefings (
  id              SERIAL PRIMARY KEY,
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  briefing_date   DATE NOT NULL,
  briefing_text   TEXT NOT NULL,
  briefing_json   JSONB,
  is_read         BOOLEAN DEFAULT false,
  email_sent_at   TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE (customer_id, briefing_date)
);

CREATE INDEX IF NOT EXISTS idx_briefings_customer_unread
  ON postcore_briefings (customer_id, is_read, briefing_date DESC);

SELECT 'Migration 005 complete — Phase 4 infrastructure tables created' AS status;
