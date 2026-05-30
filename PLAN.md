# ItsPosting — Master Product Plan
# Living document. Update after every sprint. Last updated: May 2026 (v2.0)

---

## PRODUCT VISION

ItsPosting replaces a full-time social media manager for local service businesses at a fraction of the cost. The ideal customer is a plumber, roofer, HVAC tech, landscaper, or electrician who has zero interest in social media but knows they need it.

**The 10-second morning moment** — PostCore says "Good morning, Mike's Plumbing. Frozen pipe season is here. Here's a post ready to go." Mike taps Post Now. Done.

**Target market:** 400,000+ local service businesses in the US, Canada, and UK who spend $500–$2,000/month on marketing but get poor ROI from generic agencies.

**Why ItsPosting wins:**
- Only tool that knows the difference between a plumber in January (frozen pipes) and a roofer in April (storm damage)
- No blank boxes — guided wizard, not a blank textarea
- Platform-native writing — genuinely different content per platform
- PostCore AI persona — sounds like a trusted advisor, not software
- PostCore Brain (custom LLM) — will eventually replace Claude calls for 80% of generations

---

## FULL FEATURE AUDIT (May 2026)

### ✅ Fully Built & Live

| Feature | Notes |
|---|---|
| AI Wizard (multi-step) | Full pipeline: steps → Claude → NanoBanana → 3 variations |
| Quick Post | Single-screen, direct publish, 1-3 credits |
| Post History / Drafts | Full CRUD, filter by platform/type |
| Content Calendar | Month view, bulk scheduling |
| AI Content Calendar Plans | `/api/calendar-plans` — AI-generated weekly plans |
| Media Library | 10GB quota, Cloudinary, per-file metadata |
| Photo Studio | Sharp + Claude branded card templates |
| Analytics | Per-platform breakdown, post performance |
| AI Visibility (GEO Audit) | 15Q × 3 engines, 5 credits (1st free per account) |
| Competitor Intel | Scrape + AI analysis, opportunity cards |
| Post Ideas | Seasonal/category/industry-aware idea generator |
| Templates | Admin-managed, customer-selectable |
| Billing (Whop) | Plans, credit packs, custom amount, webhooks |
| White-label | Agency plan — custom logo/color/domain, hides "Powered by ItsPosting" |
| Workspaces / Sub-accounts | Shared credits, role permissions, invite tokens |
| Knowledge Base | FAQs, pricing, docs, AI-indexed context |
| AI Receptionist | Intent classify, auto-reply, escalation, review actions |
| Google Business Messages | Inbound webhook, outbound reply via GMBMessagesService |
| Inbox (unified) | DMs, comments, GMB messages, read/reply |
| Contacts CRM | Lead pipeline, status tracking, import/export |
| Notifications | In-app bell + web push + email (Resend) |
| PostCore Suggestions | 4 types: seasonal/streak/gap/milestone |
| Business Intelligence | Plain-English metrics, industry benchmarks |
| PostCore Weekly Briefing | Monday 7am UTC, email + in-app banner |
| Showcase (public profile) | `/p/[handle]` public page with posts grid |
| Developer API (v1) | 8 scopes, 16 endpoints, SHA-256 hashed keys |
| PWA | Service worker, manifest, install banner, push |
| Social Publishing | Facebook, Instagram, GBP, LinkedIn, TikTok |
| OAuth Token Auto-refresh | Google + TikTok auto-refresh before post |
| Onboarding | 5-step flow, first post auto-generated as "wow moment" |
| Admin Portal | Dashboard, customers, impersonation, audit log |
| Admin Broadcast | Segmented blast with rate limiting (50/batch) |
| PostCore Brain admin UI | `/admin/llm` — training data, model versions, A/B, quality |
| Security hardening | bcrypt 12, SHA-256 tokens, HMAC webhooks, SSRF, SELECT FOR UPDATE |
| Referrals | Refer & Earn program |
| Video pipeline (Veo→Runway→Pika) | Built; Veo 3.1 Fast → Runway Gen-4 → Pika 2.2 fallback chain |

### ⚠️ Built but Needs Real-World Testing

