const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const intern = await db.collection("interns").findOne({ Trainee_ID: "3558" });
  console.log("Intern 3558:", intern?.Trainee_Name, intern?.Trainee_Email, intern?.Trainee_ID);

  const sync = await db.collection("interntalenttrailsyncs").findOne({
    $or: [
      { email: { $regex: new RegExp(`^${intern.Trainee_Email}$`, "i") } },
      { traineeId: intern.Trainee_ID }
    ]
  });
  console.log("Sync for 3558:", sync ? { email: sync.email, traineeId: sync.traineeId, projects: sync.projects } : "null");

  // Check all collections for projects
  const allProjects = await db.collection("projects").find().toArray();
  console.log("Projects collection total:", allProjects.length);
  if (allProjects.length > 0) {
    console.log("Sample project:", allProjects[0]);
  }

  // Check attendance counts for 3558
  const dailyAttCount = await db.collection("dailyattendance").countDocuments({
    $or: [{ traineeId: "3558" }, { internId: intern._id }]
  });
  console.log("dailyattendance count for 3558:", dailyAttCount);

  const meetingAttCount = await db.collection("meetingattendance").countDocuments({
    $or: [{ traineeId: "3558" }, { internId: intern._id }]
  });
  console.log("meetingattendance count for 3558:", meetingAttCount);

  const dailyRecordsCount = await db.collection("dailyrecords").countDocuments({
    $or: [{ traineeId: "3558" }, { internId: intern._id }]
  });
  console.log("dailyrecords count for 3558:", dailyRecordsCount);

  await mongoose.disconnect();
}

check().catch(console.error);
