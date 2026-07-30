const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const {
  assertTransition,
  nextStatuses,
  DEFAULT_NOTES,
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
} = require('../utils/orderState');

// A partner may carry at most this many parcels at once. Without a cap,
// one partner could accept every order in the pool and starve the others.
const MAX_ACTIVE_PER_PARTNER = 3;

// One SQL shape reused by every read, so a field added here appears
// everywhere at once. LEFT JOIN on delivery_assignments because an order
// has no partner until somebody accepts it.
const ORDER_SELECT = `
  SELECT o.id,
         o.order_code,
         o.status,
         o.vendor,
         o.item_description,
         o.contact_phone,
         o.room_number,
         o.notes,
         o.cancel_reason,
         o.expected_arrival,
         o.created_at,
         o.updated_at,
         o.delivered_at,
         o.student_id,
         s.name  AS student_name,
         s.phone AS student_phone,
         o.campus_id,
         c.name  AS campus_name,
         o.gate_id,
         g.name  AS gate_name,
         o.block_id,
         b.name  AS block_name,
         h.name  AS hostel_name,
         h.gender AS hostel_gender,
         da.partner_id,
         da.assigned_at,
         p.name  AS partner_name,
         p.phone AS partner_phone
    FROM orders o
    JOIN users     s ON s.id = o.student_id
    JOIN campuses  c ON c.id = o.campus_id
    JOIN gates     g ON g.id = o.gate_id
    JOIN blocks    b ON b.id = o.block_id
    JOIN hostels   h ON h.id = b.hostel_id
    -- The current assignment if there is one, otherwise the most recent
    -- past one, so a delivered order still shows who carried it.
    LEFT JOIN LATERAL (
      SELECT a.partner_id, a.assigned_at, a.is_active
        FROM delivery_assignments a
       WHERE a.order_id = o.id
       ORDER BY a.is_active DESC, a.assigned_at DESC
       LIMIT 1
    ) da ON TRUE
    LEFT JOIN users p ON p.id = da.partner_id
`;

/** Shapes a database row into the JSON the frontend expects. */
function mapOrder(row, { includeContact = true } = {}) {
  if (!row) return null;
  const order = {
    id: row.id,
    orderCode: row.order_code,
    status: row.status,
    vendor: row.vendor,
    itemDescription: row.item_description,
    notes: row.notes,
    cancelReason: row.cancel_reason,
    expectedArrival: row.expected_arrival,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deliveredAt: row.delivered_at,
    roomNumber: row.room_number,
    campus: { id: row.campus_id, name: row.campus_name },
    gate: { id: row.gate_id, name: row.gate_name },
    destination: {
      blockId: row.block_id,
      blockName: row.block_name,
      hostelName: row.hostel_name,
      gender: row.hostel_gender,
      label: `${row.hostel_name} - Block ${row.block_name}`,
    },
    student: { id: row.student_id, name: row.student_name },
    partner: row.partner_id
      ? { id: row.partner_id, name: row.partner_name, assignedAt: row.assigned_at }
      : null,
    nextStatuses: nextStatuses(row.status),
  };

  // Phone numbers are personal data, so they are only attached for people
  // who genuinely need them (see resolveVisibility below).
  if (includeContact) {
    order.contactPhone = row.contact_phone;
    order.student.phone = row.student_phone;
    if (order.partner) order.partner.phone = row.partner_phone;
  }
  return order;
}

async function insertTrackingEvent(client, { orderId, status, note, actorId }) {
  await client.query(
    `INSERT INTO tracking_events (order_id, status, note, actor_id)
     VALUES ($1, $2, $3, $4)`,
    [orderId, status, note || DEFAULT_NOTES[status] || null, actorId || null]
  );
}

