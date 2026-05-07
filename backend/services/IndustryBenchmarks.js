'use strict';

const BENCHMARKS = {
  plumbing:     { avgEngagementRate: 1.8, avgPostsPerWeek: 2.1, avgFollowerGrowthPerMonth: 8,  avgReachPerPost: 180, topContentTypes: ['before_after','educational_tip','seasonal'],     bestPostingDays: ['tuesday','thursday'],          bestPostingHours: [8,17,19] },
  hvac:         { avgEngagementRate: 1.7, avgPostsPerWeek: 2.0, avgFollowerGrowthPerMonth: 7,  avgReachPerPost: 165, topContentTypes: ['educational_tip','seasonal','before_after'],      bestPostingDays: ['monday','wednesday','friday'],  bestPostingHours: [8,12,18] },
  roofing:      { avgEngagementRate: 1.5, avgPostsPerWeek: 1.8, avgFollowerGrowthPerMonth: 6,  avgReachPerPost: 150, topContentTypes: ['before_after','seasonal','educational_tip'],      bestPostingDays: ['tuesday','friday'],            bestPostingHours: [9,17] },
  concrete:     { avgEngagementRate: 1.6, avgPostsPerWeek: 1.9, avgFollowerGrowthPerMonth: 7,  avgReachPerPost: 160, topContentTypes: ['before_after','behind_scenes','educational_tip'], bestPostingDays: ['wednesday','thursday'],         bestPostingHours: [9,16,18] },
  landscaping:  { avgEngagementRate: 2.1, avgPostsPerWeek: 2.8, avgFollowerGrowthPerMonth: 12, avgReachPerPost: 220, topContentTypes: ['before_after','seasonal','behind_scenes'],        bestPostingDays: ['monday','wednesday','saturday'],bestPostingHours: [8,12,17] },
  electrical:   { avgEngagementRate: 1.7, avgPostsPerWeek: 2.0, avgFollowerGrowthPerMonth: 7,  avgReachPerPost: 170, topContentTypes: ['educational_tip','before_after','seasonal'],      bestPostingDays: ['tuesday','thursday'],          bestPostingHours: [8,17,19] },
  painting:     { avgEngagementRate: 1.9, avgPostsPerWeek: 2.2, avgFollowerGrowthPerMonth: 9,  avgReachPerPost: 195, topContentTypes: ['before_after','behind_scenes','educational_tip'],bestPostingDays: ['tuesday','friday'],            bestPostingHours: [9,16,18] },
  pest_control: { avgEngagementRate: 2.2, avgPostsPerWeek: 2.4, avgFollowerGrowthPerMonth: 10, avgReachPerPost: 210, topContentTypes: ['educational_tip','seasonal','faq'],               bestPostingDays: ['monday','wednesday','friday'],  bestPostingHours: [8,12,18] },
  cleaning:     { avgEngagementRate: 2.3, avgPostsPerWeek: 2.5, avgFollowerGrowthPerMonth: 11, avgReachPerPost: 225, topContentTypes: ['before_after','behind_scenes','educational_tip'],bestPostingDays: ['monday','tuesday','friday'],    bestPostingHours: [8,13,18] },
  general_contractor: { avgEngagementRate: 1.8, avgPostsPerWeek: 2.1, avgFollowerGrowthPerMonth: 8, avgReachPerPost: 180, topContentTypes: ['before_after','educational_tip','behind_scenes'], bestPostingDays: ['tuesday','thursday'], bestPostingHours: [8,17,19] },
};

const FALLBACK = BENCHMARKS.general_contractor;

class IndustryBenchmarks {
  constructor(pool) {
    this.pool = pool;
  }

  getIndustryBenchmark(industry) {
    return BENCHMARKS[industry] || FALLBACK;
  }

