const express = require("express");
const router = express.Router();

const authenticateUser = require("../middleware/authMiddleware");

const {
  createBooking,
  getBookingsByDate,
  getBookingsByIntern,
  cancelBooking,
  getSeatAvailability,
  getPublicLockedSeats,
} = require("../controllers/seatBookingController");

//Create a booking (JWT REQUIRED)
router.post("/bookings", authenticateUser, createBooking);

//Get bookings for a specific date (PUBLIC)
router.get("/bookings/date/:date", getBookingsByDate);

//Get logged-in intern’s bookings (JWT REQUIRED)
router.get("/bookings/intern", authenticateUser, getBookingsByIntern);

//Cancel a booking (JWT REQUIRED)
router.put("/bookings/cancel/:id", authenticateUser, cancelBooking);

//Get seat availability (PUBLIC)
router.get("/availability/:date", getSeatAvailability);

//Get locked seats (PUBLIC - for intern seat map)
router.get("/locked-seats", getPublicLockedSeats);

module.exports = router;
