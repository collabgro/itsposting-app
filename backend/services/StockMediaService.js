'use strict';

/**
 * ItsPosting — Smart Stock Media Service
 *
 * Searches royalty-free stock platforms for images before calling NanoBanana.
 * All 6 providers are conditionally loaded based on available API keys.
 * Zero code changes needed to add/remove a provider — just set/unset the env var.
 *
 * Providers supported:
 *   PIXABAY_API_KEY              → Pixabay (free, no attribution, 100 req/min; cache 24h per ToS)
 *   PEXELS_API_KEY               → Pexels (free, no attribution, 200/hr)
 *   UNSPLASH_ACCESS_KEY          → Unsplash (excluded — attribution + hotlinking requirements incompatible with Cloudinary pipeline)
 *   FREEPIK_API_KEY              → Freepik Business API (paid tier, images only)
 *   SHUTTERSTOCK_API_KEY         → Shutterstock (paid subscription, images + video)
 *   STORYBLOCKS_PUBLIC_KEY +
 *   STORYBLOCKS_PRIVATE_KEY      → Storyblocks (paid subscription, best video library)
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');

// ── Tiny LRU Cache (no external dep) ─────────────────────────────────────────
class LRUCache {
  // Pixabay ToS requires caching for 24 hours minimum
  constructor(maxSize = 500, ttlMs = 24 * 60 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  _key(keywords) {
    const sorted = [...keywords].sort().join('|').toLowerCase();
    return crypto.createHash('sha256').update(sorted).digest('hex').slice(0, 16);
  }

  get(keywords) {
    const key = this._key(keywords);
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > this.ttlMs) { this.cache.delete(key); return null; }
    // Move to end (most-recently-used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(keywords, value) {
    const key = this._key(keywords);
    if (this.cache.size >= this.maxSize) {
      this.cache.delete(this.cache.keys().next().value);
    }
    this.cache.set(key, { value, ts: Date.now() });
  }
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function fetchJSON(url, headers = {}, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('JSON parse error')); }
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('Request timeout')); });
    req.on('error', reject);
  });
}

// ── Provider: Pixabay ─────────────────────────────────────────────────────────
class PixabayProvider {
  constructor(apiKey) { this.apiKey = apiKey; this.name = 'pixabay'; }
  supportsVideo() { return true; }

  async search(keywords, mediaType = 'image', limit = 5) {
    const q = encodeURIComponent(keywords.slice(0, 3).join(' '));
    let url;
    if (mediaType === 'video') {
      url = `https://pixabay.com/api/videos/?key=${this.apiKey}&q=${q}&per_page=${limit}&safesearch=true`;
    } else {
      url = `https://pixabay.com/api/?key=${this.apiKey}&q=${q}&image_type=photo&per_page=${limit}&safesearch=true&min_width=1080&orientation=vertical`;
    }
    const data = await fetchJSON(url);
    if (!data.hits) return [];
    if (mediaType === 'video') {
      return data.hits.map(h => ({
        url: h.videos?.medium?.url || h.videos?.small?.url || null,
        thumbUrl: h.videos?.medium?.thumbnail || h.videos?.small?.thumbnail || null,
        width: h.videos?.medium?.width || 1280,
        height: h.videos?.medium?.height || 720,
        tags: (h.tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
        downloads: h.downloads || 0,
        source: this.name, isVideo: true,
      })).filter(r => r.url);
    }
    return data.hits.map(h => ({
      url: h.largeImageURL || h.webformatURL,
      thumbUrl: h.webformatURL,
      width: h.imageWidth || h.webformatWidth || 0,
      height: h.imageHeight || h.webformatHeight || 0,
      tags: (h.tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
      downloads: h.downloads || 0,
      source: this.name, isVideo: false,
    })).filter(r => r.url);
  }
}

// ── Provider: Pexels ──────────────────────────────────────────────────────────
class PexelsProvider {
  constructor(apiKey) { this.apiKey = apiKey; this.name = 'pexels'; }
  supportsVideo() { return true; }

  async search(keywords, mediaType = 'image', limit = 5) {
    const q = encodeURIComponent(keywords.slice(0, 3).join(' '));
    if (mediaType === 'video') {
      const data = await fetchJSON(
        `https://api.pexels.com/videos/search?query=${q}&per_page=${limit}&orientation=portrait`,
        { Authorization: this.apiKey }
      );
      if (!data.videos) return [];
      return data.videos.map(v => {
        const file = v.video_files?.find(f => f.width >= 1080) || v.video_files?.[0];
        return {
          url: file?.link || null,
          thumbUrl: v.video_pictures?.[0]?.picture || null,
          width: file?.width || v.width || 0,
          height: file?.height || v.height || 0,
          tags: (v.alt || '').toLowerCase().split(/\s+/).filter(Boolean),
          downloads: 5000,
          source: this.name, isVideo: true,
        };
      }).filter(r => r.url);
    }
    const data = await fetchJSON(
      `https://api.pexels.com/v1/search?query=${q}&per_page=${limit}&orientation=portrait`,
      { Authorization: this.apiKey }
    );
    if (!data.photos) return [];
    return data.photos.map(p => ({
      url: p.src?.large2x || p.src?.original,
      thumbUrl: p.src?.medium || p.src?.small,
      width: p.width || 0,
      height: p.height || 0,
      tags: (p.alt || '').toLowerCase().split(/\s+/).filter(Boolean),
      downloads: 5000,
      source: this.name, isVideo: false,
    })).filter(r => r.url);
  }
}

// ── Provider: Unsplash (images only) ─────────────────────────────────────────
// EXCLUDED from the active candidate pool for two reasons:
//   1. Attribution required — "Photo by [name] on Unsplash" must be visible wherever the image
//      appears. Our branded photo card overlay leaves no room for this.
//   2. Hotlinking REQUIRED (opposite of Pixabay) — Unsplash requires image URLs to be served
//      directly from their CDN so they can track photo views for photographers. Our pipeline
//      downloads → Sharp brand overlay → re-uploads to Cloudinary, which breaks their tracking.
// Provider code is retained for future flows (e.g., a raw URL display path without branding).
// Excluded via requiresAttribution=true flag, filtered out in findAndValidate().
class UnsplashProvider {
  constructor(accessKey) {
    this.accessKey = accessKey;
    this.name = 'unsplash';
    this.requiresAttribution = true; // excluded from default photo post flow
  }
  supportsVideo() { return false; }

  // Call this after selecting an Unsplash photo — required by Unsplash API ToS.
  // Fire-and-forget; non-blocking.
  trackDownload(photoId) {
    if (!photoId) return;
    fetchJSON(
      `https://api.unsplash.com/photos/${photoId}/download`,
      { Authorization: `Client-ID ${this.accessKey}` }
    ).catch(e => console.warn('[StockMedia] Unsplash download tracking failed:', e.message));
  }

  async search(keywords, mediaType = 'image', limit = 5) {
    if (mediaType === 'video') return [];
    const q = encodeURIComponent(keywords.slice(0, 3).join(' '));
    const data = await fetchJSON(
      `https://api.unsplash.com/search/photos?query=${q}&per_page=${limit}&orientation=portrait`,
      { Authorization: `Client-ID ${this.accessKey}` }
    );
    if (!data.results) return [];
    return data.results.map(p => ({
      url: p.urls?.regular || p.urls?.full,
      thumbUrl: p.urls?.thumb || p.urls?.small,
      width: p.width || 0,
      height: p.height || 0,
      tags: [
        ...(p.tags || []).map(tag => tag.title?.toLowerCase()).filter(Boolean),
        ...(p.alt_description || '').toLowerCase().split(/\s+/),
      ],
      downloads: p.downloads || p.likes * 10 || 0,
      source: this.name, isVideo: false,
      // Retain id so trackDownload() can be called when this photo is selected
      _unsplashId: p.id,
    })).filter(r => r.url);
  }
}

// ── Provider: Freepik (images only, paid Business API) ────────────────────────
class FreepikProvider {
  constructor(apiKey) { this.apiKey = apiKey; this.name = 'freepik'; }
  supportsVideo() { return false; }

  async search(keywords, mediaType = 'image', limit = 5) {
    if (mediaType === 'video') return [];
    const q = encodeURIComponent(keywords.slice(0, 3).join(' '));
    const data = await fetchJSON(
      `https://api.freepik.com/v1/resources?term=${q}&filters[type][id][0]=1&page_size=${limit}`,
      { 'X-Freepik-API-Key': this.apiKey, 'Accept-Language': 'en-US' }
    );
    if (!data.data) return [];
    return data.data.map(item => ({
      url: item.image?.source?.url || null,
      thumbUrl: item.image?.source?.url || null,
      width: item.image?.meta?.width || 1080,
      height: item.image?.meta?.height || 1350,
      tags: (item.title || '').toLowerCase().split(/\s+/).filter(Boolean),
      downloads: item.stats?.downloads || 0,
      source: this.name, isVideo: false,
    })).filter(r => r.url);
  }
}

// ── Provider: Shutterstock (paid subscription) ────────────────────────────────
class ShutterstockProvider {
  constructor(apiKey, apiSecret) {
    this.name = 'shutterstock';
    this.authHeader = `Basic ${Buffer.from(`${apiKey}:${apiSecret || ''}`).toString('base64')}`;
  }
  supportsVideo() { return true; }

  async search(keywords, mediaType = 'image', limit = 5) {
    const q = encodeURIComponent(keywords.slice(0, 3).join(' '));
    if (mediaType === 'video') {
      const data = await fetchJSON(
        `https://api.shutterstock.com/v2/videos/search?query=${q}&per_page=${limit}&sort=popular&orientation=vertical`,
        { Authorization: this.authHeader }
      );
      if (!data.data) return [];
      return data.data.map(v => ({
        url: v.assets?.preview_mp4?.url || null,
        thumbUrl: v.assets?.thumb_jpg?.url || null,
        width: 1080, height: 1920,
        tags: (v.description || '').toLowerCase().split(/\s+/).filter(Boolean),
        downloads: 10000,
        source: this.name, isVideo: true,
      })).filter(r => r.url);
    }
    const data = await fetchJSON(
      `https://api.shutterstock.com/v2/images/search?query=${q}&per_page=${limit}&sort=popular&orientation=vertical&image_type=photo`,
      { Authorization: this.authHeader }
    );
    if (!data.data) return [];
    return data.data.map(img => ({
      url: img.assets?.huge_jpg?.url || img.assets?.preview?.url || null,
      thumbUrl: img.assets?.preview?.url || null,
      width: img.assets?.huge_jpg?.width || 1080,
      height: img.assets?.huge_jpg?.height || 1350,
      tags: (img.description || '').toLowerCase().split(/\s+/).filter(Boolean),
      downloads: 10000,
      source: this.name, isVideo: false,
    })).filter(r => r.url);
  }
}

// ── Provider: Storyblocks (paid subscription, best for video) ─────────────────
class StoryblocksProvider {
  constructor(publicKey, privateKey) {
    this.publicKey = publicKey;
    this.privateKey = privateKey;
    this.name = 'storyblocks';
  }
  supportsVideo() { return true; }

  _hmac(expires) {
    return crypto
      .createHmac('sha256', this.privateKey + expires)
      .update(this.publicKey + expires)
      .digest('hex');
  }

  async search(keywords, mediaType = 'image', limit = 5) {
    const q = encodeURIComponent(keywords.slice(0, 3).join(' '));
    const expires = Math.floor(Date.now() / 1000) + 300;
    const hmac = this._hmac(expires);
    const auth = `public_key=${this.publicKey}&expires=${expires}&hmac=${hmac}`;
    const contentType = mediaType === 'video' ? 'footage' : 'images';
    const url = `https://api.storyblocks.com/api/v2/stock-item/search?keywords=${q}&results_per_page=${limit}&content_type=${contentType}&${auth}`;
    const data = await fetchJSON(url);
    if (!data.results) return [];
    return data.results.map(item => ({
      url: mediaType === 'video'
        ? (item.preview_urls?.mp4_preview || item.preview_urls?.web_url || null)
        : (item.preview_urls?.web_url || item.thumbnail_url || null),
      thumbUrl: item.thumbnail_url || null,
      width: 1080,
      height: mediaType === 'video' ? 1920 : 1350,
      tags: (item.title || item.keywords || '').toLowerCase().split(/[\s,]+/).filter(Boolean),
      downloads: item.views || 1000,
      source: this.name, isVideo: mediaType === 'video',
    })).filter(r => r.url);
  }
}

// ── Main Service ──────────────────────────────────────────────────────────────
class StockMediaService {
  constructor() {
    this.providers = [];
    this.cache = new LRUCache(500, 6 * 60 * 60 * 1000);
    this.anthropic = process.env.ANTHROPIC_API_KEY
      ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      : null;

    if (process.env.PIXABAY_API_KEY)
      this.providers.push(new PixabayProvider(process.env.PIXABAY_API_KEY));
    if (process.env.PEXELS_API_KEY)
      this.providers.push(new PexelsProvider(process.env.PEXELS_API_KEY));
    if (process.env.UNSPLASH_ACCESS_KEY)
      this.providers.push(new UnsplashProvider(process.env.UNSPLASH_ACCESS_KEY));
    if (process.env.FREEPIK_API_KEY)
      this.providers.push(new FreepikProvider(process.env.FREEPIK_API_KEY));
    if (process.env.SHUTTERSTOCK_API_KEY)
      this.providers.push(new ShutterstockProvider(
        process.env.SHUTTERSTOCK_API_KEY,
        process.env.SHUTTERSTOCK_API_SECRET || ''
      ));
    if (process.env.STORYBLOCKS_PUBLIC_KEY && process.env.STORYBLOCKS_PRIVATE_KEY)
      this.providers.push(new StoryblocksProvider(
        process.env.STORYBLOCKS_PUBLIC_KEY,
        process.env.STORYBLOCKS_PRIVATE_KEY
      ));

    this.enabled = this.providers.length > 0;

    if (this.enabled) {
      console.log(`[StockMedia] ${this.providers.length} provider(s): ${this.providers.map(p => p.name).join(', ')}`);
    } else {
      console.log('[StockMedia] No providers configured — NanoBanana handles all image generation');
    }
  }

  // Called when a candidate is selected for use — hook for provider-specific post-selection
  // actions (e.g. Unsplash download tracking). Currently a no-op since Unsplash is excluded.
  _onSelected(candidate) {}

  // ── Score a candidate against the search keywords ────────────────────────
  _score(candidate, searchKeywords) {
    const resScore = Math.min(candidate.width || 0, 1080) / 1080;
    const kws = searchKeywords.map(k => k.toLowerCase().trim());
    const tags = (candidate.tags || []).map(t => t.toLowerCase().trim());
    let matches = 0;
    for (const kw of kws) {
      if (tags.some(tag => tag.includes(kw) || kw.includes(tag))) matches++;
    }
    const tagOverlap = kws.length > 0 ? matches / kws.length : 0;
    const popScore = Math.min(Math.log10((candidate.downloads || 0) + 1) / 5, 1);
    return {
      ...candidate,
      _score: (resScore * 0.4) + (tagOverlap * 0.4) + (popScore * 0.2),
      _tagOverlap: tagOverlap,
    };
  }

  // ── Claude Vision validation (1,500ms hard timeout) ──────────────────────
  async _validateWithVision(candidate, mustMatchScene, threshold) {
    if (!this.anthropic || !mustMatchScene) return false;
    const imgUrl = candidate.thumbUrl || candidate.url;
    if (!imgUrl) return false;
    try {
      const [result] = await Promise.race([
        Promise.all([this.anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 32,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'url', url: imgUrl } },
              { type: 'text', text: `Score 0-100: how well does this image match "${mustMatchScene}"? Reply only valid JSON: {"score":N}` },
            ],
          }],
        })]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Vision timeout')), 1500)),
      ]);
      const raw = result?.content?.[0]?.text || '{"score":0}';
      const { score } = JSON.parse(raw.replace(/```json|```/g, '').trim());
      console.log(`[StockMedia] Vision ${score}/100 from ${candidate.source} (need ${threshold})`);
      return typeof score === 'number' && score >= threshold;
    } catch (err) {
      console.warn('[StockMedia] Vision validation skipped:', err.message);
      return false;
    }
  }

  /**
   * Find and validate a stock image for the given mediaSpec.
   *
   * @param {Object} mediaSpec - { searchKeywords: string[], mustMatchScene: string }
   * @param {Object} options   - { maxCandidates, threshold, mediaType }
   * @returns {Object|null}    - winning candidate or null (use NanoBanana)
   */
  async findAndValidate(mediaSpec, options = {}) {
    const { searchKeywords = [], mustMatchScene = '' } = mediaSpec || {};
    const { maxCandidates = 2, threshold = 70, mediaType = 'image' } = options;

    if (!searchKeywords.length || !this.enabled) return null;

    // Exclude providers that require attribution — branded photo cards leave no room for it
    const eligible = (mediaType === 'video'
      ? this.providers.filter(p => p.supportsVideo())
      : this.providers
    ).filter(p => !p.requiresAttribution);
    if (!eligible.length) return null;

    // Cache hit
    const cached = this.cache.get(searchKeywords);
    if (cached && cached.length > 0) {
      console.log(`[StockMedia] Cache hit: ${searchKeywords.join(', ')}`);
      const top = this._score(cached[0], searchKeywords);
      if (top._tagOverlap > 0.8) return top;
      const ok = await this._validateWithVision(top, mustMatchScene, threshold);
      return ok ? top : null;
    }

    // Parallel search across providers (1s per provider)
    const providerResults = await Promise.allSettled(
      eligible.map(provider =>
        Promise.race([
          provider.search(searchKeywords, mediaType, 5),
          new Promise(r => setTimeout(() => r([]), 1000)),
        ]).catch(() => [])
      )
    );

    const all = providerResults.flatMap(r =>
      r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : []
    );

    if (!all.length) {
      console.log(`[StockMedia] No candidates: ${searchKeywords.join(', ')}`);
      return null;
    }

    const scored = all
      .map(c => this._score(c, searchKeywords))
      .sort((a, b) => b._score - a._score);

    // Cache raw results (top 5)
    this.cache.set(searchKeywords, scored.slice(0, 5));

    // Validate top N candidates in order
    for (const candidate of scored.slice(0, maxCandidates)) {
      if (candidate._tagOverlap < 0.5) {
        console.log(`[StockMedia] Rejected low overlap (${(candidate._tagOverlap * 100).toFixed(0)}%): ${candidate.source}`);
        continue;
      }
      if (candidate._tagOverlap > 0.8) {
        console.log(`[StockMedia] Accepted high overlap (${(candidate._tagOverlap * 100).toFixed(0)}%): ${candidate.source}`);
        this._onSelected(candidate);
        return candidate;
      }
      // Moderate overlap — Claude Vision decides
      const ok = await this._validateWithVision(candidate, mustMatchScene, threshold);
      if (ok) { this._onSelected(candidate); return candidate; }
    }

    return null;
  }
}

module.exports = new StockMediaService();
