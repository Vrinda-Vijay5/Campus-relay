/**
 * An error we deliberately throw, with an HTTP status attached.
 * The error handler turns these into clean JSON responses.
 * Anything that is NOT an ApiError is treated as an unexpected bug and
 * hidden behind a generic 500 message so we never leak internals.
 */
class ApiError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.status = status;
    this.details = details;
    this.isApiError = true;
  }

  static badRequest(msg, details) { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'You need to log in to do that.') { return new ApiError(401, msg); }
  static forbidden(msg = 'You do not have permission to do that.') { return new ApiError(403, msg); }
  static notFound(msg = 'Not found.') { return new ApiError(404, msg); }
  static conflict(msg) { return new ApiError(409, msg); }
}

module.exports = ApiError;
