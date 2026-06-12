/**
 * ItsPosting — Wizard Backend API
 * backend/routes/wizard.js
 *
 * Handles the guided post creation flow.
 * This replaces the blank prompt box with a step-by-step wizard
 * that assembles a rich context for Claude to generate the best possible posts.
 *
 * Flow:
 * POST /api/wizard/start     — begins session, returns step 1
 * POST /api/wizard/step      — submits answers, returns next step or final posts
 * POST /api/wizard/generate  — generates 3 variations using Claude API
 * GET  /api/wizard/steps/:industry/:contentType — returns step config
 * POST /api/wizard/quick     — mobile quick post mode
 * POST /api/wizard/refresh   — refresh a variation with a different angle
 */

const express = require('express');
const https = require('https');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate, requireActiveAccount, getBillingCustomerId } = require('../middleware/auth');
const NotificationService = require('../services/NotificationService');
const SystemPromptBuilder = require('../services/SystemPromptBuilder');

let NanoBananaService;
try {
  NanoBananaService = require('../services/NanoBananaService');
} catch {
  NanoBananaService = null;
  console.warn('[Wizard] NanoBananaService not found — image generation disabled');
}

let HeyGenService;
try {
  HeyGenService = require('../services/HeyGenService');
} catch {
  HeyGenService = null;
  console.warn('[Wizard] HeyGenService not found — video generation disabled');
}

let VideoService;
try {
  VideoService = require('../services/VideoService');
} catch {
  VideoService = null;
  console.warn('[Wizard] VideoService not found — video generation disabled');
}

let ImageResizer;
try {
  ImageResizer = require('../services/ImageResizer');
} catch {
  ImageResizer = null;
  console.warn('[Wizard] ImageResizer not found — platform variants disabled');
}

let industryKnowledge;
try {
  industryKnowledge = require('../data/industryKnowledge');
} catch {
  industryKnowledge = {};
  console.warn('[Wizard] industryKnowledge.js not found — some features will be limited');
}

let BrandedCardService;
try {
  BrandedCardService = require('../services/BrandedCardService');
} catch {
  BrandedCardService = null;
  console.warn('[Wizard] BrandedCardService not found — branded card generation disabled');
}

let PhotoCardService;
try {
  PhotoCardService = require('../services/PhotoCardService');
} catch {
  PhotoCardService = null;
  console.warn('[Wizard] PhotoCardService not found — photo card overlays disabled');
}

let DesignAdvisorService;
try {
  DesignAdvisorService = require('../services/DesignAdvisorService');
} catch {
  DesignAdvisorService = null;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Format → dimensions + media type + platform map. Mirrors FORMAT_DATA in frontend/pages/wizard.js.
// platform drives SystemPromptBuilder caption rules (Instagram-style vs Facebook-style etc.)
// mediaType drives image vs video generation path.
const FORMAT_CONFIG = {
  'universal':    { w: 1080, h: 1350, mediaType: 'image', aspectRatio: '4:5',  platform: 'all'            },
  'ig-45':        { w: 1080, h: 1350, mediaType: 'image', aspectRatio: '4:5',  platform: 'instagram'      },
  'ig-story':     { w: 1080, h: 1920, mediaType: 'video', aspectRatio: '9:16', platform: 'instagram'      },
  'ig-reel':      { w: 1080, h: 1920, mediaType: 'video', aspectRatio: '9:16', platform: 'instagram'      },
  'ig-square':    { w: 1080, h: 1080, mediaType: 'image', aspectRatio: '1:1',  platform: 'instagram'      },
  'fb-landscape': { w: 1200, h: 630,  mediaType: 'image', aspectRatio: '16:9', platform: 'facebook'       },
  'fb-story':     { w: 1080, h: 1920, mediaType: 'video', aspectRatio: '9:16', platform: 'facebook'       },
  'fb-square':    { w: 1080, h: 1080, mediaType: 'image', aspectRatio: '1:1',  platform: 'facebook'       },
  'li-post':      { w: 1200, h: 1200, mediaType: 'image', aspectRatio: '1:1',  platform: 'linkedin'       },
  'li-video':     { w: 1080, h: 1920, mediaType: 'video', aspectRatio: '9:16', platform: 'linkedin'       },
  'tt-video':     { w: 1080, h: 1920, mediaType: 'video', aspectRatio: '9:16', platform: 'tiktok'         },
  'tt-story':     { w: 1080, h: 1920, mediaType: 'video', aspectRatio: '9:16', platform: 'tiktok'         },
  'gb-45':        { w: 1080, h: 1350, mediaType: 'image', aspectRatio: '4:5',  platform: 'google_business'},
};

// Maps format ID → platform(s) to pass to generatePhotoCardsForPlatforms.
// null means this format uses the video pipeline — no card generation.
const FORMAT_TO_CARD_PLATFORMS = {
  'universal':    ['instagram_feed', 'facebook_feed', 'google_business'],
  'ig-45':        ['instagram_feed'],
  'ig-story':     null,
  'ig-reel':      null,
  'ig-square':    ['instagram_feed'],   // instagram_square fallback
  'fb-landscape': ['facebook_feed'],
  'fb-story':     null,
  'fb-square':    ['facebook_feed'],    // facebook_square fallback
  'li-post':      ['instagram_feed'],   // portrait closest to LinkedIn
  'li-video':     null,
  'tt-video':     null,
  'tt-story':     null,
  'gb-45':        ['google_business'],
};

// Maps format ID → ImageResizer platform name for BrandedCard post-resize.
const FORMAT_TO_RESIZER_PLATFORM = {
  'ig-45':        'instagram_feed',
  'ig-square':    'instagram_square',
  'fb-landscape': 'facebook_feed',
  'fb-square':    'facebook_square',
  'li-post':      'linkedin_feed',
  'gb-45':        'instagram_feed',    // google_business cards are 720×720 — keep portrait for card
};

// Auto-save generated media to media_library (non-blocking)
async function autoSaveToMediaLibrary(pool, customerId, mediaUrl, contentType, width, height) {
  if (!mediaUrl) return;
  try {
    // Extract cloudinary public_id from URL
    // URL format: https://res.cloudinary.com/{cloud}/image/upload/v{ver}/{public_id}.{ext}
    const match = mediaUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
    const publicId = match ? match[1] : mediaUrl;
    const isVideo = contentType === 'video';
    const fileType = isVideo ? 'video' : 'image';
    const mimeType = isVideo ? 'video/mp4' : 'image/jpeg';
    const fileName = `AI Generated — ${new Date().toISOString().slice(0, 10)}`;

    await pool.query(
      `INSERT INTO media_library
         (customer_id, cloudinary_public_id, url, thumbnail_url, file_name, file_type, mime_type,
          file_size_bytes, width, height, folder, created_at)
       VALUES ($1,$2,$3,$3,$4,$5,$6,0,$7,$8,'AI Generated',NOW())
       ON CONFLICT DO NOTHING`,
      [customerId, publicId, mediaUrl, fileName, fileType, mimeType, width || null, height || null]
    );
  } catch (e) {
    console.warn('[Wizard] Auto-save to media_library failed (non-fatal):', e.message);
  }
}

// ─────────────────────────────────────────────────────────────
// JSON repair — fixes literal newlines inside string values
// Claude sometimes outputs actual \n characters inside JSON strings
// (especially in videoScript / imagePrompt fields), breaking JSON.parse
// ─────────────────────────────────────────────────────────────
function repairJSON(str) {
  let inString = false;
  let escaped = false;
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escaped) { escaped = false; result += ch; continue; }
    if (ch === '\\') { escaped = true; result += ch; continue; }
    if (ch === '"') { inString = !inString; result += ch; continue; }
    if (inString && ch === '\n') { result += '\\n'; continue; }
    if (inString && ch === '\r') { continue; }
    if (inString && ch === '\t') { result += '\\t'; continue; }
    result += ch;
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// QA Auto-Fix — runs after every Claude generation
// Catches and repairs common quality gaps before returning to frontend.
// Mutates the variations object in-place; no extra API calls.
// ─────────────────────────────────────────────────────────────
const BANNED_POSTCORE_WORDS = {
  delve:    'explore',
  synergy:  'teamwork',
  leverage: 'use',
  optimize: 'improve',
  utilize:  'use',
  robust:   'solid',
  holistic: 'complete',
  paradigm: 'approach',
};
const WEAK_OPENER_RE = /^(we |our |i am |hello |hi |hey |introducing |welcome )/i;

function qaAutoFix(variations, customer) {
  // Extract city from location string — "Dallas, TX" → "dallas", "Austin" → "austin"
  const rawLoc = customer.location || '';
  const city = rawLoc.split(',')[0].trim().toLowerCase();
  const flags = [];

  for (const [key, v] of Object.entries(variations)) {
    if (!v || !v.caption) continue;

    // 1. Replace banned PostCore words
    let caption = v.caption;
    for (const [bad, good] of Object.entries(BANNED_POSTCORE_WORDS)) {
      const re = new RegExp(`\\b${bad}(ing|ed|s|ly)?\\b`, 'gi');
      if (re.test(caption)) {
        caption = caption.replace(re, (match) => {
          const suffix = match.slice(bad.length);
          return good + suffix;
        });
        flags.push(`${key}:replaced "${bad}"`);
      }
    }
    v.caption = caption;

    // 2. Fix missing engagementQuestion — extract the last "?" sentence
    if (!v.engagementQuestion || v.engagementQuestion.trim() === '') {
      const sentences = caption.split(/(?<=[.!?])\s+/);
      const question = [...sentences].reverse().find(s => s.trim().endsWith('?'));
      if (question) {
        v.engagementQuestion = question.trim();
        flags.push(`${key}:extracted engagementQuestion`);
      } else {
        flags.push(`${key}:WARN no engagementQuestion`);
      }
    }

    // 3. Ensure hashtags is always an array
    if (!Array.isArray(v.hashtags)) v.hashtags = [];

    // 4. Log quality signals (not auto-fixed — would change meaning)
    if (city && !caption.toLowerCase().includes(city)) {
      flags.push(`${key}:WARN city not mentioned`);
    }
    if (WEAK_OPENER_RE.test(caption)) {
      flags.push(`${key}:WARN weak opener`);
    }
  }

  if (flags.length > 0) {
    console.log('[Wizard][QA]', flags.join(' | '));
  }
}

// ─────────────────────────────────────────────────────────────
// Card overlay validator — enforces service item length and
// removes invalid state codes from eyebrow text before the
// overlay is passed to PhotoCardService.
// ─────────────────────────────────────────────────────────────
const VALID_US_STATES = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC','PR','GU','VI']);

function validateAndFixCardOverlay(overlay, customer) {
  if (!overlay) return overlay;

  // Services: each item must be max 5 words — they render as visual tags, not sentences
  if (Array.isArray(overlay.services)) {
    overlay.services = overlay.services.map(item => {
      if (typeof item !== 'string') return item;
      const words = item.trim().split(/\s+/);
      if (words.length > 5) {
        console.log(`[Wizard][CardQA] service truncated: "${item.substring(0, 40)}"→"${words.slice(0, 5).join(' ')}"`);
        return words.slice(0, 5).join(' ');
      }
      return item;
    }).filter(Boolean).slice(0, 4);
  }

  // Headline: strip asterisks/markdown emphasis, cap at 6 words.
  // Cap is 6 (not 4) so Claude's complete "4-7 word" phrases aren't cut into fragments.
  // wrapText() in PhotoCardService handles line-breaking within the card layout.
  if (overlay.headline) {
    overlay.headline = overlay.headline.replace(/\*/g, '').replace(/\s{2,}/g, ' ').trim();
    const words = overlay.headline.trim().split(/\s+/);
    if (words.length > 6) {
      overlay.headline = words.slice(0, 6).join(' ');
      console.log('[Wizard][CardQA] headline trimmed to 6 words');
    }
  }

  // Subtext: one sentence max 18 words
  if (overlay.subtext) {
    const firstSentence = overlay.subtext.split(/(?<=[.!?])\s+/)[0];
    const words = firstSentence.trim().split(/\s+/);
    if (words.length > 18) {
      overlay.subtext = words.slice(0, 18).join(' ') + '.';
    } else {
      overlay.subtext = firstSentence.trim();
    }
  }

  // Eyebrow: remove invalid 2-letter state codes (Claude often hallucinates "AX", "XX" etc.)
  if (overlay.eyebrow) {
    overlay.eyebrow = overlay.eyebrow.replace(/\b([A-Z]{2})\b/g, (match) => {
      if (!VALID_US_STATES.has(match)) {
        console.log(`[Wizard][CardQA] removed invalid state code "${match}" from eyebrow`);
        return '';
      }
      return match;
    }).replace(/\s{2,}/g, ' ').replace(/·\s*$/, '').trim();
  }

  return overlay;
}

// ─────────────────────────────────────────────────────────────
// Media validation — sanity checks before sending URL to frontend
// Catches corrupt/missing NanoBanana and HeyGen outputs
// ─────────────────────────────────────────────────────────────
function validateMedia(url, type = 'image') {
  // data: URLs are inline base64 — no HTTP check needed
  if (!url || url.startsWith('data:')) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, (res) => {
      const status = res.statusCode;
      const len = parseInt(res.headers['content-length'] || '0', 10);
      res.resume(); // drain response body
      // Follow redirects (HeyGen CDN may redirect)
      if (status === 301 || status === 302 || status === 307 || status === 308) {
        return resolve(); // treat redirect as OK — URL is accessible
      }
      if (status !== 200) return reject(new Error(`Media URL returned ${status}`));
      // Only apply size checks for images — videos are 50-200MB, no upper limit
      if (type === 'image') {
        if (len > 0 && len < 10240) return reject(new Error(`Image too small (${len} bytes) — likely corrupt`));
        if (len > 20 * 1024 * 1024) return reject(new Error(`Image too large (${len} bytes)`));
      }
      resolve();
    });
    req.on('error', reject);
  });
}

// ─────────────────────────────────────────────────────────────
// Wizard session management — in-memory cache + DB persistence
// DB is the source of truth; Map is a fast read cache.
// Sessions expire after 2 hours.
// ─────────────────────────────────────────────────────────────

const wizardSessions = new Map();

async function getSession(id) {
  if (wizardSessions.has(id)) return wizardSessions.get(id);
  try {
    const r = await pool.query(
      `SELECT data FROM wizard_sessions WHERE id = $1 AND expires_at > NOW()`,
      [id]
    );
    if (r.rows[0]) {
      wizardSessions.set(id, r.rows[0].data);
      return r.rows[0].data;
    }
  } catch (e) {
    console.warn('[Wizard] Session DB read failed:', e.message);
  }
  return null;
}

async function saveSession(id, data) {
  wizardSessions.set(id, data);
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  try {
    await pool.query(
      `INSERT INTO wizard_sessions (id, customer_id, data, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET data = $3, expires_at = $4`,
      [id, data.customerId, JSON.stringify(data), expiresAt]
    );
  } catch (e) {
    console.warn('[Wizard] Session DB save failed:', e.message);
  }
}

async function deleteSession(id) {
  wizardSessions.delete(id);
  try {
    await pool.query(`DELETE FROM wizard_sessions WHERE id = $1`, [id]);
  } catch (e) {
    console.warn('[Wizard] Session DB delete failed:', e.message);
  }
}

// Credit refund helper — called when video generation fails after credits were deducted
async function _refundCredits(pool, billingId, postId, amount) {
  if (!billingId || !amount) return;
  try {
    const refundRes = await pool.query(
      'UPDATE customers SET credits_balance = credits_balance + $1 WHERE id = $2 RETURNING credits_balance',
      [amount, billingId]
    );
    const newBalance = refundRes.rows[0]?.credits_balance ?? 0;
    await pool.query(
      `INSERT INTO credit_transactions (customer_id, post_id, transaction_type, amount, balance_after, description)
       VALUES ($1, $2, 'refund', $3, $4, 'Video generation failed - credits refunded')`,
      [billingId, postId, amount, newBalance]
    );
    console.log(`[Wizard] Refunded ${amount} credit(s) to customer ${billingId} for failed video post ${postId}`);
  } catch (refundErr) {
    console.error('[Wizard] Credit refund failed (manual review needed):', refundErr.message);
  }
}

// Purge expired sessions from memory every hour; DB cleanup via startup cron
setInterval(() => {
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, session] of wizardSessions.entries()) {
    if ((session.createdAt || 0) < twoHoursAgo) wizardSessions.delete(id);
  }
}, 60 * 60 * 1000);

// ─────────────────────────────────────────────────────────────
// Wizard Step Definitions
// ─────────────────────────────────────────────────────────────