| Feature | Blocker | Priority |
|---|---|---|
| Mobile responsiveness | Individual pages not fully responsive at 375px | P0 |
| HeyGen avatar video | Needs HEYGEN_API_KEY + avatar/voice setup + webhook reg | P1 |
| AI Receptionist live replies | Needs active FB/IG webhook subscription | P1 |
| TikTok posting | TikTok sandbox approval required | P2 |
| LinkedIn posting | LinkedIn App must be in production mode | P2 |
| Google Business Profile OAuth | Needs Google Cloud verification | P2 |
| Midjourney fallback | Needs REPLICATE_API_TOKEN | P2 |

### 🔴 Roadmap (Not Yet Built)

| Feature | Priority | Effort |
|---|---|---|
| PostCore Brain — first training run | P1 | External (need 10k examples) |
| Hashtag performance analytics | P2 | 2 days |
| Bulk AI week-fill on Calendar | P2 | 2 days |
| Story format (9:16) | P2 | 3 days |
| Client approval portal (separate URL) | P2 | 3 days |
| Caption A/B auto-testing | P2 | 4 days |
| In-app Canva-style image editor | P3 | 2 weeks |
| Multi-language (Spanish, French) | P3 | 1 week |
| SMS notifications | P3 | 3 days |

---

## PRIORITY ORDER

### P0 — RIGHT NOW (launch readiness)

1. **Full mobile responsiveness** — Every page works at 375px (iPhone SE)
2. **Purple/black/white enforcement** — Default dark, no hardcoded colors anywhere
3. **End-to-end smoke test** — Wizard → generate → publish → analytics confirmed live
4. **PostCore Brain collecting data** — Verify `llm_training_examples` rows are accumulating

### P1 — This sprint

5. **Video pipeline smoke test** — Veo → Runway → Pika chain verified on Railway
6. **HeyGen integration** — Register webhook, generate a test video, verify delivery
7. **AI Receptionist live test** — FB webhook subscription + test auto-reply round trip
8. **Showcase SEO** — Add og:image, meta title/description per public profile

### P2 — Next sprint

9. **Hashtag analytics** — Track which hashtags drive reach
10. **Bulk week-fill button** — "Fill this week with AI" one-click on Calendar
11. **Story format** — 9:16 variant in wizard and ImageResizer

---

## ARCHITECTURE & SCALABILITY

### Current stack (Railway)
```
Frontend:  Next.js — Railway service #1 (auto-scale)
Backend:   Express.js — Railway service #2, port 8080 (auto-scale)
Database:  Railway PostgreSQL (managed, ~5GB)
Storage:   Cloudinary (unlimited, pay-per-use)
Email:     Resend
Billing:   Whop (MoR — handles all global taxes)
AI:        Anthropic Claude (claude-sonnet-4-6) + Google Gemini (NanoBanana)
```

### Scale triggers

| Milestone | Action |
|---|---|
| 500 customers | Add Redis for rate limiting (replace in-memory) |
| 1,000 customers | Read replica + pgBouncer |
| 5,000 customers | BullMQ job queue for scheduling, AI calls, email |
| 10,000 customers | Microservices: separate AI service, social service |
| 50,000 customers | Kubernetes, CDN edge caching for public profiles |

