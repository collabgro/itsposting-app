# ItsPosting — PostCore Brain
# Proprietary AI System: Architecture, Training, Deployment, Admin
# Classification: Engineering + Product Leadership
# Last updated: May 2026 (v2.0)

---

## WHAT IS POSTCORE BRAIN?

PostCore Brain is ItsPosting's custom fine-tuned language model — a domain-specific AI trained exclusively on local service business social media content. It is the product moat that will eventually replace 80% of Claude API calls for caption and hashtag generation, reducing per-generation cost from ~$0.012 to ~$0.0002 (60× cheaper) while producing output that is MORE relevant because it is trained entirely on real-world trade business posts.

**PostCore Brain is NOT:**
- A general-purpose AI (it will not write essays or answer trivia)
- A replacement for Claude on complex tasks (image prompts, content planning, wizard orchestration still use Claude)
- A chatbot (it generates structured JSON output only)

**PostCore Brain IS:**
- A caption/hashtag generator that speaks fluent "plumber" and "roofer"
- A fine-tuned version of Llama 3.1 8B Instruct (MIT license — free to run)
- Trained on real customer wizard generations + curated gold examples
- Deployed on RunPod A100 at inference time (~150ms latency target)

---

## CURRENT STATUS

```
Phase:           PRE-TRAINING (data collection)
Model in prod:   claude-sonnet-4-6 (100% of traffic)
Training data:   Collecting passively via wizard generations
Threshold:       10,000 examples needed for first training run
Admin UI:        /admin/llm (live — training data, model versions, A/B, quality)
DB tables:       llm_training_examples, llm_model_versions, llm_ab_experiments, llm_curated_examples
```

---

## ARCHITECTURE

### System overview

```
Customer uses Wizard
        ↓
backend/routes/wizard.js
        ↓
ClaudeService.js (today) ──→ stores training example in llm_training_examples
        ↓                              (industry, content_type, prompt, output, model_used)
Customer selects variation A/B/C ──→ updates variation_selected
        ↓
Customer edits caption ──→ updates was_edited + final_caption
        ↓
Post goes live ──→ MetricsSyncService pulls reach/engagement
        ↓                              updates post_reach, post_engagement in llm_training_examples
        ↓
[In future] PostCoreBrain.js (20% A/B traffic) ──→ compare quality vs Claude
        ↓
[When winner] PostCoreBrain.js (100% of traffic)
```

### Training data schema

```sql
llm_training_examples (
  id                  SERIAL PRIMARY KEY,
  customer_id         INTEGER REFERENCES customers(id),
  session_id          UUID,                    -- wizard session
  industry            VARCHAR(50),             -- plumbing, hvac, roofing, etc.
  content_type        VARCHAR(50),             -- job_finished, tip, testimonial, etc.
  platform            VARCHAR(20),             -- facebook, instagram, google_business, all
  tone                VARCHAR(30),             -- professional, friendly, casual, etc.
  wizard_inputs       JSONB,                   -- what the customer entered in the wizard
  system_prompt       TEXT,                    -- the full 6-section system prompt sent to Claude
  raw_ai_output       JSONB,                   -- Claude's raw JSON response (variations A/B/C)
  variation_selected  CHAR(1),                 -- 'a', 'b', 'c', or NULL if skipped
  final_caption       TEXT,                    -- after customer edits (if any)
  was_edited          BOOLEAN DEFAULT FALSE,   -- did the customer edit the caption?
  post_reach          INTEGER,                 -- from MetricsSync after posting
  post_engagement     INTEGER,                 -- likes + comments + shares
  quality_score       NUMERIC(3,1),            -- 1.0–5.0, from curator (NULL = auto)
  model_used          VARCHAR(60),             -- 'claude-sonnet-4-6' today
  inference_ms        INTEGER,                 -- how long the generation took
  created_at          TIMESTAMP DEFAULT NOW()
)
```

### Model versions schema

