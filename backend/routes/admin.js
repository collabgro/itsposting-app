const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { authenticate, verifyAdmin } = require('../middleware/auth');
const ImageResizer = require('../services/ImageResizer');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const AuditLog = require('../services/AuditLog');
const EmailQueue = require('../services/EmailQueue');
const NotificationService = require('../services/NotificationService');

module.exports = (pool) => {
  const router = express.Router();
  const audit = new AuditLog(pool);
  const emailQueue = new EmailQueue(pool);
  const notif = new NotificationService(pool);

  const adminOnly = async (req, res, next) => {
    try {
      const admin = await verifyAdmin(pool, req.customerId);
      req.admin = admin;
      next();
    } catch (err) {
      const status = err.message === 'Admin access required' ? 403 : 401;
      res.status(status).json({ error: err.message });
    }
  };

  router.use(authenticate, adminOnly);

  const ALLOWED_CUSTOMER_SORT = ['created_at', 'credits_balance', 'business_name', 'last_login_at'];

  // GET /api/admin/stats
  router.get('/stats', async (req, res) => {
    try {
      const [users, posts, revenue, recent] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'trial') AS trial,
            COUNT(*) FILTER (WHERE status = 'active') AS active,
            COUNT(*) FILTER (WHERE suspended = true) AS suspended,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS new_this_week,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS new_this_month,
            COUNT(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '7 days') AS active_this_week
          FROM customers
        `),
        pool.query(`
          SELECT
            COUNT(*) AS total_posts,
            COUNT(*) FILTER (WHERE status = 'posted') AS posted,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS today,
            COALESCE(SUM(credits_used), 0) AS credits_consumed
          FROM posts
        `),
        pool.query(`
          SELECT plan, COUNT(*) AS count,
            SUM(CASE
              WHEN plan = 'starter' THEN 99
              WHEN plan = 'professional' THEN 199
              WHEN plan = 'premium' THEN 349
              ELSE 0
            END) AS mrr
          FROM customers
          WHERE status = 'active' AND suspended = false
          GROUP BY plan
        `),
        pool.query(`
          SELECT id, email, business_name, plan, status, created_at, suspended
          FROM customers ORDER BY created_at DESC LIMIT 10
        `),
      ]);

      const totalMRR = revenue.rows.reduce((sum, r) => sum + parseInt(r.mrr || 0), 0);

      res.json({
        users: users.rows[0],
        posts: posts.rows[0],
        revenue: { mrr: totalMRR, arr: totalMRR * 12, breakdown: revenue.rows },
        recentSignups: recent.rows,
      });
    } catch (err) {
      console.error('Admin stats error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/admin/customers
  router.get('/customers', async (req, res) => {
    try {
      const { search, plan, status, suspended, account_type, limit = 50, offset = 0, sort_by, sort_order } = req.query;

      const sortCol = ALLOWED_CUSTOMER_SORT.includes(sort_by) ? sort_by : 'created_at';
      const sortDir = sort_order === 'asc' ? 'ASC' : 'DESC';

      let where = 'WHERE 1=1';
      const params = [];
      let p = 0;

      if (search) { p++; where += ` AND (c.email ILIKE $${p} OR c.business_name ILIKE $${p})`; params.push(`%${search}%`); }
      if (plan) { p++; where += ` AND c.plan = $${p}`; params.push(plan); }
      if (status) { p++; where += ` AND c.status = $${p}`; params.push(status); }
      if (suspended !== undefined && suspended !== '') { p++; where += ` AND c.suspended = $${p}`; params.push(suspended === 'true'); }
      if (account_type === 'main') where += ' AND c.parent_customer_id IS NULL';
      if (account_type === 'workspace') where += ' AND c.parent_customer_id IS NOT NULL';

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM customers c LEFT JOIN customers p ON c.parent_customer_id = p.id ${where}`,
        params
      );

      const dataResult = await pool.query(
        `SELECT c.id, c.email, c.business_name, c.workspace_display_name,
                c.industry, c.location, c.plan, c.status,
                c.credits_balance, c.suspended, c.suspension_reason,
                c.is_admin, c.role, c.email_verified,
                c.created_at, c.last_login_at, c.trial_ends_at,
                c.parent_customer_id,
                p.business_name AS parent_business_name,
                (SELECT COUNT(*) FROM customers sub WHERE sub.parent_customer_id = c.id) AS workspace_count
         FROM customers c
         LEFT JOIN customers p ON c.parent_customer_id = p.id
         ${where}
         ORDER BY c.${sortCol} ${sortDir}
         LIMIT $${p + 1} OFFSET $${p + 2}`,
        [...params, parseInt(limit), parseInt(offset)]
      );

      res.json({
        customers: dataResult.rows,
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/admin/export/customers — CSV download
  router.get('/export/customers', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, email, business_name, industry, location, plan, status,
                credits_balance, suspended, created_at, last_login_at
         FROM customers ORDER BY created_at DESC`
      );

      const header = 'id,email,business_name,industry,location,plan,status,credits_balance,suspended,created_at,last_login_at\n';
      const rows = result.rows.map(r =>
        [r.id, r.email, `"${(r.business_name || '').replace(/"/g, '""')}"`,
         r.industry || '', r.location || '', r.plan, r.status,
         r.credits_balance, r.suspended,
         r.created_at ? new Date(r.created_at).toISOString() : '',
         r.last_login_at ? new Date(r.last_login_at).toISOString() : ''].join(',')
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
      res.send(header + rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/admin/customers/:id
  router.get('/customers/:id', async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      const customerRes = await pool.query('SELECT * FROM customers WHERE id = $1', [customerId]);
      if (customerRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      const c = customerRes.rows[0];
      delete c.password_hash;
      delete c.email_verification_token;
      delete c.password_reset_token;

      const [posts, transactions, auditRows, parentRes, childrenRes] = await Promise.all([
        pool.query('SELECT id, content_type, status, caption, created_at, credits_used FROM posts WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20', [customerId]),
        pool.query('SELECT * FROM credit_transactions WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 30', [customerId]),
        pool.query('SELECT * FROM admin_audit_log WHERE target_type = $1 AND target_id = $2 ORDER BY created_at DESC LIMIT 30', ['customer', customerId]),
        c.parent_customer_id
          ? pool.query('SELECT id, business_name, email, plan, status FROM customers WHERE id = $1', [c.parent_customer_id])
          : Promise.resolve({ rows: [] }),
        pool.query(
          `SELECT id, business_name, workspace_display_name, industry, location, status, created_at
           FROM customers WHERE parent_customer_id = $1 ORDER BY created_at ASC`,
          [customerId]
        ),
      ]);

      res.json({
        customer: c,
        recentPosts: posts.rows,
        creditHistory: transactions.rows,
        adminActions: auditRows.rows,
        parentAccount: parentRes.rows[0] || null,
        workspaces: childrenRes.rows,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/admin/customers/:id
  router.patch('/customers/:id', async (req, res) => {
    try {
      const { businessName, industry, plan, status, notes } = req.body;
      const id = req.params.id;

      const result = await pool.query(
        `UPDATE customers SET
          business_name = COALESCE($1, business_name),
          industry = COALESCE($2, industry),
          plan = COALESCE($3, plan),
          status = COALESCE($4, status),
          notes = COALESCE($5, notes),
          updated_at = NOW()
         WHERE id = $6 RETURNING *`,
        [businessName, industry, plan, status, notes, id]
      );

      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      await audit.log(req.admin.id, req.admin.email, 'update_customer', 'customer', id, { changes: req.body }, req);
      delete result.rows[0].password_hash;
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/admin/customers/:id/credits
  router.post('/customers/:id/credits', async (req, res) => {
    const client = await pool.connect();
    try {
      const { amount, reason } = req.body;
      const id = req.params.id;
      if (typeof amount !== 'number' || amount === 0) return res.status(400).json({ error: 'Amount must be a non-zero number' });
      if (!reason || reason.length < 3) return res.status(400).json({ error: 'Reason required (min 3 chars)' });

      await client.query('BEGIN');
      const cur = await client.query('SELECT credits_balance, email, business_name FROM customers WHERE id = $1', [id]);
      if (cur.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }

      const newBalance = parseInt(cur.rows[0].credits_balance) + amount;
      if (newBalance < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Cannot deduct ${Math.abs(amount)} credits — customer only has ${cur.rows[0].credits_balance}.` });
      }
      await client.query('UPDATE customers SET credits_balance = $1 WHERE id = $2', [newBalance, id]);
      await client.query(
        `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, amount > 0 ? 'admin_grant' : 'admin_deduction', amount, newBalance, `[ADMIN] ${reason}`]
      );
      await client.query('COMMIT');
      await audit.log(req.admin.id, req.admin.email, 'adjust_credits', 'customer', id, { amount, reason, newBalance }, req);

      emailQueue.notifyCreditsAdjusted(cur.rows[0], amount, newBalance, reason);
      notif.creditsAdjusted(id, amount, newBalance, reason);

      res.json({ success: true, newBalance });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // POST /api/admin/customers/:id/suspend
  router.post('/customers/:id/suspend', async (req, res) => {
    try {
      const { reason } = req.body;
      if (!reason) return res.status(400).json({ error: 'Suspension reason required' });

      const result = await pool.query(
        'UPDATE customers SET suspended = true, suspension_reason = $1, updated_at = NOW() WHERE id = $2 RETURNING email, business_name',
        [reason, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      await audit.log(req.admin.id, req.admin.email, 'suspend_customer', 'customer', req.params.id, { reason }, req);

      emailQueue.notifySuspended(result.rows[0], reason);
      notif.accountSuspended(req.params.id, reason);

      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/customers/:id/reactivate
  router.post('/customers/:id/reactivate', async (req, res) => {
    try {
      const result = await pool.query(
        'UPDATE customers SET suspended = false, suspension_reason = NULL, updated_at = NOW() WHERE id = $1 RETURNING email, business_name',
        [req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      await audit.log(req.admin.id, req.admin.email, 'reactivate_customer', 'customer', req.params.id, {}, req);

      emailQueue.notifyReactivated(result.rows[0]);
      notif.accountReactivated(req.params.id);

      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/customers/:id/reset-password
  router.post('/customers/:id/reset-password', async (req, res) => {
    try {
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Password must be 8+ chars' });
      const hash = await bcrypt.hash(newPassword, 12);
      const result = await pool.query(
        'UPDATE customers SET password_hash = $1 WHERE id = $2 RETURNING email, business_name',
        [hash, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      await audit.log(req.admin.id, req.admin.email, 'reset_password', 'customer', req.params.id, {}, req);

      emailQueue.notifyPasswordResetByAdmin(result.rows[0]);
      notif.passwordResetByAdmin(req.params.id);

      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/customers/:id/promote
  router.post('/customers/:id/promote', async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE customers SET is_admin = true, role = 'admin' WHERE id = $1 RETURNING email`,
        [req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      await audit.log(req.admin.id, req.admin.email, 'promote_admin', 'customer', req.params.id, {}, req);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/customers/:id/demote
  router.post('/customers/:id/demote', async (req, res) => {
    try {
      if (parseInt(req.params.id) === req.admin.id) return res.status(400).json({ error: 'Cannot demote yourself' });
      const result = await pool.query(
        `UPDATE customers SET is_admin = false, role = 'customer' WHERE id = $1 RETURNING email`,
        [req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      await audit.log(req.admin.id, req.admin.email, 'demote_admin', 'customer', req.params.id, {}, req);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/customers/:id/impersonate
  router.post('/customers/:id/impersonate', async (req, res) => {
    try {
      const target = await pool.query(
        'SELECT id, email, business_name, is_admin, suspended FROM customers WHERE id = $1',
        [req.params.id]
      );
      if (target.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
      const c = target.rows[0];
      if (c.is_admin) return res.status(400).json({ error: 'Cannot impersonate an admin account' });
      if (c.suspended) return res.status(400).json({ error: 'Cannot impersonate a suspended account' });

      const token = jwt.sign(
        { customerId: c.id, email: c.email, impersonating: true, impersonatorId: req.admin.id },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      await audit.log(
        req.admin.id, req.admin.email,
        'impersonate', 'customer', req.params.id,
        { admin_email: req.admin.email, customer_email: c.email },
        req
      );

      res.json({ token, businessName: c.business_name || c.email });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/admin/audit
  router.get('/audit', async (req, res) => {
    try {
      const { limit = 50, offset = 0, action_type, admin_email, date_from, date_to } = req.query;

      let where = 'WHERE 1=1';
      const params = [];
      let p = 0;

      if (action_type) { p++; where += ` AND action = $${p}`; params.push(action_type); }
      if (admin_email) { p++; where += ` AND admin_email ILIKE $${p}`; params.push(`%${admin_email}%`); }
      if (date_from) { p++; where += ` AND created_at >= $${p}`; params.push(date_from); }
      if (date_to) { p++; where += ` AND created_at <= $${p}`; params.push(date_to); }

      const [data, count] = await Promise.all([
        pool.query(
          `SELECT * FROM admin_audit_log ${where} ORDER BY created_at DESC LIMIT $${p + 1} OFFSET $${p + 2}`,
          [...params, parseInt(limit), parseInt(offset)]
        ),
        pool.query(`SELECT COUNT(*) FROM admin_audit_log ${where}`, params),
      ]);

      res.json({ entries: data.rows, total: parseInt(count.rows[0].count), limit: parseInt(limit), offset: parseInt(offset) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ─── Email queue management ────────────────────────────────────────────────

  // GET /api/admin/email-queue
  router.get('/email-queue', async (req, res) => {
    try {
      const { status, limit = 50, offset = 0, template, recipient } = req.query;

      let where = 'WHERE 1=1';
      const params = [];
      let p = 0;

      if (status) { p++; where += ` AND eq.status = $${p}`; params.push(status); }
      if (template) { p++; where += ` AND eq.template_name = $${p}`; params.push(template); }
      if (recipient) { p++; where += ` AND eq.to_email ILIKE $${p}`; params.push(`%${recipient}%`); }

      const [data, count, stats] = await Promise.all([
        pool.query(
          `SELECT eq.* FROM email_queue eq ${where} ORDER BY eq.created_at DESC LIMIT $${p + 1} OFFSET $${p + 2}`,
          [...params, parseInt(limit), parseInt(offset)]
        ),
        pool.query(`SELECT COUNT(*) FROM email_queue eq ${where}`, params),
        pool.query(`
          SELECT
            COUNT(*) FILTER (WHERE status = 'pending') AS pending,
            COUNT(*) FILTER (WHERE status = 'sent')    AS sent,
            COUNT(*) FILTER (WHERE status = 'failed')  AS failed,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS last_24h
          FROM email_queue
        `),
      ]);

      res.json({
        emails: data.rows,
        total: parseInt(count.rows[0].count),
        stats: stats.rows[0],
        limit: parseInt(limit),
        offset: parseInt(offset),
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/email-queue/:id/retry
  router.post('/email-queue/:id/retry', async (req, res) => {
    try {
      await emailQueue.retryFailed(parseInt(req.params.id));
      await audit.log(req.admin.id, req.admin.email, 'retry_email', 'email_queue', req.params.id, {}, req);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/email-queue/retry-all
  router.post('/email-queue/retry-all', async (req, res) => {
    try {
      const count = await emailQueue.retryAllFailed();
      await audit.log(req.admin.id, req.admin.email, 'retry_all_failed_emails', 'email_queue', null, { count }, req);
      res.json({ success: true, count });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ─── Post moderation ──────────────────────────────────────────────────────

  // GET /api/admin/posts
  router.get('/posts', async (req, res) => {
    try {
      const { customer_id, platform, status, content_type, date_from, date_to, limit = 25, offset = 0 } = req.query;

      let where = 'WHERE 1=1';
      const params = [];
      let p = 0;

      if (customer_id) { p++; where += ` AND p.customer_id = $${p}`; params.push(parseInt(customer_id)); }
      if (platform) { p++; where += ` AND p.platform = $${p}`; params.push(platform); }
      if (status) { p++; where += ` AND p.status = $${p}`; params.push(status); }
      if (content_type) { p++; where += ` AND p.content_type = $${p}`; params.push(content_type); }
      if (date_from) { p++; where += ` AND p.created_at >= $${p}`; params.push(date_from); }
      if (date_to) { p++; where += ` AND p.created_at <= $${p}`; params.push(date_to); }

      const [data, count] = await Promise.all([
        pool.query(
          `SELECT p.id, p.customer_id, c.business_name, c.email,
                  LEFT(p.caption, 120) AS caption, p.platform, p.status,
                  p.content_type, p.created_at, p.image_url
           FROM posts p
           JOIN customers c ON c.id = p.customer_id
           ${where}
           ORDER BY p.created_at DESC
           LIMIT $${p + 1} OFFSET $${p + 2}`,
          [...params, parseInt(limit), parseInt(offset)]
        ),
        pool.query(
          `SELECT COUNT(*) FROM posts p JOIN customers c ON c.id = p.customer_id ${where}`,
          params
        ),
      ]);

      res.json({ posts: data.rows, total: parseInt(count.rows[0].count), limit: parseInt(limit), offset: parseInt(offset) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // DELETE /api/admin/posts/:id
  router.delete('/posts/:id', async (req, res) => {
    try {
      const { reason } = req.body;
      if (!reason || reason.length < 5) return res.status(400).json({ error: 'Reason required (min 5 chars)' });

      const post = await pool.query('SELECT id, customer_id, caption FROM posts WHERE id = $1', [req.params.id]);
      if (post.rows.length === 0) return res.status(404).json({ error: 'Post not found' });

      await pool.query(
        `UPDATE posts SET status = 'removed_by_admin', updated_at = NOW() WHERE id = $1`,
        [req.params.id]
      );

      await audit.log(
        req.admin.id, req.admin.email,
        'remove_post', 'post', req.params.id,
        { reason, customer_id: post.rows[0].customer_id },
        req
      );

      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ─── Broadcast / Announcements ────────────────────────────────────────────

  const broadcastLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => `broadcast-${req.admin?.id || 'unknown'}`,
    message: { error: 'Broadcast rate limit: max 5 per hour' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // POST /api/admin/broadcast
  router.post('/broadcast', broadcastLimiter, async (req, res) => {
    try {
      const { title, message, target_segment, delivery_method } = req.body;
      if (!title || !title.trim()) return res.status(400).json({ error: 'Title required' });
      if (!message || !message.trim()) return res.status(400).json({ error: 'Message required' });
      if (!target_segment) return res.status(400).json({ error: 'Target segment required' });
      if (!delivery_method) return res.status(400).json({ error: 'Delivery method required' });

      const VALID_SEGMENTS = ['all', 'trial', 'starter', 'professional', 'premium', 'inactive'];
      const VALID_DELIVERY = ['notification', 'email', 'both'];
      if (!VALID_SEGMENTS.includes(target_segment)) return res.status(400).json({ error: 'Invalid segment' });
      if (!VALID_DELIVERY.includes(delivery_method)) return res.status(400).json({ error: 'Invalid delivery method' });

      // Build segment query
      let segWhere = 'WHERE suspended = false';
      if (target_segment === 'trial') segWhere += ` AND status = 'trial'`;
      else if (target_segment === 'starter') segWhere += ` AND plan = 'starter' AND status = 'active'`;
      else if (target_segment === 'professional') segWhere += ` AND plan = 'professional' AND status = 'active'`;
      else if (target_segment === 'premium') segWhere += ` AND plan = 'premium' AND status = 'active'`;
      else if (target_segment === 'inactive') segWhere += ` AND (last_login_at < NOW() - INTERVAL '14 days' OR last_login_at IS NULL)`;

      const targets = await pool.query(
        `SELECT id, email, business_name FROM customers ${segWhere}`
      );

      const sendNotif = delivery_method === 'notification' || delivery_method === 'both';
      const sendEmail = delivery_method === 'email' || delivery_method === 'both';

      // Fire all notifications/emails non-blocking
      for (const customer of targets.rows) {
        if (sendNotif) {
          notif.create(customer.id, 'system', title, message);
        }
        if (sendEmail) {
          emailQueue.queue(customer.email, 'admin_broadcast', {
            businessName: customer.business_name || customer.email,
            title,
            message,
          });
        }
      }

      // Ensure admin_broadcasts table exists and record this broadcast
      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_broadcasts (
          id SERIAL PRIMARY KEY,
          admin_id INTEGER REFERENCES customers(id),
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          target_segment VARCHAR(50) NOT NULL,
          delivery_method VARCHAR(20) NOT NULL,
          sent_to_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await pool.query(
        `INSERT INTO admin_broadcasts (admin_id, title, message, target_segment, delivery_method, sent_to_count)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.admin.id, title.trim(), message.trim(), target_segment, delivery_method, targets.rows.length]
      );

      await audit.log(
        req.admin.id, req.admin.email,
        'broadcast', 'system', null,
        { title, target_segment, delivery_method, sentTo: targets.rows.length },
        req
      );

      res.json({ success: true, sentTo: targets.rows.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/admin/broadcasts
  router.get('/broadcasts', async (req, res) => {
    try {
      // Table may not exist yet if no broadcast has been sent
      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_broadcasts (
          id SERIAL PRIMARY KEY,
          admin_id INTEGER REFERENCES customers(id),
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          target_segment VARCHAR(50) NOT NULL,
          delivery_method VARCHAR(20) NOT NULL,
          sent_to_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      const result = await pool.query(`
        SELECT ab.*, c.email AS admin_email
        FROM admin_broadcasts ab
        LEFT JOIN customers c ON c.id = ab.admin_id
        ORDER BY ab.created_at DESC
        LIMIT 20
      `);

      res.json({ broadcasts: result.rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/admin/health
  router.get('/health', async (req, res) => {
    try {
      const [dbCheck, recentErrors, emailStats] = await Promise.all([
        pool.query('SELECT NOW(), version()'),
        pool.query(`SELECT COUNT(*) FROM posts WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours'`),
        pool.query(`
          SELECT
            COUNT(*) FILTER (WHERE status = 'pending') AS email_pending,
            COUNT(*) FILTER (WHERE status = 'failed')  AS email_failed
          FROM email_queue
        `),
      ]);
      res.json({
        status: 'healthy',
        database: { connected: true, version: dbCheck.rows[0].version.split(' ').slice(0, 2).join(' '), time: dbCheck.rows[0].now },
        services: {
          anthropic: !!process.env.ANTHROPIC_API_KEY,
          nanobanana: !!process.env.GOOGLE_AI_API_KEY,
          midjourney: !!process.env.REPLICATE_API_TOKEN,
          heygen: !!process.env.HEYGEN_API_KEY,
          cloudinary: !!process.env.CLOUDINARY_CLOUD_NAME,
          email: process.env.EMAIL_PROVIDER || 'log',
        },
        errors24h: parseInt(recentErrors.rows[0].count),
        emailQueue: {
          pending: parseInt(emailStats.rows[0].email_pending),
          failed: parseInt(emailStats.rows[0].email_failed),
        },
      });
    } catch (err) { res.status(500).json({ status: 'error', error: err.message }); }
  });

  // ── Stock Photo Library (admin-managed) ─────────────────────────────────────

  const stockUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (/jpeg|jpg|png|webp/.test(file.mimetype)) cb(null, true);
      else cb(new Error('Only jpeg, png and webp images are accepted'));
    },
  });

  // POST /api/admin/stock-photos
  router.post('/stock-photos', stockUpload.array('files', 20), async (req, res) => {
    try {
      const { industry, category, tags: tagsRaw, title, description } = req.body;
      if (!industry || !category) return res.status(400).json({ error: 'industry and category are required' });
      if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'At least one image file is required' });

      const tagsArr = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
      const created = [];

      for (const file of req.files) {
        // Resize to 1080×1350 master
        const sharp = require('sharp');
        const masterBuffer = await sharp(file.buffer)
          .rotate()
          .resize(1080, 1350, { fit: 'cover', position: 'centre' })
          .jpeg({ quality: 85 })
          .toBuffer();

        // Generate 300px thumbnail
        const thumbBuffer = await ImageResizer.generateThumbnail(file.buffer, 300, 400);

        // Upload both to Cloudinary
        const publicId = `itsposting/stock-photos/${industry}/${crypto.randomBytes(16).toString('hex')}`;
        const [url, thumbnail_url] = await Promise.all([
          ImageResizer.uploadToCloudinary(masterBuffer, publicId),
          ImageResizer.uploadToCloudinary(thumbBuffer, publicId + '_thumb'),
        ]);

        const { rows: [photo] } = await pool.query(
          `INSERT INTO stock_photos (industry, category, tags, url, thumbnail_url, cloudinary_public_id, title, description, width, height, file_size_bytes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1080, 1350, $9)
           RETURNING *`,
          [industry, category, tagsArr, url, thumbnail_url, publicId, title || file.originalname, description || null, file.size]
        );
        created.push(photo);
      }

      await audit.log(req.admin.id, req.admin.email, 'stock_photos_upload', 'stock_photos', null, { count: created.length, industry, category }, req);
      res.json({ created, count: created.length });
    } catch (err) {
      console.error('[Admin] POST /stock-photos:', err.message);
      res.status(500).json({ error: err.message || 'Failed to upload stock photos' });
    }
  });

  // GET /api/admin/stock-photos
  router.get('/stock-photos', async (req, res) => {
    try {
      const { industry, category, search, active, limit: rawLimit = 40, offset: rawOffset = 0 } = req.query;
      const limit = Math.min(parseInt(rawLimit) || 40, 100);
      const offset = Math.max(parseInt(rawOffset) || 0, 0);

      const conditions = [];
      const params = [];
      let p = 1;
      if (industry) { conditions.push(`industry = $${p++}`); params.push(industry); }
      if (category) { conditions.push(`category = $${p++}`); params.push(category); }
      if (search)   { conditions.push(`(title ILIKE $${p++})`); params.push(`%${search}%`); }
      if (active === 'true')  { conditions.push(`is_active = true`); }
      if (active === 'false') { conditions.push(`is_active = false`); }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(limit, offset);

      const { rows: photos } = await pool.query(
        `SELECT * FROM stock_photos ${where} ORDER BY created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
        params
      );
      const { rows: [{ count }] } = await pool.query(
        `SELECT COUNT(*) FROM stock_photos ${where}`,
        params.slice(0, -2)
      );

      res.json({ photos, total: parseInt(count) });
    } catch (err) {
      console.error('[Admin] GET /stock-photos:', err.message);
      res.status(500).json({ error: 'Failed to fetch stock photos' });
    }
  });

  // PATCH /api/admin/stock-photos/:id
  router.patch('/stock-photos/:id', async (req, res) => {
    try {
      const photoId = parseInt(req.params.id);
      const { industry, category, tags, title, description, is_active } = req.body;
      const tagsArr = Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined);

      const { rows: [photo] } = await pool.query(
        `UPDATE stock_photos SET
           industry    = COALESCE($1, industry),
           category    = COALESCE($2, category),
           tags        = COALESCE($3, tags),
           title       = COALESCE($4, title),
           description = COALESCE($5, description),
           is_active   = COALESCE($6, is_active)
         WHERE id = $7
         RETURNING *`,
        [industry || null, category || null, tagsArr || null, title || null, description || null, is_active !== undefined ? is_active : null, photoId]
      );
      if (!photo) return res.status(404).json({ error: 'Photo not found' });
      res.json({ photo });
    } catch (err) {
      console.error('[Admin] PATCH /stock-photos/:id:', err.message);
      res.status(500).json({ error: 'Failed to update photo' });
    }
  });

  // DELETE /api/admin/stock-photos/:id  (soft-delete)
  router.delete('/stock-photos/:id', async (req, res) => {
    try {
      const photoId = parseInt(req.params.id);
      const { rowCount } = await pool.query(
        'UPDATE stock_photos SET is_active = false WHERE id = $1',
        [photoId]
      );
      if (!rowCount) return res.status(404).json({ error: 'Photo not found' });
      await audit.log(req.admin.id, req.admin.email, 'stock_photo_delete', 'stock_photos', photoId, {}, req);
      res.json({ success: true });
    } catch (err) {
      console.error('[Admin] DELETE /stock-photos/:id:', err.message);
      res.status(500).json({ error: 'Failed to delete photo' });
    }
  });

  return router;
};
