'use strict';

const axios = require('axios');

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const SYNC_COOLDOWN_HOURS = 4; // don't re-sync a post more often than this

class MetricsSyncService {
  constructor(pool) {
    this.pool = pool;
  }

  // Sync a single post by ID. Verifies customer ownership.
  async syncPost(postId, customerId) {
    const postRes = await this.pool.query(
      `SELECT id, platform_post_ids, customer_id, last_metrics_sync
       FROM posts WHERE id = $1 AND customer_id = $2 AND status = 'posted'`,
      [postId, customerId]
    );
    if (!postRes.rows.length) return { synced: false, reason: 'not_found' };

    const post = postRes.rows[0];
    const platformIds = post.platform_post_ids || {};
    if (!Object.keys(platformIds).length) return { synced: false, reason: 'no_platform_ids' };

    // Respect cooldown to avoid hammering the Graph API
    if (post.last_metrics_sync) {
      const ageHours = (Date.now() - new Date(post.last_metrics_sync).getTime()) / 3600000;
      if (ageHours < SYNC_COOLDOWN_HOURS) return { synced: false, reason: 'cooldown' };
    }

    return this._syncPostMetrics(post, platformIds, customerId);
  }

  // Sync all posted posts from the last 30 days that either have never been synced
  // or haven't been synced in more than SYNC_COOLDOWN_HOURS.
  async syncRecentPosts(customerId) {
    const postsRes = await this.pool.query(
      `SELECT id, platform_post_ids, last_metrics_sync
       FROM posts
       WHERE customer_id = $1
         AND status = 'posted'
         AND posted_at > NOW() - INTERVAL '30 days'
         AND platform_post_ids IS NOT NULL
         AND platform_post_ids::text != '{}'
         AND (
           last_metrics_sync IS NULL
           OR last_metrics_sync < NOW() - ($2 || ' hours')::INTERVAL
         )
       ORDER BY posted_at DESC
       LIMIT 20`,
      [customerId, SYNC_COOLDOWN_HOURS]
    );

    let synced = 0;
    let skipped = 0;
    const errors = [];

    for (const post of postsRes.rows) {
      try {
        const platformIds = post.platform_post_ids || {};
        if (!Object.keys(platformIds).length) { skipped++; continue; }
        const result = await this._syncPostMetrics(post, platformIds, customerId);
        if (result.synced) synced++; else skipped++;
      } catch (err) {
        errors.push({ postId: post.id, error: err.message });
        console.error(`[MetricsSyncService] Error syncing post ${post.id}:`, err.message);
      }
    }

    return { synced, skipped, errors };
  }

  // Core sync logic — fetches from all platforms and writes to DB.
  async _syncPostMetrics(post, platformIds, customerId) {
    const accounts = await this.pool.query(
      `SELECT platform, account_id, access_token FROM social_accounts
       WHERE customer_id = $1 AND platform IN ('facebook', 'instagram') AND enabled = true`,
      [customerId]
    );

    const accountMap = {};
    for (const row of accounts.rows) accountMap[row.platform] = row;

    let fbReach = 0, igReach = 0;
    let likes = 0, comments = 0, shares = 0, impressions = 0;
    const synced_platforms = [];

    if (platformIds.facebook && accountMap.facebook) {
      try {
        const fb = await this._fetchFacebookMetrics(platformIds.facebook, accountMap.facebook);
        fbReach = fb.reach || 0;
        likes += fb.likes || 0;
        comments += fb.comments || 0;
        shares += fb.shares || 0;
        impressions += fb.impressions || 0;
        synced_platforms.push('facebook');
      } catch (err) {
        console.warn(`[MetricsSyncService] FB metrics failed for post ${post.id}:`, err.message);
      }
    }

    if (platformIds.instagram && accountMap.instagram) {
      try {
        const ig = await this._fetchInstagramMetrics(platformIds.instagram, accountMap.instagram);
        igReach = ig.reach || 0;
        likes += ig.likes || 0;
        comments += ig.comments || 0;
        impressions += ig.impressions || 0;
        synced_platforms.push('instagram');
      } catch (err) {
        console.warn(`[MetricsSyncService] IG metrics failed for post ${post.id}:`, err.message);
      }
    }

    if (!synced_platforms.length) return { synced: false, reason: 'no_data' };

    // Reach: use max across platforms — the same person may follow both accounts
    const reach = Math.max(fbReach, igReach);
    const performance_score = Math.round((reach / 100) + (likes * 2) + (comments * 3) + (shares * 5));

    await this._updatePostEngagement(post.id, { reach, likes, comments, shares, impressions, performance_score });

    return { synced: true, platforms: synced_platforms, reach, likes, comments };
  }

  async _fetchFacebookMetrics(fbPostId, account) {
    const token = account.access_token;

    const [insightsRes, fieldsRes] = await Promise.allSettled([
      axios.get(`${GRAPH_BASE}/${fbPostId}/insights`, {
        params: {
          metric: 'post_impressions_unique,post_impressions,post_reactions_like_total',
          access_token: token,
        },
        timeout: 15000,
      }),
      // comments.summary(true) and shares are available on the post object itself
      axios.get(`${GRAPH_BASE}/${fbPostId}`, {
        params: {
          fields: 'comments.summary(true){id},shares',
          access_token: token,
        },
        timeout: 15000,
      }),
    ]);

    const insightsData = insightsRes.status === 'fulfilled' ? (insightsRes.value.data?.data || []) : [];
    const getValue = (name) => insightsData.find(m => m.name === name)?.values?.[0]?.value || 0;

    const fieldsData = fieldsRes.status === 'fulfilled' ? fieldsRes.value.data : {};
    const comments = fieldsData?.comments?.summary?.total_count || 0;
    const shares   = fieldsData?.shares?.count || 0;

    return {
      reach:       getValue('post_impressions_unique'),
      impressions: getValue('post_impressions'),
      likes:       getValue('post_reactions_like_total'),
      comments,
      shares,
    };
  }

  async _fetchInstagramMetrics(igMediaId, account) {
    const token = account.access_token;
    const res = await axios.get(`${GRAPH_BASE}/${igMediaId}/insights`, {
      params: {
        metric: 'reach,impressions,likes,comments,shares,saved',
        access_token: token,
      },
      timeout: 15000,
    });

    const data = res.data?.data || [];
    const getValue = (name) => {
      const metric = data.find(m => m.name === name);
      return metric?.values?.[0]?.value ?? metric?.value ?? 0;
    };

    return {
      reach:       getValue('reach'),
      impressions: getValue('impressions'),
      likes:       getValue('likes'),
      comments:    getValue('comments'),
      shares:      getValue('shares'),
      saves:       getValue('saved'),
    };
  }

  async _updatePostEngagement(postId, { reach, likes, comments, shares, impressions, performance_score }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE posts SET
           engagement = jsonb_build_object(
             'likes', $2::int,
             'comments', $3::int,
             'shares', $4::int,
             'reach', $5::int,
             'impressions', $6::int
           ),
           last_metrics_sync = NOW(),
           performance_score = $7
         WHERE id = $1`,
        [postId, likes, comments, shares, reach, impressions, performance_score]
      );

      // Snapshot for trend history — skip if already snapshotted today
      await client.query(
        `INSERT INTO post_engagement_snapshots (post_id, snapshotted_at, reach, likes, comments, shares)
         VALUES ($1, NOW(), $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [postId, reach, likes, comments, shares]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = MetricsSyncService;
