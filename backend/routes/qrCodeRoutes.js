const express = require("express");
const router = express.Router();
const { generateQRCode, markAttendance, scanQRCode } = require("../controllers/qrCodeController");

router.get("/generate-qrcode", generateQRCode);
router.post("/mark-attendance", markAttendance);
router.post("/scan", scanQRCode);

module.exports = router;
