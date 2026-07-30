const bcrypt = require('bcryptjs');
const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const { ACTIVE_STATUSES, STATUSES } = require('../utils/orderState');
const { publicUser, USER_SELECT, SALT_ROUNDS } = require('./auth.service');

// ---------------------------------------------------------------------
// Dashboard counters
// ---------------------------------------------------------------------
/**
 * One round trip to the database instead of eight. Each subquery is a
 * plain aggregate; PostgreSQL does the counting, not JavaScript.
 */
async function getStats() {
  const { rows } = await db.query(
    `SELECT
       (SELECT count(*)::int FROM orders)                                        AS total_orders,
       (SELECT count(*)::int FROM orders WHERE status = ANY($1))                 AS active_orders,
       (SELECT count(*)::int FROM orders WHERE status = 'DELIVERED')             AS delivered_orders,
       (SELECT count(*)::int FROM orders WHERE status = 'CANCELLED')             AS cancelled_orders,
       (SELECT count(*)::int FROM orders
          WHERE status = 'WAITING_AT_MAIN_GATE')                                 AS waiting_at_gate,
       (SELECT count(*)::int FROM orders
          WHERE status = 'DELIVERED' AND delivered_at >= current_date)           AS delivered_today,
       (SELECT count(*)::int FROM orders WHERE created_at >= current_date)        AS created_today,
       (SELECT count(*)::int FROM users WHERE role = 'student')                   AS students,
       (SELECT count(*)::int FROM users WHERE role = 'partner')                   AS partners,
       (SELECT count(*)::int FROM users WHERE role = 'partner' AND is_active)     AS active_partners`,
    [ACTIVE_STATUSES]
  );

  const { rows: byStatusRows } = await db.query(
    `SELECT status, count(*)::int AS count FROM orders GROUP BY status`
  );

  // Fill in the statuses with no rows so the UI never has to guess.
  const byStatus = {};
  for (const s of STATUSES) byStatus[s] = 0;
  for (const r of byStatusRows) byStatus[r.status] = r.count;

  const r = rows[0];
  return {
    orders: {
      total: r.total_orders,
      active: r.active_orders,
      delivered: r.delivered_orders,
      cancelled: r.cancelled_orders,
      waitingAtGate: r.waiting_at_gate,
      deliveredToday: r.delivered_today,
      createdToday: r.created_today,
    },
    users: {
      students: r.students,
      partners: r.partners,
      activePartners: r.active_partners,
    },
    byStatus,
  };
}

/** Live board of everything currently in motion. */
async function listActiveDeliveries() {
  const { rows } = await db.query(
    `SELECT o.id, o.order_code, o.status, o.vendor, o.expected_arrival, o.updated_at,
            s.name AS student_name,
            g.name AS gate_name,
            h.name AS hostel_name, b.name AS block_name,
            p.name AS partner_name, p.phone AS partner_phone
       FROM orders o
       JOIN users s   ON s.id = o.student_id
       JOIN gates g   ON g.id = o.gate_id
       JOIN blocks b  ON b.id = o.block_id
       JOIN hostels h ON h.id = b.hostel_id
       LEFT JOIN delivery_assignments da ON da.order_id = o.id AND da.is_active
       LEFT JOIN users p ON p.id = da.partner_id
      WHERE o.status = ANY($1)
      ORDER BY o.updated_at DESC`,
    [ACTIVE_STATUSES]
  );

  return rows.map((r) => ({
    id: r.id,
    orderCode: r.order_code,
    status: r.status,
    vendor: r.vendor,
    expectedArrival: r.expected_arrival,
    updatedAt: r.updated_at,
    studentName: r.student_name,
    gateName: r.gate_name,
    destination: `${r.hostel_name} - Block ${r.block_name}`,
    partner: r.partner_name ? { name: r.partner_name, phone: r.partner_phone } : null,
  }));
}

// ---------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------
async function listUsers({ role, q, page = 1, limit = 20 }) {
  const where = [];
  const params = [];

  if (role) {
    params.push(role);
    where.push(`u.role = $${params.length}`);
  }
  if (q) {
    params.push(`%${q.trim()}%`);
    where.push(`(u.name ILIKE $${params.length} OR u.phone ILIKE $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const { rows: countRows } = await db.query(
    `SELECT count(*)::int AS total FROM users u ${whereSql}`,
    params
  );

  const { rows } = await db.query(
    `${USER_SELECT} ${whereSql} ORDER BY u.role, u.name
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, safeLimit, offset]
  );

  const total = countRows[0].total;
  return {
    users: rows.map(publicUser),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.max(Math.ceil(total / safeLimit), 1),
    },
  };
}

