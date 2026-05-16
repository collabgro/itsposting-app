const crypto = require('crypto');

const ALLOWED_SCOPES = [
  'posts:read',
  'posts:write',
  'generate:write',
  'analytics:read',
  'media:write',
  'contacts:read',
  'contacts:write',
  'knowledge:write',
];

// Write scopes imply their read counterpart
const SCOPE_IMPLIES = {
  'posts:write': ['posts:read'],
  'contacts:write': ['contacts:read'],
};

function expandScopes(scopes) {
  const expanded = new Set(scopes);
  for (const [write, reads] of Object.entries(SCOPE_IMPLIES)) {
    if (expanded.has(write)) reads.forEach(r => expanded.add(r));
  }
  return [...expanded];
}

function authenticateApiKey(pool) {
  return async function (req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer itspost_')) {
      return res.status(401).json({ error: 'Valid API key required (Authorization: Bearer itspost_...)' });
    }

    const rawKey = authHeader.slice(7); // strip "Bearer "
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    let row;
    try {
      const result = await pool.query(
        `SELECT ak.id, ak.customer_id, ak.scopes, ak.revoked_at, ak.expires_at,
                c.suspended, c.parent_customer_id
         FROM api_keys ak
         JOIN customers c ON c.id = ak.customer_id
         WHERE ak.key_hash = $1`,
        [keyHash]
      );
      row = result.rows[0];
    } catch (err) {
      console.error('[apiKey] DB error:', err.message);
      return res.status(500).json({ error: 'Authentication error' });
    }

    if (!row) return res.status(401).json({ error: 'Invalid API key' });
    if (row.revoked_at) return res.status(401).json({ error: 'API key has been revoked' });
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return res.status(401).json({ error: 'API key has expired' });
    }
    if (row.suspended) return res.status(403).json({ error: 'Account suspended' });

    // Update last_used_at non-blocking
    pool.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [row.id]).catch(() => {});

    req.customerId = row.customer_id;
    req.parentCustomerId = row.parent_customer_id || null;
    req.apiKeyId = row.id;
    req.apiKeyScopes = expandScopes(row.scopes || []);
    req.isApiKeyAuth = true;
    next();
  };
}

function requireScope(scope) {
  return function (req, res, next) {
    if (!req.apiKeyScopes || !req.apiKeyScopes.includes(scope)) {
      return res.status(403).json({ error: `This API key does not have the '${scope}' permission` });
    }
    next();
  };
}

module.exports = { authenticateApiKey, requireScope, ALLOWED_SCOPES };
