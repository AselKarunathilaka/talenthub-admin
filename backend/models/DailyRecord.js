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
    trim: true,
    maxlength: 2000 // Allow up to 2000 characters for stack/technology descriptions
  },
  task: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000 // Allow up to 5000 characters for detailed task descriptions
  },
  progress: {
    type: String,
    default: "No challenges faced",
    trim: true,
    maxlength: 5000 // Allow up to 5000 characters for detailed progress notes
  },
  blockers: {
    type: String,
    default: "No specific plans",
    trim: true,
    maxlength: 5000 // Allow up to 5000 characters for detailed blocker descriptions
  },
  status: {
    type: String,
    enum: ["working", "leave", "wfh"],
    default: "working"
  },
  // Content quality flagging
  flagged: {
    type: Boolean,
    default: false
  },
  flagReason: {
    type: String,
    enum: ["off_topic_content", "low_entropy", "blacklisted_phrase", "too_short", "quality_check_failed", null],
    default: null
  },
  flaggedAt: {
    type: Date,
    default: null
  },
  flagDetails: {
    type: [String],
    default: []
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
