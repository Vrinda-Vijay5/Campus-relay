const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const rules = require('../validators/auth.validators');

const router = express.Router();

// Slows down password guessing without affecting normal use.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please wait a few minutes.' },
});

router.post('/register', authLimiter, rules.registerRules, validate, controller.register);
router.post('/login', authLimiter, rules.loginRules, validate, controller.login);

router.get('/me', requireAuth, controller.me);
router.patch('/me', requireAuth, rules.updateProfileRules, validate, controller.updateMe);
router.post(
  '/change-password',
  requireAuth,
  rules.changePasswordRules,
  validate,
  controller.changePassword
);

module.exports = router;
