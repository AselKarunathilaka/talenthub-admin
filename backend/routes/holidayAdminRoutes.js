const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const { requireAdmin, requirePermission } = require("../middleware/adminAuth");
const ctrl = require("../controllers/holidayAdminController");

// Holidays decide working days, which decide logbook restrictions — treat them
// as a settings-level privilege, same as the restriction screen itself.
router.use(authMiddleware, requireAdmin, requirePermission("settings.manage"));

router.get("/overview", ctrl.getOverview);
router.get("/:year", ctrl.getYear);

router.post("/", ctrl.createHoliday);
router.put("/:id", ctrl.updateHoliday);
router.delete("/:id", ctrl.deleteHoliday);

router.post("/:year/sync", ctrl.syncYear);
router.post("/:year/verify", ctrl.verifyYear);
router.delete("/:year/verify", ctrl.unverifyYear);

module.exports = router;
