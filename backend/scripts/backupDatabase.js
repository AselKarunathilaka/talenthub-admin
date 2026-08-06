const fs = require("fs/promises");
const path = require("path");
const { MongoClient } = require("mongoose").mongo;
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const {
  backupPaths,
  getToolVersion,
  isManagedSnapshotDatabase,
  pruneExpiredLocalBackups,
  pruneExcessLocalBackups,
  resolveBackupConfig,
  runTool,
  sha256File,
} = require("../utils/databaseBackup");

const hasFlag = (name) => process.argv.slice(2).includes(name);
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const reportProgress = (percentage, phase) => {
  console.log(`BACKUP_PROGRESS=${percentage}|${phase}`);
};

async function ensureTargetDatabaseIsEmpty(uri, databaseName) {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const collections = await client.db(databaseName).listCollections({}, { nameOnly: true }).toArray();
    if (collections.length) {
      throw new Error(`Refusing to import over non-empty backup database ${databaseName}.`);
    }
  } finally {
    await client.close();
  }
}

async function inventoryDatabase(uri, databaseName) {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const collections = await client.db(databaseName).listCollections({}, { nameOnly: true }).toArray();
    const inventory = [];
    for (const collection of collections) {
      const documentCount = await client.db(databaseName)
        .collection(collection.name)
        .estimatedDocumentCount();
      inventory.push({ name: collection.name, documentCount });
    }
    return inventory.sort((a, b) => a.name.localeCompare(b.name));
  } finally {
    await client.close();
  }
}

async function pruneExcessRemoteSnapshots(uri, prefix, retentionCount) {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const result = await client.db("admin").admin().listDatabases({ nameOnly: true });
    const managed = result.databases
      .map(({ name }) => name)
      .filter((name) => isManagedSnapshotDatabase(name, prefix))
      .sort()
      .reverse();
    const removed = [];
    for (const databaseName of managed.slice(retentionCount)) {
      await client.db(databaseName).dropDatabase();
      removed.push(databaseName);
    }
    return removed;
  } finally {
    await client.close();
  }
}

async function dropIncompleteSnapshot(uri, databaseName, prefix) {
  if (!isManagedSnapshotDatabase(databaseName, prefix)) {
    throw new Error("Refusing to remove a database outside the managed backup naming scheme.");
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    await client.db(databaseName).dropDatabase();
  } finally {
    await client.close();
  }
}

async function importSnapshotWithRetries(config, paths) {
  let lastError;
  for (let attempt = 1; attempt <= config.remoteRetryCount; attempt += 1) {
    try {
      await runTool(config.mongorestore, [
        `--uri=${config.targetUri}`,
        `--archive=${paths.archivePath}`,
        "--gzip",
        `--numParallelCollections=${config.parallelCollections}`,
        `--nsFrom=${config.sourceDatabase}.*`,
        `--nsTo=${paths.targetDatabase}.*`,
      ], { redactOutput: true });
      return attempt;
    } catch (error) {
      lastError = error;
      console.warn(`Separate backup import attempt ${attempt}/${config.remoteRetryCount} failed.`);
      try {
        await dropIncompleteSnapshot(
          config.targetUri,
          paths.targetDatabase,
          config.targetDatabasePrefix,
        );
      } catch (cleanupError) {
        throw new Error(
          `${error.message} Incomplete snapshot cleanup also failed: ${cleanupError.message}`,
        );
      }
      if (attempt < config.remoteRetryCount) await wait(attempt * 5000);
    }
  }
  throw lastError;
}

async function createSourceArchiveWithRetries(config, paths) {
  let lastError;
  for (let attempt = 1; attempt <= config.sourceRetryCount; attempt += 1) {
    await fs.rm(paths.partialArchivePath, { force: true });
    try {
      await runTool(config.mongodump, [
        `--uri=${config.sourceUri}`,
        `--db=${config.sourceDatabase}`,
        `--archive=${paths.partialArchivePath}`,
        "--gzip",
        `--numParallelCollections=${config.parallelCollections}`,
      ], { redactOutput: true });
      return attempt;
    } catch (error) {
      lastError = error;
      await fs.rm(paths.partialArchivePath, { force: true });
      console.warn(`Source database dump attempt ${attempt}/${config.sourceRetryCount} failed.`);
      if (attempt < config.sourceRetryCount) await wait(attempt * 5000);
    }
  }
  throw lastError;
}

