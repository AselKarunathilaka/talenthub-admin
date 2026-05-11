const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
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
    
    // Delete existing admin
    await User.deleteOne({ email: 'admin@slt.lk' });
    console.log('Deleted old admin');
    
    // Hash password manually
    const plainPassword = 'Admin@123';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    
    // Create new admin with pre-hashed password
    const admin = new User({
      email: 'admin@slt.lk',
      password: hashedPassword
    });
    
    // Save without triggering pre-save hook
    await User.collection.insertOne({
      email: 'admin@slt.lk',
      password: hashedPassword
    });
    
    console.log('✅ Admin created with hashed password');
    console.log('📧 Email: admin@slt.lk');
    console.log('🔐 Password: Admin@123');
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
};

main();
