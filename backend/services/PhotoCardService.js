/**
 * PhotoCardService — composites AI-generated photos with professional branded overlays.
 *
 * Takes a NanoBanana photo buffer + card copy from Claude + customer brand colors,
 * and produces 3 visually distinct social media cards (each 1080×1350px, 4:5 ratio).
 *
 * Template A — "Pro Panel":   semi-transparent brand panel on the left, photo visible right
 * Template B — "Full Tint":   brand color wash over entire photo, badge + bottom bar
 * Template C — "Bottom Card": photo top half, white branded card bottom half
 *
 * Brand colors are read from customer.brand_colors (set at /settings?tab=branding).
 * Falls back to ItsPosting blue if not configured.
 */

const sharp = require('sharp');

const W = 1080;
const H = 1350;

// ── Text helpers ──────────────────────────────────────────────────────────────

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

// ── Color helpers ─────────────────────────────────────────────────────────────

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

function darkenHex(hex, factor = 0.2) {
  const h = (hex || '#3B82F6').replace('#', '').padStart(6, '0');
  const r = Math.max(0, Math.round(parseInt(h.slice(0, 2), 16) * (1 - factor)));
  const g = Math.max(0, Math.round(parseInt(h.slice(2, 4), 16) * (1 - factor)));
  const b = Math.max(0, Math.round(parseInt(h.slice(4, 6), 16) * (1 - factor)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Resize photo to exact canvas size before compositing
async function resizePhoto(photoBuffer) {
  return sharp(photoBuffer)
    .rotate()
    .resize(W, H, { fit: 'cover', position: 'center' })
    .toBuffer();
}

// ── Template A — "Pro Panel" ──────────────────────────────────────────────────
// Semi-transparent brand color panel covers left 56% of canvas.
// Photo shows through on the right. Text sits inside the panel.
// Bottom: full-width dark bar with business name.

async function buildTemplateA(resizedBuffer, headline, subtext, cta, businessName, colors) {
  const panelW = 610;
  const padX = 48;
  const darkBar = darkenHex(colors.primary, 0.22);

  const headLines = wrapText(escapeXml(headline), 12);
  const subLines  = wrapText(escapeXml(subtext),  22);

  const headLineH = 70;
  const subLineH  = 36;
  const ctaBlockH = cta ? 76 : 0;
  const blockH = headLines.length * headLineH + (subLines.length ? 28 + subLines.length * subLineH : 0) + ctaBlockH;

  // Vertically center the text block in the panel area above the bottom bar
  const usableH   = H - 80 - 130; // subtract bottom bar + top brand area
  const startY    = 130 + Math.max(0, Math.floor((usableH - blockH) / 2));

  const parts = [
    // Left panel — rounded right edge only (left edges sit against canvas boundary)
    `<rect x="0" y="0" width="${panelW}" height="${H}" rx="20" fill="${colors.primary}" opacity="0.88"/>`,
    // Mask the left rounded corners by drawing a solid rect over them
    `<rect x="0" y="0" width="20" height="${H}" fill="${colors.primary}" opacity="0.88"/>`,

    // Business name top-left
    `<text x="${padX}" y="62" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700" fill="#ffffff" text-anchor="start" dominant-baseline="middle" opacity="0.85">${escapeXml(businessName)}</text>`,
    // Accent bar
    `<rect x="${padX}" y="80" width="64" height="3" rx="1" fill="${colors.secondary}"/>`,
  ];

  // Headline
  headLines.forEach((l, i) => {
    parts.push(
      `<text x="${padX}" y="${startY + i * headLineH}" font-family="Arial,Helvetica,sans-serif" font-size="60" font-weight="800" fill="#ffffff" text-anchor="start" dominant-baseline="hanging">${l}</text>`
    );
  });

  // Subtext
  const subStartY = startY + headLines.length * headLineH + 28;
  subLines.forEach((l, i) => {
    parts.push(
      `<text x="${padX}" y="${subStartY + i * subLineH}" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="400" fill="#ffffff" text-anchor="start" dominant-baseline="hanging" opacity="0.88">${l}</text>`
    );
  });

  // CTA pill button (white bg, primary text)
  if (cta) {
    const ctaY  = subStartY + subLines.length * subLineH + 44;
    const ctaW  = Math.min(panelW - padX * 2, Math.max(220, cta.length * 14 + 60));
    parts.push(`<rect x="${padX}" y="${ctaY}" width="${ctaW}" height="52" rx="26" fill="#ffffff"/>`);
    parts.push(
      `<text x="${padX + ctaW / 2}" y="${ctaY + 26}" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700" fill="${colors.primary}" text-anchor="middle" dominant-baseline="middle">${escapeXml(cta)}</text>`
    );
  }

  // Bottom bar — full width
  parts.push(`<rect x="0" y="${H - 80}" width="${W}" height="80" fill="${darkBar}" opacity="0.97"/>`);
  parts.push(
    `<text x="${W / 2}" y="${H - 40}" font-family="Arial,Helvetica,sans-serif" font-size="19" font-weight="500" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" opacity="0.8">${escapeXml(businessName)}</text>`
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;

  return sharp(resizedBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Template B — "Full Tint" ──────────────────────────────────────────────────
// Brand color wash (55% opacity) over the entire photo.
// Header bar at top: business name left + badge chip right.
// Large headline left-aligned in lower half. Bottom CTA bar.

async function buildTemplateB(resizedBuffer, headline, subtext, cta, businessName, colors, badge) {
  const darkBar   = darkenHex(colors.primary, 0.28);
  const darkTop   = darkenHex(colors.primary, 0.18);
  const padX      = 52;

  const headLines = wrapText(escapeXml(headline), 16);
  const subLines  = wrapText(escapeXml(subtext),  28);

  const headLineH = 74;
  const subLineH  = 36;

  // Push headline to lower 45% of canvas so photo detail shows in upper area
  const headStartY = Math.floor(H * 0.44);
  const subStartY  = headStartY + headLines.length * headLineH + 18;

  const badgeText = escapeXml(badge || (cta ? cta.toUpperCase() : 'CALL TODAY'));
  const badgeW    = Math.max(180, badgeText.length * 12 + 44);

  const parts = [
    // Full tint overlay
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${colors.primary}" opacity="0.52"/>`,
    // Header bar
    `<rect x="0" y="0" width="${W}" height="92" fill="${darkTop}" opacity="0.92"/>`,
    // Business name
    `<text x="${padX}" y="46" font-family="Arial,Helvetica,sans-serif" font-size="24" font-weight="700" fill="#ffffff" text-anchor="start" dominant-baseline="middle">${escapeXml(businessName)}</text>`,
    // Badge chip top-right
    `<rect x="${W - badgeW - 32}" y="26" width="${badgeW}" height="40" rx="20" fill="transparent" stroke="#ffffff" stroke-width="2"/>`,
    `<text x="${W - badgeW / 2 - 32}" y="46" font-family="Arial,Helvetica,sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${badgeText}</text>`,
  ];

  // Headline
  headLines.forEach((l, i) => {
    parts.push(
      `<text x="${padX}" y="${headStartY + i * headLineH}" font-family="Arial,Helvetica,sans-serif" font-size="68" font-weight="800" fill="#ffffff" text-anchor="start" dominant-baseline="hanging">${l}</text>`
    );
  });

  // Subtext
  subLines.forEach((l, i) => {
    parts.push(
      `<text x="${padX}" y="${subStartY + i * subLineH}" font-family="Arial,Helvetica,sans-serif" font-size="27" font-weight="400" fill="#ffffff" text-anchor="start" dominant-baseline="hanging" opacity="0.9">${l}</text>`
    );
  });

  // Bottom CTA bar
  parts.push(`<rect x="0" y="${H - 82}" width="${W}" height="82" fill="${darkBar}" opacity="0.97"/>`);
  if (cta) {
    parts.push(
      `<text x="${W / 2}" y="${H - 41}" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${escapeXml(cta)} →</text>`
    );
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;

  return sharp(resizedBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Template C — "Bottom Card" ────────────────────────────────────────────────
// Photo fills the top 52% of the canvas.
// A gradient transitions into a white rounded card in the bottom 52%.
// Card contains: brand accent line, business name, headline, subtext, CTA button.

async function buildTemplateC(resizedBuffer, headline, subtext, cta, businessName, colors) {
  const cardY   = Math.floor(H * 0.50);
  const padX    = 52;

  const headLines = wrapText(escapeXml(headline), 20);
  const subLines  = wrapText(escapeXml(subtext),  32);

  const headLineH = 62;
  const subLineH  = 34;

  // Card interior starts below the business name area
  const nameY    = cardY + 36;
  const accentY  = nameY + 26;
  const headY    = accentY + 20;
  const subY     = headY + headLines.length * headLineH + 16;
  const ctaY     = subY + subLines.length * subLineH + 36;

  const parts = [
    // Gradient overlay fading into white at the card boundary
    `<defs>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${colors.primary}" stop-opacity="0"/>
        <stop offset="65%"  stop-color="${colors.primary}" stop-opacity="0.32"/>
        <stop offset="100%" stop-color="${colors.primary}" stop-opacity="0.62"/>
      </linearGradient>
    </defs>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#fade)"/>`,

    // White card — extends past bottom of canvas so no gap visible
    `<rect x="0" y="${cardY}" width="${W}" height="${H - cardY + 40}" rx="28" fill="#ffffff"/>`,

    // Brand accent bar inside card
    `<rect x="${padX}" y="${accentY}" width="72" height="4" rx="2" fill="${colors.primary}"/>`,

    // Business name (brand colored, small)
    `<text x="${padX}" y="${nameY}" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="700" fill="${colors.primary}" text-anchor="start" dominant-baseline="hanging" opacity="0.9">${escapeXml(businessName)}</text>`,
  ];

  // Headline
  headLines.forEach((l, i) => {
    parts.push(
      `<text x="${padX}" y="${headY + i * headLineH}" font-family="Arial,Helvetica,sans-serif" font-size="54" font-weight="800" fill="#1a1a2a" text-anchor="start" dominant-baseline="hanging">${l}</text>`
    );
  });

  // Subtext
  subLines.forEach((l, i) => {
    parts.push(
      `<text x="${padX}" y="${subY + i * subLineH}" font-family="Arial,Helvetica,sans-serif" font-size="25" font-weight="400" fill="#444455" text-anchor="start" dominant-baseline="hanging">${l}</text>`
    );
  });

  // CTA button (brand color)
  if (cta && ctaY < H - 60) {
    const ctaW = Math.min(460, Math.max(240, cta.length * 15 + 80));
    parts.push(`<rect x="${padX}" y="${ctaY}" width="${ctaW}" height="56" rx="28" fill="${colors.primary}"/>`);
    parts.push(
      `<text x="${padX + ctaW / 2}" y="${ctaY + 28}" font-family="Arial,Helvetica,sans-serif" font-size="21" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${escapeXml(cta)}</text>`
    );
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;

  return sharp(resizedBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate 3 branded photo card variations from an AI-generated photo buffer.
 *
 * @param {Buffer}  photoBuffer  — raw image buffer from NanoBanana
 * @param {Object}  cardOverlay  — { headline, subtext, cta, badge } from Claude
 * @param {Object}  customer     — customer DB row (brand_colors, business_name)
 * @returns {{ bufferA, bufferB, bufferC }} — JPEG buffers ready for Cloudinary upload
 */
async function generatePhotoCards(photoBuffer, cardOverlay, customer) {
  const colors       = resolveBrandColors(customer);
  const businessName = customer?.business_name || '';
  const { headline = '', subtext = '', cta = '', badge = '' } = cardOverlay;

  // Resize once, share across all 3 templates
  const resized = await resizePhoto(photoBuffer);

  const [bufferA, bufferB, bufferC] = await Promise.all([
    buildTemplateA(resized, headline, subtext, cta, businessName, colors),
    buildTemplateB(resized, headline, subtext, cta, businessName, colors, badge),
    buildTemplateC(resized, headline, subtext, cta, businessName, colors),
  ]);

  return { bufferA, bufferB, bufferC };
}

module.exports = { generatePhotoCards, resolveBrandColors };
