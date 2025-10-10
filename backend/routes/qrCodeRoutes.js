const express = require("express");
const router = express.Router();
const { 
  generateQRCode, 
  markAttendance, 
  scanQRCode, 
  scanMeetingQRCode
} = require("../controllers/qrCodeController");
const { authenticateToken } = require("../middleware/authMiddleware");

router.get("/generate-qrcode", generateQRCode);
router.post("/mark-attendance", markAttendance);
router.post("/scan", scanQRCode);
router.post("/scan-meeting", scanMeetingQRCode);

module.exports = router;
