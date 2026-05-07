-- ============================================================
-- Migration 004: Post Variations Extras
-- backend/db/migrations/004_post_variations_extras.sql
--
-- Run ONCE against Railway PostgreSQL.
-- Adds new columns to the posts table needed for the
-- 3-variation generation flow (Phase 3.1).
--
-- Safe to re-run: all statements use IF NOT EXISTS / DO blocks.
-- NOTE: post_variations and post_images tables already exist
--       from migration 001 — this file only adds missing columns.
-- ============================================================

-- Multi-platform storage (comma-posted to multiple platforms)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS platforms JSONB DEFAULT '["facebook"]'::jsonb;

-- Best posting time recommended by Claude (morning/afternoon/evening)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS best_time_to_post VARCHAR(20) DEFAULT 'morning';

-- Quick-read cache of all 3 variations JSON on the post row
-- Populated at generation time so frontend doesn't need extra round-trip
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS variations_json JSONB DEFAULT '{}'::jsonb;

-- Which variation the customer chose (A/B/C) — written when they pick
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS selected_variation VARCHAR(1) DEFAULT 'A';

-- Add is_selected to post_variations if missing (belt-and-suspenders)
ALTER TABLE post_variations
  ADD COLUMN IF NOT EXISTS is_selected BOOLEAN DEFAULT false;

SELECT 'Migration 004 complete — posts.platforms, best_time_to_post, variations_json, selected_variation added' AS status;
