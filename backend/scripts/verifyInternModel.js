const mongoose = require('mongoose');
const path = require('path');

// Load env if present
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const Intern = require('../models/Intern');

async function run() {
  try {
    // don't actually connect to DB if MONGO_URI isn't set to avoid delays
    const mongoUri = process.env.MONGO_URI;
    if (mongoUri) {
      await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
      console.log('Connected to MongoDB for verification.');
    } else {
      console.log('No MONGO_URI found, skipping DB connect (offline verification).');
    }

    console.log('\nSchema paths:');
    console.log(Object.keys(Intern.schema.paths).sort().join(', '));

    const sample = new Intern({
      Trainee_ID: '2438',
      Trainee_Name: 'J.M. Nandun Deepaka Jayamanna',
      Trainee_HomeAddress: 'Jayamanna Walawwa, Pathakada, Pelmadulla',
      Training_StartDate: '2024-11-20',
      Training_EndDate: '2025-10-20',
      Trainee_Email: 'nandundeepaka@gmail.com',
      Institute: 'Informatics Institute of Technology',
      field_of_spec_name: 'Python'
    });

    console.log('\nSample object (toJSON):');
    console.log(JSON.stringify(sample.toJSON(), null, 2));

    if (mongoUri) await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Verification script error:', err);
    process.exit(1);
  }
}

run();
