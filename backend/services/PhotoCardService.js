/**
 * PhotoCardService — Pixel-Perfect Photo Card Design Engine
 *
 * Three world-class templates. Photo is ALWAYS full-bleed background.
 * Brand overlays float on top via gradients, polygons, and shapes.
 *
 * Template A — "Left Fade Pro":     gradient left→transparent, subject right, text left
 * Template B — "Angular Impact":    diagonal triangle overlay, huge headline, editorial checklist
 * Template C — "Top Card Window":   angled card top 54%, photo visible below as a window
 *
 * Two render modes:
 *   Sharp mode  (browserMode=false) — composites onto photo buffer → JPEG → Cloudinary
 *   Browser mode (browserMode=true) — returns self-contained SVG string with <image href="..."/>
 *                                      for live in-browser preview and instant text editing.
 *   Text elements in browser mode carry data-field="..." attributes so the frontend can
 *   update them via DOMParser/XMLSerializer without a network round-trip.
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

function lightenHex(hex, factor = 0.25) {
  const h = (hex || '#3B82F6').replace('#', '').padStart(6, '0');
  const r = Math.min(255, Math.round(parseInt(h.slice(0, 2), 16) + (255 - parseInt(h.slice(0, 2), 16)) * factor));
  const g = Math.min(255, Math.round(parseInt(h.slice(2, 4), 16) + (255 - parseInt(h.slice(2, 4), 16)) * factor));
  const b = Math.min(255, Math.round(parseInt(h.slice(4, 6), 16) + (255 - parseInt(h.slice(4, 6), 16)) * factor));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function industryIconSvg(cx, cy, r, industry, bgColor = 'rgba(255,255,255,0.95)', iconColor = '#1B3A6B') {
  const pathData = INDUSTRY_ICONS[industry] || INDUSTRY_ICONS.general_contractor;
  const scale = (r * 1.35) / 24;
  const tx = (cx - 12 * scale).toFixed(2);
  const ty = (cy - 12 * scale).toFixed(2);
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bgColor}"/><path d="${pathData}" transform="translate(${tx},${ty}) scale(${scale.toFixed(4)})" fill="${iconColor}"/>`;
}

function phoneIconSvg(cx, cy, size, color = '#ffffff') {
  const scale = size / 24;
  const tx = (cx - 12 * scale).toFixed(2);
  const ty = (cy - 12 * scale).toFixed(2);
  return `<path d="${PHONE_PATH}" transform="translate(${tx},${ty}) scale(${scale.toFixed(4)})" fill="${color}"/>`;
}

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

async function resizePhoto(buffer) {
  return sharp(buffer)
    .rotate()
    .resize(W, H, { fit: 'cover', position: 'center' })
    .toBuffer();
}

function formatPhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1') return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  return raw;
}

// ── Design Seed System ─────────────────────────────────────────────────────────
// Deterministic visual fingerprint per business — same customer always gets the
// same template variants (brand consistency), different customers get different
// variants (no two businesses look the same, even in the same industry).

function computeDesignSeed(customerId, businessName) {
  const str = `${customerId || 0}|${businessName || ''}`;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash;
}

function getDesignFingerprint(customer) {
  const seed = computeDesignSeed(customer?.id, customer?.business_name);
  return {
    // Swap primary/secondary color roles — same template, completely different feel
    colorRole:        (seed >> 18) % 2,           // 0=normal, 1=swapped
    // Card/overlay opacity variation
    overlayOpacity:   0.82 + ((seed >> 12) % 3) * 0.05, // 0.82 | 0.87 | 0.92
    // Decoration density for accent elements
    decorDensity:     (seed >> 15) % 3,            // 0=minimal, 1=standard, 2=rich
    // Typography weight variation
    typographyWeight: (seed >> 9) % 2,             // 0=900 heavy, 1=800 bold
    // Which of 3 template lineups this customer sees for each trigger type
    lineupOffset:     (seed >> 3) % 3,             // 0, 1, or 2
  };
}

// ── Template A — "Left Fade Pro" ──────────────────────────────────────────────
async function buildTemplateA(
  resizedBuffer, cardOverlay, businessName, phone, colors, logoBuffer, industry,
  browserMode = false, photoUrl = null, logoUrl = null
) {
  const {
    headline = '', eyebrow = '', subtext = '', cta = '',
    badge = '', services = [], uppercase = true,
  } = cardOverlay;

  const headText  = uppercase ? headline.toUpperCase() : toTitleCase(headline);
  const headLines = wrapText(escapeXml(headText), 13);
  const subLines  = wrapText(escapeXml(subtext), 24);
  const padX      = 58;
  const dark      = darkenHex(colors.primary, 0.28);

  const headLineH  = 82;
  const headStartY = 168;
  const headEndY   = headStartY + headLines.length * headLineH;
  const dividerY   = headEndY + 18;
  const subStartY  = dividerY + 28;
  const subLineH   = 44;
  const listStartY = subStartY + subLines.length * subLineH + 32;
  const listLineH  = 60;
  const bullets    = Array.isArray(services) ? services.slice(0, 4) : [];

  // data-field attribute helper — only added in browser mode for live editing
  const df = (field) => browserMode ? ` data-field="${field}"` : '';

  const parts = [];

  // Browser mode: photo is an <image> URL reference at the bottom of the layer stack
  if (browserMode && photoUrl) {
    parts.push(`<image href="${escapeXml(photoUrl)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`);
  }

  parts.push(
    `<defs>
      <linearGradient id="fadeA" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0.88"/>
        <stop offset="44%"  stop-color="#000000" stop-opacity="0.76"/>
        <stop offset="66%"  stop-color="#000000" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.00"/>
      </linearGradient>
      <linearGradient id="topDarkA" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0.74"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.00"/>
      </linearGradient>
      <linearGradient id="botDarkA" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${dark}" stop-opacity="0.00"/>
        <stop offset="28%"  stop-color="${dark}" stop-opacity="0.92"/>
        <stop offset="100%" stop-color="${dark}" stop-opacity="0.98"/>
      </linearGradient>
    </defs>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#fadeA)"/>`,
    `<rect x="0" y="0" width="${Math.floor(W * 0.62)}" height="${H}" fill="${colors.primary}" opacity="0.20"/>`,
    `<rect x="0" y="0" width="${W}" height="110" fill="url(#topDarkA)"/>`,
    `<rect x="0" y="${H - 165}" width="${W}" height="165" fill="url(#botDarkA)"/>`,
    `<rect x="0" y="0" width="9" height="${H}" fill="${colors.secondary}" opacity="1.0"/>`,
  );

  // Logo + business name — top left
  const hasLogo = browserMode ? !!logoUrl : !!logoBuffer;
  if (hasLogo) {
    parts.push(`<text x="${padX + 82}" y="58" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  } else {
    parts.push(industryIconSvg(padX + 22, 58, 22, industry, 'rgba(255,255,255,0.95)', colors.primary));
    parts.push(`<text x="${padX + 54}" y="58" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  }

  // Trust badge pill — top right
  if (badge) {
    const badgeText = escapeXml(badge.toUpperCase());
    const badgeW = Math.max(200, badgeText.length * 11 + 48);
    const badgeX = W - badgeW - 22;
    parts.push(`<rect x="${badgeX}" y="34" width="${badgeW}" height="48" rx="24" fill="rgba(255,255,255,0.92)"/>`);
    parts.push(`<text${df('badge')} x="${badgeX + badgeW / 2}" y="58" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="17" font-weight="800" letter-spacing="0.5" fill="${colors.primary}" text-anchor="middle" dominant-baseline="middle">${badgeText}</text>`);
  }

  // Eyebrow
  if (eyebrow) {
    parts.push(`<text${df('eyebrow')} x="${padX}" y="${headStartY - 34}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="19" font-weight="700" letter-spacing="2" fill="${colors.secondary}" dominant-baseline="hanging">${escapeXml(eyebrow.toUpperCase())}</text>`);
  }

  // Main headline lines
  headLines.forEach((l, i) => {
    parts.push(
      `<text${df(`headline-${i}`)} x="${padX}" y="${headStartY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="80" font-weight="900" letter-spacing="-2.5" fill="#ffffff" stroke="#000000" stroke-width="10" stroke-opacity="0.42" paint-order="stroke fill" dominant-baseline="hanging">${l}</text>`
    );
  });

  // Accent divider bar — thicker, more prominent
  parts.push(`<rect x="${padX}" y="${dividerY}" width="180" height="7" rx="3.5" fill="${colors.secondary}" opacity="1.0"/>`);

  // Subtext lines
  subLines.forEach((l, i) => {
    parts.push(
      `<text${df(`subtext-${i}`)} x="${padX}" y="${subStartY + i * subLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="34" font-weight="400" fill="#ffffff" opacity="0.88" dominant-baseline="hanging">${l}</text>`
    );
  });

  // Service checklist — filled circle bullets in brand secondary color
  bullets.forEach((item, i) => {
    const y = listStartY + i * listLineH + 24;
    const dotR = 9;
    const dotCx = padX + dotR + 1;
    parts.push(`<circle cx="${dotCx}" cy="${y}" r="${dotR}" fill="${colors.secondary}"/>`);
    parts.push(`<text${df(`service-${i}`)} x="${padX + dotR * 2 + 16}" y="${y}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="32" font-weight="600" fill="#ffffff" stroke="#000000" stroke-width="4" stroke-opacity="0.30" paint-order="stroke fill" dominant-baseline="middle">${escapeXml(item)}</text>`);
  });

  // Bottom: phone icon + number + CTA / business name
  const phoneFormatted = formatPhone(phone);
  if (phoneFormatted) {
    const iconSize = 26;
    const approxNumWidth = phoneFormatted.length * 22;
    const groupWidth = iconSize + 12 + approxNumWidth;
    const groupX = Math.round(W / 2 - groupWidth / 2);
    parts.push(phoneIconSvg(groupX + iconSize / 2, H - 96, iconSize, '#ffffff'));
    parts.push(`<text${df('phone')} x="${groupX + iconSize + 12}" y="${H - 96}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="38" font-weight="900" fill="#ffffff" dominant-baseline="middle">${escapeXml(phoneFormatted)}</text>`);
    parts.push(`<text${df('cta')} x="${W / 2}" y="${H - 44}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="18" font-weight="500" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" opacity="0.72">${escapeXml(cta || businessName)}</text>`);
  } else {
    if (cta) {
      const ctaW = Math.min(500, Math.max(260, cta.length * 16 + 80));
      const ctaX = padX;
      const ctaY = H - 136;
      parts.push(`<rect x="${ctaX}" y="${ctaY}" width="${ctaW}" height="68" rx="34" fill="${colors.secondary}"/>`);
      parts.push(`<rect x="${ctaX + 3}" y="${ctaY + 3}" width="${ctaW - 6}" height="62" rx="31" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1.5"/>`);
      parts.push(`<text${df('cta')} x="${ctaX + ctaW / 2}" y="${ctaY + 34}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${escapeXml(cta.toUpperCase())}</text>`);
    }
    parts.push(`<text x="${W / 2}" y="${H - 44}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="18" font-weight="500" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" opacity="0.65">${escapeXml(businessName)}</text>`);
  }

  // ── Browser mode: return self-contained SVG string ─────────────────────────
  if (browserMode) {
    if (logoUrl) {
      parts.push(`<image href="${escapeXml(logoUrl)}" x="${padX}" y="22" width="68" height="68" preserveAspectRatio="xMidYMid meet"/>`);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">${parts.join('')}</svg>`;
  }

  // ── Sharp mode: composite onto photo buffer → JPEG ─────────────────────────
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  const composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) composite.push({ input: logoBuffer, top: 22, left: padX });
  return sharp(resizedBuffer)
    .composite(composite)
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Template B — "Angular Impact" ─────────────────────────────────────────────
async function buildTemplateB(
  resizedBuffer, cardOverlay, businessName, phone, colors, logoBuffer, industry,
  browserMode = false, photoUrl = null, logoUrl = null
) {
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
  const subLineH   = 44;
  const listStartY = subStartY + subLines.length * subLineH + 36;
  const listLineH  = 58;
  const bullets    = Array.isArray(services) ? services.slice(0, 3) : [];

  const df = (field) => browserMode ? ` data-field="${field}"` : '';

  const parts = [];

  if (browserMode && photoUrl) {
    parts.push(`<image href="${escapeXml(photoUrl)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`);
  }

  parts.push(
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
    `<polygon points="0,0 760,0 0,1100" fill="url(#triGradB)"/>`,
    `<rect x="0" y="${H - 140}" width="${W}" height="140" fill="url(#botDarkB)"/>`,
    `<polygon points="0,0 180,0 0,160" fill="${colors.secondary}" opacity="0.88"/>`,
    `<line x1="760" y1="0" x2="0" y2="1100" stroke="${colors.secondary}" stroke-width="3" opacity="0.45"/>`,
  );

  const hasLogo = browserMode ? !!logoUrl : !!logoBuffer;
  if (hasLogo) {
    parts.push(`<text x="${padX + 82}" y="62" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="21" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  } else {
    parts.push(industryIconSvg(padX + 22, 62, 22, industry, 'rgba(20,20,20,0.85)', colors.secondary));
    parts.push(`<text x="${padX + 54}" y="62" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="21" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  }

  if (badge) {
    const badgeText = escapeXml(badge.toUpperCase());
    const badgeW = Math.max(190, badgeText.length * 11 + 44);
    const badgeX = W - badgeW - 22;
    parts.push(`<rect x="${badgeX}" y="34" width="${badgeW}" height="48" rx="24" fill="${colors.secondary}"/>`);
    parts.push(`<text${df('badge')} x="${badgeX + badgeW / 2}" y="58" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="17" font-weight="800" letter-spacing="0.5" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${badgeText}</text>`);
  }

  if (eyebrow) {
    parts.push(`<text${df('eyebrow')} x="${padX}" y="${headStartY - 38}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="700" letter-spacing="3" fill="${colors.secondary}" dominant-baseline="hanging">${escapeXml(eyebrow.toUpperCase())}</text>`);
  }

  headLines.forEach((l, i) => {
    parts.push(
      `<text${df(`headline-${i}`)} x="${padX}" y="${headStartY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="96" font-weight="900" letter-spacing="-3.5" fill="#ffffff" stroke="#000000" stroke-width="12" stroke-opacity="0.42" paint-order="stroke fill" dominant-baseline="hanging">${l}</text>`
    );
  });

  subLines.forEach((l, i) => {
    parts.push(
      `<text${df(`subtext-${i}`)} x="${padX}" y="${subStartY + i * subLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="34" font-weight="400" fill="#ffffff" stroke="#000000" stroke-width="4" stroke-opacity="0.30" paint-order="stroke fill" opacity="0.92" dominant-baseline="hanging">${l}</text>`
    );
  });

  // Editorial checklist — pill backdrop + brand stripe per item
  bullets.forEach((item, i) => {
    const itemY = listStartY + i * listLineH;
    const textH = 46;
    const itemW = Math.min(700, item.length * 15 + 64);
    parts.push(`<rect x="${padX}" y="${itemY}" width="${itemW}" height="${textH}" rx="8" fill="rgba(0,0,0,0.45)"/>`);
    parts.push(`<rect x="${padX}" y="${itemY}" width="9" height="${textH}" rx="4" fill="${colors.secondary}"/>`);
    parts.push(`<text${df(`service-${i}`)} x="${padX + 27}" y="${itemY + textH / 2}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="30" font-weight="600" fill="#ffffff" dominant-baseline="middle">${escapeXml(item)}</text>`);
  });

  const phoneFormatted = formatPhone(phone);
  const pillH = 62;
  const pillY = H - pillH - 30;
  if (phoneFormatted) {
    const lW = 220;
    parts.push(`<rect x="${padX}" y="${pillY}" width="${lW}" height="${pillH}" rx="${pillH / 2}" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2"/>`);
    parts.push(`<text x="${padX + lW / 2}" y="${pillY + pillH / 2}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">Contact Us</text>`);
    const rW = Math.max(300, phoneFormatted.length * 16 + 104);
    const rX = padX + lW + 20;
    const pillCY = pillY + pillH / 2;
    parts.push(`<rect x="${rX}" y="${pillY}" width="${rW}" height="${pillH}" rx="${pillH / 2}" fill="${colors.secondary}"/>`);
    parts.push(phoneIconSvg(rX + 24, pillCY, 20, '#ffffff'));
    parts.push(`<text${df('phone')} x="${rX + 52}" y="${pillCY}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="800" fill="#ffffff" dominant-baseline="middle">${escapeXml(phoneFormatted)}</text>`);
  } else {
    const ctaText = escapeXml((cta || 'Contact Us Today').toUpperCase());
    const ctaW = Math.min(640, Math.max(280, ctaText.length * 14 + 80));
    const ctaX = padX;
    parts.push(`<rect x="${ctaX}" y="${pillY}" width="${ctaW}" height="${pillH}" rx="${pillH / 2}" fill="${colors.secondary}"/>`);
    parts.push(`<text${df('cta')} x="${ctaX + ctaW / 2}" y="${pillY + pillH / 2}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${ctaText}</text>`);
  }

  if (browserMode) {
    if (logoUrl) {
      parts.push(`<image href="${escapeXml(logoUrl)}" x="${padX}" y="26" width="68" height="68" preserveAspectRatio="xMidYMid meet"/>`);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">${parts.join('')}</svg>`;
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
async function buildTemplateC(
  resizedBuffer, cardOverlay, businessName, phone, colors, logoBuffer, industry,
  browserMode = false, photoUrl = null, logoUrl = null
) {
  const {
    headline = '', eyebrow = '', subtext = '', cta = '',
    badge = '', uppercase = false,
  } = cardOverlay;

  const headText  = uppercase ? headline.toUpperCase() : toTitleCase(headline);
  const headLines = wrapText(escapeXml(headText), 14);
  const subLines  = wrapText(escapeXml(subtext), 26);
  const padX      = 58;
  const dark      = darkenHex(colors.primary, 0.30);

  const cardTopY     = 0;
  const cardBotLeft  = 700;
  const cardBotRight = 660;
  const cardPoly     = `0,${cardTopY} ${W},${cardTopY} ${W},${cardBotRight} 0,${cardBotLeft}`;

  const headStartY = 150;
  const headLineH  = 76;
  const headEndY   = headStartY + headLines.length * headLineH;
  const accentBarY = headEndY + 20;
  const subStartY  = accentBarY + 58;
  const subLineH   = 34;
  const ctaY       = cardBotLeft - 34;

  const df = (field) => browserMode ? ` data-field="${field}"` : '';

  const parts = [];

  if (browserMode && photoUrl) {
    parts.push(`<image href="${escapeXml(photoUrl)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`);
  }

  parts.push(
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
    `<polygon points="${cardPoly}" fill="${colors.primary}" opacity="0.94"/>`,
    `<line x1="0" y1="1" x2="${W}" y2="1" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>`,
    `<rect x="0" y="0" width="6" height="${cardBotLeft}" fill="${colors.secondary}" opacity="0.90"/>`,
    `<rect x="0" y="0" width="${W}" height="100" fill="url(#topDarkC)"/>`,
    `<rect x="0" y="${H - 150}" width="${W}" height="150" fill="url(#botDarkC)"/>`,
  );

  const hasLogo = browserMode ? !!logoUrl : !!logoBuffer;
  if (hasLogo) {
    parts.push(`<text x="${padX + 82}" y="56" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  } else {
    parts.push(industryIconSvg(padX + 22, 56, 22, industry, 'rgba(255,255,255,0.92)', colors.primary));
    parts.push(`<text x="${padX + 54}" y="56" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  }

  if (badge) {
    const badgeText = escapeXml(badge.toUpperCase());
    const badgeW = Math.max(200, badgeText.length * 11 + 48);
    const badgeX = W - badgeW - 22;
    parts.push(`<rect x="${badgeX}" y="30" width="${badgeW}" height="48" rx="24" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.50)" stroke-width="1.5"/>`);
    parts.push(`<text${df('badge')} x="${badgeX + badgeW / 2}" y="54" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="17" font-weight="700" letter-spacing="0.5" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${badgeText}</text>`);
  }

  if (eyebrow) {
    parts.push(`<text${df('eyebrow')} x="${padX}" y="${headStartY - 36}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="19" font-weight="700" letter-spacing="2.5" fill="${colors.secondary}" dominant-baseline="hanging">${escapeXml(eyebrow.toUpperCase())}</text>`);
  }

  headLines.forEach((l, i) => {
    parts.push(
      `<text${df(`headline-${i}`)} x="${padX}" y="${headStartY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="74" font-weight="900" letter-spacing="-2" fill="#ffffff" stroke="#000000" stroke-width="9" stroke-opacity="0.40" paint-order="stroke fill" dominant-baseline="hanging">${l}</text>`
    );
  });

  if (subtext) {
    const accentLabel = subLines[0];
    const accentW = Math.min(640, Math.max(240, accentLabel.length * 13 + 48));
    parts.push(`<rect x="${padX}" y="${accentBarY}" width="${accentW}" height="44" rx="6" fill="${colors.secondary}" opacity="0.92"/>`);
    parts.push(`<text${df('subtext-0')} x="${padX + 16}" y="${accentBarY + 22}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="700" fill="#ffffff" dominant-baseline="middle">${accentLabel}</text>`);

    subLines.slice(1).forEach((l, i) => {
      parts.push(
        `<text${df(`subtext-${i + 1}`)} x="${padX}" y="${subStartY + i * subLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="32" font-weight="400" fill="#ffffff" opacity="0.86" dominant-baseline="hanging">${l}</text>`
      );
    });
  }

  if (cta) {
    const ctaText = escapeXml(cta.toUpperCase());
    const ctaW = Math.min(520, Math.max(240, ctaText.length * 17 + 80));
    const ctaX = padX;
    parts.push(`<rect x="${ctaX}" y="${ctaY}" width="${ctaW}" height="68" rx="34" fill="#ffffff"/>`);
    parts.push(`<text${df('cta')} x="${ctaX + ctaW / 2}" y="${ctaY + 34}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="23" font-weight="900" fill="${colors.primary}" text-anchor="middle" dominant-baseline="middle">${ctaText}</text>`);
  }

  const phoneFormatted = formatPhone(phone);
  if (phoneFormatted) {
    const iconSize = 24;
    const approxNumWidth = phoneFormatted.length * 20;
    const groupWidth = iconSize + 10 + approxNumWidth;
    const groupX = Math.round(W / 2 - groupWidth / 2);
    parts.push(phoneIconSvg(groupX + iconSize / 2, H - 90, iconSize, '#ffffff'));
    parts.push(`<text${df('phone')} x="${groupX + iconSize + 10}" y="${H - 90}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="36" font-weight="900" fill="#ffffff" dominant-baseline="middle">${escapeXml(phoneFormatted)}</text>`);
    parts.push(`<text x="${W / 2}" y="${H - 44}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="18" font-weight="500" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" opacity="0.72">${escapeXml(businessName)}</text>`);
  } else {
    parts.push(`<text x="${W / 2}" y="${H - 52}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="19" font-weight="500" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" opacity="0.78">${escapeXml(businessName)}</text>`);
  }

  if (browserMode) {
    if (logoUrl) {
      parts.push(`<image href="${escapeXml(logoUrl)}" x="${padX}" y="20" width="68" height="68" preserveAspectRatio="xMidYMid meet"/>`);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">${parts.join('')}</svg>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  const composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) composite.push({ input: logoBuffer, top: 20, left: padX });
  return sharp(resizedBuffer)
    .composite(composite)
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Template D — "Brand Immersion" (Claude Design style) ─────────────────────
// Full-bleed photo with solid brand-color tint over the ENTIRE canvas.
// Unlike Template A's directional gradient, the brand color wraps everything
// uniformly, making the image feel like a branded ad rather than a photo with
// text on top. Ideal for promotions, seasonal pushes, and milestone posts.
async function buildTemplateD(
  resizedBuffer, cardOverlay, businessName, phone, colors, logoBuffer, industry,
  browserMode = false, photoUrl = null, logoUrl = null
) {
  const {
    headline = '', eyebrow = '', subtext = '', cta = '',
    badge = '', services = [], uppercase = false,
  } = cardOverlay;

  const headText  = uppercase ? headline.toUpperCase() : toTitleCase(headline);
  const headLines = wrapText(escapeXml(headText), 14);
  const subLines  = wrapText(escapeXml(subtext), 28);
  const padX      = 58;

  // Parse brand primary into r,g,b for the rgba tint
  const hexToRgb = (hex) => {
    const h = (hex || '#1B3A6B').replace('#', '').padStart(6, '0');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  };
  const { r, g, b } = hexToRgb(colors.primary);
  const tintColor = `rgba(${r},${g},${b},0.62)`;

  const headLineH  = 84;
  const headStartY = 210;
  const headEndY   = headStartY + headLines.length * headLineH;
  const dividerY   = headEndY + 22;
  const subStartY  = dividerY + 38;
  const subLineH   = 44;
  const listStartY = subStartY + subLines.length * subLineH + 44;
  const listLineH  = 60;
  const bullets    = Array.isArray(services) ? services.slice(0, 4) : [];

  const df = (field) => browserMode ? ` data-field="${field}"` : '';

  const parts = [];

  if (browserMode && photoUrl) {
    parts.push(`<image href="${escapeXml(photoUrl)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`);
  }

  // Full-canvas brand color tint — the defining trait of this template
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${tintColor}"/>`);

  // Subtle top + bottom vignette for text legibility without killing the tint
  parts.push(
    `<defs>
      <linearGradient id="topVigD" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0.38"/>
        <stop offset="18%"  stop-color="#000000" stop-opacity="0.00"/>
      </linearGradient>
      <linearGradient id="botVigD" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0.00"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.42"/>
      </linearGradient>
    </defs>`,
    `<rect x="0" y="0" width="${W}" height="130" fill="url(#topVigD)"/>`,
    `<rect x="0" y="${H - 180}" width="${W}" height="180" fill="url(#botVigD)"/>`,
  );

  // Logo + business name — top left
  const hasLogo = browserMode ? !!logoUrl : !!logoBuffer;
  if (hasLogo) {
    parts.push(`<text x="${padX + 82}" y="58" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  } else {
    parts.push(industryIconSvg(padX + 22, 58, 24, industry, 'rgba(255,255,255,0.95)', colors.primary));
    parts.push(`<text x="${padX + 58}" y="58" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  }

  // Trust badge — white pill, brand-color text (Claude Design style)
  if (badge) {
    const badgeText = escapeXml(badge.toUpperCase());
    const badgeW = Math.max(210, badgeText.length * 11.5 + 52);
    const badgeX = W - badgeW - 24;
    parts.push(`<rect x="${badgeX}" y="30" width="${badgeW}" height="52" rx="26" fill="#ffffff"/>`);
    parts.push(`<text${df('badge')} x="${badgeX + badgeW / 2}" y="56" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="17" font-weight="800" letter-spacing="0.8" fill="${colors.primary}" text-anchor="middle" dominant-baseline="middle">${badgeText}</text>`);
  }

  // Eyebrow — secondary color, all caps, letter-spaced
  if (eyebrow) {
    parts.push(`<text${df('eyebrow')} x="${padX}" y="${headStartY - 44}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" letter-spacing="2.5" fill="${colors.secondary}" dominant-baseline="hanging">${escapeXml(eyebrow.toUpperCase())}</text>`);
  }

  // Large bold headline
  headLines.forEach((l, i) => {
    parts.push(
      `<text${df(`headline-${i}`)} x="${padX}" y="${headStartY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="82" font-weight="900" letter-spacing="-2.5" fill="#ffffff" stroke="#000000" stroke-width="8" stroke-opacity="0.28" paint-order="stroke fill" dominant-baseline="hanging">${l}</text>`
    );
  });

  // Divider line — secondary color
  parts.push(`<rect x="${padX}" y="${dividerY}" width="160" height="6" rx="3" fill="${colors.secondary}"/>`);

  // Subtext
  subLines.forEach((l, i) => {
    parts.push(
      `<text${df(`subtext-${i}`)} x="${padX}" y="${subStartY + i * subLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="34" font-weight="400" fill="#ffffff" opacity="0.90" dominant-baseline="hanging">${l}</text>`
    );
  });

  // Service bullets — secondary color dots + white text
  bullets.forEach((item, i) => {
    const y = listStartY + i * listLineH + 24;
    const dotR = 8;
    parts.push(`<circle cx="${padX + dotR}" cy="${y}" r="${dotR}" fill="${colors.secondary}"/>`);
    parts.push(`<text${df(`service-${i}`)} x="${padX + dotR * 2 + 16}" y="${y}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="32" font-weight="600" fill="#ffffff" dominant-baseline="middle">${escapeXml(item)}</text>`);
  });

  // CTA — white pill button with brand-color text (Claude Design style)
  const ctaY = H - 148;
  if (cta) {
    const ctaText = escapeXml(cta.toUpperCase());
    const ctaW = Math.min(480, Math.max(240, ctaText.length * 16 + 80));
    parts.push(`<rect x="${padX}" y="${ctaY}" width="${ctaW}" height="66" rx="33" fill="#ffffff"/>`);
    parts.push(`<text${df('cta')} x="${padX + ctaW / 2}" y="${ctaY + 33}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="900" fill="${colors.primary}" text-anchor="middle" dominant-baseline="middle">${ctaText}</text>`);
  }

  // Business name footer
  parts.push(`<text x="${W / 2}" y="${H - 44}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="18" font-weight="500" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" opacity="0.68">${escapeXml(businessName)}</text>`);

  if (browserMode) {
    if (logoUrl) {
      parts.push(`<image href="${escapeXml(logoUrl)}" x="${padX}" y="22" width="68" height="68" preserveAspectRatio="xMidYMid meet"/>`);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">${parts.join('')}</svg>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  const composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) composite.push({ input: logoBuffer, top: 22, left: padX });
  return sharp(resizedBuffer)
    .composite(composite)
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Template E — "Social Proof" ────────────────────────────────────────────────
// Dark frosted panel covers the bottom 55% with a sharp edge — no gradient,
// exactly like Canva/Envato testimonial templates. Massive decorative open-quote
// mark (&#x201C;) in secondary color as ghost watermark. Gold stars. The customer's
// quote (headline) is large and clean. Attribution in secondary color.
// Best for: reviews, testimonials. The customer's voice IS the design.
async function buildTemplateE(
  resizedBuffer, cardOverlay, businessName, phone, colors, logoBuffer, industry,
  browserMode = false, photoUrl = null, logoUrl = null
) {
  const {
    headline = '', eyebrow = '', subtext = '', cta = '',
    badge = '', services = [],
  } = cardOverlay;

  // Natural case for quotes — shouted quotes feel inauthentic
  const quoteLines  = wrapText(escapeXml(headline), 28);
  const padX        = 64;
  const panelTop    = Math.floor(H * 0.44);
  const panelH      = H - panelTop;
  const starsY      = panelTop + 48;
  const quoteStartY = starsY + 72;
  const quoteLineH  = 50;
  const attrY       = quoteStartY + quoteLines.length * quoteLineH + 24;

  const df = (field) => browserMode ? ` data-field="${field}"` : '';
  const parts = [];

  if (browserMode && photoUrl) {
    parts.push(`<image href="${escapeXml(photoUrl)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`);
  }

  parts.push(
    `<defs>
      <linearGradient id="topVigE" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.00"/>
      </linearGradient>
    </defs>`,
    `<rect x="0" y="0" width="${W}" height="120" fill="url(#topVigE)"/>`,
    // Sharp-edged dark panel — the Canva/Envato testimonial signature
    `<rect x="0" y="${panelTop}" width="${W}" height="${panelH}" fill="rgba(8,12,22,0.90)"/>`,
  );

  // Thin brand accent bar across very top
  parts.push(`<rect x="0" y="0" width="${W}" height="7" fill="${colors.secondary}"/>`);

  // Logo / business name — top left
  const hasLogo = browserMode ? !!logoUrl : !!logoBuffer;
  if (hasLogo) {
    parts.push(`<text x="${padX + 82}" y="56" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  } else {
    parts.push(industryIconSvg(padX + 22, 56, 22, industry, 'rgba(255,255,255,0.95)', colors.primary));
    parts.push(`<text x="${padX + 54}" y="56" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  }

  // Badge pill — brand primary background (contrasts with white secondaries above)
  if (badge) {
    const badgeText = escapeXml(badge.toUpperCase());
    const badgeW = Math.max(200, badgeText.length * 11 + 48);
    const badgeX = W - badgeW - 22;
    parts.push(`<rect x="${badgeX}" y="32" width="${badgeW}" height="48" rx="24" fill="${colors.primary}"/>`);
    parts.push(`<text${df('badge')} x="${badgeX + badgeW / 2}" y="56" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="17" font-weight="800" letter-spacing="0.5" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${badgeText}</text>`);
  }

  // Massive ghost open-quote mark — the Canva/Envato testimonial card signature
  parts.push(`<text x="${padX - 20}" y="${panelTop + 14}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="340" font-weight="900" fill="${colors.secondary}" opacity="0.18" dominant-baseline="hanging">&#x201C;</text>`);

  // Eyebrow label + 5 gold stars
  const starColor    = colors.secondary || '#F59E0B';
  const eyebrowLabel = eyebrow ? escapeXml(eyebrow.toUpperCase()) : 'VERIFIED CUSTOMER REVIEW';
  parts.push(`<text${df('eyebrow')} x="${padX}" y="${starsY}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="19" font-weight="700" letter-spacing="2" fill="${starColor}" dominant-baseline="hanging">${eyebrowLabel}</text>`);
  parts.push(`<text x="${padX}" y="${starsY + 30}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="34" fill="${starColor}" dominant-baseline="hanging">&#x2605;&#x2605;&#x2605;&#x2605;&#x2605;</text>`);

  // Quote text (headline) — natural case, large and clean, white
  quoteLines.forEach((l, i) => {
    parts.push(
      `<text${df(`headline-${i}`)} x="${padX}" y="${quoteStartY + i * quoteLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="40" font-weight="700" fill="#ffffff" dominant-baseline="hanging">${l}</text>`
    );
  });

  // Attribution — secondary color, em-dash prefix
  if (subtext) {
    parts.push(`<text${df('subtext-0')} x="${padX}" y="${attrY}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="30" font-weight="500" fill="${starColor}" dominant-baseline="hanging">${escapeXml('— ' + subtext)}</text>`);
  }

  // CTA pill
  if (cta) {
    const ctaText = escapeXml(cta.toUpperCase());
    const ctaW = Math.min(440, Math.max(240, ctaText.length * 15 + 72));
    const ctaY = H - 128;
    parts.push(`<rect x="${padX}" y="${ctaY}" width="${ctaW}" height="62" rx="31" fill="${colors.primary}"/>`);
    parts.push(`<text${df('cta')} x="${padX + ctaW / 2}" y="${ctaY + 31}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="21" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${ctaText}</text>`);
  }

  parts.push(`<text x="${W / 2}" y="${H - 40}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="18" font-weight="500" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" opacity="0.52">${escapeXml(businessName)}</text>`);

  if (browserMode) {
    if (logoUrl) {
      parts.push(`<image href="${escapeXml(logoUrl)}" x="${padX}" y="20" width="68" height="68" preserveAspectRatio="xMidYMid meet"/>`);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">${parts.join('')}</svg>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  const composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) composite.push({ input: logoBuffer, top: 20, left: padX });
  return sharp(resizedBuffer)
    .composite(composite)
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Template F — "Bold Number" ─────────────────────────────────────────────────
// Left-dark cinematic gradient + oversized ghost number as the anchor element.
// Services render as NUMBERED checklist items (filled circle badge + number + text)
// instead of dot bullets — the Canva/Envato tip-post signature.
// Best for: share_tip, faq, educational content ("3 Signs You Need a Plumber").
async function buildTemplateF(
  resizedBuffer, cardOverlay, businessName, phone, colors, logoBuffer, industry,
  browserMode = false, photoUrl = null, logoUrl = null
) {
  const {
    headline = '', eyebrow = '', subtext = '', cta = '',
    badge = '', services = [], uppercase = false,
  } = cardOverlay;

  const headText  = uppercase ? headline.toUpperCase() : toTitleCase(headline);
  const headLines = wrapText(escapeXml(headText), 14);
  const subLines  = wrapText(escapeXml(subtext), 26);
  const padX      = 58;
  const dark      = darkenHex(colors.primary, 0.28);

  // Extract the first number found in eyebrow (e.g. "3 Signs..." → "3") for ghost element
  const eyebrowStr = String(eyebrow || '');
  const numMatch   = eyebrowStr.match(/(\d+)/);
  const ghostNum   = numMatch ? numMatch[1] : '3';

  const headStartY = 200;
  const headLineH  = 80;
  const headEndY   = headStartY + headLines.length * headLineH;
  const dividerY   = headEndY + 16;
  const subStartY  = dividerY + 26;
  const subLineH   = 42;
  const listStartY = subStartY + subLines.length * subLineH + 36;
  const listLineH  = 64;
  const bullets    = Array.isArray(services) ? services.slice(0, 4) : [];

  const df = (field) => browserMode ? ` data-field="${field}"` : '';
  const parts = [];

  if (browserMode && photoUrl) {
    parts.push(`<image href="${escapeXml(photoUrl)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`);
  }

  parts.push(
    `<defs>
      <linearGradient id="fadeF" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0.91"/>
        <stop offset="50%"  stop-color="#000000" stop-opacity="0.78"/>
        <stop offset="72%"  stop-color="#000000" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.00"/>
      </linearGradient>
      <linearGradient id="botDarkF" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${dark}" stop-opacity="0.00"/>
        <stop offset="35%"  stop-color="${dark}" stop-opacity="0.90"/>
        <stop offset="100%" stop-color="${dark}" stop-opacity="0.98"/>
      </linearGradient>
      <linearGradient id="topDarkF" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0.66"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.00"/>
      </linearGradient>
    </defs>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#fadeF)"/>`,
    `<rect x="0" y="0" width="${W}" height="120" fill="url(#topDarkF)"/>`,
    `<rect x="0" y="${H - 160}" width="${W}" height="160" fill="url(#botDarkF)"/>`,
    `<rect x="0" y="0" width="9" height="${H}" fill="${colors.secondary}" opacity="1.0"/>`,
  );

  // Ghost number — enormous, anchors the entire dark left zone visually
  parts.push(`<text x="${padX - 10}" y="180" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="520" font-weight="900" letter-spacing="-20" fill="${colors.secondary}" opacity="0.09" dominant-baseline="hanging">${escapeXml(ghostNum)}</text>`);

  // Logo + business name
  const hasLogo = browserMode ? !!logoUrl : !!logoBuffer;
  if (hasLogo) {
    parts.push(`<text x="${padX + 82}" y="58" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  } else {
    parts.push(industryIconSvg(padX + 22, 58, 22, industry, 'rgba(255,255,255,0.95)', colors.primary));
    parts.push(`<text x="${padX + 54}" y="58" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  }

  if (badge) {
    const badgeText = escapeXml(badge.toUpperCase());
    const badgeW = Math.max(200, badgeText.length * 11 + 48);
    const badgeX = W - badgeW - 22;
    parts.push(`<rect x="${badgeX}" y="34" width="${badgeW}" height="48" rx="24" fill="rgba(255,255,255,0.92)"/>`);
    parts.push(`<text${df('badge')} x="${badgeX + badgeW / 2}" y="58" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="17" font-weight="800" letter-spacing="0.5" fill="${colors.primary}" text-anchor="middle" dominant-baseline="middle">${badgeText}</text>`);
  }

  if (eyebrow) {
    parts.push(`<text${df('eyebrow')} x="${padX}" y="${headStartY - 36}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" letter-spacing="2.5" fill="${colors.secondary}" dominant-baseline="hanging">${escapeXml(eyebrow.toUpperCase())}</text>`);
  }

  headLines.forEach((l, i) => {
    parts.push(
      `<text${df(`headline-${i}`)} x="${padX}" y="${headStartY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="78" font-weight="900" letter-spacing="-2" fill="#ffffff" stroke="#000000" stroke-width="10" stroke-opacity="0.38" paint-order="stroke fill" dominant-baseline="hanging">${l}</text>`
    );
  });

  parts.push(`<rect x="${padX}" y="${dividerY}" width="160" height="6" rx="3" fill="${colors.secondary}"/>`);

  subLines.forEach((l, i) => {
    parts.push(
      `<text${df(`subtext-${i}`)} x="${padX}" y="${subStartY + i * subLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="32" font-weight="400" fill="#ffffff" opacity="0.85" dominant-baseline="hanging">${l}</text>`
    );
  });

  // Numbered checklist — filled circle with number + text (Canva/Envato tip signature)
  bullets.forEach((item, i) => {
    const y       = listStartY + i * listLineH;
    const badgeR  = 22;
    const badgeCx = padX + badgeR;
    const badgeCy = y + badgeR;
    parts.push(`<circle cx="${badgeCx}" cy="${badgeCy}" r="${badgeR}" fill="${colors.secondary}"/>`);
    parts.push(`<text x="${badgeCx}" y="${badgeCy}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${i + 1}</text>`);
    parts.push(`<text${df(`service-${i}`)} x="${padX + badgeR * 2 + 18}" y="${badgeCy}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="32" font-weight="600" fill="#ffffff" stroke="#000000" stroke-width="4" stroke-opacity="0.28" paint-order="stroke fill" dominant-baseline="middle">${escapeXml(item)}</text>`);
  });

  const phoneFormatted = formatPhone(phone);
  if (phoneFormatted) {
    const pillY = H - 116;
    const pillH = 62;
    const rW = Math.max(300, phoneFormatted.length * 16 + 104);
    parts.push(`<rect x="${padX}" y="${pillY}" width="${rW}" height="${pillH}" rx="${pillH / 2}" fill="${colors.secondary}"/>`);
    parts.push(phoneIconSvg(padX + 26, pillY + pillH / 2, 22, '#ffffff'));
    parts.push(`<text${df('phone')} x="${padX + 56}" y="${pillY + pillH / 2}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="800" fill="#ffffff" dominant-baseline="middle">${escapeXml(phoneFormatted)}</text>`);
  } else if (cta) {
    const ctaText = escapeXml(cta.toUpperCase());
    const ctaW = Math.min(500, Math.max(240, ctaText.length * 16 + 80));
    const ctaY = H - 136;
    parts.push(`<rect x="${padX}" y="${ctaY}" width="${ctaW}" height="66" rx="33" fill="${colors.secondary}"/>`);
    parts.push(`<text${df('cta')} x="${padX + ctaW / 2}" y="${ctaY + 33}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${ctaText}</text>`);
  }

  parts.push(`<text x="${W / 2}" y="${H - 44}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="18" font-weight="500" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" opacity="0.60">${escapeXml(businessName)}</text>`);

  if (browserMode) {
    if (logoUrl) {
      parts.push(`<image href="${escapeXml(logoUrl)}" x="${padX}" y="22" width="68" height="68" preserveAspectRatio="xMidYMid meet"/>`);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">${parts.join('')}</svg>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  const composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) composite.push({ input: logoBuffer, top: 22, left: padX });
  return sharp(resizedBuffer)
    .composite(composite)
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ── Template G — "Frosted Panel Left" ─────────────────────────────────────────
// Full-bleed photo background. Left 58% covered by a SOLID frosted brand-color
// panel (not a gradient fade — a sharp vertical edge). Photo subject is fully
// visible on the right. Secondary-color vertical accent bar separates the zones.
// Like the Canva "split content" style — the most distinctive modern layout.
async function buildTemplateG(
  resizedBuffer, cardOverlay, businessName, phone, colors, logoBuffer, industry,
  browserMode = false, photoUrl = null, logoUrl = null, fingerprint = null
) {
  const c = (fingerprint?.colorRole === 1)
    ? { primary: colors.secondary, secondary: colors.primary, accent: colors.accent }
    : colors;

  const {
    headline = '', eyebrow = '', subtext = '', cta = '',
    badge = '', services = [], uppercase = false,
  } = cardOverlay;

  const headText  = uppercase ? headline.toUpperCase() : toTitleCase(headline);
  const panelW    = 580;
  const padX      = 54;
  const headLines = wrapText(escapeXml(headText), 12);
  const subLines  = wrapText(escapeXml(subtext), 22);
  const bullets   = Array.isArray(services) ? services.slice(0, 3) : [];
  const opacity   = fingerprint?.overlayOpacity || 0.88;

  const headStartY = 220;
  const headLineH  = 80;
  const headEndY   = headStartY + headLines.length * headLineH;
  const subStartY  = headEndY + 28;
  const subLineH   = 40;
  const listStartY = subStartY + subLines.length * subLineH + 36;
  const listLineH  = 56;

  const df = (field) => browserMode ? ` data-field="${field}"` : '';
  const parts = [];

  if (browserMode && photoUrl) {
    parts.push(`<image href="${escapeXml(photoUrl)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`);
  }

  // Frosted brand-color panel — solid, sharp vertical right edge
  const { r: pr, g: pg, b: pb } = hexToRgbG(c.primary);
  parts.push(
    `<rect x="0" y="0" width="${panelW}" height="${H}" fill="rgba(${pr},${pg},${pb},${opacity})"/>`,
    // Secondary-color vertical accent bar — the design seam
    `<rect x="${panelW - 6}" y="0" width="8" height="${H}" fill="${c.secondary}"/>`,
    // Subtle decorative circle in panel for depth
    `<circle cx="${Math.floor(panelW * 0.85)}" cy="${Math.floor(H * 0.12)}" r="${fingerprint?.decorDensity === 2 ? 90 : 60}" fill="${c.secondary}" opacity="0.12"/>`,
    `<circle cx="${Math.floor(panelW * 0.15)}" cy="${Math.floor(H * 0.82)}" r="${fingerprint?.decorDensity === 2 ? 110 : 75}" fill="${c.secondary}" opacity="0.08"/>`,
  );

  // Logo + business name — inside panel, top-left
  const hasLogo = browserMode ? !!logoUrl : !!logoBuffer;
  if (hasLogo) {
    parts.push(`<text x="${padX + 82}" y="68" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="21" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  } else {
    parts.push(industryIconSvg(padX + 22, 68, 23, industry, 'rgba(255,255,255,0.95)', c.primary));
    parts.push(`<text x="${padX + 56}" y="68" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="21" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  }

  // Badge — inside panel, top area
  if (badge) {
    const badgeText = escapeXml(badge.toUpperCase());
    const badgeW = Math.max(170, badgeText.length * 10 + 36);
    if (badgeW < panelW - padX - 20) {
      parts.push(`<rect x="${padX}" y="104" width="${badgeW}" height="38" rx="6" fill="rgba(255,255,255,0.18)"/>`);
      parts.push(`<text${df('badge')} x="${padX + 14}" y="123" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="14" font-weight="800" letter-spacing="1" fill="#ffffff" dominant-baseline="middle">${badgeText}</text>`);
    }
  }

  // Eyebrow
  if (eyebrow) {
    parts.push(`<text${df('eyebrow')} x="${padX}" y="${headStartY - 42}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="17" font-weight="700" letter-spacing="2.5" fill="${c.secondary}" dominant-baseline="hanging">${escapeXml(eyebrow.toUpperCase())}</text>`);
  }

  // Large headline — weight from fingerprint
  const fw = fingerprint?.typographyWeight === 1 ? '800' : '900';
  headLines.forEach((l, i) => {
    parts.push(
      `<text${df(`headline-${i}`)} x="${padX}" y="${headStartY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="76" font-weight="${fw}" letter-spacing="-2" fill="#ffffff" dominant-baseline="hanging">${l}</text>`
    );
  });

  // Accent divider bar
  parts.push(`<rect x="${padX}" y="${headEndY + 14}" width="120" height="5" rx="2.5" fill="${c.secondary}"/>`);

  // Subtext
  subLines.forEach((l, i) => {
    parts.push(
      `<text${df(`subtext-${i}`)} x="${padX}" y="${subStartY + i * subLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="28" font-weight="400" fill="rgba(255,255,255,0.88)" dominant-baseline="hanging">${l}</text>`
    );
  });

  // Service bullets
  bullets.forEach((item, i) => {
    const y = listStartY + i * listLineH + 20;
    parts.push(`<circle cx="${padX + 8}" cy="${y}" r="8" fill="${c.secondary}"/>`);
    parts.push(`<text${df(`service-${i}`)} x="${padX + 26}" y="${y}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="26" font-weight="600" fill="#ffffff" dominant-baseline="middle">${escapeXml(item)}</text>`);
  });

  // CTA button — white pill with brand color text
  if (cta) {
    const ctaText = escapeXml(cta.toUpperCase());
    const ctaW    = Math.min(440, Math.max(200, ctaText.length * 14 + 64));
    const ctaY    = H - 158;
    parts.push(`<rect x="${padX}" y="${ctaY}" width="${ctaW}" height="60" rx="30" fill="#ffffff"/>`);
    parts.push(`<text${df('cta')} x="${padX + ctaW / 2}" y="${ctaY + 30}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="900" fill="${c.primary}" text-anchor="middle" dominant-baseline="middle">${ctaText}</text>`);
  }

  const phoneFormatted = formatPhone(phone);
  if (phoneFormatted && !cta) {
    const pillY = H - 148;
    parts.push(`<rect x="${padX}" y="${pillY}" width="340" height="52" rx="26" fill="rgba(255,255,255,0.15)"/>`);
    parts.push(phoneIconSvg(padX + 18, pillY + 26, 18, '#ffffff'));
    parts.push(`<text${df('phone')} x="${padX + 44}" y="${pillY + 26}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="19" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(phoneFormatted)}</text>`);
  }

  // Bottom info bar across full card
  parts.push(`<rect x="0" y="${H - 72}" width="${W}" height="72" fill="rgba(0,0,0,0.60)"/>`);
  parts.push(`<text x="${W / 2}" y="${H - 36}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="18" font-weight="500" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" opacity="0.80">${escapeXml(businessName)}</text>`);

  if (browserMode) {
    if (logoUrl) parts.push(`<image href="${escapeXml(logoUrl)}" x="${padX}" y="30" width="64" height="64" preserveAspectRatio="xMidYMid meet"/>`);
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">${parts.join('')}</svg>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  const composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) composite.push({ input: logoBuffer, top: 30, left: padX });
  return sharp(resizedBuffer).composite(composite).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

function hexToRgbG(hex) {
  const h = (hex || '#1B3A6B').replace('#', '').padStart(6, '0');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

// ── Template H — "Frosted Float Card" ─────────────────────────────────────────
// Full-bleed photo with a DARK radial vignette for depth. A frosted white
// rounded-rectangle card floats in the center — DARK TEXT ON WHITE background.
// Completely different aesthetic from all other templates — clean, airy, premium.
// The card has a brand-color top bar accent and a colored CTA button.
async function buildTemplateH(
  resizedBuffer, cardOverlay, businessName, phone, colors, logoBuffer, industry,
  browserMode = false, photoUrl = null, logoUrl = null, fingerprint = null
) {
  const c = (fingerprint?.colorRole === 1)
    ? { primary: colors.secondary, secondary: colors.primary, accent: colors.accent }
    : colors;

  const {
    headline = '', eyebrow = '', subtext = '', cta = '',
    badge = '', services = [], uppercase = false,
  } = cardOverlay;

  const headText   = uppercase ? headline.toUpperCase() : toTitleCase(headline);
  const cardX      = 72;
  const cardY      = 170;
  const cardW      = W - 144;
  const cardH      = H - 240;
  const cardRx     = 28;
  const padX       = cardX + 52;
  const cardOpacity = fingerprint?.overlayOpacity || 0.93;

  const headLines  = wrapText(escapeXml(headText), 17);
  const subLines   = wrapText(escapeXml(subtext), 30);
  const bullets    = Array.isArray(services) ? services.slice(0, 3) : [];

  const headStartY = cardY + 124;
  const headLineH  = 68;
  const headEndY   = headStartY + headLines.length * headLineH;
  const subStartY  = headEndY + 24;
  const subLineH   = 36;
  const listStartY = subStartY + subLines.length * subLineH + 28;
  const listLineH  = 50;

  const df = (field) => browserMode ? ` data-field="${field}"` : '';
  const parts = [];

  if (browserMode && photoUrl) {
    parts.push(`<image href="${escapeXml(photoUrl)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`);
  }

  // Radial dark vignette — creates cinematic depth around the card edges
  parts.push(
    `<defs>
      <radialGradient id="vigH" cx="50%" cy="50%" r="65%">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0.00"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.55"/>
      </radialGradient>
    </defs>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#vigH)"/>`,
  );

  // Frosted white card
  parts.push(
    `<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="${cardRx}" fill="rgba(255,255,255,${cardOpacity})"/>`,
    // Subtle card shadow outline
    `<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="${cardRx}" fill="none" stroke="rgba(255,255,255,0.50)" stroke-width="1"/>`,
    // Brand accent bar — top of card
    `<rect x="${cardX}" y="${cardY}" width="${cardW}" height="10" rx="${cardRx}" fill="${c.primary}"/>`,
    // Thin secondary-color underline accent
    `<rect x="${padX}" y="${cardY + 10}" width="80" height="4" fill="${c.secondary}"/>`,
  );

  if (fingerprint?.decorDensity === 2) {
    // Rich decoration: large faint circle inside card bottom-right
    parts.push(`<circle cx="${cardX + cardW - 60}" cy="${cardY + cardH - 60}" r="100" fill="${c.secondary}" opacity="0.05"/>`);
  }

  // Logo + business name — inside card, below top bar
  const hasLogo = browserMode ? !!logoUrl : !!logoBuffer;
  const logoY   = cardY + 22;
  if (hasLogo) {
    parts.push(`<text x="${padX + 74}" y="${logoY + 28}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="19" font-weight="700" fill="${c.primary}" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  } else {
    parts.push(industryIconSvg(padX + 20, logoY + 28, 20, industry, c.primary, '#ffffff'));
    parts.push(`<text x="${padX + 50}" y="${logoY + 28}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="19" font-weight="700" fill="${c.primary}" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  }

  // Badge
  if (badge) {
    const badgeText = escapeXml(badge.toUpperCase());
    const badgeW = Math.max(160, badgeText.length * 10 + 36);
    const badgeX = cardX + cardW - badgeW - 20;
    parts.push(`<rect x="${badgeX}" y="${logoY + 8}" width="${badgeW}" height="40" rx="20" fill="${c.primary}"/>`);
    parts.push(`<text${df('badge')} x="${badgeX + badgeW / 2}" y="${logoY + 28}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="14" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${badgeText}</text>`);
  }

  // Eyebrow — secondary color
  if (eyebrow) {
    parts.push(`<text${df('eyebrow')} x="${padX}" y="${headStartY - 38}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="16" font-weight="700" letter-spacing="2.5" fill="${c.secondary}" dominant-baseline="hanging">${escapeXml(eyebrow.toUpperCase())}</text>`);
  }

  // Headline — DARK on white (key differentiator from other templates)
  const fw = fingerprint?.typographyWeight === 1 ? '800' : '900';
  headLines.forEach((l, i) => {
    parts.push(
      `<text${df(`headline-${i}`)} x="${padX}" y="${headStartY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="62" font-weight="${fw}" letter-spacing="-1.5" fill="${c.primary}" dominant-baseline="hanging">${l}</text>`
    );
  });

  // Divider
  parts.push(`<rect x="${padX}" y="${headEndY + 10}" width="100" height="4" rx="2" fill="${c.secondary}"/>`);

  // Subtext — dark gray on white
  subLines.forEach((l, i) => {
    parts.push(
      `<text${df(`subtext-${i}`)} x="${padX}" y="${subStartY + i * subLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="26" font-weight="400" fill="#2d2d3a" opacity="0.85" dominant-baseline="hanging">${l}</text>`
    );
  });

  // Service items — secondary color dots + dark text
  bullets.forEach((item, i) => {
    const y = listStartY + i * listLineH + 18;
    parts.push(`<circle cx="${padX + 8}" cy="${y}" r="8" fill="${c.secondary}"/>`);
    parts.push(`<text${df(`service-${i}`)} x="${padX + 26}" y="${y}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="24" font-weight="600" fill="#1a1a2a" dominant-baseline="middle">${escapeXml(item)}</text>`);
  });

  // CTA — brand primary solid button
  if (cta) {
    const ctaText = escapeXml(cta.toUpperCase());
    const ctaW    = Math.min(450, Math.max(210, ctaText.length * 13 + 60));
    const ctaY    = cardY + cardH - 88;
    parts.push(`<rect x="${padX}" y="${ctaY}" width="${ctaW}" height="58" rx="29" fill="${c.primary}"/>`);
    parts.push(`<text${df('cta')} x="${padX + ctaW / 2}" y="${ctaY + 29}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="19" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${ctaText}</text>`);
  }

  const phoneFormatted = formatPhone(phone);
  if (phoneFormatted && !cta) {
    const pillY = cardY + cardH - 88;
    const rW    = Math.max(260, phoneFormatted.length * 13 + 80);
    parts.push(`<rect x="${padX}" y="${pillY}" width="${rW}" height="54" rx="27" fill="${c.primary}"/>`);
    parts.push(phoneIconSvg(padX + 18, pillY + 27, 18, '#ffffff'));
    parts.push(`<text${df('phone')} x="${padX + 44}" y="${pillY + 27}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="19" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(phoneFormatted)}</text>`);
  }

  if (browserMode) {
    if (logoUrl) parts.push(`<image href="${escapeXml(logoUrl)}" x="${padX}" y="${logoY}" width="56" height="56" preserveAspectRatio="xMidYMid meet"/>`);
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">${parts.join('')}</svg>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  const composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) composite.push({ input: logoBuffer, top: logoY, left: padX });
  return sharp(resizedBuffer).composite(composite).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

// ── Template I — "Header + Footer Bars" ──────────────────────────────────────
// Unique 3-zone layout: dark header bar (top 16%), completely clear photo in the
// middle, frosted white footer bar (bottom 34%) with brand-color headline.
// The PHOTO IS FULLY UNOBSCURED in the center — the most photo-forward design.
// Perfect for dramatic before/afters and job showcase content.
async function buildTemplateI(
  resizedBuffer, cardOverlay, businessName, phone, colors, logoBuffer, industry,
  browserMode = false, photoUrl = null, logoUrl = null, fingerprint = null
) {
  const c = (fingerprint?.colorRole === 1)
    ? { primary: colors.secondary, secondary: colors.primary, accent: colors.accent }
    : colors;

  const {
    headline = '', eyebrow = '', subtext = '', cta = '',
    badge = '', services = [], uppercase = false,
  } = cardOverlay;

  const headText    = uppercase ? headline.toUpperCase() : toTitleCase(headline);
  const headerH     = Math.floor(H * 0.16);   // 216px — dark header
  const footerY     = Math.floor(H * 0.66);   // footer starts at 66%
  const footerH     = H - footerY;            // 459px
  const padX        = 58;
  const footOpacity = fingerprint?.overlayOpacity || 0.94;

  const headLines   = wrapText(escapeXml(headText), 16);
  const subLines    = wrapText(escapeXml(subtext), 30);
  const bullets     = Array.isArray(services) ? services.slice(0, 2) : [];

  const headStartY  = footerY + 52;
  const headLineH   = 66;
  const headEndY    = headStartY + headLines.length * headLineH;
  const subStartY   = headEndY + 18;
  const subLineH    = 34;

  const df = (field) => browserMode ? ` data-field="${field}"` : '';
  const parts = [];

  if (browserMode && photoUrl) {
    parts.push(`<image href="${escapeXml(photoUrl)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`);
  }

  // Dark header bar
  parts.push(
    `<defs>
      <linearGradient id="hdrI" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0.82"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.50"/>
      </linearGradient>
    </defs>`,
    `<rect x="0" y="0" width="${W}" height="${headerH}" fill="url(#hdrI)"/>`,
    // Top accent bar in secondary color
    `<rect x="0" y="0" width="${W}" height="8" fill="${c.secondary}"/>`,
  );

  // WHITE/FROSTED footer bar — text rendered dark on light
  const { r: fr, g: fg, b: fb } = hexToRgbG('#ffffff');
  parts.push(
    `<rect x="0" y="${footerY}" width="${W}" height="${footerH}" fill="rgba(${fr},${fg},${fb},${footOpacity})"/>`,
    // Brand seam bar between photo and footer
    `<rect x="0" y="${footerY - 4}" width="${W}" height="10" fill="${c.primary}"/>`,
    // Left brand accent bar inside footer
    `<rect x="0" y="${footerY + 10}" width="8" height="${footerH - 10}" fill="${c.secondary}" opacity="0.80"/>`,
  );

  // Logo + business name — inside HEADER
  const hasLogo = browserMode ? !!logoUrl : !!logoBuffer;
  if (hasLogo) {
    parts.push(`<text x="${padX + 82}" y="${headerH / 2}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  } else {
    parts.push(industryIconSvg(padX + 22, headerH / 2, 22, industry, 'rgba(255,255,255,0.95)', c.primary));
    parts.push(`<text x="${padX + 56}" y="${headerH / 2}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  }

  // Badge — header right side
  if (badge) {
    const badgeText = escapeXml(badge.toUpperCase());
    const badgeW = Math.max(170, badgeText.length * 10 + 40);
    const badgeX = W - badgeW - 24;
    parts.push(`<rect x="${badgeX}" y="${Math.floor(headerH / 2) - 22}" width="${badgeW}" height="44" rx="22" fill="${c.secondary}"/>`);
    parts.push(`<text${df('badge')} x="${badgeX + badgeW / 2}" y="${Math.floor(headerH / 2)}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="15" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${badgeText}</text>`);
  }

  // Eyebrow — inside footer, brand secondary color
  if (eyebrow) {
    parts.push(`<text${df('eyebrow')} x="${padX + 14}" y="${footerY + 18}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="16" font-weight="700" letter-spacing="2" fill="${c.secondary}" dominant-baseline="hanging">${escapeXml(eyebrow.toUpperCase())}</text>`);
  }

  // Headline — BRAND COLOR on white footer (unique look)
  const fw = fingerprint?.typographyWeight === 1 ? '800' : '900';
  headLines.forEach((l, i) => {
    parts.push(
      `<text${df(`headline-${i}`)} x="${padX + 14}" y="${headStartY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="60" font-weight="${fw}" letter-spacing="-1.5" fill="${c.primary}" dominant-baseline="hanging">${l}</text>`
    );
  });

  // Subtext — dark gray on white
  subLines.forEach((l, i) => {
    parts.push(
      `<text${df(`subtext-${i}`)} x="${padX + 14}" y="${subStartY + i * subLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="24" font-weight="400" fill="#2a2a3a" opacity="0.80" dominant-baseline="hanging">${l}</text>`
    );
  });

  // Compact bullets in footer
  bullets.forEach((item, i) => {
    const y = subStartY + subLines.length * subLineH + 24 + i * 38;
    parts.push(`<text x="${padX + 14}" y="${y}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="600" fill="${c.primary}" dominant-baseline="hanging">· ${escapeXml(item)}</text>`);
  });

  // CTA — right side of footer
  if (cta) {
    const ctaText = escapeXml(cta.toUpperCase());
    const ctaW    = Math.min(360, Math.max(190, ctaText.length * 12 + 52));
    const ctaX    = W - ctaW - padX;
    const ctaY    = H - 84;
    parts.push(`<rect x="${ctaX}" y="${ctaY - 26}" width="${ctaW}" height="52" rx="26" fill="${c.primary}"/>`);
    parts.push(`<text${df('cta')} x="${ctaX + ctaW / 2}" y="${ctaY}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="17" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${ctaText}</text>`);
  }

  const phoneFormatted = formatPhone(phone);
  if (phoneFormatted && !cta) {
    parts.push(`<text${df('phone')} x="${W - padX}" y="${H - 52}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="800" fill="${c.primary}" text-anchor="end" dominant-baseline="auto">${escapeXml(phoneFormatted)}</text>`);
  }

  if (browserMode) {
    if (logoUrl) parts.push(`<image href="${escapeXml(logoUrl)}" x="${padX}" y="${Math.floor(headerH / 2) - 28}" width="56" height="56" preserveAspectRatio="xMidYMid meet"/>`);
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">${parts.join('')}</svg>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  const composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) composite.push({ input: logoBuffer, top: Math.floor(headerH / 2) - 28, left: padX });
  return sharp(resizedBuffer).composite(composite).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

// ── Template J — "Magazine Bottom Panel" ──────────────────────────────────────
// Inverse of Template C. Photo fills the TOP 55% with minimal dark overlay for
// readability. SOLID brand-color panel fills the BOTTOM 45% — white text on
// brand color. A secondary-color accent bar runs at the seam. A large ghost
// circle decoration inside the panel adds depth. Very editorial magazine feel.
async function buildTemplateJ(
  resizedBuffer, cardOverlay, businessName, phone, colors, logoBuffer, industry,
  browserMode = false, photoUrl = null, logoUrl = null, fingerprint = null
) {
  const c = (fingerprint?.colorRole === 1)
    ? { primary: colors.secondary, secondary: colors.primary, accent: colors.accent }
    : colors;

  const {
    headline = '', eyebrow = '', subtext = '', cta = '',
    badge = '', services = [], uppercase = true,
  } = cardOverlay;

  const headText   = uppercase ? headline.toUpperCase() : toTitleCase(headline);
  const splitY     = Math.floor(H * 0.54);
  const padX       = 60;
  const dark       = darkenHex(c.primary, 0.22);

  const headLines  = wrapText(escapeXml(headText), 14);
  const subLines   = wrapText(escapeXml(subtext), 28);
  const bullets    = Array.isArray(services) ? services.slice(0, 3) : [];

  const headStartY = splitY + 72;
  const headLineH  = 78;
  const headEndY   = headStartY + headLines.length * headLineH;
  const subStartY  = headEndY + 20;
  const subLineH   = 38;
  const listStartY = subStartY + subLines.length * subLineH + 28;

  const df = (field) => browserMode ? ` data-field="${field}"` : '';
  const parts = [];

  if (browserMode && photoUrl) {
    parts.push(`<image href="${escapeXml(photoUrl)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`);
  }

  parts.push(
    `<defs>
      <linearGradient id="topVigJ" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0.60"/>
        <stop offset="22%"  stop-color="#000000" stop-opacity="0.00"/>
      </linearGradient>
      <linearGradient id="panelJ" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${c.primary}" stop-opacity="1.0"/>
        <stop offset="100%" stop-color="${dark}" stop-opacity="1.0"/>
      </linearGradient>
    </defs>`,
    // Subtle top vignette for logo visibility only
    `<rect x="0" y="0" width="${W}" height="180" fill="url(#topVigJ)"/>`,
    // Solid brand color bottom panel
    `<rect x="0" y="${splitY}" width="${W}" height="${H - splitY}" fill="url(#panelJ)"/>`,
    // Secondary-color accent seam
    `<rect x="0" y="${splitY - 5}" width="${W}" height="12" fill="${c.secondary}"/>`,
  );

  // Ghost circle decoration — the magazine signature element
  const circleR = fingerprint?.decorDensity === 2 ? 200 : 160;
  parts.push(`<circle cx="${W - 100}" cy="${splitY + circleR + 40}" r="${circleR}" fill="${c.secondary}" opacity="${fingerprint?.decorDensity === 0 ? '0.05' : '0.08'}"/>`);
  if (fingerprint?.decorDensity === 2) {
    parts.push(`<circle cx="${W - 100}" cy="${splitY + circleR + 40}" r="${circleR - 60}" fill="none" stroke="${c.secondary}" stroke-width="2" opacity="0.15"/>`);
  }

  // Logo + business name — top left of PHOTO area
  const hasLogo = browserMode ? !!logoUrl : !!logoBuffer;
  if (hasLogo) {
    parts.push(`<text x="${padX + 82}" y="62" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  } else {
    parts.push(industryIconSvg(padX + 22, 62, 24, industry, 'rgba(255,255,255,0.95)', c.primary));
    parts.push(`<text x="${padX + 58}" y="62" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  }

  // Badge — photo area, top right
  if (badge) {
    const badgeText = escapeXml(badge.toUpperCase());
    const badgeW = Math.max(180, badgeText.length * 10 + 40);
    const badgeX = W - badgeW - 24;
    parts.push(`<rect x="${badgeX}" y="32" width="${badgeW}" height="52" rx="26" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.55)" stroke-width="1.5"/>`);
    parts.push(`<text${df('badge')} x="${badgeX + badgeW / 2}" y="58" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${badgeText}</text>`);
  }

  // Eyebrow — inside bottom panel
  if (eyebrow) {
    parts.push(`<text${df('eyebrow')} x="${padX}" y="${splitY + 34}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="17" font-weight="700" letter-spacing="2.5" fill="${c.secondary}" dominant-baseline="hanging">${escapeXml(eyebrow.toUpperCase())}</text>`);
  }

  // Headline — white on brand color
  const fw = fingerprint?.typographyWeight === 1 ? '800' : '900';
  headLines.forEach((l, i) => {
    parts.push(
      `<text${df(`headline-${i}`)} x="${padX}" y="${headStartY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="70" font-weight="${fw}" letter-spacing="-1.5" fill="#ffffff" dominant-baseline="hanging">${l}</text>`
    );
  });

  // Accent divider bar
  parts.push(`<rect x="${padX}" y="${headEndY + 10}" width="130" height="5" rx="2.5" fill="${c.secondary}"/>`);

  // Subtext
  subLines.forEach((l, i) => {
    parts.push(
      `<text${df(`subtext-${i}`)} x="${padX}" y="${subStartY + i * subLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="28" font-weight="400" fill="rgba(255,255,255,0.82)" dominant-baseline="hanging">${l}</text>`
    );
  });

  // Service bullets
  bullets.forEach((item, i) => {
    const y = listStartY + i * 52 + 18;
    parts.push(`<circle cx="${padX + 8}" cy="${y}" r="8" fill="${c.secondary}"/>`);
    parts.push(`<text${df(`service-${i}`)} x="${padX + 26}" y="${y}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="26" font-weight="600" fill="#ffffff" dominant-baseline="middle">${escapeXml(item)}</text>`);
  });

  // CTA — white pill button
  if (cta) {
    const ctaText = escapeXml(cta.toUpperCase());
    const ctaW    = Math.min(440, Math.max(220, ctaText.length * 14 + 64));
    const ctaY    = H - 116;
    parts.push(`<rect x="${padX}" y="${ctaY}" width="${ctaW}" height="60" rx="30" fill="#ffffff"/>`);
    parts.push(`<text${df('cta')} x="${padX + ctaW / 2}" y="${ctaY + 30}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="900" fill="${c.primary}" text-anchor="middle" dominant-baseline="middle">${ctaText}</text>`);
  }

  const phoneFormatted = formatPhone(phone);
  if (phoneFormatted && !cta) {
    const pillY = H - 118;
    const rW    = Math.max(260, phoneFormatted.length * 14 + 80);
    parts.push(`<rect x="${padX}" y="${pillY}" width="${rW}" height="56" rx="28" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.40)" stroke-width="1.5"/>`);
    parts.push(phoneIconSvg(padX + 20, pillY + 28, 20, '#ffffff'));
    parts.push(`<text${df('phone')} x="${padX + 48}" y="${pillY + 28}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="21" font-weight="800" fill="#ffffff" dominant-baseline="middle">${escapeXml(phoneFormatted)}</text>`);
  }

  parts.push(`<text x="${W / 2}" y="${H - 40}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="16" font-weight="500" fill="rgba(255,255,255,0.46)" text-anchor="middle" dominant-baseline="auto">${escapeXml(businessName)}</text>`);

  if (browserMode) {
    if (logoUrl) parts.push(`<image href="${escapeXml(logoUrl)}" x="${padX}" y="26" width="68" height="68" preserveAspectRatio="xMidYMid meet"/>`);
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">${parts.join('')}</svg>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  const composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) composite.push({ input: logoBuffer, top: 26, left: padX });
  return sharp(resizedBuffer).composite(composite).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

// ── Template K — "Diagonal Duotone" ──────────────────────────────────────────
// GOAT color move: diagonal linear gradient blending primary (bottom-left) →
// secondary (top-right) at ~0.80 opacity over the full photo. The brand colors
// become the image — like a two-tone fashion ad or music poster. Every business
// looks completely different because the gradient IS their brand palette.
// Two white diagonal accent lines reinforce the directionality.
async function buildTemplateK(
  resizedBuffer, cardOverlay, businessName, phone, colors, logoBuffer, industry,
  browserMode = false, photoUrl = null, logoUrl = null, fingerprint = null
) {
  const c = (fingerprint?.colorRole === 1)
    ? { primary: colors.secondary, secondary: colors.primary, accent: colors.accent }
    : colors;

  const {
    headline = '', eyebrow = '', subtext = '', cta = '',
    badge = '', services = [], uppercase = false,
  } = cardOverlay;

  const headText  = uppercase ? headline.toUpperCase() : toTitleCase(headline);
  const headLines = wrapText(escapeXml(headText), 14);
  const subLines  = wrapText(escapeXml(subtext), 26);
  const bullets   = Array.isArray(services) ? services.slice(0, 4) : [];
  const padX = 60;
  const headStartY = 200;
  const headLineH  = 82;
  const headEndY   = headStartY + headLines.length * headLineH;
  const dividerY   = headEndY + 18;
  const subStartY  = dividerY + 36;
  const subLineH   = 44;
  const listStartY = subStartY + subLines.length * subLineH + 36;
  const listLineH  = 58;

  const df = (field) => browserMode ? ` data-field="${field}"` : '';
  const parts = [];

  if (browserMode && photoUrl) {
    parts.push(`<image href="${escapeXml(photoUrl)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`);
  }

  parts.push(
    `<defs>
      <linearGradient id="duoK" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%"   stop-color="${c.primary}"   stop-opacity="0.84"/>
        <stop offset="100%" stop-color="${c.secondary}" stop-opacity="0.72"/>
      </linearGradient>
      <linearGradient id="topVigK" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"  stop-color="#000000" stop-opacity="0.38"/>
        <stop offset="22%" stop-color="#000000" stop-opacity="0.00"/>
      </linearGradient>
      <linearGradient id="botVigK" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0.00"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.46"/>
      </linearGradient>
    </defs>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#duoK)"/>`,
    `<rect x="0" y="0" width="${W}" height="150" fill="url(#topVigK)"/>`,
    `<rect x="0" y="${H - 200}" width="${W}" height="200" fill="url(#botVigK)"/>`,
    `<line x1="${W * 0.76}" y1="0" x2="0" y2="${H * 0.88}" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>`,
    `<line x1="${W}" y1="${H * 0.11}" x2="${W * 0.11}" y2="${H}" stroke="rgba(255,255,255,0.07)" stroke-width="1.5"/>`,
  );

  const hasLogo = browserMode ? !!logoUrl : !!logoBuffer;
  if (hasLogo) {
    parts.push(`<text x="${padX + 82}" y="58" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="21" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  } else {
    parts.push(industryIconSvg(padX + 22, 58, 22, industry, 'rgba(255,255,255,0.95)', c.primary));
    parts.push(`<text x="${padX + 56}" y="58" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="21" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  }

  if (badge) {
    const badgeText = escapeXml(badge.toUpperCase());
    const badgeW = Math.max(200, badgeText.length * 11 + 48);
    const badgeX = W - badgeW - 24;
    parts.push(`<rect x="${badgeX}" y="32" width="${badgeW}" height="50" rx="25" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.55)" stroke-width="1.5"/>`);
    parts.push(`<text${df('badge')} x="${badgeX + badgeW / 2}" y="57" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="16" font-weight="800" letter-spacing="0.5" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${badgeText}</text>`);
  }

  if (eyebrow) {
    parts.push(`<text${df('eyebrow')} x="${padX}" y="${headStartY - 40}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="19" font-weight="700" letter-spacing="2.5" fill="rgba(255,255,255,0.85)" dominant-baseline="hanging">${escapeXml(eyebrow.toUpperCase())}</text>`);
  }

  headLines.forEach((l, i) => {
    parts.push(`<text${df(`headline-${i}`)} x="${padX}" y="${headStartY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="80" font-weight="900" letter-spacing="-2.5" fill="#ffffff" stroke="rgba(0,0,0,0.28)" stroke-width="6" paint-order="stroke fill" dominant-baseline="hanging">${l}</text>`);
  });

  parts.push(`<rect x="${padX}" y="${dividerY}" width="160" height="5" rx="2.5" fill="rgba(255,255,255,0.80)"/>`);

  subLines.forEach((l, i) => {
    parts.push(`<text${df(`subtext-${i}`)} x="${padX}" y="${subStartY + i * subLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="33" font-weight="400" fill="rgba(255,255,255,0.90)" dominant-baseline="hanging">${l}</text>`);
  });

  bullets.forEach((item, i) => {
    const y = listStartY + i * listLineH + 20;
    parts.push(`<circle cx="${padX + 8}" cy="${y}" r="8" fill="rgba(255,255,255,0.85)"/>`);
    parts.push(`<text${df(`service-${i}`)} x="${padX + 26}" y="${y}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="30" font-weight="600" fill="#ffffff" dominant-baseline="middle">${escapeXml(item)}</text>`);
  });

  const ctaY = H - 148;
  if (cta) {
    const ctaText = escapeXml(cta.toUpperCase());
    const ctaW = Math.min(480, Math.max(240, ctaText.length * 15 + 72));
    parts.push(`<rect x="${padX}" y="${ctaY}" width="${ctaW}" height="66" rx="33" fill="rgba(255,255,255,0.20)" stroke="rgba(255,255,255,0.72)" stroke-width="2"/>`);
    parts.push(`<text${df('cta')} x="${padX + ctaW / 2}" y="${ctaY + 33}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="21" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${ctaText}</text>`);
  }

  const phoneFormatted = formatPhone(phone);
  if (phoneFormatted && !cta) {
    const pillY = H - 140;
    const rW = Math.max(300, phoneFormatted.length * 16 + 100);
    parts.push(`<rect x="${padX}" y="${pillY}" width="${rW}" height="62" rx="31" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.55)" stroke-width="1.5"/>`);
    parts.push(phoneIconSvg(padX + 20, pillY + 31, 20, '#ffffff'));
    parts.push(`<text${df('phone')} x="${padX + 48}" y="${pillY + 31}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="21" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(phoneFormatted)}</text>`);
  }

  parts.push(`<text x="${W / 2}" y="${H - 40}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="17" font-weight="500" fill="rgba(255,255,255,0.58)" text-anchor="middle" dominant-baseline="auto">${escapeXml(businessName)}</text>`);

  if (browserMode) {
    if (logoUrl) parts.push(`<image href="${escapeXml(logoUrl)}" x="${padX}" y="22" width="64" height="64" preserveAspectRatio="xMidYMid meet"/>`);
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">${parts.join('')}</svg>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  const composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) composite.push({ input: logoBuffer, top: 22, left: padX });
  return sharp(resizedBuffer).composite(composite).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

// ── Template L — "Gallery Frame" ─────────────────────────────────────────────
// Full-bleed photo with a thick brand-colored rectangular FRAME as the primary
// design element — like a luxury exhibition poster or gallery print. Secondary-
// color rotated-square accents mark all 4 corners. Double-frame inner line.
// The frame IS the brand identity; photo shows through the window.
async function buildTemplateL(
  resizedBuffer, cardOverlay, businessName, phone, colors, logoBuffer, industry,
  browserMode = false, photoUrl = null, logoUrl = null, fingerprint = null
) {
  const c = (fingerprint?.colorRole === 1)
    ? { primary: colors.secondary, secondary: colors.primary, accent: colors.accent }
    : colors;

  const {
    headline = '', eyebrow = '', subtext = '', cta = '',
    badge = '', services = [], uppercase = false,
  } = cardOverlay;

  const headText  = uppercase ? headline.toUpperCase() : toTitleCase(headline);
  const headLines = wrapText(escapeXml(headText), 14);
  const subLines  = wrapText(escapeXml(subtext), 26);
  const bullets   = Array.isArray(services) ? services.slice(0, 3) : [];
  const frameInset = 22;
  const padX = frameInset + 36;
  const headStartY = 220;
  const headLineH  = 78;
  const headEndY   = headStartY + headLines.length * headLineH;
  const subStartY  = headEndY + 26;
  const subLineH   = 40;
  const listStartY = subStartY + subLines.length * subLineH + 30;
  const listLineH  = 56;

  const df = (field) => browserMode ? ` data-field="${field}"` : '';
  const parts = [];

  if (browserMode && photoUrl) {
    parts.push(`<image href="${escapeXml(photoUrl)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`);
  }

  parts.push(
    `<defs>
      <linearGradient id="vigL" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0.55"/>
        <stop offset="36%"  stop-color="#000000" stop-opacity="0.22"/>
        <stop offset="64%"  stop-color="#000000" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.66"/>
      </linearGradient>
    </defs>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#vigL)"/>`,
    // Primary frame — thick brand color border
    `<rect x="${frameInset}" y="${frameInset}" width="${W - frameInset * 2}" height="${H - frameInset * 2}" rx="6" fill="none" stroke="${c.primary}" stroke-width="7"/>`,
    // Secondary inner accent frame
    `<rect x="${frameInset + 13}" y="${frameInset + 13}" width="${W - (frameInset + 13) * 2}" height="${H - (frameInset + 13) * 2}" rx="3" fill="none" stroke="${c.secondary}" stroke-width="2" opacity="0.60"/>`,
  );

  // Corner diamond accents — rotated square in secondary color
  const dOffset = frameInset + 3;
  const dS = 11;
  [[dOffset, dOffset], [W - dOffset, dOffset], [dOffset, H - dOffset], [W - dOffset, H - dOffset]].forEach(([cx, cy]) => {
    parts.push(`<rect x="${cx - dS * 0.71}" y="${cy - dS * 0.71}" width="${dS * 1.42}" height="${dS * 1.42}" rx="2" fill="${c.secondary}" transform="rotate(45,${cx},${cy})"/>`);
  });

  const hasLogo = browserMode ? !!logoUrl : !!logoBuffer;
  if (hasLogo) {
    parts.push(`<text x="${padX + 78}" y="72" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  } else {
    parts.push(industryIconSvg(padX + 20, 72, 20, industry, 'rgba(255,255,255,0.95)', c.primary));
    parts.push(`<text x="${padX + 50}" y="72" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  }

  if (badge) {
    const badgeText = escapeXml(badge.toUpperCase());
    const badgeW = Math.max(180, badgeText.length * 10.5 + 44);
    const badgeX = W - badgeW - frameInset - 8;
    parts.push(`<rect x="${badgeX}" y="46" width="${badgeW}" height="46" rx="23" fill="${c.secondary}"/>`);
    parts.push(`<text${df('badge')} x="${badgeX + badgeW / 2}" y="69" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="15" font-weight="800" letter-spacing="0.5" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${badgeText}</text>`);
  }

  if (eyebrow) {
    parts.push(`<text${df('eyebrow')} x="${padX}" y="${headStartY - 38}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="18" font-weight="700" letter-spacing="2.5" fill="${c.secondary}" dominant-baseline="hanging">${escapeXml(eyebrow.toUpperCase())}</text>`);
  }

  const fw = fingerprint?.typographyWeight === 1 ? '800' : '900';
  headLines.forEach((l, i) => {
    parts.push(`<text${df(`headline-${i}`)} x="${padX}" y="${headStartY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="74" font-weight="${fw}" letter-spacing="-2" fill="#ffffff" stroke="#000000" stroke-width="8" stroke-opacity="0.35" paint-order="stroke fill" dominant-baseline="hanging">${l}</text>`);
  });

  parts.push(`<rect x="${padX}" y="${headEndY + 14}" width="140" height="5" rx="2.5" fill="${c.primary}"/>`);

  subLines.forEach((l, i) => {
    parts.push(`<text${df(`subtext-${i}`)} x="${padX}" y="${subStartY + i * subLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="28" font-weight="400" fill="rgba(255,255,255,0.85)" dominant-baseline="hanging">${l}</text>`);
  });

  bullets.forEach((item, i) => {
    const y = listStartY + i * listLineH + 20;
    parts.push(`<rect x="${padX}" y="${y - 14}" width="6" height="28" rx="3" fill="${c.secondary}"/>`);
    parts.push(`<text${df(`service-${i}`)} x="${padX + 22}" y="${y}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="28" font-weight="600" fill="#ffffff" dominant-baseline="middle">${escapeXml(item)}</text>`);
  });

  const ctaY = H - 136;
  if (cta) {
    const ctaText = escapeXml(cta.toUpperCase());
    const ctaW = Math.min(460, Math.max(220, ctaText.length * 14 + 68));
    parts.push(`<rect x="${padX}" y="${ctaY}" width="${ctaW}" height="64" rx="32" fill="${c.primary}"/>`);
    parts.push(`<rect x="${padX + 2}" y="${ctaY + 2}" width="${ctaW - 4}" height="60" rx="30" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>`);
    parts.push(`<text${df('cta')} x="${padX + ctaW / 2}" y="${ctaY + 32}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${ctaText}</text>`);
  }

  const phoneFormatted = formatPhone(phone);
  if (phoneFormatted && !cta) {
    const pillY = H - 130;
    const rW = Math.max(280, phoneFormatted.length * 14 + 80);
    parts.push(`<rect x="${padX}" y="${pillY}" width="${rW}" height="58" rx="29" fill="${c.primary}"/>`);
    parts.push(phoneIconSvg(padX + 20, pillY + 29, 20, '#ffffff'));
    parts.push(`<text${df('phone')} x="${padX + 48}" y="${pillY + 29}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(phoneFormatted)}</text>`);
  }

  parts.push(`<text x="${W / 2}" y="${H - frameInset * 1.8}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="16" font-weight="500" fill="rgba(255,255,255,0.52)" text-anchor="middle" dominant-baseline="auto">${escapeXml(businessName)}</text>`);

  if (browserMode) {
    if (logoUrl) parts.push(`<image href="${escapeXml(logoUrl)}" x="${padX}" y="38" width="56" height="56" preserveAspectRatio="xMidYMid meet"/>`);
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">${parts.join('')}</svg>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  const composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) composite.push({ input: logoBuffer, top: 38, left: padX });
  return sharp(resizedBuffer).composite(composite).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

// ── Template M — "Mega Poster" ────────────────────────────────────────────────
// Centered layout — the HEADLINE is the visual anchor, not the overlay.
// Strong full-canvas dark gradient + subtle radial brand glow behind text.
// ALL elements (eyebrow, headline, CTA) are horizontally centered — concert
// poster / movie title card aesthetic. No side gradient, no panel, no polygon.
// The most editorial design in the set.
async function buildTemplateM(
  resizedBuffer, cardOverlay, businessName, phone, colors, logoBuffer, industry,
  browserMode = false, photoUrl = null, logoUrl = null, fingerprint = null
) {
  const c = (fingerprint?.colorRole === 1)
    ? { primary: colors.secondary, secondary: colors.primary, accent: colors.accent }
    : colors;

  const {
    headline = '', eyebrow = '', subtext = '', cta = '',
    badge = '', services = [], uppercase = true,
  } = cardOverlay;

  const headText  = uppercase ? headline.toUpperCase() : headline;
  const headLines = wrapText(escapeXml(headText), 12);
  const subLines  = wrapText(escapeXml(subtext), 28);
  const bullets   = Array.isArray(services) ? services.slice(0, 3) : [];

  const totalHeadH = headLines.length * 96 + 14;
  const headStartY = Math.max(300, Math.floor(H / 2) - Math.floor(totalHeadH / 2));
  const headLineH  = 96;
  const headEndY   = headStartY + headLines.length * headLineH;
  const subStartY  = headEndY + 28;
  const subLineH   = 42;

  const df = (field) => browserMode ? ` data-field="${field}"` : '';
  const parts = [];

  if (browserMode && photoUrl) {
    parts.push(`<image href="${escapeXml(photoUrl)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`);
  }

  parts.push(
    `<defs>
      <linearGradient id="darkM" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0.70"/>
        <stop offset="26%"  stop-color="#000000" stop-opacity="0.42"/>
        <stop offset="74%"  stop-color="#000000" stop-opacity="0.56"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.88"/>
      </linearGradient>
      <radialGradient id="glowM" cx="50%" cy="50%" r="40%">
        <stop offset="0%"   stop-color="${c.primary}" stop-opacity="0.30"/>
        <stop offset="100%" stop-color="${c.primary}" stop-opacity="0.00"/>
      </radialGradient>
    </defs>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#darkM)"/>`,
    `<rect x="0" y="${headStartY - 70}" width="${W}" height="${totalHeadH + 140}" fill="url(#glowM)"/>`,
    // Cinematic letterbox accent bars — top and bottom
    `<rect x="0" y="0" width="${W}" height="7" fill="${c.secondary}"/>`,
    `<rect x="0" y="${H - 7}" width="${W}" height="7" fill="${c.secondary}"/>`,
  );

  // Business name + logo — centered at top
  const hasLogo = browserMode ? !!logoUrl : !!logoBuffer;
  const nameY = 52;
  if (hasLogo) {
    parts.push(`<text x="${W / 2 + 36}" y="${nameY}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="19" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  } else {
    parts.push(industryIconSvg(W / 2 - 72, nameY, 16, industry, 'rgba(255,255,255,0.92)', c.primary));
    parts.push(`<text x="${W / 2 - 42}" y="${nameY}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="19" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`);
  }

  if (badge) {
    const badgeText = escapeXml(badge.toUpperCase());
    const badgeW = Math.max(180, badgeText.length * 11 + 44);
    const badgeX = W - badgeW - 24;
    parts.push(`<rect x="${badgeX}" y="28" width="${badgeW}" height="48" rx="24" fill="${c.primary}"/>`);
    parts.push(`<text${df('badge')} x="${badgeX + badgeW / 2}" y="52" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="16" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${badgeText}</text>`);
  }

  // Eyebrow — centered above headline with underline dot
  if (eyebrow) {
    const eyebrowY = headStartY - 46;
    parts.push(`<text${df('eyebrow')} x="${W / 2}" y="${eyebrowY}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="18" font-weight="700" letter-spacing="4" fill="${c.secondary}" text-anchor="middle" dominant-baseline="hanging">${escapeXml(eyebrow.toUpperCase())}</text>`);
    parts.push(`<rect x="${W / 2 - 40}" y="${eyebrowY + 28}" width="80" height="3" rx="1.5" fill="${c.secondary}"/>`);
  }

  // MEGA headline — centered, maximum impact
  const fw = fingerprint?.typographyWeight === 1 ? '800' : '900';
  headLines.forEach((l, i) => {
    parts.push(`<text${df(`headline-${i}`)} x="${W / 2}" y="${headStartY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="98" font-weight="${fw}" letter-spacing="-3" fill="#ffffff" stroke="#000000" stroke-width="14" stroke-opacity="0.45" paint-order="stroke fill" text-anchor="middle" dominant-baseline="hanging">${l}</text>`);
  });

  // Subtext — centered
  subLines.forEach((l, i) => {
    parts.push(`<text${df(`subtext-${i}`)} x="${W / 2}" y="${subStartY + i * subLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="30" font-weight="400" fill="rgba(255,255,255,0.80)" text-anchor="middle" dominant-baseline="hanging">${l}</text>`);
  });

  // Centered bullet points
  if (bullets.length > 0) {
    const bulletsY = subStartY + subLines.length * subLineH + 28;
    bullets.forEach((item, i) => {
      parts.push(`<text x="${W / 2}" y="${bulletsY + i * 52 + 18}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="26" font-weight="600" fill="rgba(255,255,255,0.80)" text-anchor="middle" dominant-baseline="middle">${escapeXml('· ' + item + ' ·')}</text>`);
    });
  }

  // CTA — centered
  const ctaY = H - 140;
  if (cta) {
    const ctaText = escapeXml(cta.toUpperCase());
    const ctaW = Math.min(500, Math.max(260, ctaText.length * 15 + 80));
    const ctaX = Math.floor((W - ctaW) / 2);
    parts.push(`<rect x="${ctaX}" y="${ctaY}" width="${ctaW}" height="68" rx="34" fill="${c.secondary}"/>`);
    parts.push(`<text${df('cta')} x="${W / 2}" y="${ctaY + 34}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${ctaText}</text>`);
  }

  const phoneFormatted = formatPhone(phone);
  if (phoneFormatted && !cta) {
    const pillY = H - 136;
    const rW = Math.max(300, phoneFormatted.length * 16 + 100);
    const pillX = Math.floor((W - rW) / 2);
    parts.push(`<rect x="${pillX}" y="${pillY}" width="${rW}" height="62" rx="31" fill="${c.secondary}"/>`);
    parts.push(phoneIconSvg(pillX + 24, pillY + 31, 20, '#ffffff'));
    parts.push(`<text${df('phone')} x="${pillX + 52}" y="${pillY + 31}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="800" fill="#ffffff" dominant-baseline="middle">${escapeXml(phoneFormatted)}</text>`);
  }

  parts.push(`<text x="${W / 2}" y="${H - 26}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="15" font-weight="500" fill="rgba(255,255,255,0.44)" text-anchor="middle" dominant-baseline="auto">${escapeXml(businessName)}</text>`);

  if (browserMode) {
    if (logoUrl) parts.push(`<image href="${escapeXml(logoUrl)}" x="${Math.floor(W / 2) - 20}" y="${nameY - 22}" width="40" height="40" preserveAspectRatio="xMidYMid meet"/>`);
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">${parts.join('')}</svg>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  const composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) composite.push({ input: logoBuffer, top: nameY - 22, left: Math.floor(W / 2) - 20 });
  return sharp(resizedBuffer).composite(composite).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

// ── Template set selection — content-type + design-seed aware ─────────────────
// 3 lineup options per trigger type. Customer's lineupOffset (from design seed)
// picks which set of 3 templates they see — same trigger, different businesses
// = different template combinations. Ensures no two customers look the same.
//
// CRITICAL RULE: The 3 lineups for each trigger must have ZERO template overlap.
// All 9 templates used (3 lineups × 3 templates) must be completely distinct so
// the "Load more designs" gallery shows genuinely different card layouts.
// 13 templates available (A-M). Each row: 3 lineups × 3 unique letters = 9 distinct designs.
const LINEUP_MAP = {
  // Bold-first: position [0] in each lineup is always the most dramatic template
  // 9 unique: J,A,H | K,G,C | D,L,M
  'job_finished':   [['J','A','H'], ['K','G','C'], ['D','L','M']],
  // 9 unique: G,A,H | K,J,C | D,L,M
  'before_after':   [['G','A','H'], ['K','J','C'], ['D','L','M']],
  // 9 unique: D,G,A | K,J,H | M,L,F
  'promotion':      [['D','G','A'], ['K','J','H'], ['M','L','F']],
  // 9 unique: D,A,J | K,G,B | M,L,F
  'seasonal':       [['D','A','J'], ['K','G','B'], ['M','L','F']],
  // 9 unique: G,H,E | K,J,C | M,L,A
  'got_review':     [['G','H','E'], ['K','J','C'], ['M','L','A']],
  // 9 unique: B,G,F | K,H,J | M,L,I
  'share_tip':      [['B','G','F'], ['K','H','J'], ['M','L','I']],
  // 9 unique: B,F,J | K,G,H | M,L,I
  'faq':            [['B','F','J'], ['K','G','H'], ['M','L','I']],
  // 9 unique: G,H,C | K,E,I | M,L,A
  'team_spotlight': [['G','H','C'], ['K','E','I'], ['M','L','A']],
  // 9 unique: B,J,G | K,I,H | D,L,M
  'community':      [['B','J','G'], ['K','I','H'], ['D','L','M']],
  // 9 unique: D,J,G | K,A,B | M,L,I
  'milestone':      [['D','J','G'], ['K','A','B'], ['M','L','I']],
};

function resolveTemplateSet(wizardTrigger, customer, lineupIndexOverride = null) {
  const fp      = getDesignFingerprint(customer);
  const lineups = LINEUP_MAP[wizardTrigger] || LINEUP_MAP['job_finished'];
  const idx     = lineupIndexOverride !== null
    ? ((lineupIndexOverride % lineups.length) + lineups.length) % lineups.length
    : fp.lineupOffset % lineups.length;
  return lineups[idx];
}

const TEMPLATE_BUILDERS = {
  A: buildTemplateA,
  B: buildTemplateB,
  C: buildTemplateC,
  D: buildTemplateD,
  E: buildTemplateE,
  F: buildTemplateF,
  G: buildTemplateG,
  H: buildTemplateH,
  I: buildTemplateI,
  J: buildTemplateJ,
  K: buildTemplateK,
  L: buildTemplateL,
  M: buildTemplateM,
};

// ── Main exports ──────────────────────────────────────────────────────────────

/**
 * Generate 3 branded photo card JPEGs (Sharp composite path).
 * wizardTrigger selects which 3 of the 4 templates to use and in what order,
 * so variation A always shows the best-fit design for the content type.
 * @returns {{ bufferA, bufferB, bufferC }}
 */
async function generatePhotoCards(photoBuffer, cardOverlay, customer, wizardTrigger = null) {
  const colors       = resolveBrandColors(customer);
  const businessName = customer?.business_name || '';
  const phone        = customer?.phone || null;
  const industry     = customer?.industry || 'general_contractor';
  const fingerprint  = getDesignFingerprint(customer);

  const logoBuffer = await fetchLogoBuffer(customer?.logo_url);
  const resized    = await resizePhoto(photoBuffer);

  const [tA, tB, tC] = resolveTemplateSet(wizardTrigger, customer);
  const [bufferA, bufferB, bufferC] = await Promise.all([
    TEMPLATE_BUILDERS[tA](resized, cardOverlay, businessName, phone, colors, logoBuffer, industry, false, null, null, fingerprint),
    TEMPLATE_BUILDERS[tB](resized, cardOverlay, businessName, phone, colors, logoBuffer, industry, false, null, null, fingerprint),
    TEMPLATE_BUILDERS[tC](resized, cardOverlay, businessName, phone, colors, logoBuffer, industry, false, null, null, fingerprint),
  ]);

  return { bufferA, bufferB, bufferC };
}

/**
 * Generate 3 branded photo card SVG strings for live browser-side editing.
 * No Sharp / no network calls (photo embedded as <image href="...">) .
 * Returns synchronously-equivalent SVG strings — text elements carry data-field
 * attributes so the frontend can update them via DOMParser without a round-trip.
 * @returns {{ svgA, svgB, svgC }}
 */
