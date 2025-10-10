const mongoose = require("mongoose");

const DailyRecordSchema = new mongoose.Schema({
  internId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Intern",
    required: true
  },
  date: {
    type: String,
    required: true
  },
  stack: {
    type: String,
    required: true,
    trim: true
  },
  task: {
    type: String,
    required: true,
    trim: true
  },
  progress: {
    type: String,
    default: "No challenges faced",
    trim: true
  },
  blockers: {
    type: String,
    default: "No specific plans",
    trim: true
  },
  status: {
    type: String,
    enum: ["working", "leave", "wfh"],
    default: "working"
  },
  attendance: {
    type: String,
    enum: ["present", "absent", "late"],
    default: "absent"
  },
  attendanceTime: {
    type: Date,
    default: null
  },
  meetingAttendance: [{
    meetingTitle: {
      type: String,
      required: true
    },
    attendanceStatus: {
      type: String,
      enum: ["present", "absent"],
      default: "absent"
    },
    attendanceTime: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Create compound index for intern and date to prevent duplicates per day
DailyRecordSchema.index({ internId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("DailyRecord", DailyRecordSchema);
