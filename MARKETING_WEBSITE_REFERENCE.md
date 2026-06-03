# ItsPosting Marketing Website — Master Reference
# For Claude Code working on the marketing/web-main repo.
# Read this entire file before writing a single line of code.

---

## WHAT YOU ARE BUILDING

An **app-style interactive marketing website** for ItsPosting — an AI social media 
automation platform for local trade businesses (plumbers, HVAC, roofers, landscapers, etc.).

This is NOT a standard SaaS landing page with hero + features + pricing.

This IS a website that **feels and behaves like the product itself**. Visitors click 
through live-feeling demos of the real UI without creating an account. By the time 
they hit "Sign up", they've already experienced the product.

**The core insight:** Local trade business owners (40-55 year old plumbers, roofers) 
don't read feature lists. They need to TOUCH the thing. Our conversion event is not 
"read about it" — it's "experience that 10-second post generation moment".

**SEO/AEO/GEO requirements:**
- Traditional SEO: semantic HTML, proper heading hierarchy, fast Core Web Vitals
- AEO (Answer Engine Optimization): FAQ schema, HowTo schema, clear Q&A structure 
  so ChatGPT/Gemini cite ItsPosting when asked "best social media tool for plumbers"
- GEO (Generative Engine Optimization): Entity-rich content, brand mentions, 
  structured data so AI engines recommend ItsPosting by name

---

## TECH STACK (MARKETING SITE)

```
Framework:      React + TypeScript
Styling:        Tailwind CSS
Animations:     Framer Motion
Router:         Next.js (App Router) or React Router — confirm with repo
Icons:          Lucide React (direct import OK on marketing site)
```

---

## THE APP'S DESIGN SYSTEM (EXACT VALUES)

Extract from the real app's `frontend/lib/theme.js`. Use these everywhere.

### Color Tokens

```css
/* Brand */
--ip-primary:     #7C5CFC;   /* Purple — brand accent, buttons, active states */
--ip-primary-dark:#5B3FF0;   /* Darker purple for gradients */
--ip-teal:        #00C4CC;   /* PostCore/AI accent color */

/* Backgrounds (Dark Mode — PRIMARY for marketing site) */
--ip-bg:          #05050A;   /* Page background — near-black */
--ip-card:        #0F0F18;   /* Card surface — dark navy */
--ip-sidebar:     #08080F;   /* Sidebar background */
--ip-input:       rgba(255,255,255,0.06); /* Input field background */

/* Backgrounds (Light Mode — secondary) */
--ip-bg-light:    #F0F0F7;
--ip-card-light:  #FFFFFF;

/* Text */
--ip-text:        rgba(255,255,255,0.92);   /* Primary text */
--ip-text-muted:  rgba(255,255,255,0.45);   /* Secondary / label text */
--ip-text-secondary: rgba(255,255,255,0.65); /* Mid-level text */

/* Borders */
--ip-border:      rgba(255,255,255,0.08);   /* Default card border */
--ip-border-hover:rgba(255,255,255,0.14);   /* Hover border */

/* Semantic */
--ip-success:     #22C55E;
--ip-warning:     #EAB308;
--ip-error:       #EF4444;
--ip-info:        #0A84FF;
--ip-orange:      #F97316;
```

### Typography

```css
font-family: -apple-system, BlinkMacSystemFont, sans-serif;

/* Scale */
font-size: 11px;   /* micro labels */
font-size: 12px;   /* captions, badges */
font-size: 13px;   /* body, inputs */
font-size: 14px;   /* secondary body */
font-size: 15px;   /* primary body */
font-size: 17px;   /* section headers */
font-size: 22px;   /* page titles */
font-size: 42px;   /* stat numbers (monospace) */

letter-spacing: -0.02em; /* headlines */
letter-spacing: -0.04em; /* display headlines */
letter-spacing: 0.05em;  /* uppercase labels */

font-weight: 400 | 500 | 600 | 700 | 800;
```

### Spacing Scale

```
xs:   4px
sm:   8px
md:   12px
lg:   16px
xl:   24px
xxl:  32px
xxxl: 48px
```

### Border Radius

```
sm:   6px
md:   10px
lg:   14px
xl:   18px
pill: 100px
```

### Glass Morphism Card Pattern

