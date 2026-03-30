const express = require("express");
const router = express.Router();
const { 
  generateQRCode, 
  markAttendance, 
  scanQRCode,
  generateDailyAttendanceQR,
  generateMeetingQR,
  scanDailyAttendanceQR,
  scanMeetingQR,
  getCurrentQRInfo,
  getCurrentMeetingQRInfo,
  scanDailyAttendanceExternal,
  scanMeetingAttendanceExternal,
  verifyQRStatus
} = require("../controllers/qrCodeController");
const { 
  validateDailyAttendanceQR, 
  rateLimitQRScan 
} = require("../middleware/validationMiddleware");

// Existing routes
router.get("/generate-qrcode", generateQRCode);
router.post("/mark-attendance", markAttendance);
router.post("/scan", scanQRCode);

// New daily attendance routes with validation
router.get("/generate-daily-qr", generateDailyAttendanceQR);
router.post("/scan-daily", 
  validateDailyAttendanceQR, 
  rateLimitQRScan, 
  scanDailyAttendanceQR
);
router.get("/current-qr-info", getCurrentQRInfo);

// New meeting attendance routes
router.get("/generate-meeting-qr", generateMeetingQR);
router.post("/scan-meeting", scanMeetingQR);
router.get("/current-meeting-qr-info", getCurrentMeetingQRInfo);

// External API for TalentHub system
router.post("/external/scan-daily", scanDailyAttendanceExternal);
router.post("/external/scan-meeting", scanMeetingAttendanceExternal);

// Cross-application QR sharing endpoints
router.get("/external/current-qr", getCurrentQRInfo);
router.get("/external/verify-qr/:sessionId", verifyQRStatus);

module.exports = router;
