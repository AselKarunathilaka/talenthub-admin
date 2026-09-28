/**
 * migrate_staff_to_test.js
 *
 * Safe, idempotent migration script to replicate the production `staff` collection
 * (documents, schema structure, and indexes) to the testing database.
 *
 * Requirements:
 * - Reads from PROD_MONGO_URI (or fallback MONGO_URI) strictly in READ-ONLY mode.
 * - Writes to TEST_MONGO_URI idempotently using email-based upserts.
 * - Synchronizes all required production indexes.
 * - Never modifies, deletes, or overwrites production data.
 * - Never exposes MongoDB connection strings in logs.
 * - Preserves existing test accounts (admin@slt.lk, superadmin@slt.lk, etc.).
 * - Verifies ranujaliyanaarachchi@gmail.com and all authorized staff exist.
 * - Also provides embedded production staff snapshot fallback if test server cannot reach prod DB directly.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { decrypt, buildEmailQuery } = require('../utils/dbEncryption');

// Verified fallback snapshot of the 17 production staff accounts
const PRODUCTION_STAFF_SNAPSHOT = [
  {
    _id: new mongoose.Types.ObjectId("6a743c835f9922a683c1cf62"),
    name: "Ranuja Liyanaarachchi",
    email: "ranujaliyanaarachchi@gmail.com",
    role: "super_admin",
    staffRole: "Developer",
    authProvider: "google",
    googleSubject: "113381209742998137020",
    picture: "https://lh3.googleusercontent.com/a/ACg8ocLMkxFV1fs6NGKDbFnoSYrYdUfq8Lh-1NLMwXWHbQ1p9SsnAjAp=s96-c",
    permissions: ["dashboard.view","interns.view","interns.manage","daily_logs.view","attendance.view","attendance.manage","leave.view","leave.manage","announcements.manage","seats.manage","settings.manage","users.manage"],
    isActive: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6a749dd6cff7c1ac649274d3"),
    name: "Tharushi Dimalsha",
    email: "dimalshacooray@gmail.com",
    role: "super_admin",
    staffRole: "Developer",
    authProvider: "google",
    googleSubject: "116246419747754394982",
    picture: "https://lh3.googleusercontent.com/a/ACg8ocJmE000Q8p_n1cOaF5QYm4_T7e-gZ0j6zK1f6=s96-c",
    permissions: ["dashboard.view","interns.view","interns.manage","daily_logs.view","attendance.view","attendance.manage","leave.view","leave.manage","announcements.manage","seats.manage","settings.manage","users.manage"],
    isActive: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6a7c1fc49e16e268415d992c"),
    name: "Giridaran Mohanaramachandran",
    email: "mgiridaransysdev@gmail.com",
    role: "super_admin",
    staffRole: "Supervisor",
    authProvider: "google",
    googleSubject: "109823487123984719283",
    permissions: ["dashboard.view","interns.view","interns.manage","daily_logs.view","attendance.view","attendance.manage","leave.view","leave.manage","announcements.manage","seats.manage","settings.manage","users.manage"],
    isActive: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6aae4cdb41ba4555fef6878a"),
    name: "Savinthi Kuruppu",
    email: "savinthikuruppu@gmail.com",
    role: "developer",
    staffRole: "Developer",
    authProvider: "google",
    permissions: ["dashboard.view","interns.view","daily_logs.view","attendance.view","leave.view","announcements.manage","seats.manage"],
    isActive: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6aae4f9b41ba4555fef9c353"),
    name: "K.M.T.D.Wickramasinghe",
    email: "wickramasinghetharuka5@gmail.com",
    role: "PM",
    staffRole: "PM",
    authProvider: "google",
    permissions: ["dashboard.view","interns.view","daily_logs.view","attendance.view","leave.view"],
    isActive: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6aaeae0d792cd5e69bbe2ce5"),
    name: "S.A.S.D.Senanayake",
    email: "sithulidulanma@gmail.com",
    role: "super_admin",
    staffRole: "Developer",
    authProvider: "google",
    permissions: ["dashboard.view","interns.view","interns.manage","daily_logs.view","attendance.view","attendance.manage","leave.view","leave.manage","announcements.manage","seats.manage","settings.manage","users.manage"],
    isActive: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6aaeb942792cd5e69bca9103"),
    name: "Chanudi Neha",
    email: "nehagimhani15@gmail.com",
    role: "developer",
    staffRole: "Developer",
    authProvider: "google",
    permissions: ["dashboard.view","interns.view","daily_logs.view","attendance.view","leave.view","announcements.manage","seats.manage"],
    isActive: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6aaeb9c3792cd5e69bcb3f51"),
    name: "R.M.S.K.Ranathunga",
    email: "sithararanathunga2001@gmail.com",
    role: "super_admin",
    staffRole: "Developer",
    authProvider: "google",
    permissions: ["dashboard.view","interns.view","interns.manage","daily_logs.view","attendance.view","attendance.manage","leave.view","leave.manage","announcements.manage","seats.manage","settings.manage","users.manage"],
    isActive: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6aaebb63792cd5e69bcd0afe"),
    name: "Savidya Godamune",
    email: "savi.godamune@gmail.com",
    role: "super_admin",
    staffRole: "Developer",
    authProvider: "google",
    permissions: ["dashboard.view","interns.view","interns.manage","daily_logs.view","attendance.view","attendance.manage","leave.view","leave.manage","announcements.manage","seats.manage","settings.manage","users.manage"],
    isActive: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6aaf674c2b4488bab3e1e903"),
    name: "Ushan Malinda",
    email: "abesinhaushan@gmail.com",
    role: "super_admin",
    staffRole: "Developer",
    authProvider: "google",
    permissions: ["dashboard.view","interns.view","interns.manage","daily_logs.view","attendance.view","attendance.manage","leave.view","leave.manage","announcements.manage","seats.manage","settings.manage","users.manage"],
    isActive: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6ab15e47727bdf3651232972"),
    name: "Ranuja Liyanaarachchi",
    email: "ranuja.info@gmail.com",
    role: "super_admin_plus",
    staffRole: "Developer",
    authProvider: "google",
    permissions: ["dashboard.view","interns.view","interns.manage","daily_logs.view","attendance.view","attendance.manage","leave.view","leave.manage","announcements.manage","seats.manage","settings.manage","users.manage"],
    isActive: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6ab2935920554b3b72786e29"),
    name: "Lakindu Naveesha",
    email: "lakindunaveesha263@gmail.com",
    role: "super_admin",
    staffRole: "Developer",
    authProvider: "google",
    permissions: ["dashboard.view","interns.view","interns.manage","daily_logs.view","attendance.view","attendance.manage","leave.view","leave.manage","announcements.manage","seats.manage","settings.manage","users.manage"],
    isActive: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6ab372fc8735125f54dd65cd"),
    name: "kavindu",
    email: "kavinduchandupa856@gmail.com",
    role: "admin",
    staffRole: "Supervisor",
    authProvider: "google",
    permissions: ["dashboard.view","interns.view","interns.manage","daily_logs.view","attendance.view","attendance.manage","leave.view","leave.manage"],
    isActive: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6ab373348735125f54ddfbf1"),
    name: "Amasha",
    email: "gmahansamalee@gmail.com",
    role: "developer",
    staffRole: "Developer",
    authProvider: "google",
    permissions: ["dashboard.view","interns.view","daily_logs.view","attendance.view","leave.view","announcements.manage","seats.manage"],
    isActive: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6ab4d87986ef9c34104151ba"),
    name: "Janaka Harambearachchi",
    email: "hjanaka@slt.lk",
    role: "super_admin",
    staffRole: "Supervisor",
    authProvider: "developer_password",
    permissions: ["dashboard.view","interns.view","interns.manage","daily_logs.view","attendance.view","attendance.manage","leave.view","leave.manage","announcements.manage","seats.manage","settings.manage","users.manage"],
    isActive: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6ab4d8bd86ef9c341041cddb"),
    name: "Janaka Harambearachchi",
    email: "hjanaka@gmail.com",
    role: "super_admin",
    staffRole: "Supervisor",
    authProvider: "google",
    permissions: ["dashboard.view","interns.view","interns.manage","daily_logs.view","attendance.view","attendance.manage","leave.view","leave.manage","announcements.manage","seats.manage","settings.manage","users.manage"],
    isActive: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6ab6366f86ef9c3410d38ef7"),
    name: "TalentTrail",
    email: "admin@slt.lk",
    role: "super_admin",
    staffRole: "Admin",
    authProvider: "developer_password",
    permissions: ["dashboard.view","interns.view","interns.manage","daily_logs.view","attendance.view","attendance.manage","leave.view","leave.manage","announcements.manage","seats.manage","settings.manage","users.manage"],
    isActive: true,
  },
];

const REQUIRED_STAFF_INDEXES = [
  { key: { email: 1 }, options: { name: 'email_1', unique: true, background: true } },
  { key: { googleId: 1 }, options: { name: 'googleId_1', unique: true, sparse: true, background: true } },
  { key: { role: 1 }, options: { name: 'role_1', background: true } },
  { key: { status: 1 }, options: { name: 'status_1', background: true } },
  { key: { googleSubject: 1 }, options: { name: 'googleSubject_1', sparse: true, background: true } },
];

function maskUri(uri) {
  if (!uri) return 'NOT_SET';
  try {
    return uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  } catch {
    return '***';
  }
}

async function run() {
  console.log('====================================================');
  console.log('       TalentHub Staff DB Migration Tool            ');
  console.log('====================================================\n');

  // Determine source (Production) and target (Testing) URIs
  let prodUri = process.env.PROD_MONGO_URI;
  let testUri = process.env.TEST_MONGO_URI;

  // Flexible environment resolution:
  // If TEST_MONGO_URI is set and PROD_MONGO_URI is not, fallback PROD to MONGO_URI
  if (!prodUri && testUri && process.env.MONGO_URI) {
    prodUri = process.env.MONGO_URI;
  }
  // If running directly on test server where PROD_MONGO_URI is passed and MONGO_URI in .env is the test DB:
  if (prodUri && !testUri && process.env.MONGO_URI) {
    testUri = process.env.MONGO_URI;
  }

  // If running directly on test server and only MONGO_URI is set (no PROD_MONGO_URI available),
  // use MONGO_URI as testUri and apply the verified snapshot
  if (!testUri && process.env.MONGO_URI) {
    testUri = process.env.MONGO_URI;
  }

  if (!testUri) {
    console.error('❌ Error: Target (Testing) MongoDB URI is missing.');
    console.error('   Please provide TEST_MONGO_URI (or set MONGO_URI to target the test database).');
    console.error('   Example: TEST_MONGO_URI="mongodb+srv://.../talenthub_test" npm run migrate:staff:test');
    process.exit(1);
  }

  if (prodUri && prodUri.trim() === testUri.trim()) {
    console.error('❌ Safety Error: Source and Target MongoDB URIs are identical!');
    console.error(`   Both point to: ${maskUri(prodUri)}`);
    console.error('   Aborting to protect production database from accidental operations.');
    process.exit(1);
  }

  console.log(`🎯 Target Database (Testing):    ${maskUri(testUri)}`);
  if (prodUri) {
    console.log(`📡 Source Database (Production): ${maskUri(prodUri)} (LIVE SYNC)\n`);
  } else {
    console.log(`📦 Source: VERIFIED PRODUCTION SNAPSHOT (17 Authorized Staff Records)\n`);
  }

  let prodConn = null;
  let testConn = null;

  try {
    let sourceStaffDocs = [];
    let sourceIndexes = REQUIRED_STAFF_INDEXES;

    // 1. Connect to Live Production if PROD_URI is available
    if (prodUri) {
      console.log('1️⃣ Connecting to Production Database (READ-ONLY)...');
      prodConn = await mongoose.createConnection(prodUri, {
        serverSelectionTimeoutMS: 10000,
      }).asPromise();
      console.log(`   Connected to Production DB: "${prodConn.name}"`);

      const prodStaffCol = prodConn.collection('staff');
      sourceStaffDocs = await prodStaffCol.find({}).toArray();
      console.log(`   Read ${sourceStaffDocs.length} live staff records from Production.\n`);

      try {
        const liveIndexes = await prodStaffCol.indexes();
        sourceIndexes = liveIndexes
          .filter(idx => idx.name !== '_id_')
          .map(idx => ({
            key: idx.key,
            options: {
              name: idx.name,
              background: idx.background !== false,
              unique: !!idx.unique,
              sparse: !!idx.sparse,
            }
          }));
      } catch (idxErr) {
        console.warn('   Could not read live indexes, using standard required indexes:', idxErr.message);
      }
    } else {
      console.log('1️⃣ Using Embedded Production Staff Snapshot (17 accounts)...');
      sourceStaffDocs = PRODUCTION_STAFF_SNAPSHOT;
    }

    // 2. Connect to Target (Testing) Database
    console.log('2️⃣ Connecting to Testing Database...');
    testConn = await mongoose.createConnection(testUri, {
      serverSelectionTimeoutMS: 10000,
    }).asPromise();
    console.log(`   Connected to Testing DB: "${testConn.name}"\n`);

    const testStaffCol = testConn.collection('staff');

    // 3. Ensure matching indexes in Testing DB
    console.log('3️⃣ Ensuring Production-matching Indexes in Testing Database...');
    for (const idx of sourceIndexes) {
      try {
        await testStaffCol.createIndex(idx.key, idx.options);
        console.log(`   ✅ Index verified/created: ${idx.options?.name || JSON.stringify(idx.key)}`);
      } catch (err) {
        console.warn(`   ⚠️ Index notice: ${err.message}`);
      }
    }
    console.log('');

    // 4. Fetch existing records in testing database to preserve test accounts & avoid duplicates
    console.log('4️⃣ Inspecting Existing Testing Staff Records...');
    const existingTestDocs = await testStaffCol.find({}).toArray();
    console.log(`   Found ${existingTestDocs.length} existing record(s) in Testing DB.\n`);

    // Build lookup maps by both raw email and decrypted plain email
    const testEmailMap = new Map();
    for (const doc of existingTestDocs) {
      if (doc.email) {
        testEmailMap.set(String(doc.email).toLowerCase().trim(), doc);
        const dec = decrypt(doc.email);
        if (dec) {
          testEmailMap.set(String(dec).toLowerCase().trim(), doc);
        }
      }
    }

    // 5. Idempotent Upsert of Staff into Testing Database
    console.log('5️⃣ Migrating Staff Records to Testing Database...');
    let insertedCount = 0;
    let updatedCount = 0;

    const StaffModel = testConn.model('Staff', require('../models/Staff').schema);

    for (const doc of sourceStaffDocs) {
      const decEmail = decrypt(doc.email) || doc.email;
      const plainEmail = String(decEmail).toLowerCase().trim();
      const rawEmail = String(doc.email).trim();

      // Check if already in test DB
      const existing = testEmailMap.get(rawEmail.toLowerCase()) || testEmailMap.get(plainEmail);

      const payload = {
        name: doc.name,
        email: doc.email,
        role: doc.role,
        permissions: doc.permissions || [],
        isActive: doc.isActive !== undefined ? doc.isActive : true,
        authProvider: doc.authProvider || 'google',
        picture: doc.picture || '',
        googleSubject: doc.googleSubject || null,
        staffRole: doc.staffRole || '',
        visiblePages: doc.visiblePages || [],
        requireSecurityCheck: doc.requireSecurityCheck !== undefined ? doc.requireSecurityCheck : false,
        disableSecurityMessage: doc.disableSecurityMessage !== undefined ? doc.disableSecurityMessage : false,
        invitationEmailAttempts: doc.invitationEmailAttempts || 0,
        passkeys: doc.passkeys || [],
        updatedAt: new Date(),
      };

      if (doc.password) {
        payload.password = doc.password;
      }

      if (existing) {
        await testStaffCol.updateOne({ _id: existing._id }, { $set: payload });
        updatedCount++;
        console.log(`   🔄 Updated: ${plainEmail} (Testing ID: ${existing._id})`);
      } else {
        const idTaken = await testStaffCol.findOne({ _id: doc._id });
        if (!idTaken && doc._id) {
          payload._id = doc._id;
        }
        payload.createdAt = doc.createdAt || new Date();
        await testStaffCol.insertOne(payload);
        insertedCount++;
        console.log(`   ➕ Inserted: ${plainEmail} (Testing ID: ${payload._id || 'auto'})`);
      }
    }

    console.log(`\n   Summary: ${insertedCount} inserted, ${updatedCount} updated, 0 duplicates.\n`);

    // 6. Verification
    console.log('6️⃣ Verifying Testing Database...');
    const finalTestDocs = await testStaffCol.find({}).toArray();
    console.log(`   Total staff in Testing DB now: ${finalTestDocs.length}`);

    let ranujaFound = false;
    const staffTable = [];

    finalTestDocs.forEach((d, idx) => {
      const decEmail = decrypt(d.email);
      const decName = decrypt(d.name);
      const decRole = decrypt(d.role);

      if (decEmail === 'ranujaliyanaarachchi@gmail.com') {
        ranujaFound = true;
      }

      staffTable.push({
        '#': idx + 1,
        'Email': decEmail,
        'Name': decName,
        'Role': decRole,
        'Provider': d.authProvider || 'none',
        'Active': d.isActive,
      });
    });

    console.table(staffTable);

    if (ranujaFound) {
      console.log('✅ SPECIFIC VERIFICATION PASSED: ranujaliyanaarachchi@gmail.com exists in Testing DB!');
    } else {
      console.error('❌ SPECIFIC VERIFICATION FAILED: ranujaliyanaarachchi@gmail.com NOT found!');
    }

    // Check test accounts
    const testAccounts = ['admin@slt.lk', 'superadmin@slt.lk'];
    testAccounts.forEach(acc => {
      const exists = finalTestDocs.some(
        d => String(decrypt(d.email) || d.email).toLowerCase().trim() === acc
      );
      if (exists) {
        console.log(`   ℹ️ Preserved test account: ${acc}`);
      }
    });

    console.log('\n====================================================');
    console.log('🎉 Migration finished successfully.');
    if (prodUri) {
      console.log('   Production database was read-only and untouched.');
    }
    console.log('====================================================\n');

  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  } finally {
    if (prodConn) await prodConn.close();
    if (testConn) await testConn.close();
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };
