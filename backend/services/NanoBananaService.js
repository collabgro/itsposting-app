/**
 * NanoBanana Service - Google Gemini 2.5 Flash Image
 * 
 * Fast, low-cost image generation and editing
 * - Cost: ~$0.039 per image (1290 tokens @ $30/M tokens)
 * - Speed: ~3-8 seconds per image
 * - Best for: Product photos, social media images, photo editing
 * 
 * Get API key from: https://aistudio.google.com/app/apikey
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const cloudinary = require('cloudinary').v2;
const industryKnowledge = require('../data/industryKnowledge');

class NanoBananaService {
  constructor() {
    this.apiKey = process.env.GOOGLE_AI_API_KEY;
    
    if (!this.apiKey) {
      console.warn('⚠️  GOOGLE_AI_API_KEY not set - NanoBanana will not work');
    }
    
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }
    
    // Configure Cloudinary if credentials exist
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }
  }

  /**
   * Generate an image from a text prompt
   * @param {Object} customer - Customer object with branding info
   * @param {String} userPrompt - User's description
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - { url, type, model, prompt }
   */
  async generateFromPrompt(customer, userPrompt, options = {}) {
    if (!this.apiKey) {
      throw new Error('NanoBanana not configured. Set GOOGLE_AI_API_KEY in .env');
    }

    const enhancedPrompt = this.enhancePrompt(customer, userPrompt, options);
    console.log('🍌 NanoBanana generating:', enhancedPrompt.substring(0, 100) + '...');

    try {
      const imageBase64 = await this.generateImage(enhancedPrompt);
      const cloudinaryUrl = await this.uploadToCloudinary(imageBase64);

      return {
        url: cloudinaryUrl,
        type: 'image',
        model: 'gemini-2.5-flash-image',
        provider: 'nanobanana',
        prompt: enhancedPrompt,
      };
    } catch (error) {
      console.error('NanoBanana generation error:', error.message);
      throw new Error(`Image generation failed: ${error.message}`);
    }
  }

  /**
   * Generate image for theme-based auto-content
   */
  async generateForTheme(customer, theme, dayOfWeek) {
    const themePrompts = {
      local_highlight: `Professional photograph of ${customer.location || 'a beautiful suburban neighborhood'}, tree-lined streets with well-maintained homes, golden hour lighting, real estate photography style, 8K quality, no text or watermarks`,
      
      service_feature: `Professional photograph of ${customer.industry || 'home services'} work in progress at a residential home in ${customer.location || 'a suburban area'}, clean and impressive results, natural lighting, architectural photography, 8K quality, no text`,
      
      project_showcase: `Before and after transformation of ${customer.industry || 'home services'} project, dramatic improvement, professional documentary photography, 8K resolution, no text or watermarks`,
      
      seasonal_content: `${this.getCurrentSeason()} scene relevant to ${customer.industry || 'home services'} business, warm inviting atmosphere, professional photography, 8K quality, no text`,
      
      maintenance_tip: `Educational photograph showing ${customer.industry || 'home services'} maintenance work, clear and informative, bright lighting, 8K quality, no text`,
    };

    const prompt = themePrompts[theme] || themePrompts.service_feature;
    return this.generateImage(prompt).then(async (imageBase64) => {
      const cloudinaryUrl = await this.uploadToCloudinary(imageBase64);
      return cloudinaryUrl;
    });
  }

  /**
   * Edit an existing image with a text prompt
   * NanoBanana excels at this - conversational image editing
   */
  async editImage(imageUrl, editPrompt) {
    if (!this.apiKey) {
      throw new Error('NanoBanana not configured');
    }

    // SSRF protection — only allow HTTPS URLs to known public hosts
    try {
      const parsed = new URL(imageUrl);
      if (parsed.protocol !== 'https:') throw new Error('Only HTTPS image URLs are allowed');
      const host = parsed.hostname.toLowerCase();
      const BLOCKED = ['localhost', '127.', '0.0.0.0', '169.254.', '10.', '172.16.', '192.168.', '::1', '[::'];
      if (BLOCKED.some(b => host.startsWith(b) || host === b.replace(/\.$/, ''))) {
        throw new Error('Private/internal image URLs are not allowed');
      }
    } catch (e) {
      throw new Error(`Invalid imageUrl: ${e.message}`);
    }

    try {
      // Fetch the image and convert to base64
      const axios = require('axios');
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
      const imageBase64 = Buffer.from(imageResponse.data).toString('base64');
      const mimeType = imageResponse.headers['content-type'] || 'image/jpeg';

      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-preview-image-generation',
      });

      const result = await model.generateContent([
        editPrompt,
        {
          inlineData: {
            data: imageBase64,
            mimeType: mimeType,
          },
        },
      ]);

      const response = result.response;
      const editedImageBase64 = this.extractImageFromResponse(response);
      const cloudinaryUrl = await this.uploadToCloudinary(editedImageBase64);

      return {
        url: cloudinaryUrl,
        type: 'image',
        model: 'gemini-2.5-flash-image',
        provider: 'nanobanana',
      };
    } catch (error) {
      console.error('NanoBanana edit error:', error.message);
      throw new Error(`Image editing failed: ${error.message}`);
    }
  }

  /**
   * Generate carousel slides with consistent style
   */
  async generateCarouselSlides(customer, slidePrompts) {
    const slides = [];
    
    for (let i = 0; i < slidePrompts.length; i++) {
      const slidePrompt = slidePrompts[i];
      console.log(`🍌 Generating slide ${i + 1}/${slidePrompts.length}`);
      
      try {
        const enhancedPrompt = this.enhanceCarouselPrompt(customer, slidePrompt, i + 1);
        const imageBase64 = await this.generateImage(enhancedPrompt);
        const url = await this.uploadToCloudinary(imageBase64);
        
        slides.push({
          slideNumber: i + 1,
          url: url,
          prompt: enhancedPrompt,
        });
      } catch (error) {
        console.error(`Failed to generate slide ${i + 1}:`, error.message);
        throw error;
      }
    }
    
    return slides;
  }

  /**
   * Core image generation function — tries image-capable models in priority order
   * Uses REST API directly (SDK doesn't support responseModalities properly)
   */
  async generateImage(prompt) {
    const axios = require('axios');
    const BASE = 'https://generativelanguage.googleapis.com/v1beta';
    const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey };
    const params  = { key: this.apiKey };

    // Per-model timeout: 12s is enough for a healthy API call.
    // Keeps 4-slide parallel carousel generation well under Railway's 280s limit.
    const MODEL_TIMEOUT = 12000;
    const allErrors = [];

    // Gemini image models — use generateContent + responseModalities.
    // Ordered: most stable / confirmed-working first.
    const geminiImageModels = [
      'gemini-2.0-flash-preview-image-generation', // confirmed stable preview
      'gemini-2.5-flash-preview-image-generation', // 2.5 preview variant
      'gemini-2.5-flash-image',                    // 2.5 stable (if released)
      'gemini-2.0-flash-image',                    // 2.0 stable fallback
    ];

    for (const modelName of geminiImageModels) {
      for (const responseModalities of [['TEXT', 'IMAGE'], ['IMAGE']]) {
        try {
          const response = await axios.post(
            `${BASE}/models/${modelName}:generateContent`,
            { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities } },
            { headers, params, timeout: MODEL_TIMEOUT }
          );
          const candidates = response.data?.candidates || [];
          for (const candidate of candidates) {
            for (const part of (candidate.content?.parts || [])) {
              if (part.inlineData?.data) {
                console.log(`[NanoBanana] ✓ ${modelName} [${responseModalities}]`);
                return part.inlineData.data;
              }
            }
          }
          const reason = candidates[0]?.finishReason;
          const msg = `${modelName} no image (finishReason: ${reason})`;
          console.warn(`[NanoBanana] ${msg}`);
          allErrors.push(msg);
          break; // no error but no image — skip other modality for this model
        } catch (err) {
          const status = err.response?.status;
          const detail = err.response?.data?.error?.message || err.message;
          const msg = `${modelName} ${status || 'err'}: ${detail}`;
          console.warn(`[NanoBanana] ${msg}`);
          allErrors.push(msg);
          break; // any error — break inner loop, try next model
        }
      }
    }

    // Imagen models — use generateImages endpoint (different API shape)
    const imagenModels = [
      'imagen-4.0-fast-generate-001',
      'imagen-4.0-generate-001',
      'imagen-3.0-generate-001',  // Imagen 3 — stable, widely available
    ];

    for (const modelName of imagenModels) {
      try {
        const response = await axios.post(
          `${BASE}/models/${modelName}:generateImages`,
          { prompt, config: { numberOfImages: 1 } },
          { headers, params, timeout: MODEL_TIMEOUT }
        );
        const imageBytes = response.data?.generatedImages?.[0]?.image?.imageBytes;
        if (imageBytes) {
          console.log(`[NanoBanana] ✓ ${modelName} (Imagen)`);
          return imageBytes;
        }
        const msg = `${modelName} returned no imageBytes`;
        console.warn(`[NanoBanana] ${msg}`);
        allErrors.push(msg);
      } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data?.error?.message || err.message;
        const msg = `${modelName} ${status || 'err'}: ${detail}`;
        console.warn(`[NanoBanana] ${msg}`);
        allErrors.push(msg);
      }
    }

    throw new Error(`All image models failed: ${allErrors.slice(0, 3).join(' | ')}`);
  }

  /**
   * Extract image data from Gemini response
   */
  extractImageFromResponse(response) {
    const candidates = response.candidates || [];
    
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      
      for (const part of parts) {
        if (part.inlineData) {
          return part.inlineData.data; // Base64 image data
        }
      }
    }
    
    throw new Error('No image data in response');
  }

  /**
   * Enhance prompt with industry-specific trade photography guidance.
   * Uses industryKnowledge.imageVisuals to make every image feel authentic
   * to the specific trade — not generic stock photography.
   */
  enhancePrompt(customer, userPrompt, options = {}) {
    const industry = customer.industry || 'general_contractor';
    const industryData = industryKnowledge[industry] || industryKnowledge.general_contractor || {};
    const iv = industryData.imageVisuals || {};

    const parts = [userPrompt];

    // 1. Trade-specific photography style — the most impactful addition for realism
    const tradePhotoStyle = this._buildTradePhotoStyle(industry);
    parts.push(tradePhotoStyle);

    // 2. Mood and lighting from industry knowledge
    if (iv.moodAndLighting) {
      parts.push(iv.moodAndLighting);
    }

    // 3. Color palette — grounds Gemini in the real materials of this trade
    if (iv.colorPalette) {
      parts.push(`natural color palette: ${iv.colorPalette}`);
    }

    // 4. Seasonal visual context — makes the image timely and relevant
    const season = this._getCurrentSeason();
    const seasonalVisual = iv.seasonalVisuals?.[season];
    if (seasonalVisual) {
      parts.push(`seasonal context (${season}): ${seasonalVisual}`);
    }

    // 5. Brand colors — from /settings?tab=branding, used for workwear + accent tones
    const brandColors = (() => {
      if (!customer.brand_colors) return null;
      try {
        const c = typeof customer.brand_colors === 'string'
          ? JSON.parse(customer.brand_colors)
          : customer.brand_colors;
        return c?.primary || (typeof c === 'string' ? c : null);
      } catch { return null; }
    })();
    if (brandColors) {
      parts.push(`technician wearing plain solid-color workwear in ${brandColors} (no text, no logos on clothing), vehicle accent color ${brandColors}`);
    }

    // 6. Visual style — adapted to feel authentic to trades (not corporate polished)
    const styleMap = {
      modern:       'clean sharp composition, natural lighting',
      professional: 'sharp focus, well-lit, composed',
      bold:         'high contrast, strong foreground subject, dramatic lighting',
      minimal:      'tight crop, single subject in focus, clean background',
    };
    if (customer.visual_style && styleMap[customer.visual_style]) {
      parts.push(styleMap[customer.visual_style]);
    }

    // 7. Composition and aspect ratio — platform-optimized framing
    if (options.aspectRatio === '9:16') {
      parts.push('vertical 9:16 portrait framing, mobile-first composition, subject fills frame');
    } else if (options.aspectRatio === '16:9') {
      parts.push('horizontal 16:9 widescreen composition, wide establishing shot');
    } else if (options.aspectRatio === '4:5') {
      parts.push('portrait 4:5 framing, optimized for Instagram and Google Business feed');
    } else if (options.aspectRatio === '1:1') {
      parts.push('square 1:1 composition, centered subject, balanced framing');
    } else {
      parts.push('portrait 4:5 framing, optimized for social media feed');
    }

    // 8. Quality markers
    parts.push('sharp focus throughout, high detail, photorealistic');

    // 9. Negative prompt — critical for avoiding the generic stock-photo look
    const clichesToAvoid = iv.avoidCliches?.slice(0, 4).join(', ') || 'generic stock photography, clipart, cartoons, illustrations';
    const finalPrompt = parts.join(', ') +
      `. CRITICAL: No text, words, letters, business names, logos, or brand marks anywhere in the image — not on clothing, uniforms, hats, vehicles, vans, trucks, equipment, tools, or any surface. Workwear must be plain with no embroidery or print. Vehicles must be plain with no decals or signage. No watermarks, signatures, or overlays of any kind. ` +
      `Do not generate: ${clichesToAvoid}.`;

    console.log(`🍌 [NanoBanana] Enhanced prompt for ${industry} (${finalPrompt.length} chars)`);
    return finalPrompt;
  }

  /**
   * Photography style descriptor per trade — tells Gemini what kind of photographer
   * to emulate. This single addition has the biggest impact on image authenticity.
   */
  _buildTradePhotoStyle(industry) {
    const styles = {
      plumbing:           'photorealistic documentary-style trade photography, real licensed plumber actively working on residential job site, authentic not staged',
      hvac:               'photorealistic documentary trade photography, HVAC technician in action at real job site, honest field photography not staged',
      roofing:            'photorealistic outdoor trade photography, roofing crew at work on residential roof, natural daylight, honest job-site feel',
      concrete:           'photorealistic construction photography, concrete work in progress, crew on active job site, natural outdoor lighting',
      landscaping:        'photorealistic outdoor landscaping photography, crew actively working on residential property, natural daylight, real job site',
      electrical:         'photorealistic trade photography, licensed electrician working on real residential electrical system, honest job-site lighting',
      painting:           'photorealistic trade photography, professional painter at work in real residential setting, natural interior or exterior light',
      pest_control:       'photorealistic documentary photography, pest control technician performing treatment at real home, honest outdoor and indoor lighting',
      general_contractor: 'photorealistic construction photography, general contractor or crew at active renovation site, honest job-site lighting',
      cleaning:           'photorealistic documentary photography, professional cleaning team working in real residential home, natural interior lighting',
      tree_service:       'photorealistic outdoor trade photography, arborist crew at work on real residential tree job, natural daylight',
      pressure_washing:   'photorealistic before/after trade photography, pressure washing in progress on real residential surface, natural outdoor lighting',
      pool_spa:           'photorealistic residential pool photography, clear water and authentic pool equipment, natural outdoor daylight',
      handyman:           'photorealistic trade photography, handyman performing real repair work in residential setting, honest natural lighting',
      flooring:           'photorealistic interior trade photography, flooring installation in progress in real home, natural interior lighting',
      junk_removal:       'photorealistic before/after documentary photography, junk removal crew at real residential property, honest natural lighting',
      solar:              'photorealistic exterior trade photography, solar installation crew mounting panels on real residential roof in branded uniforms, panels gleaming in full sun, authentic not staged',
      gutter_cleaning:    'photorealistic exterior trade photography, technician cleaning gutters on real residential home, ladder properly set against fascia, debris removal in progress, natural daylight',
    };
    return styles[industry] || 'photorealistic documentary-style trade photography, real technician at work on residential job site, authentic not staged';
  }

  /**
   * Enhanced prompt for carousel slides — consistent style across all slides
   * while maintaining the trade-authentic feel.
   */
  enhanceCarouselPrompt(customer, slidePrompt, slideNumber) {
    const industry = customer.industry || 'general_contractor';
    const industryData = industryKnowledge[industry] || {};
    const iv = industryData.imageVisuals || {};

    const parts = [`Slide ${slideNumber} of a carousel series: ${slidePrompt}`];

    // Trade photo style for consistency across slides
    parts.push(this._buildTradePhotoStyle(industry));

    // Color palette consistency
    if (iv.colorPalette) {
      parts.push(`consistent color palette throughout series: ${iv.colorPalette}`);
    }

    // Brand color
    const brandColors = (() => {
      if (!customer.brand_colors) return null;
      const c = customer.brand_colors;
      if (typeof c === 'string' && c.trim()) return c.trim();
      if (Array.isArray(c) && c.length > 0) return c[0];
      if (c.primary) return c.primary;
      return null;
    })();
    if (brandColors) {
      parts.push(`brand color ${brandColors} present in technician workwear or equipment`);
    }

    parts.push('square 1:1 composition, sharp focus, consistent lighting style across all slides');
    parts.push('no text, watermarks, or logos');

    return parts.join(', ') + '.';
  }

  /**
   * Upload base64 image to Cloudinary
   */
  async uploadToCloudinary(imageBase64) {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      // Fallback: return data URL if Cloudinary not configured
      return `data:image/png;base64,${imageBase64}`;
    }

    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        `data:image/png;base64,${imageBase64}`,
        {
          folder: 'itsposting/nanobanana',
          quality: 'auto:best',
          fetch_format: 'auto',
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            resolve(result.secure_url);
          }
        }
      );
    });
  }

  /**
   * Helper: Get current season (capitalized — used by theme prompts)
   */
  getCurrentSeason() {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'Spring';
    if (month >= 5 && month <= 7) return 'Summer';
    if (month >= 8 && month <= 10) return 'Fall';
    return 'Winter';
  }

  /**
   * Helper: Get current season lowercase — matches imageVisuals.seasonalVisuals keys
   */
  _getCurrentSeason() {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'fall';
    return 'winter';
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.apiKey) {
      return { status: 'not_configured', error: 'API key missing' };
    }

    try {
      // Try a minimal generation to verify the API works
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      await model.generateContent('test');
      return { status: 'healthy', provider: 'nanobanana' };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }
}

module.exports = NanoBananaService;