async function main() {
  reportProgress(3, "Validating backup configuration");
  const config = resolveBackupConfig();
  const paths = backupPaths(config);
  const checkOnly = hasFlag("--check");
  const dryRun = hasFlag("--dry-run");
  const dumpVersion = await getToolVersion(config.mongodump);
  const restoreVersion = await getToolVersion(config.mongorestore);

  console.log(`Backup source database: ${config.sourceDatabase}`);
  console.log(`Backup directory: ${config.backupDir}`);
  console.log(`Separate backup cluster: ${config.targetUri ? "enabled" : "disabled"}`);
  console.log(`MongoDB tools: ${dumpVersion}; ${restoreVersion}`);

  if (checkOnly || dryRun) {
    console.log(checkOnly ? "Backup configuration check passed." : "Dry run completed; no backup was created.");
    return;
  }

  reportProgress(8, "Preparing secure backup workspace");
  await fs.mkdir(config.backupDir, { recursive: true, mode: 0o700 });
  const startedAt = new Date();
  const metadata = {
    status: "running",
    startedAt: startedAt.toISOString(),
    sourceDatabase: config.sourceDatabase,
    archiveFile: path.basename(paths.archivePath),
    tools: { mongodump: dumpVersion, mongorestore: restoreVersion },
    secondaryBackup: config.targetUri
      ? { enabled: true, database: paths.targetDatabase, status: "pending" }
      : { enabled: false },
  };

  try {
    reportProgress(15, "Exporting the live database");
    metadata.sourceDumpAttempts = await createSourceArchiveWithRetries(config, paths);

    reportProgress(45, "Securing and validating the archive");
    const partialStats = await fs.stat(paths.partialArchivePath);
    if (!partialStats.size) throw new Error("mongodump produced an empty archive.");
    await fs.rename(paths.partialArchivePath, paths.archivePath);
    await fs.chmod(paths.archivePath, 0o600);

    const stats = await fs.stat(paths.archivePath);
    metadata.sizeBytes = stats.size;
    metadata.sha256 = await sha256File(paths.archivePath);

    if (config.targetUri) {
      reportProgress(55, "Copying snapshot to the backup cluster");
      await ensureTargetDatabaseIsEmpty(config.targetUri, paths.targetDatabase);
      const importAttempts = await importSnapshotWithRetries(config, paths);
      reportProgress(82, "Verifying collections and document counts");
      const inventory = await inventoryDatabase(config.targetUri, paths.targetDatabase);
      if (!inventory.length) throw new Error("Separate backup import completed without any collections.");
      metadata.secondaryBackup = {
        enabled: true,
        database: paths.targetDatabase,
        status: "verified",
        importAttempts,
        collections: inventory,
      };
      try {
        reportProgress(92, "Applying the remote retention policy");
        metadata.secondaryBackup.removedSnapshots = await pruneExcessRemoteSnapshots(
          config.targetUri,
          config.targetDatabasePrefix,
          config.retentionCount,
        );
      } catch (retentionError) {
        metadata.secondaryBackup.retentionWarning = retentionError.message;
        console.warn(`RETENTION_WARNING=${retentionError.message}`);
      }
    }

    reportProgress(96, "Finalizing backup metadata");
    metadata.status = "success";
    metadata.completedAt = new Date().toISOString();
    metadata.durationMs = Date.now() - startedAt.getTime();
    await fs.writeFile(paths.metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 });

    const expired = await pruneExpiredLocalBackups(config);
    const excess = await pruneExcessLocalBackups(config);
    const removed = [...new Set([...expired, ...excess])];
    console.log(`Full database backup completed: ${paths.archivePath}`);
    console.log(`SHA-256: ${metadata.sha256}`);
    if (metadata.secondaryBackup.enabled) {
      console.log(`Separate backup database verified: ${paths.targetDatabase}`);
    }
    if (removed.length) console.log(`Pruned ${removed.length} expired local backup file(s).`);
    reportProgress(100, "Backup completed");
  } catch (error) {
    metadata.status = "failed";
    metadata.completedAt = new Date().toISOString();
    metadata.durationMs = Date.now() - startedAt.getTime();
    metadata.error = error.message;
    await fs.rm(paths.partialArchivePath, { force: true }).catch(() => {});
    await fs.mkdir(config.backupDir, { recursive: true, mode: 0o700 });
    await fs.writeFile(paths.metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 });
    throw error;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Database backup failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  ensureTargetDatabaseIsEmpty,
  createSourceArchiveWithRetries,
  inventoryDatabase,
  importSnapshotWithRetries,
  main,
  pruneExcessRemoteSnapshots,
};
