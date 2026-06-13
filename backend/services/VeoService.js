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

// Models in priority order — preview models first, stable fallbacks last
const VEO_MODELS = [
  'veo-3.1-fast-generate-preview',
  'veo-3.1-generate-preview',
  'veo-3.0-fast-generate-001',
  'veo-3.0-generate-001',
  'veo-2.0-generate-001',
];

class VeoService {
  constructor() {
    this.apiKey = process.env.GOOGLE_AI_API_KEY;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
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
   * @returns {{ url, type: 'video', model, provider: 'veo' }}
   */
  async generate(prompt, imageUrl = null, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Veo is not enabled. Set VEO_ENABLED=true in .env to use Veo video generation.');
    }

    const aspectRatio = options.aspectRatio || '9:16';
    // Veo only accepts 4, 6, or 8 — map anything else to nearest valid value
    const durationSeconds = String(this._clampDuration(options.durationSeconds || 8));

    // Attach key frame image if provided (image-to-video mode)
    let imageBase64 = null;
    if (imageUrl) {
      try {
        imageBase64 = await this._fetchImageAsBase64(imageUrl);
        console.log('[Veo] Key frame image attached for image-to-video generation');
      } catch (imgErr) {
        console.warn('[Veo] Could not attach key frame image, using text-to-video fallback:', imgErr.message);
      }
    }

    // Try each model in priority order — 404 = not available for this key, skip
    let lastError;
    for (const model of VEO_MODELS) {
      console.log(`[Veo] Trying model: ${model}, aspect: ${aspectRatio}, duration: ${durationSeconds}s`);

      // Build request body — Gemini API instances/parameters format
      const instance = { prompt };
      if (imageBase64) {
        instance.image = { bytesBase64Encoded: imageBase64, mimeType: 'image/jpeg' };
      }
      const requestBody = {
        instances: [instance],
        parameters: { aspectRatio, sampleCount: 1, durationSeconds },
      };

      // Submit generation job — returns a long-running operation
      let operationName;
      try {
        const response = await axios.post(
          `${this.baseUrl}/models/${model}:predictLongRunning`,
          requestBody,
          {
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': this.apiKey,
            },
            timeout: 30000,
          }
        );
        operationName = response.data?.name;
        if (!operationName) {
          throw new Error('Veo API returned no operation name');
        }
        console.log(`[Veo] Job submitted with ${model}, operation:`, operationName);
      } catch (submitErr) {
        const status = submitErr.response?.status;
        const detail = submitErr.response?.data?.error?.message || submitErr.message;
        if (status === 404) {
          console.warn(`[Veo] Model ${model} not available (404), trying next`);
          lastError = new Error(`${model}: not available`);
          continue;
        }
        throw new Error(`Veo job submission failed (${model}): ${detail}`);
      }

      // Poll until done — success means we return immediately
      const videoUri = await this._waitForOperation(operationName);
      const cloudinaryUrl = await this._uploadToCloudinary(videoUri);
      return {
        url: cloudinaryUrl,
        type: 'video',
        model,
        provider: 'veo',
      };
    }

    throw lastError || new Error('All Veo models failed — check GOOGLE_AI_API_KEY and VEO_ENABLED in Railway env vars');
  }

  /**
   * Poll a long-running Veo operation until it completes.
   * @param {string} operationName - Full operation path from the generate response
   * @param {number} maxAttempts - Max polling attempts (10s each = ~250s max)
   */
  async _waitForOperation(operationName, maxAttempts = 25) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this._sleep(10000); // docs recommend 10s polling interval

      try {
        const response = await axios.get(
          `${this.baseUrl}/${operationName}`,
          {
            headers: { 'x-goog-api-key': this.apiKey },
            timeout: 15000,
          }
        );

        const data = response.data;
        console.log(`[Veo] Poll ${attempt}/${maxAttempts} — done: ${data.done}`);

        if (data.error) {
          throw new Error(`Veo generation failed: ${data.error.message || JSON.stringify(data.error)}`);
        }

        if (data.done) {
          // Extract video URI — try all known response shapes across Veo API versions
          const videoUri =
            data.response?.generatedVideos?.[0]?.video?.uri ||
            data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
            data.response?.generatedSamples?.[0]?.video?.uri ||
            data.response?.videos?.[0]?.uri;

          if (!videoUri) {
            throw new Error(`Veo completed but returned no video URI. Response keys: ${Object.keys(data.response || {}).join(', ')}`);
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

    throw new Error(`Veo generation timed out after ${maxAttempts * 10}s`);
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
   * Upload a Veo video to Cloudinary for permanent CDN storage.
   * Veo video URIs require the API key header to download — Cloudinary's
   * URL-upload path can't pass that header, so we download the buffer first.
   */
  async _uploadToCloudinary(videoUrl) {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      console.warn('[Veo] Cloudinary not configured — returning raw video URL');
      return videoUrl;
    }

    // Download the video buffer (Veo URIs require x-goog-api-key auth)
    let videoBuffer;
    try {
      const dlResponse = await axios.get(videoUrl, {
        headers: { 'x-goog-api-key': this.apiKey },
        responseType: 'arraybuffer',
        timeout: 120000,
      });
      videoBuffer = Buffer.from(dlResponse.data);
      console.log(`[Veo] Video downloaded (${Math.round(videoBuffer.length / 1024)}KB), uploading to Cloudinary`);
    } catch (dlErr) {
      console.error('[Veo] Failed to download video buffer:', dlErr.message);
      return videoUrl;
    }

    const attempt = () => new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'video', folder: 'itsposting/veo', quality: 'auto:best' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result.secure_url);
        }
      );
      uploadStream.end(videoBuffer);
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

  // Veo only accepts 4, 6, or 8 seconds
  _clampDuration(seconds) {
    const n = Number(seconds) || 8;
    if (n <= 4) return 4;
    if (n <= 6) return 6;
    return 8;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = VeoService;
