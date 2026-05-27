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
    console.log('✅ Connected to MongoDB');
    
    const email = 'admin@slt.lk';
    const password = 'Admin@123';
    
    // Check if admin exists
    const existing = await User.findOne({ email });
    if (existing) {
      console.log('✅ Admin already exists');
      process.exit(0);
    }
    
    // Create admin using model (which auto-hashes password via pre-save hook)
    const admin = new User({ email, password });
    await admin.save();
    
    console.log('✅ Admin user created!');
    console.log('📧 Email: admin@slt.lk');
    console.log('🔐 Password: Admin@123');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

main();
