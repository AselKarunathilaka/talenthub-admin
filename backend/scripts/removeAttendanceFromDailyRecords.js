// removeAttendanceFromDailyRecords.js
const mongoose = require("mongoose");
require("dotenv").config();

async function removeAttendanceFields() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const result = await mongoose.connection
      .collection("dailyrecords")
      .updateMany(
        {},
        {
          $unset: {
            meetingAttendance: "",
            attendance: "",
            attendanceTime: "",
            checkOutTime: "",
          },
        },
      );

    console.log(`Matched : ${result.matchedCount} documents`);
    console.log(`Modified: ${result.modifiedCount} documents`);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

removeAttendanceFields();
