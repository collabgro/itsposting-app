const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticate, verifyAdmin } = require('../middleware/auth');
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
      const { search, plan, status, suspended, limit = 50, offset = 0 } = req.query;

      let query = `
        SELECT id, email, business_name, industry, location, plan, status,
               credits_balance, suspended, suspension_reason,
               is_admin, role, email_verified, created_at, last_login_at, trial_ends_at
        FROM customers WHERE 1=1
      `;
      const params = [];
      let p = 0;

      if (search) { p++; query += ` AND (email ILIKE $${p} OR business_name ILIKE $${p})`; params.push(`%${search}%`); }
      if (plan) { p++; query += ` AND plan = $${p}`; params.push(plan); }
      if (status) { p++; query += ` AND status = $${p}`; params.push(status); }
      if (suspended !== undefined && suspended !== '') { p++; query += ` AND suspended = $${p}`; params.push(suspended === 'true'); }

      query += ` ORDER BY created_at DESC LIMIT $${p + 1} OFFSET $${p + 2}`;
      params.push(parseInt(limit), parseInt(offset));

      const countQuery = query.replace(/SELECT[\s\S]+?FROM/, 'SELECT COUNT(*) FROM').replace(/ORDER BY[\s\S]+$/, '');
      const [data, count] = await Promise.all([
        pool.query(query, params),
        pool.query(countQuery, params.slice(0, -2)),
      ]);

      res.json({ customers: data.rows, total: parseInt(count.rows[0].count), limit: parseInt(limit), offset: parseInt(offset) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/admin/customers/:id
  router.get('/customers/:id', async (req, res) => {
    try {
      const [customer, posts, transactions, auditRows] = await Promise.all([
        pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]),
        pool.query('SELECT id, content_type, status, caption, created_at, credits_used FROM posts WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20', [req.params.id]),
        pool.query('SELECT * FROM credit_transactions WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 30', [req.params.id]),
        pool.query('SELECT * FROM admin_audit_log WHERE target_type = $1 AND target_id = $2 ORDER BY created_at DESC LIMIT 30', ['customer', req.params.id]),
      ]);

      if (customer.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      const c = customer.rows[0];
      delete c.password_hash;
      delete c.email_verification_token;
      delete c.password_reset_token;

      res.json({ customer: c, recentPosts: posts.rows, creditHistory: transactions.rows, adminActions: auditRows.rows });
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

      const newBalance = Math.max(0, parseInt(cur.rows[0].credits_balance) + amount);
      await client.query('UPDATE customers SET credits_balance = $1 WHERE id = $2', [newBalance, id]);
      await client.query(
        `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, amount > 0 ? 'admin_grant' : 'admin_deduction', amount, newBalance, `[ADMIN] ${reason}`]
      );
      await client.query('COMMIT');
      await audit.log(req.admin.id, req.admin.email, 'adjust_credits', 'customer', id, { amount, reason, newBalance }, req);

      // Queue notification email + in-app notification (non-blocking)
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

      // Queue suspension notification + in-app
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

      // Queue reactivation notification + in-app
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
      const hash = await bcrypt.hash(newPassword, 10);
      const result = await pool.query(
        'UPDATE customers SET password_hash = $1 WHERE id = $2 RETURNING email, business_name',
        [hash, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      await audit.log(req.admin.id, req.admin.email, 'reset_password', 'customer', req.params.id, {}, req);

      // Queue password reset notification + in-app
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

  // GET /api/admin/audit
  router.get('/audit', async (req, res) => {
    try {
      const { limit = 100, offset = 0 } = req.query;
      const result = await pool.query(
        'SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [parseInt(limit), parseInt(offset)]
      );
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ─── Email queue management ────────────────────────────────────────────────

  // GET /api/admin/email-queue
  router.get('/email-queue', async (req, res) => {
    try {
      const { status, limit = 50, offset = 0 } = req.query;
      const rows = await emailQueue.list({ status, limit, offset });

      const statsRes = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE status = 'sent')    AS sent,
          COUNT(*) FILTER (WHERE status = 'failed')  AS failed,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS last_24h
        FROM email_queue
      `);

      res.json({ emails: rows, stats: statsRes.rows[0] });
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

  return router;
};
