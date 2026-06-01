# ItsPosting — PostCore Brain
# Full Proprietary AI System: Three Models, Zero API Costs
# Classification: Engineering + Product Leadership
# Last updated: May 2026 (v3.0 — Full Multimodal Architecture)

---

## THE VISION

PostCore Brain is three separate proprietary AI models that together replace every
paid AI tool ItsPosting currently uses. Once fully deployed, the cost per post
generation drops from ~$0.05–0.10 (paid APIs) to ~$0.001 (self-hosted compute).

**Why this works for ItsPosting specifically:**
Every competitor building a social media AI is solving a general problem.
ItsPosting is solving a radically narrow one:

- 18 industries (HVAC, Plumbing, Roofing, Electrical, Landscaping, Concrete,
  Painting, Pest Control, General Contractor, Cleaning, Tree Service, Pressure
  Washing, Pool & Spa, Handyman, Flooring, Junk Removal, Solar, Gutter Cleaning)
- 5 platforms (Facebook, Instagram, Google Business, LinkedIn, TikTok)
- 12 months of seasonal context
- 6 content types (job_finished, tip, testimonial, seasonal, promotion, community)
- 5 tones (professional, friendly, funny, educational, urgent)

That narrow scope means:
- A small text model (3B–8B params) can outperform Claude on THIS task
- An image LoRA needs only ~500 images per industry (not millions)
- Videos are predictable enough to cover 90% with open-source tools + FFmpeg

**The 7 paid tools being replaced:**

| Tool | Monthly Cost | Replaced By |
|---|---|---|
| Anthropic Claude API | Per token | PostCore Text |
| NanoBanana (Google Gemini) | ~$0.039/image | PostCore Image |
| Midjourney via Replicate | ~$0.002–0.05/image | PostCore Image |
| HeyGen (avatar video) | $29–89/month | PostCore Video Tier 3 |
| Veo 3.1 Fast (cinematic) | Per video | PostCore Video Tier 2 |
| Runway Gen-4 (fallback) | Per video | PostCore Video Tier 2 |
| Pika 2.2 (fallback) | Per video | PostCore Video Tier 2 |

---

## THE THREE MODELS

```
PostCore Brain
├── PostCore Text    → captions + hashtags + engagement questions
│                      Replaces: Claude API (100% of wizard text generation)
│
├── PostCore Image   → social media images (per-industry visual style)
│                      Replaces: NanoBanana + Midjourney
│
└── PostCore Video   → three-tier video pipeline (all free, open source)
                       Tier 1: FFmpeg slideshow      (replaces: nothing — new capability)
                       Tier 2: LTX-Video animation   (replaces: Veo + Runway + Pika)
                       Tier 3: SadTalker + Kokoro TTS (replaces: HeyGen)
```

---

## POSTCORE TEXT

### What it is
A fine-tuned small language model that generates caption variations, hashtag sets,
and engagement questions for all 18 industries, trained entirely on real ItsPosting
wizard generations + curated gold examples.

### Why a small model can beat Claude here
Claude knows everything. PostCore Text only needs to know:
- "It's January → frozen pipes for plumbers, heating emergency for HVAC, snow
  removal for landscapers, no new landscaping jobs"
- "A roofer in April → storm season, emphasise emergency tarping, insurance claims"
- "Google Business post = no hashtags, location mention, hard CTA with phone number"

A 3B–8B model trained on 50k+ examples of exactly this will outperform a general
175B+ model on this specific narrow task. Domain specificity is the advantage.

### Base model choices (MIT license — free forever)

**Primary: Llama 3.2 3B Instruct**
- 3B parameters: inference runs on CPU (quantized) or any cheap GPU
- MIT license: own the fine-tuned weights, no royalties
- Excellent instruction following after fine-tuning
- ~50ms latency on GPU, ~300ms on CPU (quantized Q4)

**Upgrade path: Llama 3.1 8B Instruct**
- Better quality ceiling, same MIT license
- Requires GPU for production inference
- ~150ms latency on A100

**Alternative: Phi-3.5-mini (3.8B)**
- Microsoft, MIT license
- Surprisingly strong at structured JSON output
- Best option if Llama 3.2 3B quality is insufficient

### Fine-tuning method: QLoRA (Quantized LoRA)

```python
# Configuration — runs on free Kaggle T4 (16GB VRAM) for 3B model
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
)

lora_config = LoraConfig(
    r=32,                          # rank — higher = more capacity, more params
    lora_alpha=64,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj",
                    "gate_proj", "up_proj", "down_proj"],
    lora_dropout=0.05,
    task_type="CAUSAL_LM",
)

# Training args
training_args = TrainingArguments(
    output_dir="./postcore-text-v1",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    learning_rate=2e-4,
    lr_scheduler_type="cosine",
    warmup_ratio=0.05,
    bf16=True,
    save_strategy="epoch",
    logging_steps=50,
)
```

### Training data strategy

**PHASE 0 — Synthetic Harvest (DO THIS FIRST — before cancelling any API)**

Before switching away from Claude, run a one-time batch generation script to
create the initial training dataset. This is the most important step.

```
18 industries
× 12 months
× 6 content types
× 5 tones
× 3 platforms
= 19,440 unique scenarios × 3 variations each
= 58,320 training examples

Cost to generate via Claude: ~$40–80
Value: replaces $300–500/month in ongoing API costs
```

Script: `backend/scripts/harvestTrainingData.js` (to be built)
```javascript
// Systematically generate all industry × month × type × tone combinations
// Store in post_training_data table
// Run once via: node backend/scripts/harvestTrainingData.js
```

**PHASE 1 — Passive collection (already built)**
Every wizard generation → logged in `post_training_data` table.
Variation selected, editing behaviour, and post reach added automatically.

**PHASE 2 — Curated gold examples**
200 hand-crafted "perfect" posts per industry × 18 industries = 3,600 gold examples.
Added via Admin → PostCore Brain → Curated Examples tab.
These are 10× more valuable than automated examples in training.

### Quality signals for training weighting

| Signal | Weight | Source |
|---|---|---|
| Variation selected by customer | 3× | variation_selected column |
| Used without any editing | 2× | was_edited = false |
| Post reach in top 25% for industry | 2× | post_reach vs IndustryBenchmarks |
| Curator rated ≥ 4.5 | 5× | quality_score |
| Post was published | 1.5× | was_published = true |
| Caption was heavily edited | 0.5× | edit_distance > 50% of caption |
| Post was never published | 0.25× | was_published = false |

### Training infrastructure (free first)

```
Tier 1 (FREE): Kaggle
  GPU: 2× T4 (16GB each), 30 hours/week
  Best for: Llama 3.2 3B QLoRA, short runs (~6 hours)
  Cost: $0

Tier 2 (~$20/run): RunPod Spot
  GPU: A100 80GB spot instance (~$0.40–0.80/hr)
  Best for: Llama 3.1 8B full LoRA runs (~20–40 hours)
  Cost: ~$8–32 per full training run

Tier 3 (fallback): Google Colab Pro
  GPU: A100 (with Pro+ plan, $50/month)
  Best for: ad-hoc experiments
```

### Inference (free/cheap)

**Option A: Modal.com (recommended)**
- Serverless GPU — pay per second, no idle cost
- A100 = $0.000164/GPU second
- Llama 3.2 3B inference = ~50ms = $0.000008 per call (essentially free)
- Free $30/month credit (covers ~3.7M inferences)
- Cold start: ~3 seconds (mitigated by keeping warm on active hours)

**Option B: Self-hosted on Railway GPU (when available)**
- Host quantized GGUF model on Railway service
- No per-call cost beyond Railway subscription

**Option C: Hugging Face Inference Endpoints**
- Free tier for small models
- Dedicated endpoint for production

### PostCoreBrainTextService.js (to be built)

```javascript
// backend/services/PostCoreBrainTextService.js
const axios = require('axios');

class PostCoreBrainTextService {
  constructor() {
    this.endpoint = process.env.POSTCORE_TEXT_ENDPOINT;  // Modal.com URL
    this.apiKey   = process.env.POSTCORE_TEXT_API_KEY;
    this.available = !!this.endpoint;
  }

  async generate({ industry, contentType, platform, tone, details, customer, month }) {
    if (!this.available) throw new Error('PostCore Text not configured');

    const prompt = this._buildPrompt({ industry, contentType, platform, tone, details, customer, month });
    const { data } = await axios.post(this.endpoint, {
      prompt,
      max_new_tokens: 1024,
      temperature: 0.75,
      top_p: 0.92,
      repetition_penalty: 1.1,
    }, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      timeout: 8000,
    });

    return JSON.parse(data.generated_text.replace(/```json|```/g, '').trim());
  }

  _buildPrompt({ industry, contentType, platform, tone, details, customer, month }) {
    // Compact prompt — the fine-tuned model already knows the output format
    return `[INDUSTRY:${industry}][MONTH:${month}][TYPE:${contentType}][PLATFORM:${platform}][TONE:${tone}]
