const mongoose = require("mongoose");
const { encrypt, decrypt } = require("../utils/dbEncryption");

const historySchema = new mongoose.Schema({
  activity: {
    type: String,
    required: true,
    set: encrypt,
    get: decrypt,
  },
  userName: {
    type: String,
    required: true,
    set: encrypt,
    get: decrypt,
  },
  userMail: {
    type: String,
    required: true,
    set: encrypt,
    get: decrypt,
  },
  date: {
    type: String,
    required: true,
  },
  time: {
    type: String,
    required: true,
  },
}, { toJSON: { getters: true }, toObject: { getters: true } });

const securityPasswordItemSchema = new mongoose.Schema({
  label: {
    type: String,
    default: "",
  },
  hash: {
    type: String,
    required: true,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
});

const securitySettingSchema = new mongoose.Schema(
  {
    functionName: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    passwords: [securityPasswordItemSchema],
    toggles: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    history: [historySchema],
  },
  {
    collection: "security_settings",
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

module.exports = mongoose.model("SecuritySetting", securitySettingSchema);
