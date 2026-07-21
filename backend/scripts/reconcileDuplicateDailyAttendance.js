const mongoose = require("mongoose");
require("dotenv").config();

const Intern = require("../models/Intern");
const {
  selectCanonicalDailyEntry,
} = require("../utils/attendanceHistory");

const APPLY_CHANGES = process.argv.includes("--apply");
const BATCH_SIZE = 500;

const getDuplicateGroups = () =>
  Intern.aggregate([
    { $unwind: "$attendance" },
    {
      $match: {
        "attendance.status": "Present",
        "attendance.type": { $in: ["daily_qr", "face"] },
      },
    },
    {
      $group: {
        _id: {
          internId: "$_id",
          date: {
            $dateToString: {
              date: "$attendance.date",
              format: "%Y-%m-%d",
              timezone: "Asia/Colombo",
            },
          },
        },
        traineeId: { $first: "$Trainee_ID" },
        entries: { $push: "$attendance" },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

const runBatches = async (operations) => {
  for (let index = 0; index < operations.length; index += BATCH_SIZE) {
    await Intern.collection.bulkWrite(
      operations.slice(index, index + BATCH_SIZE),
      { ordered: true },
    );
  }
};

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const groups = await getDuplicateGroups();
  const safeGroups = groups.filter((group) => {
    const localCount = group.entries.filter(
      (entry) => entry.markedBy !== "external_system",
    ).length;
    return localCount === 1;
  });
  const ambiguousGroups = groups.filter(
    (group) => !safeGroups.includes(group),
  );

  console.log(
    JSON.stringify(
      {
        mode: APPLY_CHANGES ? "apply" : "dry-run",
        duplicateGroups: groups.length,
        safeGroups: safeGroups.length,
        ambiguousGroups: ambiguousGroups.length,
      },
      null,
      2,
    ),
  );

  if (!APPLY_CHANGES || safeGroups.length === 0) return;

  const runId = new mongoose.Types.ObjectId();
  await mongoose.connection
    .collection("attendance_duplicate_backups")
    .insertMany(
      safeGroups.map((group) => ({
        runId,
        internId: group._id.internId,
        traineeId: group.traineeId,
        date: group._id.date,
        entries: group.entries,
        createdAt: new Date(),
      })),
    );

  const checkoutOperations = [];
  const duplicateRemovalOperations = [];

  safeGroups.forEach((group) => {
    const localEntry = group.entries.find(
      (entry) => entry.markedBy !== "external_system",
    );
    const reconciliation = selectCanonicalDailyEntry(
      group.entries,
      localEntry.type,
    );

    if (
      reconciliation.checkOutTime &&
      !reconciliation.canonical.checkOutTime
    ) {
      checkoutOperations.push({
        updateOne: {
          filter: { _id: group._id.internId },
          update: {
            $set: {
              "attendance.$[record].checkOutTime":
                reconciliation.checkOutTime,
            },
          },
          arrayFilters: [
            { "record._id": reconciliation.canonical._id },
          ],
        },
      });
    }

    duplicateRemovalOperations.push({
      updateOne: {
        filter: { _id: group._id.internId },
        update: {
          $pull: {
            attendance: {
              _id: {
                $in: reconciliation.duplicates.map((entry) => entry._id),
              },
            },
          },
        },
      },
    });
  });

  await runBatches(checkoutOperations);
  await runBatches(duplicateRemovalOperations);

  console.log(
    `Reconciled ${safeGroups.length} groups. Backup run ID: ${runId}`,
  );
  if (ambiguousGroups.length > 0) {
    console.log(
      `Left ${ambiguousGroups.length} ambiguous groups unchanged.`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
