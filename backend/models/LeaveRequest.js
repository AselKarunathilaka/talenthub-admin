const mongoose = require("mongoose");
const crypto = require("crypto");

const leaveRequestSchema = new mongoose.Schema(
  {
    intern: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Intern",
      required: true,
    },
    internName: {
      type: String,
      required: true,
    },
    internTraineeId: {
      type: String,
      default: null,
    },
    nationalId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      validate: {
        validator: function (value) {
          return /^(\d{9}[VX]|\d{12})$/.test(value);
        },
        message: (props) =>
          `${props.value} is not a valid Sri Lankan NIC number`,
      },
    },
    requestType: {
      type: String,
      enum: ["short_leave", "study_leave"],
      default: "short_leave",
      index: true,
    },
    leaveDate: {
      type: Date,
      required: true,
      trim: true,
    },
    studyEndDate: {
      type: Date,
      default: null,
    },
    leaveTime: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ["Personal", "Official", "Study", "Academic Exams / Study"],
      required: true,
    },
    reason: {
      type: String,
      required: true,
      minlength: 10,
    },
    proofDocument: {
      data: {
        type: String, // Base64 encoded file data
        default: null,
      },
      contentType: {
        type: String, // MIME type (e.g., 'application/pdf', 'image/jpeg')
        default: null,
      },
      filename: {
        type: String, // Original filename
        default: null,
      },
      size: {
        type: Number, // File size in bytes
        default: null,
      },
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Denied"],
      default: "Pending",
    },
    adminResponse: {
      type: String,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },

    passToken: {
      type: String,
      unique: true,
      sparse: true,
    },
    passUsed: {
      type: Boolean,
      default: false,
    },
    passUsedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Generate secure token when leave is approved
leaveRequestSchema.methods.generatePassToken = function () {
  this.passToken = crypto.randomBytes(32).toString("hex");
  return this.passToken;
};

// Index for faster queries
leaveRequestSchema.index({ intern: 1, status: 1 });
leaveRequestSchema.index({ intern: 1, requestType: 1, leaveDate: 1 });
leaveRequestSchema.index({ status: 1, submittedAt: -1 });

const LeaveRequest = mongoose.model("LeaveRequest", leaveRequestSchema);

module.exports = LeaveRequest;
