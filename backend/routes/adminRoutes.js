const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getDashboardStats,
  getInternReport,
  sendOverdueNotifications,
  getInternDetails,
  searchInterns,
  getAllDailyRecords,
  getPreviousDaySubmissions
} = require("../controllers/adminController");

// All admin routes require authentication
router.use(authMiddleware);

// Dashboard statistics
router.get("/dashboard/stats", getDashboardStats);

// Search interns
router.get("/search/interns", searchInterns);

// Intern report (for CSV export)
router.get("/report/interns", getInternReport);

// Get all daily records
router.get("/daily-records", getAllDailyRecords);

// Get previous day submissions
router.get("/previous-day-submissions", getPreviousDaySubmissions);

// Send notifications to overdue interns
router.post("/notifications/overdue", sendOverdueNotifications);

// Get individual intern details
router.get("/intern/:internId", getInternDetails);

module.exports = router;
