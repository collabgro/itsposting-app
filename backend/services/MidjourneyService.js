/**
 * Midjourney Service - via Replicate
 * Alternative image generation - higher quality but more expensive
 * Cost: ~$0.08 per image
 * Speed: ~15-20 seconds
 */

const axios = require('axios');
const cloudinary = require('cloudinary').v2;

class MidjourneyService {
  constructor() {
    this.replicateToken = process.env.REPLICATE_API_TOKEN;
    this.baseUrl = 'https://api.replicate.com/v1';
    
    if (!this.replicateToken) {
      console.warn('⚠️  REPLICATE_API_TOKEN not set - Midjourney will not work');
    }

    if (process.env.CLOUDINARY_CLOUD_NAME) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }
  }

  async generateFromPrompt(customer, userPrompt, options = {}) {
    if (!this.replicateToken) {
      throw new Error('Midjourney not configured. Set REPLICATE_API_TOKEN in .env');
    }

    const enhancedPrompt = this.enhancePrompt(customer, userPrompt, options);
    const imageUrl = await this.generateImage(enhancedPrompt, options);

    return {
      url: imageUrl,
      type: 'image',
      model: 'midjourney',
      provider: 'midjourney',
      prompt: enhancedPrompt,
    };
  }

  enhancePrompt(customer, userPrompt, options = {}) {
    let enhanced = userPrompt;
    if (!userPrompt.toLowerCase().includes('professional')) {
      enhanced += ', professional photography';
    }
    if (!userPrompt.toLowerCase().includes('quality')) {
      enhanced += ', high quality, 8K';
    }
    enhanced += ', no text, no watermarks';
    return enhanced;
  }

  async generateImage(prompt, options = {}) {
    try {
      console.log('🎨 Midjourney generating...');

      const prediction = await axios.post(
        `${this.baseUrl}/predictions`,
        {
          version: '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
          input: {
            prompt: prompt,
            aspect_ratio: options.aspectRatio || '1:1',
            output_quality: 95,
            output_format: 'jpg',
          },
        },
        {
          headers: {
            Authorization: `Token ${this.replicateToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const imageUrl = await this.waitForCompletion(prediction.data.id);
      const cloudinaryUrl = await this.uploadToCloudinary(imageUrl);

      return cloudinaryUrl;
    } catch (error) {
      console.error('Midjourney error:', error.response?.data || error.message);
      throw new Error(`Image generation failed: ${error.message}`);
    }
  }

  async waitForCompletion(predictionId, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await axios.get(`${this.baseUrl}/predictions/${predictionId}`, {
        headers: { Authorization: `Token ${this.replicateToken}` },
      });

      const status = response.data.status;
      if (status === 'succeeded') return response.data.output[0];
      if (status === 'failed' || status === 'canceled') {
        throw new Error(`Generation failed: ${status}`);
      }

      await new Promise((r) => setTimeout(r, 5000));
    }
    throw new Error('Generation timeout');
  }

  async uploadToCloudinary(imageUrl) {
    if (!process.env.CLOUDINARY_CLOUD_NAME) return imageUrl;

    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        imageUrl,
        { folder: 'itsposting/midjourney', quality: 'auto:best' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result.secure_url);
        }
      );
    });
  }
}

module.exports = MidjourneyService;
