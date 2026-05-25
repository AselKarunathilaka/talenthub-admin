const app = require("./app");
const connectDB = require("./config/database");
const InternService = require("./services/internService");
const WeeklyScheduler = require("./services/weeklyScheduler");
const SLTApiScheduler = require("./services/sltApiScheduler");
const { initScheduler } = require("./services/shortLeaveSchedulerService");
const { startTalentTrailSyncJob } = require("./services/talentTrailSyncJob");

connectDB();

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Auto-sync with SLT API on server startup
  // WARNING: enableCleanup: true will remove interns from the DB that are not present in the API.
  // This is destructive. Set AUTO_CLEANUP_INACTIVE_INTERNS='false' in your env if you want to disable cleanup.
  console.log("🔄 Starting auto-sync with SLT API (cleanup enabled)...");
  InternService.syncWithSLTAPI({ enableCleanup: true })
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
