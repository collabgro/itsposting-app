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

async function buildLayoutA(headline, subtext, ctaText, businessName, colors) {
  const { r, g, b } = parseColor(colors.primary);

  const headLines = wrapText(escapeXml(headline), 18);
  const subLines  = wrapText(escapeXml(subtext),  34);

  const lineH    = 72;
  const subLineH = 36;
  const ctaH     = ctaText ? 96 : 0; // space for CTA pill
  const totalH   = headLines.length * lineH
    + (subLines.length ? 28 + subLines.length * subLineH : 0)
    + ctaH;
  const startY = Math.floor((H - totalH) / 2);

  const parts = [];

  headLines.forEach((l, i) => {
    parts.push(`<text x="540" y="${startY + i * lineH}" font-family="Arial,Helvetica,sans-serif" font-size="64" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="hanging">${l}</text>`);
  });

  const subStartY = startY + headLines.length * lineH + 28;
  subLines.forEach((l, i) => {
    parts.push(`<text x="540" y="${subStartY + i * subLineH}" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="400" fill="#ffffff" text-anchor="middle" dominant-baseline="hanging" opacity="0.85">${l}</text>`);
  });

  if (ctaText) {
    const ctaY = subStartY + subLines.length * subLineH + 40;
    parts.push(`<rect x="330" y="${ctaY}" width="420" height="56" rx="28" fill="rgba(255,255,255,0.22)"/>`);
    parts.push(`<text x="540" y="${ctaY + 17}" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="hanging">${escapeXml(ctaText)}</text>`);
  }

  if (businessName) {
    parts.push(`<text x="540" y="${H - 44}" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="600" fill="#ffffff" text-anchor="middle" dominant-baseline="auto" opacity="0.65">${escapeXml(businessName)}</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;

  return sharp({ create: { width: W, height: H, channels: 3, background: { r, g, b } } })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

// ── Layout B — Bold Split ────────────────────────────────────────────────────
// Top 42% is brand primary color with large white headline.
// Bottom 58% is white with dark subtext + colored CTA button.
// Business name bottom-right.

async function buildLayoutB(headline, subtext, ctaText, businessName, colors) {
  const splitY = Math.floor(H * 0.42);

  const headLines = wrapText(escapeXml(headline), 16);
  const subLines  = wrapText(escapeXml(subtext),  36);

  const headLineH = 66;
  const headTotalH = headLines.length * headLineH;
  const headStartY = Math.floor((splitY - headTotalH) / 2);

  const subStartY = splitY + 56;
  const subLineH  = 38;

  const parts = [
    `<rect x="0" y="0" width="${W}" height="${splitY}" fill="${colors.primary}"/>`,
    // Accent divider line below color block
    `<rect x="60" y="${splitY + 10}" width="100" height="5" rx="2" fill="${colors.secondary}"/>`,
  ];

  headLines.forEach((l, i) => {
    parts.push(`<text x="540" y="${headStartY + i * headLineH}" font-family="Arial,Helvetica,sans-serif" font-size="58" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="hanging">${l}</text>`);
  });

  subLines.forEach((l, i) => {
    parts.push(`<text x="540" y="${subStartY + i * subLineH}" font-family="Arial,Helvetica,sans-serif" font-size="27" font-weight="400" fill="#1a1a2a" text-anchor="middle" dominant-baseline="hanging">${l}</text>`);
  });

  if (ctaText) {
    const ctaY = subStartY + subLines.length * subLineH + 52;
    parts.push(`<rect x="330" y="${ctaY}" width="420" height="58" rx="29" fill="${colors.primary}"/>`);
    parts.push(`<text x="540" y="${ctaY + 18}" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="hanging">${escapeXml(ctaText)}</text>`);
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

async function buildLayoutC(headline, subtext, ctaText, businessName, colors) {
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

  headLines.forEach((l, i) => {
    parts.push(`<text x="${textX}" y="${startY + i * headLineH}" font-family="Arial,Helvetica,sans-serif" font-size="56" font-weight="800" fill="#1a1a2a" text-anchor="start" dominant-baseline="hanging">${l}</text>`);
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

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Generate 3 branded card layout variations for a given post.
 * @param {Object} customer - Customer row with brand_colors, business_name
 * @param {string} headline - Short punchy headline (≤8 words)
 * @param {string} subtext  - Supporting context (1–2 sentences)
 * @param {string} ctaText  - Call to action (≤5 words)
 * @returns {{ bufferA, bufferB, bufferC }} — JPEG buffers ready for Cloudinary upload
 */
async function generateBrandedCards(customer, headline, subtext, ctaText) {
  const colors       = resolveBrandColors(customer);
  const businessName = customer?.business_name || '';

  const [bufferA, bufferB, bufferC] = await Promise.all([
    buildLayoutA(headline, subtext, ctaText, businessName, colors),
    buildLayoutB(headline, subtext, ctaText, businessName, colors),
    buildLayoutC(headline, subtext, ctaText, businessName, colors),
  ]);

  return { bufferA, bufferB, bufferC };
}

module.exports = { generateBrandedCards, resolveBrandColors, parseColor };
