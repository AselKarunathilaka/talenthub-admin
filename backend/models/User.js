const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name: { type: String, trim: true, default: "" },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, select: false },
  googleSubject: { type: String, sparse: true },
  picture: String,
  authProvider: {
    type: String,
    enum: ["developer_password", "google"],
  },
  role: {
    type: String,
    enum: ["super_admin", "admin", "supervisor"],
  },
  permissions: [{ type: String }],
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  invitedAt: Date,
  invitationEmailStatus: {
    type: String,
    enum: ["pending", "sent", "failed"],
  },
  invitationEmailSentAt: Date,
  invitationEmailLastAttemptAt: Date,
  invitationEmailError: { type: String, select: false },
  invitationEmailAttempts: { type: Number, default: 0 },
  lastLoginAt: Date,
  // WebAuthn Passkey fields
  passkeys: [{
    credentialID: { type: String },
    credentialPublicKey: { type: Buffer },
    counter: { type: Number },
    credentialDeviceType: { type: String },
    credentialBackedUp: { type: Boolean },
    transports: { type: [String] },
  }],
  currentChallenge: { type: String, select: false },
}, { timestamps: true });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});


userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);
