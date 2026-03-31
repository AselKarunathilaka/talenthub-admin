import { useState, useCallback, useEffect } from "react";
import { API_BASE_URL } from "../api/apiConfig";

// Left section seats configuration
export const leftSection = {
  topRow: [
    { number: 1, x: 3, y: 145 },
    { number: 2, x: 68, y: 145 },
    { number: 3, x: 133, y: 145 },
    { number: 4, x: 198, y: 145 },
    { number: 5, x: 263, y: 145 },
    { number: 6, x: 328, y: 145 },
    { number: 7, x: 393, y: 145 },
  ],
  pillarSeats: [
    { number: 10, angle: 290, radius: 115 },
    { number: 11, angle: 330, radius: 105 },
    { number: 12, angle: 30, radius: 105 },
    { number: 13, angle: 70, radius: 105 },
    { number: 14, angle: 110, radius: 105 },
    { number: 15, angle: 150, radius: 105 },
    { number: 8, angle: 210, radius: 105 },
    { number: 9, angle: 250, radius: 115 },
  ],
  outerRing1: [
    { number: 16, angle: 190, radius: 210 },
    { number: 17, angle: 172, radius: 195 },
    { number: 18, angle: 152, radius: 185 },
    { number: 19, angle: 130, radius: 180 },
    { number: 20, angle: 109, radius: 175 },
    { number: 21, angle: 88, radius: 170 },
    { number: 22, angle: 67, radius: 175 },
    { number: 23, angle: 46, radius: 185 },
    { number: 24, angle: 25, radius: 185 },
    { number: 25, angle: 6, radius: 195 },
    { number: 26, angle: -11, radius: 210 },
  ],
  outerRing2: [
    { number: 34, angle: 155, radius: 270, locked: true },
    { number: 33, angle: 139, radius: 265, locked: true },
    { number: 32, angle: 123, radius: 255, locked: true },
    { number: 31, angle: 107, radius: 245, locked: true },
    { number: 30, angle: 91, radius: 245, locked: true },
    { number: 29, angle: 75, radius: 250, locked: true },
    { number: 28, angle: 59, radius: 260, locked: true },
    { number: 27, angle: 43, radius: 270, locked: true },
  ],
  outerRing3: [
    { number: 36, angle: 59, radius: 325, locked: true },
    { number: 35, angle: 47, radius: 335, locked: true },
    //{ number: 53, angle: 42, radius: 325, locked: true },
  ],
};

// Right section seats configuration
export const rightSection = {
  straightSeats: [
    { number: 37, x: 722, y: 80 },
    { number: 38, x: 787, y: 80 },
    { number: 39, x: 852, y: 80 },
    { number: 40, x: 917, y: 80 },
    { number: 41, x: 982, y: 80 },
    { number: 42, x: 1047, y: 80 },
    { number: 43, x: 1112, y: 80 },
    { number: 44, x: 1177, y: 80 },
    { number: 53, x: 657, y: 145 },
    { number: 52, x: 722, y: 145 },
    { number: 51, x: 787, y: 145 },
    { number: 50, x: 852, y: 145 },
    { number: 49, x: 917, y: 145 },
    { number: 48, x: 982, y: 145 },
    { number: 47, x: 1047, y: 145 },
    { number: 46, x: 1112, y: 145 },
    { number: 45, x: 1177, y: 145 },
    //{ number: 9, x: 1224, y: 145 },
    { number: 54, x: 657, y: 210 },
    { number: 55, x: 722, y: 210 },
    { number: 56, x: 787, y: 210 },
    // { number: 63, x: 1047, y: 210 },
    { number: 57, x: 1112, y: 210 },
    { number: 58, x: 1179, y: 210 },
  ],
  pillarSeats: [
    { number: 61, angle: 290, radius: 115 },
    { number: 62, angle: 330, radius: 105 },
    { number: 63, angle: 30, radius: 105 },
    { number: 64, angle: 70, radius: 105 },
    { number: 65, angle: 110, radius: 105, locked: true },
    { number: 66, angle: 150, radius: 105, locked: true },
    { number: 59, angle: 210, radius: 105 },
    { number: 60, angle: 250, radius: 115 },
  ],
  outerRing1: [
    // { number: 90, angle: 161, radius: 280 },
    { number: 84, angle: 158, radius: 280 },
    { number: 83, angle: 142, radius: 270 },
    { number: 82, angle: 126, radius: 260 },
    { number: 81, angle: 111, radius: 250 },
    { number: 80, angle: 96, radius: 245 },
    { number: 79, angle: 81, radius: 245 },
    { number: 78, angle: 65, radius: 250 },
    { number: 77, angle: 50, radius: 260 },
    { number: 76, angle: 34, radius: 270 },
    { number: 75, angle: 19, radius: 280 },
  ],
  outerRing2: [
    // { number: 70, angle: 173, radius: 210, locked: true },
    { number: 67, angle: 165, radius: 190, locked: true },
    { number: 68, angle: 145, radius: 190 },
    { number: 69, angle: 123, radius: 180 },
    { number: 70, angle: 100, radius: 170 },
    { number: 71, angle: 79, radius: 170 },
    { number: 72, angle: 57, radius: 180, locked: true },
    { number: 73, angle: 35, radius: 190, locked: true },
    { number: 74, angle: 15, radius: 190, locked: true },
    // { number: 79, angle: 7, radius: 210, locked: true },
  ],
  outerRing3: [
    { number: 85, angle: 141, radius: 350, locked: true },
    { number: 86, angle: 130, radius: 330, locked: true },
    { number: 87, angle: 38, radius: 340, locked: true },
    { number: 88, angle: 26, radius: 350, locked: true },
    //{ number: 95, angle: 24, radius: 350, locked: true },
  ],
};

