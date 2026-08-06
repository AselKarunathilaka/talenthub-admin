const test = require("node:test");
const assert = require("node:assert/strict");
const { requireSuperAdmin } = require("../middleware/adminAuth");
const { snapshotCreatedAt } = require("../services/databaseBackupManager");

test("backup administration only permits the persisted super-admin role", () => {
  let nextCalled = false;
  requireSuperAdmin({ user: { role: "super_admin" } }, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true);

  let response;
  const res = {
    status(code) { response = { code }; return this; },
    json(body) { response.body = body; return this; },
  };
  requireSuperAdmin({ user: { role: "admin" } }, res, () => {});
  assert.equal(response.code, 403);
  assert.equal(response.body.code, "SUPER_ADMIN_REQUIRED");
});

test("snapshot timestamps are parsed as UTC for Colombo display conversion", () => {
  assert.equal(
    snapshotCreatedAt("talenthub_backup_20260804_063000", "talenthub_backup"),
    "2026-08-04T06:30:00.000Z",
  );
});
