const THEME_TO_BUCKET = {
  // Educational — tips, how-tos, seasonal advice, community content
  educational_tip:      'educational',
  maintenance_tip:      'educational',
  faq:                  'educational',
  faq_busting:          'educational',
  how_to:               'educational',
  tip:                  'educational',
  educational:          'educational',
  share_tip:            'educational',
  seasonal:             'educational',
  seasonal_warning:     'educational',
  community:            'educational',
  local_highlight:      'educational',
  community_event:      'educational',
  // Social Proof — completed jobs, testimonials, before/afters
  customer_testimonial: 'socialProof',
  testimonial:          'socialProof',
  review:               'socialProof',
  got_review:           'socialProof',
  project_showcase:     'socialProof',
  before_after:         'socialProof',
  job_completed:        'socialProof',
  job_finished:         'socialProof',
  team_spotlight:       'socialProof',
  // Promotional — offers, announcements, service features
  promotion:            'promotional',
  service_feature:      'promotional',
  customer_value:       'promotional',
  offer:                'promotional',
  announcement:         'promotional',
};

const CONTENT_TYPE_TO_BUCKET = {
  static:   'promotional',
  photo:    'socialProof',
  carousel: 'educational',
  video:    'promotional',
};

// 70/20/10 rule — non-negotiable per CLAUDE.md
const IDEAL_MIX = {
  educational: 0.70,
  socialProof: 0.20,
  promotional: 0.10,
};

const LOW_THRESHOLD  = 0.05; // flag if a bucket is less than half its ideal target
const HIGH_THRESHOLD = 0.60;

const BUCKET_LABELS = {
  educational: 'Educational',
  socialProof: 'Social Proof',
  promotional: 'Promotional',
};

const BUCKET_COLORS = {
  educational: '#3B82F6',
  socialProof: '#22C55E',
  promotional: '#EAB308',
};

function classifyPost(post) {
  if (post.theme && THEME_TO_BUCKET[post.theme]) return THEME_TO_BUCKET[post.theme];
  return CONTENT_TYPE_TO_BUCKET[post.content_type] || 'promotional';
}

function buildRecommendation(mix, gaps, overloaded) {
  if (gaps.length === 0 && overloaded.length === 0) {
    return 'Your content mix is well balanced. Keep it up!';
  }
  const parts = [];
  if (overloaded.includes('promotional')) parts.push("You're posting too many promotional posts — audiences disengage from constant selling. Aim for 1 promo per 10 posts.");
  if (overloaded.includes('educational')) parts.push('Good on tips, but mix in more customer results and before/after projects to build trust.');
  if (gaps.includes('educational'))       parts.push('Post more educational tips — they get 2x more saves and keep your audience coming back.');
  if (gaps.includes('socialProof'))       parts.push('Share more customer results, reviews, and before/after projects to build trust.');
  if (gaps.includes('promotional'))       parts.push('You can add a light promotional post — offers and announcements remind customers you\'re available.');
  return parts.join(' ') || 'Try mixing in different content types for better engagement.';
}

function calculateHealthScore(mix) {
  let totalDeviation = 0;
  for (const bucket of Object.keys(IDEAL_MIX)) {
    totalDeviation += Math.abs((mix[bucket] / 100) - IDEAL_MIX[bucket]);
  }
  return Math.max(0, Math.round((1 - totalDeviation / 2) * 100));
}

function getStreakMilestone(streak) {
  if (streak >= 100) return { label: '100 Day Legend', color: '#F59E0B' };
  if (streak >= 60)  return { label: '60 Day Machine', color: '#EF4444' };
  if (streak >= 30)  return { label: '30 Day Streak',  color: '#7C5CFC' };
  if (streak >= 14)  return { label: '2 Week Streak',  color: '#3B82F6' };
  if (streak >= 7)   return { label: '1 Week Streak',  color: '#22C55E' };
  return null;
}

class ContentMixTracker {
  constructor(pool) {
    this.pool = pool;
  }

  async analyzeContentMix(customerId) {
    const result = await this.pool.query(
      `SELECT content_type, theme
       FROM posts
       WHERE customer_id = $1
         AND created_at >= NOW() - INTERVAL '30 days'
       ORDER BY created_at DESC`,
      [customerId]
    );

    const posts = result.rows;
    const total = posts.length;
    const counts = { educational: 0, socialProof: 0, promotional: 0 };

    for (const post of posts) counts[classifyPost(post)]++;

    const mix = {};
    for (const bucket of Object.keys(counts)) {
      mix[bucket] = total > 0 ? Math.round((counts[bucket] / total) * 100) : 0;
    }

    const gaps = [], overloaded = [];
    for (const bucket of Object.keys(counts)) {
      const ratio = total > 0 ? counts[bucket] / total : 0;
      if (ratio < LOW_THRESHOLD && total > 0) gaps.push(bucket);
      if (ratio > HIGH_THRESHOLD)             overloaded.push(bucket);
    }

    return {
      mix,
      counts,
      healthScore:    total > 0 ? calculateHealthScore(mix) : 0,
      totalPosts:     total,
      gaps,
      overloaded,
      recommendation: buildRecommendation(mix, gaps, overloaded),
      bucketColors:   BUCKET_COLORS,
      bucketLabels:   BUCKET_LABELS,
      idealMix:       Object.fromEntries(Object.entries(IDEAL_MIX).map(([k, v]) => [k, Math.round(v * 100)])),
    };
  }

