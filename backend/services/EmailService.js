/**
 * EmailService — provider-agnostic transactional email service.
 *
 * Provider is auto-detected from available environment variables:
 *   - RESEND_API_KEY present       → uses Resend  (preferred)
 *   - SENDGRID_API_KEY present     → uses SendGrid
 *   - SMTP_HOST present            → uses SMTP / nodemailer
 *   - EMAIL_PROVIDER set explicitly → overrides auto-detect
 *   - None of the above            → LOG-ONLY mode (console output, no actual sending)
 */

// Auto-detect provider from available API keys so emails work without explicitly setting EMAIL_PROVIDER
function resolveProvider() {
  if (process.env.EMAIL_PROVIDER) return process.env.EMAIL_PROVIDER;
  if (process.env.RESEND_API_KEY)      return 'resend';
  if (process.env.SENDGRID_API_KEY)    return 'sendgrid';
  if (process.env.SMTP_HOST)           return 'smtp';
  return 'log';
}

const PROVIDER = resolveProvider();
const FROM_NAME  = process.env.EMAIL_FROM_NAME    || 'ItsPosting';
const FROM_EMAIL = process.env.EMAIL_FROM_ADDRESS || 'noreply@app.itsposting.com';

class EmailService {
  constructor() {
    this.provider = PROVIDER;
    console.log(`[EmailService] Initialised in ${PROVIDER === 'log' ? 'LOG-ONLY (no emails sent)' : PROVIDER} mode`);
  }

  // ─── Public send method ───────────────────────────────────────────────────

  async send({ to, subject, html, text }) {
    if (!to || !subject) throw new Error('to and subject are required');

    const payload = { from: `${FROM_NAME} <${FROM_EMAIL}>`, to, subject, html, text };

    switch (this.provider) {
      case 'sendgrid':   return this._sendViaSendGrid(payload);
      case 'resend':     return this._sendViaResend(payload);
      case 'smtp':       return this._sendViaSmtp(payload);
      default:           return this._logEmail(payload);
    }
  }

  // ─── Template renderer ────────────────────────────────────────────────────

  renderTemplate(templateName, data = {}) {
    const tpl = TEMPLATES[templateName];
    if (!tpl) throw new Error(`Unknown email template: ${templateName}`);
    return {
      subject: this._interpolate(tpl.subject, data),
      html: this._wrapHtml(this._interpolate(tpl.html, data), tpl.subject),
      text: this._interpolate(tpl.text, data),
    };
  }

