const asyncHandler = require('../utils/asyncHandler');
const adminService = require('../services/admin.service');
const orderService = require('../services/order.service');
const campusService = require('../services/campus.service');

const stats = asyncHandler(async (req, res) => {
  res.json({ success: true, stats: await adminService.getStats() });
});

const activeDeliveries = asyncHandler(async (req, res) => {
  res.json({ success: true, deliveries: await adminService.listActiveDeliveries() });
});

const listUsers = asyncHandler(async (req, res) => {
  const result = await adminService.listUsers(req.query);
  res.json({ success: true, ...result });
});

const createPartner = asyncHandler(async (req, res) => {
  const { name, phone, password, campusId } = req.body;
  const user = await adminService.createPartner({ name, phone, password, campusId });
  res.status(201).json({ success: true, user });
});

const setUserActive = asyncHandler(async (req, res) => {
  const user = await adminService.setUserActive(
    Number(req.params.id),
    req.body.isActive,
    req.user
  );
  res.json({ success: true, user });
});

const listPartners = asyncHandler(async (req, res) => {
  const campusId = req.query.campusId ? Number(req.query.campusId) : req.user.campus_id;
  res.json({ success: true, partners: await adminService.listPartnersWithLoad(campusId) });
});

const assignOrder = asyncHandler(async (req, res) => {
  const order = await orderService.assignOrder(
    Number(req.params.id),
    Number(req.body.partnerId),
    req.user
  );
  res.json({ success: true, order, message: 'Delivery partner assigned.' });
});

const createCampus = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, campus: await adminService.createCampus(req.body) });
});

const createGate = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, gate: await adminService.createGate(req.body) });
});

const createHostel = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, hostel: await adminService.createHostel(req.body) });
});

const createBlock = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, block: await adminService.createBlock(req.body) });
});

const setConfigActive = asyncHandler(async (req, res) => {
  const record = await adminService.setConfigActive(
    req.params.type,
    Number(req.params.id),
    req.body.isActive
  );
  res.json({ success: true, record });
});

// Admin-only listings that include deactivated rows, so there is somewhere
// to find and reactivate something setConfigActive() turned off. The public
// /campuses routes stay active-only.
const listAllCampuses = asyncHandler(async (req, res) => {
  res.json({ success: true, campuses: await campusService.listAllCampuses() });
});

const listAllGates = asyncHandler(async (req, res) => {
  const campusId = Number(req.params.campusId);
  await campusService.getCampusOrFail(campusId);
  res.json({ success: true, gates: await campusService.listAllGates(campusId) });
});

const listAllHostels = asyncHandler(async (req, res) => {
  const campusId = Number(req.params.campusId);
  await campusService.getCampusOrFail(campusId);
  res.json({ success: true, hostels: await campusService.listAllHostelsWithBlocks(campusId) });
});

module.exports = {
  stats,
  activeDeliveries,
  listUsers,
  createPartner,
  setUserActive,
  listPartners,
  assignOrder,
  createCampus,
  createGate,
  createHostel,
  createBlock,
  setConfigActive,
  listAllCampuses,
  listAllGates,
  listAllHostels,
};
