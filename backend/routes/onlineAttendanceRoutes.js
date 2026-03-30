const express = require("express");
const router = express.Router();
const onlineAttendanceController = require("../controllers/onlineAttendanceController");

// Upload and process Teams CSV report
router.post("/upload", onlineAttendanceController.uploadTeamsReport);

// Get attendance records for a specific date (?date=YYYY-MM-DD)
router.get("/date", onlineAttendanceController.getOnlineAttendanceByDate);

// Get attendance statistics (optional ?date=YYYY-MM-DD)
router.get("/stats", onlineAttendanceController.getOnlineAttendanceStats);

// Manually mark attendance for a specific intern
router.post("/mark", onlineAttendanceController.markManualOnlineAttendance);

// Get attendance records by meeting name (?meetingName=xxx&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD)
router.get("/meeting", onlineAttendanceController.getAttendanceByMeeting);

module.exports = router;
