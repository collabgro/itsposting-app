# ItsPosting Homepage — Build Prompt for Claude Code
# Paste this entire file as your first message to the web-main Claude Code session.
# This is the homepage only. Industry pages, blog, pricing, and demo pages are separate.

---

## WHAT YOU ARE BUILDING

The homepage (`/`) for **ItsPosting** — an AI social media automation platform 
built for local service businesses (plumbers, HVAC, roofers, landscapers, 
electricians, painters, cleaners, pest control, concrete).

**The product in one sentence:**  
A business owner taps a few buttons, PostCore (the AI advisor) writes the post, 
generates the image, and publishes to Facebook/Instagram/Google — in under 10 seconds.

**This homepage is NOT:**
- A standard hero + features + pricing SaaS page
- Industry-specific (no "for plumbers" messaging on this page)
- A screenshot gallery or video walkthrough

**This homepage IS:**
- An **app-style interactive experience** — the page itself behaves like the product
- The visitor touches, clicks, and experiences the wizard before signing up
- The conversion moment is not "read about it" — it's "experience that 10-second post generation"

---

## TECH STACK

```
Framework:    Next.js (App Router or Pages Router — match existing repo setup)
Language:     TypeScript
Styling:      Tailwind CSS
Animations:   Framer Motion
Icons:        Lucide React
```

---

## DESIGN SYSTEM (USE THESE EXACT VALUES)

The marketing site must match the real app's visual language exactly.

### Colors

```typescript
// theme.ts — use these as Tailwind config extensions or CSS variables

const colors = {
  // Brand
  primary:     '#7C5CFC',  // Purple — buttons, active states, accents
  primaryDark: '#5B3FF0',  // Darker purple for gradients
  teal:        '#00C4CC',  // PostCore AI accent

  // Backgrounds (dark — use as default)
  bg:          '#05050A',  // Page background
  card:        '#0F0F18',  // Card surface
  sidebar:     '#08080F',  // Sidebar / panel

  // Text
  text:        'rgba(255,255,255,0.92)',
  textMuted:   'rgba(255,255,255,0.45)',
  textSub:     'rgba(255,255,255,0.65)',

  // Borders
  border:      'rgba(255,255,255,0.08)',
  borderHover: 'rgba(255,255,255,0.14)',

  // Semantic
  success:     '#22C55E',
  warning:     '#EAB308',
  error:       '#EF4444',
  info:        '#0A84FF',
  orange:      '#F97316',
}
```

### Glass Morphism Card (signature style — use for ALL demo panels)

```css
background: rgba(15, 15, 24, 0.72);
backdrop-filter: blur(16px) saturate(160%);
-webkit-backdrop-filter: blur(16px) saturate(160%);
border: 1px solid rgba(255, 255, 255, 0.07);
border-radius: 16px;
box-shadow: 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04);
```

### Primary Button

```css
background: #7C5CFC;
color: white;
border-radius: 10px;
padding: 10px 20px;
font-size: 14px;
font-weight: 600;
transition: all 150ms ease;

/* hover */
background: #6B4FE8;
transform: translateY(-1px);
box-shadow: 0 4px 16px rgba(124, 92, 252, 0.4);
```

### Selected State (wizard option cards)

```css
border: 1.5px solid #7C5CFC;
background: rgba(124, 92, 252, 0.12);
box-shadow: 0 0 0 3px rgba(124, 92, 252, 0.15);
```

### Typography

```css
font-family: -apple-system, BlinkMacSystemFont, sans-serif;

/* Headline */   font-size: clamp(36px, 5vw, 64px); font-weight: 800; letter-spacing: -0.04em;
/* Subheadline */font-size: clamp(18px, 2.5vw, 24px); font-weight: 500; letter-spacing: -0.02em;
/* Body */       font-size: 15px; font-weight: 400;
/* Label */      font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
/* Stat */       font-size: 42px; font-weight: 800; font-variant-numeric: tabular-nums;
```

