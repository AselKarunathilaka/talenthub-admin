process.env.JWT_SECRET = "project-admin-login-test-secret";
process.env.PROJECT_ADMIN_EMAIL = "mgiri@slt.com.lk";

const assert = require("node:assert/strict");
const test = require("node:test");
const bcrypt = require("bcryptjs");
const userRepository = require("../repositories/userRepository");
const authService = require("../services/authService");

test("allows the configured project administrator to use manual login", async (t) => {
  const originalFindByEmail = userRepository.findByEmail;
  t.after(() => { userRepository.findByEmail = originalFindByEmail; });

  const user = {
    _id: "project-admin-test-id",
    name: "Project Main Supervisor",
    email: "mgiri@slt.com.lk",
    password: await bcrypt.hash("ValidProjectPassword!9", 4),
    authProvider: "google",
    role: "admin",
    permissions: ["dashboard.view", "attendance.manage"],
    isActive: true,
    save: async () => user,
  };
  userRepository.findByEmail = async (email) => email === user.email ? user : null;

  const result = await authService.login(user.email, "ValidProjectPassword!9");
  assert.ok(result.token);
  assert.equal(result.user.email, user.email);
  assert.equal(result.user.role, "admin");
  assert.deepEqual(result.user.permissions, user.permissions);
  assert.equal(user.authProvider, "developer_password");
});

test("continues to reject unconfigured manual-login email addresses", async (t) => {
  const originalFindByEmail = userRepository.findByEmail;
  t.after(() => { userRepository.findByEmail = originalFindByEmail; });
  userRepository.findByEmail = async () => null;

  const result = await authService.login("someone-else@slt.com.lk", "AnyPassword!123");
  assert.equal(result.error, "Email/password login is not enabled for this account.");
});
