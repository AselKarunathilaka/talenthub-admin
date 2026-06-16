require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const Intern = require("../models/Intern");
const geocodeAddress = require("../utils/geocode");

const MONGO_URI = process.env.MONGO_URI;
const DRY_RUN = process.env.DRY_RUN === "1";
const PROGRESS_FILE = path.join(__dirname, "fix-progress.json");

/* ── helpers ─────────────────────────────────────────────────────────────── */

const hasValidLocation = (intern) =>
  intern.location &&
  intern.location.type === "Point" &&
  Array.isArray(intern.location.coordinates) &&
  intern.location.coordinates.length === 2 &&
  typeof intern.location.coordinates[0] === "number" &&
  typeof intern.location.coordinates[1] === "number" &&
  !isNaN(intern.location.coordinates[0]) &&
  !isNaN(intern.location.coordinates[1]);

const loadProgress = () => {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
      return new Set(data.processed || []);
    }
  } catch {
    // corrupted progress file — start fresh
  }
  return new Set();
};

const saveProgress = (processed) => {
  try {
    fs.writeFileSync(
      PROGRESS_FILE,
      JSON.stringify({ processed: [...processed], savedAt: new Date().toISOString() }, null, 2)
    );
  } catch (e) {
    console.warn("⚠ Could not save progress file:", e.message);
  }
};

/* ── main ────────────────────────────────────────────────────────────────── */

async function run() {
  if (DRY_RUN) console.log("🔍 DRY RUN mode — no DB writes will happen\n");

  await mongoose.connect(MONGO_URI);
  console.log("✅ MongoDB connected\n");

  const allInterns = await Intern.find({}, {
    _id: 1,
    Trainee_ID: 1,
    Trainee_Name: 1,
    Trainee_HomeAddress: 1,
    location: 1,
    district: 1,
  }).lean();

  // Split into two groups
  const alreadyDone = allInterns.filter(hasValidLocation);
  const needsGeocode = allInterns.filter(i => !hasValidLocation(i));

  console.log(`📊 Total interns     : ${allInterns.length}`);
  console.log(`✅ Already have location : ${alreadyDone.length}`);
  console.log(`📍 Need geocoding    : ${needsGeocode.length}\n`);

  if (needsGeocode.length === 0) {
    console.log("Nothing to do — all interns already have location data.");
    await mongoose.disconnect();
    process.exit(0);
  }

  // Load progress from previous interrupted run
  const processed = loadProgress();
  const remaining = needsGeocode.filter(i => !processed.has(i._id.toString()));

  if (processed.size > 0) {
    console.log(`🔄 Resuming — ${processed.size} already processed in a previous run`);
    console.log(`📍 Remaining this run : ${remaining.length}\n`);
  }

  const stats = {
    updated: 0,
    failed: 0,
    skippedNoAddress: 0,
  };

  const failed = [];

  for (let idx = 0; idx < remaining.length; idx++) {
    const intern = remaining[idx];
    const label = `[${idx + 1}/${remaining.length}]`;
    const id = intern._id.toString();

    console.log(`${label} ${intern.Trainee_Name} (${intern.Trainee_ID})`);

    if (!intern.Trainee_HomeAddress || intern.Trainee_HomeAddress.trim() === "") {
      console.log(`        ⚠ No address on record — skipped\n`);
      stats.skippedNoAddress++;
      processed.add(id); // mark so we don't retry on resume (nothing to retry)
      saveProgress(processed);
      continue;
    }

    console.log(`        Address: ${intern.Trainee_HomeAddress}`);

    const geo = await geocodeAddress(intern.Trainee_HomeAddress);

    if (!geo) {
      console.log(`        ❌ Could not geocode — will log for manual review\n`);
      stats.failed++;
      failed.push({
        traineeId: intern.Trainee_ID,
        name: intern.Trainee_Name,
        address: intern.Trainee_HomeAddress,
      });
      // Don't mark as processed — a re-run might succeed if Nominatim recovers
      continue;
    }

    console.log(`        ✅ → ${geo.district} [${geo.location.coordinates[1].toFixed(4)}, ${geo.location.coordinates[0].toFixed(4)}]`);

    if (!DRY_RUN) {
      await Intern.findByIdAndUpdate(intern._id, {
        $set: {
          location: geo.location,
          district: geo.district,
        },
      });
    }

    stats.updated++;
    processed.add(id);
    saveProgress(processed); // save after every successful update
    console.log();
  }

  /* ── Summary ──────────────────────────────────────────────────────────── */
  console.log("═══════════════════════════════════════════");
  console.log("  DONE");
  console.log("═══════════════════════════════════════════");
  console.log(`  Updated          : ${stats.updated}`);
  console.log(`  Failed (no geo)  : ${stats.failed}`);
  console.log(`  Skipped (no addr): ${stats.skippedNoAddress}`);
  console.log(`  Already had loc  : ${alreadyDone.length}`);

  if (failed.length > 0) {
    console.log("\n⚠ The following interns could not be geocoded:");
    console.log("  (Check addresses manually or add to a manual override list)\n");
    failed.forEach(f => {
      console.log(`  • ${f.traineeId} — ${f.name}`);
      console.log(`    "${f.address}"`);
    });

    // Write failed list to a file for easy follow-up
    const failedFile = path.join(__dirname, "geocode-failures.json");
    fs.writeFileSync(
      failedFile,
      JSON.stringify({ generatedAt: new Date().toISOString(), failed }, null, 2)
    );
    console.log(`\n  Full list written to: ${failedFile}`);
  }

  if (stats.updated === remaining.length - stats.skippedNoAddress) {
    // All done — clean up progress file
    try { fs.unlinkSync(PROGRESS_FILE); } catch {}
    console.log("\n  Progress file cleaned up.");
  } else if (stats.failed > 0) {
    console.log(`\n  ℹ Re-run the script to retry the ${stats.failed} failed intern(s).`);
    console.log("    Progress is saved — already-processed interns won't be hit again.");
  }

  console.log();
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
