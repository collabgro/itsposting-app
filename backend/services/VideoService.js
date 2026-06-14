/**
 * VideoService — Abstraction layer for all video generation providers.
 *
 * Hard provider separation — never mix:
 * videoType: 'avatar'   → HeyGen ONLY (talking-head AI presenter)
 * videoType: 'services' → Cinematic pipeline (two modes via videoStyle):
 *
 *   videoStyle: 'reel' (DEFAULT — fast, always available)
 *     NanaBanana 3-frame animated reel (VideoSlideService + FFmpeg)
 *     Cost: ~$0 extra beyond image gen. Speed: 25-40s.
 *
 *   videoStyle: 'cinematic' (TRUE AI VIDEO — real camera motion)
 *     NanoBanana key frame image
 *       ↓
 *     Veo 3.1 Lite (primary — requires VEO_ENABLED=true, uses GOOGLE_AI_API_KEY)
 *       ↓ fail / not enabled
 *     FalService: Kling 3.0 → Wan 2.5 → Luma Ray-2 (requires FAL_API_KEY)
 *       ↓ fail
 *     Pika 2.2 (requires PIKA_API_KEY)
 *       ↓ all fail
 *     VideoSlideService (animated reel fallback — always available)
 *
 * NOTE: RunwayService is kept but removed from the chain — Runway API went
 * Enterprise-only in January 2026. Use FalService instead.
 */

const HeyGenService = require('./HeyGenService');
const VeoService = require('./VeoService');
const FalService = require('./FalService');
const PikaService = require('./PikaService');
const NanoBananaService = require('./NanoBananaService');
const VideoSlideService = require('./VideoSlideService');
const industryKnowledge = require('../data/industryKnowledge');

class VideoService {
  constructor() {
    this.heygen = new HeyGenService();
    this.veo = new VeoService();
    this.fal = new FalService();
    this.pika = new PikaService();
    this.nanoBanana = new NanoBananaService();
    this.slideVideo = new VideoSlideService();
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
      videoStyle = 'reel',   // 'reel' (animated slideshow, fast) | 'cinematic' (true AI video)
      contentType = null,
      imagePrompt = null,
      aspectRatio = '9:16',
      durationSeconds = 6,
      skipKeyFrame = false,
      musicMood = 'auto',
    } = options;

    // Path A: Avatar video → HeyGen (no fallback chain for avatar)
    if (videoType === 'avatar') {
      console.log('[VideoService] Avatar video — routing to HeyGen');
      return await this.heygen.generateFromScript(customer, script, options);
    }

    // Path B1: Animated Reel — NanaBanana 3-frame slideshow (fast, always available, ~free)
    if (videoStyle === 'reel') {
      console.log('[VideoService] Reel style — NanaBanana animated reel (VideoSlideService)');
      return await this.slideVideo.generate(customer, script, { contentType, aspectRatio, musicMood });
    }

    // Path B2: Cinematic AI — true video generation with real camera motion
    console.log('[VideoService] Cinematic style — Veo → fal.ai (Kling/Wan/Luma) → Pika → Reel fallback');

