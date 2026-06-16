const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema(
  {
    teamId: { type: Number, required: true },
    teamName: { type: String, required: true },
    teamLeaderId: { type: Number },
    teamLeaderName: { type: String },
  },
  { _id: false },
);

const projectSchema = new mongoose.Schema(
  {
    projectId: { type: Number, required: true },
    projectName: { type: String, required: true },
    description: { type: String },
    status: { type: String }, // e.g. IN_PROGRESS, PLANNING, COMPLETED
    startDate: { type: Date },
    targetDate: { type: Date },
    supervisorName: { type: String },
    projectManagerName: { type: String },
    teams: [teamSchema], // teams within this project the intern belongs to
  },
  { _id: false },
);

const internTalentTrailSyncSchema = new mongoose.Schema(
  {
    // Link back to the local Intern document
    internRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Intern",
      index: true,
    },

    // TalentTrail canonical fields
    talentTrailInternId: { type: Number, required: true, unique: true }, // numeric id from TalentTrail
    internCode: { type: String, unique: true, sparse: true }, // e.g. INT-2026-001
    name: { type: String, required: true },
    email: { type: String, required: true, index: true },

    // Project/team assignments
    projects: [projectSchema],

    // Derived helper — true when intern has at least one active project
    hasActiveProject: { type: Boolean, default: false, index: true },

    // Sync metadata
    lastSyncedAt: { type: Date, default: null },
    syncError: { type: String, default: null }, // store last error message if sync failed
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "InternTalentTrailSync",
  internTalentTrailSyncSchema,
);
