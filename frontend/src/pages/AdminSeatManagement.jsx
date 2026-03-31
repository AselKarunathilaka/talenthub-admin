import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaChair,
  FaUsers,
  FaCheckCircle,
  FaCalendarAlt,
  FaArrowLeft,
  FaSpinner,
  FaExclamationTriangle,
  FaFilter,
  FaUser,
  FaShieldAlt,
  FaDownload,
  FaSearch,
  FaTimes,
  FaHistory,
  FaLock,
  FaUnlock,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import logo from "../assets/sltlogo.jpg";
import {
  adminSeatApi,
  seatBookingCsvUtils,
  seatNotificationUtils,
} from "../api/adminSeatApi";

const TOTAL_SEATS = 88;

const AdminSeatManagement = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [searchMessage, setSearchMessage] = useState(null);

  // Seat lock management state
  const [lockedSeats, setLockedSeats] = useState([]);
  const [lockedSeatsCount, setLockedSeatsCount] = useState(0);
  const [lockLoading, setLockLoading] = useState(false);
  const [showLockManager, setShowLockManager] = useState(false);
  const [lockConfirm, setLockConfirm] = useState(null); // { seatNumber, action: 'lock' | 'unlock' }

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const [selectedDate, setSelectedDate] = useState(getTodayDate());

  const [stats, setStats] = useState({
    totalBookings: 0,
    occupiedSeats: 0,
    availableSeats: TOTAL_SEATS,
  });

  // Fetch locked seats from API
  const fetchLockedSeats = async () => {
    try {
      const data = await adminSeatApi.getLockedSeats();
      setLockedSeats(data.lockedSeats || []);
      setLockedSeatsCount(data.count || 0);
    } catch (err) {
      console.error("Failed to fetch locked seats:", err);
    }
  };

  // Handle lock/unlock a seat
  const handleToggleLock = async (seatNumber, action) => {
    setLockLoading(true);
    try {
      if (action === "lock") {
        const result = await adminSeatApi.lockSeat(seatNumber);
        seatNotificationUtils.showSuccess(result.message);
        if (result.warning) {
          setTimeout(() => seatNotificationUtils.showInfo(result.warning), 500);
        }
      } else {
        const result = await adminSeatApi.unlockSeat(seatNumber);
        seatNotificationUtils.showSuccess(result.message);
      }
      await fetchLockedSeats();
    } catch (err) {
      seatNotificationUtils.showError(err.message || `Failed to ${action} seat`);
    } finally {
      setLockLoading(false);
      setLockConfirm(null);
    }
  };

  useEffect(() => {
    fetchBookings();
    fetchLockedSeats();
  }, [selectedDate]);

  // Filter bookings based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredBookings(bookings);
      setSearchResults(null);
      setShowHistory(false);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = bookings.filter((booking) => {
      if (!booking) return false;

      const traineeId = booking.traineeId || "";
      const internName = booking.internName || "";

      return (
        traineeId.toLowerCase().includes(query) ||
        internName.toLowerCase().includes(query)
      );
    });
    setFilteredBookings(filtered);
  }, [searchQuery, bookings]);

  const isWeekend = (dateString) => {
    if (!dateString) return false;
    const day = new Date(dateString).getDay();
    return day === 0 || day === 6; // Sunday = 0, Saturday = 6
  };

  const fetchBookings = async () => {
    setLoading(true);
    setError(null);

    if (isWeekend(selectedDate)) {
      setBookings([]);
      setFilteredBookings([]);
      setStats({
        totalBookings: 0,
        occupiedSeats: 0,
        availableSeats: TOTAL_SEATS,
      });
      setLoading(false);
      return;
    }

    try {
      const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
      if (!adminInfo.token) {
        setError("Admin authentication required");
        navigate("/admin-login");
        return;
      }

      const data = await adminSeatApi.getSeatBookings(selectedDate || null);

      setBookings(data.bookings || []);
      setFilteredBookings(data.bookings || []);
      setStats(data.stats);
    } catch (err) {
      setError(err.message || "Failed to fetch bookings");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchBookingHistory = async () => {
    if (!searchQuery.trim()) {
      setSearchMessage({
        type: "info",
        text: "Please enter a trainee ID or name to search",
      });
      return;
    }

    setSearchLoading(true);
    setShowHistory(true);
    setSearchMessage(null);

    try {
      const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
      if (!adminInfo.token) {
        setError("Admin authentication required");
        navigate("/admin-login");
        return;
      }

      // Call API to get booking history for the searched intern
      const response = await adminSeatApi.getInternBookingHistory(
        searchQuery.trim(),
      );

      setSearchResults(response);

      if (response.bookings && response.bookings.length > 0) {
        setSearchMessage({
          type: "success",
          text: `Found ${response.bookings.length} booking${response.bookings.length !== 1 ? "s" : ""} for ${response.internInfo?.internName || searchQuery}`,
        });
      } else {
        setSearchMessage({
          type: "info",
          text: "No booking history found",
        });
      }
    } catch (err) {
      console.error("Search error:", err);
      setSearchMessage({
        type: "error",
        text: err.message || "Failed to fetch booking history",
      });
      setSearchResults(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
    setShowHistory(false);
    setSearchMessage(null);
    setFilteredBookings(bookings);
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const handleExportCSV = () => {
    try {
      const dataToExport =
        showHistory && searchResults?.bookings
          ? searchResults.bookings
          : filteredBookings;

      if (dataToExport.length === 0) {
        seatNotificationUtils.showInfo("No bookings to export");
        return;
      }

      seatBookingCsvUtils.downloadSeatBookingsReport(
        dataToExport,
        selectedDate,
      );
      seatNotificationUtils.showSuccess(
        `Exported ${dataToExport.length} booking${dataToExport.length !== 1 ? "s" : ""} to CSV`,
      );
    } catch (error) {
      console.error("Error exporting CSV:", error);
      seatNotificationUtils.showError("Failed to export CSV");
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const displayBookings =
    showHistory && searchResults?.bookings
      ? searchResults.bookings
      : filteredBookings;

  if (loading && bookings.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-t-4 border-b-4 border-green-500 rounded-full mx-auto mb-6"
          />
          <p className="text-gray-600 font-medium">Loading seat bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 text-gray-800 overflow-hidden">
      {/* Enhanced floating background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-80 h-80 rounded-full bg-blue-100/40 -top-20 -left-20"
          animate={{
            y: [0, -30, 0],
            x: [0, 20, 0],
            rotate: [0, 5, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute w-96 h-96 rounded-full bg-cyan-100/40 top-1/4 right-0"
          animate={{
            y: [0, 20, 0],
            x: [0, -20, 0],
            rotate: [0, -5, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />
        <motion.div
          className="absolute w-64 h-64 rounded-full bg-green-100/40 bottom-20 left-1/4"
          animate={{
            y: [0, -20, 0],
            x: [0, 15, 0],
            rotate: [0, 3, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
        />
      </div>

      {/* Main Content */}
      <div className="pt-2 sm:pt-4">
        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Header with Back Button */}
            <motion.div
              className="mb-4 md:mb-6"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center space-x-4 mb-2">
                <motion.button
                  onClick={() => navigate("/admin/dashboard")}
                  className="flex items-center space-x-2 px-3 py-2 bg-white/80 backdrop-blur-sm hover:bg-gray-50 rounded-xl border border-gray-200 shadow-sm transition-all"
                  whileHover={{ scale: 1.05, x: -5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FaArrowLeft className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">
                    Back to Dashboard
                  </span>
                </motion.button>
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600">
                  Seat Booking Monitor
                </span>
              </h2>
              <p className="text-gray-600 text-sm md:text-base">
                View and monitor intern seat booking details
              </p>
            </motion.div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <FaExclamationTriangle className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-800 font-medium">Error</p>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                  <button
                    onClick={() => setError(null)}
                    className="text-red-500 hover:text-red-700 text-xl font-bold"
                  >
                    ×
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Search Bar */}
            <motion.div
              className="bg-white/80 backdrop-blur-sm p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm mb-4 md:mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-3 lg:space-y-0 lg:space-x-4">
                <div className="flex-1">
                  <label
                    htmlFor="search-input"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Search Intern
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input
                        id="search-input"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) =>
                          e.key === "Enter" && handleSearchBookingHistory()
                        }
                        placeholder="Search by Trainee ID or Name..."
                        className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-sm shadow-sm"
                      />
                      {searchQuery && (
                        <button
                          onClick={clearSearch}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <FaTimes className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <motion.button
                      onClick={handleSearchBookingHistory}
                      disabled={!searchQuery.trim() || searchLoading}
                      className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md disabled:cursor-not-allowed"
                      whileHover={{
                        scale: searchQuery.trim() && !searchLoading ? 1.05 : 1,
                      }}
                      whileTap={{
                        scale: searchQuery.trim() && !searchLoading ? 0.95 : 1,
                      }}
                    >
                      {searchLoading ? (
                        <>
                          <FaSpinner className="h-4 w-4 animate-spin" />
                          <span>Searching...</span>
                        </>
                      ) : (
                        <>
                          <FaHistory className="h-4 w-4" />
                          <span className="hidden sm:inline">View History</span>
                          <span className="sm:hidden">History</span>
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* Inline Search Message */}
              <AnimatePresence>
                {searchMessage && (
                  <motion.div
                    className={`mt-4 p-3 rounded-xl border ${
                      searchMessage.type === "success"
                        ? "bg-green-50 border-green-200"
                        : searchMessage.type === "error"
                          ? "bg-red-50 border-red-200"
                          : "bg-blue-50 border-blue-200"
                    }`}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-sm font-medium ${
                          searchMessage.type === "success"
                            ? "text-green-800"
                            : searchMessage.type === "error"
                              ? "text-red-800"
                              : "text-blue-800"
                        }`}
                      >
                        {searchMessage.text}
                      </p>
                      <button
                        onClick={() => setSearchMessage(null)}
                        className={`${
                          searchMessage.type === "success"
                            ? "text-green-600 hover:text-green-800"
                            : searchMessage.type === "error"
                              ? "text-red-600 hover:text-red-800"
                              : "text-blue-600 hover:text-blue-800"
                        }`}
                      >
                        <FaTimes className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Statistics Cards */}
            {!showHistory && (
              <>
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                <motion.div
                  className="bg-white/80 backdrop-blur-sm p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm cursor-pointer"
                  whileHover={{ scale: 1.03 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setShowLockManager(!showLockManager)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-xs sm:text-sm text-gray-500 mb-1">
                        Locked Seats
                      </p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-800">
                        {lockedSeatsCount}
                      </p>
                      <p className="text-xs text-blue-500 mt-1">
                        {showLockManager ? "Hide manager ▲" : "Click to manage ▼"}
                      </p>
                    </div>
                    <FaLock className="text-xl sm:text-2xl text-blue-500" />
                  </div>
                </motion.div>

                <motion.div
                  className="bg-white/80 backdrop-blur-sm p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm"
                  whileHover={{ scale: 1.03 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-xs sm:text-sm text-gray-500 mb-1">
                        Occupied Seats
                      </p>
                      <p className="text-xl sm:text-2xl font-bold text-purple-600">
                        {stats.occupiedSeats}
                      </p>
                    </div>
                    <FaCheckCircle className="text-xl sm:text-2xl text-purple-500" />
                  </div>
                </motion.div>

                <motion.div
                  className="bg-white/80 backdrop-blur-sm p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm"
                  whileHover={{ scale: 1.03 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-xs sm:text-sm text-gray-500 mb-1">
                        Available Seats
                      </p>
                      <p className="text-xl sm:text-2xl font-bold text-green-600">
                        {TOTAL_SEATS - (stats.occupiedSeats + lockedSeatsCount)}
                      </p>
                    </div>
                    <FaChair className="text-xl sm:text-2xl text-green-500" />
                  </div>
                </motion.div>
              </motion.div>

              {/* Seat Lock Manager Panel */}
              <AnimatePresence>
                {showLockManager && (
                  <motion.div
                    className="bg-white/80 backdrop-blur-sm p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm mb-6 mt-4"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          <FaLock className="text-blue-500" />
                          Manage Seat Locks
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Click a seat to lock/unlock it. Locked seats cannot be booked by interns.
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-4 h-4 bg-gray-400 rounded"></div>
                          <span>Locked</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-4 h-4 bg-green-400 rounded"></div>
                          <span>Unlocked</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-8 sm:grid-cols-11 gap-1.5">
                      {Array.from({ length: TOTAL_SEATS }, (_, i) => i + 1).map((seatNum) => {
                        const isLocked = lockedSeats.includes(seatNum);
                        return (
                          <motion.button
                            key={seatNum}
                            onClick={() => setLockConfirm({ seatNumber: seatNum, action: isLocked ? "unlock" : "lock" })}
                            disabled={lockLoading}
                            className={`relative flex flex-col items-center justify-center p-1.5 rounded-lg text-xs font-bold transition-all border ${
                              isLocked
                                ? "bg-gray-400 text-white border-gray-500 hover:bg-gray-500"
                                : "bg-green-100 text-green-700 border-green-300 hover:bg-green-200"
                            } ${lockLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                            whileHover={lockLoading ? {} : { scale: 1.15 }}
                            whileTap={lockLoading ? {} : { scale: 0.9 }}
                            title={isLocked ? `Seat ${seatNum} (Locked) — Click to unlock` : `Seat ${seatNum} (Open) — Click to lock`}
                          >
                            {isLocked ? (
                              <FaLock className="text-[10px] mb-0.5" />
                            ) : (
                              <FaUnlock className="text-[10px] mb-0.5" />
                            )}
                            <span>{seatNum}</span>
                          </motion.button>
                        );
                      })}
                    </div>

                    <div className="mt-4 flex flex-col sm:flex-row items-center justify-between text-sm text-gray-600 gap-2">
                      <span>
                        {lockedSeatsCount} of {TOTAL_SEATS} seats locked
                      </span>
                      <span className="text-xs text-gray-400">
                        Changes take effect immediately for intern bookings
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Lock Confirmation Modal */}
              <AnimatePresence>
                {lockConfirm && (
                  <motion.div
                    className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setLockConfirm(null)}
                  >
                    <motion.div
                      className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-center mb-4">
                        {lockConfirm.action === "lock" ? (
                          <FaLock className="mx-auto text-3xl text-red-500 mb-3" />
                        ) : (
                          <FaUnlock className="mx-auto text-3xl text-green-500 mb-3" />
                        )}
                        <h3 className="text-lg font-bold text-gray-900">
                          {lockConfirm.action === "lock" ? "Lock" : "Unlock"} Seat {lockConfirm.seatNumber}?
                        </h3>
                        <p className="text-sm text-gray-600 mt-2">
                          {lockConfirm.action === "lock"
                            ? "Interns will no longer be able to book this seat."
                            : "This seat will become available for interns to book."}
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setLockConfirm(null)}
                          disabled={lockLoading}
                          className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleToggleLock(lockConfirm.seatNumber, lockConfirm.action)}
                          disabled={lockLoading}
                          className={`flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                            lockConfirm.action === "lock"
                              ? "bg-red-500 hover:bg-red-600"
                              : "bg-green-500 hover:bg-green-600"
                          }`}
                        >
                          {lockLoading ? (
                            <FaSpinner className="animate-spin" />
                          ) : lockConfirm.action === "lock" ? (
                            <><FaLock /> Lock</>
                          ) : (
                            <><FaUnlock /> Unlock</>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
              </>
            )}

            {/* Date Filter and Export */}
            {!showHistory && (
              <motion.div
                className="bg-white/80 backdrop-blur-sm p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm mb-4 md:mb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.3 }}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-3 lg:space-y-0">
                  <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                    <div className="flex items-center space-x-2">
                      <FaFilter className="text-gray-500 h-4 w-4" />
                      <label
                        htmlFor="date-filter"
                        className="text-sm font-medium text-gray-700"
                      >
                        Filter by Date:
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="date"
                        id="date-filter"
                        value={selectedDate}
                        onChange={handleDateChange}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-sm shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Export Button */}
                  <motion.button
                    onClick={handleExportCSV}
                    disabled={displayBookings.length === 0}
                    className="flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md disabled:cursor-not-allowed"
                    whileHover={{
                      scale: displayBookings.length === 0 ? 1 : 1.05,
                    }}
                    whileTap={{
                      scale: displayBookings.length === 0 ? 1 : 0.95,
                    }}
                  >
                    <FaDownload className="h-4 w-4" />
                    <span>Export to CSV</span>
                    {displayBookings.length > 0 && (
                      <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                        {displayBookings.length}
                      </span>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Export Button for History View */}
            {showHistory && searchResults && (
              <motion.div
                className="mb-4 md:mb-6 flex justify-end"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.button
                  onClick={handleExportCSV}
                  disabled={displayBookings.length === 0}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md disabled:cursor-not-allowed"
                  whileHover={{
                    scale: displayBookings.length === 0 ? 1 : 1.05,
                  }}
                  whileTap={{ scale: displayBookings.length === 0 ? 1 : 0.95 }}
                >
                  <FaDownload className="h-4 w-4" />
                  <span>Export History to CSV</span>
                  {displayBookings.length > 0 && (
                    <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                      {displayBookings.length}
                    </span>
                  )}
                </motion.button>
              </motion.div>
            )}

            {/* Bookings Table */}
            <motion.div
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.3 }}
            >
              <div className="px-4 md:px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-base md:text-lg lg:text-xl font-semibold text-gray-900">
                    {showHistory && searchResults
                      ? `Booking History - ${searchResults.internInfo?.internName || "Intern"}`
                      : `Seat Bookings${selectedDate ? ` - ${formatDate(selectedDate)}` : ""}`}
                  </h2>
                  {(loading || searchLoading) && (
                    <FaSpinner className="animate-spin text-blue-500 h-5 w-5" />
                  )}
                </div>
              </div>

              {displayBookings.length === 0 ? (
                <div className="text-center py-12 md:py-16 bg-gray-50 px-4">
                  <FaChair className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-base md:text-lg font-medium text-gray-700 mb-2">
                    No bookings found
                  </h3>
                  <p className="text-gray-500 text-sm md:text-base">
                    {showHistory
                      ? "No booking history found"
                      : selectedDate
                        ? `No seat bookings found for ${formatDate(selectedDate)}`
                        : "There are no active seat bookings at the moment"}
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="block lg:hidden">
                    <div className="divide-y divide-gray-200">
                      {displayBookings.map((booking) => (
                        <motion.div
                          key={booking._id}
                          className="p-4 hover:bg-gray-50 transition-colors"
                          whileHover={{ y: -2 }}
                          transition={{ duration: 0.1 }}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-100 to-cyan-100 flex items-center justify-center shadow-sm">
                                  <span className="text-sm font-bold text-blue-600">
                                    #{booking.seatNumber}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {booking.internName}
                                </div>
                                <div className="text-xs text-gray-600">
                                  {booking.traineeId}
                                </div>
                              </div>
                            </div>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                booking.status === "active"
                                  ? "bg-green-100 text-green-600 border border-green-200"
                                  : "bg-red-100 text-red-600 border border-red-200"
                              }`}
                            >
                              {booking.status}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs text-gray-700 truncate">
                              📧 {booking.email}
                            </div>
                            <div className="text-xs text-gray-600">
                              📅 Booking: {formatDate(booking.bookingDate)}
                            </div>
                            <div className="text-xs text-gray-600">
                              ⏰ Booked: {formatDateTime(booking.bookedAt)}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden lg:block">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Seat Number
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Trainee ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Booking Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Booked At
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {displayBookings.map((booking) => (
                          <motion.tr
                            key={booking._id}
                            className="hover:bg-gray-50 transition-colors"
                            whileHover={{ y: -2 }}
                            transition={{ duration: 0.1 }}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                                #{booking.seatNumber}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {booking.traineeId}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-8 w-8">
                                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-100 to-cyan-100 flex items-center justify-center shadow-sm">
                                    <FaUser className="text-blue-600 text-xs" />
                                  </div>
                                </div>
                                <div className="ml-3">
                                  <div className="text-sm font-medium text-gray-900">
                                    {booking.internName}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(booking.bookingDate)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {formatDateTime(booking.bookedAt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  booking.status === "active"
                                    ? "bg-green-100 text-green-600 border border-green-200"
                                    : "bg-red-100 text-red-600 border border-red-200"
                                }`}
                              >
                                {booking.status}
                              </span>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Results Summary */}
                  <div className="px-4 md:px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <p className="text-sm text-gray-600 text-center">
                      Showing {displayBookings.length} booking
                      {displayBookings.length !== 1 ? "s" : ""}
                      {showHistory
                        ? ` for ${searchResults?.internInfo?.internName || "intern"}`
                        : selectedDate
                          ? ` for ${formatDate(selectedDate)}`
                          : ""}
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminSeatManagement;
