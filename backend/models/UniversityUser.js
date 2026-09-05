const mongoose = require("mongoose");

const universityUserSchema = new mongoose.Schema(
  {
    universityName: {
      type: String,
      required: true,
      trim: true,
    },
    supervisorName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    department: {
      type: String,
      default: "",
      trim: true,
    },
    contactNumber: {
      type: String,
      default: "",
      trim: true,
    },
    designation: {
      type: String,
      default: "University Supervisor / Coordinator",
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "revoked", "cancelled"],
      default: "pending",
      index: true,
    },
    rejectionReason: {
      type: String,
      default: "",
      trim: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: String,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectedBy: {
      type: String,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    googleSubject: {
      type: String,
      default: "",
    },
    picture: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UniversityUser", universityUserSchema);
