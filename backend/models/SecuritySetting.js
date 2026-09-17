const mongoose = require("mongoose");

const historySchema = new mongoose.Schema({
  activity: {
    type: String,
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  userMail: {
    type: String,
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  time: {
    type: String,
    required: true,
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
    toggles: {
      location: { type: Boolean, default: true },
      attendance: { type: Boolean, default: true },
      logbook: { type: Boolean, default: true },
      holiday: { type: Boolean, default: true },
      lift: { type: Boolean, default: true },
    },
    history: [historySchema],
  },
  {
    collection: "security_settings",
    timestamps: true,
  }
);

module.exports = mongoose.model("SecuritySetting", securitySettingSchema);
