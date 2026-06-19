const express = require("express");
const InactiveInternController = require("../controllers/inactiveInternController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * Get all inactive interns
 */
router.get("/", InactiveInternController.getAllInactiveInterns);

/**
 * Get attendance statistics for an inactive intern
 */
router.get(
  "/:internId/attendance-stats",
  InactiveInternController.getInactiveInternAttendanceStats,
);

/**
 * Get daily records for an inactive intern
 */
router.get(
  "/:internId/daily-records",
  InactiveInternController.getInactiveInternDailyRecords,
);

/**
 * Reactivate an inactive intern
 */
router.post(
  "/:internId/reactivate",
  InactiveInternController.reactivateInactiveIntern,
);

/**
 * Get details of a specific inactive intern
 */
router.get("/:internId", InactiveInternController.getInactiveInternDetails);

module.exports = router;
