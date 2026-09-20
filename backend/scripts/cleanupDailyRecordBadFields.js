/**
 * cleanupDailyRecordBadFields.js
 *
 * Removes the incorrectly added `attendanceMarkType` and `attendanceType`
 * fields from all DailyRecord documents.
 * These fields do NOT belong in the DailyRecord collection.
 */
const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

async function cleanup() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) { console.error("❌ MONGO_URI not found"); process.exit(1); }

  await mongoose.connect(mongoUri);
  console.log("✅ Connected to MongoDB");

  const result = await mongoose.connection.db.collection("dailyrecords").updateMany(
    {
      $or: [
        { attendanceMarkType: { $exists: true } },
        { attendanceType: { $exists: true } },
      ],
    },
    {
      $unset: { attendanceMarkType: "", attendanceType: "" },
    },
  );

  console.log(`✅ Removed bad fields from ${result.modifiedCount} DailyRecord documents`);
  await mongoose.disconnect();
  console.log("👋 Done");
}

cleanup().catch(err => { console.error(err); process.exit(1); });