```sql
llm_model_versions (
  id                  SERIAL PRIMARY KEY,
  version_name        VARCHAR(60),             -- 'postcore-v0.1-llama-8b-lora'
  base_model          VARCHAR(80),             -- 'meta-llama/Llama-3.1-8B-Instruct'
  fine_tuning_method  VARCHAR(30),             -- 'lora-r16'
  training_examples   INTEGER,
  eval_bleu           NUMERIC(5,3),
  eval_human_score    NUMERIC(3,1),
  trained_at          TIMESTAMP,
  runpod_job_id       VARCHAR(100),
  huggingface_repo    VARCHAR(200),
  status              VARCHAR(20),             -- 'staging', 'production', 'retired'
  traffic_pct         INTEGER DEFAULT 0,       -- % of wizard traffic routed to this model
  notes               TEXT,
  created_at          TIMESTAMP DEFAULT NOW()
)
```

---

## TRAINING DATA STRATEGY

### Sources (ranked by value)

1. **Wizard generations** (automated, continuous)
   - Every wizard generation → logged in `llm_training_examples`
   - With variation_selected + was_edited = high-signal training example
   - Post reach/engagement added asynchronously by MetricsSyncService
   - Target: 20 new examples/day at 20 active customers

2. **Curated gold examples** (manual, one-time)
   - 200 hand-crafted "perfect" posts per industry × 10 industries = 2,000 examples
   - These are the quality anchors for fine-tuning
   - Added via Admin → PostCore Brain → Curated Examples tab
   - Quality score: 5.0 (perfect)
   - These are 10× more valuable than automated examples

3. **Customer-rated posts** (future)
   - After posting, customer can rate: "This post did great" / "Not my style"
   - Converts implicit signal (engagement) to explicit signal
   - Target: 10% opt-in rate on ratings

### Quality signals (used in training weighting)

| Signal | Weight | Source |
|---|---|---|
| Customer selected variation | 3× | variation_selected |
| Customer used without editing | 2× | was_edited = false |
| Post got high reach (top 25%) | 2× | post_reach vs industry benchmark |
| Curator rated ≥ 4 | 5× | quality_score |
| Post was edited heavily | 0.5× | was_edited = true |
| Post was never published | 0.25× | post.status never = 'published' |

### Data balance targets

```
Per-industry:    equal distribution (currently plumbing/hvac will be over-represented)
Per-platform:    70% Facebook+Instagram, 20% Google, 10% LinkedIn
Per-content-type: 30% educational, 25% job_finished, 20% testimonial, 15% seasonal, 10% other
Per-tone:        match real distribution from customer wizard selections
```

---

## FINE-TUNING PLAN

### Base model: Llama 3.1 8B Instruct

**Why Llama 3.1 8B:**
- MIT license — zero royalties, own the fine-tuned weights
- 8B parameter sweet spot — fast inference (~150ms on A100), quality matches GPT-3.5
- Meta's instruction tuning = already good at following structured output formats
- Community support — easy to fine-tune with LoRA/QLoRA

**Why NOT:**
- GPT-4o fine-tune: $25/1M tokens + OpenAI owns the model
- Claude fine-tune: Not available via API
- Llama 3.1 70B: Too slow for real-time inference (~800ms on A100)

### Fine-tuning method: LoRA (rank 16)

```python
# LoRA configuration
lora_config = LoraConfig(
    r=16,                    # rank — balances quality vs parameter count
    lora_alpha=32,           # scaling factor
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
    lora_dropout=0.05,
    task_type="CAUSAL_LM",
)
```

### Training infrastructure

```
Platform:    RunPod (GPU cloud)
GPU:         A100 80GB (single node for first run)
Cost:        ~$3.20/hour × ~60 hours = ~$192 per training run
Frequency:   Monthly (when new data batch ready)
Output:      HuggingFace private repo — pushed after training
Inference:   RunPod serverless endpoint OR local vLLM server
```

### Input/output format for fine-tuning

