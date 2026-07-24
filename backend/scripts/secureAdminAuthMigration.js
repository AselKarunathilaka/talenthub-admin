require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const { permissionsForRole, permissionsForUser } = require("../config/adminPermissions");

const run = async () => {
  const email = String(process.env.SUPER_ADMIN_EMAIL || "superadmin@slt.lk").trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const testingAdminEmail = String(process.env.TEST_ADMIN_EMAIL || "").trim().toLowerCase();
  const testingAdminPassword = process.env.TEST_ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("Set SUPER_ADMIN_PASSWORD to a new password of at least 12 characters.");
  }
  if (testingAdminEmail && (!testingAdminPassword || testingAdminPassword.length < 12)) {
    throw new Error("Set TEST_ADMIN_PASSWORD to a new password of at least 12 characters.");
  }
  if (testingAdminEmail && testingAdminEmail === email) {
    throw new Error("TEST_ADMIN_EMAIL must be different from SUPER_ADMIN_EMAIL.");
  }

  await mongoose.connect(process.env.MONGO_URI);
  let superAdmin = await User.findOne({ email }).select("+password");
  if (!superAdmin) superAdmin = new User({ email });
  superAdmin.name = superAdmin.name || "Developer Super Administrator";
  superAdmin.password = password;
  superAdmin.role = "super_admin";
  superAdmin.authProvider = "developer_password";
  superAdmin.permissions = permissionsForRole("super_admin");
  superAdmin.isActive = true;
  await superAdmin.save();

  let testingAdmin = null;
  if (testingAdminEmail) {
    testingAdmin = await User.findOne({ email: testingAdminEmail }).select("+password");
    if (!testingAdmin) testingAdmin = new User({ email: testingAdminEmail });
    testingAdmin.name = "Program Administrator";
    testingAdmin.password = testingAdminPassword;
    testingAdmin.role = "admin";
    testingAdmin.authProvider = "developer_password";
    testingAdmin.permissions = permissionsForUser(testingAdmin, permissionsForRole("admin"));
    testingAdmin.isActive = true;
    await testingAdmin.save();
  }

  const supervisorPermissionUpdate = await User.updateMany(
    { role: "supervisor", permissions: "leave.manage" },
    { $pull: { permissions: "leave.manage" } },
  );

  let deactivated = 0;
  if (process.env.CONFIRM_DEACTIVATE_LEGACY_USERS === "yes") {
    const result = await User.updateMany(
      {
        _id: { $nin: [superAdmin._id, testingAdmin?._id].filter(Boolean) },
        authProvider: { $ne: "google" },
      },
      { $set: { isActive: false, role: "supervisor", permissions: [] } },
    );
    deactivated = result.modifiedCount;
  }

  console.log(`Developer super admin ready: ${email}`);
  if (testingAdmin) console.log(`Testing admin ready: ${testingAdminEmail}`);
  console.log(`Supervisors changed to leave view-only: ${supervisorPermissionUpdate.modifiedCount}`);
  console.log(`Legacy accounts deactivated: ${deactivated}`);
  if (process.env.CONFIRM_DEACTIVATE_LEGACY_USERS !== "yes") {
    console.log("Legacy accounts were not changed. Set CONFIRM_DEACTIVATE_LEGACY_USERS=yes to deactivate them.");
  }
};

run()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