function getWizardSteps(industry, contentType) {
  const currentMonth = new Date().getMonth() + 1;
  const monthNames = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const currentMonthName = monthNames[currentMonth];

  const knowledge = industryKnowledge[industry] || {};
  const seasonal = knowledge.seasonalContent?.[currentMonth] || {};

  const step1 = {
    id: 'content_type_selection',
    title: 'What type of content?',
    subtitle: 'Choose the format that works best for your post',
    type: 'cards',
    options: [
      { value: 'static',   label: 'Text Post',  emoji: '📄', description: 'Text-only post, no image', cost: 1 },
      { value: 'photo',    label: 'Photo Post', emoji: '📸', description: 'AI-generated image with caption', cost: 3 },
      { value: 'carousel', label: 'Carousel',   emoji: '🖼️', description: 'Multiple images in one post', cost: 5 },
      { value: 'video',    label: 'Video',      emoji: '🎥', description: 'AI-generated video with voiceover', cost: 10 },
    ],
  };

  const step2 = {
    id: 'content_type',
    title: "What's happening today?",
    subtitle: 'Pick what best describes what you want to post about',
    type: 'cards',
    options: [
      { value: 'custom',            label: 'My own idea',              emoji: '✏️', description: 'You know what to post — tell ItsPosting AI' },
      { value: 'just_finished_job', label: 'Just finished a job',      emoji: '🔨', description: 'Show off your latest work' },
      { value: 'share_tip',         label: 'Share a tip',              emoji: '💡', description: 'Educate and build trust' },
      { value: 'got_review',        label: 'Got a great review',       emoji: '⭐', description: 'Share the love from a customer' },
      { value: 'running_promo',     label: 'Running a promotion',      emoji: '📅', description: 'Announce a special offer' },
      {
        value: 'seasonal',
        label: `${currentMonthName} seasonal post`,
        emoji: '🌤️',
        description: seasonal.urgencyTopic || 'Timely, seasonal content for this month',
      },
      { value: 'faq',           label: 'Answer a question',        emoji: '❓', description: 'FAQ or myth-busting post — builds trust and authority' },
      { value: 'community',     label: 'Community or local event', emoji: '🏘️', description: 'Connect with your local area' },
      { value: 'team_spotlight', label: 'Team spotlight',          emoji: '🎉', description: 'Introduce your team or celebrate a milestone' },
    ],
  };

  const step3 = {
    id: 'tone',
    title: "What's the vibe?",
    subtitle: 'How do you want this post to feel?',
    type: 'cards',
    options: [
      { value: 'friendly', label: 'Friendly & casual', emoji: '😊', description: 'Warm, approachable, conversational' },
      { value: 'professional', label: 'Professional & trustworthy', emoji: '💼', description: 'Polished, expert, credible' },
      { value: 'funny', label: 'Funny & relatable', emoji: '😄', description: 'Lighthearted, humorous, human' },
      { value: 'educational', label: 'Educational & expert', emoji: '📚', description: 'Informative, detailed, authority-building' },
      { value: 'urgent', label: 'Urgent & must-act-now', emoji: '🔥', description: 'Time-sensitive, action-driving' },
    ],
  };

  const step4Options = {
    just_finished_job: {
      id: 'details',
      title: 'Tell us about the job',
      subtitle: 'Any details help ItsPosting AI write a more specific post (all optional)',
      type: 'form',
      fields: [
        { id: 'job_description', label: 'What did you do?', placeholder: 'e.g. Replaced a water heater, installed new HVAC system, stamped concrete driveway...', type: 'textarea', required: false },
        { id: 'neighborhood', label: 'Neighborhood or area (optional)', placeholder: 'e.g. Downtown, Riverside, North Side...', type: 'text', required: false },
        { id: 'customer_reaction', label: 'How did the customer react? (optional)', placeholder: 'e.g. They were thrilled, said it looked amazing...', type: 'text', required: false },
        { id: 'include_cta', label: 'Include a call-to-action?', type: 'toggle', default: true },
      ],
    },
    share_tip: {
      id: 'details',
      title: 'What tip do you want to share?',
      subtitle: 'ItsPosting AI will turn this into an engaging educational post',
      type: 'form',
      fields: [
        { id: 'tip_topic', label: 'Topic or tip idea', placeholder: knowledge.seasonalContent?.[currentMonth]?.tipTopic || 'e.g. How to check if your water heater needs replacing...', type: 'textarea', required: false },
        { id: 'tip_audience', label: 'Who is this tip for? (optional)', placeholder: 'e.g. Homeowners with older homes, families with kids...', type: 'text', required: false },
      ],
    },
    got_review: {
      id: 'details',
      title: 'Share the review',
      subtitle: 'Paste the review and ItsPosting AI will craft the perfect social post around it',
      type: 'form',
      fields: [
        { id: 'review_text', label: 'The review (paste it here)', placeholder: 'e.g. "They showed up on time, fixed the issue in an hour, and the price was very fair. Would definitely call again!"', type: 'textarea', required: false },
        { id: 'customer_name', label: 'Customer first name (optional)', placeholder: 'e.g. Sarah, Mike, The Johnson family...', type: 'text', required: false },
        { id: 'job_type', label: 'What was the job? (optional)', placeholder: 'e.g. Pipe repair, AC installation...', type: 'text', required: false },
      ],
    },
    running_promo: {
      id: 'details',
      title: 'Tell us about your offer',
      subtitle: 'ItsPosting AI will write a compelling promotion post',
      type: 'form',
      fields: [
        { id: 'promo_offer', label: 'What is the offer?', placeholder: 'e.g. 10% off all drain cleaning, Free inspection with any repair, Buy one get one...', type: 'textarea', required: false },
        { id: 'promo_deadline', label: 'Does the offer expire? (optional)', placeholder: 'e.g. This week only, Ends Friday, Limited to first 10 customers...', type: 'text', required: false },
        { id: 'promo_reason', label: 'Why are you running this promotion? (optional)', placeholder: 'e.g. Spring special, Slow season deal, Customer appreciation...', type: 'text', required: false },
      ],
    },
    seasonal: {
      id: 'details',
      title: `Your ${currentMonthName} seasonal post`,
      subtitle: seasonal.urgencyTopic ? `ItsPosting AI knows it's the time for: ${seasonal.urgencyTopic}` : 'ItsPosting AI will write timely, seasonal content',
      type: 'form',
      fields: [
        { id: 'seasonal_angle', label: 'Any specific angle? (optional)', placeholder: seasonal.promotionAngle || 'Leave blank and ItsPosting AI will choose the most relevant seasonal topic', type: 'textarea', required: false },
        { id: 'include_offer', label: 'Include a seasonal offer?', type: 'toggle', default: false },
        { id: 'seasonal_offer', label: 'What is the offer? (optional)', placeholder: seasonal.promotionAngle || 'e.g. 15% off winterization checks this month...', type: 'text', required: false, showIf: 'include_offer' },
      ],
    },
    community: {
      id: 'details',
      title: 'Tell us about the community moment',
      subtitle: 'Local connection posts build trust and loyalty',
      type: 'form',
      fields: [
        { id: 'community_event', label: 'What is happening?', placeholder: 'e.g. Sponsoring the local little league, Donating to the food bank, Local festival this weekend...', type: 'textarea', required: false },
        { id: 'why_it_matters', label: 'Why does it matter to you? (optional)', placeholder: 'e.g. We have been in this community for 20 years and believe in giving back...', type: 'text', required: false },
      ],
    },
    custom: {
      id: 'details',
      title: 'Tell ItsPosting AI your idea',
      subtitle: 'Describe what you want to post about — the more detail you give, the better the result',
      type: 'form',
      fields: [
        { id: 'custom_topic', label: "What's on your mind?", placeholder: "e.g. 'I want to post about why we switched to eco-friendly products' or 'Remind people we now cover the Westside area' — anything goes.", type: 'textarea', required: false },
      ],
    },
    faq: {
      id: 'details',
      title: 'What question do you want to answer?',
      subtitle: 'FAQ posts are great for building authority and answering customer concerns',
      type: 'form',
      fields: [
        { id: 'question', label: 'The question customers ask', placeholder: 'e.g. How often should I have my HVAC serviced? How much does a new roof cost? Why is my water bill so high?', type: 'textarea', required: false },
        { id: 'myth', label: 'Or a common myth to bust (optional)', placeholder: 'e.g. Myth: You only need to service your AC when it breaks...', type: 'text', required: false },
      ],
    },
    team_spotlight: {
      id: 'details',
      title: 'Who or what are we spotlighting?',
      subtitle: 'Human posts get 3x more engagement than product posts',
      type: 'form',
      fields: [
        { id: 'spotlight_subject', label: 'Who or what is the spotlight about?', placeholder: 'e.g. Our lead technician Mike who just hit his 5-year anniversary, The whole crew after a big project, A company milestone...', type: 'textarea', required: false },
        { id: 'fun_fact', label: 'A fun fact or detail (optional)', placeholder: 'e.g. Mike has personally installed over 200 water heaters, Started as a helper and worked his way up...', type: 'text', required: false },
      ],
    },
  };

  const step4 = {
    id: 'platform',
    title: 'Where are we posting?',
    subtitle: 'ItsPosting AI will write differently for each platform',
    type: 'platform_selector',
    options: [
      { value: 'facebook', label: 'Facebook', emoji: '📘', description: 'Conversational, longer, great for local reach' },
      { value: 'instagram', label: 'Instagram', emoji: '📸', description: 'Visual-first, hashtag-rich, younger audience' },
      { value: 'google_business', label: 'Google Business', emoji: '🏢', description: 'Keyword-rich, boosts local search ranking' },
      { value: 'all', label: 'All three platforms', emoji: '🌍', description: 'Auto-adapted for each platform' },
    ],
    multiSelect: false,
  };

  return [
    step1,
    step2,
    step3,
    step4Options[contentType] || step4Options['just_finished_job'],
    step4,
  ];
}

// ─────────────────────────────────────────────────────────────
// Helper: Content type rules for prompt building
// ─────────────────────────────────────────────────────────────

function getContentTypeRules(contentType) {
  const rules = {
    before_after: `
- Start by describing the BEFORE state (the problem/situation)
- Then describe the TRANSFORMATION (what was done)
- End with the AFTER state (the result/outcome)
- Use vivid, descriptive language that paints a picture
- Make the customer the hero, not the business`,

    educational_tip: `
- Start with a hook that highlights a common mistake or surprising fact
- Share the tip clearly and practically (numbered steps work well)
- Explain WHY this matters to the homeowner
- End with a soft, helpful CTA (not salesy)
- Position the business as the helpful expert`,

    customer_testimonial: `
- Lead with the outcome/result (what the customer experienced)
- Briefly describe the situation/challenge
- Include specific details that make it feel real and authentic
- End with a social proof element
- Never feel like an ad — feel like a genuine share`,

    promotional: `
- Lead with the VALUE, not the discount
- Be clear about what the offer is
- Create appropriate urgency without being pushy
- Include all relevant details (deadline, restrictions)
- End with a clear, easy CTA`,

    seasonal: `
- Open with the seasonal relevance — why this matters RIGHT NOW
- Explain the risk of not acting (for urgency)
- Offer the solution clearly
- Connect to local/seasonal context
- Drive toward booking or inquiry`,

    community_involvement: `
- Lead with the community connection (not the business)
- Share WHY this matters personally
- Make it feel authentic and genuine
- Light or no promotional element — this is about connection
- Invite community engagement`,

    faq_busting: `
- State the question or myth clearly at the start
- Answer it directly and confidently
- Add expert context that builds authority
- Keep it conversational and accessible
- End by inviting more questions`,

    team_spotlight: `
- Make the person/team the star — not the business
- Share specific, human details
- Show pride and genuine appreciation
- Connect to the business values organically
- Invite audience to connect or share`,
  };

  return rules[contentType] || rules.educational_tip;
}

// ─────────────────────────────────────────────────────────────
// Wizard generation now uses SystemPromptBuilder (unified with ClaudeService)














// ─────────────────────────────────────────────────────────────
// Module export — receives pool from server.js
// ─────────────────────────────────────────────────────────────

