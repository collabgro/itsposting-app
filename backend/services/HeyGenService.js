/**
 * HeyGen Service - AI Avatar Video Generation
 * Cost: ~$0.20 per video (30-60 seconds)
 *
 * API format reference (v2):
 *   POST /v2/video/generate  — body: { avatar_id, voice: { voice_id }, input_text, test }
 *   GET  /v2/video/status/:id — returns { data: { video_status, video_url } }
 */

const axios = require('axios');
const cloudinary = require('cloudinary').v2;

class HeyGenService {
  constructor() {
    this.apiKey = process.env.HEYGEN_API_KEY;
    this.baseUrl = 'https://api.heygen.com/v2';
    this._cachedVoiceId = null;
    this._cachedAvatarId = null;

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
  // HeyGen v2 voice fields: voice_id, voice_name, language, accent (NOT locale/gender)
  async getDefaultVoiceId() {
    if (this._cachedVoiceId) return this._cachedVoiceId;
    if (process.env.HEYGEN_VOICE_ID) {
      this._cachedVoiceId = process.env.HEYGEN_VOICE_ID;
      console.log('[HeyGen] Using HEYGEN_VOICE_ID from env:', this._cachedVoiceId);
      return this._cachedVoiceId;
    }
    try {
      console.log('[HeyGen] Fetching available voices from API...');
      const response = await axios.get(`${this.baseUrl}/voices`, {
        headers: { 'X-Api-Key': this.apiKey },
        timeout: 8000,
      });
      const voices = response.data.data?.voices || response.data.voices || [];
      console.log(`[HeyGen] Found ${voices.length} voices`);
      
      // HeyGen voice_ids often embed gender: 'female-en-us-001', 'male-en-us-001'
      const pick =
        voices.find(v => v.language === 'en' && (v.voice_id || '').startsWith('female')) ||
        voices.find(v => (v.language || '').startsWith('en')) ||
        voices[0];
      if (pick?.voice_id) {
        console.log('[HeyGen] Using voice:', pick.voice_name || pick.voice_id);
        this._cachedVoiceId = pick.voice_id;
        return pick.voice_id;
      } else {
        console.warn('[HeyGen] No suitable voice found in list');
      }
    } catch (err) {
      console.error('[HeyGen] Error fetching voices:', err.response?.status, err.message);
      if (err.response?.status === 401) {
        console.error('[HeyGen] Authentication failed - check HEYGEN_API_KEY');
      }
    }
    return null;
  }

  // Fetch a valid HeyGen avatar ID — caches result
  // HeyGen v2 avatar fields: avatar_id, avatar_name, avatar_style (male/female)
  async getDefaultAvatarId() {
    if (this._cachedAvatarId) return this._cachedAvatarId;
    if (process.env.HEYGEN_AVATAR_ID) {
      this._cachedAvatarId = process.env.HEYGEN_AVATAR_ID;
      console.log('[HeyGen] Using HEYGEN_AVATAR_ID from env:', this._cachedAvatarId);
      return this._cachedAvatarId;
    }
    try {
      console.log('[HeyGen] Fetching available avatars from API...');
      const response = await axios.get(`${this.baseUrl}/avatars`, {
        headers: { 'X-Api-Key': this.apiKey },
        timeout: 8000,
      });
      const avatars = response.data.data?.avatars || response.data.avatars || [];
      console.log(`[HeyGen] Found ${avatars.length} avatars`);
      
      const pick =
        avatars.find(a => (a.avatar_style || '').toLowerCase() === 'female') ||
        avatars[0];
      if (pick?.avatar_id) {
        console.log('[HeyGen] Using avatar:', pick.avatar_name || pick.avatar_id);
        this._cachedAvatarId = pick.avatar_id;
        return pick.avatar_id;
      } else {
        console.warn('[HeyGen] No avatar found in list');
      }
    } catch (err) {
      console.error('[HeyGen] Error fetching avatars:', err.response?.status, err.message);
      if (err.response?.status === 401) {
        console.error('[HeyGen] Authentication failed - check HEYGEN_API_KEY');
      }
    }
    // Known stable fallback
    console.log('[HeyGen] Using fallback avatar: anna_20220920');
    this._cachedAvatarId = 'anna_20220920';
    return this._cachedAvatarId;
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
    console.log('[HeyGen] createVideo START — retrieving voice and avatar...');
    
    const voiceId = customer.voice_id || await this.getDefaultVoiceId();
    const avatarId = customer.avatar_id || await this.getDefaultAvatarId();

    console.log('[HeyGen] Voice ID:', voiceId ? '✓ set' : '✗ MISSING');
    console.log('[HeyGen] Avatar ID:', avatarId ? '✓ set' : '✗ MISSING');

    // HeyGen v2 flat payload — NOT video_inputs (that is v1/multi-scene format)
    const payload = {
      avatar_id: avatarId,
      voice: {
        voice_id: voiceId,
        rate: 1.0,
        emotion: 'friendly',
      },
      input_text: script.substring(0, 1500),
      test: process.env.HEYGEN_TEST_MODE === 'true', // set HEYGEN_TEST_MODE=true to generate free watermarked videos while debugging
    };

    // voice_id is required — skip generation if we couldn't resolve one
    if (!payload.voice.voice_id) {
      const err = 'No valid HeyGen voice ID available. Set HEYGEN_VOICE_ID in env or ensure your HeyGen API key has access to voices.';
      console.error('[HeyGen] ERROR:', err);
      throw new Error(err);
    }

    if (!avatarId) {
      const err = 'No valid HeyGen avatar ID available. Set HEYGEN_AVATAR_ID in env or ensure your HeyGen API key has access to avatars.';
      console.error('[HeyGen] ERROR:', err);
      throw new Error(err);
    }

    console.log('[HeyGen] Payload ready. Making API call to', `${this.baseUrl}/video/generate`);

    let response;
    try {
      response = await axios.post(`${this.baseUrl}/video/generate`, payload, {
        headers: {
          'X-Api-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });
    } catch (axiosErr) {
      const status = axiosErr.response?.status;
      const detail = axiosErr.response?.data;
      console.error('[HeyGen] API call failed:', {
        status,
        message: detail?.error?.message || detail?.message || axiosErr.message,
        fullError: JSON.stringify(detail).substring(0, 500),
      });
      throw axiosErr;
    }

    console.log('[HeyGen] createVideo response:', JSON.stringify(response.data).substring(0, 500));

    const videoId = response.data.data?.video_id || response.data.video_id;
    if (!videoId) {
      console.error('[HeyGen] createVideo — no video_id in response:', JSON.stringify(response.data).substring(0, 300));
      throw new Error('HeyGen did not return a video_id');
    }
    console.log('[HeyGen] Video job created:', videoId);
    return videoId;
  }

  async waitForVideo(videoId, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await axios.get(`${this.baseUrl}/video/status/${videoId}`, {
          headers: { 'X-Api-Key': this.apiKey },
        });

        const data = response.data.data || response.data;
        // v2 API returns video_status; handle both field names for safety
        const status = data.video_status || data.status;

        if (status === 'completed') {
          return data.video_url;
        }
        if (status === 'failed') {
          console.error('[HeyGen] waitForVideo failed — id:', videoId, '| error:', JSON.stringify(data.error || data).substring(0, 300));
          throw new Error('Video generation failed');
        }

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
    const response = await axios.get(`${this.baseUrl}/video/status/${videoId}`, {
      headers: { 'X-Api-Key': this.apiKey },
      timeout: 10000,
    });
    const data = response.data.data || response.data;
    // v2 API returns video_status; also check status for backward compat
    const status = data.video_status || data.status;
    if (status === 'failed') {
      console.error('[HeyGen] Video failed — id:', videoId, '| error:', JSON.stringify(data.error || data).substring(0, 400));
    }
    return {
      status: status || 'processing',
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
