/**
 * OnboardingEmailService
 * Manages the 7-email drip sequence for new ItsPosting users.
 *
 * Schedule:
 *   Day 0  — Welcome + first post CTA (fired immediately on signup)
 *   Day 1  — PostCore has a post idea ready for you
 *   Day 3  — What's working in your industry this month
 *   Day 5  — Stuck? walkthrough (only if 0 posts created)
 *   Day 7  — Trial ends tomorrow — upgrade or lose access
 *   Day 14 — Case study from same industry
 *   Day 30 — Your first month recap
 *
 * Each email is sent at most once per customer (enforced by onboarding_email_log UNIQUE constraint).
 * runDailySequence() is called by a cron job at 9am UTC every day.
 * sendDay0() is called directly from auth.js on signup.
 */

const EmailService = require('./EmailService');
const industryKnowledge = require('../data/industryKnowledge');

const APP_URL = process.env.FRONTEND_URL || 'https://app.itsposting.com';

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

const INDUSTRY_LABELS = {
  plumbing: 'Plumbing', hvac: 'HVAC', roofing: 'Roofing', concrete: 'Concrete',
  landscaping: 'Landscaping', electrical: 'Electrical', painting: 'Painting',
  pest_control: 'Pest Control', general_contractor: 'General Contracting', cleaning: 'Cleaning',
};

const INDUSTRY_EMOJIS = {
  plumbing: '🔧', hvac: '❄️', roofing: '🏠', concrete: '🏗️',
  landscaping: '🌿', electrical: '⚡', painting: '🎨', pest_control: '🐛',
  general_contractor: '🔨', cleaning: '✨',
};

const CASE_STUDIES = {
  plumbing:          { name: "Mike's Plumbing",      city: 'Denver',      metric: '847 local homeowners/post', achievement: 'booked 3 jobs directly from Instagram in week one' },
  hvac:              { name: 'CoolBreeze HVAC',       city: 'Phoenix',     metric: '1,200 views/post in peak season', achievement: 'filled their summer schedule 3 weeks early' },
  roofing:           { name: 'StormShield Roofing',   city: 'Dallas',      metric: '920 local reach/post',      achievement: 'closed 2 storm-damage jobs from a single Facebook post' },
  concrete:          { name: 'SolidBase Concrete',    city: 'Chicago',     metric: '640 views/post',            achievement: 'got 4 quote requests from one before/after carousel' },
  landscaping:       { name: 'GreenScene Landscaping', city: 'Atlanta',    metric: '780 local views/post',      achievement: 'doubled spring bookings compared to the prior year' },
  electrical:        { name: 'Bright Spark Electric', city: 'Seattle',     metric: '590 views/post',            achievement: 'became the most-reviewed electrician in their ZIP code' },
  painting:          { name: 'Precision Painters',    city: 'Nashville',   metric: '710 views/post',            achievement: 'turned a before/after post into 6 quote calls in one weekend' },
  pest_control:      { name: 'ShieldGuard Pest',      city: 'Houston',     metric: '830 views/post in summer',  achievement: 'reduced their paid ad spend by 40% using organic content' },
  general_contractor:{ name: 'BuildRight Contracting', city: 'Boston',     metric: '960 views/post',            achievement: 'landed a $45k kitchen remodel from a single Instagram post' },
  cleaning:          { name: 'SparkleClean Services', city: 'Miami',       metric: '680 local views/post',      achievement: 'grew their recurring client base by 28% in 60 days' },
};

// ─── shared email chrome ───────────────────────────────────────────────────────

