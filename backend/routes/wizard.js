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
const { authenticate } = require('../middleware/auth');
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

// ─────────────────────────────────────────────────────────────
// Media validation — sanity checks before sending URL to frontend
// Catches corrupt/missing NanoBanana and HeyGen outputs
// ─────────────────────────────────────────────────────────────
function validateMedia(url) {
  // data: URLs are inline base64 — no HTTP check needed
  if (!url || url.startsWith('data:')) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res) => {
      const status = res.statusCode;
      const len = parseInt(res.headers['content-length'] || '0', 10);
      res.resume(); // drain response body
      if (status !== 200) return reject(new Error(`Media URL returned ${status}`));
      if (len > 0 && len < 10240) return reject(new Error(`Media too small (${len} bytes) — likely corrupt`));
      if (len > 10 * 1024 * 1024) return reject(new Error(`Media too large (${len} bytes)`));
      resolve();
    }).on('error', reject);
  });
}

// ─────────────────────────────────────────────────────────────
// In-memory wizard sessions
// Sessions are ephemeral — they live only during the creation flow
// Cleaned up after 2 hours of inactivity
// ─────────────────────────────────────────────────────────────

const wizardSessions = new Map();

setInterval(() => {
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, session] of wizardSessions.entries()) {
    if (session.createdAt < twoHoursAgo) {
      wizardSessions.delete(id);
    }
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
          `SELECT website_url, scraped_services, scraped_about FROM customers WHERE id = $1`,
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

      wizardSessions.set(wizardId, session);

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

      if (!wizardId || !wizardSessions.has(wizardId)) {
        return res.status(404).json({ error: 'Wizard session not found or expired. Please start again.' });
      }

      const session = wizardSessions.get(wizardId);

      if (session.customerId !== req.customerId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      session.answers[stepId] = answers;

      if (stepId === 'content_type' && answers.value) {
        const newSteps = getWizardSteps(session.customer.industry || 'general_contractor', answers.value);
        session.steps = newSteps;
      }

      session.currentStep += 1;

      if (session.currentStep >= session.steps.length) {
        wizardSessions.set(wizardId, session);
        return res.json({
          complete: true,
          wizardId,
          message: 'All steps complete. Call /api/wizard/generate to generate posts.',
        });
      }

      wizardSessions.set(wizardId, session);
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
  router.post('/generate', authenticate, async (req, res) => {
    try {
      const { wizardId } = req.body;

      if (!wizardId || !wizardSessions.has(wizardId)) {
        return res.status(404).json({ error: 'Wizard session not found or expired. Please start again.' });
      }

      const session = wizardSessions.get(wizardId);

      if (session.customerId !== req.customerId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const contentTypeSelectionAnswer = session.answers['content_type_selection'];
      const contentTypeAnswer = session.answers['content_type'];
      const toneAnswer = session.answers['tone'];
      const detailsAnswer = session.answers['details'];
      const platformAnswer = session.answers['platform'];

      const answers = {
        contentTypeSelection: contentTypeSelectionAnswer?.value || 'photo',
        contentType: contentTypeAnswer?.value || 'just_finished_job',
        tone: toneAnswer?.value || 'professional',
        details: detailsAnswer || {},
        platform: platformAnswer?.value || 'facebook',
      };

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
          `SELECT content_type, content FROM business_knowledge WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 10`,
          [session.customerId]
        );
        businessKnowledge = bkResult.rows;
      } catch (e) {
        // table may not exist yet — safe to ignore
      }

      const builder = new SystemPromptBuilder(session.customer, {
        platform: answers.platform,
        contentType: answers.contentTypeSelection, // 'static', 'photo', 'carousel', 'video'
        wizardTrigger: triggerMap[answers.contentType] || answers.contentType,
        counterAnswers: answers.details,
        businessKnowledge,
      });

      const { systemPrompt, userPrompt } = builder.build();

      console.log(`[Wizard] Generating posts for customer ${session.customerId}, content type: ${answers.contentType}`);

      let claudeResponse;
      try {
        claudeResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 2500,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });
      } catch (claudeErr) {
        console.error('[Wizard] Claude API error:', claudeErr.message || claudeErr);
        return res.status(502).json({ error: `AI generation failed: ${claudeErr.message || 'Unknown error'}` });
      }

      let parsed;
      try {
        const rawText = claudeResponse.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('');

        // Find this (around line 495-505):
        // const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        // parsed = JSON.parse(cleaned);

        // Replace with this:
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
          parsed = JSON.parse(cleaned);
        } catch (jsonErr) {
          // Last resort: return a single hardcoded variation so user never sees an error
          console.error('[Wizard] JSON parse failed, using fallback:', jsonErr.message);
          parsed = {
            variation_a: {
              caption: rawText.substring(0, 500).replace(/[{}[\]"]/g, '') || 'PostCore is warming up. Please try again.',
              engagementQuestion: 'What do you think?',
            },
            variation_b: {
              caption: 'Try generating again for more variations.',
              engagementQuestion: 'Have questions? Drop them below!',
            },
            variation_c: {
              caption: 'PostCore is ready — try one more time for best results.',
              engagementQuestion: 'What would you like to know?',
            },
          };
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

        const attemptImageGen = async (prompt) => {
          const result = await nanoBanana.generateFromPrompt(session.customer, prompt);
          await validateMedia(result.url);
          return result;
        };

        try {
          if (contentTypeForMedia === 'carousel') {
            const slideList = parsed.carouselSlides || parsed.variation_a?.slides || [];
            const slideResults = [];
            for (const slide of slideList) {
              try {
                const slideResult = await nanoBanana.generateFromPrompt(session.customer, slide.description || imagePromptForGen);
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

      // ── HeyGen async kick-off for video posts ────────────────────────────────
      let videoJobId = null;
      if (HeyGenService && answers.contentTypeSelection === 'video') {
        const heyGen = new HeyGenService();
        const videoScript = parsed.variation_a?.videoScript || transformedVariations.A.caption;
        heyGen.createVideo(session.customer, videoScript)
          .then(async (jobId) => {
            if (jobId && savedPostId) {
              await pool.query(
                `UPDATE posts SET video_job_id = $1 WHERE id = $2`,
                [jobId, savedPostId]
              ).catch(err => console.warn('[Wizard] Could not save video_job_id:', err.message));
            }
          })
          .catch(err => console.error('[Wizard] HeyGen createVideo error:', err.message));
        videoJobId = 'pending';
      }

      let savedPostId = null;
      let savedVariations = null;

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
        }
      } catch (dbErr) {
        console.warn('[Wizard] Could not save post to database:', dbErr.message);
      }

      wizardSessions.delete(wizardId);

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
        videoJobId,
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
      console.error('[Wizard] Error generating posts:', err.message || err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Generation failed. Please try again.' });
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
          await validateMedia(videoUrl);
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

  // POST /api/wizard/regenerate-image — regenerate image for an existing post (costs 1 credit)
  router.post('/regenerate-image', authenticate, async (req, res) => {
    try {
      const { postId, imagePrompt } = req.body;
      const customerId = req.customerId;

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

      // Deduct 1 credit atomically
      const creditResult = await pool.query(
        `UPDATE customers SET credits_balance = credits_balance - 1
         WHERE id = $1 AND credits_balance >= 1
         RETURNING credits_balance`,
        [customerId]
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
          [customerId]
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

  // GET /api/wizard/debug-image — find working Gemini image model + test it
  // No auth required — diagnostic only, remove after debugging
  router.get('/debug-image', async (req, res) => {
    const axios = require('axios');
    const apiKey = process.env.GOOGLE_AI_API_KEY;

    if (!apiKey) {
      return res.json({ status: 'failed', error: 'GOOGLE_AI_API_KEY is not set' });
    }

    // Step 1: List all available models that support generateContent
    let imageCapableModels = [];
    try {
      const listResp = await axios.get(
        'https://generativelanguage.googleapis.com/v1beta/models',
        { params: { key: apiKey }, timeout: 10000 }
      );
      const allModels = listResp.data?.models || [];
      imageCapableModels = allModels
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace('models/', ''));
    } catch (listErr) {
      return res.json({ status: 'failed', step: 'list_models', error: listErr.message });
    }

    // Step 2: Try each candidate model name until one generates an image
    const candidates = [
      'gemini-2.5-flash-image',
      'gemini-3.1-flash-image-preview',
      'gemini-3-pro-image-preview',
      'nano-banana-pro-preview',
      ...imageCapableModels.filter(n => n.includes('image')),
    ].filter((v, i, a) => a.indexOf(v) === i); // dedupe

    const testPrompt = 'A simple test photograph of a red apple on a white table, studio lighting, square composition. No text.';
    const results = [];

    for (const modelName of candidates.slice(0, 8)) {
      try {
        const r = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
          {
            contents: [{ parts: [{ text: testPrompt }] }],
            generationConfig: { responseModalities: ['IMAGE'] },
          },
          { headers: { 'Content-Type': 'application/json' }, params: { key: apiKey }, timeout: 30000 }
        );
        const parts = r.data?.candidates?.[0]?.content?.parts || [];
        const hasImage = parts.some(p => p.inlineData?.data);
        results.push({ model: modelName, status: hasImage ? 'IMAGE_OK' : 'no_image', finishReason: r.data?.candidates?.[0]?.finishReason });
        if (hasImage) break; // found a working model — stop
      } catch (e) {
        results.push({ model: modelName, status: 'error', httpStatus: e.response?.status, error: e.response?.data?.error?.message || e.message });
      }
    }

    const working = results.find(r => r.status === 'IMAGE_OK');
    return res.json({
      availableModels: imageCapableModels.slice(0, 30),
      testedModels: results,
      workingModel: working?.model || null,
      recommendation: working
        ? `Use model: "${working.model}" — update NanoBananaService.js`
        : 'No working image model found. Check API key permissions or enable image generation in Google AI Studio.',
    });
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
  router.post('/refresh', authenticate, async (req, res) => {
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

      if (!wizardSessions.has(wizardId)) {
        return res.status(404).json({ error: 'Session not found or expired' });
      }

      const session = wizardSessions.get(wizardId);

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
