require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  let user = await User.findOne({email: 'superadmin@slt.lk'});
  if (!user) return console.log("User not found");
  
  user.currentChallenge = "test_challenge_123";
  await user.save();
  console.log("Saved challenge");

  const checkUser = await User.findOne({email: 'superadmin@slt.lk'}).select('+currentChallenge');
  console.log("Read challenge:", checkUser.currentChallenge);

  process.exit(0);
});
