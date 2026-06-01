const express = require('express');
const { authenticate, getBillingCustomerId } = require('../middleware/auth');
const GeoAuditService = require('../services/GeoAuditService');

module.exports = (pool) => {
  const router = express.Router();
  const geoAuditService = new GeoAuditService(pool);

  // Startup migrations — safe to re-run
  (async () => {
    try {
      await pool.query(`ALTER TABLE geo_audits ADD COLUMN IF NOT EXISTS service_focus VARCHAR(50)`);
      await pool.query(`ALTER TABLE geo_audits ADD COLUMN IF NOT EXISTS known_competitors TEXT[]`);
    } catch (err) {
      console.error('[GeoAudit] migration error:', err.message);
    }
  })();

  // POST /api/geo/audit — trigger a new audit
  router.post('/audit', authenticate, async (req, res) => {
    try {
      const customerId = req.customerId;
      const billingId = getBillingCustomerId(req); // parent account when in a workspace

      const { rows } = await pool.query('SELECT * FROM customers WHERE id = $1', [customerId]);
      if (!rows.length) return res.status(404).json({ error: 'Customer not found' });
      const customer = rows[0];

      // Fetch billing account (may differ from customer when inside a workspace)
      const billingRow = billingId !== customerId
        ? await pool.query('SELECT * FROM customers WHERE id = $1', [billingId])
        : { rows: [customer] };
      const billing = billingRow.rows[0];

      // Body params override profile values (from pre-audit config form)
      const businessName = (req.body.businessName || customer.business_name || '').trim();
      const location = (req.body.location || customer.location || '').trim();
      const serviceFocus = req.body.serviceFocus || 'all';
      const competitors = Array.isArray(req.body.competitors)
        ? req.body.competitors.filter(Boolean).slice(0, 3)
        : [];
      const services = Array.isArray(req.body.services)
        ? req.body.services.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim()).slice(0, 10)
        : [];

      if (!location) {
        return res.status(400).json({ error: 'Please enter your city or service area before running a GEO Audit.' });
      }

      // Check if there's already a running audit
      const running = await pool.query(
        `SELECT id FROM geo_audits WHERE customer_id = $1 AND status = 'running' LIMIT 1`,
        [customerId]
      );
      if (running.rows.length) {
        return res.status(409).json({ error: 'An audit is already running. Please wait for it to complete.', auditId: running.rows[0].id });
      }

      // Use a serialised transaction with SELECT FOR UPDATE to prevent
      // concurrent requests from both passing the credit balance check
      // (race condition that would allow double-spending 5 credits).
      let isFree = false;
      let audit;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const { rows: [billingLocked] } = await client.query(
          'SELECT credits_balance, free_geo_audit_used FROM customers WHERE id = $1 FOR UPDATE',
          [billingId]
        );
        if (!billingLocked) throw Object.assign(new Error('Billing account not found'), { status: 404 });

        if (!billingLocked.free_geo_audit_used) {
          await client.query('UPDATE customers SET free_geo_audit_used = true WHERE id = $1', [billingId]);
          isFree = true;
        } else {
          if ((billingLocked.credits_balance || 0) < 5) {
            throw Object.assign(
              new Error('You need 5 credits to run a GEO Audit. Please purchase more credits or upgrade your plan.'),
              { status: 402 }
            );
          }
          await client.query(
            'UPDATE customers SET credits_balance = credits_balance - 5 WHERE id = $1',
            [billingId]
          );
          await client.query(
            `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
             VALUES ($1, 'debit', -5, $2, 'GEO Audit — AI visibility check')`,
            [billingId, (billingLocked.credits_balance || 0) - 5]
          );
        }

        const { rows: [auditRow] } = await client.query(
          `INSERT INTO geo_audits (customer_id, industry, location, is_free, status, service_focus, known_competitors)
           VALUES ($1, $2, $3, $4, 'running', $5, $6) RETURNING id`,
          [customerId, customer.industry, location, isFree, serviceFocus, competitors]
        );
        audit = auditRow;

        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        if (txErr.status === 402) return res.status(402).json({ error: txErr.message });
        if (txErr.status === 404) return res.status(404).json({ error: txErr.message });
        throw txErr;
      } finally {
        client.release();
      }

      // Merge body params into customer object for the audit
      const auditCustomer = { ...customer, business_name: businessName, location };

      // Fire-and-forget — client polls for completion
      geoAuditService.runAudit(auditCustomer, audit.id, { serviceFocus, competitors, services }).catch(async (err) => {
        console.error('[GeoAudit route] runAudit failed:', err.message);
        await pool.query(`UPDATE geo_audits SET status = 'failed' WHERE id = $1`, [audit.id]);
        // Refund the cost so failed audits don't consume the user's entitlement
        try {
          if (isFree) {
            await pool.query('UPDATE customers SET free_geo_audit_used = false WHERE id = $1', [billingId]);
          } else {
            await pool.query('UPDATE customers SET credits_balance = credits_balance + 5 WHERE id = $1', [billingId]);
            await pool.query(
              `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
               VALUES ($1, 'credit', 5,
                       (SELECT credits_balance FROM customers WHERE id = $1),
                       'GEO Audit failed — refund')`,
              [billingId]
            );
          }
        } catch (refundErr) {
          console.error('[GeoAudit route] Refund after failure failed:', refundErr.message);
        }
      });

      res.json({ auditId: audit.id, status: 'running', isFree });
    } catch (err) {
      console.error('[GeoAudit] POST /audit:', err);
      res.status(500).json({ error: 'Failed to start audit' });
    }
  });

  // GET /api/geo/audit/latest — most recent audit
  router.get('/audit/latest', authenticate, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, status, geo_score, citations_found, total_queries, industry, location,
                report_data, is_free, created_at, completed_at, service_focus, known_competitors
         FROM geo_audits
         WHERE customer_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [req.customerId]
      );
      if (!rows.length) return res.json({ audit: null });
      res.json({ audit: rows[0] });
    } catch (err) {
      console.error('[GeoAudit] GET /audit/latest:', err);
      res.status(500).json({ error: 'Failed to fetch audit' });
    }
  });

  // GET /api/geo/audit/:id — full audit report
  router.get('/audit/:id', authenticate, async (req, res) => {
    try {
      const auditId = parseInt(req.params.id);
      if (isNaN(auditId)) return res.status(400).json({ error: 'Invalid audit ID' });

      const { rows } = await pool.query(
        `SELECT id, customer_id, status, geo_score, citations_found, total_queries,
                industry, location, report_data, is_free, created_at, completed_at,
                service_focus, known_competitors
         FROM geo_audits WHERE id = $1`,
        [auditId]
      );
      if (!rows.length) return res.status(404).json({ error: 'Audit not found' });
      if (rows[0].customer_id !== req.customerId) return res.status(403).json({ error: 'Forbidden' });

      res.json({ audit: rows[0] });
    } catch (err) {
      console.error('[GeoAudit] GET /audit/:id:', err);
      res.status(500).json({ error: 'Failed to fetch audit' });
    }
  });

  // GET /api/geo/history — past audits list
  router.get('/history', authenticate, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, status, geo_score, citations_found, total_queries, is_free, created_at, completed_at
         FROM geo_audits
         WHERE customer_id = $1
         ORDER BY created_at DESC LIMIT 20`,
        [req.customerId]
      );
      res.json({ history: rows });
    } catch (err) {
      console.error('[GeoAudit] GET /history:', err);
      res.status(500).json({ error: 'Failed to fetch history' });
    }
  });

  // GET /api/geo/score — lightweight card data for dashboard
  router.get('/score', authenticate, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT geo_score, last_geo_audit_at, free_geo_audit_used, credits_balance
         FROM customers WHERE id = $1`,
        [req.customerId]
      );
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      const c = rows[0];

      const latest = await pool.query(
        `SELECT id FROM geo_audits WHERE customer_id = $1 AND status = 'complete' ORDER BY created_at DESC LIMIT 1`,
        [req.customerId]
      );

      res.json({
        score: c.geo_score || 0,
        lastAuditAt: c.last_geo_audit_at,
        freeAuditUsed: c.free_geo_audit_used || false,
        latestAuditId: latest.rows[0]?.id || null,
      });
    } catch (err) {
      console.error('[GeoAudit] GET /score:', err);
      res.status(500).json({ error: 'Failed to fetch score' });
    }
  });

  return router;
};
