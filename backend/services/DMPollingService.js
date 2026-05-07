/**
 * ItsPosting — DM Polling Service
 * backend/services/DMPollingService.js
 *
 * Polls Facebook Messenger and Instagram Direct APIs for new DMs.
 * Instantiated in server.js with the shared pool.
 *
 * API facts:
 * - 24-hour standard messaging window after user's last message
 * - 7-day human agent window (HUMAN_AGENT tag required)
 * - 200 DMs/hour rate limit
 * - Can only message users who messaged first (no cold outreach)
 * - Requires pages_messaging + instagram_business_manage_messages permissions
 */

const cron = require('node-cron');
const axios = require('axios');

const FACEBOOK_GRAPH_URL = 'https://graph.facebook.com/v19.0';

class DMPollingService {
  constructor(pool) {
    this.pool = pool;
    this.running = false;
  }

  start() {
    console.log('💬 DMPollingService started (runs every 15 min)');
    cron.schedule('*/15 * * * *', () => this.pollAllCustomers());
  }

  // ─────────────────────────────────────────────────────────
  // Poll all customers for new DMs
  // ─────────────────────────────────────────────────────────

  async pollAllCustomers() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.pool.query(
        `SELECT DISTINCT c.id, c.business_name
         FROM customers c
         INNER JOIN social_accounts sa ON sa.customer_id = c.id
         WHERE c.status IN ('active', 'trial', 'pro', 'professional', 'premium')
           AND sa.enabled = true
           AND sa.platform IN ('facebook', 'instagram')`
      );

      const customers = result.rows;
      if (customers.length > 0) {
        console.log(`[DMPolling] Polling ${customers.length} customers for new DMs`);
      }

