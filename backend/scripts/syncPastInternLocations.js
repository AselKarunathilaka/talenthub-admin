/**
 * syncPastInternLocations.js
 *
 * Fetches ALL interns from the SLT AllRequestTextsRequested API, excludes
 * active interns (by cross-checking your Intern DB), then geocodes and stores
 * the remaining past/inactive interns in the PastInternLocation collection.
 *
 * Safe to run repeatedly — already-geocoded interns are skipped.
 * Progress is saved after every successful geocode so the script can resume
 * from where it left off if interrupted (network error, Ctrl+C, etc.).
 *
 * Usage:
 *   node scripts/syncPastInternLocations.js
 *
 * Options:
 *   RETRY_FAILED=1 node scripts/syncPastInternLocations.js
 *   — re-attempts interns that previously failed geocoding
 */

require("dotenv").config();
const mongoose = require("mongoose");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const Intern = require("../models/Intern");
const PastInternLocation = require("../models/PastInternLocation");
const geocodeAddress = require("../utils/geocode");

const MONGO_URI = process.env.MONGO_URI;
const SECRET_KEY = process.env.TRAINEES_API_SECRET_KEY;
const ALL_INTERNS_API_URL =
  "https://prohub.slt.com.lk/ProhubTrainees/api/MainApi/AllRequestTextsRequested";
const RETRY_FAILED = process.env.RETRY_FAILED === "1";

// Progress file — tracks which IDs have been processed so we can resume
const PROGRESS_FILE = path.join(__dirname, "syncPastInterns-progress.json");

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

/* ── fetch from SLT API ───────────────────────────────────────────────────── */
async function fetchAllFromAPI() {
  console.log("📡 Fetching all interns from SLT API...");
  const response = await axios.post(
    ALL_INTERNS_API_URL,
    { secretKey: SECRET_KEY },
    {
      timeout: 30000,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "TalentHub-Intern-System/2.0",
      },
    }
  );

  if (!response.data) throw new Error("Empty response from API");
  if (response.data.isSuccess === false)
    throw new Error(`API error: ${response.data.errorMessage || "Unknown"}`);

  if (Array.isArray(response.data.dataBundle)) return response.data.dataBundle;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.data.data)) return response.data.data;

  throw new Error("Unexpected response format from API");
}

