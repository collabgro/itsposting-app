/**
 * ItsPosting — Contacts Routes
 * backend/routes/contacts.js
 *
 * Mounted at /api/contacts in server.js
 *
 * GET  /api/contacts          — list with search + filter
 * POST /api/contacts          — create contact manually
 * GET  /api/contacts/:id      — contact detail + conversation history
 * PATCH /api/contacts/:id     — update contact / lead status
 * DELETE /api/contacts/:id    — delete contact
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');

module.exports = function contactsRoutes(pool) {
  const router = express.Router();

  // ──────────────────────────────────────────────────────
  // LIST CONTACTS
  // ──────────────────────────────────────────────────────

  router.get('/', authenticate, async (req, res) => {
    try {
      const { search, leadStatus, source, page = 1, limit = 25 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const conditions = ['c.customer_id = $1', 'c.is_blocked = false'];
      const params = [req.customerId];
      let idx = 2;

      if (search) {
        conditions.push(
          `(c.name ILIKE $${idx} OR c.email ILIKE $${idx} OR c.phone ILIKE $${idx} OR c.notes ILIKE $${idx})`
        );
        params.push(`%${search}%`);
        idx++;
      }

      if (leadStatus) { conditions.push(`c.lead_status = $${idx}`); params.push(leadStatus); idx++; }
      if (source) { conditions.push(`c.source_platform = $${idx}`); params.push(source); idx++; }

      const where = conditions.join(' AND ');

      const result = await pool.query(
        `SELECT c.*,
          COUNT(DISTINCT dc.id) AS conversation_count,
          MAX(dc.last_message_at) AS latest_message_at
         FROM contacts c
         LEFT JOIN dm_conversations dc ON
           (dc.sender_platform_id = c.facebook_psid OR dc.sender_platform_id = c.instagram_igsid)
           AND dc.customer_id = c.customer_id
         WHERE ${where}
         GROUP BY c.id
         ORDER BY c.last_contact_at DESC NULLS LAST, c.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, parseInt(limit), offset]
      );

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM contacts c WHERE ${where}`,
        params
      );

      res.json({
        contacts: result.rows,
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
      });
    } catch (err) {
      console.error('[Contacts] List error:', err);
      res.status(500).json({ error: 'Failed to get contacts' });
    }
  });

  // ──────────────────────────────────────────────────────
  // CREATE CONTACT
  // ──────────────────────────────────────────────────────

  router.post('/', authenticate, async (req, res) => {
    try {
      const { name, email, phone, notes, tags, leadStatus, jobType, estimatedJobValue } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required' });

      const result = await pool.query(
        `INSERT INTO contacts
          (customer_id, name, email, phone, notes, tags, lead_status, job_type,
           estimated_job_value, source, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'manual', NOW(), NOW())
         RETURNING *`,
        [
          req.customerId, name, email || null, phone || null, notes || null,
          JSON.stringify(tags || []),
          leadStatus || 'new', jobType || null, estimatedJobValue || null,
        ]
      );

      res.status(201).json({ success: true, contact: result.rows[0] });
    } catch (err) {
      console.error('[Contacts] Create error:', err);
      res.status(500).json({ error: 'Failed to create contact' });
    }
  });

  // ──────────────────────────────────────────────────────
  // GET CONTACT + CONVERSATION HISTORY
  // ──────────────────────────────────────────────────────

  router.get('/:id', authenticate, async (req, res) => {
    try {
      const contactResult = await pool.query(
        'SELECT * FROM contacts WHERE id = $1 AND customer_id = $2',
        [req.params.id, req.customerId]
      );
      if (!contactResult.rows[0]) return res.status(404).json({ error: 'Contact not found' });

      const contact = contactResult.rows[0];

      const convResult = await pool.query(
        `SELECT id, platform, last_message_at, last_message_preview, status, is_read, auto_reply_sent
         FROM dm_conversations
         WHERE customer_id = $1
           AND (sender_platform_id = $2 OR sender_platform_id = $3)
         ORDER BY last_message_at DESC`,
        [req.customerId, contact.facebook_psid || '', contact.instagram_igsid || '']
      );

      res.json({ contact, conversations: convResult.rows });
    } catch (err) {
      console.error('[Contacts] Get error:', err);
      res.status(500).json({ error: 'Failed to get contact' });
    }
  });

  // ──────────────────────────────────────────────────────
  // UPDATE CONTACT
  // ──────────────────────────────────────────────────────

  router.patch('/:id', authenticate, async (req, res) => {
    try {
      const { name, email, phone, notes, tags, leadStatus, jobType, estimatedJobValue, isCustomer } = req.body;

      const result = await pool.query(
        `UPDATE contacts SET
          name = COALESCE($1, name),
          email = COALESCE($2, email),
          phone = COALESCE($3, phone),
          notes = COALESCE($4, notes),
          tags = COALESCE($5, tags),
          lead_status = COALESCE($6, lead_status),
          job_type = COALESCE($7, job_type),
          estimated_job_value = COALESCE($8, estimated_job_value),
          is_customer = COALESCE($9, is_customer),
          updated_at = NOW()
         WHERE id = $10 AND customer_id = $11
         RETURNING *`,
        [
          name || null, email || null, phone || null, notes || null,
          tags != null ? JSON.stringify(tags) : null,
          leadStatus || null, jobType || null, estimatedJobValue || null,
          isCustomer != null ? isCustomer : null,
          req.params.id, req.customerId,
        ]
      );

      if (!result.rows[0]) return res.status(404).json({ error: 'Contact not found' });
      res.json({ success: true, contact: result.rows[0] });
    } catch (err) {
      console.error('[Contacts] Update error:', err);
      res.status(500).json({ error: 'Failed to update contact' });
    }
  });

  // ──────────────────────────────────────────────────────
  // DELETE CONTACT
  // ──────────────────────────────────────────────────────

  router.delete('/:id', authenticate, async (req, res) => {
    try {
      await pool.query(
        'DELETE FROM contacts WHERE id = $1 AND customer_id = $2',
        [req.params.id, req.customerId]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete contact' });
    }
  });

  return router;
};
