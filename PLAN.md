# ItsPosting — Master Product Roadmap
# Last updated: 2026-05-29 | Maintained by: Engineering lead
# RULE: Update the completion tracker as work is done. Never start a feature not listed here.

---

## VISION

ItsPosting is the AI social media manager built exclusively for local service businesses.
Every feature we ship must answer: "Does this help a plumber or roofer get more customers from social media without needing to understand social media?"

The 10-second morning moment:
> PostCore says: "Good morning, Mike's Plumbing. It's January — frozen pipe season. Here's a post ready to reach 800+ local homeowners." Mike taps Post Now. Done.

---

## PRIORITY SYSTEM

- **P0** — Fix this week. Broken or blocking users.
- **P1** — Ship this month. High user impact.
- **P2** — Ship next quarter. Growth/viral.
- **P3** — Backlog. Nice to have.

---

## WHAT IS ALREADY WORLD-CLASS

- Glassmorphism card system across all main pages
- Custom Ip-prefixed SVG icon system (~80 icons, depth shadows, gradient fills)
- Full dark/light theme token system (useTheme)
- PostCore AI persona (seasonal, industry-aware, business-voice)
- Industry knowledge system (10 industries, monthly seasonality data)
- Multi-platform publishing (FB, IG, GBP, LinkedIn, TikTok)
- Video pipeline (Veo 3.1 -> Runway Gen-4 -> Pika 2.2 -> HeyGen fallback)
- GEO/AI Visibility audit (15 queries x 3 engines = 45 checks)
- Workspace/multi-account system
- Developer API with 8 scoped key types
- PWA support with service worker
- Security hardened (bcrypt 12, hashed tokens, HMAC webhooks, SSRF blocklist)

---

## PHASE 0: CRITICAL FIXES (P0) — ALL COMPLETE

### 0.1 Fix stale Card import in analytics/index.js [DONE]
Remove Card from import. Replace any JSX Card usage with div + gc style.

### 0.2 Admin pages glass upgrade (7 files) [DONE]
Glass card pattern applied to all admin pages.

### 0.P PostCore Mascot [DONE]
7-mood animated SVG character in sidebar. Dashboard events wired (post published, streak, etc).

### 0.3 Global React error boundary [DONE]
ErrorBoundary class in _app.js. Catches runtime crashes, shows branded error page with retry.

### 0.4 Ideas page end-to-end [DONE]
GET /api/ideas/today returns data. "Use this idea" pre-fills wizard. "Refresh" generates new ideas.

---

## PHASE 1: UI/UX PERFECTION (P1)

### 1.1 Login & Signup — World-class treatment [DONE]
login.js: Desktop 2-column split. Left: animated radial gradient, rotating testimonials (3 businesses),
platform icons row, stat counters. Right: form + trust line. Mobile: single column.

signup.js: Step 1 = 2x5 industry card grid (icon + label, selected = primary border + checkmark overlay).
Step 2 = password strength meter (4 levels), trust badges (10 free credits, no CC, cancel anytime).

### 1.2 Dashboard — Command center upgrade [DONE]
- Quick-actions row: 4 glass tiles [Post for today | Schedule week | Turn review into post | My performance]
- 7-day sparkline mini-charts under metric cards
- Activation checklist (collapsible 5-step, confetti + 10 bonus credits on completion)
- TodaySuggestionBanner first after metrics; skeleton card prevents layout jump

### 1.3 Wizard — Cinema-grade UX [DONE]
- Step progress pill strip at top (active = filled gradient, done = green check, upcoming = outline)
- Card selection: scale(1.04) + glow shadow + checkmark overlay, 200ms cubic-bezier spring
- Loading: rotating messages + progress bar synced to backend events
- Results: 3 variation cards (A/B/C) side-by-side, hover-to-edit pencil, character counter per platform

### 1.4 Analytics — Data storytelling [DONE]
30-day engagement trend SVG AreaChart with gradient fill, trend indicator (up/down arrow + %).

Future recharts: content type BarChart, platform RadarChart, posting time heatmap (7x16 grid).

### 1.5 Calendar — Interactive scheduling [DONE]
- Month/Week view toggle
- Drag-to-reschedule (drop -> postsAPI.update(id, { scheduledDate }))
- Hover preview popover (caption preview + platform icons)
- Suggested slots: days with no posts + historically high-reach days get dotted border + tooltip

### 1.6 Post History — Power tool [DONE]
- Grid/list toggle (grid = 3-col image grid with hover overlay, list = current table)
- Bulk select: circle overlays on each post + floating action bar [Delete | Reschedule | Duplicate]
- Full-text search across caption + hashtags (client-side filter)

### 1.7 Media Library — Professional
[x] AI tag suggestions on upload (Claude extracts tags -> stored as ai_tags TEXT[])
[x] Background removal shortcut -> studioAPI.removeBackground() with before/after preview
[x] Folder drag-to-move between folders — HTML5 drag events on file cards + drop targets on folder cards; PATCH /api/media/:id backend; Escape cancels; drop hint banner; "Drop to move here" folder label

### 1.8 Settings — Completeness and clarity [DONE]
- Profile completeness progress bar (clickable missing items)
- Token expiry per account (green/yellow/red color-coded)
- Notification preferences: toggle per event (Post published, DM, GEO update, Briefing)
- Connected Accounts health: posts last 30d + avg reach per account [DONE - task 2.8]

### 1.9 Knowledge Base — Smarter AI training [DONE]
- Entry quality score badge (< 50 chars = "too short", > 200 chars = "great detail")
- "PostCore hasn't used this yet" indicator on unused entries

### 1.10 Billing — Conversion optimization [DONE]
[x] Credits usage circular progress ring (SVG stroke-dashoffset, animated, color-coded by usage %)
[x] Annual savings callout ("Save $96/yr" badge on Pro plan, billing cycle toggle)
[x] Credit packs quick-buy modal (grid: 25/50/75/100/125/150/200/250 credits, one-click -> Whop)

---

## PHASE 2: CORE PRODUCT IMPROVEMENTS (P1/P2)

### 2.1 PostCore Daily Intelligence [DONE]
Mon: full weekly briefing. Tue-Sun: 1-line seasonal/industry contextual hint in dashboard.
Performance celebration toast when post beats personal average by > 30%.

### 2.2 Caption A/B Tracking [DONE]
Track which variation (A/B/C) customer picks in wizard.
After 10 selections: detect preferred style + surface to user ("You pick B 70% — they tend to be shorter").
Store preference on customer; feed back into ClaudeService prompt.

### 2.3 Scheduling Conflict Detection [DONE]
Before saving: query posts WHERE scheduled_date BETWEEN $1 AND $2 AND platforms @> ARRAY[$3].
If conflict: toast "You already have a Facebook post at 10am. Post at 12pm instead?" + quick-reschedule chips.

### 2.4 Bulk Scheduling [DONE]
Calendar "Plan my week" -> select mode -> pick up to 7 days -> wizard opens once.
PostCore generates one post per day -> preview table -> one-click confirm -> all scheduled.

### 2.5 Post Templates Library [DONE]
Save template from results: name -> stores contentType, tone, platforms, hashtagSetId, notes.
"Use saved template" chip in wizard step 4 pre-fills all settings.
DB: post_templates (id, customer_id, name, settings JSONB, usage_count, created_at)

### 2.6 Hashtag Sets [DONE]
Settings > Hashtag Sets: create, edit, delete sets. Usage count tracked.
Wizard results: "Apply saved set" dropdown + "Add to set" button below hashtag chips.
Storage: customers.hashtag_sets JSONB (array of { id, name, tags[], usage_count }).

### 2.7 Real-time Video Status (SSE) [DONE]
POST /api/wizard/stream-ticket: issues 60s one-time UUID ticket (not JWT).
GET /api/wizard/status/:postId?ticket=...: SSE stream, polls DB every 3s, sends { status, progress }.
Frontend: native EventSource + polling fallback (setInterval every 6s) on onerror.
UI: animated SVG progress ring using CSS stroke-dashoffset, gradient stroke.

### 2.8 Social Account Health Dashboard [DONE]
GET /api/social/health: per-account { id, platform, postsLast30d, avgReachLast5, connectedAt, tokenExpiresAt }.
Settings Connected Accounts: each account row now shows "X posts this month · ~Y avg reach".
Expired tokens: inline "Reconnect" button appears without leaving the page.