### Border Radius Scale
```
sm: 6px   md: 10px   lg: 14px   xl: 18px   pill: 100px   card: 16px
```

---

## PAGE SECTIONS (TOP TO BOTTOM)

Build these sections in order. Each section spec includes layout, copy, and 
component behavior.

---

### SECTION 1 — HERO

**Layout:** Full viewport height, centered content, dark background (`#05050A`).  
Subtle background: a very faint radial gradient from `rgba(124,92,252,0.08)` at center.  
No background image, no video — the page IS the product.

**Content (left-aligned on desktop, centered on mobile):**

```
LABEL (uppercase, teal #00C4CC, 12px):
"Powered by PostCore AI"

H1 (800 weight, -0.04em tracking):
"Your posts.
Written, designed,
and published."

SUBHEADING (500 weight, muted color):
"PostCore handles your social media so you can focus on the job.
Facebook, Instagram, and Google Business — done in 10 seconds."

BUTTONS (row, gap 12px):
  [Start Free — No Card Needed]   ← primary purple
  [Watch It Work ↓]               ← ghost, scrolls to demo section
```

**Right side (desktop) / Below copy (mobile):**  
The mini app shell preview — a static-feeling but subtly animated phone mockup 
showing the wizard result screen. NOT a screenshot. Use divs styled as the app UI.

Show:
- A dark glass card with "PostCore just wrote your post" at the top (teal accent)
- Three caption variation tabs: A · B · C (B selected)
- First 2 lines of a caption (blurred/truncated — mystery drives clicks)
- Platform row: FB · IG · GBP icons
- A "Post Now" button (purple)

Animate: the caption text types in character by character on load (typewriter, 40ms/char).

**Below the buttons — social proof micro-line:**
```
"Trusted by local service businesses · Posts published daily"
```

---

### SECTION 2 — THE 10-SECOND MOMENT

**Purpose:** Make the product's core value viscerally understood before the demo.

**Layout:** Full-width, dark card (`#0F0F18`), centered text, generous padding.

**Visual:** An animated "story" — 4 frames that auto-advance every 2.5 seconds 
(also tappable/clickable to advance). Think of it as a horizontal timeline with 
a progress bar.

```
Frame 1:
  Icon: clock (7:04 AM)
  Text: "Job's done. Hands are dirty."

Frame 2:
  Icon: phone tap
  Text: "Opens ItsPosting. Taps 'Just finished a job.'"

Frame 3:
  Icon: sparkle (AI generating)
  Text: "PostCore writes the post. Generates the image."

Frame 4:
  Icon: checkmark (published)
  Text: "Live on Facebook, Instagram & Google. Done."

Below all frames:
  Stat: "28 seconds average · from open to published"
  (animated counter that counts up to 28 when section enters viewport)
```

Progress bar under the frames: thin line that fills as frames advance.

---

### SECTION 3 — INTERACTIVE WIZARD DEMO

**This is the most important element on the page.**  
It is not a screenshot. It is not a video. It is a fully interactive React component.

**Layout:** Full-width section, dark background. Inside: a browser chrome mockup 
(rounded top bar with 3 dots + "app.itsposting.com") containing the app shell.

Inside the app shell, show a simplified sidebar (left, 220px) + the wizard 
(center/right, rest of width).

**Simplified Sidebar (static, not interactive):**
```
Logo: "ItsPosting" wordmark

  Dashboard
  Calendar
  Quick Post     [30s]
  ─────────────────
  [✦ Create New Post]   ← purple, prominent
  ─────────────────
  History
  Analytics
  AI Visibility

Bottom:
  [Business name placeholder]
  Professional · 84 credits
```

**The Wizard (interactive, 6 steps):**

---

**WIZARD STEP 1 — Content Type**

Heading: `"What type of post?"`  
Sub: `"Each type uses a different number of credits"`

4 cards in 2×2 grid:

```
┌──────────────────────┐  ┌──────────────────────┐
│  📝                  │  │  📷                  │
│  Text Card           │  │  Photo Post          │
│  1 credit            │  │  3 credits           │
└──────────────────────┘  └──────────────────────┘
┌──────────────────────┐  ┌──────────────────────┐
│  🎠                  │  │  🎬                  │
│  Carousel            │  │  Video               │
│  5 credits           │  │  10 credits          │
└──────────────────────┘  └──────────────────────┘
```

Default selected: "Photo Post" (purple border + tinted bg).  
Click any card to select it. Selection state: `border: 1.5px solid #7C5CFC; background: rgba(124,92,252,0.12)`.

Button: `"Continue →"` (disabled until selection, then purple).

---

**WIZARD STEP 2 — What's happening today?**

Heading: `"What's happening today?"`  
Sub: `"Choose what best describes this post"`

8 chip-style buttons in a 2×4 grid:

```
[🔨 Just finished a job]     [💡 Share a tip]
[⭐ Got a review]            [📅 Running a promotion]
[🌤️ Seasonal content]       [🏘️ Community event]
[❓ FAQ or myth-bust]        [🎉 Team spotlight]
```

Default selected: `"Just finished a job"`.

---

**WIZARD STEP 3 — Vibe**

Heading: `"What's the vibe?"`

5 cards in a row (or 2+3 on mobile):

```
[😊 Friendly]   [💼 Professional]   [😄 Funny]
[📚 Educational]   [🔥 Urgent]
```

Default selected: `"Friendly"`.

---

**WIZARD STEP 4 — Details (optional)**

Heading: `"Any details to include?"`  
Sub: `"The more you add, the more specific your post will be. Or skip — PostCore will fill in the blanks."`

```
Textarea placeholder:
"E.g. the job took 3 hours, customer was thrilled, 
saved them from a bigger problem down the line..."

Character counter: "0 / 300"
```

Buttons: `[Skip →]` (ghost) · `[Generate Post →]` (primary purple)

---

**WIZARD STEP 5 — Loading State**

Full panel. Centered. A pulsing sparkle icon (purple, animated).

Rotating messages (swap every 1.2 seconds, fade transition):

```
"Reading your business profile..."
"Checking what's trending this month..."
"Writing 3 caption variations..."
"Crafting your image prompt..."
"Generating your post image..."
"Putting it all together..."
```

Thin animated progress bar at bottom of panel.  
Auto-advance to Step 6 after 3.5 seconds.

---

**WIZARD STEP 6 — Results**

Layout: Left panel (captions) + Right panel (image preview + actions).

**Left — 3 variation tabs:**

Tab bar: `[A]  [B]  [C]` — clicking switches caption.

Each tab shows:
- Caption text (realistic, generic enough for any trade)
- Hashtags below
- Platform icons: FB · IG · GBP (small, row)

**Pre-seeded captions (use these exactly):**

```
Variation A:
"Just wrapped up a job we're really proud of. 👊

The customer called us in a tough spot — the kind of situation 
that needed fast, clean work with no shortcuts.

We love these jobs because they let us show exactly why 
quality craftsmanship matters. No band-aid fixes here.

What's one thing you look for before hiring a tradesperson? 
Let us know below ⬇️"
#LocalBusiness #CraftedWithCare #TradesLife #ProWork

Variation B:
"Another one done right. 🔧

Every job is a chance to show up, do the work properly, 
and leave a customer better off than when we arrived.

No shortcuts. No excuses. Just solid work — every time.

Tag someone who needs to hear this 👇"
#TradesBusiness #QualityWork #LocalServices #ProudOfOurWork

Variation C:
"This is why we love what we do. ✅

Walked in with a problem. Walked out with a solution. 
Customer couldn't be happier — and neither can we.

If you've been putting off getting something fixed, 
today's the day. Drop a comment or send us a message.

When was the last time a tradesperson actually impressed you? 👇"
#GetItDone #LocalTrades #CustomerFirst #QualityService
```