Business: ${customer.business_name}, ${customer.location}
Details: ${details}
Generate 3 caption variations (JSON):`;
  }
}

module.exports = PostCoreBrainTextService;
```

---

## POSTCORE IMAGE

### What it is
A set of 18 fine-tuned image generation LoRA adapters — one per industry —
built on top of a free open-source base model. At inference time, the correct
LoRA is loaded based on the customer's industry, producing images that look
visually consistent with real trade business content.

### Why per-industry LoRAs work

A general image model generates generic content. A LoRA trained on 500+
real plumbing photos knows:
- Pipes are usually copper, PVC, or galvanised
- Job site lighting is harsh fluorescent or natural
- The "hero" is the finished fixture, the fixed leak, or the before/after
- Workers wear branded shirts, safety boots, sometimes hard hats

No prompt engineering can teach this as reliably as a LoRA trained on real images.

### Base model: FLUX.1-schnell (Apache 2.0 — free for commercial use)

**Why FLUX.1-schnell:**
- Apache 2.0 license: zero royalties, commercial use, own the fine-tuned weights
- State-of-the-art quality (beats SDXL significantly)
- Fast: 4 steps vs 20–50 for older models → cheaper inference
- Growing LoRA ecosystem (SimpleTuner, Ostris AI Toolkit, kohya_ss)
- Weights: huggingface.co/black-forest-labs/FLUX.1-schnell

**Fallback: Stable Diffusion XL (SDXL — Apache 2.0)**
- Most mature ecosystem, more tutorials, easier to debug
- Lower quality than FLUX but proven
- Use if FLUX tooling is unstable during early development

### The 18 industry LoRAs

```
postcore-image-plumbing.safetensors
postcore-image-hvac.safetensors
postcore-image-roofing.safetensors
postcore-image-electrical.safetensors
postcore-image-landscaping.safetensors
postcore-image-concrete.safetensors
postcore-image-painting.safetensors
postcore-image-pest_control.safetensors
postcore-image-general_contractor.safetensors
postcore-image-cleaning.safetensors
postcore-image-tree_service.safetensors
postcore-image-pressure_washing.safetensors
postcore-image-pool_spa.safetensors
postcore-image-handyman.safetensors
postcore-image-flooring.safetensors
postcore-image-junk_removal.safetensors
postcore-image-solar.safetensors
postcore-image-gutter_cleaning.safetensors
```

At inference: load base FLUX.1-schnell + industry-specific LoRA adapter.
LoRA files are ~50–150MB each. All 18 = ~1–2GB total.

### Training data for images — the harvest strategy

**PHASE 0 — NanoBanana harvest (DO THIS BEFORE CANCELLING)**

Before switching away, systematically generate a training dataset:
```
18 industries
× 6 content types (job_finished, tip, before_after, seasonal, team, equipment)
× 4 seasons
× 5 prompts per combination
= 2,160 images per industry variation = ~3,600 total

Cost via NanoBanana: ~$140 (3,600 × $0.039)
Value: eliminates $300+/month in ongoing image API costs
```

Script: `backend/scripts/harvestImageTrainingData.js` (to be built)

**PHASE 1 — Customer uploads (ongoing)**
Every image customers upload to the media library = potential training data.
Already logged in `image_training_data` table with `was_kept` signal.
These are highest quality — real job photos selected by the business owner.

**PHASE 2 — Free stock photos**
Use free APIs to bulk download labeled images per industry:
- Unsplash API (free, attribution required)
- Pexels API (free, no attribution required for AI training)
- Pixabay API (free)

