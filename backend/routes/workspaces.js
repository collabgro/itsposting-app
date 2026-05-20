const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { authenticate, generateToken } = require('../middleware/auth');
const EmailQueue = require('../services/EmailQueue');

const WORKSPACE_LIMITS = {
  trial: 1,
  starter: 1,
  professional: 2,
  premium: 3,
};

const VALID_ROLES = ['manager', 'editor', 'viewer'];

module.exports = (pool) => {
  const router = express.Router();
  const emailQueue = new EmailQueue(pool);

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

  // ── GET /api/workspaces/members ─────────────────────────────────────────────
  // List all team members — both workspace profiles (Type A) and invited members (Type B).
  router.get('/members', authenticate, async (req, res) => {
    try {
      const parentId = mainCustomerId(req);

      // Type A: auto-created workspace business profiles (fake internal emails)
      const profilesResult = await pool.query(
        `SELECT id, email, business_name, workspace_display_name, workspace_role AS role,
                workspace_permissions AS permissions, created_at, status,
                'workspace_profile' AS member_type
         FROM customers
         WHERE parent_customer_id = $1
           AND email LIKE 'workspace-%@internal.itsposting.com'
           AND status != 'inactive'
         ORDER BY created_at ASC`,
        [parentId]
      );

      // Type B: invited real users from workspace_members table
      const membersResult = await pool.query(
        `SELECT wm.id AS membership_id, c.id, c.email, c.business_name,
                wm.role, wm.permissions, wm.joined_at AS created_at,
                c.last_login_at, c.status, 'invited_member' AS member_type
         FROM workspace_members wm
         JOIN customers c ON c.id = wm.member_id
         WHERE wm.owner_id = $1 AND wm.revoked_at IS NULL
         ORDER BY wm.joined_at ASC`,
        [parentId]
      );

      res.json({
        members: membersResult.rows,
        workspaceProfiles: profilesResult.rows,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── PATCH /api/workspaces/members/:memberId ──────────────────────────────────
  // Update a team member's role and/or custom permissions.
  router.patch('/members/:memberId', authenticate, async (req, res) => {
    try {
      const parentId = mainCustomerId(req);
      const memberId = parseInt(req.params.memberId);
      const { role, permissions } = req.body;

      if (role && !VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Role must be manager, editor, or viewer' });
      }

      // Try new workspace_members table first (invited members)
      const wmUpdate = await pool.query(
        `UPDATE workspace_members
         SET role        = COALESCE($1, role),
             permissions = COALESCE($2, permissions),
             updated_at  = NOW()
         WHERE member_id = $3 AND owner_id = $4 AND revoked_at IS NULL
         RETURNING id`,
        [role || null, permissions ? JSON.stringify(permissions) : null, memberId, parentId]
      );

      if (!wmUpdate.rows.length) {
        // Fall back to old-style customers row (Type A workspace profiles)
        const legacyUpdate = await pool.query(
          `UPDATE customers
           SET workspace_role        = COALESCE($1, workspace_role),
               workspace_permissions = COALESCE($2, workspace_permissions),
               updated_at            = NOW()
           WHERE id = $3 AND parent_customer_id = $4
           RETURNING id`,
          [role || null, permissions ? JSON.stringify(permissions) : null, memberId, parentId]
        );
        if (!legacyUpdate.rows.length) return res.status(404).json({ error: 'Member not found' });
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── DELETE /api/workspaces/members/:memberId ─────────────────────────────────
  // Revoke member access — disconnects without deleting their account.
  router.delete('/members/:memberId', authenticate, async (req, res) => {
    try {
      const parentId = mainCustomerId(req);
      const memberId = parseInt(req.params.memberId);

      // Try soft-revoke on workspace_members first (invited members — Type B)
      const wmRevoke = await pool.query(
        `UPDATE workspace_members
         SET revoked_at = NOW(), revoked_by = $1, updated_at = NOW()
         WHERE member_id = $2 AND owner_id = $3 AND revoked_at IS NULL
         RETURNING id`,
        [parentId, memberId, parentId]
      );

      if (!wmRevoke.rows.length) {
        // Fall back to old-style: clear parent_customer_id (Type A workspace profiles)
        const legacyClear = await pool.query(
          `UPDATE customers
           SET parent_customer_id    = NULL,
               workspace_role        = NULL,
               workspace_permissions = NULL,
               updated_at            = NOW()
           WHERE id = $1 AND parent_customer_id = $2
           RETURNING id`,
          [memberId, parentId]
        );
        if (!legacyClear.rows.length) return res.status(404).json({ error: 'Member not found' });
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/workspaces/invite ─────────────────────────────────────────────
  // Create a workspace invitation with role/permissions pre-selected.
  router.post('/invite', authenticate, async (req, res) => {
    try {
      const parentId = mainCustomerId(req);
      const { email, role = 'editor', permissions = null, workspaceId = null } = req.body;

      if (!email || !email.trim()) return res.status(400).json({ error: 'Email is required' });
      const normalizedEmail = email.trim().toLowerCase();
      if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Role must be manager, editor, or viewer' });

      let targetWorkspaceId = null;
      if (workspaceId) {
        const wsCheck = await pool.query(
          `SELECT id FROM customers WHERE id = $1 AND parent_customer_id = $2`,
          [workspaceId, parentId]
        );
        if (!wsCheck.rows.length) return res.status(403).json({ error: 'Invalid workspace' });
        targetWorkspaceId = workspaceId;
      }

      // Reject if already an active member (check both old-style and new workspace_members)
      const [oldMemberCheck, newMemberCheck] = await Promise.all([
        pool.query(
          `SELECT id FROM customers WHERE email = $1 AND parent_customer_id = $2 AND status != 'inactive'`,
          [normalizedEmail, parentId]
        ),
        pool.query(
          `SELECT wm.id FROM workspace_members wm
           JOIN customers c ON c.id = wm.member_id
           WHERE c.email = $1 AND wm.owner_id = $2 AND wm.revoked_at IS NULL`,
          [normalizedEmail, parentId]
        ),
      ]);
      if (oldMemberCheck.rows.length || newMemberCheck.rows.length) {
        return res.status(409).json({ error: 'This person is already a team member.' });
      }

      // Cancel any previous pending invite for the same email
      await pool.query(
        `UPDATE workspace_invitations SET status = 'cancelled' WHERE inviter_id = $1 AND email = $2 AND status = 'pending'`,
        [parentId, normalizedEmail]
      );

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const insert = await pool.query(
        `INSERT INTO workspace_invitations (inviter_id, email, token_hash, role, permissions, expires_at, workspace_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [parentId, normalizedEmail, tokenHash, role, permissions ? JSON.stringify(permissions) : null, expiresAt, targetWorkspaceId]
      );

      const inviterRow = await pool.query('SELECT business_name FROM customers WHERE id = $1', [parentId]);
      const inviterName = inviterRow.rows[0]?.business_name || 'Someone';
      const acceptUrl = `${process.env.FRONTEND_URL}/accept-invite?token=${rawToken}`;

      emailQueue.notifyWorkspaceInvite({
        toEmail: normalizedEmail,
        inviterBusinessName: inviterName,
        roleLabel: role.charAt(0).toUpperCase() + role.slice(1),
        acceptUrl,
      });

      res.json({ success: true, inviteId: insert.rows[0].id });
    } catch (err) {
      console.error('[Workspaces] Invite error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/workspaces/invitations ──────────────────────────────────────────
  // List all pending (non-expired) invitations for this account.
  router.get('/invitations', authenticate, async (req, res) => {
    try {
      const parentId = mainCustomerId(req);
      const rows = await pool.query(
        `SELECT id, email, role, permissions, status, expires_at, created_at
         FROM workspace_invitations
         WHERE inviter_id = $1 AND status = 'pending' AND expires_at > NOW()
         ORDER BY created_at DESC`,
        [parentId]
      );
      res.json({ invitations: rows.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── DELETE /api/workspaces/invitations/:id ────────────────────────────────────
  // Cancel a pending invitation.
  router.delete('/invitations/:id', authenticate, async (req, res) => {
    try {
      const parentId = mainCustomerId(req);
      const inviteId = parseInt(req.params.id);
      const result = await pool.query(
        `UPDATE workspace_invitations SET status = 'cancelled'
         WHERE id = $1 AND inviter_id = $2 AND status = 'pending'
         RETURNING id`,
        [inviteId, parentId]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Invite not found or already cancelled' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/workspaces/main/switch ─────────────────────────────────────────
  // Switch back to the main account from any workspace context.
  // Type A (auto-created sub-account): main account is parentCustomerId.
  // Type B (invited member): main account is their own customerId (just strip workspace context).
  router.post('/main/switch', authenticate, async (req, res) => {
    try {
      if (!req.parentCustomerId && !req.ownerId) {
        return res.status(400).json({ error: 'Already on the main account' });
      }

      let mainId;
      if (req.parentCustomerId) {
        // Type A: the main account IS the parent
        mainId = req.parentCustomerId;
      } else {
        // Type B: the main account IS the member's own account (strip workspace context)
        mainId = req.customerId;
      }

      const result = await pool.query(
        `SELECT id, email FROM customers WHERE id = $1`,
        [mainId]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Main account not found' });
      const main = result.rows[0];
      // Issue a clean JWT with no workspace context
      const token = generateToken(main.id, main.email);
      res.json({ token });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/workspaces/my-memberships ──────────────────────────────────────
  // Returns all workspaces this user has been invited to (as a member, not as an owner).
  router.get('/my-memberships', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT wm.id AS membership_id, wm.workspace_id, wm.owner_id,
                wm.role, wm.permissions, wm.joined_at,
                c.business_name, c.workspace_display_name, c.industry, c.location,
                o.business_name AS owner_business_name
         FROM workspace_members wm
         JOIN customers c ON c.id = wm.workspace_id
         JOIN customers o ON o.id = wm.owner_id
         WHERE wm.member_id = $1 AND wm.revoked_at IS NULL
         ORDER BY wm.joined_at ASC`,
        [req.customerId]
      );
      res.json({ memberships: result.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/workspaces/:id/switch ─────────────────────────────────────────
  // Switch into a workspace — supports both Type A (auto-created) and Type B (invited member) access.
  router.post('/:id/switch', authenticate, async (req, res) => {
    try {
      const callerId  = req.customerId;
      const parentId  = mainCustomerId(req);
      const wsId      = parseInt(req.params.id);

      // Type A: auto-created workspace profile owned by the caller's main account
      let wsResult = await pool.query(
        `SELECT id, email, business_name, status, suspended
         FROM customers
         WHERE id = $1 AND parent_customer_id = $2`,
        [wsId, parentId]
      );

      if (wsResult.rows.length) {
        const ws = wsResult.rows[0];
        if (ws.suspended) return res.status(403).json({ error: 'This workspace is inactive' });
        // Old-style JWT — parentCustomerId is the billing account
        const token = generateToken(ws.id, ws.email, { parentCustomerId: parentId });
        return res.json({ token, workspaceName: ws.business_name });
      }

      // Type B: caller is an invited member of workspace wsId
      const memberResult = await pool.query(
        `SELECT wm.owner_id, c.id, c.email, c.business_name, c.status, c.suspended
         FROM workspace_members wm
         JOIN customers c ON c.id = wm.workspace_id
         WHERE wm.member_id = $1 AND wm.workspace_id = $2 AND wm.revoked_at IS NULL`,
        [callerId, wsId]
      );

      if (!memberResult.rows.length) return res.status(404).json({ error: 'Workspace not found' });
      const ws = memberResult.rows[0];
      if (ws.suspended) return res.status(403).json({ error: 'This workspace is inactive' });

      // New-style JWT — ownerId carries the billing account, workspaceId tracks which workspace
      const token = generateToken(callerId, req.email, {
        workspaceId: wsId,
        ownerId:     ws.owner_id,
      });
      return res.json({ token, workspaceName: ws.business_name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
