/*
  reportSltDbDiff.js

  Non-destructive report that compares SLT API active trainees with DB interns
  - Lists interns present in DB but not in API (likely terminated)
  - Lists interns present in API but missing in DB
  - Lists interns whose training end date differs between API and DB

  Usage (PowerShell):
    $env:MONGO_URI='mongodb://...'; $env:TRAINEES_API_SECRET_KEY='secret'; node .\backend\scripts\reportSltDbDiff.js

  The script prints a summary and samples to stdout. It does NOT modify the DB.
*/

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const SLTApiService = require('../services/sltApiService');
const InternRepository = require('../repositories/internRepository');
const Intern = require('../models/Intern');

async function connectDb() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not provided. Set $env:MONGO_URI in PowerShell or add backend/.env');
    process.exit(1);
  }
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
}

function formatDateForCompare(d) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  // Compare only date part (YYYY-MM-DD)
  return date.toISOString().slice(0, 10);
}

async function runReport() {
  await connectDb();

  try {
    console.log('Fetching active trainees from SLT API...');
    const apiTrainees = await SLTApiService.fetchActiveTrainees();
    console.log(`Fetched ${apiTrainees.length} trainees from API`);

    console.log('Fetching interns from DB...');
    const dbInterns = await Intern.find();
    console.log(`Loaded ${dbInterns.length} interns from DB`);

    const apiById = new Map();
    for (const t of apiTrainees) {
      const id = (t.Trainee_ID || t.traineeId || '').toString();
      if (!id) continue;
      apiById.set(id, t);
    }

    const dbById = new Map();
    for (const i of dbInterns) {
      const id = (i.Trainee_ID || i.traineeId || '').toString();
      if (!id) continue;
      dbById.set(id, i);
    }

    const inApiNotInDb = [];
    const inDbNotInApi = [];
    const mismatchedEndDates = [];

    // API -> DB comparisons
    for (const [apiId, apiObj] of apiById.entries()) {
      if (!dbById.has(apiId)) {
        inApiNotInDb.push({ traineeId: apiId, traineeName: apiObj.Trainee_Name || apiObj.traineeName || '' });
      }
    }

    // DB -> API comparisons
    for (const [dbId, dbObj] of dbById.entries()) {
      if (!apiById.has(dbId)) {
        inDbNotInApi.push({ traineeId: dbId, traineeName: dbObj.Trainee_Name || dbObj.traineeName || '', email: dbObj.Trainee_Email || '' });
        continue;
      }

      const apiObj = apiById.get(dbId);
      const apiEnd = formatDateForCompare(SLTApiService.parseDate(apiObj.Training_EndDate || apiObj.Training_EndDate || apiObj.endDate || apiObj.EndDate));
      const dbEnd = formatDateForCompare(dbObj.Training_EndDate || dbObj.trainingEndDate || dbObj.Training_EndDate);

      if (apiEnd !== dbEnd) {
        mismatchedEndDates.push({ traineeId: dbId, traineeName: dbObj.Trainee_Name || dbObj.traineeName || '', apiEnd, dbEnd });
      }
    }

    console.log('\n===== SLT API vs DB Report =====');
    console.log(`API total trainees: ${apiById.size}`);
    console.log(`DB total interns: ${dbById.size}`);
    console.log(`API -> not in DB (new in API): ${inApiNotInDb.length}`);
    console.log(`DB -> not in API (possible terminated/left): ${inDbNotInApi.length}`);
    console.log(`Mismatched Training_EndDate entries: ${mismatchedEndDates.length}`);

    if (inDbNotInApi.length > 0) {
      console.log('\n--- Sample DB-only interns (possible terminated) ---');
      inDbNotInApi.slice(0, 10).forEach(i => console.log(`- ${i.traineeId}: ${i.traineeName} (${i.email})`));
    }

    if (inApiNotInDb.length > 0) {
      console.log('\n--- Sample API-only trainees (not in DB) ---');
      inApiNotInDb.slice(0, 10).forEach(i => console.log(`- ${i.traineeId}: ${i.traineeName}`));
    }

    if (mismatchedEndDates.length > 0) {
      console.log('\n--- Sample mismatched end dates ---');
      mismatchedEndDates.slice(0, 20).forEach(i => console.log(`- ${i.traineeId}: ${i.traineeName} | API End: ${i.apiEnd || 'NULL'} | DB End: ${i.dbEnd || 'NULL'}`));
    }

    console.log('\nReport complete. No DB changes were made.');

  } catch (error) {
    console.error('Error running report:', error.message || error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runReport();