This is the signature card style. Use it for all demo UI panels:

```css
.ip-card {
  background: rgba(15, 15, 24, 0.72);
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 16px;
  box-shadow: 
    0 2px 8px rgba(0,0,0,0.3),
    inset 0 1px 0 rgba(255,255,255,0.04);
}

/* Tailwind approximate: */
className="bg-[rgba(15,15,24,0.72)] backdrop-blur-xl border border-white/7 rounded-2xl"
```

### Primary Button

```css
.ip-btn-primary {
  background: #7C5CFC;
  color: white;
  border-radius: 10px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  transition: all 150ms ease;
}
.ip-btn-primary:hover {
  background: #6B4FE8;
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(124, 92, 252, 0.4);
}
```

### Active/Selected State (Wizard options)

```css
.ip-option-selected {
  border: 1.5px solid #7C5CFC;
  background: rgba(124, 92, 252, 0.12);
  box-shadow: 0 0 0 3px rgba(124, 92, 252, 0.15);
}
```

---

## WEBSITE ARCHITECTURE (PAGE STRUCTURE)

```
/                   → Hero + Interactive Demo Section (main conversion page)
/features           → Deep feature pages with inline demos
/pricing            → Pricing with interactive credit calculator
/industries/[slug]  → Per-industry pages (plumber, hvac, roofer, etc.)
/demo               → Full-screen interactive app demo (no signup needed)
/blog               → SEO content hub (seasonal topics per trade)
/about              → Brand story
```

---

## PAGE 1: HOMEPAGE (`/`)

### Above the Fold

**Headline (H1):** 
```
Your AI Social Media Manager
for Local Trades
```

**Sub-headline:**
```
PostCore handles your Facebook, Instagram & Google Business posts.
You stay on the job site. 10 seconds, not 2 hours.
```

**CTA buttons:**
- Primary: "Try Free — No Card Needed"
- Secondary: "See How It Works" (scrolls to demo)

**Visual:** The interactive wizard demo (see DEMO COMPONENT specs below) — 
NOT a screenshot, NOT a video. The ACTUAL interactive component.

### Section 2: The 10-Second Moment (Storytelling)

Animate a story of Mike the Plumber:
```
7:04 AM, Monday. Mike finishes a frozen pipe job.
Opens ItsPosting. Taps "Just finished a job."
PostCore: "I noticed it's January — frozen pipe season. Here's your post, 
ready to reach 800+ local homeowners."
Mike taps Post Now.
Done. Back to work.
```

Use a phone mockup with animated typing, then the post appearing on Instagram.

### Section 3: Interactive Wizard Demo (PRIMARY CONVERSION ELEMENT)

Full interactive demo — see DEMO COMPONENT SPECS below.

### Section 4: Industries (Horizontal scroll cards)

Cards for: Plumber · HVAC · Roofer · Landscaper · Electrician · 
Painter · Pest Control · Concrete · Cleaning

Each card: industry icon + "See what PostCore posts for [trade] in [current month]"
Click → shows a real generated caption example for that trade + month.

### Section 5: PostCore AI Personality Section

Show the PostCore suggestion system visually:
- Seasonal intelligence: "It's [current month] — [industry urgency topic]"
- Streak awareness: "You haven't posted in 3 days"  
- Content balance: "You've posted 5 promotions — time for something educational"

Animate these firing one by one with typewriter effect.

### Section 6: The Numbers

```
52M+ posts analyzed to build our content templates
42% more engagement when businesses reply to comments
109% more reach with carousel posts vs Reels
10 seconds to publish with PostCore
```

### Section 7: Social Proof

Testimonials formatted exactly like the app's card style (dark navy glass cards).
Industry-specific: show a plumber quote, an HVAC quote, a roofer quote.

### Section 8: Pricing (with credit calculator)

See PRICING PAGE specs below.

### Section 9: AEO/FAQ Section

Structured FAQ with schema markup. Questions real people ask AI engines:
```
Q: What's the best social media tool for plumbers?
Q: How do I get more customers from Facebook as an HVAC company?
Q: Can AI write social media posts for a roofing company?
Q: How much does it cost to hire a social media manager for a trades business?
Q: What should a plumber post on Instagram in January?
```

---

## DEMO COMPONENT SPECIFICATIONS

