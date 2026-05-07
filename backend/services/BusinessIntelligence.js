'use strict';

const INDUSTRY_AVERAGES = {
  plumbing:           { profileVisitRate: 0.06, inquiryRate: 0.10, closeRate: 0.50, avgJobValue: 350,  avgEngagement: 1.8 },
  hvac:               { profileVisitRate: 0.06, inquiryRate: 0.09, closeRate: 0.45, avgJobValue: 450,  avgEngagement: 1.7 },
  roofing:            { profileVisitRate: 0.05, inquiryRate: 0.08, closeRate: 0.40, avgJobValue: 8000, avgEngagement: 1.5 },
  concrete:           { profileVisitRate: 0.05, inquiryRate: 0.08, closeRate: 0.45, avgJobValue: 3500, avgEngagement: 1.6 },
  landscaping:        { profileVisitRate: 0.07, inquiryRate: 0.10, closeRate: 0.55, avgJobValue: 800,  avgEngagement: 2.1 },
  electrical:         { profileVisitRate: 0.06, inquiryRate: 0.09, closeRate: 0.50, avgJobValue: 400,  avgEngagement: 1.7 },
  painting:           { profileVisitRate: 0.07, inquiryRate: 0.10, closeRate: 0.50, avgJobValue: 2500, avgEngagement: 1.9 },
  pest_control:       { profileVisitRate: 0.08, inquiryRate: 0.12, closeRate: 0.55, avgJobValue: 200,  avgEngagement: 2.2 },
  cleaning:           { profileVisitRate: 0.08, inquiryRate: 0.12, closeRate: 0.55, avgJobValue: 250,  avgEngagement: 2.3 },
  general_contractor: { profileVisitRate: 0.06, inquiryRate: 0.09, closeRate: 0.45, avgJobValue: 500,  avgEngagement: 1.8 },
  general:            { profileVisitRate: 0.06, inquiryRate: 0.09, closeRate: 0.45, avgJobValue: 500,  avgEngagement: 1.8 },
};

class BusinessIntelligence {
  constructor(pool) {
    this.pool = pool;
  }

  _getAvg(industry) {
    return INDUSTRY_AVERAGES[industry] || INDUSTRY_AVERAGES.general;
  }

  async getBusinessMetrics(customerId, period = '30days') {
    const days = period === '7days' ? 7 : period === '90days' ? 90 : 30;

    const [customerRes, postsRes] = await Promise.all([
      this.pool.query('SELECT industry, posting_streak FROM customers WHERE id = $1', [customerId]),
      this.pool.query(
        `SELECT
           COALESCE(SUM((engagement->>'reach')::int), 0)       AS total_reach,
           COALESCE(SUM((engagement->>'impressions')::int), 0) AS total_impressions,
           COALESCE(SUM((engagement->>'likes')::int), 0)       AS total_likes,
           COALESCE(SUM((engagement->>'comments')::int), 0)    AS total_comments,
           COALESCE(SUM((engagement->>'shares')::int), 0)      AS total_shares,
           COUNT(*)                                            AS post_count
         FROM posts
         WHERE customer_id = $1
           AND status = 'posted'
           AND posted_at >= NOW() - INTERVAL '${days} days'`,
        [customerId]
      ),
    ]);

    const customer = customerRes.rows[0] || {};
    const d        = postsRes.rows[0];
    const avg      = this._getAvg(customer.industry);

    const totalReach              = parseInt(d.total_reach)    || 0;
    const totalEngagement         = (parseInt(d.total_likes) + parseInt(d.total_comments) + parseInt(d.total_shares)) || 0;
    const estimatedLocalReach     = Math.round(totalReach * 0.67);
    const estimatedProfileVisits  = Math.round(estimatedLocalReach * avg.profileVisitRate);
    const estimatedInquiries      = Math.round(estimatedProfileVisits * avg.inquiryRate);
    const inquiryMin              = Math.max(0, Math.round(estimatedInquiries * (avg.closeRate - 0.15)));
    const inquiryMax              = Math.round(estimatedInquiries * (avg.closeRate + 0.15));
    const engagementRate          = totalReach > 0 ? parseFloat(((totalEngagement / totalReach) * 100).toFixed(2)) : 0;
    const percentileRank          = this._estimatePercentile(engagementRate, avg.avgEngagement);

    return {
      period,
      totalReach,
      totalPosts:            parseInt(d.post_count),
      estimatedLocalReach,
      estimatedProfileVisits,
      estimatedInquiries,
      estimatedNewCustomers: { min: inquiryMin, max: inquiryMax },
      estimatedRevenue:      { min: Math.round(inquiryMin * avg.avgJobValue), max: Math.round(inquiryMax * avg.avgJobValue) },
      engagementRate,
      industryAvgEngagement: avg.avgEngagement,
      percentileRank,
      isOutperforming:       engagementRate >= avg.avgEngagement,
      postingStreak:         customer.posting_streak || 0,
      disclaimer:            'These are estimates based on industry averages. Actual results vary.',
    };
  }

