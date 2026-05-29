/**
 * ItsPosting — DM & Auto-Reply Routes
 * backend/routes/dms.js
 *
 * Mounted at /api/dms in server.js
 *
 * GET  /api/dms/stats              — unread count + platform breakdown
 * GET  /api/dms/sync               — list sync status per platform
 * POST /api/dms/sync               — trigger manual sync
 * GET  /api/dms/auto-replies       — list auto-reply rules
 * POST /api/dms/auto-replies       — create rule
 * PATCH /api/dms/auto-replies/:id  — update rule
 * DELETE /api/dms/auto-replies/:id — delete rule
 * GET  /api/dms                    — list conversations
 * GET  /api/dms/:id                — conversation + messages
 * POST /api/dms/:id/reply          — send reply
 * POST /api/dms/:id/ai-reply       — PostCore AI draft
 * PATCH /api/dms/:id/read          — mark read
 * PATCH /api/dms/:id/star          — toggle star
 * PATCH /api/dms/:id/status        — update status (open/closed)
 */

const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate } = require('../middleware/auth');
const DMPollingService = require('../services/DMPollingService');
const ReceptionistService = require('../services/ReceptionistService');

let industryKnowledge = {};
try { industryKnowledge = require('../data/industryKnowledge'); } catch (_) {}