This is the most important element on the site. Build it pixel-accurately.

### The Wizard Demo Component

A self-contained, fully interactive React component that simulates the real 
Post Wizard. No API calls — all responses are hardcoded/seeded but feel real.

**Layout:** Split panel
- Left: Wizard steps (400px wide)
- Right: "Live preview" of the post being built (grows as user makes choices)

**Step 1 — Content Type Selection**

Heading: `"What type of post?"`

4 cards in a 2×2 grid:

```
┌─────────────────┐  ┌─────────────────┐
│  📝 Text Card   │  │  📷 Photo Post  │
│  1 credit       │  │  3 credits      │
└─────────────────┘  └─────────────────┘
┌─────────────────┐  ┌─────────────────┐
│ 🎠 Carousel     │  │  🎬 Video       │
│  5 credits      │  │  10 credits     │
└─────────────────┘  └─────────────────┘
```

Selected state: purple border + purple tinted background.

**Step 2 — "What's happening today?"**

Heading: `"What's happening today?"`

8 chip-style buttons in 2 rows:
```
🔨 Just finished a job   💡 Share a tip
⭐ Got a review          📅 Running a promotion  
🌤️ Seasonal content     🏘️ Community/local event
❓ FAQ or myth-bust      🎉 Team spotlight
```

**Step 3 — Vibe/Tone**

Heading: `"What's the vibe?"`

5 cards:
```
😊 Friendly & casual
💼 Professional & trustworthy
😄 Funny & relatable
📚 Educational & expert
🔥 Urgent & promotional
```

**Step 4 — Platform**

Heading: `"Where are we posting?"`

Platform chips: Facebook · Instagram · Google Business · All Three

**Step 5 — "Generating..." Loading State**

Full-panel loading with rotating messages (2s each):
```
"Reading your business profile..."
"Checking what's trending for plumbers in January..."
"Writing 3 caption variations..."
"Generating your image..."
"Almost ready..."
```

Show an animated progress bar. Duration: 3-4 seconds total (fake).

**Step 6 — Results**

3 variation cards (A, B, C) side by side (or tabbed on mobile).

Each card:
- Variation badge: "A" "B" "C" in colored circles
- Caption text (pre-seeded, realistic, industry-specific)
- Hashtags below caption
- "Select this" button

Pre-seeded content per trade (rotate based on selected industry):

**For Plumber + "Just finished a job" + January:**
```
Variation A:
"Frozen pipe season is no joke — this Westside homeowner called us at 6am 
after their basement pipes burst overnight. We were there within 45 minutes, 
had the water back on before their kids woke up. ❄️

If you're hearing unusual sounds from your pipes when temperatures drop, 
don't wait — that's the pipe telling you something.

What's your biggest cold-weather home worry this winter? ⬇️"
#FrozenPipes #PlumbingEmergency #WestsidePlumbing #LocalPlumber

Variation B:
"Another frozen pipe rescue this morning — 3rd one this week alone. 🔧
January in [City] means we're on call 24/7 for exactly this.
The homeowners always ask: could this have been prevented?
Answer: YES — and it costs about $150 instead of $1,200+.
DM us 'WINTERIZE' and we'll send you the free checklist.
What do you wish you'd known before winter hit?"
#WinterPlumbing #HomeRepair #PlumbingTips

Variation C:
"When a pipe bursts at 6am, you need someone who actually answers. 📞
We just wrapped a job on [Street/Area] — family's back up and running.
15+ years serving [City] homeowners means we've seen every pipe situation.
Do you have our number saved for when winter strikes? 
Drop a ✅ if you're prepared for frozen pipe season!"
#EmergencyPlumbing #[City]Plumber #FrozenPipes
```

**For HVAC + "Seasonal content" + June:**
```
Variation A:
"Your AC is working harder right now than it has all year. ☀️
[City] summers are brutal — and a system that hasn't been serviced since 
last summer is running at 20-30% less efficiency, costing you more every day.
We're booking fast for June tune-ups. Slots this week are almost gone.
When was your last AC service? Drop the year below 👇"
```

Action buttons on selected variation:
- "Post Now" (primary purple button)
- "Schedule" (secondary)
- "Regenerate" (ghost with refresh icon)

