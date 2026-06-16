const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const Intern = require('../models/Intern');

async function run() {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: node inspectIntern.js <_id>');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const doc = await Intern.collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
  if (!doc) {
    console.log('Not found');
  } else {
    const keys = Object.keys(doc).sort();
    console.log('Keys:', keys);
    const camel = ['traineeId','traineeName','homeAddress','trainingStartDate','trainingEndDate','email','institute','fieldOfSpecialization'];
    const present = camel.filter(k => Object.prototype.hasOwnProperty.call(doc, k));
    console.log('Camel present:', present);
  }
  await mongoose.disconnect();
}
run().catch(e => { console.error(e); process.exit(1); });
