const express = require('express');
const controller = require('../controllers/admin.controller');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const rules = require('../validators/admin.validators');

const router = express.Router();

// One gate for the whole file: every admin route needs a token AND the
// admin role. Applying it here means no individual route can forget it.
router.use(requireAuth, requireRole('admin'));

router.get('/stats', controller.stats);
router.get('/active-deliveries', controller.activeDeliveries);

router.get('/users', rules.listUsersRules, validate, controller.listUsers);
router.post('/partners', rules.createPartnerRules, validate, controller.createPartner);
router.get('/partners', controller.listPartners);
router.patch('/users/:id/active', rules.setActiveRules, validate, controller.setUserActive);

router.post('/orders/:id/assign', rules.assignRules, validate, controller.assignOrder);

router.post('/campuses', rules.campusRules, validate, controller.createCampus);
router.post('/gates', rules.gateRules, validate, controller.createGate);
router.post('/hostels', rules.hostelRules, validate, controller.createHostel);
router.post('/blocks', rules.blockRules, validate, controller.createBlock);
router.patch('/config/:type/:id/active', rules.configActiveRules, validate, controller.setConfigActive);

// Include deactivated rows, unlike the public /campuses routes - this is
// what makes a deactivated gate/hostel/block findable again to reactivate.
router.get('/campuses', controller.listAllCampuses);
router.get('/campuses/:campusId/gates', controller.listAllGates);
router.get('/campuses/:campusId/hostels', controller.listAllHostels);

module.exports = router;