Right panel (live preview):
Shows a phone mockup with the selected caption appearing as an Instagram post.
Platform tabs: IG · FB · GBP — switch to see how caption adapts.

---

## THE POSTCORE SUGGESTION DEMO

A separate interactive section on the homepage showing PostCore's proactive 
suggestions firing in real-time.

Show a dashboard mockup with a teal-accented banner at top:

```
┌──────────────────────────────────────────────────────────┐
│ ◈ Today from PostCore                           ↻ Refresh │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  🗓️  Seasonal  ████░                                     │
│  "Suggested because: It's January — frozen pipe season   │
│   is your highest-revenue month. You haven't posted      │
│   about winterization yet this week."                    │
│  "Frozen pipe emergencies are up 340% in January..."     │
│  [✅ Use This]  [✏️ Customize]  [✕ Skip]                  │
│                                                          │
│  📊  Content Balance  ████░                              │
│  "Suggested because: Your last 5 posts were all          │
│   promotions. Your audience needs value content to       │
│   stay engaged."                                         │
│  "Here's a quick winterization tip your followers..."    │
│  [✅ Use This]  [✏️ Customize]  [✕ Skip]                  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Animate: suggestion cards slide in one by one. On "Use This" click, launch wizard 
demo with pre-filled content.

**Suggestion type colors (for left border):**
- Seasonal: `#3B82F6` (blue)
- Content gap: `#EAB308` (yellow)
- Streak: `#22C55E` (green)
- Milestone: `#7C5CFC` (purple)

---

## SIDEBAR NAVIGATION (for demo app shell)

When the demo is shown inside a full app shell, use this exact sidebar:

**Sidebar width:** 240px  
**Sidebar background:** `#08080F`  
**Active item bg:** `rgba(124, 92, 252, 0.12)`  
**Active item border:** left 3px solid `#7C5CFC`

Navigation sections and items (in order):

```
━━ CREATE ━━━━━━━━━━━━━━━━━━
  Dashboard
  Calendar
  Quick Post    [30s badge]

  [CREATE NEW POST]  ← Purple gradient button, full width

━━ MANAGE ━━━━━━━━━━━━━━━━━━
  Post History
  Media Library

━━ GROW ━━━━━━━━━━━━━━━━━━━━
  Analytics
  AI Visibility

━━ BUSINESS ━━━━━━━━━━━━━━━━
  Knowledge Base
  Workspaces

━━ ━━━━━━━━━━━━━━━━━━━━━━━━━
  Settings
  Billing
```

At bottom of sidebar:
```
┌────────────────────────┐
│ Mike's Plumbing        │
│ Professional Plan      │
│ 84 credits remaining   │
└────────────────────────┘
```

---

## AI VISIBILITY DEMO (GEO Audit section)

Show a simplified version of the GEO Audit score on the marketing site.

Heading: `"How visible is your business to AI like ChatGPT?"`

Sub: `"ItsPosting checks 45 searches across ChatGPT, Claude & Perplexity 
to see how often your business gets recommended."`

Show a score ring demo (animated 0 → 34 on load, red = "Invisible"):
```
         ╭──────────╮
        ╱            ╲
       │      34      │
       │   Invisible  │
        ╲            ╱
         ╰──────────╯
```

Then show: "After 60 days with ItsPosting" → animates to 71, "Emerging"

Below: 3 "searches" that now cite the business:
```
✓ "Best plumber in Austin TX"         → Mike's Plumbing appeared
✓ "Emergency plumber Austin"          → Mike's Plumbing appeared  
✗ "Plumber with financing Austin"     → Not mentioned yet
```

CTA: "Get Your Free AI Visibility Score →"

---

## SEASONAL INTELLIGENCE SECTION

A key differentiator to showcase. Build a scrollable horizontal timeline.

**Heading:** `"PostCore knows what month it is — and what that means for your business"`

Show a 12-month wheel or horizontal scroll. Each month shows:
- Month name
- Industry urgency topic
- Pre-generated example post first line

