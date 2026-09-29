const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const Staff = require("./models/Staff");
const User = require("./models/User");
const { permissionsForRole } = require("./config/adminPermissions");

async function main() {
  const emailArg = process.argv[2];
  const roleArg = process.argv[3] || "super_admin";
  const nameArg = process.argv[4] || "Administrator";

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("❌ MONGO_URI missing in .env");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB.");

  const emailsToAuthorize = [];
  if (emailArg) {
    emailsToAuthorize.push(emailArg.trim().toLowerCase());
  } else {
    // If no argument, add standard admins from .env
    const superAdmin = (process.env.SUPER_ADMIN_EMAIL || "superadmin@slt.lk").trim().toLowerCase();
    const testAdmin = (process.env.TEST_ADMIN_EMAIL || "admin@slt.lk").trim().toLowerCase();
    emailsToAuthorize.push(superAdmin);
    if (!emailsToAuthorize.includes(testAdmin)) emailsToAuthorize.push(testAdmin);
    console.log("ℹ️  No email provided. Defaulting to .env admins:", emailsToAuthorize.join(", "));
    console.log("👉 To authorize your specific Google account, run: node add_authorized_staff.js your.email@gmail.com\n");
  }

  for (const email of emailsToAuthorize) {
    console.log(`\n--- Authorizing: ${email} ---`);

    // 1. Ensure Staff record exists
    let staff = await Staff.findOne({
      $or: [
        { email },
        { email: { $regex: `^${email}$`, $options: "i" } }
      ]
    });

    if (!staff) {
      staff = new Staff({
        name: nameArg,
        email: email,
        role: roleArg
      });
      await staff.save();
      console.log(`✅ Created Staff record for ${email} with role: ${roleArg}`);
    } else {
      staff.role = roleArg;
      await staff.save();
      console.log(`✅ Staff record already existed, updated role to: ${roleArg}`);
    }

    // 2. Ensure User record exists
    let user = await User.findOne({
      $or: [
        { email },
        { email: { $regex: `^${email}$`, $options: "i" } }
      ]
    });

    if (!user) {
      user = new User({
        name: nameArg,
        email: email,
        role: roleArg,
        authProvider: "google",
        isActive: true,
        permissions: permissionsForRole(roleArg)
      });
      await user.save();
      console.log(`✅ Created User record in 'staff' collection for ${email}`);
    } else {
      user.role = roleArg;
      user.isActive = true;
      user.permissions = permissionsForRole(roleArg);
      await user.save();
      console.log(`✅ User record updated in 'staff' collection for ${email}`);
    }
  }

  console.log("\n🎉 Done! You can now log in using Google Sign-In with this account at /admin-login.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error authorizing staff:", err.message);
  process.exit(1);
});
