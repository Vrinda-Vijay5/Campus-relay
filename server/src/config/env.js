// Loads .env into process.env and validates it once, at startup.
// Failing loudly here is much better than a confusing crash later.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const env = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  databaseUrl: process.env.DATABASE_URL || '',
  pg: {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT, 10) || 5432,
    database: process.env.PGDATABASE || 'campus_relay',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
  },
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};

env.isProd = env.nodeEnv === 'production';

if (!env.jwtSecret || env.jwtSecret.length < 16) {
  console.error(
    '\n[config] JWT_SECRET is missing or too short.\n' +
      '         Open server/.env and set JWT_SECRET to a long random string.\n'
  );
  process.exit(1);
}

if (!env.databaseUrl && !env.pg.password) {
  console.warn(
    '[config] No PGPASSWORD and no DATABASE_URL set - the database connection will probably fail.'
  );
}

module.exports = env;
