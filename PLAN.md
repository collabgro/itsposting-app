# ItsPosting — Master Product Plan
# "Google × Apple × Meta × Canva × Adobe" quality
# Last updated: 2026-05-29 | Maintained by: Engineering lead
# RULE: Update the completion tracker as work is done. Never start a feature not listed here.

---

## AUDIT FINDINGS SUMMARY

### What's genuinely world-class already
- Glassmorphism card system across all main pages ✅
- Custom Ip-prefixed SVG icon system with depth shadows and gradient fills ✅
- Full dark/light theme token system ✅
- PostCore AI persona (seasonal, industry-aware, business-voice) ✅
- Industry knowledge system (10 industries, monthly seasonality data) ✅
- Multi-platform publishing (FB, IG, GBP, LinkedIn, TikTok) ✅
- Video pipeline (Veo 3.1 → Runway Gen-4 → Pika 2.2 → HeyGen fallback) ✅
- GEO/AI Visibility audit (15 queries × 3 engines = 45 checks) ✅
- Workspace/multi-account system ✅
- Developer API with 8 scoped key types ✅
- PWA support with service worker ✅
- Security hardened (bcrypt 12, hashed tokens, HMAC webhooks, SSRF blocklist) ✅
- Glass sidebar, topbar, toast, modal, confirm dialog ✅
- Spring animations on buttons and cards ✅
- Rich global CSS (30+ animations, glass/shimmer/float/glow utilities) ✅

