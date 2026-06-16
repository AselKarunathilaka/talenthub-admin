/**
 * verifyAndFixPastInternLocations.js
 *
 * Same verification logic as verifyAndFixInternLocations.js but targets the
 * PastInternLocation collection instead of the active Intern collection.
 *
 * Usage:
 *   node scripts/verifyAndFixPastInternLocations.js
 *
 * Options:
 *   DRY_RUN=1   — show what would change without writing to DB
 *   FORCE=1     — re-geocode ALL past interns regardless of current state
 */

require("dotenv").config();
const mongoose = require("mongoose");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const PastInternLocation = require("../models/PastInternLocation");
const geocodeAddress = require("../utils/geocode");

const MONGO_URI = process.env.MONGO_URI;
const DRY_RUN = process.env.DRY_RUN === "1";
const FORCE = process.env.FORCE === "1";
const PROGRESS_FILE = path.join(__dirname, "verifyPastInterns-progress.json");

const NOMINATIM_DELAY_MS = 1500;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const SRI_LANKA_DISTRICTS = [
  "Ampara","Anuradhapura","Badulla","Batticaloa","Colombo",
  "Galle","Gampaha","Hambantota","Jaffna","Kalutara",
  "Kandy","Kegalle","Kilinochchi","Kurunegala","Mannar",
  "Matale","Matara","Monaragala","Mullaitivu","Nuwara Eliya",
  "Polonnaruwa","Puttalam","Ratnapura","Trincomalee","Vavuniya"
];

/* ── progress helpers ─────────────────────────────────────────────────────── */
const loadProgress = () => {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
      return new Set(data.processed || []);
    }
  } catch {}
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

/* ── helpers ──────────────────────────────────────────────────────────────── */
const normalizeDistrict = (value) => {
  if (!value) return null;
  const cleaned = value.replace(/district/i, "").replace(/\s+/g, " ").trim();
  const exact = SRI_LANKA_DISTRICTS.find(
    d => d.toLowerCase() === cleaned.toLowerCase()
  );
  if (exact) return exact;
  return SRI_LANKA_DISTRICTS.find(
    d => cleaned.toLowerCase().includes(d.toLowerCase())
  ) || null;
};

const reverseGeocodeCoords = async (longitude, latitude) => {
  try {
    await sleep(NOMINATIM_DELAY_MS);
    const res = await axios.get(
      "https://nominatim.openstreetmap.org/reverse",
      {
        params: { lat: latitude, lon: longitude, format: "json", addressdetails: 1 },
        headers: { "User-Agent": "TalentHub-Intern-System/2.0" },
        timeout: 15000,
      }
    );

    const addr = res.data?.address;
    if (!addr) return null;

    const cc = (addr.country_code || "").toLowerCase();
    if (cc && cc !== "lk") return null;

    return (
      normalizeDistrict(addr.county) ||
      normalizeDistrict(addr.state_district) ||
      normalizeDistrict(addr.state) ||
      null
    );
  } catch (err) {
    console.log(`  ⚠ Reverse geocode error: ${err.message}`);
    return null;
  }
};

const isWithinSriLanka = (lng, lat) =>
  lng >= 79.5 && lng <= 81.9 && lat >= 5.9 && lat <= 9.9;

/* ── fix helper ───────────────────────────────────────────────────────────── */
async function fixDoc(doc, stats, dryRun) {
  if (!doc.Trainee_HomeAddress || doc.Trainee_HomeAddress.trim() === "") {
    console.log(`        ⚠ No address to re-geocode — skipping fix`);
    stats.failed++;
    return;
  }

  const geo = await geocodeAddress(doc.Trainee_HomeAddress);

  if (!geo) {
    console.log(`        ❌ Re-geocode failed — original data left unchanged`);
    stats.failed++;
    return;
  }

  console.log(`        ✅ Fixed → ${geo.district}`);
  stats.fixed++;

  if (!dryRun) {
    await PastInternLocation.findByIdAndUpdate(doc._id, {
      $set: {
        location: geo.location,
        district: geo.district,
        geocodeFailed: false,
      },
    });
  }
}

