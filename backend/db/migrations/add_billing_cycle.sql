-- Run once: psql $DATABASE_URL -f backend/db/migrations/add_billing_cycle.sql
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP;