**Plumber examples by month:**
```
Jan: "Frozen pipe emergencies — peak season. Be the emergency responder, 
      not just a maintenance company."
Feb: "Water heater failures spike in cold weather. Post about water heater 
      signs before customers call a competitor."
Mar: "Spring thaw means pipe damage checks. Post about the 5 things to 
      inspect after a cold winter."
Apr: "Sewer line roots season begins. Educational content performs best."
May: "Outdoor spigot activations, hose connections, irrigation startups."
Jun: "Water pressure problems spike with summer usage. Tip content."
Jul: "Hose bibb and outdoor plumbing peak usage — maintenance posts."
Aug: "Back to school — busy families ignore small leaks. Urgency posts."
Sep: "Pre-winter prep content. Insulate your pipes messaging."
Oct: "Final outdoor plumbing winterization. Strong CTA month."
Nov: "Drain cleaning before holiday guests arrive. Social proof heavy."
Dec: "Holiday emergency coverage. Be the company that answers on Dec 25."
```

Interactive: click any month, see the exact caption PostCore would generate.

---

## ANALYTICS DEMO

Show the plain-English analytics approach as a feature proof.

**Heading:** `"Analytics that actually mean something"`

Side-by-side comparison:

```
Generic tools say:          ItsPosting says:
────────────────────        ──────────────────────────────────
"710 impressions"    →      "~834 local homeowners saw 
                             your business this month"

"3.2% engagement"    →      "Your engagement is in the 
                             top 25% of plumbers your size"

"Post at 9am"        →      "Your audience engages most 
                             Tuesday 8am — before the workday 
                             starts (based on your data)"
```

---

## PRICING PAGE (`/pricing`)

### Plan Cards

**Trial — Free**
```
10 credits, 7-day trial
"Try before you commit — no card needed"
```

**Starter — $20/mo ($18/mo yearly)**
```
50 credits/month
"Perfect for one business posting 2-3x per week"
[Starter Button]
```

**Professional — $40/mo ($36/mo yearly)** ← RECOMMENDED
```
100 credits/month
"Most popular — enough for daily posting + AI Visibility checks"
[Get Started — Recommended]
```

**Premium — $60/mo ($54/mo yearly)**
```
150 credits/month
"For agencies or businesses running multiple social platforms hard"
[Get Started]
```

### Credit Cost Table

```
| Content Type    | Credits | What you get                        |
|-----------------|---------|-------------------------------------|
| Text Card       | 1       | 3 caption variations                |
| Photo Post      | 3       | 3 captions + AI-generated image     |
| Carousel        | 5       | 3 captions + 3-7 slides + images    |
| Video           | 10      | 3 captions + AI-generated video     |
| AI Visibility   | 5       | 45-search audit (first one FREE)    |
| Manual Upload   | 0       | Your own photos/videos, always free |
```

### Interactive Credit Calculator

Build a simple slider: "How many posts per week?" (1–7)
Show: "You'll use X credits/month → [plan recommendation]"

---

## INDUSTRY PAGES (`/industries/[slug]`)

One page per industry. These are SEO-critical.

Industries:
- plumber (`/industries/plumber`)
- hvac (`/industries/hvac`)
- roofer (`/industries/roofer`)
- landscaper (`/industries/landscaper`)  
- electrician (`/industries/electrician`)
- painter (`/industries/painter`)
- pest-control (`/industries/pest-control`)
- concrete (`/industries/concrete`)
- cleaning (`/industries/cleaning`)

**Each page structure:**
1. H1: "Social Media for [Industry] Companies — Powered by AI"
2. The problem: "Most [plumbers] hate posting on social media. Here's why it matters anyway."
3. Live demo seeded with industry-specific content
4. 12 months of seasonal content examples for that trade
5. "What does PostCore post for [plumbers] this month?" — dynamically show current month
6. Testimonial from that industry
7. FAQ with schema (8-10 questions specific to the trade)
8. CTA

**SEO title patterns:**
- "AI Social Media for Plumbers | ItsPosting"
- "Best Social Media Tool for HVAC Companies | ItsPosting"

**AEO-targeted FAQ questions per industry:**

*Plumber:*
```
Q: What should a plumber post on social media?
Q: How often should a plumbing company post on Facebook?
Q: What are the best hashtags for a plumbing business?
Q: Can AI write social media posts for a plumber?
Q: What's the ROI of social media for plumbing companies?
```

---

## SEO / AEO / GEO TECHNICAL REQUIREMENTS

### Schema Markup (add to every relevant page)

