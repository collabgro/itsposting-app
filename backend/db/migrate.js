/**
 * ItsPosting — Migration Runner
 * backend/db/migrate.js
 *
 * Usage:
 *   node backend/db/migrate.js              — run all pending migrations
 *   node backend/db/migrate.js --verify     — verify migration was applied
 *   node backend/db/migrate.js --rollback   — see rollback instructions
 *
 * Safe to run multiple times — all statements are idempotent.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/socialmedia',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ── Migration registry ────────────────────────────────────────────────────────
const MIGRATIONS = [
  {
    id: '001_enhanced_ai_system',
    file: path.join(__dirname, 'migrations/001_enhanced_ai_system.sql'),
    description: 'Add AI personalisation columns + content_suggestions + post_variations + post_images + 5 more tables',
  },
  {
    id: '004_post_variations_extras',
    file: path.join(__dirname, 'migrations/004_post_variations_extras.sql'),
    description: 'Add platforms, best_time_to_post, variations_json, selected_variation to posts; is_selected to post_variations',
  },
  {
    id: '005_phase4_infrastructure',
    file: path.join(__dirname, 'migrations/005_phase4_infrastructure.sql'),
    description: 'Phase 4: scheduled_timezone on posts, timezone on customers, inbox_messages, posting_analytics, hashtag_performance, monthly_reports, postcore_briefings',
  },
];

// ── Migration tracking table ──────────────────────────────────────────────────
const ENSURE_TRACKING_TABLE = `
  CREATE TABLE IF NOT EXISTS _migrations (
    id           VARCHAR(100) PRIMARY KEY,
    description  TEXT,
    applied_at   TIMESTAMP DEFAULT NOW()
  );
`;

async function hasBeenApplied(client, migrationId) {
  const result = await client.query(
    'SELECT id FROM _migrations WHERE id = $1',
    [migrationId]
  );
  return result.rows.length > 0;
}

async function markApplied(client, migration) {
  await client.query(
    'INSERT INTO _migrations (id, description) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
    [migration.id, migration.description]
  );
}

// ── Verify ────────────────────────────────────────────────────────────────────
async function verify() {
  const client = await pool.connect();
  try {
    console.log('\n🔍 Verifying migration 001...\n');

    // Check customer columns
    const colCheck = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'customers'
        AND column_name IN (
          'past_post_examples', 'content_preferences',
          'posting_streak', 'last_posted_at', 'total_posts_this_month',
          'is_admin', 'role', 'suspended'
        )
      ORDER BY column_name;
    `);

    console.log('customers table — new columns:');
    colCheck.rows.forEach(r => {
      console.log(`  ✅ ${r.column_name} (${r.data_type})`);
    });

    const missingCols = 8 - colCheck.rows.length;
    if (missingCols > 0) console.log(`  ⚠️  ${missingCols} column(s) missing`);

    // Check new tables
    const tableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'content_suggestions', 'post_variations', 'post_images',
          'business_knowledge', 'postcore_briefings',
          'posting_analytics', 'hashtag_performance', 'monthly_reports'
        )
      ORDER BY table_name;
    `);

    console.log('\nNew tables:');
    tableCheck.rows.forEach(r => console.log(`  ✅ ${r.table_name}`));

    const missingTables = 8 - tableCheck.rows.length;
    if (missingTables > 0) console.log(`  ⚠️  ${missingTables} table(s) missing`);

    // Row counts for new tables
    console.log('\nRow counts:');
    for (const tbl of ['content_suggestions', 'post_variations', 'post_images', 'business_knowledge']) {
      try {
        const cnt = await client.query(`SELECT COUNT(*) FROM ${tbl}`);
        console.log(`  ${tbl}: ${cnt.rows[0].count} rows`);
      } catch {
        console.log(`  ${tbl}: ❌ table not found`);
      }
    }

    // Migration tracking
    const trackCheck = await client.query('SELECT * FROM _migrations ORDER BY applied_at');
    console.log('\nApplied migrations:');
    if (trackCheck.rows.length === 0) {
      console.log('  (none recorded)');
    } else {
      trackCheck.rows.forEach(r => console.log(`  ✅ ${r.id} — ${new Date(r.applied_at).toISOString()}`));
    }

    console.log('\n✅ Verification complete\n');
  } finally {
    client.release();
    await pool.end();
  }
}

// ── Run migrations ────────────────────────────────────────────────────────────
async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('\n🚀 ItsPosting Database Migration Runner\n');
    console.log(`   Connecting to: ${process.env.DATABASE_URL ? '(DATABASE_URL set)' : 'localhost'}`);
    console.log(`   Environment:   ${process.env.NODE_ENV || 'development'}\n`);

    // Ensure tracking table exists
    await client.query(ENSURE_TRACKING_TABLE);

    let applied = 0;
    let skipped = 0;

    for (const migration of MIGRATIONS) {
      const alreadyApplied = await hasBeenApplied(client, migration.id);

      if (alreadyApplied) {
        console.log(`⭭  Skipping ${migration.id} (already applied)`);
        skipped++;
        continue;
      }

      console.log(`▶  Running migration: ${migration.id}`);
      console.log(`   ${migration.description}`);

      if (!fs.existsSync(migration.file)) {
        throw new Error(`Migration file not found: ${migration.file}`);
      }

      const sql = fs.readFileSync(migration.file, 'utf8');

      try {
        await client.query(sql);
        await markApplied(client, migration);
        console.log(`✅ Applied: ${migration.id}\n`);
        applied++;
      } catch (err) {
        console.error(`❌ FAILED: ${migration.id}`);
        console.error(`   Error: ${err.message}`);
        throw err;
      }
    }

    console.log('─'.repeat(50));
    console.log(`✅ Done — ${applied} applied, ${skipped} skipped\n`);

    if (applied > 0) {
      console.log('Next step: run with --verify to confirm everything is in place\n');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

// ── Rollback instructions (no destructive auto-rollback) ─────────────────────
function showRollback() {
  console.log(`
⚠️  ROLLBACK — ItsPosting Migration 001
────────────────────────────────────────

This migration only ADDS columns and tables — it never modifies or drops existing data.
To roll back manually, connect to your database and run:

  -- Remove new tables (in dependency order)
  DROP TABLE IF EXISTS monthly_reports;
  DROP TABLE IF EXISTS hashtag_performance;
  DROP TABLE IF EXISTS posting_analytics;
  DROP TABLE IF EXISTS postcore_briefings;
  DROP TABLE IF EXISTS business_knowledge;
  DROP TABLE IF EXISTS post_images;
  DROP TABLE IF EXISTS post_variations;
  DROP TABLE IF EXISTS content_suggestions;

  -- Remove new customer columns
  ALTER TABLE customers DROP COLUMN IF EXISTS past_post_examples;
  ALTER TABLE customers DROP COLUMN IF EXISTS content_preferences;
  ALTER TABLE customers DROP COLUMN IF EXISTS posting_streak;
  ALTER TABLE customers DROP COLUMN IF EXISTS last_posted_at;
  ALTER TABLE customers DROP COLUMN IF EXISTS total_posts_this_month;

  -- Remove migration record
  DELETE FROM _migrations WHERE id = '001_enhanced_ai_system';

⚠️  Existing customer, post, and credit data is NEVER touched.
`);
}

// ── Entry point ───────────────────────────────────────────────────────────────
const arg = process.argv[2];
if (arg === '--verify') {
  verify().catch(err => { console.error(err); process.exit(1); });
} else if (arg === '--rollback') {
  showRollback();
  process.exit(0);
} else {
  runMigrations().catch(err => { console.error(err); process.exit(1); });
}
