const mongoose = require("mongoose");
const DailyRecord = require("../models/DailyRecord");
const Intern = require("../models/Intern");
const InactiveIntern = require("../models/InactiveIntern");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

async function backfillTraineeId() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("❌ MONGO_URI not found in environment variables");
    process.exit(1);
  }

  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    console.log("🔍 Building Intern map (Active + Inactive + Auxiliary sources)...");
    const activeInterns = await Intern.find({}, { _id: 1, Trainee_ID: 1, traineeId: 1 }).lean();
    const inactiveInterns = await InactiveIntern.find({}, { _id: 1, Trainee_ID: 1, traineeId: 1 }).lean();

    const internMap = new Map();

    for (const intern of activeInterns) {
      const tid = intern.Trainee_ID || intern.traineeId;
      if (tid) {
        internMap.set(intern._id.toString(), tid);
      }
    }

    for (const intern of inactiveInterns) {
      const tid = intern.Trainee_ID || intern.traineeId;
      if (tid && !internMap.has(intern._id.toString())) {
        internMap.set(intern._id.toString(), tid);
      }
    }

    // Pull from leaverequests
    const leaveRequests = await mongoose.connection.db.collection("leaverequests").find(
      { internTraineeId: { $exists: true, $ne: "" }, intern: { $exists: true } },
      { projection: { intern: 1, internTraineeId: 1 } }
    ).toArray();

    for (const lr of leaveRequests) {
      if (lr.intern && lr.internTraineeId && !internMap.has(lr.intern.toString())) {
        internMap.set(lr.intern.toString(), lr.internTraineeId);
      }
    }

    // Pull from faceattendancelogs
    const faceLogs = await mongoose.connection.db.collection("faceattendancelogs").find(
      { traineeId: { $exists: true, $ne: "" }, internId: { $exists: true } },
      { projection: { internId: 1, traineeId: 1 } }
    ).toArray();

    for (const fl of faceLogs) {
      if (fl.internId && fl.traineeId && !internMap.has(fl.internId.toString())) {
        internMap.set(fl.internId.toString(), fl.traineeId);
      }
    }

    // Pull from internfaceprofiles
    const faceProfiles = await mongoose.connection.db.collection("internfaceprofiles").find(
      { traineeId: { $exists: true, $ne: "" }, internId: { $exists: true } },
      { projection: { internId: 1, traineeId: 1 } }
    ).toArray();

    for (const fp of faceProfiles) {
      if (fp.internId && fp.traineeId && !internMap.has(fp.internId.toString())) {
        internMap.set(fp.internId.toString(), fp.traineeId);
      }
    }

    // Pull from seatbookings
    const seatBookings = await mongoose.connection.db.collection("seatbookings").find(
      { traineeId: { $exists: true, $ne: "" }, internId: { $exists: true } },
      { projection: { internId: 1, traineeId: 1 } }
    ).toArray();

    for (const sb of seatBookings) {
      if (sb.internId && sb.traineeId && !internMap.has(sb.internId.toString())) {
        internMap.set(sb.internId.toString(), sb.traineeId);
      }
    }

    console.log(`📋 Total unique interns mapped: ${internMap.size}`);

    // Find daily records that are missing traineeId
    const filter = {
      $or: [
        { traineeId: { $exists: false } },
        { traineeId: null },
        { traineeId: "" },
      ],
    };

    const countToUpdate = await DailyRecord.countDocuments(filter);
    console.log(`📊 Found ${countToUpdate} daily records missing traineeId`);

    if (countToUpdate === 0) {
      console.log("✅ All daily records already have traineeId!");
      await mongoose.disconnect();
      return;
    }

    let updatedCount = 0;
    let skippedCount = 0;
    const internIds = Array.from(internMap.keys());
    const totalInterns = internIds.length;

    console.log(`🚀 Starting batch updates across ${totalInterns} interns...`);

    // Bulk update per internId for fast execution across 49K+ records
    for (let i = 0; i < totalInterns; i++) {
      const internIdStr = internIds[i];
      const traineeId = internMap.get(internIdStr);

      const result = await DailyRecord.updateMany(
        {
          internId: new mongoose.Types.ObjectId(internIdStr),
          $or: [
            { traineeId: { $exists: false } },
            { traineeId: null },
            { traineeId: "" },
          ],
        },
        {
          $set: { traineeId: traineeId },
        },
      );

      updatedCount += result.modifiedCount;

      if ((i + 1) % 100 === 0 || i + 1 === totalInterns) {
        console.log(`⏳ Progress: ${i + 1}/${totalInterns} interns processed. Total records updated: ${updatedCount}`);
      }
    }

    // Check remaining
    const remaining = await DailyRecord.countDocuments(filter);
    console.log("\n==========================================");
    console.log(`🎉 Backfill Complete!`);
    console.log(`✅ Records successfully updated: ${updatedCount}`);
    console.log(`⚠️ Records without matching intern: ${remaining}`);
    console.log("==========================================\n");

    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Error during backfill:", error);
    process.exit(1);
  }
}

backfillTraineeId();
