const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

async function seed() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("❌ MONGO_URI is missing in environment variables!");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("✅ Connected to MongoDB");

  const User = require("../models/User");
  const Intern = require("../models/Intern");
  const GateStaff = require("../models/GateStaff");

  // 1. Admin account: admin@slt.lk
  const adminHashedPassword = await bcrypt.hash("Admin123", 10);
  let adminUser = await User.findOne({ email: "admin@slt.lk" });
  if (adminUser) {
    adminUser.password = "Admin123"; // pre-save hook will hash it
    adminUser.role = "super_admin";
    adminUser.isActive = true;
    adminUser.authProvider = "developer_password";
    await adminUser.save();
    console.log("✅ Updated admin@slt.lk (Password: Admin123)");
  } else {
    adminUser = new User({
      name: "Admin",
      email: "admin@slt.lk",
      password: "Admin123",
      role: "super_admin",
      isActive: true,
      authProvider: "developer_password",
    });
    await adminUser.save();
    console.log("✅ Created admin@slt.lk (Password: Admin123)");
  }

  // 2. SuperAdmin account: superadmin@slt.lk
  let superAdminUser = await User.findOne({ email: "superadmin@slt.lk" });
  if (superAdminUser) {
    superAdminUser.password = "Admin123";
    superAdminUser.role = "super_admin";
    superAdminUser.isActive = true;
    superAdminUser.authProvider = "developer_password";
    await superAdminUser.save();
    console.log("✅ Updated superadmin@slt.lk (Password: Admin123)");
  } else {
    superAdminUser = new User({
      name: "Super Admin",
      email: "superadmin@slt.lk",
      password: "Admin123",
      role: "super_admin",
      isActive: true,
      authProvider: "developer_password",
    });
    await superAdminUser.save();
    console.log("✅ Created superadmin@slt.lk (Password: Admin123)");
  }

  // 3. Gate Staff account: gatestaff@slt.lk
  let gateStaff = await GateStaff.findOne({ email: "gatestaff@slt.lk" });
  if (gateStaff) {
    gateStaff.password = "GateStaff@123";
    gateStaff.isActive = true;
    await gateStaff.save();
    console.log("✅ Updated gatestaff@slt.lk (Password: GateStaff@123)");
  } else {
    gateStaff = new GateStaff({
      email: "gatestaff@slt.lk",
      password: "GateStaff@123",
      isActive: true,
    });
    await gateStaff.save();
    console.log("✅ Created gatestaff@slt.lk (Password: GateStaff@123)");
  }

  // 4. Test Intern account: intern@slt.lk
  const internHashedPassword = await bcrypt.hash("Intern@123", 10);
  let testIntern = await Intern.findOne({
    $or: [{ Trainee_Email: "intern@slt.lk" }, { Trainee_ID: "TEST001" }],
  });

  if (testIntern) {
    testIntern.Trainee_ID = "TEST001";
    testIntern.Trainee_Name = "Test Intern";
    testIntern.Trainee_Email = "intern@slt.lk";
    testIntern.password = internHashedPassword;
    testIntern.isTestAccount = true;
    testIntern.field_of_spec_name = "Software Engineering";
    testIntern.agreementAccepted = true;
    testIntern.talentHubRestricted = false;
    await testIntern.save();
    console.log("✅ Updated intern@slt.lk (ID: TEST001, Password: Intern@123)");
  } else {
    testIntern = new Intern({
      Trainee_ID: "TEST001",
      Trainee_Name: "Test Intern",
      Trainee_Email: "intern@slt.lk",
      password: internHashedPassword,
      isTestAccount: true,
      field_of_spec_name: "Software Engineering",
      Institute: "SLT Training Centre",
      Training_StartDate: new Date(),
      Training_EndDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      agreementAccepted: true,
      talentHubRestricted: false,
    });
    await testIntern.save();
    console.log("✅ Created intern@slt.lk (ID: TEST001, Password: Intern@123)");
  }

  console.log("\n==========================================");
  console.log("All test login accounts ready!");
  console.log("1. Admin: admin@slt.lk / Admin123");
  console.log("2. Super Admin: superadmin@slt.lk / Admin123");
  console.log("3. Gate Staff: gatestaff@slt.lk / GateStaff@123");
  console.log("4. Intern: intern@slt.lk (or TEST001) / Intern@123");
  console.log("==========================================\n");

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding error:", err);
  process.exit(1);
});
