const SeatBooking = require("../models/SeatReserve");
const Intern = require("../models/Intern");
const LockedSeat = require("../models/LockedSeat");

// Create a new booking
exports.createBooking = async (req, res) => {
  try {
    const { seatNumber, date } = req.body;

    const { id } = req.user || {};

    if (!id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid or missing authentication token",
      });
    }

    const intern = await Intern.findById(id);
    if (!intern) {
      return res.status(404).json({
        success: false,
        message: "Intern not found in database",
      });
    }

    const internId = intern._id;
    const traineeId = intern.Trainee_ID;
    const email = intern.Trainee_Email;

    if (!seatNumber || !date) {
      return res.status(400).json({
        success: false,
        message: "Seat number and date are required",
      });
    }

    const bookingDate = new Date(date + "T00:00:00.000Z");

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (bookingDate < today) {
      return res.status(400).json({
        success: false,
        message: "Cannot book seats for past dates",
      });
    }

    // Check if seat is locked by admin
    const isLocked = await LockedSeat.findOne({ seatNumber });
    if (isLocked) {
      return res.status(400).json({
        success: false,
        message: `Seat ${seatNumber} is locked by admin and cannot be booked`,
      });
    }

    // ENHANCED: Check ALL bookings for this seat/date (including cancelled)
    const allBookingsForSeat = await SeatBooking.find({
      seatNumber,
      bookingDate,
    });

    // Check if there's an ACTIVE booking
    const existingBooking = allBookingsForSeat.find(
      (b) => b.status === "active",
    );

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: `Seat ${seatNumber} is already booked for this date`,
      });
    }

    // If there's a cancelled booking, delete it first to avoid unique constraint
    const cancelledBookings = allBookingsForSeat.filter(
      (b) => b.status === "cancelled",
    );
    if (cancelledBookings.length > 0) {
      console.log(
        `Found ${cancelledBookings.length} cancelled bookings, deleting them...`,
      );
      await SeatBooking.deleteMany({
        _id: { $in: cancelledBookings.map((b) => b._id) },
      });
    }

    // Check if intern already has a booking for this date
    const internBooking = await SeatBooking.findOne({
      internId,
      bookingDate,
      status: "active",
    });

    if (internBooking) {
      return res.status(400).json({
        success: false,
        message: "You can only book one seat per day",
      });
    }

    const booking = await SeatBooking.create({
      seatNumber,
      internId,
      traineeId,
      email,
      bookingDate,
      status: "active",
    });

    res.status(201).json({
      success: true,
      _id: booking._id,
      seatNumber: booking.seatNumber,
      internId: booking.internId,
      email: booking.email,
      bookingDate: booking.bookingDate,
      createdAt: booking.createdAt,
    });
  } catch (error) {
    console.error("Booking creation error:", error);

    // Better error message for duplicate key
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "This seat is already booked for the selected date. Please refresh and try again.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while creating booking",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get all bookings for a specific date
exports.getBookingsByDate = async (req, res) => {
  try {
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required",
      });
    }

    // Parse in UTC
    const queryDate = new Date(date + "T00:00:00.000Z");

    const bookings = await SeatBooking.find({
      bookingDate: queryDate,
      status: "active",
    })
      .select("seatNumber traineeId internId bookingDate")
      .sort({ seatNumber: 1 });

    res.status(200).json(bookings);
  } catch (error) {
    console.error("Get bookings by date error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching bookings",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get bookings by the authenticated intern
exports.getBookingsByIntern = async (req, res) => {
  try {
    // Get intern ID from authenticated user
    const { id } = req.user || {};

    if (!id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid authentication token",
      });
    }

    // Fetch intern to get internId
    const intern = await Intern.findById(id);
    if (!intern) {
      return res.status(404).json({
        success: false,
        message: "Intern not found in database",
      });
    }

    const internId = intern._id;

    const bookings = await SeatBooking.find({
      internId,
      status: "active",
    }).sort({ bookingDate: -1 });

    res.status(200).json(bookings);
  } catch (error) {
    console.error("Get intern bookings error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching intern bookings",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Cancel a booking
exports.cancelBooking = async (req, res) => {
  try {
    const { id: bookingId } = req.params;
    const { id } = req.user || {};

    if (!id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid authentication token",
      });
    }

    // Fetch intern to verify existence and get internId
    const intern = await Intern.findById(id);
    if (!intern) {
      return res.status(404).json({
        success: false,
        message: "Intern not found in database",
      });
    }

    const internId = intern._id;

    const booking = await SeatBooking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Verify the booking belongs to the authenticated user
    if (!booking.internId.equals(internId)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You can only cancel your own bookings",
      });
    }

    // Check if booking is already cancelled
    if (booking.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Booking is already cancelled",
      });
    }

    booking.status = "cancelled";
    await booking.save();

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking: {
        _id: booking._id,
        seatNumber: booking.seatNumber,
        bookingDate: booking.bookingDate,
        status: booking.status,
      },
    });
  } catch (error) {
    console.error("Cancel booking error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while cancelling booking",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get seat availability for a date
exports.getSeatAvailability = async (req, res) => {
  try {
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required",
      });
    }

    // Parse in UTC
    const queryDate = new Date(date + "T00:00:00.000Z");

    const bookings = await SeatBooking.find({
      bookingDate: queryDate,
      status: "active",
    });

    const bookedSeats = bookings.map((b) => b.seatNumber);
    const totalSeats = 95;

    res.status(200).json({
      success: true,
      bookedSeats,
      totalBooked: bookings.length,
      availableSeats: totalSeats - bookings.length,
      date: queryDate,
    });
  } catch (error) {
    console.error("Get availability error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching seat availability",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get locked seats (PUBLIC - no auth needed)
exports.getPublicLockedSeats = async (req, res) => {
  try {
    const lockedSeats = await LockedSeat.find()
      .select("seatNumber traineeId")
      .sort({ seatNumber: 1 })
      .lean();

    const lockedSeatNumbers = lockedSeats.map((s) => s.seatNumber);
    const lockedSeatDetails = lockedSeats.map((s) => ({
      seatNumber: s.seatNumber,
      traineeId: s.traineeId || null,
    }));

    res.status(200).json({
      success: true,
      lockedSeats: lockedSeatNumbers,
      lockedSeatDetails,
      count: lockedSeatNumbers.length,
    });
  } catch (error) {
    console.error("Error fetching public locked seats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch locked seats",
    });
  }
};
