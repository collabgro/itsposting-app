/**
 * Claude Service - Anthropic Claude AI
 * Used for: caption generation, carousel planning, video scripts, hashtag generation
 */

const Anthropic = require('@anthropic-ai/sdk');

class ClaudeService {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!this.apiKey) {
      console.warn('⚠️  ANTHROPIC_API_KEY not set');
    }
    
    this.client = this.apiKey ? new Anthropic({ apiKey: this.apiKey }) : null;
    this.model = 'claude-haiku-4-5';
  }

  /**
   * Generate a caption for a social media post
   */
  async generateCaption(customer, prompt, contentType = 'photo', platform = 'instagram') {
    if (!this.client) {
      throw new Error('Claude not configured. Set ANTHROPIC_API_KEY in .env');
    }

    let websiteContext = '';
    if (customer.website_services) {
      const services = Array.isArray(customer.website_services)
        ? customer.website_services
        : JSON.parse(customer.website_services);
      if (services.length > 0)
        websiteContext += `\n\nActual services this business offers (from their website):\n${services.slice(0, 10).map((s) => `- ${s}`).join('\n')}`;
    }
    if (customer.website_about)
      websiteContext += `\n\nAbout this business:\n${customer.website_about.substring(0, 500)}`;

    const systemPrompt = `You are a social media copywriter for ${customer.business_name || 'a local business'}, 
a ${customer.industry || 'service'} business located in ${customer.location || 'the local area'}.

Brand tone: ${customer.tone || 'professional'}
Visual style: ${customer.visual_style || 'modern'}${websiteContext}

Write captions that are:
- Authentic and engaging
- Reference the ACTUAL services/details above when relevant (don't invent things)
- Appropriate for ${platform}
- Include 1-2 relevant emojis
- End with a call-to-action when appropriate
- Match the ${customer.tone || 'professional'} tone

Respond with JSON:
{
  "caption": "the caption text",
  "hashtags": ["hashtag1", "hashtag2", ...],
  "overlay_text": "short text for image overlay (only for static cards, max 8 words)"
}`;

    const userPrompt = `Create a ${contentType} post about: ${prompt}

Platform: ${platform}
Caption length: ${this.getCaptionLength(platform)}

Return ONLY valid JSON.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const text = response.content[0].text;
      const cleaned = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        caption: parsed.caption,
        hashtags: parsed.hashtags || [],
        overlay_text: parsed.overlay_text || '',
        model: this.model,
      };
    } catch (error) {
      console.error('Claude caption error:', error.message);
      throw new Error(`Caption generation failed: ${error.message}`);
    }
  }

  /**
   * Plan a 5-slide carousel
   */
  async planCarousel(customer, prompt) {
    if (!this.client) {
      throw new Error('Claude not configured');
    }

    const systemPrompt = `You are a social media strategist for ${customer.business_name || 'a local business'}.
Plan engaging 5-slide carousel posts that educate or entertain.`;

    const userPrompt = `Plan a 5-slide carousel about: ${prompt}

Industry: ${customer.industry}
Tone: ${customer.tone}

Return ONLY valid JSON:
{
  "main_caption": "the post caption",
  "hashtags": ["tag1", "tag2", ...],
  "slides": [
    { "slide_number": 1, "title": "Hook", "image_prompt": "image description", "overlay_text": "short overlay" },
    { "slide_number": 2, "title": "Point 1", "image_prompt": "...", "overlay_text": "..." },
    { "slide_number": 3, "title": "Point 2", "image_prompt": "...", "overlay_text": "..." },
    { "slide_number": 4, "title": "Point 3", "image_prompt": "...", "overlay_text": "..." },
    { "slide_number": 5, "title": "CTA", "image_prompt": "...", "overlay_text": "..." }
  ]
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const text = response.content[0].text;
      const cleaned = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('Claude carousel error:', error.message);
      throw new Error(`Carousel planning failed: ${error.message}`);
    }
  }

  /**
   * Generate video script
   */
  async generateVideoScript(customer, prompt, durationSeconds = 30) {
    if (!this.client) {
      throw new Error('Claude not configured');
    }

    const wordCount = Math.floor((durationSeconds * 2.5) - 5); // ~2.5 words per second

    const systemPrompt = `You are a video script writer for ${customer.business_name}, a ${customer.industry} business.`;

    const userPrompt = `Write a ${durationSeconds}-second video script about: ${prompt}

Target word count: ${wordCount} words
Tone: ${customer.tone}

Return ONLY valid JSON:
{
  "script": "the spoken script",
  "caption": "post caption when sharing",
  "hashtags": ["tag1", "tag2", ...]
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const text = response.content[0].text;
      const cleaned = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('Claude script error:', error.message);
      throw new Error(`Script generation failed: ${error.message}`);
    }
  }

  /**
   * Generate weekly content plan (batched)
   */
  async generateWeekPlan(customer) {
    if (!this.client) {
      throw new Error('Claude not configured');
    }

    const systemPrompt = `You are a social media strategist for ${customer.business_name || 'a local business'}.`;

    const userPrompt = `Create a 7-day social media content plan for:
- Business: ${customer.business_name}
- Industry: ${customer.industry}
- Location: ${customer.location}
- Tone: ${customer.tone}

Return ONLY valid JSON with 7 posts (one per day):
{
  "week_plan": [
    {
      "day": 1,
      "day_name": "Monday",
      "theme": "local_highlight",
      "content_type": "photo",
      "caption": "...",
      "image_prompt": "...",
      "hashtags": ["...", "..."]
    },
    ...
  ]
}

Daily themes: Mon=local_highlight, Tue=service_feature, Wed=maintenance_tip, Thu=project_showcase, Fri=customer_value, Sat=seasonal, Sun=faq`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const text = response.content[0].text;
      const cleaned = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('Claude week plan error:', error.message);
      throw new Error(`Week plan generation failed: ${error.message}`);
    }
  }

  /**
   * Get appropriate caption length per platform
   */
  getCaptionLength(platform) {
    const lengths = {
      instagram: '125-150 words',
      facebook: '40-80 words',
      google_business: '100-150 words',
      twitter: '20-25 words',
    };
    return lengths[platform] || '100 words';
  }
}

module.exports = ClaudeService;