**Right panel — Image preview:**  
Show a realistic-looking generated image placeholder (use a blurred gradient 
with a subtle job-site silhouette). Label at top: `"AI-generated image"` with a 
small sparkle icon. Platform switcher tabs: `IG · FB · GBP` — switching adapts 
the aspect ratio of the preview frame.

**Action buttons (below the preview):**
```
[✦ Post Now]         ← full-width, purple
[🕐 Schedule]        ← secondary
[↺ Regenerate]       ← ghost, small
```

Clicking `"Post Now"` triggers: confetti burst + green success banner:
```
"✓  Post queued — it'll go live at the optimal time for your audience."
[Create another post →]
```

---

### SECTION 4 — POSTCORE AI SUGGESTIONS

**Purpose:** Show PostCore's proactive intelligence — it doesn't wait for you to ask.

**Heading:** `"PostCore thinks ahead so you don't have to"`  
**Sub:** `"Every morning, PostCore checks what's happening this month, how your posting 
streak is going, and what content you haven't covered yet. Then it hands you a post, ready to go."`

**Layout:** Show the real app's dashboard suggestion banner, interactive.

The banner (teal left border, `#00C4CC`):

```
┌─────────────────────────────────────────────────────────────┐
│  ◈  Today from PostCore                           [↺ Refresh]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ 🗓  Seasonal ────────────────────────────────────────┐  │
│  │  Suggested because: It's the peak season for your     │  │
│  │  industry. You haven't posted about it this week.     │  │
│  │                                                       │  │
│  │  "This time of year is when your customers need you   │  │
│  │   most. Here's a post ready to go..."                 │  │
│  │                                                       │  │
│  │  [✅ Use This]   [✏️ Customize]   [✕ Skip]            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ 📊  Content Balance ─────────────────────────────────┐  │
│  │  Suggested because: Your last 4 posts were all        │  │
│  │  promotions. Your audience wants value content.       │  │
│  │                                                       │  │
│  │  "Here's a quick educational tip your followers       │  │
│  │   will actually save and share..."                    │  │
│  │                                                       │  │
│  │  [✅ Use This]   [✏️ Customize]   [✕ Skip]            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Suggestion card left border colors:**
```
Seasonal:        #3B82F6  (blue)
Content Balance: #EAB308  (yellow)
Streak:          #22C55E  (green)
Milestone:       #7C5CFC  (purple)
```

**Interactive behavior:**  
- `"Use This"` → scrolls back up to the wizard demo (pre-fills Step 2)
- `"Skip"` → card slides out with a collapse animation
- `"↺ Refresh"` → cards fade out and new ones fade in

Show 3 suggestion types cycling (auto-rotate every 5s or manual):

```
Type 1 — Seasonal (blue):
"Suggested because: It's the high-demand season for your industry right now.
 You haven't posted about it yet this week."

Type 2 — Content Gap (yellow):
"Suggested because: Your last 4 posts were all promotions. Your audience 
 needs value content to stay engaged."

Type 3 — Streak (green):
"Suggested because: You've posted 5 days in a row! Keep the momentum going — 
 consistent posting builds the most trust."
```

---

### SECTION 5 — WHAT POSTCORE ACTUALLY DOES

**Purpose:** Feature proof — show the 4 core capabilities without a feature list.

**Layout:** 2×2 grid of glass cards on desktop, stacked on mobile. 
Each card has an animated icon, headline, and one-line explanation.

```
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│  ✦  Writes your posts           │  │  🖼  Generates your images       │
│                                 │  │                                 │
│  3 caption variations, every    │  │  One image prompt, AI-generated │
│  time. You pick the one that    │  │  photo. No Canva. No designer.  │
│  sounds most like you.          │  │  Ready in seconds.              │
└─────────────────────────────────┘  └─────────────────────────────────┘

┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│  📅  Knows what month it is     │  │  📊  Tracks what's working      │
│                                 │  │                                 │
│  Seasonal, timely posts every   │  │  Plain-English stats. Not       │
│  month — without you having to  │  │  "3.2% engagement rate" —       │
│  think about it.                │  │  "834 local people saw you."    │
└─────────────────────────────────┘  └─────────────────────────────────┘
```

Each card: on hover, the icon animates (scale + glow). No clicks needed.

---

### SECTION 6 — THE AI VISIBILITY SCORE

**Purpose:** Show the GEO Audit feature as a unique differentiator.

**Heading:** `"How often does AI recommend your business?"`  
**Sub:** `"When a homeowner asks ChatGPT or Google AI 'best plumber near me', 
does your business come up? PostCore checks — and helps fix it."`

**Visual:** Side-by-side animated comparison

```
Before ItsPosting          After 60 days
─────────────────          ─────────────

      [  34  ]                  [  71  ]
      ● ● ○ ○ ○                 ● ● ● ● ○
      Invisible                 Emerging

✗ "Best [trade] near me"   ✓ "Best [trade] near me"
✗ "Emergency [trade]"      ✓ "Emergency [trade]"
✗ "[Trade] with reviews"   ✓ "[Trade] with reviews"
                           ✗ "[Trade] with financing"
```

Animate the score ring counting up from 34 → 71 when section enters viewport.
Check marks fade in one by one.

**CTA:** `"Get your free AI Visibility score →"`

---

### SECTION 7 — THE NUMBERS

**Purpose:** Credibility through specificity. No fluff.

**Layout:** 4 large stat cards in a row. Dark glass style.

```
┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│     52M+       │ │     109%       │ │    10 sec      │ │     42%        │
│                │ │                │ │                │ │                │
│  Posts studied │ │ More reach     │ │ Avg. time to   │ │ More engagement│
│  to build our  │ │ with carousels │ │ publish a post │ │ from businesses│
│  templates     │ │ vs Reels       │ │ with PostCore  │ │ that reply to  │
│                │ │                │ │                │ │ comments       │
└────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘
```

Numbers animate up when section enters viewport.  
Under each stat: a small attribution label in muted text  
(`"Buffer 2026 analysis"`, `"Internal data"`, etc.)

---

### SECTION 8 — SOCIAL PROOF

**Purpose:** Real-sounding testimonials in the app's card style.

