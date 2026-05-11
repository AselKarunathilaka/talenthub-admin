const mongoose = require("mongoose");

const faceAttendanceLogSchema = new mongoose.Schema(
  {
    internId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Intern",
      default: null,
    },
    faceProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InternFaceProfile",
      default: null,
    },
    traineeId: {
      type: String,
      required: true,
    },
    traineeName: {
      type: String,
      required: true,
      trim: true,
    },
    attendanceDate: {
      type: String,
      required: true,
    },
    attendanceTime: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["present", "absent"],
      default: "present",
    },
    method: {
      type: String,
      enum: ["face", "qr"],
      default: "face",
    },
    matchDistance: {
      type: Number,
      default: null,
    },
    confidence: {
      type: Number,
      default: null,
    },
    qrBackupUsed: {
      type: Boolean,
      default: false,
    },
    source: {
      type: String,
      default: "browser-camera",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

faceAttendanceLogSchema.index({ internId: 1, attendanceTime: -1 });
faceAttendanceLogSchema.index({ attendanceDate: 1 });

module.exports = mongoose.model("FaceAttendanceLog", faceAttendanceLogSchema);
