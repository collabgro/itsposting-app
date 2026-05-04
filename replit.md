# Its Posting — Social Media SaaS

## Overview
Social media automation for local businesses. Generates content (text, images, carousels, videos) and publishes to Facebook, Instagram, and Google Business Profile.

## Architecture
- **Backend**: Node.js + Express on port 3001
- **Frontend**: Next.js 15.5.15 on port 5000 (mapped to external port 80)
- **Database**: PostgreSQL (Replit-managed, via `DATABASE_URL`)
- **Start command**: `npm run dev` (concurrently runs both)

## UI Design System (Dark-First SaaS)
- **Theme**: Linear/Vercel-style dark SaaS — `bg=#0B0B0F`, `card=#16161D`, `sidebar=#13131A`, `primary=#7C5CFC`
- **Theme system**: `frontend/lib/theme.js` — `ThemeProvider`, `useTheme()`, `tokens` (dark/light)
- **UI primitives**: `frontend/components/ui.js` — `Card`, `Button`, `Input`, `Textarea`, `Badge`, `StatCard`, `SectionHeader`, `EmptyState`, `Spinner`
- **Styling**: Inline styles only — no Tailwind. All pages use `useTheme()` → `t` tokens.
- **Pattern**: All auth-gated pages use `mounted + localStorage.getItem('token')`, no Zustand.
- **Theme toggle**: ☀/☾ in top-right header, persisted to localStorage.
- **Collapsible sidebar**: collapses to 64px icon strip, expands to 240px.

## Key Files
```
backend/
  server.js              — Express app, all routes registered (v2.1.0)
  middleware/auth.js     — JWT auth + verifyAdmin() for admin-only routes
  routes/auth.js         — Register, login, verify, forgot-password, reset-password
  routes/admin.js        — Admin CRUD: stats, customer list/detail/edit, credits, suspend, promote, audit log, health
  routes/analytics.js    — Post analytics: overview, list, detail with platform metrics + insights
  routes/customers.js    — Profile CRUD, social accounts list
  routes/posts.js        — Posts CRUD + analytics
  routes/content.js      — AI content generation
  routes/social.js       — OAuth connect/callback/disconnect
  routes/upload.js       — Manual upload (multer + Cloudinary)
  routes/billing.js      — Plans + upgrade flow
  routes/media.js        — Media library (Cloudinary)
  services/
    AuditLog.js            — Admin action audit log helper
    ClaudeService.js       — Anthropic Claude content generation
    NanoBananaService.js   — Google Gemini image generation
    MidjourneyService.js   — Replicate/Midjourney images
    HeyGenService.js       — HeyGen video generation

frontend/
  lib/
    theme.js               — ThemeProvider, useTheme, dark/light tokens
    api.js                 — Axios client + all API methods (authAPI, postsAPI, contentAPI, adminAPI, analyticsAPI, mediaAPI, etc.)
  components/
    ui.js                  — Reusable primitives (Card, Button, Input, etc.)
    Layout.js              — Collapsible sidebar + topbar + theme toggle + Admin Portal nav for admins
    ContentCreatorModal.js — AI content generation modal
  pages/
    login.js               — Dark-themed auth
    signup.js              — 2-step onboarding
    dashboard.js           — Main dashboard: mini-calendar with post dots, upcoming posts with thumbnails, recent posts table with thumbnails, clickable stat cards
    upload.js              — Post creation with media library picker, live character count (per-platform), hashtag counter
    calendar.js            — Interactive schedule calendar: click day → side panel with posts + quick-add, color-coded chips by content type
    history.js             — Post history with search, platform icons, thumbnails, delete, expand caption, AI generate button
    media.js               — Media library
    analytics/
      index.js             — Analytics overview: stats, Scheduling Optimizer (heatmap + top-3 slots), content-type performance bars, DOW distribution, top posts
      posts/[id].js        — Per-post performance detail with platform breakdown, comparisons, insights
    admin/
      index.js             — Admin portal dashboard (users, MRR, revenue, system health)
      customers.js         — Searchable/filterable customer list table
      customers/[id].js    — Full customer detail (credits, suspend, edit, promote, audit log)
    billing.js             — Upgrade/plans page
    settings.js            — Account settings
```

## Database Tables
```
customers            — Users with is_admin, role, suspended, email_verified, notes, password_reset_token
posts                — Posts with engagement, performance_score, platforms, engagement_by_platform
post_carousel_slides — Carousel slide content
social_accounts      — OAuth connected accounts
credit_transactions  — Credit usage history
admin_audit_log      — All admin actions (who, what, when, IP)
post_engagement_snapshots — Per-platform engagement snapshots over time
system_metrics       — Platform-wide metrics
email_queue          — Outbound email queue (password resets, notifications)
```

## Admin Access
- Test admin account: `test@postflow.dev` / `testpass123` (customer_id=1, is_admin=true)
- Admin routes: `GET/POST /api/admin/*` — requires `authenticate` + `verifyAdmin` middleware
- Admin portal: `/admin`, `/admin/customers`, `/admin/customers/[id]`
- Sidebar shows "Admin Portal" link only when `user.is_admin === true`

## Security
- Tiered rate limiting: 200/15min general, 10/15min auth, 3/hour password reset
- Structured JSON error logging (with `errorId`)
- `verifyAdmin()` checks `is_admin` + `suspended` on every admin request
- Admin routes are completely separate from customer routes
- Login blocks suspended accounts

## Environment Variables (Secrets)
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — Token signing secret
- `ANTHROPIC_API_KEY` — Claude API
- `GOOGLE_AI_API_KEY` — Gemini API
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — Media storage
