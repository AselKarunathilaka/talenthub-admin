const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const fs = require("fs/promises");

const {
  assertDatabaseName,
  backupPaths,
  databaseNameFromUri,
  formatTimestamp,
  isManagedBackupFile,
  isManagedSnapshotDatabase,
  mongoHostFromUri,
  pruneExcessLocalBackups,
  redactMongoUris,
  resolveBackupConfig,
} = require("../utils/databaseBackup");

test("extracts the complete application database name without exposing credentials", () => {
  const uri = "mongodb+srv://backup-user:secret@example.mongodb.net/intern-attendance?retryWrites=true";
  assert.equal(databaseNameFromUri(uri), "intern-attendance");
  assert.equal(mongoHostFromUri(uri), "example.mongodb.net");
});

test("local retention keeps only the five newest completed backup archives", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "talenthub-backup-test-"));
  try {
    const timestamps = ["20260801T063000Z", "20260802T063000Z", "20260803T063000Z", "20260804T063000Z", "20260805T063000Z", "20260806T063000Z"];
    for (const timestamp of timestamps) {
      await fs.writeFile(path.join(directory, `talenthub_full_${timestamp}.archive.gz`), "archive");
      await fs.writeFile(path.join(directory, `talenthub_full_${timestamp}.metadata.json`), "{}");
    }
    await pruneExcessLocalBackups({
      backupDir: directory,
      filePrefix: "talenthub_full",
      retentionCount: 5,
    });
    const remaining = await fs.readdir(directory);
    assert.equal(remaining.filter((name) => name.endsWith(".archive.gz")).length, 5);
    assert.equal(remaining.some((name) => name.includes("20260801T063000Z")), false);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("rejects unsafe recovery database names", () => {
  assert.equal(assertDatabaseName("intern-attendance-recovered"), "intern-attendance-recovered");
  assert.throws(() => assertDatabaseName("intern attendance"), /must contain only/);
  assert.throws(() => assertDatabaseName("prod.*"), /must contain only/);
});

test("builds deterministic timestamped full-backup paths", () => {
  const config = {
    filePrefix: "talenthub_full",
    backupDir: "/secure/backups",
    targetDatabasePrefix: "talenthub_backup",
  };
  const result = backupPaths(config, new Date("2026-08-03T02:00:00.000Z"));
  assert.equal(formatTimestamp(new Date("2026-08-03T02:00:00.000Z")), "20260803T020000Z");
  assert.equal(result.archivePath, path.join("/secure/backups", "talenthub_full_20260803T020000Z.archive.gz"));
  assert.equal(result.targetDatabase, "talenthub_backup_20260803_020000");
});

test("retention only recognizes files created by the managed backup naming scheme", () => {
  assert.equal(isManagedBackupFile("talenthub_full_20260803T020000Z.archive.gz", "talenthub_full"), true);
  assert.equal(isManagedBackupFile("talenthub_full_20260803T020000Z.metadata.json", "talenthub_full"), true);
  assert.equal(isManagedBackupFile("unrelated.archive.gz", "talenthub_full"), false);
});

test("remote retention only recognizes timestamped managed snapshot databases", () => {
  assert.equal(isManagedSnapshotDatabase("talenthub_backup_20260804_063000", "talenthub_backup"), true);
  assert.equal(isManagedSnapshotDatabase("talenthub_backup_manual", "talenthub_backup"), false);
  assert.equal(isManagedSnapshotDatabase("production", "talenthub_backup"), false);
});

test("MongoDB connection strings are removed from command output", () => {
  const message = "failed to connect to mongodb+srv://user:secret@example.mongodb.net/admin?retryWrites=true";
  const redacted = redactMongoUris(message);
  assert.equal(redacted.includes("secret"), false);
  assert.equal(redacted.includes("mongodb+srv://"), false);
  assert.match(redacted, /URI redacted/);
});

test("requires an explicit override when source and backup use the same cluster", () => {
  const env = {
    MONGO_BACKUP_SOURCE_URI: "mongodb+srv://reader:x@cluster.mongodb.net/intern-attendance",
    MONGO_BACKUP_TARGET_URI: "mongodb+srv://writer:y@cluster.mongodb.net/admin",
  };
  assert.throws(() => resolveBackupConfig(env, "/backend"), /separate cluster/);
  const config = resolveBackupConfig({ ...env, MONGO_BACKUP_ALLOW_SAME_CLUSTER: "true" }, "/backend");
  assert.equal(config.sourceDatabase, "intern-attendance");
  assert.equal(config.retentionCount, 5);
  assert.equal(config.parallelCollections, 1);
  assert.equal(config.remoteRetryCount, 3);
  assert.equal(config.sourceRetryCount, 3);
});
