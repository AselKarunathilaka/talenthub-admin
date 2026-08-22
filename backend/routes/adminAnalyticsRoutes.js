const express = require('express');
const router = express.Router();
const adminAnalyticsController = require('../controllers/adminAnalyticsController');

router.get('/', adminAnalyticsController.getAdminAnalytics);

module.exports = router;
