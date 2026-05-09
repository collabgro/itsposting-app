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
    this._cachedVoiceId = null;

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

  // Fetch a valid HeyGen voice ID — caches result so API is only called once per process
  async getDefaultVoiceId() {
    if (this._cachedVoiceId) return this._cachedVoiceId;
    try {
      const response = await axios.get(`${this.baseUrl}/voices`, {
        headers: { 'X-Api-Key': this.apiKey },
        timeout: 8000,
      });
      const voices = response.data.data?.voices || response.data.voices || [];
      // Prefer US English female voice
      const pick = voices.find(v =>
        (v.locale || '').startsWith('en-US') && (v.gender || '').toLowerCase() === 'female'
      ) || voices.find(v => (v.locale || '').startsWith('en')) || voices[0];
      if (pick?.voice_id) {
        console.log('[HeyGen] Using voice:', pick.name || pick.voice_id);
        this._cachedVoiceId = pick.voice_id;
        return pick.voice_id;
      }
    } catch (err) {
      console.warn('[HeyGen] Could not fetch voices list:', err.message);
    }
    // Hard fallback — will log an error if still wrong so we can update
    return process.env.HEYGEN_VOICE_ID || 'en-US-JennyNeural';
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
    const voiceId = customer.voice_id || await this.getDefaultVoiceId();
    const avatarId = customer.avatar_id || process.env.HEYGEN_AVATAR_ID || 'Anna_public_3_20240108';

    const payload = {
      video_inputs: [
        {
          character: {
            type: 'avatar',
            avatar_id: avatarId,
            avatar_style: 'normal',
          },
          voice: {
            type: 'text',
            input_text: script.substring(0, 1500), // HeyGen max ~1500 chars
            voice_id: voiceId,
          },
          background: {
            type: 'color',
            value: customer.brand_colors?.primary || '#1E1E2E',
          },
        },
      ],
      dimension: { width: 1080, height: 1920 }, // 9:16 — don't also pass aspect_ratio (conflicts)
      test: false,
    };

    console.log('[HeyGen] createVideo — avatar:', avatarId, '| voice:', voiceId, '| script chars:', payload.video_inputs[0].voice.input_text.length);

    const response = await axios.post(`${this.baseUrl}/video/generate`, payload, {
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    const videoId = response.data.data?.video_id || response.data.video_id;
    if (!videoId) {
      console.error('[HeyGen] createVideo — no video_id in response:', JSON.stringify(response.data).substring(0, 300));
      throw new Error('HeyGen did not return a video_id');
    }
    return videoId;
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
      timeout: 10000,
    });
    const data = response.data.data || response.data;
    if (data.status === 'failed') {
      console.error('[HeyGen] Video failed — id:', videoId, '| error:', JSON.stringify(data.error || data).substring(0, 400));
    }
    return {
      status: data.status,   // 'pending' | 'processing' | 'completed' | 'failed'
      videoUrl: data.video_url || null,
      errorDetail: data.error || null,
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