### Critical DB indexes (run on Railway console if not already present)

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_customer_created ON posts(customer_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_status_sched ON posts(status, scheduled_for) WHERE status = 'scheduled';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notif_customer_unseen ON notifications(customer_id, seen) WHERE seen = FALSE;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_llm_training_customer ON llm_training_examples(customer_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dm_conv_customer ON dm_conversations(customer_id, updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_customer ON contacts(customer_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_customer ON media_library(customer_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_geo_audits_customer ON geo_audits(customer_id, created_at DESC);
```

---

## DESIGN SYSTEM (ENFORCED)

### Color palette — Purple/Black/White
```
Background deep:  #05050A   (the canvas — near-black)
Sidebar:          #08080F
Card base:        #0F0F18   (glass morphism base)
Primary:          #7C5CFC   (ItsPosting purple — the brand)
Primary hover:    #9B7FFF
Text primary:     #F5F5F7   (near-white)
Text secondary:   #ABABAB
Text muted:       #7A7A80
Success:          #30D158
Warning:          #FFD60A
Error:            #FF453A
Info:             #0A84FF
```

### Breakpoints
```
375px  — xs  — iPhone SE minimum
480px  — sm  — large phone
768px  — md  — tablet portrait
900px  — lg  — sidebar collapses (Layout.js isMobile breakpoint)
1200px — xl  — desktop
1440px — xxl — wide desktop
```

### Component patterns
- **Cards:** glass effect (`rgba(15,15,24,0.72)` + `backdropFilter: blur(16px)`)
- **Buttons primary:** `linear-gradient(135deg, #7C5CFC, #9B7FFF)` + purple glow shadow
- **Inputs:** `background: t.input`, border `t.borderStrong`, focus ring `t.focusRing`
- **Tables:** `overflowX: auto` wrapper, `minWidth` on table, row hover with `t.cardHover`
- **Modals:** fixed overlay `rgba(0,0,0,0.72)` + `backdropFilter: blur(8px)`, card centered, max-width 560px

---

## GROWTH & GO-TO-MARKET

### Acquisition (ranked by CAC)
1. **Self-content marketing** — Run ItsPosting on its own social accounts publicly
2. **Google Ads** — "social media for plumbers", "social media for HVAC" ($3–8 CPL estimated)
3. **YouTube demos** — 60-second "before vs after" showing the 10-second morning moment
4. **Trade association sponsorships** — PHCC, ACCA, NRCA newsletters
5. **Referral program** — Refer a business, earn 50 credits
6. **Agency white-label** — Agencies resell at markup — each agency = 10–50 clients

### Retention levers
1. **Daily habit** — 8am suggestion drives daily opens
2. **Streak gamification** — Posting streak in sidebar; milestone badges
3. **Credit economy** — Running low creates urgency to upgrade
4. **PostCore smarter over time** — Training data → better output → lower churn

### Viral mechanics
1. **Public showcase** — `/p/[handle]` — "Made with ItsPosting" on every public post
2. **Job site branding** — Posts include location + service = local SEO for the business
3. **White-label agency model** — Agencies = distribution partners, not competitors
4. **10k showcase pages** → organic backlinks → Google ranks ItsPosting pages → free traffic loop

---

## COMPETITIVE POSITIONING

| Competitor | Their weakness | Our counter |
|---|---|---|
| Buffer / Hootsuite | Generic — no industry intelligence | "We know frozen pipes beat pool maintenance in January" |
| Jasper | No scheduling, no images | "One tap from idea to posted" |
| Later / Sprout | $250–1,000/month, enterprise-first | "$20/month, built for tradespeople" |
| Canva posting | No AI advisor, no local intelligence | "PostCore knows your industry and season" |
| Jobber marketing | Very basic, no AI | "10x more output, zero thinking" |

**Our moat depth:**
1. industryKnowledge.js — seasonal intelligence per trade (12 months × 10 industries)
2. PostCore persona — named, voice-consistent AI character (not just a feature)
3. Credit economy — usage-based pricing aligns cost with value
4. White-label + workspaces — agency distribution leverage
5. PostCore Brain (future) — proprietary fine-tuned model, better output = lower API costs

---

## SPRINT TEMPLATE (Sustainable Pace)

```
Mon:  Review LLM training data count, fix any P0 bugs from prod
Tue:  Ship one P1 feature; deploy to Railway
Wed:  Bug bash; customer feedback review
Thu:  P2 feature or performance improvement
Fri:  Analytics review; update PLAN.md
Sat:  Self-content: post a demo to LinkedIn/YouTube using ItsPosting
```

---

## KPIs (Track Monthly in Railway DB)

| Metric | Target 3mo | Target 12mo |
|---|---|---|
| Active paying customers | 100 | 1,000 |
| Posts created/month | 2,000 | 50,000 |
| Trial → Paid conversion | 35% | 45% |
| Monthly revenue churn | <5% | <3% |
| LLM training examples | 2,000 | 20,000 |
| Wizard first-try success (no regen) | 70% | 85% |
| NPS | 40 | 60 |
| Avg credits used/customer/month | 20 | 50 |

---

*ItsPosting — PostCore is watching. It knows it's January.*