Search terms per industry:
```javascript
const INDUSTRY_SEARCH_TERMS = {
  plumbing:           ['plumber fixing pipe', 'bathroom renovation', 'plumbing repair', 'water leak fix'],
  hvac:               ['hvac technician', 'air conditioning installation', 'furnace repair', 'duct cleaning'],
  roofing:            ['roofer working', 'roof replacement', 'shingles installation', 'roof repair'],
  electrical:         ['electrician panel', 'electrical wiring', 'outlet installation', 'circuit breaker'],
  landscaping:        ['lawn care', 'garden design', 'mulch installation', 'landscape renovation'],
  concrete:           ['concrete driveway', 'concrete patio', 'foundation work', 'stamped concrete'],
  painting:           ['house painting', 'interior painting', 'painters at work', 'color transformation'],
  pest_control:       ['pest control technician', 'exterminator working', 'termite treatment'],
  general_contractor: ['home renovation', 'construction crew', 'remodeling project', 'contractor work'],
  cleaning:           ['house cleaning', 'maid service', 'commercial cleaning', 'deep clean'],
  tree_service:       ['tree removal', 'tree trimming', 'arborist working', 'stump grinding'],
  pressure_washing:   ['pressure washing driveway', 'power wash house', 'deck cleaning'],
  pool_spa:           ['pool cleaning', 'pool installation', 'spa maintenance', 'pool technician'],
  handyman:           ['handyman repair', 'home fix', 'maintenance work', 'door installation'],
  flooring:           ['floor installation', 'hardwood flooring', 'tile installation', 'carpet laying'],
  junk_removal:       ['junk removal truck', 'debris hauling', 'cleanout service', 'dumpster'],
  solar:              ['solar panel installation', 'solar technician roof', 'solar array'],
  gutter_cleaning:    ['gutter cleaning', 'gutter installation', 'downspout repair', 'leaf removal'],
};
```

**PHASE 3 — Auto-labelling with BLIP-2**
Use BLIP-2 (free, open-source) to auto-caption downloaded images:
```python
# scripts/label_images.py (run locally or on Kaggle free)
from transformers import Blip2Processor, Blip2ForConditionalGeneration
import torch

processor = Blip2Processor.from_pretrained("Salesforce/blip2-opt-2.7b")
model = Blip2ForConditionalGeneration.from_pretrained("Salesforce/blip2-opt-2.7b")

# Generate captions for each image → store as training prompt
```

### Training tools (all free, open source)

**SimpleTuner** (recommended for FLUX.1):
```bash
# github.com/bghira/SimpleTuner
# Train FLUX.1-schnell LoRA for one industry:
python train.py \
  --model_type=flux \
  --model_family=flux \
  --pretrained_model_name=black-forest-labs/FLUX.1-schnell \
  --train_data_dir=./training_data/plumbing \
  --output_dir=./loras/postcore-image-plumbing \
  --max_train_steps=2000 \
  --learning_rate=1e-4 \
  --rank=16 \
  --mixed_precision=bf16
```

### Training infrastructure for images

```
Per LoRA cost estimate (18 LoRAs total):

Kaggle (FREE): T4 16GB
  → SDXL LoRA: works well (~4 hours/LoRA)
  → FLUX.1-schnell: may be too slow, use for experiments

Vast.ai (~$1–3 per LoRA):
  → Spot GPU (RTX 3090 ~$0.15/hr or A100 ~$0.40/hr)
  → FLUX.1-schnell LoRA: ~2 hours = ~$0.30–0.80
  → 18 industries total: ~$5–15

Total image model training cost: ~$5–15 (one-time)
```

### Inference pipeline (replacing NanoBananaService.js)

```
PostCoreImageService.js
        ↓
Load base FLUX.1-schnell (cached in memory)
        +
Load industry LoRA (e.g. postcore-image-plumbing.safetensors)
        ↓
Generate 1080×1350px master image
        ↓
ImageResizer.js (existing — creates FB/IG/GB variants)
        ↓
Cloudinary upload (existing pipeline)
        ↓
Return { url, variants, model: 'postcore-image-v1', provider: 'postcore' }
```

**Inference hosting:**

Option A: **Modal.com** (recommended — serverless, pay per second)
- A100 inference: FLUX.1-schnell + LoRA = ~3–5 seconds/image
- Cost: ~$0.001–0.002 per image vs $0.039 NanoBanana (20–40× cheaper)
- Scale to 0 when no requests (no idle cost)

Option B: **Replicate** (managed, pay per run)
- Can host custom FLUX.1 + LoRA models
- ~$0.003–0.005 per image

Option C: **Self-hosted ComfyUI** on a cheap GPU VPS ($20–50/month flat rate)
- Vast.ai: dedicated RTX 3090 = ~$50/month → unlimited images

### PostCoreBrainImageService.js (to be built)

