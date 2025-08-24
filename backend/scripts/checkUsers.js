const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Show all users
    const users = await User.find({});
    console.log('📦 All users in database:');
    users.forEach(user => {
      console.log(`➡️ Email: ${user.email}, Password hash: ${user.password}`);
    });

    // Create or update admin@slt.lk
    const existingAdmin = await User.findOne({ email: 'admin@slt.lk' });
    if (!existingAdmin) {
      const newAdmin = new User({
        email: 'admin@slt.lk',
        password: 'admin123' // plain text — model will hash it
      });
      await newAdmin.save();
      console.log('🆕 New admin user created: admin@slt.lk');
    } else {
      existingAdmin.password = 'admin123'; // plain text
      await existingAdmin.save();
      console.log('🔁 Admin password updated: admin@slt.lk');
    }

    // Create or update jana@slt.com.lk
    const existingJanaAdmin = await User.findOne({ email: 'jana@slt.com.lk' });
    if (!existingJanaAdmin) {
      const newJanaAdmin = new User({
        email: 'jana@slt.com.lk',
        password: 'jana1234' // plain text
      });
      await newJanaAdmin.save();
      console.log('🆕 New admin user created: jana@slt.com.lk');
    } else {
      existingJanaAdmin.password = 'jana1234'; // plain text
      await existingJanaAdmin.save();
      console.log('🔁 Admin password updated: jana@slt.com.lk');
    }

    // Create or update mgiri@slt.com.lk
    const existingMgiriAdmin = await User.findOne({ email: 'mgiri@slt.com.lk' });
    if (!existingMgiriAdmin) {
      const newMgiriAdmin = new User({
        email: 'mgiri@slt.com.lk',
        password: 'slt123' // plain text
      });
      await newMgiriAdmin.save();
      console.log('🆕 New admin user created: mgiri@slt.com.lk');
    } else {
      existingMgiriAdmin.password = 'slt123'; // plain text
      await existingMgiriAdmin.save();
      console.log('🔁 Admin password updated: mgiri@slt.com.lk');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB disconnected');
  }
}

checkUsers();