module.exports = (pool) => {
  const router = express.Router();

  // DesignAdvisor — shared instance for all wizard routes (reads DB-driven monthly params)
  const designAdvisor = DesignAdvisorService ? new DesignAdvisorService(pool) : null;

  // GET /api/wizard/steps/:industry/:contentType
  router.get('/steps/:industry/:contentType', authenticate, async (req, res) => {
    try {
      const { industry, contentType } = req.params;
      const steps = getWizardSteps(industry, contentType);
      res.set('Cache-Control', 'private, max-age=3600, stale-while-revalidate=86400');
      res.json({ steps, totalSteps: steps.length });
    } catch (err) {
      console.error('[Wizard] Error getting steps:', err);
      res.status(500).json({ error: 'Failed to get wizard steps' });
    }
  });

  // POST /api/wizard/start
  router.post('/start', authenticate, async (req, res) => {
    try {
      const customerId = req.customerId;

      const customerResult = await pool.query(
        `SELECT id, business_name, industry, location, phone, tone, visual_style,
                timezone, credits_balance, plan, status,
                brand_colors, logo_url, website_services, website_about, website_testimonials,
                past_post_examples, content_preferences
         FROM customers WHERE id = $1`,
        [customerId]
      );

      if (!customerResult.rows[0]) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      const customer = customerResult.rows[0];

      // Optional brand/scrape columns — added by migration, may not exist yet
      try {
        const extResult = await pool.query(
          `SELECT website, website_services, website_about, website_testimonials FROM customers WHERE id = $1`,
          [customerId]
        );
        if (extResult.rows[0]) Object.assign(customer, extResult.rows[0]);
      } catch (extErr) {
        // Columns don't exist yet — safe to continue without them
      }

      const wizardId = uuidv4();
      const industry = customer.industry || 'general_contractor';
      const steps = getWizardSteps(industry, 'just_finished_job');

      const session = {
        wizardId,
        customerId,
        customer,
        currentStep: 0,
        answers: {},
        steps,
        createdAt: Date.now(),
      };

      await saveSession(wizardId, session);

      res.json({
        wizardId,
        currentStep: 0,
        totalSteps: steps.length,
        stepData: steps[0],
        customer: {
          businessName: customer.business_name,
          industry: customer.industry,
          location: customer.location,
        },
      });
    } catch (err) {
      console.error('[Wizard] Error starting wizard:', err);
      res.status(500).json({ error: 'Failed to start wizard' });
    }
  });

  // POST /api/wizard/step
  router.post('/step', authenticate, async (req, res) => {
    try {
      const { wizardId, stepId, answers } = req.body;

      if (!wizardId) {
        return res.status(404).json({ error: 'Wizard session not found or expired. Please start again.' });
      }
      const session = await getSession(wizardId);
      if (!session) {
        return res.status(404).json({ error: 'Wizard session not found or expired. Please start again.' });
      }

      if (session.customerId !== req.customerId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // video_type and selected_format are frontend-only meta steps — store but don't advance step counter
      if (stepId === 'video_type' || stepId === 'selected_format') {
        session.answers[stepId] = answers;
        await saveSession(wizardId, session);
        return res.json({
          currentStep: session.currentStep,
          totalSteps: session.steps.length,
          stepData: session.steps[session.currentStep] || null,
          answersCollected: Object.keys(session.answers),
        });
      }

      session.answers[stepId] = answers;

      if (stepId === 'content_type' && answers.value) {
        const newSteps = getWizardSteps(session.customer.industry || 'general_contractor', answers.value);
        session.steps = newSteps;
      }

      session.currentStep += 1;

      if (session.currentStep >= session.steps.length) {
        await saveSession(wizardId, session);
        return res.json({
          complete: true,
          wizardId,
          message: 'All steps complete. Call /api/wizard/generate to generate posts.',
        });
      }

      await saveSession(wizardId, session);
      res.json({
        currentStep: session.currentStep,
        totalSteps: session.steps.length,
        stepData: session.steps[session.currentStep],
        answersCollected: Object.keys(session.answers),
      });
    } catch (err) {
      console.error('[Wizard] Error processing step:', err);
      res.status(500).json({ error: 'Failed to process step' });
    }
  });

  // POST /api/wizard/generate
  router.post('/generate', authenticate, requireActiveAccount(pool), async (req, res) => {
    // Carousel: 4 slides × image gen + 3 card designs + Cloudinary uploads can take 2-3 min
    req.setTimeout(280000); // 280s — just under Railway's 5-min proxy limit
    res.setTimeout(280000);
    let debugStage = 'start';
    try {
      const { wizardId } = req.body;

      if (!wizardId) {
        return res.status(404).json({ error: 'Wizard session not found or expired. Please start again.' });
      }
      debugStage = 'session';
      const session = await getSession(wizardId);
      if (!session) {
        return res.status(404).json({ error: 'Wizard session not found or expired. Please start again.' });
      }

      if (session.customerId !== req.customerId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const contentTypeSelectionAnswer = session.answers['content_type_selection'];
      const contentTypeAnswer = session.answers['content_type'];
      const toneAnswer = session.answers['tone'];
      const detailsAnswer = session.answers['details'];
      const platformAnswer = session.answers['platform'];

      const formatAnswer = session.answers['selected_format'];
      const videoTypeAnswer = session.answers['video_type'];
      const answers = {
        contentTypeSelection: contentTypeSelectionAnswer?.value || 'photo',
        contentType: contentTypeAnswer?.value || 'just_finished_job',
        tone: toneAnswer?.value || 'professional',
        details: detailsAnswer || {},
        platform: platformAnswer?.value || 'facebook',
        selectedFormat: formatAnswer?.value || null,
        videoType: videoTypeAnswer?.value || 'services',
      };

      // Resolve format config from selectedFormat.id (set by frontend FORMAT_DATA)
      const fmtId = answers.selectedFormat?.id || null;
      const fmtConfig = (fmtId && FORMAT_CONFIG[fmtId]) || {};
      const formatAspectRatio = fmtConfig.aspectRatio || null;

      // Format is the source of truth for platform (caption rules) and media type.
      // effectivePlatform drives SystemPromptBuilder — Instagram copy for Reels, FB copy for landscape, etc.
      const effectivePlatform = fmtConfig.platform || answers.platform;
      // If the selected format is a video format, force video generation even for 'photo' content type.
      const isVideoPost = answers.contentTypeSelection === 'video' || fmtConfig.mediaType === 'video';
      if (isVideoPost && answers.contentTypeSelection !== 'video') {
        console.log(`[Wizard] Format ${fmtId} is a video format — upgrading content type to video`);
      }

      // Map wizard content types to SystemPromptBuilder triggers
      const triggerMap = {
        custom:            'custom',
        just_finished_job: 'finished_job',
        share_tip:         'share_tip',
        got_review:        'got_review',
        running_promo:     'promotion',
        seasonal:          'seasonal',
        community:         'community',
        faq:               'faq',
        team_spotlight:    'team_spotlight',
        behind_scenes:     'behind_scenes',
      };

      let businessKnowledge = [];
      try {
        const bkResult = await pool.query(
          `SELECT knowledge_type, title, content FROM business_knowledge WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 10`,
          [session.customerId]
        );
        businessKnowledge = bkResult.rows;
      } catch (e) {
        // table may not exist yet — safe to ignore
      }

      // ── Credit check — fail before any expensive API calls ──────────────────
      const CREDIT_COSTS = { static: 1, photo: 3, branded_card: 3, carousel: 5, video: 10 };
      // If the format selection forces video (e.g. Reel), charge video credits regardless of content type
      const effectiveContentType = isVideoPost ? 'video' : answers.contentTypeSelection;
      const creditCost = CREDIT_COSTS[effectiveContentType] ?? 1;

      debugStage = 'credit_check';
      const billingId = getBillingCustomerId(req);
      const creditRow = await pool.query(
        `SELECT credits_balance, plan, status FROM customers WHERE id = $1`,
        [billingId]
      );
      const freshCustomer = creditRow.rows[0];
      if (!freshCustomer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      if (freshCustomer.status === 'suspended') {
        return res.status(403).json({ error: 'Your account is suspended. Please contact support.' });
      }
      if (freshCustomer.credits_balance < creditCost) {
        return res.status(402).json({
          error: `Not enough credits. This ${answers.contentTypeSelection} post costs ${creditCost} credit${creditCost !== 1 ? 's' : ''} but you only have ${freshCustomer.credits_balance}. Please upgrade your plan.`,
        });
      }

      // ── Branded Card fast path (bypasses NanoBanana entirely) ───────────────
      if (answers.contentTypeSelection === 'branded_card') {
        if (!BrandedCardService || !ImageResizer) {
          return res.status(503).json({ error: 'Branded card generation is not available on this server.' });
        }

        // Short Claude call — card copy + caption, enriched with industry + seasonal intelligence
        let cardParsed;
        try {
          const bck       = industryKnowledge[session.customer.industry] || industryKnowledge.general_contractor || {};
          const bcMonth   = new Date().getMonth() + 1;
          const bcSeasonal = bck.seasonalContent?.[bcMonth] || {};
          const bcHook    = bck.hookFormulas?.[0] || '';
          const bcAngle   = bck.contentAngles?.find(a => a.engagementLevel === 'very_high') || bck.contentAngles?.[0] || {};
          const bcLoc     = session.customer.location || '';
          const bcCity    = bcLoc.split(',')[0].trim();
          const bcMonthName = ['January','February','March','April','May','June','July','August','September','October','November','December'][bcMonth - 1];

          const cardClaudeResp = await Promise.race([
            anthropic.messages.create({
              model: 'claude-sonnet-4-6',
              max_tokens: 700,
              messages: [{
                role: 'user',
                content: `You are a world-class social media copywriter for LOCAL SERVICE BUSINESSES (trades, home services).
Write card copy for a branded social media post card. The card is visual-first — every word must be punchy, local, and specific.

=== BUSINESS ===
Name: ${session.customer.business_name || 'Local Business'}
Industry: ${session.customer.industry || 'home services'}
Location: ${bcLoc}
Tone: ${answers.tone || 'professional'}
Theme: ${answers.contentType || 'finished_job'}
Details: ${answers.details ? JSON.stringify(answers.details) : 'none'}

=== SEASONAL CONTEXT (${bcMonthName}) ===
${bcSeasonal.urgencyTopic ? `Most urgent right now: ${bcSeasonal.urgencyTopic}` : ''}
${bcSeasonal.promotionAngle ? `Best promo angle: ${bcSeasonal.promotionAngle}` : ''}

=== HIGH-PERFORMING HOOK FOR THIS INDUSTRY ===
${bcHook ? `"${bcHook.replace(/\[city\]/g, bcCity)}"` : ''}
${bcAngle.hook ? `Best-performing angle: "${bcAngle.hook.replace(/\[city\]/g, bcCity)}"` : ''}

=== RULES ===
- Headline: 4-7 words, punchy and specific — NOT generic ("Drain Cleared in 45 Min" beats "Great Plumbing Service")
- Subtext: one sentence, max 15 words, benefit-focused, references ${bcCity || 'local'} homeowners
- CTA: 2-4 words, verb-first ("Book Today", "Call Now", "Free Quote")
- Caption: 120-200 words, starts with a scroll-stopping hook, ends with an engagement question, includes 6-10 relevant hashtags
- NEVER use: "delve", "synergy", "leverage", "utilize", "optimize", "robust", "comprehensive"
- Caption must sound like a real ${session.customer.industry || 'tradesperson'} wrote it — specific and human

Return ONLY valid JSON (no markdown, no backticks):
{
  "headline": "4-7 word specific headline",
  "subtext": "One sentence, max 15 words, benefit-focused",
  "ctaText": "2-4 word CTA",
  "caption": "Full social caption ending with a specific engagement question",
  "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}`,
              }],
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 30000)),
          ]);

          let rawText = '';
          if (Array.isArray(cardClaudeResp.content)) {
            rawText = cardClaudeResp.content.map(b => b.text || '').join('');
          } else if (typeof cardClaudeResp.content === 'string') {
            rawText = cardClaudeResp.content;
          }
          const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const first = cleaned.indexOf('{');
          const last  = cleaned.lastIndexOf('}');
          cardParsed = JSON.parse(cleaned.substring(first, last + 1));
        } catch (cardClaudeErr) {
          console.error('[Wizard/BrandedCard] Claude call failed:', cardClaudeErr.message);
          return res.status(502).json({ error: 'AI generation failed for branded card. Please try again.' });
        }

        const { headline = '', subtext = '', ctaText = '', caption = '', hashtags = [] } = cardParsed;

        // Generate 3 card layouts in parallel
        let bufferA, bufferB, bufferC;
        try {
          const brandedDesignParams = designAdvisor ? await designAdvisor.getActiveParams() : null;
          ({ bufferA, bufferB, bufferC } = await BrandedCardService.generateBrandedCards(
            session.customer, headline, subtext, ctaText, answers.contentType, brandedDesignParams
          ));
        } catch (sharpErr) {
          console.error('[Wizard/BrandedCard] Sharp generation failed:', sharpErr.message);
          return res.status(500).json({ error: 'Card generation failed. Please try again.' });
        }

        // Resize branded card buffers to the selected format's dimensions (if applicable).
        // Cards are generated at 1080×1350; FORMAT_TO_RESIZER_PLATFORM maps format → resizer spec.
        const bcResizerPlatform = fmtId ? FORMAT_TO_RESIZER_PLATFORM[fmtId] : null;
        if (bcResizerPlatform && ImageResizer) {
          try {
            [bufferA, bufferB, bufferC] = await Promise.all([
              ImageResizer.resizeForPlatform(bufferA, bcResizerPlatform).then(r => r.buffer),
              ImageResizer.resizeForPlatform(bufferB, bcResizerPlatform).then(r => r.buffer),
              ImageResizer.resizeForPlatform(bufferC, bcResizerPlatform).then(r => r.buffer),
            ]);
          } catch (resizeErr) {
            console.warn('[Wizard/BrandedCard] Resize to format failed — using original dimensions:', resizeErr.message);
          }
        }

        // Upload all 3 to Cloudinary in parallel
        let urlA, urlB, urlC;
        try {
          const ts = Date.now();
          [urlA, urlB, urlC] = await Promise.all([
            ImageResizer.uploadToCloudinary(bufferA, `itsposting/wizard/branded/${session.customerId}/${ts}-a`),
            ImageResizer.uploadToCloudinary(bufferB, `itsposting/wizard/branded/${session.customerId}/${ts}-b`),
            ImageResizer.uploadToCloudinary(bufferC, `itsposting/wizard/branded/${session.customerId}/${ts}-c`),
          ]);
        } catch (uploadErr) {
          console.error('[Wizard/BrandedCard] Cloudinary upload failed:', uploadErr.message);
          return res.status(500).json({ error: 'Card upload failed. Please try again.' });
        }

        const cardVariations = {
          A: { caption, hashtags, hookType: 'full_overlay',  engagementQuestion: '' },
          B: { caption, hashtags, hookType: 'bold_split',    engagementQuestion: '' },
          C: { caption, hashtags, hookType: 'side_accent',   engagementQuestion: '' },
        };
        const brandedCardUrls = { A: urlA, B: urlB, C: urlC };

        // Save post + variations to DB
        let bcPostId = null;
        try {
          const bcPost = await pool.query(
            `INSERT INTO posts (customer_id, content_type, caption, platform, platforms, status, generation_method, ai_model_used, media_url, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'draft', 'wizard', 'claude-sonnet-4-6', $6, NOW(), NOW())
             RETURNING id`,
            [
              session.customerId,
              'branded_card',
              caption,
              effectivePlatform === 'all' ? 'facebook' : effectivePlatform,
              effectivePlatform === 'all' ? JSON.stringify(['facebook', 'instagram', 'google_business', 'linkedin', 'tiktok']) : JSON.stringify([effectivePlatform]),
              urlA,
            ]
          );
          bcPostId = bcPost.rows[0]?.id;

          if (bcPostId) {
            for (const [label, variation] of Object.entries(cardVariations)) {
              await pool.query(
                `INSERT INTO post_variations (post_id, variation_label, caption, hashtags, image_prompt, created_at)
                 VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT DO NOTHING`,
                [bcPostId, label, variation.caption, JSON.stringify(hashtags), null]
              );
            }
            autoSaveToMediaLibrary(pool, session.customerId, urlA, 'branded_card').catch(() => {});
          }
        } catch (dbErr) {
          console.warn('[Wizard/BrandedCard] DB save failed:', dbErr.message);
        }

        // Deduct credits
        let bcCreditsRemaining = null;
        if (bcPostId) {
          try {
            const deductResult = await pool.query(
              `UPDATE customers SET credits_balance = credits_balance - $1, credits_used_this_month = credits_used_this_month + $1
               WHERE id = $2 AND credits_balance >= $1 RETURNING credits_balance`,
              [creditCost, billingId]
            );
            if (deductResult.rows.length > 0) {
              bcCreditsRemaining = deductResult.rows[0].credits_balance;
              try { await pool.query(`UPDATE posts SET credits_used = $1 WHERE id = $2`, [creditCost, bcPostId]); } catch {}
              try {
                await pool.query(
                  `INSERT INTO credit_transactions (customer_id, post_id, transaction_type, amount, balance_after, description)
                   VALUES ($1, $2, 'debit', $3, $4, $5)`,
                  [billingId, bcPostId, -creditCost, bcCreditsRemaining, 'Generated branded card post via wizard']
                );
              } catch {}
              if (bcCreditsRemaining < 10) {
                const notifier = new NotificationService(pool);
                notifier.lowCredits(billingId, bcCreditsRemaining);
              }
            } else {
              try { await pool.query(`DELETE FROM posts WHERE id = $1`, [bcPostId]); } catch {}
              return res.status(402).json({ error: 'Insufficient credits. Please refresh and try again.' });
            }
          } catch (creditErr) {
            console.error('[Wizard/BrandedCard] Credit deduction failed:', creditErr.message);
          }
        }

        return res.json({
          success: true,
          postId: bcPostId,
          variations: cardVariations,
          hashtags,
          mediaUrl: urlA,
          brandedCardUrls,
          imageFailed: false,
          videoRendering: false,
          creditsUsed: creditCost,
          creditsRemaining: bcCreditsRemaining,
          contentType: answers.contentType,
          contentTypeSelection: 'branded_card',
          platform: answers.platform,
          recommended: 'A',
        });
      }
      // ── End branded card fast path ────────────────────────────────────────────

      debugStage = 'prompt_build';
      const builder = new SystemPromptBuilder(session.customer, {
        platform: effectivePlatform,  // derived from format selection, falls back to platform step
        contentType: answers.contentTypeSelection, // 'static', 'photo', 'carousel', 'video'
        wizardTrigger: triggerMap[answers.contentType] || answers.contentType,
        counterAnswers: answers.details,
        businessKnowledge,
        wizardTone: answers.tone,
      });

      const { systemPrompt, userPrompt } = builder.build();

      console.log(`[Wizard] Generating posts for customer ${session.customerId}, content type: ${answers.contentType}`);

      // For video posts: prefetch HeyGen voice/avatar IDs in parallel with Claude.
      // Only needed for avatar video or when Veo is not enabled (fallback path uses HeyGen).
      // The fetches take ~8s each; Claude takes ~10-15s — so by the time Claude finishes
      // the IDs are already cached and createVideo() returns in <15s instead of ~31s.
      let heyGenPrefetch = null;
      const willUseHeyGen = isVideoPost && (
        answers.videoType === 'avatar' || process.env.VEO_ENABLED !== 'true'
      );
      if (HeyGenService && process.env.HEYGEN_API_KEY && willUseHeyGen) {
        const prefetcher = new HeyGenService();
        heyGenPrefetch = Promise.allSettled([
          prefetcher.getDefaultVoiceId(),
          prefetcher.getDefaultAvatarId(),
        ]);
        console.log('[Wizard] HeyGen voice/avatar prefetch started in parallel with Claude');
      }

      debugStage = 'claude_request';
      let claudeResponse;
      try {
        const claudeTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI response timeout — please try again')), 55000)
        );
        claudeResponse = await Promise.race([
          anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 4000,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          }),
          claudeTimeout,
        ]);
      } catch (claudeErr) {
        console.error('[Wizard] Claude API error:', claudeErr.message || claudeErr);
        return res.status(502).json({ error: `AI generation failed: ${claudeErr.message || 'Unknown error'}` });
      }

      debugStage = 'claude_parse';
      let parsed;
      try {
        let rawText = '';

        if (typeof claudeResponse.content === 'string') {
          rawText = claudeResponse.content;
        } else if (Array.isArray(claudeResponse.content)) {
          rawText = claudeResponse.content
            .map(block => {
              if (typeof block === 'string') return block;
              if (block?.type === 'text' || block?.type === 'output_text' || !block.type) return block.text || block.content || '';
              if (block?.type === 'response') return block.response || '';
              return '';
            })
            .join('');
        } else if (claudeResponse.content?.text) {
          rawText = claudeResponse.content.text;
        } else if (claudeResponse.content?.[0]?.text) {
          rawText = claudeResponse.content[0].text;
        } else if (claudeResponse.output_text) {
          rawText = claudeResponse.output_text;
        } else if (claudeResponse.text) {
          rawText = claudeResponse.text;
        } else if (typeof claudeResponse === 'string') {
          rawText = claudeResponse;
        } else {
          throw new Error('Unexpected Claude response format');
        }

        let cleaned = rawText
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();

        // Find the first { and last } to extract just the JSON object
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1) {
          throw new Error('No JSON object found in response');
        }
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);

        try {
          parsed = JSON.parse(repairJSON(cleaned));
        } catch (jsonErr) {
          // repairJSON handled newlines — if we still fail, try plain parse as last resort
          try {
            parsed = JSON.parse(cleaned);
          } catch (jsonErr2) {
            console.error('[Wizard] JSON parse failed after repair:', jsonErr2.message, '| First 300 chars:', cleaned.substring(0, 300));
            return res.status(502).json({ error: 'AI returned an unexpected format. Please try again.' });
          }
        }
      } catch (parseErr) {
        console.error('[Wizard] Failed to parse Claude response:', parseErr);
        return res.status(502).json({ error: 'Failed to parse AI response. Please try again.' });
      }

      // Transform SystemPromptBuilder format (variation_a) to wizard format (variations.A)
      // Include per-variation hashtags so the frontend can show them on each card
      const transformedVariations = {
        A: {
          caption: parsed.variation_a?.caption || '',
          engagementQuestion: parsed.variation_a?.engagementQuestion || '',
          hookType: parsed.variation_a?.hookFormulaUsed || 'question',
          hashtags: parsed.variation_a?.hashtags || [],
          engagementScore: parsed.variation_a?.engagementScore || null,
        },
        B: {
          caption: parsed.variation_b?.caption || '',
          engagementQuestion: parsed.variation_b?.engagementQuestion || '',
          hookType: parsed.variation_b?.hookFormulaUsed || 'story',
          hashtags: parsed.variation_b?.hashtags || parsed.variation_a?.hashtags || [],
          engagementScore: parsed.variation_b?.engagementScore || null,
        },
        C: {
          caption: parsed.variation_c?.caption || '',
          engagementQuestion: parsed.variation_c?.engagementQuestion || '',
          hookType: parsed.variation_c?.hookFormulaUsed || 'tip',
          hashtags: parsed.variation_c?.hashtags || parsed.variation_a?.hashtags || [],
          engagementScore: parsed.variation_c?.engagementScore || null,
        },
      };

      // Extract additional content based on type
      let slides = null;
      let videoScript = null;

      if (answers.contentTypeSelection === 'carousel') {
        slides = parsed.variation_a?.slides || [];
      } else if (isVideoPost) {
        videoScript = parsed.variation_a?.videoScript || '';
      }

      if (!transformedVariations.A.caption || !transformedVariations.B.caption || !transformedVariations.C.caption) {
        console.error('[Wizard] Invalid response structure from Claude:', parsed);
        return res.status(502).json({ error: 'Invalid AI response structure. Please try again.' });
      }

      // ── QA auto-fix — correct common quality gaps before serving ─────────────
      qaAutoFix(transformedVariations, session.customer);

      // ── Media orchestration (NanoBanana images) ──────────────────────────────
      let mediaUrl = null;
      let mediaVariants = {};
      let imageFailed = false;
      const imagePromptForGen = parsed.imagePrompt || parsed.variation_a?.imagePrompt || '';
      // Skip image gen if video format was selected (video pipeline handles its own key frame)
      const contentTypeForMedia = isVideoPost ? 'video' : answers.contentTypeSelection;

      if (!imagePromptForGen && (contentTypeForMedia === 'photo' || contentTypeForMedia === 'carousel')) {
        console.warn('[Wizard] Claude returned no imagePrompt — skipping image generation. Parsed keys:', Object.keys(parsed));
      }

      if (NanoBananaService && imagePromptForGen && (contentTypeForMedia === 'photo' || contentTypeForMedia === 'carousel')) {
        if (!process.env.GOOGLE_AI_API_KEY) {
          console.error('[Wizard] GOOGLE_AI_API_KEY is not set — image generation will fail');
        }
        const nanoBanana = new NanoBananaService();

        // Determine aspect ratio from selected format, falling back to a content-type default
        const imageAspectRatio = formatAspectRatio || (
          contentTypeForMedia === 'carousel' ? '1:1' : '4:5'
        );

        const attemptImageGen = async (prompt) => {
          const result = await nanoBanana.generateFromPrompt(session.customer, prompt, { aspectRatio: imageAspectRatio });
          await validateMedia(result.url);
          return result;
        };

        try {
          if (contentTypeForMedia === 'carousel') {
            const rawSlideList = parsed.carouselSlides || parsed.variation_a?.slides || [];
            const slideList = rawSlideList.slice(0, 4); // hard cap at 4 slides
            const slideResults = [];
            for (const slide of slideList) {
              const slidePrompt = slide.description || imagePromptForGen;
              const slideStart = Date.now();
              try {
                const slideResult = await nanoBanana.generateFromPrompt(session.customer, slidePrompt, { aspectRatio: '1:1' });
                await validateMedia(slideResult.url);
                slideResults.push({ ...slide, imageUrl: slideResult.url });
                // Log each carousel slide image — fire-and-forget
                const _slideUrl = slideResult.url;
                const _slideMs  = Date.now() - slideStart;
                const _slideModel = slideResult.model || 'gemini-2.5-flash-image';
                setImmediate(async () => {
                  pool.query(
                    `INSERT INTO image_training_data
                       (post_id, customer_id, input_prompt, output_url, provider, industry,
                        content_type, model_used, generation_time_ms, created_at)
                     VALUES (NULL,$1,$2,$3,'nanobanana',$4,'carousel',$5,$6,NOW())`,
                    [session.customerId, slidePrompt, _slideUrl,
                     session.customer.industry, _slideModel, _slideMs]
                  ).catch(e => console.warn('[Wizard] carousel slide training insert failed:', e.message));
                });
              } catch (slideErr) {
                console.warn(`[Wizard] Slide ${slide.slideNumber} image failed:`, slideErr.message);
                slideResults.push({ ...slide, imageUrl: null });
              }
            }
            mediaUrl = slideResults[0]?.imageUrl || null;
            mediaVariants = { slides: slideResults };

            // ── Carousel Card Designs (3 branded templates × N slides) ─────────
            if (PhotoCardService && ImageResizer && slideResults.some(s => s.imageUrl)) {
              try {
                const WIZARD_CARD_TRIGGER = { just_finished_job: 'job_finished', running_promo: 'promotion' };
                const carouselCardTrigger = WIZARD_CARD_TRIGGER[answers.contentType] || answers.contentType || 'job_finished';
                const carouselLineupIndex = PhotoCardService.getDesignFingerprint
                  ? PhotoCardService.getDesignFingerprint(session.customer).lineupOffset % 3
                  : 0;

                // Fetch all raw slide buffers in parallel
                const slideBuffers = await Promise.all(
                  slideResults.map(s =>
                    s.imageUrl ? ImageResizer.fetchImageAsBuffer(s.imageUrl).catch(() => null) : Promise.resolve(null)
                  )
                );

                const carouselCardDesigns = { A: [], B: [], C: [] };
                const ts  = Date.now();
                const cid = session.customerId;

                const totalCarouselSlides = slideResults.length;
                for (let si = 0; si < slideResults.length; si++) {
                  const slide = slideResults[si];
                  const rawBuffer = slideBuffers[si];
                  if (!rawBuffer) {
                    carouselCardDesigns.A.push(slide.imageUrl || null);
                    carouselCardDesigns.B.push(slide.imageUrl || null);
                    carouselCardDesigns.C.push(slide.imageUrl || null);
                    continue;
                  }

                  // Carousel slides get role-specific overlays (like a mini-article):
                  // Cover  (slide 1)  — big headline + subtitle, "Swipe →" badge, no bullets/CTA
                  // Body   (mid)      — step title + bullet points + context, progress badge
                  // CTA    (last)     — closing question + action nudge, CTA button
                  const isFirstSlide = si === 0;
                  const isLastSlide = si === totalCarouselSlides - 1;
                  const slideType = slide.slideType || (isFirstSlide ? 'cover' : isLastSlide ? 'cta' : 'body');

                  const slideBadge = isFirstSlide
                    ? 'Swipe →'    // "Swipe →" drives the swipe action
                    : `${si + 1} of ${totalCarouselSlides}`;

                  // Cover: eye-catching headline + subtitle, no bullets
                  // Body:  step title + 2-3 bullet services + brief context
                  // CTA:   closing question + action nudge + CTA button
                  let slideServices = [];
                  let slideSubtext = '';
                  let slideCta = '';

                  if (slideType === 'cover') {
                    slideSubtext = slide.subtext || '';
                  } else if (slideType === 'body') {
                    slideServices = Array.isArray(slide.bullets) ? slide.bullets : [];
                    slideSubtext = slide.subtext || '';
                  } else {
                    // CTA slide
                    slideSubtext = slide.subtext || '';
                    slideCta = session.customer.phone ? 'Call Today' : 'Book Now';
                  }

                  const slideCardOverlay = {
                    headline: slide.overlayText || '',
                    // Business name only — badge carries the slide context
                    eyebrow: session.customer.business_name || '',
                    services: slideServices,
                    subtext: slideSubtext,
                    cta: slideCta,
                    badge: slideBadge,
                    uppercase: true,
                  };
                  const fixedSlideOverlay = validateAndFixCardOverlay(slideCardOverlay, session.customer);

                  // Use instagram_square (1080×1080) for carousel — native 1:1 aspect ratio
                  const slideCards = await PhotoCardService.generatePhotoCardsForPlatforms(
                    rawBuffer, fixedSlideOverlay, session.customer, carouselCardTrigger,
                    ['instagram_square'], null, carouselLineupIndex
                  );
                  const squareCards = slideCards.instagram_square;
                  if (!squareCards) { carouselCardDesigns.A.push(null); carouselCardDesigns.B.push(null); carouselCardDesigns.C.push(null); continue; }

                  const [urlA, urlB, urlC] = await Promise.all([
                    ImageResizer.uploadToCloudinary(squareCards.A, `itsposting/${cid}/carousel-card-${ts}-s${si + 1}-A`),
                    ImageResizer.uploadToCloudinary(squareCards.B, `itsposting/${cid}/carousel-card-${ts}-s${si + 1}-B`),
                    ImageResizer.uploadToCloudinary(squareCards.C, `itsposting/${cid}/carousel-card-${ts}-s${si + 1}-C`),
                  ]);
                  carouselCardDesigns.A.push(urlA);
                  carouselCardDesigns.B.push(urlB);
                  carouselCardDesigns.C.push(urlC);
                }

                // Save raw slide URLs and metadata BEFORE overwriting with card URLs
                const rawSlideUrls = slideResults.map(s => s.imageUrl || null);
                const slideOverlayTexts = slideResults.map(s => s.overlayText || '');
                // Per-slide metadata for more-designs to reproduce identical badge/CTA treatment
                const slideMetadata = slideResults.map(s => ({
                  type: s.slideType || null,
                  bullets: Array.isArray(s.bullets) ? s.bullets : [],
                  subtext: s.subtext || '',
                }));

                // Update slides to use design-A images as default display
                for (let si = 0; si < slideResults.length; si++) {
                  if (carouselCardDesigns.A[si]) slideResults[si].imageUrl = carouselCardDesigns.A[si];
                }
                mediaVariants.slides = slideResults;
                mediaUrl = carouselCardDesigns.A[0] || mediaUrl;

                const carouselPhotoCardUrls = {
                  A: carouselCardDesigns.A[0] || null,
                  B: carouselCardDesigns.B[0] || null,
                  C: carouselCardDesigns.C[0] || null,
                };
                mediaVariants._photoCardUrls       = carouselPhotoCardUrls;
                mediaVariants._carouselCardDesigns  = carouselCardDesigns;
                mediaVariants._cardLineupIndex      = carouselLineupIndex;
                mediaVariants._cardTrigger          = carouselCardTrigger;
                mediaVariants._rawSlideUrls         = rawSlideUrls;
                mediaVariants._slideOverlayTexts    = slideOverlayTexts;
                mediaVariants._slideMetadata        = slideMetadata;
              } catch (carouselCardErr) {
                console.warn('[Wizard] Carousel card design generation failed (using raw photos):', carouselCardErr.message);
              }
            }
          } else {
            // Photo — try once, retry once on failure
            const imgGenStart = Date.now();
            let imageResult;
            try {
              imageResult = await attemptImageGen(imagePromptForGen);
            } catch (firstErr) {
              console.warn('[Wizard] Image gen attempt 1 failed, retrying:', firstErr.message);
              imageResult = await attemptImageGen(imagePromptForGen);
            }
            const imgGenMs = Date.now() - imgGenStart;
            mediaUrl = imageResult.url;
            const rawPhotoUrl = imageResult.url; // preserve original before potential overwrite by card URLs

            // ── Photo Card overlay (3 branded templates per variation) ──────────
            // Fetch the raw photo buffer, composite branded overlays, upload 3 variants.
            // Each wizard variation (A/B/C) gets a different card template.
            let photoCardUrls = null;
            let cardLineupIndex = null;
            let cardTrigger = null;
            if (PhotoCardService && ImageResizer && parsed.cardOverlay && contentTypeForMedia === 'photo') {
              try {
                const rawBuffer = await ImageResizer.fetchImageAsBuffer(imageResult.url);
                // Normalise wizard content-type names to what PhotoCardService.resolveTemplateSet expects
                const WIZARD_CARD_TRIGGER = { just_finished_job: 'job_finished', running_promo: 'promotion' };
                cardTrigger = WIZARD_CARD_TRIGGER[answers.contentType] || answers.contentType;
                const fixedOverlay = validateAndFixCardOverlay(parsed.cardOverlay, session.customer);
                cardLineupIndex = PhotoCardService.getDesignFingerprint
                  ? PhotoCardService.getDesignFingerprint(session.customer).lineupOffset % 3
                  : 0;

                // Generate platform-native cards — only for the format(s) the customer chose.
                // FORMAT_TO_CARD_PLATFORMS maps format ID → platform list; null means video format (skip card).
                const cardPlatforms = (fmtId && FORMAT_TO_CARD_PLATFORMS[fmtId]) ||
                  ['instagram_feed', 'facebook_feed', 'google_business'];
                const designParams = designAdvisor ? await designAdvisor.getActiveParams() : null;
                const platformCards = await PhotoCardService.generatePhotoCardsForPlatforms(
                  rawBuffer, fixedOverlay, session.customer, cardTrigger,
                  cardPlatforms,
                  designParams
                );

                // Upload all platform variants to Cloudinary in parallel
                const ts  = Date.now();
                const cid = session.customerId;
                const photoCardsByPlatform = {};
                await Promise.all(Object.entries(platformCards).map(async ([platform, variants]) => {
                  const [urlA, urlB, urlC] = await Promise.all([
                    ImageResizer.uploadToCloudinary(variants.A, `itsposting/${cid}/wizard-card-${ts}-${platform}-A`),
                    ImageResizer.uploadToCloudinary(variants.B, `itsposting/${cid}/wizard-card-${ts}-${platform}-B`),
                    ImageResizer.uploadToCloudinary(variants.C, `itsposting/${cid}/wizard-card-${ts}-${platform}-C`),
                  ]);
                  photoCardsByPlatform[platform] = { A: urlA, B: urlB, C: urlC };
                }));

                // Backwards compat: instagram_feed cards drive mediaUrl + existing photoCardUrls
                photoCardUrls = photoCardsByPlatform.instagram_feed || Object.values(photoCardsByPlatform)[0];
                mediaUrl = photoCardUrls.A;
                mediaVariants._photoCardsByPlatform = photoCardsByPlatform;
                console.log('[Wizard] Platform cards generated:', Object.keys(photoCardsByPlatform).join(', '));
              } catch (cardErr) {
                console.warn('[Wizard] PhotoCard overlay failed (using plain photo):', cardErr.message);
              }
            }

            if (ImageResizer && !mediaVariants._photoCardsByPlatform) {
              // Only run ImageResizer resize when we don't already have platform-native cards
              try {
                const variants = await ImageResizer.uploadResizedImages(
                  photoCardUrls ? photoCardUrls.A : imageResult.url,
                  `wizard-${Date.now()}`,
                  session.customerId
                );
                mediaVariants = { ...mediaVariants, ...variants };
                if (!photoCardUrls && variants.instagram_feed) {
                  mediaUrl = variants.instagram_feed;
                }
              } catch (resizerErr) {
                console.warn('[Wizard] ImageResizer failed — using original URL:', resizerErr.message);
              }
            }

            // Generate SVG versions for live browser-side editing (no network calls — uses rawPhotoUrl directly)
            if (PhotoCardService?.generatePhotoCardsSVG && photoCardUrls && rawPhotoUrl && parsed.cardOverlay) {
              try {
                const { svgA, svgB, svgC } = await PhotoCardService.generatePhotoCardsSVG(rawPhotoUrl, parsed.cardOverlay, session.customer, cardTrigger);
                mediaVariants._svgCards = { A: svgA, B: svgB, C: svgC };
              } catch (svgErr) {
                console.warn('[Wizard] SVG card generation failed (non-fatal):', svgErr.message);
              }
            }

            // Store photoCardUrls + raw photo URL on mediaVariants so they reach the response builder
            if (photoCardUrls) mediaVariants._photoCardUrls = photoCardUrls;
            if (rawPhotoUrl) mediaVariants._rawPhotoUrl = rawPhotoUrl;
            if (cardLineupIndex !== null) mediaVariants._cardLineupIndex = cardLineupIndex;
            if (cardTrigger) mediaVariants._cardTrigger = cardTrigger;
            // ── Image training data (fire-and-forget) ──────────────────────────
            const _imgPrompt = imagePromptForGen;
            const _imgUrl = mediaUrl;
            const _imgProvider = imageResult.model?.includes('midjourney') ? 'midjourney' : 'nanobanana';
            const _imgModel = imageResult.model || 'gemini-2.5-flash-image';
            const _imgMs = imgGenMs;
            setImmediate(async () => {
              try {
                await pool.query(
                  `INSERT INTO image_training_data
                     (post_id, customer_id, input_prompt, output_url, provider, industry,
                      content_type, model_used, generation_time_ms, created_at)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
                   ON CONFLICT DO NOTHING`,
                  [null, session.customerId, _imgPrompt, _imgUrl, _imgProvider,
                   session.customer.industry, answers.contentTypeSelection, _imgModel, _imgMs]
                );
              } catch (e) {
                console.warn('[Wizard] image_training_data insert failed:', e.message);
              }
            });
          }
        } catch (imgErr) {
          console.error('[Wizard] Image generation failed after retries:', imgErr.message, imgErr.stack?.split('\n')[1]);
          imageFailed = true;
        }
      }

      let savedPostId = null;
      let savedVariations = null;
      let videoRendering = false;
      debugStage = 'db_insert';

      try {
        const postResult = await pool.query(
          `INSERT INTO posts (customer_id, content_type, caption, platform, platforms, status, generation_method, ai_model_used, media_url, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'draft', 'wizard', 'claude-sonnet-4-6', $6, NOW(), NOW())
           RETURNING id`,
          [
            session.customerId,
            answers.contentTypeSelection,
            transformedVariations.A.caption,
            effectivePlatform === 'all' ? 'facebook' : effectivePlatform,
            effectivePlatform === 'all' ? JSON.stringify(['facebook', 'instagram', 'google_business', 'linkedin', 'tiktok']) : JSON.stringify([effectivePlatform]),
            mediaUrl,
          ]
        );

        savedPostId = postResult.rows[0]?.id;

        if (savedPostId) {
          try {
            const variationHashtags = {
              A: parsed.variation_a?.hashtags || [],
              B: parsed.variation_b?.hashtags || parsed.variation_a?.hashtags || [],
              C: parsed.variation_c?.hashtags || parsed.variation_a?.hashtags || [],
            };
            for (const [label, variation] of Object.entries(transformedVariations)) {
              await pool.query(
                `INSERT INTO post_variations (post_id, variation_label, caption, hashtags, image_prompt, created_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())
                 ON CONFLICT DO NOTHING`,
                [
                  savedPostId,
                  label,
                  variation.caption,
                  JSON.stringify(variationHashtags[label] || []),
                  parsed.variation_a?.imagePrompt || null,
                ]
              );
            }
            savedVariations = true;
          } catch (variationsErr) {
            console.warn('[Wizard] Could not save post_variations (table may not exist yet):', variationsErr.message);
          }

          // Save carousel slides (design A as default — user can switch design before posting)
          if (answers.contentTypeSelection === 'carousel') {
            try {
              const designASlides = mediaVariants._carouselCardDesigns?.A || [];
              if (designASlides.length > 0) {
                for (let si = 0; si < designASlides.length; si++) {
                  const slideUrl = designASlides[si];
                  if (slideUrl) {
                    await pool.query(
                      `INSERT INTO post_carousel_slides (post_id, slide_number, media_url, caption)
                       VALUES ($1, $2, $3, NULL)`,
                      [savedPostId, si + 1, slideUrl]
                    );
                  }
                }
              }
            } catch (slidesErr) {
              console.warn('[Wizard] Could not save post_carousel_slides:', slidesErr.message);
            }
          }

          // Auto-save generated image/video to Media Library (non-blocking)
          if (mediaUrl) {
            const fmt = answers.selectedFormat;
            autoSaveToMediaLibrary(
              pool, session.customerId, mediaUrl,
              answers.contentTypeSelection,
              fmt?.width, fmt?.height
            ).catch(() => {});
          }
        }
      } catch (dbErr) {
        console.warn('[Wizard] Could not save post to database:', dbErr.message);
      }

      // ── Deduct credits atomically after post is saved ────────────────────────
      let creditsRemaining = null;
      if (savedPostId) {
        try {
          const deductResult = await pool.query(
            `UPDATE customers
             SET credits_balance          = credits_balance - $1,
                 credits_used_this_month  = credits_used_this_month + $1
             WHERE id = $2 AND credits_balance >= $1
             RETURNING credits_balance`,
            [creditCost, billingId]
          );
          if (deductResult.rows.length > 0) {
            creditsRemaining = deductResult.rows[0].credits_balance;
            // Also stamp the post with the credit cost
            try {
              await pool.query(`UPDATE posts SET credits_used = $1 WHERE id = $2`, [creditCost, savedPostId]);
            } catch {} // credits_used column may not exist yet — safe to skip
            // Audit log
            try {
              await pool.query(
                `INSERT INTO credit_transactions (customer_id, post_id, transaction_type, amount, balance_after, description)
                 VALUES ($1, $2, 'debit', $3, $4, $5)`,
                [billingId, savedPostId, -creditCost, creditsRemaining, `Generated ${answers.contentTypeSelection} post via wizard`]
              );
            } catch (txErr) {
              console.warn('[Wizard] credit_transactions insert failed:', txErr.message);
            }
            console.log(`[Wizard] Deducted ${creditCost} credit(s) for post ${savedPostId} — balance now ${creditsRemaining}`);
            // Fire low-credits notification when balance drops below 10
            if (creditsRemaining < 10) {
              const notifier = new NotificationService(pool);
              notifier.lowCredits(billingId, creditsRemaining);
            }
          } else {
            // Race condition: credits fell below threshold between check and deduction
            // Delete the post so the user isn't charged without a post
            try { await pool.query(`DELETE FROM posts WHERE id = $1`, [savedPostId]); } catch {}
            return res.status(402).json({ error: 'Insufficient credits. Please refresh and try again.' });
          }
        } catch (creditErr) {
          console.error('[Wizard] Credit deduction failed:', creditErr.message);
          // Don't fail the whole request — post exists, log the error for manual review
        }
      }

      // ── Collect training data (fire-and-forget — never blocks the response) ──
      if (savedPostId) {
        setImmediate(async () => {
          try {
            await pool.query(
              `INSERT INTO post_training_data
                 (post_id, customer_id, input_payload, output_payload, model_used, created_at)
               VALUES ($1, $2, $3, $4, 'claude-sonnet-4-6', NOW())
               ON CONFLICT DO NOTHING`,
              [
                savedPostId,
                session.customerId,
                JSON.stringify({
                  industry:      session.customer.industry,
                  contentType:   answers.contentTypeSelection,
                  tone:          answers.tone,
                  platform:      answers.platform,
                  details:       answers.details || '',
                  businessName:  session.customer.business_name,
                  location:      session.customer.location,
                  month:         new Date().getMonth() + 1,
                  wizardAnswers: answers,
                }),
                JSON.stringify({
                  variation_a: {
                    caption:            transformedVariations.A?.caption || '',
                    engagementQuestion: transformedVariations.A?.engagementQuestion || '',
                    hashtags:           parsed.variation_a?.hashtags || [],
                    imagePrompt:        parsed.variation_a?.imagePrompt || '',
                  },
                  variation_b: {
                    caption:            transformedVariations.B?.caption || '',
                    engagementQuestion: transformedVariations.B?.engagementQuestion || '',
                    hashtags:           parsed.variation_b?.hashtags || [],
                  },
                  variation_c: {
                    caption:            transformedVariations.C?.caption || '',
                    engagementQuestion: transformedVariations.C?.engagementQuestion || '',
                    hashtags:           parsed.variation_c?.hashtags || [],
                  },
                  mediaUrl: mediaUrl || null,
                }),
              ]
            );
            // Backfill post_id into image_training_data row inserted at image-gen time (was null then)
            if (mediaUrl) {
              await pool.query(
                `UPDATE image_training_data SET post_id = $1
                 WHERE id = (
                   SELECT id FROM image_training_data
                   WHERE customer_id = $2 AND output_url = $3 AND post_id IS NULL
                   ORDER BY created_at DESC LIMIT 1
                 )`,
                [savedPostId, session.customerId, mediaUrl]
              ).catch(() => {});
            }
          } catch (tdErr) {
            console.warn('[Wizard] Training data insert failed:', tdErr.message);
          }
        });
      }

      let videoJobId = null;
      let videoError = null;

      // ── Video async kickoff — fire-and-forget so the response is immediate ──
      // VideoService routes to Veo (services video) or HeyGen (avatar video).
      // Either way: mark videoRendering=true, return captions now, generate in background,
      // and let /video-poll/:postId handle completion polling.
      const videoServiceAvailable = VideoService && (process.env.HEYGEN_API_KEY || process.env.VEO_ENABLED === 'true');
      if (videoServiceAvailable && isVideoPost && savedPostId) {
        videoRendering = true; // captions are ready immediately — video is on its way

        const bgPostId = savedPostId;
        const bgCustomer = { ...session.customer };
        const bgScript = parsed.variation_a?.videoScript || transformedVariations.A.caption;
        const bgImagePrompt = parsed.variation_a?.imagePrompt || imagePromptForGen || '';
        const bgVideoType = answers.videoType;
        const bgAspectRatio = formatAspectRatio || '9:16';
        const bgBillingId = billingId;
        const bgCreditCost = creditCost;
        const bgPrefetch = heyGenPrefetch;

        setImmediate(async () => {
          try {
            if (bgPrefetch) await bgPrefetch;

            const videoSvc = new VideoService();
            console.log(`[Wizard BG] Starting video generation for post ${bgPostId} (type: ${bgVideoType})`);

            const videoGenStart = Date.now();
            const videoResult = await videoSvc.generate(bgCustomer, bgScript, {
              videoType: bgVideoType,
              imagePrompt: bgImagePrompt,
              aspectRatio: bgAspectRatio,
              durationSeconds: 7,
            });
            const videoGenMs = Date.now() - videoGenStart;

            if (videoResult?.url) {
              await pool.query(
                `UPDATE posts SET media_url = $1, video_provider = $2, status = 'draft', updated_at = NOW() WHERE id = $3`,
                [videoResult.url, videoResult.provider, bgPostId]
              );
              console.log(`[Wizard BG] Video ready for post ${bgPostId}: ${videoResult.url.substring(0, 60)}`);
              // ── Video training data (fire-and-forget) ──────────────────────
              pool.query(
                `INSERT INTO video_training_data
                   (post_id, customer_id, script, key_frame_prompt, key_frame_url, output_url,
                    provider, video_type, aspect_ratio, duration_seconds, industry,
                    content_type, model_used, generation_time_ms, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
                 ON CONFLICT DO NOTHING`,
                [bgPostId, bgCustomer.id, bgScript, bgImagePrompt || null,
                 videoResult.keyFrameUrl || null, videoResult.url,
                 videoResult.provider || bgVideoType, bgVideoType, bgAspectRatio, 7,
                 bgCustomer.industry, 'video', videoResult.model || videoResult.provider || null,
                 videoGenMs]
              ).catch(e => console.warn('[Wizard BG] video_training_data insert failed:', e.message));
            } else {
              await pool.query(`UPDATE posts SET status = 'video_failed', updated_at = NOW() WHERE id = $1`, [bgPostId]);
              console.error('[Wizard BG] VideoService returned no URL for post', bgPostId);
              // Refund credits
              await _refundCredits(pool, bgBillingId, bgPostId, bgCreditCost);
            }
          } catch (err) {
            console.error(`[Wizard BG] Video generation failed for post ${bgPostId}:`, err.message);
            try {
              await pool.query(`UPDATE posts SET status = 'video_failed', updated_at = NOW() WHERE id = $1`, [bgPostId]);
            } catch {}
            await _refundCredits(pool, bgBillingId, bgPostId, bgCreditCost);
          }
        });
      }

      await deleteSession(wizardId);

      res.json({
        success: true,
        postId: savedPostId,
        variationsSaved: savedVariations,
        variations: transformedVariations,
        hashtags: parsed.variation_a?.hashtags || [],
        imagePrompt: parsed.imagePrompt || parsed.variation_a?.imagePrompt || '',
        mediaUrl,
        mediaVariants,
        photoCardUrls: mediaVariants._photoCardUrls || null,
        photoCardsByPlatform: mediaVariants._photoCardsByPlatform || null,
        rawPhotoUrl: mediaVariants._rawPhotoUrl || null,
        svgCards: mediaVariants._svgCards || null,
        cardLineupIndex: mediaVariants._cardLineupIndex ?? null,
        cardTrigger: mediaVariants._cardTrigger || null,
        carouselCardDesigns: mediaVariants._carouselCardDesigns || null,
        rawSlideUrls: mediaVariants._rawSlideUrls || null,
        slideOverlayTexts: mediaVariants._slideOverlayTexts || null,
        slideMetadata: mediaVariants._slideMetadata || null,
        imageFailed,
        videoRendering,   // true when HeyGen was kicked off — frontend polls /video-poll/:postId
        videoJobId,
        videoError,
        creditsUsed: creditCost,
        creditsRemaining,
        bestTimeToPost: 'morning',
        contentType: answers.contentType,
        contentTypeSelection: answers.contentTypeSelection,
        platform: answers.platform,
        recommended: parsed.cardOverlay?.recommended || 'A',
        cardOverlay: parsed.cardOverlay || null,
        slides,
        videoScript,
        meta: {
          industry: session.customer.industry,
          tone: answers.tone,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error('[Wizard] Error generating posts at stage', debugStage, ':', err.message || err, '\n', err.stack || '');
      if (!res.headersSent) {
        res.status(500).json({ error: `Server error at stage: ${debugStage}. Please try again.` });
      }
    }
  });

  // GET /api/wizard/video-status/:videoId — poll HeyGen job status
  router.get('/video-status/:videoId', authenticate, async (req, res) => {
    try {
      const { videoId } = req.params;
      const customerId = req.customerId;

      // Security: only the post owner can poll their video
      const postCheck = await pool.query(
        `SELECT id FROM posts WHERE customer_id = $1 AND video_job_id = $2`,
        [customerId, videoId]
      );
      if (postCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      if (!HeyGenService) {
        return res.json({ status: 'failed', videoUrl: null });
      }

      const heyGen = new HeyGenService();
      const { status, videoUrl } = await heyGen.checkVideoStatus(videoId);

      if (status === 'completed' && videoUrl) {
        try {
          await validateMedia(videoUrl, 'video');
          await pool.query(
            `UPDATE posts SET media_url = $1 WHERE video_job_id = $2`,
            [videoUrl, videoId]
          );
        } catch (valErr) {
          console.warn('[Wizard] Video validation failed:', valErr.message);
          return res.json({ status: 'failed', videoUrl: null });
        }
      }

      res.json({ status, videoUrl: videoUrl || null });
    } catch (err) {
      console.error('[Wizard] video-status error:', err.message);
      res.status(500).json({ error: 'Failed to check video status' });
    }
  });

  // GET /api/wizard/video-poll/:postId — poll video rendering status by post ID
  // More reliable than video-status/:videoId because we use postId (always available)
  // and look up the HeyGen video_job_id from the post record ourselves.
  router.get('/video-poll/:postId', authenticate, async (req, res) => {
    try {
      const { postId } = req.params;
      const customerId = req.customerId;

      let post;
      try {
        const result = await pool.query(
          `SELECT video_job_id, video_provider, media_url, status, created_at FROM posts WHERE id = $1 AND customer_id = $2`,
          [postId, customerId]
        );
        if (result.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });
        post = result.rows[0];
      } catch (dbErr) {
        // video_job_id column may not exist yet — treat as still processing
        console.warn('[Wizard] video-poll DB error (column may not exist):', dbErr.message);
        return res.json({ status: 'processing' });
      }

      // Already completed — media_url is set once video is saved (works for both Veo and HeyGen)
      if (post.media_url) {
        return res.json({ status: 'completed', videoUrl: post.media_url });
      }

      // Explicit failure
      if (post.status === 'video_failed') {
        return res.json({ status: 'failed', error: 'Video generation failed. Credits have been refunded.' });
      }

      if (post.status === 'insufficient_credits') {
        return res.json({ status: 'failed', error: 'Insufficient credits for video generation.' });
      }

      // If neither HeyGen nor Veo are configured, fail immediately
      const videoServiceAvailableForPoll = (HeyGenService && process.env.HEYGEN_API_KEY) || process.env.VEO_ENABLED === 'true';
      if (!videoServiceAvailableForPoll) {
        return res.json({ status: 'failed', error: 'Video service unavailable.' });
      }

      // For Veo and services-video pipeline: the background job saves media_url directly.
      // If media_url is still null, it's still processing. Give it up to 4 min from creation.
      if (!post.video_job_id) {
        const ageMs = Date.now() - new Date(post.created_at).getTime();
        if (ageMs > 240_000) {
          return res.json({ status: 'failed', error: 'Video generation did not complete in time.' });
        }
        return res.json({ status: 'processing' });
      }

      // Have a HeyGen video_job_id — check its status directly (avatar video path)
      if (!HeyGenService) return res.json({ status: 'processing' });
      const heyGen = new HeyGenService();
      const { status, videoUrl } = await heyGen.checkVideoStatus(post.video_job_id);

      if (status === 'completed' && videoUrl) {
        try {
          await validateMedia(videoUrl, 'video');
          await pool.query(`UPDATE posts SET media_url = $1, video_provider = 'heygen' WHERE id = $2`, [videoUrl, postId]);
        } catch (valErr) {
          console.warn('[Wizard] Video validation failed:', valErr.message);
          return res.json({ status: 'failed', videoUrl: null, error: 'Video validation failed.' });
        }
      }

      return res.json({ status, videoUrl: videoUrl || null });
    } catch (err) {
      console.error('[Wizard] video-poll error:', err.message);
      return res.json({ status: 'processing' }); // don't error — just retry next poll
    }
  });

  // POST /api/wizard/regenerate-image — regenerate image for an existing post (costs 1 credit)
  router.post('/regenerate-image', authenticate, requireActiveAccount(pool), async (req, res) => {
    try {
      const { postId, imagePrompt } = req.body;
      const customerId = req.customerId;
      const billingId = getBillingCustomerId(req);

      if (!postId || !imagePrompt) {
        return res.status(400).json({ error: 'postId and imagePrompt are required' });
      }

      // Verify post ownership
      const postCheck = await pool.query(
        `SELECT id FROM posts WHERE id = $1 AND customer_id = $2`,
        [postId, customerId]
      );
      if (postCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Post not found or not authorized' });
      }

      // Deduct 1 credit atomically from billing account
      const creditResult = await pool.query(
        `UPDATE customers SET credits_balance = credits_balance - 1
         WHERE id = $1 AND credits_balance >= 1
         RETURNING credits_balance`,
        [billingId]
      );
      if (creditResult.rows.length === 0) {
        return res.status(402).json({ error: 'Insufficient credits' });
      }

      if (!NanoBananaService) {
        return res.status(503).json({ error: 'Image generation is not available' });
      }

      const nanoBanana = new NanoBananaService();
      let imageResult;
      try {
        imageResult = await nanoBanana.generateFromPrompt({ id: customerId }, imagePrompt);
        await validateMedia(imageResult.url);
      } catch (genErr) {
        // Refund the credit on failure
        await pool.query(
          `UPDATE customers SET credits_balance = credits_balance + 1 WHERE id = $1`,
          [billingId]
        );
        return res.status(502).json({ error: `Image generation failed: ${genErr.message}` });
      }

      let mediaVariants = {};
      if (ImageResizer) {
        try {
          mediaVariants = await ImageResizer.uploadResizedImages(
            imageResult.url,
            `regen-${postId}-${Date.now()}`,
            customerId
          );
        } catch (resizerErr) {
          console.warn('[Wizard] Regenerate: ImageResizer failed:', resizerErr.message);
        }
      }

      await pool.query(
        `UPDATE posts SET media_url = $1, updated_at = NOW() WHERE id = $2`,
        [imageResult.url, postId]
      );

      res.json({
        success: true,
        mediaUrl: imageResult.url,
        mediaVariants,
        creditsRemaining: creditResult.rows[0].credits_balance,
      });
    } catch (err) {
      console.error('[Wizard] regenerate-image error:', err.message);
      res.status(500).json({ error: 'Image regeneration failed' });
    }
  });

  // POST /api/wizard/quick — mobile quick post mode (photo + text card)
  router.post('/quick', authenticate, requireActiveAccount(pool), async (req, res) => {
    try {
      const { description, platform = 'facebook', tone = 'friendly', contentType = 'photo', wizardTrigger: rawTrigger } = req.body;

      // Normalise quick-post trigger names for PhotoCardService (which uses its own naming)
      const QUICK_PHOTO_TRIGGER_MAP = {
        finished_job:  'job_finished',
        behind_scenes: 'team_spotlight',
      };
      const quickTrigger       = rawTrigger || 'finished_job';
      const photoCardTrigger   = QUICK_PHOTO_TRIGGER_MAP[quickTrigger] || quickTrigger;

      if (!description || description.trim().length < 5) {
        return res.status(400).json({ error: 'Please describe what happened in at least a few words.' });
      }
      if (description.length > 2000) {
        return res.status(400).json({ error: 'Description is too long (max 2000 characters).' });
      }
      if (!['static', 'photo'].includes(contentType)) {
        return res.status(400).json({ error: 'contentType must be static or photo' });
      }

      const creditCost = contentType === 'static' ? 1 : 3;

      const customerResult = await pool.query(
        `SELECT id, business_name, industry, location, phone, tone, visual_style,
                brand_colors, logo_url, website_services, website_about, website_testimonials
         FROM customers WHERE id = $1`,
        [req.customerId]
      );

      if (!customerResult.rows[0]) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      const customer = customerResult.rows[0];

      const billingId = getBillingCustomerId(req);
      const creditRow = await pool.query('SELECT credits_balance FROM customers WHERE id = $1', [billingId]);
      if (!creditRow.rows[0] || creditRow.rows[0].credits_balance < creditCost) {
        return res.status(402).json({
          error: `Not enough credits. Quick ${contentType === 'static' ? 'text card' : 'photo'} posts cost ${creditCost} credit${creditCost > 1 ? 's' : ''}. Please upgrade your plan.`,
        });
      }

      // Build rich prompt — SystemPromptBuilder includes cardOverlay brief when contentType=photo
      const builder = new SystemPromptBuilder(customer, {
        platform,
        contentType,
        wizardTrigger: quickTrigger,
        counterAnswers: { job_description: description.trim() },
      });
      const { systemPrompt, userPrompt } = builder.build();

      const claudeResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: contentType === 'photo' ? 2800 : 1200,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const rawText = claudeResponse.content.filter(b => b.type === 'text').map(b => b.text).join('');
      let parsed;
      try {
        const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        try {
          parsed = JSON.parse(repairJSON(rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()));
        } catch {
          return res.status(500).json({ error: 'Quick post generation failed. Please try again.' });
        }
      }

      // Atomic credit deduction — fail fast if insufficient
      const quickDeduct = await pool.query(
        `UPDATE customers SET credits_balance = credits_balance - $2,
           credits_used_this_month = credits_used_this_month + $2
         WHERE id = $1 AND credits_balance >= $2
         RETURNING credits_balance`,
        [billingId, creditCost]
      );
      if (quickDeduct.rows.length === 0) {
        return res.status(402).json({ error: `Not enough credits. Quick ${contentType === 'static' ? 'text card' : 'photo'} posts cost ${creditCost} credit${creditCost > 1 ? 's' : ''}. Please upgrade your plan.` });
      }

      // Build all 3 variations (B and C fall back to A if Claude only returned one)
      const variations = {
        a: {
          caption:           parsed.variation_a?.caption || '',
          hashtags:          parsed.variation_a?.hashtags || [],
          engagementQuestion:parsed.variation_a?.engagementQuestion || '',
          imagePrompt:       parsed.variation_a?.imagePrompt || parsed.imagePrompt || '',
          engagementScore:   parsed.variation_a?.engagementScore || null,
        },
        b: {
          caption:           parsed.variation_b?.caption || parsed.variation_a?.caption || '',
          hashtags:          parsed.variation_b?.hashtags || parsed.variation_a?.hashtags || [],
          engagementQuestion:parsed.variation_b?.engagementQuestion || parsed.variation_a?.engagementQuestion || '',
          imagePrompt:       parsed.variation_b?.imagePrompt || parsed.imagePrompt || '',
          engagementScore:   parsed.variation_b?.engagementScore || null,
        },
        c: {
          caption:           parsed.variation_c?.caption || parsed.variation_a?.caption || '',
          hashtags:          parsed.variation_c?.hashtags || parsed.variation_a?.hashtags || [],
          engagementQuestion:parsed.variation_c?.engagementQuestion || parsed.variation_a?.engagementQuestion || '',
          imagePrompt:       parsed.variation_c?.imagePrompt || parsed.imagePrompt || '',
          engagementScore:   parsed.variation_c?.engagementScore || null,
        },
      };

      // ── QA auto-fix — correct common quality gaps before serving ─────────────
      qaAutoFix(variations, customer);

      // ── Image generation (photo posts only) ───────────────────────────────
      let mediaUrl    = null;
      let rawPhotoUrl = null;
      let photoCardUrls = null;
      let imageFailed = false;
      let quickCardLineupIndex = null;

      if (contentType === 'photo' && NanoBananaService) {
        try {
          const nanoBanana = new NanoBananaService();
          const imagePrompt = parsed.imagePrompt || variations.a.imagePrompt || description;
          const imageResult = await nanoBanana.generateFromPrompt(customer, imagePrompt, { aspectRatio: '4:5' });
          await validateMedia(imageResult.url);
          mediaUrl = imageResult.url;
          rawPhotoUrl = imageResult.url;

          if (PhotoCardService?.getDesignFingerprint) {
            const fp = PhotoCardService.getDesignFingerprint(customer);
            quickCardLineupIndex = fp.lineupOffset % 3;
          }

          // Photo card overlays — platform-native generation
          if (PhotoCardService && ImageResizer && parsed.cardOverlay) {
            try {
              validateAndFixCardOverlay(parsed.cardOverlay, customer);
              const rawBuffer = await ImageResizer.fetchImageAsBuffer(imageResult.url);
              const designParams = designAdvisor ? await designAdvisor.getActiveParams() : null;
              const platformCards = await PhotoCardService.generatePhotoCardsForPlatforms(
                rawBuffer, parsed.cardOverlay, customer, photoCardTrigger,
                ['instagram_feed', 'facebook_feed', 'google_business'],
                designParams
              );
              const ts  = Date.now();
              const cid = req.customerId;
              const photoCardsByPlatform = {};
              await Promise.all(Object.entries(platformCards).map(async ([platform, variants]) => {
                const [urlA, urlB, urlC] = await Promise.all([
                  ImageResizer.uploadToCloudinary(variants.A, `itsposting/${cid}/quick-card-${ts}-${platform}-A`),
                  ImageResizer.uploadToCloudinary(variants.B, `itsposting/${cid}/quick-card-${ts}-${platform}-B`),
                  ImageResizer.uploadToCloudinary(variants.C, `itsposting/${cid}/quick-card-${ts}-${platform}-C`),
                ]);
                photoCardsByPlatform[platform] = { A: urlA, B: urlB, C: urlC };
              }));
              photoCardUrls = photoCardsByPlatform.instagram_feed || Object.values(photoCardsByPlatform)[0];
              mediaUrl = photoCardUrls.A;
              // Attach platform map so the response can include it
              parsed._photoCardsByPlatform = photoCardsByPlatform;
              console.log('[Wizard/quick] Platform cards generated:', Object.keys(photoCardsByPlatform).join(', '));
            } catch (cardErr) {
              console.warn('[Wizard/quick] PhotoCard failed — using plain photo:', cardErr.message);
              if (ImageResizer) {
                try {
                  const variants = await ImageResizer.uploadResizedImages(
                    imageResult.url, `quick-${Date.now()}`, req.customerId
                  );
                  if (variants.instagram_feed) mediaUrl = variants.instagram_feed;
                } catch {}
              }
            }
          } else if (ImageResizer) {
            // No card overlay — ensure 1080×1350 via ImageResizer
            try {
              const variants = await ImageResizer.uploadResizedImages(
                imageResult.url, `quick-${Date.now()}`, req.customerId
              );
              if (variants.instagram_feed) mediaUrl = variants.instagram_feed;
            } catch {}
          }
        } catch (imgErr) {
          console.warn('[Wizard/quick] Image generation failed:', imgErr.message);
          imageFailed = true;
        }
      }

      // ── Save post record so Post Now works ────────────────────────────────
      let savedPostId = null;
      try {
        const postInsert = await pool.query(
          `INSERT INTO posts
             (customer_id, caption, hashtags, media_url, content_type, platform, platforms,
              status, source, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', 'ai_generated', NOW())
           RETURNING id`,
          [
            req.customerId,
            variations.a.caption,
            JSON.stringify(variations.a.hashtags),
            mediaUrl,
            contentType === 'static' ? 'static' : 'photo',
            platform,
            JSON.stringify([platform]),
          ]
        );
        savedPostId = postInsert.rows[0]?.id;
      } catch (dbErr) {
        console.warn('[Wizard/quick] DB post save failed (non-fatal):', dbErr.message);
      }

      res.json({
        success: true,
        postId: savedPostId,
        variations,
        mediaUrl,
        photoCardUrls,
        photoCardsByPlatform: parsed._photoCardsByPlatform || null,
        rawPhotoUrl,
        cardOverlay: parsed.cardOverlay || null,
        cardLineupIndex: quickCardLineupIndex,
        cardTrigger: photoCardTrigger,
        imageFailed,
        creditsRemaining: quickDeduct.rows[0].credits_balance,
      });

      // ── Training data (fire-and-forget) ───────────────────────────────────
      setImmediate(async () => {
        try {
          await pool.query(
            `INSERT INTO post_training_data
               (post_id, customer_id, input_payload, output_payload, model_used, created_at)
             VALUES ($1, $2, $3, $4, 'claude-sonnet-4-6', NOW())`,
            [
              savedPostId,
              req.customerId,
              JSON.stringify({
                source: 'quick_post_v2', industry: customer.industry,
                contentType, tone, platform,
                details: description.trim(),
                businessName: customer.business_name,
                location: customer.location,
                month: new Date().getMonth() + 1,
              }),
              JSON.stringify({ variations }),
            ]
          );
        } catch (e) {
          console.warn('[Wizard/quick] Training data insert failed:', e.message);
        }
      });

    } catch (err) {
      console.error('[Wizard] Quick post error:', err);
      res.status(500).json({ error: 'Quick post generation failed. Please try again.' });
    }
  });

  // POST /api/wizard/refresh — refresh a variation with a different angle
  router.post('/refresh', authenticate, requireActiveAccount(pool), async (req, res) => {
    try {
      const { caption, platform, tone, angle } = req.body;

      if (!caption) {
        return res.status(400).json({ error: 'Caption is required' });
      }

      const angleInstructions = {
        shorter: 'Rewrite this post to be 30-40% shorter while keeping all the key information.',
        longer: 'Expand this post with more detail, context, and value — aim for 50% more content.',
        funnier: 'Rewrite this with a touch of humor and personality while keeping it professional.',
        more_local: null, // filled in after customer lookup
        add_question: 'Rewrite this with a stronger, more engaging question at the end to drive comments.',
      };

      // Validate angle against whitelist before doing any DB work
      if (angle && !Object.prototype.hasOwnProperty.call(angleInstructions, angle)) {
        return res.status(400).json({ error: 'Invalid angle value.' });
      }

      // Sanitize caption: clamp length and strip control characters to prevent prompt injection
      const safeCaption = caption.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').substring(0, 2000);

      const customerResult = await pool.query(
        'SELECT business_name, industry, location FROM customers WHERE id = $1',
        [req.customerId]
      );
      const customer = customerResult.rows[0];

      const refreshBillingId = getBillingCustomerId(req);

      // Atomic deduction — deduct BEFORE the Claude call; fail fast if insufficient credits
      const deductResult = await pool.query(
        'UPDATE customers SET credits_balance = credits_balance - 1 WHERE id = $1 AND credits_balance >= 1 RETURNING credits_balance',
        [refreshBillingId]
      );
      if (deductResult.rows.length === 0) {
        return res.status(402).json({
          error: 'Not enough credits. Refreshing a variation costs 1 credit. Please upgrade your plan.',
        });
      }

      // Fill location-dependent instruction now that we have customer data
      angleInstructions.more_local = `Rewrite this with stronger local references — mention ${customer.location || 'the local area'} naturally.`;
      const instruction = angleInstructions[angle] || 'Rewrite this post with a fresh angle.';

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: `You are ItsPosting AI, rewriting social media posts for ${customer.business_name}, a ${customer.industry} business in ${customer.location}. Always sound human and authentic. Respond with ONLY valid JSON: { "caption": "rewritten post text" }`,
        messages: [{
          role: 'user',
          content: `${instruction}\n\nOriginal post:\n${safeCaption}`,
        }],
      });

      const rawText = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      let refreshedCaption = parsed.caption || '';

      // QA: strip banned PostCore words from refreshed caption
      for (const [bad, good] of Object.entries(BANNED_POSTCORE_WORDS)) {
        const re = new RegExp(`\\b${bad}(ing|ed|s|ly)?\\b`, 'gi');
        if (re.test(refreshedCaption)) {
          refreshedCaption = refreshedCaption.replace(re, (match) => good + match.slice(bad.length));
        }
      }

      // ── Training data — refresh is a high-value negative signal ───────────
      // Means: the original caption didn't satisfy the customer.
      // angle = WHY it failed (too long, not local enough, not funny, etc.)
      setImmediate(async () => {
        try {
          await pool.query(
            `INSERT INTO post_training_data
               (post_id, customer_id, input_payload, output_payload, model_used, created_at)
             VALUES (NULL, $1, $2, $3, 'claude-sonnet-4-6', NOW())`,
            [
              req.customerId,
              JSON.stringify({
                source:          'refresh',
                industry:        customer.industry,
                platform:        platform || 'facebook',
                tone:            tone || 'professional',
                originalCaption: safeCaption,
                refreshAngle:    angle || 'generic',
                businessName:    customer.business_name,
                location:        customer.location,
                month:           new Date().getMonth() + 1,
              }),
              JSON.stringify({
                variation_a: { caption: refreshedCaption },
                // Negative signal: original was rejected — quality_score intentionally low
                _rejected_original: safeCaption,
                _refresh_angle:     angle,
              }),
            ]
          );
        } catch (e) {
          console.warn('[Wizard/refresh] Training data insert failed:', e.message);
        }
      });

      res.json({ success: true, caption: refreshedCaption });
    } catch (err) {
      console.error('[Wizard] Refresh error:', err);
      res.status(500).json({ error: 'Refresh failed. Please try again.' });
    }
  });

  // POST /api/wizard/rerender-card — re-render photo card with edited cardOverlay (no AI, no credits)
  router.post('/rerender-card', authenticate, async (req, res) => {
    try {
      const { photoUrl, cardOverlay, wizardTrigger: rerenderTrigger } = req.body;
      if (!photoUrl || !cardOverlay) return res.status(400).json({ error: 'photoUrl and cardOverlay required' });

      const customerResult = await pool.query(
        `SELECT id, business_name, industry, location, phone, brand_colors, logo_url FROM customers WHERE id = $1`,
        [req.customerId]
      );
      const customer = customerResult.rows[0];
      if (!customer) return res.status(404).json({ error: 'Customer not found' });

      if (!PhotoCardService || !ImageResizer) return res.status(503).json({ error: 'Photo card service unavailable' });

      validateAndFixCardOverlay(cardOverlay, customer);
      const rawBuffer = await ImageResizer.fetchImageAsBuffer(photoUrl);

      // Platform-native regeneration
      const designParams = designAdvisor ? await designAdvisor.getActiveParams() : null;
      const platformCards = await PhotoCardService.generatePhotoCardsForPlatforms(
        rawBuffer, cardOverlay, customer, rerenderTrigger || null,
        ['instagram_feed', 'facebook_feed', 'google_business'],
        designParams
      );

      const ts = Date.now();
      const cid = req.customerId;

      // Upload all platform variants
      const photoCardsByPlatform = {};
      await Promise.all(Object.entries(platformCards).map(async ([platform, variants]) => {
        const [urlA, urlB, urlC] = await Promise.all([
          ImageResizer.uploadToCloudinary(variants.A, `itsposting/${cid}/wizard-card-${ts}-${platform}-A`),
          ImageResizer.uploadToCloudinary(variants.B, `itsposting/${cid}/wizard-card-${ts}-${platform}-B`),
          ImageResizer.uploadToCloudinary(variants.C, `itsposting/${cid}/wizard-card-${ts}-${platform}-C`),
        ]);
        photoCardsByPlatform[platform] = { A: urlA, B: urlB, C: urlC };
      }));

      const igCards = photoCardsByPlatform.instagram_feed || Object.values(photoCardsByPlatform)[0];

      // SVG strings for instant browser preview (Instagram only — shown in editor)
      let svgCards = null;
      if (PhotoCardService.generatePhotoCardsSVG) {
        try {
          const { svgA, svgB, svgC } = await PhotoCardService.generatePhotoCardsSVG(photoUrl, cardOverlay, customer, rerenderTrigger || null);
          svgCards = { A: svgA, B: svgB, C: svgC };
        } catch (svgErr) {
          console.warn('[Wizard] rerender-card SVG generation failed (non-fatal):', svgErr.message);
        }
      }

      res.json({ photoCardUrls: igCards, photoCardsByPlatform, svgCards });
    } catch (err) {
      console.error('[Wizard] rerender-card error:', err);
      res.status(500).json({ error: 'Card re-render failed. Please try again.' });
    }
  });

  // POST /api/wizard/more-designs — generate 3 more card designs from an alternate template lineup
  router.post('/more-designs', authenticate, async (req, res) => {
    req.setTimeout(280000);
    res.setTimeout(280000);
    try {
      const { photoUrl, cardOverlay, wizardTrigger, lineupIndex,
              slideUrls, slideOverlayTexts, slideData } = req.body;
      const isCarouselMode = Array.isArray(slideUrls) && slideUrls.length > 0;

      if (!isCarouselMode && (!photoUrl || !cardOverlay)) {
        return res.status(400).json({ error: 'photoUrl, cardOverlay, and lineupIndex are required' });
      }
      if (lineupIndex === undefined || lineupIndex === null) {
        return res.status(400).json({ error: 'lineupIndex is required' });
      }
      const idx = parseInt(lineupIndex, 10);
      if (isNaN(idx) || idx < 0 || idx > 2) {
        return res.status(400).json({ error: 'lineupIndex must be 0, 1, or 2' });
      }

      const customerResult = await pool.query(
        `SELECT id, business_name, city, industry, location, phone, brand_colors, logo_url FROM customers WHERE id = $1`,
        [req.customerId]
      );
      const customer = customerResult.rows[0];
      if (!customer) return res.status(404).json({ error: 'Customer not found' });
      if (!PhotoCardService || !ImageResizer) return res.status(503).json({ error: 'Photo card service unavailable' });

      const ts  = Date.now();
      const cid = req.customerId;

      if (isCarouselMode) {
        // ── Carousel mode: generate 3 designs × N slides ──────────────────────
        const overlayTexts = Array.isArray(slideOverlayTexts) ? slideOverlayTexts : [];
        const metaArr = Array.isArray(slideData) ? slideData : [];
        const totalMoreSlides = slideUrls.length;
        const carouselCardDesigns = { A: [], B: [], C: [] };

        for (let si = 0; si < slideUrls.length; si++) {
          const rawUrl = slideUrls[si];
          if (!rawUrl) {
            carouselCardDesigns.A.push(null);
            carouselCardDesigns.B.push(null);
            carouselCardDesigns.C.push(null);
            continue;
          }
          const rawBuffer = await ImageResizer.fetchImageAsBuffer(rawUrl);

          // Reproduce role-aware slide overlay (same logic as main generate endpoint)
          const meta = metaArr[si] || {};
          const isFirstSlide = si === 0;
          const isLastSlide  = si === totalMoreSlides - 1;
          const slideType = meta.type || (isFirstSlide ? 'cover' : isLastSlide ? 'cta' : 'body');
          const slideBadge = isFirstSlide ? 'Swipe →' : `${si + 1} of ${totalMoreSlides}`;

          let slideServices = [];
          let slideSubtext  = '';
          let slideCta      = '';
          if (slideType === 'cover') {
            slideSubtext = meta.subtext || '';
          } else if (slideType === 'body') {
            slideServices = Array.isArray(meta.bullets) ? meta.bullets : [];
            slideSubtext  = meta.subtext || '';
          } else {
            slideSubtext = meta.subtext || '';
            slideCta     = customer.phone ? 'Call Today' : 'Book Now';
          }

          const slideCardOverlay = {
            headline: overlayTexts[si] || '',
            eyebrow: customer.business_name || '',
            services: slideServices,
            subtext: slideSubtext,
            cta: slideCta,
            badge: slideBadge,
            uppercase: true,
          };
          validateAndFixCardOverlay(slideCardOverlay, customer);

          const slideCards = await PhotoCardService.generatePhotoCardsForPlatforms(
            rawBuffer, slideCardOverlay, customer, wizardTrigger || null,
            ['instagram_square'], null, idx
          );
          const squareCards = slideCards.instagram_square;
          if (!squareCards) { carouselCardDesigns.A.push(null); carouselCardDesigns.B.push(null); carouselCardDesigns.C.push(null); continue; }

          const [urlA, urlB, urlC] = await Promise.all([
            ImageResizer.uploadToCloudinary(squareCards.A, `itsposting/${cid}/carousel-more-${ts}-s${si + 1}-A`),
            ImageResizer.uploadToCloudinary(squareCards.B, `itsposting/${cid}/carousel-more-${ts}-s${si + 1}-B`),
            ImageResizer.uploadToCloudinary(squareCards.C, `itsposting/${cid}/carousel-more-${ts}-s${si + 1}-C`),
          ]);
          carouselCardDesigns.A.push(urlA);
          carouselCardDesigns.B.push(urlB);
          carouselCardDesigns.C.push(urlC);
        }

        return res.json({
          carouselDesigns: carouselCardDesigns,
          cards: {
            A: carouselCardDesigns.A[0] || null,
            B: carouselCardDesigns.B[0] || null,
            C: carouselCardDesigns.C[0] || null,
          },
          lineupIndex: idx,
          hasMore: idx < 2,
        });
      }

      // ── Photo mode (original behaviour) ─────────────────────────────────────
      validateAndFixCardOverlay(cardOverlay, customer);
      const rawBuffer = await ImageResizer.fetchImageAsBuffer(photoUrl);

      const platformCards = await PhotoCardService.generatePhotoCardsForPlatforms(
        rawBuffer, cardOverlay, customer, wizardTrigger || null,
        ['instagram_feed', 'facebook_feed', 'google_business'],
        null,
        idx
      );

      const igCards = platformCards.instagram_feed;
      if (!igCards) return res.status(500).json({ error: 'Card generation produced no output' });

      const fbCards = platformCards.facebook_feed || igCards;
      const gbCards = platformCards.google_business || igCards;

      const [urlA, urlB, urlC, fbA, fbB, fbC, gbA, gbB, gbC] = await Promise.all([
        ImageResizer.uploadToCloudinary(igCards.A, `itsposting/${cid}/wizard-more-${ts}-A`),
        ImageResizer.uploadToCloudinary(igCards.B, `itsposting/${cid}/wizard-more-${ts}-B`),
        ImageResizer.uploadToCloudinary(igCards.C, `itsposting/${cid}/wizard-more-${ts}-C`),
        ImageResizer.uploadToCloudinary(fbCards.A, `itsposting/${cid}/wizard-more-${ts}-fb-A`),
        ImageResizer.uploadToCloudinary(fbCards.B, `itsposting/${cid}/wizard-more-${ts}-fb-B`),
        ImageResizer.uploadToCloudinary(fbCards.C, `itsposting/${cid}/wizard-more-${ts}-fb-C`),
        ImageResizer.uploadToCloudinary(gbCards.A, `itsposting/${cid}/wizard-more-${ts}-gb-A`),
        ImageResizer.uploadToCloudinary(gbCards.B, `itsposting/${cid}/wizard-more-${ts}-gb-B`),
        ImageResizer.uploadToCloudinary(gbCards.C, `itsposting/${cid}/wizard-more-${ts}-gb-C`),
      ]);

      res.json({
        cards: { A: urlA, B: urlB, C: urlC },
        cardsByPlatform: {
          instagram_feed: { A: urlA, B: urlB, C: urlC },
          facebook_feed:  { A: fbA, B: fbB, C: fbC },
          google_business: { A: gbA, B: gbB, C: gbC },
        },
        lineupIndex: idx,
        hasMore: idx < 2,
      });
    } catch (err) {
      console.error('[Wizard] more-designs error:', err);
      res.status(500).json({ error: 'Failed to load more designs. Please try again.' });
    }
  });

  // GET /api/wizard/session/:wizardId — for debugging / recovery
  router.get('/session/:wizardId', authenticate, async (req, res) => {
    try {
      const { wizardId } = req.params;

      const session = await getSession(wizardId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found or expired' });
      }

      if (session.customerId !== req.customerId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      res.json({
        wizardId,
        currentStep: session.currentStep,
        totalSteps: session.steps.length,
        answersCollected: Object.keys(session.answers),
        stepData: session.steps[session.currentStep] || null,
      });
    } catch (err) {
      console.error('[Wizard] Error getting session:', err);
      res.status(500).json({ error: 'Failed to get session' });
    }
  });

  // POST /api/wizard/bulk-generate
  // Generates N text-post captions (one per date) without saving to DB.
  // Credits are only deducted on /bulk-confirm so a cancelled preview costs nothing.
  router.post('/bulk-generate', authenticate, requireActiveAccount(pool), async (req, res) => {
    try {
      const { dates, tone = 'friendly', platform = 'all' } = req.body;

      if (!Array.isArray(dates) || dates.length < 1 || dates.length > 7) {
        return res.status(400).json({ error: 'dates must be an array of 1–7 ISO date strings' });
      }

      const validDates = dates.map(d => {
        const dt = new Date(d);
        return isNaN(dt) ? null : dt.toISOString();
      }).filter(Boolean);

      if (validDates.length === 0) {
        return res.status(400).json({ error: 'No valid dates provided' });
      }

      // Check credits (1 per post — static/text)
      const billingId = getBillingCustomerId(req);
      const creditRow = await pool.query(
        'SELECT credits_balance FROM customers WHERE id = $1',
        [billingId]
      );
      const balance = creditRow.rows[0]?.credits_balance || 0;
      if (balance < validDates.length) {
        return res.status(402).json({
          error: `Not enough credits. ${validDates.length} text posts cost ${validDates.length} credit${validDates.length !== 1 ? 's' : ''} but you only have ${balance}.`,
        });
      }

      // Load customer profile for SystemPromptBuilder
      const customerResult = await pool.query(
        `SELECT id, business_name, industry, location, tone as default_tone,
                timezone, brand_colors, past_post_examples, content_preferences
         FROM customers WHERE id = $1`,
        [req.customerId]
      );
      const customer = customerResult.rows[0];
      if (!customer) return res.status(404).json({ error: 'Customer not found' });

      const knowledgeRes = await pool.query(
        `SELECT knowledge_type, title, content FROM business_knowledge WHERE customer_id = $1 LIMIT 5`,
        [req.customerId]
      ).catch(() => ({ rows: [] }));

      // Content theme rotation: 70/20/10
      const THEMES = ['finished_job', 'share_tip', 'seasonal', 'finished_job', 'share_tip', 'got_review', 'promotion'];
      const themeLabels = {
        finished_job: 'completed job showcase',
        share_tip: 'educational tip',
        seasonal: 'seasonal content',
        got_review: 'customer testimonial',
        promotion: 'promotion/offer',
      };

      const postsToGenerate = validDates.map((date, i) => ({
        date,
        theme: THEMES[i % THEMES.length],
        label: themeLabels[THEMES[i % THEMES.length]] || THEMES[i % THEMES.length],
      }));

      // Single Claude call asking for one post per date
      const builder = new SystemPromptBuilder(customer, {
        platform,
        contentType: 'static',
        wizardTrigger: 'finished_job',
        businessKnowledge: knowledgeRes.rows,
        wizardTone: tone,
      });
      const { systemPrompt } = builder.build();

      const dateList = postsToGenerate.map((p, i) =>
        `Post ${i + 1} — ${new Date(p.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} — Theme: ${p.label}`
      ).join('\n');

      const userPrompt = `Generate exactly ${postsToGenerate.length} separate social media post captions for the dates below. Each must have a DIFFERENT theme and hook. Do NOT repeat the same angle.

${dateList}

Return ONLY a JSON array (no markdown, no explanation):
[
  { "caption": "...", "hashtags": ["tag1","tag2"] },
  ...
]
One entry per post, in the same order as the dates listed.`;

      const claudeTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI response timeout — please try again')), 60000)
      );
      const claudeResponse = await Promise.race([
        anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 3000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        claudeTimeout,
      ]);

      let rawText = claudeResponse.content?.[0]?.text || '';
      rawText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const arrStart = rawText.indexOf('[');
      const arrEnd   = rawText.lastIndexOf(']');
      if (arrStart === -1 || arrEnd === -1) {
        return res.status(502).json({ error: 'AI returned unexpected format. Please try again.' });
      }
      let generated;
      try {
        generated = JSON.parse(rawText.substring(arrStart, arrEnd + 1));
      } catch {
        return res.status(502).json({ error: 'AI returned unexpected format. Please try again.' });
      }

      const preview = postsToGenerate.map((p, i) => ({
        date: p.date,
        theme: p.label,
        caption: generated[i]?.caption || '',
        hashtags: generated[i]?.hashtags || [],
      })).filter(p => p.caption);

      res.json({ preview, platform, tone });
    } catch (err) {
      console.error('[Wizard] bulk-generate error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/wizard/bulk-confirm
  // Saves pre-generated bulk posts to DB and deducts credits.
  router.post('/bulk-confirm', authenticate, requireActiveAccount(pool), async (req, res) => {
    try {
      const { posts: bulkPosts, platform = 'all', tone = 'friendly' } = req.body;

      if (!Array.isArray(bulkPosts) || bulkPosts.length < 1 || bulkPosts.length > 7) {
        return res.status(400).json({ error: 'posts must be an array of 1–7 items' });
      }

      const billingId = getBillingCustomerId(req);
      const creditCost = bulkPosts.length;

      // Atomic credit check + deduction
      const deductResult = await pool.query(
        `UPDATE customers SET
           credits_balance         = credits_balance - $1,
           credits_used_this_month = credits_used_this_month + $1
         WHERE id = $2 AND credits_balance >= $1
         RETURNING credits_balance`,
        [creditCost, billingId]
      );
      if (deductResult.rows.length === 0) {
        return res.status(402).json({ error: `Insufficient credits (need ${creditCost}).` });
      }
      const creditsRemaining = deductResult.rows[0].credits_balance;

      const savedIds = [];
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      for (const item of bulkPosts) {
        if (!item.caption || !item.date) continue;
        const scheduledDate = new Date(item.date);
        if (isNaN(scheduledDate)) continue;
        try {
          const result = await pool.query(
            `INSERT INTO posts (customer_id, content_type, caption, platform, platforms, status, generation_method, ai_model_used, scheduled_date, scheduled_timezone, created_at, updated_at)
             VALUES ($1, 'static', $2, $3, $4, 'scheduled', 'wizard_bulk', 'claude-sonnet-4-6', $5, $6, NOW(), NOW())
             RETURNING id`,
            [
              req.customerId,
              item.caption.substring(0, 5000),
              platform === 'all' ? 'facebook' : platform,
              JSON.stringify(platform === 'all' ? ['facebook', 'instagram', 'google_business'] : [platform]),
              scheduledDate,
              tz,
            ]
          );
          if (result.rows[0]) savedIds.push(result.rows[0].id);
        } catch (insertErr) {
          console.warn('[Wizard] bulk-confirm insert failed:', insertErr.message);
        }
      }

      // Audit credit transaction
      try {
        await pool.query(
          `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
           VALUES ($1, 'debit', $2, $3, $4)`,
          [billingId, -creditCost, creditsRemaining, `Bulk scheduled ${savedIds.length} posts via wizard`]
        );
      } catch {}

      res.json({ savedCount: savedIds.length, postIds: savedIds, creditsRemaining });
    } catch (err) {
      console.error('[Wizard] bulk-confirm error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/wizard/stream-ticket
  // Issues a one-time short-lived ticket (60s) that lets the frontend open an SSE stream
  // without passing the JWT in the query string. The ticket maps to customerId + postId.
  router.post('/stream-ticket', authenticate, async (req, res) => {
    const { postId } = req.body;
    if (!postId) return res.status(400).json({ error: 'postId required' });
    const ticket = uuidv4();
    if (!global.sseTickets) global.sseTickets = new Map();
    global.sseTickets.set(ticket, { customerId: req.customerId, postId: String(postId), exp: Date.now() + 60_000 });
    setTimeout(() => global.sseTickets?.delete(ticket), 60_000);
    res.json({ ticket });
  });

  // GET /api/wizard/status/:postId?ticket=<one-time-ticket>
  // SSE endpoint — streams video rendering progress. Polls DB every 3s.
  router.get('/status/:postId', async (req, res) => {
    const { postId } = req.params;
    const { ticket } = req.query;

    if (!global.sseTickets) global.sseTickets = new Map();
    const claim = global.sseTickets.get(ticket);
    if (!claim || claim.postId !== String(postId) || Date.now() > claim.exp) {
      return res.status(401).json({ error: 'Invalid or expired stream ticket' });
    }
    global.sseTickets.delete(ticket);
    const customerId = claim.customerId;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    // Track when job started for time-based progress estimate
    const startMs = Date.now();
    const EXPECTED_MS = 150_000; // 2.5 min estimate (HeyGen/Veo typical range)
    const MAX_MS = 600_000; // 10 min hard timeout

    let done = false;

    const intervalId = setInterval(async () => {
      if (done) return;
      const elapsedMs = Date.now() - startMs;

      if (elapsedMs > MAX_MS) {
        done = true;
        send({ status: 'failed', progress: 100, error: 'Video generation timed out.' });
        res.end();
        clearInterval(intervalId);
        return;
      }

      try {
        const result = await pool.query(
          `SELECT media_url, status FROM posts WHERE id = $1 AND customer_id = $2`,
          [postId, customerId]
        );
        if (!result.rows.length) {
          done = true;
          send({ status: 'failed', progress: 0, error: 'Post not found.' });
          res.end();
          clearInterval(intervalId);
          return;
        }

        const post = result.rows[0];

        if (post.media_url) {
          done = true;
          send({ status: 'ready', progress: 100, videoUrl: post.media_url });
          res.end();
          clearInterval(intervalId);
          return;
        }

        if (post.status === 'video_failed' || post.status === 'insufficient_credits') {
          done = true;
          send({ status: 'failed', progress: 100, error: post.status === 'insufficient_credits' ? 'Insufficient credits.' : 'Video generation failed.' });
          res.end();
          clearInterval(intervalId);
          return;
        }

        // Time-based progress estimate: 0% → 95% over expected duration (never reaches 100 until done)
        const rawProgress = Math.min(95, Math.round((elapsedMs / EXPECTED_MS) * 95));
        send({ status: 'rendering', progress: rawProgress });
      } catch (pollErr) {
        console.error('[Wizard] SSE poll error:', pollErr.message);
        // Don't close on transient DB errors — retry next tick
      }
    }, 3000);

    // Send initial 0% immediately
    send({ status: 'rendering', progress: 0 });

    req.on('close', () => {
      done = true;
      clearInterval(intervalId);
    });
  });

  /* ─────────────────────────────────────────────────────────
   * POST /api/wizard/plan-month
   * Generate a 30-day content plan for the current (or specified) month.
   * Returns 12-15 post slots with date, type, topic, tone, platform, and a caption preview.
   * Posts are NOT created — the frontend confirms before any drafts are saved.
   * ───────────────────────────────────────────────────────── */
  router.post('/plan-month', authenticate, requireActiveAccount(pool), async (req, res) => {
    try {
      const { month, year } = req.body;
      const now = new Date();
      const targetMonth = (parseInt(month) || (now.getMonth() + 1));
      const targetYear  = (parseInt(year)  || now.getFullYear());

      const customerRes = await pool.query(
        `SELECT id, business_name, industry, location, tone, credits_balance,
                past_post_examples, content_preferences
         FROM customers WHERE id = $1`,
        [req.customerId]
      );
      if (!customerRes.rows.length) return res.status(404).json({ error: 'Customer not found' });
      const customer = customerRes.rows[0];

      const industryKnowledge = require('../data/industryKnowledge');
      const knowledge = industryKnowledge[customer.industry] || industryKnowledge.general_contractor;
      const seasonal  = knowledge.seasonalContent[targetMonth] || {};
      const MONTH_NAMES = ['January','February','March','April','May','June',
        'July','August','September','October','November','December'];

      const systemPrompt = `You are ItsPosting AI, ItsPosting's AI content strategist for local service businesses.
Generate a 30-day content calendar for ${customer.business_name || 'this business'}, a ${customer.industry || 'general contractor'} business in ${customer.location || 'their area'}.

Month: ${MONTH_NAMES[targetMonth - 1]} ${targetYear}
Seasonal urgency topic: ${seasonal.urgencyTopic || 'Seasonal service reminder'}
Seasonal tip topic: ${seasonal.tipTopic || 'Practical tips for homeowners'}
Seasonal promotion angle: ${seasonal.promotionAngle || 'Monthly service special'}

CONTENT MIX RULE (non-negotiable 70/20/10):
- 70% educational / value-giving (tips, how-tos, FAQs, explainers)
- 20% social proof (before/after, testimonials, job showcases)
- 10% promotional (offers, specials, CTAs)

POSTING FREQUENCY: 3 posts per week = 12-13 posts for the month.
Space them out: roughly Mon, Wed, Fri pattern. Mix up the platforms.

Return a JSON array of exactly 13 post slots. Each slot:
{
  "dayOfMonth": <number 1-28>,
  "contentType": "static" | "photo" | "carousel",
  "category": "educational" | "social_proof" | "promotional",
  "topic": "<specific topic in plain English — 6-10 words>",
  "tone": "friendly" | "professional" | "educational" | "urgent",
  "platform": "facebook" | "instagram" | "google_business" | "all",
  "captionPreview": "<first 2 sentences of the caption — engaging, specific to their industry and location>"
}

Rules:
- captionPreview must feel like it was written by a real tradesperson, not a marketer
- Topics must be specific to ${customer.industry} in ${MONTH_NAMES[targetMonth - 1]}
- At least 2 slots should reference the seasonal urgency topic
- No two consecutive posts should be the same contentType
- Distribute across platforms (not all Facebook)
- Return ONLY the JSON array, no markdown fences, no extra text`;

      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: 'Generate the 30-day content calendar as specified.' }],
        system: systemPrompt,
      });

      let rawText = message.content[0]?.text || '[]';
      rawText = rawText.replace(/```json|```/g, '').trim();

      let slots;
      try {
        slots = JSON.parse(rawText);
        if (!Array.isArray(slots)) throw new Error('Not an array');
      } catch {
        return res.status(500).json({ error: 'Failed to parse content plan from AI' });
      }

      // Attach full dates and sanitise
      const result = slots.map(slot => {
        const d = new Date(targetYear, targetMonth - 1, Math.min(parseInt(slot.dayOfMonth) || 1, 28));
        return {
          date: d.toISOString().slice(0, 10),
          contentType: ['static','photo','carousel'].includes(slot.contentType) ? slot.contentType : 'static',
          category: ['educational','social_proof','promotional'].includes(slot.category) ? slot.category : 'educational',
          topic: String(slot.topic || '').substring(0, 80),
          tone: ['friendly','professional','educational','urgent'].includes(slot.tone) ? slot.tone : 'friendly',
          platform: ['facebook','instagram','google_business','all'].includes(slot.platform) ? slot.platform : 'all',
          captionPreview: String(slot.captionPreview || '').substring(0, 300),
        };
      }).sort((a, b) => a.date.localeCompare(b.date));

      res.json({ slots: result, month: targetMonth, year: targetYear, monthName: MONTH_NAMES[targetMonth - 1] });
    } catch (err) {
      console.error('[Wizard] plan-month error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/wizard/download-image ──────────────────────────────────────
  // Download a post image with optional "Made with ItsPosting" watermark.
  // withWatermark=true → also awards 5 free credits (once per post per customer).
  router.post('/download-image', authenticate, async (req, res) => {
    try {
      const { mediaUrl, postId, withWatermark = false } = req.body;
      if (!mediaUrl) return res.status(400).json({ error: 'mediaUrl required' });

      // SSRF protection
      const parsed = new URL(mediaUrl);
      const ALLOWED_HOSTS = ['res.cloudinary.com', 'storage.googleapis.com', 'cdn.nanobanana.ai', 'cdn.heygen.com'];
      if (!ALLOWED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
        return res.status(400).json({ error: 'Media URL not from an allowed host' });
      }

      const imgRes = await (require('axios').get(mediaUrl, { responseType: 'arraybuffer', timeout: 15000 }));
      let buffer = Buffer.from(imgRes.data);

      // Always normalise to 1080×1350 JPEG for download — Gemini may produce non-standard sizes
      if (ImageResizer) {
        try {
          const sharp = require('sharp');
          const meta = await sharp(buffer).metadata();
          if (meta.width !== 1080 || meta.height !== 1350) {
            buffer = await sharp(buffer)
              .resize(1080, 1350, { fit: 'cover', position: 'centre' })
              .jpeg({ quality: 85, mozjpeg: true })
              .toBuffer();
          }
        } catch (resizeErr) {
          console.warn('[Wizard/download] Resize normalisation failed (sending original):', resizeErr.message);
        }
      }

      if (withWatermark) {
        buffer = await ImageResizer.addWatermark(buffer, { isDark: true });

        // Award 5 credits once per post per customer (idempotent via unique constraint)
        if (postId) {
          try {
            const billingId = req.parentCustomerId || req.customerId;
            const existing = await pool.query(
              `SELECT id FROM credit_transactions WHERE customer_id=$1 AND post_id=$2 AND transaction_type='watermark_download'`,
              [billingId, postId]
            );
            if (existing.rows.length === 0) {
              const txClient = await pool.connect();
              try {
                await txClient.query('BEGIN');
                const balRes = await txClient.query(
                  `UPDATE customers SET credits_balance = credits_balance + 5 WHERE id=$1 RETURNING credits_balance`,
                  [billingId]
                );
                const newBal = balRes.rows[0]?.credits_balance ?? 0;
                await txClient.query(
                  `INSERT INTO credit_transactions (customer_id, post_id, transaction_type, amount, balance_after, description, created_at)
                    VALUES ($1, $2, 'watermark_download', 5, $3, 'Watermark download bonus', NOW())`,
                  [billingId, postId, newBal]
                );
                await txClient.query('COMMIT');
              } catch (txErr) {
                await txClient.query('ROLLBACK').catch(() => {});
                throw txErr;
              } finally {
                txClient.release();
              }
            }
          } catch (creditErr) {
            console.warn('[Wizard/download] Credit award failed (non-fatal):', creditErr.message);
          }
        }
      }

      res.set({
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="itsposting-post${withWatermark ? '-branded' : ''}.jpg"`,
        'Content-Length': buffer.length,
        'Cache-Control': 'no-store',
      });
      res.send(buffer);
    } catch (err) {
      console.error('[Wizard/download-image]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/wizard/feedback — capture customer choice signals for PostCore Brain training
  // Called from the frontend when customer selects a variation or keeps/regenerates media.
  // Fire this immediately on user action — never wait for it on the critical path.
  router.post('/feedback', authenticate, async (req, res) => {
    try {
      const customerId = req.customerId;
      const { postId, variationSelected, wasEdited, mediaKept, wasPublished } = req.body;

      if (!postId) return res.status(400).json({ error: 'postId required' });

      // Verify the post belongs to this customer (IDOR protection)
      const ownerCheck = await pool.query(
        `SELECT id FROM posts WHERE id = $1 AND customer_id = $2`,
        [postId, customerId]
      );
      if (ownerCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      // Update caption training signal
      if (variationSelected || wasEdited !== undefined || wasPublished !== undefined) {
        await pool.query(
          `UPDATE post_training_data SET
             variation_selected = COALESCE($1, variation_selected),
             was_edited         = COALESCE($2, was_edited),
             was_published      = COALESCE($3, was_published)
           WHERE post_id = $4`,
          [variationSelected || null,
           wasEdited !== undefined ? wasEdited : null,
           wasPublished !== undefined ? wasPublished : null,
           postId]
        );
      }

      // Update image training signal — mark the most recent image for this post
      if (mediaKept !== undefined) {
        await pool.query(
          `UPDATE image_training_data SET
             was_kept      = $1,
             was_published = COALESCE($2, was_published)
           WHERE post_id = $3`,
          [mediaKept,
           wasPublished !== undefined ? wasPublished : null,
           postId]
        );
        // Also update video training data
        await pool.query(
          `UPDATE video_training_data SET
             was_kept      = $1,
             was_published = COALESCE($2, was_published)
           WHERE post_id = $3`,
          [mediaKept,
           wasPublished !== undefined ? wasPublished : null,
           postId]
        );
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('[Wizard] feedback error:', err.message);
      res.status(500).json({ error: 'Failed to save feedback' });
    }
  });

  return router;
};
