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

    try {
      // Fetch the image and convert to base64
      const axios = require('axios');
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
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

    // Models that actually support image generation output via REST API
    const modelsToTry = [
      'gemini-2.0-flash-preview-image-generation',
      'gemini-2.0-flash-exp-image-generation',
    ];

    let lastError;
    for (const modelName of modelsToTry) {
      try {
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ['IMAGE'] },
          },
          {
            headers: { 'Content-Type': 'application/json' },
            params: { key: this.apiKey },
            timeout: 45000,
          }
        );

        const candidates = response.data?.candidates || [];
        for (const candidate of candidates) {
          const parts = candidate.content?.parts || [];
          for (const part of parts) {
            if (part.inlineData?.data) {
              console.log(`[NanoBanana] ✓ Image generated with model: ${modelName}`);
              return part.inlineData.data;
            }
          }
        }

        const finishReason = candidates[0]?.finishReason;
        console.warn(`[NanoBanana] ${modelName} returned no image. finishReason: ${finishReason}`);
        lastError = new Error(`${modelName}: no image data (finishReason: ${finishReason || 'unknown'})`);
      } catch (err) {
        const detail = err.response?.data?.error?.message || err.message;
        console.warn(`[NanoBanana] ${modelName} failed (${err.response?.status || 'network'}):`, detail);
        lastError = new Error(`${modelName}: ${detail}`);
      }
    }

    throw lastError || new Error('All image generation models failed');
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
   * Enhance prompt with branding and quality modifiers
   */
  enhancePrompt(customer, userPrompt, options = {}) {
    let enhanced = userPrompt;

    // Add quality modifiers if missing
    if (!userPrompt.toLowerCase().includes('professional')) {
      enhanced += ', professional photography';
    }
    if (!userPrompt.toLowerCase().includes('quality') && !userPrompt.toLowerCase().includes('8k')) {
      enhanced += ', high quality, 8K resolution';
    }

    // Add style based on visual_style
    const stylePrompts = {
      modern: 'modern aesthetic, clean composition, bright lighting',
      professional: 'professional polished look, sharp focus, well-lit',
      bold: 'bold dramatic composition, vibrant colors, high contrast',
      minimal: 'minimalist composition, clean background, simple',
    };

    if (customer.visual_style && stylePrompts[customer.visual_style]) {
      enhanced += `, ${stylePrompts[customer.visual_style]}`;
    }

    // Add aspect ratio hint
    if (options.aspectRatio === '9:16') {
      enhanced += ', vertical portrait orientation';
    } else if (options.aspectRatio === '16:9') {
      enhanced += ', horizontal landscape orientation';
    } else {
      enhanced += ', square 1:1 composition';
    }

    // Always exclude unwanted elements
    enhanced += '. Do not include any text, watermarks, signatures, or logos.';

    return enhanced;
  }

  /**
   * Enhanced prompt for carousel slides (maintains consistency)
   */
  enhanceCarouselPrompt(customer, slidePrompt, slideNumber) {
    let enhanced = `Slide ${slideNumber} of carousel: ${slidePrompt}`;
    
    // Maintain consistent style across slides
    enhanced += `, consistent visual style with brand colors`;
    
    if (customer.brand_colors?.primary) {
      enhanced += `, color palette featuring ${customer.brand_colors.primary}`;
    }

    enhanced += ', professional photography, high quality, square 1:1 composition, no text or watermarks';

    return enhanced;
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
   * Helper: Get current season
   */
  getCurrentSeason() {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'Spring';
    if (month >= 5 && month <= 7) return 'Summer';
    if (month >= 8 && month <= 10) return 'Fall';
    return 'Winter';
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
