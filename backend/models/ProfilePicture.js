const mongoose = require("mongoose");

const profilePictureSchema = new mongoose.Schema(
  {
    internId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Intern",
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

module.exports = mongoose.model("ProfilePicture", profilePictureSchema);
