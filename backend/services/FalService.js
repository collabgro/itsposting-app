/**
 * FalService — fal.ai video generation gateway
 *
 * One FAL_API_KEY unlocks Kling 3.0, Wan 2.5, and Luma Ray-2.
 * Replaces RunwayService (Runway API went Enterprise-only in January 2026).
 *
 * Pipeline position (cinematic path):
 *   Veo 3.1 (primary — requires VEO_ENABLED=true)
 *     ↓ fail / not enabled
 *   FalService: Kling → Wan → Luma (this service)   ← here
 *     ↓ all fail
 *   Pika 2.2 (requires PIKA_API_KEY)
 *     ↓ fail
 *   VideoSlideService (NanaBanana reel — always available)
 *
 * Credentials: FAL_API_KEY (get free $20 credits at fal.ai — no card required)
 * Model catalog: https://fal.ai/models (filter by "video")
 * API docs: https://fal.ai/docs/model-endpoints/queue
 */

const axios = require('axios');
const cloudinary = require('cloudinary').v2;

// fal.ai queue API base URL — all video models use the async queue pattern
const FAL_QUEUE_BASE = 'https://queue.fal.run';

/**
 * Model definitions — ordered by quality/cost preference.
 * Each model has its own input schema; buildInput() normalizes the differences.
 * Update model IDs here if fal.ai changes paths (check fal.ai/models).
 */
const FAL_MODELS = [
  {
    id: 'fal-ai/kling-video/v2.1/standard/image-to-video',
    name: 'kling-v2.1',
    supportsImageInput: true,
    buildInput(prompt, imageUrl, options) {
      return {
        image_url: imageUrl,
        prompt: prompt.substring(0, 500),
        duration: options.durationSeconds >= 10 ? '10' : '5',
        aspect_ratio: options.aspectRatio || '9:16',
      };
    },
    extractUrl(result) {
      return result?.video?.url || result?.videos?.[0]?.url;
    },
  },
  {
    id: 'fal-ai/wan/v2.2/image-to-video',
    name: 'wan-v2.2',
    supportsImageInput: true,
    buildInput(prompt, imageUrl, options) {
      const ratio = options.aspectRatio || '9:16';
      // Wan uses frame count instead of seconds — ~81 frames ≈ 5 seconds at 16fps
      return {
        image_url: imageUrl,
        prompt: prompt.substring(0, 500),
        aspect_ratio: ratio,
        num_frames: 81,
      };
    },
    extractUrl(result) {
      return result?.video?.url || result?.videos?.[0]?.url;
    },
  },
  {
    id: 'fal-ai/luma-dream-machine/ray-2-flash/image-to-video',
    name: 'luma-ray2-flash',
    supportsImageInput: true,
    buildInput(prompt, imageUrl, options) {
      return {
        image_url: imageUrl,
        prompt: prompt.substring(0, 500),
        aspect_ratio: options.aspectRatio || '9:16',
      };
    },
    extractUrl(result) {
      return result?.video?.url || result?.videos?.[0]?.url;
    },
  },
];

// Text-to-video fallbacks — used when no key frame image is available
const FAL_TEXT_MODELS = [
  {
    id: 'fal-ai/kling-video/v2.1/standard/text-to-video',
    name: 'kling-v2.1-t2v',
    buildInput(prompt, options) {
      return {
        prompt: prompt.substring(0, 500),
        duration: options.durationSeconds >= 10 ? '10' : '5',
        aspect_ratio: options.aspectRatio || '9:16',
      };
    },
    extractUrl(result) {
      return result?.video?.url || result?.videos?.[0]?.url;
    },
  },
];

class FalService {
  constructor() {
    this.apiKey = process.env.FAL_API_KEY;

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
   * Generate a video using fal.ai's model cascade.
   *
   * @param {string} prompt - Scene/motion description
   * @param {string|null} imageUrl - NanaBanana key frame (image-to-video mode)
   * @param {Object} options - { aspectRatio: '9:16', durationSeconds: 5 }
   * @returns {{ url, type: 'video', model, provider: 'fal' }}
   */
  async generate(prompt, imageUrl = null, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('FalService not configured — set FAL_API_KEY in environment');
    }

    const models = imageUrl ? FAL_MODELS : FAL_TEXT_MODELS;
    let lastError;

    for (const model of models) {
      console.log(`[Fal] Trying ${model.name} (${model.id})`);
      try {
        const input = model.buildInput(prompt, imageUrl, options);
        const videoUrl = await this._runQueued(model.id, input);
        const cloudinaryUrl = await this._uploadToCloudinary(videoUrl, model.name);
        return {
          url: cloudinaryUrl,
          type: 'video',
          model: model.name,
          provider: 'fal',
        };
      } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data?.detail || err.response?.data?.message || err.message;
        console.warn(`[Fal] ${model.name} failed (${status || 'no status'}): ${detail}`);
        lastError = new Error(`${model.name}: ${detail}`);
        // 404 or 422 = model path wrong or input bad; try next model
        // Any other error may be transient — still try next model
        continue;
      }
    }

