/**
 * VideoSlideService — NanoBanana-powered animated Reels for local service businesses.
 *
 * Strategy: Use tools we already have (NanoBanana + FFmpeg) instead of depending on Veo.
 * NanoBanana generates 3 targeted images (problem → work → result) in parallel (~15-25s).
 * Sharp adds branded text bars. FFmpeg crossfades them into a 6-second branded Reel.
 *
 * No Veo required. Works for ALL customers with GOOGLE_AI_API_KEY set.
 * Veo is the cinematic upgrade — this is the reliable foundation.
 */

const axios = require('axios');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const os = require('os');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const NanoBananaService = require('./NanoBananaService');

ffmpeg.setFfmpegPath(ffmpegPath);

// Maps content type → background music mood
// Place royalty-free MP3s in backend/audio/{mood}.mp3
// Source: pixabay.com/music — free for commercial use
// Tracks to download:
//   upbeat.mp3   → bright, fast-paced (job reveals, promos, team)
//   warm.mp3     → positive, gentle  (reviews, community)
//   friendly.mp3 → light, informative (tips, FAQs)
//   energetic.mp3→ urgent, driving   (seasonal, promotions)
const CONTENT_TYPE_MOOD = {
  job_finished:   'upbeat',
  got_review:     'warm',
  share_tip:      'friendly',
  promotion:      'energetic',
  seasonal:       'energetic',
  team_spotlight: 'upbeat',
  faq:            'friendly',
  community:      'warm',
};

// Industry-aware color palette for text bars
const INDUSTRY_COLORS = {
  plumbing:           '#1565C0',
  hvac:               '#C62828',
  roofing:            '#37474F',
  concrete:           '#546E7A',
  landscaping:        '#2E7D32',
  electrical:         '#E65100',
  painting:           '#6A1B9A',
  pest_control:       '#BF360C',
  cleaning:           '#00695C',
  general_contractor: '#4E342E',
  tree_service:       '#1B5E20',
  pressure_washing:   '#0277BD',
  pool_spa:           '#00838F',
  handyman:           '#4E342E',
  flooring:           '#5D4037',
  junk_removal:       '#37474F',
  solar:              '#F57F17',
  gutter_cleaning:    '#1565C0',
};

// Readable industry labels for top bar
const INDUSTRY_LABELS = {
  plumbing: 'PLUMBING', hvac: 'HVAC', roofing: 'ROOFING', concrete: 'CONCRETE',
  landscaping: 'LANDSCAPING', electrical: 'ELECTRICAL', painting: 'PAINTING',
  pest_control: 'PEST CONTROL', cleaning: 'CLEANING', general_contractor: 'HOME SERVICES',
  tree_service: 'TREE SERVICE', pressure_washing: 'PRESSURE WASHING', pool_spa: 'POOL & SPA',
  handyman: 'HANDYMAN', flooring: 'FLOORING', junk_removal: 'JUNK REMOVAL',
  solar: 'SOLAR', gutter_cleaning: 'GUTTER CLEANING',
};

