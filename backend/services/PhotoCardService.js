/**
 * PhotoCardService — Pixel-Perfect Photo Card Design Engine
 *
 * Three world-class templates. Photo is ALWAYS full-bleed background.
 * Brand overlays float on top via gradients, polygons, and shapes.
 * No more half-panel layouts — the photo is the entire canvas.
 *
 * Template A — "Left Fade Pro":     gradient left→transparent, subject right, text left
 * Template B — "Angular Impact":    diagonal triangle overlay, huge headline, editorial checklist
 * Template C — "Top Card Window":   angled card top 54%, photo visible below as a window
 *
 * Design intelligence: Claude sets uppercase (true/false), eyebrow text, badge, services.
 * Phone number from customer.phone displayed prominently in bottom bars.
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

function toTitleCase(str) {
  return String(str).replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function resolveBrandColors(customer) {
  const defaults = { primary: '#1B3A6B', secondary: '#F59E0B', accent: '#3B82F6' };
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

function darkenHex(hex, factor = 0.25) {
  const h = (hex || '#1B3A6B').replace('#', '').padStart(6, '0');
  const r = Math.max(0, Math.round(parseInt(h.slice(0, 2), 16) * (1 - factor)));
  const g = Math.max(0, Math.round(parseInt(h.slice(2, 4), 16) * (1 - factor)));
  const b = Math.max(0, Math.round(parseInt(h.slice(4, 6), 16) * (1 - factor)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Hexagonal logo placeholder (used only when customer.logo_url is absent)
function hexIcon(cx, cy, r, fill = 'rgba(255,255,255,0.95)') {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const angle = Math.PI / 3 * i - Math.PI / 6;
    return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
  return `<polygon points="${pts}" fill="${fill}"/>`;
}

// Fetch and resize customer logo to a 68×68 PNG with transparency
async function fetchLogoBuffer(logoUrl) {
  if (!logoUrl) return null;
  try {
    const resp = await fetch(logoUrl, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return null;
    const raw = Buffer.from(await resp.arrayBuffer());
    return await sharp(raw)
      .resize(68, 68, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

// Resize & auto-orient photo to full canvas
async function resizePhoto(buffer) {
  return sharp(buffer)
    .rotate()
    .resize(W, H, { fit: 'cover', position: 'center' })
    .toBuffer();
}

// Format phone for display: +1 (555) 123-4567 style
function formatPhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1') return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  return raw; // return as-is if unusual format
}

// ── Template A — "Left Fade Pro" ──────────────────────────────────────────────
// Photo fills full canvas. A left→transparent gradient creates readable text zone.
// Separate top-strip and bottom-strip darkeners ensure logo + phone always readable.
// Best for: job finished, educational, before/after, professional tone.

async function buildTemplateA(resizedBuffer, cardOverlay, businessName, phone, colors, logoBuffer) {
  const {
    headline = '', eyebrow = '', subtext = '', cta = '',
    badge = '', services = [], uppercase = true,
  } = cardOverlay;

  const headText  = uppercase ? headline.toUpperCase() : toTitleCase(headline);
  const headLines = wrapText(escapeXml(headText), 13);
  const subLines  = wrapText(escapeXml(subtext), 24);
  const padX      = 58;
  const dark      = darkenHex(colors.primary, 0.28);

  const headLineH = 82;
  const headStartY = 168;
  const headEndY  = headStartY + headLines.length * headLineH;
  const dividerY  = headEndY + 18;
  const subStartY = dividerY + 28;
  const subLineH  = 36;
  const listStartY = subStartY + subLines.length * subLineH + 32;
  const listLineH  = 52;
  const bullets   = Array.isArray(services) ? services.slice(0, 4) : [];

  const parts = [
    // ── Layer 1: Full-canvas left→transparent gradient ──
    `<defs>
      <linearGradient id="fadeA" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stop-color="${colors.primary}" stop-opacity="0.91"/>
        <stop offset="45%"  stop-color="${colors.primary}" stop-opacity="0.86"/>
        <stop offset="68%"  stop-color="${colors.primary}" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="${colors.primary}" stop-opacity="0.00"/>
      </linearGradient>
      <linearGradient id="topDarkA" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0.62"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.00"/>
      </linearGradient>
      <linearGradient id="botDarkA" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${dark}" stop-opacity="0.00"/>
        <stop offset="30%"  stop-color="${dark}" stop-opacity="0.82"/>
        <stop offset="100%" stop-color="${dark}" stop-opacity="0.97"/>
      </linearGradient>
    </defs>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#fadeA)"/>`,

    // ── Layer 2: Top strip darkener (logo always readable) ──
    `<rect x="0" y="0" width="${W}" height="110" fill="url(#topDarkA)"/>`,

    // ── Layer 3: Bottom strip darkener (phone number zone) ──
    `<rect x="0" y="${H - 160}" width="${W}" height="160" fill="url(#botDarkA)"/>`,

    // ── Thin accent line left edge ──
    `<rect x="0" y="0" width="5" height="${H}" fill="${colors.secondary}" opacity="0.85"/>`,
  ];

  // ── Logo + business name — top left ──
  if (logoBuffer) {
    parts.push(`<text x="${padX + 82}" y="58" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  } else {
    parts.push(hexIcon(padX + 22, 58, 22));
    parts.push(`<text x="${padX + 54}" y="58" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  }

  // ── Trust badge pill — top right ──
  if (badge) {
    const badgeText = escapeXml(badge.toUpperCase());
    const badgeW = Math.max(200, badgeText.length * 11 + 48);
    const badgeX = W - badgeW - 22;
    parts.push(`<rect x="${badgeX}" y="34" width="${badgeW}" height="48" rx="24" fill="rgba(255,255,255,0.92)"/>`);
    parts.push(`<text x="${badgeX + badgeW / 2}" y="58" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="17" font-weight="800" letter-spacing="0.5" fill="${colors.primary}" text-anchor="middle" dominant-baseline="middle">${badgeText}</text>`);
  }

  // ── Eyebrow text ──
  if (eyebrow) {
    parts.push(`<text x="${padX}" y="${headStartY - 34}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="19" font-weight="700" letter-spacing="2" fill="${colors.secondary}" dominant-baseline="hanging">${escapeXml(eyebrow.toUpperCase())}</text>`);
  }

  // ── Main headline ──
  headLines.forEach((l, i) => {
    parts.push(
      `<text x="${padX}" y="${headStartY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="80" font-weight="900" letter-spacing="-2.5" fill="#ffffff" dominant-baseline="hanging">${l}</text>`
    );
  });

  // ── Accent divider bar ──
  parts.push(`<rect x="${padX}" y="${dividerY}" width="160" height="6" rx="3" fill="${colors.secondary}" opacity="0.95"/>`);

  // ── Subtext ──
  subLines.forEach((l, i) => {
    parts.push(
      `<text x="${padX}" y="${subStartY + i * subLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="27" font-weight="400" fill="#ffffff" opacity="0.88" dominant-baseline="hanging">${l}</text>`
    );
  });

  // ── Service checklist (arrow style) ──
  bullets.forEach((item, i) => {
    const y = listStartY + i * listLineH + 24;
    parts.push(`<text x="${padX}" y="${y}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="26" font-weight="700" fill="${colors.secondary}" dominant-baseline="middle">→</text>`);
    parts.push(`<text x="${padX + 36}" y="${y}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="26" font-weight="500" fill="#ffffff" dominant-baseline="middle">${escapeXml(item)}</text>`);
  });

  // ── Bottom: phone number (large) + CTA or business name ──
  const phoneFormatted = formatPhone(phone);
  if (phoneFormatted) {
    parts.push(`<text x="${W / 2}" y="${H - 96}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="38" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${escapeXml(phoneFormatted)}</text>`);
    parts.push(`<text x="${W / 2}" y="${H - 44}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="18" font-weight="500" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" opacity="0.72">${escapeXml(cta || businessName)}</text>`);
  } else {
    // No phone: show CTA pill + business name
    if (cta) {
      const ctaW = Math.min(480, Math.max(240, cta.length * 16 + 80));
      const ctaX = padX;
      const ctaY = H - 130;
      parts.push(`<rect x="${ctaX}" y="${ctaY}" width="${ctaW}" height="62" rx="31" fill="#ffffff"/>`);
      parts.push(`<text x="${ctaX + ctaW / 2}" y="${ctaY + 31}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="800" fill="${colors.primary}" text-anchor="middle" dominant-baseline="middle">${escapeXml(cta.toUpperCase())}</text>`);
    }
    parts.push(`<text x="${W / 2}" y="${H - 42}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="18" font-weight="500" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" opacity="0.72">${escapeXml(businessName)}</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  const composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) composite.push({ input: logoBuffer, top: 22, left: padX });

  return sharp(resizedBuffer)
    .composite(composite)
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Template B — "Angular Impact" ─────────────────────────────────────────────
// SVG polygon triangle covers upper-left with dark gradient.
// Photo fully visible on right side. Two-tier headline (eyebrow + huge main).
// Editorial checklist: thin brand-color left stripe per item.
// Best for: urgent, promotional, emergency, dramatic/powerful tone.

async function buildTemplateB(resizedBuffer, cardOverlay, businessName, phone, colors, logoBuffer) {
  const {
    headline = '', eyebrow = '', subtext = '', cta = '',
    badge = '', services = [], uppercase = true,
  } = cardOverlay;

  const headText  = uppercase ? headline.toUpperCase() : toTitleCase(headline);
  const headLines = wrapText(escapeXml(headText), 10);
  const subLines  = wrapText(escapeXml(subtext), 26);
  const padX      = 60;
  const dark      = darkenHex(colors.primary, 0.30);

  const headStartY = 168;
  const headLineH  = 98;
  const subStartY  = headStartY + headLines.length * headLineH + 20;
  const subLineH   = 36;
  const listStartY = subStartY + subLines.length * subLineH + 36;
  const listLineH  = 58;
  const bullets    = Array.isArray(services) ? services.slice(0, 3) : [];

  const parts = [
    // ── Dark triangle gradient overlay (upper-left) ──
    `<defs>
      <linearGradient id="triGradB" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0.80"/>
        <stop offset="70%"  stop-color="#000000" stop-opacity="0.52"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.00"/>
      </linearGradient>
      <linearGradient id="botDarkB" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${dark}" stop-opacity="0.00"/>
        <stop offset="40%"  stop-color="${dark}" stop-opacity="0.88"/>
        <stop offset="100%" stop-color="${dark}" stop-opacity="0.98"/>
      </linearGradient>
    </defs>`,
    // Main diagonal triangle
    `<polygon points="0,0 760,0 0,1100" fill="url(#triGradB)"/>`,
    // Bottom contact strip
    `<rect x="0" y="${H - 140}" width="${W}" height="140" fill="url(#botDarkB)"/>`,
    // Decorative small accent triangle — top-left corner
    `<polygon points="0,0 180,0 0,160" fill="${colors.secondary}" opacity="0.88"/>`,
    // Thin accent line along diagonal (visual highlight)
    `<line x1="760" y1="0" x2="0" y2="1100" stroke="${colors.secondary}" stroke-width="3" opacity="0.45"/>`,
  ];

  // ── Logo + business name — top left (inside accent corner) ──
  if (logoBuffer) {
    parts.push(`<text x="${padX + 82}" y="62" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="21" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  } else {
    parts.push(hexIcon(padX + 22, 62, 22, '#1B1B1B'));
    parts.push(`<text x="${padX + 54}" y="62" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="21" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  }

  // ── Trust badge — top right ──
  if (badge) {
    const badgeText = escapeXml(badge.toUpperCase());
    const badgeW = Math.max(190, badgeText.length * 11 + 44);
    const badgeX = W - badgeW - 22;
    parts.push(`<rect x="${badgeX}" y="34" width="${badgeW}" height="48" rx="24" fill="${colors.secondary}"/>`);
    parts.push(`<text x="${badgeX + badgeW / 2}" y="58" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="17" font-weight="800" letter-spacing="0.5" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${badgeText}</text>`);
  }

  // ── Eyebrow (small caps, accent color) ──
  if (eyebrow) {
    parts.push(`<text x="${padX}" y="${headStartY - 38}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="700" letter-spacing="3" fill="${colors.secondary}" dominant-baseline="hanging">${escapeXml(eyebrow.toUpperCase())}</text>`);
  }

  // ── HUGE headline — 2 tiers of weight/size for drama ──
  headLines.forEach((l, i) => {
    parts.push(
      `<text x="${padX}" y="${headStartY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="96" font-weight="900" letter-spacing="-3.5" fill="#ffffff" dominant-baseline="hanging">${l}</text>`
    );
  });

  // ── Subtext (italic feel via oblique) ──
  subLines.forEach((l, i) => {
    parts.push(
      `<text x="${padX}" y="${subStartY + i * subLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="28" font-weight="400" fill="#ffffff" opacity="0.88" dominant-baseline="hanging">${l}</text>`
    );
  });

  // ── Editorial checklist — left color stripe per item ──
  bullets.forEach((item, i) => {
    const itemY = listStartY + i * listLineH;
    const textH = 40;
    // Brand-color left stripe rectangle
    parts.push(`<rect x="${padX}" y="${itemY}" width="6" height="${textH}" rx="3" fill="${colors.secondary}"/>`);
    parts.push(`<text x="${padX + 22}" y="${itemY + textH / 2}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="26" font-weight="600" fill="#ffffff" dominant-baseline="middle">${escapeXml(item)}</text>`);
  });

  // ── Bottom contact row: two pills ──
  const phoneFormatted = formatPhone(phone);
  const pillH = 62;
  const pillY = H - pillH - 30;
  if (phoneFormatted) {
    // Left pill: "Contact Us" outlined
    const lW = 220;
    parts.push(`<rect x="${padX}" y="${pillY}" width="${lW}" height="${pillH}" rx="${pillH / 2}" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2"/>`);
    parts.push(`<text x="${padX + lW / 2}" y="${pillY + pillH / 2}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">Contact Us</text>`);
    // Right pill: phone number filled with secondary color
    const rText = `📞 ${escapeXml(phoneFormatted)}`;
    const rW = Math.max(280, phoneFormatted.length * 16 + 80);
    const rX = padX + lW + 20;
    parts.push(`<rect x="${rX}" y="${pillY}" width="${rW}" height="${pillH}" rx="${pillH / 2}" fill="${colors.secondary}"/>`);
    parts.push(`<text x="${rX + rW / 2}" y="${pillY + pillH / 2}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${rText}</text>`);
  } else {
    // No phone: single CTA pill
    const ctaText = escapeXml((cta || 'Contact Us Today').toUpperCase());
    const ctaW = Math.min(640, Math.max(280, ctaText.length * 14 + 80));
    const ctaX = padX;
    parts.push(`<rect x="${ctaX}" y="${pillY}" width="${ctaW}" height="${pillH}" rx="${pillH / 2}" fill="${colors.secondary}"/>`);
    parts.push(`<text x="${ctaX + ctaW / 2}" y="${pillY + pillH / 2}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${ctaText}</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  const composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) composite.push({ input: logoBuffer, top: 26, left: padX });

  return sharp(resizedBuffer)
    .composite(composite)
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Template C — "Top Card Window" ────────────────────────────────────────────
// Brand card covers top 54% with angled bottom edge (SVG polygon).
// Photo "windows" out below — you see the actual job through a frame.
// Accent label pill inside card. CTA pill straddles card-photo boundary.
// Best for: service listings, testimonials, why-choose-us, professional posts.

async function buildTemplateC(resizedBuffer, cardOverlay, businessName, phone, colors, logoBuffer) {
  const {
    headline = '', eyebrow = '', subtext = '', cta = '',
    badge = '', uppercase = false,
  } = cardOverlay;

  const headText  = uppercase ? headline.toUpperCase() : toTitleCase(headline);
  const headLines = wrapText(escapeXml(headText), 14);
  const subLines  = wrapText(escapeXml(subtext), 26);
  const padX      = 58;
  const dark      = darkenHex(colors.primary, 0.30);

  // Card geometry — angled bottom edge (40px drop from left to right)
  const cardTopY    = 0;
  const cardBotLeft = 700;   // card bottom-left corner Y
  const cardBotRight= 660;   // card bottom-right corner Y (angled up)
  // Polygon: top-left → top-right → bottom-right → bottom-left
  const cardPoly = `0,${cardTopY} ${W},${cardTopY} ${W},${cardBotRight} 0,${cardBotLeft}`;

  const headStartY = 150;
  const headLineH  = 76;
  const headEndY   = headStartY + headLines.length * headLineH;
  const accentBarY = headEndY + 20;
  const subStartY  = accentBarY + 58;
  const subLineH   = 34;

  // CTA pill straddles card-photo boundary
  const ctaY = cardBotLeft - 34; // centered on the card bottom edge

  const parts = [
    // ── Top gradient so logo is readable even without card ──
    `<defs>
      <linearGradient id="topDarkC" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0.40"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.00"/>
      </linearGradient>
      <linearGradient id="botDarkC" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${dark}" stop-opacity="0.00"/>
        <stop offset="50%"  stop-color="${dark}" stop-opacity="0.75"/>
        <stop offset="100%" stop-color="${dark}" stop-opacity="0.96"/>
      </linearGradient>
    </defs>`,

    // ── Brand card (angled polygon) ──
    `<polygon points="${cardPoly}" fill="${colors.primary}" opacity="0.94"/>`,

    // ── Subtle inner highlight line at top of card ──
    `<line x1="0" y1="1" x2="${W}" y2="1" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>`,

    // ── Accent left stripe on card ──
    `<rect x="0" y="0" width="6" height="${cardBotLeft}" fill="${colors.secondary}" opacity="0.90"/>`,

    // ── Top darkener (logo readable over card) ──
    `<rect x="0" y="0" width="${W}" height="100" fill="url(#topDarkC)"/>`,

    // ── Bottom strip darkener (phone zone) ──
    `<rect x="0" y="${H - 150}" width="${W}" height="150" fill="url(#botDarkC)"/>`,
  ];

  // ── Logo + business name — top left ──
  if (logoBuffer) {
    parts.push(`<text x="${padX + 82}" y="56" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  } else {
    parts.push(hexIcon(padX + 22, 56, 22));
    parts.push(`<text x="${padX + 54}" y="56" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  }

  // ── Trust badge pill — top right ──
  if (badge) {
    const badgeText = escapeXml(badge.toUpperCase());
    const badgeW = Math.max(200, badgeText.length * 11 + 48);
    const badgeX = W - badgeW - 22;
    parts.push(`<rect x="${badgeX}" y="30" width="${badgeW}" height="48" rx="24" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.50)" stroke-width="1.5"/>`);
    parts.push(`<text x="${badgeX + badgeW / 2}" y="54" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="17" font-weight="700" letter-spacing="0.5" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${badgeText}</text>`);
  }

  // ── Eyebrow ──
  if (eyebrow) {
    parts.push(`<text x="${padX}" y="${headStartY - 36}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="19" font-weight="700" letter-spacing="2.5" fill="${colors.secondary}" dominant-baseline="hanging">${escapeXml(eyebrow.toUpperCase())}</text>`);
  }

  // ── Headline ──
  headLines.forEach((l, i) => {
    parts.push(
      `<text x="${padX}" y="${headStartY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="74" font-weight="900" letter-spacing="-2" fill="#ffffff" dominant-baseline="hanging">${l}</text>`
    );
  });

  // ── Accent label pill (Borcelle-style: brand secondary behind text) ──
  if (subtext) {
    const accentLabel = subLines[0]; // first line in accent pill
    const accentW = Math.min(640, Math.max(240, accentLabel.length * 13 + 48));
    parts.push(`<rect x="${padX}" y="${accentBarY}" width="${accentW}" height="44" rx="6" fill="${colors.secondary}" opacity="0.92"/>`);
    parts.push(`<text x="${padX + 16}" y="${accentBarY + 22}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="700" fill="#ffffff" dominant-baseline="middle">${accentLabel}</text>`);

    // Remaining subtext lines below the accent bar
    subLines.slice(1).forEach((l, i) => {
      parts.push(
        `<text x="${padX}" y="${subStartY + i * subLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="26" font-weight="400" fill="#ffffff" opacity="0.86" dominant-baseline="hanging">${l}</text>`
      );
    });
  }

  // ── CTA pill straddling card-photo boundary ──
  if (cta) {
    const ctaText = escapeXml(cta.toUpperCase());
    const ctaW = Math.min(520, Math.max(240, ctaText.length * 17 + 80));
    const ctaX = padX;
    parts.push(`<rect x="${ctaX}" y="${ctaY}" width="${ctaW}" height="68" rx="34" fill="#ffffff"/>`);
    parts.push(`<text x="${ctaX + ctaW / 2}" y="${ctaY + 34}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="23" font-weight="900" fill="${colors.primary}" text-anchor="middle" dominant-baseline="middle">${ctaText}</text>`);
  }

  // ── Bottom: phone + business name over photo ──
  const phoneFormatted = formatPhone(phone);
  if (phoneFormatted) {
    parts.push(`<text x="${W / 2}" y="${H - 90}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="36" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${escapeXml(phoneFormatted)}</text>`);
    parts.push(`<text x="${W / 2}" y="${H - 44}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="18" font-weight="500" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" opacity="0.72">${escapeXml(businessName)}</text>`);
  } else {
    parts.push(`<text x="${W / 2}" y="${H - 52}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="19" font-weight="500" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" opacity="0.78">${escapeXml(businessName)}</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  const composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) composite.push({ input: logoBuffer, top: 20, left: padX });

  return sharp(resizedBuffer)
    .composite(composite)
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate 3 branded photo card variations from an AI-generated photo buffer.
 *
 * @param {Buffer}  photoBuffer  — raw image buffer from NanoBanana
 * @param {Object}  cardOverlay  — { headline, eyebrow, subtext, cta, badge, services, uppercase, recommended }
 * @param {Object}  customer     — customer DB row (brand_colors, business_name, logo_url, phone)
 * @returns {{ bufferA, bufferB, bufferC }}
 */
async function generatePhotoCards(photoBuffer, cardOverlay, customer) {
  const colors       = resolveBrandColors(customer);
  const businessName = customer?.business_name || '';
  const phone        = customer?.phone || null;

  const logoBuffer = await fetchLogoBuffer(customer?.logo_url);
  const resized    = await resizePhoto(photoBuffer);

  const [bufferA, bufferB, bufferC] = await Promise.all([
    buildTemplateA(resized, cardOverlay, businessName, phone, colors, logoBuffer),
    buildTemplateB(resized, cardOverlay, businessName, phone, colors, logoBuffer),
    buildTemplateC(resized, cardOverlay, businessName, phone, colors, logoBuffer),
  ]);

  return { bufferA, bufferB, bufferC };
}

module.exports = { generatePhotoCards, resolveBrandColors };
