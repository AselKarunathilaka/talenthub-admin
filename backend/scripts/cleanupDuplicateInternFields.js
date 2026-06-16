/*
  Cleanup duplicated API-named fields saved on the Intern documents.
  - Dry-run by default: shows what it would change
  - Use --apply to perform updates

  Fields cleaned:
    Trainee_ID -> traineeId
    Trainee_Name -> traineeName
    Trainee_HomeAddress -> homeAddress
    Training_StartDate -> trainingStartDate
    Training_EndDate -> trainingEndDate
    Trainee_Email -> email
    Institute -> institute
    field_of_spec_name -> fieldOfSpecialization

  Usage:
    node cleanupDuplicateInternFields.js          # dry-run
    node cleanupDuplicateInternFields.js --apply  # actually perform updates
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

  const interns = await Intern.find().lean();
  console.log(`Found ${interns.length} interns`);

  let changes = 0;

  for (const doc of interns) {
    const updates = {};
    const unset = {};

    // helper to prefer camelCase value; if missing, take API field value
    function chooseAndPrepare(apiKey, camelKey) {
      const apiVal = doc[apiKey];
      const camelVal = doc[camelKey];

      if (apiVal === undefined) return;

      // If camel exists and equals API value -> just unset the API key
      if (camelVal !== undefined) {
        // if they differ, prefer camel (assume camel is canonical)
        if (String(camelVal) !== String(apiVal)) {
          // keep camel, unset api
          unset[apiKey] = "";
          return;
        }
        // equal -> only unset apiKey
        unset[apiKey] = "";
        return;
      }

      // camel missing, use api value to set camel and unset api
      updates[camelKey] = apiVal;
      unset[apiKey] = "";
    }

    chooseAndPrepare('Trainee_ID', 'traineeId');
    chooseAndPrepare('Trainee_Name', 'traineeName');
    chooseAndPrepare('Trainee_HomeAddress', 'homeAddress');
    chooseAndPrepare('Training_StartDate', 'trainingStartDate');
    chooseAndPrepare('Training_EndDate', 'trainingEndDate');
    chooseAndPrepare('Trainee_Email', 'email');
    chooseAndPrepare('Institute', 'institute');
    chooseAndPrepare('field_of_spec_name', 'fieldOfSpecialization');

    // If there are updates or unsets
    if (Object.keys(updates).length || Object.keys(unset).length) {
      changes++;
      console.log('\n--- Document _id:', doc._id, '---');
      if (Object.keys(updates).length) {
        console.log('Will set: ', updates);
      }
      if (Object.keys(unset).length) {
        console.log('Will unset: ', Object.keys(unset));
      }

      if (apply) {
        try {
          const setPart = Object.keys(updates).length ? { $set: updates } : {};
          const unsetPart = Object.keys(unset).length ? { $unset: unset } : {};
          const op = Object.assign({}, setPart, unsetPart);
          await Intern.updateOne({ _id: doc._id }, op);
          console.log('Applied');
        } catch (err) {
          console.error('Failed to apply update for', doc._id, err.message);
        }
      }
    }
  }

  console.log('\nTotal documents with changes:', changes);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Error in cleanup script', err);
  process.exit(1);
});
