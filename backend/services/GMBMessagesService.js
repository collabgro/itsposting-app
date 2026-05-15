/**
 * ItsPosting — Google My Business Messages Service
 * backend/services/GMBMessagesService.js
 *
 * Handles inbound Google Business Messages (GBM) conversations.
 * Uses Google Business Messages API v1.
 * Docs: https://developers.google.com/business-communications/business-messages
 */

const axios = require('axios');
const { google } = require('googleapis');

class GMBMessagesService {
  constructor() {
    this.serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
      : null;
  }

  isConfigured() {
    return !!(this.serviceAccountKey && process.env.GOOGLE_BUSINESS_AGENT_ID);
  }

  _getAuth() {
    return new google.auth.GoogleAuth({
      credentials: this.serviceAccountKey,
      scopes: ['https://www.googleapis.com/auth/businessmessages'],
    });
  }

  // Send a reply to a GBM conversation
  async sendMessage(conversationId, text) {
    if (!this.isConfigured()) throw new Error('GMB Messages not configured');

    const auth = this._getAuth();
    const token = await auth.getAccessToken();

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    await axios.post(
      `https://businessmessages.googleapis.com/v1/conversations/${conversationId}/messages`,
      {
        messageId,
        representative: {
          representativeType: 'BOT',
          displayName: 'PostCore AI',
        },
        text,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      }
    );

    return { messageId };
  }

  // Verify that an inbound webhook is genuinely from Google
  verifyWebhookSignature(req) {
    // Google Business Messages uses a client token for webhook verification
    const clientToken = process.env.GMB_WEBHOOK_CLIENT_TOKEN;
    if (!clientToken) return true; // skip verification if not configured
    const incomingToken = req.query.clientToken || req.body?.clientToken;
    return incomingToken === clientToken;
  }

  // Normalise a GBM webhook payload into a standard message object
  normaliseInbound(body) {
    const msg = body?.message;
    const context = body?.context;
    return {
      conversationId: body?.conversationId || '',
      messageText: msg?.text || '',
      userDisplayName: context?.userInfo?.displayName || null,
      googlePlaceId: context?.placeId || null,
    };
  }
}

module.exports = GMBMessagesService;