    throw lastError || new Error('All fal.ai models failed');
  }

  /**
   * Submit a job to the fal.ai queue and poll until complete.
   *
   * fal.ai queue flow:
   *   POST /queue/{model_id}          → { request_id }
   *   GET  /requests/{id}/status      → { status: IN_QUEUE | IN_PROGRESS | COMPLETED | FAILED }
   *   GET  /requests/{id}             → full result JSON
   */
  async _runQueued(modelId, input, maxAttempts = 60) {
    // 1. Submit
    const submitResponse = await axios.post(
      `${FAL_QUEUE_BASE}/${modelId}`,
      input,
      {
        headers: {
          Authorization: `Key ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const requestId = submitResponse.data?.request_id;
    if (!requestId) {
      throw new Error(`fal.ai returned no request_id for ${modelId}. Response: ${JSON.stringify(submitResponse.data).substring(0, 200)}`);
    }
    console.log(`[Fal] Job submitted: ${requestId}`);

    // 2. Poll status
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this._sleep(8000); // fal.ai recommends polling every 5-10s

      const statusRes = await axios.get(
        `${FAL_QUEUE_BASE}/requests/${requestId}/status`,
        {
          headers: { Authorization: `Key ${this.apiKey}` },
          timeout: 15000,
        }
      );

      const status = statusRes.data?.status;
      console.log(`[Fal] Poll ${attempt}/${maxAttempts} — status: ${status}`);

      if (status === 'FAILED') {
        const reason = statusRes.data?.error || 'unknown';
        throw new Error(`fal.ai generation failed: ${reason}`);
      }

      if (status === 'COMPLETED') {
        // 3. Fetch result
        const resultRes = await axios.get(
          `${FAL_QUEUE_BASE}/requests/${requestId}`,
          {
            headers: { Authorization: `Key ${this.apiKey}` },
            timeout: 15000,
          }
        );
        return resultRes.data;
      }
      // IN_QUEUE or IN_PROGRESS — keep polling
    }

    throw new Error(`fal.ai generation timed out after ${maxAttempts * 8}s`);
  }

  async _uploadToCloudinary(result, modelName) {
    // Extract URL from fal.ai result object (or it's already a URL string from older callers)
    let videoUrl;
    if (typeof result === 'string') {
      videoUrl = result;
    } else {
      // Try common fal.ai result shapes
      videoUrl =
        result?.video?.url ||
        result?.videos?.[0]?.url ||
        result?.output?.video?.url;
    }

    if (!videoUrl) {
      throw new Error(`fal.ai ${modelName} returned no video URL. Result keys: ${Object.keys(result || {}).join(', ')}`);
    }

    console.log(`[Fal] Video ready: ${String(videoUrl).substring(0, 80)}`);

    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      console.warn('[Fal] Cloudinary not configured — returning raw fal.ai URL (temporary)');
      return videoUrl;
    }

    const attempt = () => new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        videoUrl,
        { resource_type: 'video', folder: 'itsposting/fal', quality: 'auto:best' },
        (error, res) => {
          if (error) reject(error);
          else resolve(res.secure_url);
        }
      );
    });

    try {
      const url = await attempt();
      console.log(`[Fal] Uploaded to Cloudinary: ${url.substring(0, 80)}`);
      return url;
    } catch (firstErr) {
      console.warn('[Fal] Cloudinary upload failed (retrying in 3s):', firstErr.message);
      await this._sleep(3000);
      try {
        return await attempt();
      } catch (secondErr) {
        console.error('[Fal] Cloudinary upload failed after retry — returning temporary fal.ai URL:', secondErr.message);
        return videoUrl;
      }
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = FalService;
