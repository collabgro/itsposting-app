/**
 * AgencyEmailService — sends emails via an agency's own email provider.
 * Supports: Mailgun, Resend, SMTP (nodemailer).
 * Falls back to the platform EmailService if no agency config is found.
 */

const crypto = require('crypto');
const EmailService = require('./EmailService');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32-byte hex string
const ALGO           = 'aes-256-gcm';

function encrypt(text) {
  if (!ENCRYPTION_KEY) return text; // no-op if key not configured
  const key  = Buffer.from(ENCRYPTION_KEY, 'hex');
  const iv   = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc    = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return [iv.toString('hex'), enc.toString('hex'), tag.toString('hex')].join(':');
}

function decrypt(raw) {
  if (!ENCRYPTION_KEY) return raw;
  try {
    const [ivHex, encHex, tagHex] = raw.split(':');
    const key     = Buffer.from(ENCRYPTION_KEY, 'hex');
    const iv      = Buffer.from(ivHex, 'hex');
    const enc     = Buffer.from(encHex, 'hex');
    const tag     = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch { return raw; }
}

module.exports.encrypt = encrypt;
module.exports.decrypt = decrypt;

/**
 * Send an email using an agency's custom provider config.
 * Falls back to platform EmailService if agencyConfig is null/empty.
 *
 * @param {object} agencyConfig  - fields from white_label_config.email*
 * @param {object} mail          - { to, subject, html, text }
 */
module.exports.sendViaAgencyProvider = async function sendViaAgencyProvider(agencyConfig, mail) {
  const platformEmail = new EmailService();

  if (!agencyConfig?.emailProvider) {
    return platformEmail.send(mail);
  }

  const { emailProvider, emailApiKey, emailDomain, emailFrom, emailFromName, smtpHost, smtpPort, smtpUser, smtpPass } = agencyConfig;
  const apiKey = emailApiKey ? decrypt(emailApiKey) : null;

  const from = emailFrom || 'noreply@itsposting.com';
  const fromName = emailFromName || 'ItsPosting';

  switch (emailProvider) {
    case 'mailgun': {
      if (!apiKey || !emailDomain) throw new Error('Mailgun: apiKey and emailDomain required');
      const FormData = require('form-data');
      const axios    = require('axios');
      const form = new FormData();
      form.append('from', `${fromName} <${from}>`);
      form.append('to',   mail.to);
      form.append('subject', mail.subject);
      if (mail.html) form.append('html', mail.html);
      if (mail.text) form.append('text', mail.text);
      const apiBase = emailDomain.includes('.eu') ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net';
      const r = await axios.post(`${apiBase}/v3/${emailDomain}/messages`, form, {
        auth: { username: 'api', password: apiKey },
        headers: form.getHeaders(),
        timeout: 15000,
      });
      return r.data;
    }

    case 'resend': {
      if (!apiKey) throw new Error('Resend: apiKey required');
      const axios = require('axios');
      const r = await axios.post('https://api.resend.com/emails', {
        from: `${fromName} <${from}>`,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }, {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      });
      return r.data;
    }

    case 'smtp': {
      if (!smtpHost) throw new Error('SMTP: smtpHost required');
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort || 587),
        secure: parseInt(smtpPort || 587) === 465,
        auth: smtpUser ? { user: smtpUser, pass: smtpPass ? decrypt(smtpPass) : '' } : undefined,
        tls: { rejectUnauthorized: false },
      });
      return transporter.sendMail({ from: `${fromName} <${from}>`, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text });
    }

    default:
      return platformEmail.send(mail);
  }
};

/**
 * Test agency email config by sending a test email to the given address.
 */
module.exports.testAgencyEmail = async function testAgencyEmail(agencyConfig, toEmail) {
  return module.exports.sendViaAgencyProvider(agencyConfig, {
    to:      toEmail,
    subject: `Test email from ${agencyConfig.emailFromName || 'your agency'}`,
    html:    `<p>Your email configuration is working correctly. Emails to your clients will be sent from <strong>${agencyConfig.emailFrom || 'your configured address'}</strong>.</p>`,
    text:    `Your email configuration is working correctly.`,
  });
};
