const mongoose = require("mongoose");
const moment = require("moment-timezone");
const DailyRecord = require("../models/DailyRecord");
const Intern = require("../models/Intern");
const InactiveIntern = require("../models/InactiveIntern");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const TZ = "Asia/Colombo";
const DAILY_ATTENDANCE_TYPES = new Set([
  "daily",
  "daily_qr",
  "face",
  "manual_daily",
  "manual",
]);

async function backfillDailyAttendance() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("❌ MONGO_URI not found");
    process.exit(1);
  }

  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    console.log("🔍 Loading all active and inactive interns with attendance...");
    const activeInterns = await Intern.find(
      {},
      { _id: 1, Trainee_ID: 1, traineeId: 1, attendance: 1 }
    ).lean();

    const inactiveInterns = await InactiveIntern.find(
      {},
      { _id: 1, Trainee_ID: 1, traineeId: 1, attendance: 1 }
    ).lean();

    const allInterns = [...activeInterns, ...inactiveInterns];
    console.log(`📋 Total interns loaded: ${allInterns.length}`);

    // Map: internId -> { traineeId, attendanceByDate: { 'YYYY-MM-DD': { type, timeMarked } } }
    const internDataMap = new Map();

    for (const intern of allInterns) {
      const idStr = intern._id.toString();
      const tid = intern.Trainee_ID || intern.traineeId || "";
      const attMap = new Map();

      if (Array.isArray(intern.attendance)) {
        for (const att of intern.attendance) {
          if (att && att.date) {
            const dateKey = moment(att.date).tz(TZ).format("YYYY-MM-DD");
            attMap.set(dateKey, {
              type: att.type || "daily",
              timeMarked: att.timeMarked || att.date,
              checkOutTime: att.checkOutTime || null,
            });
          }
        }
      }

      internDataMap.set(idStr, {
        traineeId: tid,
        attendanceByDate: attMap,
      });
    }

    console.log("🔍 Finding DailyRecords to update...");
    // Find daily records missing attendanceMarkType or attendanceTime
    const cursor = DailyRecord.find({
      $or: [
        { attendanceMarkType: { $exists: false } },
        { attendanceMarkType: null },
        { attendanceMarkType: "" },
        { attendanceTime: { $exists: false } },
        { attendanceTime: null },
      ],
    }).cursor();

    let totalProcessed = 0;
    let totalUpdated = 0;
    let bulkOps = [];
    const BATCH_SIZE = 1000;

    for await (const doc of cursor) {
      totalProcessed++;
      const internIdStr = doc.internId ? doc.internId.toString() : null;
      const internInfo = internIdStr ? internDataMap.get(internIdStr) : null;
      const dateKey = doc.date;

      const attInfo = internInfo?.attendanceByDate.get(dateKey);

      const traineeId = doc.traineeId || internInfo?.traineeId || "";
      const markType =
        doc.attendanceMarkType ||
        attInfo?.type ||
        (doc.attendance === "present" || doc.status === "working" || doc.status === "wfh"
          ? "daily"
          : "");
      const markTime =
        doc.attendanceTime ||
        attInfo?.timeMarked ||
        doc.createdAt ||
        new Date();

      const updateFields = {};
      if (!doc.traineeId && traineeId) {
        updateFields.traineeId = traineeId;
      }
      if (!doc.attendanceMarkType && markType) {
        updateFields.attendanceMarkType = markType;
        updateFields.attendanceType = markType;
      }
      if (!doc.attendanceTime && markTime) {
        updateFields.attendanceTime = markTime;
      }
      if (!doc.attendance && (doc.status === "working" || doc.status === "wfh")) {
        updateFields.attendance = "present";
      }

      if (Object.keys(updateFields).length > 0) {
        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: updateFields },
          },
        });
      }

      if (bulkOps.length >= BATCH_SIZE) {
        const res = await DailyRecord.bulkWrite(bulkOps);
        totalUpdated += res.modifiedCount;
        bulkOps = [];
        console.log(`⏳ Processed ${totalProcessed} records... (Updated: ${totalUpdated})`);
      }
    }

    if (bulkOps.length > 0) {
      const res = await DailyRecord.bulkWrite(bulkOps);
      totalUpdated += res.modifiedCount;
      bulkOps = [];
    }

    console.log("\n==========================================");
    console.log(`🎉 Daily Attendance Backfill Complete!`);
    console.log(`📊 Total records inspected: ${totalProcessed}`);
    console.log(`✅ Total records updated: ${totalUpdated}`);
    console.log("==========================================\n");

    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
  } catch (err) {
    console.error("❌ Error in backfill:", err);
    process.exit(1);
  }
}

backfillDailyAttendance();