  _interpolate(str, data) {
    return str.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '');
  }

  _wrapHtml(body, title) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #0B0B0F; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #E2E2E8; }
    .container { max-width: 560px; margin: 40px auto; background: #16161D; border: 1px solid #26262F; border-radius: 12px; overflow: hidden; }
    .header { padding: 28px 32px; background: linear-gradient(135deg, #7C5CFC 0%, #5B3FF0 100%); }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; color: #fff; letter-spacing: -0.02em; }
    .header p { margin: 4px 0 0; font-size: 13px; color: rgba(255,255,255,0.7); }
    .body { padding: 28px 32px; }
    .body p { font-size: 14px; line-height: 1.7; color: #A0A0B0; margin: 0 0 16px; }
    .body strong { color: #E2E2E8; }
    .btn { display: inline-block; margin: 20px 0; padding: 12px 24px; background: #7C5CFC; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; }
    .box { background: #0B0B0F; border: 1px solid #26262F; border-radius: 8px; padding: 16px 20px; margin: 16px 0; }
    .box code { font-family: monospace; color: #7C5CFC; font-size: 15px; word-break: break-all; }
    .footer { padding: 20px 32px; border-top: 1px solid #26262F; font-size: 12px; color: #555; }
    .tag { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .tag-error { background: rgba(239,68,68,0.15); color: #EF4444; }
    .tag-success { background: rgba(34,197,94,0.15); color: #22C55E; }
    .tag-warning { background: rgba(234,179,8,0.15); color: #EAB308; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Its Posting</h1>
      <p>AI Social Media Automation</p>
    </div>
    <div class="body">${body}</div>
    <div class="footer">
      You received this email because of activity on your Its Posting account.<br />
      &copy; ${new Date().getFullYear()} Its Posting. All rights reserved.
    </div>
  </div>
</body>
</html>`;
  }

  // ─── Provider implementations ─────────────────────────────────────────────

  _logEmail({ from, to, subject, html, text }) {
    console.log('\n┌──────────────────────────────────────────');
    console.log(`│ [EMAIL - LOG MODE — NOT SENT]`);
    console.log(`│ From:    ${from}`);
    console.log(`│ To:      ${to}`);
    console.log(`│ Subject: ${subject}`);
    if (text) console.log(`│ Body:    ${text.slice(0, 140)}...`);
    console.log('└──────────────────────────────────────────\n');
    return { success: true, provider: 'log', messageId: `log_${Date.now()}` };
  }

  async _sendViaSendGrid({ from, to, subject, html, text }) {
    // npm install @sendgrid/mail  (add to package.json when activating)
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const result = await sgMail.send({ from, to, subject, html, text });
    return { success: true, provider: 'sendgrid', statusCode: result[0].statusCode };
  }

  async _sendViaResend({ from, to, subject, html, text }) {
    // npm install resend  (add to package.json when activating)
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({ from, to, subject, html, text });
    return { success: true, provider: 'resend', id: result.id };
  }

  async _sendViaSmtp({ from, to, subject, html, text }) {
    // npm install nodemailer  (add to package.json when activating)
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const result = await transporter.sendMail({ from, to, subject, html, text });
    return { success: true, provider: 'smtp', messageId: result.messageId };
  }
}

// ─── Email Templates ──────────────────────────────────────────────────────────

const TEMPLATES = {
  account_suspended: {
    subject: 'Your Its Posting account has been suspended',
    html: `
      <p>Hi <strong>{{businessName}}</strong>,</p>
      <p>Your Its Posting account has been <span class="tag tag-error">Suspended</span>.</p>
      {{#if reason}}
      <div class="box">
        <p style="margin:0;font-size:13px;color:#A0A0B0;">Reason provided:</p>
        <p style="margin:8px 0 0;font-size:14px;color:#E2E2E8;">{{reason}}</p>
      </div>
      {{/if}}
      <p>If you believe this is a mistake or would like to appeal, please reply to this email or contact our support team.</p>
    `,
    text: `Hi {{businessName}},\n\nYour Its Posting account has been suspended.\n\nReason: {{reason}}\n\nIf you believe this is a mistake, please contact support.`,
  },

  account_reactivated: {
    subject: 'Your Its Posting account has been reactivated',
    html: `
      <p>Hi <strong>{{businessName}}</strong>,</p>
      <p>Great news — your Its Posting account has been <span class="tag tag-success">Reactivated</span>.</p>
      <p>You can now log back in and continue creating content for your business.</p>
      <a href="{{loginUrl}}" class="btn">Log in to Its Posting</a>
      <p>If you have any questions, don't hesitate to reach out to our support team.</p>
    `,
    text: `Hi {{businessName}},\n\nYour Its Posting account has been reactivated. You can now log in at: {{loginUrl}}\n\nWelcome back!`,
  },

  credits_adjusted: {
    subject: 'Your Its Posting credit balance has been updated',
    html: `
      <p>Hi <strong>{{businessName}}</strong>,</p>
      <p>An admin has adjusted your credit balance on Its Posting.</p>
      <div class="box">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="font-size:13px;color:#A0A0B0;padding:4px 0;">Adjustment</td>
            <td style="text-align:right;font-size:14px;font-weight:700;color:{{amountColor}};font-family:monospace;">{{amountLabel}}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#A0A0B0;padding:4px 0;">New balance</td>
            <td style="text-align:right;font-size:16px;font-weight:800;color:#E2E2E8;font-family:monospace;">{{newBalance}} credits</td>
          </tr>
          {{#if reason}}
          <tr>
            <td style="font-size:13px;color:#A0A0B0;padding:4px 0;">Note</td>
            <td style="text-align:right;font-size:13px;color:#E2E2E8;">{{reason}}</td>
          </tr>
          {{/if}}
        </table>
      </div>
      <p>Your credits can be used to generate AI content, images, and more on Its Posting.</p>
    `,
    text: `Hi {{businessName}},\n\nYour credit balance has been adjusted by {{amountLabel}}. New balance: {{newBalance}} credits.\n\nNote: {{reason}}`,
  },

  password_reset: {
    subject: 'Reset your Its Posting password',
    html: `
      <p>Hi there,</p>
      <p>We received a request to reset your Its Posting password. Click the button below to choose a new one:</p>
      <a href="{{resetUrl}}" class="btn">Reset my password</a>
      <p style="font-size:13px;color:#666;">This link expires in <strong style="color:#E2E2E8;">1 hour</strong>. If you didn't request this, you can safely ignore this email — your password won't change.</p>
      <div class="box">
        <p style="margin:0;font-size:12px;color:#666;">If the button doesn't work, copy and paste this link:</p>
        <code>{{resetUrl}}</code>
      </div>
    `,
    text: `Hi,\n\nReset your Its Posting password using this link (expires in 1 hour):\n{{resetUrl}}\n\nIf you didn't request this, ignore this email.`,
  },

  password_reset_admin: {
    subject: 'Your Its Posting password has been reset by an admin',
    html: `
      <p>Hi <strong>{{businessName}}</strong>,</p>
      <p>An administrator has reset your Its Posting account password.</p>
      <p>If this was expected, you can log in with your new password. If you did <strong>not</strong> request this, please contact support immediately.</p>
      <a href="{{loginUrl}}" class="btn">Log in to Its Posting</a>
    `,
    text: `Hi {{businessName}},\n\nAn administrator has reset your Its Posting password. Log in at: {{loginUrl}}\n\nIf you did not request this, contact support.`,
  },

  payment_confirmed: {
    subject: 'Payment confirmed — welcome to Its Posting {{planName}}',
    html: `
      <p>Hi <strong>{{businessName}}</strong>,</p>
      <p>Your payment was successful! <span class="tag tag-success">{{planName}} Plan</span> is now active on your account.</p>
      <div class="box">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="font-size:13px;color:#A0A0B0;padding:4px 0;">Plan</td>
            <td style="text-align:right;font-size:14px;font-weight:700;color:#E2E2E8;">{{planName}}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#A0A0B0;padding:4px 0;">Credits added</td>
            <td style="text-align:right;font-size:16px;font-weight:800;color:#7C5CFC;font-family:monospace;">{{credits}} credits</td>
          </tr>
        </table>
      </div>
      <p>Log in now and let PostCore get to work for your business.</p>
      <a href="{{loginUrl}}" class="btn">Log in to Its Posting</a>
      <p style="font-size:13px;color:#666;">Questions? Just reply to this email — we're here to help.</p>
    `,
    text: `Hi {{businessName}},\n\nPayment confirmed! Your {{planName}} plan is now active with {{credits}} credits.\n\nLog in at: {{loginUrl}}\n\nQuestions? Reply to this email.`,
  },

  welcome: {
    subject: 'Welcome to Its Posting — your AI social media assistant',
    html: `
      <p>Hi <strong>{{businessName}}</strong>,</p>
      <p>Welcome to Its Posting! Your account is ready and you have <strong style="color:#7C5CFC;">{{credits}} free credits</strong> to get started.</p>
      <p>Here's what you can do with Its Posting:</p>
      <ul style="color:#A0A0B0;font-size:14px;line-height:1.8;padding-left:20px;">
        <li>Generate AI-written captions for Facebook, Instagram, and Google Business</li>
        <li>Create stunning AI images for your posts</li>
        <li>Build carousel posts automatically</li>
        <li>Schedule posts to publish at the perfect time</li>
      </ul>
      <a href="{{loginUrl}}" class="btn">Start creating content</a>
    `,
    text: `Hi {{businessName}},\n\nWelcome to Its Posting! You have {{credits}} free credits to get started.\n\nLog in at: {{loginUrl}}`,
  },

  post_published: {
    subject: 'Your post went live on {{platform}}',
    html: `
      <p>Hi <strong>{{businessName}}</strong>,</p>
      <p>Your post was successfully published to <strong style="color:#22C55E;">{{platform}}</strong>. <span class="tag tag-success">Live</span></p>
      <p>PostCore will track its performance over the next 24–48 hours and surface insights in your analytics dashboard.</p>
      <a href="{{analyticsUrl}}" class="btn">View Analytics</a>
    `,
    text: `Hi {{businessName}},\n\nYour post is now live on {{platform}}.\n\nView analytics at: {{analyticsUrl}}`,
  },

  workspace_invite: {
    subject: "You've been invited to join {{inviterBusinessName}} on {{platformName}}",
    html: `
      <p>Hi there,</p>
      <p><strong>{{inviterBusinessName}}</strong> has invited you to join their team on {{platformName}} as a <strong style="color:#7C5CFC;">{{roleLabel}}</strong>.</p>
      <p>Click the button below to accept the invitation and set up your account. It takes less than a minute.</p>
      <a href="{{acceptUrl}}" class="btn">Accept invitation →</a>
      <p style="font-size:13px;color:#666;">This invitation expires in <strong style="color:#E2E2E8;">7 days</strong>. If you already have a {{platformName}} account, just log in on the next page — you'll be linked automatically.</p>
      <div class="box">
        <p style="margin:0;font-size:12px;color:#666;">If the button doesn't work, copy and paste this link:</p>
        <code>{{acceptUrl}}</code>
      </div>
      <p style="font-size:12px;color:#555;">If you weren't expecting this invitation, you can safely ignore this email.</p>
    `,
    text: `{{inviterBusinessName}} has invited you to join their team on {{platformName}} as a {{roleLabel}}.\n\nAccept the invitation here (expires in 7 days):\n{{acceptUrl}}\n\nIf you already have an account, just log in on the next page.\n\nIf you weren't expecting this, you can ignore this email.`,
  },

  postcore_briefing: {
    subject: 'Your weekly PostCore briefing',
    html: `
      <p style="font-size:16px;font-weight:600;color:#E2E2E8;">{{greeting}}</p>
      <p>{{weekSummary}}</p>
      <div class="box">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#7C5CFC;text-transform:uppercase;letter-spacing:0.05em;">What's Working</p>
        <p style="margin:0;font-size:14px;color:#E2E2E8;">{{whatWorking}}</p>
      </div>
      <div class="box">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#EAB308;text-transform:uppercase;letter-spacing:0.05em;">This Week's Opportunity</p>
        <p style="margin:0;font-size:14px;color:#E2E2E8;">{{opportunity}}</p>
      </div>
      <p style="font-size:13px;color:#666;font-style:italic;">{{closingNote}}</p>
      <a href="{{dashboardUrl}}" class="btn">Open Dashboard</a>
    `,
    text: `{{greeting}}\n\n{{weekSummary}}\n\nWhat's Working:\n{{whatWorking}}\n\nThis Week's Opportunity:\n{{opportunity}}\n\n{{closingNote}}\n\nDashboard: {{dashboardUrl}}`,
  },
};

module.exports = EmailService;
