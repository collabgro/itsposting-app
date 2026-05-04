/**
 * ManualContentGenerator - Orchestrates all AI services
 * 
 * Smart provider selection:
 * - Default: NanoBanana (cheap & fast)
 * - Fallback: Midjourney (if NanoBanana fails)
 * - Customer preference: Read from customer.preferred_image_provider
 */

const ClaudeService = require('./ClaudeService');
const NanoBananaService = require('./NanoBananaService');
const MidjourneyService = require('./MidjourneyService');
const HeyGenService = require('./HeyGenService');

const CREDIT_COSTS = {
  static: 1,
  photo: 3,
  carousel: 5,
  video: 10,
};

class ManualContentGenerator {
  constructor(pool) {
    this.pool = pool;
    this.claude = new ClaudeService();
    this.nanobanana = new NanoBananaService();
    this.midjourney = new MidjourneyService();
    this.heygen = new HeyGenService();
  }

  /**
   * Get the appropriate image service based on customer preference and availability
   */
  getImageService(customer) {
    const preference = customer.preferred_image_provider || process.env.IMAGE_PROVIDER || 'nanobanana';

    if (preference === 'midjourney' && process.env.REPLICATE_API_TOKEN) {
      return { service: this.midjourney, name: 'midjourney' };
    }

    if (process.env.GOOGLE_AI_API_KEY) {
      return { service: this.nanobanana, name: 'nanobanana' };
    }

    if (process.env.REPLICATE_API_TOKEN) {
      return { service: this.midjourney, name: 'midjourney' };
    }

    throw new Error('No image generation service configured. Set GOOGLE_AI_API_KEY or REPLICATE_API_TOKEN');
  }

  /**
   * Generate content from user prompt
   */
  async generateFromPrompt(customerId, contentType, prompt, options = {}) {
    // 1. Validate credits
    const customer = await this.getCustomer(customerId);
    const creditCost = CREDIT_COSTS[contentType];

    if (!creditCost) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    if (customer.credits_balance < creditCost) {
      throw new Error(`Insufficient credits. Need ${creditCost}, have ${customer.credits_balance}`);
    }

    // 2. Generate based on type
    let result;
    switch (contentType) {
      case 'static':
        result = await this.generateStatic(customer, prompt);
        break;
      case 'photo':
        result = await this.generatePhoto(customer, prompt, options);
        break;
      case 'carousel':
        result = await this.generateCarousel(customer, prompt, options);
        break;
      case 'video':
        result = await this.generateVideo(customer, prompt, options);
        break;
      default:
        throw new Error(`Unsupported content type: ${contentType}`);
    }

    // 3. Save to database & deduct credits
    const post = await this.savePost(customer, contentType, prompt, result, creditCost);

    return {
      ...result,
      postId: post.id,
      creditsUsed: creditCost,
      creditsRemaining: customer.credits_balance - creditCost,
    };
  }

  /**
   * Generate static text card (with overlay text on color background)
   */
  async generateStatic(customer, prompt) {
    const captionData = await this.claude.generateCaption(customer, prompt, 'static', 'instagram');

    // For static cards, we use NanoBanana to create a styled background
    // OR we could use a simple HTML-to-image render (puppeteer)
    const imageService = this.getImageService(customer);
    
    const backgroundPrompt = `Beautiful gradient background using brand colors ${customer.brand_colors?.primary || 'blue'} and ${customer.brand_colors?.secondary || 'green'}, abstract elegant design, 1080x1080 square, no text, professional`;
    
    const imageResult = await imageService.service.generateFromPrompt(customer, backgroundPrompt);

    return {
      contentType: 'static',
      caption: captionData.caption,
      hashtags: captionData.hashtags,
      overlayText: captionData.overlay_text,
      mediaUrl: imageResult.url,
      provider: imageResult.provider,
      model: imageResult.model,
    };
  }

  /**
   * Generate photo post
   */
  async generatePhoto(customer, prompt, options) {
    const imageService = this.getImageService(customer);
    console.log(`📷 Using ${imageService.name} for photo generation`);

    // Generate caption and image in parallel
    const [captionData, imageResult] = await Promise.all([
      this.claude.generateCaption(customer, prompt, 'photo', 'instagram'),
      imageService.service.generateFromPrompt(customer, prompt, options),
    ]);

    return {
      contentType: 'photo',
      caption: captionData.caption,
      hashtags: captionData.hashtags,
      mediaUrl: imageResult.url,
      provider: imageResult.provider,
      model: imageResult.model,
    };
  }