  _estimatePercentile(rate, industryAvg) {
    if (industryAvg === 0) return 50;
    const ratio = rate / industryAvg;
    if (ratio >= 2.0) return 95;
    if (ratio >= 1.5) return 85;
    if (ratio >= 1.2) return 75;
    if (ratio >= 1.0) return 60;
    if (ratio >= 0.8) return 45;
    if (ratio >= 0.6) return 30;
    return 20;
  }

  async getEngagementTrend(customerId, weeks = 8) {
    const rows = await this.pool.query(
      `SELECT
         DATE_TRUNC('week', posted_at)                                   AS week_start,
         COUNT(*)                                                        AS post_count,
         COALESCE(SUM((engagement->>'likes')::int
           + (engagement->>'comments')::int
           + (engagement->>'shares')::int), 0)                          AS engagement
       FROM posts
       WHERE customer_id = $1
         AND status = 'posted'
         AND posted_at >= NOW() - INTERVAL '${weeks} weeks'
       GROUP BY 1
       ORDER BY 1`,
      [customerId]
    );

    return rows.rows.map(r => ({
      week:       new Date(r.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      engagement: parseInt(r.engagement),
      posts:      parseInt(r.post_count),
    }));
  }

  async getBestPerformingPost(customerId, period = '30days') {
    const days   = period === '7days' ? 7 : period === '90days' ? 90 : 30;
    const result = await this.pool.query(
      `SELECT id, caption, media_url, content_type, engagement,
              performance_score, posted_at, platforms
       FROM posts
       WHERE customer_id = $1
         AND status = 'posted'
         AND posted_at >= NOW() - INTERVAL '${days} days'
       ORDER BY performance_score DESC NULLS LAST,
                ((engagement->>'likes')::int + (engagement->>'comments')::int + (engagement->>'shares')::int) DESC NULLS LAST
       LIMIT 1`,
      [customerId]
    );
    return result.rows[0] || null;
  }

  async getContentMixAnalysis(customerId) {
    const result = await this.pool.query(
      `SELECT content_type, wizard_trigger, COUNT(*) AS cnt
       FROM posts
       WHERE customer_id = $1
         AND created_at >= NOW() - INTERVAL '30 days'
         AND status NOT IN ('failed')
       GROUP BY content_type, wizard_trigger`,
      [customerId]
    );

    const total = result.rows.reduce((s, r) => s + parseInt(r.cnt), 0);
    if (total === 0) {
      return {
        mix: { educational: 0, promotional: 0, socialProof: 0, seasonal: 0 },
        healthScore: 0, recommendation: 'No posts yet this month.', gaps: [],
      };
    }

    const counts = { educational: 0, promotional: 0, socialProof: 0, seasonal: 0 };
    result.rows.forEach(r => {
      const n       = parseInt(r.cnt);
      const trigger = r.wizard_trigger;
      if (['share_tip', 'faq', 'behind_scenes', 'community'].includes(trigger)) counts.educational += n;
      else if (['promotion'].includes(trigger))                                   counts.promotional += n;
      else if (['got_review', 'finished_job'].includes(trigger))                  counts.socialProof += n;
      else if (['seasonal'].includes(trigger))                                    counts.seasonal += n;
      else if (r.content_type === 'carousel')  counts.educational += n;
      else if (r.content_type === 'static')    counts.educational += n;
      else if (r.content_type === 'video')     counts.socialProof += n;
      else                                     counts.promotional += n;
    });

    const pct = k => Math.round((counts[k] / total) * 100);
    const mix = { educational: pct('educational'), promotional: pct('promotional'), socialProof: pct('socialProof'), seasonal: pct('seasonal') };

    const gaps = [];
    if (mix.educational < 50) gaps.push('Need more educational content (target: 70%)');
    if (mix.promotional > 20) gaps.push('Too many promotional posts (target: 10%)');
    if (mix.socialProof < 10) gaps.push('Add customer testimonials or before/after posts');
    if (mix.seasonal < 5)     gaps.push('Include seasonal content for this time of year');

    const healthScore    = Math.max(0, 100 - (gaps.length * 20));
    const recommendation = gaps.length === 0
      ? 'Great content balance — keep it up!'
      : `PostCore: ${gaps[0]}`;

    return { mix, healthScore, recommendation, gaps };
  }
}

module.exports = BusinessIntelligence;
