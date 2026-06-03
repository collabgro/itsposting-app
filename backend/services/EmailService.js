/**
 * EmailService — provider-agnostic transactional email service.
 *
 * Provider auto-detected from env:
 *   RESEND_API_KEY → Resend (preferred)
 *   SENDGRID_API_KEY → SendGrid
 *   SMTP_HOST → SMTP / nodemailer
 *   None → LOG-ONLY mode
 */

function resolveProvider() {
  if (process.env.EMAIL_PROVIDER) return process.env.EMAIL_PROVIDER;
  if (process.env.RESEND_API_KEY)   return 'resend';
  if (process.env.SENDGRID_API_KEY) return 'sendgrid';
  if (process.env.SMTP_HOST)        return 'smtp';
  return 'log';
}

const PROVIDER   = resolveProvider();
const FROM_NAME  = process.env.EMAIL_FROM_NAME    || 'ItsPosting';
const FROM_EMAIL = process.env.EMAIL_FROM_ADDRESS || 'noreply@itsposting.com';
const APP_URL    = process.env.FRONTEND_URL        || 'https://app.itsposting.com';

// ─── Design helpers (evaluated at module load; {{vars}} interpolated at send time) ──

/** Centered pill CTA button — table-based + inline styles (Outlook-safe) */
function btn(url, label) {
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation" style="margin:28px 0 8px;border-collapse:collapse;"><tr><td align="center"><a href="${url}" style="display:inline-block;padding:14px 32px;background:#7C5CFC;color:#ffffff;text-decoration:none;border-radius:100px;font-size:15px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;letter-spacing:-0.01em;">${label}</a></td></tr></table>`;
}

/** Ghost (outlined) secondary button */
function btnGhost(url, label) {
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation" style="margin:8px 0;border-collapse:collapse;"><tr><td align="center"><a href="${url}" style="display:inline-block;padding:11px 28px;background:transparent;color:#6B7280;text-decoration:none;border-radius:100px;border:1px solid #EDE9FE;font-size:13px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${label}</a></td></tr></table>`;
}

/** Light data box with optional accent color */
function box(content, { bg = '#F9F8FF', border = '#EDE9FE', radius = '10px', padding = '20px 22px' } = {}) {
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation" style="margin:16px 0;border-collapse:collapse;"><tr><td style="background:${bg};border:1px solid ${border};border-radius:${radius};padding:${padding};">${content}</td></tr></table>`;
}

/** Two-column label/value row — stacks inside a box */
function row(label, value, valueStyle = '', first = false) {
  const t = first ? '' : 'border-top:1px solid #EDE9FE;';
  const ff = `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;`;
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation" style="border-collapse:collapse;"><tr>
    <td style="${ff}font-size:13px;color:#6B7280;padding:9px 0;${t}">${label}</td>
    <td style="${ff}text-align:right;font-size:14px;font-weight:600;color:#111827;padding:9px 0;${t}${valueStyle}">${value}</td>
  </tr></table>`;
}

/** Centered large number hero — for credits / balances */
function bigNum(value, label, color = '#7C5CFC') {
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation" style="margin:20px 0;border-collapse:collapse;"><tr><td align="center" style="background:#F9F8FF;border:1px solid #EDE9FE;border-radius:14px;padding:32px 24px;">
    <span style="display:block;font-size:56px;font-weight:900;color:${color};font-family:'Courier New',Courier,monospace;line-height:1;letter-spacing:-0.02em;">${value}</span>
    <span style="display:block;margin-top:10px;font-size:13px;color:#6B7280;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${label}</span>
  </td></tr></table>`;
}

