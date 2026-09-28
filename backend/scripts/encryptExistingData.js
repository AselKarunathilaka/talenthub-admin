const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const SecurityAlert = require('../models/SecurityAlert');
const SecuritySetting = require('../models/SecuritySetting');
const SpecialAccessIntern = require('../models/SpecialAccessIntern');
const { encrypt } = require('../utils/dbEncryption');

const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/TalentHub";

const isEncrypted = (val) => {
  if (typeof val !== 'string') return true;
  return val.startsWith('ENC:') || val.startsWith('enc:');
};

async function runMigration() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(uri);
    console.log("Connected.");

    console.log("\n--- Migrating staff / User collection ---");
    const users = await mongoose.connection.db.collection('staff').find({}).toArray();
    let usersUpdated = 0;
    for (const user of users) {
      let needsUpdate = false;
      let updates = {};

      if (user.name && !isEncrypted(user.name)) {
        updates.name = encrypt(user.name);
        needsUpdate = true;
      }
      if (user.email && !isEncrypted(user.email)) {
        updates.email = encrypt(user.email);
        needsUpdate = true;
      }
      if (user.role && !isEncrypted(user.role)) {
        updates.role = encrypt(user.role);
        needsUpdate = true;
      }

      if (needsUpdate) {
        await mongoose.connection.db.collection('staff').updateOne({ _id: user._id }, { $set: updates });
        usersUpdated++;
      }
    }
    console.log(`Updated ${usersUpdated} records in 'staff' collection.`);

    console.log("\n--- Migrating Security Alerts ---");
    const alerts = await mongoose.connection.db.collection('security_alerts').find({}).toArray();
    let alertsUpdated = 0;
    for (const alert of alerts) {
      let needsUpdate = false;
      let updates = {};

      if (alert.name && !isEncrypted(alert.name)) {
        updates.name = encrypt(alert.name);
        needsUpdate = true;
      }
      if (alert.email && !isEncrypted(alert.email)) {
        updates.email = encrypt(alert.email);
        needsUpdate = true;
      }
      if (alert.phoneNumber && !isEncrypted(alert.phoneNumber)) {
        updates.phoneNumber = encrypt(alert.phoneNumber);
        needsUpdate = true;
      }
      if (alert.role && !isEncrypted(alert.role)) {
        updates.role = encrypt(alert.role);
        needsUpdate = true;
      }
      if (alert.subRole && !isEncrypted(alert.subRole)) {
        updates.subRole = encrypt(alert.subRole);
        needsUpdate = true;
      }

      if (needsUpdate) {
        await mongoose.connection.db.collection('security_alerts').updateOne({ _id: alert._id }, { $set: updates });
        alertsUpdated++;
      }
    }
    console.log(`Updated ${alertsUpdated} security alerts.`);

    console.log("\n--- Migrating Security Settings History ---");
    const settings = await mongoose.connection.db.collection('security_settings').find({}).toArray();
    let settingsUpdated = 0;
    for (const setting of settings) {
      if (Array.isArray(setting.history) && setting.history.length > 0) {
        let historyChanged = false;
        const updatedHistory = setting.history.map(item => {
          let itemCopy = { ...item };
          if (itemCopy.activity && !isEncrypted(itemCopy.activity)) {
            itemCopy.activity = encrypt(itemCopy.activity);
            historyChanged = true;
          }
          if (itemCopy.userName && !isEncrypted(itemCopy.userName)) {
            itemCopy.userName = encrypt(itemCopy.userName);
            historyChanged = true;
          }
          if (itemCopy.userMail && !isEncrypted(itemCopy.userMail)) {
            itemCopy.userMail = encrypt(itemCopy.userMail);
            historyChanged = true;
          }
          return itemCopy;
        });

        if (historyChanged) {
          await mongoose.connection.db.collection('security_settings').updateOne(
            { _id: setting._id },
            { $set: { history: updatedHistory } }
          );
          settingsUpdated++;
        }
      }
    }
    console.log(`Updated ${settingsUpdated} security settings documents.`);

    console.log("\n--- Migrating Special Access Interns ---");
    const specialInterns = await mongoose.connection.db.collection('specialaccessinterns').find({}).toArray();
    let specialUpdated = 0;
    for (const intern of specialInterns) {
      let needsUpdate = false;
      let updates = {};

      if (intern.email && !isEncrypted(intern.email)) {
        updates.email = encrypt(intern.email);
        needsUpdate = true;
      }
      if (intern.internId && !isEncrypted(intern.internId)) {
        updates.internId = encrypt(intern.internId);
        needsUpdate = true;
      }

      if (needsUpdate) {
        await mongoose.connection.db.collection('specialaccessinterns').updateOne({ _id: intern._id }, { $set: updates });
        specialUpdated++;
      }
    }
    console.log(`Updated ${specialUpdated} special access interns.`);

    console.log("\n--- Migrating deprecated 'users' collection (if exists) ---");
    const collections = await mongoose.connection.db.listCollections({ name: 'users' }).toArray();
    if (collections.length > 0) {
      const oldUsers = await mongoose.connection.db.collection('users').find({}).toArray();
      let oldUsersUpdated = 0;
      for (const user of oldUsers) {
        let needsUpdate = false;
        let updates = {};

        if (user.name && !isEncrypted(user.name)) {
          updates.name = encrypt(user.name);
          needsUpdate = true;
        }
        if (user.email && !isEncrypted(user.email)) {
          updates.email = encrypt(user.email);
          needsUpdate = true;
        }
        if (user.role && !isEncrypted(user.role)) {
          updates.role = encrypt(user.role);
          needsUpdate = true;
        }

        if (needsUpdate) {
          await mongoose.connection.db.collection('users').updateOne({ _id: user._id }, { $set: updates });
          oldUsersUpdated++;
        }
      }
      console.log(`Updated ${oldUsersUpdated} users in the deprecated 'users' collection.`);
    } else {
      console.log("No deprecated 'users' collection found.");
    }

    console.log("\nMigration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
