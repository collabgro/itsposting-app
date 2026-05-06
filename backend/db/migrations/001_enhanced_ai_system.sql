-- ============================================================
-- ItsPosting Migration 001: Enhanced AI Content System
-- Run this ONCE against your existing database.
-- All statements use IF NOT EXISTS / DO blocks — safe to re-run.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. CUSTOMERS TABLE — new columns for AI personalisation
-- ============================================================

-- Voice calibration: store 3-5 of their best past posts as
-- few-shot examples for Claude. The AI mimics their style.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS past_post_examples TEXT[] DEFAULT '{}';

-- Content preference ratios — defaults enforce the 70/20/10 rule.
-- Structure: { educational: 70, social_proof: 20, promotional: 10 }
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS content_preferences JSONB
    DEFAULT '{"educational":70,"social_proof":20,"promotional":10}'::jsonb;

-- Posting streak tracking for PostCore streak nudges.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS posting_streak INTEGER DEFAULT 0;

-- Last time they published a post — drives streak calculations.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS last_posted_at TIMESTAMP;

-- Rolling monthly post count — reset by a cron on 1st of each month.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS total_posts_this_month INTEGER DEFAULT 0;

-- Admin/role columns (from CLAUDE.md — may already exist, safe to re-add)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'customer';

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS suspended BOOLEAN DEFAULT false;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- Lemon Squeezy billing (NOT Stripe — unavailable in Pakistan)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS lemon_squeezy_customer_id VARCHAR(255);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS lemon_squeezy_subscription_id VARCHAR(255);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP;

-- Scraped website intelligence (may already exist)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS scraped_data JSONB;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMP;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS website_services JSONB DEFAULT '[]'::jsonb;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS website_about TEXT;

-- Storage quota for media library (may already exist)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS storage_quota_bytes BIGINT DEFAULT 10737418240;

-- ============================================================
-- 2. POSTS TABLE — new columns for variation tracking
-- ============================================================

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS scheduled_timezone VARCHAR(100);

-- Tracks whether this post came from manual upload or AI generation
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'ai_generated';

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS uploaded_by_user BOOLEAN DEFAULT false;

-- Aggregated per-platform engagement (populated by engagement sync)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS engagement_by_platform JSONB DEFAULT '{}'::jsonb;

-- 0–100 score computed from engagement vs account average
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS performance_score NUMERIC(5,2) DEFAULT 0;

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS last_metrics_sync TIMESTAMP;

-- Wizard: which wizard step / content theme triggered this
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS wizard_trigger VARCHAR(100);

-- Wizard: which variation (A/B/C) the customer chose
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS chosen_variation VARCHAR(1);

-- ============================================================
-- 3. CONTENT SUGGESTIONS TABLE
-- Proactive "Today from PostCore" suggestions on dashboard.
-- 4 types: seasonal / streak / gap / trending
-- ============================================================

CREATE TABLE IF NOT EXISTS content_suggestions (
  id                   SERIAL PRIMARY KEY,
  customer_id          INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Type drives the card colour and PostCore copy
  -- 'seasonal' = blue, 'streak' = green, 'gap' = orange, 'milestone' = purple
  suggestion_type      VARCHAR(50) NOT NULL
                         CHECK (suggestion_type IN ('seasonal','streak','gap','trending','milestone')),

  -- Short headline shown at top of suggestion card
  title                VARCHAR(255) NOT NULL,

  -- The WHY — always shown before the post preview.
  -- PostCore voice: "I noticed..." not "The system detected..."
  reason               TEXT NOT NULL,

  -- Fully generated caption ready to post — first 100 chars shown on card
  pre_generated_caption TEXT,

  -- Hashtags as array for chip display
  pre_generated_hashtags TEXT[] DEFAULT '{}',

  -- Which platform this suggestion is optimised for
  platform             VARCHAR(50) DEFAULT 'all'
                         CHECK (platform IN ('facebook','instagram','google_business','all')),

  -- static / photo / carousel / video
  content_type         VARCHAR(50) DEFAULT 'photo',

  -- Industry-specific context used during generation.
  -- Stores: { month, seasonal_topic, hook_used, pain_point }
  industry_context     JSONB DEFAULT '{}'::jsonb,

  -- Card action tracking
  is_dismissed         BOOLEAN DEFAULT false,
  is_used              BOOLEAN DEFAULT false,
  dismissed_at         TIMESTAMP,
  used_at              TIMESTAMP,
  used_in_post_id      INTEGER REFERENCES posts(id) ON DELETE SET NULL,

  -- Suggestions expire after 48h — stale suggestions feel irrelevant
  expires_at           TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),

  created_at           TIMESTAMP DEFAULT NOW()
);

-- Fetch active suggestions for a customer quickly
CREATE INDEX IF NOT EXISTS idx_suggestions_customer_active
  ON content_suggestions(customer_id, is_dismissed, is_used, expires_at);

