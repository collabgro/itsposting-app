/**
 * PhotoCardService — world-class branded photo card compositor
 *
 * Produces 3 professionally designed social media cards by compositing
 * AI-generated photos with branded overlays using Sharp + SVG.
 * Inspired by top-tier Canva templates and professional graphic design.
 *
 * Template A — "Frosted Glass Panel":   blurred glass panel left side, photo visible right
 * Template B — "Bold Brand Split":      solid brand color left, photo right, service checklist
 * Template C — "Floating Glass Card":   frosted card inset on right, subject visible left
 *
 * Brand colors come from customer.brand_colors (/settings?tab=branding).
 * Photo composition is guided by Claude (subject positioned right-center for A/B,
 * or left-center for C) so the panel never covers the main subject.
 */

const sharp = require('sharp');

const W = 1080;
const H = 1350;

// ── Utilities ─────────────────────────────────────────────────────────────────

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

function darkenHex(hex, factor = 0.22) {
  const h = (hex || '#3B82F6').replace('#', '').padStart(6, '0');
  const r = Math.max(0, Math.round(parseInt(h.slice(0, 2), 16) * (1 - factor)));
  const g = Math.max(0, Math.round(parseInt(h.slice(2, 4), 16) * (1 - factor)));
  const b = Math.max(0, Math.round(parseInt(h.slice(4, 6), 16) * (1 - factor)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Hexagonal logo icon — rendered as an SVG polygon (like Canva brand icons)
function hexIcon(cx, cy, r, fill = 'rgba(255,255,255,0.95)') {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const angle = Math.PI / 3 * i - Math.PI / 6;
    return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
  return `<polygon points="${pts}" fill="${fill}"/>`;
}

// Resize & auto-orient source photo to exact canvas dimensions
async function resizePhoto(buffer) {
  return sharp(buffer)
    .rotate()
    .resize(W, H, { fit: 'cover', position: 'center' })
    .toBuffer();
}

// ── Template A — "Frosted Glass Panel" ───────────────────────────────────────
// Multi-pass glass morphism: blur the left panel region, composite back,
// then apply brand color overlay + text. Result: frosted glass aesthetic.
// Best for: educational/tip content, job-finished, professional tone.

async function buildTemplateA(resizedBuffer, headline, subtext, cta, businessName, colors) {
  const panelW = 630;
  const padX   = 52;
  const dark   = darkenHex(colors.primary, 0.20);

  // Pass 1: extract left panel region, blur it, composite back as frosted glass base
  let base = resizedBuffer;
  try {
    const blurred = await sharp(resizedBuffer)
      .extract({ left: 0, top: 0, width: panelW, height: H })
      .blur(22)
      .toBuffer();
    base = await sharp(resizedBuffer)
      .composite([{ input: blurred, left: 0, top: 0 }])
      .toBuffer();
  } catch (blurErr) {
    console.warn('[PhotoCard/A] blur pass failed, using original:', blurErr.message);
  }

  const headLines = wrapText(escapeXml(headline), 12);
  const subLines  = wrapText(escapeXml(subtext), 21);

  const headLineH = 78;
  const subLineH  = 36;
  const ctaH      = cta ? 88 : 0;
  const blockH    = headLines.length * headLineH
    + (subLines.length ? 30 + subLines.length * subLineH : 0) + ctaH;
  const topBand   = 130;
  const startY    = topBand + Math.max(24, Math.floor((H - 82 - topBand - blockH) / 2));

  const parts = [
    // Glass panel — brand color overlay on blurred region
    `<rect x="0" y="0" width="${panelW}" height="${H}" fill="${colors.primary}" opacity="0.84"/>`,
    // Subtle right highlight line
    `<line x1="${panelW - 1}" y1="0" x2="${panelW - 1}" y2="${H}" stroke="${colors.secondary}" stroke-width="2.5" opacity="0.55"/>`,

    // Hexagonal logo + business name
    hexIcon(padX + 20, 58, 22),
    `<text x="${padX + 52}" y="58" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`,
    // Thin accent underline below logo bar
    `<rect x="${padX}" y="88" width="80" height="2.5" rx="1" fill="${colors.secondary}" opacity="0.9"/>`,
  ];

  // Headline — very large, bold
  headLines.forEach((l, i) => {
    parts.push(
      `<text x="${padX}" y="${startY + i * headLineH}" font-family="Arial,Helvetica,sans-serif" font-size="72" font-weight="800" fill="#ffffff" dominant-baseline="hanging">${l}</text>`
    );
  });

  // Subtext
  const subY = startY + headLines.length * headLineH + 30;
  subLines.forEach((l, i) => {
    parts.push(
      `<text x="${padX}" y="${subY + i * subLineH}" font-family="Arial,Helvetica,sans-serif" font-size="27" font-weight="400" fill="#ffffff" opacity="0.88" dominant-baseline="hanging">${l}</text>`
    );
  });

  // CTA pill button — white background, brand text
  if (cta) {
    const ctaY = subY + subLines.length * subLineH + 46;
    const ctaW = Math.min(panelW - padX * 2, Math.max(240, cta.length * 15 + 80));
    parts.push(`<rect x="${padX}" y="${ctaY}" width="${ctaW}" height="58" rx="29" fill="#ffffff"/>`);
    parts.push(
      `<text x="${padX + ctaW / 2}" y="${ctaY + 29}" font-family="Arial,Helvetica,sans-serif" font-size="21" font-weight="800" fill="${colors.primary}" text-anchor="middle" dominant-baseline="middle">${escapeXml(cta.toUpperCase())}</text>`
    );
  }

  // Bottom bar — full width, dark brand color
  parts.push(`<rect x="0" y="${H - 82}" width="${W}" height="82" fill="${dark}" opacity="0.97"/>`);
  parts.push(
    `<text x="${W / 2}" y="${H - 41}" font-family="Arial,Helvetica,sans-serif" font-size="19" font-weight="500" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" opacity="0.82">${escapeXml(businessName)}</text>`
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;

  return sharp(base)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Template B — "Bold Brand Split" ──────────────────────────────────────────
// Solid brand color covers left half — no transparency, no blur.
// Photo shows naturally on the right. Huge bold headline. Service checklist.
// Best for: promotions, service listings, urgent content, "available 24/7" type posts.

async function buildTemplateB(resizedBuffer, headline, subtext, cta, businessName, colors, badge, services) {
  const splitX  = 555;
  const padX    = 52;

  const headLines   = wrapText(escapeXml(headline), 10);
  const bullets     = Array.isArray(services) && services.length > 0
    ? services.slice(0, 4)
    : null;

  const headLineH   = 84;
  const headStartY  = 160;
  const headBlockH  = headLines.length * headLineH;

  const bulletStartY = headStartY + headBlockH + 28;
  const bulletLineH  = 55;

  const badgeText = escapeXml(badge || (cta ? cta.toUpperCase() : 'AVAILABLE 24/7'));
  const badgeW    = Math.max(200, badgeText.length * 13 + 52);

  const parts = [
    // Solid left panel — opaque brand color
    `<rect x="0" y="0" width="${splitX}" height="${H}" fill="${colors.primary}"/>`,

    // Hexagonal logo + business name (top-left)
    hexIcon(padX + 20, 62, 22),
    `<text x="${padX + 52}" y="62" font-family="Arial,Helvetica,sans-serif" font-size="21" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`,
  ];

  // Very large headline
  headLines.forEach((l, i) => {
    parts.push(
      `<text x="${padX}" y="${headStartY + i * headLineH}" font-family="Arial,Helvetica,sans-serif" font-size="82" font-weight="900" fill="#ffffff" dominant-baseline="hanging">${l}</text>`
    );
  });

  if (bullets) {
    // Service checklist with circular checkmarks
    bullets.forEach((item, i) => {
      const cy = bulletStartY + i * bulletLineH + 24;
      // Circle background
      parts.push(`<circle cx="${padX + 18}" cy="${cy}" r="18" fill="rgba(255,255,255,0.18)"/>`);
      // Checkmark
      parts.push(`<text x="${padX + 18}" y="${cy}" font-family="Arial,Helvetica,sans-serif" font-size="16" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">✓</text>`);
      // Item label
      parts.push(
        `<text x="${padX + 46}" y="${cy}" font-family="Arial,Helvetica,sans-serif" font-size="24" font-weight="600" fill="#ffffff" dominant-baseline="middle">${escapeXml(item)}</text>`
      );
    });
  } else {
    // Fallback: subtext lines
    const fallbackLines = wrapText(escapeXml(subtext), 22);
    fallbackLines.forEach((l, i) => {
      parts.push(
        `<text x="${padX}" y="${bulletStartY + i * 36}" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="400" fill="#ffffff" opacity="0.88" dominant-baseline="hanging">${l}</text>`
      );
    });
  }

  // Badge chip — straddles the split boundary for visual drama
  const badgeX = splitX - Math.floor(badgeW / 2);
  const badgeY = Math.floor(H * 0.55);
  parts.push(`<rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="50" rx="25" fill="#ffffff"/>`);
  parts.push(
    `<text x="${badgeX + badgeW / 2}" y="${badgeY + 25}" font-family="Arial,Helvetica,sans-serif" font-size="19" font-weight="800" fill="${colors.primary}" text-anchor="middle" dominant-baseline="middle">${badgeText}</text>`
  );

  // Bottom rounded pill — full width white pill with brand CTA text
  const pillH = 68;
  const pillY = H - pillH - 18;
  parts.push(`<rect x="22" y="${pillY}" width="${W - 44}" height="${pillH}" rx="${pillH / 2}" fill="#ffffff"/>`);
  parts.push(
    `<text x="${W / 2}" y="${pillY + pillH / 2}" font-family="Arial,Helvetica,sans-serif" font-size="21" font-weight="700" fill="${colors.primary}" text-anchor="middle" dominant-baseline="middle">${escapeXml(cta || 'Contact Us Today')}</text>`
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;

  return sharp(resizedBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Template C — "Floating Glass Card" ────────────────────────────────────────
// Frosted glass card inset on the RIGHT. Subject visible on the left.
// Decorative circle with arrow in card. Elegant, premium feel.
// Best for: testimonials, "why choose us", before/after, milestone posts.

async function buildTemplateC(resizedBuffer, headline, subtext, cta, businessName, colors) {
  // Card dimensions — inset from right edge with visible gap on right and bottom
  const cardX  = 400;
  const cardW  = W - cardX - 18;
  const cardRx = 34;
  const padX   = cardX + 44;
  const dark   = darkenHex(colors.primary, 0.18);

  // Pass 1: blur the card region for glass morphism
  let base = resizedBuffer;
  try {
    const blurred = await sharp(resizedBuffer)
      .extract({ left: cardX, top: 0, width: cardW + 18, height: H })
      .blur(24)
      .toBuffer();
    base = await sharp(resizedBuffer)
      .composite([{ input: blurred, left: cardX, top: 0 }])
      .toBuffer();
  } catch (blurErr) {
    console.warn('[PhotoCard/C] blur pass failed, using original:', blurErr.message);
  }

  const headLines = wrapText(escapeXml(headline), 13);
  const subLines  = wrapText(escapeXml(subtext), 22);

  const headLineH = 70;
  const subLineH  = 34;
  const logoAreaH = 78;

  const headStartY = logoAreaH + 24;
  const subStartY  = headStartY + headLines.length * headLineH + 26;
  const ctaY       = subStartY + subLines.length * subLineH + 44;

  // Decorative arrow circle (bottom-right inside card)
  const arrowCx = cardX + cardW - 52;
  const arrowCy = Math.min(H - 140, ctaY + 110);

  const parts = [
    // Glass card background
    `<rect x="${cardX}" y="0" width="${cardW}" height="${H}" rx="${cardRx}" fill="${colors.primary}" opacity="0.82"/>`,
    // Inner highlight border
    `<rect x="${cardX + 1}" y="1" width="${cardW - 2}" height="${H - 2}" rx="${cardRx}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>`,

    // Logo hex + business name
    hexIcon(padX + 18, 44, 20),
    `<text x="${padX + 48}" y="44" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`,
    // Accent line under logo
    `<rect x="${padX}" y="68" width="60" height="2" rx="1" fill="${colors.secondary}" opacity="0.85"/>`,
  ];

  // Headline
  headLines.forEach((l, i) => {
    parts.push(
      `<text x="${padX}" y="${headStartY + i * headLineH}" font-family="Arial,Helvetica,sans-serif" font-size="64" font-weight="800" fill="#ffffff" dominant-baseline="hanging">${l}</text>`
    );
  });

  // Subtext
  subLines.forEach((l, i) => {
    parts.push(
      `<text x="${padX}" y="${subStartY + i * subLineH}" font-family="Arial,Helvetica,sans-serif" font-size="25" font-weight="400" fill="#ffffff" opacity="0.88" dominant-baseline="hanging">${l}</text>`
    );
  });

  // CTA pill button
  if (cta && ctaY < H - 150) {
    const ctaW = Math.min(cardW - 88, Math.max(200, cta.length * 14 + 68));
    parts.push(`<rect x="${padX}" y="${ctaY}" width="${ctaW}" height="54" rx="27" fill="#ffffff"/>`);
    parts.push(
      `<text x="${padX + ctaW / 2}" y="${ctaY + 27}" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="800" fill="${colors.primary}" text-anchor="middle" dominant-baseline="middle">${escapeXml(cta.toUpperCase())}</text>`
    );
  }

  // Decorative arrow circle (signature design element like screenshot 3)
  parts.push(`<circle cx="${arrowCx}" cy="${arrowCy}" r="42" fill="rgba(255,255,255,0.12)"/>`);
  parts.push(`<circle cx="${arrowCx}" cy="${arrowCy}" r="30" fill="rgba(255,255,255,0.20)"/>`);
  parts.push(
    `<text x="${arrowCx}" y="${arrowCy}" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">↗</text>`
  );

  // Bottom bar
  parts.push(`<rect x="0" y="${H - 80}" width="${W}" height="80" fill="${dark}" opacity="0.97"/>`);
  parts.push(
    `<text x="${W / 2}" y="${H - 40}" font-family="Arial,Helvetica,sans-serif" font-size="19" font-weight="500" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" opacity="0.80">${escapeXml(businessName)}</text>`
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;

  return sharp(base)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate 3 branded photo card variations from an AI-generated photo buffer.
 *
 * @param {Buffer}  photoBuffer  — raw image buffer from NanoBanana (already 1080×1350)
 * @param {Object}  cardOverlay  — { headline, subtext, cta, badge, services, recommended } from Claude
 * @param {Object}  customer     — customer DB row (brand_colors, business_name)
 * @returns {{ bufferA, bufferB, bufferC }} — JPEG buffers ready for Cloudinary upload
 */
async function generatePhotoCards(photoBuffer, cardOverlay, customer) {
  const colors       = resolveBrandColors(customer);
  const businessName = customer?.business_name || '';
  const {
    headline  = '',
    subtext   = '',
    cta       = '',
    badge     = '',
    services  = [],
  } = cardOverlay;

  // Resize once, share the base across all 3 templates (each does its own blur pass)
  const resized = await resizePhoto(photoBuffer);

  const [bufferA, bufferB, bufferC] = await Promise.all([
    buildTemplateA(resized, headline, subtext, cta, businessName, colors),
    buildTemplateB(resized, headline, subtext, cta, businessName, colors, badge, services),
    buildTemplateC(resized, headline, subtext, cta, businessName, colors),
  ]);

  return { bufferA, bufferB, bufferC };
}

module.exports = { generatePhotoCards, resolveBrandColors };
