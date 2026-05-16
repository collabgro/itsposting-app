const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { authenticate, generateToken } = require('../middleware/auth');

const WORKSPACE_LIMITS = {
  trial: 1,
  starter: 1,
  professional: 2,
  premium: 3,
};

module.exports = (pool) => {
  const router = express.Router();

  // Helper: resolve the main (billing) customer ID for the current request.
  // If req.parentCustomerId is set, the caller is in a workspace context.
  function mainCustomerId(req) {
    return req.parentCustomerId || req.customerId;
  }

  // ── GET /api/workspaces ──────────────────────────────────────────────────────
  // List all workspaces under the caller's main account.
  router.get('/', authenticate, async (req, res) => {
    try {
      const parentId = mainCustomerId(req);
      const result = await pool.query(
        `SELECT id, business_name, workspace_display_name, industry, location, status,
                created_at, plan, credits_balance
         FROM customers
         WHERE parent_customer_id = $1
         ORDER BY created_at ASC`,
        [parentId]
      );
      // Also fetch main account info
      const mainResult = await pool.query(
        `SELECT id, business_name, industry, location, plan, credits_balance, status
         FROM customers WHERE id = $1`,
        [parentId]
      );
      res.json({
        mainAccount: mainResult.rows[0] || null,
        workspaces: result.rows,
        planLimit: WORKSPACE_LIMITS[mainResult.rows[0]?.plan] || 1,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/workspaces ─────────────────────────────────────────────────────
  // Create a new workspace (child customer record).
  router.post('/', authenticate, async (req, res) => {
    try {
      const parentId = mainCustomerId(req);

      const mainResult = await pool.query(
        `SELECT plan, status, suspended FROM customers WHERE id = $1`,
        [parentId]
      );
      const main = mainResult.rows[0];
      if (!main) return res.status(404).json({ error: 'Account not found' });
      if (main.suspended) return res.status(403).json({ error: 'Account suspended' });

      const limit = WORKSPACE_LIMITS[main.plan] || 1;
      const countResult = await pool.query(
        `SELECT COUNT(*) AS cnt FROM customers WHERE parent_customer_id = $1`,
        [parentId]
      );
      const currentCount = parseInt(countResult.rows[0].cnt) + 1; // +1 for main account itself
      if (currentCount >= limit) {
        const nextPlan = main.plan === 'starter' ? 'Professional' : main.plan === 'professional' ? 'Premium' : null;
        return res.status(403).json({
          error: `Workspace limit reached for your plan (${limit} total). ${nextPlan ? `Upgrade to ${nextPlan} to add more workspaces.` : ''}`,
          limitReached: true,
          limit,
          nextPlan,
        });
      }

      const { businessName, industry, location, displayName } = req.body;
      if (!businessName || businessName.trim().length < 2) {
        return res.status(400).json({ error: 'Business name is required (min 2 characters)' });
      }

      // Generate a unique email for the workspace account (not user-facing, just for DB uniqueness)
      const wsEmail = `workspace-${parentId}-${Date.now()}@internal.itsposting.com`;
      // Use an irreversible random hash — workspace accounts are accessed only via parent JWT switch
      const wsPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);

      const insert = await pool.query(
        `INSERT INTO customers (
           email, password_hash, business_name, workspace_display_name,
           industry, location, plan, status, credits_balance,
           parent_customer_id, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, 'trial', 'active', 0, $7, NOW(), NOW())
         RETURNING id, business_name, workspace_display_name, industry, location, status, created_at`,
        [
          wsEmail,
          wsPasswordHash,
          businessName.trim(),
          displayName?.trim() || null,
          industry || null,
          location || null,
          parentId,
        ]
      );

      res.status(201).json({ workspace: insert.rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── PATCH /api/workspaces/:id ────────────────────────────────────────────────
  // Rename a workspace.
  router.patch('/:id', authenticate, async (req, res) => {
    try {
      const parentId = mainCustomerId(req);
      const wsId = parseInt(req.params.id);
      const { name } = req.body;
      if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Name too short' });

      const result = await pool.query(
        `UPDATE customers
         SET workspace_display_name = $1, business_name = $2, updated_at = NOW()
         WHERE id = $3 AND parent_customer_id = $4
         RETURNING id, business_name, workspace_display_name`,
        [name.trim(), name.trim(), wsId, parentId]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Workspace not found' });
      res.json({ workspace: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── DELETE /api/workspaces/:id ───────────────────────────────────────────────
  // Soft-delete (deactivate) a workspace.
  router.delete('/:id', authenticate, async (req, res) => {
    try {
      const parentId = mainCustomerId(req);
      const wsId = parseInt(req.params.id);

      const result = await pool.query(
        `UPDATE customers
         SET status = 'inactive', suspended = true, updated_at = NOW()
         WHERE id = $1 AND parent_customer_id = $2
         RETURNING id`,
        [wsId, parentId]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Workspace not found' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/workspaces/main/switch ─────────────────────────────────────────
  // Switch back to the main account from a workspace context.
  router.post('/main/switch', authenticate, async (req, res) => {
    try {
      const parentId = req.parentCustomerId;
      if (!parentId) {
        return res.status(400).json({ error: 'Already on the main account' });
      }
      const result = await pool.query(
        `SELECT id, email FROM customers WHERE id = $1`,
        [parentId]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Main account not found' });
      const main = result.rows[0];
      const token = generateToken(main.id, main.email);
      res.json({ token });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/workspaces/:id/switch ─────────────────────────────────────────
  // Switch into a workspace — returns a JWT with parentCustomerId set.
  router.post('/:id/switch', authenticate, async (req, res) => {
    try {
      const parentId = mainCustomerId(req);
      const wsId = parseInt(req.params.id);

      const result = await pool.query(
        `SELECT id, email, business_name, status, suspended
         FROM customers
         WHERE id = $1 AND parent_customer_id = $2`,
        [wsId, parentId]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Workspace not found' });
      const ws = result.rows[0];
      if (ws.suspended) return res.status(403).json({ error: 'This workspace is inactive' });

      // Issue workspace-scoped JWT — parentCustomerId carries the billing account
      const token = generateToken(ws.id, ws.email, { parentCustomerId: parentId });
      res.json({ token, workspaceName: ws.business_name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
