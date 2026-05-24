const cron = require("node-cron");
const { syncTalentTrailData } = require("./talentTrailSyncService");

function startTalentTrailSyncJob() {
  cron.schedule("*/30 * * * *", async () => {
    const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
    console.log(`\n⏱  [TalentTrail Sync] Starting... ${timestamp}`);
    try {
      const result = await syncTalentTrailData();
      console.log(`✅ [TalentTrail Sync] Done:`, result);
    } catch (err) {
      console.error(`❌ [TalentTrail Sync] FAILED: ${err.message}`);
    }
  });

  console.log("🕐 [TalentTrail Sync] Scheduled — runs every 30 minutes");
}

module.exports = { startTalentTrailSyncJob };
