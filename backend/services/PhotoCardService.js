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

// ── Industry icon paths (Material Icons, normalized 24×24 viewBox) ─────────────
const INDUSTRY_ICONS = {
  plumbing:           'M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z',
  hvac:               'M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z',
  roofing:            'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  landscaping:        'M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-5 8',
  electrical:         'M7 2v11h3v9l7-12h-4l4-8z',
  painting:           'M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34c-.39-.39-1.02-.39-1.41 0L9 12.25 11.75 15l8.96-8.96c.39-.39.39-1.02 0-1.41z',
  pest_control:       'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z',
  concrete:           'M3 3h8v8H3V3zm0 10h8v8H3v-8zm10-10h8v8h-8V3zm0 10h8v8h-8v-8z',
  cleaning:           'M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z',
  general_contractor: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z',
  tree_service:       'M12 2a9 9 0 0 1 9 9c0 3.74-2.29 6.96-5.57 8.33L15 22H9l.57-2.67C6.29 17.96 4 14.74 4 11c0-4.97 4.03-9 8-9zm1 14.9V18h-2v-1.1A7.007 7.007 0 0 1 5 11c0-3.86 3.14-7 7-7s7 3.14 7 7a7.007 7.007 0 0 1-6 6.9z',
  pressure_washing:   'M5 3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h4v-2H5V5h4V3H5zm10 0v2h4v14h-4v2h4c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-4zm-4 4l-1 2h3l-4 6h5l-1 2h3l1-2h-3l4-6h-5l1-2h-3z',
  pool_spa:           'M22 21c-1.11 0-1.73-.37-2.5-1-1.12.93-3.04 1-4 0-1 1-2.88.93-4 0-1 1-2.88.93-4 0-.77.63-1.39 1-2.5 1v-2c1.11 0 1.73-.37 2.5-1 1.12.93 3.04 1 4 0 1 1 2.88.93 4 0 1 1 2.88.93 4 0 .77.63 1.39 1 2.5 1v2zm-10-4.5c-.78 0-1.5-.35-2-.83V11.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v4.17c-.5.48-1.22.83-2 .83h1zm4-4.33V11.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v4.17c-.5.48-1.22.83-2 .83h-1c-.78 0-1.5-.35-2-.83V16.5l2 .17zM12 6c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z',
  handyman:           'M21.71 20.29L18 16.59A9 9 0 1 0 16.59 18l3.7 3.71a1 1 0 0 0 1.42 0 1 1 0 0 0 0-1.42zM11 18a7 7 0 1 1 7-7 7 7 0 0 1-7 7zm1-11h-2v3H7v2h3v3h2v-3h3v-2h-3z',
  flooring:           'M4 4h4v4H4zm0 6h4v4H4zm0 6h4v4H4zm6-12h4v4h-4zm0 6h4v4h-4zm0 6h4v4h-4zm6-12h4v4h-4zm0 6h4v4h-4zm0 6h4v4h-4z',
  junk_removal:       'M15 4V3H9v1H4v2h1l1 13h12l1-13h1V4h-5zm-4 11H9.5l-.5-7h2v7zm4 0h-2V8h2v7zm1.5 0H15V8h2l-.5 7z',
  solar:              'M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z',
  gutter_cleaning:    'M19 2H5C3.9 2 3 2.9 3 4v15c0 1.1.9 2 2 2h3l1 1h6l1-1h3c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 17H5V4h14v15z',
};

// Phone handset icon (Material Icons "phone" 24×24)
const PHONE_PATH = 'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z';

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

// Industry icon inside a circle — replaces generic hexagon placeholder
function industryIconSvg(cx, cy, r, industry, bgColor = 'rgba(255,255,255,0.95)', iconColor = '#1B3A6B') {
  const pathData = INDUSTRY_ICONS[industry] || INDUSTRY_ICONS.general_contractor;
  const scale = (r * 1.35) / 24;
  const tx = (cx - 12 * scale).toFixed(2);
  const ty = (cy - 12 * scale).toFixed(2);
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bgColor}"/><path d="${pathData}" transform="translate(${tx},${ty}) scale(${scale.toFixed(4)})" fill="${iconColor}"/>`;
}

