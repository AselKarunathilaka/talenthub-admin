const mongoose = require("mongoose");

const attendanceSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "default",
    },
    sltLocationRequired: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("AttendanceSetting", attendanceSettingSchema);
