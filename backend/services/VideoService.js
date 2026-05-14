/**
 * VideoService — Abstraction layer for all video generation providers.
 *
 * Swapping video providers = change this file only. Routes and other services
 * always call VideoService.generate() and never touch HeyGen or Veo directly.
 *
 * videoType: 'avatar'   → HeyGen (talking-head AI presenter)
 * videoType: 'services' → NanoBanana key frame → Veo 3.1 Fast (animated scene)
 *                         Falls back to HeyGen if Veo is unavailable or fails.
 */

const HeyGenService = require('./HeyGenService');
const VeoService = require('./VeoService');
const NanoBananaService = require('./NanoBananaService');

class VideoService {
  constructor() {
    this.heygen = new HeyGenService();
    this.veo = new VeoService();
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

    // Path A: Avatar video or Veo unavailable → HeyGen
    if (videoType === 'avatar' || !this.veo.isAvailable()) {
      console.log(`[VideoService] Using HeyGen (videoType=${videoType}, veoAvailable=${this.veo.isAvailable()})`);
      return await this.heygen.generateFromScript(customer, script, options);
    }

    // Path B: Services video — NanoBanana key frame → Veo 3.1 Fast
    console.log('[VideoService] Using Veo pipeline (NanoBanana key frame → Veo 3.1 Fast)');

    let keyFrameUrl = null;
    if (imagePrompt) {
      try {
        const imgResult = await this.nanoBanana.generateFromPrompt(customer, imagePrompt, { aspectRatio });
        keyFrameUrl = imgResult.url;
        console.log('[VideoService] Key frame generated:', keyFrameUrl.substring(0, 60));
      } catch (imgErr) {
        console.warn('[VideoService] Key frame generation failed, Veo will use text-only prompt:', imgErr.message);
      }
    }

    try {
      return await this.veo.generate(script, keyFrameUrl, { aspectRatio, durationSeconds });
    } catch (veoErr) {
      // Veo failed — fall back to HeyGen so the user always gets a video
      console.error('[VideoService] Veo failed, falling back to HeyGen:', veoErr.message);
      return await this.heygen.generateFromScript(customer, script, options);
    }
  }
}

module.exports = VideoService;
