const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');

const main = async () => {
  const client = new MongoClient('mongodb://127.0.0.1:27017/talenthub_dev');
  try {
    await client.connect();
    const db = client.db('talenthub_dev');
    
    const adminEmail = 'admin@slt.lk';
    const adminPassword = 'Admin@123';
    
    // Check if admin already exists
    const existingAdmin = await db.collection('users').findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log('✅ Admin already exists: admin@slt.lk');
      await client.close();
      return;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    // Create admin user
    const result = await db.collection('users').insertOne({
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
      createdAt: new Date(),
      isActive: true
    });
    
    console.log('✅ Admin user created!');
    console.log('📧 Email: admin@slt.lk');
    console.log('🔐 Password: Admin@123');
    
    await client.close();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

main();
