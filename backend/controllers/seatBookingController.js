const SeatBooking = require("../models/SeatReserve");
const Intern = require("../models/Intern");

// Create a new booking
exports.createBooking = async (req, res) => {
  try {
    const { seatNumber, date } = req.body;

    // Get intern identity from JWT (set by authenticateUser middleware)
    const { id } = req.user || {};

    // Validate authentication
    if (!id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid or missing authentication token",
      });
    }

    // Fetch intern details from database
    const intern = await Intern.findById(id);
    if (!intern) {
      return res.status(404).json({
        success: false,
        message: "Intern not found in database",
      });
    }

    // Extract needed data from intern document
    const internId = intern._id.toString();
    const email = intern.Trainee_Email;
    // You can also access intern.Trainee_ID if needed for display purposes

    // Validate required fields
    if (!seatNumber || !date) {
      return res.status(400).json({
        success: false,
        message: "Seat number and date are required",
      });
    }

    // Normalize date to start of day
    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);

    // Validate date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      return res.status(400).json({
        success: false,
        message: "Cannot book seats for past dates",
      });
    }

    // Check if seat is already booked for this date
    const existingBooking = await SeatBooking.findOne({
      seatNumber,
      bookingDate,
      status: "active",
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: `Seat ${seatNumber} is already booked for this date`,
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

    // Create the booking
    const booking = await SeatBooking.create({
      seatNumber,
      internId,
      email,
      bookingDate,
      status: "active",
    });

    // Return response matching frontend expectations
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

    // Parse and normalize the date
    const queryDate = new Date(date);
    queryDate.setHours(0, 0, 0, 0);

    const bookings = await SeatBooking.find({
      bookingDate: queryDate,
      status: "active",
    }).sort({ seatNumber: 1 });

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

    // Fetch intern to get internId (can access both _id and Trainee_ID if needed)
    const intern = await Intern.findById(id);
    if (!intern) {
      return res.status(404).json({
        success: false,
        message: "Intern not found in database",
      });
    }

    const internId = intern._id.toString();

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

    const internId = intern._id.toString();

    const booking = await SeatBooking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Verify the booking belongs to the authenticated user
    if (booking.internId !== internId) {
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

    //Delete thr booking
    await SeatBooking.findByIdAndDelete(bookingId);

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking: {
        _id: booking._id,
        seatNumber: booking.seatNumber,
        bookingDate: booking.bookingDate,
        status: "cancelled",
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

    const queryDate = new Date(date);
    queryDate.setHours(0, 0, 0, 0);

    const bookings = await SeatBooking.find({
      bookingDate: queryDate,
      status: "active",
    });

    const bookedSeats = bookings.map((b) => b.seatNumber);
    const totalSeats = 96; // Total number of seats in the system

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
