# ItsPosting — PostCore Brain
# Full Multi-Modal Proprietary AI System Strategy
# Classification: Engineering + Product Leadership
# Last updated: 2026-05-29

---

## THE VISION

PostCore Brain is not just a text model.

It is a complete, niche-specific AI system for local service businesses — one that
eventually handles every AI function currently outsourced to third-party providers:

| Today (third-party)              | Future (PostCore Brain)              |
|----------------------------------|--------------------------------------|
| Claude Sonnet — captions         | PostCore Text — caption generation   |
| NanoBanana / Gemini 2.5 Flash    | PostCore Image — image generation    |
| Veo 3.1 Fast — cinematic video   | PostCore Video — video generation    |
| Runway Gen-4 — image-to-video    | PostCore Video — same model, no fallback needed |
| Pika 2.2 — video fallback        | PostCore Video — replaced entirely   |
| HeyGen — avatar/talking-head     | PostCore Avatar — talking-head video |

**Why this is achievable for our niche:**

A general-purpose image model needs to generate everything — portraits, cityscapes,
abstract art, fantasy creatures. PostCore Image only needs to generate ten things well:
plumbing job sites, HVAC installations, roofing work, concrete pours, landscaping,
electrical panels, painting jobs, pest control visits, contractor builds, cleaning.

Narrow domain = dramatically lower training data requirements.
A fine-tuned 8B text model beats GPT-4o on local trades captions because it knows
nothing else. The same principle applies to every modality.

---

## THE CORE PRINCIPLE

**Every existing integration runs unchanged until PostCore Brain earns its replacement.**

Claude handles 100% of text generation today. NanoBanana handles 100% of images.
Veo/Runway/Pika handle video. HeyGen handles avatars. None of this changes
until a PostCore module passes its quality gates and wins an A/B test.

The flywheel is passive. As customers use ItsPosting normally, every interaction
becomes training signal. Every image a customer keeps or regenerates. Every caption
variation they pick. Every video they post. That signal builds the dataset.
The dataset trains the model. The model earns its traffic share.

```
Customers use ItsPosting normally
         ↓
Every interaction generates training signal
  (text selections, image keeps/regenerates, video publishes, edit distances)
         ↓
PostCore Brain modules train on real-world local business preferences
         ↓
Modules go live when they beat third-party quality in A/B tests
         ↓
Better posts → more value → more customers → more signal
         ↓
Repeat. Compounding. Indefinitely.
```

---

## THE FOUR MODULES

### MODULE 1 — PostCore Text (replaces Claude)
**Handles:** Caption generation, hashtags, engagement questions, carousel slide copy,
PostCore suggestions, review response drafts, 30-day content planning