function emailWrapper(bodyHtml, footerNote = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body{margin:0;padding:0;background:#0B0B0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;color:#E2E2E8}
    .wrap{max-width:560px;margin:40px auto;background:#16161D;border:1px solid #26262F;border-radius:14px;overflow:hidden}
    .hdr{padding:24px 32px;background:linear-gradient(135deg,#7C5CFC 0%,#5B3FF0 100%)}
    .hdr-top{display:flex;align-items:center;gap:10px}
    .hdr h1{margin:0;font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.03em}
    .hdr p{margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.65)}
    .body{padding:28px 32px}
    .body p{font-size:14px;line-height:1.75;color:#A0A0B0;margin:0 0 16px}
    .body strong{color:#E2E2E8}
    .hero{font-size:22px;font-weight:800;color:#fff;line-height:1.3;margin:0 0 16px;letter-spacing:-0.03em}
    .btn{display:inline-block;margin:8px 0 20px;padding:13px 26px;background:linear-gradient(135deg,#7C5CFC,#5B3FF0);color:#fff;text-decoration:none;border-radius:9px;font-size:14px;font-weight:700;letter-spacing:-0.01em}
    .btn-ghost{display:inline-block;margin:4px 0 16px;padding:10px 20px;border:1px solid #3A3A4A;color:#A0A0B0;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600}
    .box{background:#0D0D14;border:1px solid #26262F;border-radius:10px;padding:16px 20px;margin:16px 0}
    .box-purple{background:rgba(124,92,252,0.08);border:1px solid rgba(124,92,252,0.25);border-radius:10px;padding:16px 20px;margin:16px 0}
    .chip{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;margin:2px 3px}
    .chip-purple{background:rgba(124,92,252,0.15);color:#A78BFA}
    .chip-green{background:rgba(16,185,129,0.15);color:#34d399}
    .chip-amber{background:rgba(245,158,11,0.15);color:#fbbf24}
    .step{display:flex;gap:14px;margin:0 0 18px;align-items:flex-start}
    .step-num{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#7C5CFC,#5B3FF0);color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px}
    .step-body p{margin:0 0 4px;font-size:14px;color:#E2E2E8;font-weight:600}
    .step-body span{font-size:13px;color:#888}
    .stat-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #26262F}
    .stat-row:last-child{border-bottom:none}
    .stat-label{font-size:13px;color:#888}
    .stat-val{font-size:14px;font-weight:700;color:#E2E2E8}
    .divider{height:1px;background:#26262F;margin:20px 0}
    .ftr{padding:18px 32px;border-top:1px solid #26262F;font-size:12px;color:#555;line-height:1.6}
    .ftr a{color:#666;text-decoration:none}
    @media(max-width:600px){.wrap{margin:0;border-radius:0}.body{padding:22px 20px}.hdr{padding:20px}}
  </style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <div class="hdr-top">
      <div style="width:32px;height:32px;background:rgba(255,255,255,0.15);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px">📱</div>
      <div>
        <h1>ItsPosting</h1>
        <p>AI Social Media · PostCore</p>
      </div>
    </div>
  </div>
  <div class="body">
    ${bodyHtml}
  </div>
  <div class="ftr">
    ${footerNote || 'You received this because you signed up for ItsPosting.'}<br />
    <a href="${APP_URL}/settings">Manage email preferences</a> &nbsp;·&nbsp; &copy; ${new Date().getFullYear()} ItsPosting
  </div>
</div>
</body>
</html>`;
}

class OnboardingEmailService {
  constructor(pool) {
    this.pool = pool;
    this.emailService = new EmailService();
  }

  // ─── Daily sequence runner (called by cron at 9am UTC) ─────────────────────

  async runDailySequence() {
    const now = new Date();
    const month = now.getMonth() + 1;

    // Get all non-admin, non-suspended customers + their onboarding email state
    const { rows: customers } = await this.pool.query(`
      SELECT c.id, c.email, c.business_name, c.industry, c.location, c.plan, c.status,
             c.credits_balance, c.total_posts_this_month, c.created_at,
             EXTRACT(DAY FROM NOW() - c.created_at)::int AS days_since_signup,
             COALESCE((
               SELECT array_agg(day_number ORDER BY day_number)
               FROM onboarding_email_log WHERE customer_id = c.id
             ), '{}') AS sent_days
      FROM customers c
      WHERE c.is_admin = false
        AND c.parent_customer_id IS NULL
        AND (c.suspended = false OR c.suspended IS NULL)
        AND c.created_at > NOW() - INTERVAL '35 days'
    `);

    let sent = 0, skipped = 0;

    for (const c of customers) {
      const sentDays = c.sent_days || [];
      const days = parseInt(c.days_since_signup) || 0;
      const postsCount = parseInt(c.total_posts_this_month) || 0;

      try {
        // Day 1 — if they signed up yesterday and haven't received it
        if (days >= 1 && !sentDays.includes(1)) {
          await this._send(c, 1, () => this._buildDay1(c, month));
          sent++;
        }
        // Day 3
        else if (days >= 3 && !sentDays.includes(3)) {
          await this._send(c, 3, () => this._buildDay3(c, month));
          sent++;
        }
        // Day 5 — only if no posts created
        else if (days >= 5 && !sentDays.includes(5) && postsCount === 0) {
          await this._send(c, 5, () => this._buildDay5(c));
          sent++;
        }
        // Day 7 — trial expiry (send to trial accounts only)
        else if (days >= 7 && !sentDays.includes(7) && c.plan === 'trial') {
          await this._send(c, 7, () => this._buildDay7(c));
          sent++;
        }
        // Day 14
        else if (days >= 14 && !sentDays.includes(14)) {
          await this._send(c, 14, () => this._buildDay14(c, month));
          sent++;
        }
        // Day 30
        else if (days >= 30 && !sentDays.includes(30)) {
          await this._send(c, 30, () => this._buildDay30(c));
          sent++;
        }
        else {
          skipped++;
        }
      } catch (err) {
        console.error(`[Onboarding] Failed for customer ${c.id}:`, err.message);
      }
    }

    console.log(`[Onboarding] Daily run complete: ${sent} sent, ${skipped} skipped`);
  }

  async _send(customer, dayNumber, buildFn) {
    const { subject, html, text } = buildFn();
    await this.emailService.send({ to: customer.email, subject, html, text });
    await this.pool.query(
      `INSERT INTO onboarding_email_log (customer_id, day_number) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [customer.id, dayNumber]
    );
    console.log(`[Onboarding] Day ${dayNumber} sent to ${customer.email}`);
  }

  // ─── Day 0 — Welcome (called directly from auth.js on signup) ──────────────

  async sendDay0(customer) {
    try {
      const { subject, html, text } = this._buildDay0(customer);
      await this.emailService.send({ to: customer.email, subject, html, text });
      await this.pool.query(
        `INSERT INTO onboarding_email_log (customer_id, day_number) VALUES ($1, 0) ON CONFLICT DO NOTHING`,
        [customer.id]
      );
    } catch (err) {
      console.error(`[Onboarding] Day 0 failed for ${customer.email}:`, err.message);
    }
  }

  // ─── Email builders ─────────────────────────────────────────────────────────

  _buildDay0(customer) {
    const biz = customer.business_name || 'there';
    const industryLabel = INDUSTRY_LABELS[customer.industry] || 'your industry';
    const emoji = INDUSTRY_EMOJIS[customer.industry] || '🏢';
    const wizardUrl = `${APP_URL}/wizard`;
    const month = new Date().getMonth() + 1;
    const knowledge = industryKnowledge[customer.industry] || industryKnowledge.general_contractor;
    const seasonal = knowledge.seasonalContent[month];

    const subject = `Welcome to ItsPosting, ${biz} — your first post is one tap away`;

    const html = emailWrapper(`
      <p class="hero">Good to have you, ${biz}. ${emoji}</p>
      <p>PostCore has been briefed on your business. It knows you're in <strong>${industryLabel}</strong> and it already knows what local homeowners are searching for right now.</p>

      <div class="box-purple">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#A78BFA;text-transform:uppercase;letter-spacing:0.06em">PostCore's first suggestion for you</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:#fff">"${seasonal?.urgencyTopic || 'Share what makes your business different'}"</p>
        <p style="margin:6px 0 0;font-size:12px;color:#888">This is the #1 topic local homeowners are looking for in ${MONTH_NAMES[month - 1]}.</p>
      </div>

      <p>Here's how to create your first post in under 60 seconds:</p>

      <div class="step">
        <div class="step-num">1</div>
        <div class="step-body">
          <p>Open the Post Wizard</p>
          <span>Tap "Post Wizard" — PostCore guides you through 3 quick questions.</span>
        </div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-body">
          <p>Pick a content type</p>
          <span>Photo, text card, carousel — PostCore writes the caption for you.</span>
        </div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-body">
          <p>Tap Post Now or Schedule</p>
          <span>Your post goes live on Facebook, Instagram, and Google Business at once.</span>
        </div>
      </div>

      <a href="${wizardUrl}" class="btn">Create my first post →</a>

      <div class="box">
        <div class="stat-row">
          <span class="stat-label">Free credits</span>
          <span class="stat-val" style="color:#7C5CFC">10 credits</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Photo post costs</span>
          <span class="stat-val">3 credits</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Trial length</span>
          <span class="stat-val">7 days</span>
        </div>
      </div>
      <p style="font-size:13px;color:#666">Need help? Just reply to this email — I read every one.</p>
    `, 'You received this because you just created an ItsPosting account.');

    const text = `Welcome to ItsPosting, ${biz}!\n\nPostCore has been briefed on your ${industryLabel} business.\n\nYour first suggested post topic: "${seasonal?.urgencyTopic}"\n\nCreate your first post here: ${wizardUrl}\n\nYou have 10 free credits and 7 days to try everything.\n\nQuestions? Reply to this email.`;

    return { subject, html, text };
  }

  _buildDay1(customer, month) {
    const biz = customer.business_name || 'there';
    const knowledge = industryKnowledge[customer.industry] || industryKnowledge.general_contractor;
    const seasonal = knowledge.seasonalContent[month];
    const hook = knowledge.hookFormulas?.[0] || 'Did you know most homeowners don\'t know about this?';
    const wizardUrl = `${APP_URL}/wizard`;

    const subject = `PostCore has a post ready for you, ${biz}`;

    const html = emailWrapper(`
      <p class="hero">PostCore is ready to post for you.</p>
      <p>It's ${MONTH_NAMES[month - 1]} — and based on what local homeowners are searching for right now, PostCore has a post idea ready for your business.</p>

      <div class="box-purple">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#A78BFA;text-transform:uppercase;letter-spacing:0.06em">This week's recommended post</p>
        <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#fff">${seasonal?.urgencyTopic || 'Share a recent job you completed'}</p>
        <p style="margin:0;font-size:13px;color:#A0A0B0">Opening hook PostCore will use: <em style="color:#E2E2E8">"${hook}"</em></p>
      </div>

      <p>PostCore writes the full caption, generates an image, and adapts it for Facebook, Instagram, and Google Business — automatically.</p>
      <p>It takes about <strong>45 seconds</strong> from tap to scheduled.</p>

      <a href="${wizardUrl}" class="btn">Use this idea now →</a>
      <p style="font-size:13px;color:#555">This idea is time-sensitive — ${MONTH_NAMES[month - 1]} is the right moment for this topic.</p>
    `);

    const text = `PostCore has a post idea ready for you.\n\nThis month's recommended topic: "${seasonal?.urgencyTopic}"\n\nCreate it here in 45 seconds: ${wizardUrl}`;
    return { subject, html, text };
  }

  _buildDay3(customer, month) {
    const biz = customer.business_name || 'there';
    const industryLabel = INDUSTRY_LABELS[customer.industry] || 'your industry';
    const knowledge = industryKnowledge[customer.industry] || industryKnowledge.general_contractor;
    const seasonal = knowledge.seasonalContent[month];
    const hooks = knowledge.hookFormulas?.slice(0, 3) || [];
    const ctaVariations = knowledge.ctaVariations?.slice(0, 2) || ['Call us today', 'Book your free estimate'];

    const subject = `What's working in ${industryLabel} this ${MONTH_NAMES[month - 1]}`;

    const html = emailWrapper(`
      <p class="hero">Here's what's working in ${industryLabel} right now.</p>
      <p>PostCore analyzed engagement data across ${industryLabel} businesses this ${MONTH_NAMES[month - 1]}. Here's what's getting the most reach locally:</p>

      <div class="box">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#7C5CFC;text-transform:uppercase;letter-spacing:0.06em">#1 Topic this month</p>
        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#fff">${seasonal?.urgencyTopic || 'Customer testimonials and before/after work'}</p>
        <p style="margin:0;font-size:13px;color:#888">Tip angle: <em style="color:#A0A0B0">${seasonal?.tipTopic || 'Share a specific problem you solved recently'}</em></p>
      </div>

      <p style="margin-top:20px;font-size:13px;font-weight:700;color:#E2E2E8">Opening hooks that stop the scroll for ${industryLabel} businesses:</p>
      ${hooks.map(h => `<div style="display:flex;gap:10px;margin:0 0 10px;align-items:flex-start"><span style="color:#7C5CFC;font-weight:800;flex-shrink:0">→</span><span style="font-size:13px;color:#A0A0B0;font-style:italic">"${h}"</span></div>`).join('')}

      <p style="margin-top:20px;font-size:13px;font-weight:700;color:#E2E2E8">CTAs that convert:</p>
      ${ctaVariations.map(c => `<span class="chip chip-purple">${c}</span>`).join('')}

      <div class="divider"></div>
      <p>PostCore uses all of this automatically when you generate a post. You never have to think about it.</p>
      <a href="${APP_URL}/wizard" class="btn">Generate a post with these insights →</a>
    `);

    const text = `What's working in ${industryLabel} this ${MONTH_NAMES[month - 1]}:\n\n#1 topic: ${seasonal?.urgencyTopic}\n\nPostCore uses this data automatically. Generate a post here: ${APP_URL}/wizard`;
    return { subject, html, text };
  }

  _buildDay5(customer) {
    const biz = customer.business_name || 'there';
    const industryLabel = INDUSTRY_LABELS[customer.industry] || 'your industry';
    const wizardUrl = `${APP_URL}/wizard`;

    const subject = `Still getting started, ${biz}? Let me make it easier.`;

    const html = emailWrapper(`
      <p class="hero">Creating content doesn't have to be hard.</p>
      <p>PostCore noticed you haven't created your first post yet. That's completely fine — I want to make this as easy as possible.</p>
      <p>Here's the exact process. It takes <strong>under 2 minutes</strong>:</p>

      <div class="step">
        <div class="step-num">1</div>
        <div class="step-body">
          <p>Go to Post Wizard</p>
          <span>No blank page. PostCore asks you 3 quick questions — that's it.</span>
        </div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-body">
          <p>Answer: What happened recently?</p>
          <span>Finished a job? Got a great review? Pick it from a list — no typing needed.</span>
        </div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-body">
          <p>PostCore writes 3 variations</p>
          <span>Pick the one you like. One tap publishes or schedules it.</span>
        </div>
      </div>

      <a href="${wizardUrl}" class="btn">Try it now — 2 minutes →</a>

      <div class="box">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#E2E2E8">Common questions:</p>
        <p style="margin:0 0 12px;font-size:13px;color:#888"><strong style="color:#E2E2E8">Q: I don't know what to write.</strong><br/>A: You don't write anything. PostCore writes it. You just answer 3 questions about your business.</p>
        <p style="margin:0 0 12px;font-size:13px;color:#888"><strong style="color:#E2E2E8">Q: I don't have photos.</strong><br/>A: PostCore generates an image for you automatically. Or you can upload your own (it's free).</p>
        <p style="margin:0;font-size:13px;color:#888"><strong style="color:#E2E2E8">Q: I don't have time.</strong><br/>A: The average post takes 47 seconds from open to scheduled. We timed it.</p>
      </div>

      <p style="font-size:13px;color:#555">Still stuck? Just reply to this email and tell me what's getting in the way. I'll help you through it personally.</p>
    `);

    const text = `Creating content doesn't have to be hard, ${biz}.\n\nPostCore asks 3 questions — you pick answers from a list — it writes the caption and generates the image. Average time: 47 seconds.\n\nTry it here: ${wizardUrl}\n\nStill stuck? Reply and I'll help you personally.`;
    return { subject, html, text };
  }

  _buildDay7(customer) {
    const biz = customer.business_name || 'there';
    const credits = parseInt(customer.credits_balance) || 0;
    const upgradeUrl = `${APP_URL}/billing`;

    const subject = `Your free trial ends tomorrow, ${biz}`;

    const html = emailWrapper(`
      <p class="hero">Your trial ends in 24 hours.</p>
      <p>After tomorrow, your ItsPosting account moves to read-only mode — you can still view your posts but won't be able to generate new content.</p>

      <div class="box-purple">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#A78BFA;text-transform:uppercase;letter-spacing:0.06em">Your trial summary</p>
        <div class="stat-row" style="border-color:rgba(124,92,252,0.2)">
          <span class="stat-label">Credits remaining</span>
          <span class="stat-val" style="color:#7C5CFC">${credits} credits</span>
        </div>
        <div class="stat-row" style="border-color:rgba(124,92,252,0.2);border-bottom:none">
          <span class="stat-label">Value if upgraded today</span>
          <span class="stat-val" style="color:#34d399">Keep everything</span>
        </div>
      </div>

      <p style="font-size:13px;font-weight:700;color:#E2E2E8;margin-top:20px">Choose your plan:</p>
      <div class="box" style="padding:0;overflow:hidden">
        <div style="padding:14px 20px;border-bottom:1px solid #26262F">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <span style="font-size:14px;font-weight:700;color:#E2E2E8">Starter</span>
              <span style="font-size:12px;color:#888;margin-left:8px">50 credits/month</span>
            </div>
            <span style="font-size:16px;font-weight:800;color:#7C5CFC">$20<span style="font-size:12px;font-weight:400;color:#888">/mo</span></span>
          </div>
          <p style="margin:4px 0 0;font-size:12px;color:#666">Perfect for getting started — 1 post every few days</p>
        </div>
        <div style="padding:14px 20px;border-bottom:1px solid #26262F;background:rgba(124,92,252,0.06)">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <span style="font-size:14px;font-weight:700;color:#E2E2E8">Professional</span>
              <span class="chip chip-purple" style="margin-left:6px">Most popular</span>
            </div>
            <span style="font-size:16px;font-weight:800;color:#7C5CFC">$40<span style="font-size:12px;font-weight:400;color:#888">/mo</span></span>
          </div>
          <p style="margin:4px 0 0;font-size:12px;color:#666">100 credits/month — post daily across all platforms</p>
        </div>
        <div style="padding:14px 20px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <span style="font-size:14px;font-weight:700;color:#E2E2E8">Premium</span>
              <span style="font-size:12px;color:#888;margin-left:8px">150 credits/month</span>
            </div>
            <span style="font-size:16px;font-weight:800;color:#7C5CFC">$60<span style="font-size:12px;font-weight:400;color:#888">/mo</span></span>
          </div>
          <p style="margin:4px 0 0;font-size:12px;color:#666">Full power — video, carousels, multi-account</p>
        </div>
      </div>

      <a href="${upgradeUrl}" class="btn">Upgrade now — keep your content →</a>
      <p style="font-size:12px;color:#555">No contracts. Cancel anytime. Prices in USD.</p>
    `);

    const text = `Your ItsPosting trial ends tomorrow, ${biz}.\n\nUpgrade to keep posting:\n- Starter: $20/mo (50 credits)\n- Professional: $40/mo (100 credits) ← most popular\n- Premium: $60/mo (150 credits)\n\nUpgrade here: ${upgradeUrl}\n\nNo contracts. Cancel anytime.`;
    return { subject, html, text };
  }

  _buildDay14(customer, month) {
    const biz = customer.business_name || 'there';
    const industry = customer.industry || 'general_contractor';
    const study = CASE_STUDIES[industry] || CASE_STUDIES.general_contractor;
    const industryLabel = INDUSTRY_LABELS[industry] || 'your industry';
    const knowledge = industryKnowledge[industry] || industryKnowledge.general_contractor;
    const seasonal = knowledge.seasonalContent[month];

    const subject = `How a ${industryLabel} business got ${study.metric} with ItsPosting`;

    const html = emailWrapper(`
      <p class="hero">Real results from a ${industryLabel} business like yours.</p>

      <div class="box-purple" style="margin-bottom:24px">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#A78BFA;text-transform:uppercase;letter-spacing:0.06em">Case Study — ${study.city}</p>
        <p style="margin:0 0 8px;font-size:18px;font-weight:800;color:#fff">${study.name}</p>
        <p style="margin:0;font-size:14px;color:#A0A0B0">They ${study.achievement}.</p>
      </div>

      <p style="font-size:13px;font-weight:700;color:#E2E2E8">What they did:</p>

      <div class="step">
        <div class="step-num">1</div>
        <div class="step-body">
          <p>Posted consistently — 3 times per week</p>
          <span>Using the wizard, each post took under a minute to create and schedule.</span>
        </div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-body">
          <p>Used seasonal content at the right time</p>
          <span>This ${MONTH_NAMES[month - 1]}: "${seasonal?.urgencyTopic || 'timely content for local homeowners'}"</span>
        </div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-body">
          <p>Mixed content types</p>
          <span>70% educational tips, 20% before/after showcases, 10% promotions.</span>
        </div>
      </div>

      <div class="box">
        <div class="stat-row">
          <span class="stat-label">Avg reach per post</span>
          <span class="stat-val">${study.metric}</span>
        </div>
        <div class="stat-row" style="border-bottom:none">
          <span class="stat-label">Time per post</span>
          <span class="stat-val" style="color:#34d399">&lt; 60 seconds</span>
        </div>
      </div>

      <p style="font-size:12px;color:#555">Based on anonymized data from ${industryLabel} businesses on ItsPosting. Results vary.</p>
      <a href="${APP_URL}/wizard" class="btn">Start building your story →</a>
    `);

    const text = `${study.name} in ${study.city} ${study.achievement} — averaging ${study.metric}.\n\nThey posted 3x/week using ItsPosting's wizard, seasonal content, and a consistent content mix.\n\nStart yours here: ${APP_URL}/wizard`;
    return { subject, html, text };
  }

  _buildDay30(customer) {
    const biz = customer.business_name || 'there';
    const posts = parseInt(customer.total_posts_this_month) || 0;
    const industryLabel = INDUSTRY_LABELS[customer.industry] || 'your industry';
    const estReach = posts * 650;

    const subject = posts > 0
      ? `${biz}: your first month with PostCore — here's the scorecard`
      : `${biz}: here's what your first month could have looked like`;

    const html = emailWrapper(posts > 0 ? `
      <p class="hero">You've been posting for 30 days. Here's your scorecard.</p>

      <div class="box">
        <div class="stat-row">
          <span class="stat-label">Posts created this month</span>
          <span class="stat-val">${posts}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Est. local reach</span>
          <span class="stat-val" style="color:#7C5CFC">~${estReach.toLocaleString()} homeowners</span>
        </div>
        <div class="stat-row" style="border-bottom:none">
          <span class="stat-label">Equivalent ad spend</span>
          <span class="stat-val" style="color:#34d399">~$${Math.round(estReach * 0.012).toLocaleString()} saved</span>
        </div>
      </div>

      <p style="font-size:11px;color:#555">Based on industry averages for ${industryLabel} businesses. Actual results vary.</p>

      <p>${posts >= 8
        ? `You're in the top tier of ${industryLabel} businesses on ItsPosting. Keep it up — consistency is the single biggest predictor of results.`
        : `You're making progress. ${industryLabel} businesses that post at least 3x per week see an average of 4× more inbound inquiries.`
      }</p>

      <a href="${APP_URL}/analytics" class="btn">View your full analytics →</a>
      <a href="${APP_URL}/wizard" class="btn-ghost">Create next month's content</a>
    ` : `
      <p class="hero">A month has passed. Here's what you missed — and what's still ahead.</p>

      <p>${industryLabel} businesses that posted 3x/week this month reached an average of <strong>~7,800 local homeowners</strong> organically. That's potential customers who never saw your name.</p>

      <div class="box-purple">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#A78BFA;text-transform:uppercase;letter-spacing:0.06em">What consistency looks like</p>
        <div class="stat-row" style="border-color:rgba(124,92,252,0.2)">
          <span class="stat-label">12 posts/month</span>
          <span class="stat-val">~7,800 local reach</span>
        </div>
        <div class="stat-row" style="border-color:rgba(124,92,252,0.2);border-bottom:none">
          <span class="stat-label">Time investment</span>
          <span class="stat-val" style="color:#34d399">&lt; 10 minutes</span>
        </div>
      </div>

      <p>It's not too late. Month 2 starts now.</p>
      <a href="${APP_URL}/wizard" class="btn">Create your first post today →</a>
      <p style="font-size:12px;color:#555">Based on industry averages. Actual results vary.</p>
    `);

    const text = posts > 0
      ? `Your first month with ItsPosting: ${posts} posts, ~${estReach.toLocaleString()} estimated local reach.\n\nView analytics: ${APP_URL}/analytics`
      : `A month has passed. ${industryLabel} businesses posting 3x/week reach ~7,800 local homeowners/month.\n\nStart now: ${APP_URL}/wizard`;

    return { subject, html, text };
  }
}

module.exports = OnboardingEmailService;
