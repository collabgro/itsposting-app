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

  // Resolve a platform's post ID from the stored map, along with the specific
  // social_accounts row id it belongs to when the key is suffixed
  // ("facebook_123" — written when a customer has multiple connected accounts
  // of the same platform; see SocialPublisher._collectPlatformPostIds). Without
  // accountRowId, the caller has no way to know WHICH of several same-platform
  // accounts a given post ID belongs to, and would have to guess — risking
  // fetching metrics with the wrong account's access token entirely.
  _resolvePlatformId(platformIds, platform) {
    if (platformIds[platform] !== undefined) return { postId: platformIds[platform], accountRowId: null };
    const entry = Object.entries(platformIds).find(([k]) => k.startsWith(`${platform}_`));
    if (!entry) return null;
    const accountRowId = parseInt(entry[0].slice(platform.length + 1), 10);
    return { postId: entry[1], accountRowId: Number.isFinite(accountRowId) ? accountRowId : null };
  }

  // Core sync logic — fetches from all platforms and writes to DB.
  async _syncPostMetrics(post, platformIds, customerId) {
    const accounts = await this.pool.query(
      `SELECT id, platform, account_id, access_token FROM social_accounts
       WHERE customer_id = $1 AND platform IN ('facebook', 'instagram', 'tiktok') AND enabled = true`,
      [customerId]
    );

    // accountById resolves a specific account when the key carries a row id
    // suffix; accountByPlatform is the fallback for the common single-account
    // (bare key) case — keeping a "last one wins" pick ONLY when there's
    // genuinely no other way to identify which account a bare key refers to.
    const accountById = {};
    const accountByPlatform = {};
    for (const row of accounts.rows) {
      accountById[row.id] = row;
      accountByPlatform[row.platform] = row;
    }

    const fb = this._resolvePlatformId(platformIds, 'facebook');
    const ig = this._resolvePlatformId(platformIds, 'instagram');
    const tt = this._resolvePlatformId(platformIds, 'tiktok');

    const fbAccount = fb?.accountRowId != null ? accountById[fb.accountRowId] : accountByPlatform.facebook;
    const igAccount = ig?.accountRowId != null ? accountById[ig.accountRowId] : accountByPlatform.instagram;
    const ttAccount = tt?.accountRowId != null ? accountById[tt.accountRowId] : accountByPlatform.tiktok;

    let fbReach = 0, igReach = 0, ttViews = 0;
    let likes = 0, comments = 0, shares = 0, impressions = 0;
    const synced_platforms = [];

    if (fb?.postId && fbAccount) {
      try {
        const fbMetrics = await this._fetchFacebookMetrics(fb.postId, fbAccount);
        fbReach = fbMetrics.reach || 0;
        likes += fbMetrics.likes || 0;
        comments += fbMetrics.comments || 0;
        shares += fbMetrics.shares || 0;
        impressions += fbMetrics.impressions || 0;
        synced_platforms.push('facebook');
      } catch (err) {
        console.warn(`[MetricsSyncService] FB metrics failed for post ${post.id}:`, err.message);
      }
    }

    if (ig?.postId && igAccount) {
      try {
        const igMetrics = await this._fetchInstagramMetrics(ig.postId, igAccount);
        igReach = igMetrics.reach || 0;
        likes += igMetrics.likes || 0;
        comments += igMetrics.comments || 0;
        impressions += igMetrics.impressions || 0;
        synced_platforms.push('instagram');
      } catch (err) {
        // Instagram insights require a Business/Creator account — log clearly
        const isInsightsError = err.response?.data?.error?.code === 100 || err.message?.includes('insights');
        console.warn(
          `[MetricsSyncService] IG metrics failed for post ${post.id}:`,
          isInsightsError ? 'Account needs to be Business/Creator type for insights' : err.message
        );
      }
    }

    if (tt?.postId && ttAccount) {
      try {
        const ttMetrics = await this._fetchTikTokMetrics(tt.postId, ttAccount);
        likes += ttMetrics.likes || 0;
        comments += ttMetrics.comments || 0;
        shares += ttMetrics.shares || 0;
        ttViews = ttMetrics.views || 0; // TikTok view_count is the closest equivalent to reach
        synced_platforms.push('tiktok');
      } catch (err) {
        const isScopeErr = err.response?.data?.error?.code === 'access_token_invalid'
          || err.message?.includes('scope') || err.message?.includes('video.list');
        console.warn(
          `[MetricsSyncService] TikTok metrics failed for post ${post.id}:`,
          isScopeErr ? 'Reconnect TikTok in Settings to grant video.list scope' : err.message
        );
      }
    }

    if (!synced_platforms.length) return { synced: false, reason: 'no_data' };

    // Reach: take the highest single-platform value — same person may follow multiple accounts.
    // TikTok view_count is used as reach equivalent (closest available metric).
    const reach = Math.max(fbReach, igReach, ttViews);
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

  async _fetchTikTokMetrics(publishId, account) {
    const token = account.access_token;

    // Step 1 — resolve publish_id → video_id (TikTok processes videos asynchronously)
    const statusRes = await axios.post(
      'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
      { publish_id: publishId },
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
        timeout: 15000,
      }
    );

    const videoId = statusRes.data?.data?.video_id;
    if (!videoId) {
      // Video still processing — not an error, just skip this sync cycle
      throw new Error(`TikTok video still processing (publish_id=${publishId})`);
    }

    // Step 2 — query video stats (requires video.list scope)
    const metricsRes = await axios.post(
      'https://open.tiktokapis.com/v2/video/query/',
      { filters: { video_ids: [videoId] } },
      {
        params:  { fields: 'id,like_count,comment_count,share_count,view_count' },
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );

    const video = metricsRes.data?.data?.videos?.[0];
    if (!video) throw new Error(`TikTok video ${videoId} not found in query response`);

    return {
      videoId,
      likes:    video.like_count    || 0,
      comments: video.comment_count || 0,
      shares:   video.share_count   || 0,
      views:    video.view_count    || 0,
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
        `INSERT INTO post_engagement_snapshots (post_id, snapshot_at, reach, likes, comments, shares)
         VALUES ($1, NOW(), $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [postId, reach, likes, comments, shares]
      );

      await client.query('COMMIT');

      // ── Sync reach back to PostCore Brain training tables (fire-and-forget) ──
      // Zero customer impact — runs after the transaction completes.
      const _reach = reach;
      const _engagement = likes + comments + shares;
      const _postId = postId;
      const _pool = this.pool;
      setImmediate(async () => {
        try {
          await Promise.all([
            _pool.query(
              `UPDATE post_training_data
               SET post_reach = $1, post_engagement = $2
               WHERE post_id = $3 AND (post_reach IS NULL OR post_reach < $1)`,
              [_reach, _engagement, _postId]
            ),
            _pool.query(
              `UPDATE image_training_data
               SET post_reach = $1, post_engagement = $2
               WHERE post_id = $3 AND (post_reach IS NULL OR post_reach < $1)`,
              [_reach, _engagement, _postId]
            ),
            _pool.query(
              `UPDATE video_training_data
               SET post_reach = $1, post_engagement = $2
               WHERE post_id = $3 AND (post_reach IS NULL OR post_reach < $1)`,
              [_reach, _engagement, _postId]
            ),
          ]);
        } catch (syncErr) {
          console.warn('[MetricsSync] training table reach sync failed:', syncErr.message);
        }
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = MetricsSyncService;
