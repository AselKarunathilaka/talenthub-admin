const { spawn } = require("child_process");
const path = require("path");
const { MongoClient } = require("mongoose").mongo;
const {
  isManagedSnapshotDatabase,
  mongoHostFromUri,
  resolveBackupConfig,
} = require("../utils/databaseBackup");

const backendDir = path.join(__dirname, "..");
let activeChild = null;
let operation = {
  type: null,
  status: "idle",
  startedAt: null,
  completedAt: null,
  requestedBy: null,
  error: null,
  warning: null,
};

class OperationBusyError extends Error {
  constructor() {
    super("A database backup operation is already running.");
    this.statusCode = 409;
  }
}

function publicOperation() {
  return { ...operation };
}

function configurationStatus() {
  try {
    const config = resolveBackupConfig();
    return {
      ready: Boolean(config.targetUri),
      sourceDatabase: config.sourceDatabase,
      sourceHost: mongoHostFromUri(config.sourceUri),
      targetHost: config.targetUri ? mongoHostFromUri(config.targetUri) : null,
      targetDatabasePrefix: config.targetDatabasePrefix,
      retentionCount: config.retentionCount,
      schedule: "Every day at 12:00 PM",
      timezone: "Asia/Colombo",
      schedulerEnabled: process.env.MONGO_BACKUP_SCHEDULER_ENABLED !== "false",
      message: config.targetUri
        ? "Separate backup database is configured."
        : "MONGO_BACKUP_TARGET_URI is not configured.",
    };
  } catch (error) {
    return {
      ready: false,
      retentionCount: 5,
      schedule: "Every day at 12:00 PM",
      timezone: "Asia/Colombo",
      schedulerEnabled: process.env.MONGO_BACKUP_SCHEDULER_ENABLED !== "false",
      message: error.message,
    };
  }
}

function snapshotCreatedAt(name, prefix) {
  const value = name.slice(prefix.length + 1);
  const match = value.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).toISOString();
}

async function listSnapshots() {
  const config = resolveBackupConfig();
  if (!config.targetUri) return [];
  const client = new MongoClient(config.targetUri);
  try {
    await client.connect();
    const result = await client.db("admin").admin().listDatabases();
    return result.databases
      .filter(({ name }) => isManagedSnapshotDatabase(name, config.targetDatabasePrefix))
      .sort((a, b) => b.name.localeCompare(a.name))
      .map(({ name, sizeOnDisk, empty }) => ({
        database: name,
        createdAt: snapshotCreatedAt(name, config.targetDatabasePrefix),
        sizeBytes: sizeOnDisk || 0,
        empty: Boolean(empty),
      }));
  } finally {
    await client.close();
  }
}

function runManagedProcess(type, scriptName, args, requestedBy) {
  if (activeChild) throw new OperationBusyError();
  operation = {
    type,
    status: "running",
    startedAt: new Date().toISOString(),
    completedAt: null,
    requestedBy: requestedBy || "system",
    error: null,
    warning: null,
  };

  const child = spawn(process.execPath, [path.join(backendDir, "scripts", scriptName), ...args], {
    cwd: backendDir,
    env: process.env,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  activeChild = child;
  let output = "";
  const capture = (chunk) => {
    const text = chunk.toString().replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, "[MongoDB URI redacted]");
    output = `${output}${text}`.slice(-12000);
    text.trim().split(/\r?\n/).filter(Boolean).forEach((line) => console.log(`[Database ${type}] ${line}`));
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  child.on("error", (error) => {
    operation.error = error.message;
  });
  child.on("close", (code) => {
    const warning = output.match(/RETENTION_WARNING=(.+)/)?.[1]?.trim() || null;
    operation = {
      ...operation,
      status: code === 0 ? "success" : "failed",
      completedAt: new Date().toISOString(),
      error: code === 0 ? null : (operation.error || output.trim().split(/\r?\n/).at(-1) || `Process exited with code ${code}.`),
      warning,
    };
    activeChild = null;
  });
  return publicOperation();
}

function startBackup(requestedBy = "system") {
  const config = resolveBackupConfig();
  if (!config.targetUri) {
    const error = new Error("Configure MONGO_BACKUP_TARGET_URI before running managed backups.");
    error.statusCode = 503;
    throw error;
  }
  return runManagedProcess("backup", "backupDatabase.js", [], requestedBy);
}

async function getStatus() {
  const configuration = configurationStatus();
  let snapshots = [];
  let snapshotError = null;
  if (configuration.ready) {
    try {
      snapshots = await listSnapshots();
    } catch (error) {
      snapshotError = "Backup storage could not be reached.";
    }
  }
  return { configuration, operation: publicOperation(), snapshots, snapshotError };
}

module.exports = {
  OperationBusyError,
  configurationStatus,
  getStatus,
  listSnapshots,
  publicOperation,
  snapshotCreatedAt,
  startBackup,
};
