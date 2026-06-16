const SeatBooking = require("../models/SeatReserve");
const Intern = require("../models/Intern");
const LockedSeat = require("../models/LockedSeat");

/**
 * Get all seat bookings with optional date filter
 * @route GET /api/admin/seat-bookings
 * @access Private (Admin only)
 */
const getSeatBookings = async (req, res) => {
  try {
    const { date } = req.query;
    let query = { status: "active" };

    // If date filter is provided, filter by booking date
    if (date) {
      const filterDate = new Date(date);
      const nextDay = new Date(filterDate);
      nextDay.setDate(nextDay.getDate() + 1);

      query.bookingDate = {
        $gte: filterDate,
        $lt: nextDay,
      };
    }

    // Fetch bookings and populate intern details
    const bookings = await SeatBooking.find(query)
      .populate({
        path: "internId",
        select: "Trainee_ID Trainee_Name Trainee_Email",
      })
      .sort({ bookingDate: -1, seatNumber: 1 })
      .lean();

    // Transform the data to include intern details directly
    const transformedBookings = bookings.map((booking) => ({
      _id: booking._id,
      seatNumber: booking.seatNumber,
      traineeId: booking.traineeId,
      email: booking.email,
      bookingDate: booking.bookingDate,
      bookedAt: booking.bookedAt,
      status: booking.status,
      internName: booking.internId?.Trainee_Name || "N/A",
      internEmail: booking.internId?.Trainee_Email || booking.email,
    }));

    // Calculate stats
    const totalBookings = transformedBookings.length;
    const occupiedSeats = new Set(transformedBookings.map((b) => b.seatNumber))
      .size;

    res.status(200).json({
      success: true,
      bookings: transformedBookings,
      stats: {
        totalBookings,
        occupiedSeats,
        availableSeats: 96 - occupiedSeats,
      },
    });
  } catch (error) {
    console.error("Error fetching seat bookings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch seat bookings",
      error: error.message,
    });
  }
};

/**
 * Get seat booking statistics
 * @route GET /api/admin/seat-bookings/stats
 * @access Private (Admin only)
 */
const getBookingStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let dateQuery = { status: "active" };

    if (startDate && endDate) {
      dateQuery.bookingDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const totalBookings = await SeatBooking.countDocuments(dateQuery);

    const activeBookings = await SeatBooking.find({
      ...dateQuery,
      bookingDate: { $gte: new Date() },
    }).distinct("seatNumber");

    const occupiedSeats = activeBookings.length;

    // Get bookings by date
    const bookingsByDate = await SeatBooking.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$bookingDate" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalBookings,
        occupiedSeats,
        availableSeats: 96 - occupiedSeats,
        bookingsByDate,
      },
    });
  } catch (error) {
    console.error("Error fetching booking stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch booking statistics",
      error: error.message,
    });
  }
};

/**
 * Get booking details by seat number
 * @route GET /api/admin/seat-bookings/seat/:seatNumber
 * @access Private (Admin only)
 */
const getBookingBySeat = async (req, res) => {
  try {
    const { seatNumber } = req.params;
    const { date } = req.query;

    let query = {
      seatNumber: parseInt(seatNumber),
      status: "active",
    };

    if (date) {
      const filterDate = new Date(date);
      const nextDay = new Date(filterDate);
      nextDay.setDate(nextDay.getDate() + 1);

      query.bookingDate = {
        $gte: filterDate,
        $lt: nextDay,
      };
    }

    const booking = await SeatBooking.findOne(query)
      .populate({
        path: "internId",
        select:
          "Trainee_ID Trainee_Name Trainee_Email Institute field_of_spec_name",
      })
      .lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "No booking found for this seat",
      });
    }

    const bookingDetails = {
      _id: booking._id,
      seatNumber: booking.seatNumber,
      traineeId: booking.traineeId,
      email: booking.email,
      bookingDate: booking.bookingDate,
      bookedAt: booking.bookedAt,
      status: booking.status,
      intern: {
        name: booking.internId?.Trainee_Name || "N/A",
        email: booking.internId?.Trainee_Email || booking.email,
        institute: booking.internId?.Institute || "N/A",
        specialization: booking.internId?.field_of_spec_name || "N/A",
      },
    };

    res.status(200).json({
      success: true,
      booking: bookingDetails,
    });
  } catch (error) {
    console.error("Error fetching booking by seat:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch booking details",
      error: error.message,
    });
  }
};

/**
 * Get booking history for a specific intern by trainee ID or name
 * @route GET /api/admin/seat-bookings/history
 * @access Private (Admin only)
 */
