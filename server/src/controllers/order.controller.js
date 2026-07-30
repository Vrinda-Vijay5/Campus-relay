const asyncHandler = require('../utils/asyncHandler');
const orderService = require('../services/order.service');

const create = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.user, req.body);
  res.status(201).json({ success: true, order });
});

/** GET /api/orders - the same endpoint serves all three roles. */
const list = asyncHandler(async (req, res) => {
  const result = await orderService.listOrders(req.user, req.query);
  res.json({ success: true, ...result });
});

const available = asyncHandler(async (req, res) => {
  const orders = await orderService.listAvailable(req.user);
  res.json({ success: true, orders });
});

const getOne = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(Number(req.params.id), req.user);
  res.json({ success: true, order });
});

/** Public: no token required. Returns limited, non-personal fields. */
const trackByCode = asyncHandler(async (req, res) => {
  const order = await orderService.getPublicByCode(req.params.code);
  res.json({ success: true, order });
});

const accept = asyncHandler(async (req, res) => {
  const order = await orderService.acceptOrder(Number(req.params.id), req.user);
  res.json({ success: true, order, message: 'Delivery accepted.' });
});

const updateStatus = asyncHandler(async (req, res) => {
  const order = await orderService.updateStatus(
    Number(req.params.id),
    req.body.status,
    req.body.note,
    req.user
  );
  res.json({ success: true, order });
});

const cancel = asyncHandler(async (req, res) => {
  const order = await orderService.cancelOrder(Number(req.params.id), req.body.reason, req.user);
  res.json({ success: true, order, message: 'Order cancelled.' });
});

module.exports = { create, list, available, getOne, trackByCode, accept, updateStatus, cancel };
