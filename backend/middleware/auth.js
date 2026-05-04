const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token;
  
  let token;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (queryToken) {
    token = queryToken;
  } else {
    return res.status(401).json({ error: 'No authorization token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.customerId = decoded.customerId;
    req.email = decoded.email;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function generateToken(customerId, email) {
  return jwt.sign({ customerId, email }, JWT_SECRET, { expiresIn: '30d' });
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

module.exports = { authenticate, generateToken, verifyAdmin };
