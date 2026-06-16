const mongoose = require('mongoose');
require('dotenv').config();

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
}, { collection: 'users' });

const User = mongoose.model('User', userSchema);

const main = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/talenthub_dev';
    await mongoose.connect(mongoUri);
    
    const admin = await User.findOne({ email: 'admin@slt.lk' });
    
    if (admin) {
      console.log('✅ Admin found in database');
      console.log('Email:', admin.email);
      console.log('Password hash exists:', admin.password ? 'Yes' : 'No');
      console.log('Password hash length:', admin.password ? admin.password.length : 0);
    } else {
      console.log('❌ Admin not found');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
};

main();