```json
// Homepage — SoftwareApplication
{
  "@type": "SoftwareApplication",
  "name": "ItsPosting",
  "applicationCategory": "BusinessApplication",
  "description": "AI social media automation for local trade businesses",
  "offers": { "@type": "Offer", "price": "20.00", "priceCurrency": "USD" }
}

// Industry pages — FAQPage
{
  "@type": "FAQPage",
  "mainEntity": [{ "@type": "Question", "name": "...", "acceptedAnswer": {...} }]
}

// Blog posts — HowTo schema where applicable
```

### Meta Tags Pattern

```html
<title>AI Social Media for [Industry] — ItsPosting</title>
<meta name="description" content="PostCore writes and posts for your [industry] business. 
10 seconds, not 2 hours. Try free — no card needed.">
<meta property="og:title" content="...">
<meta property="og:image" content="[1200x630 image with product screenshot]">
```

### Performance Requirements
- LCP < 2.5s (use next/image, lazy load demo components)
- No layout shift on demo load (reserve space before JS hydrates)
- Demo component must work with JS disabled (show static screenshot fallback)

### AEO Content Rules (so AI engines cite us)
- Every industry page must directly answer "What should a [trade] post on social media?"
- Include specific month-by-month content recommendations (AI engines love specificity)
- Use exact phrases competitors use in their queries: "social media for plumbers", 
  "HVAC Facebook posts", "roofing company Instagram"
- Brand entity: always write "ItsPosting" (not "its posting" or "itsposting") 
  so AI engines learn the brand name

---

## ANIMATION GUIDELINES (Framer Motion)

### Card entrance animation
```tsx
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

### Stat counter animation
```tsx
// Use framer-motion's useMotionValue + useTransform or react-countup
// Count up from 0 to final value over 1.2s when element enters viewport
```

### Hover on wizard option cards
```tsx
whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
```

### Loading shimmer (for fake generation)
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, 
  rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%);
background-size: 200% 100%;
animation: shimmer 1.5s infinite;
```

---

## DEMO COMPONENT: INDUSTRY + MONTH SEEDED CONTENT

Pre-seed the demo with realistic content for the 3 most common demo paths:

### Path 1: Plumber + January + "Just finished a job" + Friendly

**Image prompt result:** (show a AI-generated style mockup)
"Professional plumber fixing frozen pipes in a basement, warm lighting, 
satisfied homeowner in background, before/after split"

**Caption A:**
```
Frozen pipe rescue this morning — 6am call in Westside ❄️

This family woke up to no water. We were there in 45 minutes, 
pipes repaired, water back on before the kids' school run.

January is our busiest month for a reason. If you hear banging 
or gurgling in your pipes when temps drop, that's them telling 
you something.

Have you had your pipes checked this winter? Drop a comment ⬇️

#FrozenPipes #[City]Plumber #PlumbingEmergency #WinterPlumbing
```

**Caption B:**
```
Another frozen pipe win this morning. 🔧

3rd call this week from the Eastside alone — January in [City] is 
no joke. The homeowners always say the same thing: "I didn't think 
it would happen to me."

Prevention costs ~$150. Emergency repair? Often $1,200+.

DM us "WINTERIZE" and we'll send you our free cold-weather 
checklist. What's your biggest winter home worry?

#WinterPlumbing #PlumbingTips #HomeMaintenance #[City]
```

**Caption C:**
```
We answer at 6am. That's the difference. 📞

Frozen pipe call this morning, family back up and running before 
9am. 15 years serving [City] means we've seen every pipe situation.

Is your plumber's number saved in your phone? 
Drop a ✅ if you're ready for frozen pipe season.

#EmergencyPlumber #[City]Plumbing #FrozenPipes
```

### Path 2: HVAC + June + "Seasonal content" + Professional

**Caption A:**
```
Your AC is working harder right now than it has in 9 months. ☀️

[City] summers are brutal — and a system that hasn't been serviced 
since last year is running 20-30% less efficiently. That's real 
money on your electric bill every single day.

We're booking June tune-ups now. Slots this week are filling fast.

When was your last AC service? 
#HVAC #AirConditioning #[City]HVAC #SummerCooling
```

### Path 3: Roofer + April + "Got a review" + Friendly

