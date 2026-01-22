const mongoose = require("mongoose");
require("dotenv").config(); // Load environment variables

async function migrateIndexes() {
  try {
    // Connect to production database
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;
    const collection = db.collection("seatbookings"); // Check actual collection name

    // Step 1: Check existing indexes
    console.log("\n Current indexes:");
    const existingIndexes = await collection.indexes();
    console.log(JSON.stringify(existingIndexes, null, 2));

    // Step 2: Drop the old unique index (if it exists)
    console.log("\n  Dropping old indexes...");
    try {
      await collection.dropIndex("seatNumber_1_bookingDate_1");
      console.log(" Dropped old unique index: seatNumber_1_bookingDate_1");
    } catch (error) {
      console.log("  Old index not found or already dropped");
    }

    // Step 3: Create the new partial unique index
    console.log("\n Creating new partial unique index...");
    await collection.createIndex(
      { seatNumber: 1, bookingDate: 1 },
      {
        unique: true,
        partialFilterExpression: { status: "active" },
        name: "seatNumber_1_bookingDate_1_active_only",
      },
    );
    console.log(" Created new partial unique index");

    // Step 4: Create the intern booking index
    console.log("\n Creating intern booking index...");
    await collection.createIndex(
      { internId: 1, bookingDate: 1, status: 1 },
      { name: "internId_1_bookingDate_1_status_1" },
    );
    console.log(" Created intern booking index");

    // Step 5: Verify new indexes
    console.log("\n New indexes:");
    const newIndexes = await collection.indexes();
    console.log(JSON.stringify(newIndexes, null, 2));

    // Step 6: Clean up old cancelled bookings (optional but recommended)
    console.log("\n Cleaning up old cancelled bookings...");
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7); // Delete cancelled bookings older than 7 days

    const deleteResult = await collection.deleteMany({
      status: "cancelled",
      bookingDate: { $lt: cutoffDate },
    });
    console.log(` Deleted ${deleteResult.deletedCount} old cancelled bookings`);

    console.log("\n Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\n Migration failed:", error);
    process.exit(1);
  }
}

migrateIndexes();
