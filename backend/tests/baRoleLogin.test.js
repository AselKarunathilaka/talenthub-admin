process.env.JWT_SECRET = "ba-role-login-test-secret";

const assert = require("node:assert/strict");
const test = require("node:test");
const bcrypt = require("bcryptjs");
const { permissionsForRole, permissionsForUser, ADMIN_PERMISSIONS } = require("../config/adminPermissions");
const userRepository = require("../repositories/userRepository");
const authService = require("../services/authService");

test("BA and QA roles return ADMIN_PERMISSIONS including dashboard.view", () => {
  const baPerms = permissionsForRole("BA");
  assert.ok(baPerms.includes("dashboard.view"), "BA must have dashboard.view permission");
  assert.ok(baPerms.includes("interns.view"), "BA must have interns.view permission");
  assert.ok(baPerms.includes("daily_logs.view"), "BA must have daily_logs.view permission");
  assert.deepEqual(baPerms, ADMIN_PERMISSIONS);

  const qaPerms = permissionsForRole("QA");
  assert.ok(qaPerms.includes("dashboard.view"), "QA must have dashboard.view permission");
  assert.deepEqual(qaPerms, ADMIN_PERMISSIONS);

  const lowerBaPerms = permissionsForRole("ba");
  assert.ok(lowerBaPerms.includes("dashboard.view"));

  const lowerQaPerms = permissionsForRole("qa");
  assert.ok(lowerQaPerms.includes("dashboard.view"));
});

test("permissionsForUser resolves default ADMIN_PERMISSIONS when user permissions is empty or null", () => {
  const userWithEmptyPerms = { role: "BA", permissions: [] };
  const resolved = permissionsForUser(userWithEmptyPerms);
  assert.ok(resolved.includes("dashboard.view"));
  assert.ok(resolved.length > 0);

  const userWithNullPerms = { role: "QA" };
  const resolvedNull = permissionsForUser(userWithNullPerms);
  assert.ok(resolvedNull.includes("dashboard.view"));
});

test("BA user login assigns permissions and creates session without error", async (t) => {
  const originalFindByEmail = userRepository.findByEmail;
  t.after(() => { userRepository.findByEmail = originalFindByEmail; });

  const plainPassword = "TestPassword@123";
  const user = {
    _id: "ba-user-test-id",
    name: "Business Analyst User",
    email: "ba.test@example.com",
    password: await bcrypt.hash(plainPassword, 4),
    authProvider: "developer_password",
    role: "BA",
    permissions: [],
    isActive: true,
    save: async function () { return this; },
  };

  userRepository.findByEmail = async (email) => email === user.email ? user : null;

  const result = await authService.login(user.email, plainPassword);

  assert.ok(result.token, "Login must return a JWT token");
  assert.equal(result.user.role, "BA");
  assert.ok(Array.isArray(result.user.permissions), "Permissions must be an array");
  assert.ok(result.user.permissions.includes("dashboard.view"), "Permissions must contain dashboard.view to prevent 403 auto-logout");
  assert.equal(result.message, "Login successful!");
});

test("QA user login assigns permissions and creates session without error", async (t) => {
  const originalFindByEmail = userRepository.findByEmail;
  t.after(() => { userRepository.findByEmail = originalFindByEmail; });

  const plainPassword = "QAPassword@123";
  const user = {
    _id: "qa-user-test-id",
    name: "Quality Assurance User",
    email: "qa.test@example.com",
    password: await bcrypt.hash(plainPassword, 4),
    authProvider: "developer_password",
    role: "QA",
    permissions: [],
    isActive: true,
    save: async function () { return this; },
  };

  userRepository.findByEmail = async (email) => email === user.email ? user : null;

  const result = await authService.login(user.email, plainPassword);

  assert.ok(result.token, "Login must return a JWT token");
  assert.equal(result.user.role, "QA");
  assert.ok(Array.isArray(result.user.permissions), "Permissions must be an array");
  assert.ok(result.user.permissions.includes("dashboard.view"), "Permissions must contain dashboard.view to prevent 403 auto-logout");
  assert.equal(result.message, "Login successful!");
});

test("developer or staff with Settings in visiblePages receives settings.manage and users.manage", () => {
  const developerWithSettings = {
    role: "developer",
    visiblePages: ["Dashboard", "Daily Logs", "Settings"],
    permissions: [],
  };
  const resolved = permissionsForUser(developerWithSettings);
  assert.ok(resolved.includes("settings.manage"), "Must have settings.manage when Settings is in visiblePages");
  assert.ok(resolved.includes("users.manage"), "Must have users.manage when Settings is in visiblePages");
  assert.ok(resolved.includes("dashboard.view"));

  const developerWithoutSettings = {
    role: "developer",
    visiblePages: ["Dashboard", "Daily Logs"],
    permissions: [],
  };
  const resolvedWithout = permissionsForUser(developerWithoutSettings);
  assert.equal(resolvedWithout.includes("settings.manage"), false, "Must not have settings.manage when Settings is not in visiblePages");
  assert.equal(resolvedWithout.includes("users.manage"), false, "Must not have users.manage when Settings is not in visiblePages");
});
