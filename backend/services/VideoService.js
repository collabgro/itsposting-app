/**
 * VideoService — Abstraction layer for all video generation providers.
 *
 * Hard provider separation — never mix:
 * videoType: 'avatar'   → HeyGen ONLY (talking-head AI presenter)
 * videoType: 'services' → Cinematic pipeline ONLY (no HeyGen fallback):
 *                         NanoBanana key frame image
 *                           ↓
 *                         Veo 3.1 Fast (primary — requires VEO_ENABLED=true)
 *                           ↓ fail
 *                         Runway Gen-4 (fallback #1 — requires RUNWAY_API_KEY)
 *                           ↓ fail
 *                         Pika 2.2 (fallback #2 — requires PIKA_API_KEY)
 *                           ↓ all fail → throw (do not fall back to HeyGen)
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
      durationSeconds = 8,
    } = options;

    // Path A: Avatar video → HeyGen (no fallback chain for avatar)
    if (videoType === 'avatar') {
      console.log('[VideoService] Avatar video — routing to HeyGen');
      return await this.heygen.generateFromScript(customer, script, options);
    }

    // Path B: Services/cinematic video
    // Skip NanoBanana key frame entirely if no cinematic provider is available —
    // avoids burning a Google API call for a key frame that will never be used.
    const anyCinematicAvailable = this.veo.isAvailable() || this.runway.isAvailable() || this.pika.isAvailable();
    if (!anyCinematicAvailable) {
      throw new Error('Services video: no cinematic provider is enabled. Set VEO_ENABLED=true in Railway env vars.');
    }

    console.log('[VideoService] Services video — NanoBanana key frame → Veo → Runway → Pika');

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
   * Never falls back to HeyGen — services video = cinematic pipeline only.
   * If all cinematic providers fail, throws so the caller can mark the post failed.
   */
  async _generateServicesVideo(customer, script, { keyFrameUrl, aspectRatio, durationSeconds, options }) {

    // 1. Veo 3.1 Fast — needs a visual scene description, not a spoken script
    if (this.veo.isAvailable()) {
      try {
        const veoPrompt = this._buildVeoPrompt(customer, script, keyFrameUrl);
        return await this.veo.generate(veoPrompt, keyFrameUrl, { aspectRatio, durationSeconds });
      } catch (veoErr) {
        console.warn('[VideoService] Veo failed, trying Runway Gen-4:', veoErr.message);
      }
    } else {
      console.log('[VideoService] Veo not enabled (set VEO_ENABLED=true) — skipping to Runway');
    }

    // 2. Runway Gen-4 — image-to-video motion description (512 char limit)
    if (this.runway.isAvailable()) {
      try {
        const runwayPrompt = this._buildRunwayPrompt(customer, script, keyFrameUrl);
        return await this.runway.generate(runwayPrompt, keyFrameUrl, { aspectRatio, durationSeconds });
      } catch (runwayErr) {
        console.warn('[VideoService] Runway failed, trying Pika 2.2:', runwayErr.message);
      }
    } else {
      console.log('[VideoService] Runway not configured — skipping to Pika');
    }

    // 3. Pika 2.2 — social-first, energetic style (400 char limit)
    if (this.pika.isAvailable()) {
      try {
        const pikaPrompt = this._buildPikaPrompt(customer, script, keyFrameUrl);
        return await this.pika.generate(pikaPrompt, keyFrameUrl, { aspectRatio, durationSeconds });
      } catch (pikaErr) {
        console.warn('[VideoService] Pika failed:', pikaErr.message);
      }
    } else {
      console.log('[VideoService] Pika not configured');
    }

    // All cinematic providers failed — do NOT fall back to HeyGen (wrong video type)
    throw new Error('Services video: all cinematic providers failed. Enable VEO_ENABLED=true or configure RUNWAY_API_KEY / PIKA_API_KEY.');
  }

  /**
   * Veo prompt — cinematic scene description language.
   * Veo generates FROM SCRATCH using the text prompt. It needs visual scene
   * description, not a spoken script. Camera language, movement, mood.
   * Keep under 400 chars for best Veo results.
   */
  _buildVeoPrompt(customer, script, imagePrompt) {
    const industry = customer.industry || 'general_contractor';
    const iv = (industryKnowledge[industry] || {}).imageVisuals || {};
    const rawScene = (imagePrompt || script || '').replace(/\n/g, ' ').trim();
    const scene = rawScene.length > 120 ? rawScene.substring(0, 120).replace(/,?\s*\w+$/, '') : rawScene;
    const season = this._getCurrentSeason();
    const seasonalNote = iv.seasonalVisuals?.[season] || '';

    const cinemaStyles = {
      plumbing:           'licensed plumber working under kitchen sink, copper pipes, headlamp light, hands-on craftsmanship, slow documentary zoom, authentic residential job site',
      hvac:               'HVAC technician servicing outdoor condenser unit, gauges attached, natural daylight, slow reveal camera movement, authentic trade documentary',
      roofing:            'roofing crew installing shingles on residential roof, aerial perspective, natural sunlight, camera slowly pans across the work, dramatic sky',
      concrete:           'concrete crew screeding fresh pour on residential driveway, crew teamwork visible, outdoor light, slow pull-back camera revealing scale of job',
      landscaping:        'landscaping crew transforming residential yard, before/after slow reveal, natural daylight, aerial perspective over property',
      electrical:         'licensed electrician working on electrical panel, focused close-up of hands and wiring, warm utility lighting, slow cinematic push-in',
      painting:           'professional painter rolling bright color onto wall, before/after room transformation, natural interior light, smooth camera slide',
      pest_control:       'pest control technician inspecting residential foundation, close-up of evidence and treatment, slow tracking shot',
      general_contractor: 'renovation crew at residential job site, skilled craftsmanship, construction progress, natural light, slow reveal camera',
      cleaning:           'professional cleaning team transforming grimy kitchen to spotless, before/after reveal, natural interior light, smooth dolly shot',
      tree_service:       'arborist crew removing large tree from residential property, bucket truck extended, dramatic scale, natural daylight',
      pressure_washing:   'pressure washing driveway half-cleaned vs grimy — satisfying reveal stripe, outdoor light, slow camera tracks the clean line',
      pool_spa:           'pool technician restoring green murky pool to crystal blue, dramatic color transformation, natural sunlight on water',
      handyman:           'handyman completing precise repair work in residential home, before/after detail reveal, natural lighting',
      flooring:           'flooring team laying hardwood planks row by row, wide room shot, natural interior light, satisfying installation progress',
      junk_removal:       'junk removal crew clearing overloaded garage, dramatic before to empty clean space transformation, fast-cut documentary style',
      solar:              'solar installation crew mounting panels on residential roof, staggered installation in progress, panel rows expanding across roof, natural full-sun lighting, drone perspective revealing growing system',
      gutter_cleaning:    'technician cleaning gutters on residential home, ladder against fascia, debris removal in progress, water flowing clear from downspout, natural daylight slow reveal',
    };

    const style = cinemaStyles[industry] || `local service professional working at residential job site, documentary cinematic style`;

    // Enrich from industryKnowledge imageVisuals — makes Veo prompt specific to this trade
    const moodNote = iv.moodAndLighting || '';
    const paletteNote = iv.colorPalette ? `natural color palette: ${iv.colorPalette}` : '';
    const keyElement = iv.keyElements?.[0] || '';

    const prompt = [scene, style, keyElement, moodNote, paletteNote, seasonalNote].filter(Boolean).join('. ');
    const finalPrompt = `${prompt}. Authentic documentary style. No text overlays. ${aspectRatioCue(customer)}.`.substring(0, 480);

    console.log(`[VideoService] Veo prompt for ${industry} (${finalPrompt.length} chars)`);
    return finalPrompt;

    function aspectRatioCue(c) {
      return '9:16 vertical framing for social media';
    }
  }

  /**
   * Runway prompt — motion description for image-to-video.
   * Runway ANIMATES an existing image. The prompt describes WHAT MOVES
   * in the frame — not the scene itself (the image provides that).
   * Hard 512 char limit enforced.
   */
  _buildRunwayPrompt(customer, script, imagePrompt) {
    const industry = customer.industry || 'general_contractor';
    const iv = (industryKnowledge[industry] || {}).imageVisuals || {};
    const season = this._getCurrentSeason();
    const seasonalNote = iv.seasonalVisuals?.[season] ? ` ${iv.seasonalVisuals[season]}.` : '';

    const motionDescriptions = {
      plumbing:           "Plumber's hands continue tightening pipe fitting with slight wrist rotation. Copper pipe reflects warm headlamp light. Subtle steam near torch area. Camera drifts slowly forward. Natural ambient motion. Authentic documentary feel.",
      hvac:               'Technician adjusts manifold gauge dial slowly. Refrigerant line vibrates slightly. Outdoor unit fan spins. Camera gently pans right. Natural outdoor lighting shifts softly.',
      roofing:            'Crew members continue nailing shingles in steady rhythm. Shingle tabs settle into place. Wind gently moves safety vest. Camera slowly pulls back to reveal more of the roof. Sky clouds drift.',
      concrete:           'Concrete crew continues screeding the fresh pour. Surface glistens with moisture. Screed board slides smoothly. Camera pulls back slowly to show scale of the job. Natural sunlight steady.',
      landscaping:        'Crew member continues raking fresh mulch into bed. Mulch scatters slightly in wind. Nearby grass sways gently. Camera slowly rises to overhead view. Natural daylight warm and steady.',
      electrical:         'Electrician hands carefully route wires through panel. Fingers make precise adjustments. Headlamp beam steady. Camera slowly pushes in to wire detail. Panel indicator lights visible.',
      painting:           'Roller continues sweeping paint across wall in smooth strokes. Paint sheen glistens. New color covers old. Camera tracks right along the wall following the roller motion.',
      pest_control:       'Technician continues applying treatment around foundation perimeter. Spray settles. Gloves move methodically. Camera tracks along foundation wall. Natural outdoor lighting steady.',
      general_contractor: 'Crew member continues framing work. Hammer strikes nail. Wood settles into place. Sawdust drifts. Camera slowly pulls back to reveal the broader renovation in progress.',
      cleaning:           'Cleaning team member continues wiping surface to reveal gleaming shine. Reflection appears on surface. Camera slowly pulls back showing the full transformation. Natural light steady.',
      tree_service:       'Chainsaw continues cutting through trunk section. Wood chips fly in slow motion. Crew member below guides rope. Camera slowly tilts up to reveal remaining tree height.',
      pressure_washing:   'Pressure washer wand continues across surface. Clean stripe expands slowly revealing dramatic before/after. Water spray catches light. Camera tracks the cleaning line.',
      pool_spa:           'Pool water slowly clarifies and brightens from murky green toward blue. Technician stirs treatment. Surface ripples softly. Camera slowly zooms out to show full pool.',
      handyman:           'Handyman continues precise repair work. Tool makes small adjustment. Component settles perfectly into place. Camera slowly pushes in on the detail being fixed.',
      flooring:           'Flooring installer continues clicking planks into place. Row by row the floor expands. Camera slowly pulls back to reveal more of the finished floor. Natural light steady.',
      junk_removal:       'Team members continue loading items into truck. Space gradually clears. Before/after contrast visible in frame. Camera slowly reveals empty clean space emerging.',
      solar:              'Installer continues securing solar panel onto mounting rail. Racking clicks into alignment. Crew member hands off next panel. Camera slowly pans along growing row of installed panels. Full sun glints off clean glass surface.',
      gutter_cleaning:    'Technician continues scooping debris from gutter trough. Organic matter drops away. Water flows freely toward downspout. Camera tracks along the gutter line from clogged to clear. Natural outdoor daylight.',
    };

    const motion = motionDescriptions[industry] || 'Technician continues working methodically. Subtle natural motion. Camera drifts gently. Authentic documentary feel.';
    return (motion + seasonalNote).substring(0, 512);
  }

  /**
   * Pika prompt — social-first, energetic Reels/TikTok style.
   * Pika is optimized for short-form social content. Energetic but authentic.
   * Hard 400 char limit enforced.
   */
  _buildPikaPrompt(customer, script, imagePrompt) {
    const industry = customer.industry || 'general_contractor';
    const biz = customer.business_name || 'local business';
    const loc = customer.location || 'your area';

    const socialStyles = {
      plumbing:           `Satisfying plumbing repair reveal. Professional work by local plumber in ${loc}. Before/after pipe replacement. Real job site footage. Authentic local business.`,
      hvac:               `Satisfying HVAC service by local technician in ${loc}. Filter before/after reveal. Real residential job. Clean energy efficient system result.`,
      roofing:            `Dramatic roofing transformation by local crew in ${loc}. Before damaged roof vs after new install. Real job footage. Community trusted contractor.`,
      concrete:           `Satisfying concrete transformation in ${loc}. Before cracked driveway vs after smooth finish. Real local crew. Before/after reveal.`,
      landscaping:        `Satisfying lawn and landscape transformation in ${loc}. Before overgrown vs after manicured yard. Drone reveal. Local landscaping crew.`,
      electrical:         `Professional electrical upgrade by local electrician in ${loc}. Panel before/after. Safe certified work. Trusted local service.`,
      painting:           `Dramatic color transformation by local painters in ${loc}. Before vs after room reveal. Professional clean result. Trusted local crew.`,
      pest_control:       `Home protected by local pest control in ${loc}. Before infestation evidence vs after clean treatment. Family safe result.`,
      general_contractor: `Incredible renovation transformation in ${loc}. Before gutted space vs after finished result. Local trusted contractor. Real project footage.`,
      cleaning:           `Satisfying cleaning transformation in ${loc}. Before grimy vs after spotless. Professional local cleaning team. Real results.`,
      tree_service:       `Dramatic tree removal by local arborist crew in ${loc}. Safe professional removal. Property protected. Local trusted service.`,
      pressure_washing:   `Most satisfying pressure washing in ${loc}. Before black grimy surface vs after bright clean reveal. Local service real results.`,
      pool_spa:           `Pool transformation in ${loc}. Before green murky water vs after crystal blue. Local pool service real results.`,
      handyman:           `Satisfying repair fix by local handyman in ${loc}. Problem solved cleanly and quickly. Real job footage. Trusted local service.`,
      flooring:           `Beautiful flooring transformation in ${loc}. Before vs after room reveal. Local flooring crew real installation footage.`,
      junk_removal:       `Most satisfying junk removal in ${loc}. Before packed garage vs after completely empty clean space. Local crew real results.`,
      solar:              `Solar panel installation by local crew in ${loc}. Property gaining energy independence. Real installation footage. System going live reveal.`,
      gutter_cleaning:    `Satisfying gutter cleaning in ${loc}. Before clogged debris vs after clean flowing gutters and downspout. Local crew real results.`,
    };

    const prompt = socialStyles[industry] || `Local service transformation in ${loc}. Professional result. Real job footage. Trusted community business.`;
    return prompt.substring(0, 400);
  }

  _getCurrentSeason() {
    const m = new Date().getMonth() + 1;
    if (m >= 3 && m <= 5) return 'spring';
    if (m >= 6 && m <= 8) return 'summer';
    if (m >= 9 && m <= 11) return 'fall';
    return 'winter';
  }
}

module.exports = VideoService;
