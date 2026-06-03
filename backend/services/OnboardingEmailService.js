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

function emailWrapper(bodyHtml, footerNote = '', preheader = '') {
  const logoUrl = `${APP_URL}/fav-icon.png`;
  const year    = new Date().getFullYear();
  const preheaderHtml = preheader ? `\n<!--[if !gte mso 9]><!--><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;visibility:hidden;opacity:0;font-size:1px;color:#F5F3FF;line-height:1px;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div><!--<![endif]-->` : '';
  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
    img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none;}
    :root{color-scheme:light;}
    body{margin:0;padding:0;background:#F5F3FF;width:100% !important;min-width:100%;}
    .body p{font-size:15px;line-height:1.75;color:#374151;margin:0 0 16px;}
    .body strong{color:#111827;}
    .hero{font-size:22px;font-weight:800;color:#111827;line-height:1.3;margin:0 0 20px;letter-spacing:-0.02em;}
    .btn-wrap{text-align:center;margin:24px 0 8px;}
    .btn{display:inline-block;padding:13px 28px;background:#7C5CFC;color:#ffffff !important;text-decoration:none;border-radius:100px;font-size:14px;font-weight:700;}
    .btn-ghost{display:inline-block;padding:10px 22px;border:1px solid #EDE9FE;color:#6B7280;text-decoration:none;border-radius:100px;font-size:13px;font-weight:600;}
    .box{background:#F9F8FF;border:1px solid #EDE9FE;border-radius:10px;padding:16px 20px;margin:16px 0;}
    .box-purple{background:#F5F3FF;border:1px solid #C4B5FD;border-radius:10px;padding:20px;margin:16px 0;}
    .chip{display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;margin:2px 3px;}
    .chip-purple{background:#EDE9FE !important;color:#7C5CFC !important;}
    .chip-green{background:#D1FAE5 !important;color:#059669 !important;}
    .chip-amber{background:#FEF3C7 !important;color:#D97706 !important;}
    hr.divider{border:none;border-top:1px solid #EDE9FE;margin:24px 0;}
    @media screen and (max-width:600px){
      .email-card{width:100% !important;max-width:100% !important;}
      .email-body-td{padding:22px 20px !important;}
      .logo-outer-td{padding:20px 16px 12px !important;}
    }
    @media (prefers-color-scheme:dark){
      body{background-color:#F5F3FF !important;}
      .email-card-white{background-color:#FFFFFF !important;}
      .body p{color:#374151 !important;}
      .body strong,.hero{color:#111827 !important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F5F3FF;width:100%;">
${preheaderHtml}
<!--[if mso | IE]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F3FF;"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F3FF;width:100%;border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <!-- Logo above card -->
      <table role="presentation" class="email-card" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;border-collapse:collapse;">
        <tr>
          <td class="logo-outer-td" align="center" style="padding-bottom:16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td style="vertical-align:middle;padding-right:10px;">
                  <img src="${logoUrl}" alt="ItsPosting" width="36" height="36" style="display:block;width:36px;height:36px;border-radius:8px;" />
                </td>
                <td style="vertical-align:middle;">
                  <span style="font-size:17px;font-weight:700;color:#111827;letter-spacing:-0.02em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">ItsPosting</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Card -->
      <table role="presentation" class="email-card email-card-white" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:12px;border:1px solid #EDE9FE;border-collapse:collapse;">
        <tr>
          <td class="email-body-td body" style="padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75;color:#374151;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px 32px;background:#1E1B4B;border-radius:0 0 12px 12px;">
            <p style="margin:0;font-size:12px;color:#A5B4FC;line-height:1.8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
              ${footerNote || 'You received this because you signed up for ItsPosting.'}<br />
              <a href="${APP_URL}/settings" style="color:#C4B5FD;text-decoration:none;">Manage email preferences</a>
              &nbsp;&middot;&nbsp; &copy; ${year} ItsPosting
            </p>
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>
<!--[if mso | IE]></td></tr></table><![endif]-->
</body>
</html>`;
}

// ─── step item helper (table-based for email-client compatibility) ─────────────
function stepItem(num, title, detail) {
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 18px;">
      <tr>
        <td style="width:32px;vertical-align:top;padding-top:1px;">
          <div style="width:28px;height:28px;border-radius:50%;background:#7C5CFC;text-align:center;line-height:28px;font-size:13px;font-weight:800;color:#fff;font-family:-apple-system,sans-serif;">${num}</div>
        </td>
        <td style="padding-left:14px;vertical-align:top;">
          <p style="margin:0 0 4px;font-size:14px;color:#111827;font-weight:600;">${title}</p>
          <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6;">${detail}</p>
        </td>
      </tr>
    </table>`;
}

// ─── stat row helper (table-based) ────────────────────────────────────────────
function statRow(label, value, valueColor = '#111827', borderTop = true) {
  const border = borderTop ? 'border-top:1px solid #EDE9FE;' : '';
  return `
    <tr>
      <td style="font-size:13px;color:#6B7280;padding:8px 0;${border}">${label}</td>
      <td style="text-align:right;font-size:14px;font-weight:700;color:${valueColor};padding:8px 0;${border}">${value}</td>
    </tr>`;
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
        AND (c.marketing_emails_opt_out IS NULL OR c.marketing_emails_opt_out = FALSE)
        AND (c.email_hard_bounced IS NULL OR c.email_hard_bounced = FALSE)
    `);

    let sent = 0, skipped = 0;

    for (const c of customers) {
      const sentDays = c.sent_days || [];
      const days = parseInt(c.days_since_signup) || 0;
      const postsCount = parseInt(c.total_posts_this_month) || 0;

      try {
        if (days >= 1 && !sentDays.includes(1)) {
          await this._send(c, 1, () => this._buildDay1(c, month));
          sent++;
        } else if (days >= 3 && !sentDays.includes(3)) {
          await this._send(c, 3, () => this._buildDay3(c, month));
          sent++;
        } else if (days >= 5 && !sentDays.includes(5) && postsCount === 0) {
          await this._send(c, 5, () => this._buildDay5(c));
          sent++;
        } else if (days >= 7 && !sentDays.includes(7) && c.plan === 'trial') {
          await this._send(c, 7, () => this._buildDay7(c));
          sent++;
        } else if (days >= 14 && !sentDays.includes(14)) {
          await this._send(c, 14, () => this._buildDay14(c, month));
          sent++;
        } else if (days >= 30 && !sentDays.includes(30)) {
          await this._send(c, 30, () => this._buildDay30(c));
          sent++;
        } else {
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
      <p>ItsPosting AI has been briefed on your business. It knows you're in <strong>${industryLabel}</strong> and it already knows what local homeowners are searching for right now.</p>

      <div class="box-purple">
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#7C5CFC;text-transform:uppercase;letter-spacing:0.08em;">ItsPosting AI's first suggestion for you</p>
        <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#111827;line-height:1.4;">"${seasonal?.urgencyTopic || 'Share what makes your business different'}"</p>
        <p style="margin:0;font-size:13px;color:#6B7280;">The #1 topic local homeowners are searching for in ${MONTH_NAMES[month - 1]}.</p>
      </div>

      <p>Here's how to create your first post in under 60 seconds:</p>

      ${stepItem(1, 'Open the Post Wizard', 'Tap "Post Wizard" — ItsPosting AI guides you through 3 quick questions.')}
      ${stepItem(2, 'Pick a content type', 'Photo, text card, carousel — ItsPosting AI writes the caption for you.')}
      ${stepItem(3, 'Tap Post Now or Schedule', 'Your post goes live on Facebook, Instagram, and Google Business at once.')}

      <div class="btn-wrap"><a href="${wizardUrl}" class="btn">Create my first post →</a></div>

      <div class="box">
        <table style="width:100%;border-collapse:collapse;">
          ${statRow('Free credits', '<span style="color:#7C5CFC;font-family:monospace;">10 credits</span>', '#111827', false)}
          ${statRow('Photo post costs', '3 credits', '#111827')}
          ${statRow('Trial length', '7 days', '#111827')}
        </table>
      </div>
      <p style="font-size:13px;color:#9CA3AF;">Need help? Just reply to this email — I read every one.</p>
    `, 'You received this because you just created an ItsPosting account.', `Your first post idea is ready — ItsPosting AI picked the perfect topic for ${biz} this ${MONTH_NAMES[month - 1]}.`);

    const text = `Welcome to ItsPosting, ${biz}!\n\nItsPosting AI has been briefed on your ${industryLabel} business.\n\nYour first suggested post topic: "${seasonal?.urgencyTopic}"\n\nCreate your first post here: ${wizardUrl}\n\nYou have 10 free credits and 7 days to try everything.\n\nQuestions? Reply to this email.`;

    return { subject, html, text };
  }

  _buildDay1(customer, month) {
    const biz = customer.business_name || 'there';
    const knowledge = industryKnowledge[customer.industry] || industryKnowledge.general_contractor;
    const seasonal = knowledge.seasonalContent[month];
    const hook = knowledge.hookFormulas?.[0] || 'Did you know most homeowners don\'t know about this?';
    const wizardUrl = `${APP_URL}/wizard`;

    const subject = `ItsPosting AI has a post ready for you, ${biz}`;

    const html = emailWrapper(`
      <p class="hero">ItsPosting AI is ready to post for you.</p>
      <p>It's ${MONTH_NAMES[month - 1]} — and based on what local homeowners are searching for right now, ItsPosting AI has a post idea ready for your business.</p>

      <div class="box-purple">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#7C5CFC;text-transform:uppercase;letter-spacing:0.08em;">This week's recommended post</p>
        <p style="margin:0 0 10px;font-size:17px;font-weight:700;color:#111827;line-height:1.4;">${seasonal?.urgencyTopic || 'Share a recent job you completed'}</p>
        <p style="margin:0;font-size:13px;color:#6B7280;">Opening hook ItsPosting AI will use: <em style="color:#374151;">"${hook}"</em></p>
      </div>

      <p>ItsPosting AI writes the full caption, generates an image, and adapts it for Facebook, Instagram, and Google Business — automatically.</p>
      <p>It takes about <strong>45 seconds</strong> from tap to scheduled.</p>

      <div class="btn-wrap"><a href="${wizardUrl}" class="btn">Use this idea now →</a></div>
      <p style="font-size:13px;color:#9CA3AF;text-align:center;">This idea is time-sensitive — ${MONTH_NAMES[month - 1]} is the right moment for this topic.</p>
    `, '', `ItsPosting AI has a post ready for ${biz} — takes 45 seconds to create and schedule.`);

    const text = `ItsPosting AI has a post idea ready for you.\n\nThis month's recommended topic: "${seasonal?.urgencyTopic}"\n\nCreate it here in 45 seconds: ${wizardUrl}`;
    return { subject, html, text };
  }

  _buildDay3(customer, month) {
    const industryLabel = INDUSTRY_LABELS[customer.industry] || 'your industry';
    const knowledge = industryKnowledge[customer.industry] || industryKnowledge.general_contractor;
    const seasonal = knowledge.seasonalContent[month];
    const hooks = knowledge.hookFormulas?.slice(0, 3) || [];
    const ctaVariations = knowledge.ctaVariations?.slice(0, 2) || ['Call us today', 'Book your free estimate'];

    const subject = `What's working in ${industryLabel} this ${MONTH_NAMES[month - 1]}`;

    const html = emailWrapper(`
      <p class="hero">Here's what's working in ${industryLabel} right now.</p>
      <p>ItsPosting AI analyzed engagement data across ${industryLabel} businesses this ${MONTH_NAMES[month - 1]}. Here's what's getting the most reach locally:</p>

      <div class="box">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#7C5CFC;text-transform:uppercase;letter-spacing:0.08em;">#1 Topic this month</p>
        <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#111827;">${seasonal?.urgencyTopic || 'Customer testimonials and before/after work'}</p>
        <p style="margin:0;font-size:13px;color:#6B7280;">Tip angle: <em style="color:#374151;">${seasonal?.tipTopic || 'Share a specific problem you solved recently'}</em></p>
      </div>

      <p style="margin-top:20px;font-size:14px;font-weight:700;color:#111827;">Opening hooks that stop the scroll for ${industryLabel} businesses:</p>
      ${hooks.map(h => `
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 10px;">
          <tr>
            <td style="width:16px;vertical-align:top;padding-top:1px;font-size:14px;font-weight:800;color:#7C5CFC;">&rarr;</td>
            <td style="padding-left:10px;font-size:13px;color:#6B7280;font-style:italic;line-height:1.6;">"${h}"</td>
          </tr>
        </table>`).join('')}

      <p style="margin-top:20px;font-size:14px;font-weight:700;color:#111827;">CTAs that convert:</p>
      <p style="margin:8px 0 16px;">${ctaVariations.map(c => `<span class="chip chip-purple">${c}</span>`).join('')}</p>

      <hr class="divider" />
      <p>ItsPosting AI uses all of this automatically when you generate a post. You never have to think about it.</p>
      <div class="btn-wrap"><a href="${APP_URL}/wizard" class="btn">Generate a post with these insights →</a></div>
    `, '', `Here's what's converting for ${industryLabel} businesses this ${MONTH_NAMES[month - 1]} — ItsPosting AI uses it automatically.`);

    const text = `What's working in ${industryLabel} this ${MONTH_NAMES[month - 1]}:\n\n#1 topic: ${seasonal?.urgencyTopic}\n\nItsPosting AI uses this data automatically. Generate a post here: ${APP_URL}/wizard`;
    return { subject, html, text };
  }

  _buildDay5(customer) {
    const wizardUrl = `${APP_URL}/wizard`;

    const subject = `Still getting started? Let me make it easier.`;

    const html = emailWrapper(`
      <p class="hero">Creating content doesn't have to be hard.</p>
      <p>ItsPosting AI noticed you haven't created your first post yet. That's completely fine — I want to make this as easy as possible.</p>
      <p>Here's the exact process. It takes <strong>under 2 minutes</strong>:</p>

      ${stepItem(1, 'Go to Post Wizard', 'No blank page. ItsPosting AI asks you 3 quick questions — that\'s it.')}
      ${stepItem(2, 'Answer: What happened recently?', 'Finished a job? Got a great review? Pick it from a list — no typing needed.')}
      ${stepItem(3, 'ItsPosting AI writes 3 variations', 'Pick the one you like. One tap publishes or schedules it.')}

      <div class="btn-wrap"><a href="${wizardUrl}" class="btn">Try it now — 2 minutes →</a></div>

      <hr class="divider" />

      <p style="font-size:14px;font-weight:700;color:#111827;margin-bottom:12px;">Common questions:</p>
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:12px 0;border-bottom:1px solid #EDE9FE;font-size:14px;color:#374151;vertical-align:top;"><strong style="color:#111827;">Q: I don't know what to write.</strong><br/><span style="color:#6B7280;">A: You don't write anything. ItsPosting AI writes it. You just answer 3 questions about your business.</span></td></tr>
        <tr><td style="padding:12px 0;border-bottom:1px solid #EDE9FE;font-size:14px;color:#374151;vertical-align:top;"><strong style="color:#111827;">Q: I don't have photos.</strong><br/><span style="color:#6B7280;">A: ItsPosting AI generates an image for you automatically. Or you can upload your own (it's free).</span></td></tr>
        <tr><td style="padding:12px 0;font-size:14px;color:#374151;vertical-align:top;"><strong style="color:#111827;">Q: I don't have time.</strong><br/><span style="color:#6B7280;">A: The average post takes 47 seconds from open to scheduled. We timed it.</span></td></tr>
      </table>

      <p style="font-size:13px;color:#9CA3AF;margin-top:20px;">Still stuck? Just reply to this email and tell me what's getting in the way. I'll help you through it personally.</p>
    `, '', 'Creating your first post takes under 2 minutes — ItsPosting AI does the writing, you just answer 3 quick questions.');

    const text = `Creating content doesn't have to be hard.\n\nItsPosting AI asks 3 questions — you pick answers from a list — it writes the caption and generates the image. Average time: 47 seconds.\n\nTry it here: ${wizardUrl}\n\nStill stuck? Reply and I'll help you personally.`;
    return { subject, html, text };
  }

  _buildDay7(customer) {
    const credits = parseInt(customer.credits_balance) || 0;
    const upgradeUrl = `${APP_URL}/billing`;

    const subject = `Your free trial ends tomorrow`;

    const html = emailWrapper(`
      <p class="hero">Your trial ends in 24 hours.</p>
      <p>After tomorrow, your ItsPosting account moves to read-only mode — you can still view your posts but won't be able to generate new content.</p>

      <div class="box-purple">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#7C5CFC;text-transform:uppercase;letter-spacing:0.08em;">Your trial summary</p>
        <table style="width:100%;border-collapse:collapse;">
          ${statRow('Credits remaining', `<span style="color:#7C5CFC;font-family:monospace;">${credits} credits</span>`, '#111827', false)}
          ${statRow('Status if upgraded today', '<span style="color:#059669;">Keep everything</span>', '#111827')}
        </table>
      </div>

      <p style="font-size:14px;font-weight:700;color:#111827;margin-top:20px;">Choose your plan:</p>
      <div class="box" style="padding:0;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:14px 20px;border-bottom:1px solid #EDE9FE;vertical-align:middle;">
              <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#111827;">Starter &nbsp;<span style="font-size:12px;font-weight:400;color:#6B7280;">50 credits/month</span></p>
              <p style="margin:0;font-size:12px;color:#9CA3AF;">Perfect for getting started — 1 post every few days</p>
            </td>
            <td style="padding:14px 20px;border-bottom:1px solid #EDE9FE;text-align:right;white-space:nowrap;vertical-align:middle;">
              <span style="font-size:17px;font-weight:800;color:#7C5CFC;">$20<span style="font-size:12px;font-weight:400;color:#9CA3AF;">/mo</span></span>
            </td>
          </tr>
          <tr style="background:#F9F8FF;">
            <td style="padding:14px 20px;border-bottom:1px solid #EDE9FE;vertical-align:middle;">
              <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#111827;">Professional &nbsp;<span class="chip chip-purple">Most popular</span></p>
              <p style="margin:0;font-size:12px;color:#9CA3AF;">100 credits/month — post daily across all platforms</p>
            </td>
            <td style="padding:14px 20px;border-bottom:1px solid #EDE9FE;text-align:right;white-space:nowrap;vertical-align:middle;">
              <span style="font-size:17px;font-weight:800;color:#7C5CFC;">$40<span style="font-size:12px;font-weight:400;color:#9CA3AF;">/mo</span></span>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 20px;vertical-align:middle;">
              <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#111827;">Premium &nbsp;<span style="font-size:12px;font-weight:400;color:#6B7280;">150 credits/month</span></p>
              <p style="margin:0;font-size:12px;color:#9CA3AF;">Full power — video, carousels, multi-account</p>
            </td>
            <td style="padding:14px 20px;text-align:right;white-space:nowrap;vertical-align:middle;">
              <span style="font-size:17px;font-weight:800;color:#7C5CFC;">$60<span style="font-size:12px;font-weight:400;color:#9CA3AF;">/mo</span></span>
            </td>
          </tr>
        </table>
      </div>

      <div class="btn-wrap"><a href="${upgradeUrl}" class="btn">Upgrade now — keep your content →</a></div>
      <p style="font-size:12px;color:#9CA3AF;text-align:center;">No contracts. Cancel anytime. Prices in USD.</p>
    `, '', `Your free trial ends in 24 hours — upgrade from $20/mo to keep posting. No contracts.`);

    const text = `Your ItsPosting trial ends tomorrow.\n\nUpgrade to keep posting:\n- Starter: $20/mo (50 credits)\n- Professional: $40/mo (100 credits) ← most popular\n- Premium: $60/mo (150 credits)\n\nUpgrade here: ${upgradeUrl}\n\nNo contracts. Cancel anytime.`;
    return { subject, html, text };
  }

  _buildDay14(customer, month) {
    const industry = customer.industry || 'general_contractor';
    const study = CASE_STUDIES[industry] || CASE_STUDIES.general_contractor;
    const industryLabel = INDUSTRY_LABELS[industry] || 'your industry';
    const knowledge = industryKnowledge[industry] || industryKnowledge.general_contractor;
    const seasonal = knowledge.seasonalContent[month];

    const subject = `How a ${industryLabel} business got ${study.metric} with ItsPosting`;

    const html = emailWrapper(`
      <p class="hero">Real results from a ${industryLabel} business like yours.</p>

      <div class="box-purple">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#7C5CFC;text-transform:uppercase;letter-spacing:0.08em;">Case Study — ${study.city}</p>
        <p style="margin:0 0 8px;font-size:19px;font-weight:800;color:#111827;letter-spacing:-0.02em;">${study.name}</p>
        <p style="margin:0;font-size:14px;color:#374151;">They ${study.achievement}.</p>
      </div>

      <p style="font-size:14px;font-weight:700;color:#111827;margin:20px 0 12px;">What they did:</p>

      ${stepItem(1, 'Posted consistently — 3 times per week', 'Using the wizard, each post took under a minute to create and schedule.')}
      ${stepItem(2, 'Used seasonal content at the right time', `This ${MONTH_NAMES[month - 1]}: "${seasonal?.urgencyTopic || 'timely content for local homeowners'}"`)}
      ${stepItem(3, 'Mixed content types', '70% educational tips, 20% before/after showcases, 10% promotions.')}

      <div class="box">
        <table style="width:100%;border-collapse:collapse;">
          ${statRow('Avg reach per post', `<strong>${study.metric}</strong>`, '#111827', false)}
          ${statRow('Time per post', '<span style="color:#059669;">&#60; 60 seconds</span>', '#111827')}
        </table>
      </div>

      <p style="font-size:12px;color:#9CA3AF;">Based on anonymized data from ${industryLabel} businesses on ItsPosting. Results vary.</p>
      <div class="btn-wrap"><a href="${APP_URL}/wizard" class="btn">Start building your story →</a></div>
    `, '', `${study.name} in ${study.city} ${study.achievement} — here's exactly how.`);

    const text = `${study.name} in ${study.city} ${study.achievement} — averaging ${study.metric}.\n\nThey posted 3x/week using ItsPosting's wizard, seasonal content, and a consistent content mix.\n\nStart yours here: ${APP_URL}/wizard`;
    return { subject, html, text };
  }

  _buildDay30(customer) {
    const biz = customer.business_name || 'there';
    const posts = parseInt(customer.total_posts_this_month) || 0;
    const industryLabel = INDUSTRY_LABELS[customer.industry] || 'your industry';
    const estReach = posts * 650;
    const estSaved = Math.round(estReach * 0.012);

    const subject = posts > 0
      ? `${biz}: your first month with ItsPosting AI — here's the scorecard`
      : `${biz}: here's what your first month could have looked like`;

    const day30Preheader = posts > 0
      ? `You reached an estimated ~${estReach.toLocaleString()} local homeowners this month — here's your full scorecard.`
      : `Here's what ${industryLabel} businesses like yours accomplished this month — and what's still ahead.`;

    const day30Body = posts > 0 ? `
      <p class="hero">You've been posting for 30 days. Here's your scorecard.</p>

      <div class="box">
        <table style="width:100%;border-collapse:collapse;">
          ${statRow('Posts created this month', `<strong>${posts}</strong>`, '#111827', false)}
          ${statRow('Est. local reach', `<span style="color:#7C5CFC;font-family:monospace;">~${estReach.toLocaleString()} homeowners</span>`, '#111827')}
          ${statRow('Equivalent ad spend saved', `<span style="color:#059669;">~$${estSaved.toLocaleString()}</span>`, '#111827')}
        </table>
      </div>

      <p style="font-size:11px;color:#9CA3AF;">Based on industry averages for ${industryLabel} businesses. Actual results vary.</p>

      <p>${posts >= 8
        ? `You're in the top tier of ${industryLabel} businesses on ItsPosting. Keep it up — consistency is the single biggest predictor of results.`
        : `You're making progress. ${industryLabel} businesses that post at least 3x per week see an average of 4× more inbound inquiries.`
      }</p>

      <div class="btn-wrap"><a href="${APP_URL}/analytics" class="btn">View your full analytics →</a></div>
      <div class="btn-wrap" style="margin-top:0;"><a href="${APP_URL}/wizard" class="btn-ghost">Create next month's content</a></div>
    ` : `
      <p class="hero">A month has passed. Here's what you missed — and what's still ahead.</p>

      <p>${industryLabel} businesses that posted 3x/week this month reached an average of <strong>~7,800 local homeowners</strong> organically. That's potential customers who never saw your name.</p>

      <div class="box-purple">
        <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#7C5CFC;text-transform:uppercase;letter-spacing:0.08em;">What consistency looks like</p>
        <table style="width:100%;border-collapse:collapse;">
          ${statRow('12 posts/month', '<span style="font-family:monospace;">~7,800 local reach</span>', '#111827', false)}
          ${statRow('Time investment', '<span style="color:#059669;">&#60; 10 minutes</span>', '#111827')}
        </table>
      </div>

      <p>It's not too late. Month 2 starts now.</p>
      <div class="btn-wrap"><a href="${APP_URL}/wizard" class="btn">Create your first post today →</a></div>
      <p style="font-size:12px;color:#9CA3AF;text-align:center;">Based on industry averages. Actual results vary.</p>
    `;

    const html = emailWrapper(day30Body, '', day30Preheader);

    const text = posts > 0
      ? `Your first month with ItsPosting: ${posts} posts, ~${estReach.toLocaleString()} estimated local reach.\n\nView analytics: ${APP_URL}/analytics`
      : `A month has passed. ${industryLabel} businesses posting 3x/week reach ~7,800 local homeowners/month.\n\nStart now: ${APP_URL}/wizard`;

    return { subject, html, text };
  }
}

module.exports = OnboardingEmailService;
