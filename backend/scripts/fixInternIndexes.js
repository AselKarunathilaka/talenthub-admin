/*
  Fix legacy indexes on Intern collection.
  - Drops legacy unique index on `traineeId`
  - Ensures unique index exists on `Trainee_ID`
  Usage:
    node scripts/fixInternIndexes.js           # dry-run (default)
    node scripts/fixInternIndexes.js --apply   # apply changes
*/

const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const connectDB = require('../config/database');
const Intern = require('../models/Intern');

async function run(apply = false) {
  await connectDB();
  const col = Intern.collection;

  console.log(`\n🔎 Inspecting indexes for collection: ${col.collectionName}`);
  const indexes = await col.indexes();
  indexes.forEach((idx, i) => {
    console.log(`  [${i}] name=${idx.name} keys=${JSON.stringify(idx.key)} unique=${!!idx.unique}`);
  });

  const hasLegacy = indexes.find(i => i.name === 'traineeId_1');
  const hasCanonical = indexes.find(i => i.name === 'Trainee_ID_1' && i.unique);

  const plan = {
    dropLegacy: !!hasLegacy,
    createCanonical: !hasCanonical
  };

  console.log('\n📝 Plan:', plan);

  if (!apply) {
    console.log('\nDry-run mode. No changes applied. To apply, run with --apply');
    await mongoose.connection.close();
    return;
  }

  // Apply changes
  if (plan.dropLegacy) {
    try {
      console.log('🗑️  Dropping legacy index traineeId_1 ...');
      await col.dropIndex('traineeId_1');
      console.log('✅ Dropped traineeId_1');
    } catch (e) {
      console.error('❌ Failed to drop traineeId_1:', e.message);
    }
  } else {
    console.log('ℹ️  No legacy index traineeId_1 found.');
  }

  if (plan.createCanonical) {
    try {
      console.log('🔧 Creating unique index on Trainee_ID ...');
      await col.createIndex({ Trainee_ID: 1 }, { unique: true, name: 'Trainee_ID_1' });
      console.log('✅ Created unique index Trainee_ID_1');
    } catch (e) {
      console.error('❌ Failed to create Trainee_ID_1:', e.message);
    }
  } else {
    console.log('ℹ️  Unique index on Trainee_ID already exists.');
  }

  // Show indexes after
  const after = await col.indexes();
  console.log('\n📋 Indexes after changes:');
  after.forEach((idx, i) => {
    console.log(`  [${i}] name=${idx.name} keys=${JSON.stringify(idx.key)} unique=${!!idx.unique}`);
  });

  await mongoose.connection.close();
}

const apply = process.argv.includes('--apply');
run(apply).catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
