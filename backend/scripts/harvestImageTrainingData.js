/**
 * PostCore Brain — Image Training Data Harvest
 *
 * Generates ~2,160 training images across all 18 industries using the current
 * NanoBanana (Google Gemini) API. These images become the training dataset for
 * PostCore Image (FLUX.1-schnell + 18 industry LoRAs).
 *
 * RUN THIS ONCE before cancelling the NanoBanana / Google AI API subscription.
 *
 * Usage:
 *   cd backend
 *   node scripts/harvestImageTrainingData.js
 *
 * Options:
 *   --industry=plumbing    Run only one industry (for testing)
 *   --dry-run              Log prompts without calling NanoBanana
 *   --resume               Skip images already in DB (default: on)
 *   --concurrency=2        Parallel NanoBanana calls (default: 2, max: 4)
 *
 * Estimated time:  3–5 hours at concurrency 2
 * Estimated cost:  ~$84 in NanoBanana API (2,160 × $0.039)
 * Output:          ~2,160 rows in image_training_data + Cloudinary URLs
 *
 * After running, export to local disk for LoRA training:
 *   node scripts/exportImageTrainingData.js --industry=plumbing
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Pool }          = require('pg');
const NanoBananaService = require('../services/NanoBananaService');

// ── Config ────────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  'plumbing', 'hvac', 'roofing', 'electrical', 'landscaping', 'concrete',
  'painting', 'pest_control', 'general_contractor', 'cleaning',
  'tree_service', 'pressure_washing', 'pool_spa', 'handyman',
  'flooring', 'junk_removal', 'solar', 'gutter_cleaning',
];

const SEASONS = ['spring', 'summer', 'fall', 'winter'];

// 6 visual content angles per industry — each describes a different shot type
const VISUAL_ANGLES = {
  plumbing: [
    { type: 'before_after', prompt: 'Split image: rusted corroded pipe on left, brand new copper pipe fitting on right, professional plumbing work, clean residential setting, realistic photo' },
    { type: 'job_complete', prompt: 'Plumber in branded uniform crouching under sink, new chrome faucet installed, clean tidy cabinet interior, professional work, warm residential lighting' },
    { type: 'emergency',    prompt: 'Plumber fixing burst pipe, water damage visible, professional emergency repair, wet floor, urgent repair scene, photorealistic' },
    { type: 'team_shot',    prompt: 'Two professional plumbers standing by their service truck, branded uniforms, residential neighbourhood background, confident pose, natural lighting' },
    { type: 'detail_shot',  prompt: 'Close up of clean PEX pipe installation in wall cavity, new fittings, professional rough-in plumbing, crisp detail photo' },
    { type: 'seasonal',     prompt: 'Frozen burst pipe exterior wall, ice damage, winter emergency plumbing repair, snow in background, photorealistic' },
  ],
  hvac: [
    { type: 'before_after', prompt: 'Old dirty HVAC unit before service on left, clean serviced air conditioning system on right, residential rooftop, split comparison' },
    { type: 'job_complete', prompt: 'HVAC technician in uniform beside newly installed AC unit, outdoor condenser, suburban home background, professional photo' },
    { type: 'maintenance',  prompt: 'Technician cleaning air filter, replacing HVAC filter, indoor unit, bright clean residential interior, close-up professional work' },
    { type: 'team_shot',    prompt: 'HVAC service van parked in residential driveway, technician in uniform unloading equipment, summer setting, professional' },
    { type: 'detail_shot',  prompt: 'Clean air vent with new filter, bright light, clean residential ceiling, close-up crisp photo' },
    { type: 'seasonal',     prompt: 'Snowy winter scene, HVAC technician servicing outdoor heat pump unit, heavy snow, emergency service call, professional' },
  ],
  roofing: [
    { type: 'before_after', prompt: 'Damaged storm-torn shingles on left, brand new asphalt shingle roof on right, suburban home, dramatic comparison, aerial view' },
    { type: 'job_complete', prompt: 'Finished new roof installation, clean ridge line, new gutters, curb appeal photo, sunny day, residential home, wide angle' },
    { type: 'crew_at_work', prompt: 'Roofing crew installing shingles on residential roof, safety harnesses, teamwork, bright sunny day, wide shot from street' },
    { type: 'team_shot',    prompt: 'Roofing crew posing on finished roof, branded uniforms, clear blue sky, professional group photo, residential neighbourhood' },
    { type: 'detail_shot',  prompt: 'Close-up of fresh asphalt shingle installation, nail gun in frame, clean straight rows, crisp detail photo' },
    { type: 'storm_damage', prompt: 'Hail damage on roof shingles, dented metal flashing, storm aftermath, insurance claim documentation photo' },
  ],
  electrical: [
    { type: 'before_after', prompt: 'Old overloaded fuse box on left, brand new circuit breaker panel on right, clean professional installation, split comparison' },
    { type: 'job_complete', prompt: 'Electrician in uniform pointing to clean new electrical panel, finished installation, residential utility room, professional photo' },
    { type: 'detail_shot',  prompt: 'Electrician wiring outlets, clean rough-in work, new wire runs in wall, professional workmanship close-up' },
    { type: 'team_shot',    prompt: 'Electrician in safety gear standing by service van, residential driveway, branded uniform, professional portrait' },
    { type: 'ev_charger',   prompt: 'New EV charging station installed in residential garage, clean white charger, Tesla or generic EV in background, modern home' },
    { type: 'safety',       prompt: 'Electrician safely testing outlet with voltage meter, safety gloves, professional technique, close-up detail' },
  ],
  landscaping: [
    { type: 'before_after', prompt: 'Overgrown neglected yard on left, beautiful manicured lawn with garden beds on right, suburban home, dramatic comparison' },
    { type: 'job_complete', prompt: 'Freshly landscaped front yard, clean mulched garden beds, trimmed hedges, new sod, beautiful curb appeal, bright sunny day' },
    { type: 'crew_at_work', prompt: 'Landscaping crew mowing and trimming residential lawn, branded equipment, summer setting, professional team at work' },
    { type: 'seasonal',     prompt: 'Fall leaf cleanup, landscaper with blower in colourful leaf-covered yard, autumn colours, professional service photo' },
    { type: 'detail_shot',  prompt: 'Close-up of fresh mulch installation in garden bed, green plants, clean edge lines, professional landscaping detail' },
    { type: 'hardscape',    prompt: 'Newly installed paver patio with outdoor furniture, backyard setting, perfect stone work, warm lighting, beautiful design' },
  ],
  concrete: [
    { type: 'before_after', prompt: 'Cracked old driveway on left, smooth new concrete driveway on right, residential home, dramatic comparison, curb appeal' },
    { type: 'job_complete', prompt: 'Freshly poured and finished concrete driveway, smooth surface, residential home, clean edges, professional work, golden hour' },
    { type: 'stamped',      prompt: 'Beautiful stamped concrete patio, decorative pattern, backyard setting, outdoor furniture, warm tones, professional finish' },
    { type: 'crew_at_work', prompt: 'Concrete crew finishing freshly poured slab, screeding surface, professional teamwork, early morning light' },
    { type: 'detail_shot',  prompt: 'Close-up of decorative stamped concrete pattern, rich colour, clean edges, outdoor patio surface detail' },
    { type: 'foundation',   prompt: 'Concrete foundation repair, crack injection, professional basement waterproofing, before and after, clean professional work' },
  ],
  painting: [
    { type: 'before_after', prompt: 'Faded peeling exterior paint on left, fresh bright painted house on right, residential curb appeal, dramatic colour transformation' },
    { type: 'job_complete', prompt: 'Freshly painted home exterior, clean crisp edges, beautiful colour choice, professional job, bright sunshine, curb appeal' },
    { type: 'crew_at_work', prompt: 'Painting crew on ladders painting house exterior, branded uniforms, professional equipment, residential setting' },
    { type: 'interior',     prompt: 'Freshly painted living room interior, tape lines removed, beautiful colour on walls, clean professional finish, natural light' },
    { type: 'tape_reveal',  prompt: 'Painter peeling masking tape to reveal perfect crisp paint line, satisfying reveal moment, professional interior work' },
    { type: 'cabinet',      prompt: 'Before and after kitchen cabinet painting, old worn cabinets transformed to bright white, professional spray finish' },
  ],
  pest_control: [
    { type: 'technician',   prompt: 'Pest control technician in uniform inspecting home foundation, sprayer equipment, professional residential service' },
    { type: 'before_after', prompt: 'Termite damaged wood on left, treated and repaired wood on right, professional pest control, dramatic comparison' },
    { type: 'treatment',    prompt: 'Pest control technician applying treatment around home perimeter, branded uniform, residential setting, professional service' },
    { type: 'inspection',   prompt: 'Pest control expert using flashlight to inspect crawl space, safety gear, professional inspection, close-up' },
    { type: 'team_shot',    prompt: 'Pest control technician standing beside branded service vehicle, residential neighbourhood, professional portrait' },
    { type: 'seasonal',     prompt: 'Pest control technician treating home exterior for mosquitoes, summer setting, suburban yard, professional service' },
  ],
  general_contractor: [
    { type: 'before_after', prompt: 'Outdated kitchen before renovation on left, stunning modern kitchen after remodel on right, dramatic transformation' },
    { type: 'job_complete', prompt: 'Beautifully completed home addition, new room exterior, seamless integration with existing home, bright sunny day' },
    { type: 'crew_at_work', prompt: 'Construction crew framing new home addition, lumber, tools, safety gear, professional teamwork, wide shot' },
    { type: 'renovation',   prompt: 'Master bathroom renovation complete, new tile, vanity, fixtures, luxurious finish, professional photography' },
    { type: 'team_shot',    prompt: 'General contractor team in hard hats at job site, branded vests, professional group photo, construction background' },
    { type: 'detail_shot',  prompt: 'Craftsman installing custom trim work, clean mitered corners, beautiful finish carpentry, close-up detail photo' },
  ],
  cleaning: [
    { type: 'before_after', prompt: 'Dirty neglected bathroom on left, sparkling spotless bathroom on right, dramatic cleaning transformation, residential' },
    { type: 'job_complete', prompt: 'Spotlessly clean bright kitchen, gleaming countertops, shining appliances, professional cleaning result, natural light' },
    { type: 'team_shot',    prompt: 'Professional cleaning crew in uniform standing in clean home entrance, branded uniforms, friendly smiles, professional photo' },
    { type: 'deep_clean',   prompt: 'Cleaning technician deep cleaning oven interior, professional chemicals, before results visible, residential kitchen' },
    { type: 'detail_shot',  prompt: 'Gleaming clean shower tiles, sparkling grout, polished chrome, close-up professional cleaning result, bright light' },
    { type: 'move_in',      prompt: 'Cleaning team doing move-in deep clean, empty house, full team at work, professional residential cleaning service' },
  ],
  tree_service: [
    { type: 'before_after', prompt: 'Overgrown dangerous leaning tree on left, property cleared of hazard on right, safe professional removal, dramatic difference' },
    { type: 'job_complete', prompt: 'Clean stump ground down flush with lawn, wood chips cleared, professional tree removal result, residential yard' },
    { type: 'crew_at_work', prompt: 'Arborist in harness pruning large oak tree, chainsaw, professional tree climbing, safety gear, blue sky background' },
    { type: 'team_shot',    prompt: 'Tree service crew posing beside large felled tree, chainsaws, chippers, branded uniforms, professional team photo' },
    { type: 'storm_damage', prompt: 'Storm damaged tree on house roof, emergency tree removal service, crew with equipment assessing damage, urgent scene' },
    { type: 'seasonal',     prompt: 'Fall tree trimming service, arborist in bucket truck, colourful autumn tree, residential neighbourhood, professional' },
  ],
  pressure_washing: [
    { type: 'before_after', prompt: 'Black stained driveway on left, bright clean white concrete on right, dramatic pressure washing transformation, split image' },
    { type: 'job_complete', prompt: 'Sparkling clean home exterior, fresh white siding, cleaned walkway, beautiful curb appeal, pressure washing result' },
    { type: 'at_work',      prompt: 'Technician pressure washing concrete driveway, powerful water stream, visible cleaning path, residential, action shot' },
    { type: 'deck',         prompt: 'Before and after composite deck cleaning, black mould removed, bright clean wood revealed, pressure washing result' },
    { type: 'team_shot',    prompt: 'Pressure washing technician with equipment in residential driveway, branded van, professional portrait, clean surroundings' },
    { type: 'detail_shot',  prompt: 'Close up of pressure washing removing years of stains from patio stone, water jet detail, before/after in single frame' },
  ],
  pool_spa: [
    { type: 'before_after', prompt: 'Green algae-filled pool on left, crystal clear blue pool water on right, dramatic pool cleaning transformation' },
    { type: 'job_complete', prompt: 'Pristine sparkling swimming pool, crystal clear water, clean tile line, beautiful backyard setting, sunny day' },
    { type: 'technician',   prompt: 'Pool technician testing water chemistry, net and supplies, residential pool, professional service, sunny setting' },
    { type: 'equipment',    prompt: 'New pool pump and filter equipment installed, clean mechanical room, professional pool equipment upgrade, close-up' },
    { type: 'seasonal',     prompt: 'Pool opening service in spring, technician removing pool cover, fresh blue water revealed, neighbourhood setting' },
    { type: 'spa',          prompt: 'Sparkling clean hot tub with jets running, crystal water, residential backyard deck, evening ambient lighting' },
  ],
  handyman: [
    { type: 'before_after', prompt: 'Broken fence on left, repaired and painted fence on right, clean professional handyman work, residential yard' },
    { type: 'job_complete', prompt: 'Freshly installed bathroom vanity, new light fixture, painted walls, clean professional handyman result, modern look' },
    { type: 'at_work',      prompt: 'Handyman installing new door lock, professional tools, residential entryway, focused professional work, close-up' },
    { type: 'team_shot',    prompt: 'Friendly handyman in branded uniform at front door of residential home, tool belt, professional smile, inviting pose' },
    { type: 'deck_repair',  prompt: 'Rotted deck boards replaced with new composite, handyman work, before section still visible, professional repair detail' },
    { type: 'tile_repair',  prompt: 'Cracked tile replaced perfectly, matching grout, professional finish, bathroom floor, close-up handyman detail work' },
  ],
  flooring: [
    { type: 'before_after', prompt: 'Scratched stained carpet on left, beautiful new hardwood floors on right, residential living room transformation, dramatic' },
    { type: 'job_complete', prompt: 'Freshly installed engineered hardwood floor, beautiful grain, professional finish, residential living room, natural light' },
    { type: 'installation', prompt: 'Flooring installer laying hardwood planks, nail gun, careful alignment, residential room, professional installation in progress' },
    { type: 'tile',         prompt: 'New luxury vinyl tile installed in kitchen, modern pattern, professional grout lines, bright clean kitchen, close-up' },
    { type: 'team_shot',    prompt: 'Flooring installation crew posing on completed project, beautiful new floors, branded uniforms, professional photo' },
    { type: 'detail_shot',  prompt: 'Close-up of perfectly installed herringbone hardwood pattern, crisp edges at baseboard, professional flooring detail' },
  ],
  junk_removal: [
    { type: 'before_after', prompt: 'Cluttered hoarded garage on left, completely clean empty garage on right, dramatic junk removal transformation' },
    { type: 'job_complete', prompt: 'Completely cleared basement, clean concrete floor, fresh empty space, junk removal result, bright clean lighting' },
    { type: 'crew_at_work', prompt: 'Junk removal crew loading old furniture into branded truck, residential driveway, teamwork, professional service' },
    { type: 'team_shot',    prompt: 'Junk removal team standing beside fully loaded truck, branded uniforms, residential neighbourhood, professional photo' },
    { type: 'estate',       prompt: 'Complete estate cleanout in progress, crew carrying furniture, large home, professional organised team effort' },
    { type: 'recycling',    prompt: 'Junk removal team sorting items for donation and recycling, responsible disposal, branded truck, eco-conscious service' },
  ],
  solar: [
    { type: 'before_after', prompt: 'Plain roof before solar on left, beautiful solar panel array installed on right, residential home, dramatic comparison' },
    { type: 'job_complete', prompt: 'Completed solar panel installation on residential roof, clean rows of panels, suburban home, sunny day, wide angle' },
    { type: 'installation', prompt: 'Solar technicians installing panels on roof, safety harnesses, bright sunny day, professional installation in progress' },
    { type: 'inverter',     prompt: 'Clean solar inverter and monitoring equipment installed in garage, professional electrical work, organised and labelled' },
    { type: 'team_shot',    prompt: 'Solar installation crew posing on roof with completed panel array, branded uniforms, blue sky, professional team photo' },
    { type: 'savings',      prompt: 'Solar panel array on residential roof, bright sunshine, energy production graphic overlay, clean modern home' },
  ],
  gutter_cleaning: [
    { type: 'before_after', prompt: 'Gutter packed with leaves and debris on left, clean clear gutter on right, dramatic cleaning result, close-up split image' },
    { type: 'job_complete', prompt: 'Clean gutters on residential home, fresh downspouts, no debris, professional gutter cleaning result, curb appeal' },
    { type: 'at_work',      prompt: 'Technician on ladder cleaning packed gutter by hand, removing leaves, residential home, professional gutter service' },
    { type: 'gutter_guard', prompt: 'New gutter guard system installed, clean professional installation, technician showing finished product, close-up' },
    { type: 'team_shot',    prompt: 'Gutter cleaning technician on ladder with branded uniform, residential home, professional portrait, autumn leaves visible' },
    { type: 'downspout',    prompt: 'Technician flushing downspout with hose, debris coming out, full cleaning service, residential setting, professional' },
  ],
};

// Season-specific suffixes added to prompts
const SEASON_CONTEXT = {
  spring: 'spring setting, green lawn emerging, flowers blooming',
  summer: 'bright summer sunshine, lush green trees, summer setting',
  fall:   'autumn leaves, fall colours, seasonal residential setting',
  winter: 'winter setting, snow visible, cold weather context',
};

// ── Args ──────────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, v] = a.slice(2).split('=');
      return [k, v === undefined ? true : v];
    })
);

const DRY_RUN       = !!args['dry-run'];
const RESUME        = args['resume'] !== 'false';
const CONCURRENCY   = Math.min(4, parseInt(args['concurrency'] || '2', 10));
const ONLY_INDUSTRY = args['industry'] || null;

const INDUSTRIES_TO_RUN = ONLY_INDUSTRY
  ? INDUSTRIES.filter(i => i === ONLY_INDUSTRY)
  : INDUSTRIES;

// ── DB + NanoBanana ───────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function buildFullPrompt(basePrompt, industry, season) {
  const seasonCtx = SEASON_CONTEXT[season] || '';
  return `${basePrompt}, ${seasonCtx}, high quality social media photo, photorealistic, 4:5 aspect ratio`;
}

async function alreadyExists(industry, angleType, season) {
  const res = await pool.query(
    `SELECT 1 FROM image_training_data
     WHERE industry = $1
       AND input_prompt LIKE $2
       AND input_prompt LIKE $3
     LIMIT 1`,
    [industry, `%${angleType}%`, `%${season}%`]
  );
  return res.rows.length > 0;
}

async function generateAndStore(industry, angle, season, nanoBanana) {
  const fullPrompt = buildFullPrompt(angle.prompt, industry, season);

  const syntheticCustomer = {
    id: 0,
    industry,
    business_name: `${industry} Business`,
    location: 'Local Area',
    tone: 'professional',
    brand_colors: null,
  };

  const startMs = Date.now();
  const result = await nanoBanana.generateFromPrompt(syntheticCustomer, fullPrompt, {
    aspectRatio: '4:5',
  });
  const genMs = Date.now() - startMs;

  if (!result?.url) throw new Error('No URL returned from NanoBanana');

  await pool.query(
    `INSERT INTO image_training_data
       (post_id, customer_id, input_prompt, output_url, provider, industry,
        content_type, model_used, generation_time_ms, created_at)
     VALUES (NULL, NULL, $1, $2, 'nanobanana', $3, $4, $5, $6, NOW())`,
    [
      fullPrompt,
      result.url,
      industry,
      angle.type,
      result.model || 'gemini-2.5-flash-image',
      genMs,
    ]
  );

  return result.url;
}

// ── Build work queue ──────────────────────────────────────────────────────────

function buildWorkQueue() {
  const queue = [];
  for (const industry of INDUSTRIES_TO_RUN) {
    const angles = VISUAL_ANGLES[industry] || VISUAL_ANGLES.general_contractor;
    for (const angle of angles) {
      for (const season of SEASONS) {
        queue.push({ industry, angle, season });
      }
    }
  }
  return queue;
}

// ── Worker pool ───────────────────────────────────────────────────────────────

async function runWorker(id, queue, stats, nanoBanana) {
  while (queue.length > 0) {
    const job = queue.shift();
    if (!job) break;

    const { industry, angle, season } = job;
    const label = `[${industry}][${angle.type}][${season}]`;

    try {
      if (RESUME && !DRY_RUN) {
        const exists = await alreadyExists(industry, angle.type, season);
        if (exists) {
          stats.skipped++;
          continue;
        }
      }

      if (DRY_RUN) {
        const prompt = buildFullPrompt(angle.prompt, industry, season);
        console.log(`  [W${id}] DRY ${label}: ${prompt.substring(0, 80)}...`);
        stats.generated++;
        continue;
      }

      const url = await generateAndStore(industry, angle, season, nanoBanana);
      stats.generated++;

      if (stats.generated % 20 === 0) {
        const elapsed = ((Date.now() - stats.startedAt) / 60000).toFixed(1);
        const cost    = (stats.generated * 0.039).toFixed(2);
        console.log(`  Progress: ${stats.generated} images | $${cost} spent | ${elapsed}min | ${stats.errors} errors`);
      }

      // Respect Gemini rate limits: ~1-2 req/sec recommended
      await sleep(1500 + Math.random() * 500);

    } catch (err) {
      stats.errors++;
      console.error(`  [W${id}] ERROR ${label}: ${err.message}`);
      if (err.message?.includes('quota') || err.message?.includes('429')) {
        console.log(`  [W${id}] Rate limited — pausing 60s`);
        await sleep(60000);
      } else {
        await sleep(3000);
      }
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
  console.log('║  PostCore Brain — Image Training Data Harvest            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (!process.env.GOOGLE_AI_API_KEY) {
    console.error('ERROR: GOOGLE_AI_API_KEY not set in .env');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL not set in .env');
    process.exit(1);
  }

  const queue    = buildWorkQueue();
  const total    = queue.length;
  const estCost  = (total * 0.039).toFixed(2);

  console.log(`\nConfiguration:`);
  console.log(`  Industries:   ${INDUSTRIES_TO_RUN.length} (${INDUSTRIES_TO_RUN.join(', ')})`);
  console.log(`  Images total: ${total.toLocaleString()} (6 angles × 4 seasons × ${INDUSTRIES_TO_RUN.length} industries)`);
  console.log(`  Concurrency:  ${CONCURRENCY} parallel calls`);
  console.log(`  Resume:       ${RESUME ? 'ON' : 'OFF'}`);
  console.log(`  Dry run:      ${DRY_RUN ? 'YES' : 'NO — live API calls'}`);
  console.log(`  Est. cost:    ~$${estCost} (NanoBanana @ $0.039/image)`);
  console.log(`  Est. time:    ${Math.ceil(total / CONCURRENCY * 2 / 60)} hours\n`);

  if (!DRY_RUN) {
    console.log('Starting in 5 seconds... (Ctrl+C to abort)');
    await sleep(5000);
  }

  const nanoBanana = new NanoBananaService();
  const stats = { generated: 0, skipped: 0, errors: 0, startedAt: Date.now() };

  const workers = Array.from({ length: CONCURRENCY }, (_, i) =>
    runWorker(i + 1, queue, stats, nanoBanana)
  );
  await Promise.all(workers);

  const elapsed  = ((Date.now() - stats.startedAt) / 60000).toFixed(1);
  const actualCost = (stats.generated * 0.039).toFixed(2);

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  Image Harvest Complete                                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Generated:  ${stats.generated} images`);
  console.log(`  Skipped:    ${stats.skipped} (already existed)`);
  console.log(`  Errors:     ${stats.errors}`);
  console.log(`  Actual cost: ~$${actualCost}`);
  console.log(`  Time:        ${elapsed} minutes`);
  console.log(`\n  Next step: python scripts/train_image_lora.py --industry=plumbing`);
  console.log(`  (Run for each of the 18 industries on Vast.ai or Kaggle)\n`);

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
