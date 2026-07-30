const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Sets a batch of protective HTTP headers (no sniffing, no framing, etc).
app.use(helmet());

// Only the frontends listed in CORS_ORIGIN may call this API from a browser.
app.use(
  cors({
    origin(origin, callback) {
      // Requests with no Origin header (curl, Postman, health checks) are fine.
      if (!origin) return callback(null, true);
      if (env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: false,
  })
);

// Parse JSON bodies, with a size cap so a huge payload cannot exhaust memory.
app.use(express.json({ limit: '100kb' }));

if (!env.isProd) app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Campus Relay API. See /api/health',
    docs: '/api/health',
  });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