```javascript
// backend/services/PostCoreBrainImageService.js
const axios = require('axios');
const cloudinary = require('cloudinary').v2;

class PostCoreBrainImageService {
  constructor() {
    this.endpoint = process.env.POSTCORE_IMAGE_ENDPOINT;  // Modal.com URL
    this.apiKey   = process.env.POSTCORE_IMAGE_API_KEY;
    this.available = !!this.endpoint;
  }

  async generateFromPrompt(customer, userPrompt, options = {}) {
    if (!this.available) throw new Error('PostCore Image not configured');

    const industry = customer.industry || 'general_contractor';
    const { data } = await axios.post(this.endpoint, {
      prompt: userPrompt,
      industry_lora: `postcore-image-${industry}`,
      width: 1080,
      height: 1350,
      num_inference_steps: 4,     // FLUX.1-schnell: 4 steps is optimal
      guidance_scale: 0,          // FLUX.1-schnell uses guidance_scale=0
    }, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      timeout: 30000,
    });

    const cloudinaryUrl = await this._uploadToCloudinary(data.image_base64);
    return {
      url: cloudinaryUrl,
      type: 'image',
      model: 'postcore-image-v1',
      provider: 'postcore',
      prompt: userPrompt,
    };
  }

  async _uploadToCloudinary(base64) {
    const result = await cloudinary.uploader.upload(
      `data:image/jpeg;base64,${base64}`,
      { folder: 'postcore-generated', quality: 85 }
    );
    return result.secure_url;
  }
}

module.exports = PostCoreBrainImageService;
```

---

## POSTCORE VIDEO

### What it is
A three-tier pipeline using entirely free, open-source tools that together cover
90%+ of all video content types local service businesses need. No video model
needs to be trained — the open-source models are used as-is, with PostCore Text
generating better scripts and PostCore Image generating better key frames.

### Why 3 tiers

```
90% of local trade business videos fall into one of:

Tier 1 (60% of cases): Slideshow
  "Before and after photos of our last job — swipe to see!"
  → FFmpeg + Sharp (already in codebase) → cost: $0

Tier 2 (25% of cases): Animated still
  "One great photo of our work, subtly animated to look cinematic"
  → LTX-Video (open source) → cost: ~$0.001/video

Tier 3 (15% of cases): Talking head
  "Hi, I'm Mike from Mike's Plumbing — here's a tip for this winter"
  → SadTalker + Kokoro TTS (open source) → cost: ~$0.002/video
```

---

### Tier 1: FFmpeg Slideshow (FREE — already partially built)

No AI required. Takes 3–8 customer photos + caption + music → professional MP4.

**What it produces:**
- Ken Burns effect (slow pan/zoom on each photo)
- Animated text overlay (business name, caption, CTA)
- Background music from royalty-free library
- Platform formats: 9:16 (Reels/TikTok), 1:1 (Instagram grid), 16:9 (YouTube)
- Duration: 15–30 seconds

**Tools:**
- FFmpeg (free, already on Railway)
- Sharp.js (already built — ImageResizer.js)
- royalty-free music: Pixabay Music API (free)

**To build: `backend/services/SlideshowService.js`**

```javascript
// Takes: [imageUrls], caption, businessName, format
// Returns: Cloudinary video URL
// Uses FFmpeg subprocess — already available on Railway
```

---

### Tier 2: Animated Still (Free, open source)

Takes a single key frame image → generates 5–8 second video with cinematic motion.

**Best open-source models:**

**Primary: LTX-Video (Lightricks, Apache 2.0)**
- Text-to-video and image-to-video
- Fast: ~20 seconds on A100 for 5s video
- Good quality for short social clips
- GitHub: Lightricks/LTX-Video
- HuggingFace: Lightricks/LTX-Video

**Fallback 1: AnimateDiff (v3, Apache 2.0)**
- SDXL-native animation — works natively with SDXL base model
- Very controllable motion (pan, zoom, shake, orbit presets)
- GitHub: guoyww/AnimateDiff

**Fallback 2: CogVideoX-2B (THUDM, Apache 2.0)**
- Text-guided video, 2B params
- Good at interpreting detailed text prompts
- GitHub: THUDM/CogVideo

**No fine-tuning needed** — these models are used as-is. The niche advantage comes
from PostCore Text writing better, more specific video prompts for each industry.

**Inference: Modal.com serverless**
```python
# Deployed as Modal endpoint
# Input:  { image_url, prompt, duration_seconds, aspect_ratio }
# Output: { video_url }
# Cost:   ~$0.001–0.003 per video (A100 ~20 seconds)
```

