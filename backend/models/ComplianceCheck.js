const mongoose = require("mongoose");

const ComplianceCheckSchema = new mongoose.Schema({
  checkDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  weekChecked: {
    startDate: {
      type: String,
      required: true // Format: YYYY-MM-DD
    },
    endDate: {
      type: String,
      required: true // Format: YYYY-MM-DD
    }
  },
  triggerType: {
    type: String,
    enum: ["scheduled", "manual"],
    default: "scheduled"
  },
  results: {
    totalInterns: {
      type: Number,
      default: 0
    },
    compliantInterns: {
      type: Number,
      default: 0
    },
    gracePeriodInterns: {
      type: Number,
      default: 0
    },
    terminatedInterns: {
      type: Number,
      default: 0
    },
    emailsSent: [{
      internId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Intern"
      },
      internName: String,
      traineeId: String,
      email: String,
      emailId: String, // Email message ID from nodemailer
      sentAt: {
        type: Date,
        default: Date.now
      }
    }],
    emailsFailed: [{
      internId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Intern"
      },
      internName: String,
      traineeId: String,
      email: String,
      error: String,
      attemptedAt: {
        type: Date,
        default: Date.now
      }
    }],
    processingErrors: [{
      internId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Intern"
      },
      internName: String,
      traineeId: String,
      error: String,
      occurredAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  executionTime: {
    startedAt: {
      type: Date,
      required: true
    },
    completedAt: {
      type: Date,
      required: true
    },
    durationMs: {
      type: Number,
      required: true
    }
  },
  status: {
    type: String,
    enum: ["success", "partial_success", "failed"],
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
ComplianceCheckSchema.index({ checkDate: -1 });
ComplianceCheckSchema.index({ "weekChecked.startDate": 1, "weekChecked.endDate": 1 });
ComplianceCheckSchema.index({ triggerType: 1 });

module.exports = mongoose.model("ComplianceCheck", ComplianceCheckSchema);