/** Partners never self-register, so this is how they get into the system. */
async function createPartner({ name, phone, password, campusId }) {
  const existing = await db.query('SELECT id FROM users WHERE phone = $1', [phone]);
  if (existing.rowCount > 0) {
    throw ApiError.conflict('A user with this phone number already exists.');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const { rows } = await db.query(
    `INSERT INTO users (name, phone, password_hash, role, campus_id)
     VALUES ($1, $2, $3, 'partner', $4)
     RETURNING id`,
    [name, phone, passwordHash, campusId]
  );

  const { rows: full } = await db.query(`${USER_SELECT} WHERE u.id = $1`, [rows[0].id]);
  return publicUser(full[0]);
}

async function setUserActive(userId, isActive, admin) {
  if (userId === admin.id) {
    throw ApiError.badRequest('You cannot deactivate your own admin account.');
  }

  const { rows } = await db.query(
    `UPDATE users SET is_active = $2 WHERE id = $1 RETURNING id, role`,
    [userId, isActive]
  );
  if (rows.length === 0) throw ApiError.notFound('That user does not exist.');

  const { rows: full } = await db.query(`${USER_SELECT} WHERE u.id = $1`, [userId]);
  return publicUser(full[0]);
}

/** Partners a given order can be handed to, with their current workload. */
async function listPartnersWithLoad(campusId) {
  const { rows } = await db.query(
    `SELECT u.id, u.name, u.phone, u.is_active,
            count(da.id) FILTER (
              WHERE da.is_active AND o.status <> ALL($2)
            )::int AS active_deliveries,
            count(da.id) FILTER (WHERE o.status = 'DELIVERED')::int AS completed_deliveries
       FROM users u
       LEFT JOIN delivery_assignments da ON da.partner_id = u.id
       LEFT JOIN orders o ON o.id = da.order_id
      WHERE u.role = 'partner'
        AND ($1::int IS NULL OR u.campus_id = $1)
      GROUP BY u.id
      ORDER BY u.is_active DESC, active_deliveries ASC, u.name`,
    [campusId || null, ['DELIVERED', 'CANCELLED']]
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    isActive: r.is_active,
    activeDeliveries: r.active_deliveries,
    completedDeliveries: r.completed_deliveries,
  }));
}

// ---------------------------------------------------------------------
// Campus configuration
// ---------------------------------------------------------------------
async function createCampus({ name, city }) {
  const { rows } = await db.query(
    `INSERT INTO campuses (name, city) VALUES ($1, $2) RETURNING id, name, city, is_active`,
    [name, city]
  );
  return rows[0];
}

async function createGate({ campusId, name }) {
  const { rows } = await db.query(
    `INSERT INTO gates (campus_id, name) VALUES ($1, $2) RETURNING id, campus_id, name, is_active`,
    [campusId, name]
  );
  return rows[0];
}

async function createHostel({ campusId, name, gender }) {
  const { rows } = await db.query(
    `INSERT INTO hostels (campus_id, name, gender)
     VALUES ($1, $2, $3) RETURNING id, campus_id, name, gender, is_active`,
    [campusId, name, gender]
  );
  return rows[0];
}

async function createBlock({ hostelId, name }) {
  const { rows } = await db.query(
    `INSERT INTO blocks (hostel_id, name) VALUES ($1, $2)
     RETURNING id, hostel_id, name, is_active`,
    [hostelId, name]
  );
  return rows[0];
}

/**
 * Config rows are deactivated, never deleted, because orders reference
 * them. Hiding a block keeps old orders readable while stopping new ones.
 */
async function setConfigActive(table, id, isActive) {
  const allowed = { gates: 'gates', hostels: 'hostels', blocks: 'blocks', campuses: 'campuses' };
  const tableName = allowed[table];
  if (!tableName) throw ApiError.badRequest('Unknown configuration type.');

  const { rows } = await db.query(
    `UPDATE ${tableName} SET is_active = $2 WHERE id = $1 RETURNING id, name, is_active`,
    [id, isActive]
  );
  if (rows.length === 0) throw ApiError.notFound('That record does not exist.');
  return rows[0];
}

module.exports = {
  getStats,
  listActiveDeliveries,
  listUsers,
  createPartner,
  setUserActive,
  listPartnersWithLoad,
  createCampus,
  createGate,
  createHostel,
  createBlock,
  setConfigActive,
};
