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
const {
  checkLogbookRestriction,
} = require("../middleware/checkLogBookRestriction");
const Intern = require("../models/Intern");

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// ── Export routes (must be registered before /:id to avoid conflict) ──────────
router.get("/export/templates", getAvailableTemplates);
router.get("/export/pdf", exportDailyRecordsPDF);

// ── LLM validation ────────────────────────────────────────────────────────────
router.post("/validate-entry", validateLogbookEntry);
router.post("/validate-batch", validateBatchEntries);

// ── Logbook restriction status (used by frontend on Logbook page mount) ───────
// GET /records/status
// Returns whether the logged-in intern's logbook is currently restricted.
router.get("/status", async (req, res) => {
  try {
    const internId = req.user?.id || req.user?._id;
    if (!internId) return res.status(401).json({ error: "Unauthorized" });

    // resolveIntern logic mirrors createDailyRecord — find by _id or email
    let intern = await Intern.findById(internId).select(
      "logbookRestricted logbookRestrictionReason logbookRestrictedAt",
    );
    if (!intern) {
      intern = await Intern.findOne({ email: req.user?.email }).select(
        "logbookRestricted logbookRestrictionReason logbookRestrictedAt",
      );
    }

    if (!intern) {
      // Intern record not found — fail open so the form still renders
      return res.json({
        logbookRestricted: false,
        logbookRestrictionReason: null,
        logbookRestrictedAt: null,
      });
    }

    return res.json({
      logbookRestricted: intern.logbookRestricted || false,
      logbookRestrictionReason: intern.logbookRestrictionReason || null,
      logbookRestrictedAt: intern.logbookRestrictedAt || null,
    });
  } catch (err) {
    console.error("GET /records/status error:", err);
    // Fail open — don't block the intern from seeing the form on server error
    return res.json({
      logbookRestricted: false,
      logbookRestrictionReason: null,
      logbookRestrictedAt: null,
    });
  }
});

// ── Project access check (used by the frontend before rendering the form) ────
// GET /records/check-project-access
// Returns 200 if the intern has a team assignment, 403 if not.
router.get("/check-project-access", requireActiveProject, (req, res) => {
  res.json({ allowed: true });
});

// ── CRUD routes ───────────────────────────────────────────────────────────────
// checkLogbookRestriction sits between requireActiveProject and createDailyRecord
// so a restricted intern gets a clear 403 before any DB write is attempted.
router.post(
  "/",
  requireActiveProject,
  checkLogbookRestriction,
  createDailyRecord,
);
router.get("/", getDailyRecords);
router.get("/:id", getDailyRecordById);
router.put("/:id", updateDailyRecord);
router.delete("/:id", deleteDailyRecord);

module.exports = router;
