/**
 * Wraps an async route handler so a rejected promise is passed to
 * Express's error handler instead of crashing the process.
 * Without this you would need try/catch in every single controller.
 */
module.exports = function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
