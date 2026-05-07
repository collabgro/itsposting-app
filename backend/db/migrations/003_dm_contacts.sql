/**
 * ItsPosting — DM Handling & Contacts Schema Migration
 * backend/db/migrations/003_dm_contacts.sql
 *
 * Run this in Railway → Postgres → Data tab
 * Copy everything below and paste it into the query box
 */

-- ============================================================
-- DM CONVERSATIONS TABLE
-- One row per conversation thread (per person per platform)
-- ============================================================
CREATE TABLE IF NOT EXISTS dm_conversations (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,

  platform VARCHAR(50) NOT NULL,
  platform_thread_id VARCHAR(255) NOT NULL,

  sender_platform_id VARCHAR(255),
  sender_name VARCHAR(255),
  sender_profile_pic TEXT,

  status VARCHAR(50) DEFAULT 'open',
  last_message_at TIMESTAMP,
  last_message_preview TEXT,
  last_message_direction VARCHAR(20),

  -- 24h window from last customer message; 7-day human agent extension
  window_expires_at TIMESTAMP,
  human_agent_window_expires_at TIMESTAMP,

  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  auto_reply_sent BOOLEAN DEFAULT false,

  -- Set by PostCore AI
  intent VARCHAR(100),
  urgency VARCHAR(20) DEFAULT 'normal',

  contact_id INTEGER,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(customer_id, platform, platform_thread_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_conversations_customer ON dm_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_dm_conversations_platform ON dm_conversations(platform);
CREATE INDEX IF NOT EXISTS idx_dm_conversations_unread ON dm_conversations(customer_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_dm_conversations_status ON dm_conversations(customer_id, status);


-- ============================================================
-- DM MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS dm_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES dm_conversations(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,

  platform_message_id VARCHAR(255) UNIQUE,

  direction VARCHAR(20) NOT NULL,
  message_text TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,

  status VARCHAR(50) DEFAULT 'delivered',

  reply_type VARCHAR(50),
  ai_generated BOOLEAN DEFAULT false,
  ai_draft TEXT,

  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_messages_conversation ON dm_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_customer ON dm_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_platform_id ON dm_messages(platform_message_id);


-- ============================================================
-- CONTACTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,

  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),

  facebook_psid VARCHAR(255),
  instagram_igsid VARCHAR(255),
  profile_pic_url TEXT,

  source VARCHAR(50) DEFAULT 'manual',
  source_platform VARCHAR(50),

  notes TEXT,
  tags JSONB DEFAULT '[]'::jsonb,

  lead_status VARCHAR(50) DEFAULT 'new',
  estimated_job_value DECIMAL(10,2),
  job_type VARCHAR(100),

  first_contact_at TIMESTAMP DEFAULT NOW(),
  last_contact_at TIMESTAMP,
  total_conversations INTEGER DEFAULT 0,

  is_customer BOOLEAN DEFAULT false,
  is_blocked BOOLEAN DEFAULT false,
  do_not_contact BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_customer ON contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_status ON contacts(customer_id, lead_status);

-- Partial unique indexes to allow proper upsert by platform ID
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_facebook
  ON contacts(customer_id, facebook_psid)
  WHERE facebook_psid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_instagram
  ON contacts(customer_id, instagram_igsid)
  WHERE instagram_igsid IS NOT NULL;


-- ============================================================
-- AUTO REPLY RULES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS dm_auto_reply_rules (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,

  trigger_type VARCHAR(50) NOT NULL,
  keywords JSONB DEFAULT '[]'::jsonb,
  intent VARCHAR(100),

  reply_text TEXT NOT NULL,

  is_active BOOLEAN DEFAULT true,
  delay_seconds INTEGER DEFAULT 0,
  send_only_once BOOLEAN DEFAULT true,

  times_triggered INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_reply_customer ON dm_auto_reply_rules(customer_id);
CREATE INDEX IF NOT EXISTS idx_auto_reply_active ON dm_auto_reply_rules(customer_id, is_active) WHERE is_active = true;


-- ============================================================
-- DM SYNC LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS dm_sync_log (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  last_synced_at TIMESTAMP DEFAULT NOW(),
  messages_found INTEGER DEFAULT 0,
  sync_status VARCHAR(50) DEFAULT 'success',
  error_message TEXT,

  UNIQUE(customer_id, platform)
);


-- Add FK from dm_conversations to contacts
ALTER TABLE dm_conversations
  ADD COLUMN IF NOT EXISTS contact_id_fk INTEGER REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dm_conversations_contact
  ON dm_conversations(contact_id_fk)
  WHERE contact_id_fk IS NOT NULL;


-- Verify
SELECT 'DM & Contacts schema created successfully' AS status;
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('dm_conversations', 'dm_messages', 'contacts', 'dm_auto_reply_rules', 'dm_sync_log')
ORDER BY table_name;
