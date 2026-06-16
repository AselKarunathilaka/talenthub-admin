const mongoose = require("mongoose");

const seatBookingSchema = new mongoose.Schema(
  {
    seatNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 96,
    },
    internId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Intern",
      required: true,
    },
    traineeId: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    bookingDate: {
      type: Date,
      required: true,
    },
    bookedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["active", "cancelled", "expired"],
      default: "active",
    },
  },
  {
    timestamps: true,
  },
);

// Partial unique index - only applies to active bookings
seatBookingSchema.index(
  { seatNumber: 1, bookingDate: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
  },
);

// Index to check if intern has already booked for a date
seatBookingSchema.index({ internId: 1, bookingDate: 1, status: 1 });

const SeatBooking = mongoose.model("SeatBooking", seatBookingSchema);
module.exports = SeatBooking;
