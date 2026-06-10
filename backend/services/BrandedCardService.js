/**
 * BrandedCardService — generates Canva-style branded social media cards using Sharp.
 *
 * Three layout variations, each 1080×1350px (Instagram 4:5 — works on all platforms):
 *   A — Full Color:  solid primary brand color background, centered white text
 *   B — Bold Split:  top 42% color block / bottom 58% white, strong typographic hierarchy
 *   C — Side Accent: left brand color bar, white background, left-aligned dark text
 *
 * Brand colors are read from customer.brand_colors (set at /settings?tab=branding).
 * Falls back to ItsPosting defaults if not configured.
 *
 * No AI image generation used — pure Sharp + SVG compositing, same approach as Studio.
 */

const sharp = require('sharp');

const W = 1080;
const H = 1350;

// ── Text helpers (copied from studio.js) ────────────────────────────────────

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text, maxChars) {
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (candidate.length > maxChars && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ── Color helpers ────────────────────────────────────────────────────────────

function parseColor(hex) {
  const h = (hex || '#3B82F6').replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) || 59,
    g: parseInt(h.slice(2, 4), 16) || 130,
    b: parseInt(h.slice(4, 6), 16) || 246,
  };
}

function resolveBrandColors(customer) {
  const defaults = { primary: '#3B82F6', secondary: '#10B981', accent: '#8B5CF6' };
  if (!customer?.brand_colors) return defaults;
  try {
    const bc = typeof customer.brand_colors === 'string'
      ? JSON.parse(customer.brand_colors)
      : customer.brand_colors;
    return {
      primary:   bc.primary   || defaults.primary,
      secondary: bc.secondary || defaults.secondary,
      accent:    bc.accent    || defaults.accent,
    };
  } catch {
    return defaults;
  }
}

// ── Layout A — Full Color ────────────────────────────────────────────────────
// Solid primary brand color background. Centered white headline + subtext + CTA pill.
// Business name anchored at bottom center.

