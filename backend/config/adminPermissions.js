const ALL_PERMISSIONS = [
  "dashboard.view", "interns.view", "interns.manage", "daily_logs.view",
  "attendance.view", "attendance.manage", "leave.view", "leave.manage",
  "announcements.manage", "seats.manage", "settings.manage", "users.manage",
];

const ROLE_PERMISSIONS = {
  super_admin: ALL_PERMISSIONS,
  // Operational admins may invite and manage Google staff accounts. Controller
  // safeguards still prevent them from editing super-admin accounts or self-access.
  admin: ALL_PERMISSIONS,
  supervisor: [
    "dashboard.view", "interns.view", "daily_logs.view", "attendance.view",
    "leave.view",
  ],
};

const permissionsForRole = (role) => [...(ROLE_PERMISSIONS[role] || [])];

const permissionsForUser = (user, permissions) => {
  let resolved = Array.isArray(permissions)
    ? [...permissions]
    : user?.permissions?.length
      ? [...user.permissions]
      : permissionsForRole(user?.role);

  if (user?.role === "supervisor") {
    resolved = resolved.filter((permission) => !["users.manage", "leave.manage"].includes(permission));
  }
  return [...new Set(resolved)];
};

module.exports = {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  permissionsForRole,
  permissionsForUser,
};
