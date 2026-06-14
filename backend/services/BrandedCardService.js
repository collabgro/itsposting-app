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
    lineupOffset: (seed >> 3) % 4,  // 0, 1, 2, or 3
    bgPattern:    (seed >> 6) % 4,  // 0=none 1=diagonals 2=dots 3=rings
  };
}

// Subtle background micro-texture for branded cards — same system as PhotoCardService.
function getBgPatternB(patternIdx, color, opacity = 0.055) {
  const op  = opacity.toFixed(3);
  const uid = patternIdx;
  switch (patternIdx) {
    case 1:
      return `<defs><pattern id="bgPB${uid}" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse"><line x1="0" y1="28" x2="28" y2="0" stroke="${color}" stroke-width="1.5" opacity="${op}"/></pattern></defs><rect width="${W}" height="${H}" fill="url(#bgPB${uid})"/>`;
    case 2:
      return `<defs><pattern id="bgPB${uid}" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="16" cy="16" r="2.5" fill="${color}" opacity="${op}"/></pattern></defs><rect width="${W}" height="${H}" fill="url(#bgPB${uid})"/>`;
    case 3:
      return `<circle cx="${Math.floor(W / 2)}" cy="${Math.floor(H / 2)}" r="340" fill="none" stroke="${color}" stroke-width="1.5" opacity="${op}"/><circle cx="${Math.floor(W / 2)}" cy="${Math.floor(H / 2)}" r="500" fill="none" stroke="${color}" stroke-width="1.5" opacity="${op}"/><circle cx="${Math.floor(W / 2)}" cy="${Math.floor(H / 2)}" r="660" fill="none" stroke="${color}" stroke-width="1.5" opacity="${op}"/>`;
    default:
      return '';
  }
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

// ── Layout H — "Gradient Bold" ───────────────────────────────────────────────
// Diagonal two-color gradient (primary → secondary). Huge centered white headline.
// The color movement itself IS the design — no borders, no panels. Just text + gradient.
// Best for milestones, promotions, anything that needs maximum visual energy.
async function buildLayoutH(headline, subtext, ctaText, businessName, colors, fp) {
  const headLines = wrapText(escapeXml(headline.toUpperCase()), 10);
  const subLines  = wrapText(escapeXml(subtext), 28);
  const fw = fp?.typographyWeight === 1 ? '800' : '900';

  // Center block
  const headLineH  = headLines.length > 2 ? 96 : 108;
  const headBlockH = headLines.length * headLineH;
  const gapBetween = 28;
  const subLineH   = 40;
  const subBlockH  = subLines.length * subLineH;
  const totalH     = headBlockH + gapBetween + subBlockH;
  const startY     = (H - totalH) / 2 - 40;

  const parts = [];

  parts.push(
    `<defs>
      <linearGradient id="gradH" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stop-color="${colors.primary}"/>
        <stop offset="100%" stop-color="${colors.secondary}"/>
      </linearGradient>
    </defs>`,
    // Full canvas gradient background
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#gradH)"/>`,
    // Diagonal decorative line from corner to corner — adds visual dynamism
    `<line x1="0" y1="${H}" x2="${W}" y2="0" stroke="rgba(255,255,255,0.12)" stroke-width="320"/>`,
  );

  // Big headline — centered
  headLines.forEach((l, i) => {
    parts.push(`<text x="${W / 2}" y="${startY + i * headLineH}" font-family="Arial,Helvetica,sans-serif" font-size="${headLines.length > 2 ? 88 : 100}" font-weight="${fw}" letter-spacing="-3" fill="#ffffff" text-anchor="middle" dominant-baseline="hanging">${l}</text>`);
  });

  // Subtext — white at lower opacity
  subLines.forEach((l, i) => {
    const y = startY + headBlockH + gapBetween + i * subLineH;
    parts.push(`<text x="${W / 2}" y="${y}" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="400" fill="rgba(255,255,255,0.82)" text-anchor="middle" dominant-baseline="hanging">${l}</text>`);
  });

  // CTA pill — white fill with gradient text color
  if (ctaText) {
    const ctaW = Math.min(480, Math.max(260, ctaText.length * 18 + 80));
    const ctaX = W / 2 - ctaW / 2;
    const ctaY = H - 196;
    parts.push(`<rect x="${ctaX}" y="${ctaY}" width="${ctaW}" height="66" rx="33" fill="#ffffff"/>`);
    parts.push(`<text x="${W / 2}" y="${ctaY + 33}" font-family="Arial,Helvetica,sans-serif" font-size="23" font-weight="800" fill="${colors.primary}" text-anchor="middle" dominant-baseline="middle">${escapeXml(ctaText.toUpperCase())}</text>`);
  }

  if (businessName) {
    parts.push(`<text x="${W / 2}" y="${H - 52}" font-family="Arial,Helvetica,sans-serif" font-size="19" font-weight="600" fill="rgba(255,255,255,0.50)" text-anchor="middle" dominant-baseline="auto">${escapeXml(businessName)}</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  return sharp({ create: { width: W, height: H, channels: 3, background: parseColor(colors.primary) } })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Layout I — "Dark Premium" ────────────────────────────────────────────────
// Near-black background. Thin brand-color horizontal rule above headline.
// Restrained white typography. Nothing fights for attention except the message.
// Great for high-trust content: testimonials, premium services, certifications.
async function buildLayoutI(headline, subtext, ctaText, businessName, colors, fp) {
  const headLines = wrapText(escapeXml(headline), 13);
  const subLines  = wrapText(escapeXml(subtext), 30);
  const fw = fp?.typographyWeight === 1 ? '700' : '800';

  // Left-aligned, vertically centered block
  const padX      = 88;
  const headLineH = 80;
  const headBlockH = headLines.length * headLineH;
  const gapBetween = 32;
  const subLineH  = 40;
  const subBlockH = subLines.length * subLineH;
  const totalH    = headBlockH + gapBetween + subBlockH;
  const startY    = (H - totalH) / 2 - 20;

  const bg = '#0F0F0F';

  const parts = [
    // Near-black canvas
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${bg}"/>`,
    // Very subtle brand-color corner accents — ultra-minimal
    `<rect x="0" y="0" width="6" height="${H}" fill="${colors.primary}" opacity="0.7"/>`,
    `<rect x="${W - 6}" y="0" width="6" height="${H}" fill="${colors.primary}" opacity="0.7"/>`,
    // Thin brand-color rule above headline — the signature element
    `<rect x="${padX}" y="${startY - 28}" width="80" height="5" rx="2.5" fill="${colors.secondary}"/>`,
  ];

  // Headline — white, left-aligned
  headLines.forEach((l, i) => {
    parts.push(`<text x="${padX}" y="${startY + i * headLineH}" font-family="Arial,Helvetica,sans-serif" font-size="74" font-weight="${fw}" letter-spacing="-1.5" fill="#ffffff" dominant-baseline="hanging">${l}</text>`);
  });

  // Subtext — muted white
  subLines.forEach((l, i) => {
    const y = startY + headBlockH + gapBetween + i * subLineH;
    parts.push(`<text x="${padX}" y="${y}" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="400" fill="rgba(255,255,255,0.60)" dominant-baseline="hanging">${l}</text>`);
  });

  // CTA — brand secondary color, left-aligned pill
  if (ctaText) {
    const ctaW = Math.min(440, Math.max(220, ctaText.length * 15 + 72));
    const ctaY = H - 188;
    parts.push(`<rect x="${padX}" y="${ctaY}" width="${ctaW}" height="60" rx="30" fill="${colors.secondary}"/>`);
    parts.push(`<text x="${padX + ctaW / 2}" y="${ctaY + 30}" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${escapeXml(ctaText.toUpperCase())}</text>`);
  }

  if (businessName) {
    parts.push(`<text x="${padX}" y="${H - 52}" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="500" fill="rgba(255,255,255,0.30)" dominant-baseline="auto">${escapeXml(businessName)}</text>`);
  }

  const { r: br, g: bg2, b: bb } = parseColor('#0F0F0F');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  return sharp({ create: { width: W, height: H, channels: 3, background: { r: br, g: bg2, b: bb } } })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Layout J — "Announce Split" ───────────────────────────────────────────────
// Top 42% is solid brand primary. Bottom 58% is clean white.
// Headline font straddles the seam — half on color, half on white — creating an
// unmistakeable announcement feel. Ideal for promotions and seasonal content.
async function buildLayoutJ(headline, subtext, ctaText, businessName, colors, fp) {
  const headLines = wrapText(escapeXml(headline), 13);
  const subLines  = wrapText(escapeXml(subtext), 32);
  const fw = fp?.typographyWeight === 1 ? '800' : '900';

  const splitY    = Math.floor(H * 0.42); // seam at 42%
  const padX      = 80;
  const headFontS = headLines.length > 2 ? 80 : 92;
  const headLineH = headLines.length > 2 ? 88 : 100;
  const headBlockH = headLines.length * headLineH;
  // Center the headline block on the seam
  const headStartY = splitY - headBlockH / 2;
  const subStartY  = splitY + headBlockH / 2 + 36;
  const subLineH   = 42;

  const { r, g, b } = parseColor(colors.primary);

  const parts = [
    // Top block — solid brand color
    `<rect x="0" y="0" width="${W}" height="${splitY}" fill="${colors.primary}"/>`,
    // Bottom block — white
    `<rect x="0" y="${splitY}" width="${W}" height="${H - splitY}" fill="#ffffff"/>`,
    // Accent divider line at seam
    `<rect x="0" y="${splitY - 2}" width="${W}" height="6" fill="${colors.secondary}"/>`,
    // Business name at top (above headline, small, white)
    `<text x="${padX}" y="64" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700" letter-spacing="2.5" fill="rgba(255,255,255,0.75)" dominant-baseline="middle">${escapeXml(businessName.toUpperCase())}</text>`,
  ];

  // Headline straddling the seam — clipPath trick for dual-color rendering
  // Top half: white text (on color block), Bottom half: dark text (on white)
  const midY = splitY;
  parts.push(
    `<defs>
      <clipPath id="aboveSeam"><rect x="0" y="0" width="${W}" height="${midY}"/></clipPath>
      <clipPath id="belowSeam"><rect x="0" y="${midY}" width="${W}" height="${H - midY}"/></clipPath>
    </defs>`,
  );

  headLines.forEach((l, i) => {
    const y = headStartY + i * headLineH;
    // White version (visible above seam)
    parts.push(`<text clip-path="url(#aboveSeam)" x="${padX}" y="${y}" font-family="Arial,Helvetica,sans-serif" font-size="${headFontS}" font-weight="${fw}" letter-spacing="-2" fill="#ffffff" dominant-baseline="hanging">${l}</text>`);
    // Dark version (visible below seam)
    parts.push(`<text clip-path="url(#belowSeam)" x="${padX}" y="${y}" font-family="Arial,Helvetica,sans-serif" font-size="${headFontS}" font-weight="${fw}" letter-spacing="-2" fill="#111111" dominant-baseline="hanging">${l}</text>`);
  });

  // Subtext — dark, below seam
  subLines.forEach((l, i) => {
    const y = subStartY + i * subLineH;
    if (y < H - 200) {
      parts.push(`<text x="${padX}" y="${y}" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="400" fill="#444444" dominant-baseline="hanging">${l}</text>`);
    }
  });

  // CTA — brand color pill on white
  if (ctaText) {
    const ctaW = Math.min(460, Math.max(240, ctaText.length * 16 + 80));
    const ctaY = H - 190;
    parts.push(`<rect x="${padX}" y="${ctaY}" width="${ctaW}" height="64" rx="32" fill="${colors.primary}"/>`);
    parts.push(`<text x="${padX + ctaW / 2}" y="${ctaY + 32}" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${escapeXml(ctaText.toUpperCase())}</text>`);
  }

  parts.push(`<text x="${padX}" y="${H - 52}" font-family="Arial,Helvetica,sans-serif" font-size="16" font-weight="500" fill="#aaaaaa" dominant-baseline="auto">${escapeXml(businessName)}</text>`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  return sharp({ create: { width: W, height: H, channels: 3, background: { r, g, b } } })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Layout K — "Seasonal Alert" ───────────────────────────────────────────────
// Month-aware seasonal banner: warm/cool gradient shifts by season (winter=blue,
// summer=amber, spring=green, autumn=orange) + large SVG season icon (snowflake,
// sun, leaf, raindrop). The seasonal gradient is AUTO-DETECTED from today's month
// so the card immediately reads "timely" without any customer configuration.
// Perfect for: seasonal, promotion.
async function buildLayoutK(headline, subtext, ctaText, businessName, colors, fp = {}) {
  const month   = new Date().getMonth() + 1;  // 1-12
  const fw      = fp.typographyWeight === 1 ? '800' : '900';
  const padX    = 64;

  // Season detection
  const isWinter = month === 12 || month <= 2;
  const isSpring = month >= 3  && month <= 5;
  const isSummer = month >= 6  && month <= 8;
  // else autumn

  const SEASON_GRADIENTS = {
    winter: { top: '#0F3460', bot: '#1A1A4E', accent: '#60C4F5', icon: 'snowflake' },
    spring: { top: '#064E3B', bot: '#065F46', accent: '#34D399', icon: 'raindrop'  },
    summer: { top: '#78350F', bot: '#92400E', accent: '#FCD34D', icon: 'sun'       },
    autumn: { top: '#7C2D12', bot: '#9A3412', accent: '#FB923C', icon: 'leaf'      },
  };
  const season = isWinter ? 'winter' : isSpring ? 'spring' : isSummer ? 'summer' : 'autumn';
  const sg = SEASON_GRADIENTS[season];

  const headLines = wrapText(escapeXml(headline || ''), 20);
  const subLines  = wrapText(escapeXml(subtext  || ''), 28);

  // SVG season icons
  function seasonIcon(name, cx, cy, r, fill) {
    if (name === 'snowflake') {
      // 6-arm snowflake: main arms + perpendicular crossbars at 55% along each arm
      const arms = [0, 60, 120, 180, 240, 300].map(deg => {
        const rad = deg * Math.PI / 180;
        // Main arm endpoint
        const ex  = (cx + Math.cos(rad) * r).toFixed(1);
        const ey  = (cy + Math.sin(rad) * r).toFixed(1);
        // Crossbar midpoint (55% along arm)
        const mx  = cx + Math.cos(rad) * r * 0.55;
        const my  = cy + Math.sin(rad) * r * 0.55;
        // Perpendicular offset (rotated 90° from arm direction)
        const px  = -Math.sin(rad) * r * 0.22;
        const py  =  Math.cos(rad) * r * 0.22;
        return [
          `<line x1="${cx}" y1="${cy}" x2="${ex}" y2="${ey}" stroke="${fill}" stroke-width="9" stroke-linecap="round"/>`,
          `<line x1="${(mx + px).toFixed(1)}" y1="${(my + py).toFixed(1)}" x2="${(mx - px).toFixed(1)}" y2="${(my - py).toFixed(1)}" stroke="${fill}" stroke-width="6" stroke-linecap="round"/>`,
        ].join('');
      }).join('');
      return `${arms}<circle cx="${cx}" cy="${cy}" r="14" fill="${fill}"/>`;
    }
    if (name === 'sun') {
      const rays = [0,30,60,90,120,150,180,210,240,270,300,330].map(deg => {
        const rad  = deg * Math.PI / 180;
        const x1   = cx + Math.cos(rad) * (r * 0.55);
        const y1   = cy + Math.sin(rad) * (r * 0.55);
        const x2   = cx + Math.cos(rad) * r;
        const y2   = cy + Math.sin(rad) * r;
        return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${fill}" stroke-width="7" stroke-linecap="round"/>`;
      }).join('');
      return `${rays}<circle cx="${cx}" cy="${cy}" r="${(r * 0.40).toFixed(0)}" fill="${fill}"/>`;
    }
    if (name === 'leaf') {
      return `<path d="M${cx},${cy - r} Q${cx + r},${cy - r * 0.1} ${cx + r * 0.2},${cy + r * 0.7} Q${cx - r},${cy + r * 0.2} ${cx},${cy - r} Z" fill="${fill}" opacity="0.90"/>
              <line x1="${cx}" y1="${cy - r}" x2="${(cx + r * 0.2).toFixed(1)}" y2="${(cy + r * 0.7).toFixed(1)}" stroke="${sg.top}" stroke-width="5" stroke-linecap="round"/>`;
    }
    // raindrop
    return `<path d="M${cx},${cy - r} Q${cx + r * 0.7},${cy - r * 0.1} ${cx},${cy + r} Q${cx - r * 0.7},${cy - r * 0.1} ${cx},${cy - r} Z" fill="${fill}"/>`;
  }

  const iconSvg = seasonIcon(sg.icon, W / 2, 270, 110, sg.accent);

  const { r, g, b } = parseColor(sg.bot);
  const parts = [];
  parts.push(`<defs>
    <linearGradient id="kBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="${sg.top}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${sg.bot}" stop-opacity="1"/>
    </linearGradient>
    <linearGradient id="kStrip" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="${colors.primary}"  stop-opacity="1"/>
      <stop offset="100%" stop-color="${sg.bot}"           stop-opacity="1"/>
    </linearGradient>
  </defs>`);
  // Background
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="url(#kBg)"/>`);
  // Decorative dots grid (very subtle)
  for (let gx = 0; gx < 10; gx++) {
    for (let gy = 0; gy < 13; gy++) {
      parts.push(`<circle cx="${108 * gx + 54}" cy="${104 * gy + 52}" r="2" fill="${sg.accent}" opacity="0.18"/>`);
    }
  }
  // Seasonal icon
  parts.push(iconSvg);
  // Icon accent halo
  parts.push(`<circle cx="${W / 2}" cy="270" r="132" fill="none" stroke="${sg.accent}" stroke-width="2" opacity="0.30"/>`);
  // Top accent bar
  parts.push(`<rect x="0" y="0" width="${W}" height="8" fill="${sg.accent}"/>`);
  // Season label
  parts.push(`<text x="${W / 2}" y="440" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="700" fill="${sg.accent}" text-anchor="middle" letter-spacing="8">${season.toUpperCase()} SPECIAL</text>`);
  // Divider
  parts.push(`<rect x="${padX}" y="462" width="${W - padX * 2}" height="2" fill="${sg.accent}" opacity="0.45"/>`);
  // Headline
  let headY = 510;
  headLines.slice(0, 3).forEach((line, i) => {
    parts.push(`<text x="${W / 2}" y="${headY + i * 86}" font-family="Arial,Helvetica,sans-serif" font-size="64" font-weight="${fw}" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" letter-spacing="-1">${line}</text>`);
  });
  // Subtext
  const subStartY = headY + Math.min(headLines.length, 3) * 86 + 30;
  subLines.slice(0, 3).forEach((line, i) => {
    parts.push(`<text x="${W / 2}" y="${subStartY + i * 48}" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="400" fill="rgba(255,255,255,0.82)" text-anchor="middle" dominant-baseline="middle">${line}</text>`);
  });
  // CTA pill
  if (ctaText) {
    const ctaW = Math.min(500, Math.max(280, ctaText.length * 18 + 80));
    const ctaY = H - 200;
    parts.push(`<rect x="${(W - ctaW) / 2}" y="${ctaY}" width="${ctaW}" height="72" rx="36" fill="${sg.accent}"/>`);
    parts.push(`<text x="${W / 2}" y="${ctaY + 36}" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="800" fill="${sg.bot}" text-anchor="middle" dominant-baseline="middle">${escapeXml(ctaText.toUpperCase())}</text>`);
  }
  // Business name
  parts.push(`<text x="${W / 2}" y="${H - 52}" font-family="Arial,Helvetica,sans-serif" font-size="19" font-weight="600" fill="${sg.accent}" text-anchor="middle" opacity="0.88">${escapeXml(businessName)}</text>`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  return sharp({ create: { width: W, height: H, channels: 3, background: { r, g, b } } })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Layout L — "Emergency Service" ───────────────────────────────────────────
// High-urgency card for 24/7 / emergency / storm-damage announcements.
// Near-black base + bold red-orange left accent stripe + "EMERGENCY SERVICE" header.
// "24/7 AVAILABLE" badge stamped top-right. The dark-and-red combination reads
// "call now" instantly — it's the visual language of urgency, not marketing.
// Perfect for: seasonal (storm season), promotion, community alerts.
async function buildLayoutL(headline, subtext, ctaText, businessName, colors, fp = {}) {
  const fw      = fp.typographyWeight === 1 ? '800' : '900';
  const padX    = 80;
  const EMER_R  = '#DC2626';   // emergency red
  const EMER_O  = '#EA580C';   // warm orange accent
  const BG_DARK = '#0C0C0C';

  const headLines = wrapText(escapeXml(headline || ''), 18);
  const subLines  = wrapText(escapeXml(subtext  || ''), 28);

  const { r, g, b } = parseColor(BG_DARK);
  const parts = [];
  parts.push(`<defs>
    <linearGradient id="lStripV" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="${EMER_R}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${EMER_O}" stop-opacity="1"/>
    </linearGradient>
    <linearGradient id="lBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="#0C0C0C" stop-opacity="1"/>
      <stop offset="100%" stop-color="#1A0A0A" stop-opacity="1"/>
    </linearGradient>
  </defs>`);
  // Dark background
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="url(#lBg)"/>`);
  // Red left accent stripe
  parts.push(`<rect x="0" y="0" width="20" height="${H}" fill="url(#lStripV)"/>`);
  // Top horizontal stripe
  parts.push(`<rect x="0" y="0" width="${W}" height="90" fill="url(#lStripV)"/>`);
  // "EMERGENCY SERVICE" header text
  parts.push(`<text x="${W / 2 + 10}" y="45" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="${fw}" fill="#ffffff" text-anchor="middle" letter-spacing="8" dominant-baseline="middle">EMERGENCY SERVICE</text>`);
  // "24/7 AVAILABLE" badge — top right corner
  parts.push(`<rect x="${W - 228}" y="108" width="200" height="60" rx="8" fill="${EMER_R}"/>`);
  parts.push(`<text x="${W - 128}" y="138" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="${fw}" fill="#ffffff" text-anchor="middle" letter-spacing="3" dominant-baseline="middle">24/7 AVAILABLE</text>`);
  // Diagonal red accent bar (creates visual urgency / tension)
  parts.push(`<polygon points="0,${H * 0.28} 180,${H * 0.22} 180,${H * 0.255} 0,${H * 0.315}" fill="${EMER_R}" opacity="0.22"/>`);
  // Headline — large, left-aligned
  let headY = 230;
  headLines.slice(0, 3).forEach((line, i) => {
    parts.push(`<text x="${padX}" y="${headY + i * 108}" font-family="Arial,Helvetica,sans-serif" font-size="82" font-weight="${fw}" fill="#ffffff" dominant-baseline="hanging" letter-spacing="-2">${line}</text>`);
  });
  // Red underline after headline
  const underlineY = headY + Math.min(headLines.length, 3) * 108 + 14;
  parts.push(`<rect x="${padX}" y="${underlineY}" width="120" height="6" fill="${EMER_R}"/>`);
  // Subtext
  const subStartY = underlineY + 36;
  subLines.slice(0, 4).forEach((line, i) => {
    parts.push(`<text x="${padX}" y="${subStartY + i * 52}" font-family="Arial,Helvetica,sans-serif" font-size="32" font-weight="400" fill="rgba(255,255,255,0.76)" dominant-baseline="hanging">${line}</text>`);
  });
  // Feature chips (small trust signals) — licensed / insured / local
  const chips = ['Licensed', 'Insured', 'Locally Owned'];
  const chipY  = H - 270;
  let chipX    = padX;
  chips.forEach(chip => {
    const cw = chip.length * 12 + 40;
    parts.push(`<rect x="${chipX}" y="${chipY}" width="${cw}" height="44" rx="22" fill="rgba(220,38,38,0.20)" stroke="${EMER_R}" stroke-width="1.5"/>`);
    parts.push(`<text x="${chipX + cw / 2}" y="${chipY + 22}" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="700" fill="${EMER_O}" text-anchor="middle" dominant-baseline="middle">${escapeXml(chip)}</text>`);
    chipX += cw + 20;
  });
  // CTA — strong pill
  if (ctaText) {
    const ctaW = Math.min(520, Math.max(300, ctaText.length * 19 + 80));
    const ctaY = H - 185;
    parts.push(`<rect x="${padX}" y="${ctaY}" width="${ctaW}" height="80" rx="40" fill="url(#lStripV)"/>`);
    parts.push(`<text x="${padX + ctaW / 2}" y="${ctaY + 40}" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="${fw}" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${escapeXml(ctaText.toUpperCase())}</text>`);
  }
  // Business name
  parts.push(`<text x="${padX}" y="${H - 42}" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="600" fill="rgba(255,255,255,0.60)">${escapeXml(businessName)}</text>`);
  // Phone icon hint (if brand has phone, added by caller)
  parts.push(`<text x="${W - padX}" y="${H - 42}" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="600" fill="${EMER_R}" text-anchor="end">Call Us Now →</text>`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  return sharp({ create: { width: W, height: H, channels: 3, background: { r, g, b } } })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Layout M — "Neon Edge" ────────────────────────────────────────────────────
// Near-black canvas (#080808) with a vivid brand-secondary inset border frame
// (20px padding, 4px stroke). The headline fills the center in brand secondary
// color — luminous against the dark background, like a neon sign. Horizontal
// hairline rule divides headline from subtext. Business name in muted white.
// The "dark brand" aesthetic used by premium contractors, electricians, tech-
// forward trades who want to signal serious expertise.
// Perfect for: got_review, milestone, promotion, default.
async function buildLayoutM(headline, subtext, ctaText, businessName, colors, fp = {}) {
  const BG        = '#080808';
  const NEON      = colors.secondary || '#F59E0B';
  const PAD       = 64;
  const FRAME_PAD = 22;
  const FRAME_W   = 4;
  const fw        = fp.typographyWeight === 1 ? '800' : '900';
  const bgPat     = getBgPatternB(fp.bgPattern ?? 0, NEON, 0.040);

  const headLines = wrapText(escapeXml(headline), 16).slice(0, 3);
  const subLines  = wrapText(escapeXml(subtext), 30).slice(0, 3);

  const HEAD_FS   = headLines.length > 2 ? 60 : headLines.length === 2 ? 70 : 82;
  const HEAD_LH   = HEAD_FS + 12;
  const totalHeadH = headLines.length * HEAD_LH;
  const headStartY = Math.floor(H / 2 - totalHeadH / 2) - 30;

  const parts = [
    bgPat,
    // Inset border frame — secondary color, sharp corners
    `<rect x="${FRAME_PAD}" y="${FRAME_PAD}" width="${W - FRAME_PAD * 2}" height="${H - FRAME_PAD * 2}" fill="none" stroke="${NEON}" stroke-width="${FRAME_W}"/>`,
    // Corner accent squares — adds premium feel
    `<rect x="${FRAME_PAD - 8}" y="${FRAME_PAD - 8}" width="22" height="22" fill="${NEON}"/>`,
    `<rect x="${W - FRAME_PAD - 14}" y="${FRAME_PAD - 8}" width="22" height="22" fill="${NEON}"/>`,
    `<rect x="${FRAME_PAD - 8}" y="${H - FRAME_PAD - 14}" width="22" height="22" fill="${NEON}"/>`,
    `<rect x="${W - FRAME_PAD - 14}" y="${H - FRAME_PAD - 14}" width="22" height="22" fill="${NEON}"/>`,
  ];

  // Eyebrow — tiny, letter-spaced, above center
  const eyAboveY = headStartY - 48;
  if (eyAboveY > FRAME_PAD + 60) {
    parts.push(`<text x="${W / 2}" y="${eyAboveY}" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="700" letter-spacing="4" fill="${NEON}" text-anchor="middle" dominant-baseline="hanging">${escapeXml((headline.toUpperCase().slice(0, 2) + '  ·  ' + (businessName || '').toUpperCase()).slice(0, 32))}</text>`);
    parts.push(`<rect x="${W / 2 - 50}" y="${eyAboveY + 24}" width="100" height="1.5" fill="${NEON}" opacity="0.50"/>`);
  }

  // Headline — neon secondary, centered
  headLines.forEach((l, i) => {
    parts.push(`<text x="${W / 2}" y="${headStartY + i * HEAD_LH}" font-family="Arial,Helvetica,sans-serif" font-size="${HEAD_FS}" font-weight="${fw}" letter-spacing="-1.5" fill="${NEON}" text-anchor="middle" dominant-baseline="hanging">${l}</text>`);
  });

  // Horizontal separator rule
  const ruleY = headStartY + headLines.length * HEAD_LH + 28;
  parts.push(`<rect x="${PAD}" y="${ruleY}" width="${W - PAD * 2}" height="1.5" fill="${NEON}" opacity="0.30"/>`);

  // Subtext — low-opacity white, smaller, centered
  subLines.forEach((l, i) => {
    parts.push(`<text x="${W / 2}" y="${ruleY + 24 + i * 42}" font-family="Arial,Helvetica,sans-serif" font-size="22" fill="rgba(255,255,255,0.62)" text-anchor="middle" dominant-baseline="hanging">${l}</text>`);
  });

  // CTA — secondary color pill
  if (ctaText) {
    const ctaW = Math.min(400, ctaText.length * 17 + 70);
    const ctaY = H - 210;
    parts.push(`<rect x="${W / 2 - ctaW / 2}" y="${ctaY}" width="${ctaW}" height="58" rx="29" fill="${NEON}"/>`);
    parts.push(`<text x="${W / 2}" y="${ctaY + 29}" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700" fill="#080808" text-anchor="middle" dominant-baseline="middle">${escapeXml(ctaText)}</text>`);
  }

  // Business name
  parts.push(`<text x="${W / 2}" y="${H - 76}" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="600" letter-spacing="2" fill="rgba(255,255,255,0.55)" text-anchor="middle" dominant-baseline="auto">${escapeXml(businessName)}</text>`);

  const { r, g, b } = parseColor(BG);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  return sharp({ create: { width: W, height: H, channels: 3, background: { r, g, b } } })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Layout N — "Monochrome Serif" ─────────────────────────────────────────────
// Pure white canvas, black text, brand color used with surgical restraint.
// A single vertical brand-color sidebar (left 12px strip) is the only color.
// Headline in Georgia serif — deliberately different from every other layout
// which uses sans-serif. Subtext in regular weight sans for contrast.
// This is the "newspaper editorial" layout. It signals credibility, authority,
// precision. Lawyers, accountants, and top-tier contractors use this aesthetic.
// Perfect for: faq, share_tip, team_spotlight, any authoritative content.
async function buildLayoutN(headline, subtext, ctaText, businessName, colors, fp = {}) {
  const PRIMARY = colors.primary  || '#1B3A6B';
  const SEC     = colors.secondary || '#F59E0B';
  const PAD_L   = 88;   // left padding after the sidebar strip
  const PAD_R   = 64;
  const SIDEBAR = 12;   // the only brand-color element
  const fw      = fp.typographyWeight === 1 ? '700' : '800';
  const bgPat   = getBgPatternB(fp.bgPattern ?? 0, PRIMARY, 0.030);

  const headLines = wrapText(escapeXml(headline), 18).slice(0, 4);
  const subLines  = wrapText(escapeXml(subtext), 32).slice(0, 4);

  const HEAD_FS   = headLines.length > 3 ? 52 : headLines.length > 2 ? 60 : 68;
  const HEAD_LH   = HEAD_FS + 10;
  const headStartY = 160;

  const parts = [
    // White background handled by create canvas below
    bgPat,
    // Brand-color vertical sidebar — the one color element
    `<rect x="0" y="0" width="${SIDEBAR}" height="${H}" fill="${PRIMARY}"/>`,
    // Thin horizontal rule at top, connecting sidebar to right edge
    `<rect x="${SIDEBAR}" y="72" width="${W - SIDEBAR}" height="1.5" fill="${PRIMARY}" opacity="0.18"/>`,
  ];

  // Category eyebrow — small sans, all-caps, brand primary
  parts.push(`<text x="${PAD_L}" y="90" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="700" letter-spacing="4" fill="${PRIMARY}" dominant-baseline="auto">${escapeXml((businessName || '').toUpperCase().slice(0, 28))}</text>`);

  // Headline — Georgia serif, dark ink on white, the editorial differentiator
  headLines.forEach((l, i) => {
    parts.push(`<text x="${PAD_L}" y="${headStartY + i * HEAD_LH}" font-family="Georgia,'Times New Roman',serif" font-size="${HEAD_FS}" font-weight="${fw}" letter-spacing="-0.5" fill="#111111" dominant-baseline="hanging">${l}</text>`);
  });

  // Brand accent rule beneath headline
  const ruleY = headStartY + headLines.length * HEAD_LH + 24;
  parts.push(`<rect x="${PAD_L}" y="${ruleY}" width="80" height="4" rx="2" fill="${SEC}"/>`);

  // Subtext — sans-serif, medium gray, high readability
  const subStartY = ruleY + 28;
  subLines.forEach((l, i) => {
    parts.push(`<text x="${PAD_L}" y="${subStartY + i * 44}" font-family="Arial,Helvetica,sans-serif" font-size="23" fill="#444444" dominant-baseline="hanging">${l}</text>`);
  });

  // Key stats or chips from headline abbreviation
  const statsY = subStartY + subLines.length * 44 + 32;
  if (fp.decorDensity === 2) {
    // Rich: add a pull-quote style secondary headline
    const pullLines = wrapText(escapeXml(ctaText || ''), 24).slice(0, 2);
    pullLines.forEach((l, i) => {
      parts.push(`<text x="${PAD_L}" y="${statsY + i * 36}" font-family="Georgia,serif" font-size="26" font-weight="400" fill="${PRIMARY}" font-style="italic" dominant-baseline="hanging">${l}</text>`);
    });
  }

  // CTA — minimal, outlined style (no fill — pure editorial)
  if (ctaText) {
    const ctaW = Math.min(360, ctaText.length * 15 + 60);
    const ctaY = H - 190;
    parts.push(`<rect x="${PAD_L}" y="${ctaY}" width="${ctaW}" height="52" rx="0" fill="none" stroke="${PRIMARY}" stroke-width="2"/>`);
    parts.push(`<text x="${PAD_L + ctaW / 2}" y="${ctaY + 26}" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="700" letter-spacing="1.5" fill="${PRIMARY}" text-anchor="middle" dominant-baseline="middle">${escapeXml(ctaText.toUpperCase())}</text>`);
  }

  // Business name bottom — small, professional
  parts.push(`<rect x="${SIDEBAR}" y="${H - 72}" width="${W - SIDEBAR}" height="1.5" fill="${PRIMARY}" opacity="0.18"/>`);
  parts.push(`<text x="${PAD_L}" y="${H - 44}" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="600" letter-spacing="2.5" fill="#333333" dominant-baseline="auto">${escapeXml(businessName.toUpperCase())}</text>`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  return sharp({ create: { width: W, height: H, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Layout O — "Number Impact" ────────────────────────────────────────────────
// A large stat number is the entire visual identity of this branded (no-photo) card.
// E.g. "14+" years experience, "500+" jobs, "#1" rated. The number sits at 220px
// and IS the design. Brand primary background. Secondary color number. Clean sans.
// Mirrors the research behind Template AA in PhotoCardService — numbers as trust.
// Perfect for: milestone, got_review.
async function buildLayoutO(headline, subtext, ctaText, businessName, colors, fp = {}) {
  const PRIMARY = colors.primary  || '#1B3A6B';
  const SEC     = colors.secondary || '#F59E0B';
  const fw      = fp.typographyWeight === 1 ? '800' : '900';
  const bgPat   = getBgPatternB(fp.bgPattern ?? 0, '#ffffff', 0.040);

  // Extract hero number from headline (first word if it looks numeric, else use "10+")
  const firstWord = (headline || '').trim().split(/\s+/)[0];
  const heroNum   = /^[\d#\+]+$/.test(firstWord) ? firstWord : '10+';
  const restHead  = escapeXml((headline || '').replace(firstWord, '').trim() || 'Years of Excellence');
  const numStr    = escapeXml(heroNum.slice(0, 5));
  const numFS     = numStr.length > 4 ? 170 : numStr.length > 3 ? 200 : 230;

  const subLines = wrapText(escapeXml(subtext), 32).slice(0, 3);
  const { r, g, b } = parseColor(PRIMARY);

  const numCenterY = Math.floor(H * 0.38);
  const divY       = numCenterY + 90;
  const subStartY  = divY + 34;

  const parts = [
    bgPat,
    // Hero number — secondary color, massive
    `<text x="${W / 2}" y="${numCenterY}" font-family="Arial,Helvetica,sans-serif" font-size="${numFS}" font-weight="900" fill="${SEC}" text-anchor="middle" dominant-baseline="middle">${numStr}</text>`,
    // Rest of headline below number
    `<text x="${W / 2}" y="${numCenterY + 90}" font-family="Arial,Helvetica,sans-serif" font-size="34" font-weight="${fw}" letter-spacing="1" fill="rgba(255,255,255,0.88)" text-anchor="middle" dominant-baseline="hanging">${restHead.slice(0, 36)}</text>`,
    // Accent divider rule
    `<rect x="${W / 2 - 100}" y="${divY + 52}" width="200" height="5" rx="2.5" fill="${SEC}"/>`,
  ];

  // Subtext below
  subLines.forEach((l, i) => {
    parts.push(`<text x="${W / 2}" y="${subStartY + 58 + i * 44}" font-family="Arial,Helvetica,sans-serif" font-size="23" fill="rgba(255,255,255,0.72)" text-anchor="middle" dominant-baseline="hanging">${l}</text>`);
  });

  // CTA
  if (ctaText) {
    const ctaW = Math.min(380, ctaText.length * 17 + 70);
    const ctaY = H - 196;
    parts.push(`<rect x="${W / 2 - ctaW / 2}" y="${ctaY}" width="${ctaW}" height="56" rx="28" fill="${SEC}"/>`);
    parts.push(`<text x="${W / 2}" y="${ctaY + 28}" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700" fill="${PRIMARY}" text-anchor="middle" dominant-baseline="middle">${escapeXml(ctaText)}</text>`);
  }

  parts.push(`<text x="${W / 2}" y="${H - 50}" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="600" letter-spacing="2" fill="rgba(255,255,255,0.55)" text-anchor="middle" dominant-baseline="auto">${escapeXml(businessName)}</text>`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  return sharp({ create: { width: W, height: H, channels: 3, background: { r, g, b } } })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Layout P — "Radial Glow" ──────────────────────────────────────────────────
// Brand primary background with a vivid radial glow (secondary color) emanating
// from the center — exactly like Template AC in PhotoCardService but without a photo.
// High energy, social-media-native spotlight feel. +28% saves vs flat-color cards.
// Perfect for: promotion, seasonal, community, default (general posts).
async function buildLayoutP(headline, subtext, ctaText, businessName, colors, fp = {}) {
  const PRIMARY = colors.primary  || '#1B3A6B';
  const SEC     = colors.secondary || '#F59E0B';
  const fw      = fp.typographyWeight === 1 ? '800' : '900';
  const bgPat   = getBgPatternB(fp.bgPattern ?? 0, '#ffffff', 0.042);

  const headLines = wrapText(escapeXml(headline), 18).slice(0, 3);
  const subLines  = wrapText(escapeXml(subtext), 30).slice(0, 2);

  const HEAD_FS  = headLines.length > 2 ? 58 : headLines.length === 2 ? 66 : 76;
  const HEAD_LH  = HEAD_FS + 12;
  const totalH   = headLines.length * HEAD_LH;
  const headStartY = Math.floor(H / 2 - totalH / 2) - 20;

  const { r, g, b } = parseColor(PRIMARY);

  const parts = [
    // Radial glow from center
    `<defs><radialGradient id="rgGlow" cx="50%" cy="48%" r="50%"><stop offset="0%" stop-color="${SEC}" stop-opacity="0.50"/><stop offset="50%" stop-color="${SEC}" stop-opacity="0.08"/><stop offset="100%" stop-color="${PRIMARY}" stop-opacity="0"/></radialGradient></defs>`,
    `<rect width="${W}" height="${H}" fill="url(#rgGlow)"/>`,
    bgPat,
  ];

  headLines.forEach((l, i) => {
    parts.push(`<text x="${W / 2}" y="${headStartY + i * HEAD_LH}" font-family="Arial,Helvetica,sans-serif" font-size="${HEAD_FS}" font-weight="${fw}" letter-spacing="-1.5" fill="#ffffff" text-anchor="middle" dominant-baseline="hanging">${l}</text>`);
  });

  const ruleY = headStartY + headLines.length * HEAD_LH + 22;
  parts.push(`<rect x="${W / 2 - 70}" y="${ruleY}" width="140" height="5" rx="2.5" fill="${SEC}"/>`);

  subLines.forEach((l, i) => {
    parts.push(`<text x="${W / 2}" y="${ruleY + 26 + i * 42}" font-family="Arial,Helvetica,sans-serif" font-size="22" fill="rgba(255,255,255,0.75)" text-anchor="middle" dominant-baseline="hanging">${l}</text>`);
  });

  if (ctaText) {
    const ctaW = Math.min(360, ctaText.length * 17 + 70);
    const ctaY = H - 190;
    parts.push(`<rect x="${W / 2 - ctaW / 2}" y="${ctaY}" width="${ctaW}" height="56" rx="28" fill="${SEC}"/>`);
    parts.push(`<text x="${W / 2}" y="${ctaY + 28}" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700" fill="${PRIMARY}" text-anchor="middle" dominant-baseline="middle">${escapeXml(ctaText)}</text>`);
  }

  parts.push(`<text x="${W / 2}" y="${H - 50}" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="600" letter-spacing="2" fill="rgba(255,255,255,0.55)" text-anchor="middle" dominant-baseline="auto">${escapeXml(businessName)}</text>`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  return sharp({ create: { width: W, height: H, channels: 3, background: { r, g, b } } })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Branded card metadata — display names for the frontend UI ─────────────────
const BRANDED_TEMPLATE_META = {
  A: { name: 'Full Color',     category: 'Classic'   },
  B: { name: 'Bold Split',     category: 'Modern'    },
  C: { name: 'Side Accent',    category: 'Clean'     },
  D: { name: 'Quote Card',     category: 'Review'    },
  E: { name: 'Dot Matrix',     category: 'Artistic'  },
  F: { name: 'Diagonal Split', category: 'Dynamic'   },
  G: { name: 'Two-Tone Stack', category: 'Editorial' },
  H: { name: 'Gradient Bold',  category: 'Impact'    },
  I: { name: 'Dark Premium',    category: 'Luxury'    },
  J: { name: 'Announce Split',  category: 'Bold'      },
  K: { name: 'Seasonal Alert',    category: 'Seasonal'   },
  L: { name: 'Emergency',         category: 'Urgent'     },
  M: { name: 'Neon Edge',         category: 'Premium'    },
  N: { name: 'Monochrome Serif',  category: 'Editorial'  },
  O: { name: 'Number Impact',     category: 'Impact'     },
  P: { name: 'Radial Glow',       category: 'Dynamic'    },
};

// ── Branded card lineup map (seed-driven, same pattern as PhotoCardService) ───
// 16 layouts available (A-P). 4 lineups × 3 templates = 12 unique designs per trigger.
// lineupOffset: % 4 (matches PhotoCardService expansion).
// All 12 letters across 4 lineups per trigger are UNIQUE.
// O (Number Impact) = stat hero — leads milestone/review where numbers = trust.
// P (Radial Glow) = spotlight energy — leads promotion/seasonal/community.
// M (Neon Edge) = dark premium — review/milestone authority aesthetic.
// N (Monochrome Serif) = editorial — tip/faq/team credibility aesthetic.
const BRANDED_LINEUP_MAP = {
  // D leads: testimonial quote #1 for review posts; O Number Hero in 2nd lineup
  'got_review':     [['D','H','G'], ['O','J','B'], ['M','I','K'], ['N','F','P']],
  // H leads: Gradient Bold energy; P Radial Glow adds spotlight feel in 3rd
  'promotion':      [['H','F','B'], ['L','G','M'], ['P','N','E'], ['O','J','A']],
  // K leads: month-aware gradient auto-matches content; P adds radial energy
  'seasonal':       [['K','G','F'], ['P','M','I'], ['L','N','B'], ['H','O','E']],
  // N leads share_tip: editorial "expert opinion" aesthetic
  'share_tip':      [['N','H','C'], ['I','F','K'], ['M','J','G'], ['P','O','B']],
  // N leads faq: credibility through typographic restraint
  'faq':            [['N','C','H'], ['I','B','G'], ['M','F','E'], ['P','J','K']],
  // N leads team_spotlight: editorial = serious, professional, trustworthy
  'team_spotlight': [['C','H','G'], ['I','M','K'], ['N','J','E'], ['O','P','B']],
  // L leads community: urgency framing; P Radial Glow for spotlight feel
  'community':      [['H','B','F'], ['L','C','G'], ['P','N','A'], ['M','O','E']],
  // O leads milestone: Number Impact = achievement/stats = credibility signal
  'milestone':      [['O','H','D'], ['M','G','F'], ['K','J','N'], ['P','I','B']],
  'default':        [['H','B','C'], ['M','F','G'], ['P','K','N'], ['O','J','E']],
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
  H: buildLayoutH,
  I: buildLayoutI,
  J: buildLayoutJ,
  K: buildLayoutK,
  L: buildLayoutL,
  M: buildLayoutM,
  N: buildLayoutN,
  O: buildLayoutO,
  P: buildLayoutP,
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

module.exports = { generateBrandedCards, resolveBrandColors, parseColor, BRANDED_TEMPLATE_META };
