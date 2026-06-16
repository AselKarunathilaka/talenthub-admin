// routes/featureTipRoutes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getUnseenFeatureTips,
  markFeatureTipSeen,
} = require("../controllers/featureTipController");

// All feature tip routes require a valid intern JWT
router.use(authMiddleware);

// GET /api/feature-tips/unseen
router.get("/unseen", getUnseenFeatureTips);

// POST /api/feature-tips/mark-seen
router.post("/mark-seen", markFeatureTipSeen);

module.exports = router;
