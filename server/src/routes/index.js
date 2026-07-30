const express = require('express');
const authRoutes = require('./auth.routes');
const orderRoutes = require('./order.routes');
const campusRoutes = require('./campus.routes');
const adminRoutes = require('./admin.routes');
const campusController = require('../controllers/campus.controller');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ success: true, service: 'campus-relay-api', time: new Date().toISOString() });
});

router.get('/meta', campusController.meta);

router.use('/auth', authRoutes);
router.use('/campuses', campusRoutes);
router.use('/orders', orderRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
