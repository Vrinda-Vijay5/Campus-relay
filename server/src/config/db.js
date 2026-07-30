// One shared connection pool for the whole app.
// A pool reuses TCP connections instead of opening a new one per request.
const { Pool } = require('pg');
const env = require('./env');

const pool = env.databaseUrl
  ? new Pool({
      connectionString: env.databaseUrl,
      // Hosted Postgres (Neon/Render) requires TLS. Local Postgres does not.
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({ ...env.pg });

pool.on('error', (err) => {
  console.error('[db] idle client error:', err.message);
});

/**
 * Run a single parameterised query.
 * ALWAYS pass user input through `params` - never build SQL with string
 * concatenation. This is what makes SQL injection impossible here.
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  if (!env.isProd) {
    const ms = Date.now() - start;
    if (ms > 200) console.warn(`[db] slow query ${ms}ms: ${text.split('\n')[0]}`);
  }
  return result;
}

/**
 * Run several statements as one all-or-nothing transaction.
 * Used wherever two tables must change together - for example updating
 * orders.status AND inserting the matching tracking_events row.
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function testConnection() {
  const { rows } = await pool.query('SELECT current_database() AS db, now() AS at');
  return rows[0];
}

module.exports = { pool, query, withTransaction, testConnection };
