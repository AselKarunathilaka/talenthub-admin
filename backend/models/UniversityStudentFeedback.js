const mongoose = require("mongoose");

const universityStudentFeedbackSchema = new mongoose.Schema(
  {
    internId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Intern",
      required: true,
      index: true,
    },
    traineeId: {
      type: String,
      trim: true,
    },
    universitySupervisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UniversityUser",
      required: true,
    },
    supervisorName: {
      type: String,
      required: true,
      trim: true,
    },
    supervisorEmail: {
      type: String,
      required: true,
      trim: true,
    },
    universityName: {
      type: String,
      required: true,
      trim: true,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    tags: {
      type: [String],
      default: [],
    },
    supervisorPicture: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "UniversityStudentFeedback",
  universityStudentFeedbackSchema
);
