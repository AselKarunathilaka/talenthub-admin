require("dotenv").config();
const mongoose = require("mongoose");
const Intern = require("../models/Intern");
const geocodeAddress = require("../utils/geocode");

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB Connected");

    const interns = await Intern.find();

    let updated = 0;

    for (const intern of interns) {

      console.log("Processing:", intern.Trainee_Name);

      const geo = await geocodeAddress(intern.Trainee_HomeAddress);

      if (!geo) {
        console.log("❌ Could not geocode");
        continue;
      }

      intern.location = geo.location;
      intern.district = geo.district;

      await intern.save();

      console.log("✅ Updated →", geo.district);
      updated++;
    }

    console.log("DONE. Updated:", updated);
    process.exit();

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();