const cron = require("node-cron");
const { syncTalentTrailData } = require("./talentTrailSyncService");

async function runSync() {
  const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.log(`\n⏱  [TalentTrail Sync] Starting... ${timestamp}`);
  try {
    const result = await syncTalentTrailData();
    console.log(`✅ [TalentTrail Sync] Done:`, result);
  } catch (err) {
    console.error(`❌ [TalentTrail Sync] FAILED: ${err.message}`);
  }
}

function startTalentTrailSyncJob() {
  runSync(); // Run immediately on startup

  cron.schedule("*/5 * * * *", runSync); // Then every 5 minutes

  console.log(
    "🕐 [TalentTrail Sync] Scheduled — runs every 5 minutes (initial run triggered on startup)",
  );
}

module.exports = { startTalentTrailSyncJob };