async function buildLayoutA(headline, subtext, ctaText, businessName, colors, fp) {
  const { r, g, b } = parseColor(colors.primary);
  const secColor = colors.secondary || '#10B981';

  const headLines = wrapText(escapeXml(headline), 18);
  const subLines  = wrapText(escapeXml(subtext),  34);

  const lineH    = 72;
  const subLineH = 36;
  const ctaH     = ctaText ? 96 : 0;
  const totalH   = headLines.length * lineH
    + (subLines.length ? 36 + subLines.length * subLineH : 0)
    + ctaH;
  const startY = Math.floor((H - totalH) / 2);

  const parts = [
    // Depth gradient overlay — makes it feel 3D instead of flat
    `<defs>
      <linearGradient id="depthA" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0.32"/>
        <stop offset="50%"  stop-color="#000000" stop-opacity="0.00"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.28"/>
      </linearGradient>
    </defs>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#depthA)"/>`,
    // Decorative accent — top left corner triangle
    `<polygon points="0,0 320,0 0,280" fill="${secColor}" opacity="0.20"/>`,
    // Decorative accent — bottom right corner triangle
    `<polygon points="${W},${H} ${W - 280},${H} ${W},${H - 240}" fill="${secColor}" opacity="0.15"/>`,
    // Horizontal accent bar above headline
    `<rect x="${540 - 60}" y="${startY - 28}" width="120" height="5" rx="2.5" fill="${secColor}" opacity="0.90"/>`,
  ];

  const fw = fp?.typographyWeight === 1 ? '800' : '900';
  headLines.forEach((l, i) => {
    parts.push(`<text x="540" y="${startY + i * lineH}" font-family="Arial,Helvetica,sans-serif" font-size="64" font-weight="${fw}" fill="#ffffff" stroke="#000000" stroke-width="6" stroke-opacity="0.25" paint-order="stroke fill" text-anchor="middle" dominant-baseline="hanging">${l}</text>`);
  });

  const subStartY = startY + headLines.length * lineH + 36;
  subLines.forEach((l, i) => {
    parts.push(`<text x="540" y="${subStartY + i * subLineH}" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="400" fill="#ffffff" text-anchor="middle" dominant-baseline="hanging" opacity="0.88">${l}</text>`);
  });

  if (ctaText) {
    const ctaY = subStartY + subLines.length * subLineH + 44;
    const ctaW = Math.min(560, Math.max(340, ctaText.length * 18 + 80));
    const ctaX = 540 - ctaW / 2;
    const ctaRx = fp?.cornerRadiusLg || 31;
    parts.push(`<rect x="${ctaX}" y="${ctaY}" width="${ctaW}" height="62" rx="${ctaRx}" fill="#ffffff"/>`);
    parts.push(`<text x="540" y="${ctaY + 20}" font-family="Arial,Helvetica,sans-serif" font-size="23" font-weight="800" fill="${colors.primary}" text-anchor="middle" dominant-baseline="hanging">${escapeXml(ctaText.toUpperCase())}</text>`);
  }

  if (businessName) {
    parts.push(`<text x="540" y="${H - 44}" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="600" fill="#ffffff" text-anchor="middle" dominant-baseline="auto" opacity="0.60">${escapeXml(businessName)}</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;

  return sharp({ create: { width: W, height: H, channels: 3, background: { r, g, b } } })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Layout B — Bold Split ────────────────────────────────────────────────────
// Top 42% is brand primary color with large white headline.
// Bottom 58% is white with dark subtext + colored CTA button.
// Business name bottom-right.

async function buildLayoutB(headline, subtext, ctaText, businessName, colors, fp) {
  const splitY = Math.floor(H * 0.42);

  const headLines = wrapText(escapeXml(headline), 16);
  const subLines  = wrapText(escapeXml(subtext),  36);

  const headLineH = 66;
  const headTotalH = headLines.length * headLineH;
  const headStartY = Math.floor((splitY - headTotalH) / 2);

  const subStartY = splitY + 56;
  const subLineH  = 38;

  const parts = [
    `<defs>
      <linearGradient id="topGradB" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.00"/>
      </linearGradient>
    </defs>`,
    `<rect x="0" y="0" width="${W}" height="${splitY}" fill="${colors.primary}"/>`,
    `<rect x="0" y="0" width="${W}" height="${splitY}" fill="url(#topGradB)"/>`,
    // Bold accent bar — left-aligned, sits at the split seam
    `<rect x="60" y="${splitY - 8}" width="140" height="${fp?.accentBarThickness || 8}" rx="4" fill="${colors.secondary}"/>`,
    // Secondary accent dot cluster
    `<circle cx="${W - 80}" cy="${Math.floor(splitY * 0.35)}" r="30" fill="${colors.secondary}" opacity="0.18"/>`,
    `<circle cx="${W - 80}" cy="${Math.floor(splitY * 0.35)}" r="18" fill="${colors.secondary}" opacity="0.25"/>`,
  ];

  const fwB = fp?.typographyWeight === 1 ? '800' : '900';
  headLines.forEach((l, i) => {
    parts.push(`<text x="540" y="${headStartY + i * headLineH}" font-family="Arial,Helvetica,sans-serif" font-size="58" font-weight="${fwB}" fill="#ffffff" stroke="#000000" stroke-width="6" stroke-opacity="0.22" paint-order="stroke fill" text-anchor="middle" dominant-baseline="hanging">${l}</text>`);
  });

  subLines.forEach((l, i) => {
    parts.push(`<text x="540" y="${subStartY + i * subLineH}" font-family="Arial,Helvetica,sans-serif" font-size="27" font-weight="400" fill="#1a1a2a" text-anchor="middle" dominant-baseline="hanging">${l}</text>`);
  });

  if (ctaText) {
    const ctaY = subStartY + subLines.length * subLineH + 52;
    const ctaW = Math.min(560, Math.max(340, ctaText.length * 18 + 80));
    const ctaX = 540 - ctaW / 2;
    parts.push(`<rect x="${ctaX}" y="${ctaY}" width="${ctaW}" height="62" rx="${fp?.cornerRadiusLg || 31}" fill="${colors.primary}"/>`);
    parts.push(`<text x="540" y="${ctaY + 20}" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="hanging">${escapeXml(ctaText.toUpperCase())}</text>`);
  }

  if (businessName) {
    parts.push(`<text x="1020" y="${H - 24}" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="500" fill="#aaaaaa" text-anchor="end" dominant-baseline="auto">${escapeXml(businessName)}</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;

  return sharp({ create: { width: W, height: H, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

// ── Layout C — Side Accent ───────────────────────────────────────────────────
// White background with 64px left brand color bar.
// Large dark left-aligned headline. Decorative circles on the bar.
// CTA as styled text link (no button).

async function buildLayoutC(headline, subtext, ctaText, businessName, colors, fp) {
  const barW  = 64;
  const textX = barW + 48; // 112px from left edge

  const headLines = wrapText(escapeXml(headline), 15);
  const subLines  = wrapText(escapeXml(subtext),  32);

  const headLineH = 70;
  const subLineH  = 38;
  const ctaH      = ctaText ? 66 : 0;
  const totalH    = headLines.length * headLineH
    + (subLines.length ? 32 + subLines.length * subLineH : 0)
    + ctaH;
  const startY = Math.floor((H - totalH) / 2);

  const parts = [
    `<rect x="0" y="0" width="${barW}" height="${H}" fill="${colors.primary}"/>`,
    // Decorative accent circles on bar
    `<circle cx="${barW / 2}" cy="${Math.floor(H * 0.28)}" r="22" fill="${colors.secondary}" opacity="0.9"/>`,
    `<circle cx="${barW / 2}" cy="${Math.floor(H * 0.68)}" r="14" fill="${colors.accent}" opacity="0.75"/>`,
  ];

  const fwC = fp?.typographyWeight === 1 ? '800' : '900';
  headLines.forEach((l, i) => {
    parts.push(`<text x="${textX}" y="${startY + i * headLineH}" font-family="Arial,Helvetica,sans-serif" font-size="56" font-weight="${fwC}" fill="#1a1a2a" text-anchor="start" dominant-baseline="hanging">${l}</text>`);
  });

  const subStartY = startY + headLines.length * headLineH + 32;
  subLines.forEach((l, i) => {
    parts.push(`<text x="${textX}" y="${subStartY + i * subLineH}" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="400" fill="#444444" text-anchor="start" dominant-baseline="hanging">${l}</text>`);
  });

  if (ctaText) {
    const ctaY = subStartY + subLines.length * subLineH + 44;
    parts.push(`<text x="${textX}" y="${ctaY}" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="700" fill="${colors.primary}" text-anchor="start" dominant-baseline="hanging">${escapeXml(ctaText)} →</text>`);
  }

  if (businessName) {
    parts.push(`<text x="${textX}" y="${H - 36}" font-family="Arial,Helvetica,sans-serif" font-size="19" font-weight="500" fill="#bbbbbb" text-anchor="start" dominant-baseline="auto">${escapeXml(businessName)}</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;

  return sharp({ create: { width: W, height: H, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

// ── Layout D — Testimonial Quote Card ────────────────────────────────────────
// Dark premium background (deep navy + subtle brand tint). Massive decorative
// open/close quote marks as ghost watermarks. Gold stars centered. Quote text
// (headline) large and white. Attribution (subtext) in secondary color.
// Canva/Envato testimonial card DNA — for got_review content without a photo.

async function buildLayoutD(headline, subtext, ctaText, businessName, colors, fp) {
  const { r, g, b } = parseColor(colors.primary);
  const secColor = colors.secondary || '#F59E0B';

  // Deep navy background with subtle brand color tint
  const bgR = Math.round(10 * 0.92 + r * 0.08);
  const bgG = Math.round(15 * 0.92 + g * 0.08);
  const bgB = Math.round(28 * 0.92 + b * 0.08);

  const quoteLines = wrapText(escapeXml(headline), 22);
  const attrLines  = wrapText(escapeXml(subtext || ''), 34);
  const quoteLineH = 54;
  const attrLineH  = 34;

  const starsY      = Math.floor(H * 0.30);
  const quoteStartY = starsY + 76;
  const quoteEndY   = quoteStartY + quoteLines.length * quoteLineH;
  const attrY       = quoteEndY + 36;

  const parts = [
    `<defs>
      <linearGradient id="topAccD" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${colors.primary}" stop-opacity="0.30"/>
        <stop offset="100%" stop-color="${colors.primary}" stop-opacity="0.00"/>
      </linearGradient>
      <linearGradient id="botAccD" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${colors.primary}" stop-opacity="0.00"/>
        <stop offset="100%" stop-color="${colors.primary}" stop-opacity="0.22"/>
      </linearGradient>
    </defs>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#topAccD)"/>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#botAccD)"/>`,
    // Top accent bar + subtle side lines
    `<rect x="0" y="0" width="${W}" height="${fp?.accentBarThickness || 8}" fill="${secColor}"/>`,
    `<rect x="0" y="8" width="4" height="${H - 8}" fill="${secColor}" opacity="0.40"/>`,
    `<rect x="${W - 4}" y="8" width="4" height="${H - 8}" fill="${secColor}" opacity="0.40"/>`,
    // Ghost open-quote — enormous background watermark
    `<text x="36" y="160" font-family="Arial,Helvetica,sans-serif" font-size="380" font-weight="900" fill="${secColor}" opacity="0.07" dominant-baseline="hanging">&#x201C;</text>`,
    // Ghost close-quote — bottom-right counterpoint
    `<text x="${W - 50}" y="${H - 80}" font-family="Arial,Helvetica,sans-serif" font-size="280" font-weight="900" fill="${secColor}" opacity="0.07" text-anchor="end" dominant-baseline="auto">&#x201D;</text>`,
  ];

  // Business name — top center, subtle
  parts.push(`<text x="540" y="64" font-family="Arial,Helvetica,sans-serif" font-size="21" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" opacity="0.65">${escapeXml(businessName)}</text>`);

  // 5 gold stars — centered, prominent
  parts.push(`<text x="540" y="${starsY}" font-family="Arial,Helvetica,sans-serif" font-size="44" fill="${secColor}" text-anchor="middle" dominant-baseline="hanging">&#x2605;&#x2605;&#x2605;&#x2605;&#x2605;</text>`);

  // Quote text — centered, white, large, the design hero
  quoteLines.forEach((l, i) => {
    parts.push(`<text x="540" y="${quoteStartY + i * quoteLineH}" font-family="Arial,Helvetica,sans-serif" font-size="46" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="hanging">${l}</text>`);
  });

  // Attribution — secondary color, em-dash prefix
  attrLines.forEach((l, i) => {
    const prefix = i === 0 ? '— ' : '';
    parts.push(`<text x="540" y="${attrY + i * attrLineH}" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="500" fill="${secColor}" text-anchor="middle" dominant-baseline="hanging">${escapeXml(prefix + l)}</text>`);
  });

  // CTA pill — centered
  if (ctaText) {
    const ctaW = Math.min(520, Math.max(280, ctaText.length * 16 + 80));
    const ctaX = 540 - ctaW / 2;
    const ctaY = H - 148;
    parts.push(`<rect x="${ctaX}" y="${ctaY}" width="${ctaW}" height="64" rx="${fp?.cornerRadiusLg || 32}" fill="${secColor}"/>`);
    parts.push(`<text x="540" y="${ctaY + 22}" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="hanging">${escapeXml(ctaText.toUpperCase())}</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;

  return sharp({ create: { width: W, height: H, channels: 3, background: { r: bgR, g: bgG, b: bgB } } })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Design seed (same pattern as PhotoCardService) ───────────────────────────

function computeDesignSeedB(customerId, businessName) {
  const str = `${customerId || 0}|${businessName || ''}`;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash;
}

function getDesignFingerprintB(customer) {
  const seed = computeDesignSeedB(customer?.id, customer?.business_name);
  return {
    colorRole:    (seed >> 18) % 2,
    decorDensity: (seed >> 15) % 3,
    lineupOffset: (seed >> 3) % 3,
  };
}

// Merge monthly DesignAdvisor params on top of per-customer fingerprint.
// Customer-specific values (colorRole, decorDensity, lineupOffset) are preserved.
function mergeDesignParamsB(fp, dp) {
  if (!dp) return fp;
  return {
    ...fp,
    typographyWeight:   dp.headlineFontWeight === '800' ? 1 : 0,
    accentBarThickness: dp.accentBarThickness  || 8,
    cornerRadiusMd:     dp.cornerRadiusMd      || 8,
    cornerRadiusLg:     dp.cornerRadiusLg      || 31,
  };
}

// ── Layout E — "Dot Matrix" ──────────────────────────────────────────────────
// Brand primary background with an overlay of small white dots in a grid.
// Ultra-modern pattern — stands apart from solid-color Layout A.
// Large white centered headline, secondary-color accent bar, white CTA pill.

async function buildLayoutE(headline, subtext, ctaText, businessName, colors, fingerprint) {
  const { r, g, b } = parseColor(colors.primary);
  const secColor = colors.secondary || '#F59E0B';
  const dotSpacing = 36;
  const dotRadius  = 2.2;

  // Build dot grid SVG pattern
  const dotRows = [];
  for (let dy = dotSpacing; dy < H; dy += dotSpacing) {
    for (let dx = dotSpacing; dx < W; dx += dotSpacing) {
      dotRows.push(`<circle cx="${dx}" cy="${dy}" r="${dotRadius}" fill="#ffffff" opacity="0.14"/>`);
    }
  }

  const headLines = wrapText(escapeXml(headline), 18);
  const subLines  = wrapText(escapeXml(subtext), 34);
  const lineH     = 68;
  const subLineH  = 36;
  const totalH    = headLines.length * lineH + (subLines.length ? 32 + subLines.length * subLineH : 0) + (ctaText ? 88 : 0);
  const startY    = Math.floor((H - totalH) / 2);

  const parts = [
    // Dot grid
    ...dotRows,
    // Subtle radial glow at center
    `<defs><radialGradient id="glowE" cx="50%" cy="45%" r="55%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.12"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0.00"/></radialGradient></defs>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#glowE)"/>`,
    // Horizontal accent bar above headline
    `<rect x="${540 - 80}" y="${startY - 32}" width="160" height="5" rx="2.5" fill="${secColor}"/>`,
  ];

  const fwE = fp?.typographyWeight === 1 ? '800' : '900';
  headLines.forEach((l, i) => {
    parts.push(`<text x="540" y="${startY + i * lineH}" font-family="Arial,Helvetica,sans-serif" font-size="62" font-weight="${fwE}" letter-spacing="-1.5" fill="#ffffff" text-anchor="middle" dominant-baseline="hanging">${l}</text>`);
  });

  const subStartY = startY + headLines.length * lineH + 32;
  subLines.forEach((l, i) => {
    parts.push(`<text x="540" y="${subStartY + i * subLineH}" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="400" fill="#ffffff" opacity="0.80" text-anchor="middle" dominant-baseline="hanging">${l}</text>`);
  });

  if (ctaText) {
    const ctaY = subStartY + subLines.length * subLineH + 44;
    const ctaW = Math.min(520, Math.max(300, ctaText.length * 16 + 80));
    const ctaX = 540 - ctaW / 2;
    parts.push(`<rect x="${ctaX}" y="${ctaY}" width="${ctaW}" height="58" rx="${fp?.cornerRadiusLg || 29}" fill="#ffffff"/>`);
    parts.push(`<text x="540" y="${ctaY + 29}" font-family="Arial,Helvetica,sans-serif" font-size="21" font-weight="800" fill="${colors.primary}" text-anchor="middle" dominant-baseline="middle">${escapeXml(ctaText.toUpperCase())}</text>`);
  }

  if (businessName) {
    parts.push(`<text x="540" y="${H - 44}" font-family="Arial,Helvetica,sans-serif" font-size="19" font-weight="600" fill="#ffffff" text-anchor="middle" dominant-baseline="auto" opacity="0.55">${escapeXml(businessName)}</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  return sharp({ create: { width: W, height: H, channels: 3, background: { r, g, b } } })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Layout F — "Diagonal Split" ──────────────────────────────────────────────
// Brand primary on the left (behind a diagonal cut), brand secondary on the right.
// White text left-aligned in the primary zone. Bold typography, very editorial.
// Headline positioned upper-left; CTA lower-left; business name anchored bottom.

async function buildLayoutF(headline, subtext, ctaText, businessName, colors, fingerprint) {
  const headLines = wrapText(escapeXml(headline), 14);
  const subLines  = wrapText(escapeXml(subtext), 26);
  const padX      = 70;
  const lineH     = 72;
  const subLineH  = 38;

  const headStartY = 200;
  const headEndY   = headStartY + headLines.length * lineH;
  const subStartY  = headEndY + 28;

  const secColor = colors.secondary || '#F59E0B';

  const parts = [
    `<defs>
      <linearGradient id="leftF" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${colors.primary}"/>
        <stop offset="100%" stop-color="${colors.primary}"/>
      </linearGradient>
    </defs>`,
    // Full secondary background
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${colors.secondary}"/>`,
    // Diagonal primary zone — covers left ~68% with a diagonal right edge
    `<polygon points="0,0 820,0 620,${H} 0,${H}" fill="${colors.primary}"/>`,
    // Accent diagonal stripe at the seam
    `<polygon points="820,0 860,0 660,${H} 620,${H}" fill="rgba(0,0,0,0.18)"/>`,
    // Top accent bar
    `<rect x="0" y="0" width="${W}" height="${fp?.accentBarThickness || 8}" fill="${secColor}" opacity="0.60"/>`,
    // Large ghost letter — watermark for visual depth
    `<text x="${padX - 20}" y="120" font-family="Arial,Helvetica,sans-serif" font-size="480" font-weight="900" fill="${secColor}" opacity="0.07" dominant-baseline="hanging">${escapeXml(headline.charAt(0) || 'A')}</text>`,
  ];

  // Business name top
  if (businessName) {
    parts.push(`<text x="${padX}" y="52" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle" opacity="0.75">${escapeXml(businessName)}</text>`);
  }

  // Headline — large, white, left-aligned
  const fwF = fp?.typographyWeight === 1 ? '800' : '900';
  headLines.forEach((l, i) => {
    parts.push(`<text x="${padX}" y="${headStartY + i * lineH}" font-family="Arial,Helvetica,sans-serif" font-size="70" font-weight="${fwF}" letter-spacing="-2" fill="#ffffff" dominant-baseline="hanging">${l}</text>`);
  });

  // Accent divider
  parts.push(`<rect x="${padX}" y="${headEndY + 16}" width="140" height="5" rx="2.5" fill="${secColor}"/>`);

  // Subtext
  subLines.forEach((l, i) => {
    parts.push(`<text x="${padX}" y="${subStartY + i * subLineH}" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="400" fill="#ffffff" opacity="0.82" dominant-baseline="hanging">${l}</text>`);
  });

  if (ctaText) {
    const ctaW = Math.min(480, Math.max(260, ctaText.length * 16 + 80));
    const ctaY = H - 180;
    parts.push(`<rect x="${padX}" y="${ctaY}" width="${ctaW}" height="64" rx="${fp?.cornerRadiusLg || 32}" fill="#ffffff"/>`);
    parts.push(`<text x="${padX + ctaW / 2}" y="${ctaY + 32}" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="800" fill="${colors.primary}" text-anchor="middle" dominant-baseline="middle">${escapeXml(ctaText.toUpperCase())}</text>`);
  }

  if (businessName) {
    parts.push(`<text x="${padX}" y="${H - 48}" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="500" fill="#ffffff" dominant-baseline="auto" opacity="0.50">${escapeXml(businessName)}</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  return sharp({ create: { width: W, height: H, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Layout G — "Two-Tone Stack" ──────────────────────────────────────────────
// Near-black premium background with strong brand-color accent elements.
// Brand-color block contains the eyebrow/tagline. White headline below.
// Very premium, announcement-style card. Great for milestones and promos.

async function buildLayoutG(headline, subtext, ctaText, businessName, colors, fingerprint) {
  const { r, g, b } = parseColor('#0a0b14');
  const secColor  = colors.secondary || '#F59E0B';
  const headLines = wrapText(escapeXml(headline), 20);
  const subLines  = wrapText(escapeXml(subtext), 36);

  // Derive a slightly lighter version of primary for the accent block
  const { r: pr, g: pg, b: pb } = parseColor(colors.primary);

  const accentBlockY = 280;
  const accentBlockH = 90;
  const headStartY   = accentBlockY + accentBlockH + 44;
  const lineH        = 72;
  const subStartY    = headStartY + headLines.length * lineH + 32;
  const subLineH     = 38;
  const padX         = 80;

  const parts = [
    `<defs>
      <linearGradient id="bgG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${colors.primary}" stop-opacity="0.20"/>
        <stop offset="100%" stop-color="${colors.primary}" stop-opacity="0.00"/>
      </linearGradient>
      <linearGradient id="botG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${colors.primary}" stop-opacity="0.00"/>
        <stop offset="100%" stop-color="${colors.primary}" stop-opacity="0.18"/>
      </linearGradient>
    </defs>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#bgG)"/>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#botG)"/>`,
    // Top accent bar
    `<rect x="0" y="0" width="${W}" height="${fp?.accentBarThickness || 8}" fill="${secColor}"/>`,
    // Left accent bar
    `<rect x="0" y="8" width="6" height="${H - 8}" fill="${secColor}" opacity="0.40"/>`,
    // Right accent bar
    `<rect x="${W - 6}" y="8" width="6" height="${H - 8}" fill="${secColor}" opacity="0.40"/>`,
    // Ghost open-quote watermark
    `<text x="${padX - 30}" y="90" font-family="Arial,Helvetica,sans-serif" font-size="320" font-weight="900" fill="${colors.primary}" opacity="0.12" dominant-baseline="hanging">&#x201C;</text>`,
    // Brand color accent block — holds eyebrow/tagline
    `<rect x="${padX}" y="${accentBlockY}" width="${W - padX * 2}" height="${accentBlockH}" rx="${fp?.cornerRadiusMd || 8}" fill="rgba(${pr},${pg},${pb},0.90)"/>`,
  ];

  // Business name top center
  if (businessName) {
    parts.push(`<text x="540" y="64" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" opacity="0.60">${escapeXml(businessName)}</text>`);
  }

  // Eyebrow inside accent block
  const eyebrowText = subLines[0] ? subLines[0] : (businessName || '');
  parts.push(`<text x="540" y="${accentBlockY + accentBlockH / 2}" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="700" letter-spacing="1.5" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${escapeXml(eyebrowText.toUpperCase().slice(0, 40))}</text>`);

  // Headline — white, large
  const fwG = fp?.typographyWeight === 1 ? '800' : '900';
  headLines.forEach((l, i) => {
    parts.push(`<text x="540" y="${headStartY + i * lineH}" font-family="Arial,Helvetica,sans-serif" font-size="64" font-weight="${fwG}" letter-spacing="-1.5" fill="#ffffff" text-anchor="middle" dominant-baseline="hanging">${l}</text>`);
  });

  // Divider
  parts.push(`<rect x="${540 - 60}" y="${headStartY + headLines.length * lineH + 16}" width="120" height="4" rx="2" fill="${secColor}"/>`);

  // Remaining subtext lines
  subLines.slice(1).forEach((l, i) => {
    parts.push(`<text x="540" y="${subStartY + i * subLineH}" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="400" fill="#ffffff" opacity="0.72" text-anchor="middle" dominant-baseline="hanging">${l}</text>`);
  });

  if (ctaText) {
    const ctaW = Math.min(500, Math.max(280, ctaText.length * 16 + 80));
    const ctaX = 540 - ctaW / 2;
    const ctaY = H - 168;
    parts.push(`<rect x="${ctaX}" y="${ctaY}" width="${ctaW}" height="62" rx="${fp?.cornerRadiusLg || 31}" fill="${secColor}"/>`);
    parts.push(`<text x="540" y="${ctaY + 31}" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${escapeXml(ctaText.toUpperCase())}</text>`);
  }

  if (businessName) {
    parts.push(`<text x="540" y="${H - 48}" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="500" fill="#ffffff" text-anchor="middle" dominant-baseline="auto" opacity="0.40">${escapeXml(businessName)}</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  return sharp({ create: { width: W, height: H, channels: 3, background: { r, g, b } } })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Branded card lineup map (seed-driven, same pattern as PhotoCardService) ───
const BRANDED_LINEUP_MAP = {
  'got_review':     [['D','A','G'], ['D','G','B'], ['G','D','A']],
  'promotion':      [['A','F','B'], ['F','G','A'], ['G','A','E']],
  'seasonal':       [['A','G','F'], ['E','A','G'], ['F','G','B']],
  'share_tip':      [['B','E','C'], ['C','F','B'], ['E','G','B']],
  'faq':            [['B','C','E'], ['E','B','G'], ['C','F','B']],
  'team_spotlight': [['C','A','G'], ['G','B','C'], ['A','G','E']],
  'community':      [['A','B','F'], ['F','C','G'], ['G','E','A']],
  'milestone':      [['G','A','D'], ['D','G','F'], ['A','G','D']],
  'default':        [['A','B','C'], ['E','F','G'], ['B','G','E']],
};

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Generate 3 branded card layout variations for a given post.
 * wizardTrigger routes content types to their best-fit leading layout:
 *   got_review → Layout D (Testimonial Quote) leads
 *   all others → Layout A leads
 * @param {Object} customer     - Customer row with brand_colors, business_name
 * @param {string} headline     - Short punchy headline (≤8 words)
 * @param {string} subtext      - Supporting context (1–2 sentences)
 * @param {string} ctaText      - Call to action (≤5 words)
 * @param {string} wizardTrigger - Content type from wizard step 1 (optional)
 * @returns {{ bufferA, bufferB, bufferC }} — JPEG buffers ready for Cloudinary upload
 */
const BRANDED_BUILDERS = {
  A: buildLayoutA,
  B: buildLayoutB,
  C: buildLayoutC,
  D: buildLayoutD,
  E: buildLayoutE,
  F: buildLayoutF,
  G: buildLayoutG,
};

async function generateBrandedCards(customer, headline, subtext, ctaText, wizardTrigger = null, designParams = null) {
  const colors       = resolveBrandColors(customer);
  const businessName = customer?.business_name || '';
  const fp           = mergeDesignParamsB(getDesignFingerprintB(customer), designParams);

  const lineups = BRANDED_LINEUP_MAP[wizardTrigger] || BRANDED_LINEUP_MAP['default'];
  const [lA, lB, lC] = lineups[fp.lineupOffset % lineups.length];

  const [bufferA, bufferB, bufferC] = await Promise.all([
    BRANDED_BUILDERS[lA](headline, subtext, ctaText, businessName, colors, fp),
    BRANDED_BUILDERS[lB](headline, subtext, ctaText, businessName, colors, fp),
    BRANDED_BUILDERS[lC](headline, subtext, ctaText, businessName, colors, fp),
  ]);

  return { bufferA, bufferB, bufferC };
}

module.exports = { generateBrandedCards, resolveBrandColors, parseColor };
