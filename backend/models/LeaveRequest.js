const mongoose = require("mongoose");

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
    leaveDate: {
      type: Date,
      required: true,
      trim: true,
    },
    leaveTime: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ["Personal", "Official"],
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
  },
  {
    timestamps: true,
  },
);

// Index for faster queries
leaveRequestSchema.index({ intern: 1, status: 1 });
leaveRequestSchema.index({ status: 1, submittedAt: -1 });

const LeaveRequest = mongoose.model("LeaveRequest", leaveRequestSchema);

module.exports = LeaveRequest;
