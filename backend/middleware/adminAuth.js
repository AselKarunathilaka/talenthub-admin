const User = require("../models/User");
const { permissionsForUser } = require("../config/adminPermissions");

const requireAdmin = async (req, res, next) => {
  try {
    if (req.user?.accountType !== "admin") {
      return res.status(403).json({ message: "Admin access required.", code: "ADMIN_REQUIRED" });
    }
    const user = await User.findById(req.user.id);
    if (!user || !user.isActive) {
      return res.status(403).json({ message: "Admin account is inactive or unavailable.", code: "ACCOUNT_INACTIVE" });
    }
    req.admin = user;
    req.user.role = user.role;
    req.user.permissions = permissionsForUser(user);
    next();
  } catch (error) {
    next(error);
  }
};

const requirePermission = (permission) => (req, res, next) => {
  if (req.user?.role === "super_admin" || req.user?.permissions?.includes(permission)) return next();
  return res.status(403).json({ message: `Permission required: ${permission}`, code: "FORBIDDEN" });
};

const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role === "super_admin") return next();
  return res.status(403).json({ message: "Super-admin access required.", code: "SUPER_ADMIN_REQUIRED" });
};

const routePermission = (req) => {
  const path = req.path;
  if (path.startsWith("/users")) return "users.manage";
  if (path.startsWith("/dashboard")) return "dashboard.view";
  if (path.startsWith("/daily-records") || path.includes("non-submission")) return "daily_logs.view";
  if (path.startsWith("/announcements")) return "announcements.manage";
  if (path.startsWith("/attendance") || path.startsWith("/face-attendance") || path.startsWith("/manual-attendance")) {
    return req.method === "GET" ? "attendance.view" : "attendance.manage";
  }
  if (path.includes("issue-certificate") || path.startsWith("/sync/") || path.startsWith("/trigger/")) return "interns.manage";
  if (path.startsWith("/intern") || path.includes("district") || path.includes("location") || path.startsWith("/past-intern")) return "interns.view";
  return "dashboard.view";
};

const enforceRoutePermission = (req, res, next) => requirePermission(routePermission(req))(req, res, next);

module.exports = { requireAdmin, requirePermission, requireSuperAdmin, enforceRoutePermission };
