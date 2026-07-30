const { body } = require('express-validator');

const PHONE_RE = /^[6-9][0-9]{9}$/;

const phoneRule = (field = 'phone') =>
  body(field)
    .trim()
    .matches(PHONE_RE)
    .withMessage('Enter a valid 10-digit Indian mobile number.');

const passwordRule = (field = 'password') =>
  body(field)
    .isLength({ min: 8, max: 72 })
    .withMessage('Password must be at least 8 characters.')
    .matches(/[A-Za-z]/)
    .withMessage('Password must contain at least one letter.')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number.');

const registerRules = [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Enter your full name.'),
  phoneRule(),
  passwordRule(),
  body('campusId').isInt({ min: 1 }).withMessage('Choose your campus.').toInt(),
  body('defaultBlockId').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
  body('roomNumber').optional({ values: 'falsy' }).trim().isLength({ max: 20 }),
];

const loginRules = [
  phoneRule(),
  body('password').notEmpty().withMessage('Enter your password.'),
];

const updateProfileRules = [
  body('name').optional({ values: 'falsy' }).trim().isLength({ min: 2, max: 80 }),
  body('defaultBlockId').optional({ values: 'null' }).isInt({ min: 1 }).toInt(),
  body('roomNumber').optional({ values: 'null' }).trim().isLength({ max: 20 }),
];

const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Enter your current password.'),
  passwordRule('newPassword'),
];

module.exports = { registerRules, loginRules, updateProfileRules, changePasswordRules, PHONE_RE };
