const { body, param, query } = require('express-validator');
const { STATUSES } = require('../utils/orderState');

const VENDORS = ['Swiggy', 'Zomato', 'Blinkit', 'Zepto', 'Amazon', 'Flipkart', 'Other'];

const createOrderRules = [
  body('gateId').isInt({ min: 1 }).withMessage('Choose the pickup gate.').toInt(),
  body('blockId').isInt({ min: 1 }).withMessage('Choose your hostel block.').toInt(),
  body('roomNumber').optional({ values: 'falsy' }).trim().isLength({ max: 20 }),
  body('vendor').isIn(VENDORS).withMessage('Choose the delivery app or service.'),
  body('itemDescription')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Describe the order in 2 to 200 characters.'),
  body('contactPhone')
    .trim()
    .matches(/^[6-9][0-9]{9}$/)
    .withMessage('Enter a valid 10-digit contact number.'),
  body('expectedArrival')
    .isISO8601()
    .withMessage('Choose when the delivery should reach the gate.')
    .custom((value) => {
      const at = new Date(value).getTime();
      const now = Date.now();
      // A relay only makes sense for something arriving soon.
      if (at < now - 2 * 60 * 60 * 1000) {
        throw new Error('That time is already more than two hours in the past.');
      }
      if (at > now + 48 * 60 * 60 * 1000) {
        throw new Error('Please pick a time within the next 48 hours.');
      }
      return true;
    }),
  body('notes').optional({ values: 'falsy' }).trim().isLength({ max: 300 }),
];

const idParamRule = [param('id').isInt({ min: 1 }).withMessage('Invalid order id.').toInt()];

const updateStatusRules = [
  ...idParamRule,
  body('status')
    .isIn(STATUSES)
    .withMessage('Unknown order status.')
    .bail()
    // ASSIGNED is only ever reached by accepting or being assigned a delivery,
    // both of which also create the matching delivery_assignments row. Allowing
    // it here would let a caller move an order to ASSIGNED with no partner
    // attached to it.
    .custom((value) => value !== 'ASSIGNED')
    .withMessage(
      'ASSIGNED cannot be set directly. Accept the order as a partner or use the admin assign endpoint.'
    ),
  body('note').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
];

const cancelRules = [
  ...idParamRule,
  body('reason').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
];

const listRules = [
  query('status').optional({ values: 'falsy' }).isIn(STATUSES),
  query('vendor').optional({ values: 'falsy' }).isIn(VENDORS),
  query('gender').optional({ values: 'falsy' }).isIn(['girls', 'boys']),
  query('blockId').optional({ values: 'falsy' }).isInt({ min: 1 }),
  query('partnerId').optional({ values: 'falsy' }).isInt({ min: 1 }),
  query('page').optional({ values: 'falsy' }).isInt({ min: 1 }),
  query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 50 }),
  query('q').optional({ values: 'falsy' }).trim().isLength({ max: 60 }),
];

const codeParamRule = [
  param('code')
    .trim()
    .matches(/^[A-Za-z0-9-]{4,24}$/)
    .withMessage('That does not look like an order code.'),
];

module.exports = {
  VENDORS,
  createOrderRules,
  idParamRule,
  updateStatusRules,
  cancelRules,
  listRules,
  codeParamRule,
};