**Caption A:**
```
"They were here the next morning after the storm. Professional, 
fast, and my roof looks better than before the damage." ⭐⭐⭐⭐⭐

— [Customer initials], [Neighbourhood]

Storm season is here in [City]. If you've had recent hail or high 
winds, it's worth a free inspection — damage isn't always visible 
from the ground but will show up in your next insurance renewal.

Have you had your roof checked this spring?
#Roofing #[City]Roofing #StormDamage #RoofRepair
```

---

## COPY RULES (PostCore Voice — enforce everywhere)

PostCore voice rules from the app must carry into marketing copy:

- Never says: "delve", "synergy", "leverage", "optimize", "utilize"
- Always explains WHY before WHAT
- Speaks like a trusted business advisor, not a software tool
- Plain language a tradesperson would understand
- Maximum 3 benefit points per section — never overwhelm

**Marketing headline tone examples:**
```
WRONG: "Leverage AI to optimize your social media strategy"
RIGHT: "PostCore writes your posts. You stay on the job site."

WRONG: "Utilize cutting-edge generative AI for content creation"
RIGHT: "10 seconds to a finished Instagram post. No typing required."

WRONG: "Synergize your digital presence across multiple platforms"
RIGHT: "One tap posts to Facebook, Instagram & Google at the same time."
```

---

## WHAT MAKES THIS SITE DIFFERENT FROM ANY COMPETITOR

Build these moments into the site:

1. **The wizard is ON the homepage** — not a screenshot of it. Visitors click through it.

2. **Industry selector at the top** — "I'm a [dropdown: Plumber / HVAC / Roofer / etc.]" 
   and the ENTIRE page adapts: demo content, seasonal examples, testimonials, FAQ.
   This makes every trade feel like the site was built specifically for them.

3. **Live month awareness** — The site knows today's month and shows relevant 
   seasonal content. A roofer visiting in April sees storm season content.
   A plumber visiting in January sees frozen pipe content. No JS needed — 
   server-render the current month.

4. **The "30 seconds" counter** — A prominent animated timer showing the average 
   time from wizard open to post published: "Average time to publish: 28 seconds"

5. **The credit calculator** — Interactive, not a static table. Users drag a slider 
   for posts per week and see exactly which plan covers them.

---

## FILE ORGANIZATION (suggested)

```
web-main/
├── components/
│   ├── demo/
│   │   ├── WizardDemo.tsx       ← The interactive wizard
│   │   ├── PostCoreDemo.tsx     ← Suggestion banner demo  
│   │   ├── GeoScoreDemo.tsx     ← AI visibility score demo
│   │   ├── AnalyticsDemo.tsx    ← Analytics comparison
│   │   └── PhoneMockup.tsx     ← Phone shell for previews
│   ├── layout/
│   │   ├── SiteHeader.tsx
│   │   └── SiteFooter.tsx
│   └── sections/
│       ├── Hero.tsx
│       ├── IndustryCards.tsx
│       ├── SeasonalTimeline.tsx
│       ├── SocialProof.tsx
│       └── PricingCards.tsx
├── pages/ (or app/)
│   ├── index.tsx
│   ├── pricing.tsx
│   ├── demo.tsx
│   ├── industries/[slug].tsx
│   └── blog/[slug].tsx
├── lib/
│   ├── seedContent.ts           ← All pre-seeded demo captions
│   ├── industryData.ts          ← Industry + month content map
│   └── theme.ts                 ← Design tokens (from app's theme.js)
└── public/
    └── images/
        └── demo/                ← Static fallback screenshots
```

---

## CRITICAL: THE DEMO MUST FEEL REAL

The wizard demo is not a slideshow. It is not an animated GIF. It must:

- Respond to actual clicks
- Remember choices across steps
- Show a real loading state (3-4 second fake generation)
- Display content that matches the industry + month combination
- Let users switch between the 3 variations and see them change
- Have the "Post Now" button do something satisfying (confetti + "Your post is ready!" state)

This is the make-or-break element. A trade business owner who clicks through 
the demo and sees a real-looking caption for "plumber in January in their city" 
will sign up. One who sees a generic placeholder will bounce.

---

*Document version: 1.0 | Created for ItsPosting marketing website*
*Source: Extracted from itsposting-app-main codebase + creative direction*
