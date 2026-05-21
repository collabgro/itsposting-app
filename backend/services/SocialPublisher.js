'use strict';

/**
 * SocialPublisher — unified posting engine for all platforms.
 * Used by AutoPostScheduler (cron) and the /api/social/publish endpoint (immediate).
 */

const axios = require('axios');

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

    for (const account of accounts.rows) {
      try {
        const platformId = await this.postToPlatform(account, post);
        if (platformId) platformPostIds[account.platform] = platformId;
      } catch (err) {
        const apiDetail = err.response?.data ? JSON.stringify(err.response.data) : null;
        console.error(`[SocialPublisher] ${account.platform} failed:`, err.message, apiDetail || '');
        errors.push({ platform: account.platform, message: err.message });
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
    const errors = [];

    for (const account of accounts.rows) {
      try {
        const platformId = await this.postToPlatform(account, post);
        if (platformId) platformPostIds[`${account.platform}_${account.id}`] = platformId;
      } catch (err) {
        const apiDetail = err.response?.data ? JSON.stringify(err.response.data) : null;
        console.error(`[SocialPublisher] ${account.platform} (id=${account.id}) failed:`, err.message, apiDetail || '');
        errors.push({ platform: account.platform, accountId: account.id, message: err.message });
      }
    }

    return { platformPostIds, errors };
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

    for (const account of accounts.rows) {
      try {
        const platformId = await this.postToPlatform(account, post);
        if (platformId) platformPostIds[account.platform] = platformId;
      } catch (err) {
        const apiDetail = err.response?.data ? JSON.stringify(err.response.data) : null;
        console.error(`[SocialPublisher] ${account.platform} failed:`, err.message, apiDetail || '');
        errors.push({ platform: account.platform, message: err.message });
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

  async postToFacebook(account, post) {
    const pageId = account.account_id;
    const token  = account.access_token;
    if (!pageId) throw new Error('Facebook Page ID not stored — reconnect the account');

    const caption = this.buildCaption(post, 'facebook');

    try {
      if (post.media_url) {
        const photoBody = { url: post.media_url, caption, access_token: token };
        if (post.location_id) photoBody.place = post.location_id;
        const res = await axios.post(
          `https://graph.facebook.com/v18.0/${pageId}/photos`,
          photoBody,
          { timeout: 30000 }
        );
        return res.data.id;
      }

      const feedBody = { message: caption, access_token: token };
      if (post.location_id) feedBody.place = post.location_id;
      const res = await axios.post(
        `https://graph.facebook.com/v18.0/${pageId}/feed`,
        feedBody,
        { timeout: 30000 }
      );
      return res.data.id;
    } catch (err) {
      const fbMsg = err.response?.data?.error?.message;
      const fbCode = err.response?.data?.error?.code;
      const fbSubcode = err.response?.data?.error?.error_subcode;
      if (fbMsg) {
        const detail = fbCode ? ` (code ${fbCode}${fbSubcode ? '/' + fbSubcode : ''})` : '';
        throw new Error(`Facebook API: ${fbMsg}${detail}`);
      }
      throw err;
    }
  }

  async postToInstagram(account, post) {
    const igUserId = account.account_id;
    const token    = account.access_token;
    if (!igUserId) throw new Error('Instagram Business Account ID not stored — reconnect the account');
    if (!post.media_url) throw new Error('Instagram requires an image or video URL');

    const caption = this.buildCaption(post, 'instagram');

    try {
      // Step 1 — create media container
      const containerBody = { image_url: post.media_url, caption, access_token: token };
      if (post.location_id) containerBody.location_id = post.location_id;
      const containerRes = await axios.post(
        `https://graph.facebook.com/v18.0/${igUserId}/media`,
        containerBody,
        { timeout: 30000 }
      );
      const creationId = containerRes.data.id;

      // Step 2 — wait for container to be ready
      await this._waitForIgContainer(igUserId, creationId, token);

      // Step 3 — publish
      const publishRes = await axios.post(
        `https://graph.facebook.com/v18.0/${igUserId}/media_publish`,
        { creation_id: creationId, access_token: token },
        { timeout: 30000 }
      );
      return publishRes.data.id;
    } catch (err) {
      if (err.message.startsWith('Instagram')) throw err; // our own errors
      const fbMsg = err.response?.data?.error?.message;
      const fbCode = err.response?.data?.error?.code;
      if (fbMsg) throw new Error(`Instagram API: ${fbMsg}${fbCode ? ` (code ${fbCode})` : ''}`);
      throw err;
    }
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

    let mediaAsset = null;
    if (post.media_url) {
      try {
        mediaAsset = await this._uploadLinkedInImage(token, authorUrn, post.media_url);
      } catch (err) {
        console.warn('[SocialPublisher] LinkedIn image upload failed, posting text-only:', err.message);
      }
    }

    const shareContent = {
      shareCommentary: { text: caption },
      shareMediaCategory: mediaAsset ? 'IMAGE' : 'NONE',
    };
    if (mediaAsset) {
      shareContent.media = [{ status: 'READY', description: { text: '' }, media: mediaAsset, title: { text: '' } }];
    }

    const res = await axios.post(
      'https://api.linkedin.com/v2/ugcPosts',
      {
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: { 'com.linkedin.ugc.ShareContent': shareContent },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      },
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
        timeout: 30000,
      }
    );
    return res.headers['x-linkedin-id'] || res.data.id;
  }

  async _uploadLinkedInImage(token, authorUrn, imageUrl) {
    // Step 1 — register upload
    const regRes = await axios.post(
      'https://api.linkedin.com/v2/assets?action=registerUpload',
      {
        registerUploadRequest: {
          owner: authorUrn,
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          serviceRelationships: [{ identifier: 'urn:li:userGeneratedContent', relationshipType: 'OWNER' }],
          supportedUploadMechanism: ['SYNCHRONOUS_UPLOAD'],
        },
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 15000 }
    );

    const uploadUrl  = regRes.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
    const assetUrn   = regRes.data.value.asset;

    // Step 2 — download image buffer
    const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 20000 });

    // Step 3 — PUT to LinkedIn upload URL
    await axios.put(uploadUrl, imgRes.data, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
      timeout: 30000,
    });

    return assetUrn;
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
