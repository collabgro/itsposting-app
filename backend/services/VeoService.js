/**
 * VeoService — Google Veo 3.1 Fast video generation
 *
 * Uses the same GOOGLE_AI_API_KEY as NanoBanana (no new credentials needed).
 * Model: veo-3.1-fast-generate-preview — 5-8 second clips, built for social media.
 *
 * Pipeline: text prompt (+ optional key frame image from NanoBanana) → short video
 * Enable via VEO_ENABLED=true in .env (disabled by default — Preview API).
 *
 * Veo is still Preview. This service wraps it with graceful fallback:
 * VideoService.js catches any Veo error and falls back to HeyGen automatically.
 */

const axios = require('axios');
const cloudinary = require('cloudinary').v2;

class VeoService {
  constructor() {
    this.apiKey = process.env.GOOGLE_AI_API_KEY;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.model = 'veo-3.1-fast-generate-preview';
    this.enabled = process.env.VEO_ENABLED === 'true';

    if (process.env.CLOUDINARY_CLOUD_NAME) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }
  }

  isAvailable() {
    return this.enabled && !!this.apiKey;
  }

  /**
   * Generate a short video from a text prompt + optional key frame image URL.
   * @param {string} prompt - Video description / spoken script
   * @param {string|null} imageUrl - Optional NanoBanana key frame image (image-to-video)
   * @param {Object} options - { aspectRatio: '9:16', durationSeconds: 7 }
   * @returns {{ url, type: 'video', model: 'veo-3.1-fast', provider: 'veo' }}
   */
  async generate(prompt, imageUrl = null, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Veo is not enabled. Set VEO_ENABLED=true in .env to use Veo video generation.');
    }

    const aspectRatio = options.aspectRatio || '9:16';
    const durationSeconds = options.durationSeconds || 7;

    console.log(`[Veo] Submitting video job — aspect: ${aspectRatio}, duration: ${durationSeconds}s`);

    // Build request body
    const requestBody = {
      model: this.model,
      prompt: { text: prompt },
      generationConfig: {
        durationSeconds,
        aspectRatio,
        numberOfVideos: 1,
      },
    };

    // Attach key frame image if provided (image-to-video mode)
    if (imageUrl) {
      try {
        const imageBase64 = await this._fetchImageAsBase64(imageUrl);
        requestBody.image = {
          imageBytes: imageBase64,
          mimeType: 'image/png',
        };
        console.log('[Veo] Key frame image attached for image-to-video generation');
      } catch (imgErr) {
        console.warn('[Veo] Could not attach key frame image, using text-to-video fallback:', imgErr.message);
      }
    }

    // Submit generation job — returns a long-running operation
    let operationName;
    try {
      const response = await axios.post(
        `${this.baseUrl}/models/${this.model}:generateVideo`,
        requestBody,
        {
          headers: { 'Content-Type': 'application/json' },
          params: { key: this.apiKey },
          timeout: 30000, // 30s just to submit — actual generation happens async
        }
      );
      operationName = response.data?.name;
      if (!operationName) {
        throw new Error('Veo API returned no operation name');
      }
      console.log('[Veo] Job submitted, operation:', operationName);
    } catch (submitErr) {
      const detail = submitErr.response?.data?.error?.message || submitErr.message;
      throw new Error(`Veo job submission failed: ${detail}`);
    }

    // Poll until done
    const videoUri = await this._waitForOperation(operationName);

    // Upload to Cloudinary for permanent storage
    const cloudinaryUrl = await this._uploadToCloudinary(videoUri);

    return {
      url: cloudinaryUrl,
      type: 'video',
      model: 'veo-3.1-fast',
      provider: 'veo',
    };
  }

  /**
   * Poll a long-running Veo operation until it completes.
   * @param {string} operationName - Full operation path from the generate response
   * @param {number} maxAttempts - Max polling attempts (8s each = ~200s max)
   */
  async _waitForOperation(operationName, maxAttempts = 25) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this._sleep(8000);

      try {
        const response = await axios.get(
          `${this.baseUrl}/${operationName}`,
          {
            params: { key: this.apiKey },
            timeout: 15000,
          }
        );

        const data = response.data;
        console.log(`[Veo] Poll ${attempt}/${maxAttempts} — done: ${data.done}`);

        if (data.error) {
          throw new Error(`Veo generation failed: ${data.error.message || JSON.stringify(data.error)}`);
        }

        if (data.done) {
          // Extract video URI from completed operation
          const videoUri =
            data.response?.generatedSamples?.[0]?.video?.uri ||
            data.response?.videos?.[0]?.uri ||
            data.response?.candidates?.[0]?.video?.uri;

          if (!videoUri) {
            throw new Error('Veo completed but returned no video URI');
          }

          console.log('[Veo] Video generation complete:', videoUri.substring(0, 80));
          return videoUri;
        }
      } catch (pollErr) {
        if (pollErr.message.startsWith('Veo generation failed') || pollErr.message.startsWith('Veo completed')) {
          throw pollErr;
        }
        console.warn(`[Veo] Poll ${attempt} error (retrying):`, pollErr.message);
      }
    }

    throw new Error(`Veo generation timed out after ${maxAttempts * 8}s`);
  }

  /**
   * Fetch a remote image and return it as a base64 string.
   */
  async _fetchImageAsBase64(imageUrl) {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
    });
    return Buffer.from(response.data).toString('base64');
  }

  /**
   * Upload a video URL to Cloudinary for permanent CDN storage.
   */
  async _uploadToCloudinary(videoUrl) {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      console.warn('[Veo] Cloudinary not configured — returning raw video URL');
      return videoUrl;
    }

    const attempt = () => new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        videoUrl,
        { resource_type: 'video', folder: 'itsposting/veo', quality: 'auto:best' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result.secure_url);
        }
      );
    });

    try {
      return await attempt();
    } catch (firstErr) {
      console.warn('[Veo] Cloudinary upload failed (retrying in 3s):', firstErr.message);
      await this._sleep(3000);
      try {
        return await attempt();
      } catch (secondErr) {
        console.error('[Veo] Cloudinary upload failed after retry — video URL is temporary and will expire:', secondErr.message);
        return videoUrl;
      }
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = VeoService;
