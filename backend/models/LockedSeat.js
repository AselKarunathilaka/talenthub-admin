const mongoose = require("mongoose");

const lockedSeatSchema = new mongoose.Schema(
  {
    seatNumber: {
      type: Number,
      required: true,
      unique: true,
      min: 1,
      max: 96,
    },
    lockedBy: {
      type: String,
      default: "admin",
    },
    lockedAt: {
      type: Date,
      default: Date.now,
    },
    traineeId: {
      type: String,
      default: null, // Optional: ID of the intern this seat is reserved for
    },
  },
  {
    timestamps: true,
  }
);

const LockedSeat = mongoose.model("LockedSeat", lockedSeatSchema);
module.exports = LockedSeat;