/* ── main ────────────────────────────────────────────────────────────────── */
async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ MongoDB connected\n");

  const allFromAPI = await fetchAllFromAPI();
  console.log(`📥 Total interns from API  : ${allFromAPI.length}`);

  const activeInterns = await Intern.find({}, { Trainee_ID: 1 }).lean();
  const activeIds = new Set(
    activeInterns.map((i) => i.Trainee_ID?.toString()).filter(Boolean)
  );
  console.log(`👤 Active interns in DB    : ${activeIds.size}`);

  const pastOnly = allFromAPI.filter(
    (i) => i.Trainee_ID && !activeIds.has(i.Trainee_ID.toString())
  );
  console.log(`📋 Past/inactive interns   : ${pastOnly.length}\n`);

  const existingDocs = await PastInternLocation.find(
    {},
    { Trainee_ID: 1, geocodeFailed: 1 }
  ).lean();

  const existingIds = new Set(existingDocs.map((d) => d.Trainee_ID?.toString()));
  const failedIds = new Set(
    existingDocs.filter((d) => d.geocodeFailed).map((d) => d.Trainee_ID?.toString())
  );

  // Load progress from a previous interrupted run
  const sessionProgress = loadProgress();
  if (sessionProgress.size > 0) {
    console.log(`🔄 Resuming — ${sessionProgress.size} already processed in previous session`);
  }

  const toProcess = pastOnly.filter((intern) => {
    const id = intern.Trainee_ID?.toString();
    if (!id) return false;
    if (sessionProgress.has(id)) return false;           // already done this session
    if (!existingIds.has(id)) return true;               // brand new
    if (RETRY_FAILED && failedIds.has(id)) return true;  // retry failures
    return false;
  });

  console.log(`✅ Already geocoded        : ${existingIds.size - failedIds.size}`);
  console.log(`❌ Previously failed       : ${failedIds.size}`);
  console.log(`🔄 To process this run     : ${toProcess.length}`);
  if (RETRY_FAILED) console.log("🔁 RETRY_FAILED mode on");
  console.log();

  if (toProcess.length === 0) {
    console.log("✅ Nothing to do — all past interns already geocoded.");
    try { fs.unlinkSync(PROGRESS_FILE); } catch {}
    await mongoose.disconnect();
    process.exit(0);
  }

  const stats = { saved: 0, failed: 0, skippedNoAddress: 0 };
  const failures = [];

  for (let i = 0; i < toProcess.length; i++) {
    const intern = toProcess[i];
    const id = intern.Trainee_ID?.toString();
    const label = `[${i + 1}/${toProcess.length}]`;

    console.log(`${label} ${intern.Trainee_Name} (${id})`);

    // ── No address ────────────────────────────────────────────────────────
    if (!intern.Trainee_HomeAddress || intern.Trainee_HomeAddress.trim() === "") {
      console.log(`        ⚠ No address — saving stub\n`);
      stats.skippedNoAddress++;

      try {
        await PastInternLocation.findOneAndUpdate(
          { Trainee_ID: id },
          {
            $set: {
              Trainee_ID: id,
              Trainee_Name: intern.Trainee_Name || "",
              Trainee_HomeAddress: "",
              Trainee_Email: intern.Trainee_Email || "",
              Institute: intern.Institute || "",
              geocodeFailed: true,
            },
            $unset: { location: "" },
          },
          { upsert: true, new: true }
        );
      } catch (dbErr) {
        console.warn(`        ⚠ DB error saving stub: ${dbErr.message}`);
      }

      sessionProgress.add(id);
      saveProgress(sessionProgress);
      continue;
    }

    // ── Attempt geocoding ─────────────────────────────────────────────────
    console.log(`        Address: ${intern.Trainee_HomeAddress}`);

    let geo = null;
    try {
      geo = await geocodeAddress(intern.Trainee_HomeAddress);
    } catch (geoErr) {
      console.log(`        ⚠ Geocode threw: ${geoErr.message}`);
    }

    if (!geo) {
      console.log(`        ❌ Geocode failed\n`);
      stats.failed++;
      failures.push({ id, name: intern.Trainee_Name, address: intern.Trainee_HomeAddress });

      try {
        await PastInternLocation.findOneAndUpdate(
          { Trainee_ID: id },
          {
            $set: {
              Trainee_ID: id,
              Trainee_Name: intern.Trainee_Name || "",
              Trainee_HomeAddress: intern.Trainee_HomeAddress || "",
              Trainee_Email: intern.Trainee_Email || "",
              Institute: intern.Institute || "",
              geocodeFailed: true,
            },
            $unset: { location: "" },
          },
          { upsert: true, new: true }
        );
      } catch (dbErr) {
        console.warn(`        ⚠ DB error saving failed stub: ${dbErr.message}`);
      }

      // Mark as processed so a re-run skips it (unless RETRY_FAILED=1)
      sessionProgress.add(id);
      saveProgress(sessionProgress);
      continue;
    }

    // ── Save geocoded result ──────────────────────────────────────────────
    try {
      await PastInternLocation.findOneAndUpdate(
        { Trainee_ID: id },
        {
          $set: {
            Trainee_ID: id,
            Trainee_Name: intern.Trainee_Name || "",
            Trainee_HomeAddress: intern.Trainee_HomeAddress || "",
            Trainee_Email: intern.Trainee_Email || "",
            Institute: intern.Institute || "",
            district: geo.district,
            location: geo.location,
            geocodeFailed: false,
          },
        },
        { upsert: true, new: true }
      );
    } catch (dbErr) {
      console.warn(`        ⚠ DB error saving geocoded result: ${dbErr.message}`);
      // Don't mark as done — let it retry next run
      continue;
    }

    console.log(`        ✅ → ${geo.district}\n`);
    stats.saved++;

    sessionProgress.add(id);
    saveProgress(sessionProgress);
  }

  /* ── summary ── */
  console.log("═══════════════════════════════════════════");
  console.log("  DONE");
  console.log("═══════════════════════════════════════════");
  console.log(`  Geocoded & saved  : ${stats.saved}`);
  console.log(`  Geocode failed    : ${stats.failed}`);
  console.log(`  No address        : ${stats.skippedNoAddress}`);
  console.log(`  Already in DB     : ${existingIds.size - failedIds.size}`);
  console.log(`  Active (excluded) : ${activeIds.size}`);

  if (failures.length > 0) {
    console.log("\n⚠ Failed addresses (run with RETRY_FAILED=1 to retry):");
    failures.forEach((f) =>
      console.log(`  • ${f.id} — ${f.name}: "${f.address}"`)
    );
  }

  // Clean up progress file on successful completion
  try { fs.unlinkSync(PROGRESS_FILE); } catch {}

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Fatal:", err.message);
  console.log("\n💡 If this was a network error, just re-run the script.");
  console.log("   Progress is saved — it will resume from where it stopped.");
  process.exit(1);
});