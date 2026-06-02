const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { generateToken, authenticate, invalidatePwCache } = require('../middleware/auth');
const EmailQueue = require('../services/EmailQueue');
const OnboardingEmailService = require('../services/OnboardingEmailService');

module.exports = (pool) => {
  const router = express.Router();
  const emailQueue = new EmailQueue(pool);
  const onboardingEmail = new OnboardingEmailService(pool);

  /**
   * POST /api/auth/register
   */
  router.post('/register', async (req, res) => {
    try {
      const { email, password, businessName, industry, location, parentRef, referredBy } = req.body;

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

      const passwordHash = await bcrypt.hash(password, 12);

      let parentCustomerId = null;
      if (parentRef) {
        const parentCheck = await pool.query('SELECT id FROM customers WHERE id = $1', [parseInt(parentRef, 10) || 0]);
        if (parentCheck.rows.length) parentCustomerId = parentCheck.rows[0].id;
      }

      // Validate referral code if provided
      let validatedReferralCode = null;
      if (referredBy) {
        const refCheck = await pool.query('SELECT referral_code FROM customers WHERE referral_code = $1', [referredBy.toUpperCase()]);
        if (refCheck.rows.length) validatedReferralCode = referredBy.toUpperCase();
      }

      const result = await pool.query(
        `INSERT INTO customers (email, password_hash, business_name, industry, location, parent_customer_id, referred_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, email, business_name, industry, location, plan, credits_balance, status`,
        [email, passwordHash, businessName, industry || 'other', location || '', parentCustomerId, validatedReferralCode]
      );

      const customer = result.rows[0];
      const token = generateToken(customer.id, customer.email);

      if (!parentCustomerId) {
        await pool.query(
          `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
           VALUES ($1, 'bonus', 10, 10, 'Welcome bonus - 10 free credits')`,
          [customer.id]
        );
      }

      // Record this IP → customer registration (non-blocking, fail silently)
      pool.query(
        `INSERT INTO trial_ip_registrations (ip_address, customer_id) VALUES ($1, $2)`,
        [clientIp, customer.id]
      ).catch(err => console.warn('[Auth] Could not record trial IP:', err.message));

      // Send Day 0 onboarding email (non-blocking) — replaces generic welcome
      onboardingEmail.sendDay0({ id: customer.id, email: customer.email, business_name: customer.business_name, industry: industry || 'general_contractor', credits_balance: 10 }).catch(() => {});

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
                is_admin, role, suspended, parent_customer_id, free_geo_audit_used,
                workspace_role, workspace_permissions,
                white_label_config, logo_url, avatar_url, tagline,
                posting_streak, total_posts_this_month, timezone
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

      // Share the billing owner's credit pool.
      // Covers Type A (parent_customer_id in DB) and Type B transition — old 30-day JWTs
      // carry parentCustomerId for up to 30 days after the legacy column is cleared.
      if (customer.parent_customer_id || req.parentCustomerId) {
        const ownerIdToUse = customer.parent_customer_id || req.parentCustomerId;
        const parentRow = await pool.query(
          `SELECT credits_balance, free_geo_audit_used, is_admin, white_label_config FROM customers WHERE id = $1`,
          [ownerIdToUse]
        );
        if (parentRow.rows.length) {
          const p = parentRow.rows[0];
          customer.credits_balance     = p.credits_balance;
          customer.free_geo_audit_used = p.free_geo_audit_used;
          customer.is_admin            = customer.is_admin || p.is_admin;
          customer.is_sub_account      = !!customer.parent_customer_id;
          customer.is_member           = !customer.parent_customer_id && !!req.parentCustomerId;
          // Inherit parent agency branding so sub-accounts see the white-label UI
          if (p.white_label_config && Object.keys(p.white_label_config).length) {
            customer.white_label_config = p.white_label_config;
          }
        }
      } else if (req.ownerId) {
        // Invited member (Type B) operating in workspace context — pull credits from workspace owner
        const [ownerRow, memberRoleRow] = await Promise.all([
          pool.query(`SELECT credits_balance, free_geo_audit_used, white_label_config FROM customers WHERE id = $1`, [req.ownerId]),
          req.workspaceId
            ? pool.query(
                `SELECT role, permissions FROM workspace_members WHERE member_id = $1 AND workspace_id = $2 AND revoked_at IS NULL LIMIT 1`,
                [req.customerId, req.workspaceId]
              )
            : Promise.resolve({ rows: [] }),
        ]);
        if (ownerRow.rows.length) {
          const owner = ownerRow.rows[0];
          const memberRow = memberRoleRow.rows[0];
          customer.credits_balance      = owner.credits_balance;
          customer.free_geo_audit_used  = owner.free_geo_audit_used;
          customer.is_member            = true;
          customer.workspace_id         = req.workspaceId || null;
          customer.workspace_role       = memberRow?.role || 'editor';
          customer.workspace_permissions = memberRow?.permissions || null;
          // Inherit workspace owner's agency branding
          if (owner.white_label_config && Object.keys(owner.white_label_config).length) {
            customer.white_label_config = owner.white_label_config;
          }
        }
      }

      // Fire-and-forget: stamp last_active_at — non-blocking, never fails the request
      pool.query(
        `UPDATE customers SET last_active_at = NOW() WHERE id = $1`,
        [req.customerId]
      ).catch(() => {});

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

      // Always run the bcrypt hash on BOTH branches so response time is equalised
      // and attackers cannot enumerate registered emails via timing differences.
      const [tokenResult, bcryptDone] = await Promise.allSettled([
        (async () => {
          if (customer.rows.length === 0) {
            console.log(`[ForgotPassword] No account found for submitted email`);
            return;
          }
          console.log(`[ForgotPassword] Account found (id=${customer.rows[0].id}), generating reset token`);
          const rawToken = crypto.randomBytes(32).toString('hex');
          const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
          const expires = new Date(Date.now() + 60 * 60 * 1000);
          await pool.query(
            'UPDATE customers SET password_reset_token = $1, password_reset_expires = $2 WHERE email = $3',
            [hashedToken, expires, email]
          );
          console.log(`[ForgotPassword] Token stored, queuing reset email`);
          await emailQueue.notifyPasswordReset(email, rawToken);
          console.log(`[ForgotPassword] Reset email queued successfully for id=${customer.rows[0].id}`);
        })(),
        bcrypt.hash('timing-equalizer', 12),
      ]);
      if (tokenResult.status === 'rejected') {
        console.error('[ForgotPassword] Token flow failed:', tokenResult.reason?.message);
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

      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      const result = await pool.query(
        'SELECT id FROM customers WHERE password_reset_token = $1 AND password_reset_expires > NOW()',
        [hashedToken]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      const hash = await bcrypt.hash(newPassword, 12);
      await pool.query(
        'UPDATE customers SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL, password_changed_at = NOW() WHERE id = $2',
        [hash, result.rows[0].id]
      );

      // Immediately evict from cache so the old token is rejected on the next request
      invalidatePwCache(result.rows[0].id);

      res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/auth/invite/:token — PUBLIC
   * Returns invite details so the frontend can render the accept page.
   */
  router.get('/invite/:token', async (req, res) => {
    try {
      const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
      const result = await pool.query(
        `SELECT wi.id, wi.email, wi.role, wi.permissions, wi.status, wi.expires_at,
                wi.workspace_id,
                c.business_name AS inviter_business_name,
                c.white_label_config AS inviter_white_label_config,
                ws.business_name AS workspace_business_name
         FROM workspace_invitations wi
         JOIN customers c ON c.id = wi.inviter_id
         LEFT JOIN customers ws ON ws.id = wi.workspace_id
         WHERE wi.token_hash = $1`,
        [tokenHash]
      );

      if (!result.rows.length) return res.status(404).json({ error: 'Invite not found' });
      const invite = result.rows[0];

      if (invite.status !== 'pending') {
        return res.status(410).json({
          error: invite.status === 'accepted'
            ? 'This invite has already been accepted.'
            : 'This invite has been cancelled.',
          status: invite.status,
        });
      }
      if (new Date(invite.expires_at) < new Date()) {
        return res.status(410).json({ error: 'This invite has expired. Ask the account owner to send a new one.', expired: true });
      }

      const existingCheck = await pool.query('SELECT id FROM customers WHERE email = $1', [invite.email]);

      const wlConfig = invite.inviter_white_label_config || {};
      res.json({
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          permissions: invite.permissions,
          inviterBusinessName: invite.inviter_business_name,
          workspaceId: invite.workspace_id,
          workspaceBusinessName: invite.workspace_business_name,
          expiresAt: invite.expires_at,
          agencyName: wlConfig.agencyName || null,
          agencyLogo: wlConfig.logo || null,
          agencyColor: wlConfig.primaryColor || null,
        },
        existingAccount: existingCheck.rows.length > 0,
      });
    } catch (err) {
      console.error('[Auth] Get invite error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/auth/invite/:token/accept — PUBLIC
   * Accept an invitation. Creates account (new user) or links existing account.
   * Body: { password }  — email always comes from the invite record, never from body.
   */
  router.post('/invite/:token/accept', async (req, res) => {
    const client = await pool.connect();
    try {
      const { password } = req.body;
      if (!password || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');

      // Re-validate invite fresh from DB (don't trust frontend state)
      const inviteResult = await pool.query(
        `SELECT wi.id, wi.email, wi.role, wi.permissions, wi.status, wi.expires_at, wi.accepted_by,
                wi.inviter_id, wi.workspace_id, c.business_name AS inviter_business_name
         FROM workspace_invitations wi
         JOIN customers c ON c.id = wi.inviter_id
         WHERE wi.token_hash = $1`,
        [tokenHash]
      );

      if (!inviteResult.rows.length) return res.status(404).json({ error: 'Invite not found' });
      const invite = inviteResult.rows[0];

      if (invite.status === 'accepted') {
        // Idempotent retry — re-issue workspace JWT if same user re-submits
        if (invite.accepted_by) {
          const existingCustomer = await pool.query('SELECT * FROM customers WHERE id = $1', [invite.accepted_by]);
          if (existingCustomer.rows.length) {
            const valid = await bcrypt.compare(password, existingCustomer.rows[0].password_hash);
            if (valid) {
              const c = existingCustomer.rows[0];
              delete c.password_hash;
              delete c.password_reset_token;
              return res.json({
                customer: c,
                token: generateToken(c.id, c.email, {
                  workspaceId: invite.workspace_id || invite.inviter_id,
                  ownerId:     invite.inviter_id,
                }),
              });
            }
          }
        }
        return res.status(410).json({ error: 'This invite link has already been used.' });
      }

      if (invite.status !== 'pending') {
        return res.status(410).json({ error: 'This invite has been cancelled.' });
      }
      if (new Date(invite.expires_at) < new Date()) {
        return res.status(410).json({ error: 'This invite has expired. Ask the account owner to send a new one.' });
      }

      await client.query('BEGIN');

      const existingCustomer = await client.query(
        'SELECT id, email, password_hash, suspended FROM customers WHERE email = $1',
        [invite.email]
      );

      let customer;

      if (existingCustomer.rows.length > 0) {
        // ── Branch A: existing user ──────────────────────────────────────────
        const existing = existingCustomer.rows[0];
        const valid = await bcrypt.compare(password, existing.password_hash);
        if (!valid) {
          await client.query('ROLLBACK');
          return res.status(401).json({ error: 'Incorrect password' });
        }
        if (existing.suspended) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'Your account is suspended. Contact support.' });
        }

        // Block only if already an active member of THIS specific workspace (multi-workspace is allowed)
        const alreadyMember = await client.query(
          `SELECT id FROM workspace_members
           WHERE member_id = $1 AND workspace_id = $2 AND revoked_at IS NULL`,
          [existing.id, invite.inviter_id]
        );
        if (alreadyMember.rows.length) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Your account is already a member of this workspace.' });
        }

        await client.query('UPDATE customers SET last_login_at = NOW() WHERE id = $1', [existing.id]);
        customer = existing;
      } else {
        // ── Branch B: new user ───────────────────────────────────────────────
        // IP trial limit check (non-blocking on failure)
        const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';
        try {
          const ipCheck = await client.query(
            'SELECT COUNT(*) FROM trial_ip_registrations WHERE ip_address = $1',
            [clientIp]
          );
          if (parseInt(ipCheck.rows[0].count, 10) >= 2) {
            await client.query('ROLLBACK');
            return res.status(429).json({ error: 'Trial limit reached for this network. Please contact support.' });
          }
        } catch (_) { /* table may not exist — allow */ }

        const passwordHash = await bcrypt.hash(password, 12);
        const businessName = invite.email.split('@')[0];

        // New accounts are created clean — no parent_customer_id, they are first-class accounts
        const insertResult = await client.query(
          `INSERT INTO customers
             (email, password_hash, business_name, industry, location, status, plan, credits_balance)
           VALUES ($1, $2, $3, 'other', '', 'active', 'trial', 0)
           RETURNING id, email, business_name, industry, location, plan, credits_balance, status`,
          [invite.email, passwordHash, businessName]
        );
        customer = insertResult.rows[0];

        // Record trial IP (non-blocking)
        client.query(
          'INSERT INTO trial_ip_registrations (ip_address, customer_id) VALUES ($1, $2)',
          [clientIp, customer.id]
        ).catch(() => {});
      }

      const targetWorkspaceId = invite.workspace_id || invite.inviter_id;

      // Create workspace membership row (idempotent — un-revokes if member was previously removed)
      await client.query(
        `INSERT INTO workspace_members
           (workspace_id, member_id, owner_id, role, permissions, invited_by, joined_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (workspace_id, member_id)
           DO UPDATE SET revoked_at  = NULL,
                         role        = EXCLUDED.role,
                         permissions = EXCLUDED.permissions,
                         updated_at  = NOW()`,
        [
          targetWorkspaceId,
          customer.id,
          invite.inviter_id,
          invite.role,
          invite.permissions ? JSON.stringify(invite.permissions) : null,
          invite.inviter_id,
        ]
      );

      // Mark invite accepted
      await client.query(
        `UPDATE workspace_invitations
         SET status = 'accepted', accepted_at = NOW(), accepted_by = $1
         WHERE id = $2`,
        [customer.id, invite.id]
      );

      await client.query('COMMIT');

      // Issue a workspace-context JWT — ownerId enables getBillingCustomerId to resolve to the owner
      const token = generateToken(customer.id, customer.email, {
        workspaceId: targetWorkspaceId,
        ownerId:     invite.inviter_id,
      });
      res.json({ customer, token });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[Auth] Accept invite error:', err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  return router;
};
