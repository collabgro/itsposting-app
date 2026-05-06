-- PostFlow Database Schema v2
-- PostgreSQL 14+

-- Drop existing tables (for clean install)
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS post_carousel_slides CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS content_templates CASCADE;
DROP TABLE IF EXISTS industry_templates CASCADE;
DROP TABLE IF EXISTS social_accounts CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- ============================================
-- CUSTOMERS TABLE
-- ============================================
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    location VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(255),

    -- Branding
    logo_url TEXT,
    brand_colors JSONB DEFAULT '{"primary":"#3B82F6","secondary":"#10B981","accent":"#8B5CF6"}'::jsonb,
    visual_style VARCHAR(50) DEFAULT 'modern',
    tone VARCHAR(50) DEFAULT 'professional',

    -- AI Settings
    avatar_id VARCHAR(100),
    voice_id VARCHAR(100),
    preferred_image_provider VARCHAR(50) DEFAULT 'nanobanana',
    custom_instructions TEXT,

    -- Subscription
    plan VARCHAR(50) DEFAULT 'trial',
    status VARCHAR(50) DEFAULT 'trial',
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    trial_ends_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days'),

    -- Credits
    credits_balance INTEGER DEFAULT 10,
    credits_used_this_month INTEGER DEFAULT 0,

    -- Auto-posting
    auto_post_enabled BOOLEAN DEFAULT true,
    auto_post_frequency VARCHAR(50) DEFAULT 'daily',
    posting_times JSONB DEFAULT '["09:00","12:00","17:00"]'::jsonb,
    timezone VARCHAR(100) DEFAULT 'America/New_York',

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP
);

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_status ON customers(status);

-- ============================================
-- SOCIAL ACCOUNTS TABLE
-- ============================================
CREATE TABLE social_accounts (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- 'facebook', 'instagram', 'google_business'
    
    -- OAuth tokens
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    
    -- Account info
    account_id VARCHAR(255),
    account_username VARCHAR(255),
    account_name VARCHAR(255),
    profile_image_url TEXT,
    
    -- Platform-specific data
    platform_data JSONB DEFAULT '{}'::jsonb,
    
    -- Settings
    enabled BOOLEAN DEFAULT true,
    auto_post BOOLEAN DEFAULT true,
    
    -- Metadata
    connected_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(customer_id, platform)
);

CREATE INDEX idx_social_accounts_customer ON social_accounts(customer_id);
CREATE INDEX idx_social_accounts_platform ON social_accounts(platform);