---

### Tier 3: Talking Head (Free, replaces HeyGen completely)

Takes: avatar photo + text script → full talking head video with lip sync.

**Stack:**

**TTS (Text to Speech): Kokoro TTS (Apache 2.0)**
- 82M parameter model — tiny, runs on CPU
- Exceptional quality (rivals ElevenLabs)
- Multiple voices, accent support
- GitHub: hexgrad/Kokoro-82M
- Generates the audio from the video script

**Talking Head: SadTalker (free, open source)**
- Drives a portrait photo with audio → realistic lip sync + head motion
- Works with any clean face photo (avatar photo stored per customer)
- GitHub: OpenTalker/SadTalker
- Generates the talking head video from audio + photo

**Alternative Talking Head: MuseTalk (ByteDance, free)**
- Real-time lip sync synthesis
- Slightly more natural motion than SadTalker
- GitHub: TMElyralab/MuseTalk

**Pipeline:**
```
Customer text script
       ↓
Kokoro TTS → WAV audio file (~1 second)
       ↓
SadTalker (avatar photo + WAV) → raw talking head video (~30 seconds on GPU)
       ↓
FFmpeg: add branded intro/outro, business logo watermark, captions
       ↓
Cloudinary upload → MP4 URL
```

**Avatar management:**
- Each customer selects or uploads an avatar photo (stored in DB)
- One avatar photo = unlimited videos
- No per-video avatar cost (unlike HeyGen)
- Avatar stored as: `customers.avatar_photo_url` (new column needed)

**To build: `backend/services/PostCoreTalkingHeadService.js`**
Wraps Kokoro TTS + SadTalker endpoints on Modal.com.

---

## DATA COLLECTION (ALL THREE MODELS)

All three training tables are live (built May 2026):

```sql
post_training_data     -- caption + hashtag examples (Claude outputs)
image_training_data    -- image generation events (NanoBanana/MJ outputs)
video_training_data    -- video generation events (HeyGen/Veo/Runway/Pika outputs)
```

**Customer feedback signals (captured via POST /api/wizard/feedback):**
- `variation_selected` — which caption variation (A/B/C) did they pick?
- `was_edited` — did they edit the caption before posting?
- `was_published` — did they actually publish the post?
- `media_kept` — did they keep the image/video or regenerate?
- `post_reach` — how many people saw the post? (synced from analytics)

**These signals tell us:**
- Which captions resonated (text training signal)
- Which images customers kept vs regenerated (image quality signal)
- Which video styles got published (video preference signal)

---

## TRAINING DATA STRATEGY — REAL CUSTOMER DATA ONLY

PostCore Brain is trained exclusively on real customer wizard generations.
No synthetic data, no pre-generation scripts, no extra API spend.

**Why real data beats synthetic:**
- Real customers choosing variation B and publishing it to 1,200 people → that's
  a quality label no prompt engineering can replicate
- Variation_selected + was_edited + post_reach = the strongest training signal possible
- Costs $0 extra — data is collected passively from generations already paid for
- Authentic diversity: real businesses, real locations, real situations — not scripted combos

**The passive pipeline (already fully built):**
```
Customer uses wizard (existing flow, no changes)
       ↓
Claude generates captions → post_training_data ✅ (wizard.js)
NanoBanana generates image → image_training_data ✅ (wizard.js)
Video generates → video_training_data ✅ (wizard.js background task)
       ↓
Customer selects variation / keeps image / publishes
       ↓
POST /api/wizard/feedback → writes variation_selected, was_edited,
                             mediaKept, wasPublished back to all 3 tables ✅
       ↓
Post analytics sync → post_reach and post_engagement written back ✅
       ↓
Admin monitors progress at /admin/llm → Overview tab shows all 3 modalities ✅
       ↓
At 10,000 examples → first training run (no extra cost)
```

**Note:** `harvestTrainingData.js` and `harvestImageTrainingData.js` exist in
`backend/scripts/` as optional bootstrap tools but are NOT the primary strategy.

---

## DEPLOYMENT ROADMAP

### Current Status
```
PostCore Text:   PRE-TRAINING — collecting data passively + preparing harvest
PostCore Image:  PRE-TRAINING — collecting data + preparing harvest
PostCore Video:  NOT STARTED — architecture designed, ready to build
Paid APIs:       100% of traffic (Claude, NanoBanana, HeyGen/Veo/Runway/Pika)
```

