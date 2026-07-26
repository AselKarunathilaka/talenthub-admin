require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  let user = await User.findOne({email: 'superadmin@slt.lk'}).select('+currentChallenge');
  console.log("Read challenge:", user.currentChallenge);

  process.exit(0);
});
