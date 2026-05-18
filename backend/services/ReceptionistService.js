'use strict';

const Anthropic = require('@anthropic-ai/sdk');

let industryKnowledge = {};
try { industryKnowledge = require('../data/industryKnowledge'); } catch (_) {}

const INTENT_LABELS = [
  'price_inquiry', 'booking_request', 'emergency', 'service_area_check',
  'faq', 'complaint', 'legal', 'human_requested', 'general', 'unknown',
];

// Keywords that always trigger escalation regardless of AI intent
const HARD_ESCALATE_KEYWORDS = ['legal', 'lawyer', 'lawsuit', 'sue', 'solicitor', 'court', 'attorney'];

class ReceptionistService {
  constructor(pool) {
    this.pool = pool;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) console.warn('[ReceptionistService] ⚠️  ANTHROPIC_API_KEY not set');
    this.anthropic = apiKey ? new Anthropic({ apiKey }) : null;
  }

  // ── Build Claude system prompt from knowledge base ───────────────
  async buildSystemPrompt(customerId) {
    const [customerRes, configRes, knowledgeRes] = await Promise.all([
      this.pool.query(`SELECT business_name, industry, location, timezone FROM customers WHERE id=$1`, [customerId]),
      this.pool.query(`SELECT * FROM receptionist_config WHERE customer_id=$1`, [customerId]),
      this.pool.query(
        `SELECT knowledge_type, title, content FROM business_knowledge
         WHERE customer_id=$1 AND is_active=true ORDER BY knowledge_type, sort_order LIMIT 60`,
        [customerId]
      ),
    ]);

    const customer = customerRes.rows[0] || {};
    const config = configRes.rows[0] || {};
    const knowledge = knowledgeRes.rows;

    // Group knowledge by type
    const kb = { services: [], faqs: [], reviews: [], differentiators: [], team: [] };
    for (const row of knowledge) {
      const type = row.knowledge_type;
      if (kb[type]) kb[type].push(row);
    }

    const industryData = industryKnowledge[customer.industry] || {};
    const currentMonth = new Date().getMonth() + 1;
    const seasonal = industryData.seasonalContent?.[currentMonth];

    // Strip characters used in prompt injection and cap entry length
    const sanitizeKb = (text, maxLen = 600) =>
      typeof text === 'string' ? text.substring(0, maxLen).replace(/[<>`]/g, '').trim() : '';

    const servicesText = kb.services.slice(0, 15).map(s => {
      try {
        const p = JSON.parse(s.content);
        const name = sanitizeKb(p.name || s.title);
        const price = p.priceRange ? ` (${sanitizeKb(p.priceRange, 80)})` : '';
        return `- ${name}${price}`;
      }
      catch { return `- ${sanitizeKb(s.title)}`; }
    }).join('\n');

    const faqText = kb.faqs.slice(0, 10).map(f => {
      try {
        const p = JSON.parse(f.content);
        return `Q: ${sanitizeKb(p.q || f.title)}\nA: ${sanitizeKb(p.a || '', 400)}`;
      }
      catch { return `Q: ${sanitizeKb(f.title)}\nA: ${sanitizeKb(f.content, 400)}`; }
    }).join('\n\n');

    const reviewsText = kb.reviews.slice(0, 5).map(r => `"${sanitizeKb(r.content, 300)}"`).join('\n');
    const diffsText = kb.differentiators.slice(0, 3).map(d => sanitizeKb(d.content)).join('\n');

    const escalateKw = (config.escalate_keywords || HARD_ESCALATE_KEYWORDS).join(', ');
    const tone = config.tone || 'friendly';
    const toneDesc = {
      friendly: 'warm, friendly, and helpful — like a trusted neighbour',
      professional: 'professional and trustworthy — confident and concise',
      expert: 'expert and knowledgeable — authoritative but approachable',
    }[tone] || 'warm and friendly';

    const hoursText = config.business_hours_start && config.business_hours_end
      ? `${config.business_hours_start} – ${config.business_hours_end} (${config.timezone || 'local time'})`
      : 'Standard business hours';

    const afterHours = config.after_hours_message ||
      `Thanks for reaching out! We're currently outside business hours. ${customer.business_name || 'The team'} will get back to you first thing tomorrow morning.`;

    return `You are the AI receptionist for ${customer.business_name || 'this local business'}, a ${customer.industry || 'local service'} business based in ${customer.location || 'the local area'}.

YOUR ROLE:
- Answer customer inquiries about services, pricing, and availability
- Qualify leads and guide them towards booking
- Be concise — this is a chat message, NOT an email (2-5 sentences max)
- Sound like a real local business owner, not a robot
- NEVER make up information not found in this profile

BUSINESS INFORMATION:
Name: ${customer.business_name || 'Local Business'}
Industry: ${customer.industry || 'local services'}
Location: ${customer.location || 'local area'}
Tone: ${toneDesc}
Business hours: ${hoursText}

SERVICES OFFERED:
${servicesText || '(services not yet configured — answer based on industry knowledge)'}

FREQUENTLY ASKED QUESTIONS:
${faqText || '(no FAQs yet)'}

WHAT MAKES US DIFFERENT:
${diffsText || ''}

CUSTOMER REVIEWS:
${reviewsText || ''}

PRICING GUIDANCE:
Always give rough ranges only. Never commit to exact prices without seeing the job.
Always say: "Final price is confirmed after a quick site visit."

BOOKING:
${config.booking_link ? `If customer wants to book: ${config.booking_link}` : 'Ask customer for their availability and say the team will follow up to confirm.'}

AFTER HOURS RESPONSE:
${afterHours}

SEASONAL CONTEXT (current month):
${seasonal ? `It is currently the time for "${seasonal.urgencyTopic}" — reference this naturally if relevant.` : ''}

ESCALATE IMMEDIATELY (do not handle yourself) when customer mentions:
${escalateKw}
Also escalate for: complaints about completed work, legal threats, explicit requests to speak to a human, and emergencies (flood, gas leak, burst pipe, fire).

When escalating, say: "I'm going to connect you directly with [${customer.business_name || 'the team'}] right now. You'll hear from them very shortly."

RULES:
- Keep replies SHORT — 2 to 5 sentences maximum
- No bullet points — write conversational prose
- Always include ONE clear next step
- Never say "I don't know" — say "Let me find out for you" or ask a clarifying question
- Respond in the same language the customer uses`;
  }

  // ── Classify message intent ──────────────────────────────────────
  classifyIntent(message) {
    const lower = (message || '').toLowerCase();

    // Hard escalations first
    for (const kw of HARD_ESCALATE_KEYWORDS) {
      if (lower.includes(kw)) return 'legal';
    }

    const patterns = {
      emergency:         /emergency|urgent|flood|flooding|burst|gas leak|no water|no heat|fire|overflow/i,
      complaint:         /terrible|awful|worst|scam|rip.?off|refund|money back|disappointed|never again/i,
      human_requested:   /speak to|talk to|call me|real person|human|owner|manager|someone/i,
      price_inquiry:     /how much|price|cost|quote|estimate|charge|fee|rate|pricing/i,
      booking_request:   /book|schedule|appointment|come out|visit|available|availability|when can/i,
      service_area_check:/do you (serve|cover|work in)|area|near me|zip|postcode|neighbourhood|city/i,
      faq:               /how do|what is|why is|explain|difference|recommend|advice|tip|help with/i,
    };

    for (const [intent, re] of Object.entries(patterns)) {
      if (re.test(lower)) return intent;
    }
    return 'general';
  }

  // ── Determine if intent + config requires escalation ────────────
  shouldEscalate(intent, message, configEscalateKeywords = []) {
    const escalateIntents = ['emergency', 'complaint', 'legal', 'human_requested'];
    if (escalateIntents.includes(intent)) return true;

    const lower = (message || '').toLowerCase();
    const allKeywords = [...HARD_ESCALATE_KEYWORDS, ...configEscalateKeywords];
    return allKeywords.some(kw => lower.includes(kw.toLowerCase()));
  }

  // ── Generate a response for an incoming DM ──────────────────────
  async generateResponse(customerId, conversationId, newMessage, platform) {
    const systemPrompt = await this.buildSystemPrompt(customerId);
    const intent = this.classifyIntent(newMessage);

    // Fetch last 20 messages for context
    const messagesRes = await this.pool.query(
      `SELECT direction, message_text FROM dm_messages
       WHERE conversation_id=$1 ORDER BY COALESCE(sent_at, created_at) DESC LIMIT 20`,
      [conversationId]
    );
    const history = messagesRes.rows.reverse();

    const conversationContext = history
      .map(m => ({ role: m.direction === 'incoming' ? 'user' : 'assistant', content: m.message_text }));

    // Add the new message
    conversationContext.push({ role: 'user', content: newMessage });

    if (!this.anthropic) throw new Error('AI not configured — ANTHROPIC_API_KEY missing');

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      temperature: 0.4,
      system: systemPrompt,
      messages: conversationContext,
    });

    const reply = response.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();

    const configRes = await this.pool.query(
      `SELECT escalate_keywords FROM receptionist_config WHERE customer_id=$1`, [customerId]
    );
    const escalateKeywords = configRes.rows[0]?.escalate_keywords || [];

    return {
      reply,
      intent,
      shouldEscalate: this.shouldEscalate(intent, newMessage, escalateKeywords),
    };
  }

  // ── Handle incoming message (auto-handle or draft) ───────────────
  async handleIncoming(platform, conversationId, newMessage, customerId) {
    const configRes = await this.pool.query(
      `SELECT * FROM receptionist_config WHERE customer_id=$1`, [customerId]
    );
    const config = configRes.rows[0];

    // Receptionist not configured — skip
    if (!config?.enabled) return { handled: false, reason: 'receptionist_disabled' };

    // Platform not active for this customer
    if (config.active_platforms?.length && !config.active_platforms.includes(platform)) {
      return { handled: false, reason: 'platform_not_active' };
    }

    const { reply, intent, shouldEscalate } = await this.generateResponse(
      customerId, conversationId, newMessage, platform
    );

    if (shouldEscalate) {
      // Update conversation status to escalated
      await this.pool.query(
        `UPDATE dm_conversations SET status='escalated', updated_at=NOW() WHERE id=$1`,
        [conversationId]
      );
      // Create in-app notification for owner
      await this._notifyEscalation(customerId, conversationId, platform, newMessage, intent);
      return { handled: true, escalated: true, intent, reply };
    }

    if (config.auto_handle) {
      // Auto-send: store as outgoing message
      await this.pool.query(
        `INSERT INTO dm_messages (conversation_id, direction, message_text, sent_at, ai_handled)
         VALUES ($1, 'outgoing', $2, NOW(), true)`,
        [conversationId, reply]
      );
      await this.pool.query(
        `UPDATE dm_conversations SET last_message_at=NOW(), is_read=true WHERE id=$1`, [conversationId]
      );
      return { handled: true, autoSent: true, intent, reply };
    }

    // Draft only — store as pending draft (not yet sent)
    await this.pool.query(
      `INSERT INTO dm_messages (conversation_id, direction, message_text, sent_at, ai_handled)
       VALUES ($1, 'draft', $2, NOW(), true)`,
      [conversationId, reply]
    ).catch(() => {
      // dm_messages may not have 'draft' direction — fall back to not storing
    });

    return { handled: true, drafted: true, intent, reply };
  }

  // ── Notify owner of escalation ───────────────────────────────────
  async _notifyEscalation(customerId, conversationId, platform, message, intent) {
    const intentLabels = {
      emergency:       'Emergency situation',
      complaint:       'Customer complaint',
      legal:           'Legal mention — urgent',
      human_requested: 'Customer requesting human',
    };
    const title = intentLabels[intent] || 'Conversation needs attention';
    const body = `${platform} message: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`;

    await this.pool.query(
      `INSERT INTO notifications (customer_id, type, title, message)
       VALUES ($1, 'receptionist_escalation', $2, $3)`,
      [customerId, title, body]
    ).catch(err => console.error('[ReceptionistService] Notification error:', err.message));
  }
}

module.exports = ReceptionistService;