### Month 1 — Data Harvest + Preparation
```
□ Run harvestTrainingData.js (text: 58k+ examples)
□ Run harvestImageTrainingData.js (image: 2,160 images)
□ Add curated gold examples for all 18 industries (Admin → Curated Examples)
□ Scrape Pexels/Pixabay for additional industry images (~500 per industry)
□ Set up Kaggle notebooks for training experiments
□ Set up Modal.com account (free tier)
□ Set up Vast.ai account for cheap GPU access
```

### Month 2 — PostCore Text v0.1
```
□ Export post_training_data to JSONL training format
□ QLoRA fine-tune Llama 3.2 3B on Kaggle (free)
□ Evaluate: compare 50 outputs vs Claude, rate 1–5
□ If quality ≥ 4.0 average: deploy to Modal.com
□ Build PostCoreBrainTextService.js
□ A/B test at 5% wizard traffic (admin/llm experiments tab)
□ Monitor: edit rate, selection balance, reach vs Claude baseline
```

### Month 3 — PostCore Image v0.1
```
□ Train 18 SDXL/FLUX.1-schnell LoRAs on Vast.ai (~$15 total)
□ Build PostCoreBrainImageService.js
□ Deploy LoRAs + inference endpoint to Modal.com
□ A/B test at 5% image generation traffic
□ Monitor: image keep rate (was_kept), regeneration rate
□ Compare: customer retention of PostCore images vs NanoBanana images
```

### Month 4 — PostCore Video Tier 1 (FFmpeg Slideshow)
```
□ Build SlideshowService.js (FFmpeg + Sharp)
□ Add slideshow option to wizard (new content type: 'slideshow')
□ No AI inference needed — pure FFmpeg
□ Deploy: immediate, zero ongoing cost
□ Measure: does slideshow option increase video content creation?
```

### Month 5 — PostCore Video Tier 2 + 3
```
□ Deploy LTX-Video endpoint on Modal.com
□ Build LTXVideoService.js (replaces VeoService.js, RunwayService.js, PikaService.js)
□ Update VideoService.js to route 'services' video to LTX-Video first
□ Deploy Kokoro TTS + SadTalker endpoint on Modal.com
□ Build PostCoreTalkingHeadService.js (replaces HeyGenService.js)
□ Update VideoService.js to route 'avatar' video to PostCoreTalkingHeadService
□ Add customers.avatar_photo_url column for talking head
```

### Month 6+ — Scale Up, Eliminate Paid API Costs
```
□ PostCore Text: if A/B winning → scale to 50% → 80% traffic
□ PostCore Image: if A/B winning → scale to 50% → 80% traffic
□ PostCore Video: measure quality vs paid providers
□ Cancel: Midjourney subscription (PostCore Image covers it)
□ Cancel: HeyGen subscription (PostCore Talking Head covers it)
□ Reduce: Claude API spend (80% of wizard traffic now free)
□ Reduce: NanoBanana API spend (80% of image traffic now free)
□ Reduce: Veo/Runway/Pika (LTX-Video covers it)
```

---

## INFRASTRUCTURE SUMMARY

### Training (one-time costs)

| Model | Platform | GPU | Cost |
|---|---|---|---|
| PostCore Text (3B QLoRA) | Kaggle | T4 free | $0 |
| PostCore Text (8B QLoRA) | RunPod Spot | A100 | ~$15–25 |
| PostCore Image (18 LoRAs) | Vast.ai | RTX 3090 | ~$5–15 |
| **Total training** | | | **~$20–40** |

### Inference (monthly, at 100 active customers)

| Model | Platform | Rate | Monthly Est. |
|---|---|---|---|
| PostCore Text | Modal.com | ~$0.00001/call | ~$1–3 |
| PostCore Image | Modal.com | ~$0.002/image | ~$10–20 |
| PostCore Video T1 | Railway (FFmpeg) | $0/video | $0 |
| PostCore Video T2 | Modal.com | ~$0.003/video | ~$3–8 |
| PostCore Video T3 | Modal.com | ~$0.005/video | ~$2–5 |
| **Total inference** | | | **~$16–36/month** |

### vs Current paid API costs (100 active customers)
```
Claude API:           ~$80–150/month
NanoBanana:          ~$50–100/month
Midjourney:          ~$30–120/month (subscription)
HeyGen:              ~$29–89/month (subscription)
Veo/Runway/Pika:     ~$30–80/month (pay per use)
Total current:       ~$219–539/month

PostCore Brain total: ~$16–36/month
Monthly savings:      ~$200–500/month
Annual savings:       ~$2,400–6,000/year
```