/* ── main ────────────────────────────────────────────────────────────────── */
async function run() {
  if (DRY_RUN) console.log("🔍 DRY RUN mode — no DB writes\n");
  if (FORCE) console.log("⚡ FORCE mode — re-geocoding all past interns\n");

  await mongoose.connect(MONGO_URI);
  console.log("✅ MongoDB connected\n");

  const allDocs = await PastInternLocation.find(
    {},
    {
      _id: 1,
      Trainee_ID: 1,
      Trainee_Name: 1,
      Trainee_HomeAddress: 1,
      district: 1,
      location: 1,
      geocodeFailed: 1,
    }
  ).lean();

  console.log(`📊 Total past interns in DB: ${allDocs.length}`);

  const noLocation = allDocs.filter(
    (d) =>
      d.geocodeFailed ||
      !d.location ||
      !Array.isArray(d.location.coordinates) ||
      d.location.coordinates.length !== 2 ||
      d.location.coordinates[0] == null
  );

  const hasLocation = allDocs.filter(
    (d) =>
      !d.geocodeFailed &&
      d.location &&
      Array.isArray(d.location.coordinates) &&
      d.location.coordinates.length === 2 &&
      d.location.coordinates[0] != null
  );

  console.log(`📍 Have location      : ${hasLocation.length}`);
  console.log(`❌ Missing/failed     : ${noLocation.length}`);
  console.log(`🔄 Will verify        : ${FORCE ? allDocs.length : hasLocation.length}\n`);

  const sessionProgress = loadProgress();
  if (sessionProgress.size > 0) {
    console.log(`🔄 Resuming — ${sessionProgress.size} already processed\n`);
  }

  const stats = {
    correct: 0,
    fixed: 0,
    geocodedNew: 0,
    failed: 0,
    skippedNoAddress: 0,
    outOfBounds: 0,
  };

  const issues = [];

  // ── STEP 1: verify existing locations ─────────────────────────────────────
  const toVerify = FORCE ? allDocs : hasLocation;

  for (let i = 0; i < toVerify.length; i++) {
    const doc = toVerify[i];
    const id = doc._id.toString();
    const label = `[${i + 1}/${toVerify.length}]`;

    if (sessionProgress.has(id)) continue;

    const lng = doc.location?.coordinates?.[0];
    const lat = doc.location?.coordinates?.[1];

    console.log(`${label} ${doc.Trainee_Name} (${doc.Trainee_ID})`);
    console.log(`        Stored district : ${doc.district || "none"}`);
    console.log(`        Coordinates     : [${lng}, ${lat}]`);

    if (lng != null && lat != null && !isWithinSriLanka(lng, lat)) {
      console.log(`        ❌ Coordinates outside Sri Lanka bounds — re-geocoding\n`);
      stats.outOfBounds++;
      issues.push({
        id: doc.Trainee_ID,
        name: doc.Trainee_Name,
        storedDistrict: doc.district,
        verifiedDistrict: "OUT OF BOUNDS",
        address: doc.Trainee_HomeAddress,
        action: "re-geocoded",
      });
      await fixDoc(doc, stats, DRY_RUN);
      sessionProgress.add(id);
      saveProgress(sessionProgress);
      continue;
    }

    const verifiedDistrict = await reverseGeocodeCoords(lng, lat);
    console.log(`        Verified district: ${verifiedDistrict || "unknown"}`);

    if (!verifiedDistrict) {
      console.log(`        ⚠ Could not verify — skipping\n`);
      sessionProgress.add(id);
      saveProgress(sessionProgress);
      continue;
    }

    if (verifiedDistrict === doc.district) {
      console.log(`        ✅ Correct\n`);
      stats.correct++;
      sessionProgress.add(id);
      saveProgress(sessionProgress);
      continue;
    }

    console.log(
      `        ⚠ MISMATCH: stored "${doc.district}" but coords are in "${verifiedDistrict}" — re-geocoding\n`
    );
    issues.push({
      id: doc.Trainee_ID,
      name: doc.Trainee_Name,
      storedDistrict: doc.district,
      verifiedDistrict,
      address: doc.Trainee_HomeAddress,
      action: "re-geocoded",
    });

    await fixDoc(doc, stats, DRY_RUN);
    sessionProgress.add(id);
    saveProgress(sessionProgress);
  }

  // ── STEP 2: geocode past interns with no/failed location ──────────────────
  for (let i = 0; i < noLocation.length; i++) {
    const doc = noLocation[i];
    const id = doc._id.toString();
    const label = `[NEW ${i + 1}/${noLocation.length}]`;

    if (sessionProgress.has(id)) continue;

    console.log(`${label} ${doc.Trainee_Name} (${doc.Trainee_ID})`);

    if (!doc.Trainee_HomeAddress || doc.Trainee_HomeAddress.trim() === "") {
      console.log(`        ⚠ No address — skipping\n`);
      stats.skippedNoAddress++;
      sessionProgress.add(id);
      saveProgress(sessionProgress);
      continue;
    }

    console.log(`        Address: ${doc.Trainee_HomeAddress}`);
    const geo = await geocodeAddress(doc.Trainee_HomeAddress);

    if (!geo) {
      console.log(`        ❌ Geocode failed\n`);
      stats.failed++;
    } else {
      console.log(`        ✅ → ${geo.district}\n`);
      stats.geocodedNew++;
      if (!DRY_RUN) {
        await PastInternLocation.findByIdAndUpdate(doc._id, {
          $set: {
            location: geo.location,
            district: geo.district,
            geocodeFailed: false,
          },
        });
      }
    }

    sessionProgress.add(id);
    saveProgress(sessionProgress);
  }

  /* ── summary ── */
  console.log("═══════════════════════════════════════════");
  console.log("  VERIFICATION COMPLETE");
  console.log("═══════════════════════════════════════════");
  console.log(`  Correct (no change)  : ${stats.correct}`);
  console.log(`  Fixed (re-geocoded)  : ${stats.fixed}`);
  console.log(`  Newly geocoded       : ${stats.geocodedNew}`);
  console.log(`  Out of bounds fixed  : ${stats.outOfBounds}`);
  console.log(`  Geocode failed       : ${stats.failed}`);
  console.log(`  No address (skipped) : ${stats.skippedNoAddress}`);

  if (issues.length > 0) {
    console.log(`\n📋 Issues found (${issues.length}):`);
    issues.forEach((issue) => {
      console.log(`  • ${issue.id} — ${issue.name}`);
      console.log(
        `    Stored: "${issue.storedDistrict}" | Actual: "${issue.verifiedDistrict}" | Action: ${issue.action}`
      );
      console.log(`    Address: "${issue.address}"`);
    });

    const reportFile = path.join(__dirname, "past-intern-location-issues.json");
    fs.writeFileSync(
      reportFile,
      JSON.stringify({ generatedAt: new Date().toISOString(), issues }, null, 2)
    );
    console.log(`\n  Full report written to: ${reportFile}`);
  }

  if (DRY_RUN) console.log("\n  DRY RUN — no changes were written to the DB.");

  try { fs.unlinkSync(PROGRESS_FILE); } catch {}

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Fatal:", err.message);
  console.log("\n💡 Re-run the script to resume from where it stopped.");
  process.exit(1);
});
