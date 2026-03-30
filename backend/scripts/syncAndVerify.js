#!/usr/bin/env node
// Sync external trainees into MongoDB and verify a sample mapping

const mongoose = require('mongoose');
const connectDB = require('../config/database');
const internService = require('../services/internService');
const traineesApiService = require('../services/traineesApiService');
const Intern = require('../models/Intern');

function fmtDate(d) {
  if (!d) return null;
  const iso = new Date(d).toISOString();
  return iso.slice(0, 10); // YYYY-MM-DD
}

function compareRecord(ext, db) {
  const diffs = [];
  const checks = [
    ['traineeId', String(ext.traineeId), String(db.traineeId)],
    ['traineeName', String(ext.traineeName), String(db.traineeName)],
    ['fieldOfSpecialization', String(ext.fieldOfSpecialization || ''), String(db.fieldOfSpecialization || '')],
    ['institute', String(ext.institute || ''), String(db.institute || '')],
    ['homeAddress', String(ext.homeAddress || ''), String(db.homeAddress || '')],
    ['email', String(ext.email || ''), String(db.email || '')],
    ['trainingStartDate', fmtDate(ext.trainingStartDate), fmtDate(db.trainingStartDate)],
    ['trainingEndDate', fmtDate(ext.trainingEndDate), fmtDate(db.trainingEndDate)],
  ];
  for (const [key, a, b] of checks) {
    if ((a || '') !== (b || '')) diffs.push({ key, expected: a, actual: b });
  }
  return diffs;
}

(async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error('Missing MONGO_URI env var. Please set it and rerun.');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await connectDB();
    console.log('Connected. Fetching external trainees (sample)...');

    const external = await traineesApiService.fetchAllActive();
    if (!Array.isArray(external) || external.length === 0) {
      console.error('No external trainees returned.');
      process.exit(2);
    }

    const sample = external.slice(0, Math.min(5, external.length));
    console.log(`Sample picked: ${sample.map(s => s.traineeId).join(', ')}`);

    console.log('Running sync (upsert into MongoDB)...');
    const summary = await internService.syncActiveInterns();
    console.log('Sync summary:', summary);

    console.log('Verifying sample in MongoDB...');
    let ok = 0, bad = 0;
    for (const ext of sample) {
      const db = await Intern.findOne({ traineeId: ext.traineeId });
      if (!db) {
        bad++;
        console.log(`- ${ext.traineeId} NOT FOUND in DB`);
        continue;
      }
      const diffs = compareRecord(ext, db);
      if (diffs.length === 0) {
        ok++;
        console.log(`- ${ext.traineeId} OK: ${ext.traineeName}`);
      } else {
        bad++;
        console.log(`- ${ext.traineeId} MISMATCHES:`, diffs);
      }
    }
    console.log(`Verification complete: OK=${ok}, MISMATCH=${bad}`);
  } catch (e) {
    console.error('Error during sync/verify:', e.message);
    process.exit(3);
  } finally {
    try { await mongoose.connection.close(); } catch {}
  }
})();
