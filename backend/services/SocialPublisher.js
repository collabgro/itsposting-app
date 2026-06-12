'use strict';

/**
 * SocialPublisher — unified posting engine for all platforms.
 * Used by AutoPostScheduler (cron) and the /api/social/publish endpoint (immediate).
 */

const axios = require('axios');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;

// Background options for Facebook text-only posts — mirrors frontend FB_BG_OPTIONS.
// Facebook native text_format_preset_id values (same approach as GHL / Publer).
// Primary: use the preset ID for native Facebook backgrounds (≤130 chars).
// Fallback: generate a styled image for longer captions.
const FB_BG_MAP = {
  sunrise:  { presetId: '901751159967576',  stops: ['#FF6B35', '#FF4785'], textColor: '#ffffff' },
  golden:   { presetId: '901751159967576',  stops: ['#F7C948', '#FF8C00'], textColor: '#1c1e21' },
  coral:    { presetId: '204187940028597',  stops: ['#FF6B6B', '#FE8C4B'], textColor: '#ffffff' },
  rose:     { presetId: '1903718606535395', stops: ['#F43F5E', '#EC4899'], textColor: '#ffffff' },
  violet:   { presetId: '1777259169190672', stops: ['#8B5CF6', '#EC4899'], textColor: '#ffffff' },
  ocean:    { presetId: '217761075370932',  stops: ['#4FACFE', '#00F2FE'], textColor: '#ffffff' },
  sky:      { presetId: '1365883126823705', stops: ['#6EE7F7', '#3B82F6'], textColor: '#ffffff' },
  lavender: { presetId: '106018623298955',  stops: ['#C084FC', '#7C3AED'], textColor: '#ffffff' },
  midnight: { presetId: '122708641613922',  stops: ['#1A1A2E', '#0F3460'], textColor: '#ffffff' },
  forest:   { presetId: '688479024672716',  stops: ['#134E5E', '#71B280'], textColor: '#ffffff' },
  mint:     { presetId: '301029513638534',  stops: ['#23D5AB', '#23A6D5'], textColor: '#ffffff' },
  peach:    { presetId: '175493843120364',  stops: ['#FFDAB9', '#FF9A8B'], textColor: '#1c1e21' },
  aurora:   { presetId: '688479024672716',  stops: ['#43E97B', '#38F9D7'], textColor: '#ffffff' },
  yellow:   { presetId: '175493843120364',  solid: '#F5E642',              textColor: '#1c1e21' },
  orange:   { presetId: '901751159967576',  solid: '#F08C00',              textColor: '#ffffff' },
  red:      { presetId: '621731364695726',  solid: '#E24444',              textColor: '#ffffff' },
  crimson:  { presetId: '1289741387813798', solid: '#9F1239',              textColor: '#ffffff' },
  purple:   { presetId: '433967226963128',  solid: '#7B5AF6',              textColor: '#ffffff' },
  blue:     { presetId: '1365883126823705', solid: '#4E7BF6',              textColor: '#ffffff' },
  navy:     { presetId: '1289741387813798', solid: '#1E3A5F',              textColor: '#ffffff' },
  green:    { presetId: '688479024672716',  solid: '#5FBF5E',              textColor: '#ffffff' },
  teal:     { presetId: '154977255088164',  solid: '#4EB7C4',              textColor: '#ffffff' },
  pink:     { presetId: '219266485227663',  solid: '#EC4899',              textColor: '#ffffff' },
  dark:     { presetId: '1881421442117417', solid: '#2E2E2E',              textColor: '#ffffff' },
  white:    { presetId: null,               solid: '#FFFFFF',              textColor: '#1c1e21' },
};

class SocialPublisher {
  constructor(pool) {
    this.pool = pool;
  }

  // ─── Entry point ──────────────────────────────────────────────────────────

  /**
   * Publish a post (by DB row) to all connected+enabled accounts for that customer.
   * Returns { platformPostIds, errors }
   */
  async publishPost(post) {
    const accounts = await this.pool.query(
      `SELECT * FROM social_accounts
       WHERE customer_id = $1 AND enabled = true AND auto_post = true`,
      [post.customer_id]
    );

    const platformPostIds = {};
    const errors = [];

    const results = await Promise.allSettled(
      accounts.rows.map(account =>
        this.postToPlatform(account, post)
          .then(id => ({ account, id }))
          .catch(err => { throw { account, err }; })
      )
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        const { account, id } = r.value;
        if (id) platformPostIds[account.platform] = id;
      } else {
        const { account, err } = r.reason;
        const apiDetail = err?.response?.data ? JSON.stringify(err.response.data) : null;
        console.error(`[SocialPublisher] ${account?.platform} failed:`, err?.message, apiDetail || '');
        errors.push({ platform: account?.platform, message: err?.message });
      }
    }

