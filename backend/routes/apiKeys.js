const crypto = require('crypto');
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { ALLOWED_SCOPES } = require('../middleware/apiKey');

const MAX_KEYS_BY_PLAN = { trial: 0, starter: 5, professional: 5, premium: 5 };
const EXPIRY_OPTIONS = { '30d': 30, '90d': 90, '1y': 365, never: null };

module.exports = (pool) => {
  const router = express.Router();

  // GET /api/api-keys — list customer's active keys (no hashes)
  router.get('/', authenticate, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, name, key_prefix, scopes, expires_at, last_used_at, created_at
         FROM api_keys
         WHERE customer_id = $1 AND revoked_at IS NULL
         ORDER BY created_at DESC`,
        [req.customerId]
      );
      res.json({ keys: rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/api-keys — create a new key
  router.post('/', authenticate, async (req, res) => {
    try {
      const { name, scopes, expiry } = req.body;

      if (!name?.trim()) return res.status(400).json({ error: 'Key name is required' });
      if (!Array.isArray(scopes) || scopes.length === 0) {
        return res.status(400).json({ error: 'At least one scope is required' });
      }
      const invalid = scopes.filter(s => !ALLOWED_SCOPES.includes(s));
      if (invalid.length) return res.status(400).json({ error: `Invalid scopes: ${invalid.join(', ')}` });
      if (expiry && !Object.keys(EXPIRY_OPTIONS).includes(expiry)) {
        return res.status(400).json({ error: 'expiry must be 30d, 90d, 1y, or never' });
      }

      // Enforce plan key limit
      const planRow = await pool.query('SELECT plan FROM customers WHERE id = $1', [req.customerId]);
      const plan = planRow.rows[0]?.plan || 'trial';
      const maxKeys = MAX_KEYS_BY_PLAN[plan] ?? 0;
      if (maxKeys === 0) {
        return res.status(403).json({ error: 'API keys require a paid plan. Please upgrade to create API keys.' });
      }

      const { rows: existing } = await pool.query(
        'SELECT COUNT(*) FROM api_keys WHERE customer_id = $1 AND revoked_at IS NULL',
        [req.customerId]
      );
      if (parseInt(existing[0].count, 10) >= maxKeys) {
        return res.status(403).json({ error: `Your plan allows up to ${maxKeys} API key${maxKeys !== 1 ? 's' : ''}. Revoke one to create another.` });
      }

      // Generate key — show raw once, store only the SHA-256 hash
      const rawKey = `itspost_${crypto.randomBytes(20).toString('hex')}`;
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
      const keyPrefix = rawKey.slice(0, 18); // "itspost_" + first 10 hex chars

      const days = EXPIRY_OPTIONS[expiry ?? 'never'];
      const expiresAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;

      const { rows } = await pool.query(
        `INSERT INTO api_keys (customer_id, name, key_prefix, key_hash, scopes, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, key_prefix, scopes, expires_at, created_at`,
        [req.customerId, name.trim(), keyPrefix, keyHash, scopes, expiresAt]
      );

      // Return raw key ONLY in this response
      res.status(201).json({ key: rows[0], rawKey });
    } catch (err) {
      console.error('[apiKeys] create:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/api-keys/:id — revoke a key (soft delete)
  router.delete('/:id', authenticate, async (req, res) => {
    try {
      const { rowCount } = await pool.query(
        `UPDATE api_keys SET revoked_at = NOW()
         WHERE id = $1 AND customer_id = $2 AND revoked_at IS NULL`,
        [req.params.id, req.customerId]
      );
      if (rowCount === 0) return res.status(404).json({ error: 'API key not found' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
