const express = require("express");
const authenticateUser = require("../middleware/authMiddleware");

const {
  createDailyRecord,
  getDailyRecords,
  getDailyRecordById,
  updateDailyRecord,
  deleteDailyRecord,
  validateLogbookEntry,
  validateBatchEntries,
} = require("../controllers/dailyRecordController");

const {
  exportDailyRecordsPDF,
  getAvailableTemplates,
} = require("../controllers/logbookExportController");

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// ── Export routes (must be registered before /:id to avoid conflict) ──────────
router.get("/export/templates", getAvailableTemplates);
router.get("/export/pdf", exportDailyRecordsPDF);

// ── Endpoint for LLM validation ───────────────────────────────────────────────
router.post("/validate-entry", validateLogbookEntry);
router.post("/validate-batch", validateBatchEntries);

// ── CRUD routes ───────────────────────────────────────────────────────────────
router.post("/", createDailyRecord);
router.get("/", getDailyRecords);
router.get("/:id", getDailyRecordById);
router.put("/:id", updateDailyRecord);
router.delete("/:id", deleteDailyRecord);

module.exports = router;
