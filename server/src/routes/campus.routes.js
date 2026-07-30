const express = require('express');
const controller = require('../controllers/campus.controller');

const router = express.Router();

// Public: the register and order forms need these lists.
// They contain campus configuration only - no personal data.
router.get('/', controller.listCampuses);
router.get('/:campusId/gates', controller.listGates);
router.get('/:campusId/hostels', controller.listHostels);

module.exports = router;
