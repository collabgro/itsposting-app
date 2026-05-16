const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { generateToken, authenticate } = require('../middleware/auth');
const EmailQueue = require('../services/EmailQueue');

module.exports = (pool) => {
  const router = express.Router();
  const emailQueue = new EmailQueue(pool);

  /**
   * POST /api/auth/register
   */
  router.post('/register', async (req, res) => {
    try {
      const { email, password, businessName, industry, location, parentRef } = req.body;

      if (!email || !password || !businessName) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      const existing = await pool.query('SELECT id FROM customers WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // IP-based trial limit (max 2 trial accounts per IP address)
      const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';
      try {
        const ipCheck = await pool.query(
          `SELECT COUNT(*) FROM trial_ip_registrations WHERE ip_address = $1`,
          [clientIp]
        );
        if (parseInt(ipCheck.rows[0].count, 10) >= 2) {
          return res.status(429).json({
            error: 'Trial limit reached for this network. Please contact support to upgrade your plan.',
          });
        }
      } catch (ipErr) {
        // trial_ip_registrations table may not exist yet — allow registration
        console.warn('[Auth] IP trial check skipped (table may not exist):', ipErr.message);
      }

      const passwordHash = await bcrypt.hash(password, 10);

      let parentCustomerId = null;
      if (parentRef) {
        const parentCheck = await pool.query('SELECT id FROM customers WHERE id = $1', [parseInt(parentRef, 10) || 0]);
        if (parentCheck.rows.length) parentCustomerId = parentCheck.rows[0].id;
      }

      const result = await pool.query(
        `INSERT INTO customers (email, password_hash, business_name, industry, location, parent_customer_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, business_name, industry, location, plan, credits_balance, status`,
        [email, passwordHash, businessName, industry || 'other', location || '', parentCustomerId]
      );

      const customer = result.rows[0];
      const token = generateToken(customer.id, customer.email);

      await pool.query(
        `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
         VALUES ($1, 'bonus', 10, 10, 'Welcome bonus - 10 free credits')`,
        [customer.id]
      );

      // Record this IP → customer registration (non-blocking, fail silently)
      pool.query(
        `INSERT INTO trial_ip_registrations (ip_address, customer_id) VALUES ($1, $2)`,
        [clientIp, customer.id]
      ).catch(err => console.warn('[Auth] Could not record trial IP:', err.message));

      // Queue welcome email (non-blocking)
      emailQueue.notifyWelcome({ email: customer.email, business_name: customer.business_name, credits_balance: 10 });

      res.json({ customer, token });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/auth/login
   */
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      const result = await pool.query('SELECT * FROM customers WHERE email = $1', [email]);

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const customer = result.rows[0];

      if (customer.suspended) {
        return res.status(403).json({ error: 'Account suspended. Please contact support.' });
      }

      const valid = await bcrypt.compare(password, customer.password_hash);

      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      await pool.query('UPDATE customers SET last_login_at = NOW() WHERE id = $1', [customer.id]);

      const token = generateToken(customer.id, customer.email);

      delete customer.password_hash;
      delete customer.password_reset_token;
      delete customer.email_verification_token;

      res.json({ customer, token });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/auth/verify
   */
  router.get('/verify', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, email, business_name, industry, location, plan, status, credits_balance,
                brand_colors, visual_style, tone, avatar_id, voice_id, preferred_image_provider,
                is_admin, role, suspended, parent_customer_id, free_geo_audit_used
         FROM customers WHERE id = $1`,
        [req.customerId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      const customer = result.rows[0];
      if (customer.suspended) {
        return res.status(403).json({ error: 'Account suspended' });
      }

      // Sub-accounts share the parent's credit pool and admin status
      if (customer.parent_customer_id) {
        const parentRow = await pool.query(
          `SELECT credits_balance, free_geo_audit_used, is_admin FROM customers WHERE id = $1`,
          [customer.parent_customer_id]
        );
        if (parentRow.rows.length) {
          customer.credits_balance = parentRow.rows[0].credits_balance;
          customer.free_geo_audit_used = parentRow.rows[0].free_geo_audit_used;
          customer.is_admin = customer.is_admin || parentRow.rows[0].is_admin;
          customer.is_sub_account = true;
        }
      }

      res.json({ customer });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/auth/forgot-password
   */
  router.post('/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email required' });

      const customer = await pool.query('SELECT id FROM customers WHERE email = $1', [email]);

      if (customer.rows.length > 0) {
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 60 * 60 * 1000);

        await pool.query(
          'UPDATE customers SET password_reset_token = $1, password_reset_expires = $2 WHERE email = $3',
          [token, expires, email]
        );

        emailQueue.notifyPasswordReset(email, token);
      }

      res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/auth/reset-password
   */
  router.post('/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });
      if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be 8+ characters' });

      const result = await pool.query(
        'SELECT id FROM customers WHERE password_reset_token = $1 AND password_reset_expires > NOW()',
        [token]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      const hash = await bcrypt.hash(newPassword, 10);
      await pool.query(
        'UPDATE customers SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2',
        [hash, result.rows[0].id]
      );

      res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
