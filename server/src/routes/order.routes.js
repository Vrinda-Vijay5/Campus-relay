const express = require('express');
const controller = require('../controllers/order.controller');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const rules = require('../validators/order.validators');

const router = express.Router();

// --- Public tracking, matching the original "Track My Order" page ---
router.get('/track/:code', rules.codeParamRule, validate, controller.trackByCode);

// Everything below needs a valid token.
router.use(requireAuth);

router.get('/', rules.listRules, validate, controller.list);

// Must be declared before "/:id" or Express would read "available" as an id.
router.get('/available', requireRole('partner'), controller.available);

router.post(
  '/',
  requireRole('student'),
  rules.createOrderRules,
  validate,
  controller.create
);

router.get('/:id', rules.idParamRule, validate, controller.getOne);

router.post('/:id/accept', requireRole('partner'), rules.idParamRule, validate, controller.accept);

router.patch('/:id/status', rules.updateStatusRules, validate, controller.updateStatus);

router.post(
  '/:id/cancel',
  requireRole('student', 'admin'),
  rules.cancelRules,
  validate,
  controller.cancel
);

module.exports = router;
