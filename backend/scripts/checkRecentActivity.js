const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

async function checkRecent() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const now = new Date();
  const thirtyMinsAgo = new Date(now.getTime() - 45 * 60 * 1000);
  console.log("Looking for changes since:", thirtyMinsAgo.toISOString());

  const interns = await mongoose.connection.db.collection("interns").find({
    "attendance.timeMarked": { $gte: thirtyMinsAgo }
  }).toArray();
  console.log("Interns with recent attendance marked:", interns.length);
  interns.forEach(i => {
    const recent = (i.attendance || []).filter(a => new Date(a.timeMarked || a.date) >= thirtyMinsAgo);
    console.log("Intern:", i.Trainee_ID, i.Trainee_Name, "Recent entries:", JSON.stringify(recent, null, 2));
  });

  const dailyRecords = await mongoose.connection.db.collection("dailyrecords").find({
    updatedAt: { $gte: thirtyMinsAgo }
  }).toArray();
  console.log("DailyRecords modified recently:", dailyRecords.length);
  dailyRecords.forEach(r => {
    console.log("DailyRecord:", r.traineeId, r.date, "attendance:", r.attendance, "attendanceTime:", r.attendanceTime, "updatedAt:", r.updatedAt);
  });

  const dailyAttendance = await mongoose.connection.db.collection("dailyattendance").find({
    $or: [
      { createdAt: { $gte: thirtyMinsAgo } },
      { attendanceTime: { $gte: thirtyMinsAgo } }
    ]
  }).toArray();
  console.log("DailyAttendance docs in new collection recently:", dailyAttendance.length);
  dailyAttendance.forEach(d => {
    console.log("DailyAttendance doc:", JSON.stringify(d, null, 2));
  });

  await mongoose.disconnect();
}

checkRecent().catch(console.error);
