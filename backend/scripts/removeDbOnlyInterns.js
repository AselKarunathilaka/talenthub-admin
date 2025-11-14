/*
  removeDbOnlyInterns.js

  Safe utility to remove interns present in DB but not present in SLT API.
  - Supports --dry to only list the candidates
  - Supports --apply to actually delete

  Usage (PowerShell):
    $env:MONGO_URI='...'; $env:TRAINEES_API_SECRET_KEY='...'; node .\backend\scripts\removeDbOnlyInterns.js --dry
    node .\backend\scripts\removeDbOnlyInterns.js --apply

  NOTE: This is destructive when --apply is used. Create a DB backup before applying.
*/

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const SLTApiService = require('../services/sltApiService');
const Intern = require('../models/Intern');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry');
const apply = args.includes('--apply');

if (!dryRun && !apply) {
  console.error('Specify --dry to preview or --apply to delete. Exiting.');
  process.exit(1);
}

async function connectDb() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not provided. Set $env:MONGO_URI in PowerShell or add backend/.env');
    process.exit(1);
  }
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
}

async function run() {
  await connectDb();
  try {
    console.log('Fetching active trainees from SLT API...');
    const apiTrainees = await SLTApiService.fetchActiveTrainees();
    const apiIds = new Set(apiTrainees.map(t => (t.Trainee_ID || t.traineeId || '').toString()).filter(Boolean));

    console.log('Fetching interns from DB...');
    const dbInterns = await Intern.find();

    const dbOnly = dbInterns.filter(i => {
      const id = (i.Trainee_ID || '').toString();
      return id && !apiIds.has(id);
    });

    console.log(`Found ${dbOnly.length} DB-only interns (not present in API)`);

    if (dbOnly.length === 0) {
      console.log('Nothing to do.');
      return;
    }

    dbOnly.forEach(i => console.log(`- ${i.Trainee_ID}: ${i.Trainee_Name} (${i.Trainee_Email || 'No email'})`));

    if (dryRun) {
      console.log('\nDry-run mode: no deletions performed.');
      return;
    }

    if (apply) {
      console.log('\nApplying deletions...');
      for (const i of dbOnly) {
        try {
          await Intern.findByIdAndDelete(i._id);
          console.log(`Deleted: ${i.Trainee_ID} - ${i.Trainee_Name}`);
        } catch (err) {
          console.error(`Failed to delete ${i.Trainee_ID}:`, err.message || err);
        }
      }
      console.log('Deletion complete.');
    }

  } catch (err) {
    console.error('Error:', err.message || err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
