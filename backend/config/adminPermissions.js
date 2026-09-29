const ADMIN_PERMISSIONS = [
  "dashboard.view", "interns.view", "interns.manage", "daily_logs.view",
  "attendance.view", "attendance.manage", "leave.view", "leave.manage",
  "announcements.manage", "seats.manage",
];

const ALL_PERMISSIONS = [
  ...ADMIN_PERMISSIONS,
  "settings.manage", "users.manage",
];

const ROLE_PERMISSIONS = {
  super_admin: ALL_PERMISSIONS,
  super_admin_plus: ALL_PERMISSIONS,
  PM: ALL_PERMISSIONS,
  pm: ALL_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
  developer: ADMIN_PERMISSIONS,
  BA: ADMIN_PERMISSIONS,
  ba: ADMIN_PERMISSIONS,
  QA: ADMIN_PERMISSIONS,
  qa: ADMIN_PERMISSIONS,
  supervisor: [
    "dashboard.view", "interns.view", "daily_logs.view", "attendance.view",
    "leave.view",
  ],
};

const permissionsForRole = (role) => {
  if (!role || typeof role !== "string") return [];
  const normalized = role.trim();
  const direct = ROLE_PERMISSIONS[normalized] || ROLE_PERMISSIONS[normalized.toLowerCase()] || ROLE_PERMISSIONS[normalized.toUpperCase()];
  return direct ? [...direct] : [];
};

const permissionsForUser = (user, permissions) => {
  const role = user?.role;
  const roleDefaults = permissionsForRole(role);
  let resolved = Array.isArray(permissions) && permissions.length > 0
    ? [...permissions]
    : user?.permissions?.length
      ? [...user.permissions]
      : roleDefaults;

  // Ensure default role permissions are used if resolved array is empty
  if ((!resolved || resolved.length === 0) && roleDefaults.length > 0) {
    resolved = [...roleDefaults];
  }

  // Ensure dashboard.view is always present for active staff with dashboard access
  if (roleDefaults.includes("dashboard.view") && !resolved.includes("dashboard.view")) {
    resolved.push("dashboard.view");
  }

  // If user has "Settings" in visiblePages, grant settings.manage and users.manage
  const hasSettingsAccess = Array.isArray(user?.visiblePages) && user.visiblePages.includes("Settings");
  if (hasSettingsAccess) {
    if (!resolved.includes("settings.manage")) resolved.push("settings.manage");
    if (!resolved.includes("users.manage")) resolved.push("users.manage");
  }

  if (role && role.toLowerCase() === "supervisor") {
    resolved = resolved.filter((permission) => !["users.manage", "leave.manage"].includes(permission));
  }
  return [...new Set(resolved)];
};

module.exports = {
  ADMIN_PERMISSIONS,
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  permissionsForRole,
  permissionsForUser,
};
