const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');

// Controllers stay thin: read the request, call a service, send a response.
// All the rules live in the services, which makes them easy to reuse and test.

const register = asyncHandler(async (req, res) => {
  const { name, phone, password, campusId, defaultBlockId, roomNumber } = req.body;
  const result = await authService.register({
    name,
    phone,
    password,
    campusId,
    defaultBlockId,
    roomNumber,
  });
  res.status(201).json({ success: true, ...result });
});

const login = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;
  const result = await authService.login({ phone, password });
  res.json({ success: true, ...result });
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.findById(req.user.id);
  res.json({ success: true, user });
});

const updateMe = asyncHandler(async (req, res) => {
  const { name, defaultBlockId, roomNumber } = req.body;
  const user = await authService.updateProfile(req.user.id, { name, defaultBlockId, roomNumber });
  res.json({ success: true, user });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user.id, { currentPassword, newPassword });
  res.json({ success: true, message: 'Password changed.' });
});

module.exports = { register, login, me, updateMe, changePassword };
