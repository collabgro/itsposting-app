/**
 * PostCore Brain — Text Training Data Harvest
 *
 * Generates ~58,000 caption + hashtag training examples across all 18 industries,
 * 12 months, 6 content types, 5 tones, and 3 platforms using the current Claude API.
 *
 * RUN THIS ONCE before cancelling the Claude API subscription.
 * Results are stored in post_training_data and become the fine-tuning dataset
 * for PostCore Text (Llama 3.2 3B / 8B QLoRA).
 *
 * Usage:
 *   cd backend
 *   node scripts/harvestTrainingData.js
 *
 * Options:
 *   --industry=plumbing      Run only one industry (for testing)
 *   --dry-run                Log what would be generated without calling Claude
 *   --resume                 Skip combinations already in DB (default: on)
 *   --concurrency=3          Parallel Claude calls (default: 3, max: 5)
 *
 * Estimated time:  8–14 hours at concurrency 3
 * Estimated cost:  ~$40–80 in Claude API (claude-sonnet-4-6)
 * Output:          ~58,320 rows in post_training_data
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Pool }   = require('pg');
const Anthropic   = require('@anthropic-ai/sdk');
const industryKnowledge = require('../data/industryKnowledge');
const SystemPromptBuilder = require('../services/SystemPromptBuilder');

// ── Config ────────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  'plumbing', 'hvac', 'roofing', 'electrical', 'landscaping', 'concrete',
  'painting', 'pest_control', 'general_contractor', 'cleaning',
  'tree_service', 'pressure_washing', 'pool_spa', 'handyman',
  'flooring', 'junk_removal', 'solar', 'gutter_cleaning',
];

const CONTENT_TYPES = [
  'photo',      // job_finished / before-after
  'static',     // text card — tips, FAQs, education
  'carousel',   // multi-slide educational
  'video',      // cinematic / talking head
];

const WIZARD_TRIGGERS = [
  'finished_job',
  'share_tip',
  'got_review',
  'promotion',
  'seasonal',
  'community',
];

const TONES = [
  'professional',
  'friendly',
  'funny',
  'educational',
  'urgent',
];

const PLATFORMS = [
  'facebook',
  'instagram',
  'google_business',
];

// Synthetic customer profiles — one per industry, realistic but fictional
const SYNTHETIC_CUSTOMERS = {
  plumbing:           { business_name: "Mike's Plumbing",         location: 'Austin, TX',       tone: 'professional' },
  hvac:               { business_name: 'CoolFlow HVAC',           location: 'Phoenix, AZ',      tone: 'friendly'     },
  roofing:            { business_name: 'Peak Roofing Co.',        location: 'Denver, CO',       tone: 'professional' },
  electrical:         { business_name: 'Bright Spark Electric',   location: 'Nashville, TN',    tone: 'educational'  },
  landscaping:        { business_name: 'GreenThumb Landscaping',  location: 'Portland, OR',     tone: 'friendly'     },
  concrete:           { business_name: 'SolidBase Concrete',      location: 'Chicago, IL',      tone: 'professional' },
  painting:           { business_name: 'FreshCoat Painting',      location: 'Seattle, WA',      tone: 'friendly'     },
  pest_control:       { business_name: 'ShieldPest Control',      location: 'Houston, TX',      tone: 'urgent'       },
  general_contractor: { business_name: 'BuildRight Contractors',  location: 'Atlanta, GA',      tone: 'professional' },
  cleaning:           { business_name: 'SparkleClean Services',   location: 'Miami, FL',        tone: 'friendly'     },
  tree_service:       { business_name: 'Canopy Tree Service',     location: 'Charlotte, NC',    tone: 'professional' },
  pressure_washing:   { business_name: 'BlastClean Power Wash',   location: 'Tampa, FL',        tone: 'friendly'     },
  pool_spa:           { business_name: 'ClearWave Pool & Spa',    location: 'Las Vegas, NV',    tone: 'friendly'     },
  handyman:           { business_name: 'FixIt Handyman Services', location: 'Columbus, OH',     tone: 'friendly'     },
  flooring:           { business_name: 'ProFloor Installation',   location: 'Dallas, TX',       tone: 'professional' },
  junk_removal:       { business_name: 'HaulAway Junk Removal',   location: 'San Diego, CA',    tone: 'friendly'     },
  solar:              { business_name: 'SunPower Solar Solutions', location: 'Sacramento, CA',  tone: 'educational'  },
  gutter_cleaning:    { business_name: 'FlowFree Gutter Service', location: 'Pittsburgh, PA',   tone: 'professional' },
};

// Sample details injected into counter-query for each content type
const SAMPLE_DETAILS = {
  finished_job: [
    'Replaced burst pipe under the kitchen sink. Job took 2 hours. Customer was thrilled.',
    'Emergency callout at 11pm. Fixed main line blockage. Back to normal by midnight.',
    'Complete bathroom remodel — new fixtures, tile, vanity. Took 3 days. Stunning result.',
  ],
  share_tip: [
    'Seasonal maintenance tip relevant to this month',
    'Common mistake homeowners make that costs them money',
    'DIY vs professional — when to call an expert',
  ],
  got_review: [
    'Customer left a 5-star review saying we were fast, professional, and fair priced.',
    'Google review: "Best service company I have ever hired. Will use again."',
    'Facebook review praising our team and clean worksite.',
  ],
  promotion: [
    'Spring special — 15% off all services booked this month',
    'Free inspection with any service call this week only',
    'Refer a friend and both get $50 off next service',
  ],
  seasonal: [
    'Seasonal content relevant to this industry and month',
    'Weather-driven urgency for this time of year',
    'Pre-season preparation advice for homeowners',
  ],
  community: [
    'Sponsored local school fundraiser last weekend',
    'Team volunteered at the neighbourhood cleanup event',
    'Proud sponsor of the local youth sports team',
  ],
};

// ── Args parsing ──────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, v] = a.slice(2).split('=');
      return [k, v === undefined ? true : v];
    })
);

const DRY_RUN     = !!args['dry-run'];
const RESUME      = args['resume'] !== 'false';  // default on
const CONCURRENCY = Math.min(5, parseInt(args['concurrency'] || '3', 10));
const ONLY_INDUSTRY = args['industry'] || null;

const INDUSTRIES_TO_RUN = ONLY_INDUSTRY
  ? INDUSTRIES.filter(i => i === ONLY_INDUSTRY)
  : INDUSTRIES;

// ── DB + Claude ───────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/** Build a synthetic customer object for prompt generation */
function buildSyntheticCustomer(industry, month) {
  const base = SYNTHETIC_CUSTOMERS[industry] || SYNTHETIC_CUSTOMERS.general_contractor;
  return {
    id: 0,
    industry,
    business_name: base.business_name,
    location:      base.location,
    tone:          base.tone,
    website_url:   null,
    brand_colors:  null,
    past_post_examples: null,
    content_preferences: null,
    website_services: null,
    website_testimonials: null,
  };
}

