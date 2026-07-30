const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Runs after a list of express-validator rules. Collects every problem
 * into one 400 response so the form can highlight all bad fields at once,
 * instead of the user fixing them one at a time.
 */
module.exports = function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = {};
  for (const err of result.array()) {
    if (!details[err.path]) details[err.path] = err.msg;
  }

  next(ApiError.badRequest('Please correct the highlighted fields.', details));
};
