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
   - NanoBanana generates the image (or video pipeline for video)
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

**Status:** Backend (`backend/routes/wizard.js`) — BUILT and live. Frontend (`frontend/pages/wizard.js`) — BUILT and live. Full dedicated wizard page operational; ContentCreatorModal.js retained as a secondary entry point.

**Text Post (static) behavior:** When `contentTypeSelection === 'static'`, the wizard skips NanoBanana entirely, deducts 1 credit, returns `mediaUrl: null`, and the results screen hides the left media panel — showing only the 3 caption variations at full width.

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
              Model: claude-sonnet-4-6 (ALWAYS this exact string)
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
              Sharp.js for image processing (backend/services/ImageResizer.js)
Video gen:    Two separate pipelines:
              1. Avatar/talking-head: HeyGen API (HeyGenService.js)
              2. Cinematic/job footage (PLANNED — see VIDEO CONTENT PIPELINE section):
                 NanoBanana 2 key frame → Veo 3.1 Fast (primary) →
                 Runway Gen-4 (fallback #1) → Pika 2.2 (fallback #2)
              VeoService.js and VideoService.js already exist for pipeline #2
Timezone:     Luxon (backend), Intl.DateTimeFormat (frontend)
Payments:     Whop (NOT Stripe — unavailable in Pakistan)
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
│       └── auth.js            # JWT auth — getBillingCustomerId() for workspace billing
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
- `customers.js` — profile CRUD, social accounts list; sub-accounts return parent credits
- `posts.js` — posts CRUD, analytics summary
- `content.js` — AI content generation endpoint
- `social.js` — social platform OAuth and posting
- `scraper.js` — website scraping (FREE, 7-day cache)
- `upload.js` — manual file upload (0 credits)
- `billing.js` — plan management + Whop webhooks (fully implemented)
- `media.js` — 10GB media library with quota enforcement
- `admin.js` — customer management, credits, suspend/reactivate, impersonation
- `analytics.js` — post performance, per-platform breakdown
- `notifications.js` — notification management
- `wizard.js` — guided content creation (steps, generate, quick-post, refresh)
- `geo.js` — GEO Audit (trigger, poll, history, score card); 1 free then 5 credits
- `suggestions.js` — proactive PostCore suggestions (4 types: seasonal/streak/gap/milestone)
- `workspaces.js` — multi-account workspaces (create, switch, rename, delete)
- `knowledge.js` — business knowledge base CRUD
- `intelligence.js` — business intelligence metrics endpoint
- `dms.js` — DM polling and management
- `inbox.js` — unified engagement inbox
- `contacts.js` — contacts management
- `webhooks.js` — inbound webhook handling
- `receptionist.js` — AI Receptionist config, conversations, leads pipeline, automations, review actions
- `twilio.js` — Twilio inbound SMS/WhatsApp webhooks (per-customer credentials; mounted at /api/twilio)
- `gmb-messages.js` — Google Business Messages inbound webhook + verification (mounted at /api/gmb)
- `studio.js` — AI-powered image studio (Sharp + Claude for branded card templates)
- `apiKeys.js` — Developer API key management (create, list, revoke); enforces plan limits (Trial = 0, paid = 5)
- `external.js` — External API v1 (mounted at /api/v1); all 16 endpoints require API key auth + scope

### Backend middleware (all in backend/middleware/):
- `auth.js` — JWT authentication, token revocation, admin verification, workspace billing resolution
- `apiKey.js` — `authenticateApiKey(pool)` factory + `requireScope(scope)` helper; SHA-256 hash lookup; expands write→read implied scopes automatically

### Backend services (all in backend/services/):
- `ClaudeService.js` — caption, carousel, video script, week plan generation
- `SystemPromptBuilder.js` — assembles 6-section rich prompts for every AI call
- `NanoBananaService.js` — Google Gemini 2.5 Flash image generation
- `MidjourneyService.js` — Replicate/Midjourney premium images
- `HeyGenService.js` — AI avatar video generation
- `VeoService.js` — Veo 3.1 Fast video generation (cinematic pipeline primary)
- `RunwayService.js` — Runway Gen-4 image-to-video (cinematic pipeline fallback #1)
- `PikaService.js` — Pika 2.2 image-to-video (cinematic pipeline fallback #2)
- `VideoService.js` — video orchestration: Veo → Runway → Pika → HeyGen fallback chain
- `ImageResizer.js` — Sharp-based 3-variant image processing (FB/IG/GB)
- `GeoAuditService.js` — runs 15 AI questions × 3 engines GEO visibility audit
- `SuggestionsEngine.js` — generates proactive PostCore suggestions
- `BusinessIntelligence.js` — translates metrics into business-language insights
- `PostCoreAdvisor.js` — weekly briefing generator (Monday 7am UTC)
- `ContentMixTracker.js` — 70/20/10 content ratio tracking and enforcement
- `IndustryBenchmarks.js` — per-industry engagement benchmark data
- `ScraperService.js` — Cheerio-based website scraper
- `CrawlerService.js` — deep website crawler for business intelligence
- `ManualContentGenerator.js` — orchestrator, provider routing
- `AutoPostScheduler.js` — scheduled posting cron
- `EmailService.js` — Resend email sending
- `EmailWorker.js` — email queue worker
- `EmailQueue.js` — email queue management
- `AuditLog.js` — admin action logging
- `NotificationService.js` — in-app notifications
- `DMPollingService.js` — polling social DMs
- `WhopService.js` — Whop integration
- `ReceptionistService.js` — AI receptionist brain (intent classification, reply generation, escalation logic)
- `TwilioService.js` — SMS + WhatsApp send/receive via Twilio (per-customer credentials)
- `MetaWhatsAppService.js` — WhatsApp via Meta Business Cloud API (Graph API v19.0); preferred over Twilio when configured
- `MailgunService.js` — transactional email via Mailgun (per-customer credentials)
- `CalComService.js` — Cal.com booking link integration
- `GMBMessagesService.js` — Google My Business Messages send/receive
- `QueueService.js` — BullMQ queue management with Redis fallback (graceful degradation to cron)
- `OutboundQueue.js` — outbound job scheduler (follow-up, review request, no-show, seasonal, custom); BullMQ + cron fallback

### Frontend pages (all in frontend/pages/):
- `index.js` — auth redirect
- `login.js` — authentication
- `signup.js` — 2-step onboarding
- `dashboard.js` — main dashboard; shows first-time welcome banner when 0 posts; PostCore briefing + suggestions
- `calendar.js` — month calendar view; header buttons: "Post Wizard" + "Upload"
- `history.js` — post history / drafts; header buttons: "Post Wizard" + "Upload"
- `upload.js` — manual upload + library picker; page title "Upload"
- `media.js` — 10GB media library + Photo Studio tab
- `quick-post.js` — single-screen post creation; only Text Card + Photo Post (carousel/video removed); "Post Now" publishes directly without redirect
- `wizard.js` — dedicated full-page AI content creation wizard (multi-step, all content types)
- `billing.js` — plan management; each plan card has a plain-English tagline; "Email us to downgrade" links to support email
- `settings.js` — profile, branding, social connections, integrations (Image Source + Inbox Sync sections removed)
- `reports.js` — redirects to /analytics?tab=monthly
- `roi.js` — redirects to /analytics
- `receptionist.js` — redirects to /knowledge-base?tab=ai-response
- `workspaces.js` — multi-account workspace switcher UI; permission labels use plain names (AI Visibility, Knowledge Base)
- `contacts.js` — contacts management
- `knowledge-base.js` — Knowledge Base UI (page title: "Knowledge Base"); train AI with business info, FAQs, pricing, docs, AI Receptionist config
- `analytics/index.js` — analytics overview; content type labels use display names (Text Card, Photo, etc.)
- `analytics/posts/[id].js` — per-post performance detail
- `geo-audit/index.js` — AI Visibility dashboard (page title: "AI Visibility"); run/configure visibility checks
- `geo-audit/[id].js` — AI Visibility Report (page title: "AI Visibility Report")
- `studio.js` — Photo Studio (standalone entry point, also accessible via media.js tab)
- `admin/index.js` — admin dashboard
- `admin/customers.js` — customer list
- `admin/customers/[id].js` — customer detail + impersonation
- `admin/email-queue.js` — email queue management
- `admin/audit.js` — admin audit log
- `admin/posts.js` — admin posts management
- `admin/broadcast.js` — admin broadcast messaging

### Frontend components:
- `Layout.js` — sidebar + topbar with theme toggle; trial card shows "X shared credits" for sub-accounts
- `ContentCreatorModal.js` — wizard content creation (current primary UI for wizard flow)
- `ui.js` — Card, Button, Input, Badge, StatCard, SectionHeader, EmptyState
- `NotificationBell.js` — notification bell with dropdown
- `PostCoreBanner.js` — PostCore weekly briefing banner
- `SuggestionCard.js` — individual suggestion card (use/customize/skip)
- `TodaySuggestionBanner.js` — "Today from PostCore" dashboard banner
- `ItsPostingLogo.js` — brand logo component
- `Icon.js` — Lucide wrapper for wizard step cards
- `icons/index.js` — custom Ip-prefixed SVG icons (~80 icons)

---

## DATABASE TABLES (ALL EXIST — DO NOT RECREATE)

### Core tables:
```sql
customers             -- Business accounts (50+ columns); parent_customer_id for workspaces
social_accounts       -- OAuth-linked FB/IG/GBP connections
posts                 -- All generated and scheduled posts
post_carousel_slides  -- Individual carousel slides
content_templates     -- Customer-specific prompt templates
industry_templates    -- Day-themed templates per industry (35 rows seeded)
credit_transactions   -- Full credit audit trail
```

### Extended tables:
```sql
media_library             -- Customer uploaded files (10GB quota)
admin_audit_log           -- All admin actions with IP + user agent
post_engagement_snapshots -- Per-platform engagement timeline
email_queue               -- Outbound email queue (body_html, body_text)
system_metrics            -- Health monitoring
notifications             -- In-app user notifications
business_knowledge        -- Teach PostCore knowledge base entries
wizard_sessions           -- Guided wizard step state
trial_ip_registrations    -- IP-based trial account rate limiting
geo_audits                -- GEO visibility audit runs and results
geo_citations             -- Individual citations found per audit
geo_tracking_scores       -- Score history over time per customer
```

### AI Receptionist tables:
```sql
receptionist_config       -- Per-customer AI Receptionist settings; all integration credentials stored here:
                          --   enabled, auto_handle, active_platforms (JSONB), tone
                          --   escalate_keywords (JSONB), booking_link
                          --   business_hours_start/end, timezone, after_hours_message
                          --   twilio_account_sid, twilio_auth_token (secret), twilio_phone_number, twilio_whatsapp_number
                          --   calcom_api_key (secret)
                          --   mailgun_api_key (secret), mailgun_domain, mailgun_from_email
                          --   meta_wa_phone_number_id, meta_wa_access_token (secret), meta_wa_business_id
                          --   automation_config (JSONB) -- array of automation rules
dm_conversations          -- Inbound DM conversation threads (Facebook, Instagram, Google)
dm_messages               -- Individual DM messages; ai_handled BOOLEAN tracks AI auto-replies
sms_conversations         -- SMS/WhatsApp conversation threads per customer
sms_messages              -- Individual SMS/WhatsApp messages within conversations
outbound_jobs             -- Scheduled outbound messages; statuses: pending/running/sent/failed
                          --   job_type: follow_up | review_request | noshow | seasonal | custom
                          --   platform: sms | whatsapp | email
                          --   payload JSONB, scheduled_for TIMESTAMP
```

### Key columns on customers:
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
whop_membership_id VARCHAR(255)
whop_customer_id VARCHAR(255)
billing_cycle VARCHAR(20)             -- 'monthly' | 'yearly'
plan_expires_at TIMESTAMP
next_billing_date TIMESTAMP
parent_customer_id INTEGER        -- NULL for main accounts; set for workspace sub-accounts
workspace_display_name VARCHAR(255) -- friendly name override for workspace
geo_score NUMERIC                 -- latest GEO visibility score (0-100)
last_geo_audit_at TIMESTAMP
free_geo_audit_used BOOLEAN       -- one free audit per billing account
website_testimonials TEXT
```

### Key columns on posts:
```sql
scheduled_timezone VARCHAR(100)
source VARCHAR(50)          -- 'ai_generated' or 'manual_upload'
uploaded_by_user BOOLEAN
engagement_by_platform JSONB
performance_score NUMERIC
last_metrics_sync TIMESTAMP
video_job_id VARCHAR(255)
video_render_status VARCHAR(50)
video_provider VARCHAR(50)
```

---

## ENVIRONMENT VARIABLES

```bash
# Database
DATABASE_URL                    # Railway Postgres connection string

# Auth
JWT_SECRET                      # 32+ char secret
ADMIN_SECRET                    # Required for /api/webhooks/heygen/register — no fallback to JWT_SECRET

# Server
PORT=8080                       # Always 8080 on Railway
NODE_ENV                        # development | production
FRONTEND_URL                    # Deployed frontend Railway URL
BACKEND_URL                     # Public Railway backend URL — used for HeyGen webhook self-registration
CRON_SECRET                     # Protects cron-triggered endpoints (suggestions, auto-post); required in production

# AI — Text
ANTHROPIC_API_KEY               # Claude API key

# AI — Images
GOOGLE_AI_API_KEY               # NanoBanana (Google Gemini) image generation
REPLICATE_API_TOKEN             # Midjourney via Replicate
IMAGE_PROVIDER=nanobanana       # 'nanobanana' | 'midjourney' | 'auto'

# AI — Video
HEYGEN_API_KEY                  # Avatar/talking-head video generation
HEYGEN_WEBHOOK_SECRET           # HMAC secret for verifying HeyGen webhook payloads (from /heygen/register)
HEYGEN_VOICE_ID                 # Optional — pre-configured HeyGen voice ID (auto-fetched if not set)
HEYGEN_AVATAR_ID                # Optional — pre-configured HeyGen avatar ID (auto-fetched if not set)
HEYGEN_TEST_MODE=false          # Set true to generate watermarked test videos (saves HeyGen credits)
VEO_API_KEY                     # Veo cinematic video generation (pipeline #2)
RUNWAY_API_KEY                  # Runway Gen-4 fallback video
PIKA_API_KEY                    # Pika 2.2 fallback video

# Webhooks & Social
FACEBOOK_APP_SECRET             # Facebook webhook HMAC signature verification (X-Hub-Signature-256)
FACEBOOK_WEBHOOK_VERIFY_TOKEN   # Facebook webhook setup challenge token (any string you choose)
TIKTOK_APP_SECRET               # TikTok webhook signature verification; required in production

# Storage
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET

# Billing (Whop — NOT Stripe)
WHOP_API_KEY
WHOP_WEBHOOK_KEY
PLAN_STARTER_M_WHOP_ID          # Whop plan ID for Starter monthly ($20)
PLAN_STARTER_Y_WHOP_ID          # Whop plan ID for Starter yearly ($18/mo)
PLAN_PRO_M_WHOP_ID              # Whop plan ID for Professional monthly ($40)
PLAN_PRO_Y_WHOP_ID              # Whop plan ID for Professional yearly ($36/mo)
PLAN_PREMIUM_M_WHOP_ID          # Whop plan ID for Premium monthly ($60)
PLAN_PREMIUM_Y_WHOP_ID          # Whop plan ID for Premium yearly ($54/mo)

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
- Model: claude-sonnet-4-6 — always this exact string, never haiku
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
- Upload all variants to Cloudinary

### Timezone
- Store: UTC always in database
- Display: Convert to customer's IANA timezone on frontend
- Convert local→UTC: Luxon DateTime.fromISO(date, { zone: tz }).toUTC()
- Convert UTC→local: Intl.DateTimeFormat on frontend
- Auto-detect: Intl.DateTimeFormat().resolvedOptions().timeZone

### Billing
- NEVER suggest or implement Stripe — unavailable in Pakistan
- Use Whop as Merchant of Record (handles all taxes globally)
- Webhook route at `POST /api/billing/whop/webhook` uses `express.raw({ type: 'application/json' })`
- Always verify signature via `whop.verifyWebhookSignature()` before processing
- Always return 200 OK immediately, then process async (already implemented this way)
- Use `WhopService.js` for checkout URLs, plan ID resolution, and membership cancellation

### Workspaces / Sub-Accounts
- Sub-accounts have `parent_customer_id` set; main accounts have it NULL
- Sub-accounts are created with `credits_balance = 0` — they share the parent's pool
- For credit checks and deductions always use `getBillingCustomerId(req)` from `middleware/auth.js`
  — this resolves to `req.parentCustomerId || req.customerId` (parent when in workspace context)
- `GET /api/auth/verify` and `GET /api/customers/profile` both override `credits_balance` and
  `free_geo_audit_used` with the parent's values when `parent_customer_id` is set
- Layout.js sidebar shows "X shared credits" (not "X credits remaining") for `user.is_sub_account`
- Workspace JWT contains `{ parentCustomerId }` claim — set by `POST /api/workspaces/:id/switch`

### Trial Rate Limiting (IP-Based)
- Max 2 trial account registrations per IP address, enforced in `backend/routes/auth.js`
- Table: `trial_ip_registrations` (ip_address VARCHAR(45), customer_id, created_at)
- Use x-forwarded-for header first (Railway uses proxies), fallback to req.ip
- Return 429 with human-readable message: "Trial limit reached for this network. Please contact support to upgrade your plan."
- IP check wrapped in try/catch — skips silently if table doesn't exist yet (migration safety)

### Generated Media Validation
- ALL NanoBanana images and HeyGen videos must pass validation before being used:
  - HTTP status 200 from the URL
  - File size > 10KB and < 10MB (checked via Content-Length header)
- On validation failure: retry once → imageFailed: true in response (caption-only mode)
- Validation is ONLY for media files — NOT for captions, hashtags, or engagement questions
- The validateMedia() helper lives in `backend/routes/wizard.js` and is reused by all wizard endpoints

### Security
- **bcrypt rounds: always 12** — never 10. If you see `bcrypt.hash(password, 10)` anywhere, fix it.
- **Hash password reset tokens before storing:** generate `rawToken = crypto.randomBytes(32).toString('hex')`, store `crypto.createHash('sha256').update(rawToken).digest('hex')` in DB, email the raw token. On reset, hash the incoming token to look it up.
- **JWT via Authorization header only** — never accept tokens via query string (`?token=`); they appear in server access logs and browser history.
- **Credit deductions must use SELECT FOR UPDATE** — wrap in `BEGIN/COMMIT` transaction: `SELECT credits_balance FROM customers WHERE id=$1 FOR UPDATE` before any UPDATE. See `backend/routes/geo.js` for the reference implementation.
- **Production webhooks must verify HMAC signatures** — never process a payload if the signature header is missing or mismatched. If the required secret env var is not set in production, return 403; do not silently ignore.
- **ADMIN_SECRET is required for admin webhook endpoints** — never fall back to JWT_SECRET. If `ADMIN_SECRET` is unset, return 503.
- **Sanitise user content before AI injection** — truncate to 600 chars max per entry, strip `<>\`` characters. See `sanitizeKb()` in `backend/services/ReceptionistService.js` for the pattern.
- **Rate limiting applies to ALL users** — authenticated requests do NOT skip the global rate limiter.
- **Security headers must stay enabled** — frontend via `next.config.js` `headers()`, backend via `helmet()` (CSP enabled). Do not disable either.
- **API keys use SHA-256 hashing** — same pattern as password reset tokens; generate with `crypto.randomBytes(20).toString('hex')`, prefix `itspost_`, store only `crypto.createHash('sha256').update(rawKey).digest('hex')`. Never store or return the raw key after creation.
- **API key scopes must be enforced on every external route** — use `requireScope('scope:name')` from `backend/middleware/apiKey.js`. Never expose billing, social OAuth tokens, admin operations, or password/auth via API keys.

---

## THE INDUSTRY KNOWLEDGE SYSTEM

**File:** `backend/data/industryKnowledge.js` — COMPLETE

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

## THE SYSTEM PROMPT ARCHITECTURE

**File:** `backend/services/SystemPromptBuilder.js` — BUILT

Every Claude API call for post generation goes through this builder.
Never send a raw simple prompt to Claude for post generation.

The assembled system prompt contains 6 sections:

### 1. BUSINESS CONTEXT
```
Business name, industry, location, tone, visual style
Their scraped services (from website intelligence if available)
Brand personality and voice
Past post examples if provided (few-shot prompting)
Business knowledge base entries (from business_knowledge table)
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

## THE GUIDED CREATION WIZARD

**Backend:** `backend/routes/wizard.js` — BUILT
**Frontend:** `frontend/pages/wizard.js` — BUILT

**Core principle:** NO blank prompt boxes. Ever. Local business owners are not
copywriters. Remove the blank box entirely and replace with guided choices.

### Wizard endpoints (all live):
```
POST /api/wizard/start              — begin session, return step 1
POST /api/wizard/step               — submit answers, return next step or final posts
POST /api/wizard/generate           — generate 3 variations
GET  /api/wizard/steps/:industry/:contentType — return step config
POST /api/wizard/quick              — mobile quick post mode
POST /api/wizard/refresh            — refresh a variation with a different angle
```

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

### Step 4 — Smart Counter-Query
2-3 targeted questions based on Step 1 choice + industry before generating.
Maximum 3 questions. Always show Skip button. Use chip selects wherever possible.

### Step 5 — Loading state (rotating messages)

### Step 6 — Results (3 variation cards: A, B, C)

---

## THE SMART COUNTER-QUERY ENGINE

**This is what separates ItsPosting from every competitor.**

After Step 1 of the wizard, the system asks 2-3 targeted questions before
generating. The questions are dynamic — based on content type, industry,
day-of-week theme, and what's already known from the website scrape.

The psychology:
- Blank prompt → vague output → customer regenerates 2-3 times → credits wasted
- 3 smart questions → first-try success rate jumps from ~30% to ~80%
- Maximum 3 questions. Never more. Never required (always show Skip button).
- Use quick-select chips wherever possible (tap-friendly, not typing)

---

## GEO AUDIT SYSTEM

**Backend:** `backend/routes/geo.js` + `backend/services/GeoAuditService.js` — BUILT
**Frontend:** `frontend/pages/geo-audit/index.js` + `frontend/pages/geo-audit/[id].js` — BUILT
**Frontend label:** "AI Visibility" — all user-facing text uses this name; backend API routes/DB tables still use `geo` terminology internally

GEO (Generative Engine Optimisation) audits measure how visible the business is
across AI answer engines (ChatGPT, Gemini, Perplexity, etc.).

### How it works:
1. 15 targeted queries × 3 AI engines = 45 visibility checks
2. Results scored 0-100, stored in `geo_audits` + `geo_citations` + `geo_tracking_scores`
3. Report shows citations found, missing platforms, and improvement recommendations

### Credit model:
- First audit: FREE (one per billing account; `free_geo_audit_used` flag)
- Subsequent audits: **5 credits** each
- Always deduct from the billing account (parent for workspaces) via `getBillingCustomerId(req)`

### Endpoints:
```
POST /api/geo/audit         — trigger audit (free once, then 5 credits)
GET  /api/geo/audit/latest  — most recent audit
GET  /api/geo/audit/:id     — full report
GET  /api/geo/history       — past 20 audits
GET  /api/geo/score         — lightweight score card for dashboard
```

---

## WORKSPACES / MULTI-ACCOUNT SYSTEM

**Backend:** `backend/routes/workspaces.js` — BUILT
**Frontend:** `frontend/pages/workspaces.js` — BUILT

Allows one main account to manage multiple business identities (e.g. an agency
managing clients, or a business with multiple locations).

### How it works:
- Workspace = child `customers` row with `parent_customer_id` set
- Workspaces share the parent's credit pool (`credits_balance` always 0 on workspace row)
- Switching into a workspace issues a new JWT with `parentCustomerId` claim
- All billing operations resolve to the parent via `getBillingCustomerId(req)`

### Plan limits:
```
Trial / Starter:  1 workspace total (main only)
Professional:     2 workspaces
Premium:          3 workspaces
```

### Endpoints:
```
GET    /api/workspaces           — list all workspaces under the main account
POST   /api/workspaces           — create a new workspace
PATCH  /api/workspaces/:id       — rename workspace
DELETE /api/workspaces/:id       — soft-delete (suspend) workspace
POST   /api/workspaces/:id/switch    — switch into a workspace (returns new JWT)
POST   /api/workspaces/main/switch   — switch back to main account
```

---

## PROACTIVE SUGGESTIONS SYSTEM

**Files:** `backend/services/SuggestionsEngine.js`, `backend/routes/suggestions.js` — BUILT
**Frontend:** `TodaySuggestionBanner.js`, `SuggestionCard.js` on dashboard — BUILT

### 4 types of suggestions:

**1. SEASONAL** — "It's January, peak frozen pipe season. Here's a post:"
   - Generated from `industryKnowledge[industry].seasonalContent[currentMonth]`

**2. STREAK** — "You haven't posted in 3 days" OR "Keep your 6-day streak!"
   - Based on `customers.posting_streak` and `customers.last_posted_at`

**3. CONTENT GAP** — "You've posted 5 promos but no educational content"
   - Analyzes last 10 posts against 70/20/10 ratio via `ContentMixTracker.js`

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
```

---

## BUSINESS INTELLIGENCE DASHBOARD

**File:** `backend/services/BusinessIntelligence.js` + `backend/routes/intelligence.js` — BUILT
**Frontend:** `frontend/pages/roi.js`, `frontend/pages/reports.js` — BUILT

The rule: Never show vanity metrics without context.
```
NOT: "710 impressions this week"
YES: "~834 local people saw your business this month"

NOT: "3.2% engagement rate"
YES: "Your engagement is in the top 25% of HVAC businesses your size"
```

**CRITICAL:** ALL revenue/customer estimates must say "estimated".
Always show: "Based on industry averages. Actual results vary."

---

## POSTCORE WEEKLY BRIEFING

**File:** `backend/services/PostCoreAdvisor.js` — BUILT
**Frontend:** `PostCoreBanner.js` on dashboard — BUILT

Generated every Monday 7am UTC for all active customers.
Delivered via Resend email + in-app dashboard banner.

---

## IMAGE RESIZING

**File:** `backend/services/ImageResizer.js` — BUILT

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

Process: receive buffer → resize to master (1080x1350) → create FB + GB variants →
upload all to Cloudinary → return URLs. Always 'cover' fit — never distort, always crop.

---

## VIDEO CONTENT PIPELINE (BUILT)

Two separate pipelines for different video types:

**Pipeline 1 — Avatar / talking-head (EXISTS):**
`HeyGenService.js` — for AI spokesperson videos

**Pipeline 2 — Cinematic / job footage (PLANNED):**
```
Step 1: Generate key frame image
        NanoBanana 2 (always — stable)
              ↓
Step 2: Animate to video
        Veo 3.1 Fast          ← Primary (preview, cheap, native audio, Google ecosystem)
              ↓ rate limit / downtime
        Runway Gen-4          ← Fallback #1 (image-to-video king, cinematic zoom)
                                + Google TTS for audio layer
              ↓ Runway outage (rare)
        Pika 2.2              ← Fallback #2 (social-first, authentic feel)
```

`VeoService.js`, `RunwayService.js`, `PikaService.js`, and `VideoService.js` are all built.
Full fallback chain active: Veo → Runway → Pika → HeyGen.

---

## CONTENT CALENDAR BLUEPRINT

The AI enforces this content rotation. Never let users spam promotions.

```
Week 1: Educational tip
Week 2: Before & after project showcase
Week 3: Customer testimonial or review
Week 4: Team/behind-the-scenes OR seasonal
```

**The 70/20/10 rule** (non-negotiable, enforced by ContentMixTracker.js):
- 70% educational / value-giving content
- 20% social proof (testimonials, before/afters)
- 10% promotional (special offers, sales)

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

## BILLING (WHOP — NEVER STRIPE)

### Plans:
```
Trial:        Free       — 10 credits, 7-day trial
Starter:      $20/month  — 50 credits/month  ($18/mo yearly)
Professional: $40/month  — 100 credits/month ($36/mo yearly) ← recommended
Premium:      $60/month  — 150 credits/month ($54/mo yearly)
```

### Credit packs (top-up, no subscription):
```
25 credits  → $10
50 credits  → $20
75 credits  → $30
100 credits → $40
125 credits → $50
150 credits → $60
200 credits → $80
250 credits → $100
```

### Credits per action:
```
Static text card:  1 credit
Photo post:        3 credits
Carousel:          5 credits
Video:             10 credits
GEO Audit:         5 credits (first one is FREE per billing account)
Manual upload:     0 credits (own content)
```

### Free (no credits):
- Website scraping (any frequency)
- All analytics viewing
- Calendar browsing
- Editing captions of existing posts
- Social account management

### Whop webhook events handled (in billing.js):
```javascript
'membership.activated'   → activate plan, add credits, send confirmation email
'payment.succeeded'      → same as above (handles renewals + credit packs)
'membership.deactivated' → downgrade to trial, suspend account, notify if low credits
```

**Webhook URL:** `POST /api/billing/whop/webhook`
Returns 200 immediately, processes async. Verifies HMAC-SHA256 signature via `WHOP_WEBHOOK_KEY`.

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

## CURRENT STATUS & WHAT'S STILL TO BUILD

### ✅ FULLY BUILT:
- Full AI content pipeline (captions, images, carousels, video)
- industryKnowledge.js — complete with 10 industries
- SystemPromptBuilder.js — 6-section rich prompt assembly
- Guided wizard API (backend/routes/wizard.js) — all endpoints live
- ContentCreatorModal.js — current wizard UI
- Quick Post mode (frontend/pages/quick-post.js)
- Smart Counter-Query Engine (built into wizard route)
- ImageResizer.js — Sharp-based 3-variant processing
- GEO Audit — full pipeline (GeoAuditService.js + routes + frontend pages)
- Proactive Suggestions — SuggestionsEngine.js + routes + dashboard UI
- ContentMixTracker.js — 70/20/10 enforcement
- BusinessIntelligence.js + intelligence route + ROI page
- PostCoreAdvisor.js — weekly briefing + PostCoreBanner
- Business Knowledge Base — knowledge route + knowledge-base.js page
- Workspaces / Multi-account — full stack (routes + frontend)
- Admin portal — dashboard, customers, impersonation, audit log, broadcast
- Website scraping with 7-day cache
- Manual upload (0 credits) + 10GB media library
- Post analytics with per-platform breakdown
- Notifications (in-app bell + email queue)
- Auth (JWT + bcrypt + IP rate limiting + workspace JWTs)
- Password reset flow
- Reports page + ROI estimator
- DMs + Inbox + Contacts pages
- IndustryBenchmarks.js
- **Video pipeline #2** — VeoService.js (Veo 3.1 Fast primary) + RunwayService.js (Runway Gen-4 fallback #1) + PikaService.js (Pika 2.2 fallback #2) + HeyGen final fallback; full chain in VideoService.js
- **Social posting (all 5 platforms)** — SocialPublisher.js: Facebook, Instagram (3-step container flow), Google Business Profile, LinkedIn (with image upload), TikTok; AutoPostScheduler.js for scheduled posting; OAuth flows in social.js for all 5 platforms
- **PWA** — manifest.json, sw.js (cache-first for assets, network-first for nav, API calls always live), icons (192px + 512px), install banner with 7-day dismiss, meta tags in _app.js
- Whop billing — WhopService.js + full webhook handler (activation, renewal, deactivation, credit packs)
- **AI Receptionist** — ReceptionistService.js (intent classification, AI reply generation, escalation); receptionist.js route (config, conversations, leads pipeline, review actions); settings UI (full configuration panel)
- **SMS/WhatsApp inbox** — TwilioService.js + twilio.js inbound webhook; per-customer Twilio credentials; SMS conversation threading (sms_conversations + sms_messages)
- **Google Business Messages** — GMBMessagesService.js + gmb-messages.js webhook handler
- **Outbound Automations** — OutboundQueue.js + QueueService.js; 4 built-in rules (follow_up, review_request, noshow, seasonal) + unlimited custom rules; BullMQ + Redis when available; cron fallback when Redis absent
- **Custom Automations UI** — create/edit/delete custom automation rules in settings; all channels (SMS, WhatsApp, Email); trigger events; delay window; message template with variables
- **Meta WhatsApp Business API** — MetaWhatsAppService.js (Graph API v19.0); preferred over Twilio WhatsApp when `meta_wa_phone_number_id` + `meta_wa_access_token` configured; Twilio WhatsApp remains fallback
- **Channel selector** — automation modals always show SMS / WhatsApp / Email; unconfigured channels shown as disabled with "(not configured)" label so users know what to set up
- **Integration cards** — settings page has Twilio, Cal.com, Mailgun, and WhatsApp Business (Meta) cards with configure modals; credentials stored in receptionist_config, secrets never returned to frontend
- **Studio route** — AI-powered branded image card generator (Sharp + Claude, mounted at /api/studio)
- **`frontend/pages/wizard.js`** — dedicated wizard page, fully operational; text post hides media panel, 1 credit deducted
- **Security hardening** — bcrypt rounds 12, hashed reset tokens, JWT Bearer-only, SELECT FOR UPDATE on credit deductions, HMAC webhook enforcement, CSP + security headers on frontend and backend, knowledge base content sanitisation (`b4e0450`); round 2 adds JWT algorithm pinning, SSRF blocklist, token revocation after password reset, IDOR fix on analytics, DM auth defense-in-depth, limit/offset clamping, timing attack fix, admin bcrypt fix, broadcast rate limit (`0babf58`); round 3 adds impersonation JWT field fix (customerId), DB SSL rejectUnauthorized:true, atomic credit deduction in /wizard/refresh, angle whitelist + caption sanitisation against prompt injection, SSRF protection in NanoBananaService.editImage, ORDER BY lookup-map in external.js, customer field sanitisation in SystemPromptBuilder, HSTS header, restricted Next.js image remotePatterns, receptionist pagination cap (100), global JSON body limit 1mb, parallel timing equaliser in forgot-password
- **Developer API Keys** — scoped API key system (`api_keys` table); `backend/middleware/apiKey.js` + `backend/routes/apiKeys.js` + `backend/routes/external.js`; 8 permission scopes; `/api/v1/` external route layer (16 endpoints); Settings UI with 3-step create modal + one-time key reveal + inline revoke; SHA-256 key hashing; Trial = 0 keys, paid = 5 keys
- **UI/UX polish pass** — plain-English labels throughout (no jargon); navigation restructured with section dividers (Create, Manage, Grow, Business, Admin); "GEO Audit" renamed "AI Visibility" everywhere in the frontend; "Teach PostCore" renamed "Knowledge Base"; "Create Post" renamed "Upload"; content type badges show "Text Card" instead of "static" across all pages
- **Quick Post direct publish** — "Post Now" calls `socialAPI.publish()` directly instead of redirecting to /upload; inline success banner + "Post another" flow; no sessionStorage hack
- **Performance optimization** — 26 empty `getServerSideProps() { return { props: {} } }` removed across all pages; pages now use Next.js static optimization; all data still fetched client-side via useEffect
- **Settings cleanup** — removed "Image Source" and "Inbox Sync" sections from settings.js (non-functional placeholders)
- **First-time user welcome banner** — dashboard shows a contextual welcome card (with CTA to Quick Post) when the customer has zero posts
- **Billing plan taglines** — each plan card shows a plain-English description of who the plan is for

### 🔴 STILL TO BUILD:
- **Monthly report generator** — PDF generation via Resend (reports page is UI-only)
- **Token refresh** — OAuth tokens for Google/TikTok stored but not auto-refreshed on expiry

---

## DEVELOPER API KEYS

**Backend:** `backend/routes/apiKeys.js` + `backend/middleware/apiKey.js` + `backend/routes/external.js` — BUILT
**Frontend:** `frontend/pages/settings.js` (Developer API section) — BUILT

Allows customers to create scoped API keys for connecting third-party tools (Zapier, Jobber, Housecall Pro, their website developer, etc.) without sharing their login credentials.

### Key format & storage
- Format: `itspost_` + 40 hex chars (`crypto.randomBytes(20).toString('hex')`)
- Storage: `SHA-256(rawKey)` in `api_keys.key_hash` — raw key shown exactly once at creation
- Display: first 18 chars shown as prefix (`itspost_a1b2c3d4e5`) — rest never revealed

### Authentication
API keys authenticate via the same `Authorization: Bearer` header as JWTs. The `authenticateApiKey(pool)` middleware distinguishes them by the `itspost_` prefix, so the same header works for both. Sets `req.customerId`, `req.apiKeyScopes`, `req.parentCustomerId` (workspace-aware).

### The 8 scopes

| Scope | What it unlocks |
|---|---|
| `posts:read` | GET /api/v1/posts, GET /api/v1/posts/:id |
| `posts:write` | POST + PATCH /api/v1/posts (implies posts:read) |
| `generate:write` | POST /api/v1/generate — AI caption generation, deducts 1 credit |
| `analytics:read` | GET /api/v1/analytics/summary + /posts |
| `media:write` | POST /api/v1/media/upload |
| `contacts:read` | GET /api/v1/contacts |
| `contacts:write` | POST + PATCH /api/v1/contacts (implies contacts:read) |
| `knowledge:write` | GET + POST + PATCH + DELETE /api/v1/knowledge |

**Never expose via API keys:** billing, social OAuth tokens, admin operations, workspace management, auth/passwords.

### Plan limits
- Trial: 0 keys (shown but blocked with upgrade prompt)
- Starter / Professional / Premium: 5 keys each

### External API base
All external endpoints live at `/api/v1/`. Adding new external endpoints: add them to `backend/routes/external.js` with `requireScope('scope:name')` on each route.

### DB table
```sql
api_keys (id, customer_id, name, key_prefix, key_hash, scopes TEXT[], expires_at, last_used_at, revoked_at, created_at)
```
Indexes on `customer_id` and `key_hash`. Created at server startup via the migrations array in `server.js`.

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

*Last updated: May 2026 (v2.2) | ItsPosting.com*