/** Generate one scenario via Claude, return parsed JSON */
async function generateScenario({ industry, month, contentType, wizardTrigger, tone, platform }) {
  const customer  = buildSyntheticCustomer(industry, month);
  customer.tone   = tone;

  // Pick a sample detail appropriate for this trigger
  const details = pickRandom(SAMPLE_DETAILS[wizardTrigger] || SAMPLE_DETAILS.finished_job);

  const builder = new SystemPromptBuilder(customer, {
    platform,
    contentType,
    wizardTrigger,
    counterAnswers: { details, month },
    businessKnowledge: [],
    wizardTone: tone,
  });

  // Override the month so we get all 12 months of data, not just current month
  builder.currentMonth = month;
  builder.seasonal = builder.knowledge?.seasonalContent?.[month] || null;

  const { systemPrompt, userPrompt } = builder.build();

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2500,
    temperature: 0.85,   // slightly higher than prod to create more diversity
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const rawText = response.content[0]?.text || '';
  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

/** Check if this exact combination was already harvested (for --resume) */
async function alreadyExists(industry, month, contentType, wizardTrigger, tone, platform) {
  const res = await pool.query(
    `SELECT 1 FROM post_training_data
     WHERE input_payload->>'industry'      = $1
       AND input_payload->>'month'         = $2
       AND input_payload->>'contentType'   = $3
       AND input_payload->>'wizardTrigger' = $4
       AND input_payload->>'tone'          = $5
       AND input_payload->>'platform'      = $6
       AND input_payload->>'source'        = 'harvest'
     LIMIT 1`,
    [industry, String(month), contentType, wizardTrigger, tone, platform]
  );
  return res.rows.length > 0;
}

/** Store one harvested example in post_training_data */
async function storeExample({ industry, month, contentType, wizardTrigger, tone, platform }, parsed) {
  const inputPayload = JSON.stringify({
    source:       'harvest',
    industry,
    month:        String(month),
    contentType,
    wizardTrigger,
    tone,
    platform,
    businessName: SYNTHETIC_CUSTOMERS[industry]?.business_name || '',
    location:     SYNTHETIC_CUSTOMERS[industry]?.location || '',
  });

  const outputPayload = JSON.stringify({
    variation_a: parsed.variation_a || {},
    variation_b: parsed.variation_b || {},
    variation_c: parsed.variation_c || {},
  });

  await pool.query(
    `INSERT INTO post_training_data
       (post_id, customer_id, input_payload, output_payload, model_used, created_at)
     VALUES (NULL, NULL, $1, $2, 'claude-sonnet-4-6', NOW())`,
    [inputPayload, outputPayload]
  );
}

// ── Build work queue ──────────────────────────────────────────────────────────

function buildWorkQueue() {
  const queue = [];
  for (const industry of INDUSTRIES_TO_RUN) {
    for (let month = 1; month <= 12; month++) {
      for (const contentType of CONTENT_TYPES) {
        for (const wizardTrigger of WIZARD_TRIGGERS) {
          for (const tone of TONES) {
            for (const platform of PLATFORMS) {
              queue.push({ industry, month, contentType, wizardTrigger, tone, platform });
            }
          }
        }
      }
    }
  }
  return queue;
}

// ── Worker pool ───────────────────────────────────────────────────────────────

async function runWorker(id, queue, stats) {
  while (queue.length > 0) {
    const job = queue.shift();
    if (!job) break;

    const { industry, month, contentType, wizardTrigger, tone, platform } = job;
    const label = `[${industry}][m${month}][${contentType}][${wizardTrigger}][${tone}][${platform}]`;

    try {
      if (RESUME && !DRY_RUN) {
        const exists = await alreadyExists(industry, month, contentType, wizardTrigger, tone, platform);
        if (exists) {
          stats.skipped++;
          if (stats.skipped % 100 === 0) console.log(`  [W${id}] Skipped ${stats.skipped} already-done`);
          continue;
        }
      }

      if (DRY_RUN) {
        console.log(`  [W${id}] DRY ${label}`);
        stats.generated++;
        continue;
      }

      const parsed = await generateScenario(job);

      // Validate — must have at least variation_a with a caption
      if (!parsed?.variation_a?.caption) {
        console.warn(`  [W${id}] SKIP (bad output) ${label}`);
        stats.errors++;
        continue;
      }

      await storeExample(job, parsed);
      stats.generated++;

      if (stats.generated % 50 === 0) {
        const elapsed = ((Date.now() - stats.startedAt) / 60000).toFixed(1);
        const rate    = (stats.generated / parseFloat(elapsed)).toFixed(1);
        console.log(`  Progress: ${stats.generated} generated | ${stats.skipped} skipped | ${stats.errors} errors | ${elapsed}min elapsed | ${rate}/min`);
      }

      // Small jitter to avoid Claude rate limits
      await sleep(200 + Math.random() * 300);

    } catch (err) {
      stats.errors++;
      console.error(`  [W${id}] ERROR ${label}: ${err.message}`);
      // Back off on rate limit errors
      if (err.status === 429 || err.message?.includes('rate')) {
        console.log(`  [W${id}] Rate limited — pausing 30s`);
        await sleep(30000);
      } else {
        await sleep(2000);
      }
      // Re-queue on transient errors (max 1 retry)
      if (!job._retried) {
        job._retried = true;
        queue.push(job);
      }
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  PostCore Brain — Text Training Data Harvest             ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY not set in .env');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL not set in .env');
    process.exit(1);
  }

  const queue = buildWorkQueue();
  const total = queue.length;

  console.log(`\nConfiguration:`);
  console.log(`  Industries:   ${INDUSTRIES_TO_RUN.length} (${INDUSTRIES_TO_RUN.join(', ')})`);
  console.log(`  Total combos: ${total.toLocaleString()}`);
  console.log(`  Concurrency:  ${CONCURRENCY} parallel Claude calls`);
  console.log(`  Resume:       ${RESUME ? 'ON (will skip existing)' : 'OFF'}`);
  console.log(`  Dry run:      ${DRY_RUN ? 'YES — no API calls, no DB writes' : 'NO — live'}`);
  console.log(`  Est. time:    ${Math.ceil(total / CONCURRENCY / 60 * 2.5)} hours`);
  console.log(`  Est. cost:    ~$${(total * 0.0015).toFixed(0)}–$${(total * 0.003).toFixed(0)} (Claude API)\n`);

  if (!DRY_RUN) {
    // Ensure harvest source column exists
    await pool.query(`ALTER TABLE post_training_data ADD COLUMN IF NOT EXISTS _source VARCHAR(20)`).catch(() => {});

    // Confirm before proceeding
    console.log('Starting in 5 seconds... (Ctrl+C to abort)');
    await sleep(5000);
  }

  const stats = { generated: 0, skipped: 0, errors: 0, startedAt: Date.now() };

  // Run workers in parallel
  const workers = Array.from({ length: CONCURRENCY }, (_, i) =>
    runWorker(i + 1, queue, stats)
  );
  await Promise.all(workers);

  const elapsed = ((Date.now() - stats.startedAt) / 60000).toFixed(1);
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  Harvest Complete                                        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Generated:  ${stats.generated.toLocaleString()} examples`);
  console.log(`  Skipped:    ${stats.skipped.toLocaleString()} (already existed)`);
  console.log(`  Errors:     ${stats.errors}`);
  console.log(`  Time:       ${elapsed} minutes`);
  console.log(`\n  Next step: node scripts/exportTrainingData.js`);

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