    return { platformPostIds, errors };
  }

  /**
   * Publish to specific social_accounts rows by their integer IDs.
   * Used when the frontend sends accountIds (multi-account selection).
   */
  async publishToAccounts(post, accountIds) {
    if (!accountIds?.length) return { platformPostIds: {}, errors: [] };
    const placeholders = accountIds.map((_, i) => `$${i + 2}`).join(',');
    const accounts = await this.pool.query(
      `SELECT * FROM social_accounts
       WHERE customer_id = $1 AND id IN (${placeholders}) AND enabled = true`,
      [post.customer_id, ...accountIds]
    );

    const platformPostIds = {};
    const accountLabels = {};
    const errors = [];

    const results = await Promise.allSettled(
      accounts.rows.map(account =>
        this.postToPlatform(account, post)
          .then(id => ({ account, id }))
          .catch(err => { throw { account, err }; })
      )
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        const { account, id } = r.value;
        if (id) {
          const key = `${account.platform}_${account.id}`;
          platformPostIds[key] = id;
          accountLabels[key] = account.account_name || account.account_username || account.platform;
        }
      } else {
        const { account, err } = r.reason;
        const apiDetail = err?.response?.data ? JSON.stringify(err.response.data) : null;
        console.error(`[SocialPublisher] ${account?.platform} (id=${account?.id}) failed:`, err?.message, apiDetail || '');
        errors.push({ platform: account?.platform, accountId: account?.id, message: err?.message });
      }
    }

    return { platformPostIds, accountLabels, errors };
  }

  /**
   * Publish to a specific set of platform accounts (used by /api/social/publish
   * which knows which platforms the user selected).
   */
  async publishToPlatforms(post, platformIds) {
    const placeholders = platformIds.map((_, i) => `$${i + 2}`).join(',');
    const accounts = await this.pool.query(
      `SELECT * FROM social_accounts
       WHERE customer_id = $1 AND platform IN (${placeholders}) AND enabled = true`,
      [post.customer_id, ...platformIds]
    );

    const platformPostIds = {};
    const errors = [];

    const results = await Promise.allSettled(
      accounts.rows.map(account =>
        this.postToPlatform(account, post)
          .then(id => ({ account, id }))
          .catch(err => { throw { account, err }; })
      )
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        const { account, id } = r.value;
        if (id) platformPostIds[account.platform] = id;
      } else {
        const { account, err } = r.reason;
        const apiDetail = err?.response?.data ? JSON.stringify(err.response.data) : null;
        console.error(`[SocialPublisher] ${account?.platform} failed:`, err?.message, apiDetail || '');
        errors.push({ platform: account?.platform, message: err?.message });
      }
    }

    return { platformPostIds, errors };
  }

  // ─── Router ───────────────────────────────────────────────────────────────

  async postToPlatform(account, post) {
    account = await this._refreshTokenIfNeeded(account);
    switch (account.platform) {
      case 'facebook':        return this.postToFacebook(account, post);
      case 'instagram':       return this.postToInstagram(account, post);
      case 'google_business': return this.postToGoogleBusiness(account, post);
      case 'linkedin':        return this.postToLinkedIn(account, post);
      case 'tiktok':          return this.postToTikTok(account, post);
      default: throw new Error(`Unsupported platform: ${account.platform}`);
    }
  }

  // ─── Platform implementations ─────────────────────────────────────────────

  _isVideoUrl(url) {
    return /\.(mp4|mov|avi|wmv|flv|webm|mkv)(\?|$)/i.test(url || '');
  }

  // Posts an automated first comment right after publish (GHL "Follow up comment" parity).
  // Uses same Graph API endpoint for both FB and IG. Never throws — comment failure
  // must not invalidate the main post.
  async _postFollowUpComment(postId, token, comment) {
    if (!comment?.trim() || !postId) return;
    try {
      await axios.post(
        `https://graph.facebook.com/v18.0/${postId}/comments`,
        { message: comment.trim(), access_token: token },
        { timeout: 15000 }
      );
      console.log(`[SocialPublisher] Follow-up comment posted on ${postId}`);
    } catch (err) {
      console.warn('[SocialPublisher] Follow-up comment failed:', err.response?.data?.error?.message || err.message);
    }
  }

  // Word-wrap plain text into lines fitting maxCharsPerLine.
  _wrapTextLines(text, maxCharsPerLine) {
    const words = text.split(/\s+/);
    const lines = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > maxCharsPerLine && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  // Generate a 1080×1080 styled-text image (gradient or solid bg + caption text).
  // SVG → Sharp → Cloudinary. Returns URL or null on failure.
  async _generateFbTextBgImage(caption, bgOptionId) {
    const opt = FB_BG_MAP[bgOptionId];
    if (!opt || !process.env.CLOUDINARY_CLOUD_NAME) return null;
    try {
      const W = 1080, H = 1080, PAD = 90;
      const textLen = caption.length;
      const fontSize = textLen < 60 ? 80 : textLen < 120 ? 62 : textLen < 220 ? 48 : 38;
      const maxChars = Math.floor((W - 2 * PAD) / (fontSize * 0.55));
      const lines = this._wrapTextLines(caption, maxChars);
      const lineHeight = Math.round(fontSize * 1.4);
      const startY = Math.round((H - lines.length * lineHeight) / 2) + Math.round(fontSize * 0.85);
      const escXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

      let bgDef = '', fillAttr = '';
      if (opt.stops) {
        bgDef = `<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${opt.stops[0]}"/><stop offset="100%" stop-color="${opt.stops[1]}"/></linearGradient></defs>`;
        fillAttr = 'url(#g)';
      } else {
        fillAttr = opt.solid;
      }

      const textEls = lines.map((line, i) =>
        `<text x="${W / 2}" y="${startY + i * lineHeight}" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize}" font-weight="bold" fill="${opt.textColor}" text-anchor="middle">${escXml(line)}</text>`
      ).join('');

      const svg = `<?xml version="1.0" encoding="UTF-8"?><svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${bgDef}<rect width="${W}" height="${H}" fill="${fillAttr}"/>${textEls}</svg>`;
      const buffer = await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();

      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });

      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: 'image', folder: 'itsposting/fb_text_bg' },
          (err, result) => err ? reject(err) : resolve(result.secure_url)
        );
        stream.end(buffer);
      });
    } catch (err) {
      console.warn('[SocialPublisher] FB text bg image generation failed:', err.message);
      return null;
    }
  }

  async postToFacebook(account, post) {
    const pageId = account.account_id;
    const token  = account.access_token;
    if (!pageId) throw new Error('Facebook Page ID not stored — reconnect the account');

    const caption  = this.buildCaption(post, 'facebook');
    const format   = post.fb_post_format || 'feed';
    const isVideo  = this._isVideoUrl(post.media_url);

    const _fbErr = (err) => {
      const fbMsg    = err.response?.data?.error?.message;
      const fbCode   = err.response?.data?.error?.code;
      const fbSub    = err.response?.data?.error?.error_subcode;
      if (fbMsg) throw new Error(`Facebook API: ${fbMsg}${fbCode ? ` (code ${fbCode}${fbSub ? '/' + fbSub : ''})` : ''}`);
      throw err;
    };

    try {
      // ── Facebook Multi-Photo (carousel) ────────────────────────────────────
      if (post.slides?.length >= 2 && format !== 'reel' && format !== 'story') {
        return this._postFacebookMultiPhoto(pageId, token, caption, post.slides, post.location_id);
      }

      // ── Facebook Reel ──────────────────────────────────────────────────────
      if (format === 'reel') {
        if (!post.media_url || !isVideo) {
          // Reel requires a video — fall back to photo/feed post
          console.warn('[SocialPublisher] FB Reel requested but no video URL — falling back to feed post');
        } else {
          const reelRes = await axios.post(
            `https://graph.facebook.com/v18.0/${pageId}/videos`,
            { file_url: post.media_url, description: caption, published: true, video_type: 'REEL', access_token: token },
            { timeout: 90000 }
          );
          const reelId = reelRes.data.id;
          await this._postFollowUpComment(reelId, token, post.follow_up_comment);
          return reelId;
        }
      }

      // ── Facebook Story ─────────────────────────────────────────────────────
      // Stories don't support comments — skip follow-up comment
      if (format === 'story') {
        if (!post.media_url) {
          console.warn('[SocialPublisher] FB Story requested but no media URL — falling back to feed post');
        } else if (isVideo) {
          // Video story: upload non-published video then publish as story
          const videoUpRes = await axios.post(
            `https://graph.facebook.com/v18.0/${pageId}/videos`,
            { file_url: post.media_url, published: false, access_token: token },
            { timeout: 90000 }
          );
          const videoId = videoUpRes.data.id;
          const storyRes = await axios.post(
            `https://graph.facebook.com/v18.0/${pageId}/video_stories`,
            { video_id: videoId, access_token: token },
            { timeout: 30000 }
          );
          return storyRes.data.id || videoId;
        } else {
          // Photo story: upload non-published photo then publish as story
          const photoUpRes = await axios.post(
            `https://graph.facebook.com/v18.0/${pageId}/photos`,
            { url: post.media_url, published: false, access_token: token },
            { timeout: 30000 }
          );
          const photoId = photoUpRes.data.id;
          const storyRes = await axios.post(
            `https://graph.facebook.com/v18.0/${pageId}/photo_stories`,
            { photo_id: photoId, access_token: token },
            { timeout: 30000 }
          );
          return storyRes.data.id || photoId;
        }
      }

      // ── Facebook Feed (default) ────────────────────────────────────────────
      // Prefer platform-specific card (1200×630 landscape) over the default portrait card
      const effectiveMediaUrl = post.platform_media_urls?.facebook || post.media_url || null;

      if (effectiveMediaUrl && this._isVideoUrl(effectiveMediaUrl)) {
        const videoBody = { file_url: effectiveMediaUrl, description: caption, published: true, access_token: token };
        if (post.location_id) videoBody.place = post.location_id;
        const res = await axios.post(`https://graph.facebook.com/v18.0/${pageId}/videos`, videoBody, { timeout: 90000 });
        const videoPostId = res.data.id;
        await this._postFollowUpComment(videoPostId, token, post.follow_up_comment);
        return videoPostId;
      }

      if (effectiveMediaUrl) {
        const photoBody = { url: effectiveMediaUrl, caption, access_token: token };
        if (post.location_id) photoBody.place = post.location_id;
        const res = await axios.post(`https://graph.facebook.com/v18.0/${pageId}/photos`, photoBody, { timeout: 30000 });
        const photoPostId = res.data.id;
        await this._postFollowUpComment(photoPostId, token, post.follow_up_comment);
        return photoPostId;
      }

      // ── Facebook native background text (GHL approach) ────────────────────
      // Uses text_format_preset_id — same native API that GHL / Publer use.
      // Facebook limit: 130 chars. Longer captions fall back to plain text.
      // Bad/expired preset IDs are caught and fall through to plain text post.
      if (post.fb_text_background) {
        const bgOpt = FB_BG_MAP[post.fb_text_background];
        if (bgOpt?.presetId && caption.length <= 130) {
          try {
            const bgBody = { message: caption, text_format_preset_id: bgOpt.presetId, access_token: token };
            if (post.location_id) bgBody.place = post.location_id;
            const bgRes = await axios.post(`https://graph.facebook.com/v18.0/${pageId}/feed`, bgBody, { timeout: 30000 });
            const bgPostId = bgRes.data.id;
            await this._postFollowUpComment(bgPostId, token, post.follow_up_comment);
            return bgPostId;
          } catch (bgErr) {
            const detail = bgErr.response?.data?.error;
            console.warn('[SocialPublisher] FB native background failed (preset=%s): %s — falling back to plain text',
              bgOpt.presetId, detail?.message || bgErr.message);
            // fall through to plain text post below
          }
        }
      }

      const feedBody = { message: caption, access_token: token };
      if (post.location_id) feedBody.place = post.location_id;
      const res = await axios.post(`https://graph.facebook.com/v18.0/${pageId}/feed`, feedBody, { timeout: 30000 });
      const feedPostId = res.data.id;
      await this._postFollowUpComment(feedPostId, token, post.follow_up_comment);
      return feedPostId;
    } catch (err) {
      _fbErr(err);
    }
  }

  async postToInstagram(account, post) {
    const igUserId = account.account_id;
    const token    = account.access_token;
    if (!igUserId) throw new Error('Instagram Business Account ID not stored — reconnect the account');
    if (!post.media_url && !post.platform_media_urls?.instagram && !post.slides?.length) throw new Error('Instagram requires an image or video URL');

    const caption  = this.buildCaption(post, 'instagram');
    const format   = post.ig_post_format || 'feed';

    // ── Instagram Carousel (2–10 images, Feed only) ───────────────────────────
    if (post.slides?.length >= 2 && format === 'feed') {
      return this._postInstagramCarousel(igUserId, token, caption, post.slides);
    }

    const igMediaUrl = post.platform_media_urls?.instagram || post.media_url;
    const isVideo  = this._isVideoUrl(igMediaUrl);

    const _igErr = (err) => {
      if (err.message?.startsWith('Instagram')) throw err;
      const fbMsg  = err.response?.data?.error?.message;
      const fbCode = err.response?.data?.error?.code;
      if (fbMsg) throw new Error(`Instagram API: ${fbMsg}${fbCode ? ` (code ${fbCode})` : ''}`);
      throw err;
    };

    try {
      let containerBody;

      if (format === 'reel') {
        if (!isVideo) {
          console.warn('[SocialPublisher] IG Reel requested but no video URL — falling back to feed image post');
          containerBody = { image_url: igMediaUrl, caption, access_token: token };
        } else {
          containerBody = {
            video_url: igMediaUrl,
            media_type: 'REELS',
            caption,
            share_to_feed: true,
            access_token: token,
          };
        }
      } else if (format === 'story') {
        // Stories don't support captions
        if (isVideo) {
          containerBody = { video_url: igMediaUrl, media_type: 'STORIES', access_token: token };
        } else {
          containerBody = { image_url: igMediaUrl, media_type: 'STORIES', access_token: token };
        }
      } else {
        // Feed (default)
        if (isVideo) {
          containerBody = { video_url: igMediaUrl, media_type: 'VIDEO', caption, access_token: token };
        } else {
          containerBody = { image_url: igMediaUrl, caption, access_token: token };
        }
      }

      // Location (Feed only — not supported for Stories/Reels)
      if (post.location_id && format === 'feed') containerBody.location_id = post.location_id;

      // Collaborators — Instagram supports Feed and Reels (not Stories, not Carousels)
      if (post.ig_collaborator && (format === 'feed' || format === 'reel')) {
        const handle = post.ig_collaborator.replace(/^@/, '').trim();
        if (handle) containerBody.collaborators = [handle];
      }

      // Step 1 — create media container
      const containerRes = await axios.post(
        `https://graph.facebook.com/v18.0/${igUserId}/media`,
        containerBody,
        { timeout: 30000 }
      );
      const creationId = containerRes.data.id;

      // Step 2 — wait for container to be ready (longer for video/reels)
      const maxWait = (format === 'reel' || isVideo) ? 90000 : 45000;
      await this._waitForIgContainer(igUserId, creationId, token, maxWait);

      // Step 3 — publish
      const publishRes = await axios.post(
        `https://graph.facebook.com/v18.0/${igUserId}/media_publish`,
        { creation_id: creationId, access_token: token },
        { timeout: 30000 }
      );
      const mediaId = publishRes.data.id;

      // Stories don't support comments
      if (format !== 'story') {
        await this._postFollowUpComment(mediaId, token, post.follow_up_comment);
      }

      return mediaId;
    } catch (err) {
      _igErr(err);
    }
  }

  // ── Instagram Carousel (2-10 images, Feed only) ──────────────────────────
  // Instagram Graph API: create item containers → wait for each → carousel container → publish.
  async _postInstagramCarousel(igUserId, token, caption, slideUrls) {
    const slides = slideUrls.slice(0, 10); // Instagram hard cap: 10 items

    // Step 1 — create an item container for every slide (is_carousel_item=true)
    // then wait for each to reach FINISHED status before building the carousel container.
    const itemIds = [];
    for (const url of slides) {
      const itemRes = await axios.post(
        `https://graph.facebook.com/v18.0/${igUserId}/media`,
        { image_url: url, is_carousel_item: true, access_token: token },
        { timeout: 30000 }
      );
      const itemId = itemRes.data.id;
      // Wait for item container to be FINISHED before moving on — required by Instagram API
      await this._waitForIgContainer(igUserId, itemId, token, 30000);
      itemIds.push(itemId);
    }

    // Step 2 — create the carousel container.
    // children must be an array of container IDs (not a comma-separated string).
    const carouselRes = await axios.post(
      `https://graph.facebook.com/v18.0/${igUserId}/media`,
      { media_type: 'CAROUSEL', caption, children: itemIds, access_token: token },
      { timeout: 30000 }
    );
    const carouselId = carouselRes.data.id;

    // Step 3 — wait for carousel container to be ready
    await this._waitForIgContainer(igUserId, carouselId, token, 60000);

    // Step 4 — publish
    const publishRes = await axios.post(
      `https://graph.facebook.com/v18.0/${igUserId}/media_publish`,
      { creation_id: carouselId, access_token: token },
      { timeout: 30000 }
    );
    const mediaId = publishRes.data.id;
    await this._postFollowUpComment(mediaId, token, null);
    return mediaId;
  }

  // ── Facebook Multi-Photo post ─────────────────────────────────────────────
  // Upload each photo as unpublished, then attach to a single feed post.
  async _postFacebookMultiPhoto(pageId, token, caption, slideUrls, locationId) {
    const slides = slideUrls.slice(0, 10); // reasonable cap

    // Upload each photo as unpublished to get a photo ID
    const photoIds = await Promise.all(
      slides.map(url =>
        axios.post(
          `https://graph.facebook.com/v18.0/${pageId}/photos`,
          { url, published: false, access_token: token },
          { timeout: 30000 }
        ).then(r => r.data.id)
      )
    );

    // Post to feed with attached_media
    const feedBody = {
      message: caption,
      attached_media: photoIds.map(id => ({ media_fbid: id })),
      access_token: token,
    };
    if (locationId) feedBody.place = locationId;

    const feedRes = await axios.post(
      `https://graph.facebook.com/v18.0/${pageId}/feed`,
      feedBody,
      { timeout: 30000 }
    );
    const postId = feedRes.data.id;
    await this._postFollowUpComment(postId, token, null);
    return postId;
  }

  async _waitForIgContainer(igUserId, creationId, token, maxWaitMs = 45000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const statusRes = await axios.get(
        `https://graph.facebook.com/v18.0/${creationId}`,
        { params: { fields: 'status_code', access_token: token }, timeout: 10000 }
      );
      if (statusRes.data.status_code === 'FINISHED') return;
      if (statusRes.data.status_code === 'ERROR') throw new Error('Instagram media container processing failed');
      await new Promise(r => setTimeout(r, 3000));
    }
    throw new Error('Instagram media container timed out — container not ready after 45s');
  }

  async postToGoogleBusiness(account, post) {
    const token = account.access_token;

    // Fetch the GBP account list
    const accRes = await axios.get(
      'https://mybusinessbusinessinformation.googleapis.com/v1/accounts',
      { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
    );
    const accounts = accRes.data.accounts;
    if (!accounts?.length) throw new Error('No Google Business accounts found');

    // Fetch the first location
    const locRes = await axios.get(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accounts[0].name}/locations`,
      { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
    );
    const locations = locRes.data.locations;
    if (!locations?.length) throw new Error('No Google Business locations found');

    const body = {
      languageCode: 'en-US',
      summary: this.buildCaption(post, 'google_business'),
      callToAction: { actionType: 'LEARN_MORE' },
    };
    if (post.media_url) {
      body.media = [{ mediaFormat: 'PHOTO', sourceUrl: post.media_url }];
    }

    const res = await axios.post(
      `https://mybusiness.googleapis.com/v4/${locations[0].name}/localPosts`,
      body,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    return res.data.name;
  }

  async postToLinkedIn(account, post) {
    const token     = account.access_token;
    const authorUrn = account.account_id; // e.g. "urn:li:person:abc123" or "urn:li:organization:123456"
    if (!authorUrn) throw new Error('LinkedIn author URN not stored — reconnect the account');

    const caption = this.buildCaption(post, 'linkedin');

    // ── LinkedIn Multi-Image Carousel (2–20 images) ──────────────────────────
    if (post.slides?.length >= 2) {
      return this._postLinkedInMultiImage(token, authorUrn, caption, post.slides);
    }

    // ── Single image or text-only post (new Posts API) ───────────────────────
    let imageUrn = null;
    if (post.media_url) {
      try {
        imageUrn = await this._uploadLinkedInImageNew(token, authorUrn, post.media_url);
      } catch (err) {
        console.warn('[SocialPublisher] LinkedIn image upload failed, posting text-only:', err.message);
      }
    }

    const body = {
      author: authorUrn,
      commentary: caption,
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    };
    if (imageUrn) {
      body.content = { media: { altText: '', id: imageUrn } };
    }

    const res = await axios.post(
      'https://api.linkedin.com/rest/posts',
      body,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202502',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        timeout: 30000,
      }
    );
    return res.headers['x-linkedin-id'] || res.headers['x-restli-id'] || res.data.id;
  }

  // ── LinkedIn Multi-Image Carousel (new Posts API, multiImage content type) ─
  async _postLinkedInMultiImage(token, authorUrn, caption, slideUrls) {
    const slides = slideUrls.slice(0, 20); // LinkedIn hard cap: 20 images

    // Upload each image sequentially and collect URNs
    const imageUrns = [];
    for (const url of slides) {
      try {
        const urn = await this._uploadLinkedInImageNew(token, authorUrn, url);
        imageUrns.push(urn);
      } catch (err) {
        console.warn('[SocialPublisher] LinkedIn slide upload failed, skipping:', err.message);
      }
    }

    if (imageUrns.length < 2) throw new Error('LinkedIn multiImage requires at least 2 successfully uploaded images');

    const res = await axios.post(
      'https://api.linkedin.com/rest/posts',
      {
        author: authorUrn,
        commentary: caption,
        visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
        content: {
          multiImage: {
            images: imageUrns.map(id => ({ id, altText: '' })),
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202502',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        timeout: 30000,
      }
    );
    return res.headers['x-linkedin-id'] || res.headers['x-restli-id'] || res.data.id;
  }

  // ── LinkedIn Image Upload (new Images API) ───────────────────────────────
  async _uploadLinkedInImageNew(token, authorUrn, imageUrl) {
    // Step 1 — initialize upload, get upload URL + image URN
    const initRes = await axios.post(
      'https://api.linkedin.com/rest/images?action=initializeUpload',
      { initializeUploadRequest: { owner: authorUrn } },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202502',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        timeout: 15000,
      }
    );
    const uploadUrl = initRes.data.value.uploadUrl;
    const imageUrn  = initRes.data.value.image; // e.g. "urn:li:image:C4D22AQxxx"

    // Step 2 — download image buffer from Cloudinary
    const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 20000 });

    // Step 3 — PUT binary to LinkedIn's upload URL
    await axios.put(uploadUrl, imgRes.data, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
      timeout: 30000,
    });

    return imageUrn;
  }

  async postToTikTok(account, post) {
    const token = account.access_token;
    if (!post.media_url) throw new Error('TikTok requires a photo or video URL');

    const caption = this.buildCaption(post, 'tiktok').substring(0, 150); // TikTok 150-char limit

    // TikTok Content Posting API — Direct Post (Photo)
    const initRes = await axios.post(
      'https://open.tiktokapis.com/v2/post/publish/content/init/',
      {
        post_info: {
          title: caption,
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          auto_add_music: true,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          photo_cover_index: 0,
          photo_images: [post.media_url],
        },
        post_mode: 'DIRECT_POST',
        media_type: 'PHOTO',
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        timeout: 30000,
      }
    );

    const publishId = initRes.data?.data?.publish_id;
    if (!publishId) throw new Error(initRes.data?.error?.message || 'TikTok post initiation failed');
    return publishId;
  }

  // ─── Token refresh ────────────────────────────────────────────────────────

  // Refresh Google or TikTok access token when it has expired or is within 5 minutes
  // of expiry. Updates social_accounts in the DB and returns a fresh account object.
  // Falls through silently on failure — the post attempt will then fail with a natural
  // API error, which is more informative than a generic refresh error.
  async _refreshTokenIfNeeded(account) {
    const { platform, refresh_token, token_expires_at } = account;
    if (platform !== 'google_business' && platform !== 'tiktok') return account;
    if (!refresh_token) return account;

    const BUFFER_MS = 5 * 60 * 1000; // 5 minutes
    const expiresAt = token_expires_at ? new Date(token_expires_at).getTime() : 0;
    if (expiresAt - Date.now() >= BUFFER_MS) return account; // still fresh

    let newAccessToken, newRefreshToken, newExpiresIn;
    try {
      if (platform === 'google_business') {
        const res = await axios.post(
          'https://oauth2.googleapis.com/token',
          new URLSearchParams({
            client_id:     process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token,
            grant_type:    'refresh_token',
          }),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
        );
        newAccessToken  = res.data.access_token;
        newRefreshToken = res.data.refresh_token || refresh_token; // Google rarely rotates the refresh token
        newExpiresIn    = res.data.expires_in || 3600;
      } else {
        const res = await axios.post(
          'https://open.tiktokapis.com/v2/oauth/token/',
          new URLSearchParams({
            client_key:    process.env.TIKTOK_CLIENT_KEY,
            client_secret: process.env.TIKTOK_CLIENT_SECRET,
            grant_type:    'refresh_token',
            refresh_token,
          }),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
        );
        const data      = res.data?.data || res.data;
        newAccessToken  = data.access_token;
        newRefreshToken = data.refresh_token || refresh_token;
        newExpiresIn    = data.expires_in || 86400;
      }
    } catch (err) {
      console.error(`[SocialPublisher] Token refresh failed for ${platform} (id=${account.id}):`, err.response?.data || err.message);
      return account;
    }

    if (!newAccessToken) return account;

    const newExpiresAt = new Date(Date.now() + newExpiresIn * 1000);
    await this.pool.query(
      `UPDATE social_accounts
       SET access_token     = $1,
           refresh_token    = $2,
           token_expires_at = $3,
           updated_at       = NOW()
       WHERE id = $4`,
      [newAccessToken, newRefreshToken, newExpiresAt, account.id]
    );

    console.log(`[SocialPublisher] Token refreshed for ${platform} (id=${account.id}), expires ${newExpiresAt.toISOString()}`);
    return { ...account, access_token: newAccessToken, refresh_token: newRefreshToken, token_expires_at: newExpiresAt };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  captionForPlatform(post, platform) {
    let platformCaptions = {};
    try {
      platformCaptions = typeof post.platform_captions === 'string'
        ? JSON.parse(post.platform_captions)
        : (post.platform_captions || {});
    } catch { platformCaptions = {}; }
    return platformCaptions[platform] || post.caption || '';
  }

  buildCaption(post, platform) {
    let text = platform ? this.captionForPlatform(post, platform) : (post.caption || '');
    let tags = [];
    try {
      tags = Array.isArray(post.hashtags) ? post.hashtags : JSON.parse(post.hashtags || '[]');
    } catch { tags = []; }
    if (tags.length > 0) {
      text += '\n\n' + tags.map(t => t.startsWith('#') ? t : `#${t}`).join(' ');
    }
    return text;
  }

  // ─── Token verification ───────────────────────────────────────────────────

  async verifyToken(platform, accessToken, accountId) {
    try {
      switch (platform) {
        case 'facebook': {
          const res = await axios.get('https://graph.facebook.com/v18.0/me', {
            params: { fields: 'id,name', access_token: accessToken },
            timeout: 10000,
          });
          return { valid: true, accountName: res.data.name, accountId: res.data.id };
        }
        case 'instagram': {
          const id = accountId || '';
          const res = await axios.get(`https://graph.facebook.com/v18.0/${id}`, {
            params: { fields: 'id,name,username', access_token: accessToken },
            timeout: 10000,
          });
          return { valid: true, accountName: res.data.name || res.data.username, accountId: res.data.id };
        }
        case 'google_business': {
          const res = await axios.get('https://mybusinessbusinessinformation.googleapis.com/v1/accounts', {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10000,
          });
          const acc = res.data.accounts?.[0];
          return { valid: true, accountName: acc?.accountName || 'Google Business Account', accountId: acc?.name };
        }
        case 'linkedin': {
          const res = await axios.get('https://api.linkedin.com/v2/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { projection: '(id,localizedFirstName,localizedLastName)' },
            timeout: 10000,
          });
          const name = `${res.data.localizedFirstName} ${res.data.localizedLastName}`;
          return { valid: true, accountName: name, accountId: `urn:li:person:${res.data.id}` };
        }
        case 'tiktok': {
          const res = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { fields: 'open_id,display_name,avatar_url' },
            timeout: 10000,
          });
          const user = res.data?.data?.user;
          return { valid: true, accountName: user?.display_name || 'TikTok Account', accountId: user?.open_id };
        }
        default:
          return { valid: false, error: 'Unknown platform' };
      }
    } catch (err) {
      const apiMsg = err.response?.data?.error?.message
        || err.response?.data?.error_description
        || err.message;
      return { valid: false, error: apiMsg };
    }
  }
}

module.exports = SocialPublisher;
