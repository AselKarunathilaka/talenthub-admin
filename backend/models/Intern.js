const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ["Present", "Absent"], default: "Absent" },
});

// Store API-style keys as the canonical document shape so DB contains Trainee_* fields.
const internSchema = new mongoose.Schema({
  Trainee_ID: { type: String, required: true, unique: true },
  Trainee_Name: { type: String, required: true },
  Trainee_HomeAddress: { type: String, default: "" },
  Training_StartDate: { type: Date },
  Training_EndDate: { type: Date },
  Trainee_Email: { type: String, default: "" },
  Institute: { type: String, default: "" },
  field_of_spec_name: { type: String, required: true },

  // keep other app-specific fields
  team: { type: String, default: "" },
  attendance: [attendanceSchema],
  availableDays: {
    type: [String],
    enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    default: [],
  },
}, { timestamps: true });

// Backwards-compatible camelCase virtuals for existing code that expects traineeId, etc.
internSchema.virtual('traineeId')
  .get(function() { return this.Trainee_ID; })
  .set(function(v) { this.Trainee_ID = v; });

internSchema.virtual('traineeName')
  .get(function() { return this.Trainee_Name; })
  .set(function(v) { this.Trainee_Name = v; });

internSchema.virtual('homeAddress')
  .get(function() { return this.Trainee_HomeAddress; })
  .set(function(v) { this.Trainee_HomeAddress = v; });

internSchema.virtual('trainingStartDate')
  .get(function() { return this.Training_StartDate; })
  .set(function(v) { this.Training_StartDate = v; });

internSchema.virtual('trainingEndDate')
  .get(function() { return this.Training_EndDate; })
  .set(function(v) { this.Training_EndDate = v; });

internSchema.virtual('email')
  .get(function() { return this.Trainee_Email; })
  .set(function(v) { this.Trainee_Email = v; });

internSchema.virtual('institute')
  .get(function() { return this.Institute; })
  .set(function(v) { this.Institute = v; });

internSchema.virtual('fieldOfSpecialization')
  .get(function() { return this.field_of_spec_name; })
  .set(function(v) { this.field_of_spec_name = v; });

// Include virtuals in JSON/Object representations so both shapes are available to API and code
internSchema.set('toJSON', { virtuals: true });
internSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Intern', internSchema);