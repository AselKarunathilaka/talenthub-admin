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
  getPreviousDaySubmissions,
  getWeeklyNonSubmissions,
  syncWithSLTAPI,
  triggerWeeklyNonSubmissionCheck
} = require("../controllers/adminController");
const { exportOnLeaveExcel } = require("../controllers/onLeaveExportController");
// Export on-leave interns as Excel
router.get("/on-leave/export", exportOnLeaveExcel);

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

// Get weekly non-submissions (Monday to Friday of current week)
router.get("/weekly-non-submissions", getWeeklyNonSubmissions);

// Send notifications to overdue interns
router.post("/notifications/overdue", sendOverdueNotifications);

// Get individual intern details
router.get("/intern/:internId", getInternDetails);

// Manually trigger SLT API sync
router.post("/sync/slt-api", syncWithSLTAPI);

// Manually trigger weekly non-submission check
router.post("/trigger/weekly-non-submission-check", triggerWeeklyNonSubmissionCheck);

module.exports = router;
