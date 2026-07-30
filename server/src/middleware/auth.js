const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Reads the "Authorization: Bearer <token>" header, verifies the JWT
 * signature, then re-loads the user from the database.
 *
 * Why hit the database instead of trusting the token payload? Because a
 * token stays valid for 7 days. If an admin deactivates an account or
 * changes someone's role, we want that to take effect immediately.
 */
const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing login token.');
  }

  const token = header.slice(7).trim();
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    throw ApiError.unauthorized(
      err.name === 'TokenExpiredError'
        ? 'Your session expired. Please log in again.'
        : 'Your login token is not valid.'
    );
  }

  const { rows } = await db.query(
    `SELECT id, name, phone, role, campus_id, default_block_id, room_number, is_active
       FROM users WHERE id = $1`,
    [payload.sub]
  );

  const user = rows[0];
  if (!user) throw ApiError.unauthorized('This account no longer exists.');
  if (!user.is_active) throw ApiError.forbidden('This account has been deactivated.');

  req.user = user;
  next();
});

/**
 * Role gate. Use AFTER requireAuth:
 *   router.get('/stats', requireAuth, requireRole('admin'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(`This action is only available to: ${roles.join(', ')}.`)
      );
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
