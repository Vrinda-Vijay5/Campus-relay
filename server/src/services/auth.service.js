const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const SALT_ROUNDS = 10;

// Never send password_hash to the client. Every response goes through this.
function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    role: row.role,
    campusId: row.campus_id,
    campusName: row.campus_name || null,
    defaultBlockId: row.default_block_id,
    blockLabel: row.block_label || null,
    roomNumber: row.room_number,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function signToken(user) {
  // Only the id and role go in the token. Everything else is looked up
  // fresh from the database on each request (see middleware/auth.js).
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

const USER_SELECT = `
  SELECT u.id, u.name, u.phone, u.password_hash, u.role, u.campus_id,
         u.default_block_id, u.room_number, u.is_active, u.created_at,
         c.name AS campus_name,
         CASE WHEN b.id IS NULL THEN NULL
              ELSE h.name || ' - Block ' || b.name END AS block_label
    FROM users u
    LEFT JOIN campuses c ON c.id = u.campus_id
    LEFT JOIN blocks b   ON b.id = u.default_block_id
    LEFT JOIN hostels h  ON h.id = b.hostel_id
`;

/** Student self-registration. Partners and admins are created by an admin. */
async function register({ name, phone, password, campusId, defaultBlockId, roomNumber }) {
  const existing = await db.query('SELECT id FROM users WHERE phone = $1', [phone]);
  if (existing.rowCount > 0) {
    throw ApiError.conflict('An account with this phone number already exists.');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const { rows } = await db.query(
    `INSERT INTO users (name, phone, password_hash, role, campus_id, default_block_id, room_number)
     VALUES ($1, $2, $3, 'student', $4, $5, $6)
     RETURNING id`,
    [name, phone, passwordHash, campusId, defaultBlockId || null, roomNumber || null]
  );

  const user = await findById(rows[0].id);
  return { user, token: signToken(user) };
}

async function login({ phone, password }) {
  const { rows } = await db.query(`${USER_SELECT} WHERE u.phone = $1`, [phone]);
  const row = rows[0];

  // Same message whether the phone is unknown or the password is wrong,
  // so an attacker cannot use this endpoint to discover valid phone numbers.
  const invalid = ApiError.unauthorized('Incorrect phone number or password.');
  if (!row) throw invalid;

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) throw invalid;

  if (!row.is_active) throw ApiError.forbidden('This account has been deactivated.');

  const user = publicUser(row);
  return { user, token: signToken(user) };
}

async function findById(id) {
  const { rows } = await db.query(`${USER_SELECT} WHERE u.id = $1`, [id]);
  return publicUser(rows[0]);
}

async function updateProfile(id, { name, defaultBlockId, roomNumber }) {
  const { rows } = await db.query(
    `UPDATE users
        SET name             = COALESCE($2, name),
            default_block_id = $3,
            room_number      = $4
      WHERE id = $1
      RETURNING id`,
    [id, name || null, defaultBlockId || null, roomNumber || null]
  );
  if (rows.length === 0) throw ApiError.notFound('Account not found.');
  return findById(id);
}

async function changePassword(id, { currentPassword, newPassword }) {
  const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [id]);
  if (rows.length === 0) throw ApiError.notFound('Account not found.');

  const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!ok) throw ApiError.badRequest('Your current password is not correct.');

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
  return { changed: true };
}

module.exports = {
  register,
  login,
  findById,
  updateProfile,
  changePassword,
  publicUser,
  signToken,
  SALT_ROUNDS,
  USER_SELECT,
};
