const jwt = require('jsonwebtoken');

/**
 * authenticateToken — Verifies JWT access token from Authorization header.
 * Sets req.user = { userId, rollNo, isAdmin }
 * Rejects with 401 if missing, invalid, or expired.
 */
function authenticateToken(req, res, next) {
  let token = null;
  let secret = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
    secret = process.env.JWT_ACCESS_SECRET;
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
    secret = process.env.JWT_ACCESS_SECRET;
  } else if (req.cookies && req.cookies.refreshToken) {
    token = req.cookies.refreshToken;
    secret = process.env.JWT_REFRESH_SECRET;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
  }

  if (!secret) {
    console.error('FATAL: JWT secret is not set in environment variables');
    return res.status(500).json({ success: false, message: 'Server configuration error' });
  }

  try {
    const decoded = jwt.verify(token, secret);
    req.user = {
      userId: decoded.userId,
      rollNo: decoded.rollNo,
      isAdmin: decoded.isAdmin === true
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Unauthorized: Token expired' });
    }
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token' });
  }
}

/**
 * requireAdmin — Must be used AFTER authenticateToken.
 * Checks that the authenticated user has admin privileges.
 * Rejects with 403 if not admin.
 */
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
  }
  next();
}

module.exports = { authenticateToken, requireAdmin };
