/*
  Batched sync from SLT API using bulkWrite upserts to avoid per-doc timeouts.
  - Dry-run optional with --dry flag (prints what would change but doesn't write).
  - Use --batch=N to change batch size (default 100).

  Usage:
    node batchedSyncSLT.js          # run write
    node batchedSyncSLT.js --dry    # dry-run
    node batchedSyncSLT.js --batch=200
*/

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const SLTApiService = require('../services/sltApiService');
const Intern = require('../models/Intern');
const InternRepository = require('../repositories/internRepository');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry');
let batchSize = 100;
for (const a of args) {
  if (a.startsWith('--batch=')) {
    const v = parseInt(a.split('=')[1], 10);
    if (!isNaN(v) && v > 0) batchSize = v;
  }
}

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI missing in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  try {
    const apiTrainees = await SLTApiService.fetchActiveTrainees();
    console.log(`Fetched ${apiTrainees.length} trainees from SLT API`);

    const mapped = SLTApiService.mapToInternSchema(apiTrainees);
    console.log(`Mapped to ${mapped.length} internal objects`);

    const opsBatches = [];
    let totalOps = 0;

    for (const m of mapped) {
      // normalize to API-style keys (Trainee_ID etc.) using repository helper
      const apiDoc = InternRepository.normalizeToApiFields(m);
      // ensure Trainee_ID exists
      const traineeId = (apiDoc.Trainee_ID || apiDoc.traineeId || apiDoc.Trainee_ID)?.toString();
      if (!traineeId) continue; // skip

      // Build $set only for fields we want to sync
      const setObj = {};
      const keysToSet = ['Trainee_ID','Trainee_Name','Trainee_HomeAddress','Training_StartDate','Training_EndDate','Trainee_Email','Institute','field_of_spec_name'];
      for (const k of keysToSet) {
        if (apiDoc[k] !== undefined) setObj[k] = apiDoc[k];
      }

      // Keep attendance/team/availableDays untouched by sync (not overwritten)

      const op = {
        updateOne: {
          filter: { Trainee_ID: traineeId },
          update: { $set: setObj },
          upsert: true
        }
      };

      opsBatches.push(op);
      totalOps++;
    }

    console.log(`Prepared ${totalOps} bulk ops; running in batches of ${batchSize}`);

    let added = 0, modified = 0, upserted = 0;
    for (let i = 0; i < opsBatches.length; i += batchSize) {
      const batch = opsBatches.slice(i, i + batchSize);
      if (dryRun) {
        console.log(`Dry-run: would execute batch ${i/batchSize + 1} with ${batch.length} ops`);
        continue;
      }
      const res = await Intern.bulkWrite(batch, { ordered: false });
      // res contains nModified, nUpserted etc depending on driver version
      if (res) {
        modified += res.modifiedCount || res.nModified || 0;
        upserted += (res.upsertedCount || res.nUpserted || 0);
      }
      console.log(`Executed batch ${i/batchSize + 1}: modified ${res.modifiedCount||res.nModified||0}, upserted ${res.upsertedCount||res.nUpserted||0}`);
    }

    console.log('Sync complete');
    console.log({ totalPrepared: totalOps, modified, upserted, dryRun });

  } catch (err) {
    console.error('Error during batched sync', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
