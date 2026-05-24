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
const requireActiveProject = require("../middleware/requireActiveProject");

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// ── Export routes (must be registered before /:id to avoid conflict) ──────────
router.get("/export/templates", getAvailableTemplates);
router.get("/export/pdf", exportDailyRecordsPDF);

// ── LLM validation ────────────────────────────────────────────────────────────
router.post("/validate-entry", validateLogbookEntry);
router.post("/validate-batch", validateBatchEntries);

// ── Project access check (used by the frontend before rendering the form) ────
// GET /records/check-project-access
// Returns 200 if the intern has a team assignment, 403 if not.
router.get("/check-project-access", requireActiveProject, (req, res) => {
  res.json({ allowed: true });
});

// ── CRUD routes ───────────────────────────────────────────────────────────────
router.post("/", requireActiveProject, createDailyRecord);
router.get("/", getDailyRecords);
router.get("/:id", getDailyRecordById);
router.put("/:id", updateDailyRecord);
router.delete("/:id", deleteDailyRecord);

module.exports = router;
