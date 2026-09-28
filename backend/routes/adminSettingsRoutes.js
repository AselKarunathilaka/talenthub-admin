const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/adminSettingsController");
const authMiddleware = require("../middleware/authMiddleware");
const { requireAdmin, enforceRoutePermission } = require("../middleware/adminAuth");

// Apply JWT auth first (populates req.user), then verify admin account
router.use(authMiddleware);
router.use(requireAdmin);

// Settings routes require 'settings.manage' or 'users.manage' depending on the exact route,
// but since both fall under /settings in the current setup, we use enforceRoutePermission.
// If you want finer granularity, enforceRoutePermission handles this via routePermission().

// ─── Security Settings ───
router.put("/security-password", enforceRoutePermission, settingsController.changeSecurityPassword);
router.get("/security-passwords", enforceRoutePermission, settingsController.getAllSecurityPasswords);
router.post("/security-passwords", enforceRoutePermission, settingsController.addSecurityPassword);
router.put("/security-passwords/:id", enforceRoutePermission, settingsController.updateSecurityPassword);
router.delete("/security-passwords/:id", enforceRoutePermission, settingsController.removeSecurityPassword);

// ─── User Management (Requires super_admin or 'users.manage' permission) ───
const { requirePermission } = require("../middleware/adminAuth");
const requireUserManage = requirePermission("users.manage");

router.get("/users", requireUserManage, settingsController.getAllUsers);
router.post("/users", requireUserManage, settingsController.createUser);
router.put("/users/:id", requireUserManage, settingsController.updateUser);
router.delete("/users/:id", requireUserManage, settingsController.deleteUser);

// ─── WhatsApp Integration ───
router.get("/whatsapp-status", enforceRoutePermission, settingsController.getWhatsAppStatus);
router.post("/whatsapp-disconnect", enforceRoutePermission, settingsController.disconnectWhatsApp);
router.post("/whatsapp-link", enforceRoutePermission, settingsController.linkWhatsApp);

// ─── Toggles ───
router.get("/toggles", enforceRoutePermission, settingsController.getSettingsToggles);
router.put("/toggles", enforceRoutePermission, settingsController.updateSettingsToggles);

// ─── Security Alerts ───
router.get("/security-alerts", enforceRoutePermission, settingsController.getAllSecurityAlerts);
router.post("/security-alerts", enforceRoutePermission, settingsController.createSecurityAlert);
router.put("/security-alerts/:id", enforceRoutePermission, settingsController.updateSecurityAlert);
router.delete("/security-alerts/:id", enforceRoutePermission, settingsController.deleteSecurityAlert);

// ─── Specializations ───




// ─── API Keys ───
router.get("/api-keys", enforceRoutePermission, settingsController.getAllApiKeys);
router.post("/api-keys", enforceRoutePermission, settingsController.createApiKey);
router.delete("/api-keys/:id", enforceRoutePermission, settingsController.deleteApiKey);

module.exports = router;
