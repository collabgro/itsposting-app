/**
 * PhotoCardService — world-class branded photo card compositor
 *
 * Produces 3 professionally designed social media cards by compositing
 * AI-generated photos with branded overlays using Sharp + SVG.
 *
 * Template A — "Frosted Glass Gradient":  full-width gradient fade left→transparent, glass blur left half
 * Template B — "Bold Brand Split":        solid brand color left, photo right, service checklist
 * Template C — "Floating Glass Card":     frosted card inset on right, subject visible left
 *
 * Brand colors from customer.brand_colors (/settings?tab=branding).
 * Real logo from customer.logo_url (/settings?tab=branding) — hexagon fallback if none.
 * Headlines are uppercased with tight letter-spacing for Canva-quality typography.
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
  const defaults = { primary: '#1E3A5F', secondary: '#F59E0B', accent: '#10B981' };
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
  const h = (hex || '#1E3A5F').replace('#', '').padStart(6, '0');
  const r = Math.max(0, Math.round(parseInt(h.slice(0, 2), 16) * (1 - factor)));
  const g = Math.max(0, Math.round(parseInt(h.slice(2, 4), 16) * (1 - factor)));
  const b = Math.max(0, Math.round(parseInt(h.slice(4, 6), 16) * (1 - factor)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Hexagonal logo icon fallback (used when customer has no logo_url)
function hexIcon(cx, cy, r, fill = 'rgba(255,255,255,0.95)') {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const angle = Math.PI / 3 * i - Math.PI / 6;
    return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
  return `<polygon points="${pts}" fill="${fill}"/>`;
}

// Fetch and resize customer logo to a fixed square PNG buffer.
// Returns null on any failure — callers fall back to hexIcon.
async function fetchLogoBuffer(logoUrl) {
  if (!logoUrl) return null;
  try {
    const resp = await fetch(logoUrl, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return null;
    const raw = Buffer.from(await resp.arrayBuffer());
    return await sharp(raw)
      .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

// Resize & auto-orient source photo to exact canvas dimensions
async function resizePhoto(buffer) {
  return sharp(buffer)
    .rotate()
    .resize(W, H, { fit: 'cover', position: 'center' })
    .toBuffer();
}

// ── Template A — "Frosted Glass Gradient" ─────────────────────────────────────
// Glass morphism on left 60% + full-width gradient color overlay that fades to
// transparent by ~82% width. Works for ANY subject position — no hard panel edge.
// Best for: job-finished, educational tips, authentic/professional content.

async function buildTemplateA(resizedBuffer, headline, subtext, cta, businessName, colors, logoBuffer) {
  const blurRegionW = 648;  // region we blur for glass morphism
  const padX        = 54;
  const dark        = darkenHex(colors.primary, 0.22);

  // Pass 1: blur left region → composite back for frosted glass base
  let base = resizedBuffer;
  try {
    const blurred = await sharp(resizedBuffer)
      .extract({ left: 0, top: 0, width: blurRegionW, height: H })
      .blur(20)
      .toBuffer();
    base = await sharp(resizedBuffer)
      .composite([{ input: blurred, left: 0, top: 0 }])
      .toBuffer();
  } catch (blurErr) {
    console.warn('[PhotoCard/A] blur pass failed:', blurErr.message);
  }

  const headText  = headline.toUpperCase();
  const headLines = wrapText(escapeXml(headText), 11);
  const subLines  = wrapText(escapeXml(subtext), 22);

  const headLineH = 80;
  const subLineH  = 36;
  const ctaH      = cta ? 96 : 0;
  const blockH    = headLines.length * headLineH
    + (subLines.length ? 28 + subLines.length * subLineH : 0) + ctaH;
  const topBand   = 130;
  const startY    = topBand + Math.max(20, Math.floor((H - 82 - topBand - blockH) / 2));

  const parts = [
    // Full-width gradient overlay — fades from solid left to transparent right
    `<defs>
      <linearGradient id="panelGradA" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stop-color="${colors.primary}" stop-opacity="0.93"/>
        <stop offset="52%"  stop-color="${colors.primary}" stop-opacity="0.89"/>
        <stop offset="76%"  stop-color="${colors.primary}" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="${colors.primary}" stop-opacity="0.02"/>
      </linearGradient>
    </defs>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#panelGradA)"/>`,
    // Accent line on left edge
    `<rect x="0" y="0" width="5" height="${H}" fill="${colors.secondary}" opacity="0.9"/>`,
  ];

  // Logo or hexagon — top left
  if (logoBuffer) {
    // Real logo composited via sharp later; reserve space in SVG
    parts.push(`<rect x="${padX}" y="28" width="64" height="64" rx="8" fill="rgba(255,255,255,0.12)"/>`);
    parts.push(`<text x="${padX + 78}" y="62" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="21" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  } else {
    parts.push(hexIcon(padX + 22, 60, 22));
    parts.push(`<text x="${padX + 54}" y="60" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="21" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  }
  parts.push(`<rect x="${padX}" y="96" width="72" height="3" rx="1.5" fill="${colors.secondary}" opacity="0.88"/>`);

  // Headline — uppercase, tight tracking, very large
  headLines.forEach((l, i) => {
    parts.push(
      `<text x="${padX}" y="${startY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="76" font-weight="900" letter-spacing="-2.5" fill="#ffffff" dominant-baseline="hanging">${l}</text>`
    );
  });

  // Subtext
  const subY = startY + headLines.length * headLineH + 28;
  subLines.forEach((l, i) => {
    parts.push(
      `<text x="${padX}" y="${subY + i * subLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="27" font-weight="400" fill="#ffffff" opacity="0.88" dominant-baseline="hanging">${l}</text>`
    );
  });

  // CTA pill — white background, brand text
  if (cta) {
    const ctaY = subY + subLines.length * subLineH + 44;
    const ctaW = Math.min(480, Math.max(240, cta.length * 15 + 80));
    parts.push(`<rect x="${padX}" y="${ctaY}" width="${ctaW}" height="60" rx="30" fill="#ffffff"/>`);
    parts.push(
      `<text x="${padX + ctaW / 2}" y="${ctaY + 30}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="21" font-weight="800" letter-spacing="0.5" fill="${colors.primary}" text-anchor="middle" dominant-baseline="middle">${escapeXml(cta.toUpperCase())}</text>`
    );
  }

  // Dark bottom bar
  parts.push(`<rect x="0" y="${H - 84}" width="${W}" height="84" fill="${dark}" opacity="0.97"/>`);
  parts.push(
    `<text x="${W / 2}" y="${H - 42}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="19" font-weight="500" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" opacity="0.80">${escapeXml(businessName)}</text>`
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;

  let composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) {
    composite.push({ input: logoBuffer, top: 28, left: padX });
  }

  return sharp(base)
    .composite(composite)
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Template B — "Bold Brand Split" ──────────────────────────────────────────
// Solid brand color covers left half — no blur, no transparency.
// Most reliable template: solid panel never depends on photo composition.
// Best for: promotions, service listings, urgent content, "available 24/7".

async function buildTemplateB(resizedBuffer, headline, subtext, cta, businessName, colors, badge, services, logoBuffer) {
  const splitX  = 555;
  const padX    = 52;

  const headText  = headline.toUpperCase();
  const headLines = wrapText(escapeXml(headText), 9);
  const bullets   = Array.isArray(services) && services.length > 0 ? services.slice(0, 4) : null;

  const headLineH  = 86;
  const headStartY = 154;
  const headBlockH = headLines.length * headLineH;

  const bulletStartY = headStartY + headBlockH + 24;
  const bulletLineH  = 58;

  const badgeText = escapeXml(badge ? badge.toUpperCase() : (cta ? cta.toUpperCase() : 'AVAILABLE 24/7'));
  const badgeW    = Math.max(210, badgeText.length * 12 + 52);

  const parts = [
    // Solid left panel with subtle gradient for depth
    `<defs>
      <linearGradient id="splitGradB" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${colors.primary}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${darkenHex(colors.primary, 0.15)}" stop-opacity="1"/>
      </linearGradient>
    </defs>`,
    `<rect x="0" y="0" width="${splitX}" height="${H}" fill="url(#splitGradB)"/>`,
    // Subtle dot-texture on panel for depth
    `<rect x="0" y="0" width="${splitX}" height="${H}" fill="url(#dots)" opacity="0.06"/>`,
  ];

  // Logo or hexagon — top left
  if (logoBuffer) {
    parts.push(`<rect x="${padX}" y="30" width="64" height="64" rx="8" fill="rgba(255,255,255,0.12)"/>`);
    parts.push(`<text x="${padX + 78}" y="64" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  } else {
    parts.push(hexIcon(padX + 22, 62, 22));
    parts.push(`<text x="${padX + 54}" y="62" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  }

  // Huge headline — uppercase, tight tracking
  headLines.forEach((l, i) => {
    parts.push(
      `<text x="${padX}" y="${headStartY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="84" font-weight="900" letter-spacing="-3" fill="#ffffff" dominant-baseline="hanging">${l}</text>`
    );
  });

  if (bullets) {
    bullets.forEach((item, i) => {
      const cy = bulletStartY + i * bulletLineH + 26;
      parts.push(`<circle cx="${padX + 20}" cy="${cy}" r="20" fill="rgba(255,255,255,0.18)"/>`);
      parts.push(`<text x="${padX + 20}" y="${cy}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="16" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">✓</text>`);
      parts.push(
        `<text x="${padX + 50}" y="${cy}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="24" font-weight="600" fill="#ffffff" dominant-baseline="middle">${escapeXml(item)}</text>`
      );
    });
  } else {
    const fallbackLines = wrapText(escapeXml(subtext), 22);
    fallbackLines.forEach((l, i) => {
      parts.push(
        `<text x="${padX}" y="${bulletStartY + i * 38}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="26" font-weight="400" fill="#ffffff" opacity="0.88" dominant-baseline="hanging">${l}</text>`
      );
    });
  }

  // Badge chip — straddles split boundary for visual drama
  const badgeX = splitX - Math.floor(badgeW / 2);
  const badgeY = Math.floor(H * 0.55);
  parts.push(`<rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="52" rx="26" fill="#ffffff"/>`);
  parts.push(
    `<text x="${badgeX + badgeW / 2}" y="${badgeY + 26}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="18" font-weight="800" letter-spacing="0.5" fill="${colors.primary}" text-anchor="middle" dominant-baseline="middle">${badgeText}</text>`
  );

  // Full-width CTA pill at bottom
  const pillH = 70;
  const pillY = H - pillH - 20;
  parts.push(`<rect x="20" y="${pillY}" width="${W - 40}" height="${pillH}" rx="${pillH / 2}" fill="#ffffff"/>`);
  parts.push(
    `<text x="${W / 2}" y="${pillY + pillH / 2}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="800" letter-spacing="0.5" fill="${colors.primary}" text-anchor="middle" dominant-baseline="middle">${escapeXml((cta || 'Contact Us Today').toUpperCase())}</text>`
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;

  let composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) {
    composite.push({ input: logoBuffer, top: 30, left: padX });
  }

  return sharp(resizedBuffer)
    .composite(composite)
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Template C — "Floating Glass Card" ────────────────────────────────────────
// Frosted glass card inset on the RIGHT. Subject clearly visible on the left.
// Decorative concentric circles with arrow — signature design element.
// Best for: testimonials, "why choose us", before/after, milestone posts.

async function buildTemplateC(resizedBuffer, headline, subtext, cta, businessName, colors, logoBuffer) {
  const cardX  = 388;
  const cardW  = W - cardX - 16;
  const cardRx = 36;
  const padX   = cardX + 44;
  const dark   = darkenHex(colors.primary, 0.20);

  // Blur card region for glass morphism
  let base = resizedBuffer;
  try {
    const blurred = await sharp(resizedBuffer)
      .extract({ left: cardX, top: 0, width: cardW + 16, height: H })
      .blur(24)
      .toBuffer();
    base = await sharp(resizedBuffer)
      .composite([{ input: blurred, left: cardX, top: 0 }])
      .toBuffer();
  } catch (blurErr) {
    console.warn('[PhotoCard/C] blur pass failed:', blurErr.message);
  }

  const headText  = headline.toUpperCase();
  const headLines = wrapText(escapeXml(headText), 12);
  const subLines  = wrapText(escapeXml(subtext), 21);

  const headLineH  = 72;
  const subLineH   = 35;
  const logoAreaH  = 80;
  const headStartY = logoAreaH + 22;
  const subStartY  = headStartY + headLines.length * headLineH + 24;
  const ctaY       = subStartY + subLines.length * subLineH + 42;

  const arrowCx = cardX + cardW - 54;
  const arrowCy = Math.min(H - 145, ctaY + 115);

  const parts = [
    `<defs>
      <linearGradient id="cardGradC" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${colors.primary}" stop-opacity="0.88"/>
        <stop offset="100%" stop-color="${darkenHex(colors.primary, 0.12)}" stop-opacity="0.88"/>
      </linearGradient>
    </defs>`,
    // Glass card background
    `<rect x="${cardX}" y="0" width="${cardW}" height="${H}" rx="${cardRx}" fill="url(#cardGradC)"/>`,
    // Inner highlight border
    `<rect x="${cardX + 1}" y="1" width="${cardW - 2}" height="${H - 2}" rx="${cardRx}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>`,
    // Left accent stripe
    `<rect x="${cardX}" y="80" width="4" height="160" rx="2" fill="${colors.secondary}" opacity="0.80"/>`,
  ];

  // Logo or hexagon
  if (logoBuffer) {
    parts.push(`<rect x="${padX}" y="16" width="64" height="64" rx="8" fill="rgba(255,255,255,0.12)"/>`);
    parts.push(`<text x="${padX + 78}" y="48" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="19" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  } else {
    parts.push(hexIcon(padX + 20, 46, 20));
    parts.push(`<text x="${padX + 50}" y="46" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="19" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  }
  parts.push(`<rect x="${padX}" y="70" width="56" height="2.5" rx="1.25" fill="${colors.secondary}" opacity="0.82"/>`);

  // Headline — uppercase, tight tracking
  headLines.forEach((l, i) => {
    parts.push(
      `<text x="${padX}" y="${headStartY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="66" font-weight="900" letter-spacing="-2" fill="#ffffff" dominant-baseline="hanging">${l}</text>`
    );
  });

  // Subtext
  subLines.forEach((l, i) => {
    parts.push(
      `<text x="${padX}" y="${subStartY + i * subLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="25" font-weight="400" fill="#ffffff" opacity="0.88" dominant-baseline="hanging">${l}</text>`
    );
  });

  // CTA pill
  if (cta && ctaY < H - 155) {
    const ctaW = Math.min(cardW - 88, Math.max(190, cta.length * 14 + 68));
    parts.push(`<rect x="${padX}" y="${ctaY}" width="${ctaW}" height="56" rx="28" fill="#ffffff"/>`);
    parts.push(
      `<text x="${padX + ctaW / 2}" y="${ctaY + 28}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="800" letter-spacing="0.5" fill="${colors.primary}" text-anchor="middle" dominant-baseline="middle">${escapeXml(cta.toUpperCase())}</text>`
    );
  }

  // Decorative concentric arrow circles (signature design element)
  parts.push(`<circle cx="${arrowCx}" cy="${arrowCy}" r="44" fill="rgba(255,255,255,0.10)"/>`);
  parts.push(`<circle cx="${arrowCx}" cy="${arrowCy}" r="30" fill="rgba(255,255,255,0.18)"/>`);
  parts.push(
    `<text x="${arrowCx}" y="${arrowCy}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="26" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">↗</text>`
  );

  // Dark bottom bar
  parts.push(`<rect x="0" y="${H - 82}" width="${W}" height="82" fill="${dark}" opacity="0.97"/>`);
  parts.push(
    `<text x="${W / 2}" y="${H - 41}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="19" font-weight="500" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" opacity="0.80">${escapeXml(businessName)}</text>`
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;

  let composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) {
    composite.push({ input: logoBuffer, top: 16, left: padX });
  }

  return sharp(base)
    .composite(composite)
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate 3 branded photo card variations from an AI-generated photo buffer.
 *
 * @param {Buffer}  photoBuffer  — raw image buffer from NanoBanana (already 1080×1350)
 * @param {Object}  cardOverlay  — { headline, subtext, cta, badge, services, recommended } from Claude
 * @param {Object}  customer     — customer DB row (brand_colors, business_name, logo_url)
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

  // Fetch real logo once — shared across all 3 templates
  const logoBuffer = await fetchLogoBuffer(customer?.logo_url);

  // Resize source photo once
  const resized = await resizePhoto(photoBuffer);

  const [bufferA, bufferB, bufferC] = await Promise.all([
    buildTemplateA(resized, headline, subtext, cta, businessName, colors, logoBuffer),
    buildTemplateB(resized, headline, subtext, cta, businessName, colors, badge, services, logoBuffer),
    buildTemplateC(resized, headline, subtext, cta, businessName, colors, logoBuffer),
  ]);

  return { bufferA, bufferB, bufferC };
}

module.exports = { generatePhotoCards, resolveBrandColors };
