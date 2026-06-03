/**
 * Generates Apple iOS splash screen PNGs for all common device sizes.
 * Run once: node scripts/generate-splash.js
 * Output: frontend/public/splash/
 */
const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const SPLASH_DIR = path.join(__dirname, '../frontend/public/splash');
const ICON_PATH  = path.join(__dirname, '../frontend/public/icon-512.png');

// Background matches the app dark theme
const BG = { r: 7, g: 7, b: 14, alpha: 1 };

// Every size Apple ever listed, portrait orientation
const SIZES = [
  { w: 640,  h: 1136, name: 'apple-splash-640-1136'  },  // iPhone SE 1st gen
  { w: 750,  h: 1334, name: 'apple-splash-750-1334'  },  // iPhone 6/7/8
  { w: 828,  h: 1792, name: 'apple-splash-828-1792'  },  // iPhone XR / 11
  { w: 1080, h: 1920, name: 'apple-splash-1080-1920' },  // iPhone 6+/7+/8+ (display-scaled)
  { w: 1125, h: 2436, name: 'apple-splash-1125-2436' },  // iPhone X / XS / 11 Pro
  { w: 1170, h: 2532, name: 'apple-splash-1170-2532' },  // iPhone 12 / 13 / 14
  { w: 1179, h: 2556, name: 'apple-splash-1179-2556' },  // iPhone 14 Pro / 15 Pro
  { w: 1242, h: 2208, name: 'apple-splash-1242-2208' },  // iPhone 6+ / 7+ / 8+ (native)
  { w: 1242, h: 2688, name: 'apple-splash-1242-2688' },  // iPhone XS Max / 11 Pro Max
  { w: 1284, h: 2778, name: 'apple-splash-1284-2778' },  // iPhone 12/13 Pro Max, 14 Plus
  { w: 1290, h: 2796, name: 'apple-splash-1290-2796' },  // iPhone 15 Plus / 15 Pro Max
  { w: 1536, h: 2048, name: 'apple-splash-1536-2048' },  // iPad mini / Air 9.7" / 10.2"
  { w: 1668, h: 2224, name: 'apple-splash-1668-2224' },  // iPad Pro 10.5"
  { w: 1668, h: 2388, name: 'apple-splash-1668-2388' },  // iPad Air 4/5 / iPad Pro 11"
  { w: 2048, h: 2732, name: 'apple-splash-2048-2732' },  // iPad Pro 12.9"
];

async function generate() {
  if (!fs.existsSync(SPLASH_DIR)) fs.mkdirSync(SPLASH_DIR, { recursive: true });

  const iconBuf = fs.readFileSync(ICON_PATH);

  for (const { w, h, name } of SIZES) {
    // Icon size: 1/4 of the shorter dimension, min 120, max 256
    const iconSize = Math.min(256, Math.max(120, Math.round(Math.min(w, h) / 4)));

    const resizedIcon = await sharp(iconBuf)
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    const iconLeft = Math.round((w - iconSize) / 2);
    const iconTop  = Math.round((h - iconSize) / 2) - Math.round(h * 0.04); // slightly above center

    await sharp({
      create: { width: w, height: h, channels: 4, background: BG },
    })
      .composite([{ input: resizedIcon, left: iconLeft, top: iconTop }])
      .png({ compressionLevel: 9 })
      .toFile(path.join(SPLASH_DIR, `${name}.png`));

    console.log(`  ✓  ${name}.png  (${w}×${h})`);
  }

  console.log(`\nGenerated ${SIZES.length} splash screens → frontend/public/splash/`);
  console.log('\nAdd these <link> tags to frontend/pages/_app.js <Head>:');
  for (const { w, h, name } of SIZES) {
    const scale = w <= 750 ? 2 : 3;
    const dw = Math.round(w / scale);
    const dh = Math.round(h / scale);
    console.log(`  <link rel="apple-touch-startup-image" media="screen and (device-width: ${dw}px) and (device-height: ${dh}px) and (-webkit-device-pixel-ratio: ${scale}) and (orientation: portrait)" href="/splash/${name}.png" />`);
  }
}

generate().catch(err => { console.error(err); process.exit(1); });