### 2.9 Smart Scheduling AI ("best time" auto-pick) [DONE]
After wizard generates content, offer:
  "When should I post this?"
  [PostCore picks best time] OR [I'll choose myself]

PostCore logic:
1. Read analyticsAPI.getOptimalTimes()
2. Pick first available slot matching this customer's historically best day + hour
3. Show: "Thursday 10am — your last 3 Thursday morning posts averaged 2.3x your normal reach"
4. One-click accept -> schedules at that time with explanation on the post record

Implemented: PostCore Smart Schedule banner in wizard results, one-click accept, dismiss option.

---

## PHASE 3: VIRAL GROWTH FEATURES (P2)

### 3.1 Referral Program [DONE]
Mechanic: Share link -> friend upgrades -> you get 20 credits.
Implementation:
- customers.referral_code VARCHAR(20): BUSINESSPREFIX(6)+4hex chars
- Referral link: itsposting.com/signup?refcode=MIKE1a2b (uses ?refcode= to avoid conflict with workspace ?ref=)
- customers.referred_by VARCHAR(20)
- On referral upgrade (Whop membership.activated): /api/referrals/award awards 20 credits to referrer
- Email: "Someone you referred just upgraded! Here are your 20 bonus credits."
Billing page Referral tab: link + one-click copy + stats (total referrals, upgraded, credits earned) + share buttons (X/Twitter, WhatsApp, email)
Backend: backend/routes/referrals.js; frontend: billing.js Refer & Earn tab; auth.js captures referredBy on signup.

### 3.2 Shareable Posts + Viral Watermark [DONE]
Every downloaded image has optional "Made with ItsPosting" watermark.
- Wizard results: "↓ Download Image" button
- Modal: [Download with watermark (+5 free credits)] vs [Download clean]
- Watermark: Sharp SVG composite text layer, bottom-right, semi-transparent with drop shadow
- Backend: POST /api/wizard/download-image; awards 5 credits once per post via credit_transactions check
- SSRF protection: only Cloudinary/GCS/NanoBanana/HeyGen CDN hosts allowed
- ImageResizer.addWatermark() exported utility function
- [ ] /showcase page: public gallery (backlog)

### 3.3 Industry Leaderboard (Anonymous FOMO) [DONE]
Analytics page addition:
  "How you stack up — HVAC businesses this month"
  🥇 A plumber in Chicago: 847 avg views/post
  🥉 Your ranking: Top 23%
  "Want to break into the top 10%? Here's what they're doing ->"
Data: aggregated anonymized analytics. No PII exposed.
Backend: GET /api/analytics/leaderboard (PERCENTILE_CONT, top performers anonymized to first 2 words of city).
Frontend: analytics/index.js leaderboard widget with percentile badge, progress-to-next-tier bar, PostCore tips, CTA.

### 3.6 White-Label Option (Agency Plan)
Target: Marketing agencies managing 10+ local businesses.
- Custom domain, logo/color replacement, client portal, agency dashboard
- $200/month, unlimited sub-accounts
- white_label_config JSONB on customers: { logo, primaryColor, domain, agencyName }
- Layout.js reads and overrides branding if set

---

## PHASE 4: NEW PRODUCT FEATURES (P2/P3)

### 4.1 One-Click Video Wizard
Single screen: Choose [Talking-Head] OR [Cinematic Job Footage].
Talking-head: PostCore writes 30s script -> HeyGen renders.
Cinematic: PostCore writes scene -> NanoBanana -> Veo animation.
Single "Generate" button, results in same view, no redirects.

### 4.2 Google Review Response AI [DONE]
For each review: [Turn into post] AND [Draft a response].
Bad review: 3 response styles (Empathetic / Professional / Brief).
One-click publish response via Google Business API.
Backend: POST /api/social/reviews/draft-reply (Claude 3 styles) + POST /api/social/reviews/:id/post-reply (GMB PUT).
Frontend: "Draft Reply" button per review in dashboard; modal with style selector + editable textarea + "Post Reply to Google".

### 4.3 30-Day Content Calendar Generator [DONE]
"Auto-plan my month" on Calendar.
PostCore returns 12-15 pre-filled slots (day, time, content type, topic).
User reviews in drag-reorderable grid -> one-click confirm -> all created as drafts.

### 4.4 Competitor Intelligence
User enters up to 3 competitor names/websites.
ScraperService pulls their public posts.
PostCore analyzes: content types, tones, engagement patterns.
Report: "Your competitor posts Wed/Fri, mostly before/after. Their avg likes: 45. Yours: 12."
"Generate a better version of their best post ->" CTA pre-fills wizard.

### 4.5 Testimonial Machine [DONE]
"Enable auto-testimonial posts" toggle in Settings.
Every 2 weeks: PostCore picks best unposted review -> generates caption via Claude.
Draft appears with "⭐ Auto-Testimonial" badge in history.js.
Backend: TestimonialMachine.js service + Mon+Thu 10am UTC cron; posts to `posts` table as source='auto_testimonial' status='draft'.
Frontend: Settings toggle (PATCH /api/customers/preferences); "⭐ Auto-Testimonial" badge in post history; Active status panel with explanation.

### 4.6 Inbox Approval Queue Mode
New mode between full-auto and manual.
AI drafts reply -> shows as "Draft — Pending approval" in inbox.
Shows: sentiment score, urgency level (red/yellow/green), customer intent estimate.
Mobile: swipe right = send, swipe left = dismiss.

### 4.7 PDF Report Export
"Export report" on analytics/[month] page.
Branded PDF: cover page, metrics summary, top posts, content mix chart, recommendations.
Uses Sharp for chart rendering + pdf-lib for assembly.

### 4.8 Team Post Approval Workflow [DONE]
Workspace members submit drafts → manager reviews before publishing.
DB: posts.approval_status (pending/approved/changes_requested/rejected), posts.approval_history JSONB, posts.approval_note.
Backend: 4 new endpoints (submit-approval, approve, request-changes, reject-approval) in posts.js.
Frontend: "↑ Submit" button in history.js; status badges (Pending review, Changes requested).
New page: /approvals — manager view with Approve/Request Changes/Reject actions + optional note modal.
Layout.js: "Approvals" nav item with pending count badge.

---

## PHASE 5: TECHNICAL EXCELLENCE (P1/P2)

### 5.1 Performance — Lighthouse 90+ [DONE]
- [x] loading="lazy" on all post images in history.js (list + grid view)
- [x] Cache-Control: private, max-age=3600 on GET /api/billing/plans
- [x] Font split: Inter injected dynamically via useEffect (non-render-blocking); 19 studio fonts lazy-loaded only on /media (Photo Studio) — removed 20-family render-blocking link from every page
- [x] Removed duplicate Inter @import from globals.css
- [x] dns-prefetch for res.cloudinary.com in _app.js <Head>
- [x] Cache-Control: private, max-age=3600 on GET /api/wizard/steps
- [x] Cache-Control: private, max-age=1800 on GET /api/analytics/leaderboard
- [ ] Bundle analysis: ANALYZE=true next build (developer task — run locally to identify next wins)

### 5.2 Accessibility — WCAG 2.1 AA [DONE]
- [x] aria-label on icon-only buttons (Layout: mobile menu open/close, theme toggle)
- [x] role="status" + aria-live="polite" on ToastContainer; aria-label="Loading" on Spinner
- [x] role="dialog" + aria-modal="true" + aria-labelledby/describedby on ConfirmModal; focus auto-moves to Cancel button on open
- [x] textMuted dark token raised from #6E6E73 to #7A7A80 (4.76:1 contrast ratio, exceeds WCAG AA 4.5:1)
- [x] aria-label="Main navigation" on Layout nav element
- [x] Button component wrapped with forwardRef to support focus management

### 5.3 Error State Polish [DONE]
- ErrorCard component in ui.js; dashboard.js + history.js upgraded
- Session expiry: GlobalToast in _app.js listens for itsposting:session-expired (amber, 2.5s redirect)
- Server errors: itsposting:server-error event shows red dismissable toast

### 5.4 Loading State Consistency [DONE]
SkeletonPage component in ui.js. analytics/index.js overview + posts tabs use it.
history.js already had proper per-row Skeleton usage.

### 5.5 Database Performance — Add missing indexes [DONE]
CREATE INDEX IF NOT EXISTS idx_posts_customer_id ON posts(customer_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_date ON posts(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_source ON posts(source);
CREATE INDEX IF NOT EXISTS idx_engagement_snapshots_post_id ON post_engagement_snapshots(post_id);
CREATE INDEX IF NOT EXISTS idx_notifications_customer_id ON notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(customer_id, is_read);
CREATE INDEX IF NOT EXISTS idx_business_knowledge_customer_id ON business_knowledge(customer_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_customer ON social_accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_dm_conversations_customer ON dm_conversations(customer_id);
All added to server.js migrations array.

### 5.6 Rate Limiting — Per-endpoint granularity [DONE]
File: backend/middleware/rateLimits.js created.
AI_LIMIT (10/min), UPLOAD_LIMIT (30/min), AUTH_LIMIT (5/min), RESET_LIMIT (3/15min),
POST_LIMIT (30/hr), GEO_LIMIT (5/hr), BROADCAST_LIMIT (3/day), INVITE_LIMIT (10/hr).
Applied in server.js: upload, geo/audit, customers/invite routes.

### 5.7 Webhook Reliability [DONE]
Webhook event log table: webhook_events (id, source, event_type, payload, processed_at, status, error_message)
Table created in server.js migrations. Whop billing webhook logs every event (source, action, id) immediately after signature verification.

---

## PHASE 6: MARKETING & GROWTH (P2)

### 6.3 Email Onboarding Sequence (7 emails) [DONE]
Day 0:  Welcome + wizard link with their industry pre-selected
Day 1:  "Your first post is ready — here's how to schedule it"
Day 3:  PostCore seasonal tip for their industry + current month
Day 5:  IF no post yet — "Having trouble? 2-minute walkthrough" + Loom/GIF
Day 7:  Trial expiry warning + upgrade CTA ("Upgrade to 100/month for $40")
Day 14: Success story from same industry
Day 30: Monthly ROI recap (X posts, Y people reached, $Z saved vs hiring)
OnboardingEmailService.js built. Day 0 fires on signup. Daily 9am cron for days 1-30.
onboarding_email_log table prevents duplicate sends. Premium dark-theme HTML emails.

### 6.4 In-App Activation Checklist [DONE]
ActivationChecklist.js on dashboard — 5-step collapsible card.
Steps: connect social | create first post | schedule a post | add 3 KB entries | run AI Visibility check.
Completion tracked in customers.activation_completed_steps TEXT[].
All 5 done: confetti animation + 10 bonus credits.

---

## PHASE 7: BRAND & IDENTITY (P1)

### 7.1 New Premium Logo
Replace current lightning-bolt circle with world-class mark.
File: frontend/components/ItsPostingLogo.js
Design: rounded-rectangle icon (modern app icon shape), premium purple gradient
(#6D28D9 -> #7C5CFC -> #A78BFA), inner symbol = stylized post-spark monogram.
4 variants: full (icon + wordmark), icon-only, wordmark-only, monochrome-on-white.
Export PNG 512px for website use (itsposting.com marketing site).

### 7.2 Branded Loading Experience
File: frontend/components/LoadingScreen.js
- Full-screen branded splash for auth-gated page loads (logo + shimmer bar + tagline)
- Wizard generation: rotating messages + SVG progress ring (done in 2.7)
- Button loading: inline spinner, button stays same width (no layout shift)
- PWA launch: splash screen matches brand colors

### 7.3 PostCore Mascot Extensions
Already built (Phase 0.P). Extend with:
[ ] More mood states: celebration on viral post, encouragement on first-ever post
[ ] Seasonal outfits: Santa hat December, hard hat for construction month
[ ] Speech bubble with dynamic PostCore tips on hover
[ ] Unlockable moods as user hits milestones (10 posts, 30-day streak, etc)

---

## PHASE 8: OWN LLM (P2 now, P1 in 6 months)

See LLM.md for full detailed roadmap.

Summary: Build ItsPosting's proprietary AI model, fine-tuned for local service business
social media. Replaces Claude progressively as training data grows.

Admin LLM panel: visible to admins now (frontend/pages/admin/llm.js).
Tabs: Training Data | Model Status | A/B Testing | Deployment | Changelog.
Not visible to regular customers until model is production-ready.

---

## DESIGN SYSTEM RULES (Non-negotiable)

Glass card recipe — gc constant:
```
background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card
backdropFilter: 'blur(16px) saturate(160%)'
border: 1px solid rgba(255,255,255,0.07) (dark) or t.border (light)
borderRadius: 16
boxShadow: t.shadowSm + inset 0 1px 0 rgba(255,255,255,0.04)
```

Typography scale:
- Page title: 18px 700 -0.035em
- Section header: 19px 700 -0.03em
- Card title: 14-15px 700 -0.02em
- Body: 13px 400-500
- Label/meta: 11-12px 500-600 t.textMuted
- Stats: 32-40px 800 -0.04em monospace

Interaction: transition 160-240ms, lift translateY(-2 to -4px), press scale(0.96-0.99).
Primary CTA: linear-gradient(135deg, #7C5CFC 0%, #9B7FFF 50%, #6D3FF2 100%) + 0 4px 15px rgba(124,92,252,0.4).

---

## ABSOLUTE RULES (NEVER BREAK)

1. Never import from lucide-react directly — via Icon.js (wizard cards) or Ip-prefixed (everything else)
2. Never hardcode colors — always t.primary, t.error etc from useTheme()
3. Never create page section without glass card treatment (gc constant)
4. Never fetch directly with fetch() — always through frontend/lib/api.js
5. Never use TypeScript — plain JavaScript throughout
6. Never store raw API keys — SHA-256 hash before DB
7. Never use Stripe — Whop only (Pakistan legal constraint)
8. Never bcrypt.hash(password, 10) — always rounds 12
9. Never add empty getServerSideProps() { return { props: {} } }
10. Never generate 1 post variation — always 3 (A/B/C)
11. Never add placeholder/mock data to production
12. Never skip HMAC webhook signature verification
13. Never accept JWT via query string — only Authorization: Bearer header
14. Model: claude-sonnet-4-6 — always this exact string

---

## COMPLETION TRACKER

### Phase 0: Critical Fixes
- [x] 0.1 Fix analytics/index.js stale Card import
- [x] 0.2 Admin pages glass upgrade (8 files)
- [x] 0.P PostCore Mascot — 7-mood animated SVG in sidebar
- [x] 0.3 Global error boundary in _app.js
- [x] 0.4 Ideas page glass + mascot events

### Phase 1: UI/UX Perfection
- [x] 1.1 Login split-layout + animated testimonial slider + stats
- [x] 1.2 Signup industry emoji grid + password strength meter + trust badges
- [x] 1.3 Dashboard quick-actions row + activation checklist (5-step, confetti, bonus credits)
- [x] 1.4 Wizard step progress pill strip + card pop animation + hover-to-edit pencil
- [x] 1.5 Analytics engagement trend SVG AreaChart
- [x] 1.6 Calendar week view toggle + drag-to-reschedule + hover preview
- [x] 1.7 Post history grid/list toggle + bulk select + floating action bar
- [x] 1.8 Media Library AI tagging + background removal
- [x] 1.9 Settings profile completeness + token expiry + notification preferences
- [x] 1.10 Knowledge Base quality scores + PostCore usage indicators

### Phase 2: Core Product
- [x] 2.1 PostCore daily micro-briefings (contextual hints Tue-Sun)
- [x] 2.2 Caption A/B tracking + preferred style detection
- [x] 2.3 Scheduling conflict detection (toast + quick-reschedule chips)
- [x] 2.4 Bulk scheduling (calendar select mode, PostCore generates per day)
- [x] 2.5 Post templates library (save/apply in wizard)
- [x] 2.6 Hashtag sets (Settings manager + wizard Apply/Add-to-set)
- [x] 2.7 SSE real-time video status + animated SVG progress ring
- [x] 2.8 Social account health (posts/month + avg reach per account in Settings)
- [x] 2.9 Smart scheduling AI ("best time" PostCore auto-pick)

### Phase 3: Viral Growth
- [x] 3.1 Referral program
- [x] 3.2 Shareable posts + watermark option
- [x] 3.3 Industry leaderboard in analytics — GET /api/analytics/leaderboard; percentile badge, top performers, progress-to-next-tier bar, PostCore tips, CTA in analytics/index.js
- [x] 3.6 White-label for agencies — white_label_config JSONB on customers; GET/PATCH /api/customers/white-label (agency plan only); Layout.js applies custom logo/name; settings.js White-Label section (upgrade prompt for non-agency); billing.js Agency plan card ($200/mo, email CTA)

### Phase 4: New Features
- [x] 4.1 One-click video wizard (dedicated /video-wizard page, Talking-Head + Cinematic modes, polling)
- [x] 4.2 Google review response AI
- [x] 4.3 30-day content calendar generator
- [x] 4.4 Competitor intelligence — competitor_profiles table; POST /api/competitor/:id/analyze (scrape + Claude strategic breakdown); 3-competitor max, 1 credit per analysis; /competitor-intel frontend with add/delete/analyze/use-opportunity flow; sidebar nav under Insights
- [x] 4.5 Testimonial machine
- [x] 4.6 Inbox approval queue mode (pending drafts, sentiment/urgency/intent badges, mobile swipe, role-gated approve)
- [x] 4.7 PDF report export (3-page branded A4 PDF via pdf-lib, cover + posts + recommendations)
- [x] 4.8 Team post approval workflow

### Phase 5: Technical
- [x] 5.1 Lighthouse 90+ on all pages
- [x] 5.2 Accessibility WCAG 2.1 AA
- [x] 5.3 Error state polish (every API call)
- [x] 5.4 Skeleton loading consistency
- [x] 5.5 Database indexes
- [x] 5.6 Per-endpoint rate limiting
- [x] 5.7 Webhook event log

### Phase 6: Marketing
- [x] 6.3 Email onboarding sequence (7 emails)
- [x] 6.4 In-app activation checklist

### Phase 7: Brand
- [ ] 7.1 New premium logo
- [x] 7.2 Branded loading experience (LoadingScreen.js)
- [x] 7.3 PostCore mascot seasonal/milestone moods — SEASONAL_MSGS by month (idle on dashboard), MILESTONE_MSGS (streak 3/7/30, posts 10/25/50/100); triggerMilestone() export; sessionStorage dedup

### Phase 8: Own LLM
- [ ] 8.1 Training data collection pipeline
- [ ] 8.2 Fine-tuning infrastructure setup
- [ ] 8.3 A/B test fine-tuned model vs Claude
- [ ] 8.4 Progressive handoff (fine-tuned handles more, Claude handles edge cases)
- [ ] 8.5 Admin LLM management panel (frontend/pages/admin/llm.js)

---

## PHASE 12: FULL DEVICE RESPONSIVENESS (P1)

Every page must work flawlessly on mobile (375px), tablet (768px), and desktop (1280px+).
The primary use case is a trades owner checking ItsPosting at 7am on their phone.

### 12.1 Global responsive layout audit [DONE — dashboard, wizard, history, billing, calendar all fixed]
Priority pages (highest mobile traffic): dashboard, inbox, wizard, calendar, history, billing.
Breakpoints:
- Mobile: max-width 480px → single column, larger touch targets (min 44px), no horizontal overflow
- Tablet: 481-1024px → 2-column where possible, collapsed sidebar
- Desktop: 1025px+ → full layout

Rules:
- Sidebar: drawer on mobile (hamburger toggle), rail on tablet, full on desktop
- All tables → card stacks on mobile (no horizontal scroll)
- All modals → full-screen bottom sheet on mobile
- Touch targets: minimum 44×44px (WCAG 2.1 success criterion 2.5.5)
- Font size floor: 13px body, 11px labels (never smaller)
- No `overflow-x: hidden` hacks — fix the root cause

### 12.2 Inbox mobile experience [DONE — Phase 4.6]
Two-panel inbox already collapses on mobile (showMobileThread state).
Swipe-right/swipe-left for approval queue implemented.
Pending: bottom-sheet style thread panel on mobile (slide up animation).

### 12.3 Wizard mobile experience [DONE]
Step cards: auto-fill minmax(180px,1fr) — 2 cols on mobile. Progress: linear bar on mobile.
Results: media panel goes full-width first on mobile. Action bar: Post Now full-width, secondary buttons in 2-col grid.
History grid: 2-col on mobile (was 3-col). Calendar already had full isMobile support.

### 12.4 Calendar mobile experience [DONE]
Month view: reduce cell padding, smaller text (already done); filter bar now horizontally scrollable (no wrap) on mobile; header padding reduced.
Week view: collapses to Mon-Fri 5-column strip on mobile (already done).
Day panel: fixed bottom-sheet on mobile (position:fixed, 78vh, border-radius 20px top, drag handle, backdrop overlay). Desktop still shows as right-column panel.
Drag-to-reschedule: desktop-only (not supported on touch — no change).

### 12.5 Photo Studio / Editor mobile experience [PENDING]
Konva canvas: pinch-to-zoom + pan gesture support.
Toolbar: hide on mobile, show via FAB (floating action button).
Properties panel: bottom drawer on mobile.
Note: The editor is complex — Tier 2 priority after pages above are fixed.

---

## PHASE 13: WORKSPACE MULTI-USER DEEP AUDIT (P1)

### 13.1 Audit findings [DONE — May 2026]

Two workspace types exist and both are now fully fixed:

**Type A** (auto-created sub-accounts):
- JWT: customerId = workspace.id, parentCustomerId = main.id
- Credit billing → parent via getBillingCustomerId()
- DMs, posts, content → owned by workspace.id ✓ (always worked)

**Type B** (invited members via workspace_invitations):
- JWT: customerId = member.id, workspaceId = workspace.id, ownerId = owner.id
- CRITICAL BUG FIXED (May 2026): dms.js was using req.customerId for DM queries
  instead of req.workspaceId. Invited members saw empty inbox. Now uses getDmCustomerId(req).
- Role-based access added to dms.js: viewer/editor/manager/owner
  - viewer: read-only, no send/AI draft
  - editor: can generate drafts, send replies, save pending drafts for manager review
  - manager: can approve/dismiss pending drafts and send
  - owner: full access (no workspace context = always owner)

### 13.2 Post approval workflow for workspace members [DONE — Phase 4.8]
Posts submitted for approval by team members (source: posts.approval_status).
Manager reviews in /approvals page. Approve / Request Changes / Reject.
Notification sent when status changes.

### 13.3 Workspace member DM approval workflow [DONE — Phase 4.6]
- Editor member generates AI draft → saved as pending_draft on dm_conversations
- Manager sees "Draft pending" badge on conversation card + pending count in "Pending" filter tab
- Manager reviews draft: sentiment color (green/yellow/red), urgency badge, intent label
- Manager: Approve & Send / Edit then send / Regenerate / Dismiss
- Mobile: swipe right to approve, swipe left to dismiss

### 13.4 UI for workspace roles [PENDING]
Currently roles are enforced at API level but the UI doesn't communicate them.
Needed:
- Role badge next to the user's name in the top bar when in workspace context ("Editor" / "Manager")
- Disabled state + tooltip on approve button if current user is 'editor' (not manager)
- workspaces.js: show role badge next to each member in the member list
- Settings: show "Your role in this workspace: Editor" banner

---

## PHASE 9: PHOTO STUDIO 2.0 — WORLD-CLASS EDITOR (P1)

### AUDIT FINDINGS (May 2026)

The current editor is built on React-Konva and is more capable than most people realise.
Before adding anything, here is an honest audit of what exists and what is missing
compared to Canva, Adobe Express, and Meta's Creator Studio.

---

#### WHAT IS ALREADY EXCELLENT (DO NOT REBUILD)

The editor ([TemplatesEditorInner.js](frontend/components/templates/TemplatesEditorInner.js))
already has:

- **Full Konva stage** — multi-select, transformer handles, drag, resize, rotate
- **Text elements** — full font picker (5 categories, 25 fonts from Google Fonts), 12 font
  pair combos with preview, letter spacing, line height, text transform (upper/lower/capitalize),
  bullet list mode, vertical alignment (top/mid/bottom), curve text (IcoCurve)
- **Image elements** — 7 filter presets (warm/cool/faded/vivid/bw/moody + normal),
  custom brightness/contrast/saturation sliders, duotone filter (custom Konva filter),
  12 blend modes, flip H/V, replace image
- **Shapes** — rect, circle, line, polygon, star, arrow, with fill/stroke/opacity/corner radius
- **Color picker** — extended 40-color palette, document colors, recent colors,
  hex input, native eyedropper (EyeDropper API), color wheel
- **Layout tools** — 6 alignment actions (L/R/T/B/centerH/centerV), distribute H/V, flip H/V
- **Layer management** — bring forward, send back, lock/unlock, duplicate, delete
- **Undo/redo** — full history stack
- **Snap to guides** — 5px threshold snap to element edges and canvas center
- **12 color schemes** — one-click palette apply (Ocean, Sunset, Forest, Fire, ItsPosting, etc.)
- **8 grid/photo layouts** — 2-col, 3-col, 4-col, 2-row, 4-square, 9-square, 3-strip
- **Stickers/emoji** — 6 categories, 20 items each
- **Multi-page** — page/slide system (carousel support)
- **5 canvas sizes** — IG Portrait (1080×1350), IG Square, IG Story, FB Post, Google Business
- **Stock photos** — Pexels search integration inside editor
- **Media library** — pick from customer's uploaded files
- **Background color** — full color picker on canvas background

**Verdict:** The editor foundation is solid and professional. Konva is the right library.
The gaps are in UX flow, AI integration, brand continuity, and polish — not in the core rendering.

---

#### WHAT IS MISSING (PRIORITISED BY IMPACT)

**TIER 1 — Critical gaps. Every serious design tool has these.**

| Gap | Impact | Notes |
|-----|--------|-------|
| Brand Kit | Very High | No saved brand colors/fonts/logo per customer. Every session starts blank. |
| Smart Placeholders | Very High | Templates have no `[BUSINESS NAME]` / `[PHONE]` / `[CITY]` auto-fill. |
| Post Now from editor | Very High | Must save → go back to Upload page → create post. Breaks the flow completely. |
| Gradient backgrounds | High | Canvas background is solid color only. No linear/radial gradients. |
| Design naming in editor | High | No title bar. Designs saved as "Untitled". Can't rename without leaving. |
| Auto-save | High | No periodic save. Crash = work lost. |
| QR code element | High | Local businesses print QR codes everywhere. Phone/website QR in a tap. |

**TIER 2 — Significant UX gaps that Canva solves well.**

| Gap | Impact | Notes |
|-----|--------|-------|
| AI in editor | Very High | No PostCore button. No background remover. No "suggest copy for this design". |
| Magic Resize | High | Can't auto-convert IG Portrait design to FB Post + Google Business at once. |
| "Apply to all pages" | High | Changing background on page 1 doesn't propagate to carousel pages 2-8. |
| Floating contextual toolbar | High | Selected element shows all properties in side panel. Canva shows 4 quick actions floating above the element itself — faster muscle memory. |
| Gradient/image backgrounds | High | Pattern textures, gradient overlays as background. |
| Keyboard shortcut reference | Medium | No shortcut overlay (Cmd+Z, Cmd+D, Cmd+G, etc. not discoverable). |
| Unified asset search | Medium | Can't type "roofing" and see templates + stock photos + elements together. |
| Version history / save points | Medium | Named save points ("Before adding CTA", "Client draft 1"). |
| Design sharing link | Medium | View-only shareable URL for sending to client for approval. |
| Element shadow/glow | Medium | Konva supports shadowBlur but editor doesn't expose it in the panel. |
| Stroke/border on shapes | Medium | Border weight and style not editable in current panel. |
| Copy/paste between pages | Medium | Can't copy an element from page 1 and paste to page 3. |

**TIER 3 — Advanced features for power users.**

| Gap | Impact | Notes |
|-----|--------|-------|
| Animated elements | Medium | Simple entrance animations (fade, slide, pop) for Stories/Reels. |
| Mobile-optimized editing | Medium | Touch targets too small; Konva transform handles not thumb-friendly. |
| PDF export | Low | Multi-page download as PDF. Useful for menus, price lists, flyers. |
| Dark/light mode in editor | Low | Editor is always dark regardless of app theme. |
| Collaboration (multi-user) | Low | Not needed for this niche. One business owner, maybe one VA. |

---

### 9.1 Brand Kit (P1 — Build first)

**Files:** New `frontend/pages/settings.js` (Brand Kit section) + backend `customers` table extension

**What it is:**
A saved brand identity per customer that the editor reads automatically when creating a new design.

**What it stores:**
```
Brand colors:  Up to 6 hex values (primary, secondary, accent, background, text, extra)
Brand fonts:   Primary font (headlines) + secondary font (body) from FONTS list
Brand logo:    Cloudinary URL of logo file (uploaded via media library)
```

**How it integrates with the editor:**
- "New Design" → editor pre-populates the color scheme with brand colors
- Color picker shows "Brand" section above document colors with the 6 brand swatches
- Font picker shows "Brand Fonts" at the top of the font list
- "Apply brand" button in editor toolbar recolors all text elements to brand colors + applies brand fonts

**Backend changes:**
```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS brand_colors JSONB DEFAULT '[]';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS brand_fonts JSONB DEFAULT '{}';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS brand_logo_url TEXT;
```

**API:** `PATCH /api/customers/profile` already handles arbitrary JSONB updates — no new route needed.

---

### 9.2 Smart Placeholders (P1)

**What it is:**
Admin creates templates with placeholder tokens. When a customer opens a template,
placeholders are replaced with their real business data.

**Placeholder tokens:**
```
[BUSINESS_NAME]  → customer.business_name
[PHONE]          → customer.phone
[CITY]           → customer.city
[WEBSITE]        → customer.website
[INDUSTRY]       → human-readable industry label
[TAGLINE]        → customer.tagline (new field)
[YEAR]           → current year
[MONTH]          → current month name
```

**How it works:**
1. Admin creates a template with `[BUSINESS_NAME]` in a text element
2. Customer opens template → editor calls `customerAPI.getProfile()` on load (already done)
3. Editor loops through all text elements and replaces tokens before rendering
4. Customer sees their actual business name, not a placeholder
5. They can still edit the text manually after it's been filled in

**Implementation:** Pure frontend function in TemplatesEditorInner.js:
```javascript
function applyPlaceholders(pages, profile) {
  const map = {
    '[BUSINESS_NAME]': profile.business_name || '',
    '[PHONE]': profile.phone || '',
    '[CITY]': profile.city || '',
    '[WEBSITE]': profile.website || '',
  };
  return pages.map(page => ({
    ...page,
    elements: page.elements.map(el =>
      el.type === 'text' ? { ...el, text: Object.entries(map).reduce((t, [k, v]) => t.replaceAll(k, v), el.text) } : el
    ),
  }));
}
```

---

### 9.3 Post Now from Editor (P1 — Critical flow fix)

**Current broken flow:**
Editor → Save design → Go back to /media → Click creation → Go to /upload page → Create post → Done.
**That is 4 page navigations to post one design.**

**Target flow:**
Editor → [Post Now] button → bottom sheet slides up → select platforms → caption (pre-generated by PostCore) → Post / Schedule. Done.

**What to build:**
- "Post Now" button in editor top bar (primary CTA — most users came here to post, not just design)
- Bottom sheet modal (same as quick-post.js): platform selector + caption area
- Caption pre-filled by calling `claudeAPI.generateCaption({ imageContext: currentDesignName })` on open
- On confirm: `studioAPI.saveCreation()` → `postsAPI.create()` → `socialAPI.publish()` or schedule
- Success state: confetti + "View post" link

---

### 9.4 Gradient Backgrounds (P1)

**Current state:** Canvas background is a single hex color.

**Add:**
1. **Linear gradients** — 2 color stops, angle picker (0°–360°), preset angles (45°/90°/135°/180°)
2. **Radial gradients** — 2 color stops, center/edge focal point
3. **Preset gradients** — 20 curated gradients per brand color scheme, shown as swatches
4. **Image background** — set any uploaded image as full-bleed canvas background (already possible via a full-size image element, but should be a dedicated BG mode)

**Implementation:**
Konva `Stage` renders background as a `Rect` element that fills the canvas. Currently sets `fill` to hex.
Add support for `fillLinearGradientColorStops`, `fillRadialGradientColorStops` on the background Rect.
Store in `canvas_json.pages[n].bgType: 'solid'|'linear'|'radial'|'image'` and `bgGradient: {}`.

---

### 9.5 QR Code Element (P1)

**Why:** Local businesses put phone number and website on every physical piece of marketing.
A QR code element that auto-generates from the business website/phone is genuinely unique.

**Implementation:**
- Use `qrcode` npm package (zero-dependency, no API call)
- Element type: `'qrcode'` — stores `{ url, fgColor, bgColor, cornerRadius }`
- In editor: "Add element → QR Code" → modal shows "Link to Website / Phone / Custom URL"
- Website pre-fills from `customer.website`, phone formats as `tel:` URL
- Renders as image (PNG dataURL) via qrcode.toDataURL()
- Can be resized, styled, moved like any other element

---

### 9.6 Magic Resize (P2)

**What Canva calls "Magic Resize" — the single most-requested Canva Pro feature.**

After completing a design in IG Portrait (1080×1350), one button creates adapted versions for:
- Facebook Post (1200×630) — landscape layout re-flowed
- Google Business (720×720) — square crop
- IG Story (1080×1920) — vertical extension

**Implementation strategy:**
Canvas resize is complex to do perfectly (element repositioning is non-trivial).
Start with a smart crop approach:
1. User clicks "Resize to All Formats"
2. For each target format: create a new page at the target size
3. Scale all elements proportionally to fit
4. Flag oversized/cropped elements with orange border handles so user can adjust
5. User corrects the 1-2 elements that need tweaking, then exports all 4

This gets 80% of the value with 20% of the complexity of a full re-layout engine.

---

### 9.7 AI Integration in Editor — PostCore Magic Toolbar (P1)

**The biggest differentiator. No competitor puts AI inside the canvas editor.**

**Where it lives:** Floating button in the editor toolbar — "✦ PostCore" — always visible.

**What it does (4 actions):**

**1. Write caption for this design**
Sends canvas thumbnail + design name + customer industry to Claude.
Returns a platform-optimised caption ready to use in the Post Now flow.
"I see this is a before/after roofing job. Here's your Facebook caption:"

**2. Remove background from selected image**
Calls `studioAPI.removeBackground(imageUrl)` (backend uses Sharp + rembg or Cloudinary's bg removal).
Replaces image element with the transparent-background version.
Shows before/after toggle in the panel.

**3. Suggest color palette from image**
Selected image element → Claude Vision or Cloudinary's color palette extraction.
Returns 5 dominant colors → auto-fills brand palette picker.
"I pulled these colors from your photo. Apply to design?"

**4. "Improve this text" on selected text element**
Selected text → PostCore rewrites it to be more engaging/professional.
Shows original vs suggested side-by-side. Customer picks one.

---

### 9.8 Element Enhancements: Shadow, Stroke, Copy-Paste (P1)

**Shadows on all elements:**
Konva supports `shadowBlur`, `shadowColor`, `shadowOffsetX/Y` natively.
Add shadow controls to the properties panel: toggle on/off, blur radius, offset X/Y, color, opacity.
Preset shadows: None / Soft / Hard / Glow (color-matched)

**Stroke/border on shapes and text:**
Konva `strokeWidth` and `stroke` already on shapes. Currently not exposed in the right panel.
Add: stroke width (0–20px), stroke color picker, stroke position (inner/outer/center).

**Copy/paste across pages:**
Cmd+C / Cmd+V already works within a page.
Add cross-page paste: if on page 2 and clipboard has elements from page 1, paste lands on page 2.
"Paste to all pages" option for brand elements (logo, footer bar).

---

### 9.9 Auto-Save + Design Naming (P1)

**Auto-save:**
Every 30 seconds and on any navigation away: call `studioAPI.saveCreation()` silently.
Show "Saved" indicator (green dot, fades after 2s) vs "Saving..." vs "Unsaved changes" (amber).
On crash recovery: load the last auto-saved state with a "Restored from auto-save" toast.

**Design naming:**
Title bar at top-center of editor: click to rename (inline input, blur to save).
Title stored as `canvas_json.title` and displayed in "My Designs" grid.
Default name: `[Industry] Design — [Date]` (e.g. "Roofing Design — Jan 15").

---

### 9.10 Floating Contextual Toolbar (P2)

**What Canva gets right that we don't:**
When you click a text element in Canva, a small floating toolbar appears *above* the element
with the 4 most-used actions: Bold · Italic · Color · Font size.
You don't have to look to the right panel at all for common edits.

**Implementation:**
When an element is selected and the transformer is active, render a `<div>` positioned
above the transformer bounding box (using the Konva transformer's boundingBox clientRect).
Contents vary by element type:
- Text: Bold toggle · Italic toggle · Font size ± · Text color · Alignment chips
- Image: Filter quick-select (5 filter dots) · Flip · Replace
- Shape: Fill color · Stroke color · Opacity slider · Corner radius (if rect)

All changes are mirrored to the right panel. The floating toolbar is a shortcut, not a replacement.

---

### 9.11 Keyboard Shortcuts Overlay (P2)

**Cmd+Z** Undo · **Cmd+Shift+Z** Redo
**Cmd+D** Duplicate · **Delete** Remove element
**Cmd+G** Group selection · **Cmd+Shift+G** Ungroup
**T** Add text · **R** Add rectangle · **C** Add circle
**Cmd+[** Send back · **Cmd+]** Bring forward
**Cmd+A** Select all · **Escape** Deselect
**Cmd+S** Save · **Cmd+Shift+E** Export/download
**?** Show this overlay

Implementation: `useEffect` keyboard listener in editor. `?` key toggles a modal overlay
showing the full shortcut list in a 2-column grid. Also add small shortcut hints to button tooltips.

---

### 9.12 Carousel Preview Mode (P2)

**Current state:** Multiple pages exist but there is no way to preview the carousel
as it would appear on Instagram — swiping between cards.

**Add:**
- "Preview" button in top bar → enters full-screen preview mode
- Cards displayed side-by-side at mobile scale (375px wide each)
- Left/right arrows + swipe gestures to flip between slides
- Shows slide count indicator (1 / 5)
- "Export all" button in preview mode → downloads all slides as a ZIP
- Exits back to editor with Escape or X

---

### DESIGN PRINCIPLES FOR THE EDITOR REDESIGN

**1. The editor must feel like it was made specifically for a plumber using an iPad.**
Not for a graphic designer on a desktop. Every default, every template, every placeholder
is trade-business-specific. No abstract shapes, no generic "Lorem ipsum" text.

**2. Speed over features.**
A business owner should be able to open a template, swap the photo, change their name,
and post in under 60 seconds. Every feature added must not slow down this path.

**3. Brand kit is the unlock.**
The moment a customer sets their brand colors and fonts, every template becomes theirs
instantly. That is the "wow moment" for the editor. Build brand kit first.

**4. AI is the differentiator.**
No competitor has PostCore inside their canvas editor. The "Write caption for this design"
and "Remove background" buttons are the features that get shared on social media.

**5. The editor is not Photoshop.**
Resist adding features that require training to use. Curves editor, pen tool, masking layers —
no. Text, shapes, photos, colors, and brand consistency — yes.

---

## Phase 9 Addendum: Canvas UX Deep Dive — Interaction Design Specification

> This section defines **exactly how the editor should feel**, not just what features it has.
> The benchmark: after using this editor for 60 seconds, a plumber on an iPad should feel like
> they are using a tool designed specifically for them by the teams behind Canva, Figma, and Apple.
> Features without friction-free UX are just complexity. Every interaction spec below is mandatory.

---

### UX-1: Canvas Interaction Model (The Foundation)

**Selection:**
- Single click element → selects it; 8-handle transformer + rotation handle appear instantly (0ms delay — no animation on selection itself, it must feel snappy)
- Single click background → deselects all; transformer disappears
- Double-click text element → enters inline edit mode immediately; cursor blinks inside; keyboard opens on mobile
- Double-click image element → opens image replacement panel on the right; no navigation away
- Shift+click → multi-select; transformer wraps all in a shared bounding box
- Click+drag on empty canvas → rubber-band marquee selection; semi-transparent blue fill `rgba(91,111,245,0.15)`, solid blue border `#5B6FF5`
- Drag selected element → moves it; smart guide lines appear when within 6px of any element edge, canvas center, or canvas thirds

**Selection ring appearance:**
- Primary selection: `2px solid #5B6FF5` around bounding box
- First-select pulse: element scales `1.0 → 1.03 → 1.0` over 120ms ease-out-back (subtle "click pop" feel)
- Multi-select: `2px dashed #5B6FF5`
- Hovered-not-selected: `1px dashed rgba(91,111,245,0.4)` (signals "this is interactive" to new users)
- Locked element: `2px dashed #E05C5C` + small 🔒 icon at top-left of bounding box

**Resize handles (exact specs):**
- Visual: 12px × 12px circle, white fill, `2px solid #5B6FF5` stroke, `0 2px 6px rgba(0,0,0,0.4)` drop shadow
- Touch target: 44px × 44px invisible tap zone centered on each handle (Apple HIG minimum)
- Corner handles: proportional scale by default; hold Shift for free scale
- Side midpoint handles: single-axis stretch only
- Rotation handle: 28px above top-center midpoint; shows ↻ cursor; floating angle label (e.g. "45°") appears next to cursor during rotation and disappears 600ms after release

**Smart guides (snap behavior):**
- Snaps to: element edges, element centers, canvas center axes, canvas edge margins (8px inset), canvas thirds
- Snap threshold: 6px desktop, 12px mobile/tablet
- Visual: guide line color `#5B6FF5` at 85% opacity; extends full canvas width or height (not just the gap between two elements)
- Guide animation: appears instantly on snap; fades out 350ms after pointer velocity drops below threshold (not on mouseup — feels natural)
- Magnetic snap: element "jumps" to alignment position when within threshold
- Hold Alt/Option to temporarily disable snap during drag

**Layering feedback:**
- Bring forward / Send back: element briefly highlights with a 150ms `#5B6FF5` tint overlay, then clears
- Current z-index order shown in right panel as "Layer 3 of 7" with up/down arrows

---

### UX-2: Touch & Mobile Canvas (iPad-First, Not iPad-Afterthought)

Local business owners are on iPads and phones. The editor must feel as natural on a 10" touchscreen as on a desktop. **Accidental taps are the #1 frustration on mobile — every gesture must be intentional.**

**Core gestures:**
| Gesture | Action |
|---|---|
| Two-finger pinch | Zoom canvas (0.25× – 4×); centered at pinch midpoint |
| Two-finger pan | Pan the canvas viewport (works at any zoom level) |
| Single tap | Select element / deselect background |
| Double-tap element | Enter edit mode (text keyboard; image replace panel) |
| Double-tap background | Zoom to fit (reset to 100% centered) |
| Long-press element (500ms) | Context menu: Edit · Duplicate · Bring Forward · Send Back · Delete |
| Three-finger tap | Undo (matches iOS native convention) |
| Three-finger swipe right | Redo |
| Pinch within selected element | Scale that specific element (not the canvas viewport) |
| Two-finger rotate within selected element | Rotate that element |

**Touch-specific layout:**
- On viewports < 768px: right properties panel collapses into a **bottom sheet** (drag indicator at top; half-height by default; swipe up for full height)
- Bottom sheet shows the 4 most relevant controls for current element type
- Top toolbar on mobile: shows only [Post Now] [Undo] [Redo] [⋯ More]
- Left panel becomes a **bottom-anchored icon bar** (5 icons): Templates · Elements · Photos · Text · Upload
- Tapping a bottom bar icon opens a modal panel from below (60vh); backdrop dismisses it

**Drag handle sizing on touch:**
- Handles: 16px × 16px circles (larger than desktop)
- Touch target: 44px × 44px (mandatory — no exceptions)
- Handles are positioned 4px outside the element bounding box on touch (not flush) so fingers don't obscure the element while dragging

---

### UX-3: Panel Layout Redesign

**Left Panel (280px desktop; bottom bar mobile):**
```
Tab 1 [◧] Templates  — industry-filtered, most-used first, live search
Tab 2 [⊞] Elements   — shapes, lines, frames, stickers, QR Code
Tab 3 [⊟] Photos     — media library grid + Pexels search integration
Tab 4 [T] Text        — heading presets, body text, add custom text
Tab 5 [⬆] Upload      — drag-drop zone, recent uploads grid
```
- Active tab: `#5B6FF5` icon color + 2px bottom border in `#5B6FF5`
- Panel scrolls independently from canvas
- Sticky search bar at top of Templates and Photos tabs (clears on tab switch)
- Section headers inside panel: collapsible, show item count ("Shapes · 24")
- 2-column thumbnail grid for visual assets; full-width list for text styles

**Right Panel (280px; bottom sheet on mobile) — fully contextual:**
```
Nothing selected    → Canvas: size picker, background color/gradient, page list
Text selected       → Font family, size, weight, style, alignment, color, line height, letter spacing, shadow toggle
Image selected      → Crop handle, 5 filter presets, opacity slider, flip H/V, Replace Image button
Shape selected      → Fill color, stroke color + width, corner radius, opacity
Group selected      → Group opacity, "Ungroup" button, alignment tools within group
Multi-select        → Align (L/Center/R/Top/Mid/Bot), Distribute H/V, Group, Delete all
```
- Sections use accordion with 200ms height transition (smooth expand/collapse)
- Color picker opens as a popover: shows `Brand` section first (6 brand swatches), then `Document Colors` (recently used), then full color wheel with hex input
- Number inputs: stepper arrows appear on hover (±1 per click; ±10 with Shift held)
- Sliders: numerical readout on the right (click to type directly); range labels appear on hover

**Top Toolbar (56px tall, sticky, frosted glass):**
```
[← Back] [●●● Design Name (click to rename)] ────────── [? Shortcuts] [⟲ Undo] [⟳ Redo] [✦ PostCore ▾] [⊡ Magic Resize] [▶ Preview] [↓ Export ▾] [Post Now ▶]
```
- Background: `rgba(10,10,18,0.88)` with `backdrop-filter: blur(14px) saturate(160%)`
- `Post Now` is always the rightmost button; primary fill color `#5B6FF5`; pill shape
- `Export ▾` dropdown: PNG · JPG · All Pages as ZIP
- `✦ PostCore ▾` dropdown: Write Caption · Remove Background · Suggest Colors · Improve Text
- Design name: click to rename; blur to save; max 60 chars; placeholder "Untitled Design"
- Save indicator: sits immediately left of Design Name — `● Saved` (green), `○ Saving…` (amber pulse), `! Unsaved` (amber static)

---

### UX-4: Micro-Interactions & Animation Budget

All animations must complete within 300ms. The editor must maintain **60fps with up to 30 elements on canvas**. Animations are never decorative — each one communicates state.

**Element add (from left panel):**
- Scale `0.85 → 1.0` + opacity `0 → 1`, duration 180ms, `cubic-bezier(0.34, 1.56, 0.64, 1)` (ease-out-back — has a slight overshoot that feels "physical")
- Exception: text box added → directly enters edit mode, no entrance animation (snappy = professional)

**Element delete:**
- Scale `1.0 → 0.75` + opacity `1 → 0`, duration 140ms, `ease-in`
- Then removed from DOM. Matches iOS app deletion feel.

**Drag pickup and drop:**
- Pickup: scale `1.0 → 1.04` + shadow `0 4px 8px rgba(0,0,0,0.3)` → `0 12px 24px rgba(0,0,0,0.5)` in 80ms
- During drag: element at 92% opacity; non-dragged elements dim to 70% opacity (creates depth cue)
- Drop: scale back to `1.0` + shadow reduces in 100ms ease-out; spring settle (stiffness 180, damping 20) — feels like the element has weight when it lands

**Undo / Redo:**
- Undo: undone element briefly overlays with `rgba(224,92,92,0.25)` tint for 100ms then clears
- Redo: redone element briefly overlays with `rgba(91,111,245,0.25)` tint for 100ms then clears
- Stack position shown: "3 / 10" label next to Undo button updates after every action

**Template load:**
- Background color renders immediately (synchronous)
- Image placeholders: show shimmer skeleton (`rgba(255,255,255,0.06)` animated sweep) until image loads
- Text: renders at 60% opacity immediately, fades to 100% when smart placeholders have been applied (signals that personalization happened)
- Staggered entrance: background first, images group 30ms later, text group 60ms later

**Snap guide:**
- Appears in 0ms (no fade-in — must feel instant and precise)
- Fades out 350ms after pointer velocity drops to zero (not on mouseup)

**Color picker open/close:**
- Opens with scale `0.95 → 1.0` + opacity `0 → 1` over 120ms — feels like it "blooms" from the swatch
- Closes with opacity `1 → 0` over 80ms (faster close = responsive feel)

**Panel tab switch:**
- Panel content: cross-fade 120ms (old content fades out, new content fades in — no layout shift)
- Active indicator bar: slides horizontally to new tab position in 150ms ease-out

---

### UX-5: Empty State & In-Editor Onboarding

**Blank canvas (new design, no template):**
- Canvas center: large dashed-border circle (64px diameter, `2px dashed rgba(255,255,255,0.2)`)
- Inside: `+` icon in `rgba(255,255,255,0.4)`
- Below circle: "Start with a template" (primary button) and "Start blank" (text link)
- Disappears instantly when the first element is added
- Never shown again on re-open of the same design

**Template loaded for the first time:**
- 3 pulsing blue dots (20px) appear over: (1) any text element, (2) the left panel Templates tab, (3) Post Now button
- Each dot has a tooltip bubble that shows for 4 seconds: "Click to edit your business name" / "Swap for a different template style" / "Post directly when you're ready"
- Entire onboarding dismissed after: user clicks any element, or after 8 seconds
- Stored in `localStorage` → shown exactly once, never again

**Re-entering a saved design:**
- Bottom toast for 3 seconds (auto-dismiss): "Last saved 5 minutes ago · [Edit]"
- If auto-saved recovery: amber banner at top of editor: "Restored from auto-save · [Dismiss]"

**Empty left panel state (no matching templates for search):**
- Illustration: small coffee cup or tool (trade-themed)
- Text: "No templates match '[search term]'"
- Sub-text: "Try a different keyword, or [Start blank]"

---

### UX-6: Zoom & Viewport Management

- Zoom controls: bottom-left corner of editor (keeps toolbar clean)
  - Visual: `[−] [75% ▾] [+]`
  - Click percentage → dropdown: 25% · 50% · 75% · 100% · 150% · 200% · Fit
- `Cmd+0` → Fit design in viewport (most-used zoom action — must always work)
- `Cmd+1` → 100% actual size
- Spacebar + drag → temporary pan mode (cursor becomes ✋; release returns to pointer mode)
- Canvas "stage" background (outside design): `#0A0A12` with a subtle dot grid at `rgba(255,255,255,0.04)` — gives spatial context at any zoom level, signals "you're looking at a canvas"
- Zoom animation: smooth 200ms ease-out when changing via keyboard or button; pinch-to-zoom follows the finger directly with no animation lag (0ms)
- Min zoom: 10% · Max zoom: 400%

---

### UX-7: Keyboard Shortcut System

All shortcuts must work consistently. No conflicts with browser defaults.

| Shortcut | Action |
|---|---|
| `Cmd+Z` | Undo |
| `Cmd+Shift+Z` | Redo |
| `Cmd+D` | Duplicate selected |
| `Delete` / `Backspace` | Remove selected |
| `Cmd+G` | Group selection |
| `Cmd+Shift+G` | Ungroup |
| `T` | Add text element |
| `R` | Add rectangle shape |
| `C` | Add circle shape |
| `Cmd+[` | Send back one layer |
| `Cmd+]` | Bring forward one layer |
| `Cmd+Shift+[` | Send to back |
| `Cmd+Shift+]` | Bring to front |
| `Cmd+A` | Select all elements |
| `Escape` | Exit mode / deselect |
| `Arrow keys` | Move element 1px |
| `Shift+Arrow` | Move element 10px |
| `Enter` | Edit selected text element |
| `Cmd+S` | Save now |
| `Cmd+Shift+E` | Export / download |
| `Cmd+0` | Fit to viewport |
| `Cmd+1` | 100% zoom |
| `Space+drag` | Pan viewport |
| `?` | Open keyboard shortcuts overlay |

**Shortcuts overlay (`?` key):**
- Full-screen dimmed backdrop
- 2-column grid of all shortcuts, grouped by category (Selection · Editing · Layers · View · Export)
- Close with `Escape` or `?` again or clicking backdrop
- Small hint labels appear on button tooltips: "Undo (⌘Z)" — visible on first hover

---

### UX-8: Accessibility & Performance Floors

**Performance (mandatory minimums):**
- 60fps canvas render during element drag with 30+ elements
- Right panel updates debounced at 16ms (1 frame) — never on every keystroke
- Font list (25 fonts) loaded lazily — only fetched when user scrolls to them in the list
- Image thumbnails in left panel: blurred placeholder shown until loaded (prevents layout shift)
- PNG export must complete in < 3 seconds for 1080×1350 canvas on a 2020 iPad Air

**Keyboard accessibility:**
- Tab order: Top toolbar → Left panel tab bar → Canvas (focus outline on canvas area) → Right panel
- Canvas elements focusable via Tab; shows distinct keyboard focus ring (3px dashed white, not the selection ring)
- Arrow keys: move selected element 1px; Shift+Arrow = 10px; matches Figma/Canva convention
- Enter on focused text element → enters text edit mode
- Escape key hierarchy: text edit mode → deselect element → deselect canvas

**Visual accessibility:**
- All panel text: minimum 4.5:1 contrast ratio (WCAG AA)
- Primary text on `#0F0F18`: use `#E8E8F2`; secondary: `#9090A8`
- Button states: default / hover (brightness 110%) / active (brightness 90% + scale 0.97) / disabled (50% opacity + no-cursor) — must all be visually distinct
- Resize handles: auto-invert based on canvas background luminance — white handles on dark backgrounds, dark handles on light backgrounds (avoids invisible handles on white templates)

---

### UX-9: Canvas Performance Optimization Strategy

As the element count grows, Konva performance degrades. These strategies must be baked into the architecture:

1. **Layer separation**: Static elements (background, brand watermark) on one Konva Layer; dynamic/draggable elements on a second Layer. Konva only redraws the layer that changed.
2. **Image caching**: All image elements call `.cache()` after load — transforms render from cached bitmap, not re-composited per frame
3. **Transformer batching**: Only one Konva Transformer instance exists at all times; it updates `nodes` on selection change rather than creating/destroying per selection
4. **Off-screen canvas for export**: The export path uses a separate Konva Stage at full resolution (not upscaling the visible stage), so export quality is always pixel-perfect regardless of zoom level
5. **Debounce right panel**: All panel controls that update element attributes debounce at 16ms so rapid slider drags don't trigger per-pixel Konva redraws
6. **Pixel ratio cap**: On mobile, cap `pixelRatio` at `2.0` even on 3x screens — 3x renders 9× the pixel count for ~5% visual difference that users cannot see

---

### COMPLETION TRACKER ENTRIES (added to tracker below)

```
### Phase 9: Editor 2.0
- [ ] 9.1 Brand Kit — saved colors/fonts/logo in settings + editor reads on load
- [ ] 9.2 Smart Placeholders — [BUSINESS_NAME] / [PHONE] / [CITY] auto-fill from profile
- [ ] 9.3 Post Now from editor — bottom sheet → platforms → caption → publish/schedule
- [ ] 9.4 Gradient backgrounds — linear/radial + 20 preset gradients
- [ ] 9.5 QR code element — auto-fills from business website/phone
- [x] 9.6 Magic Resize — runMagicResize() adds new pages at target formats with proportionally scaled elements; toolbar ⊡ Resize button + modal format selector
- [ ] 9.7 AI Magic Toolbar — caption writer, background remover, color palette suggester, text improver
- [ ] 9.8 Shadow + stroke controls + cross-page copy/paste
- [ ] 9.9 Auto-save every 30s + design naming in title bar
- [ ] 9.10 Floating contextual toolbar on element selection
- [x] 9.11 Keyboard shortcuts overlay (? key) — showShortcutsOverlay state + modal + ? button in toolbar
- [x] 9.12 Carousel preview mode — previewOpen state + full-screen modal + arrows + auto-play + P hotkey; download all pages as PNG
```

---

## COMPLETION TRACKER (PHASE 9 ADDED)

### Phase 9: Editor 2.0
- [x] 9.1 Brand Kit — BrandColorsCtx in editor reads brand_colors/brand_fonts/brand_logo from profile
- [x] 9.2 Smart Placeholders — resolvePlaceholders() auto-fills [BUSINESS_NAME]/[PHONE]/[CITY]/[TAGLINE]
- [x] 9.3 Post Now from editor — toolbar Post Now button + modal: platforms + caption + Post/Schedule/Draft
- [x] 9.4 Gradient backgrounds — linear/radial/gradient on canvas bg, shapes, and text elements
- [x] 9.5 QR code element — type:'qrcode', QRCodeLib.toDataURL, auto-fills from business website/phone
- [x] 9.6 Magic Resize — runMagicResize() adds new pages at target formats with proportionally scaled elements; toolbar ⊡ Resize button + modal format selector
- [x] 9.7 AI Magic Toolbar — PostCore dropdown: Write Caption, Remove BG, Suggest Colors, PostCore Write
- [x] 9.8 Shadow + stroke controls (shadowBlur slider + preset shadows; stroke width/color on shapes)
- [x] 9.9 Auto-save every 30s + design naming in title bar (autosaveTimerRef + localStorage crash recovery)
- [x] 9.10 Floating contextual toolbar — quick-action bar renders above selected element
- [x] 9.11 Keyboard shortcuts overlay (? key) — showShortcutsOverlay state + modal + ? button in toolbar
- [x] 9.12 Carousel preview mode — previewOpen state + full-screen modal + arrows + auto-play + P hotkey; download all pages as PNG

---

---

## PHASE 10: PROFILE & ACCOUNT PAGE (P1)

### WHY THIS MATTERS

Settings.js currently mixes business identity (who you are) with configuration (how the app behaves).
A dedicated Profile page separates these concerns and creates a premium "account home" — the first
place a new user should feel proud of their presence in ItsPosting.

---

### 10.1 Dedicated Profile Page `/profile` (P1)

**File:** `frontend/pages/profile.js` (new page)

**What it shows:**

**Hero section — Business Identity Card**
```
[Avatar / Logo] [Business Name — bold 24px]
                [Industry badge] [City, State]
                [Member since: Jan 2026] [Plan badge: Professional]
```
- Avatar: Upload logo/photo (JPG/PNG, stored in Cloudinary via `/api/media/upload`)
- Business name: click-to-edit inline (saves on blur via `customerAPI.update()`)
- Industry: colored badge matching industry palette
- "Edit Profile" button → inline form fields slide down (no page navigation)

**Usage stats strip — 4 cards**
```
[Total Posts] [This Month] [Platforms Connected] [Credits Remaining]
```
- Stats pulled from existing `/api/analytics/summary` + `/api/customers/profile`
- Small sparkline under "This Month" (uses existing 30-day data)

**Connected Platforms — visual status board**
```
[Facebook ✓ / ✗] [Instagram ✓ / ✗] [Google Business ✓ / ✗] [LinkedIn ✓ / ✗] [TikTok ✓ / ✗]
```
- Platform icon + "Connected" / "Not connected" + token expiry indicator
- One-click "Reconnect" if token expired (calls existing OAuth flow)
- Read from existing `/api/social/health` endpoint

**PostCore Preferences**
```
Tone:      [Friendly ○] [Professional ◉] [Funny ○] [Expert ○]
Platforms: [FB ✓] [IG ✓] [GBP ✗] [LinkedIn ✗] [TikTok ✗]
Default posting time: [10:00 AM ▾] [Your timezone ▾]
```
- Saves via existing `customerAPI.update()` — no new API needed

**Business Details section** (collapsed by default, expand to edit)
```
Website | Phone | Address | Tagline | Services offered
```
- Each field: click to edit, enter to save
- Website auto-scrapes when changed (calls `/api/scraper/scrape`)
- "Scrape website again" button to refresh AI context

**Danger zone** (at bottom, collapsed)
```
Change password | Delete account (requires typing business name to confirm)
```

**Backend changes needed:**
```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tagline VARCHAR(200);
```

**API:** All data already available from existing endpoints. Avatar stored via `/api/media/upload`.
Add `PATCH /api/customers/profile/avatar` endpoint that updates `avatar_url` column only.

---

### 10.2 Avatar Upload (P1)

**File:** Enhancement to `frontend/pages/profile.js` + new backend endpoint

**Flow:**
1. Click avatar → file picker opens (image/*, max 5MB)
2. Client crops to square using built-in canvas crop (no library needed — canvas.drawImage with square clip)
3. Upload via `POST /api/customers/profile/avatar` → Sharp resizes to 256×256 → Cloudinary → returns URL
4. Immediately updates UI + stores in `customers.avatar_url`

**Where avatar appears:**
- Profile page hero
- Sidebar (small circle, 28px, below logo) — replaces the generic icon
- Settings page header
- Admin portal customer list (32px)

---

### 10.3 Public Business Profile Page `/p/[handle]` (P3)

A shareable public page for each business — their social proof from ItsPosting.

**What it shows:**
- Business name + logo + industry + city
- Best-performing posts (top 3 by engagement, user selects which to show)
- "Follow on [platforms]" links
- "Powered by ItsPosting" attribution badge (optional, 10 bonus credits if shown)
- `customers.public_handle VARCHAR(50) UNIQUE` — set during onboarding or in profile settings

---

### COMPLETION TRACKER (Phase 10)

```
### Phase 10: Profile & Account
- [x] 10.1 Profile page /profile — identity card, stats, connected platforms, PostCore prefs
- [x] 10.2 Avatar upload — AvatarUploader component + /api/customers/upload-asset + avatar_url column
- [x] 10.3 Public business profile /p/[handle] — backend/routes/public.js + pages/p/[handle].js + settings handle input; DB migration adds public_handle VARCHAR(50) UNIQUE
```

---

## PHASE 11: CONTENT CALENDAR — STRATEGIC PLANNING LAYER (P1)

### WHY THIS MATTERS

The current `/calendar` page shows what is **already scheduled**. 
What customers desperately need is a tool to **plan** what they WILL create — weeks in advance —
before a single post is generated. This is how real marketing teams work.

**The gap ItsPosting fills:** A plumber with 3 slow weeks ahead can plan
"Week 1: before/after job | Week 2: seasonal tip | Week 3: customer testimonial"
— all in one sitting. Then generate posts one by one from the plan, on their schedule.

---

### 11.1 Database Schema

```sql
CREATE TABLE IF NOT EXISTS content_calendar_plans (
  id              SERIAL PRIMARY KEY,
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  plan_date       DATE NOT NULL,
  title           VARCHAR(200),
  content_type    VARCHAR(50),          -- photo_post, carousel, video, text_card, story
  platforms       TEXT[]  DEFAULT '{}',
  notes           TEXT,
  status          VARCHAR(20) DEFAULT 'planned',
  -- planned → briefed → scheduled → published → skipped
  post_id         INTEGER REFERENCES posts(id),
  ai_suggested    BOOLEAN DEFAULT false,
  color           VARCHAR(20) DEFAULT 'purple',
  -- purple | blue | green | orange | red | pink (user color-codes by campaign)
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_plans_customer_id ON content_calendar_plans(customer_id);
CREATE INDEX IF NOT EXISTS idx_calendar_plans_date ON content_calendar_plans(plan_date);
```

---

### 11.2 Backend API Routes

**File:** `backend/routes/calendarPlans.js` (new route file)
**Mount:** `app.use('/api/calendar-plans', auth, calendarPlansRouter)` in server.js

```
GET    /api/calendar-plans              ?start=YYYY-MM-DD&end=YYYY-MM-DD — get plans for date range
POST   /api/calendar-plans              — create new plan entry
PATCH  /api/calendar-plans/:id          — update plan (date, title, status, platforms, notes)
DELETE /api/calendar-plans/:id          — delete plan
POST   /api/calendar-plans/ai-fill      — PostCore AI suggests a month of content
POST   /api/calendar-plans/:id/generate — convert plan entry → wizard generation → returns post_id
```

**POST /api/calendar-plans/ai-fill logic:**
1. Read `customer.industry`, `customer.city`, current month from DB
2. Inject `industryKnowledge[industry].seasonalContent[currentMonth]`
3. Ask Claude to return 4 weeks × 3-4 entries per week = 12-16 suggestions
4. Each suggestion: `{ date, title, content_type, platforms, notes, ai_suggested: true }`
5. Deduct 0 credits (planning is free — only generation costs credits)
6. Return array, frontend inserts into DB

**Credit model:**
- Creating/editing plan entries: FREE (unlimited planning)
- `POST /api/calendar-plans/:id/generate`: deducts normal credits (3 for photo, 1 for text, etc.)

---

### 11.3 Frontend — `/content-calendar` Page

**File:** `frontend/pages/content-calendar.js` (new page)
**Nav:** Add "Content Calendar" to sidebar under the "Plan" / "Create" section

**Layout:**
```
[Page title: Content Calendar]
[Month navigation: < April 2026 >]   [View: Month | Week]   [✦ AI Fill Month]   [+ Add Plan]

[Calendar Grid — 5-7 row × 7-col month view]
  Each day cell:
  - Date number (top-left)
  - Plan cards stacked vertically (colored left border by content_type)
  - "+" on hover → quick-add plan inline
  - Overflow: "+2 more" link expands day

[Plan card (compact, in day cell):]
  [● colored dot] [title, 1 line truncated]
  [status badge: planned/scheduled/published]
```

**Plan card detail (click to expand — side drawer):**
```
Title:          [editable inline]
Date:           [date picker]
Content Type:   [chip selector: Photo | Carousel | Video | Text | Story]
Platforms:      [platform icon toggles]
Notes/Brief:    [multiline textarea — this is the creative brief for this post]
Status:         [planned → scheduled → published]
──────────────────────────────────────────
[Generate with PostCore →]   [Delete]
```

**"Generate with PostCore" button:**
- Reads the plan's title + notes + content_type as the wizard brief
- Opens wizard.js pre-filled (or generates inline)
- On completion: `plan.status = 'scheduled'`, `plan.post_id = newPost.id`
- Plan card in calendar turns green (scheduled state)

**AI Fill Month (✦ PostCore button):**
- Shows loading state: "PostCore is planning your month..."
- Calls `POST /api/calendar-plans/ai-fill`
- Displays results in a preview modal: list of 12-16 suggested entries
- User can toggle off individual suggestions they don't want
- "Add [X] to calendar" → creates all at once
- Toast: "12 content ideas added to April. Start generating when you're ready."

**Week View:**
```
[7-column week grid, taller rows]
[Each day column: time slots not shown — just day header + plan cards]
[Better for reviewing a specific week in detail]
```

**Color coding by content type (left border on plan card):**
```
photo_post → blue (#3B82F6)
carousel   → purple (#7C5CFC)
video      → red (#EF4444)
text_card  → green (#22C55E)
story      → orange (#F97316)
```

**Status visual:**
```
planned    → gray background, dashed border
scheduled  → purple background (the post exists and is scheduled)
published  → green checkmark badge
skipped    → strikethrough title, 40% opacity
```

**Dashboard integration:**
- Dashboard: "Your content plan for this week" widget showing Mon-Sun with plan entries
- Green dot for days with a scheduled post, empty for gaps, gold star for AI-suggested plans
- "View full calendar →" link

---

### 11.4 Calendar Integration

The existing `/calendar` page shows **scheduled posts** (posts that have been generated and timed).
The new Content Calendar shows **plans** (ideas and briefs before generation).

**How they connect:**
- When a plan entry has `post_id` set, the Calendar page also shows a subtle indicator:
  "This post was planned in Content Calendar" (linked)
- In the Content Calendar, clicking a "published" plan shows the post's performance data

---

### COMPLETION TRACKER (Phase 11)

```
### Phase 11: Content Calendar
- [x] 11.1 DB migration — content_calendar_plans table + indexes
- [x] 11.2 Backend routes — calendarPlans.js (CRUD + ai-fill + generate)
- [x] 11.3 Frontend — content-calendar.js (month view + week view + side drawer)
- [x] 11.4 AI Fill Month — PostCore generates 4 weeks of content ideas (0 credits)
- [x] 11.5 Dashboard "This week" widget showing plan entries
- [x] 11.6 Calendar page cross-link (plan → scheduled post → published post)
```

---

## COMPLETION TRACKER (PHASES 9-13)

### Phase 9: Editor 2.0
- [x] 9.1 Brand Kit — BrandColorsCtx reads brand_colors/brand_fonts/brand_logo from profile
- [x] 9.2 Smart Placeholders — resolvePlaceholders() for [BUSINESS_NAME]/[PHONE]/[CITY]/[TAGLINE]
- [x] 9.3 Post Now from editor — toolbar button + modal: platforms + caption + Post/Schedule/Draft
- [x] 9.4 Gradient backgrounds — linear/radial/gradient on canvas bg, shapes, and text
- [x] 9.5 QR code element — type:'qrcode', QRCodeLib, auto-fills from business website/phone
- [x] 9.6 Magic Resize — runMagicResize() adds new pages at target formats with proportionally scaled elements; toolbar ⊡ Resize button + modal format selector
- [x] 9.7 AI Magic Toolbar — PostCore Write Caption / Remove BG / Suggest Colors / Improve Text
- [x] 9.8 Shadow + stroke controls (shadowBlur slider + preset shadows + stroke on shapes)
- [x] 9.9 Auto-save every 30s + design naming in title bar (autosaveTimerRef + localStorage)
- [x] 9.10 Floating contextual toolbar above selected element
- [x] 9.11 Keyboard shortcuts overlay (? key) — showShortcutsOverlay state + modal + ? button in toolbar
- [x] 9.12 Carousel preview mode — previewOpen state + full-screen modal + arrows + auto-play + P hotkey; download all pages as PNG

### Phase 10: Profile & Account
- [x] 10.1 Profile page /profile — identity card, stats, connected platforms, PostCore prefs
- [x] 10.2 Avatar upload — crop + Cloudinary + sidebar display
- [x] 10.3 Public business profile /p/[handle] (P3)

### Phase 11: Content Calendar
- [x] 11.1 DB migration — content_calendar_plans table + indexes
- [x] 11.2 Backend routes — calendarPlans.js (CRUD + ai-fill + generate)
- [x] 11.3 Frontend — content-calendar.js (month view + week view + side drawer)
- [x] 11.4 AI Fill Month — PostCore generates 4 weeks of content ideas (0 credits)
- [x] 11.5 Dashboard "This week" widget showing plan entries
- [x] 11.6 Calendar page cross-link (plan → scheduled post → published post)

### Phase 12: Full Device Responsiveness
- [x] 12.1 Global responsive layout audit — dashboard, wizard, history, billing, calendar
- [x] 12.2 Inbox mobile experience (two-panel collapse + swipe approval queue)
- [x] 12.3 Wizard mobile experience — action bar grid, media panel full-width, history 2-col grid
- [x] 12.4 Calendar mobile experience — bottom-sheet day panel (fixed, 78vh, border-radius 20px, drag handle), filter bar horizontally scrollable, header padding reduced
- [ ] 12.5 Photo Studio mobile (pinch-to-zoom canvas, bottom drawer panel)

### Phase 13: Workspace Multi-User Audit
- [x] 13.1 Workspace DM access bug fix — invited members (Type B) now use workspaceId for DM queries
- [x] 13.2 Post approval workflow for workspace members (Phase 4.8)
- [x] 13.3 Workspace member DM approval queue (Phase 4.6) — editor generates pending, manager approves
- [x] 13.4 UI: role badge in topbar (Layout.js) + disabled approve button (inbox.js) + workspace role banner in settings.js

---

*Single source of truth for product direction.*
*Update completion tracker as work is done.*
*Do not code anything not in this document without adding it first.*
