// Entry point: start the HTTP server after checking the database is reachable.
const app = require('./app');
const env = require('./config/env');
const db = require('./config/db');

async function start() {
  try {
    const info = await db.testConnection();
    console.log(`[db]     connected to "${info.db}"`);
  } catch (err) {
    console.error('\n[db] Could not connect to PostgreSQL.');
    console.error('     ' + err.message);
    console.error('\n     Check these, in order:');
    console.error('       1. Is PostgreSQL running? (Windows: Services > postgresql-x64-16)');
    console.error('       2. Do PGUSER / PGPASSWORD / PGDATABASE in server/.env match pgAdmin?');
    console.error('       3. Did you create the database and run db/schema.sql?\n');
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    console.log(`[server] Campus Relay API listening on http://localhost:${env.port}`);
    console.log(`[server] environment: ${env.nodeEnv}`);
    console.log(`[server] allowed frontends: ${env.corsOrigins.join(', ')}`);
  });

  // Let Render/Railway stop the container cleanly instead of killing connections.
  const shutdown = (signal) => () => {
    console.log(`\n[server] ${signal} received, shutting down.`);
    server.close(() => {
      db.pool.end().finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', shutdown('SIGTERM'));
  process.on('SIGINT', shutdown('SIGINT'));
}

start();