      for (const customer of customers) {
        try {
          await this.pollCustomerDMs(customer.id);
          await this._sleep(500);
        } catch (err) {
          console.error(`[DMPolling] Error polling customer ${customer.id}:`, err.message);
        }
      }
    } catch (err) {
      console.error('[DMPolling] Error in pollAllCustomers:', err);
    } finally {
      this.running = false;
    }
  }

  // ─────────────────────────────────────────────────────────
  // Poll a single customer's connected platforms
  // ─────────────────────────────────────────────────────────

  async pollCustomerDMs(customerId) {
    const accountsResult = await this.pool.query(
      `SELECT platform, access_token, account_id, account_name
       FROM social_accounts
       WHERE customer_id = $1 AND enabled = true AND platform IN ('facebook', 'instagram')`,
      [customerId]
    );

    for (const account of accountsResult.rows) {
      try {
        if (account.platform === 'facebook') {
          await this._pollFacebookDMs(customerId, account);
        } else if (account.platform === 'instagram') {
          await this._pollInstagramDMs(customerId, account);
        }
      } catch (err) {
        await this._logSync(customerId, account.platform, 0, 'failed', err.message);
        console.error(`[DMPolling] Error polling ${account.platform} for customer ${customerId}:`, err.message);
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // Facebook DM Polling
  // ─────────────────────────────────────────────────────────

  async _pollFacebookDMs(customerId, account) {
    const { account_id: pageId, access_token: accessToken } = account;
    if (!pageId || !accessToken) return;

    const lastSyncResult = await this.pool.query(
      `SELECT last_synced_at FROM dm_sync_log WHERE customer_id = $1 AND platform = 'facebook'`,
      [customerId]
    );
    const lastSyncAt = lastSyncResult.rows[0]?.last_synced_at;

    const response = await axios.get(`${FACEBOOK_GRAPH_URL}/${pageId}/conversations`, {
      params: {
        access_token: accessToken,
        fields: 'id,updated_time,unread_count,participants,messages{id,message,from,created_time,attachments}',
        limit: 25,
        ...(lastSyncAt ? { since: Math.floor(new Date(lastSyncAt).getTime() / 1000) } : {}),
      },
      timeout: 10000,
    });

    const conversations = response.data?.data || [];
    let newCount = 0;

    for (const conversation of conversations) {
      try {
        const messages = conversation.messages?.data || [];
        const participants = conversation.participants?.data || [];
        const sender = participants.find(p => p.id !== pageId);
        if (!sender) continue;

        const convResult = await this.pool.query(
          `INSERT INTO dm_conversations
            (customer_id, platform, platform_thread_id, sender_platform_id, sender_name,
             last_message_at, is_read, status, created_at, updated_at)
           VALUES ($1, 'facebook', $2, $3, $4, $5, false, 'open', NOW(), NOW())
           ON CONFLICT (customer_id, platform, platform_thread_id) DO UPDATE SET
             sender_name = EXCLUDED.sender_name,
             last_message_at = EXCLUDED.last_message_at,
             updated_at = NOW()
           RETURNING id`,
          [customerId, conversation.id, sender.id, sender.name || 'Facebook User',
           conversation.updated_time ? new Date(conversation.updated_time) : new Date()]
        );

        const conversationId = convResult.rows[0]?.id;
        if (!conversationId) continue;

        for (const msg of messages) {
          const isIncoming = msg.from?.id !== pageId;
          const inserted = await this._upsertMessage(
            conversationId, customerId, msg.id,
            isIncoming ? 'incoming' : 'outgoing',
            msg.message || '', msg.attachments?.data || [],
            msg.created_time ? new Date(msg.created_time) : new Date()
          );

          if (inserted && isIncoming) {
            newCount++;
            await this.checkAndApplyAutoReply(customerId, conversationId, msg.message, 'facebook', accessToken, sender.id);

            const windowExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const humanWindowExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            await this.pool.query(
              `UPDATE dm_conversations SET
                window_expires_at = $1,
                human_agent_window_expires_at = $2,
                last_message_preview = $3,
                last_message_direction = 'incoming',
                is_read = false
               WHERE id = $4`,
              [windowExpiry, humanWindowExpiry, (msg.message || '').substring(0, 100), conversationId]
            );
          }
        }

        await this._upsertContact(customerId, sender.id, null, sender.name, null, 'facebook_dm', 'facebook');
      } catch (err) {
        console.error(`[DMPolling] Error processing FB conversation ${conversation.id}:`, err.message);
      }
    }

    await this._logSync(customerId, 'facebook', newCount, 'success', null);
    if (newCount > 0) console.log(`[DMPolling] ${newCount} new Facebook messages for customer ${customerId}`);
  }

  // ─────────────────────────────────────────────────────────
  // Instagram DM Polling
  // ─────────────────────────────────────────────────────────

  async _pollInstagramDMs(customerId, account) {
    const { account_id: igAccountId, access_token: accessToken } = account;
    if (!igAccountId || !accessToken) return;

    const lastSyncResult = await this.pool.query(
      `SELECT last_synced_at FROM dm_sync_log WHERE customer_id = $1 AND platform = 'instagram'`,
      [customerId]
    );
    const lastSyncAt = lastSyncResult.rows[0]?.last_synced_at;

    const response = await axios.get(`${FACEBOOK_GRAPH_URL}/${igAccountId}/conversations`, {
      params: {
        access_token: accessToken,
        fields: 'id,updated_time,participants,messages{id,message,from,created_time}',
        platform: 'instagram',
        limit: 25,
        ...(lastSyncAt ? { since: Math.floor(new Date(lastSyncAt).getTime() / 1000) } : {}),
      },
      timeout: 10000,
    });

    const conversations = response.data?.data || [];
    let newCount = 0;

    for (const conversation of conversations) {
      try {
        const messages = conversation.messages?.data || [];
        const participants = conversation.participants?.data || [];
        const sender = participants.find(p => p.id !== igAccountId);
        if (!sender) continue;

        const convResult = await this.pool.query(
          `INSERT INTO dm_conversations
            (customer_id, platform, platform_thread_id, sender_platform_id, sender_name,
             last_message_at, is_read, status, created_at, updated_at)
           VALUES ($1, 'instagram', $2, $3, $4, $5, false, 'open', NOW(), NOW())
           ON CONFLICT (customer_id, platform, platform_thread_id) DO UPDATE SET
             sender_name = EXCLUDED.sender_name,
             last_message_at = EXCLUDED.last_message_at,
             updated_at = NOW()
           RETURNING id`,
          [customerId, conversation.id, sender.id, sender.name || sender.username || 'Instagram User',
           conversation.updated_time ? new Date(conversation.updated_time) : new Date()]
        );

        const conversationId = convResult.rows[0]?.id;
        if (!conversationId) continue;

        for (const msg of messages) {
          const isIncoming = msg.from?.id !== igAccountId;
          const inserted = await this._upsertMessage(
            conversationId, customerId, msg.id,
            isIncoming ? 'incoming' : 'outgoing',
            msg.message || '', [],
            msg.created_time ? new Date(msg.created_time) : new Date()
          );

          if (inserted && isIncoming) {
            newCount++;
            await this.checkAndApplyAutoReply(customerId, conversationId, msg.message, 'instagram', accessToken, sender.id);

            const windowExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
            await this.pool.query(
              `UPDATE dm_conversations SET
                window_expires_at = $1,
                last_message_preview = $2,
                last_message_direction = 'incoming',
                is_read = false
               WHERE id = $3`,
              [windowExpiry, (msg.message || '').substring(0, 100), conversationId]
            );
          }
        }

        await this._upsertContact(customerId, null, sender.id, sender.name || sender.username, null, 'instagram_dm', 'instagram');
      } catch (err) {
        console.error(`[DMPolling] Error processing IG conversation ${conversation.id}:`, err.message);
      }
    }

    await this._logSync(customerId, 'instagram', newCount, 'success', null);
    if (newCount > 0) console.log(`[DMPolling] ${newCount} new Instagram messages for customer ${customerId}`);
  }

  // ─────────────────────────────────────────────────────────
  // Send a reply via Facebook/Instagram API
  // ─────────────────────────────────────────────────────────

  async sendDMReply(customerId, conversationId, messageText, platform) {
    const convResult = await this.pool.query(
      `SELECT dc.*, sa.access_token, sa.account_id
       FROM dm_conversations dc
       INNER JOIN social_accounts sa ON sa.customer_id = dc.customer_id AND sa.platform = dc.platform
       WHERE dc.id = $1 AND dc.customer_id = $2`,
      [conversationId, customerId]
    );

    if (!convResult.rows[0]) throw new Error('Conversation not found');
    const conv = convResult.rows[0];

    const now = new Date();
    const inStandardWindow = conv.window_expires_at && now < new Date(conv.window_expires_at);
    const inHumanWindow = conv.human_agent_window_expires_at && now < new Date(conv.human_agent_window_expires_at);

    if (!inStandardWindow && !inHumanWindow) {
      throw new Error('WINDOW_EXPIRED: Cannot send message — 7-day messaging window has closed. The customer needs to message you again.');
    }

    const requestBody = {
      recipient: { id: conv.sender_platform_id },
      message: { text: messageText },
    };

    if (!inStandardWindow && inHumanWindow) {
      requestBody.tag = 'HUMAN_AGENT';
    }

    const endpoint = `${FACEBOOK_GRAPH_URL}/${conv.account_id}/messages`;

    await axios.post(endpoint, requestBody, {
      params: { access_token: conv.access_token },
      timeout: 10000,
    });

    await this.pool.query(
      `INSERT INTO dm_messages
        (conversation_id, customer_id, direction, message_text, status, reply_type, sent_at, created_at)
       VALUES ($1, $2, 'outgoing', $3, 'sent', 'manual', NOW(), NOW())`,
      [conversationId, customerId, messageText]
    );

    await this.pool.query(
      `UPDATE dm_conversations SET
        last_message_at = NOW(),
        last_message_preview = $1,
        last_message_direction = 'outgoing',
        updated_at = NOW()
       WHERE id = $2`,
      [messageText.substring(0, 100), conversationId]
    );

    return { success: true };
  }

  // ─────────────────────────────────────────────────────────
  // Auto-reply: check rules and send if matched
  // ─────────────────────────────────────────────────────────

  async checkAndApplyAutoReply(customerId, conversationId, messageText, platform, accessToken, senderId) {
    try {
      const convResult = await this.pool.query(
        'SELECT auto_reply_sent, sender_platform_id FROM dm_conversations WHERE id = $1',
        [conversationId]
      );
      if (convResult.rows[0]?.auto_reply_sent) return;

      const rulesResult = await this.pool.query(
        `SELECT * FROM dm_auto_reply_rules
         WHERE customer_id = $1 AND is_active = true
         ORDER BY (trigger_type = 'first_message') DESC`,
        [customerId]
      );

      if (!rulesResult.rows.length) return;

      const lowerMessage = (messageText || '').toLowerCase();
      let matchedRule = null;

      for (const rule of rulesResult.rows) {
        if (rule.trigger_type === 'first_message') {
          const msgCount = await this.pool.query(
            'SELECT COUNT(*) FROM dm_messages WHERE conversation_id = $1',
            [conversationId]
          );
          if (parseInt(msgCount.rows[0].count) <= 1) { matchedRule = rule; break; }
        } else if (rule.trigger_type === 'keyword') {
          const keywords = rule.keywords || [];
          if (keywords.some(k => lowerMessage.includes(k.toLowerCase()))) { matchedRule = rule; break; }
        } else if (rule.trigger_type === 'intent') {
          if (this.detectIntent(messageText) === rule.intent) { matchedRule = rule; break; }
        }
      }

      if (!matchedRule) return;
      if (matchedRule.delay_seconds > 0) await this._sleep(matchedRule.delay_seconds * 1000);

      const senderPsid = convResult.rows[0].sender_platform_id;
      await axios.post(`${FACEBOOK_GRAPH_URL}/me/messages`, {
        recipient: { id: senderPsid },
        message: { text: matchedRule.reply_text },
      }, { params: { access_token: accessToken }, timeout: 10000 });

      await this.pool.query(
        `INSERT INTO dm_messages
          (conversation_id, customer_id, direction, message_text, status, reply_type, ai_generated, sent_at, created_at)
         VALUES ($1, $2, 'outgoing', $3, 'sent', 'auto_reply', false, NOW(), NOW())`,
        [conversationId, customerId, matchedRule.reply_text]
      );

      await this.pool.query(
        `UPDATE dm_conversations SET
          auto_reply_sent = true,
          last_message_direction = 'outgoing',
          updated_at = NOW()
         WHERE id = $1`,
        [conversationId]
      );

      await this.pool.query(
        'UPDATE dm_auto_reply_rules SET times_triggered = times_triggered + 1 WHERE id = $1',
        [matchedRule.id]
      );
    } catch (err) {
      console.error(`[DMPolling] Auto-reply error for conversation ${conversationId}:`, err.message);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Intent detection — classify incoming DMs
  // ─────────────────────────────────────────────────────────

  detectIntent(messageText) {
    if (!messageText) return 'general';
    const lower = messageText.toLowerCase();
    if (lower.match(/how much|price|cost|quote|estimate|rate|charge/)) return 'price_inquiry';
    if (lower.match(/available|availability|when|schedule|appointment|book|time/)) return 'availability';
    if (lower.match(/area|location|service area|do you serve|come to|near/)) return 'service_area';
    if (lower.match(/emergency|urgent|asap|flooding|burst|broken|not working|help/)) return 'emergency';
    if (lower.match(/review|feedback|complaint|terrible|amazing|great/)) return 'feedback';
    return 'general';
  }

  // ─────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────

  async _upsertMessage(conversationId, customerId, platformMessageId, direction, text, attachments, sentAt) {
    try {
      const result = await this.pool.query(
        `INSERT INTO dm_messages
          (conversation_id, customer_id, platform_message_id, direction, message_text,
           attachments, status, sent_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'delivered', $7, NOW())
         ON CONFLICT (platform_message_id) DO NOTHING
         RETURNING id`,
        [conversationId, customerId, platformMessageId, direction, text,
         JSON.stringify(attachments || []), sentAt]
      );
      return result.rows.length > 0;
    } catch (err) {
      console.error('[DMPolling] Error upserting message:', err.message);
      return false;
    }
  }

  async _upsertContact(customerId, facebookPsid, instagramIgsid, name, profilePic, source, platform) {
    try {
      const platformId = facebookPsid || instagramIgsid;
      if (!platformId) return null;

      if (facebookPsid) {
        const result = await this.pool.query(
          `INSERT INTO contacts
            (customer_id, name, profile_pic_url, facebook_psid, source, source_platform,
             first_contact_at, last_contact_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW(), NOW())
           ON CONFLICT (customer_id, facebook_psid) WHERE facebook_psid IS NOT NULL DO UPDATE SET
             name = COALESCE(EXCLUDED.name, contacts.name),
             last_contact_at = NOW(),
             total_conversations = contacts.total_conversations + 1,
             updated_at = NOW()
           RETURNING id`,
          [customerId, name, profilePic, facebookPsid, source, platform]
        );
        return result.rows[0]?.id || null;
      } else {
        const result = await this.pool.query(
          `INSERT INTO contacts
            (customer_id, name, profile_pic_url, instagram_igsid, source, source_platform,
             first_contact_at, last_contact_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW(), NOW())
           ON CONFLICT (customer_id, instagram_igsid) WHERE instagram_igsid IS NOT NULL DO UPDATE SET
             name = COALESCE(EXCLUDED.name, contacts.name),
             last_contact_at = NOW(),
             total_conversations = contacts.total_conversations + 1,
             updated_at = NOW()
           RETURNING id`,
          [customerId, name, profilePic, instagramIgsid, source, platform]
        );
        return result.rows[0]?.id || null;
      }
    } catch (err) {
      return null;
    }
  }

  async _logSync(customerId, platform, messagesFound, status, errorMessage) {
    try {
      await this.pool.query(
        `INSERT INTO dm_sync_log (customer_id, platform, last_synced_at, messages_found, sync_status, error_message)
         VALUES ($1, $2, NOW(), $3, $4, $5)
         ON CONFLICT (customer_id, platform) DO UPDATE SET
           last_synced_at = NOW(),
           messages_found = EXCLUDED.messages_found,
           sync_status = EXCLUDED.sync_status,
           error_message = EXCLUDED.error_message`,
        [customerId, platform, messagesFound, status, errorMessage]
      );
    } catch (_) {}
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = DMPollingService;
