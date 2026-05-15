/**
 * ItsPosting — Twilio SMS + WhatsApp Service
 * backend/services/TwilioService.js
 *
 * Each customer provides their own Twilio credentials.
 * Credentials are passed in the constructor — no server-wide env vars.
 */

const twilio = require('twilio');

class TwilioService {
  constructor({ accountSid, authToken, phoneNumber, whatsappNumber } = {}) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.phoneNumber = phoneNumber;
    this.whatsappNumber = whatsappNumber;

    if (accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
    }
  }

  isConfigured() {
    return !!(this.client && this.phoneNumber);
  }

  isWhatsAppConfigured() {
    return !!(this.client && this.whatsappNumber);
  }

  async sendSMS(to, body) {
    if (!this.isConfigured()) throw new Error('Twilio SMS not configured for this account');
    const message = await this.client.messages.create({
      body,
      from: this.phoneNumber,
      to,
    });
    return { sid: message.sid, status: message.status };
  }

  async sendWhatsApp(to, body) {
    if (!this.isWhatsAppConfigured()) throw new Error('Twilio WhatsApp not configured for this account');
    const toWA = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const fromWA = this.whatsappNumber.startsWith('whatsapp:') ? this.whatsappNumber : `whatsapp:${this.whatsappNumber}`;
    const message = await this.client.messages.create({
      body,
      from: fromWA,
      to: toWA,
    });
    return { sid: message.sid, status: message.status };
  }

  verifyWebhookSignature(req) {
    if (!this.authToken) return false;
    const signature = req.headers['x-twilio-signature'];
    if (!signature) return false;
    const url = `${process.env.RECEPTIONIST_WEBHOOK_BASE_URL}${req.originalUrl}`;
    return twilio.validateRequest(this.authToken, signature, url, req.body);
  }

  normaliseInbound(body) {
    const from = body.From || '';
    const isWhatsApp = from.startsWith('whatsapp:');
    return {
      platform: isWhatsApp ? 'whatsapp' : 'sms',
      contactPhone: isWhatsApp ? from.replace('whatsapp:', '') : from,
      contactName: body.ProfileName || null,
      messageText: body.Body || '',
      twilioSid: body.MessageSid || '',
    };
  }
}

module.exports = TwilioService;