const getInternBookingHistory = async (req, res) => {
  try {
    const { search } = req.query;

    if (!search || !search.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search term is required",
      });
    }

    const searchTerm = search.trim();

    // First, try to find the intern in the Intern model
    let intern = null;

    // Search for intern by Trainee_ID or Trainee_Name
    intern = await Intern.findOne({
      $or: [
        { Trainee_ID: { $regex: searchTerm, $options: "i" } },
        { Trainee_Name: { $regex: searchTerm, $options: "i" } },
      ],
    })
      .select("Trainee_ID Trainee_Name Trainee_Email")
      .lean();

    // Build the search query for bookings
    let bookingQuery = {
      $or: [{ traineeId: { $regex: searchTerm, $options: "i" } }],
    };

    // If intern found, also search by their ID
    if (intern) {
      bookingQuery.$or.push({ traineeId: intern.Trainee_ID });
    }

    // Search for all bookings (both active and inactive) matching the criteria
    const bookings = await SeatBooking.find(bookingQuery)
      .populate({
        path: "internId",
        select:
          "Trainee_ID Trainee_Name Trainee_Email Institute field_of_spec_name",
      })
      .sort({ bookingDate: -1, bookedAt: -1 }) // Sort by most recent first
      .lean();

    if (bookings.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No bookings found for this intern",
        internInfo: intern
          ? {
              traineeId: intern.Trainee_ID,
              internName: intern.Trainee_Name,
              email: intern.Trainee_Email,
            }
          : null,
        bookings: [],
        totalBookings: 0,
      });
    }

    // Transform bookings to match frontend format
    const transformedBookings = bookings.map((booking) => ({
      _id: booking._id,
      seatNumber: booking.seatNumber,
      traineeId: booking.traineeId,
      email: booking.email,
      bookingDate: booking.bookingDate,
      bookedAt: booking.bookedAt,
      status: booking.status,
      internName: booking.internId?.Trainee_Name || "N/A",
      internEmail: booking.internId?.Trainee_Email || booking.email,
    }));

    // Get intern information from the most recent booking or from Intern model
    let internInfo;
    if (intern) {
      internInfo = {
        traineeId: intern.Trainee_ID,
        internName: intern.Trainee_Name,
        email: intern.Trainee_Email,
      };
    } else {
      // Fallback to booking data if intern not found in Intern model
      internInfo = {
        traineeId: transformedBookings[0].traineeId,
        internName: transformedBookings[0].internName,
        email: transformedBookings[0].email,
      };
    }

    // Calculate some statistics
    const activeBookings = transformedBookings.filter(
      (b) => b.status === "active",
    ).length;
    const totalBookings = transformedBookings.length;
    const uniqueSeats = new Set(transformedBookings.map((b) => b.seatNumber))
      .size;

    res.status(200).json({
      success: true,
      message: `Found ${totalBookings} booking(s)`,
      internInfo,
      bookings: transformedBookings,
      statistics: {
        totalBookings,
        activeBookings,
        inactiveBookings: totalBookings - activeBookings,
        uniqueSeatsUsed: uniqueSeats,
      },
    });
  } catch (error) {
    console.error("Error fetching booking history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch booking history",
      error: error.message,
    });
  }
};

/**
 * Get all locked seats
 * @route GET /api/admin/seat-bookings/locked
 * @access Private (Admin only)
 */
const getLockedSeats = async (req, res) => {
  try {
    const lockedSeats = await LockedSeat.find()
      .sort({ seatNumber: 1 })
      .lean();

    // Return both the plain number array (for backward compat) and full objects with traineeId
    const lockedSeatNumbers = lockedSeats.map((s) => s.seatNumber);
    const lockedSeatDetails = lockedSeats.map((s) => ({
      seatNumber: s.seatNumber,
      traineeId: s.traineeId || null,
      lockedBy: s.lockedBy,
      lockedAt: s.lockedAt,
    }));

    res.status(200).json({
      success: true,
      lockedSeats: lockedSeatNumbers,
      lockedSeatDetails,
      count: lockedSeatNumbers.length,
      details: lockedSeats,
    });
  } catch (error) {
    console.error("Error fetching locked seats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch locked seats",
      error: error.message,
    });
  }
};

/**
 * Lock a seat
 * @route POST /api/admin/seat-bookings/lock
 * @access Private (Admin only)
 */
const lockSeat = async (req, res) => {
  try {
    const { seatNumber, traineeId } = req.body;

    if (!seatNumber || seatNumber < 1 || seatNumber > 96) {
      return res.status(400).json({
        success: false,
        message: "Valid seat number (1-96) is required",
      });
    }

    // Check if already locked
    const existing = await LockedSeat.findOne({ seatNumber });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Seat ${seatNumber} is already locked`,
      });
    }

    // Check if seat has an active booking — if so, warn but still allow locking
    const activeBooking = await SeatBooking.findOne({
      seatNumber,
      status: "active",
      bookingDate: { $gte: new Date() },
    });

    await LockedSeat.create({
      seatNumber,
      lockedBy: req.user?.email || req.user?.id || "admin",
      lockedAt: new Date(),
      traineeId: traineeId ? String(traineeId).trim() : null,
    });

    res.status(201).json({
      success: true,
      message: `Seat ${seatNumber} has been locked`,
      seatNumber,
      hasActiveBooking: !!activeBooking,
      warning: activeBooking
        ? `Note: Seat ${seatNumber} has an active booking that will remain. Future bookings are blocked.`
        : null,
    });
  } catch (error) {
    console.error("Error locking seat:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: `Seat ${req.body.seatNumber} is already locked`,
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to lock seat",
      error: error.message,
    });
  }
};

/**
 * Unlock a seat
 * @route POST /api/admin/seat-bookings/unlock
 * @access Private (Admin only)
 */
const unlockSeat = async (req, res) => {
  try {
    const { seatNumber } = req.body;

    if (!seatNumber || seatNumber < 1 || seatNumber > 96) {
      return res.status(400).json({
        success: false,
        message: "Valid seat number (1-96) is required",
      });
    }

    const result = await LockedSeat.findOneAndDelete({ seatNumber });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: `Seat ${seatNumber} is not currently locked`,
      });
    }

    res.status(200).json({
      success: true,
      message: `Seat ${seatNumber} has been unlocked`,
      seatNumber,
    });
  } catch (error) {
    console.error("Error unlocking seat:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unlock seat",
      error: error.message,
    });
  }
};

module.exports = {
  getSeatBookings,
  getBookingStats,
  getBookingBySeat,
  getInternBookingHistory,
  getLockedSeats,
  lockSeat,
  unlockSeat,
};
