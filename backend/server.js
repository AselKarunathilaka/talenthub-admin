const app = require("./app");
const connectDB = require("./config/database");


connectDB();

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

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
  