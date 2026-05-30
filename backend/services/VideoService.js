/**
 * VideoService — Abstraction layer for all video generation providers.
 *
 * Swapping video providers = change this file only. Routes and other services
 * always call VideoService.generate() and never touch individual providers directly.
 *
 * videoType: 'avatar'   → HeyGen (talking-head AI presenter)
 * videoType: 'services' → NanoBanana key frame + full cinematic fallback chain:
 *                         Veo 3.1 Fast (primary)
 *                           ↓ fail
 *                         Runway Gen-4 (fallback #1)
 *                           ↓ fail
 *                         Pika 2.2 (fallback #2)
 *                           ↓ fail
 *                         HeyGen (final safety net — always available)
 */

const HeyGenService = require('./HeyGenService');
const VeoService = require('./VeoService');
const RunwayService = require('./RunwayService');
const PikaService = require('./PikaService');
const NanoBananaService = require('./NanoBananaService');
const industryKnowledge = require('../data/industryKnowledge');

class VideoService {
  constructor() {
    this.heygen = new HeyGenService();
    this.veo = new VeoService();
    this.runway = new RunwayService();
    this.pika = new PikaService();
    this.nanoBanana = new NanoBananaService();
  }

  /**
   * Generate a video using the appropriate provider.
   *
   * @param {Object} customer - Customer record from DB (for branding, voice, avatar)
   * @param {string} script - The spoken/animated script (from ClaudeService.generateVideoScript)
   * @param {Object} options
   * @param {string} options.videoType - 'avatar' | 'services' (default: 'services')
   * @param {string} options.imagePrompt - NanoBanana key frame prompt for services video
   * @param {string} options.aspectRatio - '9:16' | '16:9' | '1:1' (default: '9:16')
   * @param {number} options.durationSeconds - Video duration in seconds (default: 7)
   * @returns {{ url, type: 'video', model, provider }}
   */
  async generate(customer, script, options = {}) {
    const {
      videoType = 'services',
      imagePrompt = null,
      aspectRatio = '9:16',
      durationSeconds = 7,
    } = options;

    // Path A: Avatar video → HeyGen (no fallback chain for avatar)
    if (videoType === 'avatar') {
      console.log('[VideoService] Avatar video — routing to HeyGen');
      return await this.heygen.generateFromScript(customer, script, options);
    }

    // Path B: Services/cinematic video — generate NanoBanana key frame, then try providers in order
    console.log('[VideoService] Services video — NanoBanana key frame → Veo → Runway → Pika → HeyGen');

    let keyFrameUrl = null;
    if (imagePrompt) {
      try {
        const imgResult = await this.nanoBanana.generateFromPrompt(customer, imagePrompt, { aspectRatio });
        keyFrameUrl = imgResult.url;
        console.log('[VideoService] Key frame generated:', keyFrameUrl.substring(0, 60));
      } catch (imgErr) {
        console.warn('[VideoService] Key frame generation failed, proceeding without it:', imgErr.message);
      }
    }

    return await this._generateServicesVideo(customer, script, { keyFrameUrl, aspectRatio, durationSeconds, options });
  }

  /**
   * Try each cinematic provider in order, falling through on failure.
   * HeyGen is the guaranteed final fallback so the user always gets a video.
   */
  async _generateServicesVideo(customer, script, { keyFrameUrl, aspectRatio, durationSeconds, options }) {
    // 1. Veo 3.1 Fast (primary — uses same Google API key as NanoBanana)
    if (this.veo.isAvailable()) {
      try {
        return await this.veo.generate(script, keyFrameUrl, { aspectRatio, durationSeconds });
      } catch (veoErr) {
        console.warn('[VideoService] Veo failed, trying Runway Gen-4:', veoErr.message);
      }
    } else {
      console.log('[VideoService] Veo not enabled — skipping to Runway');
    }

    // 2. Runway Gen-4 (fallback #1 — requires RUNWAY_API_KEY)
    if (this.runway.isAvailable()) {
      try {
        return await this.runway.generate(script, keyFrameUrl, { aspectRatio, durationSeconds });
      } catch (runwayErr) {
        console.warn('[VideoService] Runway failed, trying Pika 2.2:', runwayErr.message);
      }
    } else {
      console.log('[VideoService] Runway not configured — skipping to Pika');
    }

    // 3. Pika 2.2 (fallback #2 — requires PIKA_API_KEY)
    if (this.pika.isAvailable()) {
      try {
        return await this.pika.generate(script, keyFrameUrl, { aspectRatio, durationSeconds });
      } catch (pikaErr) {
        console.warn('[VideoService] Pika failed, final fallback to HeyGen:', pikaErr.message);
      }
    } else {
      console.log('[VideoService] Pika not configured — falling back to HeyGen');
    }

    // 4. HeyGen (final safety net — always available if configured)
    console.log('[VideoService] Using HeyGen as final fallback for services video');
    return await this.heygen.generateFromScript(customer, script, options);
  }
}

module.exports = VideoService;