// ---------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------
async function createOrder(student, payload) {
  const { gateId, blockId, roomNumber, vendor, itemDescription, contactPhone, expectedArrival, notes } =
    payload;

  // Validate that the gate and block really belong to this student's campus.
  // Skipping this would let a student post someone else's campus ids.
  const { rows: checkRows } = await db.query(
    `SELECT (SELECT campus_id FROM gates  WHERE id = $1) AS gate_campus,
            (SELECT h.campus_id FROM blocks b JOIN hostels h ON h.id = b.hostel_id
              WHERE b.id = $2) AS block_campus`,
    [gateId, blockId]
  );
  const { gate_campus: gateCampus, block_campus: blockCampus } = checkRows[0];

  if (gateCampus === null) throw ApiError.badRequest('That pickup gate does not exist.');
  if (blockCampus === null) throw ApiError.badRequest('That hostel block does not exist.');

  const campusId = student.campus_id || gateCampus;
  if (gateCampus !== campusId || blockCampus !== campusId) {
    throw ApiError.badRequest('The gate and hostel block must belong to your campus.');
  }

  return db.withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO orders (student_id, campus_id, gate_id, block_id, room_number, vendor,
                           item_description, contact_phone, expected_arrival, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        student.id,
        campusId,
        gateId,
        blockId,
        roomNumber || null,
        vendor,
        itemDescription,
        contactPhone,
        expectedArrival,
        notes || null,
      ]
    );

    const orderId = rows[0].id;
    await insertTrackingEvent(client, {
      orderId,
      status: 'CREATED',
      note: DEFAULT_NOTES.CREATED,
      actorId: student.id,
    });

    const { rows: full } = await client.query(`${ORDER_SELECT} WHERE o.id = $1`, [orderId]);
    return mapOrder(full[0]);
  });
}

// ---------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------

/**
 * Decides what a given user is allowed to see for a given order row.
 * Returns null when they should not see it at all.
 */
function resolveVisibility(row, user) {
  if (!row) return null;
  if (user.role === 'admin') return { includeContact: true };
  if (user.role === 'student') {
    return row.student_id === user.id ? { includeContact: true } : null;
  }
  if (user.role === 'partner') {
    // The assigned partner needs the student's phone to hand the parcel over.
    if (row.partner_id === user.id) return { includeContact: true };
    // An unassigned partner may preview a job in the pool, minus phone numbers.
    if (row.status === 'WAITING_AT_MAIN_GATE' && row.campus_id === user.campus_id) {
      return { includeContact: false };
    }
    return null;
  }
  return null;
}

/**
 * Role-aware list with filtering, searching and pagination.
 * Every value the client sends becomes a $n parameter - the SQL string
 * itself is only ever built from our own fixed fragments.
 */
async function listOrders(user, query) {
  const where = [];
  const params = [];
  const add = (fragment, value) => {
    params.push(value);
    where.push(fragment.replace('$?', `$${params.length}`));
  };

  // 1. Scope by role first. This is the ownership rule, not a filter the
  //    client can change.
  if (user.role === 'student') {
    add('o.student_id = $?', user.id);
  } else if (user.role === 'partner') {
    // EXISTS over every assignment, not just the active one - otherwise a
    // partner's finished deliveries would vanish from their own history.
    add(
      `EXISTS (SELECT 1 FROM delivery_assignments dx
                WHERE dx.order_id = o.id AND dx.partner_id = $?)`,
      user.id
    );
  }

  // 2. Optional filters from the query string.
  if (query.status) add('o.status = $?', query.status);
  if (query.vendor) add('o.vendor = $?', query.vendor);
  if (query.blockId) add('o.block_id = $?', Number(query.blockId));
  if (query.gender) add('h.gender = $?', query.gender);
  if (query.partnerId && user.role === 'admin') {
    add(
      `EXISTS (SELECT 1 FROM delivery_assignments dy
                WHERE dy.order_id = o.id AND dy.partner_id = $?)`,
      Number(query.partnerId)
    );
  }
  if (query.active === 'true') {
    params.push(ACTIVE_STATUSES);
    where.push(`o.status = ANY($${params.length})`);
  }
  if (query.q) {
    params.push(`%${query.q.trim()}%`);
    const p = `$${params.length}`;
    where.push(
      `(o.order_code ILIKE ${p} OR o.item_description ILIKE ${p} OR s.name ILIKE ${p})`
    );
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 50);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const offset = (page - 1) * limit;

  // Counted with the same WHERE clause but without the extra joins the
  // full select needs, so pagination totals always match the rows.
  const countSql = `
    SELECT count(*)::int AS total
      FROM orders o
      JOIN users s ON s.id = o.student_id
      JOIN blocks b ON b.id = o.block_id
      JOIN hostels h ON h.id = b.hostel_id
      ${whereSql}`;

  const { rows: countRows } = await db.query(countSql, params);
  const total = countRows[0].total;

  const { rows } = await db.query(
    `${ORDER_SELECT} ${whereSql} ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${
      params.length + 2
    }`,
    [...params, limit, offset]
  );

  return {
    orders: rows.map((r) => mapOrder(r, resolveVisibility(r, user) || { includeContact: false })),
    pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
  };
}

