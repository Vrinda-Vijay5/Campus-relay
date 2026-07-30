const env = require('../config/env');

// Any request that matched no route lands here.
function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `No API route for ${req.method} ${req.originalUrl}`,
  });
}

/**
 * The single place where errors become HTTP responses.
 *
 * Deliberate errors (ApiError) keep their message and status.
 * Everything else is a bug: we log the real error on the server and send
 * the client a generic 500, so stack traces, SQL and file paths never
 * leak to the browser.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err && err.isApiError) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // Translate the PostgreSQL errors we can predict into friendly messages.
  if (err && err.code === '23505') {
    return res.status(409).json({ success: false, message: 'That record already exists.' });
  }
  if (err && err.code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'That referenced record does not exist.',
    });
  }
  if (err && err.code === '23514') {
    return res.status(400).json({
      success: false,
      message: 'One of the submitted values is not allowed.',
    });
  }
  if (err && (err.code === 'ECONNREFUSED' || err.code === '28P01' || err.code === '3D000')) {
    console.error('[db] connection problem:', err.message);
    return res.status(503).json({
      success: false,
      message: 'The database is unreachable. Check the server .env settings.',
    });
  }

  console.error('[error]', err);
  res.status(500).json({
    success: false,
    message: 'Something went wrong on the server.',
    ...(env.isProd ? {} : { debug: err && err.message }),
  });
}

module.exports = { notFound, errorHandler };