    const anyCinematicAvailable = this.veo.isAvailable() || this.fal.isAvailable() || this.pika.isAvailable();
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
      console.log('[VideoService] Skipping NanaBanana key frame (text-to-video mode)');
    }

    return await this._generateCinematicVideo(customer, script, { keyFrameUrl, aspectRatio, durationSeconds, contentType, musicMood, options });
  }

  /**
   * Try each cinematic provider in order, falling through on failure.
   * Falls back to VideoSlideService (animated reel) if all true-video providers fail.
   */
  async _generateCinematicVideo(customer, script, { keyFrameUrl, aspectRatio, durationSeconds, contentType, musicMood, options }) {

    // 1. Veo 3.1 Lite — Google's video model, same GOOGLE_AI_API_KEY as NanaBanana
    //    Enable with VEO_ENABLED=true. Costs ~$0.05-0.15/s. Fastest true AI video.
    if (this.veo.isAvailable()) {
      try {
        const veoPrompt = this._buildVeoPrompt(customer, script, keyFrameUrl, contentType);
        return await this.veo.generate(veoPrompt, keyFrameUrl, { aspectRatio, durationSeconds });
      } catch (veoErr) {
        console.warn('[VideoService] Veo failed, trying fal.ai:', veoErr.message);
      }
    } else {
      console.log('[VideoService] Veo not enabled (set VEO_ENABLED=true) — trying fal.ai');
    }

    // 2. fal.ai — Kling 3.0 → Wan 2.5 → Luma Ray-2 (internal cascade in FalService)
    //    Best quality for local service businesses. Kling excels at realistic human motion.
    //    ~$0.25-0.42 per 5s clip. Set FAL_API_KEY (free $20 credits at fal.ai).
    if (this.fal.isAvailable()) {
      try {
        const falPrompt = this._buildFalPrompt(customer, script, keyFrameUrl, contentType);
        return await this.fal.generate(falPrompt, keyFrameUrl, { aspectRatio, durationSeconds });
      } catch (falErr) {
        console.warn('[VideoService] fal.ai failed, trying Pika:', falErr.message);
      }
    } else {
      console.log('[VideoService] fal.ai not configured (set FAL_API_KEY) — trying Pika');
    }

    // 3. Pika 2.2 — social-first video, affordable fallback ($0.05/s)
    if (this.pika.isAvailable()) {
      try {
        const pikaPrompt = this._buildPikaPrompt(customer, script, keyFrameUrl);
        return await this.pika.generate(pikaPrompt, keyFrameUrl, { aspectRatio, durationSeconds });
      } catch (pikaErr) {
        console.warn('[VideoService] Pika failed, falling back to animated reel:', pikaErr.message);
      }
    } else {
      console.log('[VideoService] Pika not configured — falling back to animated reel');
    }

    // 4. VideoSlideService — last resort for cinematic mode (NanaBanana reel + FFmpeg)
    //    Never fails as long as GOOGLE_AI_API_KEY is set. Customer gets a reel instead
    //    of true cinematic video but still gets quality branded content.
    if (this.slideVideo.isAvailable()) {
      console.log('[VideoService] All cinematic providers failed — falling back to NanaBanana animated reel');
      return await this.slideVideo.generate(customer, script, { contentType, aspectRatio, musicMood });
    }

    throw new Error('All video providers failed. Check GOOGLE_AI_API_KEY, FAL_API_KEY, and PIKA_API_KEY in Railway env vars.');
  }

  /**
   * Veo prompt — 3-act story, content-type-aware.
   *
   * The wizard's Step 1 choice (contentType) determines the VIDEO NARRATIVE:
   *   job_finished  → before/after reveal (most satisfying, most viral)
   *   got_review    → happy homeowner + celebration of the result
   *   share_tip     → expert demonstrating a useful tip to camera
   *   promotion     → urgency + deal reveal + call to action
   *   seasonal      → seasonal problem shown + urgent solution
   *   team_spotlight → crew introduction + teamwork in action
   *   faq           → common mistake shown → correct way demonstrated
   *   community     → local neighborhood presence + community pride
   *
   * Each content type × industry = targeted, relevant video for that exact post.
   * Veo 3.1 timestamp format: [HH:MM-HH:MM] scene. SFX: sound. A narrator says: text.
   */
  _buildVeoPrompt(customer, script, imagePrompt, contentType) {
    const industry = customer.industry || 'general_contractor';
    const biz = (customer.business_name || 'local expert').substring(0, 30);
    const loc = (customer.location || 'your area').substring(0, 25);
    const ct = contentType || 'job_finished';

    console.log(`[VideoService] Building Veo prompt: industry=${industry}, contentType=${ct}`);

    // ── REVIEW / TESTIMONIAL videos ─────────────────────────────────────────
    // Customer chose "Got a review" — show a happy homeowner moment
    if (ct === 'got_review') {
      const reviewActs = {
        plumbing:   { a2: 'Homeowner in freshly repaired kitchen, turning faucet on and off with a smile, genuinely happy.' },
        hvac:       { a2: 'Homeowner at thermostat, comfortable home, air flowing through vents, visible relief and satisfaction.' },
        roofing:    { a2: 'Homeowner standing in front of newly completed roof, pointing up proudly, giving thumbs up.' },
        concrete:   { a2: 'Homeowner standing on flawless new driveway, gesturing to the clean surface, clearly delighted.' },
        landscaping:{ a2: 'Homeowner admiring their transformed lawn and garden, hands on hips, smiling broadly.' },
        electrical: { a2: 'Homeowner at newly upgraded electrical panel, lights bright and reliable, family comfortable.' },
        painting:   { a2: 'Homeowner standing in beautifully repainted room, arms open wide, admiring the transformation.' },
        pest_control:{ a2: 'Family relaxing comfortably at home — no worries, no pests, complete peace of mind visible.' },
        cleaning:   { a2: 'Homeowner in spotless gleaming kitchen, touching clean surfaces with delight and disbelief.' },
      };
      const rm = reviewActs[industry] || { a2: 'Satisfied homeowner giving thumbs up and big smile in front of beautifully completed work.' };
      const prompt = `[00:00-00:02] Close-up of 5-star review on phone screen, then pull back to reveal the homeowner holding it. SFX: notification ding.\n[00:02-00:04] ${rm.a2}\n[00:04-00:06] Text on screen: "5 stars." ${biz} in ${loc} — trusted by your neighbors. A narrator says: another happy customer. Ambient: warm triumphant music.\n9:16 vertical framing. Cinematic and warm. No subtitles.`;
      return prompt.substring(0, 900);
    }

    // ── TIP / EDUCATIONAL videos ─────────────────────────────────────────────
    // Customer chose "Share a tip" — professional giving useful advice
    if (ct === 'share_tip') {
      const tipActs = {
        plumbing:   'Split screen: left — homeowner ignoring a slow drain. Right — plumber pointing to the drain trap, explaining the fix.',
        hvac:       'HVAC tech holding a clogged air filter vs clean new filter, pointing to the difference, explaining why it matters.',
        roofing:    'Roofer on roof pointing to early warning signs of damage — lifted shingles, granule loss — explaining what to look for.',
        concrete:   'Concrete expert crouching next to a small crack, explaining how small cracks become big problems if ignored.',
        landscaping:'Landscaper demonstrating proper mowing height, showing before and after grass health in the same shot.',
        electrical: 'Electrician at panel pointing to a tripped breaker, explaining the right way to reset it safely.',
        painting:   'Painter demonstrating proper surface prep — sanding, priming — explaining why skipping this ruins the final result.',
        pest_control:'Pest control tech showing common entry points around a door frame, explaining how to prevent pest intrusion.',
        cleaning:   'Cleaning professional demonstrating proper bathroom disinfection sequence — showing which surfaces to hit first and why.',
      };
      const tipScene = tipActs[industry] || 'Local service professional demonstrating a key professional tip, pointing to the detail that most homeowners miss.';
      const prompt = `[00:00-00:02] ${tipScene} SFX: ambient natural sound.\n[00:02-00:04] Close-up of the specific technique or problem being shown. Camera focuses on the expert detail. Natural authentic lighting.\n[00:04-00:06] Professional looks directly at camera: A narrator says: from ${biz} in ${loc} — hope that helps. Ambient: light friendly music.\n9:16 vertical. Authentic handheld feel. No subtitles.`;
      return prompt.substring(0, 900);
    }

    // ── PROMOTION / DEAL videos ──────────────────────────────────────────────
    // Customer chose "Running a promotion" — urgency + value
    if (ct === 'promotion') {
      const promoActs = {
        plumbing:   'Plumber at front door of home, holding up a "Spring Tune-Up Special" sign, friendly and inviting.',
        hvac:       'HVAC tech next to outdoor condenser unit, pointing to a "AC Tune-Up Deal" sign. Seasonal urgency.',
        roofing:    'Roofing crew on rooftop, team shot, one crew member holding a "Free Inspection" sign. Professional and trustworthy.',
        concrete:   'Concrete crew standing next to a freshly poured driveway, presenting a limited-time offer sign.',
        landscaping:'Landscaping crew with equipment, presenting a spring lawn care special. Green lush results visible behind them.',
        electrical: 'Electrician at panel holding a "Panel Safety Check" coupon, expert and trustworthy.',
        painting:   'Painter in front of freshly painted wall, holding a color chip fan and a special offer sign.',
        pest_control:'Pest control tech in uniform at front door, presenting a seasonal treatment package offer.',
        cleaning:   'Cleaning team in matching uniforms presenting a first-clean discount, home sparkling behind them.',
      };
      const promoScene = promoActs[industry] || 'Local service professional in uniform presenting a special offer directly to camera. Friendly, genuine, and trustworthy.';
      const prompt = `[00:00-00:02] Bold text flash: "Limited Time Offer" — then cut to: ${promoScene} SFX: upbeat alert sound.\n[00:02-00:04] Quick cut montage of three recent job results — quality work visible. Fast paced, satisfying. SFX: whoosh transitions.\n[00:04-00:06] Call to action: A narrator says: call ${biz} in ${loc} today — this offer ends soon. Ambient: energetic promotional music.\n9:16 vertical. Dynamic and urgent. No subtitles.`;
      return prompt.substring(0, 900);
    }

    // ── SEASONAL / URGENT videos ─────────────────────────────────────────────
    // Customer chose "Seasonal content" — current season problem + solution
    if (ct === 'seasonal') {
      const season = this._getCurrentSeason();
      const seasonalActs = {
        plumbing: {
          winter: 'Frozen pipe bursting under sink — water spraying, emergency damage. Camera captures the urgency.',
          spring: 'Spring thaw reveals pipe damage — homeowner discovering water damage under flooring, shocked.',
          summer: 'Water heater failing in summer heat — no hot water, homeowner frustrated at shower.',
          fall:   'Homeowner winterizing outdoor faucets with help of plumber before frost arrives.',
        },
        hvac: {
          winter: 'Furnace struggling in winter — cold home, family bundled up indoors, thermostat reading low.',
          spring: 'AC unit covered after winter, homeowner and HVAC tech preparing it for summer season.',
          summer: 'Summer heat wave — AC struggling, house not cooling, homeowner sweating indoors.',
          fall:   'Homeowner scheduling fall furnace tune-up before winter arrives. Smart preparation shown.',
        },
        roofing: {
          winter: 'Heavy snow load on roof — ice dams forming at eaves, water infiltrating the fascia.',
          spring: 'Post-winter roof inspection — finding storm damage before spring rains cause more problems.',
          summer: 'Intense summer sun beating down — roofing team inspecting UV-damaged shingles.',
          fall:   'Fall storm damage — missing shingles after wind, emergency repair crew on the scene.',
        },
      };
      const sActs = seasonalActs[industry];
      const scenicProblem = sActs?.[season] || `Local homeowner dealing with a ${season} ${industry.replace('_', ' ')} emergency — urgent problem clearly visible.`;
      const prompt = `[00:00-00:02] ${scenicProblem} SFX: weather sounds appropriate to season.\n[00:02-00:04] ${biz} crew arriving quickly, professional and prepared, ready to solve the seasonal emergency. SFX: truck arriving, crew deploying.\n[00:04-00:06] Problem solved, homeowner relieved. A narrator says: ${biz} in ${loc} — ready when ${season} hits hard. Ambient: reassuring upbeat music.\n9:16 vertical. Urgent and authentic. No subtitles.`;
      return prompt.substring(0, 900);
    }

    // ── TEAM SPOTLIGHT videos ────────────────────────────────────────────────
    if (ct === 'team_spotlight') {
      const prompt = `[00:00-00:02] Wide shot of the full ${industry.replace('_', ' ')} crew at a job site — working together, tools out, professional and capable. SFX: ambient job site sounds.\n[00:02-00:04] Quick cuts: each team member at their specific task, close-up of skilled hands at work, faces showing focus and pride. Documentary style.\n[00:04-00:06] Full crew giving thumbs up or fist bump at completed job. A narrator says: this is the team at ${biz} serving ${loc}. Ambient: upbeat confident music.\n9:16 vertical. Authentic team energy. No subtitles.`;
      return prompt.substring(0, 900);
    }

    // ── FAQ / MYTH-BUST videos ────────────────────────────────────────────────
    if (ct === 'faq') {
      const faqActs = {
        plumbing:   'Split screen: homeowner pouring grease down drain (wrong) vs properly disposing of grease in a container (right).',
        hvac:       'Homeowner blocking air vents with furniture (wrong) vs all vents clear for proper airflow (right).',
        roofing:    'Homeowner ignoring a small roof leak (wrong) vs calling for early inspection before it spreads (right).',
        cleaning:   'Homeowner mixing bleach and ammonia cleaners (dangerous wrong) vs using correct separate products (right).',
      };
      const faqScene = faqActs[industry] || 'Common homeowner mistake shown clearly, then the correct professional approach demonstrated side by side.';
      const prompt = `[00:00-00:02] Text flash: "Common Mistake" — then: ${faqScene} SFX: error sound for wrong side, clean chime for right side.\n[00:02-00:04] Expert from ${biz} explaining directly to camera why the mistake is costly and what the right approach is. Natural and educational.\n[00:04-00:06] A narrator says: questions? ${biz} in ${loc} answers them. Ambient: friendly informative music.\n9:16 vertical. Educational and clear. No subtitles.`;
      return prompt.substring(0, 900);
    }

    // ── COMMUNITY videos ─────────────────────────────────────────────────────
    if (ct === 'community') {
      const prompt = `[00:00-00:02] Aerial or wide shot of a recognizable ${loc} neighborhood — familiar local surroundings, genuine and local. SFX: ambient neighborhood sounds.\n[00:02-00:04] ${biz} crew working on a job in the neighborhood — trucks with logo visible, team in uniform, part of the community fabric.\n[00:04-00:06] Crew member waves to a passing neighbor, genuine community connection. A narrator says: ${biz} — proud to serve ${loc}. Ambient: warm community music.\n9:16 vertical. Warm and local. No subtitles.`;
      return prompt.substring(0, 900);
    }

    // ── JOB FINISHED / DEFAULT — before → work → after reveal ───────────────
    // The "most satisfying" video type for local service businesses.
    // Also the fallback for any unrecognized content type.
    const jobActs = {
      plumbing:    { a1: 'Close-up of a dripping faucet under a kitchen sink, water staining the cabinet. SFX: persistent drip.', a2: 'Licensed plumber\'s confident hands tightening copper pipe fitting with wrench, headlamp lit up.', a3: `Kitchen sink running perfectly clear, gleaming cabinet. A narrator says: ${biz} — plumbing done right. SFX: water flowing cleanly. Ambient: upbeat professional music.` },
      hvac:        { a1: 'Indoor thermostat showing high temperature, homeowner fanning themselves. SFX: struggling AC unit humming.', a2: 'HVAC technician attaching manifold gauges to outdoor condenser, systematic diagnosis in daylight.', a3: `Cool air flowing from vents, homeowner smiling with relief. A narrator says: ${biz} — stay comfortable. Ambient: relieved upbeat music.` },
      roofing:     { a1: 'Aerial shot of damaged roof — missing shingles, visible water damage and worn underlayment.', a2: 'Roofing crew in steady rhythm installing new shingles silhouetted against bright sky. SFX: rhythmic nail gun.', a3: `Pristine new roof gleaming in sunlight, crew giving thumbs up. A narrator says: ${biz} — roofs built to last. Ambient: triumphant upbeat music.` },
      concrete:    { a1: 'Wide shot of cracked heaved driveway — hazardous surface, weeds in cracks, clear before state.', a2: 'Concrete crew screeding fresh pour across driveway, teamwork and precision, smooth motion.', a3: `Flawless new concrete driveway gleaming. A narrator says: ${biz} in ${loc}. Ambient: confident upbeat music.` },
      landscaping: { a1: 'Overgrown neglected yard — tangled weeds, patchy lawn, poor curb appeal.', a2: 'Landscaping crew mowing, edging, and planting in sync under bright daylight, transformation in progress.', a3: `Immaculate lawn and garden. A narrator says: ${biz} transforms yards in ${loc}. Ambient: cheerful upbeat music.` },
      electrical:  { a1: 'Outdated electrical panel with visible hazards, homeowner looking concerned. SFX: flickering power hum.', a2: 'Licensed electrician making precise confident connections inside panel, close-up expert hands at work.', a3: `Modern upgraded panel, safe and reliable. A narrator says: ${biz} — certified electrical. Ambient: reassuring music.` },
      painting:    { a1: 'Dull peeling walls in tired dated room — before state, natural interior light.', a2: 'Professional painter rolling vibrant color onto wall in smooth even strokes, transformation happening.', a3: `Stunning transformed room with rich flawless color. A narrator says: ${biz} transforms spaces. Ambient: uplifting music.` },
      pest_control:{ a1: 'Signs of pest infestation in home — homeowner discovering problem, concerned expression.', a2: 'Pest control technician conducting thorough inspection and professional treatment, systematic and confident.', a3: `Clean protected home, family relaxing. A narrator says: ${biz} — your home protected. Ambient: safe reassuring music.` },
      general_contractor: { a1: 'Dated worn room before renovation — old finishes waiting for transformation.', a2: 'Renovation crew working with skilled craftsmanship, tools and teamwork, progress clearly visible.', a3: `Stunning finished renovation reveal. A narrator says: ${biz} builds ${loc} right. Ambient: triumphant reveal music.` },
      cleaning:    { a1: 'Grimy kitchen — dirty surfaces, grease-covered stove, dull floors before the team arrives.', a2: 'Professional cleaning team working efficiently surface by surface. SFX: squeaky clean sounds.', a3: `Spotless gleaming kitchen. A narrator says: ${biz} — spotless guaranteed. Ambient: cheerful satisfying music.` },
      tree_service:{ a1: 'Large dead tree dangerously close to home, homeowner worried. SFX: wind through dead branches.', a2: 'Arborist crew with bucket truck, controlled professional removal, safety ropes and teamwork.', a3: `Clear safe yard, tree gone. A narrator says: ${biz} — expert tree removal in ${loc}. Ambient: relief upbeat music.` },
      pressure_washing: { a1: 'Half of driveway black with grime, half freshly cleaned — dramatic contrast visible.', a2: 'Pressure washer wand revealing bright clean stripe across dark grimy surface, tracking shot follows.', a3: `Fully restored bright driveway. A narrator says: ${biz} in ${loc}. SFX: water rushing. Ambient: satisfying upbeat music.` },
      pool_spa:    { a1: 'Murky green pool — uninviting, algae-covered, homeowner shaking head.', a2: 'Pool technician adding treatment, brushing walls, water gradually clarifying. SFX: gentle water movement.', a3: `Crystal clear blue pool sparkling. A narrator says: ${biz} restores your pool in ${loc}. Ambient: refreshing upbeat music.` },
      handyman:    { a1: 'Broken fixture or damaged item in home — clear problem, homeowner frustrated.', a2: 'Handyman making precise repair with professional tools, focused and skilled. Close-up expert hands.', a3: `Perfect repair complete. A narrator says: ${biz} — no job too small in ${loc}. Ambient: satisfied upbeat music.` },
      flooring:    { a1: 'Old worn carpet or cracked tile floors — dated and tired looking.', a2: 'Flooring team laying beautiful hardwood planks row by row, satisfying installation progress.', a3: `Stunning new floor transformation full room reveal. A narrator says: ${biz} floors ${loc} homes. Ambient: uplifting reveal music.` },
      junk_removal:{ a1: 'Overloaded garage packed floor to ceiling — complete chaos, no space to move.', a2: 'Junk removal crew rapidly clearing items, fast documentary cuts, space emerging fast.', a3: `Completely empty clean garage. A narrator says: ${biz} clears ${loc}. SFX: quiet empty space. Ambient: triumphant music.` },
      solar:       { a1: 'Empty residential roof from drone view — untapped potential under full sunlight.', a2: 'Solar installation crew mounting panels in expanding rows, aerial view reveals growing system.', a3: `Complete solar array gleaming. A narrator says: ${biz} powers ${loc} homes. Ambient: inspiring upbeat music.` },
      gutter_cleaning: { a1: 'Clogged gutters overflowing during rain — leaves and debris, water damage risk visible.', a2: 'Technician scooping debris from gutters on ladder, debris clearing, tracking shot along roofline.', a3: `Clean gutters with water flowing freely. A narrator says: ${biz} — gutters cleared right. Ambient: clean refreshing music.` },
    };

    const a = jobActs[industry];
    if (a) {
      const prompt = `[00:00-00:02] ${a.a1}\n[00:02-00:04] ${a.a2}\n[00:04-00:06] ${a.a3}\n9:16 vertical framing for social media Reels. Cinematic documentary quality. No subtitles. No text overlays.`;
      console.log(`[VideoService] Veo job-finished prompt for ${industry} (${prompt.length} chars)`);
      return prompt.substring(0, 900);
    }

    // Generic fallback
    const fallback = `[00:00-00:02] Homeowner facing a service problem at their home, clearly in need of professional help. SFX: ambient problem sounds.\n[00:02-00:04] Skilled ${industry.replace('_', ' ')} professional arriving and confidently solving the problem with expert tools.\n[00:04-00:06] Problem solved, satisfied homeowner. A narrator says: ${biz} in ${loc} — quality you can trust. Ambient: upbeat professional music.\n9:16 vertical framing. Cinematic quality. No subtitles.`;
    console.log(`[VideoService] Veo generic fallback for ${industry}`);
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

  /**
   * fal.ai / Kling prompt — image-to-video motion description.
   * Kling excels at realistic human motion on a key frame image.
   * The prompt describes WHAT MOVES in the scene (not the scene itself — that's the image).
   * Hard 500 char limit per FalService.buildInput().
   */
  _buildFalPrompt(customer, script, imageUrl, contentType) {
    const industry = customer.industry || 'general_contractor';
    const ct = contentType || 'job_finished';

    // Motion descriptions optimised for Kling image-to-video
    // Focus on: specific body part motion, camera move, ambient elements
    const motionByType = {
      job_finished: {
        plumbing:         "Plumber's gloved hands tighten pipe fitting with confident wrist rotation. Copper gleams under headlamp. Camera slowly pushes forward. Water begins flowing cleanly. Authentic job site feel.",
        hvac:             'HVAC technician adjusts manifold gauge dial with precise finger movement. Condenser fan spins in background. Camera gently pans right. Natural outdoor light shifts.',
        roofing:          'Roofer continues nailing shingles in steady rhythm. Safety vest catches wind. Camera slowly pulls back revealing more of the new roof. Sky bright.',
        concrete:         'Crew continues screeding fresh concrete pour. Wet surface glistens. Screed board slides smoothly across form. Camera pulls back to show the full pour.',
        landscaping:      'Landscaper rakes mulch into garden bed. Mulch scatters naturally. Nearby grass sways gently in breeze. Camera slowly rises to reveal full yard.',
        electrical:       'Electrician's hands route wires through panel with precision. Headlamp beam moves slightly. Camera slowly pushes in on the clean wire connections.',
        painting:         'Painter roller sweeps vibrant color across wall in smooth even strokes. Paint sheen glistens under natural light. Camera tracks right following the roller.',
        cleaning:         'Cleaning team member wipes surface to reveal gleaming shine. Reflection appears on the surface. Camera slowly pulls back showing the full transformation.',
        general_contractor:'Crew member frames wall — hammer strikes nail rhythmically. Wood settles into place. Sawdust drifts. Camera pulls back revealing the emerging renovation.',
        pressure_washing:  'Pressure washer wand tracks across surface. Clean bright stripe expands revealing dramatic before/after contrast in same frame. Water spray catches light.',
        flooring:          'Flooring installer clicks plank into place. Row by row the floor expands. Camera slowly pulls back. Natural light plays across the new surface.',
      },
      got_review: {
        default: 'Homeowner smiles and nods with genuine satisfaction. Camera slowly zooms in on the happy expression. Warm ambient light. Soft focus background.',
      },
      share_tip: {
        default: 'Expert professional points to specific detail with confident hand gesture. Camera follows pointing finger to the key detail. Natural educational energy.',
      },
      promotion: {
        default: 'Professional in uniform makes direct eye contact with camera, gestures toward offer. Energetic confident body language. Camera slowly pushes in.',
      },
    };

    const industryMotions = motionByType[ct] || motionByType.job_finished;
    const motion = industryMotions?.[industry] || industryMotions?.default
      || `${industry.replace('_', ' ')} professional continues working methodically. Subtle natural motion. Camera drifts gently. Authentic documentary feel.`;

    return motion.substring(0, 500);
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
