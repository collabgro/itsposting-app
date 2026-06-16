'use strict';

/**
 * AutoPostScheduler — publishes scheduled posts every 5 minutes.
 * All platform logic lives in SocialPublisher.js.
 */

const cron = require('node-cron');
const SocialPublisher = require('./SocialPublisher');
const NotificationService = require('./NotificationService');
const EmailQueue = require('./EmailQueue');

class AutoPostScheduler {
  constructor(pool) {
    this.pool       = pool;
    this.running    = false;
    this.publisher  = new SocialPublisher(pool);
    this.notifier   = new NotificationService(pool);
    this.emailQueue = new EmailQueue(pool);
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
      for (const post of posts) await this.processPost(post);
    } catch (err) {
      console.error('[AutoPostScheduler] Cycle error:', err.message);
    } finally {
      this.running = false;
    }
  }

  async getDuePosts() {
    // auto_post_enabled defaults to true if column doesn't exist (see server.js migration)
    const result = await this.pool.query(
      `SELECT p.*, c.id AS customer_id, c.email AS customer_email,
              c.business_name AS customer_business_name
       FROM posts p
       JOIN customers c ON p.customer_id = c.id
       WHERE p.status = 'scheduled'
         AND p.scheduled_date <= NOW()
         AND COALESCE(c.auto_post_enabled, true) = true
       ORDER BY p.scheduled_date ASC
       LIMIT 20`
    );
    return result.rows;
  }

  async processPost(post) {
    // Atomic claim: only transition if still 'scheduled'. Without the WHERE guard, a
    // concurrent manual "Post Now" click (or a second scheduler instance) racing this
    // same post would both proceed to publish, double-posting to every connected platform.
    const claim = await this.pool.query(
      `UPDATE posts SET status = 'posting', updated_at = NOW() WHERE id = $1 AND status = 'scheduled' RETURNING id`,
      [post.id]
    );
    if (claim.rowCount === 0) return; // already claimed elsewhere — skip

    try {
      // Load carousel slides so SocialPublisher can publish a true multi-image carousel
      if (post.content_type === 'carousel') {
        try {
          const slidesRes = await this.pool.query(
            `SELECT media_url FROM post_carousel_slides WHERE post_id = $1 ORDER BY slide_number`,
            [post.id]
          );
          const slideUrls = slidesRes.rows.map(r => r.media_url).filter(Boolean);
          if (slideUrls.length > 1) post.slides = slideUrls;
        } catch (slideErr) {
          console.warn(`[AutoPostScheduler] Could not load carousel slides for post ${post.id}:`, slideErr.message);
        }
      }

      let platformIds = [];
      try {
        if (post.platforms) {
          const parsed = typeof post.platforms === 'string'
            ? JSON.parse(post.platforms) : post.platforms;
          if (Array.isArray(parsed) && parsed.length > 0) platformIds = parsed;
        }
      } catch {}

      const { platformPostIds, errors } = platformIds.length
        ? await this.publisher.publishToPlatforms(post, platformIds)
        : await this.publisher.publishPost(post);
      const allFailed = errors.length > 0 && Object.keys(platformPostIds).length === 0;

      if (allFailed) {
        const errMsg = errors.map(e => `${e.platform}: ${e.message}`).join('; ');
        await this.pool.query(
          `UPDATE posts SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
          [errMsg, post.id]
        );
        for (const e of errors) {
          this.notifier.postFailed(post.customer_id, post.id, e.platform, e.message).catch(() => {});
        }
      } else {
        // Some platforms succeeded. Store partial error info so nothing is silently lost.
        const partialErrMsg = errors.length > 0
          ? errors.map(e => `${e.platform}: ${e.message}`).join('; ')
          : null;
        if (partialErrMsg) {
          console.warn(`[AutoPostScheduler] Post #${post.id} partial failure: ${partialErrMsg}`);
        }

        await this.pool.query(
          `UPDATE posts SET status = 'posted', posted_at = NOW(),
            platform_post_ids = $1, error_message = $2, updated_at = NOW() WHERE id = $3`,
          [JSON.stringify(platformPostIds), partialErrMsg, post.id]
        );
        console.log(`✅ Posted #${post.id} to ${Object.keys(platformPostIds).join(', ')}`);

        // Update posting streak for this customer
        try {
          const ContentMixTracker = require('./ContentMixTracker');
          await new ContentMixTracker(this.pool).updatePostingStreak(post.customer_id);
        } catch (streakErr) {
          console.warn(`[AutoPostScheduler] streak update failed for customer ${post.customer_id}:`, streakErr.message);
        }

        // Invalidate metrics cache
        this.pool.query(
          `DELETE FROM customer_metrics_cache WHERE customer_id = $1`,
          [post.customer_id]
        ).catch(() => {});

        // Sync real engagement metrics 5 minutes after publish
        setTimeout(() => {
          const MetricsSyncService = require('./MetricsSyncService');
          new MetricsSyncService(this.pool).syncPost(post.id, post.customer_id).catch(err =>
            console.warn(`[AutoPostScheduler] Metrics sync failed for post ${post.id}:`, err.message)
          );
        }, 5 * 60 * 1000);

        const customerObj = {
          email: post.customer_email,
          business_name: post.customer_business_name,
        };
        for (const key of Object.keys(platformPostIds)) {
          // Keys are suffixed with the social_accounts row id ("facebook_57") when a
          // customer has multiple connected accounts of the same platform — strip
          // that back to a friendly platform name for notifications/emails.
          const platform = key.replace(/_\d+$/, '');
          this.notifier.postPublished(post.customer_id, post.id, platform).catch(() => {});
          this.emailQueue.notifyPostPublished(customerObj, platform).catch(err =>
            console.error('[AutoPostScheduler] Email queue error:', err.message)
          );
        }
        // Notify about any platforms that failed even though overall post succeeded
        for (const e of errors) {
          this.notifier.postFailed(post.customer_id, post.id, e.platform, e.message).catch(() => {});
        }
      }
    } catch (err) {
      await this.pool.query(
        `UPDATE posts SET status = 'failed', error_message = $1,
          retry_count = retry_count + 1, updated_at = NOW() WHERE id = $2`,
        [err.message, post.id]
      );
      console.error(`[AutoPostScheduler] Failed to process post #${post.id}:`, err.message);
    }
  }
}

module.exports = AutoPostScheduler;
