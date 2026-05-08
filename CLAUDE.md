# ItsPosting — Claude Code Master Reference
# Read this entire file before writing a single line of code.
# Every feature, every file, every decision must align with this document.

---

## WHAT ITSPOSTING IS

ItsPosting is an AI-powered social media automation platform built exclusively
for local service businesses — plumbers, HVAC companies, roofers, concrete
contractors, landscapers, electricians, painters, pest control, and cleaners.

**Core mission:** Replace a full-time social media manager for a local trades
business at a fraction of the cost. The business owner taps a few buttons and
PostCore (our AI advisor) handles the rest.

**The competitive moat:** Radical specificity. Every competitor is generic.
ItsPosting knows the difference between a plumber in January (frozen pipes)
and a roofer in April (storm season). No other tool does this.

**The single most important product rule:** Every feature must answer:
"Does this help a local plumber or roofer get more customers from social
media without needing to understand social media?"

---

## THE WIZARD ARCHITECTURE (CORE FEATURE — NON-NEGOTIABLE)

The wizard is ItsPosting's most important feature. It is a single-page,
end-to-end content creation pipeline. The customer never leaves the wizard.

Flow:
1. Customer answers 5 steps (content type, what's happening, vibe, details, platform)
2. Hits Generate
3. Backend orchestrates EVERYTHING:
   - Claude reads customer DB profile + industry knowledge + brand data
   - Claude generates 3 caption variations + hashtags
   - Claude generates ONE rich image/video prompt
   - NanoBanana generates the image (or HeyGen for video)
   - All 3 variations share the same image (saves API costs)
   - ImageResizer creates platform variants (FB/IG/GB)
4. Customer sees finished post on same page
5. They tap Post Now or Schedule — done

Critical principles:
- Customer NEVER sees or writes image prompts
- Claude is the orchestrator — it decides everything from DB context
- Carousel slide count: Claude decides (3-7 based on topic)
- All API calls happen in ONE backend request from /api/wizard/generate
- If image generation fails: auto-retry once → fallback to stock image → caption-only
- Loading screen: rotating messages showing real progress
- Result screen: same page, no redirects

---

## POSTCORE — THE AI PERSONA (NON-NEGOTIABLE)

PostCore is not a feature. PostCore IS the product's identity — a named AI
advisor that speaks in plain business language, never marketing jargon.

PostCore voice rules (enforce in ALL generated copy and AI calls):
- Always says "I noticed..." not "The system detected..."
- Explains WHY before WHAT
- Speaks like a trusted business advisor, not a software tool
- Maximum 3 recommendations per interaction — never overwhelm
- Plain language a tradesperson would understand
- Never says: "delve", "synergy", "leverage", "optimize", "utilize"
- Always addresses the customer by business name: "Good morning, Mike's Plumbing"

**The vision:** A local plumber opens ItsPosting at 7am on Monday.
PostCore says: "Good morning, Mike's Plumbing. It's January — frozen pipe
season is here. I noticed you haven't posted about winterization yet.
Here's a post ready to go, estimated to reach 800+ local homeowners."
Mike taps [Post Now]. Done. 10 seconds. No thinking required.
Build everything toward that moment.

---

## TECH STACK (EXACT — DO NOT DEVIATE)

```
Frontend:     Next.js (pages router), plain JavaScript — NO TypeScript
Backend:      Express.js, Node.js — PORT 8080 on Railway, 3001 locally
Database:     PostgreSQL via pg library (pool imported from server.js)
AI:           Anthropic Claude API (@anthropic-ai/sdk)
              Model: claude-sonnet-4-20250514 (ALWAYS this exact string)
Styling:      Inline styles using theme object from frontend/lib/theme.js
              Use (t) from useTheme() — NEVER hardcode colors
Icons:        Two-tier system:
              Tier 1 — UI chrome (sidebar, nav, buttons, all pages except wizard cards):
                Custom SVG system: frontend/components/icons/index.js (Ip-prefixed)
                Import: import { IpSparkle, IpPlus } from '../components/icons'
              Tier 2 — Wizard step cards (content type, theme, tone selectors):
                Lucide wrapper: frontend/components/Icon.js
                Import: import Icon from '../components/Icon'
                Usage: <Icon name="job_finished" size={32} />
                NEVER import directly from 'lucide-react' — always go through Icon.js
Image gen:    NanoBanana (Google Gemini 2.5 Flash Image) — default
              Midjourney via Replicate — premium fallback
              Sharp.js for image processing (backend)
Video gen:    HeyGen API
Timezone:     Luxon (backend), Intl.DateTimeFormat (frontend)
Payments:     Lemon Squeezy (NOT Stripe — unavailable in Pakistan)
Email:        Resend SDK
Storage:      Cloudinary (images + videos)
Deployment:   Railway (backend port 8080, frontend Next.js separate service)
Database:     Railway PostgreSQL
```

---

## PROJECT STRUCTURE

```
itsposting-app-main/
├── backend/
│   ├── server.js              # Main Express server — register ALL routes here
│   ├── routes/                # All API route files (one file per domain)
│   ├── services/              # Business logic services
│   ├── data/
│   │   └── industryKnowledge.js  # THE BRAIN — injected into every AI call
│   ├── utils/
│   │   └── timezone.js        # Luxon timezone helpers
│   └── middleware/
│       └── auth.js            # JWT authentication middleware
├── frontend/
│   ├── pages/                 # Next.js pages (pages router)
│   ├── components/            # Shared React components
│   └── lib/
│       ├── api.js             # ALL frontend API calls go through here ONLY
│       ├── theme.js           # Theme tokens — use (t) from useTheme()
│       └── store.js           # Zustand global state
└── CLAUDE.md                  # This file
```

---

## WHAT IS ALREADY BUILT (DO NOT REBUILD)

### Backend routes (all in backend/routes/):
- `auth.js` — register, login, verify, forgot-password, reset-password
- `customers.js` — profile CRUD, social accounts list
- `posts.js` — posts CRUD, analytics summary
- `content.js` — AI content generation endpoint
- `social.js` — social platform OAuth and posting
- `scraper.js` — website scraping (FREE, 7-day cache)
- `upload.js` — manual file upload (0 credits)
- `billing.js` — plan management (Lemon Squeezy placeholder)
- `media.js` — 10GB media library with quota enforcement
- `admin.js` — customer management, credits, suspend/reactivate
- `analytics.js` — post performance, per-platform breakdown
- `notifications.js` — notification management

### Backend services (all in backend/services/):
- `ClaudeService.js` — caption, carousel, video script, week plan generation
- `NanoBananaService.js` — Google Gemini 2.5 Flash image generation
- `MidjourneyService.js` — Replicate/Midjourney premium images
- `HeyGenService.js` — AI avatar video generation
- `ScraperService.js` — Cheerio-based website scraper
- `ManualContentGenerator.js` — orchestrator, provider routing
- `AutoPostScheduler.js` — scheduled posting cron
- `EmailService.js` — Resend email sending
- `EmailWorker.js` — email queue worker
- `EmailQueue.js` — email queue management
- `AuditLog.js` — admin action logging
- `NotificationService.js` — in-app notifications

### Frontend pages (all in frontend/pages/):
- `index.js` — auth redirect
- `login.js` — authentication
- `signup.js` — 2-step onboarding
- `dashboard.js` — main dashboard
- `calendar.js` — month calendar view
- `history.js` — post history / drafts
- `upload.js` — manual upload + library picker
- `media.js` — 10GB media library
- `billing.js` — plan management
- `settings.js` — profile, branding, scraper
- `analytics/index.js` — analytics overview
- `analytics/posts/[id].js` — per-post performance detail
- `admin/index.js` — admin dashboard
- `admin/customers.js` — customer list
- `admin/customers/[id].js` — customer detail
- `admin/email-queue.js` — email queue management

### Frontend components:
- `Layout.js` — sidebar + topbar with theme toggle and Lucide icons
- `ContentCreatorModal.js` — 4-step content creation wizard
- `ui.js` — Card, Button, Input, Badge, StatCard, SectionHeader, EmptyState
- `NotificationBell.js` — notification bell with dropdown

---

## DATABASE TABLES (ALL EXIST — DO NOT RECREATE)

### Core tables (original schema):
```sql
customers             -- Business accounts (50+ columns)
social_accounts       -- OAuth-linked FB/IG/GBP connections
posts                 -- All generated and scheduled posts
post_carousel_slides  -- Individual carousel slides
content_templates     -- Customer-specific prompt templates
industry_templates    -- Day-themed templates per industry (35 rows seeded)
credit_transactions   -- Full credit audit trail
```

### Extended tables (Phase 2+):
```sql
media_library          -- Customer uploaded files (10GB quota)
admin_audit_log        -- All admin actions with IP + user agent
post_engagement_snapshots -- Per-platform engagement timeline
email_queue            -- Outbound email queue (body_html, body_text)
system_metrics         -- Health monitoring
notifications          -- In-app user notifications
content_suggestions    -- Proactive AI suggestions (TO BE BUILT)
post_variations        -- 3 AI variations per generation (TO BE BUILT)
post_images            -- Platform-specific image variants (TO BE BUILT)
posting_analytics      -- Best time to post data (TO BE BUILT)
hashtag_performance    -- Hashtag tracking (TO BE BUILT)
monthly_reports        -- Auto-generated monthly reports (TO BE BUILT)
business_knowledge     -- Teach PostCore knowledge base (TO BE BUILT)
postcore_briefings     -- Weekly PostCore strategy briefings (TO BE BUILT)
```

### Key columns added to customers:
```sql
timezone VARCHAR(100)
is_admin BOOLEAN
role VARCHAR(50)
suspended BOOLEAN
suspension_reason TEXT
posting_streak INTEGER
last_posted_at TIMESTAMP
total_posts_this_month INTEGER
past_post_examples TEXT[]
content_preferences JSONB
lemon_squeezy_customer_id VARCHAR(255)
lemon_squeezy_subscription_id VARCHAR(255)
plan_expires_at TIMESTAMP
```

### Key columns added to posts:
```sql
scheduled_timezone VARCHAR(100)
source VARCHAR(50)          -- 'ai_generated' or 'manual_upload'
uploaded_by_user BOOLEAN
engagement_by_platform JSONB
performance_score NUMERIC
last_metrics_sync TIMESTAMP
```

---

## ENVIRONMENT VARIABLES

```bash
# Database
DATABASE_URL                    # Railway Postgres connection string

# Auth
JWT_SECRET                      # 32+ char secret

# Server
PORT=8080                       # Always 8080 on Railway
NODE_ENV                        # development | production
FRONTEND_URL                    # Deployed frontend Railway URL

# AI — Text
ANTHROPIC_API_KEY               # Claude API key

# AI — Images
GOOGLE_AI_API_KEY               # NanoBanana (Google Gemini) image generation
REPLICATE_API_TOKEN             # Midjourney via Replicate
IMAGE_PROVIDER=nanobanana       # 'nanobanana' | 'midjourney' | 'auto'

# AI — Video
HEYGEN_API_KEY                  # Video generation

# Storage
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET

# Billing (Lemon Squeezy — NOT Stripe)
LEMONSQUEEZY_API_KEY
LEMONSQUEEZY_STORE_ID
LEMONSQUEEZY_WEBHOOK_SECRET
PLAN_STARTER_ID                 # Lemon Squeezy variant ID for $99 plan
PLAN_PRO_ID                     # Lemon Squeezy variant ID for $199 plan
PLAN_AGENCY_ID                  # Lemon Squeezy variant ID for $349 plan

# Email
RESEND_API_KEY
```

---

## CODING RULES (ABSOLUTE — NEVER VIOLATE)

### General
- Always async/await — never .then() chains or callbacks
- Every API route must have try/catch with proper error responses
- Never hardcode API keys — always process.env
- Always handle loading + error states in every frontend component
- Use theme (t) from useTheme() for ALL styling — never hardcode colors
- Frontend API calls go ONLY through frontend/lib/api.js — never fetch directly

### Icons (Two-Tier System)
**Tier 1 — UI chrome** (sidebar, nav, all pages except wizard step cards):
- Import from: `import { IpXxx } from '../components/icons'`
- Every icon is Ip-prefixed (IpSparkle, IpPlus, IpClose, IpChevronRight, etc.)
- Icon reference: frontend/components/icons/index.js (~80 icons available)
- Platform icons: IpFacebook, IpInstagram, IpGoogle (abstract geometric shapes)
- Common mappings: Sparkles→IpSparkle, Plus→IpPlus, X→IpClose, Clock→IpSchedule,
  ChevronRight→IpChevronRight, Search→IpSearch, Trash2→IpDelete, RefreshCw→IpRefresh,
  AlertCircle/AlertTriangle→IpWarning, CheckCircle→IpCheckCircle, XCircle→IpCloseCircle,
  Users→IpTeam, Building→IpBusiness, Shield→IpAdmin, DollarSign→IpDollar,
  TrendingUp→IpTrendingUp, Heart→IpHeart, MessageCircle→IpComment, Share2→IpShare

**Tier 2 — Wizard step cards** (content type, theme, tone selectors):
- Import from: `import Icon from '../components/Icon'`
- Usage: `<Icon name="job_finished" size={32} />`
- Reference: frontend/components/Icon.js (wraps lucide-react)
- NEVER import directly from 'lucide-react' — always go through Icon.js
- Available names: text_post, photo_post, carousel, video, job_finished, share_tip,
  got_review, promotion, seasonal, community, faq, team_spotlight,
  friendly, professional, funny, educational, urgent, warning, image, refresh, etc.

### Database
- Always parameterized queries ($1, $2) — NEVER string concatenation
- Add IF NOT EXISTS to all CREATE TABLE statements
- Include created_at TIMESTAMP DEFAULT NOW() on every new table
- Import pool from backend/server.js — never recreate the pool
- Store times in UTC always — never local time in database

### Claude API
- Model: claude-sonnet-4-20250514 — always this exact string, never haiku
- Always handle JSON parse failures with try/catch
- Strip ```json fences: text.replace(/```json|```/g, '').trim()
- Always validate Claude responses before saving to database
- Log all Claude errors: console.error('[ClaudeService]', err)
- Generate 3 variations (A, B, C) for every post — NEVER just 1
- Every generated post MUST end with an engagement question
- Content ratio enforced: 70% educational, 20% social proof, 10% promotional

### Images
- Master size: 1080x1350px (4:5 ratio — works on all platforms)
- Always generate 3 variants: facebook_feed (1200x630), instagram_feed (1080x1350), google_business (720x720)
- Use Sharp with 'cover' fit — never distort images, always crop
- JPEG quality: 85 for all exports
- Upload all variants to Cloudinary, save URLs to post_images table

### Timezone
- Store: UTC always in database
- Display: Convert to customer's IANA timezone on frontend
- Convert local→UTC: Luxon DateTime.fromISO(date, { zone: tz }).toUTC()
- Convert UTC→local: Intl.DateTimeFormat on frontend
- Auto-detect: Intl.DateTimeFormat().resolvedOptions().timeZone

### Billing
- NEVER suggest or implement Stripe — unavailable in Pakistan
- Use Lemon Squeezy as Merchant of Record (handles all taxes globally)
- Webhook route MUST use express.raw() — not JSON body parser
- Always verify webhook signature before processing any event
- Always return 200 OK to Lemon Squeezy (even on errors — log, don't reject)

---

## THE INDUSTRY KNOWLEDGE SYSTEM

**File:** `backend/data/industryKnowledge.js` — ALREADY CREATED AND COMPLETE

This is the brain of every AI generation. Contains for each industry:
- `customerPainPoints` — 15+ real homeowner problems in human language
- `seasonalContent` — Month 1-12 with urgencyTopic, tipTopic, promotionAngle
- `contentThemes` — 8 post types that work for this industry
- `trustSignals` — Credibility phrases per industry
- `localKeywords` — Location-aware phrases for local SEO
- `hookFormulas` — 10 proven opening hooks that stop the scroll
- `ctaVariations` — 8 CTAs from soft to hard

**Industries covered:** plumbing, hvac, roofing, concrete, landscaping,
electrical, painting, pest_control, general_contractor, cleaning

**HOW TO USE IT in any service:**
```javascript
const industryKnowledge = require('../data/industryKnowledge');
const knowledge = industryKnowledge[customer.industry] || industryKnowledge.general_contractor;
const thisMonth = new Date().getMonth() + 1; // 1-12
const seasonal = knowledge.seasonalContent[thisMonth];

// Then inject into system prompt:
// - seasonal.urgencyTopic → "It's [month], [urgencyTopic] is the priority right now"
// - knowledge.hookFormulas → pick one to start the post
// - knowledge.customerPainPoints → reference real pain in the caption
// - knowledge.trustSignals → include credibility signals naturally
```

---

## THE SYSTEM PROMPT ARCHITECTURE (HOW CLAUDE MUST BE CALLED)

**File:** `backend/services/SystemPromptBuilder.js` — TO BE CREATED

Every Claude API call for post generation MUST go through this builder.
Never send a raw simple prompt to Claude for post generation.

The assembled system prompt contains 6 sections:

### 1. BUSINESS CONTEXT
```
Business name, industry, location, tone, visual style
Their scraped services (from website intelligence if available)
Brand personality and voice
Past post examples if provided (few-shot prompting)
```

### 2. INDUSTRY EXPERTISE
```
From industryKnowledge.js for their specific industry
Current month's seasonal context (auto-detected from Date)
Most urgent topic for their industry this month (seasonal.urgencyTopic)
2-3 relevant customer pain points
1-2 hook formulas appropriate for the content type
```

### 3. PLATFORM RULES
```
Facebook: 150-300 words, conversational, 2-3 hashtags, question at end
Instagram: 100-150 words, visual-first, 8-15 hashtags, 3-5 emojis
Google Business: 100-200 words, keyword-rich, location natural, hard CTA, no hashtags
```

### 4. CONTENT TYPE RULES
```
before_after: before state → transformation → after state → customer outcome
educational_tip: Hook → Tip → Why it matters → Soft CTA
customer_testimonial: Story → Outcome → Social proof → Engagement question
seasonal: Urgency → Problem → Solution → Hard CTA
```

### 5. BRAND VOICE + FEW-SHOT
```
Tone (professional/friendly/casual/expert) from customer settings
Past post examples if customer.past_post_examples is populated
Business knowledge base content if provided
```

### 6. OUTPUT FORMAT (CRITICAL)
```json
{
  "variation_a": {
    "caption": "First variation — different hook",
    "hashtags": ["tag1", "tag2"],
    "imagePrompt": "Detailed image generation prompt",
    "engagementQuestion": "Question to end the post"
  },
  "variation_b": {
    "caption": "Second variation — different angle",
    "hashtags": ["tag1", "tag2"],
    "imagePrompt": "...",
    "engagementQuestion": "..."
  },
  "variation_c": {
    "caption": "Third variation — different tone",
    "hashtags": ["tag1", "tag2"],
    "imagePrompt": "...",
    "engagementQuestion": "..."
  }
}
```

**Every post variation must:**
- Start with one of the industry's hookFormulas (adapted to context)
- Reference the business's actual location naturally
- End with an engagement question (stored separately as engagementQuestion)
- Match the 70/20/10 content ratio for the week
- Inject seasonal urgency if it's the right month

---

## THE GUIDED CREATION WIZARD (NEXT MAJOR FEATURE)

**File:** `frontend/pages/wizard.js` — TO BE CREATED
**File:** `backend/routes/wizard.js` — TO BE CREATED

**Core principle:** NO blank prompt boxes. Ever. Local business owners are not
copywriters. Remove the blank box entirely and replace with guided choices.

### Step 1 — "What's happening today?" (clickable cards, 2×4 grid)
```
🔨 Just finished a job
💡 Share a tip
⭐ Got a review
📅 Running a promotion
🌤️ Seasonal content (auto-detected by month)
🏘️ Community/local event
❓ FAQ or myth-bust
🎉 Team spotlight
```

### Step 2 — "What's the vibe?" (tone cards)
```
😊 Friendly & casual
💼 Professional & trustworthy
😄 Funny & relatable
📚 Educational & expert
🔥 Urgent & promotional
```

### Step 3 — "Where are we posting?" (platform selector)
```
Facebook | Instagram | Google Business | All Three (auto-adapted)
```

### Step 4 — Smart Counter-Query (THE FLAGSHIP FEATURE — see below)
Ask 2-3 targeted questions based on Step 1 choice + industry before generating.

### Step 5 — Loading state (rotating messages):
```
"Reading the room for [industry]..."
"Writing like a local expert..."
"Checking what's trending in [city]..."
"Adding that authentic touch..."
```

### Step 6 — Results (3 variation cards: A, B, C) each showing:
```
- Full caption text
- Engagement question (highlighted separately)
- Hashtags as chips
- Image prompt suggestion
- [Use This] [Edit] [Try Different Tone] buttons
- Below all: [One-Tap Refresh] [Start Over]
```

### Quick Post Mode (mobile/job site):
```
Single screen: short text input + platform toggles + tone emoji row
Results: best single variation + [Post Now] [See All Versions] [Edit]
```

---

## THE SMART COUNTER-QUERY ENGINE (FLAGSHIP FEATURE)

**This is what separates ItsPosting from every competitor.**

After Step 1 of the wizard, the system asks 2-3 targeted questions before
generating. The questions are dynamic — based on content type, industry,
day-of-week theme, and what's already known from the website scrape.

### The psychology:
- Blank prompt → vague output → customer regenerates 2-3 times → credits wasted
- 3 smart questions → first-try success rate jumps from ~30% to ~80%
- Maximum 3 questions. Never more. Never required (always show Skip button).
- Use quick-select chips wherever possible (tap-friendly, not typing)

### Question selection logic:
```javascript
// backend/routes/wizard.js — getQuestionsForContext(industry, contentType, dayTheme, scrapeData)

const questionBank = {
  universal: [
    { id: 'location', text: 'Which area or neighbourhood is this job in?', type: 'text' },
    { id: 'cta', text: 'What action should people take?', type: 'chips',
      options: ['Call us', 'DM for quote', 'Book online', 'Visit our website', 'No CTA'] },
    { id: 'unique', text: 'Anything unique about this job or situation?', type: 'text' }
  ],
  before_after: [
    { id: 'transformation', text: 'How dramatic was the change?', type: 'chips',
      options: ['Very dramatic', 'Significant improvement', 'Subtle but important'] },
    { id: 'before_state', text: 'Describe the "before" in a few words:', type: 'text' },
    { id: 'challenge', text: 'Was there anything technically challenging?', type: 'text' }
  ],
  plumbing: [
    { id: 'emergency', text: 'Was this an emergency call-out?', type: 'chips',
      options: ['Yes — emergency', 'No — planned work'] },
    { id: 'pain_point', text: 'What was the customer\'s main issue?', type: 'text' }
  ],
  // ... per industry + per content type
}
```

### New API endpoints:
```
POST /api/wizard/questions    — returns 2-3 questions based on context
POST /api/wizard/generate     — generates 3 variations using questions + context
```

---

## PROACTIVE SUGGESTIONS SYSTEM (TO BE BUILT)

**Files:** `backend/services/SuggestionsEngine.js`, `backend/routes/suggestions.js`
**Frontend:** Dashboard "Today from PostCore" banner

### 4 types of suggestions:

**1. SEASONAL** — "It's January, peak frozen pipe season. Here's a post:"
   - Generated from `industryKnowledge[industry].seasonalContent[currentMonth]`
   - Shown in first week of each month

**2. STREAK** — "You haven't posted in 3 days" OR "Keep your 6-day streak!"
   - Based on `customers.posting_streak` and `customers.last_posted_at`

**3. CONTENT GAP** — "You've posted 5 promos but no educational content"
   - Analyzes last 10 posts by content_type against 70/20/10 ratio
   - Generates a ready post of the missing type

**4. MILESTONE** — "First post of the month!" "10th post!" "30-day streak!"
   - Based on posting_streak and total_posts_this_month

### Suggestion card format:
```
[colored left border: seasonal=blue, gap=orange, streak=green, milestone=purple]
💡 Suggested because: [the WHY always comes first]
[First 100 chars of pre-generated caption]
[✅ Use This] [✏️ Customize] [✕ Skip]
```

### Daily habit loop:
```
8am daily cron → generate suggestions for all active customers
Dashboard → prominent "Today from PostCore" banner (red dot if unseen)
Push notification → "☀️ Good morning! Here's today's suggested post..."
```

---

## BUSINESS INTELLIGENCE DASHBOARD (TO BE BUILT)

**File:** `backend/services/BusinessIntelligence.js`
Translate social media numbers into BUSINESS language.

### The rule: Never show vanity metrics without context.
```
NOT: "710 impressions this week"
YES: "~834 local people saw your business this month"

NOT: "3.2% engagement rate"
YES: "Your engagement is in the top 25% of HVAC businesses your size"
```

### The 4 metric cards:
1. "People Reached This Month" — reach + "estimated [X] local homeowners"
2. "Estimated New Customers" — range (min-max) with "Based on [industry] averages"
3. "Engagement Rate" — your rate vs industry average + percentile badge
4. "Posting Streak" — 🔥 N-day streak with encouragement phrase

**CRITICAL:** ALL revenue/customer estimates must say "estimated".
Always show: "Based on industry averages. Actual results vary."

### Content Health Bar:
```
[Educational 70%][Social Proof 20%][Promotional 10%]  ← target
[Educational 25%][Social Proof 15%][Seasonal 10%][Promotional 50%]  ← actual
```
If imbalanced: PostCore tip + [Generate Educational Post →]

---

## POSTCORE WEEKLY BRIEFING (TO BE BUILT)

**File:** `backend/services/PostCoreAdvisor.js`
Generated every Monday 7am UTC for all active customers.
Delivered via Resend email + in-app dashboard banner.

### Format:
```
"Good morning, [Business Name]."

This week in numbers:
- [X] posts published → reached approximately [Y] local people
- Your best post: [caption excerpt] with [N] engagements
- [Streak status]

What's Working
[observation] → [why it matters] → [one action]

Needs Attention
[observation] → [why it matters] → [one action]

This Week's Opportunity
[seasonal or gap-based suggestion] → [one action]

Keep it going — [encouragement specific to their industry and streak]
```

---

## IMAGE INTELLIGENCE (TO BE BUILT)

**File:** `backend/services/ImageResizer.js`

### Platform specs (hardcoded, never change):
```javascript
const PLATFORM_SPECS = {
  facebook_feed:     { width: 1200, height: 630,  quality: 85 },
  facebook_square:   { width: 1200, height: 1200, quality: 85 },
  instagram_feed:    { width: 1080, height: 1350, quality: 85 }, // PRIMARY
  instagram_stories: { width: 1080, height: 1920, quality: 85 },
  google_business:   { width: 720,  height: 720,  quality: 85 },
};
```

### Process for every generated or uploaded image:
```
1. Receive image buffer
2. Resize to instagram_feed (1080x1350) — the master
3. Resize to facebook_feed and google_business
4. Upload all 3 variants to Cloudinary (folder: 'postflow/images')
5. Save URLs to post_images table
6. Return all URLs in API response
```

**Safe zone for text:** Keep content in center 80% — outer 10% is danger zone
**Fit:** Always 'cover' with Sharp — never distort, always crop

---

## CONTENT CALENDAR BLUEPRINT

The AI enforces this content rotation. Never let users spam promotions.

```
Week 1: Educational tip
Week 2: Before & after project showcase
Week 3: Customer testimonial or review
Week 4: Team/behind-the-scenes OR seasonal

Monthly overlays (from industryKnowledge.js):
- Month start: "Start strong" milestone suggestion
- Seasonal peak: Industry-specific urgency posts
- Content gap: Auto-detected and auto-filled
```

**The 70/20/10 rule** (non-negotiable):
- 70% educational / value-giving content
- 20% social proof (testimonials, before/afters)
- 10% promotional (special offers, sales)

If a customer tries to post a 5th promotional post when they've only had 2
educational posts, PostCore should proactively flag this and suggest an
educational post first.

---

## PLATFORM-SPECIFIC WRITING RULES

### Facebook
- 150-300 words optimal
- Conversational tone — like talking to a neighbour
- End with a direct question to drive comments
- 2-3 hashtags maximum (not keyword-stuffed)
- 1-2 emojis max — don't overdo it
- Local references: city, neighbourhood, area names

### Instagram
- 100-150 words in caption
- Visual-first language ("Look at this..." "See how...")
- 8-15 hashtags: 3 broad + 5 niche + 4 local + 3 industry
- 3-5 emojis per post
- Engagement question always at end
- First line must be a hook (only line visible before "more")

### Google Business
- 100-200 words
- Keywords naturally woven in: "[city] [service]"
- Include location reference naturally (not forced)
- Hard CTA: phone number or "call us today"
- No hashtags — keywords only
- Every post should help with local search rankings

---

## BILLING (LEMON SQUEEZY — NEVER STRIPE)

### Plans:
```
Starter:      $99/month  — 50 credits, 1 platform
Professional: $199/month — 150 credits, all platforms (recommended)
Premium:      $349/month — 500 credits, all platforms + agency features
```

### Credits per content type:
```
Static text card: 1 credit
Photo post:       3 credits
Carousel:         5 credits
Video:            10 credits
Manual upload:    0 credits (own content)
```

### Free (no credits):
- Website scraping (any frequency)
- All analytics viewing
- Calendar browsing
- Editing captions of existing posts
- Social account management

### Webhook events to handle:
```javascript
'order_created'              → update plan + status + add credits
'subscription_created'       → store LS subscription ID
'subscription_updated'       → handle upgrades/downgrades
'subscription_cancelled'     → status = 'cancelled', keep access until expiry
'subscription_expired'       → downgrade to trial limits
```

**CRITICAL:** Webhook route uses `express.raw({ type: 'application/json' })`
Always verify signature before processing. Always return 200 OK (log errors, don't reject).

---

## ONBOARDING FLOW (REFERENCE — DO NOT CHANGE)

```
Step 1 (30 sec): Business name + industry + city — NOTHING ELSE
Step 2 (1 min):  Website URL → auto-scrape → confirm extracted services
Step 3 (2 min):  Connect Facebook/Instagram/Google Business
Step 4 (30 sec): Generate FIRST POST AUTOMATICALLY — show it immediately
Step 5:          Onboarding complete → [Post This Now] button
```

**The first AI-generated post is the "wow moment" that determines retention.**
It must be specific to their industry, location, AND current season.
Never show a generic placeholder. Always generate real content.

---

## DEEP RESEARCH FINDINGS (INTEGRATE INTO EVERY FEATURE)

Based on research across 52M+ posts and competitor analysis:

### What actually works for local businesses:
1. **Before & After** — the contrast is what grabs attention. Show the ugly before.
2. **Educational Tips** — giving away value makes people trust and remember you.
3. **Time-lapses / Process videos** — satisfying trade content goes viral on Reels.
4. **Seasonal content** — the right post at the right time of year converts.
5. **Hyper-local references** — mention the neighbourhood, not just the city.

### The single biggest engagement driver:
Accounts that **reply to comments** outperform those that don't by up to 42%.
ItsPosting should track comment reply rates and encourage this behavior.

### Content format data (Buffer 2026 analysis of 52M+ posts):
- Carousels get +109% more engagement than Reels on Instagram
- Carousels get 21.77% engagement on LinkedIn (3x higher than video)
- Accounts posting 3-6x/week on Instagram get 5x more engagement than sporadic posters
- 52% of consumers disengage if they suspect AI-generated content

**Implication:** ItsPosting must make AI content sound genuinely human and local.
Generic AI-sounding content destroys trust. The industry templates and
counter-query system are the solution.

### The authenticity signal:
"A shaky selfie-style video from a satisfied homeowner after the job
consistently outperforms any polished promotional post."
ItsPosting should actively encourage customer-uploaded authentic content
(manual upload flow, 0 credits) alongside AI generation.

### The hook-value-CTA framework (enforce in ALL generations):
```
Hook (first 3 seconds): Address a specific pain point or visual "wow"
Value: Genuine information, tip, or story that helps the reader
CTA: Clear single action (not multiple options)
```

### Gap ItsPosting fills that NO competitor does:
1. **Hyper-local voice** — reference specific neighbourhoods, not just city
2. **Platform-native writing** — genuinely different content for each platform
3. **Seasonal intelligence** — know what month it is and what it means per industry
4. **70/20/10 enforcement** — automatically rotate content types
5. **Engagement-optimised captions** — every post ends with a question
6. **Private knowledge base** — business can upload FAQs, past posts, service details

---

## IMPLEMENTATION ORDER (FOLLOW THIS EXACTLY)

### ✅ DONE:
- Full AI content pipeline (captions, images, carousels, video)
- industryKnowledge.js (backend/data/) — complete with 10 industries
- Website scraping with 7-day cache
- Manual upload (0 credits)
- 10GB media library
- Admin portal with audit logging
- Post analytics with per-platform breakdown
- Billing structure (4 plan tiers)
- Dark theme + Lucide icons
- Auth (JWT + bcrypt + rate limiting)
- Password reset flow
- Email queue infrastructure

### 🔴 CRITICAL — Build these first:
**Week 1:**
- [ ] `SystemPromptBuilder.js` — the AI brain upgrade (uses industryKnowledge.js)
- [ ] Database migrations for new tables (content_suggestions, post_variations, post_images, business_knowledge, postcore_briefings)
- [ ] Install and configure Luxon + Sharp
- [ ] Timezone handling (backend utils + frontend display)

**Week 2:**
- [ ] `backend/routes/wizard.js` — Guided wizard API
- [ ] `frontend/pages/wizard.js` — Guided wizard UI (Step 1-6)
- [ ] Smart Counter-Query Engine (questions API + UI chips)
- [ ] `ImageResizer.js` — 3-variant image processing with Sharp

**Week 3:**
- [ ] `SuggestionsEngine.js` — Proactive suggestions (4 types)
- [ ] Dashboard suggestions UI — "Today from PostCore" banner
- [ ] Content mix tracker — 70/20/10 enforcement
- [ ] Mobile Quick Post mode

**Week 4:**
- [ ] `BusinessIntelligence.js` — business-language metrics
- [ ] `PostCoreAdvisor.js` — weekly briefing generator
- [ ] Business intelligence dashboard UI
- [ ] ROI estimator page

**Week 5:**
- [ ] Teach PostCore — business knowledge base UI + storage
- [ ] Monthly report generator (PDF via Resend)
- [ ] Unified engagement inbox (comment monitoring)
- [ ] Industry benchmarking

**Week 6:**
- [ ] Lemon Squeezy billing integration (full webhook handling)
- [ ] PWA setup for mobile job-site use
- [ ] Facebook + Instagram live OAuth + posting
- [ ] Google Business Profile posting

---

## GIT WORKFLOW

After EVERY completed feature:
```bash
git add .
git commit -m "feat: [feature name in plain English]"
git push
```

Railway auto-deploys on push to main. Always test on Railway after each push.
**Never implement multiple features at once — one at a time, test each.**

---

## WHAT SUCCESS LOOKS LIKE

**The 10-second morning moment:**

A local plumber opens ItsPosting at 7am on Monday.

PostCore says: "Good morning, Mike's Plumbing. It's January — frozen pipe
season is here. I noticed you haven't posted about winterization yet.
Here's a post ready to go, estimated to reach 800+ local homeowners
in your area."

Mike taps [Post Now].

Done. 10 seconds. No thinking required.

**Every line of code you write should make this moment more likely.**

---

*Last updated: May 2026 | ItsPosting.com*