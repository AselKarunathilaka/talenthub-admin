const app = require("./app");
const connectDB = require("./config/database");
const InternService = require("./services/internService");
const WeeklyScheduler = require("./services/weeklyScheduler");

connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Auto-sync with SLT API on server startup
  console.log('🔄 Starting auto-sync with SLT API...');
  InternService.syncWithSLTAPI()
    .then(result => {
      if (result.success) {
        console.log('✅ Auto-sync completed successfully!');
        console.log(`📊 Stats: ${result.stats.added} added, ${result.stats.updated} updated, ${result.stats.skipped} skipped, ${result.stats.errors} errors`);
      } else {
        console.log('❌ Auto-sync failed:', result.message);
      }
    })
    .catch(error => {
      console.error('❌ Auto-sync error:', error.message);
    });

  // Initialize weekly work log compliance scheduler
  WeeklyScheduler.init();
});
  