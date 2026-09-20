const mongoose = require("mongoose");

const adminProfilePictureSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    imageBuffer: {
      type: Buffer,
      required: true,
    },
    contentType: {
      type: String,
      required: true,
      default: "image/jpeg",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminProfilePicture", adminProfilePictureSchema);
