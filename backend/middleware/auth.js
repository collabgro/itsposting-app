const jwt = require('jsonwebtoken');

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required in production');
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Injected at server startup via setPool() — enables password-change revocation checks
let _pool = null;
function setPool(pool) { _pool = pool; }

// Short-lived cache for password_changed_at — avoids a DB hit on every API request.
// TTL: 5 minutes. Invalidated immediately on password reset via invalidatePwCache().
const _pwCache = new Map(); // customerId -> { changedAtSec: number, expiresAt: number }
const PW_CACHE_TTL_MS = 5 * 60 * 1000;

function invalidatePwCache(customerId) {
  _pwCache.delete(customerId);
}

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  let token;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else {
    return res.status(401).json({ error: 'No authorization token provided' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Invalidate tokens issued before a password reset.
  // Uses a 5-min cache so we don't query the DB on every single API call.
  if (_pool && decoded.customerId) {
    try {
      const now = Date.now();
      let cached = _pwCache.get(decoded.customerId);
      if (!cached || cached.expiresAt < now) {
        const { rows } = await _pool.query(
          'SELECT password_changed_at FROM customers WHERE id = $1',
          [decoded.customerId]
        );
        const changedAt = rows[0]?.password_changed_at;
        const changedAtSec = changedAt ? Math.floor(new Date(changedAt).getTime() / 1000) : 0;
        cached = { changedAtSec, expiresAt: now + PW_CACHE_TTL_MS };
        _pwCache.set(decoded.customerId, cached);
      }
      if (cached.changedAtSec && decoded.iat < cached.changedAtSec) {
        _pwCache.delete(decoded.customerId);
        return res.status(401).json({ error: 'Session expired — please log in again' });
      }
    } catch { /* DB unavailable — allow through, don't block all traffic */ }
  }

  req.customerId = decoded.customerId;
  req.email = decoded.email;
  req.parentCustomerId = decoded.parentCustomerId || null;
  next();
}

function generateToken(customerId, email, extra = {}) {
  return jwt.sign({ customerId, email, ...extra }, JWT_SECRET, { expiresIn: '30d' });
}

// Returns the customer ID to use for billing/credit operations.
// When operating inside a workspace, credits come from the parent account.
function getBillingCustomerId(req) {
  return req.parentCustomerId || req.customerId;
}

async function verifyAdmin(pool, customerId) {
  const result = await pool.query(
    'SELECT id, email, is_admin, role, suspended FROM customers WHERE id = $1',
    [customerId]
  );
  if (result.rows.length === 0) throw new Error('User not found');
  const user = result.rows[0];
  if (user.suspended) throw new Error('Account suspended');
  if (!user.is_admin) throw new Error('Admin access required');
  return user;
}

// Factory: pass your pg pool instance, returns an Express middleware.
// Apply to generation/posting routes — not to read or profile routes.
function requireActiveAccount(pool) {
  return async function (req, res, next) {
    try {
      const r = await pool.query(
        `SELECT suspended, status FROM customers WHERE id = $1`,
        [req.customerId]
      );
      const c = r.rows[0];
      if (!c) return res.status(401).json({ error: 'Account not found' });
      if (c.suspended) return res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
      if (c.status === 'suspended') return res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { authenticate, setPool, generateToken, getBillingCustomerId, verifyAdmin, requireActiveAccount, invalidatePwCache };
