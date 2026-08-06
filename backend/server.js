// Compatibility shim for Node >=25: define SlowBuffer and Buffer.equal
// so older modules (e.g. buffer-equal-constant-time) don't crash.
const _bufferShim = require('buffer');
if (!_bufferShim.SlowBuffer) _bufferShim.SlowBuffer = Buffer;
if (!Buffer.prototype.equal && Buffer.prototype.equals) Buffer.prototype.equal = Buffer.prototype.equals;

const app = require("./app");
const connectDB = require("./config/database");
const InternService = require("./services/internService");
const WeeklyScheduler = require("./services/weeklyScheduler");
const SLTApiScheduler = require("./services/sltApiScheduler");
const { initScheduler } = require("./services/shortLeaveSchedulerService");
const { startTalentTrailSyncJob } = require("./services/talentTrailSyncJob");
const { initSeatBookingScheduler } = require("./services/seatBookingSchedulerService");
const { initDatabaseBackupScheduler } = require("./services/databaseBackupScheduler");

connectDB();

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Auto-sync with SLT API on server startup. Destructive cleanup is disabled
  // unless an operator explicitly enables it in the server environment.
  const enableStartupCleanup = process.env.AUTO_CLEANUP_INACTIVE_INTERNS === "true";
  console.log(
    `🔄 Starting auto-sync with SLT API (cleanup ${enableStartupCleanup ? "enabled" : "disabled"})...`,
  );
  InternService.syncWithSLTAPI({ enableCleanup: enableStartupCleanup })
    .then((result) => {
      if (result.success) {
        console.log("✅ Auto-sync completed successfully!");
        console.log(
          `📊 Stats: ${result.stats.added} added, ${result.stats.updated} updated, ${result.stats.skipped} skipped, ${result.stats.errors} errors`,
        );
      } else {
        console.log("❌ Auto-sync failed:", result.message);
      }
    })
    .catch((error) => {
      console.error("❌ Auto-sync error:", error.message);
    });

  // Initialize weekly work log compliance scheduler
  WeeklyScheduler.init();

  // Initialize SLT API synchronization scheduler
  SLTApiScheduler.init();

  // Initialize daily 4 PM approved leave report scheduler
  initScheduler();

  // Initialize daily 4:30 PM seat booking expiration scheduler
  initSeatBookingScheduler();

  // Initialize daily 12:00 PM full database backup to the separate cluster
  initDatabaseBackupScheduler();

  // Initialize TalentTrail sync job (runs immediately, then every 5 minutes)
  console.log("⏳ Starting TalentTrail sync job...");
  try {
    startTalentTrailSyncJob();
    console.log("✅ TalentTrail sync job registered");
  } catch (err) {
    console.error("❌ TalentTrail sync job failed to start:", err.message);
  }
});

// Set server timeout to handle longer requests (5 minutes)
server.timeout = 300000;
