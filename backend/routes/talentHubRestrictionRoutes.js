const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/talentHubRestrictionController");
const authMiddleware = require("../middleware/authMiddleware");

// Require authentication for admin endpoints
router.use(authMiddleware);

// List restrictions
router.get("/", ctrl.listRestrictions);

// Lift restriction (grant temporary 5-day access)
router.post("/:id/lift", ctrl.liftRestriction);

// Manually restrict intern / revoke override
router.post("/:id/restrict", ctrl.restrictIntern);

// Background / manual sync
router.post("/sync", ctrl.syncRestrictions);

module.exports = router;
