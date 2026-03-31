/**
 * Seed script to migrate the 20 hardcoded locked seats into the LockedSeat collection.
 * Idempotent — safe to run multiple times.
 *
 * Usage: node scripts/seedLockedSeats.js
 */

const mongoose = require("mongoose");
const dotenv = require("../config/dotenv");
const LockedSeat = require("../models/LockedSeat");

// The 20 seats that were previously hardcoded as locked in useSeatManagement.jsx
const HARDCODED_LOCKED_SEATS = [
  // Left section — outerRing2
  27, 28, 29, 30, 31, 32, 33, 34,
  // Left section — outerRing3
  35, 36,
  // Right section — pillarSeats
  65, 66,
  // Right section — outerRing2
  67, 72, 73, 74,
  // Right section — outerRing3
  86, 87, 88,
];

const seedLockedSeats = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(dotenv.mongoURI);
    console.log("Connected to MongoDB");

    let inserted = 0;
    let skipped = 0;

    for (const seatNumber of HARDCODED_LOCKED_SEATS) {
      const exists = await LockedSeat.findOne({ seatNumber });
      if (exists) {
        skipped++;
        continue;
      }

      await LockedSeat.create({
        seatNumber,
        lockedBy: "system-migration",
        lockedAt: new Date(),
      });
      inserted++;
    }

    console.log(`\nSeed complete:`);
    console.log(`  Inserted: ${inserted} locked seats`);
    console.log(`  Skipped (already existed): ${skipped}`);
    console.log(`  Total locked seats in DB: ${await LockedSeat.countDocuments()}`);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("Seed error:", error);
    process.exit(1);
  }
};

seedLockedSeats();