### Critical gaps found in this audit
1. `analytics/index.js` still imports `Card` from ui.js — stale, needs cleanup
2. All 7 admin pages still use `<Card>` — not yet upgraded to glass system
3. Login/signup pages are functional but not Apple/Canva-quality (missing split layout, animated proof)
4. No global React error boundary — JS crashes show blank white page
5. No real-time updates for video generation (user has to manually refresh)
6. No referral/affiliate system
7. No in-app activation checklist for new user onboarding
8. Ideas page exists in nav but implementation quality unknown
9. No scheduling conflict detection (double-booking same time slot)
10. No bulk operations (schedule/delete/reschedule multiple posts)
11. No hashtag performance analytics
12. No post template library (user-created)
13. No competitor benchmarking UI (IndustryBenchmarks.js backend exists, no frontend)
14. No saved hashtag sets
15. No caption A/B result tracking (wizard generates 3 but doesn't track which performs best)
16. Analytics page has no charts — pure text metrics only
17. Website for marketing: itsposting.com (separate — noted below)

---

## PRIORITY SYSTEM

- **P0** — Fix this week. Broken or blocking users.
- **P1** — Ship this month. High user impact.
- **P2** — Ship next quarter. Growth/viral.
- **P3** — Backlog. Nice to have.

---

## PHASE 0: CRITICAL FIXES (P0)

### 0.1 Fix stale Card import — analytics/index.js
**File:** `frontend/pages/analytics/index.js`
**Problem:** Line 9 still has `import { Card, Button, Badge, ... }` — Card was supposed to be removed in the glass pass.
**Fix:** Remove `Card` from import. If any JSX still uses `<Card>`, replace with `<div style={gc}>`. Run `npx next build` to confirm clean.

### 0.2 Admin pages glass upgrade (7 files)
**Files:** All 7 admin pages (index, customers, customers/[id], broadcast, posts, email-queue, audit)
**Problem:** Still use `<Card>` — looks inconsistent with every other page.
**Pattern (same as all other pages done):**
```javascript
const gc = {
  background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
  backdropFilter: 'blur(16px) saturate(160%)',
  WebkitBackdropFilter: 'blur(16px) saturate(160%)',
  border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
  borderRadius: 16,
  padding: 24,
  marginBottom: 20,
  boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
};
```
Remove `Card` from imports. Replace `<Card style={{ ... }}>` → `<div style={{ ...gc, ... }}>`.

### 0.3 Global React error boundary
**File:** `frontend/pages/_app.js`
**Problem:** No error boundary — React crash = blank white screen.
**Fix:** Add class `ErrorBoundary extends React.Component` wrapping `<Component>`. Shows styled error page with ItsPosting logo, "Something went wrong", and refresh/contact links. Catches runtime exceptions from any page.

### 0.4 Verify ideas page end-to-end
**Files:** `frontend/pages/ideas.js`, `backend/routes/ideas.js`
**Problem:** Appears in nav but completeness unclear.
**Check:** Does `GET /api/ideas/today` return data? Does "Use this idea" pre-fill wizard correctly? Does "Refresh" generate new ideas? Fix any gaps.

---

## PHASE 1: UI/UX PERFECTION (P1)

### 1.1 Login & Signup — World-class treatment

**Current:** Basic centered card. Ambient gradient background. Functional only.
**Target:** Apple/Linear-quality. Split layout on desktop. Conversion-optimized.

**login.js redesign:**
```
Desktop layout: 2-column (50/50)

LEFT PANEL:
  background: animated radial gradient cycling brand colors
  Contents:
    - Large ItsPosting logo with ambient glow ring
    - Headline: "Your AI Social Media Manager"
    - 3 rotating testimonial cards (animate in/out):
        "Mike's Plumbing — 200 local followers in 3 weeks"
        "HVAC Solutions — reviews up 40% after consistent posting"
        "Roofer Pro — first post: 847 local views on Google"
    - Animated stats: "1,200+ businesses · 47,000+ posts generated"
    - Platform icons row (FB/IG/Google/LinkedIn/TikTok) with subtle glow

RIGHT PANEL (same as current form, enhanced):
  - "Welcome back" headline
  - Email + password fields (already great)
  - Trust line: "Bank-level security · No credit card required"
  - Link to signup below

MOBILE: Single column, right panel only. No left panel.
```

**signup.js redesign:**
```
Step 1 — Business info:
  - Replace text dropdown for industry with 2×5 card grid
  - Each card: icon + label (Wrench=Plumbing, Flame=HVAC, Hammer=Roofing, etc.)
  - Selected card: primary color border, scale-up, checkmark overlay

Step 2 — Credentials:
  - Password strength meter (4 levels: weak/fair/good/strong)
  - Checkmarks: "10 free credits · No CC required · Cancel anytime"
  - Clear privacy/terms footer
```

### 1.2 Dashboard — Command center upgrade

**Add quick-actions row** (4 big tappable buttons, above metrics):
```javascript
[🎯 Post for today]     → runs quick post with PostCore suggestion
[📅 Schedule week]      → opens calendar to week view
[⭐ Turn review into post] → opens review → post flow
[📊 My performance]     → jumps to analytics
```

**Metric cards enhancement:**
- Add 7-day sparkline mini-chart under each stat value (Canvas-drawn, thin line)
- Animate number count-up on page load

**Activity feed (wide screens > 1400px):**
- Right-side panel: recent comments received, new reviews, platform notifications
- Requires pulling data from inbox/reviews APIs

**PostCore suggestion prominence:**
- TodaySuggestionBanner should be the first thing a user sees after metrics
- If no suggestion loaded yet: skeleton card animating → prevents layout jump
- Suggestion card: left color bar, PostCore "thinking" icon, caption preview, [Use · Edit · Skip]

### 1.3 Wizard — Cinema-grade UX

**Step progress indicator:**
- Pill strip at top: 5 pills, active = filled gradient, completed = green check, upcoming = outline
- Animates forward on each step (translateX + scale)

**Card selection feedback:**
```javascript
// Selected card style
style={{
  border: `2px solid ${t.primary}`,
  boxShadow: `0 0 20px rgba(124,92,252,0.35), inset 0 0 10px rgba(124,92,252,0.06)`,
  transform: 'scale(1.04)',
  transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)',
}}
// Checkmark overlay top-right corner
```

**Loading screen:**
- Real progress bar (0→100%) synced to backend events
- Rotating messages already work — add matching visual

**Results screen:**
- 3 variation cards (A/B/C) side-by-side on desktop, swipeable cards on mobile
- Each card: glass treatment, full caption preview, copy button, hashtag chips
- Platform icons showing which platform each hashtag set is optimized for
- "Use this" → inline platform selector appears below (no redirect)
- Quick Regenerate button (🔄) on each card
- Inline caption editing: click pencil → textarea replaces text, save updates in place
- Character counter per platform below caption (300/150/200)

### 1.4 Analytics — Data storytelling

**Problem:** Text-only metrics are forgettable. Charts build emotional connection with data.

**Add `recharts` dependency:**
```
npm install recharts
```

**Charts to add:**
1. **Engagement trend** — 30-day AreaChart (likes + comments + shares stacked)
2. **Content type performance** — BarChart (avg engagement by type: Text/Photo/Carousel/Video)
3. **Best posting times heatmap** — 7×16 grid (already has getOptimalTimes data) — color intensity = engagement
4. **Platform comparison** — RadarChart (engagement across platforms) or PieChart
5. **Posting frequency vs reach** — ScatterChart (posts/week vs avg reach)

All charts: themed (dark/light), responsive, animated on mount, tooltips on hover.

### 1.5 Calendar — Interactive scheduling

**Week view:**
- Toggle: [Month | Week] buttons in header
- Week view shows 7 columns, 24 rows (or condensed 6am-10pm)
- Each post slot clickable → opens PostPreviewModal

**Drag to reschedule:**
```
Dependency: @dnd-kit/core (existing, or add)
Posts are draggable → drop on new day → calls postsAPI.update(id, { scheduledDate })
Visual: drag ghost shows post thumbnail
Conflict detection: red highlight on drop target if slot is taken
```

**Hover previews:**
- Hover over post dot → popover with caption preview + platform icons
- Hover over empty day → "Best time: Thursday 10am" hint (from analytics data)

**Suggested posting slots:**
- Days with no scheduled posts that fall on historically good days: subtle dotted border
- Tooltip: "You tend to get 2× reach on Thursdays. Schedule something here?"

### 1.6 Post History — Power tool

**Grid/list toggle:**
- Grid view: 3-column image grid (like Instagram), hover shows caption + stats overlay
- List view: current table layout

**Bulk actions:**
- Checkbox on each post in list view
- Floating action bar appears when ≥1 selected: [Delete] [Reschedule] [Duplicate]
- Reschedule: date picker modal applies to all selected

**Search:**
- Full-text search across caption and hashtags
- Instant results as user types (client-side filter against loaded posts)

**Performance sorting:**
- Sort dropdown: "Most liked · Most commented · Lowest reach · Newest · Oldest"

### 1.7 Media Library — Professional

**AI Tag suggestions:**
- On upload: call `studioAPI.extractElements()` → Claude returns tags
- Store tags on media_library record: `ai_tags TEXT[]`
- Search bar filters by tags

**Background removal shortcut:**
- Select image → "Remove background" button → calls studioAPI.removeBackground()
- Shows before/after preview

**Folder creation:**
- "New folder" button → name input → creates folder
- Drag items between folders (visual, updates folder assignment via mediaAPI.markUsed)

### 1.8 Settings — Completeness and clarity

**Profile completeness bar:**
```
"Your profile is 60% complete"
[████████░░░░░░] 60%
Missing: Logo · Website URL · Social accounts (1/3 connected)
Each missing item is a clickable link to the relevant section.
```

**Connected accounts health:**
- Token expiry date shown per account
- < 7 days: yellow warning badge
- Expired: red badge + "Reconnect" button

**Notification preferences (new section):**
- Toggle per event: Post published · New DM · GEO score update · Weekly briefing
- Channel per event: In-app · Email · Both

**Danger zone:**
- Account deletion request (GDPR required)
- Shows warning: "This deletes all posts, media, and billing data. Irreversible."
- Requires typing business name to confirm

### 1.9 Knowledge Base — Smarter AI training

**PostCore usage indicators:**
- Each knowledge entry: "Used in 3 recent posts" badge
- Entries never used: "PostCore hasn't used this yet — try adding more detail"

**Entry quality score:**
```
Short FAQ (< 50 chars): warning badge "Too short for PostCore to use effectively"
Rich entry (> 200 chars): success badge "Great detail — PostCore will use this"
```

**AI-suggested entries:**
- After user creates 5+ posts: "I noticed you often mention [service]. Want to add pricing for it to your knowledge base?"
- Prompt appears as a PostCore suggestion card

### 1.10 Billing — Conversion optimization

**Usage visualization:**
- Credits: circular progress ring (% used this month)
- Posts this month: horizontal bar
- "At this rate you'll run out in X days" if on track to exhaust

**ROI calculator:**
```
"A social media manager costs $2,000–4,000/month
ItsPosting costs $40/month
You save $1,960–3,960/month
That's $23,520–47,520/year"
```

**Annual savings callout:**
- Yearly toggle: big "Save $96/yr" badge on Pro plan
- Most popular badge: Professional plan

**Credit packs quick-buy:**
- Modal overlay instead of navigating away
- Pack options in grid: 25/50/75/100/150/200 credits
- One-click buy → Whop checkout link

---

## PHASE 2: CORE PRODUCT IMPROVEMENTS (P1/P2)

### 2.1 PostCore Daily Intelligence

**Currently:** Briefing only on Mondays or when unread.
**Target:** PostCore speaks every day in small ways.

**Daily contextual hint** (1 line, dashboard):
```
Monday: Full briefing (existing)
Tuesday–Sunday: 1-line seasonal/industry tip
  "It's January. Frozen pipe calls peak Thursday. Post about winterization today."
  "You haven't posted in 4 days. Your reach drops 40% after 5 days of silence."
  "Thursday 10am is your best posting time. It's 9:45am now."
```

**Performance celebration toast:**
```
When post beats their average by > 30%:
  "🎉 Your latest post is in your top 10% — nice work!"
  Click → opens analytics/posts/[id]
```


### 2.3 Scheduling Conflict Detection

**Problem:** User can schedule 3 posts at the same time on the same platform.

**Fix:**
1. Before saving scheduled post: query posts where `scheduled_date BETWEEN $1 AND $2 AND platforms @> ARRAY[$3]`
2. If conflict found: toast warning "You already have a Facebook post at 10am. Post at 12pm instead?" with quick reschedule buttons

### 2.4 Bulk Scheduling

**Use case:** Agency manages 5 clients. Plan a week in 5 minutes.

**Calendar: select mode:**
1. "Plan my week" button → enters select mode
2. Click empty days to select them (max 7 per batch)
3. "Schedule posts for selected days" button → wizard opens once
4. PostCore generates posts for each selected day (sequential, uses same settings)
5. Preview all before confirming: table of day + content type + caption preview
6. One-click confirm → all scheduled

### 2.5 Post Templates Library

**Use case:** Mike's Plumbing always does the same before/after format. Save it.

**Save a template:**
- From post results: "Save as template" button
- Asks for template name
- Saves: content_type, tone, platform list, hashtag set, caption style notes

**Use a template:**
- Wizard step 4 (details): "Use saved template" chip
- Pre-fills tone, platform, hashtags from template
- Caption: PostCore uses template style guidance

**Database:**
```sql
CREATE TABLE IF NOT EXISTS post_templates (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  name VARCHAR(100),
  settings JSONB,  -- contentType, tone, platforms, hashtagSetId, notes
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.6 Hashtag Sets

**Use case:** Save 15 roofing hashtags, reuse on every roofing post.

**Hashtag sets manager (Settings > Hashtag Sets tab):**
- Create set: name + paste hashtags
- Edit, delete existing sets
- Usage count per set

**In wizard results:**
- Below hashtag list: "Apply saved set" dropdown
- Applying replaces current hashtags with saved set
- "Add to set" button: saves current hashtags as new set

**Storage:** `customers.hashtag_sets JSONB` — array of `{ id, name, tags[] }`.

### 2.7 Real-time Video Status (SSE)

**Problem:** Video generation takes 2+ minutes. User sits on results screen with no feedback.

**Backend:**
```javascript
// GET /api/wizard/status/:jobId (SSE)
router.get('/status/:jobId', auth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // Poll DB or in-memory job state every 3 seconds
  // Send: data: {"status":"rendering","progress":45}\n\n
  // Close when status === 'ready' or 'failed'
});
```

**Frontend (wizard results screen):**
```javascript
const es = new EventSource(`/api/wizard/status/${jobId}`);
es.onmessage = (e) => {
  const { status, progress, videoUrl } = JSON.parse(e.data);
  setVideoProgress(progress);
  if (status === 'ready') { setVideoUrl(videoUrl); es.close(); }
};
```

**UI:** Animated progress ring replaces the "Video rendering..." placeholder.

### 2.8 Social Account Health Dashboard

**New section: Settings > Connected Accounts:**
- Last sync time per account
- Token expiry countdown
- Estimated reach based on last 5 posts per platform
- Quick re-auth button if expired

### 2.9 Smart Scheduling AI

**Feature:** "Let PostCore choose the best time"

After wizard generates content:
```
"When should I post this?"
[PostCore picks best time] OR [I'll choose myself]
```

PostCore logic:
1. Reads analyticsAPI.getOptimalTimes()
2. Picks first available slot that's this customer's historically best day/hour
3. Returns: "Thursday 10am — your last 3 Thursday morning posts averaged 2.3× your normal reach"
4. One-click accept → schedules at that time with explanation stored on post

---

## PHASE 3: VIRAL GROWTH FEATURES (P2)

### 3.1 Referral Program

**Mechanic:** Share link → friend signs up → friend upgrades → you get 20 credits.

**Implementation:**
1. `customers.referral_code VARCHAR(12)` — generate on account creation (BUSINESSNAME + 4 digits)
2. Referral link: `itsposting.com/signup?ref=MIKE1234`
3. On signup: `customers.referred_by VARCHAR(12)`
4. When referral upgrades to paid (Whop webhook `membership.activated`): give referrer 20 credits
5. Email: "Someone you referred just upgraded! Here are your 20 bonus credits."

**Billing page — Referral tab:**
- Referral link with one-click copy
- Stats: # referred, # converted, # credits earned
- "Share" buttons: Twitter, WhatsApp, email pre-written message

### 3.2 Shareable Posts + Viral Watermark

**Mechanic:** Every downloaded image has an optional "Made with ItsPosting" watermark.
Users share to social → their followers see it → free acquisition.

**Implementation:**
1. Wizard results: "Download image" button
2. Download modal: [Download with watermark (+5 free credits)] vs [Download clean (0 credits bonus)]
3. Watermark: subtle text bottom-right: "Made with ItsPosting.com" (light/dark adapted)
4. Backend: ImageResizer adds watermark text layer using Sharp

**Showcase page `/showcase`:**
- Public gallery of top-performing AI-generated posts (with user opt-in permission)
- Filter by industry
- "Made in 60 seconds" badge on each
- CTA: "Create yours free →" prominently

### 3.3 Industry Leaderboard (Anonymous FOMO)

**Analytics page addition:**
```
"How you stack up — [Industry] businesses this month"
┌─────────────────────────────────────┐
│ 🥇 A plumber in Chicago: 847 avg views/post    │
│ 🥈 A plumber in Denver: 623 avg views/post     │
│ 🥉 Your ranking: Top 23%                       │
└─────────────────────────────────────┘
"Want to break into the top 10%? Here's what they're doing →"
```

Data source: aggregated anonymized data from analytics. No PII exposed.




### 3.6 White-Label Option (Agency Plan)

**Target:** Marketing agencies managing 10+ local businesses.

**Features:**
- Custom domain: `posts.mikeagency.com` → points to ItsPosting infrastructure
- Logo/brand replacement: replaces all ItsPosting logos with agency logo
- Color scheme: agency can set primary color
- Client portal: clients log in and see agency-branded interface
- Agency dashboard: see all client accounts, credit usage, performance

**Plan:** $200/month, unlimited sub-accounts for clients
**Database:** `white_label_config JSONB` on customers table: `{ logo, primaryColor, domain, agencyName }`
**Layout.js:** reads white_label_config and overrides branding if set

---

## PHASE 4: NEW PRODUCT FEATURES (P2/P3)

### 4.1 One-Click Video Wizard

**Problem:** Current video in wizard requires too many steps.

**New "Quick Video" entry point (from dashboard or wizard):**
1. Choose: Talking-Head (your face) OR Cinematic Job Footage
2. Talking-head: PostCore writes the 30-second script automatically → HeyGen renders
3. Cinematic: PostCore writes the scene → NanoBanana → Veo animation
4. Single screen, single "Generate" button, results in same view

### 4.2 Google Review Response AI

**Feature:** Get a bad/good review → PostCore drafts the perfect response.

1. Dashboard "Share a Review" card already exists → extend it
2. For each review: [Turn into post] AND [Draft a response]
3. Bad review: 3 response options:
   - Empathetic: "I'm so sorry to hear this, Mike. Let's make it right."
   - Professional: "Thank you for the feedback. We take all reviews seriously..."
   - Brief: "We'd love to discuss this directly. Please call us at [phone]."
4. One-click publish response via Google Business API

### 4.3 30-Day Content Calendar Generator

**Feature:** "Plan my entire month in one click"

**Calendar → "Auto-plan my month" button:**
1. PostCore analyzes: current month seasonality + 70/20/10 balance + best posting days
2. Returns 12-15 pre-filled post slots:
   - Day, time, content type, theme, suggested topic
3. User reviews in a grid — can drag/reorder
4. One-click confirm → all created as drafts, scheduled

### 4.4 Competitor Intelligence

**Feature:** "What are similar businesses in my area posting?"

1. User enters up to 3 competitor names/websites
2. Scraper pulls their public Facebook/Instagram posts (ScraperService already exists)
3. PostCore analyzes: what content types, what tones, what's getting engagement
4. Report: "Your top competitor posts every Wed/Fri, mostly before/after photos. Their avg likes: 45. Yours: 12."
5. "Generate a better version of their best post →" CTA → pre-fills wizard with their content theme

### 4.5 Testimonial Machine

**Feature:** Auto-generate a post from any review, weekly.

1. "Enable auto-testimonial posts" toggle in Settings
2. Every 2 weeks: PostCore picks the best unposted review
3. Generates: quote card image (Sharp) + caption in their voice
4. Draft appears in history with "[Auto-Testimonial — Review pending approval]" badge
5. User approves or skips

### 4.6 Inbox Approval Queue Mode

**Current:** AI Receptionist either auto-replies or doesn't.

**Enhancement:**
1. New mode: "Approval Queue" (between full-auto and manual)
2. AI drafts the reply → shows in inbox as "Draft — Pending your approval"
3. User reads draft, taps "Send" with one tap
4. Shows: sentiment score, urgency level (🔴🟡🟢), estimated customer intent
5. Mobile-optimized: entire flow works as swipe gestures (swipe right = send, swipe left = dismiss)

### 4.8 Team Post Approval Workflow

**Current:** Workspace members can create posts. No approval before publishing.

**Enhancement:**
1. Workspace settings: "Require approval for posts" toggle
2. When editor creates post → status = `pending_approval` instead of `draft`
3. Managers see "awaiting approval" badge on Calendar/History
4. Manager reviews → [Approve] [Request changes] [Reject with note]
5. Approval history stored on post

---

## PHASE 5: TECHNICAL EXCELLENCE (P1/P2)

### 5.1 Performance Audit

**Target:** Lighthouse score 90+ on all pages.

**Actions:**
1. Add `loading="lazy"` to all `<img>` tags that are below the fold
2. Preload critical fonts: `<link rel="preload" href="..." as="font">`
3. Bundle size analysis: `ANALYZE=true next build` — identify large chunks
4. Cache API responses that rarely change (plans, industry list): `Cache-Control: max-age=3600`
5. Compress images before Cloudinary upload (already doing 85 JPEG quality — verify)

### 5.2 Accessibility (WCAG 2.1 AA)

**Current gaps:**
- Icon-only buttons have no `aria-label`
- Loading states lack `role="status"` / `aria-live`
- Form fields missing `id`/`htmlFor` associations
- Modals need focus trap and `aria-modal`
- Color contrast may fail on `textMuted` in some contexts

**Fix systematically:** Start with highest-traffic pages (login, dashboard, wizard).

### 5.3 Error State Polish

**Every API call must have visible error state with retry:**
```javascript
// Pattern to use everywhere:
const [data, setData] = useState(null);
const [error, setError] = useState(null);
const [loading, setLoading] = useState(true);

// On error:
<div style={{ textAlign: 'center', padding: 40 }}>
  <div style={{ color: t.error, marginBottom: 12 }}>Failed to load. Check your connection.</div>
  <Button variant="secondary" onClick={load}>Try again</Button>
</div>
```

**Session expiry:** Instead of silent redirect, show toast: "Your session expired. Tap to sign in." for 3 seconds, then redirect.

### 5.4 Loading State Consistency

**Standard:** All content areas use `<Skeleton>` while loading (not custom spinners).

**Skeleton sizes to match content:**
- Metric cards: `<Skeleton height={104} borderRadius={18} />`
- Post history rows: `<Skeleton height={72} borderRadius={12} />`
- Chart areas: `<Skeleton height={280} borderRadius={16} />`
- Profile info: combination of thin/thick skeletons

### 5.5 Database Performance Review

**Add indexes if missing:**
```sql
CREATE INDEX IF NOT EXISTS idx_posts_customer_id ON posts(customer_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_date ON posts(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_snapshots_post_id ON post_engagement_snapshots(post_id);
CREATE INDEX IF NOT EXISTS idx_notifications_customer_id ON notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_business_knowledge_customer_id ON business_knowledge(customer_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_customer_id ON api_keys(customer_id);
```

### 5.6 Rate Limiting — Per-endpoint granularity

```javascript
// backend/middleware/rateLimits.js
const AI_LIMIT = rateLimit({ windowMs: 60000, max: 10, message: 'Too many AI requests' });
const UPLOAD_LIMIT = rateLimit({ windowMs: 60000, max: 20 });
const AUTH_LIMIT = rateLimit({ windowMs: 60000, max: 5, message: 'Too many auth attempts' });
```

Apply: `router.post('/wizard/generate', AI_LIMIT, auth, ...)` etc.

### 5.7 Webhook Reliability

**Current:** Process Whop webhook synchronously. If DB is slow → timeout → Whop retries.

**Enhancement:** Queue webhook events:
1. Accept webhook → return 200 immediately (already doing this)
2. Push payload to in-memory queue (or Redis if available)
3. Worker processes async
4. Add webhook event log table: `webhook_events (id, source, event_type, payload, processed_at, status)`

---

## PHASE 6: MARKETING & GROWTH (P2)


### 6.3 Email Onboarding Sequence (7 emails)

Implement in EmailService.js / triggered by events:

```
Day 0:  "Welcome to ItsPosting — here's your free post"
        → Link to wizard with their industry pre-selected

Day 1:  "Your first post is ready — here's how to schedule it"
        → Tutorial of wizard → schedule flow

Day 3:  "PostCore tip: [their industry] in [their month] — here's what works"
        → Seasonal content tip relevant to their trade

Day 5:  IF no post yet → "Having trouble? Here's a 2-minute walkthrough"
        → Loom video or animated GIF of the wizard

Day 7:  Trial expiry warning + upgrade CTA
        → "Your 10 credits run out in 2 days. Upgrade to 100/month for $40."

Day 14: Success story from same industry
        → "Mike's Plumbing (just like you) posts 3x/week and gets 800+ views"

Day 30: Monthly ROI recap
        → "You created X posts, reached Y people, saved $Z vs hiring a manager"
```

### 6.4 In-App Activation Checklist

**New component:** `ActivationChecklist.js` on dashboard.

Sticky card (collapses when all done):
```
Your account is 2/5 set up
──────────────────────────

□  Connect a social account
✅ Create your first post
□  Schedule a post for tomorrow  
□  Add 3 knowledge base entries
□  Run your free AI Visibility check (Free One time)
──────────────────────────
```

Completion tracked in `customers.activation_completed_steps TEXT[]`.
When all 5 done: confetti animation + 10 bonus credits granted.

---

## DESIGN SYSTEM RULES (Non-negotiable)

### Glass card recipe — `gc` constant (use on EVERY card section)
```javascript
const gc = {
  background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
  backdropFilter: 'blur(16px) saturate(160%)',
  WebkitBackdropFilter: 'blur(16px) saturate(160%)',
  border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
  borderRadius: 16,
  padding: 24,
  boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
};
```

### Ambient depth orb (behind major sections)
```javascript
<div style={{
  position: 'absolute', top: -30, right: -30,
  width: 120, height: 120, borderRadius: '50%',
  background: accentColor, opacity: 0.07, filter: 'blur(30px)', pointerEvents: 'none'
}} />
```

### Typography scale (exact — never deviate)
- Page title: 18px, 700 weight, -0.035em tracking
- Section header: 19px, 700 weight, -0.03em tracking
- Card title: 14–15px, 700 weight, -0.02em tracking
- Body text: 13px, 400–500 weight
- Label/meta: 11–12px, 500–600 weight, `t.textMuted` color
- Stats/numbers: 32–40px, 800 weight, -0.04em tracking, monospace

### Hover state rule
Every interactive element must have:
1. `transition` on background, border-color, box-shadow, transform (160–240ms)
2. Lift: `translateY(-2px)` to `translateY(-4px)` based on card size
3. Press feedback: `onMouseDown` → `scale(0.96)–0.99`
4. Restore: `onMouseLeave` restores to initial state exactly

### Color usage
- Primary CTA: `linear-gradient(135deg, #7C5CFC 0%, #9B7FFF 50%, #6D3FF2 100%)` + `box-shadow: 0 4px 15px rgba(124,92,252,0.4)`
- Destructive: `t.error` + `box-shadow: 0 4px 12px rgba(239,68,68,0.3)`
- Secondary: `t.card` background, `t.border` border
- NEVER hardcode hex colors — always use `t.*` tokens

---

## RULES THAT MUST NEVER BE BROKEN

1. Never import from `lucide-react` directly — always via `Icon.js` (wizard step cards) or Ip-prefixed icons (everything else)
2. Never hardcode colors — always use `t.primary`, `t.error`, etc. from `useTheme()`
3. Never create a page section without glass card treatment (`gc` constant)
4. Never fetch data directly with `fetch()` — always through `frontend/lib/api.js`
5. Never use TypeScript — this project is plain JavaScript throughout
6. Never store raw API keys — always SHA-256 hash before storing in DB
7. Never use Stripe — Whop is the only payment provider (Pakistan legal constraint)
8. Never call `bcrypt.hash(password, 10)` — always use rounds 12
9. Never add empty `getServerSideProps() { return { props: {} } }` — just don't export it
10. Never generate 1 post variation — wizard always returns 3 variations (A/B/C)
11. Never add placeholder/mock data to production — only real data or empty states
12. Never skip HMAC webhook signature verification — always verify before processing
13. Never accept JWT via query string — only Authorization: Bearer header

---

## COMPLETION TRACKER

### Phase 0: Critical Fixes
- [x] 0.1 Fix analytics/index.js stale Card import ✅ shipped commit a3b (analytics Card import removed)
- [x] 0.2 Admin pages glass upgrade (8 files — +stock-photos.js found via grep) ✅ shipped commit 5b6b483
- [x] 0.P PostCore Mascot — 7-mood animated SVG character in sidebar ✅ shipped commit 5b6b483; dashboard events added commit 19b6671
- [x] 0.3 Global error boundary in _app.js ✅ shipped commit d92d681
- [x] 0.4 Ideas page glass + mascot events ✅ shipped commit d92d681

### Phase 1: UI/UX Perfection
- [x] 1.1 Login split-layout + animated testimonial slider + stats + platform pills ✅ shipped commit d92d681
- [x] 1.2 Signup industry emoji grid + selection animation + password strength meter + trust badges ✅ shipped commit d92d681
- [x] 1.3 Dashboard quick-actions row (4 glass tiles) + activation checklist (5-step, collapsible, 10 bonus credits) ✅ shipped commit d92d681
- [x] 1.4 Wizard step progress pill strip + card pop animation + hover-to-edit pencil on caption ✅ shipped
- [x] 1.5 Analytics engagement trend chart (30-day SVG AreaChart, gradient fill, trend indicator) ✅ shipped commit d92d681
- [x] 1.6 Calendar week view toggle + drag-to-reschedule + hover preview popup ✅ shipped
- [x] 1.7 Post history grid/list toggle + bulk select (circle overlays) + floating action bar ✅ shipped
- [ ] 1.8 Media Library AI tagging + background removal shortcut
- [x] 1.9 Settings profile completeness + token expiry + notifications prefs ✅ shipped
- [x] 1.10 Knowledge Base quality scores + PostCore usage indicators ✅ shipped

### Phase 2: Core Product
- [x] 2.1 PostCore daily micro-briefings ✅ shipped
- [ ] 2.2 Caption A/B tracking + preferred style detection
- [ ] 2.3 Scheduling conflict detection
- [ ] 2.4 Bulk scheduling
- [ ] 2.5 Post templates library
- [ ] 2.6 Hashtag sets
- [ ] 2.7 SSE real-time video status
- [ ] 2.8 Social account health dashboard
- [ ] 2.9 Smart scheduling AI ("best time" auto-pick)

### Phase 3: Viral Growth
- [ ] 3.1 Referral program (link + dashboard + credit reward)
- [ ] 3.2 Shareable posts + "Made with ItsPosting" watermark option
- [ ] 3.3 Industry leaderboard in analytics
- [ ] 3.6 White-label option for agencies

### Phase 4: New Features
- [ ] 4.1 One-click video wizard
- [ ] 4.2 Google review response AI
- [ ] 4.3 30-day content calendar generator
- [ ] 4.4 Competitor intelligence
- [ ] 4.5 Testimonial machine (auto-scheduled)
- [ ] 4.6 Inbox approval queue mode
- [ ] 4.7 PDF report export
- [ ] 4.8 Team post approval workflow

### Phase 5: Technical
- [ ] 5.1 Lighthouse 90+ on all pages
- [ ] 5.2 Accessibility WCAG 2.1 AA
- [ ] 5.3 Error state polish (every API call)
- [ ] 5.4 Skeleton loading consistency
- [ ] 5.5 Database indexes review
- [ ] 5.6 Per-endpoint rate limiting
- [ ] 5.7 Webhook event log + reliability


- [ ] 6.3 Email onboarding sequence (7 emails)
- [ ] 6.4 In-app activation checklist

---

*This is the single source of truth for product direction.*
*Every feature, every fix, every improvement starts here.*
*Do not code anything not in this document without adding it first.*
*Update completion tracker as work is done.*