```json
{
  "instruction": "You are PostCore, ItsPosting's AI advisor for local trade businesses. Generate 3 social media caption variations for a plumbing business in Houston, TX. Content type: job_finished. Tone: friendly. Platform: facebook.",
  "input": "A customer had a burst pipe emergency. We arrived in 45 minutes and replaced the main line. Customer left a 5-star review.",
  "output": {
    "variation_a": {
      "caption": "🔧 Emergency response in 45 minutes — that's the Mike's Plumbing promise...",
      "hashtags": ["#HoustonPlumber", "#EmergencyPlumbing", "#HoustonHomeowner"],
      "engagementQuestion": "Have you ever had a plumbing emergency? What happened?"
    },
    "variation_b": { "..." },
    "variation_c": { "..." }
  }
}
```

### Threshold roadmap

| Examples | Milestone | Action |
|---|---|---|
| 2,000 | First curated batch complete | Review example quality, add gap industries |
| 5,000 | Early checkpoint | Run eval-only training run; benchmark vs Claude |
| 10,000 | **First real training run** | Train v0.1; A/B test at 5% traffic |
| 25,000 | V0.2 training run | Improve industry balance; A/B at 20% |
| 100,000 | V1.0 | Full production deployment at 80% of wizard traffic |

---

## DEPLOYMENT ROADMAP

### Phase 1: Data Collection (NOW → 10k examples)
- `llm_training_examples` table collecting passively from every wizard use
- Curated examples being added manually by the team
- No model trained yet; 100% Claude traffic
- Admin UI live at `/admin/llm` for monitoring progress

### Phase 2: First Training Run (10k examples)
```
1. Export training data to JSONL from DB
2. Upload to RunPod storage
3. Run QLoRA fine-tune on A100 (~60 hours)
4. Evaluate: BLEU score, human eval (10 random samples rated 1-5)
5. Upload weights to HuggingFace private repo
6. Deploy to RunPod serverless endpoint
7. Add PostCoreBrainService.js to backend/services/
```

### Phase 3: A/B Testing (v0.1 deployed, 5% traffic)
```javascript
// In wizard.js generate endpoint:
const usePostCore = Math.random() < (MODEL_TRAFFIC_PCT / 100);
const result = usePostCore
  ? await postCoreBrain.generate(params)   // PostCoreBrainService.js
  : await ClaudeService.generateCaptions(params);  // existing

// Log which model was used in llm_training_examples.model_used
// Track: user_selection_rate, edit_rate, avg_reach per model
```

### Phase 4: Scale-up (50% → 100% traffic)
- A/B test shows PostCore Brain wins on edit rate + reach → scale to 50%
- If no regression after 30 days → scale to 100% for caption generation
- Keep Claude for: image prompts, wizard orchestration, weekly briefings

### PostCoreBrainService.js (to be created at 10k examples)

```javascript
// backend/services/PostCoreBrainService.js
const axios = require('axios');

const ENDPOINT = process.env.POSTCORE_BRAIN_ENDPOINT; // RunPod serverless URL
const API_KEY  = process.env.POSTCORE_BRAIN_API_KEY;

async function generate({ industry, contentType, platform, tone, details, customer }) {
  if (!ENDPOINT) throw new Error('PostCore Brain endpoint not configured');

  const prompt = buildPrompt({ industry, contentType, platform, tone, details, customer });
  const response = await axios.post(ENDPOINT, {
    prompt,
    max_tokens: 1024,
    temperature: 0.7,
    top_p: 0.9,
  }, {
    headers: { Authorization: `Bearer ${API_KEY}` },
    timeout: 10000,
  });

  return JSON.parse(response.data.text.replace(/```json|```/g, '').trim());
}

module.exports = { generate };
```

---

## QUALITY MONITORING

### Key metrics (tracked in `llm_ab_experiments`)

| Metric | Target (v0.1) | Target (v1.0) |
|---|---|---|
| User edit rate | < 30% | < 15% |
| Variation A selection (always pick A) | < 40% (means A/B/C are balanced) | balanced |
| Regeneration rate | < 20% | < 10% |
| Avg post reach vs Claude baseline | ≥ 90% | ≥ 105% |
| Inference latency p50 | < 300ms | < 150ms |
| Format errors (invalid JSON) | < 1% | < 0.1% |

