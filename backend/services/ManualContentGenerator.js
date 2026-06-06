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
const VideoService = require('./VideoService');

let ImageResizer;
try {
  ImageResizer = require('./ImageResizer');
} catch {
  ImageResizer = null;
}

const CREDIT_COSTS = {
  static: 1,
  photo: 3,
  carousel: 5,
  video: 10,
};

class ManualContentGenerator {
  constructor(pool) {
    this.pool = pool;
    this.claude = new ClaudeService(pool);
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

    return null;
  }

  /**
   * Generate content from user prompt
   */
  async generateFromPrompt(customerId, contentType, prompt, options = {}, billingCustomerId = null) {
    // 1. Validate credits — always check against the billing account (parent if workspace)
    const effectiveBillingId = billingCustomerId || customerId;
    const billingCustomer = effectiveBillingId !== customerId
      ? await this.getCustomer(effectiveBillingId)
      : null;

    const customer = await this.getCustomer(customerId);
    const creditCost = CREDIT_COSTS[contentType];

    if (!creditCost) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    const creditsSource = billingCustomer || customer;
    if (creditsSource.credits_balance < creditCost) {
      throw new Error(`Insufficient credits. Need ${creditCost}, have ${creditsSource.credits_balance}`);
    }

    // Resolve platforms — frontend may send platforms[] or platform string
    const platformsArr = Array.isArray(options.platforms)
      ? options.platforms
      : (options.platform ? [options.platform] : ['facebook']);
    const primaryPlatform = platformsArr[0] || 'facebook';
    // When multiple platforms selected, use 'all' so Claude writes one variation per platform
    const effectivePlatform = platformsArr.length > 1 ? 'all' : primaryPlatform;
    const opts = { ...options, platform: effectivePlatform };

    // 2. Generate based on type
    let result;
    switch (contentType) {
      case 'static':
        result = await this.generateStatic(customer, prompt, opts);
        break;
      case 'photo':
        result = await this.generatePhoto(customer, prompt, opts);
        break;
      case 'carousel':
        result = await this.generateCarousel(customer, prompt, opts);
        break;
      case 'video':
        result = await this.generateVideo(customer, prompt, opts);
        break;
      default:
        throw new Error(`Unsupported content type: ${contentType}`);
    }

    // 3. Save to database & deduct credits from billing account
    const post = await this.savePost(customer, contentType, prompt, result, creditCost, platformsArr, primaryPlatform, effectiveBillingId);

    // 4. Persist A/B/C variations to post_variations table (non-fatal if fails)
    if (result.variations && post.id) {
      this.claude.saveVariations(post.id, result.variations).catch((err) => {
        console.error('[ManualContentGenerator] saveVariations failed (non-fatal):', err.message);
      });
    }

    return {
      ...result,
      postId: post.id,
      creditsUsed: creditCost,
      creditsRemaining: creditsSource.credits_balance - creditCost,
    };
  }

  /**
   * Generate static text card (with overlay text on color background)
   */
  async generateStatic(customer, prompt, options = {}) {
    const captionData = await this.claude.generateCaption(
      customer, prompt, 'static', options.platform || 'instagram', options.wizardTrigger || null
    );

    return {
      contentType: 'static',
      caption: captionData.caption,
      hashtags: captionData.hashtags,
      overlayText: captionData.overlay_text,
      mediaUrl: null,
      variations: captionData.variations || null,
      imagePrompt: null,
    };
  }

  /**
   * Generate photo post
   */
  async generatePhoto(customer, prompt, options = {}) {
    const imageService = this.getImageService(customer);
    if (imageService) {
      console.log(`📷 Using ${imageService.name} for photo generation`);
    } else {
      console.warn('[ManualContentGenerator] No image service configured for photo generation');
    }

    // Caption first — Claude's imagePrompt is richer than the raw user prompt
    const captionData = await this.claude.generateCaption(
      customer, prompt, 'photo', options.platform || 'instagram', options.wizardTrigger || null
    );

    const imageGenPrompt = captionData.imagePrompt || prompt;
    let imageResult = null;
    if (imageService) {
      try {
        imageResult = await imageService.service.generateFromPrompt(
          customer, imageGenPrompt, { ...options, aspectRatio: '4:5' }
        );
      } catch (err) {
        console.error('[ManualContentGenerator] photo image generation failed:', err.message || err);
      }
    }

    // Resize to exact 1080×1350 (same pipeline as wizard)
    let mediaUrl = imageResult?.url || null;
    let mediaVariants = {};
    if (imageResult?.url && ImageResizer) {
      try {
        const variants = await ImageResizer.uploadResizedImages(
          imageResult.url,
          `content-${Date.now()}`,
          customer.id
        );
        mediaUrl = variants.instagram_feed || variants.original || imageResult.url;
        mediaVariants = variants;
      } catch (resizerErr) {
        console.warn('[ManualContentGenerator] ImageResizer failed — using original URL:', resizerErr.message);
      }
    }

    return {
      contentType: 'photo',
      caption: captionData.caption,
      hashtags: captionData.hashtags,
      mediaUrl,
      mediaVariants,
      provider: imageResult?.provider || imageService?.name || 'none',
      model: imageResult?.model || null,
      variations: captionData.variations || null,
      imagePrompt: imageGenPrompt,
      engagementQuestion: captionData.engagementQuestion || '',
    };
  }

