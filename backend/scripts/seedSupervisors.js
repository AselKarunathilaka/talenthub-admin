/**
 * seedSupervisors.js
 *
 * Seeds the `supervisors` collection with the authorised admin/developer
 * accounts that are permitted to sign in via Google.
 *
 * Run with:
 *   node scripts/seedSupervisors.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Supervisor = require("../models/Supervisor");

const SUPERVISORS = [
  {
    name: "M. Giridaran",
    email: "mgiridaransysdev@gmail.com",
    role: "Supervisor",
  },
  {
    name: "Kavindu Nimsara",
    email: "kavindunimsara123@gmail.com",
    role: "Developer",
  },
  {
    name: "Ranuja Liyanaarachchi",
    email: "ranujaliyanaarachchi@gmail.com",
    role: "Developer",
  },
  {
    name: "Tharushi Dimalsha",
    email: "dimalshacooray@gmail.com",
    role: "Developer",
  },
  {
    name: "H. Janaka",
    email: "hjanaka@gmail.com",
    role: "Supervisor",
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    let added = 0;
    let skipped = 0;

    for (const supervisor of SUPERVISORS) {
      const result = await Supervisor.findOneAndUpdate(
        { email: supervisor.email.toLowerCase() },
        { $set: supervisor },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        console.log(`  ➕ Added: ${supervisor.name} <${supervisor.email}>`);
        added++;
      } else {
        console.log(`  ⏭️  Already exists: ${supervisor.name} <${supervisor.email}>`);
        skipped++;
      }
    }

    const total = await Supervisor.countDocuments();
    console.log(`\n📊 Seed complete — ${added} added, ${skipped} already existed.`);
    console.log(`   Total supervisors in DB: ${total}`);
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

seed();
