'use strict';

const axios = require('axios');

class MetaWhatsAppService {
  constructor({ phoneNumberId, accessToken }) {
    this.phoneNumberId = phoneNumberId;
    this.accessToken = accessToken;
  }

  async sendMessage(to, text) {
    const phone = to.replace(/\D/g, '');
    await axios.post(
      `https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

module.exports = MetaWhatsAppService;
