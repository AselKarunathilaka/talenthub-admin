const mongoose = require("mongoose");
const { encrypt, decrypt } = require("../utils/dbEncryption");

const staffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, set: encrypt, get: decrypt },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
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
  },
  { timestamps: true, collection: "staff", toJSON: { getters: true }, toObject: { getters: true } }
);

module.exports = mongoose.model("Staff", staffSchema);
