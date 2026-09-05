/**
 * renameCollectionToDailyAttendance.js
 *
 * Migrates data from `dailyattendancelogs` to `dailyattendance` collection
 * and drops `dailyattendancelogs`.
 */
const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

async function run() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("❌ MONGO_URI not found");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log("✅ Connected to MongoDB");

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map((c) => c.name);

  console.log("Collections in DB:", collectionNames);

  const hasOld = collectionNames.includes("dailyattendancelogs");
  const hasNew = collectionNames.includes("dailyattendance");

  if (hasOld && !hasNew) {
    console.log("Renaming dailyattendancelogs -> dailyattendance...");
    try {
      await db.collection("dailyattendancelogs").rename("dailyattendance");
      console.log("✅ Renamed collection successfully!");
    } catch (renameErr) {
      console.log("Rename failed, copying documents instead...", renameErr.message);
      const docs = await db.collection("dailyattendancelogs").find({}).toArray();
      if (docs.length > 0) {
        await db.collection("dailyattendance").insertMany(docs);
      }
      await db.collection("dailyattendancelogs").drop();
      console.log(`✅ Copied ${docs.length} docs and dropped old collection.`);
    }
  } else if (hasOld && hasNew) {
    console.log("Both collections exist. Copying docs from dailyattendancelogs to dailyattendance...");
    const docs = await db.collection("dailyattendancelogs").find({}).toArray();
    if (docs.length > 0) {
      try {
        await db.collection("dailyattendance").insertMany(docs, { ordered: false });
      } catch (err) {
        // ignore duplicate key errors
      }
    }
    await db.collection("dailyattendancelogs").drop();
    console.log(`✅ Copied docs and dropped old dailyattendancelogs.`);
  } else {
    console.log("Collection dailyattendance already in place or ready.");
  }

  const count = await db.collection("dailyattendance").countDocuments();
  console.log(`📊 Total documents in 'dailyattendance': ${count}`);

  await mongoose.disconnect();
  console.log("👋 Done");
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
