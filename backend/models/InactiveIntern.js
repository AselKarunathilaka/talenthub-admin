const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ["Present", "Absent"], default: "Absent" },
  type: {
    type: String,
      enum: ["manual", "qr", "daily_qr", "daily", "face"],
    default: "manual",
  },
  timeMarked: { type: Date },
  qrCode: { type: String },
  meetingName: { type: String },
});

const inactiveInternSchema = new mongoose.Schema(
  {
    // ✅ Preserve the exact same _id from the Intern document
    _id: { type: mongoose.Schema.Types.ObjectId, required: true },

    // All original Intern fields (identical to internSchema)
    Trainee_ID: { type: String, required: true },
    Trainee_Name: { type: String, required: true },
    Trainee_HomeAddress: { type: String, default: "" },
    district: { type: String, default: "" },

    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
      },
    },

    Training_StartDate: { type: Date },
    Training_EndDate: { type: Date },
    Trainee_Email: { type: String, default: "" },
    Institute: { type: String, default: "" },
    field_of_spec_name: { type: String, default: "" },

    team: { type: String, default: "" },
    attendance: [attendanceSchema],
    availableDays: {
      type: [String],
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      default: [],
    },
    agreementAccepted: { type: Boolean, default: false },
    agreementAcceptedDate: { type: Date },

    // ✅ Archival metadata — why/when this intern was archived
    archivedAt: { type: Date, default: Date.now },
    archiveReason: {
      type: String,
      enum: ["not_in_api", "manual_cleanup", "manual"],
      default: "not_in_api",
    },
    // Preserve original timestamps from the Intern document
    originalCreatedAt: { type: Date },
    originalUpdatedAt: { type: Date },
  },
  {
    timestamps: false, // We manage timestamps manually via originalCreatedAt/updatedAt
    _id: false, // Prevent Mongoose from auto-generating a new _id
  },
);

inactiveInternSchema.index({ Trainee_ID: 1 });
inactiveInternSchema.index({ archivedAt: -1 });
inactiveInternSchema.index({ location: "2dsphere" }, { sparse: true });

module.exports = mongoose.model("InactiveIntern", inactiveInternSchema);