---

## NEW ENVIRONMENT VARIABLES (when live)

```bash
# PostCore Text
POSTCORE_TEXT_ENDPOINT=        # Modal.com serverless URL
POSTCORE_TEXT_API_KEY=         # Modal.com API key
POSTCORE_TEXT_VERSION=         # e.g. postcore-text-v1-llama3.2-3b
POSTCORE_TEXT_TRAFFIC_PCT=0    # 0–100, % of wizard traffic to route to PostCore

# PostCore Image
POSTCORE_IMAGE_ENDPOINT=       # Modal.com serverless URL
POSTCORE_IMAGE_API_KEY=        # Modal.com API key
POSTCORE_IMAGE_VERSION=        # e.g. postcore-image-v1-flux-schnell
POSTCORE_IMAGE_TRAFFIC_PCT=0   # 0–100

# PostCore Video
POSTCORE_VIDEO_ENDPOINT=       # Modal.com serverless URL (LTX-Video)
POSTCORE_AVATAR_ENDPOINT=      # Modal.com serverless URL (SadTalker + Kokoro)
POSTCORE_VIDEO_API_KEY=        # Modal.com API key
POSTCORE_VIDEO_TRAFFIC_PCT=0   # 0–100

# Fallbacks stay active until PostCore reaches 100%
GOOGLE_AI_API_KEY=             # NanoBanana fallback
ANTHROPIC_API_KEY=             # Claude fallback
HEYGEN_API_KEY=                # HeyGen fallback (until Tier 3 is live)
```

---

## QUALITY GATES — WHEN TO SWITCH TRAFFIC

### PostCore Text: promote when
- Edit rate < 25% (Claude baseline ~35%)
- Variation A selection rate < 40% (balanced A/B/C = model not biased)
- Format error rate < 0.5%
- Human eval avg ≥ 4.0/5.0 (10 random samples per industry)
- Average post reach within 10% of Claude-generated posts

### PostCore Image: promote when
- Image keep rate > 70% (customer didn't hit regenerate)
- Human eval avg ≥ 4.0/5.0 (rate: composition, relevance to industry, quality)
- Generation time < 8 seconds (comparable to NanoBanana)

### PostCore Video: promote when
- Tier 1 (Slideshow): always promote — zero risk, $0 cost
- Tier 2 (LTX-Video): promote when customer keep rate > 65%
- Tier 3 (Talking Head): promote when lip sync quality rated ≥ 4.0/5.0

### Automatic rollback
Any of these → revert to paid APIs immediately:
- Format error rate > 3%
- Inference latency p99 > 15 seconds (image) / 60 seconds (video)
- Customer complaints about quality spike
- API error rate > 2%

---

## ADMIN INTERFACE (/admin/llm)

Tabs: Overview · Training Data · Model Versions · A/B Testing · Quality Monitor · Curated Examples

Overview shows:
- Caption / Image / Video examples collected separately
- Image keep rate + video keep rate
- Provider breakdown (which tools data came from)
- Per-industry distribution (ensure all 18 industries are represented)
- Current traffic % for each PostCore model

---

## THE COMPETITIVE MOAT

When PostCore Brain is fully live:

1. **No competitor can replicate it quickly** — the training data is proprietary.
   58,000+ real wizard generations from real local service businesses + customer
   selection signals = a dataset that doesn't exist anywhere else.

2. **Cost structure is fundamentally different** — at 500 customers, inference
   costs stay at ~$80–180/month while competitors pay $1,000–2,500/month in
   API costs. PostCore Brain is why ItsPosting can price lower OR margin higher.

3. **Quality improves automatically** — every wizard generation is a new training
   example. Every customer selection is a quality signal. The model gets better
   every month without any manual intervention.

4. **Domain specificity is the product** — a roofer using PostCore Brain gets a
   model that has seen 3,000+ roofing posts across all 4 seasons, all 5 platforms,
   trained on which posts got the most engagement. No general AI can match that.

---

*PostCore Brain will be the first AI system ever purpose-built for local service
business social media. Not adapted. Not prompted. Fine-tuned, evaluated, and
deployed — trained on the exact industry, the exact platform, the exact season.*

*Last updated: May 2026 (v3.0) | Architecture: Abdul Mannan*
