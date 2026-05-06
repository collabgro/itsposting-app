-- Migration 002: Suggestions Engine
-- Run ONCE against Railway PostgreSQL before deploying.
-- Safe to re-run — all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.

-- ── 1. Add missing columns to customers ──────────────────────────────────────

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS posting_streak                INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_posted_at                TIMESTAMP,
  ADD COLUMN IF NOT EXISTS total_posts_this_month        INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS past_post_examples            TEXT[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS content_preferences           JSONB       DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_admin                      BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS role                          VARCHAR(50) DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS suspended                     BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspension_reason             TEXT,
  ADD COLUMN IF NOT EXISTS lemon_squeezy_customer_id     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS lemon_squeezy_subscription_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS plan_expires_at               TIMESTAMP;

-- ── 2. Add missing columns to posts ──────────────────────────────────────────

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS scheduled_timezone      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS source                  VARCHAR(50)  DEFAULT 'ai_generated',
  ADD COLUMN IF NOT EXISTS uploaded_by_user        BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS engagement_by_platform  JSONB        DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS performance_score       NUMERIC,
  ADD COLUMN IF NOT EXISTS last_metrics_sync       TIMESTAMP;

-- ── 3. content_suggestions table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS content_suggestions (
  id                    SERIAL PRIMARY KEY,
  customer_id           INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type                  VARCHAR(50)  NOT NULL, -- seasonal | streak | content_gap | milestone
  title                 TEXT         NOT NULL,
  reason                TEXT         NOT NULL, -- PostCore WHY before WHAT
  pre_generated_caption TEXT,                  -- JSON: { caption, hashtags, imagePrompt }
  platform              VARCHAR(50)  DEFAULT 'facebook',
  content_type          VARCHAR(50)  DEFAULT 'educational_tip',
  reference_key         VARCHAR(255) NOT NULL, -- dedup key e.g. seasonal_2026_05
  status                VARCHAR(50)  DEFAULT 'pending', -- pending | dismissed | used | expired
  expires_at            TIMESTAMP,
  created_at            TIMESTAMP    DEFAULT NOW(),
  updated_at            TIMESTAMP    DEFAULT NOW(),
  UNIQUE (customer_id, reference_key)
);

CREATE INDEX IF NOT EXISTS idx_suggestions_customer        ON content_suggestions (customer_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status          ON content_suggestions (status);
CREATE INDEX IF NOT EXISTS idx_suggestions_expires         ON content_suggestions (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suggestions_customer_status ON content_suggestions (customer_id, status) WHERE status = 'pending';

-- ── 4. Auto-update updated_at trigger ────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_suggestions_updated_at ON content_suggestions;
CREATE TRIGGER set_suggestions_updated_at
  BEFORE UPDATE ON content_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

SELECT 'Migration 002 complete — content_suggestions table ready' AS status;
