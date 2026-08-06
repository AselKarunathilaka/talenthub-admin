const test = require("node:test");
const assert = require("node:assert/strict");
const { requireSuperAdmin } = require("../middleware/adminAuth");
const {
  parseBackupProgress,
  snapshotCreatedAt,
} = require("../services/databaseBackupManager");

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

test("backup progress markers expose only a bounded percentage and phase", () => {
  assert.deepEqual(
    parseBackupProgress("log line\nBACKUP_PROGRESS=55|Copying snapshot to the backup cluster\n"),
    { progress: 55, phase: "Copying snapshot to the backup cluster" },
  );
  assert.deepEqual(
    parseBackupProgress("BACKUP_PROGRESS=120|Finishing"),
    { progress: 100, phase: "Finishing" },
  );
  assert.equal(parseBackupProgress("ordinary backup output"), null);
});
