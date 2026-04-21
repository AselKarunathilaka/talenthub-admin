/**
 * verifyAndFixInternLocations.js
 *
 * Checks every intern in the Intern collection and:
 *   1. Interns with NO location → geocodes their address and saves
 *   2. Interns WITH location → reverse geocodes the stored coordinates to verify
 *      the district matches. If it doesn't match, re-geocodes from the address.
 *   3. Interns where reverse geocode confirms the district is correct → skipped
 *
 * Nothing is changed unless verification fails or location is missing.
 * Safe to run multiple times.
 *
 * Usage:
 *   node scripts/verifyAndFixInternLocations.js
 *
 * Options:
 *   DRY_RUN=1   — show what would change without writing to DB
 *   FORCE=1     — re-geocode ALL interns regardless of current state
 */

require("dotenv").config();
const mongoose = require("mongoose");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const Intern = require("../models/Intern");
const geocodeAddress = require("../utils/geocode");

const MONGO_URI = process.env.MONGO_URI;
const DRY_RUN = process.env.DRY_RUN === "1";
const FORCE = process.env.FORCE === "1";
const PROGRESS_FILE = path.join(__dirname, "verifyInterns-progress.json");

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

/* ── normalise district string ────────────────────────────────────────────── */
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

/* ── reverse geocode stored coordinates ──────────────────────────────────── */
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

/* ── check if coordinates are within Sri Lanka bounding box ──────────────── */
const isWithinSriLanka = (lng, lat) =>
  lng >= 79.5 && lng <= 81.9 && lat >= 5.9 && lat <= 9.9;

