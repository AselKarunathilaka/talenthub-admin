import { API_BASE_URL } from "./apiConfig";

// Get auth token from localStorage
const getAuthToken = () => {
  const adminInfo = localStorage.getItem("adminInfo");
  if (adminInfo) {
    const parsed = JSON.parse(adminInfo);
    return parsed.token;
  }

  const userData = localStorage.getItem("userData");
  if (userData) {
    const parsed = JSON.parse(userData);
    return parsed.token;
  }

  return null;
};

// Create API headers
const getHeaders = () => {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

// Admin Seat Management API functions
export const adminSeatApi = {
  /**
   * Get booking history for a specific intern by trainee ID or name
   * @param {string} searchTerm - Trainee ID or intern name to search for
   * @returns {Promise<Object>} Intern info and their booking history
   */
  getInternBookingHistory: async (searchTerm) => {
    try {
      const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");

      if (!adminInfo.token) {
        throw new Error("Admin authentication required");
      }

      const response = await fetch(
        `${API_BASE_URL}/admin/seat-bookings/history?search=${encodeURIComponent(searchTerm)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminInfo.token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch booking history");
      }

      return data;
    } catch (error) {
      console.error("Error fetching booking history:", error);
      throw error;
    }
  },

  /**
   * Get all seat bookings with optional date filter
   * @param {string} date - Optional date filter (YYYY-MM-DD)
   * @returns {Promise<Object>} - { success, bookings, stats }
   */
  getSeatBookings: async (date = null) => {
    try {
      let url = `${API_BASE_URL}/admin/seat-bookings`;
      if (date) {
        url += `?date=${encodeURIComponent(date)}`;
      }

      console.log(" Fetching seat bookings from:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: getHeaders(),
        cache: "no-store", // Prevent browser caching the polling request
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("Authentication failed. Please login again.");
        }
        throw new Error(`Failed to fetch seat bookings: ${response.status}`);
      }

      const data = await response.json();
      console.log(" Seat bookings fetched successfully");
      return data;
    } catch (error) {
      console.error(" Error fetching seat bookings:", error);
      throw error;
    }
  },

  /**
   * Get seat booking statistics
   * @param {string} startDate - Optional start date (YYYY-MM-DD)
   * @param {string} endDate - Optional end date (YYYY-MM-DD)
   * @returns {Promise<Object>} - { success, stats }
   */
  getBookingStats: async (startDate = null, endDate = null) => {
    try {
      let url = `${API_BASE_URL}/admin/seat-bookings/stats`;
      const params = new URLSearchParams();

      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("Authentication failed. Please login again.");
        }
        throw new Error(`Failed to fetch booking stats: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching booking stats:", error);
      throw error;
    }
  },

  /**
   * Get booking details for a specific seat
   * @param {number} seatNumber - Seat number (1-96)
   * @param {string} date - Optional date filter (YYYY-MM-DD)
   * @returns {Promise<Object>} - { success, booking }
   */
  getBookingBySeat: async (seatNumber, date = null) => {
    try {
      let url = `${API_BASE_URL}/admin/seat-bookings/seat/${seatNumber}`;
      if (date) {
        url += `?date=${encodeURIComponent(date)}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("Authentication failed. Please login again.");
        }
        if (response.status === 404) {
          throw new Error("No booking found for this seat");
        }
        throw new Error(`Failed to fetch seat booking: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching seat booking:", error);
      throw error;
    }
  },

  /**
   * Get all locked seat numbers
   * @returns {Promise<Object>} - { success, lockedSeats, count }
   */
  getLockedSeats: async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/seat-bookings/locked`,
        {
          method: "GET",
          headers: getHeaders(),
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch locked seats: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching locked seats:", error);
      throw error;
    }
  },

  /**
   * Lock a seat
   * @param {number} seatNumber - Seat number to lock
   * @param {string} traineeId - Optional trainee ID to attach to the lock
   * @returns {Promise<Object>} - { success, message, seatNumber }
   */
  lockSeat: async (seatNumber, traineeId = null) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/seat-bookings/lock`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ seatNumber, traineeId: traineeId || null }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Failed to lock seat: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error("Error locking seat:", error);
      throw error;
    }
  },

  /**
   * Unlock a seat
   * @param {number} seatNumber - Seat number to unlock
   * @returns {Promise<Object>} - { success, message, seatNumber }
   */
  unlockSeat: async (seatNumber) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/seat-bookings/unlock`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ seatNumber }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Failed to unlock seat: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error("Error unlocking seat:", error);
      throw error;
    }
  },

  /**
   * Get interns who booked a seat but haven't scanned daily attendance
   * @param {string} date - Date filter (YYYY-MM-DD)
   * @returns {Promise<Object>} - { success, date, pendingCheckIns, count }
   */
  getPendingCheckIns: async (date) => {
    try {
      let url = `${API_BASE_URL}/admin/seat-bookings/pending-checkins`;
      if (date) {
        url += `?date=${encodeURIComponent(date)}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers: getHeaders(),
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("Authentication failed. Please login again.");
        }
        throw new Error(`Failed to fetch pending check-ins: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching pending check-ins:", error);
      throw error;
    }
  },
};

// CSV export utility for seat bookings
export const seatBookingCsvUtils = {
  /**
   * Convert seat bookings to CSV
   * @param {Array} bookings - Array of booking objects
   * @returns {string} - CSV content
   */
  convertToCSV: (bookings) => {
    if (!bookings || !Array.isArray(bookings) || bookings.length === 0) {
      return "";
    }

    // Define CSV headers
    const headers = [
      "Seat Number",
      "Trainee ID",
      "Name",
      "Email",
      "Booking Date",
      "Booked At",
      "Status",
    ];

    // Convert data to CSV rows
    const csvRows = [
      headers.join(","), // Header row
      ...bookings.map((booking) => {
        const bookingDate = new Date(booking.bookingDate);
        const bookedAt = new Date(booking.bookedAt);

        return [
          booking.seatNumber || "",
          booking.traineeId || "",
          `"${booking.internName || ""}"`,
          booking.email || "",
          bookingDate.toLocaleDateString("en-US"),
          bookedAt.toLocaleString("en-US"),
          booking.status || "",
        ].join(",");
      }),
    ];

    return csvRows.join("\n");
  },

  /**
   * Download CSV file
   * @param {string} csvContent - CSV content
   * @param {string} filename - Filename for download
   */
  downloadCSV: (csvContent, filename = "seat_bookings.csv") => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  },

  /**
   * Generate and download seat bookings CSV
   * @param {Array} bookings - Array of booking objects
   * @param {string} date - Optional date for filename
   */
  downloadSeatBookingsReport: (bookings, date = null) => {
    try {
      const csvContent = seatBookingCsvUtils.convertToCSV(bookings);
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = date
        ? `seat_bookings_${date}.csv`
        : `seat_bookings_${timestamp}.csv`;

      seatBookingCsvUtils.downloadCSV(csvContent, filename);
      return { success: true, filename };
    } catch (error) {
      console.error("Error generating CSV report:", error);
      throw error;
    }
  },

  /**
   * Generate and download pending check-ins CSV
   * @param {Array} pendingCheckIns - Array of { seatNumber, traineeId, name, email }
   * @param {string} date - Optional date for filename
   */
  downloadPendingCheckInsReport: (pendingCheckIns, date = null) => {
    try {
      if (!pendingCheckIns || pendingCheckIns.length === 0) {
        return { success: false, message: "No pending check-ins to export" };
      }

      const headers = ["Seat Number", "Trainee ID", "Name", "Email"];
      const rows = [
        headers.join(","),
        ...pendingCheckIns.map((item) =>
          [
            item.seatNumber || "",
            item.traineeId || "",
            `"${(item.name || "").replace(/"/g, '""')}"`,
            item.email || "",
          ].join(",")
        ),
      ];

      const csvContent = rows.join("\n");
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = date
        ? `pending_checkins_${date}.csv`
        : `pending_checkins_${timestamp}.csv`;

      seatBookingCsvUtils.downloadCSV(csvContent, filename);
      return { success: true, filename };
    } catch (error) {
      console.error("Error generating pending check-ins CSV:", error);
      throw error;
    }
  },
};

// Notification utilities
export const seatNotificationUtils = {
  showSuccess: (message) => {
    console.log("Success:", message);

    alert(` ${message}`);
  },

  showError: (message) => {
    console.error("Error:", message);

    alert(` ${message}`);
  },

  showInfo: (message) => {
    console.log("Info:", message);

    alert(` ${message}`);
  },
};

export default adminSeatApi;