/** The pool a partner picks from: parcels waiting at a gate on their campus. */
async function listAvailable(partner) {
  const { rows } = await db.query(
    `${ORDER_SELECT}
      WHERE o.status = 'WAITING_AT_MAIN_GATE'
        AND o.campus_id = $1
        AND da.partner_id IS NULL
      ORDER BY o.expected_arrival ASC, o.created_at ASC
      LIMIT 50`,
    [partner.campus_id]
  );
  return rows.map((r) => mapOrder(r, { includeContact: false }));
}

async function getOrderById(id, user) {
  const { rows } = await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [id]);
  const row = rows[0];
  if (!row) throw ApiError.notFound('That order does not exist.');

  const visibility = resolveVisibility(row, user);
  // 404 rather than 403: we do not confirm that someone else's order exists.
  if (!visibility) throw ApiError.notFound('That order does not exist.');

  const order = mapOrder(row, visibility);
  order.tracking = await getTracking(id);
  return order;
}

/**
 * Public tracking by order code - no login needed, matching the original
 * "Track My Order" link. Returns status and progress only: no phone
 * numbers, no student name, no notes. Order codes carry a random suffix
 * so they cannot be guessed by counting upwards.
 */
async function getPublicByCode(code) {
  const { rows } = await db.query(`${ORDER_SELECT} WHERE o.order_code = $1`, [code.trim()]);
  const row = rows[0];
  if (!row) throw ApiError.notFound('No order found with that code. Check it and try again.');

  return {
    orderCode: row.order_code,
    status: row.status,
    vendor: row.vendor,
    expectedArrival: row.expected_arrival,
    createdAt: row.created_at,
    deliveredAt: row.delivered_at,
    gate: { name: row.gate_name },
    destination: { label: `${row.hostel_name} - Block ${row.block_name}` },
    partner: row.partner_id ? { name: row.partner_name } : null,
    tracking: await getTracking(row.id),
  };
}

async function getTracking(orderId) {
  const { rows } = await db.query(
    `SELECT te.status, te.note, te.created_at, u.name AS actor_name, u.role AS actor_role
       FROM tracking_events te
       LEFT JOIN users u ON u.id = te.actor_id
      WHERE te.order_id = $1
      ORDER BY te.created_at ASC, te.id ASC`,
    [orderId]
  );
  return rows.map((r) => ({
    status: r.status,
    note: r.note,
    at: r.created_at,
    by: r.actor_name ? { name: r.actor_name, role: r.actor_role } : null,
  }));
}

// ---------------------------------------------------------------------
// Write: status changes
// ---------------------------------------------------------------------

/** Loads an order inside a transaction and locks the row against concurrent writes. */
async function lockOrder(client, id) {
  const { rows } = await client.query(
    `SELECT o.id, o.status, o.student_id, o.campus_id,
            da.partner_id
       FROM orders o
       LEFT JOIN delivery_assignments da ON da.order_id = o.id AND da.is_active
      WHERE o.id = $1
      FOR UPDATE OF o`,
    [id]
  );
  if (rows.length === 0) throw ApiError.notFound('That order does not exist.');
  return rows[0];
}