module.exports = function dmsRoutes(pool) {
  const router = express.Router();
  const dmService = new DMPollingService(pool);
  const receptionistSvc = new ReceptionistService(pool);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // For DMs, use the workspace's customer_id when operating as an invited member (Type B).
  // Type B JWT has workspaceId set; Type A sub-accounts already have customerId = workspace's own ID.
  function getDmCustomerId(req) {
    return req.workspaceId || req.customerId;
  }

  // Returns member's role in a workspace, or 'owner' when no workspace context.
  // Used for role-gated actions (approve/send drafts).
  async function getWorkspaceRole(req) {
    if (!req.workspaceId) return 'owner';
    try {
      const result = await pool.query(
        `SELECT role FROM workspace_members
         WHERE member_id = $1 AND workspace_id = $2 AND revoked_at IS NULL LIMIT 1`,
        [req.customerId, req.workspaceId]
      );
      return result.rows[0]?.role || 'viewer';
    } catch { return 'viewer'; }
  }

  const ROLE_RANK = { viewer: 0, editor: 1, manager: 2, owner: 3 };
  function hasRole(role, required) {
    return (ROLE_RANK[role] || 0) >= (ROLE_RANK[required] || 0);
  }

  // ──────────────────────────────────────────────────────
  // STATS — always before /:id
  // ──────────────────────────────────────────────────────

  router.get('/stats', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
          COUNT(*) FILTER (WHERE is_read = false) AS unread_count,
          COUNT(*) FILTER (WHERE status = 'open') AS open_count,
          COUNT(*) FILTER (WHERE platform = 'facebook') AS facebook_count,
          COUNT(*) FILTER (WHERE platform = 'instagram') AS instagram_count,
          COUNT(*) FILTER (WHERE platform = 'linkedin') AS linkedin_count,
          COUNT(*) FILTER (WHERE platform = 'tiktok') AS tiktok_count,
          COUNT(*) FILTER (WHERE urgency = 'urgent') AS urgent_count,
          COUNT(*) FILTER (WHERE pending_draft IS NOT NULL) AS pending_approval_count
         FROM dm_conversations
         WHERE customer_id = $1`,
        [getDmCustomerId(req)]
      );

      const syncResult = await pool.query(
        `SELECT platform, last_synced_at, sync_status, messages_found
         FROM dm_sync_log WHERE customer_id = $1`,
        [getDmCustomerId(req)]
      );

      res.json({
        unreadCount: parseInt(result.rows[0]?.unread_count || 0),
        openCount: parseInt(result.rows[0]?.open_count || 0),
        facebookCount: parseInt(result.rows[0]?.facebook_count || 0),
        instagramCount: parseInt(result.rows[0]?.instagram_count || 0),
        linkedinCount: parseInt(result.rows[0]?.linkedin_count || 0),
        tiktokCount: parseInt(result.rows[0]?.tiktok_count || 0),
        urgentCount: parseInt(result.rows[0]?.urgent_count || 0),
        pendingApprovalCount: parseInt(result.rows[0]?.pending_approval_count || 0),
        lastSync: syncResult.rows,
      });
    } catch (err) {
      console.error('[DMs] Stats error:', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  });

  // ──────────────────────────────────────────────────────
  // SYNC — before /:id
  // ──────────────────────────────────────────────────────

  router.post('/sync', authenticate, async (req, res) => {
    try {
      dmService.pollCustomerDMs(getDmCustomerId(req)).catch(err =>
        console.error('[DMs] Manual sync error:', err)
      );
      res.json({ success: true, message: 'Sync started. New messages will appear shortly.' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to start sync' });
    }
  });

  // ──────────────────────────────────────────────────────
  // AUTO-REPLY RULES — before /:id to avoid conflict
  // ──────────────────────────────────────────────────────

  router.get('/auto-replies', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM dm_auto_reply_rules WHERE customer_id = $1 ORDER BY trigger_type, created_at',
        [getDmCustomerId(req)]
      );
      res.json({ rules: result.rows });
    } catch (err) {
      res.status(500).json({ error: 'Failed to get auto-reply rules' });
    }
  });

  router.post('/auto-replies', authenticate, async (req, res) => {
    try {
      const { triggerType, keywords, intent, replyText, delaySeconds = 0, sendOnlyOnce = true } = req.body;
      if (!triggerType || !replyText) {
        return res.status(400).json({ error: 'triggerType and replyText are required' });
      }
      const result = await pool.query(
        `INSERT INTO dm_auto_reply_rules
          (customer_id, trigger_type, keywords, intent, reply_text, delay_seconds, send_only_once, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        [getDmCustomerId(req), triggerType, JSON.stringify(keywords || []), intent, replyText, delaySeconds, sendOnlyOnce]
      );
      res.status(201).json({ success: true, rule: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create auto-reply rule' });
    }
  });

  router.patch('/auto-replies/:id', authenticate, async (req, res) => {
    try {
      const { isActive, replyText, keywords, delaySeconds } = req.body;
      const result = await pool.query(
        `UPDATE dm_auto_reply_rules SET
          is_active = COALESCE($1, is_active),
          reply_text = COALESCE($2, reply_text),
          keywords = COALESCE($3, keywords),
          delay_seconds = COALESCE($4, delay_seconds),
          updated_at = NOW()
         WHERE id = $5 AND customer_id = $6
         RETURNING *`,
        [isActive, replyText, keywords ? JSON.stringify(keywords) : null, delaySeconds, req.params.id, getDmCustomerId(req)]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Rule not found' });
      res.json({ success: true, rule: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update rule' });
    }
  });

  router.delete('/auto-replies/:id', authenticate, async (req, res) => {
    try {
      await pool.query(
        'DELETE FROM dm_auto_reply_rules WHERE id = $1 AND customer_id = $2',
        [req.params.id, getDmCustomerId(req)]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete rule' });
    }
  });

  // ──────────────────────────────────────────────────────
  // LIST CONVERSATIONS
  // ──────────────────────────────────────────────────────

  router.get('/', authenticate, async (req, res) => {
    try {
      const { platform, status, unread, starred, pending_approval, page = 1, limit = 20 } = req.query;
      const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
      const safePage = Math.max(parseInt(page) || 1, 1);
      const offset = (safePage - 1) * safeLimit;

      const conditions = ['dc.customer_id = $1'];
      const params = [getDmCustomerId(req)];
      let idx = 2;

      if (platform) { conditions.push(`dc.platform = $${idx}`); params.push(platform); idx++; }
      if (status) { conditions.push(`dc.status = $${idx}`); params.push(status); idx++; }
      if (unread === 'true') conditions.push('dc.is_read = false');
      if (starred === 'true') conditions.push('dc.is_starred = true');
      if (pending_approval === 'true') conditions.push('dc.pending_draft IS NOT NULL');

      const where = conditions.join(' AND ');

      const result = await pool.query(
        `SELECT dc.*,
          CASE
            WHEN dc.window_expires_at > NOW() THEN 'open'
            WHEN dc.human_agent_window_expires_at > NOW() THEN 'human_agent'
            ELSE 'closed'
          END AS messaging_window_status,
          EXTRACT(EPOCH FROM (dc.window_expires_at - NOW())) AS window_seconds_remaining,
          (SELECT ai_handled FROM dm_messages
           WHERE conversation_id = dc.id AND direction = 'outgoing'
           ORDER BY COALESCE(sent_at, created_at) DESC LIMIT 1) AS last_message_ai_handled
         FROM dm_conversations dc
         WHERE ${where}
         ORDER BY dc.is_starred DESC, dc.last_message_at DESC NULLS LAST
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, safeLimit, offset]
      );

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM dm_conversations dc WHERE ${where}`,
        params
      );

      res.json({
        conversations: result.rows,
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
      });
    } catch (err) {
      console.error('[DMs] List error:', err);
      res.status(500).json({ error: 'Failed to get conversations' });
    }
  });

  // ──────────────────────────────────────────────────────
  // GET SINGLE CONVERSATION + MESSAGES
  // ──────────────────────────────────────────────────────

  router.get('/:id', authenticate, async (req, res) => {
    try {
      const convResult = await pool.query(
        `SELECT dc.*,
          CASE
            WHEN dc.window_expires_at > NOW() THEN 'open'
            WHEN dc.human_agent_window_expires_at > NOW() THEN 'human_agent'
            ELSE 'closed'
          END AS messaging_window_status,
          EXTRACT(EPOCH FROM (dc.window_expires_at - NOW())) AS window_seconds_remaining
         FROM dm_conversations dc
         WHERE dc.id = $1 AND dc.customer_id = $2`,
        [req.params.id, getDmCustomerId(req)]
      );

      if (!convResult.rows[0]) return res.status(404).json({ error: 'Conversation not found' });

      const messagesResult = await pool.query(
        `SELECT dm.* FROM dm_messages dm
         JOIN dm_conversations dc ON dc.id = dm.conversation_id
         WHERE dm.conversation_id = $1 AND dc.customer_id = $2
         ORDER BY COALESCE(dm.sent_at, dm.created_at) ASC
         LIMIT 100`,
        [req.params.id, getDmCustomerId(req)]
      );

      await pool.query(
        'UPDATE dm_conversations SET is_read = true WHERE id = $1 AND customer_id = $2',
        [req.params.id, getDmCustomerId(req)]
      );

      res.json({ conversation: convResult.rows[0], messages: messagesResult.rows });
    } catch (err) {
      console.error('[DMs] Get conversation error:', err);
      res.status(500).json({ error: 'Failed to get conversation' });
    }
  });

  // ──────────────────────────────────────────────────────
  // SEND REPLY
  // ──────────────────────────────────────────────────────

  router.post('/:id/reply', authenticate, async (req, res) => {
    try {
      const { message } = req.body;
      if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });

      const convResult = await pool.query(
        'SELECT platform FROM dm_conversations WHERE id = $1 AND customer_id = $2',
        [req.params.id, getDmCustomerId(req)]
      );
      if (!convResult.rows[0]) return res.status(404).json({ error: 'Conversation not found' });

      // Viewers cannot send replies
      const role = await getWorkspaceRole(req);
      if (!hasRole(role, 'editor')) {
        return res.status(403).json({ error: 'Viewer role cannot send messages. Contact your workspace manager.' });
      }

      await dmService.sendDMReply(getDmCustomerId(req), parseInt(req.params.id), message.trim(), convResult.rows[0].platform);
      res.json({ success: true, message: 'Reply sent successfully' });
    } catch (err) {
      console.error('[DMs] Reply error:', err);
      if (err.message.includes('WINDOW_EXPIRED')) {
        return res.status(400).json({
          error: 'Messaging window has expired',
          detail: 'The 7-day window has closed. The customer needs to message you first.',
        });
      }
      res.status(500).json({ error: 'Failed to send reply: ' + err.message });
    }
  });

  // ──────────────────────────────────────────────────────
  // AI DRAFT REPLY
  // ──────────────────────────────────────────────────────

  router.post('/:id/ai-reply', authenticate, async (req, res) => {
    try {
      const { tone = 'friendly', savePending = false } = req.body;

      const convResult = await pool.query(
        `SELECT dc.* FROM dm_conversations dc WHERE dc.id=$1 AND dc.customer_id=$2`,
        [req.params.id, getDmCustomerId(req)]
      );
      if (!convResult.rows[0]) return res.status(404).json({ error: 'Conversation not found' });

      // Viewers cannot generate AI drafts
      const role = await getWorkspaceRole(req);
      if (!hasRole(role, 'editor')) {
        return res.status(403).json({ error: 'Viewer role cannot generate drafts. Contact your workspace manager.' });
      }

      const messagesResult = await pool.query(
        `SELECT direction, message_text FROM dm_messages
         WHERE conversation_id=$1 ORDER BY COALESCE(sent_at, created_at) DESC LIMIT 20`,
        [req.params.id]
      );
      const messages = messagesResult.rows.reverse();
      const lastIncoming = messages.filter(m => m.direction === 'incoming').at(-1);
      if (!lastIncoming) return res.status(400).json({ error: 'No incoming message to reply to' });

      const detectedIntent = receptionistSvc.classifyIntent(lastIncoming.message_text);

      // Detect sentiment from the last incoming message
      const msgLower = lastIncoming.message_text.toLowerCase();
      let sentiment = 'neutral';
      const negWords = ['angry', 'terrible', 'awful', 'bad', 'hate', 'scam', 'fraud', 'worst', 'disappointed', 'frustrated', 'refund', 'lawsuit', 'never again'];
      const posWords = ['great', 'love', 'amazing', 'excellent', 'perfect', 'thank', 'awesome', 'fantastic', 'happy', 'satisfied', 'best', 'wonderful'];
      if (negWords.some(w => msgLower.includes(w))) sentiment = 'negative';
      else if (posWords.some(w => msgLower.includes(w))) sentiment = 'positive';

      // Urgency detection
      const urgencyWords = ['urgent', 'emergency', 'asap', 'immediately', 'flooding', 'fire', 'broken', 'no heat', 'no water', 'leaking', 'burst'];
      const urgency = urgencyWords.some(w => msgLower.includes(w)) ? 'urgent' : 'normal';

      // Build knowledge-enriched system prompt
      const systemPrompt = await receptionistSvc.buildSystemPrompt(getDmCustomerId(req));

      const conversationHistory = messages.map(m => ({
        role: m.direction === 'incoming' ? 'user' : 'assistant',
        content: m.message_text,
      }));

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        temperature: 0.4,
        system: systemPrompt + `\n\nTone requested: ${tone}. Respond with ONLY valid JSON: {"reply":"..."}`,
        messages: conversationHistory,
      });

      const rawText = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
      let draft;
      try {
        const parsed = JSON.parse(rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
        draft = parsed.reply;
      } catch {
        draft = rawText.trim();
      }

      // Optionally save as pending approval draft on the conversation
      if (savePending && draft) {
        await pool.query(
          `UPDATE dm_conversations SET
            pending_draft = $1,
            pending_draft_intent = $2,
            pending_draft_sentiment = $3,
            pending_draft_urgency = $4,
            pending_draft_created_at = NOW(),
            updated_at = NOW()
           WHERE id = $5 AND customer_id = $6`,
          [draft, detectedIntent, sentiment, urgency, req.params.id, getDmCustomerId(req)]
        );
      }

      res.json({ success: true, draft, intent: detectedIntent, sentiment, urgency, tone });
    } catch (err) {
      console.error('[DMs] AI reply error:', err);
      res.status(500).json({ error: 'Failed to generate AI reply' });
    }
  });

  // ──────────────────────────────────────────────────────
  // PENDING DRAFT — APPROVE (send) or DISMISS
  // ──────────────────────────────────────────────────────

  router.post('/:id/draft/approve', authenticate, async (req, res) => {
    try {
      const { editedText } = req.body;

      // Only managers and owners can approve and send drafts
      const role = await getWorkspaceRole(req);
      if (!hasRole(role, 'manager')) {
        return res.status(403).json({ error: 'Only managers can approve and send drafts. Editors can generate them for manager review.' });
      }

      const convResult = await pool.query(
        'SELECT * FROM dm_conversations WHERE id=$1 AND customer_id=$2',
        [req.params.id, getDmCustomerId(req)]
      );
      if (!convResult.rows[0]) return res.status(404).json({ error: 'Conversation not found' });
      const conv = convResult.rows[0];

      const messageToSend = (editedText || conv.pending_draft || '').trim();
      if (!messageToSend) return res.status(400).json({ error: 'No draft to approve' });

      // Send the message using the workspace's billing account
      await dmService.sendDMReply(getDmCustomerId(req), parseInt(req.params.id), messageToSend, conv.platform);

      // Clear pending draft
      await pool.query(
        `UPDATE dm_conversations SET
          pending_draft = NULL, pending_draft_intent = NULL,
          pending_draft_sentiment = NULL, pending_draft_urgency = NULL,
          pending_draft_created_at = NULL, updated_at = NOW()
         WHERE id = $1 AND customer_id = $2`,
        [req.params.id, getDmCustomerId(req)]
      );

      res.json({ success: true, message: 'Draft approved and sent' });
    } catch (err) {
      console.error('[DMs] Draft approve error:', err);
      if (err.message.includes('WINDOW_EXPIRED')) {
        return res.status(400).json({ error: 'Messaging window has expired', detail: 'The 7-day window has closed.' });
      }
      res.status(500).json({ error: 'Failed to approve draft: ' + err.message });
    }
  });

  router.post('/:id/draft/dismiss', authenticate, async (req, res) => {
    try {
      // Managers and owners can dismiss; editors can dismiss their own drafted content
      const role = await getWorkspaceRole(req);
      if (!hasRole(role, 'editor')) {
        return res.status(403).json({ error: 'Viewer role cannot modify drafts.' });
      }

      const result = await pool.query(
        `UPDATE dm_conversations SET
          pending_draft = NULL, pending_draft_intent = NULL,
          pending_draft_sentiment = NULL, pending_draft_urgency = NULL,
          pending_draft_created_at = NULL, updated_at = NOW()
         WHERE id = $1 AND customer_id = $2 RETURNING id`,
        [req.params.id, getDmCustomerId(req)]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Conversation not found' });
      res.json({ success: true });
    } catch (err) {
      console.error('[DMs] Draft dismiss error:', err);
      res.status(500).json({ error: 'Failed to dismiss draft' });
    }
  });

  // ──────────────────────────────────────────────────────
  // MARK READ / STAR / STATUS
  // ──────────────────────────────────────────────────────

  router.patch('/:id/read', authenticate, async (req, res) => {
    try {
      await pool.query(
        'UPDATE dm_conversations SET is_read = true WHERE id = $1 AND customer_id = $2',
        [req.params.id, getDmCustomerId(req)]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to mark as read' });
    }
  });

  router.patch('/:id/star', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE dm_conversations SET is_starred = NOT is_starred
         WHERE id = $1 AND customer_id = $2 RETURNING is_starred`,
        [req.params.id, getDmCustomerId(req)]
      );
      res.json({ success: true, isStarred: result.rows[0]?.is_starred });
    } catch (err) {
      res.status(500).json({ error: 'Failed to toggle star' });
    }
  });

  router.patch('/:id/status', authenticate, async (req, res) => {
    try {
      const { status } = req.body;
      if (!['open', 'closed'].includes(status)) {
        return res.status(400).json({ error: 'Status must be open or closed' });
      }
      await pool.query(
        'UPDATE dm_conversations SET status = $1, updated_at = NOW() WHERE id = $2 AND customer_id = $3',
        [status, req.params.id, getDmCustomerId(req)]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update status' });
    }
  });

  // ──────────────────────────────────────────────────────
  // SAVE DM SENDER AS CONTACT
  // ──────────────────────────────────────────────────────

  router.post('/:id/contact', authenticate, async (req, res) => {
    try {
      const dmCustId = getDmCustomerId(req);
      const convResult = await pool.query(
        'SELECT * FROM dm_conversations WHERE id = $1 AND customer_id = $2',
        [req.params.id, dmCustId]
      );
      if (!convResult.rows[0]) return res.status(404).json({ error: 'Conversation not found' });
      const conv = convResult.rows[0];

      // If already linked, return the existing contact
      if (conv.contact_id) {
        const linked = await pool.query('SELECT * FROM contacts WHERE id = $1', [conv.contact_id]);
        if (linked.rows[0]) return res.json({ success: true, contact: linked.rows[0], existed: true });
      }

      // Look for a contact that matches this sender's platform ID
      const psidCol = conv.platform === 'instagram' ? 'instagram_igsid' : 'facebook_psid';
      let contact = null;

      if (conv.sender_platform_id && (conv.platform === 'facebook' || conv.platform === 'instagram')) {
        const existing = await pool.query(
          `SELECT * FROM contacts WHERE customer_id = $1 AND ${psidCol} = $2 LIMIT 1`,
          [dmCustId, conv.sender_platform_id]
        );
        if (existing.rows[0]) contact = existing.rows[0];
      }

      // Create contact if not found
      if (!contact) {
        const insertCols = ['customer_id', 'name', 'source', 'source_platform', 'lead_status', 'first_contact_at', 'last_contact_at', 'created_at', 'updated_at'];
        const params = [dmCustId, conv.sender_name || 'Unknown', `${conv.platform}_dm`, conv.platform];
        let idx = params.length + 1;

        let extraCols = '';
        if (conv.sender_platform_id && (conv.platform === 'facebook' || conv.platform === 'instagram')) {
          extraCols += `, ${psidCol}`;
          params.push(conv.sender_platform_id); idx++;
        }
        if (conv.sender_profile_pic) {
          extraCols += ', profile_pic_url';
          params.push(conv.sender_profile_pic); idx++;
        }

        const psidInsert = conv.sender_platform_id && (conv.platform === 'facebook' || conv.platform === 'instagram')
          ? `, $${params.indexOf(conv.sender_platform_id) + 1}` : '';
        const picInsert = conv.sender_profile_pic
          ? `, $${params.indexOf(conv.sender_profile_pic) + 1}` : '';

        const insertResult = await pool.query(
          `INSERT INTO contacts
            (customer_id, name, source, source_platform, lead_status${extraCols},
             first_contact_at, last_contact_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'new'${psidInsert}${picInsert}, NOW(), NOW(), NOW(), NOW())
           RETURNING *`,
          params
        );
        contact = insertResult.rows[0];
      }

      // Link the conversation to the contact
      await pool.query(
        'UPDATE dm_conversations SET contact_id = $1, updated_at = NOW() WHERE id = $2',
        [contact.id, conv.id]
      );

      res.json({ success: true, contact, existed: false });
    } catch (err) {
      console.error('[DMs] Save contact error:', err);
      res.status(500).json({ error: 'Failed to save contact' });
    }
  });

  return router;
};
