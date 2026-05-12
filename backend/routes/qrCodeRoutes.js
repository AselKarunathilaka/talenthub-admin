const express = require("express");
const router = express.Router();
const { 
  generateQRCode, 
  markAttendance, 
  scanQRCode, 
  scanMeetingQRCode
} = require("../controllers/qrCodeController");
const authenticateUser = require("../middleware/authMiddleware");

router.get("/generate-qrcode", generateQRCode);
router.post("/mark-attendance", markAttendance);
router.post("/scan", authenticateUser, scanQRCode);
router.post("/scan-meeting", authenticateUser, scanMeetingQRCode);

module.exports = router;
