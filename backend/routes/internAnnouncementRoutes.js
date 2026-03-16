// routes/internAnnouncementRoutes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getActiveAnnouncements,
} = require("../controllers/AnnouncementController");

// All routes require a valid intern JWT
router.use(authMiddleware);

// GET /api/announcements/active
// Returns announcements visible to the logged-in intern (all + their specific ones)
router.get("/active", getActiveAnnouncements);

module.exports = router;
