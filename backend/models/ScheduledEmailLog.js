const mongoose = require("mongoose");

/**
 * One row per (scheduled job, period) that has been dispatched.
 *
 * The unique index on { jobKey, periodKey } is what makes this a cross-process
 * lock: whichever backend instance inserts the row first owns the send for that
 * period, every other instance gets a duplicate-key error and skips. This is
 * what prevents supervisors from receiving the same weekly report twice when
 * more than one backend process is connected to this database.
 */
const ScheduledEmailLogSchema = new mongoose.Schema(
  {
    // Identifies the job, e.g. "weekly-non-submission"
    jobKey: {
      type: String,
      required: true,
    },
    // Identifies the run, e.g. "2026-08-09" (Asia/Colombo date of the run)
    periodKey: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["in_progress", "sent"],
      default: "in_progress",
      required: true,
    },
    // Free-form details about the run (period label, recipients, counts, ...)
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Host/PID of the process that owns the claim — makes it obvious which
    // machine sent the report when investigating.
    claimedBy: {
      type: String,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

ScheduledEmailLogSchema.index({ jobKey: 1, periodKey: 1 }, { unique: true });
ScheduledEmailLogSchema.index({ startedAt: -1 });

module.exports = mongoose.model("ScheduledEmailLog", ScheduledEmailLogSchema);