  /**
   * Generate carousel (5 slides)
   */
  async generateCarousel(customer, prompt, options) {
    const imageService = this.getImageService(customer);
    console.log(`📊 Using ${imageService.name} for carousel generation`);

    // 1. Plan the carousel with Claude
    const plan = await this.claude.planCarousel(customer, prompt);

    // 2. Generate all 5 slide images
    const slidePrompts = plan.slides.map((s) => s.image_prompt);
    let slides = [];

    if (imageService.name === 'nanobanana') {
      // NanoBanana has a batch method
      slides = await this.nanobanana.generateCarouselSlides(customer, slidePrompts);
    } else {
      // Midjourney - generate one by one
      for (let i = 0; i < slidePrompts.length; i++) {
        const result = await imageService.service.generateFromPrompt(customer, slidePrompts[i]);
        slides.push({ slideNumber: i + 1, url: result.url });
      }
    }

    // 3. Combine slide info
    const enrichedSlides = plan.slides.map((slide, idx) => ({
      ...slide,
      mediaUrl: slides[idx]?.url,
    }));

    return {
      contentType: 'carousel',
      caption: plan.main_caption,
      hashtags: plan.hashtags,
      slides: enrichedSlides,
      mediaUrl: slides[0]?.url, // First slide as thumbnail
      provider: imageService.name,
    };
  }

  /**
   * Generate video
   */
  async generateVideo(customer, prompt, options) {
    // 1. Generate script with Claude
    const scriptData = await this.claude.generateVideoScript(customer, prompt, options.duration || 30);

    // 2. Generate video with HeyGen
    const videoResult = await this.heygen.generateFromScript(customer, scriptData.script, options);

    return {
      contentType: 'video',
      caption: scriptData.caption,
      hashtags: scriptData.hashtags,
      script: scriptData.script,
      mediaUrl: videoResult.url,
      provider: 'heygen',
      model: videoResult.model,
    };
  }

  /**
   * Save post to database & deduct credits
   */
  async savePost(customer, contentType, prompt, result, creditCost) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Insert post
      const postResult = await client.query(
        `INSERT INTO posts (
          customer_id, content_type, caption, hashtags, media_url, 
          overlay_text, prompt, generation_method, ai_model_used,
          image_provider, status, credits_used
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          customer.id,
          contentType,
          result.caption,
          JSON.stringify(result.hashtags || []),
          result.mediaUrl,
          result.overlayText || null,
          prompt,
          'manual',
          result.model || 'unknown',
          result.provider || 'unknown',
          'draft',
          creditCost,
        ]
      );

      const post = postResult.rows[0];

      // Save carousel slides if applicable
      if (contentType === 'carousel' && result.slides) {
        for (const slide of result.slides) {
          await client.query(
            `INSERT INTO post_carousel_slides 
            (post_id, slide_number, media_url, caption, overlay_text)
            VALUES ($1, $2, $3, $4, $5)`,
            [post.id, slide.slide_number, slide.mediaUrl, slide.title, slide.overlay_text]
          );
        }
      }

      // Deduct credits
      const newBalance = customer.credits_balance - creditCost;
      await client.query(
        `UPDATE customers 
        SET credits_balance = $1, 
            credits_used_this_month = credits_used_this_month + $2
        WHERE id = $3`,
        [newBalance, creditCost, customer.id]
      );

      // Log transaction
      await client.query(
        `INSERT INTO credit_transactions 
        (customer_id, post_id, transaction_type, amount, balance_after, description)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          customer.id,
          post.id,
          'debit',
          -creditCost,
          newBalance,
          `Generated ${contentType} post`,
        ]
      );

      await client.query('COMMIT');
      return post;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getCustomer(customerId) {
    const result = await this.pool.query(
      'SELECT * FROM customers WHERE id = $1',
      [customerId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Customer not found');
    }
    
    return result.rows[0];
  }
}

module.exports = ManualContentGenerator;
