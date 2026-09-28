const mongoose = require("mongoose");
const { encrypt, decrypt } = require("../utils/dbEncryption");

const securityAlertSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      set: encrypt,
      get: decrypt,
    },
    role: {
      type: String,
      required: true,
      trim: true,
      set: encrypt,
      get: decrypt,
    },
    subRole: {
      type: String,
      required: true,
      trim: true,
      set: encrypt,
      get: decrypt,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      set: encrypt,
      get: decrypt,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      set: encrypt,
      get: decrypt,
    },
  },
  {
    collection: "security_alerts",
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
  }
);

module.exports = mongoose.model("SecurityAlert", securityAlertSchema);
