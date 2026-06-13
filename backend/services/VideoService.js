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
      durationSeconds = 6,
      skipKeyFrame = false,
    } = options;

    // Path A: Avatar video → HeyGen (no fallback chain for avatar)
    if (videoType === 'avatar') {
      console.log('[VideoService] Avatar video — routing to HeyGen');
      return await this.heygen.generateFromScript(customer, script, options);
    }

    // Path B: Services/cinematic video
    console.log('[VideoService] Services video — NanoBanana key frame → Veo → Runway → Pika → HeyGen fallback');

    // Skip NanoBanana key frame when skipKeyFrame=true (text-to-video is faster for Veo)
    const anyCinematicAvailable = this.veo.isAvailable() || this.runway.isAvailable() || this.pika.isAvailable();
    let keyFrameUrl = null;
    if (!skipKeyFrame && imagePrompt && anyCinematicAvailable) {
      try {
        const imgResult = await this.nanoBanana.generateFromPrompt(customer, imagePrompt, { aspectRatio });
        keyFrameUrl = imgResult.url;
        console.log('[VideoService] Key frame generated:', keyFrameUrl.substring(0, 60));
      } catch (imgErr) {
        console.warn('[VideoService] Key frame generation failed, proceeding without it:', imgErr.message);
      }
    } else if (skipKeyFrame) {
      console.log('[VideoService] Skipping NanoBanana key frame (text-to-video mode)');
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

    throw new Error('Services video: all cinematic providers failed or unavailable. Enable VEO_ENABLED=true in Railway.');
  }

  /**
   * Veo prompt — 3-act story structure with audio.
   *
   * Format follows Veo 3.1 best practices:
   *   [timestamp] Visual description. SFX: sounds. Ambient: music.
   *   A narrator says: short phrase.
   *
   * Act 1 (00:00-00:02): The problem / before state — hook the viewer
   * Act 2 (00:02-00:04): The professional doing the work — credibility
   * Act 3 (00:04-00:06): The result + business name voiceover — conversion
   *
   * This mirrors what high-performing local business videos actually do on
   * Instagram Reels and TikTok: show the ugly before, the skilled fix,
   * and the satisfying after — in under 8 seconds.
   */
  _buildVeoPrompt(customer, script, imagePrompt) {
    const industry = customer.industry || 'general_contractor';
    const biz = (customer.business_name || 'local expert').substring(0, 30);
    const loc = (customer.location || 'your area').substring(0, 25);

    // 3-act definitions per industry: before → work → after + audio
    const acts = {
      plumbing: {
        a1: 'Close-up of a dripping faucet under a kitchen sink, water staining the cabinet. SFX: persistent drip.',
        a2: 'Tracking shot of licensed plumber\'s confident hands tightening copper pipe fitting with wrench, headlamp light.',
        a3: `Kitchen sink running perfectly clear, gleaming cabinet. A narrator says: ${biz} — plumbing done right. SFX: water flowing cleanly. Ambient: upbeat professional music.`,
      },
      hvac: {
        a1: 'Indoor thermostat showing high temperature, homeowner uncomfortably fanning themselves. SFX: struggling AC unit.',
        a2: 'HVAC technician attaching manifold gauges to outdoor condenser, systematic diagnosis in natural daylight.',
        a3: `Cool air flowing from vents, homeowner smiling with relief. A narrator says: ${biz} — stay comfortable year-round. Ambient: relieved upbeat music.`,
      },
      roofing: {
        a1: 'Aerial shot of damaged roof — missing shingles, visible water damage, worn underlayment.',
        a2: 'Roofing crew in steady rhythm installing new shingles, silhouetted against bright sky. SFX: rhythmic nail gun.',
        a3: `Pristine new roof gleaming in sunlight, crew giving thumbs up. A narrator says: ${biz} — roofs built to last. Ambient: triumphant upbeat music.`,
      },
      concrete: {
        a1: 'Wide shot of cracked, heaved driveway — hazardous surface, weeds in cracks.',
        a2: 'Concrete crew screeding fresh pour across driveway, teamwork and precision, smooth motion.',
        a3: `Flawless new concrete driveway gleaming, smooth finish. A narrator says: ${biz} in ${loc}. Ambient: confident upbeat music. SFX: satisfying quiet.`,
      },
      landscaping: {
        a1: 'Overgrown neglected yard — tangled weeds, patchy lawn, poor curb appeal.',
        a2: 'Landscaping crew mowing, edging, and planting in sync under bright daylight, transformation in progress.',
        a3: `Immaculate lawn and garden, stunning curb appeal. A narrator says: ${biz} transforms yards in ${loc}. Ambient: cheerful upbeat music.`,
      },
      electrical: {
        a1: 'Outdated electrical panel with visible hazards, homeowner looking concerned. SFX: flickering power hum.',
        a2: 'Licensed electrician making precise confident connections inside panel, close-up of expert hands at work.',
        a3: `Modern upgraded panel, safe and reliable. A narrator says: ${biz} — certified electrical. Ambient: reassuring confident music.`,
      },
      painting: {
        a1: 'Dull peeling walls in tired dated room — before state, natural interior light.',
        a2: 'Professional painter rolling vibrant color onto wall in smooth even strokes, visible transformation happening.',
        a3: `Stunning transformed room with rich flawless color. A narrator says: ${biz} transforms spaces. SFX: satisfied exhale. Ambient: uplifting music.`,
      },
      pest_control: {
        a1: 'Signs of pest infestation in home — homeowner discovering problem, concerned expression.',
        a2: 'Pest control technician conducting thorough inspection and professional treatment, systematic and confident.',
        a3: `Clean protected home, family relaxing comfortably. A narrator says: ${biz} — your home protected. Ambient: safe reassuring music.`,
      },
      general_contractor: {
        a1: 'Dated worn room before renovation — old finishes, tired design waiting for transformation.',
        a2: 'Renovation crew working with skilled craftsmanship, tools and teamwork, progress visible.',
        a3: `Stunning finished renovation — incredible transformation. A narrator says: ${biz} builds ${loc} right. Ambient: triumphant reveal music.`,
      },
      cleaning: {
        a1: 'Grimy kitchen — dirty surfaces, grease-covered stove, dull floors before the team arrives.',
        a2: 'Professional cleaning team working efficiently surface by surface, transformation visible. SFX: squeaky clean sounds.',
        a3: `Spotless gleaming kitchen — truly immaculate. A narrator says: ${biz} — spotless guaranteed. Ambient: cheerful satisfying music.`,
      },
      tree_service: {
        a1: 'Large dead tree dangerously close to home, homeowner worried. SFX: wind through dead branches.',
        a2: 'Arborist crew with bucket truck, controlled professional removal, safety ropes and teamwork.',
        a3: `Clear safe yard, tree gone. A narrator says: ${biz} — safe expert tree removal in ${loc}. Ambient: relief upbeat music.`,
      },
      pressure_washing: {
        a1: 'Half of driveway black with grime, other half freshly cleaned — dramatic contrast visible.',
        a2: 'Pressure washer wand revealing bright clean stripe across dark grimy surface, tracking shot follows clean line.',
        a3: `Fully restored bright driveway — incredible contrast. A narrator says: ${biz} in ${loc}. SFX: water rushing. Ambient: satisfying upbeat music.`,
      },
      pool_spa: {
        a1: 'Murky green pool — uninviting, algae-covered, homeowner shaking head.',
        a2: 'Pool technician adding treatment, brushing walls, water gradually clarifying. SFX: gentle water movement.',
        a3: `Crystal clear blue pool sparkling in sunlight. A narrator says: ${biz} restores your pool in ${loc}. Ambient: refreshing upbeat music.`,
      },
      handyman: {
        a1: 'Broken fixture or damaged item in home — clear problem, homeowner frustrated.',
        a2: 'Handyman making precise repair with professional tools, focused and skilled. Close-up of expert hands.',
        a3: `Perfect repair complete. A narrator says: ${biz} — no job too small in ${loc}. Ambient: satisfied upbeat music.`,
      },
      flooring: {
        a1: 'Old worn carpet or cracked tile floors — dated and tired looking.',
        a2: 'Flooring team laying beautiful hardwood planks row by row, satisfying installation progress.',
        a3: `Stunning new floor transformation — full room reveal. A narrator says: ${biz} floors ${loc} homes. Ambient: uplifting reveal music.`,
      },
      junk_removal: {
        a1: 'Overloaded garage packed floor to ceiling — complete chaos, no space to move.',
        a2: 'Junk removal crew rapidly clearing items, fast documentary cuts, space emerging fast.',
        a3: `Completely empty clean garage — dramatic transformation. A narrator says: ${biz} clears ${loc}. SFX: quiet empty space. Ambient: triumphant music.`,
      },
      solar: {
        a1: 'Empty residential roof from drone view — untapped potential under full sunlight.',
        a2: 'Solar installation crew mounting panels in expanding rows, aerial view reveals growing system.',
        a3: `Complete solar array gleaming in full sun. A narrator says: ${biz} powers ${loc} homes. Ambient: inspiring upbeat music.`,
      },
      gutter_cleaning: {
        a1: 'Clogged gutters overflowing during rain — leaves and debris, water damage risk visible.',
        a2: 'Technician scooping debris from gutters on ladder, debris clearing, tracking shot along roofline.',
        a3: `Clean gutters with water flowing freely. A narrator says: ${biz} — gutters cleared right. Ambient: clean refreshing music.`,
      },
    };

    const a = acts[industry];
    if (a) {
      const prompt = `[00:00-00:02] ${a.a1}\n[00:02-00:04] ${a.a2}\n[00:04-00:06] ${a.a3}\n9:16 vertical framing for social media Reels. Cinematic documentary quality. No subtitles. No text overlays.`;
      console.log(`[VideoService] Veo 3-act prompt for ${industry} (${prompt.length} chars)`);
      return prompt.substring(0, 900);
    }

    // Generic fallback
    const fallback = `[00:00-00:02] Homeowner facing a service problem at their home, clearly in need of professional help. SFX: ambient problem sounds.\n[00:02-00:04] Skilled local service professional arriving and confidently solving the problem with expert tools.\n[00:04-00:06] Problem solved, satisfied homeowner. A narrator says: ${biz} in ${loc} — quality you can trust. Ambient: upbeat professional music.\n9:16 vertical framing. Cinematic quality. No subtitles.`;
    console.log(`[VideoService] Veo fallback prompt for ${industry}`);
    return fallback.substring(0, 900);
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
