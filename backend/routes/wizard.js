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
const { v4: uuidv4 } = require('uuid');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate } = require('../middleware/auth');

let industryKnowledge;
try {
  industryKnowledge = require('../data/industryKnowledge');
} catch {
  industryKnowledge = {};
  console.warn('[Wizard] industryKnowledge.js not found — some features will be limited');
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

  const step2 = {
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

  const step3Options = {
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
    step3Options[contentType] || step3Options['just_finished_job'],
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
// Helper: Build Claude prompt from wizard answers
// ─────────────────────────────────────────────────────────────

async function buildGenerationPrompt(customer, answers) {
  const { contentType, tone, details, platform } = answers;
  const industry = customer.industry || 'general_contractor';
  const knowledge = industryKnowledge[industry] || {};
  const currentMonth = new Date().getMonth() + 1;
  const seasonal = knowledge.seasonalContent?.[currentMonth] || {};

  const contentTypeMap = {
    just_finished_job: 'before_after',
    share_tip: 'educational_tip',
    got_review: 'customer_testimonial',
    running_promo: 'promotional',
    seasonal: 'seasonal',
    community: 'community_involvement',
    faq: 'faq_busting',
    team_spotlight: 'team_spotlight',
  };
  const internalContentType = contentTypeMap[contentType] || 'educational_tip';

  const toneDescriptions = {
    friendly: 'warm, casual, and approachable — like talking to a neighbor',
    professional: 'polished, expert, and trustworthy — like a seasoned professional',
    funny: 'lighthearted, relatable, and human — with a touch of humor',
    educational: 'informative, detailed, and authority-building — like a knowledgeable expert sharing wisdom',
    urgent: 'time-sensitive and action-driving — creating a sense of urgency without being pushy',
  };

  const platformRules = {
    facebook: 'Facebook post: 150-300 words, conversational tone, end with a question to drive comments, 2-3 hashtags maximum',
    instagram: 'Instagram caption: 100-150 words, visual-first language, end with engagement question, 10-15 relevant hashtags on a new line',
    google_business: 'Google Business post: 100-200 words, naturally weave in local keywords and city name, include a clear call-to-action with contact info, no hashtags',
    all: 'Write for Facebook (primary) with the understanding it will be adapted for Instagram and Google Business',
  };

  const painPoints = knowledge.customerPainPoints?.slice(0, 5).join(', ') || '';
  const trustSignals = knowledge.trustSignals?.slice(0, 3).join(', ') || '';
  const hooks = knowledge.hookFormulas?.slice(0, 3).join(' | ') || '';

  let detailContext = '';
  if (details) {
    if (details.job_description) detailContext += `Job details: ${details.job_description}. `;
    if (details.neighborhood) detailContext += `Location/neighborhood: ${details.neighborhood}. `;
    if (details.customer_reaction) detailContext += `Customer reaction: ${details.customer_reaction}. `;
    if (details.tip_topic) detailContext += `Tip topic: ${details.tip_topic}. `;
    if (details.review_text) detailContext += `Customer review: "${details.review_text}". `;
    if (details.customer_name) detailContext += `Customer name: ${details.customer_name}. `;
    if (details.promo_offer) detailContext += `Promotion: ${details.promo_offer}. `;
    if (details.promo_deadline) detailContext += `Deadline: ${details.promo_deadline}. `;
    if (details.seasonal_angle) detailContext += `Seasonal angle: ${details.seasonal_angle}. `;
    if (details.community_event) detailContext += `Community event: ${details.community_event}. `;
    if (details.question) detailContext += `FAQ question: ${details.question}. `;
    if (details.spotlight_subject) detailContext += `Spotlight subject: ${details.spotlight_subject}. `;
    if (details.fun_fact) detailContext += `Fun fact: ${details.fun_fact}. `;
  }

  const systemPrompt = `You are PostCore, the AI social media advisor for ItsPosting. You create social media posts for local service businesses that sound completely human and authentic — never AI-generated.

BUSINESS CONTEXT:
- Business name: ${customer.business_name}
- Industry: ${industry}
- Location: ${customer.location || 'local area'}
- Tone preference: ${customer.tone || 'professional'}
- Visual style: ${customer.visual_style || 'modern'}

INDUSTRY EXPERTISE:
- Common customer pain points: ${painPoints}
- Trust signals for this industry: ${trustSignals}
- Proven hook formulas: ${hooks}
- This month's seasonal opportunity: ${seasonal.urgencyTopic || 'general seasonal relevance'}
- This month's tip opportunity: ${seasonal.tipTopic || 'general educational content'}

TONE FOR THIS POST:
${toneDescriptions[tone] || toneDescriptions.professional}

PLATFORM RULES:
${platformRules[platform] || platformRules.facebook}

CONTENT TYPE RULES for ${internalContentType}:
${getContentTypeRules(internalContentType)}

AUTHENTICITY RULES (CRITICAL):
- Write like a real business owner, not a marketing agency
- Use natural, conversational language — avoid corporate speak
- Never use words like: "delve", "synergy", "leverage", "optimize", "utilize", "in conclusion"
- Reference the local community naturally (use the city name if provided)
- Include a genuine human element — the people behind the business
- The post must end with an engagement question (question to encourage comments)
- Keep the 70/20/10 rule: 70% value/educational, 20% social proof, 10% promotional

OUTPUT FORMAT:
You must respond with ONLY valid JSON in this exact structure:
{
  "variations": {
    "A": {
      "caption": "Full post text here. Everything. Ending with engagement question.",
      "hookType": "question",
      "engagementQuestion": "The question at the end of the post, repeated here"
    },
    "B": {
      "caption": "Full post text here. Different hook. Same content angle. Ending with engagement question.",
      "hookType": "story",
      "engagementQuestion": "The question at the end of the post, repeated here"
    },
    "C": {
      "caption": "Full post text here. Third approach. Ending with engagement question.",
      "hookType": "tip",
      "engagementQuestion": "The question at the end of the post, repeated here"
    }
  },
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
  "imagePrompt": "A detailed description of the ideal image to accompany this post, written for an AI image generator. Specify: subject, style, lighting, composition. Always vertical/portrait orientation (4:5 ratio). Authentic, real-world feel — not stock photo.",
  "bestTimeToPost": "morning",
  "contentType": "${internalContentType}",
  "platform": "${platform}"
}

Variation A must use a question hook.
Variation B must use a story or narrative hook.
Variation C must use a tip or fact hook.
All three must cover the same topic but feel distinctly different.
Do not add any text before or after the JSON.`;

  const userMessage = `Generate 3 variations of a ${internalContentType} post for ${platform}.
Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
${detailContext ? `\nBusiness owner provided these details: ${detailContext}` : '\nNo additional details provided — use your industry expertise to create compelling content.'}
${seasonal.urgencyTopic ? `\nSeasonal context: ${seasonal.urgencyTopic}` : ''}`;

  return { systemPrompt, userMessage, internalContentType };
}

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
                timezone, credits_balance, plan, status
         FROM customers WHERE id = $1`,
        [customerId]
      );

      if (!customerResult.rows[0]) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      const customer = customerResult.rows[0];

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

      const contentTypeAnswer = session.answers['content_type'];
      const toneAnswer = session.answers['tone'];
      const detailsAnswer = session.answers['details'];
      const platformAnswer = session.answers['platform'];

      const answers = {
        contentType: contentTypeAnswer?.value || 'just_finished_job',
        tone: toneAnswer?.value || 'professional',
        details: detailsAnswer || {},
        platform: platformAnswer?.value || 'facebook',
      };

      const { systemPrompt, userMessage, internalContentType } = await buildGenerationPrompt(session.customer, answers);

      console.log(`[Wizard] Generating posts for customer ${session.customerId}, content type: ${answers.contentType}`);

      let claudeResponse;
      try {
        claudeResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        });
      } catch (claudeErr) {
        console.error('[Wizard] Claude API error:', claudeErr);
        return res.status(502).json({ error: 'AI generation failed. Please try again.' });
      }

      let parsed;
      try {
        const rawText = claudeResponse.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('');
        const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error('[Wizard] Failed to parse Claude response:', parseErr);
        return res.status(502).json({ error: 'Failed to parse AI response. Please try again.' });
      }

      if (!parsed.variations || !parsed.variations.A || !parsed.variations.B || !parsed.variations.C) {
        console.error('[Wizard] Invalid response structure from Claude:', parsed);
        return res.status(502).json({ error: 'Invalid AI response structure. Please try again.' });
      }

      let savedPostId = null;
      let savedVariations = null;

      try {
        const postResult = await pool.query(
          `INSERT INTO posts (customer_id, content_type, caption, platform, platforms, status, generation_method, ai_model_used, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'draft', 'wizard', 'claude-sonnet-4-20250514', NOW(), NOW())
           RETURNING id`,
          [
            session.customerId,
            internalContentType,
            parsed.variations.A.caption,
            answers.platform === 'all' ? 'facebook' : answers.platform,
            answers.platform === 'all' ? JSON.stringify(['facebook', 'instagram', 'google_business']) : JSON.stringify([answers.platform]),
          ]
        );

        savedPostId = postResult.rows[0]?.id;

        if (savedPostId) {
          try {
            for (const [label, variation] of Object.entries(parsed.variations)) {
              await pool.query(
                `INSERT INTO post_variations (post_id, variation_label, caption, hashtags, image_prompt, created_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())
                 ON CONFLICT DO NOTHING`,
                [
                  savedPostId,
                  label,
                  variation.caption,
                  JSON.stringify(parsed.hashtags || []),
                  parsed.imagePrompt || null,
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
        variations: parsed.variations,
        hashtags: parsed.hashtags || [],
        imagePrompt: parsed.imagePrompt || '',
        bestTimeToPost: parsed.bestTimeToPost || 'morning',
        contentType: answers.contentType,
        platform: answers.platform,
        recommended: 'A',
        meta: {
          industry: session.customer.industry,
          tone: answers.tone,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error('[Wizard] Error generating posts:', err);
      res.status(500).json({ error: 'Generation failed. Please try again.' });
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
      const industry = customer.industry || 'general_contractor';
      const knowledge = industryKnowledge[industry] || {};
      const currentMonth = new Date().getMonth() + 1;
      const seasonal = knowledge.seasonalContent?.[currentMonth] || {};

      const toneDescriptions = {
        friendly: 'warm, casual, conversational',
        professional: 'polished, expert, trustworthy',
        funny: 'lighthearted, relatable, with gentle humor',
        educational: 'informative and authority-building',
        urgent: 'time-sensitive and action-driving',
      };

      const platformRules = {
        facebook: '150-250 words, conversational, 2-3 hashtags',
        instagram: '100-150 words, visual-first language, 10-15 hashtags',
        google_business: '100-200 words, local keywords, clear CTA, no hashtags',
        all: '150-250 words optimized for Facebook',
      };

      const claudeResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: `You are PostCore, the AI social media advisor for ItsPosting. Create authentic social posts for local service businesses.

Business: ${customer.business_name}
Industry: ${industry}
Location: ${customer.location || 'local area'}
Tone: ${toneDescriptions[tone] || toneDescriptions.friendly}
Platform rules: ${platformRules[platform] || platformRules.facebook}
Current seasonal context: ${seasonal.urgencyTopic || 'general'}

Rules:
- Sound like a real business owner, never an AI
- End with an engagement question
- Include local reference naturally
- Never use corporate buzzwords

Respond with ONLY valid JSON:
{
  "caption": "The full post text ending with an engagement question",
  "hashtags": ["tag1", "tag2"],
  "imagePrompt": "Description of ideal image for this post",
  "engagementQuestion": "The question at the end of the post"
}`,
        messages: [{
          role: 'user',
          content: `Create a quick social post for ${platform} about: "${description.trim()}"`,
        }],
      });

      const rawText = claudeResponse.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('');
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      res.json({
        success: true,
        caption: parsed.caption,
        hashtags: parsed.hashtags || [],
        imagePrompt: parsed.imagePrompt || '',
        engagementQuestion: parsed.engagementQuestion || '',
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
        model: 'claude-sonnet-4-20250514',
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
