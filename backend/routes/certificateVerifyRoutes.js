const express = require("express");
const router = express.Router();
const { verifyCertificate } = require("../controllers/certificateController");

// PUBLIC — no auth required
// GET /api/verify/certificate/:token
router.get("/certificate/:token", verifyCertificate);

module.exports = router;
