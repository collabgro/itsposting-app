/**
 * PikaService — Pika 2.2 image-to-video generation
 *
 * Used as fallback #2 in the cinematic video pipeline when both Veo and Runway fail.
 *
 * Pipeline position:
 *   NanoBanana key frame → Veo 3.1 Fast (primary)
 *                              ↓ fail
 *                          Runway Gen-4
 *                              ↓ fail
 *                           Pika 2.2 (this service)   ← here
 *                              ↓ fail
 *                            HeyGen
 *
 * Credentials: PIKA_API_KEY (separate from all other keys)
 * API docs: https://pika.art/api-documentation
 */

const axios = require('axios');
const cloudinary = require('cloudinary').v2;

class PikaService {
  constructor() {
    this.apiKey = process.env.PIKA_API_KEY;
    this.baseUrl = 'https://api.pika.art/v1';

    if (process.env.CLOUDINARY_CLOUD_NAME) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }
  }

  isAvailable() {
    return !!this.apiKey;
  }

  /**
   * Generate a short video from a key frame image + text prompt.
   * @param {string} prompt - Scene/motion description
   * @param {string|null} imageUrl - Key frame image URL (from NanoBanana)
   * @param {Object} options - { aspectRatio: '9:16', durationSeconds: 5 }
   * @returns {{ url, type: 'video', model: 'pika-2.2', provider: 'pika' }}
   */
  async generate(prompt, imageUrl = null, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('PikaService not configured — set PIKA_API_KEY in environment');
    }

    const aspectRatio = options.aspectRatio || '9:16';
    const durationSeconds = Math.min(options.durationSeconds || 5, 10);

    console.log(`[Pika] Submitting 2.2 job — aspect: ${aspectRatio}, duration: ${durationSeconds}s`);

    const body = {
      model: 'pike-2.2',
      options: {
        aspectRatio,
        duration: durationSeconds,
        frameRate: 24,
      },
    };

    // Build prompts array — image + text if image provided, text-only otherwise
    if (imageUrl) {
      body.prompts = [{ text: prompt.substring(0, 400), image: { url: imageUrl } }];
      console.log('[Pika] Key frame image attached:', imageUrl.substring(0, 60));
    } else {
      body.prompts = [{ text: prompt.substring(0, 400) }];
      console.warn('[Pika] No key frame image provided — text-only generation');
    }

    let jobId;
    try {
      const response = await axios.post(`${this.baseUrl}/generate`, body, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });
      jobId = response.data?.jobId || response.data?.id;
      if (!jobId) throw new Error('Pika API returned no job ID');
      console.log('[Pika] Job submitted, ID:', jobId);
    } catch (submitErr) {
      const detail = submitErr.response?.data?.error || submitErr.response?.data?.message || submitErr.message;
      throw new Error(`Pika job submission failed: ${detail}`);
    }

    // Poll until job completes
    const videoUrl = await this._pollJob(jobId);

    // Upload to Cloudinary for permanent CDN storage
    const cloudinaryUrl = await this._uploadToCloudinary(videoUrl);

    return {
      url: cloudinaryUrl,
      type: 'video',
      model: 'pika-2.2',
      provider: 'pika',
    };
  }

  /**
   * Poll a Pika job until it completes or fails.
   * @param {string} jobId
   * @param {number} maxAttempts - 8s intervals → ~4 minutes max
   */
  async _pollJob(jobId, maxAttempts = 30) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this._sleep(8000);

      try {
        const response = await axios.get(`${this.baseUrl}/jobs/${jobId}`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
          timeout: 15000,
        });

        const { status, result, error } = response.data;
        console.log(`[Pika] Poll ${attempt}/${maxAttempts} — status: ${status}`);

        if (status === 'failed') {
          throw new Error(`Pika generation failed: ${error || 'unknown reason'}`);
        }

        if (status === 'succeeded' || status === 'completed') {
          const url =
            result?.videos?.[0]?.url ||
            result?.url ||
            response.data?.videos?.[0]?.url;

          if (!url) throw new Error('Pika succeeded but returned no video URL');
          console.log('[Pika] Video generation complete:', String(url).substring(0, 80));
          return url;
        }
        // status is pending or running — keep polling
      } catch (pollErr) {
        if (pollErr.message.startsWith('Pika generation failed') || pollErr.message.startsWith('Pika succeeded')) {
          throw pollErr; // terminal — bubble up to VideoService
        }
        console.warn(`[Pika] Poll ${attempt} error (retrying):`, pollErr.message);
      }
    }

    throw new Error(`Pika generation timed out after ${maxAttempts * 8}s`);
  }

  /**
   * Upload a video URL to Cloudinary for permanent CDN storage.
   */
  async _uploadToCloudinary(videoUrl) {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      console.warn('[Pika] Cloudinary not configured — returning raw video URL');
      return videoUrl;
    }

    const attempt = () => new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        videoUrl,
        { resource_type: 'video', folder: 'itsposting/pika', quality: 'auto:best' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result.secure_url);
        }
      );
    });

    try {
      return await attempt();
    } catch (firstErr) {
      console.warn('[Pika] Cloudinary upload failed (retrying in 3s):', firstErr.message);
      await this._sleep(3000);
      try {
        return await attempt();
      } catch (secondErr) {
        console.error('[Pika] Cloudinary upload failed after retry — video URL is temporary and will expire:', secondErr.message);
        return videoUrl;
      }
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = PikaService;
