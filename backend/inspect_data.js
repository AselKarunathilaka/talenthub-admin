const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const DailyRecord = require("./models/DailyRecord");
const FaceAttendanceLog = require("./models/FaceAttendanceLog");
const Intern = require("./models/Intern");

async function inspectData() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/intern-attendance");

  console.log("Checking sample DailyRecord...");
  const sampleDr = await DailyRecord.findOne().lean();
  console.log("DailyRecord sample:", {
    date: sampleDr?.date,
    dateType: typeof sampleDr?.date,
    isDateInstance: sampleDr?.date instanceof Date,
    status: sampleDr?.status,
    meetingAttendance: sampleDr?.meetingAttendance
  });

  console.log("\nChecking sample FaceAttendanceLog...");
  const sampleFace = await FaceAttendanceLog.findOne().lean();
  console.log("FaceAttendanceLog sample:", {
    attendanceDate: sampleFace?.attendanceDate,
    attendanceDateType: typeof sampleFace?.attendanceDate,
    attendanceTime: sampleFace?.attendanceTime
  });

  console.log("\nChecking sample Intern...");
  const sampleIntern = await Intern.findOne({ "attendance.0": { $exists: true } }).lean();
  console.log("Intern with attendance sample:", {
    name: sampleIntern?.Trainee_Name,
    attendanceLength: sampleIntern?.attendance?.length,
    sampleAtt: sampleIntern?.attendance?.[0]
  });

  await mongoose.disconnect();
}

inspectData();