  /**
   * Generate carousel (5 slides)
   */
  async generateCarousel(customer, prompt, options) {
    const imageService = this.getImageService(customer);
    if (imageService) {
      console.log(`📊 Using ${imageService.name} for carousel generation`);
    } else {
      console.warn('[ManualContentGenerator] No image service configured for carousel generation');
    }

    // 1. Plan the carousel with Claude
    const plan = await this.claude.planCarousel(customer, prompt);

    // 2. Generate all 5 slide images if possible
    const slidePrompts = plan.slides.map((s) => s.image_prompt);
    let slides = [];

    if (imageService) {
      try {
        if (imageService.name === 'nanobanana') {
          slides = await this.nanobanana.generateCarouselSlides(customer, slidePrompts);
        } else {
          for (let i = 0; i < slidePrompts.length; i++) {
            const result = await imageService.service.generateFromPrompt(customer, slidePrompts[i]);
            slides.push({ slideNumber: i + 1, url: result.url });
          }
        }
      } catch (err) {
        console.error('[ManualContentGenerator] carousel image generation failed:', err.message || err);
        slides = [];
      }
    }

    const enrichedSlides = plan.slides.map((slide, idx) => ({
      ...slide,
      mediaUrl: slides[idx]?.url || null,
    }));

    return {
      contentType: 'carousel',
      caption: plan.main_caption,
      hashtags: plan.hashtags,
      slides: enrichedSlides,
      mediaUrl: slides[0]?.url || null,
      provider: imageService?.name || 'none',
    };
  }

  /**
   * Generate video — routes to avatar (HeyGen) or services (NanoBanana → Veo) via VideoService
   */
  async generateVideo(customer, prompt, options = {}) {
    // 1. Generate script with Claude
    const scriptData = await this.claude.generateVideoScript(customer, prompt, options.duration || 30);

    const videoService = new VideoService();
    const videoType = options.videoType || 'services';
    const aspectRatio = options.aspectRatio || '9:16';
    const imagePrompt = `Professional ${customer.industry || 'home services'} business scene: ${scriptData.script.substring(0, 120)}`;

    let videoResult = null;
    try {
      videoResult = await videoService.generate(customer, scriptData.script, {
        videoType,
        imagePrompt,
        aspectRatio,
        durationSeconds: 7,
      });
    } catch (err) {
      console.error('[ManualContentGenerator] Video generation failed:', err.message || err);
    }

    return {
      contentType: 'video',
      caption: scriptData.caption,
      hashtags: scriptData.hashtags,
      script: scriptData.script,
      mediaUrl: videoResult?.url || null,
      provider: videoResult?.provider || 'none',
      model: videoResult?.model || null,
      videoError: videoResult ? null : 'Video generation unavailable. Please try again or contact support.',
    };
  }

  /**
   * Save post to database & deduct credits
   */
  async savePost(customer, contentType, prompt, result, creditCost, platforms = ['facebook'], primaryPlatform = 'facebook', billingCustomerId = null) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Insert post
      const postResult = await client.query(
        `INSERT INTO posts (
          customer_id, content_type, caption, hashtags, media_url,
          overlay_text, prompt, generation_method, ai_model_used,
          image_provider, platform, platforms, status, credits_used
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
          result.model || 'claude-sonnet-4-6',
          result.provider || 'unknown',
          primaryPlatform,
          JSON.stringify(platforms),
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

      // Deduct credits from billing account (parent if workspace, else same customer)
      const creditAccountId = billingCustomerId || customer.id;
      const balanceRow = await client.query(
        `SELECT credits_balance FROM customers WHERE id = $1`,
        [creditAccountId]
      );
      const currentBalance = balanceRow.rows[0]?.credits_balance || 0;
      const newBalance = currentBalance - creditCost;
      await client.query(
        `UPDATE customers
        SET credits_balance = $1,
            credits_used_this_month = credits_used_this_month + $2
        WHERE id = $3`,
        [newBalance, creditCost, creditAccountId]
      );

      // Log transaction
      await client.query(
        `INSERT INTO credit_transactions
        (customer_id, post_id, transaction_type, amount, balance_after, description)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          creditAccountId,
          post.id,
          'debit',
          -creditCost,
          newBalance,
          `Generated ${contentType} post`,
        ]
      );

      await client.query('COMMIT');

      // Auto-save generated media to Media Library (non-blocking)
      if (result.mediaUrl) {
        this._autoSaveToMediaLibrary(customer.id, result.mediaUrl, contentType).catch(() => {});
      }

      return post;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async _autoSaveToMediaLibrary(customerId, mediaUrl, contentType) {
    try {
      const match = mediaUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
      const publicId = match ? match[1] : mediaUrl;
      const isVideo = contentType === 'video';
      await this.pool.query(
        `INSERT INTO media_library
           (customer_id, cloudinary_public_id, url, thumbnail_url, file_name, file_type, mime_type,
            file_size_bytes, folder, created_at)
         VALUES ($1,$2,$3,$3,$4,$5,$6,0,'AI Generated',NOW())
         ON CONFLICT DO NOTHING`,
        [
          customerId, publicId, mediaUrl,
          `AI Generated — ${new Date().toISOString().slice(0, 10)}`,
          isVideo ? 'video' : 'image',
          isVideo ? 'video/mp4' : 'image/jpeg',
        ]
      );
    } catch (e) {
      console.warn('[ContentGenerator] Auto-save to media_library failed (non-fatal):', e.message);
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