/** Turns a state-machine rejection into the right HTTP error. */
function guardTransition(from, to, role) {
  try {
    assertTransition(from, to, role);
  } catch (e) {
    if (e && e.code) {
      const status = e.code === 'ROLE_NOT_ALLOWED' ? 403 : 409;
      throw new ApiError(status, e.message, e.allowed ? { allowed: e.allowed } : undefined);
    }
    throw e;
  }
}

/**
 * A partner claims a parcel from the pool.
 *
 * Two things stop two partners claiming the same order at the same moment:
 *   1. FOR UPDATE locks the order row for the duration of the transaction.
 *   2. The partial unique index one_active_assignment_per_order makes a
 *      second active assignment impossible even if the lock were bypassed.
 */
async function acceptOrder(orderId, partner) {
  return db.withTransaction(async (client) => {
    const order = await lockOrder(client, orderId);

    if (order.campus_id !== partner.campus_id) {
      throw ApiError.forbidden('That order is on a different campus.');
    }
    if (order.partner_id) {
      throw ApiError.conflict('Another relay partner just took this delivery.');
    }
    guardTransition(order.status, 'ASSIGNED', 'partner');

    const { rows: loadRows } = await client.query(
      `SELECT count(*)::int AS active
         FROM delivery_assignments da
         JOIN orders o ON o.id = da.order_id
        WHERE da.partner_id = $1 AND da.is_active
          AND o.status <> ALL($2)`,
      [partner.id, ['DELIVERED', 'CANCELLED']]
    );
    if (loadRows[0].active >= MAX_ACTIVE_PER_PARTNER) {
      throw ApiError.conflict(
        `You are already carrying ${MAX_ACTIVE_PER_PARTNER} deliveries. Finish one first.`
      );
    }

    await client.query(
      `INSERT INTO delivery_assignments (order_id, partner_id, assigned_by)
       VALUES ($1, $2, NULL)`,
      [orderId, partner.id]
    );
    await client.query(`UPDATE orders SET status = 'ASSIGNED' WHERE id = $1`, [orderId]);
    await insertTrackingEvent(client, {
      orderId,
      status: 'ASSIGNED',
      note: `Accepted by ${partner.name}`,
      actorId: partner.id,
    });

    const { rows } = await client.query(`${ORDER_SELECT} WHERE o.id = $1`, [orderId]);
    return mapOrder(rows[0]);
  });
}

/** Admin assigns, or re-assigns, a parcel to a specific partner. */
async function assignOrder(orderId, partnerId, admin) {
  return db.withTransaction(async (client) => {
    const order = await lockOrder(client, orderId);

    const { rows: partnerRows } = await client.query(
      `SELECT id, name, campus_id, is_active FROM users WHERE id = $1 AND role = 'partner'`,
      [partnerId]
    );
    const partner = partnerRows[0];
    if (!partner) throw ApiError.badRequest('That delivery partner does not exist.');
    if (!partner.is_active) throw ApiError.badRequest('That delivery partner is deactivated.');
    if (partner.campus_id !== order.campus_id) {
      throw ApiError.badRequest('That partner belongs to a different campus.');
    }
    if (['DELIVERED', 'CANCELLED'].includes(order.status)) {
      throw ApiError.conflict('This order is already finished.');
    }
    if (order.partner_id === partner.id) {
      throw ApiError.conflict(`${partner.name} is already carrying this order.`);
    }

    // Retire the previous assignment, keeping it as history.
    if (order.partner_id) {
      await client.query(
        `UPDATE delivery_assignments
            SET is_active = FALSE, released_at = now()
          WHERE order_id = $1 AND is_active`,
        [orderId]
      );
    }

    await client.query(
      `INSERT INTO delivery_assignments (order_id, partner_id, assigned_by)
       VALUES ($1, $2, $3)`,
      [orderId, partner.id, admin.id]
    );

    // Only a parcel still waiting at the gate changes status. Re-assigning
    // one that is already picked up must not rewind its progress.
    if (order.status === 'WAITING_AT_MAIN_GATE') {
      guardTransition(order.status, 'ASSIGNED', 'admin');
      await client.query(`UPDATE orders SET status = 'ASSIGNED' WHERE id = $1`, [orderId]);
    } else {
      await client.query(`UPDATE orders SET updated_at = now() WHERE id = $1`, [orderId]);
    }

    await insertTrackingEvent(client, {
      orderId,
      status: order.status === 'WAITING_AT_MAIN_GATE' ? 'ASSIGNED' : order.status,
      note: `${order.partner_id ? 'Reassigned' : 'Assigned'} to ${partner.name} by ${admin.name}`,
      actorId: admin.id,
    });

    const { rows } = await client.query(`${ORDER_SELECT} WHERE o.id = $1`, [orderId]);
    return mapOrder(rows[0]);
  });
}