  async updatePostingStreak(customerId) {
    const customerResult = await this.pool.query(
      `SELECT posting_streak, last_posted_at FROM customers WHERE id = $1`,
      [customerId]
    );
    if (customerResult.rows.length === 0) throw new Error(`Customer ${customerId} not found`);

    const customer       = customerResult.rows[0];
    const previousStreak = customer.posting_streak || 0;
    const lastPostedAt   = customer.last_posted_at;
    const now            = new Date();

    let newStreak, isReset = false;
    if (!lastPostedAt) {
      newStreak = 1;
    } else {
      const hoursSinceLastPost = (now - new Date(lastPostedAt)) / (1000 * 60 * 60);
      if (hoursSinceLastPost <= 48) {
        newStreak = previousStreak + 1;
      } else {
        newStreak = 1;
        isReset   = true;
      }
    }

    await this.pool.query(
      `UPDATE customers SET posting_streak = $1, last_posted_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [newStreak, customerId]
    );

    return { streak: newStreak, previousStreak, isReset, lastPostedAt: now.toISOString() };
  }

  async getMonthlyStats(customerId) {
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const postsResult = await this.pool.query(
      `SELECT
         id, content_type, theme, status, caption, media_url,
         scheduled_date, posted_at, created_at,
         COALESCE((engagement->>'likes')::int, 0)    AS likes,
         COALESCE((engagement->>'comments')::int, 0) AS comments,
         COALESCE((engagement->>'shares')::int, 0)   AS shares
       FROM posts
       WHERE customer_id = $1 AND created_at BETWEEN $2 AND $3
       ORDER BY created_at DESC`,
      [customerId, monthStart.toISOString(), monthEnd.toISOString()]
    );

    const posts = postsResult.rows;
    const total = posts.length;

    if (total === 0) {
      return {
        totalPostsThisMonth: 0, postedCount: 0, scheduledCount: 0, draftCount: 0,
        streakCurrentMonth: 0, bestPerformingType: null, avgEngagementThisMonth: 0,
        totalEngagement: 0, postsPerDay: 0, activeDays: 0, topPost: null,
        monthLabel: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
      };
    }

    const postedCount    = posts.filter(p => p.status === 'posted').length;
    const scheduledCount = posts.filter(p => p.status === 'scheduled').length;
    const draftCount     = posts.filter(p => p.status === 'draft').length;

    const postsWithEngagement = posts.map(p => ({
      ...p,
      totalEngagement: (parseInt(p.likes) || 0) + (parseInt(p.comments) || 0) + (parseInt(p.shares) || 0),
    }));

    const totalEngagement        = postsWithEngagement.reduce((sum, p) => sum + p.totalEngagement, 0);
    const avgEngagementThisMonth = Math.round(totalEngagement / total);

    const typeEngagement = {}, typeCounts = {};
    for (const p of postsWithEngagement) {
      const type = p.content_type || 'static';
      typeEngagement[type] = (typeEngagement[type] || 0) + p.totalEngagement;
      typeCounts[type]     = (typeCounts[type] || 0) + 1;
    }

    let bestPerformingType = null, bestAvg = -1;
    for (const type of Object.keys(typeEngagement)) {
      const avg = typeEngagement[type] / typeCounts[type];
      if (avg > bestAvg) { bestAvg = avg; bestPerformingType = type; }
    }

    const topPost = postsWithEngagement.reduce(
      (best, p) => (!best || p.totalEngagement > best.totalEngagement) ? p : best, null
    );

    const activeDates = new Set(posts.map(p => {
      const d = new Date(p.scheduled_date || p.posted_at || p.created_at);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }));
    const activeDays  = activeDates.size;
    const postsPerDay = activeDays > 0 ? Math.round((total / activeDays) * 10) / 10 : 0;

    const customerResult = await this.pool.query(
      `SELECT posting_streak FROM customers WHERE id = $1`, [customerId]
    );
    const streakCurrentMonth = customerResult.rows[0]?.posting_streak || 0;

    return {
      totalPostsThisMonth: total, postedCount, scheduledCount, draftCount,
      streakCurrentMonth, bestPerformingType, avgEngagementThisMonth,
      totalEngagement, postsPerDay, activeDays,
      topPost: topPost ? {
        id: topPost.id, contentType: topPost.content_type,
        caption: topPost.caption, mediaUrl: topPost.media_url,
        totalEngagement: topPost.totalEngagement,
      } : null,
      monthLabel: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
    };
  }

  async getContentHealth(customerId) {
    const [contentMix, monthlyStats] = await Promise.all([
      this.analyzeContentMix(customerId),
      this.getMonthlyStats(customerId),
    ]);

    const streakNum = monthlyStats.streakCurrentMonth;
    return {
      contentMix,
      streak: {
        current:   streakNum,
        label:     streakNum === 1 ? '1 day' : `${streakNum} days`,
        isOnFire:  streakNum >= 7,
        milestone: getStreakMilestone(streakNum),
      },
      monthlyStats,
      recommendation: contentMix.recommendation,
      generatedAt:    new Date().toISOString(),
    };
  }
}

module.exports = ContentMixTracker;