### Automatic rollback triggers
If any of these are detected in production within 24h:
- Format error rate > 5%
- User edit rate > 50% (double the Claude baseline)
- Inference latency p99 > 2,000ms
- Error rate (HTTP 5xx) > 2%

Action: Revert MODEL_TRAFFIC_PCT to 0, alert admin, investigate.

---

## ADMIN INTERFACE GUIDE (/admin/llm)

The `/admin/llm` page is fully live. Only admin accounts can access it.

### Tab 1: Overview
- Training data progress bar (toward 10,000 threshold)
- Stat cards: total examples, with selection, with reach data, avg quality
- By-industry bar chart (balance visualization)
- Current model configuration (which model handles what % of traffic)

### Tab 2: Training Data
- Table of all training examples
- Columns: industry, content type, variation selected, edited, reach, engagement, quality, model, date
- Paginated, 20 per page

### Tab 3: Model Versions
- All trained PostCore Brain versions
- Shows: version name, base model, training examples, BLEU score, human score, traffic %
- When no models exist: shows the planned base model + training requirements

### Tab 4: A/B Testing
- Active and past experiments
- Shows: calls total, selection rate, edit rate, avg reach per experiment
- "New experiment" button (enabled when a model is in staging)

### Tab 5: Quality Monitor
- Live metrics: PostCore calls, Claude calls, edit rate, regen rate
- Warning banner when quality monitoring is not yet active

### Tab 6: Curated Examples
- Gold standard examples added by the team
- "Add example" button to contribute hand-crafted posts
- Displayed with star ratings and industry/type labels

---

## MULTI-MODAL FUTURE (Post v1.0)

Once PostCore Brain is handling text generation at 80% of traffic, expand to:

1. **PostCore Vision** — Fine-tuned CLIP/BLIP model that rates image quality and relevance for a given trade industry. Input: generated image + industry + content type → Output: quality score 0–100. Use to auto-reject bad images before showing to customer.

2. **PostCore Prompt** — Fine-tuned image prompt generator. Instead of Claude generating NanoBanana prompts, a smaller model does it. Trained on: NanoBanana prompts → resulting image quality (from PostCore Vision score).

3. **PostCore Voice** — ElevenLabs fine-tune with a custom voice for video narration. Consistent PostCore voice across all AI-narrated videos.

4. **PostCore Scheduler** — Optimal posting time predictor. Input: industry + location + platform + content type + historical performance → Output: best time to post in the next 48 hours.

---

## ENVIRONMENT VARIABLES (when PostCore Brain is live)

```bash
POSTCORE_BRAIN_ENDPOINT=https://api.runpod.ai/v2/xxx/runsync  # RunPod serverless
POSTCORE_BRAIN_API_KEY=...                                     # RunPod API key
MODEL_TRAFFIC_PCT=0                                            # 0 = Claude, 5 = 5% A/B test
POSTCORE_BRAIN_VERSION=postcore-v0.1-llama-8b-lora            # Current model version
```

---

## DATA COLLECTION VERIFICATION

To check passive data collection is working:
```sql
-- Run in Railway DB console
SELECT 
  COUNT(*) as total,
  COUNT(variation_selected) as with_selection,
  COUNT(post_reach) as with_reach,
  AVG(quality_score) as avg_quality,
  MAX(created_at) as last_example
FROM llm_training_examples;

-- By industry
SELECT industry, COUNT(*) as count 
FROM llm_training_examples 
GROUP BY industry 
ORDER BY count DESC;
```

Expected output after 1 month of active customers:
- `total` > 100
- `with_selection` > 70% of total
- `last_example` = within last 24h (proving passive collection is live)

---

*PostCore Brain will be the first AI model ever fine-tuned exclusively for local service business social media. When it launches, it will be the competitive moat that no competitor can quickly replicate — you can't buy industry-specific real-world training data from a marketplace.*

*Last updated: May 2026 | Architecture: Abdul Mannan*
