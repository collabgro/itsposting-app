-- ============================================================
-- ItsPosting Migration 006: Business Intelligence + Inbox
-- Run ONCE against your Railway PostgreSQL database.
-- All statements are safe to re-run (IF NOT EXISTS).
-- ============================================================

BEGIN;

-- PostCore weekly briefings
CREATE TABLE IF NOT EXISTS postcore_briefings (
  id            SERIAL PRIMARY KEY,
  customer_id   INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  briefing_data JSONB   NOT NULL DEFAULT '{}'::jsonb,
  week_of       DATE    NOT NULL,
  is_read       BOOLEAN DEFAULT false,
  created_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_id, week_of)
);
CREATE INDEX IF NOT EXISTS idx_briefings_customer ON postcore_briefings(customer_id, is_read, week_of DESC);

-- Monthly reports
CREATE TABLE IF NOT EXISTS monthly_reports (
  id            SERIAL PRIMARY KEY,
  customer_id   INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  report_month  INTEGER NOT NULL CHECK (report_month BETWEEN 1 AND 12),
  report_year   INTEGER NOT NULL,
  report_data   JSONB   NOT NULL DEFAULT '{}'::jsonb,
  email_sent    BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_id, report_year, report_month)
);

-- Social inbox messages (Facebook comments, Google reviews)
-- Separate from DMs (dms table). Comments = inbox_messages.
CREATE TABLE IF NOT EXISTS inbox_messages (
  id                  SERIAL PRIMARY KEY,
  customer_id         INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  platform            VARCHAR(50)  NOT NULL,
  platform_message_id VARCHAR(500) NOT NULL,
  post_id             INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  message_type        VARCHAR(50) DEFAULT 'comment',
  sender_name         VARCHAR(255),
  sender_platform_id  VARCHAR(255),
  message_text        TEXT        NOT NULL,
  reply_text          TEXT,
  replied_at          TIMESTAMP,
  is_read             BOOLEAN DEFAULT false,
  received_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMP DEFAULT NOW(),
  UNIQUE(platform_message_id)
);
CREATE INDEX IF NOT EXISTS idx_inbox_customer_unread ON inbox_messages(customer_id, is_read, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_platform ON inbox_messages(customer_id, platform);

-- Business knowledge base
CREATE TABLE IF NOT EXISTS business_knowledge (
  id             SERIAL PRIMARY KEY,
  customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  knowledge_type VARCHAR(50) NOT NULL,
  title          VARCHAR(255) NOT NULL,
  content        TEXT NOT NULL,
  sort_order     INTEGER DEFAULT 0,
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_knowledge_customer ON business_knowledge(customer_id, knowledge_type, is_active);

-- Add wizard_trigger column to posts if missing (used by content mix analysis)
DO $$ BEGIN
  ALTER TABLE posts ADD COLUMN wizard_trigger VARCHAR(50);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

COMMIT;

SELECT 'Migration 006 complete' AS status;
