const crypto = require("crypto");
const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");

const ARCHIVE_SUFFIX = ".archive.gz";
const METADATA_SUFFIX = ".metadata.json";

const isEnabled = (value) => String(value || "").trim().toLowerCase() === "true";

function databaseNameFromUri(uri) {
  if (!uri) return "";
  const withoutScheme = String(uri).replace(/^mongodb(?:\+srv)?:\/\//, "");
  const authorityAndPath = withoutScheme.includes("@")
    ? withoutScheme.slice(withoutScheme.lastIndexOf("@") + 1)
    : withoutScheme;
  const slashIndex = authorityAndPath.indexOf("/");
  if (slashIndex < 0) return "";
  return decodeURIComponent(
    authorityAndPath.slice(slashIndex + 1).split("?")[0].trim(),
  );
}

function mongoHostFromUri(uri) {
  if (!uri) return "";
  const withoutScheme = String(uri).replace(/^mongodb(?:\+srv)?:\/\//, "");
  const authorityAndPath = withoutScheme.includes("@")
    ? withoutScheme.slice(withoutScheme.lastIndexOf("@") + 1)
    : withoutScheme;
  return authorityAndPath.split("/")[0].split("?")[0].toLowerCase();
}

function assertDatabaseName(name, label = "database") {
  if (!name || !/^[A-Za-z0-9_-]+$/.test(name)) {
    throw new Error(
      `${label} must contain only letters, numbers, underscores, or hyphens.`,
    );
  }
  return name;
}

function assertFilePrefix(prefix) {
  if (!prefix || !/^[A-Za-z0-9_-]{3,64}$/.test(prefix)) {
    throw new Error(
      "MONGO_BACKUP_FILE_PREFIX must be 3-64 letters, numbers, underscores, or hyphens.",
    );
  }
  return prefix;
}

function formatTimestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function resolveTool(toolName, env = process.env) {
  const toolsDir = String(env.MONGO_DATABASE_TOOLS_DIR || "").trim();
  return toolsDir ? path.join(toolsDir, toolName) : toolName;
}

function resolveBackupConfig(env = process.env, backendDir = path.join(__dirname, "..")) {
  const sourceUri = String(env.MONGO_BACKUP_SOURCE_URI || env.MONGO_URI || "").trim();
  if (!sourceUri) {
    throw new Error("MONGO_BACKUP_SOURCE_URI or MONGO_URI is required.");
  }

  const sourceDatabase = assertDatabaseName(
    String(env.MONGO_BACKUP_SOURCE_DB || databaseNameFromUri(sourceUri)).trim(),
    "Source database",
  );
  const targetUri = String(env.MONGO_BACKUP_TARGET_URI || "").trim();
  const targetDatabasePrefix = assertDatabaseName(
    String(env.MONGO_BACKUP_TARGET_DB_PREFIX || "talenthub_backup").trim(),
    "Target database prefix",
  );
  const filePrefix = assertFilePrefix(
    String(env.MONGO_BACKUP_FILE_PREFIX || "talenthub_full").trim(),
  );
  const backupDir = path.resolve(
    backendDir,
    String(env.MONGO_BACKUP_DIR || "backups").trim(),
  );
  const retentionDays = Number.parseInt(env.MONGO_BACKUP_RETENTION_DAYS || "30", 10);
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
    throw new Error("MONGO_BACKUP_RETENTION_DAYS must be between 1 and 3650.");
  }
  const retentionCount = Number.parseInt(env.MONGO_BACKUP_RETENTION_COUNT || "5", 10);
  if (!Number.isInteger(retentionCount) || retentionCount < 1 || retentionCount > 365) {
    throw new Error("MONGO_BACKUP_RETENTION_COUNT must be between 1 and 365.");
  }
  const parallelCollections = Number.parseInt(env.MONGO_BACKUP_PARALLEL_COLLECTIONS || "1", 10);
  if (!Number.isInteger(parallelCollections) || parallelCollections < 1 || parallelCollections > 8) {
    throw new Error("MONGO_BACKUP_PARALLEL_COLLECTIONS must be between 1 and 8.");
  }
  const remoteRetryCount = Number.parseInt(env.MONGO_BACKUP_REMOTE_RETRY_COUNT || "3", 10);
  if (!Number.isInteger(remoteRetryCount) || remoteRetryCount < 1 || remoteRetryCount > 5) {
    throw new Error("MONGO_BACKUP_REMOTE_RETRY_COUNT must be between 1 and 5.");
  }
  const sourceRetryCount = Number.parseInt(env.MONGO_BACKUP_SOURCE_RETRY_COUNT || "3", 10);
  if (!Number.isInteger(sourceRetryCount) || sourceRetryCount < 1 || sourceRetryCount > 5) {
    throw new Error("MONGO_BACKUP_SOURCE_RETRY_COUNT must be between 1 and 5.");
  }

  if (
    targetUri &&
    mongoHostFromUri(sourceUri) === mongoHostFromUri(targetUri) &&
    !isEnabled(env.MONGO_BACKUP_ALLOW_SAME_CLUSTER)
  ) {
    throw new Error(
      "The backup target resolves to the production cluster. Use a separate cluster, or explicitly set MONGO_BACKUP_ALLOW_SAME_CLUSTER=true.",
    );
  }

  return {
    sourceUri,
    sourceDatabase,
    targetUri,
    targetDatabasePrefix,
    filePrefix,
    backupDir,
    retentionDays,
    retentionCount,
    parallelCollections,
    remoteRetryCount,
    sourceRetryCount,
    mongodump: resolveTool("mongodump", env),
    mongorestore: resolveTool("mongorestore", env),
  };
}

function managedSnapshotRegex(prefix) {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}_\\d{8}_\\d{6}$`);
}

function isManagedSnapshotDatabase(name, prefix) {
  return managedSnapshotRegex(prefix).test(String(name || ""));
}

function redactMongoUris(value) {
  return String(value || "").replace(
    /mongodb(?:\+srv)?:\/\/[^\s"']+/gi,
    "[MongoDB URI redacted]",
  );
}

function runTool(command, args, { captureOutput = false, redactOutput = false } = {}) {
  return new Promise((resolve, reject) => {
    const pipeOutput = captureOutput || redactOutput;
    const child = spawn(command, args, {
      shell: false,
      stdio: pipeOutput ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    if (pipeOutput) {
      child.stdout.on("data", (chunk) => {
        const text = redactOutput ? redactMongoUris(chunk) : chunk.toString();
        if (captureOutput) stdout += text;
        if (redactOutput) process.stdout.write(text);
      });
      child.stderr.on("data", (chunk) => {
        const text = redactOutput ? redactMongoUris(chunk) : chunk.toString();
        if (captureOutput) stderr += text;
        if (redactOutput) process.stderr.write(text);
      });
    }
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) return resolve({ stdout, stderr });
      return reject(new Error(`${path.basename(command)} exited with code ${code}.`));
    });
  });
}

async function getToolVersion(command) {
  const result = await runTool(command, ["--version"], { captureOutput: true });
  return (result.stdout || result.stderr).split(/\r?\n/)[0].trim();
}

async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const input = fs.createReadStream(filePath);
    input.on("error", reject);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("end", () => resolve(hash.digest("hex")));
  });
}

function isManagedBackupFile(name, prefix) {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `^${escaped}_\\d{8}T\\d{6}Z(?:${ARCHIVE_SUFFIX.replace(/\./g, "\\.")}|${METADATA_SUFFIX.replace(/\./g, "\\.")})$`,
  ).test(name);
}

async function pruneExpiredLocalBackups({ backupDir, filePrefix, retentionDays, now = new Date() }) {
  const removed = [];
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  const entries = await fsPromises.readdir(backupDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !isManagedBackupFile(entry.name, filePrefix)) continue;
    const filePath = path.join(backupDir, entry.name);
    const stats = await fsPromises.stat(filePath);
    if (stats.mtimeMs >= cutoff) continue;
    await fsPromises.unlink(filePath);
    removed.push(entry.name);
  }
  return removed;
}

async function pruneExcessLocalBackups({ backupDir, filePrefix, retentionCount }) {
  const entries = await fsPromises.readdir(backupDir, { withFileTypes: true });
  const escaped = filePrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const archivePattern = new RegExp(`^(${escaped}_\\d{8}T\\d{6}Z)${ARCHIVE_SUFFIX.replace(/\./g, "\\.")}$`);
  const completedBases = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name.match(archivePattern)?.[1])
    .filter(Boolean)
    .sort()
    .reverse();
  const removed = [];
  for (const baseName of completedBases.slice(retentionCount)) {
    for (const suffix of [ARCHIVE_SUFFIX, METADATA_SUFFIX]) {
      const name = `${baseName}${suffix}`;
      await fsPromises.unlink(path.join(backupDir, name)).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
      removed.push(name);
    }
  }
  return removed;
}

function backupPaths(config, date = new Date()) {
  const timestamp = formatTimestamp(date);
  const baseName = `${config.filePrefix}_${timestamp}`;
  return {
    timestamp,
    archivePath: path.join(config.backupDir, `${baseName}${ARCHIVE_SUFFIX}`),
    partialArchivePath: path.join(config.backupDir, `${baseName}${ARCHIVE_SUFFIX}.partial`),
    metadataPath: path.join(config.backupDir, `${baseName}${METADATA_SUFFIX}`),
    targetDatabase: `${config.targetDatabasePrefix}_${timestamp.replace("T", "_").replace("Z", "")}`,
  };
}

module.exports = {
  ARCHIVE_SUFFIX,
  METADATA_SUFFIX,
  assertDatabaseName,
  backupPaths,
  databaseNameFromUri,
  formatTimestamp,
  getToolVersion,
  isEnabled,
  isManagedBackupFile,
  isManagedSnapshotDatabase,
  managedSnapshotRegex,
  mongoHostFromUri,
  pruneExpiredLocalBackups,
  pruneExcessLocalBackups,
  redactMongoUris,
  resolveBackupConfig,
  runTool,
  sha256File,
};