  async compareToIndustry(customerId) {
    const [customerRes, statsRes] = await Promise.all([
      this.pool.query('SELECT industry, posting_streak FROM customers WHERE id = $1', [customerId]),
      this.pool.query(
        `SELECT
           COUNT(*)                                        AS post_count,
           COALESCE(AVG(
             (engagement->>'likes')::int +
             (engagement->>'comments')::int +
             (engagement->>'shares')::int
           ), 0)                                          AS avg_engagement,
           COALESCE(AVG((engagement->>'reach')::int), 0) AS avg_reach
         FROM posts
         WHERE customer_id = $1
           AND status = 'posted'
           AND posted_at >= NOW() - INTERVAL '30 days'`,
        [customerId]
      ),
    ]);

    const customer     = customerRes.rows[0] || {};
    const s            = statsRes.rows[0];
    const bench        = this.getIndustryBenchmark(customer.industry);
    const postCount    = parseInt(s.post_count) || 0;
    const avgEng       = parseFloat(s.avg_engagement) || 0;
    const avgReach     = parseFloat(s.avg_reach) || 0;
    const postsPerWeek = postCount / 4.3;
    const engRate      = avgReach > 0 ? parseFloat(((avgEng / avgReach) * 100).toFixed(2)) : 0;

    const outperforming   = [];
    const underperforming = [];

    if (postsPerWeek >= bench.avgPostsPerWeek) outperforming.push('posting consistency');
    else underperforming.push(`posting frequency (you: ${postsPerWeek.toFixed(1)}/wk, industry: ${bench.avgPostsPerWeek}/wk)`);

    if (engRate >= bench.avgEngagementRate) outperforming.push('engagement rate');
    else underperforming.push(`engagement rate (you: ${engRate}%, industry avg: ${bench.avgEngagementRate}%)`);

    const percentile = this._percentile(engRate, bench.avgEngagementRate);
    const insight = outperforming.length >= underperforming.length
      ? `You are posting more consistently than ${percentile}% of ${customer.industry || 'similar'} businesses.`
      : `Your ${underperforming[0]} needs attention. Most ${customer.industry || 'similar'} businesses post ${bench.avgPostsPerWeek} times per week.`;

    return {
      yourStats:             { engagementRate: engRate, postsPerWeek: parseFloat(postsPerWeek.toFixed(1)), reachPerPost: Math.round(avgReach) },
      industryStats:         { engagementRate: bench.avgEngagementRate, postsPerWeek: bench.avgPostsPerWeek, reachPerPost: bench.avgReachPerPost },
      percentileRank:        percentile,
      outperformingAreas:    outperforming,
      underperformingAreas:  underperforming,
      insight,
    };
  }

  async getBestTimeToPost(customerId) {
    const customerRes = await this.pool.query('SELECT industry FROM customers WHERE id = $1', [customerId]);
    const industry    = customerRes.rows[0]?.industry;
    const bench       = this.getIndustryBenchmark(industry);

    const histRes = await this.pool.query(
      `SELECT
         EXTRACT(DOW FROM posted_at)::int  AS dow,
         EXTRACT(HOUR FROM posted_at)::int AS hour,
         AVG((engagement->>'likes')::int + (engagement->>'comments')::int) AS avg_eng
       FROM posts
       WHERE customer_id = $1
         AND status = 'posted'
         AND posted_at >= NOW() - INTERVAL '90 days'
       GROUP BY 1, 2
       HAVING COUNT(*) >= 2
       ORDER BY avg_eng DESC
       LIMIT 6`,
      [customerId]
    );

    const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

    if (histRes.rows.length >= 4) {
      const personalBestDays  = [...new Set(histRes.rows.map(r => DAYS[r.dow]))];
      const personalBestHours = [...new Set(histRes.rows.map(r => parseInt(r.hour)))];
      return {
        source:          'your_data',
        facebook:        { bestDays: personalBestDays.slice(0, 3), bestHours: personalBestHours.slice(0, 3) },
        instagram:       { bestDays: personalBestDays.slice(0, 3), bestHours: personalBestHours.slice(0, 3) },
        google_business: { bestDays: bench.bestPostingDays, bestHours: bench.bestPostingHours },
        note: 'Based on your top-performing posts from the last 90 days.',
      };
    }

    return {
      source:          'industry_benchmarks',
      facebook:        { bestDays: bench.bestPostingDays, bestHours: bench.bestPostingHours },
      instagram:       { bestDays: bench.bestPostingDays, bestHours: bench.bestPostingHours },
      google_business: { bestDays: bench.bestPostingDays, bestHours: bench.bestPostingHours.slice(0, 2) },
      note: `Based on industry averages for ${industry || 'your industry'}. Post more to unlock your personal best times.`,
    };
  }

  _percentile(rate, industryAvg) {
    if (!industryAvg) return 50;
    const r = rate / industryAvg;
    if (r >= 2)   return 95;
    if (r >= 1.5) return 82;
    if (r >= 1.2) return 72;
    if (r >= 1.0) return 58;
    if (r >= 0.8) return 42;
    if (r >= 0.5) return 28;
    return 15;
  }
}

module.exports = IndustryBenchmarks;
