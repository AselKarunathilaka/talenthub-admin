const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireAdmin, requireSuperAdmin } = require("../middleware/adminAuth");
const {
  createBackup,
  getBackupStatus,
} = require("../controllers/databaseBackupController");

const router = express.Router();
router.use(authMiddleware, requireAdmin, requireSuperAdmin);
router.get("/status", getBackupStatus);
router.post("/run", createBackup);

module.exports = router;
