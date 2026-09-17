const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/adminSettingsController");
const { requireAdmin, enforceRoutePermission } = require("../middleware/adminAuth");

// Apply basic admin authentication to all routes here
router.use(requireAdmin);

// Settings routes require 'settings.manage' or 'users.manage' depending on the exact route,
// but since both fall under /settings in the current setup, we use enforceRoutePermission.
// If you want finer granularity, enforceRoutePermission handles this via routePermission().

// ─── Security Settings ───
router.put("/security-password", enforceRoutePermission, settingsController.changeSecurityPassword);

// ─── User Management (Requires super_admin or 'users.manage' permission) ───
// We map these manually if needed, or rely on enforceRoutePermission if we adjust the mapping.
// Since all are under /settings, routePermission in adminAuth currently maps /settings to 'settings.manage'.
// To restrict user management correctly, we use enforceRoutePermission mapped to 'users.manage' explicitly here,
// or we modify routePermission to check /settings/users. 
// Let's use custom middleware to ensure 'users.manage' is enforced strictly for these routes.
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
