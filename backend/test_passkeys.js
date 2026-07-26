require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const users = await User.find({'passkeys.0': {$exists: true}});
  console.log('Users with passkeys:', users.length);
  users.forEach(u => {
    console.log('Email:', u.email);
    u.passkeys.forEach(p => {
      console.log(' - ID (base64url):', p.credentialID.toString('base64url'));
      console.log(' - ID (base64):', p.credentialID.toString('base64'));
    });
  });
  process.exit(0);
});
