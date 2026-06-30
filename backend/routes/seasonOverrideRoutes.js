const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getActiveSeason,
  setSeasonOverride,
  clearSeasonOverride,
} = require("../controllers/seasonOverrideController");

// ── Public route (no auth) ────────────────────────────────────────────────────
// GET /api/login-season — returns the active season (used by frontend Login page)
router.get("/", getActiveSeason);

// ── Admin-only routes (auth required) ─────────────────────────────────────────
// PUT /api/login-season/override    — set a season override for testing
// DELETE /api/login-season/override — clear the override (back to auto-detect)
router.put("/override", authMiddleware, setSeasonOverride);
router.delete("/override", authMiddleware, clearSeasonOverride);

module.exports = router;
