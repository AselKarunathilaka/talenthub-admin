/*
  Migrate documents that currently store camelCase fields (traineeId, traineeName, etc.)
  to API-style canonical fields (Trainee_ID, Trainee_Name, field_of_spec_name, ...).

  Dry-run by default. Use --apply to perform updates.

  Usage:
    node migrateToApiFields.js
    node migrateToApiFields.js --apply
*/

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const Intern = require('../models/Intern');

const apply = process.argv.includes('--apply');

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not found in .env — cannot connect to DB.');
    process.exit(1);
  }

  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to DB');

  // Find documents that have either camelCase fields or the old API fields
  const cursor = Intern.find({ $or: [
    { traineeId: { $exists: true } },
    { traineeName: { $exists: true } },
    { fieldOfSpecialization: { $exists: true } },
    { trainingStartDate: { $exists: true } },
    { trainingEndDate: { $exists: true } }
  ]}).cursor();

  let count = 0;
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    count++;
    const updates = {};
    const unset = {};
    const docObj = doc.toObject({ minimize: false });
    const hasOwn = (k) => Object.prototype.hasOwnProperty.call(docObj, k);

    // prefer existing API fields; if missing, copy from camelCase
  if (!doc.Trainee_ID && hasOwn('traineeId')) updates.Trainee_ID = docObj.traineeId;
  if (!doc.Trainee_Name && hasOwn('traineeName')) updates.Trainee_Name = docObj.traineeName;
  if (!doc.Trainee_HomeAddress && hasOwn('homeAddress')) updates.Trainee_HomeAddress = docObj.homeAddress;
  if (!doc.Training_StartDate && hasOwn('trainingStartDate')) updates.Training_StartDate = docObj.trainingStartDate;
  if (!doc.Training_EndDate && hasOwn('trainingEndDate')) updates.Training_EndDate = docObj.trainingEndDate;
  if (!doc.Trainee_Email && hasOwn('email')) updates.Trainee_Email = docObj.email;
  if (!doc.Institute && hasOwn('institute')) updates.Institute = docObj.institute;
  if (!doc.field_of_spec_name && hasOwn('fieldOfSpecialization')) updates.field_of_spec_name = docObj.fieldOfSpecialization;

    // If camelCase exists, schedule it to be removed after migration
  if (hasOwn('traineeId')) unset.traineeId = "";
  if (hasOwn('traineeName')) unset.traineeName = "";
  if (hasOwn('homeAddress')) unset.homeAddress = "";
  if (hasOwn('trainingStartDate')) unset.trainingStartDate = "";
  if (hasOwn('trainingEndDate')) unset.trainingEndDate = "";
  if (hasOwn('email')) unset.email = "";
  if (hasOwn('institute')) unset.institute = "";
  if (hasOwn('fieldOfSpecialization')) unset.fieldOfSpecialization = "";

    if (Object.keys(updates).length === 0 && Object.keys(unset).length === 0) continue;

    console.log('\nDoc _id:', doc._id);
    if (Object.keys(updates).length) console.log(' Will set:', updates);
    if (Object.keys(unset).length) console.log(' Will unset:', Object.keys(unset));

    if (apply) {
      const op = {};
      if (Object.keys(updates).length) op['$set'] = updates;
      if (Object.keys(unset).length) op['$unset'] = unset;

      try {
        await Intern.updateOne({ _id: doc._id }, op);
        console.log(' Applied.');
      } catch (err) {
        console.error(' Failed to apply for', doc._id, err.message);
      }
    }
  }

  console.log('\nProcessed docs:', count);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Migration error', err);
  process.exit(1);
});
