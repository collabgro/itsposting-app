-- Run once: psql $DATABASE_URL -f backend/db/migrations/add_content_mix_tracker.sql

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS posting_streak INTEGER DEFAULT 0;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS last_posted_at TIMESTAMP;

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS content_theme VARCHAR(100);

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS performance_score DECIMAL(5,2) DEFAULT 0;

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS engagement_by_platform JSONB DEFAULT '{}'::jsonb;

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual';

UPDATE customers SET posting_streak = 0 WHERE posting_streak IS NULL;

UPDATE customers c
  SET last_posted_at = (
    SELECT MAX(posted_at) FROM posts p
    WHERE p.customer_id = c.id
      AND p.status = 'posted'
      AND p.posted_at IS NOT NULL
  )
  WHERE c.last_posted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_streak ON customers(posting_streak DESC);
CREATE INDEX IF NOT EXISTS idx_posts_content_theme ON posts(content_theme);
CREATE INDEX IF NOT EXISTS idx_posts_customer_created ON posts(customer_id, created_at DESC);

SELECT 'Migration complete' AS status;
