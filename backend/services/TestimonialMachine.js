const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
let NotificationService;
try { NotificationService = require('./NotificationService'); } catch { NotificationService = null; }

class TestimonialMachine {
  constructor(pool) {
    this.pool = pool;
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async runForAllEligible() {
    const client = await this.pool.connect();
    try {
      // Find customers with auto-testimonial on, not suspended, not sub-accounts,
      // and either no prior auto-testimonial or last one > 14 days ago.
      const { rows: customers } = await client.query(`
        SELECT c.id, c.business_name, c.industry, c.city, c.timezone,
               c.content_preferences
        FROM customers c
        WHERE c.suspended IS NOT TRUE
          AND c.parent_customer_id IS NULL
          AND c.content_preferences->>'auto_testimonial_enabled' = 'true'
          AND (
            c.content_preferences->>'auto_testimonial_last_run' IS NULL
            OR (c.content_preferences->>'auto_testimonial_last_run')::timestamptz < NOW() - INTERVAL '14 days'
          )
        LIMIT 50
      `);

      for (const customer of customers) {
        try {
          await this.runForCustomer(customer, client);
        } catch (err) {
          console.error(`[TestimonialMachine] customer ${customer.id}:`, err.message);
        }
      }
    } finally {
      client.release();
    }
  }

  async runForCustomer(customer, client) {
    // Fetch GMB social account
    const { rows: accounts } = await client.query(
      `SELECT access_token, account_id FROM social_accounts
        WHERE customer_id=$1 AND platform='google_business' AND enabled=true LIMIT 1`,
      [customer.id]
    );
    if (!accounts[0]) return;

    const { access_token, account_id } = accounts[0];

    // Fetch up to 10 reviews
    let reviews = [];
    try {
      const res = await axios.get(
        `https://mybusiness.googleapis.com/v4/${account_id}/reviews`,
        { params: { pageSize: 10 }, headers: { Authorization: `Bearer ${access_token}` }, timeout: 10000 }
      );
      reviews = (res.data?.reviews || [])
        .filter(r => r.comment && r.comment.trim().length > 20)
        .map(r => ({
          id: r.reviewId,
          name: r.reviewer?.displayName || 'A customer',
          stars: { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[r.starRating] || 5,
          text: r.comment,
          date: r.createTime,
        }))
        .filter(r => r.stars >= 4);
    } catch (err) {
      console.error(`[TestimonialMachine] fetch reviews for ${customer.id}:`, err.message);
      return;
    }

    if (reviews.length === 0) return;

    // Pick the best unused review (most specific text, highest star rating)
    const { rows: usedReviews } = await client.query(
      `SELECT metadata->>'review_id' AS review_id FROM posts
        WHERE customer_id=$1 AND source='auto_testimonial'`,
      [customer.id]
    );
    const usedIds = new Set(usedReviews.map(r => r.review_id).filter(Boolean));

    const candidates = reviews.filter(r => !usedIds.has(r.id));
    if (candidates.length === 0) return;

    // Pick highest-star, longest text
    const review = candidates.sort((a, b) => b.stars - a.stars || b.text.length - a.text.length)[0];

    // Generate caption with Claude
    const caption = await this.generateCaption(customer, review);
    if (!caption) return;

    // Create draft post
    const meta = JSON.stringify({ review_id: review.id, reviewer: review.name, stars: review.stars });
    await client.query(
      `INSERT INTO posts (customer_id, content_type, caption, status, source, platforms, metadata, created_at)
        VALUES ($1, 'static', $2, 'draft', 'auto_testimonial', ARRAY['facebook','instagram'], $3::jsonb, NOW())`,
      [customer.id, caption, meta]
    );

    // Update last run timestamp
    await client.query(
      `UPDATE customers
          SET content_preferences = COALESCE(content_preferences, '{}'::jsonb)
            || jsonb_build_object('auto_testimonial_last_run', NOW()::text)
        WHERE id=$1`,
      [customer.id]
    );

    console.log(`[TestimonialMachine] Created auto-testimonial draft for customer ${customer.id}`);

    // Notify user that a testimonial post draft is ready to review
    if (NotificationService) {
      try {
        const ns = new NotificationService(client);
        ns.create(customer.id, 'system',
          'PostCore created a testimonial post for you',
          `We turned a ${review.stars}-star review from ${review.name} into a draft post. Tap to review and publish it.`
        );
      } catch (notifErr) {
        console.error('[TestimonialMachine] Notification failed:', notifErr.message);
      }
    }
  }

  async generateCaption(customer, review) {
    try {
      const msg = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 350,
        messages: [{
          role: 'user',
          content: `You are writing a social media post for ${customer.business_name} in ${customer.city || 'our area'} (${customer.industry || 'local services'}).

A happy customer named ${review.name} left this ${review.stars}-star review:
"${review.text.substring(0, 400)}"

Write a genuine, human-sounding caption that:
- Thanks them by name naturally
- Highlights one specific detail from their review
- Sounds like the business owner wrote it themselves
- Ends with a soft engagement question ("Have you had a similar experience?")
- Is 100-180 words
- Does NOT say "delve", "synergy", "leverage", "optimize", or "utilize"

Return ONLY the caption text, no quotes, no preamble.`,
        }],
      });
      return msg.content[0]?.text?.trim() || null;
    } catch (err) {
      console.error('[TestimonialMachine] Claude error:', err.message);
      return null;
    }
  }
}

module.exports = TestimonialMachine;
