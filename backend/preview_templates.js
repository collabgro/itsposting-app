/**
 * Preview test — renders all 3 photo card templates using the real PhotoCardService.
 * Run: node preview_templates.js
 * Output: preview_A.jpg, preview_B.jpg, preview_C.jpg
 */

const sharp = require('sharp');
const { generatePhotoCards } = require('./services/PhotoCardService');

const W = 1080, H = 1350;

// A realistic mock customer
const mockCustomer = {
  business_name: 'Mike\'s Plumbing',
  industry: 'plumbing',
  location: 'Dallas, TX',
  phone: '(214) 555-0123',
  brand_colors: { primary: '#1B3A6B', secondary: '#F59E0B', accent: '#3B82F6' },
  logo_url: null,
};

// A realistic mock cardOverlay (as Claude would produce)
const cardOverlay = {
  headline: 'Drain Cleared Fast',
  eyebrow: 'Licensed Plumber · Dallas TX',
  subtext: 'Same-day emergency service, flat-rate pricing.',
  cta: 'Call Today',
  badge: 'Available 24/7',
  services: ['24/7 Emergency Service', 'Licensed & Insured', 'Flat Rate Pricing'],
  uppercase: true,
  recommended: 'A',
};

async function run() {
  // Create a flat grey background to simulate a NanoBanana photo
  const photoBuffer = await sharp({
    create: { width: W, height: H, channels: 3, background: '#4A6741' }
  }).jpeg({ quality: 88 }).toBuffer();

  console.log('Generating 3 photo card templates...');
  const { bufferA, bufferB, bufferC } = await generatePhotoCards(photoBuffer, cardOverlay, mockCustomer);

  await Promise.all([
    sharp(bufferA).toFile('preview_A.jpg'),
    sharp(bufferB).toFile('preview_B.jpg'),
    sharp(bufferC).toFile('preview_C.jpg'),
  ]);

  console.log('Done: preview_A.jpg, preview_B.jpg, preview_C.jpg');
  console.log('Template A — Left Fade Pro (with plumbing icon top-left, phone icon in bottom bar)');
  console.log('Template B — Angular Impact (industry icon in dark corner, phone icon in right pill)');
  console.log('Template C — Top Card Window (industry icon in card, phone icon in bottom strip)');
}

run().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
