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
        errors.push({ platform: account.platform, message: err.message });
        console.error(`[SocialPublisher] ${account.platform} failed:`, err.message);
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
        errors.push({ platform: account.platform, message: err.message });
        console.error(`[SocialPublisher] ${account.platform} failed:`, err.message);
      }
    }

    return { platformPostIds, errors };
  }

  // ─── Router ───────────────────────────────────────────────────────────────

  async postToPlatform(account, post) {
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

    const caption = this.buildCaption(post);

    if (post.media_url) {
      const res = await axios.post(
        `https://graph.facebook.com/v18.0/${pageId}/photos`,
        { url: post.media_url, caption, access_token: token },
        { timeout: 30000 }
      );
      return res.data.id;
    }

    const res = await axios.post(
      `https://graph.facebook.com/v18.0/${pageId}/feed`,
      { message: caption, access_token: token },
      { timeout: 30000 }
    );
    return res.data.id;
  }

  async postToInstagram(account, post) {
    const igUserId = account.account_id;
    const token    = account.access_token;
    if (!igUserId) throw new Error('Instagram Business Account ID not stored — reconnect the account');
    if (!post.media_url) throw new Error('Instagram requires an image or video URL');

    const caption = this.buildCaption(post);

    // Step 1 — create media container
    const containerRes = await axios.post(
      `https://graph.facebook.com/v18.0/${igUserId}/media`,
      { image_url: post.media_url, caption, access_token: token },
      { timeout: 30000 }
    );
    const creationId = containerRes.data.id;

    // Step 2 — wait for container to be ready (Instagram needs processing time)
    await this._waitForIgContainer(igUserId, creationId, token);

    // Step 3 — publish
    const publishRes = await axios.post(
      `https://graph.facebook.com/v18.0/${igUserId}/media_publish`,
      { creation_id: creationId, access_token: token },
      { timeout: 30000 }
    );
    return publishRes.data.id;
  }

  async _waitForIgContainer(igUserId, creationId, token, maxWaitMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const statusRes = await axios.get(
        `https://graph.facebook.com/v18.0/${creationId}`,
        { params: { fields: 'status_code', access_token: token } }
      );
      if (statusRes.data.status_code === 'FINISHED') return;
      if (statusRes.data.status_code === 'ERROR') throw new Error('Instagram media container failed');
      await new Promise(r => setTimeout(r, 3000));
    }
    // Proceed anyway after timeout — Instagram sometimes still works
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
      summary: this.buildCaption(post),
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

    const caption = this.buildCaption(post);

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

    const caption = this.buildCaption(post).substring(0, 2200); // TikTok caption limit

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

  // ─── Helpers ──────────────────────────────────────────────────────────────

  buildCaption(post) {
    let text = post.caption || '';
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
