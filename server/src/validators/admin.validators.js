const { body, param, query } = require('express-validator');

const createPartnerRules = [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage("Enter the partner's name."),
  body('phone')
    .trim()
    .matches(/^[6-9][0-9]{9}$/)
    .withMessage('Enter a valid 10-digit mobile number.'),
  body('password')
    .isLength({ min: 8, max: 72 })
    .withMessage('Password must be at least 8 characters.')
    .matches(/[A-Za-z]/)
    .withMessage('Password must contain at least one letter.')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number.'),
  body('campusId').isInt({ min: 1 }).withMessage('Choose a campus.').toInt(),
];

const assignRules = [
  param('id').isInt({ min: 1 }).toInt(),
  body('partnerId').isInt({ min: 1 }).withMessage('Choose a delivery partner.').toInt(),
];

const setActiveRules = [
  param('id').isInt({ min: 1 }).toInt(),
  body('isActive').isBoolean().withMessage('isActive must be true or false.').toBoolean(),
];

const listUsersRules = [
  query('role').optional({ values: 'falsy' }).isIn(['student', 'partner', 'admin']),
  query('q').optional({ values: 'falsy' }).trim().isLength({ max: 60 }),
  query('page').optional({ values: 'falsy' }).isInt({ min: 1 }),
  query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 100 }),
];

const campusRules = [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Enter a campus name.'),
  body('city').trim().isLength({ min: 2, max: 60 }).withMessage('Enter a city.'),
];

const gateRules = [
  body('campusId').isInt({ min: 1 }).withMessage('Choose a campus.').toInt(),
  body('name').trim().isLength({ min: 1, max: 60 }).withMessage('Enter a gate name.'),
];

const hostelRules = [
  body('campusId').isInt({ min: 1 }).withMessage('Choose a campus.').toInt(),
  body('name').trim().isLength({ min: 2, max: 60 }).withMessage('Enter a hostel name.'),
  body('gender').isIn(['girls', 'boys']).withMessage('Choose girls or boys.'),
];

const blockRules = [
  body('hostelId').isInt({ min: 1 }).withMessage('Choose a hostel.').toInt(),
  body('name').trim().isLength({ min: 1, max: 20 }).withMessage('Enter a block name.'),
];

const configActiveRules = [
  param('type').isIn(['campuses', 'gates', 'hostels', 'blocks']),
  param('id').isInt({ min: 1 }).toInt(),
  body('isActive').isBoolean().toBoolean(),
];

module.exports = {
  createPartnerRules,
  assignRules,
  setActiveRules,
  listUsersRules,
  campusRules,
  gateRules,
  hostelRules,
  blockRules,
  configActiveRules,
};
