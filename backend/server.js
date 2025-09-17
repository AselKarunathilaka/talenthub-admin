const app = require("./app");
const connectDB = require("./config/database");
const InternService = require("./services/internService");

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
});

// const internData = {
//     traineeId: "12345",
//     traineeName: "Nawamina",
//     fieldOfSpecialization: "MERN"
//   };
  
//   fetch("https://internattendancebe.azurewebsites.net/api/interns/add-external", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json"
//     },
//     body: JSON.stringify(internData)
//   })
//   .then(response => response.json())
//   .then(data => console.log("Success:", data))
//   .catch(error => console.error("Error:", error));
  