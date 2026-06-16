const mongoose = require("mongoose");

const internFaceProfileSchema = new mongoose.Schema(
  {
    internId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Intern",
      required: true,
      unique: true,
    },
    traineeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    traineeName: {
      type: String,
      required: true,
      trim: true,
    },
    embeddings: {
      type: [[Number]],
      default: [],
    },
    sampleCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastMatchedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);


module.exports = mongoose.model("InternFaceProfile", internFaceProfileSchema);