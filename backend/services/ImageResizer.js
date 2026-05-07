'use strict';

const sharp = require('sharp');
const axios = require('axios');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const PLATFORM_SPECS = {
  facebook_feed:     { width: 1200, height: 630,  format: 'jpeg', quality: 85 },
  facebook_square:   { width: 1200, height: 1200, format: 'jpeg', quality: 85 },
  instagram_feed:    { width: 1080, height: 1350, format: 'jpeg', quality: 85 },
  instagram_square:  { width: 1080, height: 1080, format: 'jpeg', quality: 85 },
  instagram_stories: { width: 1080, height: 1920, format: 'jpeg', quality: 85 },
  google_business:   { width: 720,  height: 720,  format: 'jpeg', quality: 85 },
  universal_feed:    { width: 1080, height: 1350, format: 'jpeg', quality: 85 },
};

const SAFE_ZONES = {
  facebook_feed:     { topPercent: 5,  bottomPercent: 5,  leftPercent: 5,  rightPercent: 5  },
  facebook_square:   { topPercent: 5,  bottomPercent: 5,  leftPercent: 5,  rightPercent: 5  },
  instagram_feed:    { topPercent: 8,  bottomPercent: 15, leftPercent: 8,  rightPercent: 8  },
  instagram_square:  { topPercent: 8,  bottomPercent: 8,  leftPercent: 8,  rightPercent: 8  },
  instagram_stories: { topPercent: 14, bottomPercent: 20, leftPercent: 8,  rightPercent: 8  },
  google_business:   { topPercent: 10, bottomPercent: 10, leftPercent: 10, rightPercent: 10 },
  universal_feed:    { topPercent: 10, bottomPercent: 15, leftPercent: 10, rightPercent: 10 },
};

const DEFAULT_PLATFORMS = ['facebook_feed', 'instagram_feed', 'google_business'];

async function resizeForPlatform(inputBuffer, platform) {
  const spec = PLATFORM_SPECS[platform];
  if (!spec) throw new Error(`Unknown platform: ${platform}`);

  const buffer = await sharp(inputBuffer)
    .rotate()
    .resize(spec.width, spec.height, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: spec.quality, mozjpeg: true })
    .toBuffer();

  const meta = await sharp(buffer).metadata();
  return {
    buffer,
    metadata: { width: meta.width, height: meta.height, sizeKB: Math.round(buffer.length / 1024), platform },
  };
}

async function resizeForAllPlatforms(inputBuffer, platforms = DEFAULT_PLATFORMS) {
  const results = {};
  await Promise.all(platforms.map(async (platform) => {
    try {
      results[platform] = await resizeForPlatform(inputBuffer, platform);
    } catch (err) {
      console.error(`[ImageResizer] Failed to resize for ${platform}:`, err.message);
    }
  }));
  return results;
}

function getImageSafeZone(platform) {
  const zone = SAFE_ZONES[platform] || SAFE_ZONES.universal_feed;
  const spec = PLATFORM_SPECS[platform] || PLATFORM_SPECS.universal_feed;
  return {
    ...zone,
    platform,
    pixels: {
      top:    Math.round(spec.height * (zone.topPercent    / 100)),
      bottom: Math.round(spec.height * (zone.bottomPercent / 100)),
      left:   Math.round(spec.width  * (zone.leftPercent   / 100)),
      right:  Math.round(spec.width  * (zone.rightPercent  / 100)),
    },
    safeArea: {
      width:  Math.round(spec.width  * (1 - (zone.leftPercent  + zone.rightPercent)  / 100)),
      height: Math.round(spec.height * (1 - (zone.topPercent   + zone.bottomPercent) / 100)),
    },
  };
}

