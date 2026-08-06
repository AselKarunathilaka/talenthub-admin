const cron = require("node-cron");
const DatabaseBackupManager = require("./databaseBackupManager");

let task = null;

function initDatabaseBackupScheduler() {
  if (task) return task;
  const configuration = DatabaseBackupManager.configurationStatus();
  if (!configuration.schedulerEnabled) {
    console.log("Database backup scheduler is disabled by configuration.");
    return null;
  }
  if (!configuration.ready) {
    console.warn(`Database backup scheduler not started: ${configuration.message}`);
    return null;
  }

  task = cron.schedule(
    "0 12 * * *",
    () => {
      try {
        DatabaseBackupManager.startBackup("scheduled:Asia/Colombo");
        console.log("Daily full database backup started at 12:00 PM Asia/Colombo.");
      } catch (error) {
        console.error(`Daily database backup could not start: ${error.message}`);
      }
    },
    { scheduled: true, timezone: "Asia/Colombo" },
  );
  console.log("Database backup scheduler registered for 12:00 PM daily (Asia/Colombo).");
  return task;
}

module.exports = { initDatabaseBackupScheduler };