// Phone handset icon at (cx,cy) center, given size
function phoneIconSvg(cx, cy, size, color = '#ffffff') {
  const scale = size / 24;
  const tx = (cx - 12 * scale).toFixed(2);
  const ty = (cy - 12 * scale).toFixed(2);
  return `<path d="${PHONE_PATH}" transform="translate(${tx},${ty}) scale(${scale.toFixed(4)})" fill="${color}"/>`;
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

async function buildTemplateA(resizedBuffer, cardOverlay, businessName, phone, colors, logoBuffer, industry) {
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
    parts.push(industryIconSvg(padX + 22, 58, 22, industry, 'rgba(255,255,255,0.95)', colors.primary));
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

  // ── Bottom: phone icon + number (large) + CTA or business name ──
  const phoneFormatted = formatPhone(phone);
  if (phoneFormatted) {
    // Phone icon left of center, number to its right — centered as a group
    const iconSize = 26;
    const approxNumWidth = phoneFormatted.length * 22; // approx at 38px bold
    const groupWidth = iconSize + 12 + approxNumWidth;
    const groupX = Math.round(W / 2 - groupWidth / 2);
    parts.push(phoneIconSvg(groupX + iconSize / 2, H - 96, iconSize, '#ffffff'));
    parts.push(`<text x="${groupX + iconSize + 12}" y="${H - 96}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="38" font-weight="900" fill="#ffffff" dominant-baseline="middle">${escapeXml(phoneFormatted)}</text>`);
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

async function buildTemplateB(resizedBuffer, cardOverlay, businessName, phone, colors, logoBuffer, industry) {
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
    parts.push(industryIconSvg(padX + 22, 62, 22, industry, 'rgba(20,20,20,0.85)', colors.secondary));
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
    // Right pill: phone icon + number, filled with secondary color
    const rW = Math.max(300, phoneFormatted.length * 16 + 104);
    const rX = padX + lW + 20;
    const pillCY = pillY + pillH / 2;
    parts.push(`<rect x="${rX}" y="${pillY}" width="${rW}" height="${pillH}" rx="${pillH / 2}" fill="${colors.secondary}"/>`);
    parts.push(phoneIconSvg(rX + 24, pillCY, 20, '#ffffff'));
    parts.push(`<text x="${rX + 52}" y="${pillCY}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="800" fill="#ffffff" dominant-baseline="middle">${escapeXml(phoneFormatted)}</text>`);
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

async function buildTemplateC(resizedBuffer, cardOverlay, businessName, phone, colors, logoBuffer, industry) {
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
    parts.push(industryIconSvg(padX + 22, 56, 22, industry, 'rgba(255,255,255,0.92)', colors.primary));
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

  // ── Bottom: phone icon + number + business name over photo ──
  const phoneFormatted = formatPhone(phone);
  if (phoneFormatted) {
    const iconSize = 24;
    const approxNumWidth = phoneFormatted.length * 20;
    const groupWidth = iconSize + 10 + approxNumWidth;
    const groupX = Math.round(W / 2 - groupWidth / 2);
    parts.push(phoneIconSvg(groupX + iconSize / 2, H - 90, iconSize, '#ffffff'));
    parts.push(`<text x="${groupX + iconSize + 10}" y="${H - 90}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="36" font-weight="900" fill="#ffffff" dominant-baseline="middle">${escapeXml(phoneFormatted)}</text>`);
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
  const industry     = customer?.industry || 'general_contractor';

  const logoBuffer = await fetchLogoBuffer(customer?.logo_url);
  const resized    = await resizePhoto(photoBuffer);

  const [bufferA, bufferB, bufferC] = await Promise.all([
    buildTemplateA(resized, cardOverlay, businessName, phone, colors, logoBuffer, industry),
    buildTemplateB(resized, cardOverlay, businessName, phone, colors, logoBuffer, industry),
    buildTemplateC(resized, cardOverlay, businessName, phone, colors, logoBuffer, industry),
  ]);

  return { bufferA, bufferB, bufferC };
}

module.exports = { generatePhotoCards, resolveBrandColors };
