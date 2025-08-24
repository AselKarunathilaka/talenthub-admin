const mongoose = require("mongoose");
const UserRepository = require("../repositories/userRepository");
require("../config/dotenv");

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

// Create admin user
const createAdminUser = async () => {
  try {
    console.log("Creating admin user...");

    // Check if admin already exists
    const existingAdmin = await UserRepository.findByEmail("admin@slt.lk");
    if (existingAdmin) {
      console.log("Admin user already exists!");
      console.log("Email: admin@slt.lk");
      console.log("You can change the password if needed.");
    } else {
      // Create new admin user
      const adminUser = await UserRepository.createAdmin(
        "admin@slt.lk",
        "admin123",
        "System Administrator"
      );

      console.log("Admin user created successfully!");
      console.log("Admin Credentials:");
      console.log("Email: admin@slt.lk");
      console.log("Password: admin123");
      console.log("Role: admin");
      console.log("Please change the default password after first login.");
    }

    // Check if the new admin already exists
    const existingJanaAdmin = await UserRepository.findByEmail("jana@slt.com.lk");
    if (existingJanaAdmin) {
      console.log("Admin user already exists!");
      console.log("Email: jana@slt.com.lk");
      console.log("You can change the password if needed.");
    } else {
      // Create new admin user
      const janaAdminUser = await UserRepository.createAdmin(
        "jana@slt.com.lk",
        "jana1234",
        "System Administrator"
      );

      console.log("Admin user created successfully!");
      console.log("Admin Credentials:");
      console.log("Email: jana@slt.com.lk");
      console.log("Password: jana1234");
      console.log("Role: admin");
      console.log("Please change the default password after first login.");
    }

    // Check if the new admin already exists
    const existingMgiriAdmin = await UserRepository.findByEmail("mgiri@slt.com.lk");
    if (existingMgiriAdmin) {
      console.log("Admin user already exists!");
      console.log("Email: mgiri@slt.com.lk");
      console.log("You can change the password if needed.");
    } else {
      // Create new admin user
      const mgiriAdminUser = await UserRepository.createAdmin(
        "mgiri@slt.com.lk",
        "slt123",
        "System Administrator"
      );

      console.log("Admin user created successfully!");
      console.log("Admin Credentials:");
      console.log("Email: mgiri@slt.com.lk");
      console.log("Password: slt123");
      console.log("Role: admin");
      console.log("Please change the default password after first login.");
    }

  } catch (error) {
    console.error("Error creating admin user:", error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await createAdminUser();
  mongoose.connection.close();
  console.log("Database connection closed.");
};

// Run the script
main().catch(console.error);
