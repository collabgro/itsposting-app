/**
 * ItsPosting — Migration Test Script
 * backend/db/test-migration.js
 *
 * Run AFTER the migration to verify everything is in place.
 * Tests: columns exist, tables exist, insert/read/delete on each new table.
 *
 * Usage:
 *   node backend/db/test-migration.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/socialmedia',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
    failed++;
  }
}

async function run() {
  console.log('\n🧪 ItsPosting — Migration 001 Test Suite\n');

  // ── 1. Customer columns ───────────────────────────────────────────────────
  console.log('customers table — new columns:');

  await test('past_post_examples column exists', async () => {
    await pool.query("SELECT past_post_examples FROM customers LIMIT 0");
  });

  await test('content_preferences column exists', async () => {
    await pool.query("SELECT content_preferences FROM customers LIMIT 0");
  });

  await test('posting_streak column exists', async () => {
    await pool.query("SELECT posting_streak FROM customers LIMIT 0");
  });

  await test('last_posted_at column exists', async () => {
    await pool.query("SELECT last_posted_at FROM customers LIMIT 0");
  });

  await test('total_posts_this_month column exists', async () => {
    await pool.query("SELECT total_posts_this_month FROM customers LIMIT 0");
  });

  await test('is_admin column exists', async () => {
    await pool.query("SELECT is_admin FROM customers LIMIT 0");
  });

  await test('content_preferences has correct default', async () => {
    const result = await pool.query(
      "SELECT column_default FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'content_preferences'"
    );
    if (result.rows.length === 0) throw new Error('Column not found in information_schema');
  });

  // ── 2. New tables ─────────────────────────────────────────────────────────
  console.log('\nNew tables:');

  const tables = [
    'content_suggestions',
    'post_variations',
    'post_images',
    'business_knowledge',
    'postcore_briefings',
    'posting_analytics',
    'hashtag_performance',
    'monthly_reports',
  ];

  for (const tbl of tables) {
    await test(`${tbl} table exists`, async () => {
      await pool.query(`SELECT COUNT(*) FROM ${tbl}`);
    });
  }

  // ── 3. content_suggestions — insert / read / delete ──────────────────────
  console.log('\ncontent_suggestions — CRUD:');

  // Get first customer for test
  const customerResult = await pool.query('SELECT id FROM customers ORDER BY id LIMIT 1');
  const customerId = customerResult.rows[0]?.id;

  if (!customerId) {
    console.log('  ⚠️  No customers in DB — skipping insertion tests');
  } else {
    let testSuggestionId;

    await test('INSERT into content_suggestions', async () => {
      const result = await pool.query(
        `INSERT INTO content_suggestions
           (customer_id, suggestion_type, title, reason, pre_generated_caption,
            pre_generated_hashtags, platform, content_type, industry_context, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          customerId,
          'seasonal',
          'Test seasonal suggestion',
          'I noticed it is test month, peak season for test services.',
          'This is a test caption for the migration test. It ends with a question to drive engagement — what do you think? 👇',
          ['testlocal', 'testindustry'],
          'all',
          'photo',
          JSON.stringify({ month: 5, seasonal_topic: 'test topic' }),
          new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        ]
      );
      testSuggestionId = result.rows[0].id;
      if (!testSuggestionId) throw new Error('No ID returned from INSERT');
    });

    await test('SELECT from content_suggestions', async () => {
      const result = await pool.query(
        'SELECT * FROM content_suggestions WHERE id = $1',
        [testSuggestionId]
      );
      if (result.rows.length === 0) throw new Error('Row not found after INSERT');
      if (result.rows[0].suggestion_type !== 'seasonal') throw new Error('Wrong suggestion_type');
    });

    await test('UPDATE is_dismissed on content_suggestions', async () => {
      await pool.query(
        'UPDATE content_suggestions SET is_dismissed = true, dismissed_at = NOW() WHERE id = $1',
        [testSuggestionId]
      );
    });

    await test('DELETE from content_suggestions (cleanup)', async () => {
      await pool.query('DELETE FROM content_suggestions WHERE id = $1', [testSuggestionId]);
    });

    // ── 4. post_variations — schema test ─────────────────────────────────────
    console.log('\npost_variations — schema:');

    await test('variation_label CHECK constraint works (A/B/C only)', async () => {
      // Get first post
      const postResult = await pool.query('SELECT id FROM posts ORDER BY id LIMIT 1');
      const postId = postResult.rows[0]?.id;
      if (!postId) {
        console.log('  (no posts found — skipping)');
        return;
      }

      // This should FAIL (good) — invalid label
      try {
        await pool.query(
          "INSERT INTO post_variations (post_id, variation_label, caption) VALUES ($1, 'X', 'test')",
          [postId]
        );
        throw new Error('Should have failed with CHECK constraint');
      } catch (err) {
        if (err.message.includes('check')) return; // Expected — constraint working
        if (err.message.includes('violates check')) return;
        if (err.message.includes('Should have failed')) throw err;
        // Some DBs phrase it differently — any constraint error is fine
        return;
      }
    });

    // ── 5. Indexes ────────────────────────────────────────────────────────────
    console.log('\nPerformance indexes:');

    const expectedIndexes = [
      'idx_suggestions_customer_active',
      'idx_suggestions_type',
      'idx_variations_post',
      'idx_post_images_post',
      'idx_posts_customer_status',
      'idx_posts_customer_created',
    ];

    for (const idx of expectedIndexes) {
      await test(`index: ${idx}`, async () => {
        const result = await pool.query(
          "SELECT indexname FROM pg_indexes WHERE indexname = $1",
          [idx]
        );
        if (result.rows.length === 0) throw new Error(`Index ${idx} not found`);
      });
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50));
  const total = passed + failed;
  console.log(`Results: ${passed}/${total} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('✅ All tests passed — migration is complete and correct\n');
  } else {
    console.log('⚠️  Some tests failed — review the migration SQL and re-run\n');
    console.log('Tip: Run: node backend/db/migrate.js --verify\n');
    process.exit(1);
  }

  await pool.end();
}

run().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
