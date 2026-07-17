const ALL_PERMISSIONS = [
  "dashboard.view", "interns.view", "interns.manage", "daily_logs.view",
  "attendance.view", "attendance.manage", "leave.view", "leave.manage",
  "announcements.manage", "seats.manage", "settings.manage", "users.manage",
];

const ROLE_PERMISSIONS = {
  super_admin: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter((permission) => permission !== "users.manage"),
  supervisor: [
    "dashboard.view", "interns.view", "daily_logs.view", "attendance.view",
    "leave.view", "leave.manage",
  ],
};

const permissionsForRole = (role) => [...(ROLE_PERMISSIONS[role] || [])];

module.exports = { ALL_PERMISSIONS, ROLE_PERMISSIONS, permissionsForRole };
