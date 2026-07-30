const db = require('../config/db');
const ApiError = require('../utils/ApiError');

// These lists are public: the registration form and the order form both
// need them before anyone is logged in. They contain no personal data.

async function listCampuses() {
  const { rows } = await db.query(
    `SELECT id, name, city FROM campuses WHERE is_active ORDER BY name`
  );
  return rows;
}

async function listGates(campusId) {
  const { rows } = await db.query(
    `SELECT id, name FROM gates WHERE campus_id = $1 AND is_active ORDER BY name`,
    [campusId]
  );
  return rows;
}

/** Hostels with their blocks nested, ready for a grouped <select>. */
async function listHostelsWithBlocks(campusId) {
  const { rows } = await db.query(
    `SELECT h.id   AS hostel_id,
            h.name AS hostel_name,
            h.gender,
            b.id   AS block_id,
            b.name AS block_name
       FROM hostels h
       JOIN blocks b ON b.hostel_id = h.id AND b.is_active
      WHERE h.campus_id = $1 AND h.is_active
      ORDER BY h.gender DESC, h.name, b.name`,
    [campusId]
  );

  const hostels = [];
  const index = new Map();
  for (const r of rows) {
    if (!index.has(r.hostel_id)) {
      const hostel = {
        id: r.hostel_id,
        name: r.hostel_name,
        gender: r.gender,
        blocks: [],
      };
      index.set(r.hostel_id, hostel);
      hostels.push(hostel);
    }
    index.get(r.hostel_id).blocks.push({ id: r.block_id, name: r.block_name });
  }
  return hostels;
}

async function getCampusOrFail(campusId) {
  const { rows } = await db.query('SELECT id, name FROM campuses WHERE id = $1', [campusId]);
  if (rows.length === 0) throw ApiError.notFound('That campus does not exist.');
  return rows[0];
}

// ---------------------------------------------------------------------
// Admin variants: include deactivated rows too, so there is somewhere to
// find and reactivate a record that setConfigActive() turned off. The
// public functions above stay active-only on purpose - a deactivated gate
// must not appear in the registration or order forms.
// ---------------------------------------------------------------------

async function listAllCampuses() {
  const { rows } = await db.query(
    `SELECT id, name, city, is_active FROM campuses ORDER BY name`
  );
  return rows.map((r) => ({ id: r.id, name: r.name, city: r.city, isActive: r.is_active }));
}

async function listAllGates(campusId) {
  const { rows } = await db.query(
    `SELECT id, name, is_active FROM gates WHERE campus_id = $1 ORDER BY name`,
    [campusId]
  );
  return rows.map((r) => ({ id: r.id, name: r.name, isActive: r.is_active }));
}

/** Same shape as listHostelsWithBlocks, but includes inactive hostels and blocks. */
async function listAllHostelsWithBlocks(campusId) {
  const { rows } = await db.query(
    `SELECT h.id   AS hostel_id,
            h.name AS hostel_name,
            h.gender,
            h.is_active AS hostel_active,
            b.id   AS block_id,
            b.name AS block_name,
            b.is_active AS block_active
       FROM hostels h
       LEFT JOIN blocks b ON b.hostel_id = h.id
      WHERE h.campus_id = $1
      ORDER BY h.gender DESC, h.name, b.name`,
    [campusId]
  );

  const hostels = [];
  const index = new Map();
  for (const r of rows) {
    if (!index.has(r.hostel_id)) {
      const hostel = {
        id: r.hostel_id,
        name: r.hostel_name,
        gender: r.gender,
        isActive: r.hostel_active,
        blocks: [],
      };
      index.set(r.hostel_id, hostel);
      hostels.push(hostel);
    }
    // LEFT JOIN means a hostel with zero blocks produces one row with nulls.
    if (r.block_id) {
      index
        .get(r.hostel_id)
        .blocks.push({ id: r.block_id, name: r.block_name, isActive: r.block_active });
    }
  }
  return hostels;
}

module.exports = {
  listCampuses,
  listGates,
  listHostelsWithBlocks,
  getCampusOrFail,
  listAllCampuses,
  listAllGates,
  listAllHostelsWithBlocks,
};
