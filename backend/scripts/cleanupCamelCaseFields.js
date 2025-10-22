/*
  Find and optionally remove camelCase fields from Intern documents.
  Dry-run by default. Use --apply to perform removal.

  Fields removed (legacy camelCase only, excluding 'team'):
    traineeId, traineeName, homeAddress, trainingStartDate, trainingEndDate,
    email, institute, fieldOfSpecialization

  Usage:
    node cleanupCamelCaseFields.js          # dry-run
    node cleanupCamelCaseFields.js --apply  # actually perform updates
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

  const camelFields = [
    'traineeId','traineeName','homeAddress','trainingStartDate','trainingEndDate',
    'email','institute','fieldOfSpecialization'
  ];

  // find documents that have any of these fields
  const query = { $or: camelFields.map(f => ({ [f]: { $exists: true } })) };
  const docs = await Intern.find(query).select('_id Trainee_ID').lean();

  console.log(`Found ${docs.length} documents containing camelCase fields.`);
  if (docs.length > 0) {
    console.log('Sample ids:', docs.slice(0, 20).map(d => d._id.toString()).join(', '));
  }

  if (!apply) {
    console.log('\nDry-run only. To remove camelCase fields run with --apply');
    await mongoose.disconnect();
    process.exit(0);
  }

  // build unset object
  const unsetObj = {};
  camelFields.forEach(f => unsetObj[f] = "");

  // Use raw collection to bypass Mongoose strict mode and ensure $unset on non-schema fields
  const result = await Intern.collection.updateMany(query, { $unset: unsetObj });
  console.log(`Applied: matched ${result.matchedCount ?? result.matched}, modified ${result.modifiedCount ?? result.modifiedCount}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Error', err);
  process.exit(1);
});
