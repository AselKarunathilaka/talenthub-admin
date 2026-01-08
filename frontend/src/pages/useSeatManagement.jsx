import { useState, useCallback, useEffect } from "react";
import { API_BASE_URL } from "../api/apiConfig";

const LOCKED_SEATS = [0];

// Left section seats configuration
const leftSection = {
  topRow: [
    { number: 25, x: 3, y: 145 },
    { number: 24, x: 68, y: 145 },
    { number: 23, x: 133, y: 145 },
    { number: 22, x: 198, y: 145 },
    { number: 21, x: 263, y: 145 },
    { number: 20, x: 328, y: 145 },
    { number: 19, x: 393, y: 145 },
  ],
  pillarSeats: [
    { number: 28, angle: 300, radius: 115 },
    { number: 29, angle: 340, radius: 105 },
    { number: 30, angle: 20, radius: 105 },
    { number: 31, angle: 60, radius: 105 },
    { number: 32, angle: 120, radius: 105 },
    { number: 33, angle: 160, radius: 105 },
    { number: 26, angle: 200, radius: 105 },
    { number: 27, angle: 240, radius: 115 },
  ],
  outerRing1: [
    { number: 34, angle: 190, radius: 240 },
    { number: 0, angle: 174, radius: 225 },
    { number: 36, angle: 155, radius: 195 },
    { number: 37, angle: 133, radius: 180 },
    { number: 38, angle: 111, radius: 174 },
    { number: 39, angle: 89, radius: 170 },
   // { number: 39, angle: 80, radius: 170 },
    { number: 40, angle: 66, radius: 174 },
    { number: 41, angle: 43, radius: 180 },
    { number: 42, angle: 20, radius: 198 },
    { number: 43, angle: 0.6, radius: 228 },
    { number: 44, angle: -11, radius: 240 },
  ],
  outerRing2: [
    { number: 52, angle: 155, radius: 260 },
    { number: 51, angle: 139, radius: 255 },
    { number: 50, angle: 123, radius: 250 },
    { number: 49, angle: 107, radius: 245 },
    { number: 48, angle: 91, radius: 235 },
    { number: 47, angle: 75, radius: 240 },
    { number: 46, angle: 59, radius: 245 },
    { number: 45, angle: 43, radius: 250 },
  ],
  outerRing3: [
    { number: 55, angle: 63, radius: 312 },
    { number: 54, angle: 51, radius: 335 },
    { number: 53, angle: 42, radius: 325 },
  ],
};