async function generatePhotoCardsSVG(photoUrl, cardOverlay, customer, wizardTrigger = null) {
  const colors       = resolveBrandColors(customer);
  const businessName = customer?.business_name || '';
  const phone        = customer?.phone || null;
  const industry     = customer?.industry || 'general_contractor';
  const logoUrl      = customer?.logo_url || null;
  const fingerprint  = getDesignFingerprint(customer);

  const [tA, tB, tC] = resolveTemplateSet(wizardTrigger, customer);
  const [svgA, svgB, svgC] = await Promise.all([
    TEMPLATE_BUILDERS[tA](null, cardOverlay, businessName, phone, colors, null, industry, true, photoUrl, logoUrl, fingerprint),
    TEMPLATE_BUILDERS[tB](null, cardOverlay, businessName, phone, colors, null, industry, true, photoUrl, logoUrl, fingerprint),
    TEMPLATE_BUILDERS[tC](null, cardOverlay, businessName, phone, colors, null, industry, true, photoUrl, logoUrl, fingerprint),
  ]);

  return { svgA, svgB, svgC };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLATFORM DIMENSION ENGINE
// Purpose-built layouts per aspect ratio — NOT crop/resize hacks.
// Every platform gets a composition designed for its canvas and audience.
// ═══════════════════════════════════════════════════════════════════════════════

const PLATFORM_SPECS = {
  instagram_feed:    { w: 1080, h: 1350, label: 'Instagram Feed' },
  instagram_square:  { w: 1080, h: 1080, label: 'Instagram Square' },
  instagram_stories: { w: 1080, h: 1920, label: 'Instagram Stories' },
  facebook_feed:     { w: 1080, h: 1080, label: 'Facebook Feed' },
  linkedin_feed:     { w: 1200, h: 627,  label: 'LinkedIn Feed' },
  google_business:   { w: 1200, h: 900,  label: 'Google Business' },
};

async function resizePhotoTo(buffer, targetW, targetH) {
  return sharp(buffer)
    .rotate()
    .resize(targetW, targetH, { fit: 'cover', position: 'center' })
    .toBuffer();
}

// ── Landscape L1 — "Wide Side Panel" (1200×630) ───────────────────────────────
// Brand color panel left 42% with all text. Photo FULLY VISIBLE right 58%.
// Sharp vertical seam in secondary color — the most effective Facebook format.
async function buildLandscapePanel(resizedBuf, cardOverlay, businessName, phone, colors, logoBuffer, industry, fingerprint) {
  const FW = 1200, FH = 630;
  const c = (fingerprint?.colorRole === 1)
    ? { primary: colors.secondary, secondary: colors.primary, accent: colors.accent }
    : colors;
  const { headline = '', eyebrow = '', subtext = '', cta = '', services = [], uppercase = false } = cardOverlay;
  const headText  = uppercase ? headline.toUpperCase() : toTitleCase(headline);
  const panelW    = 492;
  const padX      = 44;
  const headLines = wrapText(escapeXml(headText), 15);
  const subLines  = wrapText(escapeXml(subtext), 27);
  const bullets   = Array.isArray(services) ? services.slice(0, 2) : [];
  const { r: pr, g: pg, b: pb } = hexToRgbG(c.primary);
  const opacity   = fingerprint?.overlayOpacity || 0.90;
  const dark      = darkenHex(c.primary, 0.20);
  const fw        = fingerprint?.typographyWeight === 1 ? '800' : '900';

  const headStartY = 155;
  const headLineH  = 54;
  const headEndY   = headStartY + headLines.length * headLineH;
  const subStartY  = headEndY + 18;
  const subLineH   = 28;
  const listStartY = subStartY + subLines.length * subLineH + 18;

  const parts = [
    `<defs><linearGradient id="panelLP" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${c.primary}"/><stop offset="100%" stop-color="${dark}"/></linearGradient></defs>`,
    `<rect x="0" y="0" width="${panelW}" height="${FH}" fill="rgba(${pr},${pg},${pb},${opacity})"/>`,
    `<rect x="${panelW - 5}" y="0" width="${fingerprint?.accentBarThickness || 7}" height="${FH}" fill="${c.secondary}"/>`,
    `<circle cx="${Math.floor(panelW * 0.82)}" cy="${Math.floor(FH * 0.18)}" r="55" fill="${c.secondary}" opacity="0.09"/>`,
    `<circle cx="${Math.floor(panelW * 0.12)}" cy="${Math.floor(FH * 0.76)}" r="80" fill="${c.secondary}" opacity="${fingerprint?.decorDensity === 2 ? '0.07' : '0.04'}"/>`,
  ];

  parts.push(logoBuffer
    ? `<text x="${padX + 78}" y="38" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="16" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`
    : industryIconSvg(padX + 18, 38, 17, industry, 'rgba(255,255,255,0.95)', c.primary) + `<text x="${padX + 46}" y="38" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="16" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`
  );

  if (eyebrow) parts.push(`<text x="${padX}" y="${headStartY - 32}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="13" font-weight="700" letter-spacing="2" fill="${c.secondary}" dominant-baseline="hanging">${escapeXml(eyebrow.toUpperCase())}</text>`);

  headLines.forEach((l, i) => parts.push(`<text x="${padX}" y="${headStartY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="46" font-weight="${fw}" letter-spacing="-1.5" fill="#ffffff" dominant-baseline="hanging">${l}</text>`));
  parts.push(`<rect x="${padX}" y="${headEndY + 10}" width="80" height="4" rx="2" fill="${c.secondary}"/>`);
  subLines.forEach((l, i) => parts.push(`<text x="${padX}" y="${subStartY + i * subLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="400" fill="rgba(255,255,255,0.84)" dominant-baseline="hanging">${l}</text>`));
  bullets.forEach((item, i) => {
    const y = listStartY + i * 36 + 12;
    parts.push(`<circle cx="${padX + 7}" cy="${y}" r="7" fill="${c.secondary}"/>`);
    parts.push(`<text x="${padX + 22}" y="${y}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="18" font-weight="600" fill="#ffffff" dominant-baseline="middle">${escapeXml(item)}</text>`);
  });

  if (cta) {
    const ctaText = escapeXml(cta.toUpperCase());
    const ctaW = Math.min(380, Math.max(180, ctaText.length * 11 + 52));
    const ctaY = FH - 96;
    parts.push(`<rect x="${padX}" y="${ctaY}" width="${ctaW}" height="52" rx="26" fill="#ffffff"/>`);
    parts.push(`<text x="${padX + ctaW / 2}" y="${ctaY + 26}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="16" font-weight="900" fill="${c.primary}" text-anchor="middle" dominant-baseline="middle">${ctaText}</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FW}" height="${FH}">${parts.join('')}</svg>`;
  const composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) composite.push({ input: logoBuffer, top: 10, left: padX });
  return sharp(resizedBuf).composite(composite).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

// ── Landscape L2 — "Cinematic Lower Third" (1200×630) ─────────────────────────
// Photo FULLY CLEAR in top 58%. Dark gradient bottom zone — broadcast style.
// Brand-color bar pins the top. Headline + CTA in lower third only.
async function buildLandscapeCinematic(resizedBuf, cardOverlay, businessName, phone, colors, logoBuffer, industry, fingerprint) {
  const FW = 1200, FH = 630;
  const c = (fingerprint?.colorRole === 1)
    ? { primary: colors.secondary, secondary: colors.primary, accent: colors.accent }
    : colors;
  const { headline = '', eyebrow = '', subtext = '', cta = '', uppercase = false } = cardOverlay;
  const headText  = uppercase ? headline.toUpperCase() : toTitleCase(headline);
  const headLines = wrapText(escapeXml(headText), 22);
  const subLines  = wrapText(escapeXml(subtext), 44);
  const dark      = darkenHex(c.primary, 0.22);
  const lowerY    = Math.floor(FH * 0.58);
  const lowerH    = FH - lowerY;
  const padX      = 44;
  const fw        = fingerprint?.typographyWeight === 1 ? '800' : '900';

  const parts = [
    `<defs><linearGradient id="lowerLC" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#000000" stop-opacity="0.68"/><stop offset="100%" stop-color="${dark}" stop-opacity="0.95"/></linearGradient></defs>`,
    `<rect x="0" y="0" width="${FW}" height="${fingerprint?.accentBarThickness || 7}" fill="${c.secondary}"/>`,
    `<text x="${padX}" y="32" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="14" font-weight="600" fill="#ffffff" dominant-baseline="middle" opacity="0.70">${escapeXml(businessName)}</text>`,
    `<rect x="0" y="${lowerY}" width="${FW}" height="${lowerH}" fill="url(#lowerLC)"/>`,
  ];

  const headStartY = lowerY + (eyebrow ? 52 : 30);
  if (eyebrow) parts.push(`<text x="${padX}" y="${lowerY + 16}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="12" font-weight="700" letter-spacing="2.5" fill="${c.secondary}" dominant-baseline="hanging">${escapeXml(eyebrow.toUpperCase())}</text>`);

  headLines.slice(0, 2).forEach((l, i) => parts.push(`<text x="${padX}" y="${headStartY + i * 52}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="44" font-weight="${fw}" letter-spacing="-1" fill="#ffffff" dominant-baseline="hanging">${l}</text>`));

  const subY = headStartY + Math.min(headLines.length, 2) * 52 + 10;
  subLines.slice(0, 1).forEach(l => parts.push(`<text x="${padX}" y="${subY}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="18" font-weight="400" fill="rgba(255,255,255,0.76)" dominant-baseline="hanging">${l}</text>`));

  if (cta) {
    const ctaText = escapeXml(cta.toUpperCase());
    const ctaW = Math.min(280, Math.max(160, ctaText.length * 10 + 44));
    const ctaX = FW - ctaW - padX;
    const ctaY = FH - 68;
    parts.push(`<rect x="${ctaX}" y="${ctaY - 22}" width="${ctaW}" height="44" rx="22" fill="${c.secondary}"/>`);
    parts.push(`<text x="${ctaX + ctaW / 2}" y="${ctaY}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="14" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${ctaText}</text>`);
  }

  const phoneFormatted = formatPhone(phone);
  if (phoneFormatted && !cta) parts.push(`<text x="${FW - padX}" y="${FH - 38}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="end" dominant-baseline="middle">${escapeXml(phoneFormatted)}</text>`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FW}" height="${FH}">${parts.join('')}</svg>`;
  const composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) composite.push({ input: logoBuffer, top: 10, left: padX });
  return sharp(resizedBuf).composite(composite).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

// ── Landscape L3 — "Right Frosted Card" (1200×630) ────────────────────────────
// Photo full-bleed (photo subject visible left side). Frosted white card RIGHT.
// Dark text on white — premium, asymmetric, editorial. Most unique Facebook look.
async function buildLandscapeSplitCard(resizedBuf, cardOverlay, businessName, phone, colors, logoBuffer, industry, fingerprint) {
  const FW = 1200, FH = 630;
  const c = (fingerprint?.colorRole === 1)
    ? { primary: colors.secondary, secondary: colors.primary, accent: colors.accent }
    : colors;
  const { headline = '', eyebrow = '', subtext = '', cta = '', uppercase = false } = cardOverlay;
  const headText    = uppercase ? headline.toUpperCase() : toTitleCase(headline);
  const cardW       = 484;
  const cardH       = 550;
  const cardX       = FW - cardW - 30;
  const cardY       = (FH - cardH) / 2;
  const cardRx      = fingerprint?.cornerRadiusMd || 20;
  const cPadX       = cardX + 40;
  const headLines   = wrapText(escapeXml(headText), 14);
  const subLines    = wrapText(escapeXml(subtext), 27);
  const cardOpacity = fingerprint?.overlayOpacity || 0.92;
  const fw          = fingerprint?.typographyWeight === 1 ? '800' : '900';
  const headStartY  = cardY + 96;
  const headLineH   = 52;
  const headEndY    = headStartY + headLines.length * headLineH;
  const subStartY   = headEndY + 14;

  const parts = [
    `<defs><radialGradient id="vigLSC" cx="30%" cy="50%" r="80%"><stop offset="0%" stop-color="#000000" stop-opacity="0.00"/><stop offset="100%" stop-color="#000000" stop-opacity="0.38"/></radialGradient></defs>`,
    `<rect x="0" y="0" width="${FW}" height="${FH}" fill="url(#vigLSC)"/>`,
    `<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="${cardRx}" fill="rgba(255,255,255,${cardOpacity})"/>`,
    `<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="${cardRx}" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1"/>`,
    `<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${fingerprint?.accentBarThickness || 8}" rx="${cardRx}" fill="${c.primary}"/>`,
    `<text x="32" y="${FH - 20}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="13" font-weight="600" fill="#ffffff" dominant-baseline="auto" opacity="0.60">${escapeXml(businessName)}</text>`,
  ];

  parts.push(logoBuffer
    ? `<text x="${cPadX + 64}" y="${cardY + 36}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="15" font-weight="700" fill="${c.primary}" dominant-baseline="middle">${escapeXml(businessName)}</text>`
    : industryIconSvg(cPadX + 17, cardY + 36, 17, industry, c.primary, '#ffffff') + `<text x="${cPadX + 44}" y="${cardY + 36}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="15" font-weight="700" fill="${c.primary}" dominant-baseline="middle">${escapeXml(businessName)}</text>`
  );

  if (eyebrow) parts.push(`<text x="${cPadX}" y="${headStartY - 26}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="12" font-weight="700" letter-spacing="2" fill="${c.secondary}" dominant-baseline="hanging">${escapeXml(eyebrow.toUpperCase())}</text>`);

  headLines.forEach((l, i) => parts.push(`<text x="${cPadX}" y="${headStartY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="44" font-weight="${fw}" letter-spacing="-1" fill="${c.primary}" dominant-baseline="hanging">${l}</text>`));
  parts.push(`<rect x="${cPadX}" y="${headEndY + 8}" width="70" height="4" rx="2" fill="${c.secondary}"/>`);
  subLines.forEach((l, i) => parts.push(`<text x="${cPadX}" y="${subStartY + i * 28}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="18" font-weight="400" fill="#2d2d3a" opacity="0.82" dominant-baseline="hanging">${l}</text>`));

  if (cta) {
    const ctaText = escapeXml(cta.toUpperCase());
    const ctaW = Math.min(360, Math.max(160, ctaText.length * 10 + 44));
    const ctaY = cardY + cardH - 68;
    parts.push(`<rect x="${cPadX}" y="${ctaY - 20}" width="${ctaW}" height="44" rx="22" fill="${c.primary}"/>`);
    parts.push(`<text x="${cPadX + ctaW / 2}" y="${ctaY}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="14" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${ctaText}</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FW}" height="${FH}">${parts.join('')}</svg>`;
  const composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) composite.push({ input: logoBuffer, top: cardY + 18, left: cPadX });
  return sharp(resizedBuf).composite(composite).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

// ── Google Business GB1 — "Bottom Banner" (1200×900) ──────────────────────────
// Photo fills top 62%. Frosted white strip bottom 38%. Brand-color seam bar.
// Brand-color headline on white — extremely readable, recommended for GBP.
async function buildGBBottomBanner(resizedBuf, cardOverlay, businessName, phone, colors, logoBuffer, industry, fingerprint) {
  const FW = 1200, FH = 900;
  const c = (fingerprint?.colorRole === 1)
    ? { primary: colors.secondary, secondary: colors.primary, accent: colors.accent }
    : colors;
  const { headline = '', eyebrow = '', subtext = '', cta = '', services = [], uppercase = false } = cardOverlay;
  const headText   = uppercase ? headline.toUpperCase() : toTitleCase(headline);
  const stripY     = Math.floor(FH * 0.62);
  const stripH     = FH - stripY;
  const padX       = 60;
  const stripOpac  = fingerprint?.overlayOpacity || 0.95;
  const headLines  = wrapText(escapeXml(headText), 18);
  const subLines   = wrapText(escapeXml(subtext), 36);
  const bullets    = Array.isArray(services) ? services.slice(0, 2) : [];
  const headStartY = stripY + 52;
  const headLineH  = 64;
  const headEndY   = headStartY + headLines.length * headLineH;
  const fw         = fingerprint?.typographyWeight === 1 ? '800' : '900';

  const parts = [
    `<defs><linearGradient id="topVigGB1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#000000" stop-opacity="0.56"/><stop offset="20%" stop-color="#000000" stop-opacity="0.00"/></linearGradient></defs>`,
    `<rect x="0" y="0" width="${FW}" height="160" fill="url(#topVigGB1)"/>`,
    `<rect x="0" y="${stripY}" width="${FW}" height="${stripH}" fill="rgba(255,255,255,${stripOpac})"/>`,
    `<rect x="0" y="${stripY - 4}" width="${FW}" height="${fingerprint?.accentBarThickness || 10}" fill="${c.primary}"/>`,
    `<rect x="0" y="${stripY + 6}" width="${Math.round((fingerprint?.accentBarThickness || 7) * 0.9) || 6}" height="${stripH - 6}" fill="${c.secondary}" opacity="0.80"/>`,
  ];

  parts.push(logoBuffer
    ? `<text x="${padX + 76}" y="52" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`
    : industryIconSvg(padX + 20, 52, 20, industry, 'rgba(255,255,255,0.95)', c.primary) + `<text x="${padX + 52}" y="52" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`
  );

  if (eyebrow) parts.push(`<text x="${padX + 12}" y="${stripY + 18}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="2" fill="${c.secondary}" dominant-baseline="hanging">${escapeXml(eyebrow.toUpperCase())}</text>`);

  headLines.forEach((l, i) => parts.push(`<text x="${padX + 12}" y="${headStartY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="56" font-weight="${fw}" letter-spacing="-1.5" fill="${c.primary}" dominant-baseline="hanging">${l}</text>`));

  subLines.slice(0, 2).forEach((l, i) => parts.push(`<text x="${padX + 12}" y="${headEndY + 18 + i * 30}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="400" fill="#2a2a3a" opacity="0.78" dominant-baseline="hanging">${l}</text>`));

  bullets.forEach((item, i) => {
    const y = headEndY + 18 + 2 * 30 + 24 + i * 40;
    parts.push(`<text x="${padX + 12}" y="${y}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="600" fill="${c.primary}" dominant-baseline="middle">· ${escapeXml(item)}</text>`);
  });

  if (cta) {
    const ctaText = escapeXml(cta.toUpperCase());
    const ctaW = Math.min(360, Math.max(200, ctaText.length * 12 + 52));
    const ctaX = FW - ctaW - padX;
    const ctaY = FH - 78;
    parts.push(`<rect x="${ctaX}" y="${ctaY - 26}" width="${ctaW}" height="52" rx="26" fill="${c.primary}"/>`);
    parts.push(`<text x="${ctaX + ctaW / 2}" y="${ctaY}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="17" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${ctaText}</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FW}" height="${FH}">${parts.join('')}</svg>`;
  const composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) composite.push({ input: logoBuffer, top: 22, left: padX });
  return sharp(resizedBuf).composite(composite).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

// ── Google Business GB2 — "Full Overlay" (1200×900) ───────────────────────────
// Photo full-bleed. Dark left gradient. Left-aligned text hierarchy.
// Mirrors Template A proportionally for the 4:3 canvas — native GBP look.
async function buildGBFullOverlay(resizedBuf, cardOverlay, businessName, phone, colors, logoBuffer, industry, fingerprint) {
  const FW = 1200, FH = 900;
  const c = (fingerprint?.colorRole === 1)
    ? { primary: colors.secondary, secondary: colors.primary, accent: colors.accent }
    : colors;
  const { headline = '', eyebrow = '', subtext = '', cta = '', services = [], uppercase = false } = cardOverlay;
  const headText   = uppercase ? headline.toUpperCase() : toTitleCase(headline);
  const headLines  = wrapText(escapeXml(headText), 16);
  const subLines   = wrapText(escapeXml(subtext), 30);
  const bullets    = Array.isArray(services) ? services.slice(0, 3) : [];
  const padX       = 60;
  const dark       = darkenHex(c.primary, 0.28);
  const headStartY = 220;
  const headLineH  = 70;
  const headEndY   = headStartY + headLines.length * headLineH;
  const subStartY  = headEndY + 24;
  const listStartY = subStartY + subLines.length * 38 + 30;
  const fw         = fingerprint?.typographyWeight === 1 ? '800' : '900';

  const parts = [
    `<defs>
      <linearGradient id="fadeGB2" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#000000" stop-opacity="0.88"/><stop offset="48%" stop-color="#000000" stop-opacity="0.72"/><stop offset="70%" stop-color="#000000" stop-opacity="0.10"/><stop offset="100%" stop-color="#000000" stop-opacity="0.00"/></linearGradient>
      <linearGradient id="topDGB2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#000000" stop-opacity="0.72"/><stop offset="100%" stop-color="#000000" stop-opacity="0.00"/></linearGradient>
      <linearGradient id="botDGB2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${dark}" stop-opacity="0.00"/><stop offset="100%" stop-color="${dark}" stop-opacity="0.96"/></linearGradient>
    </defs>`,
    `<rect x="0" y="0" width="${FW}" height="${FH}" fill="url(#fadeGB2)"/>`,
    `<rect x="0" y="0" width="${FW}" height="120" fill="url(#topDGB2)"/>`,
    `<rect x="0" y="${FH - 160}" width="${FW}" height="160" fill="url(#botDGB2)"/>`,
    `<rect x="0" y="0" width="${Math.min(12, (fingerprint?.accentBarThickness || 7) + 2)}" height="${FH}" fill="${c.secondary}"/>`,
  ];

  parts.push(logoBuffer
    ? `<text x="${padX + 78}" y="60" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`
    : industryIconSvg(padX + 22, 60, 22, industry, 'rgba(255,255,255,0.95)', c.primary) + `<text x="${padX + 56}" y="60" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" dominant-baseline="middle">${escapeXml(businessName)}</text>`
  );

  if (eyebrow) parts.push(`<text x="${padX}" y="${headStartY - 40}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="17" font-weight="700" letter-spacing="2.5" fill="${c.secondary}" dominant-baseline="hanging">${escapeXml(eyebrow.toUpperCase())}</text>`);

  headLines.forEach((l, i) => parts.push(`<text x="${padX}" y="${headStartY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="64" font-weight="${fw}" letter-spacing="-1.5" fill="#ffffff" stroke="#000000" stroke-width="8" stroke-opacity="0.36" paint-order="stroke fill" dominant-baseline="hanging">${l}</text>`));
  parts.push(`<rect x="${padX}" y="${headEndY + 14}" width="110" height="5" rx="2.5" fill="${c.secondary}"/>`);
  subLines.forEach((l, i) => parts.push(`<text x="${padX}" y="${subStartY + i * 38}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="28" font-weight="400" fill="#ffffff" opacity="0.86" dominant-baseline="hanging">${l}</text>`));
  bullets.forEach((item, i) => {
    const y = listStartY + i * 52 + 20;
    parts.push(`<circle cx="${padX + 8}" cy="${y}" r="8" fill="${c.secondary}"/>`);
    parts.push(`<text x="${padX + 26}" y="${y}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="26" font-weight="600" fill="#ffffff" dominant-baseline="middle">${escapeXml(item)}</text>`);
  });

  if (cta) {
    const ctaText = escapeXml(cta.toUpperCase());
    const ctaW = Math.min(420, Math.max(220, ctaText.length * 13 + 60));
    const ctaY = FH - 120;
    parts.push(`<rect x="${padX}" y="${ctaY}" width="${ctaW}" height="60" rx="30" fill="${c.secondary}"/>`);
    parts.push(`<text x="${padX + ctaW / 2}" y="${ctaY + 30}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="20" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${ctaText}</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FW}" height="${FH}">${parts.join('')}</svg>`;
  const composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) composite.push({ input: logoBuffer, top: 22, left: padX });
  return sharp(resizedBuf).composite(composite).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

// ── Google Business GB3 — "Centered Float Card" (1200×900) ────────────────────
// Photo full-bleed with radial vignette. Centered frosted card (920×560px).
// Dark text on white — premium, clean, professional. GBP loves clean layouts.
async function buildGBFloatCard(resizedBuf, cardOverlay, businessName, phone, colors, logoBuffer, industry, fingerprint) {
  const FW = 1200, FH = 900;
  const c = (fingerprint?.colorRole === 1)
    ? { primary: colors.secondary, secondary: colors.primary, accent: colors.accent }
    : colors;
  const { headline = '', eyebrow = '', subtext = '', cta = '', services = [], uppercase = false } = cardOverlay;
  const headText    = uppercase ? headline.toUpperCase() : toTitleCase(headline);
  const cardW       = 920, cardH = 560;
  const cardX       = (FW - cardW) / 2;
  const cardY       = (FH - cardH) / 2;
  const cardRx      = fingerprint?.cornerRadiusLg || 24;
  const cPadX       = cardX + 60;
  const cardOpacity = fingerprint?.overlayOpacity || 0.92;
  const headLines   = wrapText(escapeXml(headText), 22);
  const subLines    = wrapText(escapeXml(subtext), 40);
  const bullets     = Array.isArray(services) ? services.slice(0, 2) : [];
  const headStartY  = cardY + 120;
  const headLineH   = 66;
  const headEndY    = headStartY + headLines.length * headLineH;
  const fw          = fingerprint?.typographyWeight === 1 ? '800' : '900';

  const parts = [
    `<defs><radialGradient id="vigGB3" cx="50%" cy="50%" r="65%"><stop offset="0%" stop-color="#000000" stop-opacity="0.00"/><stop offset="100%" stop-color="#000000" stop-opacity="0.52"/></radialGradient></defs>`,
    `<rect x="0" y="0" width="${FW}" height="${FH}" fill="url(#vigGB3)"/>`,
    `<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="${cardRx}" fill="rgba(255,255,255,${cardOpacity})"/>`,
    `<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="${cardRx}" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1"/>`,
    `<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${fingerprint?.accentBarThickness || 10}" rx="${cardRx}" fill="${c.primary}"/>`,
  ];

  parts.push(logoBuffer
    ? `<text x="${cPadX + 80}" y="${cardY + 42}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="18" font-weight="700" fill="${c.primary}" dominant-baseline="middle">${escapeXml(businessName)}</text>`
    : industryIconSvg(cPadX + 20, cardY + 42, 20, industry, c.primary, '#ffffff') + `<text x="${cPadX + 52}" y="${cardY + 42}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="18" font-weight="700" fill="${c.primary}" dominant-baseline="middle">${escapeXml(businessName)}</text>`
  );

  if (eyebrow) parts.push(`<text x="${cPadX}" y="${headStartY - 34}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="2" fill="${c.secondary}" dominant-baseline="hanging">${escapeXml(eyebrow.toUpperCase())}</text>`);

  headLines.forEach((l, i) => parts.push(`<text x="${cPadX}" y="${headStartY + i * headLineH}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="58" font-weight="${fw}" letter-spacing="-1.5" fill="${c.primary}" dominant-baseline="hanging">${l}</text>`));
  parts.push(`<rect x="${cPadX}" y="${headEndY + 10}" width="90" height="4" rx="2" fill="${c.secondary}"/>`);
  subLines.slice(0, 2).forEach((l, i) => parts.push(`<text x="${cPadX}" y="${headEndY + 24 + i * 34}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="24" font-weight="400" fill="#2d2d3a" opacity="0.82" dominant-baseline="hanging">${l}</text>`));
  bullets.forEach((item, i) => {
    const y = headEndY + 24 + 2 * 34 + 20 + i * 42;
    parts.push(`<circle cx="${cPadX + 8}" cy="${y}" r="8" fill="${c.secondary}"/>`);
    parts.push(`<text x="${cPadX + 26}" y="${y}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="22" font-weight="600" fill="#1a1a2a" dominant-baseline="middle">${escapeXml(item)}</text>`);
  });

  if (cta) {
    const ctaText = escapeXml(cta.toUpperCase());
    const ctaW = Math.min(400, Math.max(200, ctaText.length * 13 + 56));
    const ctaY = cardY + cardH - 80;
    parts.push(`<rect x="${cPadX}" y="${ctaY - 26}" width="${ctaW}" height="52" rx="26" fill="${c.primary}"/>`);
    parts.push(`<text x="${cPadX + ctaW / 2}" y="${ctaY}" font-family="'Liberation Sans','DejaVu Sans',Arial,sans-serif" font-size="17" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${ctaText}</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FW}" height="${FH}">${parts.join('')}</svg>`;
  const composite = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logoBuffer) composite.push({ input: logoBuffer, top: cardY + 22, left: cPadX });
  return sharp(resizedBuf).composite(composite).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

// ── Design param merger ────────────────────────────────────────────────────────
// Merges global DesignAdvisor params (monthly Claude output) into the
// per-customer fingerprint. Customer-specific values (colorRole, lineupOffset,
// decorDensity) are preserved; global trend overrides (opacity, bar thickness,
// radii, weight) are applied on top.
function mergeDesignParams(fingerprint, dp) {
  if (!dp) return fingerprint;
  return {
    ...fingerprint,
    overlayOpacity:      dp.overlayOpacityBase    || fingerprint.overlayOpacity,
    typographyWeight:    dp.headlineFontWeight === '800' ? 1 : 0,
    accentBarThickness:  dp.accentBarThickness     || 7,
    cornerRadiusMd:      dp.cornerRadiusMd         || 18,
    cornerRadiusLg:      dp.cornerRadiusLg         || 24,
  };
}

/**
 * Generate photo cards for multiple platforms in parallel.
 * Each platform gets a purpose-built composition — NOT a crop/resize of the master.
 *
 * instagram_feed:   10-template variety (A-J) selected by design seed
 * facebook_feed:    3 dedicated landscape compositions (L1/L2/L3)
 * linkedin_feed:    same 3 landscape compositions as Facebook
 * google_business:  3 dedicated 4:3 compositions (GB1/GB2/GB3)
 * instagram_square: portrait templates at 1080×1080 (center-crop photo)
 *
 * @param {Buffer}   photoBuffer      Raw NanoBanana photo buffer
 * @param {Object}   cardOverlay      Text content (headline, subtext, cta, etc.)
 * @param {Object}   customer         Customer row with brand_colors, business_name
 * @param {string}   wizardTrigger    Content type from wizard step 1
 * @param {string[]} platforms        Which platforms to generate. Default: main 3.
 * @returns {Object} { instagram_feed: {A, B, C}, facebook_feed: {A, B, C}, ... }
 */
async function generatePhotoCardsForPlatforms(
  photoBuffer,
  cardOverlay,
  customer,
  wizardTrigger = null,
  platforms = ['instagram_feed', 'facebook_feed', 'google_business'],
  designParams = null,
  lineupIndexOverride = null
) {
  const colors       = resolveBrandColors(customer);
  const businessName = customer?.business_name || '';
  const phone        = customer?.phone || null;
  const industry     = customer?.industry || 'general_contractor';
  const fingerprint  = mergeDesignParams(getDesignFingerprint(customer), designParams);
  const logoBuffer   = await fetchLogoBuffer(customer?.logo_url);

  // Resize photo to each unique dimension needed (deduplicated).
  // facebook_feed derives from instagram_feed via crop, so skip its separate resize.
  const dimsNeeded = new Map();
  const needsIgForFb = platforms.includes('facebook_feed') && !platforms.includes('instagram_feed');
  for (const p of platforms) {
    if (p === 'facebook_feed') continue; // no separate photo resize — derived from instagram
    const s = PLATFORM_SPECS[p];
    if (s) dimsNeeded.set(`${s.w}x${s.h}`, { w: s.w, h: s.h });
  }
  if (needsIgForFb) {
    const ig = PLATFORM_SPECS['instagram_feed'];
    dimsNeeded.set(`${ig.w}x${ig.h}`, { w: ig.w, h: ig.h });
  }
  const resizedMap = {};
  await Promise.all(Array.from(dimsNeeded.entries()).map(async ([key, dim]) => {
    resizedMap[key] = await resizePhotoTo(photoBuffer, dim.w, dim.h);
  }));

  const result = {};

  // Instagram must run before facebook (facebook is a square crop of instagram)
  if (platforms.includes('instagram_feed') || platforms.includes('facebook_feed')) {
    const igSpec = PLATFORM_SPECS['instagram_feed'];
    const igPhoto = resizedMap[`${igSpec.w}x${igSpec.h}`];
    if (igPhoto) {
      const [tA, tB, tC] = resolveTemplateSet(wizardTrigger, customer, lineupIndexOverride);
      const [bA, bB, bC] = await Promise.all([
        TEMPLATE_BUILDERS[tA](igPhoto, cardOverlay, businessName, phone, colors, logoBuffer, industry, false, null, null, fingerprint),
        TEMPLATE_BUILDERS[tB](igPhoto, cardOverlay, businessName, phone, colors, logoBuffer, industry, false, null, null, fingerprint),
        TEMPLATE_BUILDERS[tC](igPhoto, cardOverlay, businessName, phone, colors, logoBuffer, industry, false, null, null, fingerprint),
      ]);
      result.instagram_feed = { A: bA, B: bB, C: bC };
    }
  }

  await Promise.all(platforms.filter(p => p !== 'instagram_feed').map(async (platform) => {
    const spec = PLATFORM_SPECS[platform];
    if (!spec && platform !== 'facebook_feed') return;

    if (platform === 'facebook_feed') {
      // Square 1080×1080: crop the portrait instagram card from the top (preserves logo + headline)
      if (result.instagram_feed) {
        const [bA, bB, bC] = await Promise.all([
          sharp(result.instagram_feed.A).resize(1080, 1080, { fit: 'cover', position: 'top' }).jpeg({ quality: 85, mozjpeg: true }).toBuffer(),
          sharp(result.instagram_feed.B).resize(1080, 1080, { fit: 'cover', position: 'top' }).jpeg({ quality: 85, mozjpeg: true }).toBuffer(),
          sharp(result.instagram_feed.C).resize(1080, 1080, { fit: 'cover', position: 'top' }).jpeg({ quality: 85, mozjpeg: true }).toBuffer(),
        ]);
        result.facebook_feed = { A: bA, B: bB, C: bC };
      }
      return;
    }

    const photo = resizedMap[`${spec.w}x${spec.h}`];

    if (platform === 'linkedin_feed') {
      const [bA, bB, bC] = await Promise.all([
        buildLandscapePanel(photo, cardOverlay, businessName, phone, colors, logoBuffer, industry, fingerprint),
        buildLandscapeCinematic(photo, cardOverlay, businessName, phone, colors, logoBuffer, industry, fingerprint),
        buildLandscapeSplitCard(photo, cardOverlay, businessName, phone, colors, logoBuffer, industry, fingerprint),
      ]);
      result.linkedin_feed = { A: bA, B: bB, C: bC };

    } else if (platform === 'google_business') {
      const [bA, bB, bC] = await Promise.all([
        buildGBBottomBanner(photo, cardOverlay, businessName, phone, colors, logoBuffer, industry, fingerprint),
        buildGBFullOverlay(photo, cardOverlay, businessName, phone, colors, logoBuffer, industry, fingerprint),
        buildGBFloatCard(photo, cardOverlay, businessName, phone, colors, logoBuffer, industry, fingerprint),
      ]);
      result.google_business = { A: bA, B: bB, C: bC };

    } else if (platform === 'instagram_square') {
      // Square: use portrait templates with square-cropped photo
      const [tA, tB, tC] = resolveTemplateSet(wizardTrigger, customer, lineupIndexOverride);
      const [bA, bB, bC] = await Promise.all([
        TEMPLATE_BUILDERS[tA](photo, cardOverlay, businessName, phone, colors, logoBuffer, industry, false, null, null, fingerprint),
        TEMPLATE_BUILDERS[tB](photo, cardOverlay, businessName, phone, colors, logoBuffer, industry, false, null, null, fingerprint),
        TEMPLATE_BUILDERS[tC](photo, cardOverlay, businessName, phone, colors, logoBuffer, industry, false, null, null, fingerprint),
      ]);
      result.instagram_square = { A: bA, B: bB, C: bC };
    }
  }));

  return result;
}

module.exports = { generatePhotoCards, generatePhotoCardsSVG, generatePhotoCardsForPlatforms, resolveBrandColors, PLATFORM_SPECS, getDesignFingerprint };