// Calculate total seats and locked seats
const ALL_SEATS = [
  ...leftSection.topRow,
  ...leftSection.pillarSeats,
  ...leftSection.outerRing1,
  ...leftSection.outerRing2,
  ...leftSection.outerRing3,
  ...rightSection.straightSeats,
  ...rightSection.pillarSeats,
  ...rightSection.outerRing1,
  ...rightSection.outerRing2,
  ...rightSection.outerRing3,
];

//Total unique seats
const TOTAL_SEATS = ALL_SEATS.length;

// NOTE: Locked seats are now fetched from the API (managed by admin)
// The `locked: true` flags in seat configs above are kept for reference but no longer used.

export const useSeatManagement = () => {
  const [showModal, setShowModal] = useState(false);
  const [currentSeat, setCurrentSeat] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [dailyBookings, setDailyBookings] = useState({});
  const [minBookingDate, setMinBookingDate] = useState("");
  const [maxBookingDate, setMaxBookingDate] = useState("");
  const [takenSeatsByAnyone, setTakenSeatsByAnyone] = useState([]);
  const [allBookings, setAllBookings] = useState({});
  const [lockedSeats, setLockedSeats] = useState([]);

  // Fetch locked seats from API
  const fetchLockedSeats = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/seat-reservation/locked-seats`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch locked seats");
      }
      const data = await response.json();
      setLockedSeats(data.lockedSeats || []);
    } catch (err) {
      console.error("Error fetching locked seats:", err);
      // Fallback: empty locked seats
      setLockedSeats([]);
    }
  }, []);

  //Computed values based on current state
  const totalUnavailableCount = takenSeatsByAnyone.length;
  const totalBookedCount = takenSeatsByAnyone.filter(
    (seatNum) => !lockedSeats.includes(seatNum),
  ).length;
  const totalAvailableCount = TOTAL_SEATS - totalUnavailableCount;

  const formatDisplayDate = useCallback((dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  const getThreeDayRange = useCallback(() => {
    const today = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(today.getDate() + 3);

    return {
      minDate: today.toISOString().split("T")[0],
      maxDate: threeDaysLater.toISOString().split("T")[0],
    };
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("authToken");
    if (!token) throw new Error("No auth token found");

    return {
      Authorization: `Bearer ${token}`,
    };
  };

  // Fetch bookings by intern
  const fetchBookingsByIntern = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/seat-reservation/bookings/intern`,
        {
          headers: {
            ...getAuthHeaders(),
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch intern bookings");
      }

      return await response.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  }, []);

  // Create booking
  const createBooking = useCallback(async (bookingData) => {
    try {
      setLoading(true);

      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("Authentication required");
      }

      const response = await fetch(
        `${API_BASE_URL}/seat-reservation/bookings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(bookingData),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create booking");
      }

      return await response.json();
    } finally {
      setLoading(false);
    }
  }, []);

  // Cancel booking
  const cancelBooking = useCallback(async (bookingId) => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/seat-reservation/bookings/cancel/${bookingId}`,
        {
          method: "PUT",
          headers: {
            ...getAuthHeaders(),
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to cancel booking");
      }

      return await response.json();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch seat availability (all booked seats for the date)
  const fetchSeatAvailability = useCallback(async (dateString) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/seat-reservation/availability/${dateString}`,
        {
          headers: {
            ...getAuthHeaders(),
          },
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch availability: ${response.statusText}`);
      }
      const result = await response.json();
      return result.data || result;
    } catch (err) {
      console.error("Error fetching seat availability:", err);
      return { bookedSeats: [] };
    }
  }, []);

  // Load bookings for a specific date
  // Update the loadBookingsForDate function in useSeatManagement hook
  const loadBookingsForDate = useCallback(async (dateString) => {
    try {
      setLoading(true);

      // 1. Get ALL bookings for this date (not just availability)
      const response = await fetch(
        `${API_BASE_URL}/seat-reservation/bookings/date/${dateString}`,
        {
          headers: getAuthHeaders(),
        },
      );

      let allBookings = [];
      if (response.ok) {
        const result = await response.json();
        allBookings = result.data || result;
      } else {
        console.error("Failed to fetch bookings for date");
      }

      // 2. Create a map of all bookings with booking details
      const allBookingsMap = {};
      const allTakenSeats = [];

      allBookings.forEach((booking) => {
        const seatNum = booking.seatNumber;
        allBookingsMap[seatNum] = {
          internId: booking.internId,
          traineeId: booking.traineeId,
          email: booking.email,
          date: booking.bookingDate,
          bookedAt: booking.createdAt || booking.bookedAt,
          id: booking._id,
          // Add any other relevant booking info
        };
        allTakenSeats.push(seatNum);
      });

      // 3. Combine with locked seats
      const allUnavailableSeats = [
        ...new Set([...allTakenSeats, ...lockedSeats]),
      ];

      // 4. Get my bookings separately for cancellation purposes
      const myBookingsResponse = await fetch(
        `${API_BASE_URL}/seat-reservation/bookings/intern`,
        {
          headers: getAuthHeaders(),
        },
      );

      let myBookings = [];
      if (myBookingsResponse.ok) {
        myBookings = await myBookingsResponse.json();
      }

      // 5. Find my booking for THIS date
      const targetDate = new Date(dateString);
      targetDate.setHours(0, 0, 0, 0);

      const myBookingForDate = myBookings.find((booking) => {
        const bookingDate = new Date(booking.bookingDate);
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate.getTime() === targetDate.getTime();
      });

      // 6. Store my booking separately
      const myOnly = {};
      if (myBookingForDate) {
        myOnly[myBookingForDate.seatNumber] = {
          internId: myBookingForDate.internId,
          traineeId: myBookingForDate.traineeId,
          email: myBookingForDate.email,
          date: myBookingForDate.bookingDate,
          bookedAt: myBookingForDate.createdAt || myBookingForDate.bookedAt,
          id: myBookingForDate._id,
        };
      }

      // 7. Update state with ALL bookings and my bookings
      setDailyBookings(myOnly); // Only my bookings (for cancellation)
      setAllBookings(allBookingsMap); // Add this state
      setTakenSeatsByAnyone(allUnavailableSeats);
    } catch (err) {
      console.error("Load error:", err);
      setError("Failed to load seat bookings");
    } finally {
      setLoading(false);
    }
  }, [lockedSeats]);

  // Handle date change
  const handleDateChange = useCallback(
    async (newDate) => {
      const selected = new Date(newDate);
      const today = new Date();
      const threeDaysLater = new Date();

      threeDaysLater.setDate(today.getDate() + 3);

      //Normalize times
      today.setHours(0, 0, 0, 0);
      selected.setHours(0, 0, 0, 0);
      threeDaysLater.setHours(0, 0, 0, 0);

      //Block weekends
      const day = selected.getDay(); // 0 = Sunday, 6 = Saturday
      if (day === 0 || day === 6) {
        alert("Seat booking is only allowed on weekdays (Monday to Friday).");
        return false;
      }

      //Enforce today + next 3 days rule
      if (selected < today || selected > threeDaysLater) {
        alert("You can only book seats for today and the next 3 days.");
        return false;
      }

      //Valid weekday booking
      setSelectedDate(newDate);
      await loadBookingsForDate(newDate);
      return true;
    },
    [loadBookingsForDate],
  );

  // Handle seat click
  const handleSeatClick = useCallback(
    (seatNumber) => {
      if (lockedSeats.includes(seatNumber)) return;

      // Check if seat is booked by anyone (not just the current intern)
      if (takenSeatsByAnyone.includes(seatNumber)) {
        alert(
          `This seat is already booked for ${formatDisplayDate(selectedDate)}.`,
        );
        return;
      }

      setCurrentSeat(seatNumber);
      setShowModal(true);
    },
    [takenSeatsByAnyone, selectedDate, formatDisplayDate, lockedSeats],
  );

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setShowModal(false);
    setCurrentSeat(null);
    setError(null);
  }, []);

  // Handle booking confirmation
  const handleDateBookingConfirm = useCallback(async () => {
    try {
      const bookingData = {
        seatNumber: currentSeat,
        date: selectedDate,
      };

      await createBooking(bookingData);

      // Auto-refresh the seat layout
      await loadBookingsForDate(selectedDate);

      handleModalClose();
      return true;
    } catch (err) {
      alert(err.message);
      return false;
    }
  }, [
    currentSeat,
    selectedDate,
    createBooking,
    handleModalClose,
    loadBookingsForDate,
  ]);

  // Handle booking cancellation
  const handleCancelBooking = useCallback(
    async (seatNumber) => {
      const booking = dailyBookings[seatNumber];
      if (!booking) return;

      const confirmed = window.confirm(
        `Are you sure you want to cancel the booking for Seat ${seatNumber}?`,
      );

      if (!confirmed) return;

      try {
        await cancelBooking(booking.id);

        // Auto-refresh the seat layout
        await loadBookingsForDate(selectedDate);

        alert(
          `Booking for Seat ${seatNumber} has been cancelled successfully.`,
        );
      } catch (err) {
        alert(`Failed to cancel booking: ${err.message}`);
      }
    },
    [dailyBookings, cancelBooking, loadBookingsForDate, selectedDate],
  );

  // Get seat status
  const getSeatStatus = useCallback(
    (seatNumber) => {
      if (lockedSeats.includes(seatNumber)) return "locked";

      // If seat is booked by anyone (including you) → show as "booked"
      if (takenSeatsByAnyone.includes(seatNumber)) return "booked";

      // Otherwise → available
      return "available";
    },
    [takenSeatsByAnyone, lockedSeats],
  );

  // Initialize dates and load bookings
  useEffect(() => {
    const initializeDates = async () => {
      const today = new Date();
      const formatDate = (date) => date.toISOString().split("T")[0];
      const threeDayRange = getThreeDayRange();

      setMinBookingDate(threeDayRange.minDate);
      setMaxBookingDate(threeDayRange.maxDate);
      setSelectedDate(formatDate(today));

      // Fetch locked seats first, then load bookings
      await fetchLockedSeats();
      await loadBookingsForDate(formatDate(today));
    };

    initializeDates();
  }, [getThreeDayRange, loadBookingsForDate, fetchLockedSeats]);

  return {
    showModal,
    currentSeat,
    selectedDate,
    dailyBookings,
    minBookingDate,
    maxBookingDate,
    leftSection,
    rightSection,
    loading,
    error,
    totalBookedCount,
    totalUnavailableCount,
    totalAvailableCount,
    TOTAL_SEATS,
    allBookings,
    formatDisplayDate,
    handleDateChange,
    handleSeatClick,
    handleModalClose,
    handleDateBookingConfirm,
    handleCancelBooking,
    getSeatStatus,
    loadBookingsForDate,
    fetchBookingsByIntern,
    fetchSeatAvailability,
  };
};
