/**
 * Standalone test for VideoSlideService — run from backend/ directory:
 *   node test-video-slide.js
 *
 * Needs in .env: GOOGLE_AI_API_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 * No database, no auth, no wizard needed.
 */

require('dotenv').config();
const VideoSlideService = require('./services/VideoSlideService');

const service = new VideoSlideService();

// Fake customer — mirrors a real DB row
const customer = {
  id: 9999,
  business_name: "Mike's Plumbing",
  industry: 'plumbing',
  location: 'Dallas, TX',
  tone: 'professional',
  brand_color: '#1565C0',
};

// Test every content type so we see all 8 frame plans
const CONTENT_TYPES = [
  'job_finished',
  'got_review',
  'share_tip',
  'promotion',
  'seasonal',
  'team_spotlight',
  'faq',
  'community',
];

async function runTest(contentType) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Testing: ${contentType}`);
  console.log('─'.repeat(60));

  const start = Date.now();
  try {
    const result = await service.generate(customer, 'Test caption script', {
      contentType,
      aspectRatio: '9:16',
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✅ SUCCESS (${elapsed}s)`);
    console.log(`   Provider: ${result.provider}`);
    console.log(`   URL: ${result.url}`);
    return { contentType, ok: true, url: result.url, elapsed };
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`❌ FAILED (${elapsed}s): ${err.message}`);
    return { contentType, ok: false, error: err.message, elapsed };
  }
}

async function main() {
  console.log('\n🎬 VideoSlideService — local test');
  console.log(`GOOGLE_AI_API_KEY: ${process.env.GOOGLE_AI_API_KEY ? '✓ set' : '✗ MISSING'}`);
  console.log(`CLOUDINARY_CLOUD_NAME: ${process.env.CLOUDINARY_CLOUD_NAME ? '✓ set' : '✗ MISSING'}`);

  if (!service.isAvailable()) {
    console.error('\n❌ Service not available — check GOOGLE_AI_API_KEY and CLOUDINARY_CLOUD_NAME in .env');
    process.exit(1);
  }

  // Default: just test job_finished (fastest to verify the pipeline works)
  // To test all 8 types: node test-video-slide.js --all
  const testAll = process.argv.includes('--all');
  const types = testAll ? CONTENT_TYPES : ['job_finished'];

  const results = [];
  for (const ct of types) {
    results.push(await runTest(ct));
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log('SUMMARY');
  console.log('═'.repeat(60));
  results.forEach(r => {
    const icon = r.ok ? '✅' : '❌';
    console.log(`${icon} ${r.contentType.padEnd(20)} ${r.elapsed}s${r.ok ? '  ' + r.url.substring(0, 55) + '...' : '  ' + r.error}`);
  });

  const failed = results.filter(r => !r.ok);
  if (failed.length === 0) {
    console.log('\n✅ All tests passed. Copy a URL above and open it in your browser to watch the Reel.');
  } else {
    console.log(`\n❌ ${failed.length} test(s) failed.`);
    process.exit(1);
  }
}

main();
