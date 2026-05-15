'use strict';

const axios = require('axios');

class MailgunService {
  constructor(apiKey, domain, fromEmail) {
    this.apiKey = apiKey;
    this.domain = domain;
    this.from = fromEmail || `AI Receptionist <noreply@${domain}>`;
    this.base = `https://api.mailgun.net/v3/${domain}`;
  }

  async sendEmail(to, subject, text) {
    const params = new URLSearchParams({ from: this.from, to, subject, text });
    await axios.post(`${this.base}/messages`, params.toString(), {
      auth: { username: 'api', password: this.apiKey },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  normaliseInbound(body) {
    return {
      from: body.sender || body.from || '',
      to: body.recipient || '',
      subject: body.subject || '(no subject)',
      text: (body['body-stripped'] || body['body-plain'] || '').trim(),
      messageId: body['Message-Id'] || body['message-id'] || '',
    };
  }
}

module.exports = MailgunService;
