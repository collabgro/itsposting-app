const express = require('express');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const { authenticate, generateToken } = require('../middleware/auth');
const { encrypt, testAgencyEmail } = require('../services/AgencyEmailService');

module.exports = (pool) => {
  const router = express.Router();

  async function requireAgencyPlan(req, res, next) {
    try {
      const { rows } = await pool.query(
        'SELECT plan, suspended FROM customers WHERE id = $1',
        [req.customerId]
      );
      if (!rows[0] || rows[0].plan !== 'agency') {
        return res.status(403).json({ error: 'Agency plan required to access this feature.' });
      }
      if (rows[0].suspended) {
        return res.status(403).json({ error: 'Account suspended.' });
      }
      next();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  router.use(authenticate, requireAgencyPlan);

  // ── GET /api/agency/overview ────────────────────────────────────────────────
  router.get('/overview', async (req, res) => {
    try {
      const agencyId = req.customerId;

      const [clientsR, creditsR, usageR, plansR, activityR] = await Promise.all([
        pool.query(
          `SELECT COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE status = 'active' AND NOT COALESCE(suspended, false)) AS active
           FROM customers WHERE parent_customer_id = $1`,
          [agencyId]
        ),
        pool.query(
          'SELECT credits_balance FROM customers WHERE id = $1',
          [agencyId]
        ),
        pool.query(
          `SELECT COALESCE(SUM(ABS(amount)), 0) AS used_this_month
           FROM credit_transactions
           WHERE customer_id = $1
             AND transaction_type = 'deduction'
             AND created_at >= date_trunc('month', NOW())`,
          [agencyId]
        ),
        pool.query(
          'SELECT COUNT(*) AS total FROM agency_plans WHERE agency_id = $1 AND is_active = true',
          [agencyId]
        ),
        pool.query(
          `SELECT ct.id, ct.amount, ct.transaction_type, ct.description, ct.created_at,
                  c.business_name, c.workspace_display_name
           FROM credit_transactions ct
           JOIN customers c ON c.id = ct.customer_id
           WHERE c.parent_customer_id = $1
           ORDER BY ct.created_at DESC LIMIT 10`,
          [agencyId]
        ),
      ]);

      res.json({
        totalClients:        parseInt(clientsR.rows[0].total),
        activeClients:       parseInt(clientsR.rows[0].active),
        creditsRemaining:    parseInt(creditsR.rows[0]?.credits_balance || 0),
        creditsUsedThisMonth: parseFloat(usageR.rows[0].used_this_month),
        activePlans:         parseInt(plansR.rows[0].total),
        recentActivity:      activityR.rows,
      });
    } catch (err) {
      console.error('[agency/overview]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/agency/clients ─────────────────────────────────────────────────
  router.get('/clients', async (req, res) => {
    try {
      const agencyId = req.customerId;
      const limit  = Math.min(parseInt(req.query.limit)  || 50, 100);
      const offset = Math.max(parseInt(req.query.offset) || 0,  0);

      const [dataR, countR] = await Promise.all([
        pool.query(
          `SELECT c.id, c.business_name, c.workspace_display_name, c.industry,
                  c.location, c.status, c.suspended, c.suspension_reason, c.created_at,
                  ap.id AS plan_id, ap.name AS plan_name, ap.credits_per_month,
                  wpa.monthly_credit_budget, wpa.credits_used_this_cycle, wpa.cycle_reset_at,
                  COALESCE((
                    SELECT SUM(ABS(ct.amount))
                    FROM credit_transactions ct
                    WHERE ct.customer_id = c.id
                      AND ct.transaction_type = 'deduction'
                      AND ct.created_at >= date_trunc('month', NOW())
                  ), 0) AS credits_used_this_month
           FROM customers c
           LEFT JOIN workspace_plan_assignments wpa ON wpa.workspace_id = c.id
           LEFT JOIN agency_plans ap ON ap.id = wpa.agency_plan_id
           WHERE c.parent_customer_id = $1
           ORDER BY c.created_at DESC
           LIMIT $2 OFFSET $3`,
          [agencyId, limit, offset]
        ),
        pool.query(
          `SELECT COUNT(*) AS total FROM customers WHERE parent_customer_id = $1`,
          [agencyId]
        ),
      ]);

      res.json({
        clients: dataR.rows,
        total:   parseInt(countR.rows[0].total),
        limit,
        offset,
      });
    } catch (err) {
      console.error('[agency/clients]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/agency/clients/:id ─────────────────────────────────────────────
  router.get('/clients/:id', async (req, res) => {
    try {
      const agencyId  = req.customerId;
      const clientId  = parseInt(req.params.id);

      const clientR = await pool.query(
        `SELECT c.id, c.business_name, c.workspace_display_name, c.industry, c.location,
                c.status, c.suspended, c.suspension_reason, c.created_at, c.website_url,
                ap.id AS plan_id, ap.name AS plan_name, ap.credits_per_month,
                wpa.monthly_credit_budget, wpa.credits_used_this_cycle, wpa.cycle_reset_at
         FROM customers c
         LEFT JOIN workspace_plan_assignments wpa ON wpa.workspace_id = c.id
         LEFT JOIN agency_plans ap ON ap.id = wpa.agency_plan_id
         WHERE c.id = $1 AND c.parent_customer_id = $2`,
        [clientId, agencyId]
      );
      if (!clientR.rows[0]) return res.status(404).json({ error: 'Client not found' });

      const historyR = await pool.query(
        `SELECT id, amount, transaction_type, description, balance_after, created_at
         FROM credit_transactions WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 30`,
        [clientId]
      );

      // Monthly usage for last 6 months
      const monthlyR = await pool.query(
        `SELECT date_trunc('month', created_at) AS month,
                COALESCE(SUM(ABS(amount)) FILTER (WHERE transaction_type = 'deduction'), 0) AS used
         FROM credit_transactions
         WHERE customer_id = $1 AND created_at >= NOW() - INTERVAL '6 months'
         GROUP BY 1 ORDER BY 1`,
        [clientId]
      );

      res.json({
        client:       clientR.rows[0],
        creditHistory: historyR.rows,
        monthlyUsage:  monthlyR.rows,
      });
    } catch (err) {
      console.error('[agency/clients/:id]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/agency/clients — create new client workspace ──────────────────
  router.post('/clients', async (req, res) => {
    try {
      const agencyId = req.customerId;
      const { businessName, industry, location, displayName } = req.body;

      if (!businessName || businessName.trim().length < 2) {
        return res.status(400).json({ error: 'Business name required (min 2 characters).' });
      }

      const wsEmail        = `workspace-${agencyId}-${Date.now()}@internal.itsposting.com`;
      const wsPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);

      const { rows } = await pool.query(
        `INSERT INTO customers (
           email, password_hash, business_name, workspace_display_name,
           industry, location, plan, status, credits_balance,
           parent_customer_id, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,'trial','active',0,$7,NOW(),NOW())
         RETURNING id, business_name, workspace_display_name, industry, location, status, created_at`,
        [wsEmail, wsPasswordHash, businessName.trim(), displayName?.trim() || null,
         industry || null, location || null, agencyId]
      );

      res.status(201).json({ client: rows[0] });
    } catch (err) {
      console.error('[agency/clients POST]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── PATCH /api/agency/clients/:id ──────────────────────────────────────────
  router.patch('/clients/:id', async (req, res) => {
    try {
      const agencyId = req.customerId;
      const clientId = parseInt(req.params.id);
      const { businessName, displayName, suspended, suspensionReason } = req.body;

      const own = await pool.query(
        'SELECT id FROM customers WHERE id = $1 AND parent_customer_id = $2',
        [clientId, agencyId]
      );
      if (!own.rows[0]) return res.status(404).json({ error: 'Client not found' });

      const sets = ['updated_at = NOW()'];
      const vals = [];
      let i = 1;

      if (businessName !== undefined) { sets.push(`business_name = $${i++}`); vals.push(businessName.trim()); }
      if (displayName  !== undefined) { sets.push(`workspace_display_name = $${i++}`); vals.push(displayName?.trim() || null); }
      if (suspended    !== undefined) {
        sets.push(`suspended = $${i++}`); vals.push(!!suspended);
        if (suspended && suspensionReason) { sets.push(`suspension_reason = $${i++}`); vals.push(suspensionReason); }
        if (!suspended) sets.push(`suspension_reason = NULL`);
      }

      vals.push(clientId, agencyId);

      const { rows } = await pool.query(
        `UPDATE customers SET ${sets.join(', ')}
         WHERE id = $${i++} AND parent_customer_id = $${i++}
         RETURNING id, business_name, workspace_display_name, suspended, status`,
        vals
      );

      res.json({ client: rows[0] });
    } catch (err) {
      console.error('[agency/clients PATCH]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── DELETE /api/agency/clients/:id — archive (soft-delete) ─────────────────
  router.delete('/clients/:id', async (req, res) => {
    try {
      const agencyId = req.customerId;
      const clientId = parseInt(req.params.id);

      const { rows } = await pool.query(
        `UPDATE customers SET suspended = true, suspension_reason = 'Archived by agency', updated_at = NOW()
         WHERE id = $1 AND parent_customer_id = $2 RETURNING id`,
        [clientId, agencyId]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Client not found' });

      res.json({ ok: true });
    } catch (err) {
      console.error('[agency/clients DELETE]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/agency/plans ───────────────────────────────────────────────────
  router.get('/plans', async (req, res) => {
    try {
      const agencyId = req.customerId;
      const { rows } = await pool.query(
        `SELECT ap.*,
                COUNT(wpa.workspace_id) AS client_count
         FROM agency_plans ap
         LEFT JOIN workspace_plan_assignments wpa ON wpa.agency_plan_id = ap.id
         WHERE ap.agency_id = $1
         GROUP BY ap.id
         ORDER BY ap.created_at ASC`,
        [agencyId]
      );
      res.json({ plans: rows });
    } catch (err) {
      console.error('[agency/plans]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/agency/plans ──────────────────────────────────────────────────
  router.post('/plans', async (req, res) => {
    try {
      const agencyId = req.customerId;
      const { name, creditsPerMonth, monthlyCapEnabled, priceMonthly, priceYearly, featureFlags } = req.body;

      if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Plan name required.' });
      const credits = parseInt(creditsPerMonth);
      if (!credits || credits < 1) return res.status(400).json({ error: 'Credits per month must be at least 1.' });

      const DEFAULT_FLAGS = { wizard: true, quick_post: true, calendar: true, analytics: true, geo_audit: false, inbox: false, competitor_intel: false, templates: true, media_library: true, api_keys: false };
      const flags = featureFlags ? { ...DEFAULT_FLAGS, ...featureFlags } : DEFAULT_FLAGS;

      const { rows } = await pool.query(
        `INSERT INTO agency_plans (agency_id, name, credits_per_month, monthly_cap_enabled, price_monthly, price_yearly, feature_flags)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [agencyId, name.trim(), credits, !!monthlyCapEnabled, priceMonthly || null, priceYearly || null, JSON.stringify(flags)]
      );

      res.status(201).json({ plan: rows[0] });
    } catch (err) {
      console.error('[agency/plans POST]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── PATCH /api/agency/plans/:id ─────────────────────────────────────────────
  router.patch('/plans/:id', async (req, res) => {
    try {
      const agencyId = req.customerId;
      const planId   = parseInt(req.params.id);
      const { name, creditsPerMonth, monthlyCapEnabled, priceMonthly, priceYearly, isActive, featureFlags } = req.body;

      const sets = [];
      const vals = [];
      let i = 1;

      if (name              !== undefined) { sets.push(`name = $${i++}`);                vals.push(name.trim()); }
      if (creditsPerMonth   !== undefined) { sets.push(`credits_per_month = $${i++}`);   vals.push(parseInt(creditsPerMonth)); }
      if (monthlyCapEnabled !== undefined) { sets.push(`monthly_cap_enabled = $${i++}`); vals.push(!!monthlyCapEnabled); }
      if (priceMonthly      !== undefined) { sets.push(`price_monthly = $${i++}`);       vals.push(priceMonthly || null); }
      if (priceYearly       !== undefined) { sets.push(`price_yearly = $${i++}`);        vals.push(priceYearly || null); }
      if (isActive          !== undefined) { sets.push(`is_active = $${i++}`);           vals.push(!!isActive); }
      if (featureFlags      !== undefined) { sets.push(`feature_flags = $${i++}`);       vals.push(JSON.stringify(featureFlags)); }

      if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update.' });
      vals.push(planId, agencyId);

      const { rows } = await pool.query(
        `UPDATE agency_plans SET ${sets.join(', ')} WHERE id = $${i++} AND agency_id = $${i++} RETURNING *`,
        vals
      );
      if (!rows[0]) return res.status(404).json({ error: 'Plan not found.' });

      res.json({ plan: rows[0] });
    } catch (err) {
      console.error('[agency/plans PATCH]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/agency/clients/:id/assign-plan ────────────────────────────────
  router.post('/clients/:id/assign-plan', async (req, res) => {
    try {
      const agencyId = req.customerId;
      const clientId = parseInt(req.params.id);
      const { planId } = req.body; // null = remove plan

      const own = await pool.query(
        'SELECT id FROM customers WHERE id = $1 AND parent_customer_id = $2',
        [clientId, agencyId]
      );
      if (!own.rows[0]) return res.status(404).json({ error: 'Client not found.' });

      if (planId) {
        const planR = await pool.query(
          'SELECT credits_per_month, monthly_cap_enabled FROM agency_plans WHERE id = $1 AND agency_id = $2 AND is_active = true',
          [planId, agencyId]
        );
        if (!planR.rows[0]) return res.status(404).json({ error: 'Plan not found or inactive.' });

        const { credits_per_month, monthly_cap_enabled } = planR.rows[0];
        const budget = monthly_cap_enabled ? credits_per_month : null;

        await pool.query(
          `INSERT INTO workspace_plan_assignments
             (workspace_id, agency_id, agency_plan_id, monthly_credit_budget, cycle_reset_at)
           VALUES ($1,$2,$3,$4, date_trunc('month', NOW()) + INTERVAL '1 month')
           ON CONFLICT (workspace_id) DO UPDATE SET
             agency_plan_id = EXCLUDED.agency_plan_id,
             monthly_credit_budget = EXCLUDED.monthly_credit_budget,
             cycle_reset_at = EXCLUDED.cycle_reset_at`,
          [clientId, agencyId, planId, budget]
        );
      } else {
        await pool.query(
          'DELETE FROM workspace_plan_assignments WHERE workspace_id = $1 AND agency_id = $2',
          [clientId, agencyId]
        );
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('[agency/clients/assign-plan]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/agency/clients/:id/credits — allocate credits from agency pool ─
  router.post('/clients/:id/credits', async (req, res) => {
    try {
      const agencyId = req.customerId;
      const clientId = parseInt(req.params.id);
      const { amount, reason } = req.body;

      const credits = parseInt(amount);
      if (!credits || credits < 1) return res.status(400).json({ error: 'Amount must be at least 1.' });

      const ownR = await pool.query(
        'SELECT id FROM customers WHERE id = $1 AND parent_customer_id = $2',
        [clientId, agencyId]
      );
      if (!ownR.rows[0]) return res.status(404).json({ error: 'Client not found.' });

      const pgClient = await pool.connect();
      try {
        await pgClient.query('BEGIN');

        // Check + lock agency balance
        const agencyR = await pgClient.query(
          'SELECT credits_balance FROM customers WHERE id = $1 FOR UPDATE',
          [agencyId]
        );
        if (agencyR.rows[0].credits_balance < credits) {
          await pgClient.query('ROLLBACK');
          pgClient.release();
          return res.status(400).json({ error: 'Insufficient credits in your agency account.' });
        }

        const newAgencyBalance = agencyR.rows[0].credits_balance - credits;

        await pgClient.query(
          'UPDATE customers SET credits_balance = $1, updated_at = NOW() WHERE id = $2',
          [newAgencyBalance, agencyId]
        );
        await pgClient.query(
          `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description, created_at)
           VALUES ($1,'agency_allocation',$2,$3,$4,NOW())`,
          [agencyId, -credits, newAgencyBalance, reason ? `Allocated to client: ${reason}` : `Allocated to client workspace #${clientId}`]
        );

        const clientR = await pgClient.query(
          'SELECT credits_balance FROM customers WHERE id = $1 FOR UPDATE',
          [clientId]
        );
        const newClientBalance = (clientR.rows[0]?.credits_balance || 0) + credits;
        await pgClient.query(
          'UPDATE customers SET credits_balance = $1, updated_at = NOW() WHERE id = $2',
          [newClientBalance, clientId]
        );
        await pgClient.query(
          `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description, created_at)
           VALUES ($1,'agency_allocation',$2,$3,$4,NOW())`,
          [clientId, credits, newClientBalance, reason || 'Credits from agency']
        );

        await pgClient.query('COMMIT');
        res.json({ ok: true, agencyBalance: newAgencyBalance, clientBalance: newClientBalance });
      } catch (inner) {
        await pgClient.query('ROLLBACK').catch(() => {});
        throw inner;
      } finally {
        pgClient.release();
      }
    } catch (err) {
      console.error('[agency/clients/credits]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/agency/credits/history ─────────────────────────────────────────
  router.get('/credits/history', async (req, res) => {
    try {
      const agencyId = req.customerId;
      const { rows } = await pool.query(
        `SELECT ct.id, ct.amount, ct.transaction_type, ct.description, ct.balance_after, ct.created_at,
                c.business_name, c.workspace_display_name
         FROM credit_transactions ct
         JOIN customers c ON c.id = ct.customer_id
         WHERE c.parent_customer_id = $1
         ORDER BY ct.created_at DESC LIMIT 100`,
        [agencyId]
      );
      res.json({ history: rows });
    } catch (err) {
      console.error('[agency/credits/history]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/agency/analytics ──────────────────────────────────────────────
  router.get('/analytics', async (req, res) => {
    try {
      const agencyId = req.customerId;

      const { rows } = await pool.query(
        `SELECT c.id, c.business_name, c.workspace_display_name, c.suspended,
                COALESCE(SUM(ABS(ct.amount)) FILTER (WHERE ct.transaction_type = 'deduction'
                  AND ct.created_at >= date_trunc('month', NOW())), 0) AS credits_used_this_month,
                COUNT(DISTINCT p.id) FILTER (WHERE p.created_at >= date_trunc('month', NOW())) AS posts_this_month,
                MAX(p.created_at) AS last_post_at,
                wpa.monthly_credit_budget, ap.name AS plan_name
         FROM customers c
         LEFT JOIN credit_transactions ct ON ct.customer_id = c.id
         LEFT JOIN posts p ON p.customer_id = c.id
         LEFT JOIN workspace_plan_assignments wpa ON wpa.workspace_id = c.id
         LEFT JOIN agency_plans ap ON ap.id = wpa.agency_plan_id
         WHERE c.parent_customer_id = $1
         GROUP BY c.id, wpa.monthly_credit_budget, ap.name
         ORDER BY credits_used_this_month DESC`,
        [agencyId]
      );

      // Clients at risk: 0 posts in 7 days, not suspended
      const atRisk = rows.filter(r =>
        !r.suspended &&
        (!r.last_post_at || (Date.now() - new Date(r.last_post_at)) > 7 * 86400000)
      );

      const totalCreditsUsed = rows.reduce((s, r) => s + parseFloat(r.credits_used_this_month || 0), 0);
      const totalPosts = rows.reduce((s, r) => s + parseInt(r.posts_this_month || 0), 0);

      res.json({
        clients: rows,
        atRisk,
        totalCreditsUsed,
        totalPosts,
        mostActive: rows[0] || null,
      });
    } catch (err) {
      console.error('[agency/analytics]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/agency/clients/:id/impersonate ───────────────────────────────
  router.post('/clients/:id/impersonate', async (req, res) => {
    try {
      const agencyId = req.customerId;
      const clientId = parseInt(req.params.id);

      const own = await pool.query(
        `SELECT id, email, business_name FROM customers WHERE id = $1 AND parent_customer_id = $2`,
        [clientId, agencyId]
      );
      if (!own.rows[0]) return res.status(404).json({ error: 'Client not found.' });

      const client = own.rows[0];
      // Short-lived token (2h) with parentCustomerId so billing still resolves to agency
      const token = generateToken(client.id, client.email, { parentCustomerId: agencyId, isAgencyImpersonation: true });

      res.json({ token, clientName: client.business_name });
    } catch (err) {
      console.error('[agency/impersonate]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/agency/email/save-config ─────────────────────────────────────
  // Stores agency email provider settings encrypted in white_label_config
  router.post('/email/save-config', async (req, res) => {
    try {
      const agencyId = req.customerId;
      const { emailProvider, emailApiKey, emailDomain, emailFrom, emailFromName, smtpHost, smtpPort, smtpUser, smtpPass } = req.body;

      if (!emailProvider || !['mailgun', 'resend', 'smtp'].includes(emailProvider)) {
        return res.status(400).json({ error: 'Valid emailProvider required: mailgun, resend, or smtp.' });
      }

      const emailConfig = { emailProvider };
      if (emailApiKey)    emailConfig.emailApiKey  = encrypt(emailApiKey);   // encrypt before storing
      if (emailDomain)    emailConfig.emailDomain   = String(emailDomain).substring(0, 100);
      if (emailFrom)      emailConfig.emailFrom     = String(emailFrom).substring(0, 100);
      if (emailFromName)  emailConfig.emailFromName = String(emailFromName).substring(0, 80);
      if (smtpHost)       emailConfig.smtpHost      = String(smtpHost).substring(0, 100);
      if (smtpPort)       emailConfig.smtpPort      = parseInt(smtpPort) || 587;
      if (smtpUser)       emailConfig.smtpUser      = String(smtpUser).substring(0, 100);
      if (smtpPass)       emailConfig.smtpPass      = encrypt(smtpPass);

      await pool.query(
        `UPDATE customers
            SET white_label_config = COALESCE(white_label_config, '{}'::jsonb) || $1::jsonb,
                updated_at = NOW()
          WHERE id = $2`,
        [JSON.stringify(emailConfig), agencyId]
      );

      res.json({ ok: true });
    } catch (err) {
      console.error('[agency/email/save-config]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/agency/email/test ─────────────────────────────────────────────
  router.post('/email/test', async (req, res) => {
    try {
      const agencyId = req.customerId;

      const { rows } = await pool.query('SELECT email, white_label_config FROM customers WHERE id = $1', [agencyId]);
      if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });

      const wl = rows[0].white_label_config || {};
      if (!wl.emailProvider) return res.status(400).json({ error: 'No email provider configured.' });

      await testAgencyEmail(wl, rows[0].email);
      res.json({ ok: true, sentTo: rows[0].email });
    } catch (err) {
      console.error('[agency/email/test]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/agency/broadcast ─────────────────────────────────────────────
  router.post('/broadcast', async (req, res) => {
    try {
      const agencyId = req.customerId;
      const { title, message } = req.body;

      if (!title?.trim() || !message?.trim()) {
        return res.status(400).json({ error: 'Title and message are required.' });
      }

      const clientsR = await pool.query(
        `SELECT id FROM customers WHERE parent_customer_id = $1 AND NOT COALESCE(suspended, false)`,
        [agencyId]
      );

      if (clientsR.rows.length === 0) return res.json({ sent: 0 });

      const inserts = clientsR.rows.map(c =>
        pool.query(
          `INSERT INTO notifications (customer_id, type, title, message) VALUES ($1, 'agency_broadcast', $2, $3)`,
          [c.id, title.trim().substring(0, 255), message.trim()]
        )
      );
      await Promise.all(inserts);

      res.json({ sent: clientsR.rows.length });
    } catch (err) {
      console.error('[agency/broadcast]', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
