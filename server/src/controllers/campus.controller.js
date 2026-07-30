const asyncHandler = require('../utils/asyncHandler');
const campusService = require('../services/campus.service');
const { STATUS_LABELS, RELAY_SEQUENCE } = require('../utils/orderState');
const { VENDORS } = require('../validators/order.validators');

const listCampuses = asyncHandler(async (req, res) => {
  res.json({ success: true, campuses: await campusService.listCampuses() });
});

const listGates = asyncHandler(async (req, res) => {
  const campusId = Number(req.params.campusId);
  await campusService.getCampusOrFail(campusId);
  res.json({ success: true, gates: await campusService.listGates(campusId) });
});

const listHostels = asyncHandler(async (req, res) => {
  const campusId = Number(req.params.campusId);
  await campusService.getCampusOrFail(campusId);
  res.json({ success: true, hostels: await campusService.listHostelsWithBlocks(campusId) });
});

/**
 * Lets the frontend read the status labels, relay order and vendor list
 * from the backend instead of hardcoding them in two places.
 */
const meta = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    statusLabels: STATUS_LABELS,
    relaySequence: RELAY_SEQUENCE,
    vendors: VENDORS,
  });
});

module.exports = { listCampuses, listGates, listHostels, meta };
