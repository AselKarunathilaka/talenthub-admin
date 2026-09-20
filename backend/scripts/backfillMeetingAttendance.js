/**
 * backfillMeetingAttendance.js
 *
 * Backfills the new `meetingattendance` collection with historical meeting
 * attendance data from each intern's `attendance` array.
 *
 * Meeting types: qr, face_meeting, meeting, manual_meeting
 */
const mongoose = require("mongoose");
const moment = require("moment-timezone");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const MEETING_TYPES = new Set(["qr", "face_meeting", "meeting", "manual_meeting"]);
const TZ = "Asia/Colombo";

function resolveMarkType(type) {
  const t = String(type || "").toLowerCase().trim();
  if (MEETING_TYPES.has(t)) return t;
  return "meeting";
}

function resolveSource(type) {
  const t = String(type || "").toLowerCase().trim();
  if (t === "qr") return "qr";
  if (t === "face_meeting") return "face";
  if (t === "manual_meeting") return "manual";
  return "system";
}

async function run() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("❌ MONGO_URI not found");
    process.exit(1);
  }

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  });
  console.log("✅ Connected to MongoDB");

  const db = mongoose.connection.db;
  const internsCol = db.collection("interns");
  const logsCol = db.collection("meetingattendance");

  console.log("🔍 Loading existing meeting logs to avoid duplicates...");
  const existingCursor = logsCol.find({}, { projection: { internId: 1, attendanceTime: 1, projectName: 1 } });
  const existingSet = new Set();
  await existingCursor.forEach((doc) => {
    if (doc.attendanceTime) {
      existingSet.add(`${doc.internId}_${doc.attendanceTime.getTime()}_${doc.projectName || ""}`);
    }
  });
  console.log(`   Found ${existingSet.size} already-imported entries`);

  const interns = await internsCol
    .find(
      {},
      {
        projection: {
          _id: 1,
          Trainee_ID: 1,
          traineeId: 1,
          Trainee_Name: 1,
          attendance: 1,
        },
      },
    )
    .toArray();

  console.log(`📊 Processing ${interns.length} interns...`);

  let totalInserted = 0;
  let totalSkipped = 0;
  let batch = [];
  const BATCH_SIZE = 200;

  async function flushBatch() {
    if (batch.length === 0) return;
    try {
      await logsCol.insertMany(batch, { ordered: false });
      totalInserted += batch.length;
    } catch (err) {
      if (err.code === 11000 || err.writeErrors) {
        totalInserted += err.result?.nInserted || (batch.length - (err.writeErrors?.length || 0));
      } else {
        console.error("Insert error:", err.message);
      }
    }
    batch = [];
  }

  for (const intern of interns) {
    const meetingEntries = (intern.attendance || []).filter((a) =>
      MEETING_TYPES.has(String(a.type || "").toLowerCase().trim()),
    );

    for (const entry of meetingEntries) {
      const attendanceTime = entry.timeMarked ? new Date(entry.timeMarked) : new Date(entry.date);
      if (isNaN(attendanceTime.getTime())) continue;

      const projectName = entry.projectName || entry.meetingName || "";
      const dedupKey = `${intern._id}_${attendanceTime.getTime()}_${projectName}`;
      if (existingSet.has(dedupKey)) {
        totalSkipped++;
        continue;
      }
      existingSet.add(dedupKey);

      const date = moment(attendanceTime).tz(TZ).format("YYYY-MM-DD");
      const markType = resolveMarkType(entry.type);
      const source = resolveSource(entry.type);

      batch.push({
        internId: intern._id,
        traineeId: intern.Trainee_ID || intern.traineeId || "",
        traineeName: intern.Trainee_Name || "",
        date,
        attendanceTime,
        markType,
        projectName,
        meetingTitle: entry.meetingName || projectName,
        projectKey: entry.projectKey || projectName.toLowerCase().replace(/\s+/g, "_"),
        status: String(entry.status || "Present").toLowerCase() === "present" ? "present" : "absent",
        sessionId: entry.qrCode || entry.meetingSessionId || null,
        source,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      if (batch.length >= BATCH_SIZE) {
        await flushBatch();
      }
    }
  }

  await flushBatch();

  console.log(`\n🎉 Meeting Attendance Backfill completed!`);
  console.log(`   Newly inserted : ${totalInserted}`);
  console.log(`   Skipped/Exists : ${totalSkipped}`);

  const finalCount = await logsCol.countDocuments();
  console.log(`   Total in meetingattendance: ${finalCount}`);

  await mongoose.disconnect();
  console.log("👋 Disconnected");
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
