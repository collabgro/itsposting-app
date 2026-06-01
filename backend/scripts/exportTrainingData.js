/**
 * PostCore Brain — Training Data Export
 *
 * Exports post_training_data from the DB to JSONL format, ready to upload
 * to Kaggle / RunPod / Google Colab for QLoRA fine-tuning of Llama 3.2 3B
 * or Llama 3.1 8B.
 *
 * Output format: Hugging Face SFTTrainer / TRL chat template (ShareGPT format)
 * Compatible with: trl, axolotl, LLaMA-Factory, unsloth
 *
 * Usage:
 *   cd backend
 *   node scripts/exportTrainingData.js
 *
 * Options:
 *   --output=./exports/training.jsonl    Output file path (default: ./exports/training_YYYYMMDD.jsonl)
 *   --min-quality=0                      Minimum quality_score to include (default: 0 = all)
 *   --only-selected                      Only include rows where variation was selected by customer
 *   --industry=plumbing                  Export one industry only
 *   --limit=10000                        Cap total rows exported
 *   --split=0.9                          Train/val split ratio (default: 0.9 = 90% train)
 *
 * After export:
 *   Upload training.jsonl and val.jsonl to Kaggle dataset
 *   Run the Kaggle notebook: notebooks/postcore_text_finetune.ipynb
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Pool } = require('pg');
const fs       = require('fs');
const path     = require('path');

// ── Args ──────────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, v] = a.slice(2).split('=');
      return [k, v === undefined ? true : v];
    })
);

const TODAY          = new Date().toISOString().split('T')[0].replace(/-/g, '');
const OUTPUT_DIR     = path.join(__dirname, '../exports');
const OUTPUT_PATH    = args['output'] || path.join(OUTPUT_DIR, `training_${TODAY}.jsonl`);
const VAL_PATH       = OUTPUT_PATH.replace('.jsonl', '_val.jsonl');
const MIN_QUALITY    = parseFloat(args['min-quality'] || '0');
const ONLY_SELECTED  = !!args['only-selected'];
const ONLY_INDUSTRY  = args['industry'] || null;
const LIMIT          = parseInt(args['limit'] || '999999', 10);
const SPLIT_RATIO    = parseFloat(args['split'] || '0.9');

// ── DB ────────────────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── System prompt template (compact — fine-tuned model already knows the task) ──

const SYSTEM_PROMPT = `You are PostCore, ItsPosting's AI content advisor for local service businesses.
Generate exactly 3 social media caption variations (A, B, C) for the given business.
Each variation must:
- Start with a strong hook that stops the scroll
- Reference the business location naturally
- End with an engagement question
- Match the requested tone
- Follow platform word limits (Facebook: 150-300 words, Instagram: 100-150 words, Google Business: 100-200 words)
Respond with valid JSON only. No markdown. No explanation.`;

// ── Format one DB row into ShareGPT JSONL format ──────────────────────────────

function formatRow(row) {
  const input  = row.input_payload  || {};
  const output = row.output_payload || {};

  const industry      = input.industry      || 'general_contractor';
  const contentType   = input.contentType   || input.content_type || 'photo';
  const wizardTrigger = input.wizardTrigger || 'finished_job';
  const tone          = input.tone          || 'professional';
  const platform      = input.platform      || 'facebook';
  const businessName  = input.businessName  || input.business_name || 'Local Business';
  const location      = input.location      || 'Local Area';
  const month         = input.month         || String(new Date().getMonth() + 1);
  const details       = input.details       || input.wizardAnswers?.details || '';

  const userContent = [
    `Industry: ${industry}`,
    `Business: ${businessName}, ${location}`,
    `Month: ${month}`,
    `Content type: ${contentType}`,
    `Content trigger: ${wizardTrigger}`,
    `Tone: ${tone}`,
    `Platform: ${platform}`,
    details ? `Details: ${details}` : null,
  ].filter(Boolean).join('\n');

  // Build the ideal output — weight toward the selected variation
  const idealOutput = {
    variation_a: output.variation_a || {},
    variation_b: output.variation_b || {},
    variation_c: output.variation_c || {},
  };

  // If customer selected a variation, make it variation_a (the model learns to lead with the winner)
  if (row.variation_selected && row.variation_selected !== 'A') {
    const selected = `variation_${row.variation_selected.toLowerCase()}`;
    const original_a = idealOutput.variation_a;
    idealOutput.variation_a = idealOutput[selected] || idealOutput.variation_a;
    idealOutput[selected]   = original_a;
  }

  // ShareGPT format — compatible with trl SFTTrainer, axolotl, LLaMA-Factory
  return {
    conversations: [
      { from: 'system', value: SYSTEM_PROMPT },
      { from: 'human',  value: userContent },
      { from: 'gpt',    value: JSON.stringify(idealOutput, null, 0) },
    ],
    // Metadata — not used in training, useful for analysis
    _meta: {
      id:                row.id,
      industry,
      contentType,
      platform,
      tone,
      variationSelected: row.variation_selected || null,
      wasEdited:         row.was_edited || false,
      wasPublished:      row.was_published || false,
      qualityScore:      row.quality_score || null,
      postReach:         row.post_reach || null,
      source:            input.source || 'wizard',
    },
  };
}

// ── Weight calculation (higher = more important example) ──────────────────────

function computeWeight(row) {
  let w = 1.0;
  if (row.variation_selected)                     w *= 3.0;  // customer chose this
  if (row.was_edited === false)                   w *= 2.0;  // used without editing
  if (row.was_published === true)                 w *= 1.5;  // actually published
  if (row.quality_score >= 4.5)                   w *= 5.0;  // curator gold
  if (row.quality_score >= 3.5)                   w *= 2.0;  // curator good
  if (row.post_reach > 0)                         w *= 2.0;  // has real engagement data
  if (row.was_edited === true)                    w *= 0.5;  // customer didn't love it
  if (!row.variation_selected && !row.was_published) w *= 0.25; // low signal
  return Math.round(w);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  PostCore Brain — Training Data Export                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL not set in .env');
    process.exit(1);
  }

  // Build query with filters
  const conditions = ['1=1'];
  const params     = [];

  if (MIN_QUALITY > 0) {
    params.push(MIN_QUALITY);
    conditions.push(`(quality_score IS NULL OR quality_score >= $${params.length})`);
  }
  if (ONLY_SELECTED) {
    conditions.push('variation_selected IS NOT NULL');
  }
  if (ONLY_INDUSTRY) {
    params.push(ONLY_INDUSTRY);
    conditions.push(`input_payload->>'industry' = $${params.length}`);
  }

  params.push(LIMIT);
  const query = `
    SELECT id, input_payload, output_payload,
           variation_selected, was_edited, was_published,
           quality_score, post_reach, post_engagement, model_used
    FROM post_training_data
    WHERE ${conditions.join(' AND ')}
      AND output_payload->>'variation_a' IS NOT NULL
    ORDER BY
      CASE WHEN quality_score IS NOT NULL THEN 0 ELSE 1 END,
      quality_score DESC NULLS LAST,
      created_at DESC
    LIMIT $${params.length}
  `;

  console.log('Querying database...');
  const result = await pool.query(query, params);
  const rows   = result.rows;

  if (rows.length === 0) {
    console.log('No training data found. Run harvestTrainingData.js first.');
    await pool.end();
    return;
  }

  console.log(`Found ${rows.length.toLocaleString()} rows`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Format and weight-expand rows
  const formatted = [];
  let skipped = 0;
  for (const row of rows) {
    try {
      const entry  = formatRow(row);
      const weight = computeWeight(row);
      // Duplicate high-value examples according to weight (up to 5×)
      const copies = Math.min(5, weight);
      for (let i = 0; i < copies; i++) formatted.push(entry);
    } catch {
      skipped++;
    }
  }

  // Shuffle
  for (let i = formatted.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [formatted[i], formatted[j]] = [formatted[j], formatted[i]];
  }

  // Split into train / val
  const splitIdx  = Math.floor(formatted.length * SPLIT_RATIO);
  const trainData = formatted.slice(0, splitIdx);
  const valData   = formatted.slice(splitIdx);

  // Write JSONL files
  fs.writeFileSync(OUTPUT_PATH, trainData.map(r => JSON.stringify(r)).join('\n'), 'utf8');
  fs.writeFileSync(VAL_PATH,    valData.map(r => JSON.stringify(r)).join('\n'),   'utf8');

  // Industry breakdown
  const byIndustry = {};
  for (const row of rows) {
    const ind = row.input_payload?.industry || 'unknown';
    byIndustry[ind] = (byIndustry[ind] || 0) + 1;
  }

  console.log('\n── Industry breakdown ─────────────────────────────────────');
  Object.entries(byIndustry)
    .sort(([, a], [, b]) => b - a)
    .forEach(([ind, count]) => {
      const bar = '█'.repeat(Math.round(count / rows.length * 40));
      console.log(`  ${ind.padEnd(22)} ${String(count).padStart(6)}  ${bar}`);
    });

  console.log('\n── Export summary ─────────────────────────────────────────');
  console.log(`  Source rows:      ${rows.length.toLocaleString()}`);
  console.log(`  Skipped (error):  ${skipped}`);
  console.log(`  After weighting:  ${formatted.length.toLocaleString()} examples`);
  console.log(`  Train split:      ${trainData.length.toLocaleString()} (${(SPLIT_RATIO * 100).toFixed(0)}%)`);
  console.log(`  Val split:        ${valData.length.toLocaleString()} (${((1 - SPLIT_RATIO) * 100).toFixed(0)}%)`);
  console.log(`\n  Train file: ${OUTPUT_PATH}`);
  console.log(`  Val file:   ${VAL_PATH}`);

  console.log('\n── Next steps ─────────────────────────────────────────────');
  console.log('  1. Upload both files to your Kaggle dataset');
  console.log('  2. Open notebooks/postcore_text_finetune.ipynb on Kaggle');
  console.log('  3. Set TRAIN_FILE and VAL_FILE paths in the notebook');
  console.log('  4. Run on Kaggle free T4 GPU (Llama 3.2 3B) or');
  console.log('     RunPod A100 Spot (Llama 3.1 8B, ~$15–25/run)');
  console.log('  5. Download weights → push to HuggingFace private repo');
  console.log('  6. Deploy to Modal.com → set POSTCORE_TEXT_ENDPOINT env var\n');

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
