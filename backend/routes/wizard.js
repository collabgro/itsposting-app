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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Format → dimensions + media type map. Mirrors FORMAT_DATA in frontend/pages/wizard.js.
// Used to pass correct aspect ratio to NanoBanana and Veo.
const FORMAT_CONFIG = {
  'ig-45':        { w: 1080, h: 1350, mediaType: 'image', aspectRatio: '4:5' },
  'ig-story':     { w: 1080, h: 1920, mediaType: 'video', aspectRatio: '9:16' },
  'ig-reel':      { w: 1080, h: 1920, mediaType: 'video', aspectRatio: '9:16' },
  'ig-square':    { w: 1080, h: 1080, mediaType: 'image', aspectRatio: '1:1' },
  'fb-landscape': { w: 1200, h: 630,  mediaType: 'image', aspectRatio: '16:9' },
  'fb-story':     { w: 1080, h: 1920, mediaType: 'video', aspectRatio: '9:16' },
  'fb-square':    { w: 1080, h: 1080, mediaType: 'image', aspectRatio: '1:1' },
  'li-post':      { w: 1200, h: 1200, mediaType: 'image', aspectRatio: '1:1' },
  'li-video':     { w: 1080, h: 1920, mediaType: 'video', aspectRatio: '9:16' },
  'tt-video':     { w: 1080, h: 1920, mediaType: 'video', aspectRatio: '9:16' },
  'tt-story':     { w: 1080, h: 1920, mediaType: 'video', aspectRatio: '9:16' },
  'gb-45':        { w: 1080, h: 1350, mediaType: 'image', aspectRatio: '4:5' },
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
    await pool.query(
      'UPDATE customers SET credits_balance = credits_balance + $1 WHERE id = $2',
      [amount, billingId]
    );
    await pool.query(
      `INSERT INTO credit_transactions (customer_id, post_id, transaction_type, amount, description)
       VALUES ($1, $2, 'refund', $3, 'Video generation failed - credits refunded')`,
      [billingId, postId, amount]
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
      { value: 'static', label: 'Static Post', emoji: '📄', description: 'Single image with caption', cost: 1 },
      { value: 'photo', label: 'Photo Post', emoji: '📸', description: 'Single photo with caption', cost: 3 },
      { value: 'carousel', label: 'Carousel', emoji: '📸📸📸', description: 'Multiple images in one post', cost: 5 },
      { value: 'video', label: 'Video', emoji: '🎥', description: 'AI-generated video with voiceover', cost: 10 },
    ],
  };

  const step2 = {
    id: 'content_type',
    title: "What's happening today?",
    subtitle: 'Pick what best describes what you want to post about',
    type: 'cards',
    options: [
      { value: 'just_finished_job', label: 'Just finished a job', emoji: '🔨', description: 'Show off your latest work' },
      { value: 'share_tip', label: 'Share a tip', emoji: '💡', description: 'Educate and build trust' },
      { value: 'got_review', label: 'Got a great review', emoji: '⭐', description: 'Share the love from a customer' },
      { value: 'running_promo', label: 'Running a promotion', emoji: '📅', description: 'Announce a special offer' },
      {
        value: 'seasonal',
        label: `${currentMonthName} seasonal post`,
        emoji: '🌤️',
        description: seasonal.urgencyTopic || 'Timely, seasonal content for this month',
      },
      { value: 'community', label: 'Community or local event', emoji: '🏘️', description: 'Connect with your local area' },
      { value: 'faq', label: 'FAQ or myth-busting', emoji: '❓', description: 'Answer a common question' },
      { value: 'team_spotlight', label: 'Team spotlight', emoji: '🎉', description: 'Introduce your team or celebrate a milestone' },
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
      subtitle: 'Any details help PostCore write a more specific post (all optional)',
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
      subtitle: 'PostCore will turn this into an engaging educational post',
      type: 'form',
      fields: [
        { id: 'tip_topic', label: 'Topic or tip idea', placeholder: knowledge.seasonalContent?.[currentMonth]?.tipTopic || 'e.g. How to check if your water heater needs replacing...', type: 'textarea', required: false },
        { id: 'tip_audience', label: 'Who is this tip for? (optional)', placeholder: 'e.g. Homeowners with older homes, families with kids...', type: 'text', required: false },
      ],
    },
    got_review: {
      id: 'details',
      title: 'Share the review',
      subtitle: 'Paste the review and PostCore will craft the perfect social post around it',
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
      subtitle: 'PostCore will write a compelling promotion post',
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
      subtitle: seasonal.urgencyTopic ? `PostCore knows it's the time for: ${seasonal.urgencyTopic}` : 'PostCore will write timely, seasonal content',
      type: 'form',
      fields: [
        { id: 'seasonal_angle', label: 'Any specific angle? (optional)', placeholder: seasonal.promotionAngle || 'Leave blank and PostCore will choose the most relevant seasonal topic', type: 'textarea', required: false },
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
    subtitle: 'PostCore will write differently for each platform',
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

  // GET /api/wizard/steps/:industry/:contentType
  router.get('/steps/:industry/:contentType', authenticate, async (req, res) => {
    try {
      const { industry, contentType } = req.params;
      const steps = getWizardSteps(industry, contentType);
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
        `SELECT id, business_name, industry, location, tone, visual_style,
                timezone, credits_balance, plan, status,
                brand_colors, logo_url,
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

      // Map wizard content types to SystemPromptBuilder triggers
      const triggerMap = {
        just_finished_job: 'finished_job',
        share_tip: 'share_tip',
        got_review: 'got_review',
        running_promo: 'promotion',
        seasonal: 'seasonal',
        community: 'community',
        faq: 'faq',
        team_spotlight: 'behind_scenes',
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
      const CREDIT_COSTS = { static: 1, photo: 3, carousel: 5, video: 10 };
      const creditCost = CREDIT_COSTS[answers.contentTypeSelection] ?? 1;

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

      debugStage = 'prompt_build';
      const builder = new SystemPromptBuilder(session.customer, {
        platform: answers.platform,
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
      const willUseHeyGen = answers.contentTypeSelection === 'video' && (
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
      const transformedVariations = {
        A: {
          caption: parsed.variation_a?.caption || '',
          engagementQuestion: parsed.variation_a?.engagementQuestion || '',
          hookType: parsed.variation_a?.hookFormulaUsed || 'question',
        },
        B: {
          caption: parsed.variation_b?.caption || '',
          engagementQuestion: parsed.variation_b?.engagementQuestion || '',
          hookType: parsed.variation_b?.hookFormulaUsed || 'story',
        },
        C: {
          caption: parsed.variation_c?.caption || '',
          engagementQuestion: parsed.variation_c?.engagementQuestion || '',
          hookType: parsed.variation_c?.hookFormulaUsed || 'tip',
        },
      };

      // Extract additional content based on type
      let slides = null;
      let videoScript = null;

      if (answers.contentTypeSelection === 'carousel') {
        slides = parsed.variation_a?.slides || [];
      } else if (answers.contentTypeSelection === 'video') {
        videoScript = parsed.variation_a?.videoScript || '';
      }

      if (!transformedVariations.A.caption || !transformedVariations.B.caption || !transformedVariations.C.caption) {
        console.error('[Wizard] Invalid response structure from Claude:', parsed);
        return res.status(502).json({ error: 'Invalid AI response structure. Please try again.' });
      }

      // ── Media orchestration (NanoBanana images) ──────────────────────────────
      let mediaUrl = null;
      let mediaVariants = {};
      let imageFailed = false;
      const imagePromptForGen = parsed.imagePrompt || parsed.variation_a?.imagePrompt || '';
      const contentTypeForMedia = answers.contentTypeSelection;

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
            const slideList = parsed.carouselSlides || parsed.variation_a?.slides || [];
            const slideResults = [];
            for (const slide of slideList) {
              try {
                const slideResult = await nanoBanana.generateFromPrompt(session.customer, slide.description || imagePromptForGen, { aspectRatio: '1:1' });
                await validateMedia(slideResult.url);
                slideResults.push({ ...slide, imageUrl: slideResult.url });
              } catch (slideErr) {
                console.warn(`[Wizard] Slide ${slide.slideNumber} image failed:`, slideErr.message);
                slideResults.push({ ...slide, imageUrl: null });
              }
            }
            mediaUrl = slideResults[0]?.imageUrl || null;
            mediaVariants = { slides: slideResults };
          } else {
            // Photo — try once, retry once on failure
            let imageResult;
            try {
              imageResult = await attemptImageGen(imagePromptForGen);
            } catch (firstErr) {
              console.warn('[Wizard] Image gen attempt 1 failed, retrying:', firstErr.message);
              imageResult = await attemptImageGen(imagePromptForGen);
            }
            mediaUrl = imageResult.url;
            if (ImageResizer) {
              try {
                const variants = await ImageResizer.uploadResizedImages(
                  imageResult.url,
                  `wizard-${Date.now()}`,
                  session.customerId
                );
                mediaVariants = variants;
              } catch (resizerErr) {
                console.warn('[Wizard] ImageResizer failed — using original URL:', resizerErr.message);
                mediaVariants = {};
              }
            }
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
            answers.platform === 'all' ? 'facebook' : answers.platform,
            answers.platform === 'all' ? JSON.stringify(['facebook', 'instagram', 'google_business']) : JSON.stringify([answers.platform]),
            mediaUrl,
          ]
        );

        savedPostId = postResult.rows[0]?.id;

        if (savedPostId) {
          try {
            for (const [label, variation] of Object.entries(transformedVariations)) {
              await pool.query(
                `INSERT INTO post_variations (post_id, variation_label, caption, hashtags, image_prompt, created_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())
                 ON CONFLICT DO NOTHING`,
                [
                  savedPostId,
                  label,
                  variation.caption,
                  JSON.stringify(parsed.variation_a?.hashtags || []), // Use variation_a hashtags for all
                  parsed.variation_a?.imagePrompt || null,
                ]
              );
            }
            savedVariations = true;
          } catch (variationsErr) {
            console.warn('[Wizard] Could not save post_variations (table may not exist yet):', variationsErr.message);
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

      let videoJobId = null;
      let videoError = null;

      // ── Video async kickoff — fire-and-forget so the response is immediate ──
      // VideoService routes to Veo (services video) or HeyGen (avatar video).
      // Either way: mark videoRendering=true, return captions now, generate in background,
      // and let /video-poll/:postId handle completion polling.
      const videoServiceAvailable = VideoService && (process.env.HEYGEN_API_KEY || process.env.VEO_ENABLED === 'true');
      if (videoServiceAvailable && answers.contentTypeSelection === 'video' && savedPostId) {
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

            const videoResult = await videoSvc.generate(bgCustomer, bgScript, {
              videoType: bgVideoType,
              imagePrompt: bgImagePrompt,
              aspectRatio: bgAspectRatio,
              durationSeconds: 7,
            });

            if (videoResult?.url) {
              await pool.query(
                `UPDATE posts SET media_url = $1, video_provider = $2, status = 'draft', updated_at = NOW() WHERE id = $3`,
                [videoResult.url, videoResult.provider, bgPostId]
              );
              console.log(`[Wizard BG] Video ready for post ${bgPostId}: ${videoResult.url.substring(0, 60)}`);
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
        recommended: 'A',
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

  // POST /api/wizard/quick — mobile quick post mode
  router.post('/quick', authenticate, async (req, res) => {
    try {
      const { description, platform = 'facebook', tone = 'friendly' } = req.body;

      if (!description || description.trim().length < 5) {
        return res.status(400).json({ error: 'Please describe what happened in at least a few words.' });
      }

      const customerResult = await pool.query(
        'SELECT id, business_name, industry, location, tone, visual_style FROM customers WHERE id = $1',
        [req.customerId]
      );

      if (!customerResult.rows[0]) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      const customer = customerResult.rows[0];

      // Use SystemPromptBuilder for consistent quality
      const builder = new SystemPromptBuilder(customer, {
        platform,
        contentType: 'photo', // Quick post generates single images
        wizardTrigger: 'finished_job', // Default trigger for quick posts
        counterAnswers: { job_description: description.trim() }, // Pass the description as job details
      });

      const { systemPrompt, userPrompt } = builder.build();

      const claudeResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const rawText = claudeResponse.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('');
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      // Extract from variation_a (SystemPromptBuilder format)
      res.json({
        success: true,
        caption: parsed.variation_a?.caption || '',
        hashtags: parsed.variation_a?.hashtags || [],
        imagePrompt: parsed.variation_a?.imagePrompt || '',
        engagementQuestion: parsed.variation_a?.engagementQuestion || '',
        platform,
        tone,
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

      const customerResult = await pool.query(
        'SELECT business_name, industry, location FROM customers WHERE id = $1',
        [req.customerId]
      );
      const customer = customerResult.rows[0];

      const angleInstructions = {
        shorter: 'Rewrite this post to be 30-40% shorter while keeping all the key information.',
        longer: 'Expand this post with more detail, context, and value — aim for 50% more content.',
        funnier: 'Rewrite this with a touch of humor and personality while keeping it professional.',
        more_local: `Rewrite this with stronger local references — mention ${customer.location || 'the local area'} naturally.`,
        add_question: 'Rewrite this with a stronger, more engaging question at the end to drive comments.',
      };

      const instruction = angleInstructions[angle] || 'Rewrite this post with a fresh angle.';

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: `You are PostCore, rewriting social media posts for ${customer.business_name}, a ${customer.industry} business in ${customer.location}. Always sound human and authentic. Respond with ONLY valid JSON: { "caption": "rewritten post text" }`,
        messages: [{
          role: 'user',
          content: `${instruction}\n\nOriginal post:\n${caption}`,
        }],
      });

      const rawText = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      res.json({ success: true, caption: parsed.caption });
    } catch (err) {
      console.error('[Wizard] Refresh error:', err);
      res.status(500).json({ error: 'Refresh failed. Please try again.' });
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

  return router;
};