class VideoSlideService {
  constructor() {
    this.nanoBanana = new NanoBananaService();

    if (process.env.CLOUDINARY_CLOUD_NAME) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }
  }

  isAvailable() {
    return !!process.env.GOOGLE_AI_API_KEY && !!process.env.CLOUDINARY_CLOUD_NAME;
  }

  /**
   * Generate a 6-second branded animated Reel from 3 NanoBanana images.
   * @param {Object} customer - Customer DB record
   * @param {string} script - Claude-generated caption (used as context for prompts)
   * @param {Object} options - { contentType, aspectRatio }
   */
  async generate(customer, script, options = {}) {
    const { contentType = 'job_finished', aspectRatio = '9:16' } = options;

    const tmpDir = path.join(os.tmpdir(), `vsvc_${Date.now()}_${customer.id || 0}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    try {
      const isVertical = aspectRatio === '9:16';
      const [vW, vH] = isVertical ? [1080, 1920] : [1080, 1350];

      const industry = customer.industry || 'general_contractor';
      const biz = this._trim(customer.business_name || 'Local Expert', 28);
      const loc = this._trim(customer.location || 'your area', 22);
      const accentColor = INDUSTRY_COLORS[industry] || '#1565C0';

      const { framePrompts, bars } = this._buildFramePlan(customer, contentType, script, industry, biz, loc);

      console.log(`[VideoSlide] Generating 3 NanaBanana frames in parallel (${industry}, ${contentType})`);

      // 3 parallel NanaBanana calls — per-frame retry if one times out
      const frameResults = await Promise.all(
        framePrompts.map(async (prompt, i) => {
          try {
            return await this.nanoBanana.generateFromPrompt(customer, prompt, { aspectRatio });
          } catch (firstErr) {
            console.warn(`[VideoSlide] Frame ${i} failed (${firstErr.message}), retrying in 2s…`);
            await new Promise(r => setTimeout(r, 2000));
            return await this.nanoBanana.generateFromPrompt(customer, prompt, { aspectRatio });
          }
        })
      );

      // Download each image → Sharp resize + text bar overlay → save to temp file
      const framePaths = [];
      for (let i = 0; i < frameResults.length; i++) {
        const framePath = path.join(tmpDir, `frame_${i}.jpg`);
        await this._processFrame(frameResults[i].url, framePath, bars[i], vW, vH, accentColor);
        framePaths.push(framePath);
      }

      // Pick background music if available (backend/audio/{mood}.mp3)
      const audioPath = this._pickAudioTrack(contentType);

      // FFmpeg crossfade animation → 7s total with audio fade-out
      const outputPath = path.join(tmpDir, 'output.mp4');
      await this._buildVideo(framePaths, outputPath, vW, vH, audioPath);

      // Upload final video to Cloudinary
      const url = await this._uploadToCloudinary(outputPath, customer.id);
      console.log(`[VideoSlide] Reel ready: ${url.substring(0, 60)}...`);

      return { url, type: 'video', provider: 'nanobanana_reel' };

    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }
  }

  // ─── Frame plan per content type ────────────────────────────────────────────

  /**
   * Returns { framePrompts, bars } for the 3 slides.
   * framePrompts: NanaBanana prompt for each frame image
   * bars: text overlay config for each frame { top, bottom }
   */
  _buildFramePlan(customer, contentType, script, industry, biz, loc) {
    const label = INDUSTRY_LABELS[industry] || 'HOME SERVICES';
    const style = 'Ultra-realistic residential photography. Vertical 9:16 framing. Professional warm lighting. Cinematic depth of field. No text. Real home environment.';

    // Common CTA bar (frame 3 bottom)
    const ctaBottom = `${biz}  ·  ${loc}`;

    const plans = {

      job_finished: {
        framePrompts: [
          `${this._problemScene(industry, loc)} ${style}`,
          `${this._workScene(industry)} ${style}`,
          `${this._resultScene(industry, loc)} ${style}`,
        ],
        bars: [
          { top: `${label} PROBLEM?`,     bottom: biz },
          { top: 'WE FIX IT RIGHT',        bottom: biz },
          { top: 'CALL US TODAY',          bottom: ctaBottom },
        ],
      },

      got_review: {
        framePrompts: [
          `Smartphone held in hand showing a 5-star Google review, home interior background blurred. ${style}`,
          `${this._resultScene(industry, loc)} Happy satisfied homeowner visible in background. ${style}`,
          `Friendly professional ${industry.replace(/_/g, ' ')} technician at front door in uniform, warm natural light. ${style}`,
        ],
        bars: [
          { top: '5-STAR REVIEW',    bottom: biz },
          { top: 'ANOTHER HAPPY CUSTOMER', bottom: biz },
          { top: 'JOIN OUR CUSTOMERS', bottom: ctaBottom },
        ],
      },

      share_tip: {
        framePrompts: [
          `Professional ${industry.replace(/_/g, ' ')} expert pointing at a common household problem, educational gesture, closeup. ${style}`,
          `${this._workScene(industry)} Close-up of skilled expert hands demonstrating the correct technique. ${style}`,
          `${this._resultScene(industry, loc)} Perfectly done result, homeowner looking satisfied. ${style}`,
        ],
        bars: [
          { top: 'PRO TIP',          bottom: biz },
          { top: 'THE RIGHT WAY',    bottom: biz },
          { top: 'QUESTIONS? CALL US', bottom: ctaBottom },
        ],
      },

      promotion: {
        framePrompts: [
          `${this._workScene(industry)} Professional crew showing high quality work in progress, natural light. ${style}`,
          `${this._resultScene(industry, loc)} Stunning transformation, excellent finished result. ${style}`,
          `Professional ${industry.replace(/_/g, ' ')} team smiling and confident, uniforms with company logo impression. ${style}`,
        ],
        bars: [
          { top: 'SPECIAL OFFER',     bottom: biz },
          { top: 'QUALITY YOU CAN TRUST', bottom: biz },
          { top: 'BOOK TODAY',        bottom: ctaBottom },
        ],
      },

      seasonal: {
        framePrompts: [
          `${this._seasonalProblemScene(industry)} Urgent ${this._getCurrentSeason()} problem visible in residential setting. ${style}`,
          `${this._workScene(industry)} Fast professional response to seasonal emergency. ${style}`,
          `${this._resultScene(industry, loc)} Problem solved before it got worse, relieved homeowner. ${style}`,
        ],
        bars: [
          { top: this._seasonalHookText(), bottom: biz },
          { top: 'FAST RESPONSE',     bottom: biz },
          { top: "DON'T WAIT — CALL NOW", bottom: ctaBottom },
        ],
      },

      team_spotlight: {
        framePrompts: [
          `Professional ${industry.replace(/_/g, ' ')} crew in matching uniforms at a job site, confident team. ${style}`,
          `Close-up of expert ${industry.replace(/_/g, ' ')} hands doing precise skilled work, professional tools visible. ${style}`,
          `${industry.replace(/_/g, ' ')} team giving thumbs up after completing a job, completed work visible behind them. ${style}`,
        ],
        bars: [
          { top: 'MEET OUR TEAM',     bottom: biz },
          { top: 'SKILLED & RELIABLE', bottom: biz },
          { top: `YOUR LOCAL ${label}`, bottom: ctaBottom },
        ],
      },

      faq: {
        framePrompts: [
          `Homeowner making a common ${industry.replace(/_/g, ' ')} mistake at home, concerned expression, educational contrast. ${style}`,
          `${industry.replace(/_/g, ' ')} professional demonstrating the correct approach, teaching gesture, clear expert technique. ${style}`,
          `${this._resultScene(industry, loc)} Professional correct result, clean outcome visible. ${style}`,
        ],
        bars: [
          { top: 'DID YOU KNOW?',    bottom: biz },
          { top: 'THE RIGHT WAY',    bottom: biz },
          { top: 'ASK US ANYTHING',  bottom: ctaBottom },
        ],
      },

      community: {
        framePrompts: [
          `Wide view of a friendly ${loc} residential neighborhood, homes and streets, warm community feel. ${style}`,
          `${industry.replace(/_/g, ' ')} professional crew working on a local home, neighbors visible in background, community setting. ${style}`,
          `${industry.replace(/_/g, ' ')} technician shaking hands with satisfied homeowner at their front door, warm natural light. ${style}`,
        ],
        bars: [
          { top: `PROUD TO SERVE ${loc.toUpperCase()}`, bottom: biz },
          { top: 'YOUR NEIGHBORS',   bottom: biz },
          { top: 'LOCAL & TRUSTED',  bottom: ctaBottom },
        ],
      },
    };

    return plans[contentType] || plans.job_finished;
  }

  // ─── Industry scene descriptions ─────────────────────────────────────────────

  _problemScene(industry, loc) {
    const scenes = {
      plumbing:    `Leaking pipe under kitchen sink, water dripping into cabinet, urgent water damage in ${loc} home.`,
      hvac:        `Homeowner sweating indoors, thermostat at high temperature, struggling AC unit visible outside.`,
      roofing:     `Damaged roof with missing shingles and water stain streaks, storm damage visible from ground level.`,
      concrete:    `Cracked heaved driveway with weeds growing in gaps, hazardous uneven surfaces in ${loc}.`,
      landscaping: `Overgrown neglected yard with patchy dead lawn and tangled weeds, poor curb appeal.`,
      electrical:  `Flickering light fixture and outdated electrical panel with visible hazards, homeowner looking concerned.`,
      painting:    `Peeling and faded exterior or interior paint, worn chipped surfaces, tired appearance.`,
      pest_control:`Homeowner discovering pest evidence in kitchen cabinet, concerned expression, clear infestation signs.`,
      cleaning:    `Very dirty kitchen with grease-covered stovetop and stained countertops before professional cleaning.`,
    };
    return scenes[industry] || `Home in need of ${industry.replace(/_/g, ' ')} service, clear problem visible, homeowner concerned.`;
  }

  _workScene(industry) {
    const scenes = {
      plumbing:    `Licensed plumber confidently tightening pipe connections under sink with professional tools, headlamp lit.`,
      hvac:        `HVAC technician attaching manifold gauges to outdoor condenser unit, systematic professional diagnosis.`,
      roofing:     `Roofing crew installing new shingles in steady teamwork rhythm, safety equipment visible, blue sky.`,
      concrete:    `Concrete crew screeding fresh pour across driveway, precision teamwork, smooth motion, bright day.`,
      landscaping: `Landscaping team mowing edging and planting in coordinated action, green transformation in progress.`,
      electrical:  `Licensed electrician making precise wire connections inside panel, expert hands, proper safety equipment.`,
      painting:    `Professional painter rolling vibrant fresh paint across wall in smooth even strokes, crisp lines.`,
      pest_control:`Pest control technician in uniform methodically applying professional treatment around home perimeter.`,
      cleaning:    `Professional cleaning team working efficiently surface by surface, gleaming results appearing.`,
    };
    return scenes[industry] || `Skilled ${industry.replace(/_/g, ' ')} professional working methodically at residential property, expert tools visible.`;
  }

  _resultScene(industry, loc) {
    const scenes = {
      plumbing:    `Gleaming dry cabinet under sink with new pipe installed, no leaks, homeowner smiling with relief in ${loc}.`,
      hvac:        `Comfortable cool home with thermostat set perfectly, homeowner relaxing and smiling, relief visible in ${loc}.`,
      roofing:     `Brand new pristine roof gleaming in sunlight, perfect shingles, clean gutters, curb appeal restored in ${loc}.`,
      concrete:    `Flawless smooth new driveway, perfect finish, incredible transformation, stunning result in ${loc}.`,
      landscaping: `Immaculate manicured lawn and beautiful garden beds, stunning curb appeal, property transformed in ${loc}.`,
      electrical:  `Modern clean electrical panel, bright reliable lights throughout home, safe and upgraded in ${loc}.`,
      painting:    `Beautifully painted walls with rich fresh color, sharp clean lines, stunning room transformation in ${loc}.`,
      pest_control:`Clean pest-free home, family relaxing comfortably on couch, complete peace of mind in ${loc}.`,
      cleaning:    `Spotlessly clean sparkling home, gleaming every surface, homeowner delighted with result in ${loc}.`,
    };
    return scenes[industry] || `Professional quality result clearly visible, satisfied homeowner, complete transformation in ${loc}.`;
  }

  _seasonalProblemScene(industry) {
    const season = this._getCurrentSeason();
    const seasonal = {
      plumbing:    { winter: 'Frozen pipe under kitchen sink, ice visible, emergency water damage.', summer: 'Water heater failing in summer heat, homeowner frustrated.', spring: 'Spring thaw reveals pipe damage, water stains appearing.', fall: 'Outdoor faucet preparation for winter, homeowner rushing.' },
      hvac:        { summer: 'AC struggling in extreme summer heat, warm air blowing, thermostat showing high temp.', winter: 'Furnace failing in cold winter, family bundled up indoors, cold breath visible.', spring: 'AC unit startup after winter, homeowner nervous about summer.', fall: 'Furnace tune-up time, homeowner calling for service before winter.' },
      roofing:     { fall: 'Fall windstorm damage, missing shingles, homeowner inspecting from ground.', winter: 'Ice dam forming at roof edge, icicles, water infiltrating inside.', spring: 'Post-winter roof inspection, storm damage discovered.', summer: 'Summer sun UV damage to aging shingles, cracking visible.' },
    };
    return seasonal[industry]?.[season] || `${season} season problem requiring immediate ${industry.replace(/_/g, ' ')} service, urgent situation.`;
  }

  _seasonalHookText() {
    const month = new Date().getMonth() + 1;
    if (month <= 2 || month === 12) return 'WINTER IS HERE';
    if (month <= 5) return 'SPRING SEASON';
    if (month <= 8) return 'SUMMER HEAT';
    return 'FALL IS COMING';
  }

  _getCurrentSeason() {
    const m = new Date().getMonth() + 1;
    if (m <= 2 || m === 12) return 'winter';
    if (m <= 5) return 'spring';
    if (m <= 8) return 'summer';
    return 'fall';
  }

  // ─── Image processing ────────────────────────────────────────────────────────

  /**
   * Download a NanaBanana image, resize to video dimensions, add text bars, save to file.
   */
  async _processFrame(imageUrl, outputPath, bars, vW, vH, accentColor) {
    // Download image
    const resp = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 45000 });
    const imgBuffer = Buffer.from(resp.data);

    // Resize to exact video dimensions
    const resized = await sharp(imgBuffer)
      .resize(vW, vH, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 92 })
      .toBuffer();

    // Build SVG composite overlay (top bar + bottom bar)
    const barH = Math.round(vH * 0.075); // ~7.5% of height = 144px on 1920h
    const fontSize = Math.round(barH * 0.38);
    const subFontSize = Math.round(barH * 0.30);

    const overlayParts = [];

    // Top bar: semi-transparent black + accent left strip + label text
    if (bars.top) {
      const topText = this._trim(bars.top, 30).toUpperCase();
      overlayParts.push(`
        <!-- top gradient bar -->
        <rect x="0" y="0" width="${vW}" height="${barH + 20}" fill="rgba(0,0,0,0.72)"/>
        <rect x="0" y="0" width="10" height="${barH + 20}" fill="${accentColor}"/>
        <text x="${vW / 2}" y="${barH * 0.62}"
          font-family="Arial, Helvetica, sans-serif"
          font-size="${fontSize}" font-weight="bold"
          fill="#ffffff" text-anchor="middle"
          letter-spacing="3"
        >${this._escapeXml(topText)}</text>
      `);
    }

    // Bottom bar: semi-transparent black + business name
    if (bars.bottom) {
      const bottomText = this._trim(bars.bottom, 40);
      const barY = vH - barH - 20;
      overlayParts.push(`
        <!-- bottom bar -->
        <rect x="0" y="${barY}" width="${vW}" height="${barH + 20}" fill="rgba(0,0,0,0.72)"/>
        <rect x="0" y="${barY}" width="10" height="${barH + 20}" fill="${accentColor}"/>
        <text x="${vW / 2}" y="${barY + barH * 0.62}"
          font-family="Arial, Helvetica, sans-serif"
          font-size="${subFontSize}" font-weight="bold"
          fill="#ffffff" text-anchor="middle"
        >${this._escapeXml(bottomText)}</text>
      `);
    }

    if (overlayParts.length === 0) {
      fs.writeFileSync(outputPath, resized);
      return;
    }

    const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${vW}" height="${vH}">
      ${overlayParts.join('\n')}
    </svg>`;

    await sharp(resized)
      .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
      .jpeg({ quality: 92 })
      .toFile(outputPath);
  }

  // ─── Video assembly ──────────────────────────────────────────────────────────

  /**
   * Animate 3 image frames with FFmpeg crossfade transitions + optional background music.
   *
   * Timing: 2.3s / 2.3s / 3.0s (CTA slide holds longer) with 0.3s dissolves
   * Total = (2.3 + 2.3 + 3.0) - (2 × 0.3) = 7.0 seconds
   *
   * Audio: if audioPath exists, mixed in at 40% volume with 1s fade-out at 6s.
   * If no audio file found, produces a silent video (still works fine).
   */
  _buildVideo(framePaths, outputPath, vW, vH, audioPath = null) {
    const slideDurations = [2.3, 2.3, 3.0];  // last slide holds 3s — CTA needs time
    const transitionDur = 0.3;
    // xfade offset = cumulative hold time before each transition
    const offsets = [
      slideDurations[0] - transitionDur,                                       // 2.0
      slideDurations[0] - transitionDur + slideDurations[1] - transitionDur,  // 4.0
    ];

    const hasAudio = audioPath && fs.existsSync(audioPath);
    if (hasAudio) {
      console.log(`[VideoSlide] Mixing audio: ${path.basename(audioPath)}`);
    } else if (audioPath) {
      console.log(`[VideoSlide] Audio file not found (${audioPath}) — silent video`);
    }

    return new Promise((resolve, reject) => {
      const cmd = ffmpeg();

      // Image inputs — each looped for its slide duration
      framePaths.forEach((p, i) => {
        cmd.input(p).inputOptions(['-loop 1', `-t ${slideDurations[i]}`, '-framerate 30']);
      });

      // Audio input (optional)
      if (hasAudio) {
        cmd.input(audioPath);
      }

      // Build filter_complex: scale each frame, then xfade chain
      const filters = [];

      framePaths.forEach((_, i) => {
        filters.push(
          `[${i}:v]` +
          `scale=${vW}:${vH}:force_original_aspect_ratio=decrease,` +
          `pad=${vW}:${vH}:(ow-iw)/2:(oh-ih)/2,` +
          `format=yuv420p,` +
          `setpts=PTS-STARTPTS` +
          `[sv${i}]`
        );
      });

      // xfade chain: sv0 + sv1 → xf1 → xf1 + sv2 → out
      let prevLabel = 'sv0';
      for (let i = 1; i < framePaths.length; i++) {
        const outLabel = i === framePaths.length - 1 ? 'out' : `xf${i}`;
        filters.push(
          `[${prevLabel}][sv${i}]` +
          `xfade=transition=dissolve:duration=${transitionDur}:offset=${offsets[i - 1]}` +
          `[${outLabel}]`
        );
        prevLabel = outLabel;
      }

      const outputOptions = [
        '-map [out]',
        '-c:v libx264',
        '-preset fast',
        '-crf 22',
        '-pix_fmt yuv420p',
        '-r 30',
      ];

      if (hasAudio) {
        const audioInputIdx = framePaths.length; // audio is the last input
        outputOptions.push(
          `-map ${audioInputIdx}:a`,
          '-c:a aac',
          '-b:a 128k',
          '-af afade=t=out:st=6.0:d=1.0,volume=0.40',  // fade out at 6s, 40% volume (music under visuals)
          '-shortest',  // cut audio at video end (7s)
        );
      }

      outputOptions.push('-y');

      cmd
        .complexFilter(filters)
        .outputOptions(outputOptions)
        .output(outputPath);

      cmd
        .on('start', (cmdLine) => console.log('[VideoSlide] FFmpeg:', cmdLine.substring(0, 120)))
        .on('end', () => { console.log('[VideoSlide] FFmpeg done'); resolve(); })
        .on('error', (err) => { console.error('[VideoSlide] FFmpeg error:', err.message); reject(err); })
        .run();
    });
  }

  /**
   * Pick a background music track based on content type mood.
   * Looks in backend/audio/{mood}.mp3 — returns null if not found (silent video).
   */
  _pickAudioTrack(contentType) {
    const mood = CONTENT_TYPE_MOOD[contentType] || 'upbeat';
    const audioDir = path.join(__dirname, '..', 'audio');
    const trackPath = path.join(audioDir, `${mood}.mp3`);
    return trackPath;  // _buildVideo checks fs.existsSync before using
  }

  // ─── Cloudinary upload ───────────────────────────────────────────────────────

  async _uploadToCloudinary(filePath, customerId) {
    const publicId = `itsposting/reels/${customerId || 0}/${Date.now()}`;
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'video',
      public_id: publicId,
      overwrite: true,
      quality: 'auto:best',
    });
    return result.secure_url;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  _escapeXml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  _trim(text, max) {
    const s = String(text || '').trim();
    return s.length <= max ? s : s.substring(0, max - 1).trimEnd() + '…';
  }
}

module.exports = VideoSlideService;