-- Admin: see suggestions by type across all customers
CREATE INDEX IF NOT EXISTS idx_suggestions_type
  ON content_suggestions(suggestion_type, created_at DESC);

-- ============================================================
-- 4. POST VARIATIONS TABLE
-- Stores the A/B/C variations Claude generates.
-- The customer picks one — chosen_variation written to posts table.
-- ============================================================

CREATE TABLE IF NOT EXISTS post_variations (
  id               SERIAL PRIMARY KEY,
  post_id          INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

  -- 'A', 'B', or 'C' — never more than 3 per post
  variation_label  VARCHAR(1) NOT NULL CHECK (variation_label IN ('A','B','C')),

  -- Full caption text for this variation
  caption          TEXT NOT NULL,

  -- Hashtags stored as JSONB array: ["concrete","austin","driveway"]
  hashtags         JSONB DEFAULT '[]'::jsonb,

  -- Prompt sent to NanoBanana/Midjourney for this variation's image
  image_prompt     TEXT,

  -- The engagement question extracted from the caption end
  engagement_question TEXT,

  -- Hook formula used (from industryKnowledge.hookFormulas)
  hook_formula_used TEXT,

  -- 0–100 predicted engagement score (from Claude analysis)
  -- Shown on the variation card: "Estimated 2x more comments"
  engagement_score INTEGER DEFAULT 0 CHECK (engagement_score BETWEEN 0 AND 100),

  -- Which platform this variation was written for
  platform         VARCHAR(50) DEFAULT 'all',

  created_at       TIMESTAMP DEFAULT NOW(),

  -- One set of A/B/C per post — enforce uniqueness
  UNIQUE(post_id, variation_label)
);

-- Fetch all variations for a post in one query
CREATE INDEX IF NOT EXISTS idx_variations_post
  ON post_variations(post_id);

-- ============================================================
-- 5. POST IMAGES TABLE
-- Platform-specific resized image variants (Sharp output).
-- Every generated image gets 3 variants: FB, IG, GBP.
-- ============================================================

