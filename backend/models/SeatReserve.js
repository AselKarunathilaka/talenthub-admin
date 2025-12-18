const mongoose = require("mongoose");

const seatBookingSchema = new mongoose.Schema({
  seatNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 96,
  },
  internId: {
    type: String,
    required: true,
    trim: true,
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
    enum: ["active", "cancelled"],
    default: "active",
  },
});

// Compound unique index to prevent duplicate bookings for same seat on same date
seatBookingSchema.index({ seatNumber: 1, bookingDate: 1 }, { unique: true });

// Index to check if intern has already booked for a date
seatBookingSchema.index({ internId: 1, bookingDate: 1 });

const SeatBooking = mongoose.model("SeatBooking", seatBookingSchema);
module.exports = SeatBooking;
