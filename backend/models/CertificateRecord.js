const mongoose = require("mongoose");

const CertificateRecordSchema = new mongoose.Schema(
  {
    verificationToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    internId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Intern",
      required: true,
    },
    traineeId: { type: String, required: true },
    traineeName: { type: String, required: true },
    email: { type: String },
    institute: { type: String },
    fieldOfSpecialization: { type: String },
    trainingStartDate: { type: Date },
    trainingEndDate: { type: Date },
    issuedAt: { type: Date, default: Date.now },
    isValid: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CertificateRecord", CertificateRecordSchema);
