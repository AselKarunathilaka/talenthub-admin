const express = require("express");
const router = express.Router();
const {
  getSeatBookings,
  getBookingStats,
  getBookingBySeat,
  getInternBookingHistory,
  getLockedSeats,
  lockSeat,
  unlockSeat,
  getPendingCheckIns,
} = require("../controllers/adminSeatController");
const authenticateUser = require("../middleware/authMiddleware");

// Apply authentication middleware to all routes
router.use(authenticateUser);

/**
 * @route   GET /api/admin/seat-bookings
 * @desc    Get all seat bookings with optional date filter
 * @access  Private (Admin)
 * @query   date - optional date filter (YYYY-MM-DD)
 */
router.get("/seat-bookings", getSeatBookings);

/**
 * @route   GET /api/admin/seat-bookings/stats
 * @desc    Get seat booking statistics
 * @access  Private (Admin)
 * @query   startDate, endDate - optional date range
 */
router.get("/seat-bookings/stats", getBookingStats);

/**
 * @route   GET /api/admin/seat-bookings/history
 * @desc    Get booking history for a specific intern
 * @access  Private (Admin)
 * @query   search - trainee ID or name to search for
 */
router.get("/seat-bookings/history", getInternBookingHistory);

/**
 * @route   GET /api/admin/seat-bookings/locked
 * @desc    Get all locked seat numbers
 * @access  Private (Admin)
 */
router.get("/seat-bookings/locked", getLockedSeats);

/**
 * @route   POST /api/admin/seat-bookings/lock
 * @desc    Lock a seat (prevents interns from booking it)
 * @access  Private (Admin)
 * @body    { seatNumber: Number }
 */
router.post("/seat-bookings/lock", lockSeat);

/**
 * @route   POST /api/admin/seat-bookings/unlock
 * @desc    Unlock a seat (allows interns to book it again)
 * @access  Private (Admin)
 * @body    { seatNumber: Number }
 */
router.post("/seat-bookings/unlock", unlockSeat);

/**
 * @route   GET /api/admin/seat-bookings/pending-checkins
 * @desc    Get interns who booked a seat but haven't scanned daily attendance
 * @access  Private (Admin)
 * @query   date - optional date filter (YYYY-MM-DD)
 */
router.get("/seat-bookings/pending-checkins", getPendingCheckIns);

/**
 * @route   GET /api/admin/seat-bookings/seat/:seatNumber
 * @desc    Get booking details for a specific seat
 * @access  Private (Admin)
 * @param   seatNumber - seat number (1-96)
 * @query   date - optional date filter (YYYY-MM-DD)
 */
router.get("/seat-bookings/seat/:seatNumber", getBookingBySeat);

module.exports = router;