CREATE TABLE IF NOT EXISTS post_images (
  id                    SERIAL PRIMARY KEY,
  post_id               INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

  -- Platform variant
  platform              VARCHAR(50) NOT NULL
                          CHECK (platform IN (
                            'facebook_feed','facebook_square',
                            'instagram_feed','instagram_stories',
                            'google_business','master'
                          )),

  -- Cloudinary URL for this variant
  url                   TEXT NOT NULL,

  -- Cloudinary public_id for deletion
  cloudinary_public_id  VARCHAR(500),

  -- Pixel dimensions
  width                 INTEGER,
  height                INTEGER,

  -- File size in bytes
  file_size_bytes       BIGINT,

  -- The image prompt used to generate this image
  image_prompt          TEXT,

  -- Which AI provider generated the master image
  provider              VARCHAR(50),

  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_images_post
  ON post_images(post_id, platform);

-- ============================================================
-- 6. BUSINESS KNOWLEDGE TABLE
-- "Teach PostCore" — customers upload FAQs, service descriptions,
-- past winning content. Injected into every generation call.
-- ============================================================

CREATE TABLE IF NOT EXISTS business_knowledge (
  id            SERIAL PRIMARY KEY,
  customer_id   INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- 'faq' / 'service' / 'past_post' / 'brand_voice' / 'custom'
  knowledge_type VARCHAR(50) NOT NULL,

  -- Short label shown in the UI
  title         VARCHAR(255) NOT NULL,

  -- The actual content injected into Claude's system prompt
  content       TEXT NOT NULL,

  -- Whether this entry is included in AI generation
  is_active     BOOLEAN DEFAULT true,

  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_knowledge_customer
  ON business_knowledge(customer_id, is_active);

-- ============================================================
-- 7. POSTCORE BRIEFINGS TABLE
-- Weekly briefings generated every Monday 7am UTC.
-- Delivered via Resend email + in-app dashboard banner.
-- ============================================================

CREATE TABLE IF NOT EXISTS postcore_briefings (
  id              SERIAL PRIMARY KEY,
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Week this briefing covers
  week_start_date DATE NOT NULL,

  -- The full briefing text in PostCore voice
  briefing_text   TEXT NOT NULL,

  -- Structured data used to generate the briefing
  week_stats      JSONB DEFAULT '{}'::jsonb,

  -- Delivery state
  email_sent      BOOLEAN DEFAULT false,
  email_sent_at   TIMESTAMP,
  is_read         BOOLEAN DEFAULT false,
  read_at         TIMESTAMP,
  is_dismissed    BOOLEAN DEFAULT false,

  created_at      TIMESTAMP DEFAULT NOW(),

  -- One briefing per customer per week
  UNIQUE(customer_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_briefings_customer_unread
  ON postcore_briefings(customer_id, is_read, is_dismissed);

-- ============================================================
-- 8. POSTING ANALYTICS TABLE
-- Tracks engagement by day-of-week and time-of-day.
-- Powers "best time to post" recommendations.
-- ============================================================

CREATE TABLE IF NOT EXISTS posting_analytics (
  id              SERIAL PRIMARY KEY,
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  post_id         INTEGER REFERENCES posts(id) ON DELETE SET NULL,

  -- 0=Sunday ... 6=Saturday
  day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),

  -- Hour in customer's local timezone (0-23)
  hour_of_day     INTEGER NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),

  -- Platform this data is for
  platform        VARCHAR(50) NOT NULL,

  -- Engagement numbers
  likes           INTEGER DEFAULT 0,
  comments        INTEGER DEFAULT 0,
  shares          INTEGER DEFAULT 0,
  reach           INTEGER DEFAULT 0,
  impressions     INTEGER DEFAULT 0,

  -- Computed engagement rate for this slot
  engagement_rate NUMERIC(5,2) DEFAULT 0,

  recorded_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posting_analytics_customer
  ON posting_analytics(customer_id, platform, day_of_week, hour_of_day);

-- ============================================================
-- 9. HASHTAG PERFORMANCE TABLE
-- Tracks which hashtags drive the most engagement per industry.
-- Powers smarter hashtag selection in future generations.
-- ============================================================

CREATE TABLE IF NOT EXISTS hashtag_performance (
  id              SERIAL PRIMARY KEY,
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  hashtag         VARCHAR(150) NOT NULL,
  platform        VARCHAR(50) NOT NULL,
  industry        VARCHAR(100),

  -- Aggregate stats across all posts using this hashtag
  times_used      INTEGER DEFAULT 1,
  total_likes     INTEGER DEFAULT 0,
  total_comments  INTEGER DEFAULT 0,
  total_reach     INTEGER DEFAULT 0,

  -- Average engagement per use
  avg_engagement  NUMERIC(8,2) DEFAULT 0,

  last_used_at    TIMESTAMP DEFAULT NOW(),
  created_at      TIMESTAMP DEFAULT NOW(),

  UNIQUE(customer_id, hashtag, platform)
);

CREATE INDEX IF NOT EXISTS idx_hashtag_perf_customer
  ON hashtag_performance(customer_id, platform, avg_engagement DESC);

-- ============================================================
-- 10. MONTHLY REPORTS TABLE
-- Auto-generated PDF-ready report each month end.
-- ============================================================

CREATE TABLE IF NOT EXISTS monthly_reports (
  id              SERIAL PRIMARY KEY,
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Report period
  report_month    INTEGER NOT NULL CHECK (report_month BETWEEN 1 AND 12),
  report_year     INTEGER NOT NULL,

  -- Report content
  report_data     JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_url         TEXT,

  -- Delivery state
  email_sent      BOOLEAN DEFAULT false,
  email_sent_at   TIMESTAMP,

  created_at      TIMESTAMP DEFAULT NOW(),

  UNIQUE(customer_id, report_year, report_month)
);

-- ============================================================
-- 11. PERFORMANCE INDEXES (production critical)
-- ============================================================

-- Faster dashboard queries
CREATE INDEX IF NOT EXISTS idx_posts_customer_status
  ON posts(customer_id, status);

CREATE INDEX IF NOT EXISTS idx_posts_customer_created
  ON posts(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_posts_performance
  ON posts(performance_score DESC) WHERE performance_score > 0;

CREATE INDEX IF NOT EXISTS idx_credit_tx_customer_date
  ON credit_transactions(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_role
  ON customers(role);

CREATE INDEX IF NOT EXISTS idx_customers_suspended
  ON customers(suspended) WHERE suspended = true;

CREATE INDEX IF NOT EXISTS idx_customers_streak
  ON customers(posting_streak DESC) WHERE posting_streak > 0;

-- ============================================================
-- 12. SEED: Default content_preferences for existing customers
-- (new customers get this from the column default)
-- ============================================================

UPDATE customers
SET content_preferences = '{"educational":70,"social_proof":20,"promotional":10}'::jsonb
WHERE content_preferences IS NULL;

COMMIT;

-- ============================================================
-- Verification — run this after the migration to confirm
-- ============================================================
DO $$
DECLARE
  col_count INTEGER;
  tbl_count INTEGER;
BEGIN
  -- Check new customer columns exist
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'customers'
    AND column_name IN (
      'past_post_examples','content_preferences',
      'posting_streak','last_posted_at','total_posts_this_month'
    );

  -- Check new tables exist
  SELECT COUNT(*) INTO tbl_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'content_suggestions','post_variations','post_images',
      'business_knowledge','postcore_briefings',
      'posting_analytics','hashtag_performance','monthly_reports'
    );

  RAISE NOTICE '✅ Migration 001 complete';
  RAISE NOTICE '   Customer columns added: % / 5 expected', col_count;
  RAISE NOTICE '   New tables created: % / 8 expected', tbl_count;
END $$;
