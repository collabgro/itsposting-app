/**
 * HeyGen Service - AI Avatar Video Generation
 * Cost: ~$0.20 per video (30-60 seconds)
 */

const axios = require('axios');
const cloudinary = require('cloudinary').v2;

class HeyGenService {
  constructor() {
    this.apiKey = process.env.HEYGEN_API_KEY;
    this.baseUrl = 'https://api.heygen.com/v2';

    if (!this.apiKey) {
      console.warn('⚠️  HEYGEN_API_KEY not set - video generation will not work');
    }

    if (process.env.CLOUDINARY_CLOUD_NAME) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }
  }

  async generateFromScript(customer, script, options = {}) {
    if (!this.apiKey) {
      throw new Error('HeyGen not configured. Set HEYGEN_API_KEY in .env');
    }

    try {
      console.log('🎥 HeyGen generating video...');
      const videoId = await this.createVideo(customer, script, options);
      const videoUrl = await this.waitForVideo(videoId);
      const cloudinaryUrl = await this.uploadToCloudinary(videoUrl);

      return {
        url: cloudinaryUrl,
        type: 'video',
        model: 'heygen-v2',
        provider: 'heygen',
      };
    } catch (error) {
      console.error('HeyGen error:', error.response?.data || error.message);
      throw new Error(`Video generation failed: ${error.message}`);
    }
  }

  async createVideo(customer, script, options = {}) {
    const payload = {
      video_inputs: [
        {
          character: {
            type: 'avatar',
            avatar_id: customer.avatar_id || 'Anna_public_3_20240108',
            avatar_style: 'normal',
          },
          voice: {
            type: 'text',
            input_text: script,
            voice_id: customer.voice_id || 'en-US-JennyNeural',
          },
          background: {
            type: 'color',
            value: customer.brand_colors?.primary || '#3B82F6',
          },
        },
      ],
      dimension: { width: 1080, height: 1920 },
      aspect_ratio: options.aspectRatio || '9:16',
      test: false,
    };

    const response = await axios.post(`${this.baseUrl}/video/generate`, payload, {
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    return response.data.data?.video_id || response.data.video_id;
  }

  async waitForVideo(videoId, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await axios.get(`${this.baseUrl}/video/${videoId}`, {
          headers: { 'X-Api-Key': this.apiKey },
        });

        const status = response.data.data?.status || response.data.status;
        if (status === 'completed') {
          return response.data.data?.video_url || response.data.video_url;
        }
        if (status === 'failed') throw new Error('Video generation failed');

        await new Promise((r) => setTimeout(r, 5000));
      } catch (error) {
        if (i >= maxAttempts - 1) throw error;
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    throw new Error('Video generation timeout');
  }

  // Single status check — no polling loop, safe to call from a status endpoint
  async checkVideoStatus(videoId) {
    const response = await axios.get(`${this.baseUrl}/video/${videoId}`, {
      headers: { 'X-Api-Key': this.apiKey },
    });
    const data = response.data.data || response.data;
    return {
      status: data.status,          // 'pending' | 'processing' | 'completed' | 'failed'
      videoUrl: data.video_url || null,
    };
  }

  async uploadToCloudinary(videoUrl) {
    if (!process.env.CLOUDINARY_CLOUD_NAME) return videoUrl;

    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        videoUrl,
        {
          resource_type: 'video',
          folder: 'itsposting/videos',
          quality: 'auto:best',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result.secure_url);
        }
      );
    });
  }
}

module.exports = HeyGenService;