// Right section seats configuration
const rightSection = {
  straightSeats: [
    { number: 1, x: 722, y: 80 },
    { number: 2, x: 787, y: 80 },
    { number: 3, x: 852, y: 80 },
    { number: 4, x: 917, y: 80 },
    { number: 5, x: 982, y: 80 },
    { number: 6, x: 1047, y: 80 },
    { number: 7, x: 1112, y: 80 },
    { number: 8, x: 1177, y: 80 },
    { number: 18, x: 657, y: 145 },
    { number: 17, x: 722, y: 145 },
    { number: 16, x: 787, y: 145 },
    { number: 15, x: 852, y: 145 },
    { number: 14, x: 917, y: 145 },
    { number: 13, x: 982, y: 145 },
    { number: 12, x: 1047, y: 145 },
    { number: 11, x: 1112, y: 145 },
    { number: 10, x: 1177, y: 145 },
    { number: 9, x: 1224, y: 145 },
    { number: 56, x: 657, y: 210 },
    { number: 57, x: 722, y: 210 },
    { number: 58, x: 787, y: 210 },
    { number: 63, x: 1047, y: 210 },
    { number: 64, x: 1112, y: 210 },
    { number: 65, x: 1159, y: 210 },
  ],
  pillarSeats: [
    { number: 61, angle: 300, radius: 115 },
    { number: 62, angle: 340, radius: 105 },
    { number: 66, angle: 20, radius: 105 },
    { number: 67, angle: 60, radius: 105 },
    { number: 68, angle: 120, radius: 105 },
    { number: 69, angle: 160, radius: 105 },
    { number: 59, angle: 200, radius: 105 },
    { number: 60, angle: 240, radius: 115 },
  ],
  outerRing1: [
    { number: 91, angle: 161, radius: 280 },
    { number: 90, angle: 151, radius: 280 },
    { number: 89, angle: 135, radius: 270 },
    { number: 87, angle: 120, radius: 260 },
    { number: 86, angle: 106, radius: 250 },
    { number: 85, angle: 92, radius: 245 },
    { number: 84, angle: 77, radius: 250 },
    { number: 83, angle: 63, radius: 260 },
    { number: 82, angle: 48, radius: 270 },
    { number: 81, angle: 32, radius: 280 },
    { number: 80, angle: 22, radius: 280 },
  ],
  outerRing2: [
    { number: 70, angle: 173, radius: 210 },
    { number: 71, angle: 160, radius: 210 },
    { number: 72, angle: 140, radius: 200 },
    { number: 73, angle: 120, radius: 180 },
    { number: 74, angle: 100, radius: 170 },
    { number: 75, angle: 80, radius: 170 },
    { number: 76, angle: 60, radius: 180 },
    { number: 77, angle: 40, radius: 200 },
    { number: 78, angle: 20, radius: 210 },
    { number: 79, angle: 7, radius: 210},
  ],
  outerRing3: [
    { number: 92, angle: 132, radius: 340 },
    { number: 93, angle: 120, radius: 330 },
    { number: 94, angle: 43, radius: 340 },
    { number: 95, angle: 31, radius: 360 },
    { number: 96, angle: 24, radius: 350 },
  ],
};

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
  const [totalBookedCount, setTotalBookedCount] = useState(0);

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
        }
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
        }
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
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to cancel booking");
      }

      const result = await response.json();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch seat availability
  const fetchSeatAvailability = useCallback(async (dateString) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/seat-reservation/availability/${dateString}`,
        {
          headers: {
            ...getAuthHeaders(),
          },
        }
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

  // Check if intern can book for date
  const canInternBookForDate = useCallback(() => {
    return Object.values(dailyBookings).length === 0;
  }, [dailyBookings]);

  // Load bookings for a specific date
  const loadBookingsForDate = useCallback(
    async (dateString) => {
      try {
        setLoading(true);

        // 1. Get all taken seats (for red color on map)
        const availability = await fetchSeatAvailability(dateString);
        const allTakenSeats = availability.bookedSeats || [];

        // 2. Get ONLY my bookings
        const response = await fetch(
          `${API_BASE_URL}/seat-reservation/bookings/intern`,
          {
            headers: getAuthHeaders(),
          }
        );

        if (!response.ok) {
          console.error("Failed to fetch my bookings");
          setDailyBookings({});
          setTakenSeatsByAnyone(allTakenSeats);
          return;
        }

        const myBookings = await response.json();

        // 3. Find booking for THIS date (critical fix: proper date match)
        const targetDate = new Date(dateString);
        targetDate.setHours(0, 0, 0, 0);

        const myBookingForDate = myBookings.find((booking) => {
          const bookingDate = new Date(booking.bookingDate);
          bookingDate.setHours(0, 0, 0, 0);
          return bookingDate.getTime() === targetDate.getTime();
        });

        // 4. Build ONLY my booking
        const myOnly = {};
        if (myBookingForDate) {
          myOnly[myBookingForDate.seatNumber] = {
            internId: myBookingForDate.internId,
            email: myBookingForDate.email,
            date: myBookingForDate.bookingDate,
            bookedAt: myBookingForDate.createdAt || myBookingForDate.bookedAt,
            id: myBookingForDate._id,
          };
        }

        setDailyBookings(myOnly); // ← Table: only YOU
        setTakenSeatsByAnyone(allTakenSeats); // ← Map: all red
        setTotalBookedCount(allTakenSeats.length);
      } catch (err) {
        console.error("Load error:", err);
        setError("Failed to load your seat");
      } finally {
        setLoading(false);
      }
    },
    [fetchSeatAvailability]
  );

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
    [loadBookingsForDate]
  );

  // Handle seat click
  const handleSeatClick = useCallback(
    (seatNumber) => {
      if (LOCKED_SEATS.includes(seatNumber)) return;

      // Check if seat is booked by anyone (not just the current intern)
      if (takenSeatsByAnyone.includes(seatNumber)) {
        alert(
          `This seat is already booked for ${formatDisplayDate(selectedDate)}.`
        );
        return;
      }

      setCurrentSeat(seatNumber);
      setShowModal(true);
    },
    [takenSeatsByAnyone, selectedDate, formatDisplayDate]
  );

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setShowModal(false);
    setCurrentSeat(null);
    setError(null);
  }, []);

  // Handle booking confirmation
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
        `Are you sure you want to cancel the booking for Seat ${seatNumber}?\nIntern ID: ${booking.internId}\nEmail: ${booking.email}`
      );

      if (!confirmed) return;

      try {
        await cancelBooking(booking.id);

        // Auto-refresh the seat layout
        await loadBookingsForDate(selectedDate);

        alert(
          `Booking for Seat ${seatNumber} has been cancelled successfully.`
        );
      } catch (err) {
        alert(`Failed to cancel booking: ${err.message}`);
      }
    },
    [dailyBookings, cancelBooking, loadBookingsForDate, selectedDate]
  );

  // Get seat status
  const getSeatStatus = useCallback(
    (seatNumber) => {
      if (LOCKED_SEATS.includes(seatNumber)) return "locked";

      // 1. If it's YOUR seat → show as "booked" (red + in table)
      if (dailyBookings[seatNumber]) return "booked";

      // 2. If it's someone else's seat → show as "taken" (red on map only)
      if (takenSeatsByAnyone.includes(seatNumber)) return "taken";

      // 3. Otherwise → available
      return "available";
    },
    [dailyBookings, takenSeatsByAnyone]
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
      await loadBookingsForDate(formatDate(today));
    };

    initializeDates();
  }, [getThreeDayRange, loadBookingsForDate]);

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
    formatDisplayDate,
    canInternBookForDate,
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
