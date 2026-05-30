/**
 * Midjourney Service - via Replicate
 * Alternative image generation - higher quality but more expensive
 * Cost: ~$0.08 per image
 * Speed: ~15-20 seconds
 */

const axios = require('axios');
const cloudinary = require('cloudinary').v2;
const industryKnowledge = require('../data/industryKnowledge');

class MidjourneyService {
  constructor() {
    this.replicateToken = process.env.REPLICATE_API_TOKEN;
    this.baseUrl = 'https://api.replicate.com/v1';
    
    if (!this.replicateToken) {
      console.warn('⚠️  REPLICATE_API_TOKEN not set - Midjourney will not work');
    }

    if (process.env.CLOUDINARY_CLOUD_NAME) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }
  }

  async generateFromPrompt(customer, userPrompt, options = {}) {
    if (!this.replicateToken) {
      throw new Error('Midjourney not configured. Set REPLICATE_API_TOKEN in .env');
    }

    const enhancedPrompt = this.enhancePrompt(customer, userPrompt, options);
    const imageUrl = await this.generateImage(enhancedPrompt, options);

    return {
      url: imageUrl,
      type: 'image',
      model: 'midjourney',
      provider: 'midjourney',
      prompt: enhancedPrompt,
    };
  }

  enhancePrompt(customer, userPrompt, options = {}) {
    const industry = customer.industry || 'general_contractor';
    const industryData = industryKnowledge[industry] || industryKnowledge.general_contractor || {};
    const iv = industryData.imageVisuals || {};

    const parts = [userPrompt];

    // Photography style — Flux/Replicate responds strongly to editorial photography references
    const photoStyle = this._buildEditorialStyle(industry);
    parts.push(photoStyle);

    // Mood and lighting — critical for Flux to produce authentic (not staged) results
    if (iv.moodAndLighting) {
      parts.push(iv.moodAndLighting);
    }

    // Color palette — grounds the model in real materials of this trade
    if (iv.colorPalette) {
      parts.push(`natural color palette: ${iv.colorPalette}`);
    }

    // Seasonal visual context
    const season = this._getCurrentSeason();
    const seasonalVisual = iv.seasonalVisuals?.[season];
    if (seasonalVisual) {
      parts.push(`seasonal context: ${seasonalVisual}`);
    }

    // Brand color in workwear
    const brandColor = (() => {
      if (!customer.brand_colors) return null;
      const c = customer.brand_colors;
      if (typeof c === 'string' && c.trim()) return c.trim();
      if (Array.isArray(c) && c.length > 0) return c[0];
      if (c?.primary) return c.primary;
      return null;
    })();
    if (brandColor) {
      parts.push(`technician wearing ${brandColor} branded workwear`);
    }

    // Camera/lens language — Flux responds well to photographic technical terms
    const lensStyle = this._buildLensStyle(industry);
    parts.push(lensStyle);

    // Aspect ratio framing
    const arMap = {
      '9:16': 'vertical portrait composition, 9:16 framing, mobile-first',
      '4:5':  'portrait composition, 4:5 framing, social media feed',
      '1:1':  'square composition, centered subject, balanced frame',
      '16:9': 'widescreen landscape, 16:9 framing, wide establishing shot',
    };
    parts.push(arMap[options.aspectRatio] || 'portrait 4:5 social media framing');

    // Quality and realism
    parts.push('photorealistic, sharp focus, high detail, authentic not staged');

    // Avoidance — describe what NOT to generate inline (Flux handles this better inline than as negative prompts)
    const avoidList = iv.avoidCliches?.slice(0, 3).join(', ') || 'cartoon, clipart, stock photography, studio backdrop';
    const finalPrompt = parts.join(', ') +
      `. No text overlays, watermarks, logos. Absolutely not: ${avoidList}.`;

    console.log(`🎨 [Midjourney/Replicate] Enhanced prompt for ${industry} (${finalPrompt.length} chars)`);
    return finalPrompt;
  }

  /**
   * Editorial photography style per trade — tells Flux which real-world
   * photographic tradition to emulate for maximum authenticity.
   */
  _buildEditorialStyle(industry) {
    const styles = {
      plumbing:           'National Geographic editorial trade photography style, photojournalism, real licensed plumber at work in residential home, authentic documentary',
      hvac:               'editorial trade photography, photojournalism style, HVAC technician at real job site, documentary authenticity',
      roofing:            'outdoor editorial photography, photojournalism, roofing crew at work on residential property, natural daylight documentary',
      concrete:           'construction documentary photography, editorial style, concrete crew at active residential job site, natural outdoor light',
      landscaping:        'outdoor editorial photography, landscape crew at residential property, photojournalism style, natural daylight',
      electrical:         'editorial trade photography, licensed electrician at real residential job site, documentary photojournalism',
      painting:           'editorial residential photography, professional painter at work, photojournalism style, natural interior or exterior light',
      pest_control:       'documentary photography, pest control technician in action at real home, photojournalism authenticity',
      general_contractor: 'construction documentary photography, editorial style, renovation crew at real residential job site',
      cleaning:           'documentary lifestyle photography, professional cleaning team at real home, natural interior light',
      tree_service:       'outdoor editorial photography, arborist crew at residential tree job, photojournalism, natural daylight',
      pressure_washing:   'before/after editorial photography, pressure washing reveal, documentary style, natural outdoor light',
      pool_spa:           'residential lifestyle photography, editorial style, pool technician at work, natural daylight',
      handyman:           'editorial trade photography, handyman at real residential repair job, photojournalism authenticity',
      flooring:           'interior documentary photography, flooring installation in real home, photojournalism style',
      junk_removal:       'before/after documentary photography, junk removal crew at real residential property',
      solar_gutter_cleaning: 'exterior editorial photography, technician cleaning solar panels or gutters on real residential roof',
    };
    return styles[industry] || 'editorial documentary trade photography, real technician at residential job site, photojournalism style';
  }

  /**
   * Camera and lens descriptors per trade — different trades have different
   * natural compositions that make the image feel authentic.
   */
  _buildLensStyle(industry) {
    const lensMap = {
      plumbing:           '50mm equivalent lens, shallow depth of field, sharp focus on hands and pipes, soft background',
      hvac:               '35mm equivalent lens, moderate depth of field, technician and equipment in focus',
      roofing:            'wide angle lens, dramatic perspective from roof height, crew and sky in frame',
      concrete:           '24mm wide angle, crew and fresh pour in frame, natural light',
      landscaping:        'wide shot, 24mm, full yard or bed transformation visible',
      electrical:         '50mm close-up, sharp focus on panel or wiring, hands in precise position',
      painting:           '35mm, wide enough to show the room transformation, brush or roller in motion',
      pest_control:       '50mm, close-up on inspection or treatment, technician in focus',
      general_contractor: 'wide angle, renovation progress visible, crew at work',
      cleaning:           '35mm, before/after comparison composition, sharp reflective surface',
      tree_service:       'wide angle looking up, dramatic tree height, bucket truck in frame',
      pressure_washing:   '35mm, dramatic dirty/clean stripe visible, before/after composition',
      pool_spa:           'wide angle, pool and technician, blue water prominent',
      handyman:           '50mm close-up, specific repair detail in focus, hands at work',
      flooring:           'wide room shot, full floor visible, installation in progress',
      junk_removal:       'wide angle, before/after space transformation, dramatic difference',
      solar_gutter_cleaning: '35mm, roof angle, panels or gutters in frame with technician',
    };
    return lensMap[industry] || '50mm equivalent lens, natural depth of field, subject in sharp focus';
  }

  _getCurrentSeason() {
    const m = new Date().getMonth() + 1;
    if (m >= 3 && m <= 5) return 'spring';
    if (m >= 6 && m <= 8) return 'summer';
    if (m >= 9 && m <= 11) return 'fall';
    return 'winter';
  }

  async generateImage(prompt, options = {}) {
    try {
      console.log('🎨 Midjourney generating...');

      const prediction = await axios.post(
        `${this.baseUrl}/predictions`,
        {
          version: '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
          input: {
            prompt: prompt,
            aspect_ratio: options.aspectRatio || '1:1',
            output_quality: 95,
            output_format: 'jpg',
          },
        },
        {
          headers: {
            Authorization: `Token ${this.replicateToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const imageUrl = await this.waitForCompletion(prediction.data.id);
      const cloudinaryUrl = await this.uploadToCloudinary(imageUrl);

      return cloudinaryUrl;
    } catch (error) {
      console.error('Midjourney error:', error.response?.data || error.message);
      throw new Error(`Image generation failed: ${error.message}`);
    }
  }

  async waitForCompletion(predictionId, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await axios.get(`${this.baseUrl}/predictions/${predictionId}`, {
        headers: { Authorization: `Token ${this.replicateToken}` },
      });

      const status = response.data.status;
      if (status === 'succeeded') return response.data.output[0];
      if (status === 'failed' || status === 'canceled') {
        throw new Error(`Generation failed: ${status}`);
      }

      await new Promise((r) => setTimeout(r, 5000));
    }
    throw new Error('Generation timeout');
  }

  async uploadToCloudinary(imageUrl) {
    if (!process.env.CLOUDINARY_CLOUD_NAME) return imageUrl;

    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        imageUrl,
        { folder: 'itsposting/midjourney', quality: 'auto:best' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result.secure_url);
        }
      );
    });
  }
}

module.exports = MidjourneyService;