/** Colored status badge pill */
function badge(text, type = 'success') {
  const C = { success:{bg:'#D1FAE5',fg:'#059669'}, warning:{bg:'#FEF3C7',fg:'#D97706'}, error:{bg:'#FEE2E2',fg:'#DC2626'}, info:{bg:'#EDE9FE',fg:'#7C5CFC'}, neutral:{bg:'#F3F4F6',fg:'#6B7280'} };
  const c = C[type] || C.info;
  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;margin-bottom:20px;"><tr><td style="background:${c.bg};border-radius:100px;padding:7px 18px;font-size:13px;font-weight:700;color:${c.fg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;white-space:nowrap;">${text}</td></tr></table>`;
}

/** Purple left-border callout for highlighted messages */
function callout(content, borderColor = '#7C5CFC', bg = '#F9F8FF') {
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation" style="margin:16px 0;border-collapse:collapse;"><tr><td style="border-left:4px solid ${borderColor};background:${bg};border-radius:0 8px 8px 0;padding:14px 18px;">${content}</td></tr></table>`;
}

/** Horizontal rule divider */
function hr() {
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation" style="margin:28px 0;border-collapse:collapse;"><tr><td style="height:1px;background:#EDE9FE;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}

/** Side-by-side plan comparison (Current → New) */
function planCompare(currentPlan, newPlan) {
  const ff = `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;`;
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation" style="margin:20px 0;background:#F9F8FF;border-radius:10px;border:1px solid #EDE9FE;border-collapse:collapse;"><tr>
    <td style="padding:22px 20px;text-align:center;width:42%;">
      <span style="${ff}display:block;font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">Current plan</span>
      <span style="${ff}display:block;font-size:19px;font-weight:800;color:#111827;">${currentPlan}</span>
    </td>
    <td style="${ff}text-align:center;font-size:22px;color:#C4B5FD;width:16%;">&#8594;</td>
    <td style="padding:22px 20px;text-align:center;border-left:1px solid #EDE9FE;width:42%;">
      <span style="${ff}display:block;font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">New plan</span>
      <span style="${ff}display:block;font-size:19px;font-weight:800;color:#D97706;">${newPlan}</span>
    </td>
  </tr></table>`;
}

/** Paragraph shorthand (avoids repetition in templates) */
function p(text, style = '') {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:#374151;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;${style}">${text}</p>`;
}

/** Muted small note */
function note(text) {
  return `<p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#6B7280;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${text}</p>`;
}

/** Tiny caption — for legal-ish notes at bottom */
function caption(text) {
  return `<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#9CA3AF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${text}</p>`;
}

// ─── Deliverability helpers ───────────────────────────────────────────────────

/**
 * HMAC token for unsubscribe URLs — prevents enumeration attacks.
 * Uses JWT_SECRET so the token is server-specific and rotates with the secret.
 */
function _unsubToken(email) {
  const crypto = require('crypto');
  const secret = process.env.JWT_SECRET || 'itsposting-unsub-fallback';
  return crypto.createHmac('sha256', secret).update(email.toLowerCase().trim()).digest('hex').slice(0, 24);
}

/**
 * Inbox preview text — shown after the subject line in Gmail/Apple Mail/Outlook.
 * Keeps the content relevant so emails don't look like bulk mail in inbox lists.
 * {{vars}} are interpolated at render time, same as subject/body.
 */
const PREHEADERS = {
  login_otp:                   '{{code}} is your sign-in code — expires in 10 minutes.',
  password_reset:              'Your password reset link is ready. Valid for 1 hour.',
  password_reset_admin:        'An administrator just reset your ItsPosting account password.',
  account_suspended:           'Your account has been temporarily paused — here\'s why.',
  account_reactivated:         'Welcome back — your account is fully active again.',
  credits_adjusted:            'Your credit balance has been updated to {{newBalance}} credits.',
  payment_confirmed:           '{{planName}} is active. Your {{credits}} credits are loaded and ready.',
  upgrade_applied:             'You\'re now on {{planName}} — {{credits}} credits per month from here.',
  downgrade_scheduled:         'Plan change confirmed — switching to {{newPlanName}} on {{effectiveDate}}.',
  downgrade_checkout:          'Your {{currentPlanName}} period ended — continue in one tap.',
  credit_pack_purchased:       '+{{amount}} credits added. New balance: {{newBalance}} credits.',
  subscription_cancelled:      'Confirmed — no further charges. Access continues until {{accessUntil}}.',
  welcome:                     'You have {{credits}} free credits and a first post ready to create in 47 seconds.',
  post_published:              'Your post is live on {{platform}} — track reach and engagement here.',
  workspace_invite:            '{{inviterBusinessName}} wants you on their ItsPosting team.',
  postcore_briefing:           'Your weekly PostCore briefing is ready — what\'s working this week.',
  referral_released:           '+{{credits}} credits added — your referral upgraded to a paid plan.',
  referral_rejected:           'About your recent referral reward — a note from our team.',
  service_request_received:    'Our team has your request and will update you within 24 hours.',
  service_request_admin_alert: '{{businessName}} submitted a {{requestLabel}} — review needed.',
  service_request_resolved:    'Done — your {{requestLabel}} has been processed and is live.',
  service_request_rejected:    'About your {{requestLabel}} — a note from our team.',
  service_request_message:     'The ItsPosting team has a note for you about your account.',
};

// ─── EmailService class ───────────────────────────────────────────────────────

class EmailService {
  constructor() {
    this.provider = PROVIDER;
    console.log(`[EmailService] Initialised in ${PROVIDER === 'log' ? 'LOG-ONLY (no emails sent)' : PROVIDER} mode`);
  }

  async send({ to, subject, html, text, fromName }) {
    if (!to || !subject) throw new Error('to and subject are required');
    // List-Unsubscribe + List-Unsubscribe-Post headers are required by Gmail and Yahoo
    // for all bulk senders (mandatory since Feb 2024). Including them on transactional
    // emails too — it doesn't hurt and keeps SPF/DKIM reputation clean.
    const unsubUrl = `${APP_URL}/api/email/unsubscribe?email=${encodeURIComponent(to)}&t=${_unsubToken(to)}`;
    const headers = {
      'List-Unsubscribe':      `<${unsubUrl}>, <mailto:${FROM_EMAIL}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
    const payload = { from: `${fromName || FROM_NAME} <${FROM_EMAIL}>`, to, subject, html, text, headers };
    switch (this.provider) {
      case 'sendgrid': return this._sendViaSendGrid(payload);
      case 'resend':   return this._sendViaResend(payload);
      case 'smtp':     return this._sendViaSmtp(payload);
      default:         return this._logEmail(payload);
    }
  }

  renderTemplate(templateName, data = {}, { platformName } = {}) {
    const tpl = TEMPLATES[templateName];
    if (!tpl) throw new Error(`Unknown email template: ${templateName}`);
    const mergedData = { platformName: platformName || FROM_NAME, ...data };
    const preheader  = PREHEADERS[templateName]
      ? this._interpolate(PREHEADERS[templateName], mergedData)
      : '';
    return {
      subject: this._interpolate(tpl.subject, mergedData),
      html:    this._wrapHtml(this._interpolate(tpl.html, mergedData), tpl.subject, platformName, preheader),
      text:    this._interpolate(tpl.text, mergedData),
    };
  }

  _interpolate(str, data) {
    str = str.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, content) => data[key] ? content : '');
    return str.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '');
  }

  _wrapHtml(body, title, platformName, preheader = '') {
    const brand   = platformName || FROM_NAME;
    const logoUrl = `${APP_URL}/fav-icon.png`;
    const year    = new Date().getFullYear();

    // Preheader: hidden text shown as inbox preview after the subject line.
    // The &zwnj; padding prevents the actual email body from bleeding into the preview.
    const preheaderHtml = preheader ? `
<!--[if !gte mso 9]><!--><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;visibility:hidden;opacity:0;font-size:1px;color:#F5F3FF;line-height:1px;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div><!--<![endif]-->` : '';

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
  <title>${title}</title>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
    img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none;}
    :root{color-scheme:light;}
    body{margin:0;padding:0;background:#F5F3FF;width:100% !important;min-width:100%;}
    .tag{display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;}
    .tag-error{background:#FEE2E2 !important;color:#DC2626 !important;}
    .tag-success{background:#D1FAE5 !important;color:#059669 !important;}
    .tag-warning{background:#FEF3C7 !important;color:#D97706 !important;}
    @media screen and (max-width:600px){
      .email-card{width:100% !important;max-width:100% !important;}
      .email-body{padding:24px 20px !important;}
      .email-footer{padding:18px 20px !important;}
      .logo-cell{padding-bottom:12px !important;}
    }
    @media (prefers-color-scheme:dark){
      body{background-color:#F5F3FF !important;}
      .email-outer-bg{background-color:#F5F3FF !important;}
      .email-card-white{background-color:#FFFFFF !important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F5F3FF;width:100%;">
${preheaderHtml}
<!--[if mso | IE]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F3FF;"><tr><td><![endif]-->
<table role="presentation" class="email-outer-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F3FF;width:100%;border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <!-- Logo above card -->
      <table role="presentation" class="email-card" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;border-collapse:collapse;">
        <tr>
          <td class="logo-cell" align="center" style="padding-bottom:18px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td style="vertical-align:middle;padding-right:10px;">
                  <img src="${logoUrl}" alt="${brand}" width="36" height="36" style="display:block;width:36px;height:36px;border-radius:8px;" />
                </td>
                <td style="vertical-align:middle;">
                  <span style="font-size:17px;font-weight:700;color:#111827;letter-spacing:-0.02em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${brand}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- White card -->
      <table role="presentation" class="email-card email-card-white" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:12px;border:1px solid #EDE9FE;border-collapse:collapse;">
        <tr>
          <td class="email-body" style="padding:36px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75;color:#374151;">
            ${body}
          </td>
        </tr>
        <tr>
          <td class="email-footer" align="center" style="padding:20px 32px;background:#1E1B4B;border-radius:0 0 12px 12px;">
            <p style="margin:0;font-size:12px;color:#A5B4FC;line-height:1.8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
              You received this email because of activity on your ${brand} account.<br />
              <a href="${APP_URL}/settings" style="color:#C4B5FD;text-decoration:none;">Manage preferences</a>
              &nbsp;&middot;&nbsp; &copy; ${year} ${brand}
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

  async _sendViaSendGrid({ from, to, subject, html, text, headers }) {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const result = await sgMail.send({ from, to, subject, html, text, headers });
    return { success: true, provider: 'sendgrid', statusCode: result[0].statusCode };
  }

  async _sendViaResend({ from, to, subject, html, text, headers }) {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({ from, to, subject, html, text, headers });
    if (error) throw new Error(`Resend: ${error.message || JSON.stringify(error)}`);
    return { success: true, provider: 'resend', id: data?.id };
  }

  async _sendViaSmtp({ from, to, subject, html, text, headers }) {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const result = await transporter.sendMail({ from, to, subject, html, text, headers });
    return { success: true, provider: 'smtp', messageId: result.messageId };
  }
}

// ─── Templates — designed + written to be beautiful AND human ────────────────

const TEMPLATES = {

  // ── Security ────────────────────────────────────────────────────────────────

  login_otp: {
    subject: 'Your sign-in code: {{code}}',
    html: `
      ${p('Hi <strong style="color:#111827;">{{businessName}}</strong>,')}
      ${p('Here\'s your one-time sign-in code for <strong style="color:#111827;">{{platformName}}</strong>. Enter it now — it expires in 10 minutes.')}
      <table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation" style="margin:8px 0 24px;border-collapse:collapse;">
        <tr><td align="center">
          <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
            <tr>
              <td style="background:#F5F3FF;border:2px solid #7C5CFC;border-radius:16px;padding:28px 56px;text-align:center;">
                <span style="display:block;font-size:54px;font-weight:900;color:#7C5CFC;font-family:'Courier New',Courier,monospace;letter-spacing:0.22em;line-height:1;">{{code}}</span>
                <span style="display:block;margin-top:14px;font-size:12px;color:#9CA3AF;font-family:-apple-system,sans-serif;letter-spacing:0.02em;">Expires in 10 minutes &nbsp;&middot;&nbsp; Never share this</span>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
      ${callout(`<p style="margin:0;font-size:13px;color:#374151;line-height:1.6;font-family:-apple-system,sans-serif;">Didn't try to sign in? Someone may have your password. <strong style="color:#DC2626;">Change it immediately</strong> — don't wait.</p>`, '#DC2626', '#FFF5F5')}
    `,
    text: `Your {{platformName}} sign-in code: {{code}}\n\nExpires in 10 minutes. Never share this code.\n\nIf you didn't request this, change your password immediately.`,
  },

  password_reset: {
    subject: 'Reset your ItsPosting password',
    html: `
      ${p('Hi there,')}
      ${p('Someone (hopefully you) asked to reset your ItsPosting password. Click the button to pick a new one — this link is good for <strong style="color:#111827;">1 hour</strong>, then it expires for your security.')}
      ${btn('{{resetUrl}}', 'Reset my password →')}
      ${hr()}
      ${note('Didn\'t ask for this? Just ignore it — your password is unchanged and your account is safe.')}
      ${box(`<p style="margin:0 0 6px;font-size:12px;color:#9CA3AF;font-family:-apple-system,sans-serif;">Button not working? Copy and paste this link:</p>
              <p style="margin:0;font-size:12px;color:#7C5CFC;font-family:'Courier New',Courier,monospace;word-break:break-all;">{{resetUrl}}</p>`)}
    `,
    text: `Reset your ItsPosting password (expires in 1 hour):\n{{resetUrl}}\n\nDidn't ask for this? Ignore it — your password is unchanged.`,
  },

  password_reset_admin: {
    subject: 'Your ItsPosting password was just reset',
    html: `
      ${badge('Password Reset by Administrator', 'warning')}
      ${p('Hi <strong style="color:#111827;">{{businessName}}</strong>,')}
      ${p('An administrator just reset your ItsPosting account password. Here\'s what to do next:')}
      ${box(`<table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation" style="border-collapse:collapse;">
        <tr><td style="padding:12px 0;border-bottom:1px solid #EDE9FE;font-size:14px;font-family:-apple-system,sans-serif;">
          <strong style="color:#059669;">&#10003;&nbsp; If you expected this</strong>
          <span style="display:block;color:#6B7280;font-size:13px;margin-top:4px;">All good — use the button below to log in with your new credentials.</span>
        </td></tr>
        <tr><td style="padding:12px 0;font-size:14px;font-family:-apple-system,sans-serif;">
          <strong style="color:#DC2626;">&#10005;&nbsp; If you didn't expect this</strong>
          <span style="display:block;color:#6B7280;font-size:13px;margin-top:4px;">Reply to this email right now and we'll investigate immediately.</span>
        </td></tr>
      </table>`)}
      ${btn('{{loginUrl}}', 'Log in to ItsPosting →')}
    `,
    text: `Hi {{businessName}},\n\nAn administrator reset your ItsPosting password.\n\nExpected this? Log in at: {{loginUrl}}\n\nDidn't expect this? Reply to this email immediately.`,
  },

  // ── Account status ──────────────────────────────────────────────────────────

  account_suspended: {
    subject: 'Your ItsPosting account has been paused',
    html: `
      ${badge('Account Paused', 'error')}
      ${p('Hi <strong style="color:#111827;">{{businessName}}</strong>,')}
      ${p('Your ItsPosting account has been temporarily paused. Content creation and posting are on hold until this is resolved.')}
      {{#if reason}}
      ${callout(`<p style="margin:0 0 5px;font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;font-family:-apple-system,sans-serif;">Reason</p>
                 <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;font-family:-apple-system,sans-serif;">{{reason}}</p>`, '#DC2626', '#FFF5F5')}
      {{/if}}
      ${hr()}
      ${p('Think this is a mistake? Reply to this email and we\'ll look into it today. We\'re real people and we respond fast.')}
    `,
    text: `Hi {{businessName}},\n\nYour ItsPosting account has been paused.\n\nReason: {{reason}}\n\nIf you believe this is a mistake, reply to this email.`,
  },

  account_reactivated: {
    subject: "You're back — ItsPosting account reactivated",
    html: `
      ${badge('&#10003; Account Active', 'success')}
      ${p('Hi <strong style="color:#111827;">{{businessName}}</strong>,')}
      ${p('Your ItsPosting account is back up and running. Everything is exactly as you left it — your posts, settings, and credits are all there.')}
      ${btn('{{loginUrl}}', 'Log back in →')}
      ${note('Questions about what happened? Just reply to this email — happy to walk you through it.')}
    `,
    text: `Hi {{businessName}},\n\nYour ItsPosting account has been reactivated. Everything is back to normal.\n\nLog in at: {{loginUrl}}\n\nWelcome back!`,
  },

  // ── Credits ─────────────────────────────────────────────────────────────────

  credits_adjusted: {
    subject: 'Your credit balance was updated — {{newBalance}} credits now',
    html: `
      ${p('Hi <strong style="color:#111827;">{{businessName}}</strong>,')}
      ${p('A credit adjustment was just made to your ItsPosting account. Here\'s the breakdown:')}
      ${bigNum('{{newBalance}}', 'credits — your new balance')}
      ${box(`
        ${row('Adjustment made', '<span style="font-family:\'Courier New\',monospace;font-weight:700;color:{{amountColor}};">{{amountLabel}}</span>', '', true)}
        {{#if reason}}${row('Reason', '{{reason}}')}{{/if}}
      `)}
      ${caption('Each photo post costs 3 credits. Carousels are 5. Videos are 10. Make them count.')}
    `,
    text: `Hi {{businessName}},\n\nYour credit balance was adjusted by {{amountLabel}}. New balance: {{newBalance}} credits.\n\nReason: {{reason}}`,
  },

  // ── Billing ─────────────────────────────────────────────────────────────────

  payment_confirmed: {
    subject: 'Payment confirmed — {{planName}} is live on your account',
    html: `
      ${badge('&#10003; Payment Successful', 'success')}
      ${p('Hi <strong style="color:#111827;">{{businessName}}</strong>,')}
      ${p('It\'s official. <strong style="color:#7C5CFC;">{{planName}}</strong> is active and your credits are loaded. Time to put them to work.')}
      ${box(`
        ${row('Plan', '<strong style="color:#111827;">{{planName}}</strong>', '', true)}
        ${row('Credits added', '<span style="font-size:16px;font-weight:800;color:#7C5CFC;font-family:\'Courier New\',monospace;">{{credits}} credits</span>')}
        ${row('Status', '<span style="background:#D1FAE5;border-radius:100px;padding:3px 12px;font-size:12px;font-weight:700;color:#059669;">Active</span>')}
      `)}
      ${btn('{{loginUrl}}', 'Start creating →')}
      ${caption('Questions? Reply to this email — we\'re real people and we respond same day.')}
    `,
    text: `Hi {{businessName}},\n\nPayment confirmed! Your {{planName}} plan is active with {{credits}} credits.\n\nLog in at: {{loginUrl}}\n\nQuestions? Reply to this email.`,
  },

  upgrade_applied: {
    subject: "Upgraded to {{planName}} — your extra credits are already in",
    html: `
      ${badge('&#8593; Plan Upgraded', 'info')}
      ${p('Hi <strong style="color:#111827;">{{businessName}}</strong>,')}
      ${p('Your account is now on <strong style="color:#7C5CFC;">{{planName}}</strong>. We\'ve already added prorated credits for your remaining billing cycle — no waiting, no proration headache.')}
      ${box(`
        ${row('New plan', '<strong style="color:#111827;">{{planName}}</strong>', '', true)}
        ${row('Monthly credits', '<span style="font-size:16px;font-weight:800;color:#7C5CFC;font-family:\'Courier New\',monospace;">{{credits}}/mo</span>')}
        {{#if creditsDelta}}${row('Added right now', '<span style="font-weight:700;color:#059669;font-family:\'Courier New\',monospace;">+{{creditsDelta}} credits</span>')}{{/if}}
        ${row('Billing', '{{cycle}}')}
      `)}
      ${btn('{{loginUrl}}', 'Go create something →')}
      ${caption('Questions? Reply to this email — we respond same day.')}
    `,
    text: `Hi {{businessName}},\n\nUpgraded to {{planName}}!\n\nMonthly credits: {{credits}}/mo\nCredits added instantly: +{{creditsDelta}}\nBilling: {{cycle}}\n\nLog in: {{loginUrl}}`,
  },

  downgrade_scheduled: {
    subject: 'Noted — switching to {{newPlanName}} on {{effectiveDate}}',
    html: `
      ${p('Hi <strong style="color:#111827;">{{businessName}}</strong>,')}
      ${p('Your plan change is locked in. Here\'s exactly what happens:')}
      ${planCompare('{{currentPlanName}}', '{{newPlanName}}')}
      ${box(`
        ${row('Switches on', '<strong style="color:#111827;">{{effectiveDate}}</strong>', '', true)}
        ${row('New monthly credits', '{{newPlanCredits}} credits/mo')}
        ${row('Until then', '<span style="color:#059669;font-weight:600;">Full access — keep posting</span>')}
      `)}
      ${p('Keep using everything you have today. Nothing changes until <strong style="color:#111827;">{{effectiveDate}}</strong>, and your next charge will automatically be at the new lower price.')}
      ${callout(`<p style="margin:0;font-size:13px;color:#374151;line-height:1.6;font-family:-apple-system,sans-serif;">Changed your mind? Go to billing settings and click <strong style="color:#111827;">"Keep current plan"</strong> before {{effectiveDate}} — no penalty, no friction.</p>`)}
      ${btnGhost('{{billingUrl}}', 'View billing settings')}
    `,
    text: `Hi {{businessName}},\n\nSwitching from {{currentPlanName}} to {{newPlanName}} on {{effectiveDate}}.\n\nYou have full access until then. Changed your mind? Visit: {{billingUrl}}`,
  },

  downgrade_checkout: {
    subject: "Your {{currentPlanName}} period ended — pick up where you left off",
    html: `
      ${badge('Billing period ended', 'neutral')}
      ${p('Hi <strong style="color:#111827;">{{businessName}}</strong>,')}
      ${p('Your <strong style="color:#111827;">{{currentPlanName}}</strong> billing period just ended. Your <strong style="color:#7C5CFC;">{{newPlanName}}</strong> subscription is ready and waiting — subscribe in under 30 seconds and your credits load instantly.')}
      ${box(`
        ${row('Plan', '<span style="color:#7C5CFC;font-weight:700;">{{newPlanName}}</span>', '', true)}
        ${row('Monthly credits', '{{newPlanCredits}} credits/mo')}
        ${row('Billing', '{{cycle}}')}
      `)}
      ${btn('{{checkoutUrl}}', 'Continue with {{newPlanName}} →')}
      ${caption('This link is personalised for your account. Have a question? Just reply to this email.')}
    `,
    text: `Hi {{businessName}},\n\nYour {{currentPlanName}} period ended. Continue with {{newPlanName}} ({{newPlanCredits}} credits/mo):\n\n{{checkoutUrl}}`,
  },

  credit_pack_purchased: {
    subject: '+{{amount}} credits just landed in your ItsPosting account',
    html: `
      ${p('Hi <strong style="color:#111827;">{{businessName}}</strong>,')}
      ${p('Purchase confirmed. Your credits are in and ready to use right now — no delays.')}
      ${bigNum('+{{amount}}', 'credits added to your account', '#059669')}
      ${box(`${row('New balance', '<span style="font-size:17px;font-weight:800;color:#7C5CFC;font-family:\'Courier New\',monospace;">{{newBalance}} credits</span>', '', true)}`)}
      <table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation" style="margin:16px 0 20px;border-collapse:collapse;">
        <tr><td style="padding:7px 0;border-bottom:1px solid #EDE9FE;font-size:14px;color:#374151;font-family:-apple-system,sans-serif;"><span style="color:#7C5CFC;font-weight:700;margin-right:8px;">&#8594;</span> Photo post &nbsp;&mdash;&nbsp; 3 credits</td></tr>
        <tr><td style="padding:7px 0;border-bottom:1px solid #EDE9FE;font-size:14px;color:#374151;font-family:-apple-system,sans-serif;"><span style="color:#7C5CFC;font-weight:700;margin-right:8px;">&#8594;</span> Carousel &nbsp;&mdash;&nbsp; 5 credits</td></tr>
        <tr><td style="padding:7px 0;font-size:14px;color:#374151;font-family:-apple-system,sans-serif;"><span style="color:#7C5CFC;font-weight:700;margin-right:8px;">&#8594;</span> Video &nbsp;&mdash;&nbsp; 10 credits</td></tr>
      </table>
      ${btn('{{loginUrl}}', 'Start creating →')}
      ${caption('Purchase question? Reply to this email and we\'ll sort it out.')}
    `,
    text: `Hi {{businessName}},\n\n+{{amount}} credits added. New balance: {{newBalance}} credits.\n\nStart creating: {{loginUrl}}`,
  },

  subscription_cancelled: {
    subject: 'Subscription cancelled — no further charges from ItsPosting',
    html: `
      ${badge('Cancellation Confirmed', 'warning')}
      ${p('Hi <strong style="color:#111827;">{{businessName}}</strong>,')}
      ${p('Your <strong style="color:#111827;">{{planName}}</strong> subscription has been cancelled. No hard feelings — here\'s what you still have:')}
      ${box(`
        ${row('Full access until', '<strong style="color:#D97706;">{{accessUntil}}</strong>', '', true)}
        ${row('Further charges', '<span style="color:#059669;font-weight:700;">None</span>')}
        ${row('Your content & history', '<span style="color:#059669;font-weight:700;">Always kept — forever</span>')}
      `)}
      ${p('Keep posting and using everything until <strong style="color:#111827;">{{accessUntil}}</strong>. After that, your account moves to the free tier — but your posts and data are always there.')}
      ${callout(`<p style="margin:0;font-size:13px;color:#374151;line-height:1.6;font-family:-apple-system,sans-serif;">We\'d love to have you back whenever the time is right. One click in billing settings is all it takes — your history is always waiting.</p>`)}
      ${btnGhost('{{billingUrl}}', 'View billing settings')}
    `,
    text: `Hi {{businessName}},\n\nSubscription cancelled — no further charges. Full access until: {{accessUntil}}\n\nYour content is always kept. Come back any time: {{billingUrl}}`,
  },

  // ── Onboarding / Engagement ─────────────────────────────────────────────────

  welcome: {
    subject: 'Welcome to ItsPosting, {{businessName}} — your first post is one tap away',
    html: `
      ${p('Hi <strong style="color:#111827;">{{businessName}}</strong>,')}
      <p style="margin:0 0 24px;font-size:22px;font-weight:800;color:#111827;line-height:1.3;letter-spacing:-0.02em;font-family:-apple-system,sans-serif;">ItsPosting knows your business.<br />Your first post is one tap away.</p>
      ${bigNum('{{credits}}', 'free credits — no card required')}
      <table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation" style="margin:20px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 0;border-bottom:1px solid #EDE9FE;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation" style="border-collapse:collapse;"><tr>
            <td style="width:28px;vertical-align:top;padding-top:2px;"><span style="font-size:14px;color:#059669;font-weight:700;">&#10003;</span></td>
            <td style="font-size:14px;color:#374151;font-family:-apple-system,sans-serif;line-height:1.6;">Captions written for your industry — Facebook, Instagram, Google Business</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #EDE9FE;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation" style="border-collapse:collapse;"><tr>
            <td style="width:28px;vertical-align:top;padding-top:2px;"><span style="font-size:14px;color:#059669;font-weight:700;">&#10003;</span></td>
            <td style="font-size:14px;color:#374151;font-family:-apple-system,sans-serif;line-height:1.6;">AI images that look like they came from your job site</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #EDE9FE;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation" style="border-collapse:collapse;"><tr>
            <td style="width:28px;vertical-align:top;padding-top:2px;"><span style="font-size:14px;color:#059669;font-weight:700;">&#10003;</span></td>
            <td style="font-size:14px;color:#374151;font-family:-apple-system,sans-serif;line-height:1.6;">Photo posts, carousels, and video — all in one tap</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:8px 0;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation" style="border-collapse:collapse;"><tr>
            <td style="width:28px;vertical-align:top;padding-top:2px;"><span style="font-size:14px;color:#059669;font-weight:700;">&#10003;</span></td>
            <td style="font-size:14px;color:#374151;font-family:-apple-system,sans-serif;line-height:1.6;">Schedule everything — or post instantly — your call</td>
          </tr></table>
        </td></tr>
      </table>
      ${btn('{{loginUrl}}', 'Create my first post →')}
      ${caption('Average time from sign-in to first post: 47 seconds. We timed it.')}
    `,
    text: `Hi {{businessName}},\n\nWelcome to ItsPosting! You have {{credits}} free credits. Average time from sign-in to first post: 47 seconds.\n\nLog in at: {{loginUrl}}`,
  },

  post_published: {
    subject: "Your post is live on {{platform}}",
    html: `
      ${badge('&#10003; Published', 'success')}
      ${p('Hi <strong style="color:#111827;">{{businessName}}</strong>,')}
      ${p('It\'s out there. Your post is live on <strong style="color:#111827;">{{platform}}</strong> and reaching your local audience right now.')}
      ${callout(`<p style="margin:0;font-size:13px;color:#374151;line-height:1.6;font-family:-apple-system,sans-serif;"><strong style="color:#111827;">Quick tip:</strong> Reply to any comments in the first hour — it tells the algorithm this post deserves more reach. Local businesses that do this see 2–3× more impressions.</p>`)}
      ${btn('{{analyticsUrl}}', 'View performance →')}
      ${caption('ItsPosting AI tracks engagement over the next 24–48 hours and surfaces insights in your dashboard.')}
    `,
    text: `Hi {{businessName}},\n\nYour post is live on {{platform}}. View analytics at: {{analyticsUrl}}\n\nTip: Reply to comments in the first hour for more reach.`,
  },

  workspace_invite: {
    subject: "{{inviterBusinessName}} invited you to join their ItsPosting team",
    html: `
      ${p('Hi there,')}
      ${box(`<table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation" style="border-collapse:collapse;"><tr>
        <td style="padding:4px 0;font-size:15px;color:#374151;font-family:-apple-system,sans-serif;">
          <strong style="color:#111827;">{{inviterBusinessName}}</strong> has invited you to join their team on <strong style="color:#111827;">{{platformName}}</strong> as a
        </td>
      </tr><tr>
        <td style="padding:8px 0 4px;">
          <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;"><tr><td style="background:#EDE9FE;border-radius:100px;padding:6px 18px;font-size:14px;font-weight:700;color:#7C5CFC;font-family:-apple-system,sans-serif;">{{roleLabel}}</td></tr></table>
        </td>
      </tr></table>`, { bg:'#F9F8FF', border:'#EDE9FE', padding:'20px 22px' })}
      ${p('Click the button below to accept the invitation and set up your account. It takes less than a minute.')}
      ${btn('{{acceptUrl}}', 'Accept invitation →')}
      ${note('This invitation expires in <strong style="color:#111827;">7 days</strong>. If you already have a {{platformName}} account, just log in on the next page — you\'ll be linked automatically.')}
      ${box(`<p style="margin:0 0 6px;font-size:12px;color:#9CA3AF;font-family:-apple-system,sans-serif;">If the button doesn't work, copy and paste this link:</p>
              <p style="margin:0;font-size:12px;color:#7C5CFC;font-family:'Courier New',Courier,monospace;word-break:break-all;">{{acceptUrl}}</p>`)}
      ${caption('If you weren\'t expecting this invitation, you can safely ignore this email.')}
    `,
    text: `{{inviterBusinessName}} has invited you to join their team on {{platformName}} as {{roleLabel}}.\n\nAccept here (expires in 7 days):\n{{acceptUrl}}\n\nIf you weren't expecting this, ignore this email.`,
  },

  // ── PostCore ────────────────────────────────────────────────────────────────

  postcore_briefing: {
    subject: 'Your weekly briefing from PostCore',
    html: `
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.1em;font-family:-apple-system,sans-serif;">PostCore &middot; Weekly Briefing</p>
      <p style="margin:0 0 20px;font-size:22px;font-weight:800;color:#111827;line-height:1.3;letter-spacing:-0.02em;font-family:-apple-system,sans-serif;">{{greeting}}</p>
      ${p('{{weekSummary}}')}
      ${hr()}
      ${callout(`<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#7C5CFC;text-transform:uppercase;letter-spacing:0.08em;font-family:-apple-system,sans-serif;">What's Working</p>
                 <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;font-family:-apple-system,sans-serif;">{{whatWorking}}</p>`)}
      ${callout(`<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#D97706;text-transform:uppercase;letter-spacing:0.08em;font-family:-apple-system,sans-serif;">This Week's Opportunity</p>
                 <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;font-family:-apple-system,sans-serif;">{{opportunity}}</p>`, '#D97706', '#FFFBEB')}
      ${hr()}
      ${note('<em>{{closingNote}}</em>')}
      ${btn('{{dashboardUrl}}', 'Open dashboard →')}
    `,
    text: `{{greeting}}\n\n{{weekSummary}}\n\nWhat's Working:\n{{whatWorking}}\n\nThis Week's Opportunity:\n{{opportunity}}\n\n{{closingNote}}\n\nDashboard: {{dashboardUrl}}`,
  },

  // ── Referrals ───────────────────────────────────────────────────────────────

  referral_released: {
    subject: '+{{credits}} credits earned — your referral just upgraded',
    html: `
      ${p('Hi <strong style="color:#111827;">{{businessName}}</strong>,')}
      ${p('Nice work. Someone you referred just upgraded to a paid plan, and your reward has been added to your account automatically.')}
      ${bigNum('+{{credits}}', 'credits earned — just for referring a friend', '#059669')}
      ${box(`${row('New credit balance', '<span style="font-size:16px;font-weight:800;color:#7C5CFC;font-family:\'Courier New\',monospace;">{{newBalance}} credits</span>', '', true)}`)}
      ${p('There\'s no cap on how many businesses you can refer. Every paid upgrade earns you more credits — share your link and keep going.')}
      ${btn('{{referralUrl}}', 'View referral stats →')}
    `,
    text: `Hi {{businessName}},\n\nNice work! You earned +{{credits}} credits. New balance: {{newBalance}} credits.\n\nView referral stats: {{referralUrl}}`,
  },

  referral_rejected: {
    subject: 'About your referral reward',
    html: `
      ${p('Hi <strong style="color:#111827;">{{businessName}}</strong>,')}
      ${p('We reviewed a referral credit award on your account. After looking into it, we were unable to approve it this time.')}
      {{reasonBlock}}
      ${hr()}
      ${p('Think we got it wrong? Reply to this email with any context you have and we\'ll look again — we genuinely want to get this right.')}
      ${btnGhost('{{billingUrl}}', 'View referral stats')}
    `,
    text: `Hi {{businessName}},\n\nA referral credit award was reviewed and not approved.\n\n{{reasonText}}\n\nThink we got it wrong? Reply to this email.`,
  },

  // ── Service requests ────────────────────────────────────────────────────────

  service_request_received: {
    subject: "Got it — we're on your {{requestLabel}} request",
    html: `
      ${badge('&#10003; Request Received', 'info')}
      ${p('Hi <strong style="color:#111827;">{{businessName}}</strong>,')}
      ${p('We\'ve got your request and our team is already on it. Here\'s what we have on file:')}
      ${box(`
        ${row('Request', '<strong style="color:#111827;">{{requestLabel}}</strong>', '', true)}
        {{#if requestDetail}}${row('Details', '{{requestDetail}}')}{{/if}}
        ${row('You\'ll hear from us', '<span style="color:#059669;font-weight:600;">Within 24 hours</span>')}
      `)}
      ${note('Nothing else needed from you. We\'ll email as soon as it\'s processed.')}
    `,
    text: `Hi {{businessName}},\n\nGot it. We're on your {{requestLabel}} request and will respond within 24 hours.\n\nDetails: {{requestDetail}}`,
  },

  service_request_admin_alert: {
    subject: 'New service request — {{requestLabel}} from {{businessName}}',
    html: `
      ${badge('New Request Requires Review', 'warning')}
      ${box(`
        ${row('Customer', '<strong style="color:#111827;">{{businessName}}</strong>', '', true)}
        ${row('Email', '<span style="color:#7C5CFC;">{{customerEmail}}</span>')}
        ${row('Request type', '<strong style="color:#111827;">{{requestLabel}}</strong>')}
        ${row('Details', '{{requestDetail}}')}
      `)}
      {{#if customerMessage}}
      ${callout(`<p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#7C5CFC;text-transform:uppercase;letter-spacing:0.06em;font-family:-apple-system,sans-serif;">Customer note</p>
                 <p style="margin:0;font-size:13px;color:#374151;font-family:-apple-system,sans-serif;">{{customerMessage}}</p>`)}
      {{/if}}
      ${btn('{{adminUrl}}', 'Review in admin panel →')}
    `,
    text: `New service request:\n\nCustomer: {{businessName}} ({{customerEmail}})\nType: {{requestLabel}}\nDetails: {{requestDetail}}\nNote: {{customerMessage}}\n\nReview: {{adminUrl}}`,
  },

  service_request_resolved: {
    subject: "Done — your {{requestLabel}} request has been processed",
    html: `
      ${badge('&#10003; Done', 'success')}
      ${p('Hi <strong style="color:#111827;">{{businessName}}</strong>,')}
      ${p('Your request has been processed and the changes are live on your account.')}
      ${box(`
        ${row('Request', '<strong style="color:#111827;">{{requestLabel}}</strong>', '', true)}
        {{#if adminNotes}}${row('From our team', '{{adminNotes}}')}{{/if}}
      `)}
      ${btn('{{billingUrl}}', 'Check your account →')}
    `,
    text: `Hi {{businessName}},\n\nDone — your {{requestLabel}} request has been processed.\n\n{{adminNotes}}\n\nCheck your account: {{billingUrl}}`,
  },

  service_request_rejected: {
    subject: "About your {{requestLabel}} request",
    html: `
      ${p('Hi <strong style="color:#111827;">{{businessName}}</strong>,')}
      ${p('We looked at your request carefully and weren\'t able to process it this time.')}
      ${box(`
        ${row('Request', '<strong style="color:#111827;">{{requestLabel}}</strong>', '', true)}
        {{#if adminNotes}}${row('Reason', '{{adminNotes}}')}{{/if}}
      `)}
      ${p('Questions? Just reply to this email — we\'re humans who read every message and we\'re happy to talk it through.')}
      ${btnGhost('{{billingUrl}}', 'Contact support')}
    `,
    text: `Hi {{businessName}},\n\nWe couldn't process your {{requestLabel}} request.\n\nReason: {{adminNotes}}\n\nQuestions? Reply to this email.`,
  },

  service_request_message: {
    subject: 'A note from the ItsPosting team',
    html: `
      ${p('Hi <strong style="color:#111827;">{{businessName}}</strong>,')}
      ${p('Our team wanted to reach out about your account:')}
      ${callout(`<p style="margin:0;font-size:15px;color:#374151;line-height:1.75;font-family:-apple-system,sans-serif;">{{message}}</p>`)}
      ${note('Reply directly to this email and it goes straight to us — we respond the same day.')}
      ${btnGhost('{{billingUrl}}', 'View your account')}
    `,
    text: `Hi {{businessName}},\n\nA note from the ItsPosting team:\n\n{{message}}\n\nReply to this email to respond.`,
  },

};

module.exports = EmailService;