/** Every other status move funnels through here. */
async function updateStatus(orderId, nextStatus, note, user) {
  return db.withTransaction(async (client) => {
    const order = await lockOrder(client, orderId);

    // A finished order is checked FIRST. Delivering an order releases its
    // assignment, so an ownership check here would wrongly report "you are
    // not the relay partner" when the real answer is "this is already done".
    if (TERMINAL_STATUSES.includes(order.status)) {
      guardTransition(order.status, nextStatus, user.role);
    }

    // Ownership: only the people involved in this order may move it.
    if (user.role === 'student' && order.student_id !== user.id) {
      throw ApiError.notFound('That order does not exist.');
    }
    if (user.role === 'partner' && order.partner_id !== user.id) {
      throw ApiError.forbidden('You are not the relay partner for this order.');
    }

    guardTransition(order.status, nextStatus, user.role);

    if (nextStatus === 'DELIVERED') {
      await client.query(
        `UPDATE orders SET status = 'DELIVERED', delivered_at = now() WHERE id = $1`,
        [orderId]
      );
      await client.query(
        `UPDATE delivery_assignments SET is_active = FALSE, released_at = now()
          WHERE order_id = $1 AND is_active`,
        [orderId]
      );
    } else {
      await client.query(`UPDATE orders SET status = $2 WHERE id = $1`, [orderId, nextStatus]);
    }

    await insertTrackingEvent(client, {
      orderId,
      status: nextStatus,
      note,
      actorId: user.id,
    });

    const { rows } = await client.query(`${ORDER_SELECT} WHERE o.id = $1`, [orderId]);
    return mapOrder(rows[0]);
  });
}

async function cancelOrder(orderId, reason, user) {
  return db.withTransaction(async (client) => {
    const order = await lockOrder(client, orderId);

    if (TERMINAL_STATUSES.includes(order.status)) {
      guardTransition(order.status, 'CANCELLED', user.role);
    }
    if (user.role === 'student' && order.student_id !== user.id) {
      throw ApiError.notFound('That order does not exist.');
    }
    if (user.role === 'partner') {
      throw ApiError.forbidden('Relay partners cannot cancel orders.');
    }

    guardTransition(order.status, 'CANCELLED', user.role);

    await client.query(
      `UPDATE orders SET status = 'CANCELLED', cancel_reason = $2 WHERE id = $1`,
      [orderId, reason || null]
    );
    // Free the partner up again if one was already carrying it.
    await client.query(
      `UPDATE delivery_assignments SET is_active = FALSE, released_at = now()
        WHERE order_id = $1 AND is_active`,
      [orderId]
    );
    await insertTrackingEvent(client, {
      orderId,
      status: 'CANCELLED',
      note: reason ? `Cancelled: ${reason}` : DEFAULT_NOTES.CANCELLED,
      actorId: user.id,
    });

    const { rows } = await client.query(`${ORDER_SELECT} WHERE o.id = $1`, [orderId]);
    return mapOrder(rows[0]);
  });
}

module.exports = {
  createOrder,
  listOrders,
  listAvailable,
  getOrderById,
  getPublicByCode,
  getTracking,
  acceptOrder,
  assignOrder,
  updateStatus,
  cancelOrder,
  MAX_ACTIVE_PER_PARTNER,
  ORDER_SELECT,
  mapOrder,
};
