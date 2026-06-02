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
            COUNT(*) FILTER (WHERE is_admin = false) AS total,
            COUNT(*) FILTER (WHERE is_admin = false AND status = 'trial') AS trial,
            COUNT(*) FILTER (WHERE is_admin = false AND status = 'active') AS active,
            COUNT(*) FILTER (WHERE is_admin = false AND suspended = true) AS suspended,
            COUNT(*) FILTER (WHERE is_admin = false AND created_at > NOW() - INTERVAL '7 days') AS new_this_week,
            COUNT(*) FILTER (WHERE is_admin = false AND created_at > NOW() - INTERVAL '30 days') AS new_this_month,
            COUNT(*) FILTER (WHERE is_admin = false AND last_login_at > NOW() - INTERVAL '7 days') AS active_this_week
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
          WHERE status = 'active' AND (suspended = false OR suspended IS NULL) AND is_admin = false
          GROUP BY plan
        `),
        pool.query(`
          SELECT id, email, business_name, plan, status, created_at, suspended
          FROM customers WHERE is_admin = false ORDER BY created_at DESC LIMIT 10
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
      if (account_type === 'main')      where += ' AND c.parent_customer_id IS NULL AND c.is_admin = false';
      else if (account_type === 'workspace') where += ' AND c.parent_customer_id IS NOT NULL';
      else if (account_type === 'admin')     where += ' AND c.is_admin = true';
      else                                   where += ' AND c.is_admin = false'; // default: exclude platform admins from customer view

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
         FROM customers WHERE is_admin = false ORDER BY created_at DESC`
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

  // POST /api/admin/customers/:id/plan
  router.post('/customers/:id/plan', async (req, res) => {
    const PLAN_CREDITS = { trial: 10, starter: 50, professional: 100, premium: 150, agency: 200 };
    const client = await pool.connect();
    try {
      const { plan, billingCycle = 'monthly', allocateCredits = true, reason } = req.body;
      const id = req.params.id;

      if (!PLAN_CREDITS.hasOwnProperty(plan)) {
        return res.status(400).json({ error: 'Invalid plan. Must be trial, starter, professional, premium, or agency.' });
      }
      if (!reason || reason.trim().length < 3) {
        return res.status(400).json({ error: 'Reason required (min 3 chars)' });
      }

      await client.query('BEGIN');
      const cur = await client.query('SELECT id, credits_balance, plan FROM customers WHERE id = $1 FOR UPDATE', [id]);
      if (cur.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Customer not found' }); }

      const currentBalance = parseInt(cur.rows[0].credits_balance) || 0;
      const planCredits = PLAN_CREDITS[plan];
      const newBalance = allocateCredits ? currentBalance + planCredits : currentBalance;

      const now = new Date();
      let expiresAt;
      if (plan === 'trial') {
        expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (billingCycle === 'yearly') {
        expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      } else {
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      await client.query(
        `UPDATE customers SET
          plan = $1,
          status = 'active',
          billing_cycle = $2,
          plan_expires_at = $3,
          next_billing_date = $3,
          plan_changed_at = NOW(),
          credits_used_this_month = 0,
          credits_balance = $4,
          updated_at = NOW()
         WHERE id = $5`,
        [plan, plan === 'trial' ? null : billingCycle, expiresAt, newBalance, id]
      );

      if (allocateCredits) {
        await client.query(
          `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
           VALUES ($1, 'admin_grant', $2, $3, $4)`,
          [id, planCredits, newBalance, `[ADMIN] Plan changed to ${plan} — ${reason.trim()}`]
        );
      }

      await client.query('COMMIT');
      await audit.log(req.admin.id, req.admin.email, 'change_plan', 'customer', id, { plan, billingCycle, allocateCredits, reason, newBalance }, req);

      const updated = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
      delete updated.rows[0].password_hash;
      res.json(updated.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
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
    const client = await pool.connect();
    try {
      const { role = 'support' } = req.body;
      const VALID_ADMIN_ROLES = ['super_admin', 'support', 'finance'];
      if (!VALID_ADMIN_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Role must be super_admin, support, or finance' });
      }

      // Only super_admin can promote; legacy is_admin without a platform_admins row is treated as super_admin
      const callerRole = req.admin.admin_role || (req.admin.is_admin ? 'super_admin' : null);
      if (callerRole !== 'super_admin') {
        return res.status(403).json({ error: 'Only super_admin can promote users' });
      }

      const targetId = parseInt(req.params.id);
      const check = await pool.query('SELECT id, email FROM customers WHERE id = $1', [targetId]);
      if (!check.rows.length) return res.status(404).json({ error: 'Not found' });

      await client.query('BEGIN');
      // Upsert into platform_admins — handles re-promote after a previous demote
      await client.query(
        `INSERT INTO platform_admins (customer_id, admin_role, granted_by, granted_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (customer_id) DO UPDATE
           SET admin_role  = EXCLUDED.admin_role,
               granted_by  = EXCLUDED.granted_by,
               granted_at  = NOW(),
               revoked_at  = NULL,
               updated_at  = NOW()`,
        [targetId, role, req.admin.id]
      );
      // Keep is_admin flag in sync as a fast-path cache
      await client.query(
        `UPDATE customers SET is_admin = true, role = $1 WHERE id = $2`,
        [role, targetId]
      );
      await client.query('COMMIT');

      await audit.log(req.admin.id, req.admin.email, 'promote_admin', 'customer', req.params.id, { role }, req);
      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // POST /api/admin/customers/:id/demote
  router.post('/customers/:id/demote', async (req, res) => {
    const client = await pool.connect();
    try {
      const targetId = parseInt(req.params.id);
      if (targetId === req.admin.id) return res.status(400).json({ error: 'Cannot demote yourself' });

      const callerRole = req.admin.admin_role || (req.admin.is_admin ? 'super_admin' : null);
      if (callerRole !== 'super_admin') {
        return res.status(403).json({ error: 'Only super_admin can demote users' });
      }

      // Prevent locking out all super_admins
      const otherSuperAdmins = await pool.query(
        `SELECT COUNT(*) FROM platform_admins
         WHERE admin_role = 'super_admin' AND revoked_at IS NULL AND customer_id != $1`,
        [targetId]
      );
      if (parseInt(otherSuperAdmins.rows[0].count) === 0) {
        // Check if the target is actually a super_admin before blocking
        const targetRow = await pool.query(
          `SELECT admin_role FROM platform_admins WHERE customer_id = $1 AND revoked_at IS NULL`,
          [targetId]
        );
        if (targetRow.rows[0]?.admin_role === 'super_admin') {
          return res.status(400).json({ error: 'Cannot demote the last super_admin' });
        }
      }

      await client.query('BEGIN');
      const pa = await client.query(
        `UPDATE platform_admins SET revoked_at = NOW(), updated_at = NOW()
         WHERE customer_id = $1 AND revoked_at IS NULL RETURNING id`,
        [targetId]
      );
      await client.query(
        `UPDATE customers SET is_admin = false, role = 'customer' WHERE id = $1`,
        [targetId]
      );
      await client.query('COMMIT');

      if (!pa.rows.length) return res.status(404).json({ error: 'Admin record not found' });
      await audit.log(req.admin.id, req.admin.email, 'demote_admin', 'customer', req.params.id, {}, req);
      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
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
        provider: process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? 'resend' : 'log'),
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

  // POST /api/admin/email-queue/test — diagnose the full email pipeline
  router.post('/email-queue/test', async (req, res) => {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: 'to email required' });

    const results = { to, steps: [] };

    // Step 1: verify email_queue table exists and INSERT works
    try {
      const insertRes = await pool.query(
        `INSERT INTO email_queue (to_email, template_name, template_data, scheduled_at)
         VALUES ($1, $2, $3::jsonb, NOW()) RETURNING id`,
        [to, 'password_reset', JSON.stringify({ resetUrl: 'https://app.itsposting.com/reset-password?token=admin-test' })]
      );
      results.steps.push({ step: 'db_insert', ok: true, id: insertRes.rows[0].id });
    } catch (err) {
      results.steps.push({ step: 'db_insert', ok: false, error: err.message });
      return res.status(500).json({ ...results, fatal: 'email_queue INSERT failed — table may be missing or schema mismatch' });
    }

    // Step 2: try sending directly via Resend right now (don't wait for worker)
    try {
      const EmailService = require('../services/EmailService');
      const svc = new EmailService();
      const rendered = svc.renderTemplate('password_reset', { resetUrl: 'https://app.itsposting.com/reset-password?token=admin-test' });
      const result = await svc.send({ to, subject: rendered.subject, html: rendered.html, text: rendered.text });
      results.steps.push({ step: 'resend_direct', ok: true, provider: svc.provider, id: result.id });
    } catch (err) {
      results.steps.push({ step: 'resend_direct', ok: false, error: err.message });
    }

    res.json({ ...results, message: 'Check steps array for details.' });
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
                  p.content_type, p.created_at, p.media_url
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
      let segWhere = 'WHERE (suspended = false OR suspended IS NULL)';
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

  // ─── Canvas Templates — Admin Management ────────────────────────────────────

  // GET /api/admin/canvas-templates
  router.get('/canvas-templates', authenticate, adminOnly, async (req, res) => {
    try {
      const { industry, category, show_inactive, search, page = 1, limit = 60 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const conditions = [];
      const params = [];
      if (show_inactive !== 'true') conditions.push('ct.is_active = true');
      if (industry && industry !== 'all') { conditions.push(`ct.industry = $${params.length + 1}`); params.push(industry); }
      if (category && category !== 'all') { conditions.push(`ct.category = $${params.length + 1}`); params.push(category); }
      if (search) { conditions.push(`ct.name ILIKE $${params.length + 1}`); params.push(`%${search.slice(0, 100)}%`); }
      const whereSQL = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const countParams = [...params];
      params.push(parseInt(limit));
      params.push(offset);
      const [dataRes, countRes] = await Promise.all([
        pool.query(`SELECT ct.id, ct.name, ct.industry, ct.category, ct.thumbnail_url,
            ct.canvas_width, ct.canvas_height, ct.sort_order, ct.is_active, ct.created_at,
            COUNT(sc.id)::int AS usage_count
          FROM canvas_templates ct
          LEFT JOIN studio_creations sc ON sc.template_id = ct.id
          ${whereSQL}
          GROUP BY ct.id
          ORDER BY ct.sort_order ASC, ct.created_at DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
        pool.query(`SELECT COUNT(*) FROM canvas_templates ct ${whereSQL}`, countParams),
      ]);
      res.json({ templates: dataRes.rows, total: parseInt(countRes.rows[0].count) });
    } catch (err) {
      console.error('[Admin] GET /canvas-templates:', err.message);
      res.status(500).json({ error: 'Failed to load canvas templates' });
    }
  });

  // POST /api/admin/canvas-templates/bulk — bulk operations
  router.post('/canvas-templates/bulk', authenticate, adminOnly, async (req, res) => {
    try {
      const { ids, action, industry } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids required' });
      const safeIds = ids.map(Number).filter(n => Number.isInteger(n) && n > 0);
      if (safeIds.length === 0) return res.status(400).json({ error: 'No valid ids' });
      const placeholders = safeIds.map((_, i) => `$${i + 1}`).join(',');
      let updated = 0;
      if (action === 'activate') {
        const { rowCount } = await pool.query(`UPDATE canvas_templates SET is_active = true WHERE id IN (${placeholders})`, safeIds);
        updated = rowCount;
      } else if (action === 'deactivate') {
        const { rowCount } = await pool.query(`UPDATE canvas_templates SET is_active = false WHERE id IN (${placeholders})`, safeIds);
        updated = rowCount;
      } else if (action === 'set_industry') {
        if (!industry) return res.status(400).json({ error: 'industry required' });
        const { rowCount } = await pool.query(
          `UPDATE canvas_templates SET industry = $${safeIds.length + 1} WHERE id IN (${placeholders})`,
          [...safeIds, industry]
        );
        updated = rowCount;
      } else {
        return res.status(400).json({ error: 'Unknown action' });
      }
      await audit.log(req.admin.id, req.admin.email, 'canvas_template_bulk', 'canvas_templates', null, { action, ids: safeIds, industry }, req);
      res.json({ success: true, updated });
    } catch (err) {
      console.error('[Admin] POST /canvas-templates/bulk:', err.message);
      res.status(500).json({ error: 'Bulk operation failed' });
    }
  });

  // POST /api/admin/canvas-templates
  router.post('/canvas-templates', authenticate, adminOnly, async (req, res) => {
    try {
      const { name, industry = 'general', category = 'general', canvas_json, canvas_width = 1080, canvas_height = 1350, sort_order = 0 } = req.body;
      if (!name) return res.status(400).json({ error: 'name is required' });
      const { rows: [tmpl] } = await pool.query(
        `INSERT INTO canvas_templates (name, industry, category, canvas_json, canvas_width, canvas_height, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [name, industry, category, canvas_json ? JSON.stringify(canvas_json) : '{}', canvas_width, canvas_height, sort_order]
      );
      await audit.log(req.admin.id, req.admin.email, 'canvas_template_create', 'canvas_templates', tmpl.id, { name, industry }, req);
      res.status(201).json({ template: tmpl });
    } catch (err) {
      console.error('[Admin] POST /canvas-templates:', err.message);
      res.status(500).json({ error: 'Failed to create canvas template' });
    }
  });

  // PATCH /api/admin/canvas-templates/:id
  router.patch('/canvas-templates/:id', authenticate, adminOnly, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, industry, category, sort_order, is_active } = req.body;
      const sets = [];
      const params = [];
      if (name !== undefined) { sets.push(`name = $${params.length + 1}`); params.push(name.slice(0, 255)); }
      if (industry !== undefined) { sets.push(`industry = $${params.length + 1}`); params.push(industry); }
      if (category !== undefined) { sets.push(`category = $${params.length + 1}`); params.push(category); }
      if (sort_order !== undefined) { sets.push(`sort_order = $${params.length + 1}`); params.push(parseInt(sort_order)); }
      if (is_active !== undefined) { sets.push(`is_active = $${params.length + 1}`); params.push(Boolean(is_active)); }
      if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
      params.push(id);
      const { rows: [tmpl] } = await pool.query(
        `UPDATE canvas_templates SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
      );
      if (!tmpl) return res.status(404).json({ error: 'Template not found' });
      await audit.log(req.admin.id, req.admin.email, 'canvas_template_update', 'canvas_templates', id, req.body, req);
      res.json({ template: tmpl });
    } catch (err) {
      console.error('[Admin] PATCH /canvas-templates/:id:', err.message);
      res.status(500).json({ error: 'Failed to update canvas template' });
    }
  });

  // DELETE /api/admin/canvas-templates/:id (soft-delete)
  router.delete('/canvas-templates/:id', authenticate, adminOnly, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { rowCount } = await pool.query(
        'UPDATE canvas_templates SET is_active = false WHERE id = $1', [id]
      );
      if (!rowCount) return res.status(404).json({ error: 'Template not found' });
      await audit.log(req.admin.id, req.admin.email, 'canvas_template_delete', 'canvas_templates', id, {}, req);
      res.json({ success: true });
    } catch (err) {
      console.error('[Admin] DELETE /canvas-templates/:id:', err.message);
      res.status(500).json({ error: 'Failed to delete template' });
    }
  });

  // POST /api/admin/canvas-templates/:id/duplicate
  router.post('/canvas-templates/:id/duplicate', authenticate, adminOnly, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { rows: [orig] } = await pool.query('SELECT * FROM canvas_templates WHERE id = $1', [id]);
      if (!orig) return res.status(404).json({ error: 'Template not found' });
      const { rows: [copy] } = await pool.query(
        `INSERT INTO canvas_templates (name, industry, category, canvas_json, canvas_width, canvas_height, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [`${orig.name} (copy)`, orig.industry, orig.category, orig.canvas_json, orig.canvas_width, orig.canvas_height, orig.sort_order]
      );
      await audit.log(req.admin.id, req.admin.email, 'canvas_template_duplicate', 'canvas_templates', copy.id, { source_id: id }, req);
      res.status(201).json({ template: copy });
    } catch (err) {
      console.error('[Admin] POST /canvas-templates/:id/duplicate:', err.message);
      res.status(500).json({ error: 'Failed to duplicate template' });
    }
  });

  // ─── PostCore Brain — LLM Management ────────────────────────────────────────

  // GET /api/admin/llm/overview
  router.get('/llm/overview', authenticate, adminOnly, async (req, res) => {
    try {
      const [countRes, modelRes, expRes, recentRes, imgRes, vidRes] = await Promise.all([
        pool.query(`SELECT COUNT(*) AS total,
          COUNT(CASE WHEN variation_selected IS NOT NULL THEN 1 END) AS with_selection,
          COUNT(CASE WHEN post_reach IS NOT NULL THEN 1 END) AS with_reach,
          ROUND(AVG(quality_score), 1) AS avg_quality
          FROM post_training_data`).catch(() => ({ rows: [{ total: 0, with_selection: 0, with_reach: 0, avg_quality: null }] })),
        pool.query(`SELECT * FROM llm_model_versions ORDER BY created_at DESC`).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM llm_ab_experiments ORDER BY started_at DESC LIMIT 5`).catch(() => ({ rows: [] })),
        pool.query(`SELECT input_payload->>'industry' AS industry, COUNT(*) AS count
          FROM post_training_data
          WHERE input_payload->>'industry' IS NOT NULL
          GROUP BY input_payload->>'industry' ORDER BY count DESC`).catch(() => ({ rows: [] })),
        pool.query(`SELECT COUNT(*) AS total,
          COUNT(CASE WHEN was_kept = true THEN 1 END) AS kept,
          COUNT(CASE WHEN was_kept = false THEN 1 END) AS regenerated,
          COUNT(CASE WHEN was_kept IS NOT NULL THEN 1 END) AS with_feedback,
          ROUND(AVG(generation_time_ms) / 1000.0, 1) AS avg_gen_secs,
          json_agg(DISTINCT provider) FILTER (WHERE provider IS NOT NULL) AS providers
          FROM image_training_data`).catch(() => ({ rows: [{ total: 0, kept: 0, regenerated: 0, with_feedback: 0, avg_gen_secs: null, providers: null }] })),
        pool.query(`SELECT COUNT(*) AS total,
          COUNT(CASE WHEN was_kept = true THEN 1 END) AS kept,
          COUNT(CASE WHEN was_kept = false THEN 1 END) AS discarded,
          COUNT(CASE WHEN was_kept IS NOT NULL THEN 1 END) AS with_feedback,
          ROUND(AVG(generation_time_ms) / 1000.0, 0) AS avg_gen_secs,
          json_agg(DISTINCT provider) FILTER (WHERE provider IS NOT NULL) AS providers
          FROM video_training_data`).catch(() => ({ rows: [{ total: 0, kept: 0, discarded: 0, with_feedback: 0, avg_gen_secs: null, providers: null }] })),
      ]);
      const stats = countRes.rows[0];
      const imgStats = imgRes.rows[0];
      const vidStats = vidRes.rows[0];
      const captionTotal = parseInt(stats.total) || 0;
      const imageTotal = parseInt(imgStats.total) || 0;
      const videoTotal = parseInt(vidStats.total) || 0;
      const total = captionTotal + imageTotal + videoTotal;
      const threshold = 10000;
      res.json({
        trainingExamples: total,
        captionExamples: captionTotal,
        imageExamples: imageTotal,
        videoExamples: videoTotal,
        withSelection: parseInt(stats.with_selection) || 0,
        withReach: parseInt(stats.with_reach) || 0,
        avgQuality: stats.avg_quality ? parseFloat(stats.avg_quality) : null,
        threshold,
        progressPct: Math.min(100, Math.round((total / threshold) * 100)),
        byIndustry: recentRes.rows,
        models: modelRes.rows,
        experiments: expRes.rows,
        activeModel: modelRes.rows.find(m => m.status === 'production') || null,
        claudeTrafficPct: 100 - (modelRes.rows.filter(m => m.status === 'production').reduce((s, m) => s + m.traffic_pct, 0)),
        imageStats: {
          total: imageTotal,
          kept: parseInt(imgStats.kept) || 0,
          regenerated: parseInt(imgStats.regenerated) || 0,
          withFeedback: parseInt(imgStats.with_feedback) || 0,
          keepRate: imgStats.with_feedback > 0 ? Math.round((imgStats.kept / imgStats.with_feedback) * 100) : null,
          avgGenSecs: imgStats.avg_gen_secs ? parseFloat(imgStats.avg_gen_secs) : null,
          providers: imgStats.providers || [],
        },
        videoStats: {
          total: videoTotal,
          kept: parseInt(vidStats.kept) || 0,
          discarded: parseInt(vidStats.discarded) || 0,
          withFeedback: parseInt(vidStats.with_feedback) || 0,
          keepRate: vidStats.with_feedback > 0 ? Math.round((vidStats.kept / vidStats.with_feedback) * 100) : null,
          avgGenSecs: vidStats.avg_gen_secs ? parseFloat(vidStats.avg_gen_secs) : null,
          providers: vidStats.providers || [],
        },
      });
    } catch (err) {
      console.error('[Admin LLM] overview error:', err.message);
      res.status(500).json({ error: 'Failed to load LLM overview' });
    }
  });

  // GET /api/admin/llm/training-data
  router.get('/llm/training-data', authenticate, adminOnly, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(50, parseInt(req.query.limit) || 20);
      const offset = (page - 1) * limit;
      const industry = req.query.industry;
      const whereClause = industry ? `WHERE input_payload->>'industry' = $3` : '';
      const params = industry ? [limit, offset, industry] : [limit, offset];
      const [dataRes, countRes] = await Promise.all([
        pool.query(`SELECT id,
          input_payload->>'industry' AS industry,
          COALESCE(input_payload->>'contentType', input_payload->>'content_type') AS content_type,
          variation_selected, was_edited, post_reach, post_engagement, quality_score,
          model_used, created_at
          FROM post_training_data ${whereClause}
          ORDER BY created_at DESC LIMIT $1 OFFSET $2`, params),
        pool.query(`SELECT COUNT(*) FROM post_training_data ${whereClause}`,
          industry ? [industry] : []),
      ]);
      res.json({ examples: dataRes.rows, total: parseInt(countRes.rows[0].count), page, limit });
    } catch (err) {
      console.error('[Admin LLM] training-data error:', err.message);
      res.status(500).json({ error: 'Failed to load training data' });
    }
  });

  // GET /api/admin/llm/models
  router.get('/llm/models', authenticate, adminOnly, async (req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM llm_model_versions ORDER BY created_at DESC`).catch(() => ({ rows: [] }));
      res.json({ models: result.rows });
    } catch (err) {
      console.error('[Admin LLM] models error:', err.message);
      res.status(500).json({ error: 'Failed to load models' });
    }
  });

  // GET /api/admin/llm/experiments
  router.get('/llm/experiments', authenticate, adminOnly, async (req, res) => {
    try {
      const result = await pool.query(`SELECT e.*, m.version_name FROM llm_ab_experiments e
        LEFT JOIN llm_model_versions m ON e.model_version_id = m.id
        ORDER BY e.started_at DESC LIMIT 20`).catch(() => ({ rows: [] }));
      res.json({ experiments: result.rows });
    } catch (err) {
      console.error('[Admin LLM] experiments error:', err.message);
      res.status(500).json({ error: 'Failed to load experiments' });
    }
  });

  // POST /api/admin/llm/experiments
  router.post('/llm/experiments', authenticate, adminOnly, async (req, res) => {
    try {
      const { modelVersionId, trafficPct, notes } = req.body;
      const { rows: [exp] } = await pool.query(
        `INSERT INTO llm_ab_experiments (model_version_id, traffic_pct, notes)
         VALUES ($1, $2, $3) RETURNING *`,
        [modelVersionId, trafficPct || 10, notes || null]
      );
      await audit.log(req.admin.id, req.admin.email, 'llm_experiment_create', 'llm_ab_experiments', exp.id, { trafficPct }, req);
      res.json({ experiment: exp });
    } catch (err) {
      console.error('[Admin LLM] create experiment error:', err.message);
      res.status(500).json({ error: 'Failed to create experiment' });
    }
  });

  // PATCH /api/admin/llm/experiments/:id
  router.patch('/llm/experiments/:id', authenticate, adminOnly, async (req, res) => {
    try {
      const { result, notes, trafficPct } = req.body;
      const { rows: [exp] } = await pool.query(
        `UPDATE llm_ab_experiments SET
          result = COALESCE($1, result),
          notes = COALESCE($2, notes),
          traffic_pct = COALESCE($3, traffic_pct),
          ended_at = CASE WHEN $1 IN ('promoted','rolled_back') THEN NOW() ELSE ended_at END
         WHERE id = $4 RETURNING *`,
        [result || null, notes || null, trafficPct || null, req.params.id]
      );
      if (!exp) return res.status(404).json({ error: 'Experiment not found' });
      await audit.log(req.admin.id, req.admin.email, 'llm_experiment_update', 'llm_ab_experiments', exp.id, { result }, req);
      res.json({ experiment: exp });
    } catch (err) {
      console.error('[Admin LLM] update experiment error:', err.message);
      res.status(500).json({ error: 'Failed to update experiment' });
    }
  });

  // GET /api/admin/llm/curated
  router.get('/llm/curated', authenticate, adminOnly, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT * FROM llm_curated_examples ORDER BY quality_score DESC, created_at DESC LIMIT 100`
      ).catch(() => ({ rows: [] }));
      res.json({ examples: result.rows });
    } catch (err) {
      console.error('[Admin LLM] curated error:', err.message);
      res.status(500).json({ error: 'Failed to load curated examples' });
    }
  });

  // POST /api/admin/llm/curated
  router.post('/llm/curated', authenticate, adminOnly, async (req, res) => {
    try {
      const { industry, contentType, inputPayload, idealOutput, qualityScore } = req.body;
      if (!industry || !contentType || !inputPayload || !idealOutput || !qualityScore) {
        return res.status(400).json({ error: 'All fields required' });
      }
      const { rows: [ex] } = await pool.query(
        `INSERT INTO llm_curated_examples (industry, content_type, input_payload, ideal_output, quality_score, annotated_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [industry, contentType, inputPayload, idealOutput, qualityScore, req.admin.email]
      );
      res.json({ example: ex });
    } catch (err) {
      console.error('[Admin LLM] add curated error:', err.message);
      res.status(500).json({ error: 'Failed to add curated example' });
    }
  });

  // ── PostCore Brain — Extended Admin Training Controls ────────────────────

  // GET /api/admin/llm/export — download all training data as JSONL for fine-tuning
  router.get('/llm/export', authenticate, adminOnly, async (req, res) => {
    try {
      const minQuality   = parseFloat(req.query.minQuality || '0');
      const onlySelected = req.query.onlySelected === 'true';
      const industry     = req.query.industry || null;
      const limitParam   = Math.min(parseInt(req.query.limit || '999999'), 999999);

      const conditions = ['output_payload IS NOT NULL'];
      const params = [];
      if (minQuality > 0) { params.push(minQuality); conditions.push(`(quality_score IS NULL OR quality_score >= $${params.length})`); }
      if (onlySelected)   { conditions.push('variation_selected IS NOT NULL'); }
      if (industry)       { params.push(industry); conditions.push(`input_payload->>'industry' = $${params.length}`); }
      params.push(limitParam);

      const rows = await pool.query(
        `SELECT id, input_payload, output_payload, variation_selected,
                was_edited, was_published, quality_score, post_reach, post_engagement
         FROM post_training_data
         WHERE ${conditions.join(' AND ')}
         ORDER BY CASE WHEN quality_score IS NOT NULL THEN 0 ELSE 1 END,
                  quality_score DESC NULLS LAST, created_at DESC
         LIMIT $${params.length}`,
        params
      );

      const SYSTEM = `You are PostCore, ItsPosting's AI content advisor for local service businesses. Generate exactly 3 social media caption variations (A, B, C). Each must start with a hook, reference the business location naturally, end with an engagement question, and match the requested tone. Respond with valid JSON only.`;

      // Build weighted JSONL (high-signal examples duplicated up to 5×)
      const lines = [];
      for (const row of rows.rows) {
        const inp = row.input_payload || {};
        const out = row.output_payload || {};
        const userMsg = [
          `Industry: ${inp.industry || 'general_contractor'}`,
          `Business: ${inp.businessName || 'Local Business'}, ${inp.location || 'Local Area'}`,
          `Month: ${inp.month || new Date().getMonth() + 1}`,
          `Content type: ${inp.contentType || 'photo'}`,
          `Trigger: ${inp.wizardTrigger || 'finished_job'}`,
          `Tone: ${inp.tone || 'professional'}`,
          `Platform: ${inp.platform || 'facebook'}`,
          inp.details ? `Details: ${inp.details}` : null,
        ].filter(Boolean).join('\n');

        // Weight: curator gold = 5×, selected+unpublished-edit = 3×, selected = 2×, rest = 1×
        let weight = 1;
        if (row.quality_score >= 4.5) weight = 5;
        else if (row.quality_score >= 3.5) weight = 2;
        if (row.variation_selected && row.was_edited === false) weight = Math.max(weight, 3);
        else if (row.variation_selected) weight = Math.max(weight, 2);
        if (row.was_published) weight = Math.min(weight * 1.5, 5);
        weight = Math.min(5, Math.round(weight));

        const entry = JSON.stringify({
          conversations: [
            { from: 'system', value: SYSTEM },
            { from: 'human',  value: userMsg },
            { from: 'gpt',    value: JSON.stringify({ variation_a: out.variation_a || {}, variation_b: out.variation_b || {}, variation_c: out.variation_c || {} }) },
          ],
        });
        for (let i = 0; i < weight; i++) lines.push(entry);
      }

      // Shuffle
      for (let i = lines.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lines[i], lines[j]] = [lines[j], lines[i]];
      }

      const filename = `postcore-training-${new Date().toISOString().split('T')[0]}.jsonl`;
      res.setHeader('Content-Type', 'application/jsonl');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(lines.join('\n'));
    } catch (err) {
      console.error('[Admin LLM] export error:', err.message);
      res.status(500).json({ error: 'Export failed' });
    }
  });

  // POST /api/admin/llm/models — register a newly trained model version
  router.post('/llm/models', authenticate, adminOnly, async (req, res) => {
    try {
      const { versionName, baseModel, modality, weightsUrl, trainingExamples,
              evalBleu, evalHumanScore, notes, inferenceEndpoint } = req.body;
      if (!versionName || !baseModel) return res.status(400).json({ error: 'versionName and baseModel required' });

      const { rows: [model] } = await pool.query(
        `INSERT INTO llm_model_versions
           (version_name, base_model, modality, weights_url, training_examples,
            eval_score, eval_human_score, status, traffic_pct, notes, trained_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'staging',0,$8,NOW(),NOW()) RETURNING *`,
        [versionName, baseModel, modality || 'text', weightsUrl || inferenceEndpoint || null,
         trainingExamples || null, evalBleu || null, evalHumanScore || null, notes || null]
      );
      await audit.log(req.admin.id, req.admin.email, 'llm_model_register', 'llm_model_versions', model.id, { versionName, baseModel }, req);
      res.json({ model });
    } catch (err) {
      console.error('[Admin LLM] register model error:', err.message);
      res.status(500).json({ error: 'Failed to register model' });
    }
  });

  // PATCH /api/admin/llm/models/:id — deploy, rollback, retire, set traffic %
  router.patch('/llm/models/:id', authenticate, adminOnly, async (req, res) => {
    try {
      const { action, trafficPct, notes, inferenceEndpoint } = req.body;
      const id = parseInt(req.params.id);

      let statusVal, trafficVal, promotedAt;
      if (action === 'deploy') {
        statusVal  = 'production';
        trafficVal = Math.min(100, Math.max(1, parseInt(trafficPct) || 5));
        promotedAt = 'NOW()';
      } else if (action === 'staging') {
        statusVal  = 'staging';
        trafficVal = 0;
      } else if (action === 'rollback' || action === 'retire') {
        statusVal  = 'retired';
        trafficVal = 0;
      } else if (action === 'set_traffic') {
        trafficVal = Math.min(100, Math.max(0, parseInt(trafficPct) || 0));
      }

      const { rows: [model] } = await pool.query(
        `UPDATE llm_model_versions SET
           status      = COALESCE($1, status),
           traffic_pct = COALESCE($2, traffic_pct),
           notes       = COALESCE($3, notes),
           weights_url = COALESCE($4, weights_url),
           promoted_at = CASE WHEN $5 THEN NOW() ELSE promoted_at END
         WHERE id = $6 RETURNING *`,
        [statusVal || null, trafficVal ?? null, notes || null,
         inferenceEndpoint || null, action === 'deploy', id]
      );
      if (!model) return res.status(404).json({ error: 'Model not found' });
      await audit.log(req.admin.id, req.admin.email, `llm_model_${action || 'update'}`, 'llm_model_versions', id, { action, trafficPct }, req);
      res.json({ model });
    } catch (err) {
      console.error('[Admin LLM] update model error:', err.message);
      res.status(500).json({ error: 'Failed to update model' });
    }
  });

  // PATCH /api/admin/llm/training-data/:id/quality — admin rates an individual example
  router.patch('/llm/training-data/:id/quality', authenticate, adminOnly, async (req, res) => {
    try {
      const { qualityScore } = req.body;
      const score = parseFloat(qualityScore);
      if (isNaN(score) || score < 1 || score > 5) return res.status(400).json({ error: 'qualityScore must be 1–5' });
      const { rows: [ex] } = await pool.query(
        `UPDATE post_training_data SET quality_score = $1 WHERE id = $2 RETURNING id, quality_score`,
        [score, req.params.id]
      );
      if (!ex) return res.status(404).json({ error: 'Example not found' });
      res.json({ id: ex.id, qualityScore: ex.quality_score });
    } catch (err) {
      console.error('[Admin LLM] rate example error:', err.message);
      res.status(500).json({ error: 'Failed to rate example' });
    }
  });

  // DELETE /api/admin/llm/training-data/:id — remove a low-quality example
  router.delete('/llm/training-data/:id', authenticate, adminOnly, async (req, res) => {
    try {
      await pool.query(`DELETE FROM post_training_data WHERE id = $1`, [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      console.error('[Admin LLM] delete example error:', err.message);
      res.status(500).json({ error: 'Failed to delete example' });
    }
  });

  // DELETE /api/admin/llm/curated/:id — remove a curated example
  router.delete('/llm/curated/:id', authenticate, adminOnly, async (req, res) => {
    try {
      await pool.query(`DELETE FROM llm_curated_examples WHERE id = $1`, [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      console.error('[Admin LLM] delete curated error:', err.message);
      res.status(500).json({ error: 'Failed to delete curated example' });
    }
  });

  // GET /api/admin/llm/quality-stats — real quality metrics computed from training data
  router.get('/llm/quality-stats', authenticate, adminOnly, async (req, res) => {
    try {
      const days = Math.min(parseInt(req.query.days || '30'), 90);
      const [generalRes, selectionRes, sourceRes, reachRes] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*) AS total,
            COUNT(CASE WHEN variation_selected IS NOT NULL THEN 1 END) AS with_selection,
            COUNT(CASE WHEN was_edited = true THEN 1 END) AS edited_count,
            COUNT(CASE WHEN was_published = true THEN 1 END) AS published_count,
            ROUND(
              COUNT(CASE WHEN was_edited = true THEN 1 END)::numeric /
              NULLIF(COUNT(CASE WHEN variation_selected IS NOT NULL THEN 1 END), 0) * 100, 1
            ) AS edit_rate_pct,
            ROUND(
              COUNT(CASE WHEN input_payload->>'source' = 'refresh' THEN 1 END)::numeric /
              NULLIF(COUNT(*), 0) * 100, 1
            ) AS regen_rate_pct
          FROM post_training_data
          WHERE created_at > NOW() - ($1 || ' days')::INTERVAL
        `, [days]).catch(() => ({ rows: [{}] })),

        pool.query(`
          SELECT variation_selected, COUNT(*) AS count
          FROM post_training_data
          WHERE variation_selected IS NOT NULL
            AND created_at > NOW() - ($1 || ' days')::INTERVAL
          GROUP BY variation_selected
          ORDER BY variation_selected
        `, [days]).catch(() => ({ rows: [] })),

        pool.query(`
          SELECT
            COALESCE(input_payload->>'source', 'wizard') AS source,
            COUNT(*) AS count
          FROM post_training_data
          WHERE created_at > NOW() - ($1 || ' days')::INTERVAL
          GROUP BY source ORDER BY count DESC
        `, [days]).catch(() => ({ rows: [] })),

        pool.query(`
          SELECT
            ROUND(AVG(post_reach), 0) AS avg_reach,
            ROUND(AVG(post_engagement), 0) AS avg_engagement,
            COUNT(CASE WHEN post_reach IS NOT NULL THEN 1 END) AS with_reach
          FROM post_training_data
          WHERE created_at > NOW() - ($1 || ' days')::INTERVAL
        `, [days]).catch(() => ({ rows: [{}] })),
      ]);

      const g = generalRes.rows[0] || {};
      res.json({
        days,
        total:           parseInt(g.total) || 0,
        withSelection:   parseInt(g.with_selection) || 0,
        editedCount:     parseInt(g.edited_count) || 0,
        publishedCount:  parseInt(g.published_count) || 0,
        editRatePct:     parseFloat(g.edit_rate_pct) || 0,
        regenRatePct:    parseFloat(g.regen_rate_pct) || 0,
        selectionBreakdown: selectionRes.rows,
        bySource:        sourceRes.rows,
        avgReach:        parseInt(reachRes.rows[0]?.avg_reach) || 0,
        avgEngagement:   parseInt(reachRes.rows[0]?.avg_engagement) || 0,
        withReach:       parseInt(reachRes.rows[0]?.with_reach) || 0,
      });
    } catch (err) {
      console.error('[Admin LLM] quality-stats error:', err.message);
      res.status(500).json({ error: 'Failed to load quality stats' });
    }
  });

  // ── PostCore Brain — Image Dataset Import & Export ───────────────────────

  // POST /api/admin/llm/import-images
  // Accepts a batch of image URLs, auto-labels each with Claude Vision,
  // and stores results in image_training_data. Processes 3 images at a time.
  //
  // Body:
  //   urls          string[]   — publicly accessible image URLs (Cloudinary, etc.)
  //   industry      string     — force this industry, or omit for auto-detect
  //   contentType   string     — force this content type, or omit for auto-detect
  //   customCaption string     — if provided, skip Vision and use this caption for all
  router.post('/llm/import-images', authenticate, adminOnly, async (req, res) => {
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const { urls, industry, contentType, customCaption } = req.body;

      if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'urls array required' });
      }
      if (urls.length > 500) {
        return res.status(400).json({ error: 'Max 500 URLs per batch. Split into multiple requests.' });
      }

      // Basic URL validation — must be http/https, no internal IPs
      const INTERNAL_IP = /^https?:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i;
      const validUrls = urls
        .map(u => String(u).trim())
        .filter(u => /^https?:\/\//i.test(u) && !INTERNAL_IP.test(u));

      if (validUrls.length === 0) {
        return res.status(400).json({ error: 'No valid public HTTP/HTTPS URLs provided' });
      }

      const anthropic = process.env.ANTHROPIC_API_KEY
        ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        : null;

      const INDUSTRIES_18 = [
        'plumbing','hvac','roofing','electrical','landscaping','concrete',
        'painting','pest_control','general_contractor','cleaning',
        'tree_service','pressure_washing','pool_spa','handyman',
        'flooring','junk_removal','solar','gutter_cleaning',
      ];

      const LABEL_PROMPT = `You are a professional AI training data annotator specializing in local service business imagery for FLUX.1-schnell LoRA fine-tuning.

Your job: extract MAXIMUM detail from each image so the model learns to generate images that look EXACTLY like real trade business content — not generic stock photos.

Analyze this image and return ONLY a valid JSON object with ALL of these fields:

{
  "caption": "A rich 100–200 word FLUX.1-schnell training caption. Structure it as comma-separated descriptive phrases covering ALL of: (1) shot type [wide establishing shot / medium shot / close-up / detail macro / split before-after / overhead aerial], (2) subject detail [worker gender/approximate age, exact clothing — color, brand logos visible, PPE like hard hat/safety vest/gloves/boots, tool or equipment in hand], (3) precise action [crouching under sink tightening compression fitting / applying shingles with pneumatic nailer / routing new romex through wall cavity], (4) setting [residential suburban ranch home exterior / commercial kitchen with stainless steel / unfinished basement with exposed joists / backyard stamped concrete patio], (5) lighting [harsh midday sun casting hard shadows / soft overcast diffused natural light / warm incandescent under-cabinet lighting / cool fluorescent shop lighting / golden hour warm backlight], (6) composition [rule-of-thirds framing / centered symmetrical / diagonal leading lines / shallow depth-of-field bokeh background], (7) mood/authenticity [authentic candid worksite documentation / staged professional portfolio shot / satisfied customer testimonial moment], (8) color palette [dominant colors], (9) trade-specific visible details [name specific materials, tools, brands if readable — copper sweat fitting / PEX manifold / Bryant condenser unit / Owens Corning Duration shingles / Behr paint / Milwaukee M18 drill]. Write present tense. Never start with 'A photo of'.",
  "industry": "ONE of exactly: plumbing, hvac, roofing, electrical, landscaping, concrete, painting, pest_control, general_contractor, cleaning, tree_service, pressure_washing, pool_spa, handyman, flooring, junk_removal, solar, gutter_cleaning",
  "contentType": "ONE of exactly: before_after, job_complete, crew_at_work, team_shot, detail_shot, equipment, seasonal, testimonial, promotional",
  "qualityScore": "Decimal 1.0–5.0 using this rubric: 5.0=sharp professional DSLR/mirrorless, perfect exposure, compelling composition, authentic trade content, no distractions; 4.5=professional quality with one minor flaw (slight overexposure, minor background clutter); 4.0=good quality smartphone shot, well-lit, clear subject; 3.5=acceptable but issues (soft focus, dim lighting, cluttered background, partially relevant); 3.0=marginal — usable but significant problems; 2.0=poor (very blurry, severely over/underexposed, mostly irrelevant content); 1.0=reject (stock photo watermark, heavy text overlay blocking content, wrong industry, NSFW, screenshot of app/website)",
  "hasPerson": true or false — is at least one human worker or customer visible in the frame?,
  "hasTextOverlay": true or false — are there text overlays, watermarks, logos, captions, or phone numbers overlaid on the image? (these contaminate training),
  "isBranded": true or false — are branded company colors, uniforms, vehicle wraps, or logos clearly visible?,
  "compositionType": "ONE of: wide_shot, medium_shot, close_up, macro_detail, before_after_split, aerial_overhead, portrait",
  "lightingType": "ONE of: natural_daylight, golden_hour, overcast_diffused, indoor_incandescent, indoor_fluorescent, mixed_natural_artificial, flash_artificial",
  "tags": ["array", "of", "5-12", "specific", "keywords", "visible", "in", "image", "eg", "copper-pipe", "PEX-manifold", "safety-harness", "knee-pads", "concrete-trowel"]
}

CRITICAL RULES:
- The caption is the most important field. A vague caption produces generic images. A specific caption produces authentic trade images.
- Never say "A photo of" — start directly with the shot type or subject.
- If text overlays or watermarks are present (hasTextOverlay: true), set qualityScore to maximum 2.5 — overlays corrupt training.
- If the image is clearly stock photography (overly perfect, diverse multicultural crew, unrealistically clean), set qualityScore to maximum 2.0.
- Authentic, slightly imperfect real worksite photos often score HIGHER than polished stock.

No markdown. No explanation. JSON only.`;

      const results   = [];
      const errors    = [];
      const CONCURRENCY = 3;

      // Process in batches of CONCURRENCY
      for (let i = 0; i < validUrls.length; i += CONCURRENCY) {
        const batch = validUrls.slice(i, i + CONCURRENCY);

        await Promise.all(batch.map(async (url) => {
          try {
            let caption       = customCaption || null;
            let detectedInd   = industry || null;
            let detectedType  = contentType || null;
            let qualityScore  = null;
            const visionMeta  = {};

            // If no custom caption, use Claude Vision to label
            if (!caption && anthropic) {
              const response = await anthropic.messages.create({
                model: 'claude-sonnet-4-6',
                max_tokens: 900,
                messages: [{
                  role: 'user',
                  content: [
                    { type: 'image', source: { type: 'url', url } },
                    { type: 'text', text: LABEL_PROMPT },
                  ],
                }],
              });

              const raw     = response.content[0]?.text || '';
              const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
              const parsed  = JSON.parse(cleaned);

              caption       = parsed.caption || '';
              detectedInd   = industry || (INDUSTRIES_18.includes(parsed.industry) ? parsed.industry : 'general_contractor');
              detectedType  = contentType || parsed.contentType || 'job_complete';
              qualityScore  = parseFloat(parsed.qualityScore) || null;

              // Store rich metadata from Vision
              Object.assign(visionMeta, {
                hasPerson:       parsed.hasPerson       ?? null,
                hasTextOverlay:  parsed.hasTextOverlay  ?? null,
                isBranded:       parsed.isBranded       ?? null,
                compositionType: parsed.compositionType || null,
                lightingType:    parsed.lightingType    || null,
                tags:            Array.isArray(parsed.tags) ? parsed.tags.slice(0, 15) : [],
              });
            }

            // Skip if no caption (Vision failed and no custom caption)
            if (!caption) { errors.push({ url, error: 'No caption generated' }); return; }

            // Auto-reject images with text overlays (they corrupt LoRA training)
            if (visionMeta.hasTextOverlay === true && !customCaption) {
              console.log(`[LLM Import] Skipping ${url.substring(0, 50)} — text overlay detected`);
              errors.push({ url, error: 'Skipped: text overlay/watermark detected — would corrupt training' });
              return;
            }

            await pool.query(
              `INSERT INTO image_training_data
                 (post_id, customer_id, input_prompt, output_url, provider, industry, content_type,
                  quality_score, model_used, has_person, has_text_overlay, is_branded,
                  composition_type, lighting_type, tags, metadata, created_at)
               VALUES (NULL, NULL, $1, $2, 'import', $3, $4, $5, 'claude-vision-import',
                       $6, $7, $8, $9, $10, $11, $12, NOW())
               ON CONFLICT DO NOTHING`,
              [
                caption, url, detectedInd, detectedType, qualityScore,
                visionMeta.hasPerson      ?? null,
                visionMeta.hasTextOverlay ?? null,
                visionMeta.isBranded      ?? null,
                visionMeta.compositionType || null,
                visionMeta.lightingType   || null,
                visionMeta.tags?.length   ? visionMeta.tags : null,
                Object.keys(visionMeta).length ? JSON.stringify(visionMeta) : null,
              ]
            );

            results.push({ url, caption: caption.substring(0, 100) + '…', industry: detectedInd, contentType: detectedType, qualityScore, hasPerson: visionMeta.hasPerson });
          } catch (imgErr) {
            errors.push({ url, error: imgErr.message });
          }
        }));

        // Small pause between batches to respect rate limits
        if (i + CONCURRENCY < validUrls.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      await audit.log(req.admin.id, req.admin.email, 'llm_image_import', 'image_training_data', null,
        { imported: results.length, errors: errors.length, industry: industry || 'auto' }, req);

      res.json({
        imported: results.length,
        errors:   errors.length,
        results,
        errorDetails: errors.slice(0, 20), // cap error details
      });
    } catch (err) {
      console.error('[Admin LLM] import-images error:', err.message);
      res.status(500).json({ error: 'Image import failed: ' + err.message });
    }
  });

  // GET /api/admin/llm/image-dataset — paginated, filterable view of all labeled images
  router.get('/llm/image-dataset', authenticate, adminOnly, async (req, res) => {
    try {
      const page        = Math.max(1, parseInt(req.query.page  || '1'));
      const limit       = Math.min(50, parseInt(req.query.limit || '24'));
      const offset      = (page - 1) * limit;
      const industry    = req.query.industry    || null;
      const contentType = req.query.contentType || null;
      const minQuality  = parseFloat(req.query.minQuality || '0');
      const search      = req.query.search ? `%${req.query.search}%` : null;

      const conditions = ["output_url IS NOT NULL AND output_url != ''"];
      const params     = [];

      if (industry)    { params.push(industry);    conditions.push(`industry = $${params.length}`); }
      if (contentType) { params.push(contentType); conditions.push(`content_type = $${params.length}`); }
      if (minQuality > 0) { params.push(minQuality); conditions.push(`(quality_score IS NULL OR quality_score >= $${params.length})`); }
      if (search)      { params.push(search);      conditions.push(`input_prompt ILIKE $${params.length}`); }

      const whereClause = conditions.join(' AND ');

      const [dataRes, countRes, statsRes] = await Promise.all([
        pool.query(
          `SELECT id, output_url AS url, input_prompt AS caption, industry, content_type,
                  quality_score, provider, model_used, was_kept, post_reach,
                  has_person, has_text_overlay, is_branded, composition_type, lighting_type, tags,
                  created_at
           FROM image_training_data
           WHERE ${whereClause}
           ORDER BY quality_score DESC NULLS LAST, created_at DESC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limit, offset]
        ),
        pool.query(
          `SELECT COUNT(*) FROM image_training_data WHERE ${whereClause}`,
          params
        ),
        pool.query(
          `SELECT industry, content_type, COUNT(*) AS count
           FROM image_training_data
           WHERE output_url IS NOT NULL
           GROUP BY industry, content_type
           ORDER BY count DESC`
        ).catch(() => ({ rows: [] })),
      ]);

      res.json({
        images:  dataRes.rows,
        total:   parseInt(countRes.rows[0].count),
        page, limit,
        stats:   statsRes.rows,
      });
    } catch (err) {
      console.error('[Admin LLM] image-dataset list error:', err.message);
      res.status(500).json({ error: 'Failed to load image dataset' });
    }
  });

  // PATCH /api/admin/llm/image-dataset/:id — edit labels on a single image
  router.patch('/llm/image-dataset/:id', authenticate, adminOnly, async (req, res) => {
    try {
      const { industry, contentType, caption, qualityScore } = req.body;
      const id = parseInt(req.params.id);

      const { rows: [img] } = await pool.query(
        `UPDATE image_training_data SET
           industry     = COALESCE($1, industry),
           content_type = COALESCE($2, content_type),
           input_prompt = COALESCE($3, input_prompt),
           quality_score = COALESCE($4, quality_score)
         WHERE id = $5
         RETURNING id, output_url AS url, input_prompt AS caption,
                   industry, content_type, quality_score`,
        [industry || null, contentType || null,
         caption   || null, qualityScore != null ? parseFloat(qualityScore) : null, id]
      );
      if (!img) return res.status(404).json({ error: 'Image not found' });
      res.json({ image: img });
    } catch (err) {
      console.error('[Admin LLM] image-dataset patch error:', err.message);
      res.status(500).json({ error: 'Failed to update image' });
    }
  });

  // POST /api/admin/llm/image-dataset/bulk-label — update labels on multiple images at once
  router.post('/llm/image-dataset/bulk-label', authenticate, adminOnly, async (req, res) => {
    try {
      const { ids, industry, contentType, qualityScore } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids array required' });
      }
      if (ids.length > 200) {
        return res.status(400).json({ error: 'Max 200 images per bulk update' });
      }
      if (!industry && !contentType && qualityScore == null) {
        return res.status(400).json({ error: 'At least one of industry, contentType, qualityScore required' });
      }

      const safeIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));
      const setParts = [];
      const params   = [];

      if (industry)          { params.push(industry);                  setParts.push(`industry = $${params.length}`);      }
      if (contentType)       { params.push(contentType);               setParts.push(`content_type = $${params.length}`);  }
      if (qualityScore != null) { params.push(parseFloat(qualityScore)); setParts.push(`quality_score = $${params.length}`); }

      params.push(safeIds);
      const result = await pool.query(
        `UPDATE image_training_data SET ${setParts.join(', ')}
         WHERE id = ANY($${params.length}) RETURNING id`,
        params
      );

      await audit.log(req.admin.id, req.admin.email, 'llm_image_bulk_label', 'image_training_data', null,
        { count: result.rows.length, industry, contentType, qualityScore }, req);

      res.json({ updated: result.rows.length });
    } catch (err) {
      console.error('[Admin LLM] bulk-label error:', err.message);
      res.status(500).json({ error: 'Bulk label failed' });
    }
  });

  // DELETE /api/admin/llm/image-dataset/:id — remove a single bad image from training set
  router.delete('/llm/image-dataset/:id', authenticate, adminOnly, async (req, res) => {
    try {
      await pool.query(`DELETE FROM image_training_data WHERE id = $1`, [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      console.error('[Admin LLM] image-dataset delete error:', err.message);
      res.status(500).json({ error: 'Failed to delete image' });
    }
  });

  // POST /api/admin/llm/image-dataset/bulk-delete — delete multiple images at once
  router.post('/llm/image-dataset/bulk-delete', authenticate, adminOnly, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids required' });
      const safeIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));
      const result  = await pool.query(
        `DELETE FROM image_training_data WHERE id = ANY($1) RETURNING id`,
        [safeIds]
      );
      res.json({ deleted: result.rows.length });
    } catch (err) {
      console.error('[Admin LLM] bulk-delete error:', err.message);
      res.status(500).json({ error: 'Bulk delete failed' });
    }
  });

  // GET /api/admin/llm/export-image-dataset
  // Exports image_training_data as a JSONL file (URL + caption + metadata)
  // plus a self-contained Python download script that organises files into
  // the folder structure expected by FLUX.1-schnell / SDXL LoRA training tools.
  router.get('/llm/export-image-dataset', authenticate, adminOnly, async (req, res) => {
    try {
      const industry   = req.query.industry || null;
      const minQuality = parseFloat(req.query.minQuality || '0');
      const format     = req.query.format || 'jsonl'; // 'jsonl' | 'script'

      const conditions = ['output_url IS NOT NULL', "provider != 'video'"];
      const params = [];
      if (industry)       { params.push(industry);    conditions.push(`industry = $${params.length}`); }
      if (minQuality > 0) { params.push(minQuality);  conditions.push(`(quality_score IS NULL OR quality_score >= $${params.length})`); }

      const result = await pool.query(
        `SELECT output_url AS url, input_prompt AS caption, industry, content_type, quality_score,
                has_person, is_branded, composition_type, lighting_type, tags
         FROM image_training_data
         WHERE ${conditions.join(' AND ')}
           AND (has_text_overlay IS NULL OR has_text_overlay = false)
         ORDER BY quality_score DESC NULLS LAST, created_at DESC`,
        params
      );

      if (format === 'script') {
        // Return a ready-to-run Python download script
        const industryFilter = industry ? `['${industry}']` : 'None  # all industries';
        const script = `#!/usr/bin/env python3
"""
PostCore Brain — Image Dataset Downloader
Generated: ${new Date().toISOString()}
Total images: ${result.rows.length}

Usage:
  pip install requests Pillow
  python download_dataset.py

Output structure:
  training_data/
  ├── plumbing/
  │   ├── 001.jpg
  │   ├── 001.txt   ← caption file (FLUX.1 / SDXL LoRA format)
  │   ├── 002.jpg
  │   └── ...
  ├── hvac/
  └── ...

After downloading, upload the training_data/ folder to:
  - Kaggle dataset (for free T4 GPU training)
  - RunPod storage (for A100 training)
  - Vast.ai volume (for cheap GPU training)
"""

import os
import json
import requests
from pathlib import Path
from PIL import Image
from io import BytesIO

# ── Dataset ──────────────────────────────────────────────────────────────────

DATASET = ${JSON.stringify(result.rows.map(r => ({
  url:         r.url,
  caption:     r.caption,
  industry:    r.industry || 'general_contractor',
  contentType: r.content_type || 'job_complete',
  quality:     r.quality_score ? parseFloat(r.quality_score) : null,
})), null, 2)}

# ── Config ───────────────────────────────────────────────────────────────────

OUTPUT_DIR     = Path("training_data")
TARGET_SIZE    = (1024, 1024)    # resize all images to 1024×1024 for LoRA training
MIN_QUALITY    = 3.0             # skip images rated below this (None = include all)
INDUSTRY_FILTER = ${industryFilter}

# ── Download ──────────────────────────────────────────────────────────────────

def download_and_save(item, idx, industry_dir):
    url     = item["url"]
    caption = item["caption"]

    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()

        img = Image.open(BytesIO(resp.content)).convert("RGB")
        img = img.resize(TARGET_SIZE, Image.LANCZOS)

        img_path = industry_dir / f"{idx:04d}.jpg"
        txt_path = industry_dir / f"{idx:04d}.txt"

        img.save(img_path, "JPEG", quality=90)

        # Build rich caption: main caption + tag suffix for FLUX.1-schnell
        # Tag suffix boosts training signal for specific visual attributes
        tag_parts = []
        if item.get("tags"):
            tag_parts.append(", ".join(item["tags"]))
        if item.get("compositionType"):
            tag_parts.append(item["compositionType"].replace("_", " "))
        if item.get("lightingType"):
            tag_parts.append(item["lightingType"].replace("_", " ") + " lighting")
        if item.get("isBranded"):
            tag_parts.append("branded uniform")
        if item.get("hasPerson"):
            tag_parts.append("professional tradesperson visible")

        full_caption = caption
        if tag_parts:
            full_caption = caption.rstrip(".") + ", " + ", ".join(tag_parts)

        txt_path.write_text(full_caption, encoding="utf-8")

        return True
    except Exception as e:
        print(f"  SKIP {url[:60]}: {e}")
        return False


def main():
    total = ok = skipped = 0

    for item in DATASET:
        # Filters
        if INDUSTRY_FILTER and item["industry"] not in INDUSTRY_FILTER:
            continue
        if MIN_QUALITY and item["quality"] and item["quality"] < MIN_QUALITY:
            skipped += 1
            continue

        industry_dir = OUTPUT_DIR / item["industry"]
        industry_dir.mkdir(parents=True, exist_ok=True)

        # Count existing files in this folder for sequential naming
        existing = len(list(industry_dir.glob("*.jpg")))

        success = download_and_save(item, existing + 1, industry_dir)
        ok    += int(success)
        skipped += int(not success)
        total += 1

        if total % 25 == 0:
            print(f"  {ok}/{total} downloaded…")

    print(f"\\nDone. {ok} images saved, {skipped} skipped.")
    print(f"Training data ready at: {OUTPUT_DIR.absolute()}")

    # Print per-industry summary
    print("\\nPer-industry breakdown:")
    for ind_dir in sorted(OUTPUT_DIR.iterdir()):
        count = len(list(ind_dir.glob("*.jpg")))
        print(f"  {ind_dir.name:<25} {count} images")

if __name__ == "__main__":
    main()
`;
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="download_dataset.py"`);
        return res.send(script);
      }

      // Default: JSONL export — full rich metadata for LoRA training
      const lines = result.rows.map(r => JSON.stringify({
        url:             r.url,
        caption:         r.caption,
        industry:        r.industry        || 'general_contractor',
        contentType:     r.content_type    || 'job_complete',
        quality:         r.quality_score   ? parseFloat(r.quality_score) : null,
        hasPerson:       r.has_person      ?? null,
        isBranded:       r.is_branded      ?? null,
        compositionType: r.composition_type || null,
        lightingType:    r.lighting_type   || null,
        tags:            r.tags            || [],
      }));

      const filename = `postcore-image-dataset-${new Date().toISOString().split('T')[0]}.jsonl`;
      res.setHeader('Content-Type', 'application/jsonl');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(lines.join('\n'));
    } catch (err) {
      console.error('[Admin LLM] export-image-dataset error:', err.message);
      res.status(500).json({ error: 'Export failed' });
    }
  });

  /* ─────────────────────────────────────────────────────────
   * REFERRAL MANAGEMENT
   * ───────────────────────────────────────────────────────── */

  /**
   * GET /api/admin/referrals
   * List all referral awards with optional status filter.
   */
  router.get('/referrals', async (req, res) => {
    try {
      const { status, limit = 50, offset = 0 } = req.query;
      const safeLimit  = Math.min(parseInt(limit) || 50, 200);
      const safeOffset = Math.max(parseInt(offset) || 0, 0);

      let where = 'WHERE 1=1';
      const params = [];
      let p = 0;

      if (status && ['pending', 'released', 'rejected'].includes(status)) {
        p++; where += ` AND ra.status = $${p}`; params.push(status);
      }

      params.push(safeLimit, safeOffset);

      const rows = await pool.query(
        `SELECT
           ra.id, ra.status, ra.credits, ra.referral_code,
           ra.created_at, ra.released_at, ra.rejection_reason,
           -- referrer
           c_ref.id   AS referrer_id,
           c_ref.business_name AS referrer_name,
           c_ref.email AS referrer_email,
           c_ref.plan  AS referrer_plan,
           -- referred
           c_new.id   AS referred_id,
           c_new.business_name AS referred_name,
           c_new.email AS referred_email,
           c_new.plan  AS referred_plan,
           c_new.created_at AS referred_joined_at,
           -- releasing admin
           c_adm.email AS released_by_email
         FROM referral_awards ra
         JOIN customers c_ref ON c_ref.id = ra.referrer_customer_id
         JOIN customers c_new ON c_new.id = ra.referred_customer_id
         LEFT JOIN customers c_adm ON c_adm.id = ra.released_by_admin_id
         ${where}
         ORDER BY ra.created_at DESC
         LIMIT $${p + 1} OFFSET $${p + 2}`,
        params
      );

      const countRes = await pool.query(
        `SELECT COUNT(*) AS total FROM referral_awards ra ${where}`,
        params.slice(0, p)
      );

      // Summary counts
      const summaryRes = await pool.query(
        `SELECT status, COUNT(*) AS count, SUM(credits) AS credits
         FROM referral_awards GROUP BY status`
      );
      const summary = {};
      for (const r of summaryRes.rows) {
        summary[r.status] = { count: parseInt(r.count), credits: parseInt(r.credits) };
      }

      res.json({
        awards: rows.rows,
        total: parseInt(countRes.rows[0].total),
        summary,
      });
    } catch (err) {
      console.error('[Admin referrals] list error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/admin/referrals/:id/release
   * Release a pending award — adds 20 credits to the referrer's account.
   */
  router.post('/referrals/:id/release', async (req, res) => {
    const awardId = parseInt(req.params.id);
    if (!awardId) return res.status(400).json({ error: 'Invalid award ID' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const awardRes = await client.query(
        'SELECT * FROM referral_awards WHERE id = $1 FOR UPDATE',
        [awardId]
      );
      if (!awardRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Award not found' });
      }
      const award = awardRes.rows[0];
      if (award.status !== 'pending') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Award is already ${award.status}` });
      }

      // Credit the referrer
      const balRes = await client.query(
        'SELECT credits_balance FROM customers WHERE id = $1 FOR UPDATE',
        [award.referrer_customer_id]
      );
      if (!balRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Referrer not found' });
      }
      const newBalance = (parseInt(balRes.rows[0].credits_balance) || 0) + award.credits;

      await client.query(
        `UPDATE customers
         SET credits_balance = $1,
             referral_credits_earned = COALESCE(referral_credits_earned, 0) + $2
         WHERE id = $3`,
        [newBalance, award.credits, award.referrer_customer_id]
      );
      await client.query(
        `INSERT INTO credit_transactions
           (customer_id, transaction_type, amount, balance_after, description)
         VALUES ($1, 'referral_reward', $2, $3, $4)`,
        [award.referrer_customer_id, award.credits, newBalance,
          `Referral reward released by admin — referred customer upgraded to paid plan`]
      );
      await client.query(
        `UPDATE referral_awards
         SET status='released', released_at=NOW(), released_by_admin_id=$1
         WHERE id=$2`,
        [req.customerId, awardId]
      );

      await client.query('COMMIT');

      await audit.log(req.admin.id, req.admin.email, 'referral_release', 'referral_awards', awardId,
        { referrer_id: award.referrer_customer_id, credits: award.credits }, req);

      res.json({ success: true, credits_awarded: award.credits });

      // Notify referrer — fire-and-forget, never blocks the response
      pool.query('SELECT email, business_name FROM customers WHERE id = $1', [award.referrer_customer_id])
        .then(async row => {
          if (!row.rows.length) return;
          emailQueue.notifyReferralReleased(row.rows[0], award.credits, newBalance).catch(() => {});
          notif.referralReleased(award.referrer_customer_id, award.credits, newBalance);
        }).catch(e => console.warn('[Referral] notify release error:', e.message));
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[Admin referrals] release error:', err.message);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  /**
   * POST /api/admin/referrals/:id/reject
   * Reject a pending award (e.g. fraudulent referral).
   */
  router.post('/referrals/:id/reject', async (req, res) => {
    const awardId = parseInt(req.params.id);
    if (!awardId) return res.status(400).json({ error: 'Invalid award ID' });

    const { reason } = req.body;

    try {
      const awardRes = await pool.query(
        'SELECT * FROM referral_awards WHERE id = $1',
        [awardId]
      );
      if (!awardRes.rows.length) return res.status(404).json({ error: 'Award not found' });
      if (awardRes.rows[0].status !== 'pending') {
        return res.status(409).json({ error: `Award is already ${awardRes.rows[0].status}` });
      }

      await pool.query(
        `UPDATE referral_awards
         SET status='rejected', rejection_reason=$1, released_by_admin_id=$2
         WHERE id=$3`,
        [reason || null, req.customerId, awardId]
      );

      await audit.log(req.admin.id, req.admin.email, 'referral_reject', 'referral_awards', awardId,
        { reason: reason || null }, req);

      res.json({ success: true });

      // Notify referrer — fire-and-forget
      const award = awardRes.rows[0];
      pool.query('SELECT email, business_name FROM customers WHERE id = $1', [award.referrer_customer_id])
        .then(async row => {
          if (!row.rows.length) return;
          emailQueue.notifyReferralRejected(row.rows[0], reason || null).catch(() => {});
          notif.referralRejected(award.referrer_customer_id);
        }).catch(e => console.warn('[Referral] notify reject error:', e.message));
    } catch (err) {
      console.error('[Admin referrals] reject error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/admin/referrals/release-all
   * Release ALL pending referral awards atomically, one per transaction.
   * Must be defined BEFORE /:id/release to avoid route collision.
   */
  router.post('/referrals/release-all', async (req, res) => {
    try {
      const pending = await pool.query(
        `SELECT ra.id, ra.referrer_customer_id, ra.referred_customer_id, ra.credits
         FROM referral_awards ra
         WHERE ra.status = 'pending'
         ORDER BY ra.created_at ASC`
      );

      if (!pending.rows.length) {
        return res.json({ success: true, released: 0 });
      }

      let released = 0;
      for (const award of pending.rows) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          // Re-check still pending and lock
          const check = await client.query(
            'SELECT id FROM referral_awards WHERE id = $1 AND status = $2 FOR UPDATE',
            [award.id, 'pending']
          );
          if (!check.rows.length) { await client.query('ROLLBACK'); continue; }

          const balRes = await client.query(
            'SELECT credits_balance FROM customers WHERE id = $1 FOR UPDATE',
            [award.referrer_customer_id]
          );
          if (!balRes.rows.length) { await client.query('ROLLBACK'); continue; }

          const newBalance = (parseInt(balRes.rows[0].credits_balance) || 0) + award.credits;

          await client.query(
            `UPDATE customers
             SET credits_balance = $1,
                 referral_credits_earned = COALESCE(referral_credits_earned, 0) + $2
             WHERE id = $3`,
            [newBalance, award.credits, award.referrer_customer_id]
          );
          await client.query(
            `INSERT INTO credit_transactions
               (customer_id, transaction_type, amount, balance_after, description)
             VALUES ($1, 'referral_reward', $2, $3, $4)`,
            [award.referrer_customer_id, award.credits, newBalance,
              'Referral reward released (bulk) — referred customer upgraded to paid plan']
          );
          await client.query(
            `UPDATE referral_awards
             SET status='released', released_at=NOW(), released_by_admin_id=$1
             WHERE id=$2`,
            [req.customerId, award.id]
          );

          await client.query('COMMIT');
          released++;

          // Notify referrer — fire-and-forget per award
          const capturedAward = award;
          const capturedBalance = newBalance;
          pool.query('SELECT email, business_name FROM customers WHERE id = $1', [capturedAward.referrer_customer_id])
            .then(async row => {
              if (!row.rows.length) return;
              emailQueue.notifyReferralReleased(row.rows[0], capturedAward.credits, capturedBalance).catch(() => {});
              notif.referralReleased(capturedAward.referrer_customer_id, capturedAward.credits, capturedBalance);
            }).catch(() => {});
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          console.error(`[Admin bulk referral] award ${award.id} error:`, err.message);
        } finally {
          client.release();
        }
      }

      await audit.log(req.admin.id, req.admin.email, 'referral_bulk_release', 'referral_awards', null,
        { released, total: pending.rows.length }, req);

      res.json({ success: true, released });
    } catch (err) {
      console.error('[Admin bulk referral] error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Service Requests ────────────────────────────────────────────────────────

  // GET /api/admin/service-requests
  router.get('/service-requests', async (req, res) => {
    try {
      const { type, status, search, limit: rawLimit = 50, offset: rawOffset = 0 } = req.query;
      const limit  = Math.min(parseInt(rawLimit)  || 50, 100);
      const offset = Math.max(parseInt(rawOffset) || 0,  0);

      const conditions = ['1=1'];
      const params = [];
      let p = 1;

      if (type)   { conditions.push(`sr.type = $${p++}`);   params.push(type); }
      if (status) { conditions.push(`sr.status = $${p++}`); params.push(status); }
      if (search) {
        conditions.push(`(c.business_name ILIKE $${p} OR c.email ILIKE $${p})`);
        params.push(`%${search}%`); p++;
      }

      const where = conditions.join(' AND ');
      const countRes = await pool.query(
        `SELECT COUNT(*) FROM service_requests sr
         JOIN customers c ON c.id = sr.customer_id
         WHERE ${where}`,
        params
      );

      params.push(limit, offset);
      const dataRes = await pool.query(
        `SELECT sr.id, sr.type, sr.status, sr.request_data, sr.admin_notes,
                sr.resolved_by, sr.resolved_at, sr.created_at, sr.updated_at,
                c.id AS customer_id, c.business_name, c.email, c.plan
         FROM service_requests sr
         JOIN customers c ON c.id = sr.customer_id
         WHERE ${where}
         ORDER BY
           CASE sr.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
           sr.created_at DESC
         LIMIT $${p} OFFSET $${p + 1}`,
        params
      );

      res.json({
        requests: dataRes.rows,
        total: parseInt(countRes.rows[0].count),
        pendingCount: parseInt(countRes.rows[0].count), // caller can re-query with status=pending
      });
    } catch (err) {
      console.error('[Admin] GET /service-requests:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/admin/service-requests/count — lightweight pending count for nav badge
  router.get('/service-requests/count', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) FROM service_requests WHERE status IN ('pending','in_progress')`
      );
      res.json({ count: parseInt(result.rows[0].count) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/admin/service-requests/:id — update status / add notes
  router.patch('/service-requests/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, admin_notes } = req.body;

      const VALID_STATUSES = ['pending', 'in_progress', 'resolved', 'rejected'];
      if (status && !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const sets = ['updated_at = NOW()'];
      const params = [];
      let p = 1;
      if (status)      { sets.push(`status = $${p++}`);      params.push(status); }
      if (admin_notes !== undefined) { sets.push(`admin_notes = $${p++}`); params.push(String(admin_notes).substring(0, 500)); }
      if (status === 'resolved' || status === 'rejected') {
        sets.push(`resolved_by = $${p++}`); params.push(req.admin.email);
        sets.push(`resolved_at = NOW()`);
      }
      params.push(id);

      const { rows: [updated] } = await pool.query(
        `UPDATE service_requests SET ${sets.join(', ')} WHERE id = $${p}
         RETURNING id, type, status, admin_notes, customer_id`,
        params
      );
      if (!updated) return res.status(404).json({ error: 'Request not found' });

      // Notify customer if resolved/rejected
      if (status === 'resolved' || status === 'rejected') {
        try {
          const customerRow = await pool.query(
            'SELECT email, business_name FROM customers WHERE id = $1',
            [updated.customer_id]
          );
          if (customerRow.rows[0]) {
            const customer = customerRow.rows[0];
            const handler = status === 'resolved'
              ? emailQueue.notifyServiceRequestResolved.bind(emailQueue)
              : emailQueue.notifyServiceRequestRejected.bind(emailQueue);
            await handler(customer, { type: updated.type }, admin_notes || '');
          }
        } catch (emailErr) {
          console.error('[Admin] service-request notify error:', emailErr.message);
        }
      }

      await audit.log(req.admin.id, req.admin.email, 'service_request_update', 'service_requests', id,
        { status, admin_notes }, req);
      res.json({ success: true, request: updated });
    } catch (err) {
      console.error('[Admin] PATCH /service-requests/:id:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/admin/service-requests/:id/contact — email or in-app notify
  router.post('/service-requests/:id/contact', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { channel, message } = req.body;
      if (!['email', 'notification'].includes(channel)) {
        return res.status(400).json({ error: 'channel must be email or notification' });
      }
      if (!message || String(message).trim().length < 3) {
        return res.status(400).json({ error: 'message is required' });
      }

      const reqRow = await pool.query(
        `SELECT sr.customer_id, c.email, c.business_name
         FROM service_requests sr JOIN customers c ON c.id = sr.customer_id
         WHERE sr.id = $1`,
        [id]
      );
      if (!reqRow.rows.length) return res.status(404).json({ error: 'Request not found' });
      const { customer_id, email, business_name } = reqRow.rows[0];

      if (channel === 'email') {
        await emailQueue.notifyServiceRequestMessage(
          { email, business_name },
          String(message).substring(0, 2000)
        );
      } else {
        await notif.create(customer_id, 'admin_message', 'Message from ItsPosting team', String(message).substring(0, 500));
      }

      await audit.log(req.admin.id, req.admin.email, 'service_request_contact', 'service_requests', id,
        { channel, messageLength: message.length }, req);
      res.json({ success: true });
    } catch (err) {
      console.error('[Admin] POST /service-requests/:id/contact:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/admin/service-requests/:id/approve — one-click approve
  router.post('/service-requests/:id/approve', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const reqRow = await pool.query(
        `SELECT sr.*, c.email, c.business_name, c.credits_balance
         FROM service_requests sr JOIN customers c ON c.id = sr.customer_id
         WHERE sr.id = $1 AND sr.status IN ('pending','in_progress')`,
        [id]
      );
      if (!reqRow.rows.length) return res.status(404).json({ error: 'Request not found or already resolved' });

      const { type, request_data, customer_id, email, business_name, credits_balance } = reqRow.rows[0];

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        if (type === 'credit_purchase') {
          const credits = request_data?.credits;
          if (!credits || credits <= 0) throw new Error('Invalid credit amount in request');
          const newBalance = (credits_balance || 0) + credits;
          await client.query(
            `UPDATE customers SET credits_balance = $1, updated_at = NOW() WHERE id = $2`,
            [newBalance, customer_id]
          );
          await client.query(
            `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
             VALUES ($1, 'purchase', $2, $3, $4)`,
            [customer_id, credits, newBalance, `Admin approved credit purchase: ${credits} credits ($${request_data?.price})`]
          );
        } else if (type === 'agency_plan') {
          await client.query(
            `UPDATE customers SET plan = 'agency', status = 'active',
             credits_balance = GREATEST(credits_balance, 200), updated_at = NOW()
             WHERE id = $1`,
            [customer_id]
          );
          await client.query(
            `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
             VALUES ($1, 'bonus', 200, GREATEST(credits_balance, 200), 'Agency plan activated by admin')`,
            [customer_id]
          );
        }

        await client.query(
          `UPDATE service_requests SET status = 'resolved', resolved_by = $1, resolved_at = NOW(), updated_at = NOW()
           WHERE id = $2`,
          [req.admin.email, id]
        );

        await client.query('COMMIT');
      } catch (dbErr) {
        await client.query('ROLLBACK');
        throw dbErr;
      } finally {
        client.release();
      }

      // Notify customer (fire-and-forget)
      try {
        const reqObj = { type, request_data };
        await emailQueue.notifyServiceRequestResolved(
          { email, business_name },
          reqObj,
          type === 'credit_purchase'
            ? `${request_data?.credits} credits have been added to your account.`
            : 'Your account has been upgraded to the Agency plan.'
        );
      } catch (emailErr) {
        console.error('[Admin] approve email error:', emailErr.message);
      }

      await audit.log(req.admin.id, req.admin.email, 'service_request_approve', 'service_requests', id,
        { type, request_data }, req);
      res.json({ success: true });
    } catch (err) {
      console.error('[Admin] POST /service-requests/:id/approve:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};

