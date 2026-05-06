/**
 * AutoPostScheduler - Publishes scheduled posts to connected social accounts
 * Runs every 5 minutes via cron
 */

const cron = require('node-cron');
const axios = require('axios');

class AutoPostScheduler {
  constructor(pool) {
    this.pool = pool;
    this.running = false;
  }

  start() {
    console.log('⏰ AutoPostScheduler started (runs every 5 min)');
    cron.schedule('*/5 * * * *', () => this.runCycle());
  }

  async runCycle() {
    if (this.running) return;
    this.running = true;
    try {
      const posts = await this.getDuePosts();
      if (posts.length > 0) console.log(`📬 Processing ${posts.length} scheduled post(s)`);
      for (const post of posts) {
        await this.publishPost(post);
      }
    } catch (error) {
      console.error('Scheduler error:', error.message);
    } finally {
      this.running = false;
    }
  }

  async getDuePosts() {
    const result = await this.pool.query(
      `SELECT p.*, c.id AS customer_id
       FROM posts p
       JOIN customers c ON p.customer_id = c.id
       WHERE p.status = 'scheduled'
         AND p.scheduled_date <= NOW()
         AND c.auto_post_enabled = true
       LIMIT 20`
    );
    return result.rows;
  }

  async publishPost(post) {
    await this.pool.query(`UPDATE posts SET status='posting', updated_at=NOW() WHERE id=$1`, [post.id]);
    try {
      const accounts = await this.pool.query(
        `SELECT * FROM social_accounts
         WHERE customer_id=$1 AND enabled=true AND auto_post=true`,
        [post.customer_id]
      );

      if (accounts.rows.length === 0) {
        await this.pool.query(`UPDATE posts SET status='failed', error_message='No connected accounts', updated_at=NOW() WHERE id=$1`, [post.id]);
        return;
      }

      const platformPostIds = {};
      const errors = [];

      for (const account of accounts.rows) {
        try {
          const postId = await this.postToplatform(account, post);
          if (postId) platformPostIds[account.platform] = postId;
        } catch (err) {
          errors.push(`${account.platform}: ${err.message}`);
          console.error(`Failed to post to ${account.platform}:`, err.message);
        }
      }

      if (errors.length === accounts.rows.length) {
        await this.pool.query(
          `UPDATE posts SET status='failed', error_message=$1, updated_at=NOW() WHERE id=$2`,
          [errors.join('; '), post.id]
        );
      } else {
        await this.pool.query(
          `UPDATE posts SET status='posted', posted_at=NOW(), platform_post_ids=$1, updated_at=NOW() WHERE id=$2`,
          [JSON.stringify(platformPostIds), post.id]
        );
        console.log(`✅ Posted #${post.id} to ${Object.keys(platformPostIds).join(', ')}`);
      }
    } catch (error) {
      await this.pool.query(
        `UPDATE posts SET status='failed', error_message=$1, retry_count=retry_count+1, updated_at=NOW() WHERE id=$2`,
        [error.message, post.id]
      );
    }
  }

  async postToplatform(account, post) {
    switch (account.platform) {
      case 'facebook': return await this.postToFacebook(account, post);
      case 'instagram': return await this.postToInstagram(account, post);
      case 'google_business': return await this.postToGoogleBusiness(account, post);
      default: throw new Error(`Unsupported platform: ${account.platform}`);
    }
  }

  async postToFacebook(account, post) {
    const pageId = account.account_id;
    const token = account.access_token;

    if (post.media_url) {
      const res = await axios.post(
        `https://graph.facebook.com/v18.0/${pageId}/photos`,
        { url: post.media_url, caption: this.buildCaption(post), access_token: token }
      );
      return res.data.id;
    } else {
      const res = await axios.post(
        `https://graph.facebook.com/v18.0/${pageId}/feed`,
        { message: this.buildCaption(post), access_token: token }
      );
      return res.data.id;
    }
  }

  async postToInstagram(account, post) {
    const igUserId = account.account_id;
    const token = account.access_token;
    const caption = this.buildCaption(post);

    if (!post.media_url) throw new Error('Instagram requires an image');

    const containerRes = await axios.post(
      `https://graph.facebook.com/v18.0/${igUserId}/media`,
      { image_url: post.media_url, caption, access_token: token }
    );

    const creationId = containerRes.data.id;
    await new Promise((r) => setTimeout(r, 3000));

    const publishRes = await axios.post(
      `https://graph.facebook.com/v18.0/${igUserId}/media_publish`,
      { creation_id: creationId, access_token: token }
    );
    return publishRes.data.id;
  }

  async postToGoogleBusiness(account, post) {
    const token = account.access_token;

    const locationsRes = await axios.get(
      'https://mybusinessbusinessinformation.googleapis.com/v1/accounts',
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const accounts = locationsRes.data.accounts;
    if (!accounts || accounts.length === 0) throw new Error('No Google Business accounts found');

    const accountName = accounts[0].name;
    const locRes = await axios.get(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const locations = locRes.data.locations;
    if (!locations || locations.length === 0) throw new Error('No Google Business locations found');

    const locationName = locations[0].name;

    const localPost = {
      languageCode: 'en-US',
      summary: this.buildCaption(post),
      callToAction: { actionType: 'LEARN_MORE' },
    };

    if (post.media_url) {
      localPost.media = [{ mediaFormat: 'PHOTO', sourceUrl: post.media_url }];
    }

    const res = await axios.post(
      `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`,
      localPost,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    return res.data.name;
  }

  buildCaption(post) {
    let text = post.caption || '';
    if (post.hashtags) {
      const tags = Array.isArray(post.hashtags) ? post.hashtags : JSON.parse(post.hashtags);
      if (tags.length > 0) text += '\n\n' + tags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ');
    }
    return text;
  }
}

module.exports = AutoPostScheduler;