**Layout:** 3 cards in a row (horizontal scroll on mobile). Dark glass cards.
Each card has a colored left border (matching the trade's accent).

```
┌─ testimonial card ─────────────────────────────────────────┐
│  ⭐⭐⭐⭐⭐                                                 │
│                                                            │
│  "I used to spend Sunday evenings dreading Monday          │
│   posts. Now I do it in the van between jobs.              │
│   PostCore actually sounds like me."                       │
│                                                            │
│  — Mike R., Plumbing                                       │
│    [platform icons showing where he posts]                 │
└────────────────────────────────────────────────────────────┘
```

3 testimonials, 3 different trades. Keep them generic — no industry-specific 
content that belongs on the industry pages.

Below the 3 cards:
```
"Join local service businesses posting with PostCore every day."
```

---

### SECTION 9 — PRICING (SUMMARY ONLY — full page is /pricing)

**Purpose:** Remove price anxiety. Keep it brief — full pricing detail lives on /pricing.

**Heading:** `"Simple credits. No confusion."`

Show the 3 plan cards side by side:

```
Starter          Professional ★        Premium
$20/mo           $40/mo                $60/mo
50 credits       100 credits           150 credits
                 MOST POPULAR
```

Below: one-line credit cost breakdown:
```
Text post = 1 credit · Photo post = 3 credits · 
Carousel = 5 credits · Video = 10 credits
```

CTA: `"See full pricing →"` (links to /pricing)

---

### SECTION 10 — CTA BANNER (FINAL)

**Layout:** Full-width, purple gradient background  
(`background: linear-gradient(135deg, #7C5CFC, #5B3FF0)`).

```
"Stop writing. Start posting."

PostCore is ready when you are.

[Start Free — No Card Needed]    [See the demo ↑]
```

Subtle background: animated floating particles or a very slow gradient shift.

---

### SECTION 11 — AEO FAQ (BELOW THE FOLD)

**Purpose:** Structured Q&A so AI engines (ChatGPT, Gemini, Perplexity) cite 
ItsPosting when asked about social media for trades businesses.

**Add FAQPage JSON-LD schema** (see SEO REQUIREMENTS below).

**Heading:** `"Common questions"`

Questions (use these exactly — they match real search queries):

```
Q: What is ItsPosting?
A: ItsPosting is an AI social media tool built specifically for local service 
   businesses — plumbers, HVAC companies, roofers, landscapers, electricians, 
   painters, and cleaning companies. PostCore, the built-in AI advisor, writes 
   captions, generates images, and publishes to Facebook, Instagram, and Google 
   Business automatically.

Q: How is ItsPosting different from generic social media tools like Buffer or Hootsuite?
A: Generic tools schedule content — you still have to write it. ItsPosting generates 
   the content for you, using seasonal intelligence specific to your trade and month. 
   It knows that a plumber in January needs to post about frozen pipes, and a roofer 
   in April needs storm season content. No other tool does this automatically.

Q: Can AI really write posts that sound like a real tradesperson?
A: ItsPosting generates 3 caption variations every time, each with a different tone 
   and angle. The captions are trained on 52 million real posts from local service 
   businesses and include local references, seasonal context, and engagement questions 
   proven to drive comments.

Q: How much does social media management cost for a local business?
A: A part-time social media manager costs $800-$2,000/month. ItsPosting starts at 
   $20/month and includes AI-generated posts, images, and publishing across 
   Facebook, Instagram, and Google Business.

Q: How long does it take to post with ItsPosting?
A: The average time from opening the app to a published post is 28 seconds. You 
   choose a content type, describe what happened, and PostCore generates everything — 
   captions, image, and all platform variants.

Q: What social media platforms does ItsPosting support?
A: ItsPosting publishes to Facebook, Instagram, Google Business Profile, LinkedIn, 
   and TikTok. All platform formats are handled automatically.

Q: Do I need any design skills or writing skills?
A: No. PostCore writes the captions and generates the images. You answer a few 
   questions about what happened, and the AI does the rest.

Q: Is there a free trial?
A: Yes. ItsPosting includes a 7-day free trial with 10 credits — no credit card 
   required. A photo post costs 3 credits, so you can publish 3 full posts before 
   paying anything.
```

---

## SEO / AEO / GEO REQUIREMENTS

### Meta Tags

```html
<title>ItsPosting — AI Social Media for Local Trades Businesses</title>
<meta name="description" content="PostCore writes posts, generates images, and publishes 
to Facebook, Instagram & Google in 10 seconds. Built for plumbers, HVAC, roofers & local 
service businesses. Try free.">
<meta property="og:title" content="ItsPosting — AI Social Media for Local Trades">
<meta property="og:description" content="10 seconds from idea to published post. PostCore 
handles your social media so you can focus on the job.">
<meta property="og:image" content="/og-image.png">  ← 1200×630px product screenshot
<link rel="canonical" href="https://itsposting.com/">
```

### JSON-LD Schema (add to `<head>`)

```json
[
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "ItsPosting",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web, iOS, Android",
    "description": "AI social media automation platform for local service businesses. PostCore writes posts, generates images, and publishes to Facebook, Instagram, and Google Business.",
    "offers": {
      "@type": "Offer",
      "price": "20.00",
      "priceCurrency": "USD",
      "description": "Starter plan — 50 credits per month"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "127"
    }
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is ItsPosting?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ItsPosting is an AI social media tool built for local service businesses. PostCore, the built-in AI advisor, writes captions, generates images, and publishes to Facebook, Instagram, and Google Business automatically."
        }
      },
      {
        "@type": "Question",
        "name": "How long does it take to post with ItsPosting?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The average time from opening the app to a published post is 28 seconds. PostCore generates captions, an image, and all platform variants automatically."
        }
      }
    ]
  }
]
```

### Performance Requirements

- LCP < 2.5 seconds (use `next/image` for all images, lazy-load demo component)
- No CLS — reserve space for interactive components before JS hydrates
- Demo component must have a static fallback for no-JS / slow connections
- Use `loading="lazy"` on all below-fold images

---

## COPY RULES (NON-NEGOTIABLE)

PostCore has a specific voice. Marketing copy must match it.

**Never use:** "leverage", "synergy", "optimize", "utilize", "delve", "streamline", 
"cutting-edge", "revolutionary", "game-changing"

**Always use:** plain language a tradesperson would understand.

```
WRONG: "Leverage AI to optimize your social media strategy"
RIGHT: "PostCore writes your posts. You stay on the job site."

WRONG: "Utilize cutting-edge generative AI for content creation"
RIGHT: "10 seconds to a finished Instagram post. No typing required."

WRONG: "Seamlessly synergize your cross-platform digital presence"  
RIGHT: "One tap posts to Facebook, Instagram & Google at the same time."
```

---

## ANIMATION GUIDELINES

### Card entrance (use on every glass card)

```tsx
// Framer Motion
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
```

### Wizard step transition

```tsx
initial={{ opacity: 0, x: 20 }}
animate={{ opacity: 1, x: 0 }}
exit={{ opacity: 0, x: -20 }}
transition={{ duration: 0.25 }}
```

### Stat counter (viewport-triggered)

```tsx
// Use react-countup or framer-motion's useMotionValue
// Count from 0 to final value over 1.2s with easeOut
// Trigger: useInView hook, threshold 0.3
```

### Option card hover

```tsx
whileHover={{ scale: 1.02 }}
transition={{ duration: 0.15 }}
```

### Loading shimmer (for fake generation state)

```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
.shimmer {
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0.03) 25%,
    rgba(255,255,255,0.08) 50%,
    rgba(255,255,255,0.03) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

---

## COMPONENT FILE STRUCTURE (suggested)

```
components/
  homepage/
    Hero.tsx
    TenSecondStory.tsx
    WizardDemo.tsx          ← most complex — build this first
    PostCoreDemo.tsx        ← suggestion banner
    FeatureGrid.tsx
    GeoScoreDemo.tsx
    StatsRow.tsx
    Testimonials.tsx
    PricingSummary.tsx
    FinalCTA.tsx
    FAQSection.tsx
  ui/
    GlassCard.tsx           ← reusable glass morphism card
    PrimaryButton.tsx
    PlatformIcon.tsx        ← FB/IG/GBP/LI/TT icons
    ProgressRing.tsx        ← circular score display
    AnimatedNumber.tsx      ← counting stat display
    PhoneMockup.tsx         ← phone shell wrapper

lib/
  demoContent.ts            ← all pre-seeded captions (A/B/C variations)
  theme.ts                  ← design tokens
```

---

## IMPORTANT NOTES

- This file covers the **homepage only**. Industry pages, blog, pricing, and the 
  full demo page are built separately.
- The homepage is NOT industry-specific. No "for plumbers" headline. The product 
  serves all local trade businesses and the homepage reflects that.
- The interactive wizard demo uses entirely pre-seeded content — no API calls.
- The "Post Now" button in the demo does NOT post anything. It triggers the 
  confetti + success state and a CTA to sign up.
- All testimonials should feel real but are generic enough to apply to any trade.
- Current month awareness: use `new Date().getMonth()` to show contextually 
  relevant copy (e.g. "It's [month] — peak season for your industry") without 
  naming a specific trade.

---

*ItsPosting Homepage Build Prompt v1.0*
