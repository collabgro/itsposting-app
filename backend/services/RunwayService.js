/**
 * RunwayService — Runway Gen-4 image-to-video generation
 *
 * Used as fallback #1 in the cinematic video pipeline when Veo 3.1 Fast fails.
 *
 * Pipeline position:
 *   NanoBanana key frame → Veo 3.1 Fast (primary)
 *                              ↓ fail
 *                        Runway Gen-4 (this service)   ← here
 *                              ↓ fail
 *                           Pika 2.2
 *                              ↓ fail
 *                            HeyGen
 *
 * Credentials: RUNWAY_API_KEY (separate from Google/HeyGen keys)
 * API docs: https://docs.runwayml.com/reference/image_to_video
 */

const axios = require('axios');
const cloudinary = require('cloudinary').v2;

const ASPECT_RATIO_MAP = {
  '9:16': '720:1280',   // vertical — Instagram Reels, TikTok, Stories
  '16:9': '1280:720',   // horizontal — YouTube, landscape
  '1:1':  '720:720',    // square — Instagram feed
};

class RunwayService {
  constructor() {
    this.apiKey = process.env.RUNWAY_API_KEY;
    this.baseUrl = 'https://api.runwayml.com/v1';
    // gen4_turbo: fastest Gen-4 variant — good for social-media clips (5–10s)
    this.model = 'gen4_turbo';

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
   * @param {string} prompt - Scene description / caption for motion
   * @param {string|null} imageUrl - Key frame image URL (from NanoBanana)
   * @param {Object} options - { aspectRatio: '9:16', durationSeconds: 5 }
   * @returns {{ url, type: 'video', model: 'gen4_turbo', provider: 'runway' }}
   */
  async generate(prompt, imageUrl = null, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('RunwayService not configured — set RUNWAY_API_KEY in environment');
    }

    const aspectRatio = options.aspectRatio || '9:16';
    const durationSeconds = options.durationSeconds >= 10 ? 10 : 5; // Runway supports 5 or 10
    const ratio = ASPECT_RATIO_MAP[aspectRatio] || ASPECT_RATIO_MAP['9:16'];

    console.log(`[Runway] Submitting Gen-4 job — ratio: ${ratio}, duration: ${durationSeconds}s`);

    const body = {
      model: this.model,
      promptText: prompt.substring(0, 512), // Runway caps prompt at 512 chars
      duration: durationSeconds,
      ratio,
    };

    // Attach key frame image if provided
    if (imageUrl) {
      body.promptImage = imageUrl;
      console.log('[Runway] Key frame image attached:', imageUrl.substring(0, 60));
    } else {
      // Runway Gen-4 requires an image; generate a minimal placeholder signal
      console.warn('[Runway] No key frame image provided — generation may be lower quality');
    }

    let taskId;
    try {
      const response = await axios.post(`${this.baseUrl}/image_to_video`, body, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-Runway-Version': '2024-11-06',
        },
        timeout: 30000,
      });
      taskId = response.data?.id;
      if (!taskId) throw new Error('Runway API returned no task ID');
      console.log('[Runway] Job submitted, task ID:', taskId);
    } catch (submitErr) {
      const detail = submitErr.response?.data?.error || submitErr.response?.data?.message || submitErr.message;
      throw new Error(`Runway job submission failed: ${detail}`);
    }

    // Poll until the task completes
    const videoUrl = await this._pollTask(taskId);

    // Upload to Cloudinary for permanent CDN storage
    const cloudinaryUrl = await this._uploadToCloudinary(videoUrl);

    return {
      url: cloudinaryUrl,
      type: 'video',
      model: this.model,
      provider: 'runway',
    };
  }

  /**
   * Poll a Runway task until it completes or fails.
   * @param {string} taskId
   * @param {number} maxAttempts - 10s intervals → 5 minutes max
   */
  async _pollTask(taskId, maxAttempts = 30) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this._sleep(10000);

      try {
        const response = await axios.get(`${this.baseUrl}/tasks/${taskId}`, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'X-Runway-Version': '2024-11-06',
          },
          timeout: 15000,
        });

        const { status, output, failure, failureCode } = response.data;
        console.log(`[Runway] Poll ${attempt}/${maxAttempts} — status: ${status}`);

        if (status === 'FAILED') {
          throw new Error(`Runway generation failed: ${failure || failureCode || 'unknown reason'}`);
        }

        if (status === 'SUCCEEDED') {
          const url = Array.isArray(output) ? output[0] : output;
          if (!url) throw new Error('Runway succeeded but returned no output URL');
          console.log('[Runway] Video generation complete:', String(url).substring(0, 80));
          return url;
        }
        // status is PENDING or RUNNING — keep polling
      } catch (pollErr) {
        if (pollErr.message.startsWith('Runway generation failed') || pollErr.message.startsWith('Runway succeeded')) {
          throw pollErr; // terminal — bubble up to VideoService
        }
        console.warn(`[Runway] Poll ${attempt} error (retrying):`, pollErr.message);
      }
    }

    throw new Error(`Runway generation timed out after ${maxAttempts * 10}s`);
  }

  /**
   * Upload a video URL to Cloudinary for permanent CDN storage.
   */
  async _uploadToCloudinary(videoUrl) {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      console.warn('[Runway] Cloudinary not configured — returning raw video URL');
      return videoUrl;
    }

    const attempt = () => new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        videoUrl,
        { resource_type: 'video', folder: 'itsposting/runway', quality: 'auto:best' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result.secure_url);
        }
      );
    });

    try {
      return await attempt();
    } catch (firstErr) {
      console.warn('[Runway] Cloudinary upload failed (retrying in 3s):', firstErr.message);
      await this._sleep(3000);
      try {
        return await attempt();
      } catch (secondErr) {
        console.error('[Runway] Cloudinary upload failed after retry — video URL is temporary and will expire:', secondErr.message);
        return videoUrl;
      }
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = RunwayService;