/* ── main ────────────────────────────────────────────────────────────────── */
async function run() {
  if (DRY_RUN) console.log("🔍 DRY RUN mode — no DB writes\n");
  if (FORCE) console.log("⚡ FORCE mode — re-geocoding all interns\n");

  await mongoose.connect(MONGO_URI);
  console.log("✅ MongoDB connected\n");

  const allInterns = await Intern.find(
    {},
    {
      _id: 1,
      Trainee_ID: 1,
      Trainee_Name: 1,
      Trainee_HomeAddress: 1,
      district: 1,
      location: 1,
    }
  ).lean();

  console.log(`📊 Total interns in DB: ${allInterns.length}\n`);

  // Categorise
  const noLocation = allInterns.filter(
    (i) =>
      !i.location ||
      !Array.isArray(i.location.coordinates) ||
      i.location.coordinates.length !== 2 ||
      i.location.coordinates[0] == null
  );

  const hasLocation = allInterns.filter(
    (i) =>
      i.location &&
      Array.isArray(i.location.coordinates) &&
      i.location.coordinates.length === 2 &&
      i.location.coordinates[0] != null
  );

  console.log(`📍 Have location      : ${hasLocation.length}`);
  console.log(`❌ Missing location   : ${noLocation.length}`);
  console.log(`🔄 Will verify        : ${FORCE ? allInterns.length : hasLocation.length}`);
  console.log(`🆕 Will geocode new   : ${noLocation.length}\n`);

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

  const issues = []; // collects everything that was wrong for the summary

  // ── STEP 1: verify existing locations ─────────────────────────────────────
  const toVerify = FORCE ? allInterns : hasLocation;

  for (let i = 0; i < toVerify.length; i++) {
    const intern = toVerify[i];
    const id = intern._id.toString();
    const label = `[${i + 1}/${toVerify.length}]`;

    if (sessionProgress.has(id)) continue;

    const lng = intern.location?.coordinates?.[0];
    const lat = intern.location?.coordinates?.[1];

    console.log(`${label} ${intern.Trainee_Name} (${intern.Trainee_ID})`);
    console.log(`        Stored district : ${intern.district || "none"}`);
    console.log(`        Coordinates     : [${lng}, ${lat}]`);

    // Check if coordinates are even within Sri Lanka
    if (lng != null && lat != null && !isWithinSriLanka(lng, lat)) {
      console.log(`        ❌ Coordinates outside Sri Lanka bounds — re-geocoding\n`);
      stats.outOfBounds++;
      issues.push({
        id: intern.Trainee_ID,
        name: intern.Trainee_Name,
        storedDistrict: intern.district,
        verifiedDistrict: "OUT OF BOUNDS",
        address: intern.Trainee_HomeAddress,
        action: "re-geocoded",
      });

      await fixIntern(intern, stats, DRY_RUN);
      sessionProgress.add(id);
      saveProgress(sessionProgress);
      continue;
    }

    // Reverse geocode to verify stored district
    const verifiedDistrict = await reverseGeocodeCoords(lng, lat);
    console.log(`        Verified district: ${verifiedDistrict || "unknown"}`);

    if (!verifiedDistrict) {
      // Can't verify — skip rather than blindly re-geocoding
      console.log(`        ⚠ Could not verify — skipping\n`);
      sessionProgress.add(id);
      saveProgress(sessionProgress);
      continue;
    }

    if (verifiedDistrict === intern.district) {
      console.log(`        ✅ Correct\n`);
      stats.correct++;
      sessionProgress.add(id);
      saveProgress(sessionProgress);
      continue;
    }

    // District mismatch — re-geocode from address
    console.log(
      `        ⚠ MISMATCH: stored "${intern.district}" but coords are in "${verifiedDistrict}" — re-geocoding\n`
    );
    issues.push({
      id: intern.Trainee_ID,
      name: intern.Trainee_Name,
      storedDistrict: intern.district,
      verifiedDistrict,
      address: intern.Trainee_HomeAddress,
      action: "re-geocoded",
    });

    await fixIntern(intern, stats, DRY_RUN);
    sessionProgress.add(id);
    saveProgress(sessionProgress);
  }

  // ── STEP 2: geocode interns with no location ───────────────────────────────
  for (let i = 0; i < noLocation.length; i++) {
    const intern = noLocation[i];
    const id = intern._id.toString();
    const label = `[NEW ${i + 1}/${noLocation.length}]`;

    if (sessionProgress.has(id)) continue;

    console.log(`${label} ${intern.Trainee_Name} (${intern.Trainee_ID})`);

    if (!intern.Trainee_HomeAddress || intern.Trainee_HomeAddress.trim() === "") {
      console.log(`        ⚠ No address — skipping\n`);
      stats.skippedNoAddress++;
      sessionProgress.add(id);
      saveProgress(sessionProgress);
      continue;
    }

    console.log(`        Address: ${intern.Trainee_HomeAddress}`);
    const geo = await geocodeAddress(intern.Trainee_HomeAddress);

    if (!geo) {
      console.log(`        ❌ Geocode failed\n`);
      stats.failed++;
      issues.push({
        id: intern.Trainee_ID,
        name: intern.Trainee_Name,
        storedDistrict: "none",
        verifiedDistrict: "—",
        address: intern.Trainee_HomeAddress,
        action: "geocode failed",
      });
    } else {
      console.log(`        ✅ → ${geo.district}\n`);
      stats.geocodedNew++;
      if (!DRY_RUN) {
        await Intern.findByIdAndUpdate(intern._id, {
          $set: { location: geo.location, district: geo.district },
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
      console.log(
        `  • ${issue.id} — ${issue.name}`
      );
      console.log(
        `    Stored: "${issue.storedDistrict}" | Actual: "${issue.verifiedDistrict}" | Action: ${issue.action}`
      );
      console.log(`    Address: "${issue.address}"`);
    });

    // Write issues to a file for review
    const reportFile = path.join(__dirname, "location-issues.json");
    fs.writeFileSync(
      reportFile,
      JSON.stringify({ generatedAt: new Date().toISOString(), issues }, null, 2)
    );
    console.log(`\n  Full report written to: ${reportFile}`);
  }

  if (DRY_RUN) {
    console.log("\n  DRY RUN — no changes were written to the DB.");
  }

  try { fs.unlinkSync(PROGRESS_FILE); } catch {}

  await mongoose.disconnect();
  process.exit(0);
}

/* ── helper: re-geocode an intern and save ────────────────────────────────── */
async function fixIntern(intern, stats, dryRun) {
  if (!intern.Trainee_HomeAddress || intern.Trainee_HomeAddress.trim() === "") {
    console.log(`        ⚠ No address to re-geocode — skipping fix`);
    stats.failed++;
    return;
  }

  const geo = await geocodeAddress(intern.Trainee_HomeAddress);

  if (!geo) {
    console.log(`        ❌ Re-geocode failed — original data left unchanged`);
    stats.failed++;
    return;
  }

  console.log(`        ✅ Fixed → ${geo.district}`);
  stats.fixed++;

  if (!dryRun) {
    await Intern.findByIdAndUpdate(intern._id, {
      $set: { location: geo.location, district: geo.district },
    });
  }
}

run().catch((err) => {
  console.error("Fatal:", err.message);
  console.log("\n💡 Re-run the script to resume from where it stopped.");
  process.exit(1);
});