**Base model:** Llama 3.1 8B Instruct (Meta, MIT license)
**Fine-tuning method:** LoRA (Low-Rank Adaptation)
**Training data source:** Passive — every wizard session writes to `post_training_data`
**Corpus target:** 10,000 examples to first fine-tune, 50,000 for production quality
**Inference speed:** ~150ms (vs Claude's ~2,000ms)
**Cost per call:** ~$0.005 (vs Claude's ~$0.08)
**Timeline:** First trained model at Month 6, production at Month 10–12

---

### MODULE 2 — PostCore Image (replaces NanoBanana / Gemini)
**Handles:** Social media image generation — job site photos, before/after shots,
team photos, seasonal content, promotional graphics — for all 10 industries

**Base model:** FLUX.1-dev (Black Forest Labs, Apache 2.0 license)
- Best open-source image quality as of 2026
- Native support for photorealistic and graphic styles
- Strong prompt adherence — critical for branded content
- Alternative: Stable Diffusion XL 1.0 (Stability AI, open license)

**Fine-tuning method:** DreamBooth + LoRA on trades-specific imagery
**Training data source:** Three-tier system, each tier bootstrapping the next

**Tier 1 — Synthetic bootstrap (starts immediately, zero cost beyond existing API budget)**
Use NanoBanana (already integrated, already paid for) to generate a curated set of
training images per industry. Admin runs controlled generation sessions:
- 1,000 images per industry × 10 industries = 10,000 base images
- Prompts are crafted per industry and content type (job site, before/after, seasonal, team)
- Human curator approves/rejects each image before it enters the corpus
- Cost: ~$200 in NanoBanana API calls — already within normal image generation budget
- This corpus is available to start immediately. No external sourcing required.

The model's first version is trained on NanoBanana-generated images. It learns the
trades-specific visual domain. Then real images progressively replace synthetic ones
as Tier 2 and Tier 3 accumulate — and each retraining cycle improves on the last.

**Tier 2 — Customer uploads (passive, grows over time)**
Every manually uploaded photo (0 credits) tagged with industry and content type.
Customer keeps a generated image → positive signal added to corpus.
Customer regenerates → negative signal with original prompt logged.
Over time, real job-site photos from real customers become the dominant training signal.

**Tier 3 — Licensed library (long-term quality anchor)**
As budget allows: license trades photography packs from stock libraries.
Real photos anchor the model's understanding of authentic job-site aesthetics.
Target: 500+ real licensed photos per industry by Month 18.

**What the model learns:**
- Exact visual appearance of each trade's work (pipes, shingles, ductwork, turf cuts)
- Before vs after contrast — the dramatic transformation that drives engagement
- Authentic aesthetic — real job sites, not corporate stock photo sterility
- Seasonal context: frozen pipe emergencies in January, storm damage in April
- Tool and equipment authenticity per industry

**⚡ No blocking dependency.** NanoBanana generates the initial corpus today.
The image model training timeline is no longer blocked on external photo sourcing.

**Inference speed:** ~3–5 seconds (comparable to NanoBanana)
**Cost per image:** ~$0.002 (vs NanoBanana's ~$0.02)
**Timeline:** Synthetic corpus ready: Month 1–2, first model trained: Month 6–8, production: Month 10–12

---

### MODULE 3 — PostCore Video (replaces Veo 3 + Runway + Pika)
**Handles:** Short-form social video — 15–30 second clips of job sites, time-lapses,
before/after reveals, seasonal promotions — optimized for Instagram Reels and TikTok

**Base model:** CogVideoX 5B (Zhipu AI, Apache 2.0) or Open-Sora 1.2 (MIT)
- Open-source video generation has matured significantly
- For 10-second social clips at 720p, quality is competitive with Runway/Pika
- Fine-tunable on domain-specific video datasets
- Alternative: AnimateDiff v3 (for image-to-video from PostCore Image output)

**Fine-tuning method:** LoRA fine-tune on short-form trades video corpus
**Training data source:**
- Customer-published videos (with consent) tagged by industry and content type
- Licensed trades video footage from stock libraries
- Synthetic training data: animate PostCore Image outputs using base model
- Target: 500 video clips per industry × 10 industries = 5,000 base clips

**What the model learns:**
- Camera movement styles for each content type (slow push-in for before/after, overhead for landscaping)
- Industry-appropriate pacing (fast cuts for roofing storm response, slow reveal for painting)
- Social-first formatting: vertical 9:16 by default, safe zones for captions
- Authentic motion — tools being used, workers moving, water flowing, grass being cut

**PostCore Video replaces the entire cascade:**
Once trained, there is no Veo → Runway → Pika fallback chain.
PostCore Video is the primary. PostCore Image animated (via AnimateDiff fine-tune)
is the fallback. Both are fully controlled, with no per-video API costs.

**Inference speed:** ~30–60 seconds for 10-second clip (comparable to Veo/Runway)
**Cost per video:** ~$0.05 (vs Veo's ~$0.50 + Runway's ~$0.30)
**Timeline:** This is the most complex module. Month 18–24 for first working version,
Month 24–30 for production quality.

---

### MODULE 4 — PostCore Avatar (replaces HeyGen)
**Handles:** AI talking-head videos where a spokesperson presents content —
scripts delivered by a realistic AI presenter for each trades industry

**Base model:** LatentSync (ByteDance, MIT) or SadTalker v2 (open source)
- Drives a static photo to lip-sync with any audio input
- Significantly simpler than full video generation
- Quality competitive with HeyGen for social media use case

**Fine-tuning method:** Fine-tune on a curated set of diverse trade business presenter types
- Friendly contractor, professional HVAC tech, approachable landscaper, etc.
- 5–8 avatar archetypes per gender, varied ethnicity and age

**Pipeline:** PostCore Text (script) → TTS audio → PostCore Avatar (video)
All three components proprietary. Zero per-call cost at scale.

**Inference speed:** ~60–90 seconds for 30-second video (comparable to HeyGen)
**Cost per video:** ~$0.02 (vs HeyGen's ~$1.00+)
**Timeline:** Month 12–18 for first working version (simpler than full video generation)

---

## TRAINING DATA STRATEGY BY MODALITY

### Text data (passive, already collecting)
Every wizard session → `post_training_data` table:
- Which variation was selected (A/B/C)
- Edit distance before posting (0 = used as-is)
- 7-day reach and engagement (synced async)
- Industry, content type, tone, platform, month
- Whether customer regenerated (negative signal)

No action required. Data accumulates automatically.

### Image data (requires active curation)
Three sources:

**Source 1 — Customer uploads (passive)**
Every manual upload tagged with industry and content type.
Customer keeps an AI-generated image → positive signal.
Customer regenerates → negative signal with original prompt logged.

**Source 2 — Curated library (active — critical path)**
Admin builds visual library of 1,000+ real photos per industry.
Options: licensed stock (iStock industry packs), partnerships with trades businesses,
commissioned photography sessions. Must be owned or licensed for AI training use.
This is the single biggest timeline driver for Module 2 (PostCore Image).

**Source 3 — Synthetic augmentation**
Once 500+ base images per industry are collected, use NanoBanana to generate
controlled synthetic variations. Human curator reviews and approves each one.
Bootstraps the corpus while awaiting full library build.

### Video data (requires active curation)
Similar to image data but harder to source:

**Source 1 — Customer-published videos (passive, with consent)**
Customers who connect social accounts and opt in to training data collection
contribute their published video content, tagged by industry.

**Source 2 — Licensed footage libraries**
Shutterstock / Getty have extensive trades video libraries available for licensing.
Target: 500 clips per industry, 10–30 seconds each, various styles.

**Source 3 — Synthetic generation**
Animate PostCore Image outputs using base AnimateDiff model.
Short loops (5-second), industry-tagged. Scales cheaply once image library exists.

---

## PHASED ROLLOUT PLAN

```
Phase 0 — Foundation (Now → Month 6)
  ✓ Text training data collecting passively (already live)
  ✓ Admin panel tracking corpus growth (already built)
  → Build image visual library (active task — start now)
  → Tag customer uploads by industry and content type

Phase 1 — PostCore Text (Month 6–12)
  → Gate 1: 10,000 text training examples
  → Train Llama 3.1 8B with LoRA on caption data
  → A/B test at 10% traffic
  → Gates pass → gradually replace Claude for caption generation
  → Claude remains for complex reasoning, new industries, safety fallback

Phase 2 — PostCore Avatar (Month 12–18)
  → Simpler than full video — achievable with open source LatentSync
  → Train on 5–8 avatar archetypes (diverse, trades-appropriate presenters)
  → A/B test: PostCore Avatar vs HeyGen for talking-head posts
  → Gates pass → replace HeyGen for standard avatar videos
  → HeyGen retained as premium/fallback option

Phase 3 — PostCore Image (Month 6–12, runs in parallel with Text)
  → Synthetic corpus: Admin generates 10,000 NanoBanana images across 10 industries (Month 1–2)
  → Human curator approves corpus, tags industry + content type
  → Fine-tune FLUX.1-dev with DreamBooth + LoRA on approved corpus
  → A/B test: PostCore Image vs NanoBanana — customer keep/regenerate rate
  → Gates pass → replace NanoBanana/Gemini for image generation
  → Real customer uploads progressively replace synthetic data each retraining cycle

Phase 4 — PostCore Video (Month 20–30)
  → Most complex — requires video corpus + compute
  → Fine-tune CogVideoX on short-form trades video corpus
  → A/B test: PostCore Video vs Veo/Runway
  → Gates pass → replace entire Veo → Runway → Pika cascade
  → External video APIs retired (largest cost saving)
```

---

## QUALITY GATES BY MODULE

Every module must pass all three gates before any customer traffic routes to it:

### Gate 1 — Corpus size (per module)
| Module               | Minimum corpus          | Ideal corpus          |
|----------------------|-------------------------|-----------------------|
| PostCore Text        | 10,000 wizard sessions  | 50,000+ sessions      |
| PostCore Image       | 1,000 images/industry   | 5,000+ images/industry|
| PostCore Video       | 500 clips/industry      | 2,000+ clips/industry |
| PostCore Avatar      | 50 hours driving video  | 200+ hours            |

### Gate 2 — Automated quality threshold (per module)
**Text:** BLEU ≥ 0.40, format compliance 99.9%, no forbidden words, engagement question 100%

**Image:** FID (Fréchet Inception Distance) ≤ 50 on trades test set,
CLIP score ≥ 0.28 (prompt alignment), no hallucinated tools or safety hazards visible,
resolution and aspect ratio compliance 100%

**Video:** FVD (Fréchet Video Distance) ≤ 300 on trades test set,
temporal consistency score ≥ 0.85 (no flickering or incoherent motion),
vertical format compliance 100%, duration accuracy ±2 seconds

**Avatar:** Lip sync accuracy ≥ 0.85 (LSE-D metric), natural blink and head motion,
no uncanny valley artifacts in 95%+ of frames

### Gate 3 — Live A/B test win (per module)
14-day minimum test window at 10% traffic.
Module wins if: customer keep rate ≥ current third-party keep rate.
Module fails if: edit rate, regeneration rate, or complaint rate exceeds baseline.

---

## DATABASE SCHEMA (FULL SYSTEM)

```sql
-- Text training (passive, already collecting)
CREATE TABLE IF NOT EXISTS post_training_data (
  id                 SERIAL PRIMARY KEY,
  post_id            INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  input_payload      JSONB NOT NULL,          -- anonymized wizard context
  output_payload     JSONB NOT NULL,          -- 3 variations generated
  variation_selected CHAR(1),                 -- 'a', 'b', 'c' or null (regenerated)
  was_edited         BOOLEAN DEFAULT FALSE,
  edit_distance      INTEGER,
  post_reach         INTEGER,
  post_engagement    INTEGER,
  quality_score      NUMERIC(3,1),
  model_used         VARCHAR(50) DEFAULT 'claude-sonnet-4-6',
  created_at         TIMESTAMP DEFAULT NOW()
);

-- Image training data registry
CREATE TABLE IF NOT EXISTS image_training_data (
  id                 SERIAL PRIMARY KEY,
  file_url           TEXT NOT NULL,
  cloudinary_id      VARCHAR(500),
  industry           VARCHAR(50) NOT NULL,
  content_type       VARCHAR(50),             -- job_site, before_after, team, seasonal
  prompt_used        TEXT,                    -- if AI-generated, what prompt made this
  source             VARCHAR(50),             -- 'customer_upload', 'curated', 'synthetic'
  quality_score      NUMERIC(3,1),           -- human curator score 1.0-5.0
  is_approved        BOOLEAN DEFAULT FALSE,   -- must pass human review before training
  was_kept           BOOLEAN,                 -- customer kept (true) or regenerated (false/null)
  annotated_by       VARCHAR(100),
  created_at         TIMESTAMP DEFAULT NOW()
);

-- Video training data registry
CREATE TABLE IF NOT EXISTS video_training_data (
  id                 SERIAL PRIMARY KEY,
  file_url           TEXT NOT NULL,
  cloudinary_id      VARCHAR(500),
  industry           VARCHAR(50) NOT NULL,
  content_type       VARCHAR(50),
  duration_seconds   NUMERIC(5,1),
  aspect_ratio       VARCHAR(10),             -- '9:16', '16:9', '1:1'
  source             VARCHAR(50),             -- 'customer_publish', 'licensed', 'synthetic'
  quality_score      NUMERIC(3,1),
  is_approved        BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMP DEFAULT NOW()
);

-- Model version registry (all modalities)
CREATE TABLE IF NOT EXISTS llm_model_versions (
  id                 SERIAL PRIMARY KEY,
  version_name       VARCHAR(100) NOT NULL,
  modality           VARCHAR(20) NOT NULL,    -- 'text', 'image', 'video', 'avatar'
  base_model         VARCHAR(100) NOT NULL,
  weights_url        TEXT,
  replicate_model_id TEXT,
  training_examples  INTEGER,
  eval_score         NUMERIC(6,3),           -- BLEU / FID / FVD / LSE-D depending on modality
  eval_human_score   NUMERIC(3,1),
  status             VARCHAR(30) DEFAULT 'training',
  traffic_pct        INTEGER DEFAULT 0,
  trained_at         TIMESTAMP,
  promoted_at        TIMESTAMP,
  created_at         TIMESTAMP DEFAULT NOW()
);

-- A/B experiment log (all modalities)
CREATE TABLE IF NOT EXISTS llm_ab_experiments (
  id                   SERIAL PRIMARY KEY,
  model_version_id     INTEGER REFERENCES llm_model_versions(id),
  modality             VARCHAR(20) NOT NULL,
  started_at           TIMESTAMP DEFAULT NOW(),
  ended_at             TIMESTAMP,
  traffic_pct          INTEGER,
  calls_total          INTEGER DEFAULT 0,
  keep_rate            NUMERIC(4,3),          -- % outputs kept (not regenerated)
  edit_rate            NUMERIC(4,3),
  avg_reach            NUMERIC(10,2),
  result               VARCHAR(20),
  notes                TEXT
);

-- Human-curated gold examples (text)
CREATE TABLE IF NOT EXISTS llm_curated_examples (
  id             SERIAL PRIMARY KEY,
  industry       VARCHAR(50) NOT NULL,
  content_type   VARCHAR(50) NOT NULL,
  input_payload  JSONB NOT NULL,
  ideal_output   JSONB NOT NULL,
  quality_score  NUMERIC(3,1) NOT NULL,
  annotated_by   VARCHAR(100),
  created_at     TIMESTAMP DEFAULT NOW()
);
```

---

## ADMIN LLM PANEL — `/admin/llm`

Access: Admin only. Not visible to customers until production launch.
Navigation: Admin sidebar → PostCore Brain (IpSparkle icon).

The panel covers all four modules. Each module has its own status, corpus progress,
and A/B test controls. The overview tab shows the full picture at a glance.

### Tab 1 — Overview
System-wide status: all four modules, corpus progress, active traffic routing.
```
PostCore Text     ████████░░░░░ 28% (2,847 / 10,000 examples)   Status: Collecting
PostCore Image    ███░░░░░░░░░░ 12% (118 / 1,000 img/industry)  Status: Building library
PostCore Video    █░░░░░░░░░░░░  4% (22 / 500 clips/industry)   Status: Building library
PostCore Avatar   ░░░░░░░░░░░░░  0% (awaiting Phase 2)          Status: Planned

Current traffic routing:
  Claude Sonnet:    100% of text calls
  NanoBanana:       100% of image calls
  Veo/Runway/Pika:  100% of video calls
  HeyGen:           100% of avatar calls
```

### Tab 2 — Training Data
Four sub-tabs, one per modality.
Text: wizard session records with variation picked, edit rate, reach.
Image: curated library with thumbnails, industry tags, quality scores, approval status.
Video: clip registry with thumbnails, duration, source, approval status.
Avatar: driving video hours collected per avatar archetype.
Each sub-tab shows corpus progress toward Gate 1 threshold.

### Tab 3 — Model Versions
Full registry of all trained models across all modalities.
Shows: version name, modality, base model, training examples, eval scores, status, traffic %.
"Start training run" unlocks per modality when that modality's Gate 1 passes.

### Tab 4 — A/B Testing
Active and historical experiments across all modalities.
Create experiment: select modality, select model version, set traffic split.
Live stats: keep rate, edit rate, reach, calls routed per model.
Promote or rollback with a single click. Emergency rollback to all third-party tools
always available — one button resets all traffic to external providers instantly.

### Tab 5 — Quality Monitor
Real-time quality dashboard per modality.
Text: selection rate, edit rate, regeneration rate, latency.
Image: keep rate, regeneration rate, generation time.
Video: keep rate, render time, error rate.
Quality trend charts over 30 days. Alert configuration per modality.

### Tab 6 — Curated Examples
Text gold examples (human-written ideal captions per industry).
Image approval queue (curated photos awaiting admin approval for training corpus).
Video approval queue (licensed or customer-contributed clips awaiting review).
Bulk approve/reject, quality scoring, industry re-tagging.

---

## INFRASTRUCTURE PLAN

### Phase 0–1 (Text module)
- Training: RunPod A100 80GB × 2 — ~$200 per LoRA fine-tune run
- Serving: Replicate or Modal serverless — ~$0.005 per text call
- Storage: HuggingFace private + S3 — ~$20/month

### Phase 2 (Avatar module)
- Training: RunPod A100 — ~$100 per run (simpler than text)
- Serving: Modal GPU — ~$0.02 per 30-second avatar video
- Saves: ~$0.98 per video vs HeyGen

### Phase 3 (Image module)
- Training: RunPod A100 80GB — ~$300–500 per DreamBooth fine-tune run
- Serving: Modal / Replicate — ~$0.002 per image
- Saves: ~$0.018 per image vs NanoBanana (at volume, $1,800/100K images)

### Phase 4 (Video module) — most compute-intensive
- Training: 8× A100 80GB cluster, ~$2,000 per fine-tune run
- Serving: Modal A10G GPU pool — ~$0.05 per 10-second clip
- Saves: ~$0.45 per video vs Veo/Runway (at volume, $45,000/100K videos)

### Total annual cost advantage at scale (100K monthly active users)
```
PostCore Text:   Saves ~$90,000/year vs all-Claude
PostCore Image:  Saves ~$216,000/year vs NanoBanana
PostCore Video:  Saves ~$540,000/year vs Veo/Runway/Pika
PostCore Avatar: Saves ~$120,000/year vs HeyGen
──────────────────────────────────────────
Total:           ~$966,000/year saved → reinvested into product and growth
```

---

## WHY THE NICHE MAKES THIS POSSIBLE

**The single most important strategic insight:**

Building a general-purpose image model requires generating everything.
Building PostCore Image requires generating ten things, really well.

A plumber's social media post needs one of these:
- Water heater being replaced (before: rusted, after: new and clean)
- Under-sink repair (before: leak, after: new pipes)
- Frozen pipe situation in winter
- Emergency flood cleanup
- Happy customer holding a business card

That's it. Five visual categories for plumbing. Ten industries × five categories = 50 visual types
total. A fine-tuned model trained on 50,000 images spread across these 50 types will
produce more accurate, more authentic, more relevant results than any general-purpose
model generating a plumbing post from a cold start.

The same logic applies to video. A roofing job video looks like a roofing job video.
A trained model that has seen 5,000 of them will generate one that looks real.
Veo 3 has seen everything but specializes in nothing.

**This is the competitive moat that cannot be replicated:**
Our model gets better at serving local trades businesses specifically.
Every competitor using general-purpose APIs gets worse at the niche as those
APIs chase generality. PostCore Brain gets more specialized over time.
The gap between PostCore and a generic tool widens with every customer interaction.

---

## RISKS AND MITIGATIONS

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Image visual library build takes too long | High | Medium | Synthetic augmentation from NanoBanana fills gap; licensed stock as bridge |
| Video fine-tune quality insufficient | Medium | Medium | AnimateDiff image-to-video as simpler fallback; external APIs retained until proven |
| Compute costs for video training exceed plan | Medium | Medium | Monthly re-evaluation; train video module only after text + image proven profitable |
| Customer opts out of training data at scale | Low | Medium | Curated examples + licensed data fill gap; model still trains from aggregate anonymous data |
| Open-source base model quality gap vs commercial | Medium | Medium | Fine-tuning on niche data typically closes 80%+ of quality gap for narrow domains |
| FLUX.1 / CogVideoX licensing changes | Low | High | Multiple Apache/MIT alternatives maintained as drop-in replacements |
| Data breach of visual training corpus | Low | High | Encrypted S3; anonymization; no customer PII in image/video metadata |

---

## TIMELINE SUMMARY

| Module | Phase | Start | Production | Third-party retired |
|--------|-------|-------|------------|---------------------|
| PostCore Text | Phase 1 | Month 6 | Month 10–12 | Claude → fallback only |
| PostCore Image | Phase 3* | Month 1–2 (corpus) | Month 10–12 | NanoBanana retired |
| PostCore Avatar | Phase 2 | Month 12 | Month 15–18 | HeyGen retired |
| PostCore Video | Phase 4 | Month 20 | Month 24–28 | Veo/Runway/Pika retired |

*PostCore Image corpus build starts immediately (Month 1–2) using NanoBanana to generate
synthetic training data. No external photo sourcing required to begin. Text and Image
modules train in parallel — both can reach production around Month 10–12.

No fixed calendar dates. Each module unlocks when its three quality gates pass.
Timeline estimates assume steady customer growth (training data accumulation rate
scales with active users — faster growth = faster training).

---

## PRIVACY AND ETHICS CHARTER

1. **Opt-out respected immediately.** Customers who disable training consent are
   excluded from all training sets and retroactively removed within 24 hours.
2. **Text anonymization.** No business names, owner names, phone numbers, or addresses
   in any text training record.
3. **Image privacy.** Customer-uploaded photos used for training only after explicit
   opt-in and only for images the customer has already published publicly.
4. **No private communications.** DM conversations, contact lists, and inbox data
   never enter any training pipeline under any circumstances.
5. **Transparency.** Every post, image, and video record logs which model (third-party
   or PostCore) produced it. Full audit trail forever.
6. **Human review gate.** All curated training examples reviewed by a human before
   training inclusion. Automated quality filters catch obvious issues first.
7. **No competitor data.** We do not train on scraped third-party content without
   explicit written opt-in from the originating business.

---

## SUCCESS METRICS

### 6-month target (corpus foundations laid):
- Text training examples: 10,000+ wizard sessions collected passively
- Image synthetic corpus: 10,000 NanoBanana-generated images approved and tagged
- Both Text and Image modules in first fine-tune run
- Admin panel showing live progress across all four modules

### 12-month target (Text + Image in production):
- PostCore Text handling 50%+ of all caption generation (Claude → fallback only)
- PostCore Image replacing NanoBanana for standard image generation
- Both models continuously improving as real customer data replaces synthetic training data
- Combined annual AI cost savings: $306,000+ vs all third-party

### 18-month target (Text + Image + Avatar in production):
- PostCore Text at 80%+ of caption generation
- PostCore Image at 80%+ of image generation, training now dominated by real customer photos
- PostCore Avatar replacing HeyGen for standard talking-head videos
- Video corpus building actively
- Combined annual AI cost savings: $426,000+ vs all third-party

### 24-month target (Text + Image + Avatar + Video in production):
- PostCore Video replacing Veo / Runway / Pika entire cascade
- Zero dependency on Claude, NanoBanana, HeyGen, or Veo for standard workload
- All four PostCore modules continuously self-improving from live customer interactions
- Combined annual AI cost savings: $966,000+ vs all third-party at scale

### 30-month target (All four modules in production):
- PostCore Video replacing Veo / Runway / Pika entire cascade
- All four modalities running on PostCore Brain
- Combined annual AI cost savings: $966,000+ vs all third-party at scale
- Every post, image, and video generated with models that have seen thousands of
  real local trades jobs — quality no general-purpose competitor can match

---

*This document is the single source of truth for ItsPosting's AI model strategy.*
*PostCore Brain covers all four modalities: text, image, video, and avatar.*
*Every third-party integration runs unchanged until its PostCore replacement earns its traffic share.*
*No module goes live without passing all three quality gates and winning an A/B test.*
*Reviewed quarterly by Engineering and Product leadership.*
*Do not discuss specific training data collection with customers without Legal review.*