async function validateImageDimensions(buffer) {
  const warnings = [];
  let isValid = true;
  try {
    const meta = await sharp(buffer).metadata();
    const fileSizeMB = buffer.length / (1024 * 1024);

    if (fileSizeMB > 8)  warnings.push(`File is ${fileSizeMB.toFixed(1)}MB — will compress.`);
    if (meta.width < 400 || meta.height < 400) { warnings.push('Image too small (under 400px). Output may be blurry.'); isValid = false; }
    else if (meta.width < 600 || meta.height < 600) warnings.push('Image under 600px — recommend higher resolution.');
    if (meta.pages && meta.pages > 1) warnings.push('Animated image — only first frame will be used.');

    return {
      isValid, width: meta.width, height: meta.height, format: meta.format,
      fileSizeMB: parseFloat(fileSizeMB.toFixed(2)), warnings,
      recommendation: isValid ? (warnings.length ? 'Proceeding with warnings' : 'Image looks great') : 'Use a higher resolution image',
    };
  } catch (err) {
    return { isValid: false, width: 0, height: 0, format: 'unknown', fileSizeMB: 0, warnings: [`Could not read image: ${err.message}`], recommendation: 'File may be corrupted' };
  }
}

function uploadToCloudinary(buffer, publicId) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: 'image', overwrite: true, format: 'jpeg' },
      (error, result) => (error ? reject(new Error(`Cloudinary upload failed: ${error.message}`)) : resolve(result.secure_url))
    ).end(buffer);
  });
}

async function fetchImageAsBuffer(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: { 'User-Agent': 'ItsPosting/1.0' },
    maxContentLength: 50 * 1024 * 1024,
  });
  return Buffer.from(response.data);
}

/**
 * Resize and upload all platform variants to Cloudinary.
 * Returns URLs for each platform. No DB access — callers handle DB.
 *
 * @param {Buffer|string} input - Buffer or URL
 * @param {string} pathId - Used for Cloudinary folder path (e.g. postId or temp ID)
 * @param {string|number} customerId
 * @param {string[]} platforms
 * @returns {Promise<Object>} { original, facebook_feed, instagram_feed, ... }
 */
async function uploadResizedImages(input, pathId, customerId, platforms = DEFAULT_PLATFORMS) {
  const inputBuffer = typeof input === 'string' ? await fetchImageAsBuffer(input) : input;

  const validation = await validateImageDimensions(inputBuffer);
  if (validation.warnings.length > 0) {
    console.log(`[ImageResizer] Warnings for ${pathId}:`, validation.warnings);
  }

  // Upload compressed original
  const originalBuffer = await sharp(inputBuffer).rotate().jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  let originalUrl = null;
  try {
    originalUrl = await uploadToCloudinary(originalBuffer, `itsposting/${customerId}/${pathId}/original`);
  } catch (err) {
    console.error('[ImageResizer] Failed to upload original:', err.message);
  }

  // Resize and upload all platform variants in parallel
  const resized = await resizeForAllPlatforms(inputBuffer, platforms);
  const urls = { original: originalUrl };

  await Promise.all(Object.entries(resized).map(async ([platform, { buffer, metadata }]) => {
    try {
      urls[platform] = await uploadToCloudinary(buffer, `itsposting/${customerId}/${pathId}/${platform}`);
      console.log(`[ImageResizer] Uploaded ${platform} (${metadata.sizeKB}KB) for ${pathId}`);
    } catch (err) {
      console.error(`[ImageResizer] Failed to upload ${platform}:`, err.message);
      urls[platform] = null;
    }
  }));

  return {
    ...urls,
    validation,
    platformsGenerated: platforms.filter(p => urls[p]),
    platformsFailed:    platforms.filter(p => !urls[p]),
  };
}

async function generateThumbnail(inputBuffer, width = 300, height = 300) {
  return sharp(inputBuffer)
    .rotate()
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 70, mozjpeg: true })
    .toBuffer();
}

function getPlatformSpecs() { return PLATFORM_SPECS; }

function getAllSafeZones() {
  return Object.keys(PLATFORM_SPECS).reduce((acc, p) => { acc[p] = getImageSafeZone(p); return acc; }, {});
}

module.exports = {
  resizeForPlatform,
  resizeForAllPlatforms,
  uploadResizedImages,
  validateImageDimensions,
  getImageSafeZone,
  generateThumbnail,
  fetchImageAsBuffer,
  getPlatformSpecs,
  getAllSafeZones,
  PLATFORM_SPECS,
  SAFE_ZONES,
  DEFAULT_PLATFORMS,
};
