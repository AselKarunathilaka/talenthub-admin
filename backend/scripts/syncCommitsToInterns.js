const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");

async function main() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log("Connected!");

  const Intern = require("../models/Intern");
  const InternSync = require("../models/InternTalentTrailSync");

  const [allInterns, allSync] = await Promise.all([
    Intern.find({}).lean(),
    InternSync.find({}).lean(),
  ]);

  console.log(`Loaded ${allInterns.length} interns and ${allSync.length} sync records.`);

  const internByCode = new Map();
  const internByEmail = new Map();

  for (const intern of allInterns) {
    if (intern.Trainee_ID) internByCode.set(String(intern.Trainee_ID).trim(), intern);
    if (intern.Trainee_Email) internByEmail.set(String(intern.Trainee_Email).trim().toLowerCase(), intern);
  }

  const syncBulkOps = [];
  const internBulkOps = [];

  for (const sync of allSync) {
    const code = String(sync.internCode || "").trim();
    const email = String(sync.email || "").trim().toLowerCase();

    const matchedIntern = internByCode.get(code) || internByEmail.get(email);
    if (matchedIntern) {
      if (!sync.internRef || sync.internRef.toString() !== matchedIntern._id.toString()) {
        syncBulkOps.push({
          updateOne: {
            filter: { _id: sync._id },
            update: { $set: { internRef: matchedIntern._id } },
          },
        });
      }

      if (typeof sync.commitsCount === "number" && sync.commitsCount > 0) {
        internBulkOps.push({
          updateOne: {
            filter: { _id: matchedIntern._id },
            update: { $set: { commitsCount: sync.commitsCount } },
          },
        });
      }
    }
  }

  if (syncBulkOps.length > 0) {
    await InternSync.bulkWrite(syncBulkOps);
  }
  if (internBulkOps.length > 0) {
    await Intern.bulkWrite(internBulkOps);
  }

  console.log(`Successfully linked ${syncBulkOps.length} sync records and updated ${internBulkOps.length} intern commits.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error in sync script:", err);
  process.exit(1);
});
