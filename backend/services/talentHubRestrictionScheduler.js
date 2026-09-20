const cron = require("node-cron");
const { syncAllRestrictions } = require("./talentHubRestrictionService");

// Run every Sunday at 10:05 AM
// "5 10 * * 0"
const talentHubRestrictionScheduler = cron.schedule("5 10 * * 0", async () => {
  console.log("[CRON] Running weekly TalentHub restriction sync (Sunday 10:05 AM)...");
  try {
    const result = await syncAllRestrictions();
    console.log("[CRON] TalentHub restriction sync completed:", result);
  } catch (error) {
    console.error("[CRON] TalentHub restriction sync failed:", error.message);
  }
});

module.exports = talentHubRestrictionScheduler;
