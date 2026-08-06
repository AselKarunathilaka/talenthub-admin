require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const InactiveIntern = mongoose.connection.db.collection('inactiveinterns');
  
  const interns = await InactiveIntern.find({}, { projection: { Trainee_ID: 1, Trainee_Name: 1, googlePictureUrl: 1 } }).limit(5).toArray();
  console.log("Inactive interns:");
  console.log(JSON.stringify(interns, null, 2));

  const Intern = mongoose.connection.db.collection('interns');
  const active = await Intern.find({ logbookRestricted: true }, { projection: { Trainee_ID: 1, Trainee_Name: 1, googlePictureUrl: 1 } }).limit(5).toArray();
  console.log("Restricted interns:");
  console.log(JSON.stringify(active, null, 2));

  process.exit(0);
}
run();