-- ============================================
-- POSTS TABLE
-- ============================================
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    
    -- Content
    content_type VARCHAR(50) NOT NULL, -- 'static', 'photo', 'carousel', 'video'
    caption TEXT,
    overlay_text TEXT,
    hashtags JSONB DEFAULT '[]'::jsonb,
    
    -- Media
    media_url TEXT,
    media_urls JSONB DEFAULT '[]'::jsonb,
    thumbnail_url TEXT,
    
    -- Generation
    prompt TEXT,
    theme VARCHAR(100),
    generation_method VARCHAR(50) DEFAULT 'manual', -- 'manual', 'auto'
    ai_model_used VARCHAR(100),
    image_provider VARCHAR(50), -- 'nanobanana', 'midjourney', 'heygen'
    
    -- Platforms
    platform VARCHAR(50), -- primary platform
    platforms JSONB DEFAULT '[]'::jsonb, -- ['facebook', 'instagram', 'google_business']
    
    -- Scheduling
    scheduled_date TIMESTAMP,
    posted_at TIMESTAMP,
    timezone VARCHAR(100) DEFAULT 'America/New_York',
    time_of_day VARCHAR(20),
    
    -- Status
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'scheduled', 'posting', 'posted', 'failed'
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Platform IDs (after posting)
    platform_post_ids JSONB DEFAULT '{}'::jsonb,
    
    -- Engagement
    engagement JSONB DEFAULT '{"likes":0,"comments":0,"shares":0}'::jsonb,
    
    -- Cost tracking
    credits_used INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_posts_customer ON posts(customer_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_scheduled ON posts(scheduled_date) WHERE status = 'scheduled';
CREATE INDEX idx_posts_content_type ON posts(content_type);

-- ============================================
-- POST CAROUSEL SLIDES
-- ============================================
CREATE TABLE post_carousel_slides (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    slide_number INTEGER NOT NULL,
    media_url TEXT NOT NULL,
    caption TEXT,
    overlay_text TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(post_id, slide_number)
);

CREATE INDEX idx_carousel_post ON post_carousel_slides(post_id);

-- ============================================
-- CONTENT TEMPLATES
-- ============================================
CREATE TABLE content_templates (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    content_type VARCHAR(50),
    theme VARCHAR(100),
    prompt_template TEXT,
    is_public BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_templates_customer ON content_templates(customer_id);
CREATE INDEX idx_templates_public ON content_templates(is_public) WHERE is_public = true;

-- ============================================
-- CREDIT TRANSACTIONS (Audit Trail)
-- ============================================
CREATE TABLE credit_transactions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
    
    transaction_type VARCHAR(50) NOT NULL, -- 'debit', 'credit', 'refund', 'bonus'
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_credit_tx_customer ON credit_transactions(customer_id);
CREATE INDEX idx_credit_tx_created ON credit_transactions(created_at DESC);

-- ============================================
-- INDUSTRY TEMPLATES (Pre-built prompts)
-- ============================================
CREATE TABLE industry_templates (
    id SERIAL PRIMARY KEY,
    industry VARCHAR(100) NOT NULL,
    theme VARCHAR(100) NOT NULL,
    day_of_week INTEGER, -- 0=Sunday, 6=Saturday
    
    title VARCHAR(255),
    prompt_template TEXT NOT NULL,
    example_caption TEXT,
    suggested_hashtags JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_industry_templates_industry ON industry_templates(industry);
CREATE INDEX idx_industry_templates_day ON industry_templates(day_of_week);

-- ============================================
-- SEED DATA: Industry Templates
-- ============================================
INSERT INTO industry_templates (industry, theme, day_of_week, title, prompt_template, example_caption) VALUES
-- Concrete Industry
('concrete', 'local_highlight', 1, 'Monday Local Highlight', 'Create a post featuring a local neighborhood {location}, showing beautiful homes with concrete features', 'Proud to serve the {location} community! 🏡'),
('concrete', 'service_feature', 2, 'Tuesday Service Feature', 'Showcase concrete driveway installation with professional photography', 'Transform your driveway with our premium concrete services 🚧'),
('concrete', 'maintenance_tip', 3, 'Wednesday Maintenance Tip', 'Educational tip about concrete sealing and maintenance', '💡 Pro tip: Seal your concrete every 2-3 years to prevent cracks and stains'),
('concrete', 'project_showcase', 4, 'Thursday Project Showcase', 'Before and after transformation of a concrete project', 'Check out this stunning before & after! 🔨'),
('concrete', 'customer_value', 5, 'Friday Customer Value', 'Why customers choose our concrete services - quality, warranty, expertise', 'Why {business_name}? 💪 Quality you can trust.'),
('concrete', 'seasonal', 6, 'Saturday Seasonal', 'Seasonal concrete advice based on current weather/season', 'Get your concrete ready for {season}! 🍂'),
('concrete', 'faq', 0, 'Sunday FAQ', 'Common question about concrete services with helpful answer', '❓ Q: How long does concrete take to cure?'),

-- Plumbing Industry
('plumbing', 'local_highlight', 1, 'Monday Local Highlight', 'Local {location} community spotlight with plumbing services', 'Serving the {location} community with pride! 🔧'),
('plumbing', 'service_feature', 2, 'Tuesday Service Feature', 'Showcase a specific plumbing service like water heater installation', '24/7 emergency plumbing services available! 🚿'),
('plumbing', 'maintenance_tip', 3, 'Wednesday Maintenance Tip', 'Educational plumbing maintenance tip', '💡 Pro tip: Check your water heater anode rod annually'),
('plumbing', 'project_showcase', 4, 'Thursday Project Showcase', 'Recent plumbing installation or repair project', 'Another successful installation! 🔧'),
('plumbing', 'customer_value', 5, 'Friday Customer Value', 'Why customers trust our plumbing services', 'Licensed, insured, and ready to help! 💧'),
('plumbing', 'seasonal', 6, 'Saturday Seasonal', 'Seasonal plumbing tips based on current season', 'Winter is coming - prevent frozen pipes! ❄️'),
('plumbing', 'faq', 0, 'Sunday FAQ', 'Common plumbing question with answer', '❓ Q: Why is my water bill so high?'),

-- HVAC Industry
('hvac', 'local_highlight', 1, 'Monday Local Highlight', 'Local community HVAC service spotlight', 'Keeping {location} comfortable year-round! 🌡️'),
('hvac', 'service_feature', 2, 'Tuesday Service Feature', 'HVAC service like AC installation or furnace repair', 'Beat the heat with our AC tune-ups! ❄️'),
('hvac', 'maintenance_tip', 3, 'Wednesday Maintenance Tip', 'HVAC maintenance tip', '💡 Pro tip: Change your air filter every 1-3 months'),
('hvac', 'project_showcase', 4, 'Thursday Project Showcase', 'Recent HVAC installation', 'New HVAC system installed! 🏠'),
('hvac', 'customer_value', 5, 'Friday Customer Value', 'Why customers choose our HVAC services', 'Energy-efficient solutions for your home 🌿'),
('hvac', 'seasonal', 6, 'Saturday Seasonal', 'Seasonal HVAC advice', 'Time for your seasonal HVAC tune-up! 🔧'),
('hvac', 'faq', 0, 'Sunday FAQ', 'Common HVAC question', '❓ Q: How often should I service my HVAC?'),

-- Landscaping Industry
('landscaping', 'local_highlight', 1, 'Monday Local Highlight', 'Local landscaping showcase', 'Beautifying {location} one yard at a time! 🌳'),
('landscaping', 'service_feature', 2, 'Tuesday Service Feature', 'Landscaping service feature', 'Lawn care, hardscaping, and more! 🌿'),
('landscaping', 'maintenance_tip', 3, 'Wednesday Maintenance Tip', 'Lawn care maintenance tip', '💡 Pro tip: Water deeply and infrequently for healthier roots'),
('landscaping', 'project_showcase', 4, 'Thursday Project Showcase', 'Landscaping transformation', 'Look at this incredible transformation! 🌺'),
('landscaping', 'customer_value', 5, 'Friday Customer Value', 'Why choose our landscaping', 'Your dream yard awaits! 🌷'),
('landscaping', 'seasonal', 6, 'Saturday Seasonal', 'Seasonal landscaping tips', 'Spring is here - time to mulch! 🌱'),
('landscaping', 'faq', 0, 'Sunday FAQ', 'Common landscaping question', '❓ Q: When should I aerate my lawn?'),

-- Roofing Industry
('roofing', 'local_highlight', 1, 'Monday Local Highlight', 'Local roofing service', 'Protecting {location} homes! 🏠'),
('roofing', 'service_feature', 2, 'Tuesday Service Feature', 'Roofing service feature', 'Quality roofing that lasts decades! 🔨'),
('roofing', 'maintenance_tip', 3, 'Wednesday Maintenance Tip', 'Roof maintenance tip', '💡 Pro tip: Inspect your roof twice a year'),
('roofing', 'project_showcase', 4, 'Thursday Project Showcase', 'Roof installation or repair', 'New roof, new peace of mind! 🏠'),
('roofing', 'customer_value', 5, 'Friday Customer Value', 'Why choose our roofing', 'Lifetime warranty on all installations! ✅'),
('roofing', 'seasonal', 6, 'Saturday Seasonal', 'Seasonal roof care', 'Storm damage? We handle insurance claims! ⛈️'),
('roofing', 'faq', 0, 'Sunday FAQ', 'Common roofing question', '❓ Q: How long does a roof last?');

-- Verify schema
SELECT 'Schema created successfully' AS status;
