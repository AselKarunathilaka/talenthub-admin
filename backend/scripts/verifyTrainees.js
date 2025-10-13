const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const Intern = require('../models/Intern');

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['2438','2439','2538','2614','2720'];

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI missing in backend/.env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    for (const id of ids) {
      const doc = await Intern.findOne({ Trainee_ID: id }).lean();
      console.log('\n--- Trainee_ID:', id, '---');
      if (!doc) {
        console.log('Not found');
        continue;
      }
      const out = {
        Trainee_ID: doc.Trainee_ID,
        Trainee_Name: doc.Trainee_Name,
        field_of_spec_name: doc.field_of_spec_name,
        Training_StartDate: doc.Training_StartDate,
        Training_EndDate: doc.Training_EndDate,
        Trainee_Email: doc.Trainee_Email,
        Institute: doc.Institute,
        // show if camelCase still present
        traineeId: doc.traineeId,
        traineeName: doc.traineeName,
        fieldOfSpecialization: doc.fieldOfSpecialization,
        trainingStartDate: doc.trainingStartDate,
        trainingEndDate: doc.trainingEndDate,
        email: doc.email,
        institute: doc.institute,
        homeAddress: doc.Trainee_HomeAddress || doc.homeAddress || ''
      };
      console.log(JSON.stringify(out, null, 2));
    }
  } catch (err) {
    console.error('Error verifying trainees', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
