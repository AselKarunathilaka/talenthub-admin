import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavigation from "../components/AdminNavigation";
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
import { API_BASE_URL } from "../api/apiConfig";
import { Armchair, Map as MapIcon, List, Mail, Clock, Calendar, ChevronLeft } from "lucide-react";

import {
  adminSeatApi,
  seatBookingCsvUtils,
  seatNotificationUtils,
} from "../api/adminSeatApi";
import { leftSection, rightSection, useMapScale, getLocalISODate } from "./useSeatManagement";

const TOTAL_SEATS = 88;

const AdminSeatManagement = () => {
  const navigate = useNavigate();
  const mapViewportRef = useRef(null);
  const MAP_WIDTH = 1480;
  const MAP_HEIGHT = 770;

  const [scale, setScale] = useState(0.85);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let observer;
    const updateScale = () => {
      if (!mapViewportRef.current) return;
      const rect = mapViewportRef.current.getBoundingClientRect();
      if (rect.width === 0) return;
      // Maximize seat area size to comfortably fill the container
      const scaleX = (rect.width / MAP_WIDTH) * 0.985;
      const fitScale = Math.min(Math.max(scaleX, 0.65), 1.05);
      setScale(fitScale);
      setReady(true);
    };

    updateScale();
    if (mapViewportRef.current) {
      observer = new ResizeObserver(updateScale);
      observer.observe(mapViewportRef.current);
    }
    window.addEventListener("resize", updateScale);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [MAP_WIDTH]);
  const [activeTab, setActiveTab] = useState("map");
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [searchMessage, setSearchMessage] = useState(null);

  const dateInputRef = useRef(null);
  const [selectedSeatModal, setSelectedSeatModal] = useState(null); // { seatNumber, isLocked, isBooked, booking, lockDetail }
  const [seatModalTab, setSeatModalTab] = useState("book"); // "book" | "lock" | "unlock" | "view"
  const [bookingTraineeId, setBookingTraineeId] = useState("");
  const [seatActionLoading, setSeatActionLoading] = useState(false);

  // Seat lock management state
  const [lockedSeats, setLockedSeats] = useState([]);
  const [lockedSeatDetailsBySeat, setLockedSeatDetailsBySeat] = useState({}); // { seatNum: { traineeId } }
  const [lockedSeatsCount, setLockedSeatsCount] = useState(0);
  const [lockLoading, setLockLoading] = useState(false);
  const [lockConfirm, setLockConfirm] = useState(null); // { seatNumber, action: 'lock' | 'unlock' }
  const [lockTraineeId, setLockTraineeId] = useState(""); // Trainee ID input for locking


  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    if (now.getHours() > 16 || (now.getHours() === 16 && now.getMinutes() >= 30)) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return getLocalISODate(tomorrow);
    }
    return getLocalISODate(now);
  });

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
      // Build a quick lookup map: { seatNumber -> { traineeId } }
      const detailsMap = {};
      (data.lockedSeatDetails || []).forEach((d) => {
        detailsMap[d.seatNumber] = d;
      });
      setLockedSeatDetailsBySeat(detailsMap);
    } catch (err) {
      console.error("Failed to fetch locked seats:", err);
    }
  };

  // Handle lock/unlock a seat
  const handleToggleLock = async (seatNumber, action, customTraineeId) => {
    setLockLoading(true);
    setSeatActionLoading(true);
    try {
      const tId = customTraineeId !== undefined ? customTraineeId : lockTraineeId;
      if (action === "lock") {
        const result = await adminSeatApi.lockSeat(seatNumber, tId?.trim() || null);
        seatNotificationUtils.showSuccess(result.message);
        if (result.warning) {
          setTimeout(() => seatNotificationUtils.showInfo(result.warning), 500);
        }
      } else {
        const result = await adminSeatApi.unlockSeat(seatNumber);
        seatNotificationUtils.showSuccess(result.message);
      }
      await fetchLockedSeats();
      await fetchBookings(); // Refresh bookings too in case a locked seat had a booking
    } catch (err) {
      seatNotificationUtils.showError(err.message || `Failed to ${action} seat`);
    } finally {
      setLockLoading(false);
      setSeatActionLoading(false);
      setLockConfirm(null);
      setSelectedSeatModal(null);
      setLockTraineeId(""); // Reset trainee ID input
    }
  };

  // Admin Book a Seat for an intern
  const handleAdminBookSeat = async (seatNumber, traineeId) => {
    if (!traineeId || !traineeId.trim()) {
      seatNotificationUtils.showError("Please enter a Trainee ID");
      return;
    }
    setSeatActionLoading(true);
    try {
      const result = await adminSeatApi.bookSeat(seatNumber, selectedDate, traineeId.trim());
      seatNotificationUtils.showSuccess(result.message || `Seat ${seatNumber} booked successfully`);
      setSelectedSeatModal(null);
      setBookingTraineeId("");
      await fetchBookings();
      await fetchLockedSeats();
    } catch (err) {
      seatNotificationUtils.showError(err.message || "Failed to book seat");
    } finally {
      setSeatActionLoading(false);
    }
  };

  // Admin Cancel a Booking
  const handleAdminCancelBooking = async (bookingId, seatNumber) => {
    setSeatActionLoading(true);
    try {
      const result = await adminSeatApi.cancelBooking({
        bookingId,
        seatNumber,
        date: selectedDate,
      });
      seatNotificationUtils.showSuccess(result.message || `Booking for Seat ${seatNumber} cancelled`);
      setSelectedSeatModal(null);
      await fetchBookings();
      await fetchLockedSeats();
    } catch (err) {
      seatNotificationUtils.showError(err.message || "Failed to cancel booking");
    } finally {
      setSeatActionLoading(false);
    }
  };

  // Silent refresh for polling — doesn't trigger loading spinner
  const silentRefresh = async () => {
    try {
      if (isWeekend(selectedDate)) return;
      const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
      if (!adminInfo.token) return;

      const data = await adminSeatApi.getSeatBookings(selectedDate || null);
      setBookings(data.bookings || []);
      setStats(data.stats);
    } catch (err) {
      console.error("Silent refresh failed:", err);
    }
  };


  useEffect(() => {
    fetchBookings();
    fetchLockedSeats();

    // Auto-refresh every 15 seconds — uses silent refresh to avoid loading spinner
    const pollInterval = setInterval(() => {
      silentRefresh();
      fetchLockedSeats();
    }, 15000);

    return () => clearInterval(pollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);


  // Build a seat-number -> booking lookup for the floor plan
  const bookingsBySeat = {};
  bookings.forEach((b) => {
    if (b.seatNumber) {
      bookingsBySeat[b.seatNumber] = b;
    }
  });


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

  const [exportingPendingCheckIns, setExportingPendingCheckIns] = useState(false);

  const handleExportPendingCheckIns = async () => {
    setExportingPendingCheckIns(true);
    try {
      const data = await adminSeatApi.getPendingCheckIns(selectedDate);
      if (!data.pendingCheckIns || data.pendingCheckIns.length === 0) {
        seatNotificationUtils.showInfo("No pending check-ins found for this date");
        return;
      }
      seatBookingCsvUtils.downloadPendingCheckInsReport(
        data.pendingCheckIns,
        selectedDate,
      );
      seatNotificationUtils.showSuccess(
        `Exported ${data.pendingCheckIns.length} pending check-in${data.pendingCheckIns.length !== 1 ? "s" : ""} to CSV`,
      );
    } catch (error) {
      console.error("Error exporting pending check-ins:", error);
      seatNotificationUtils.showError(error.message || "Failed to export pending check-ins");
    } finally {
      setExportingPendingCheckIns(false);
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

  // Removed blocking loading screen to allow immediate render

  return (
    <AdminNavigation>
      <div className="min-h-full relative font-sans text-slate-800 flex flex-col select-none">
        <main className="relative flex-1 p-3 sm:p-6 sm:px-8 mx-auto max-w-[1400px] w-full flex flex-col gap-5 sm:gap-6 min-w-0">

          {/* Normal Flow Back Button before page heading (History page only) */}
          {showHistory && (
            <div className="w-full -mt-2 sm:-mt-4 mb-1">
              <button
                onClick={clearSearch}
                className="flex items-center gap-2 text-slate-500 hover:text-[#000066] transition-colors w-fit px-3 py-1.5 -ml-3 rounded-lg hover:bg-slate-200/50 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.5} />
                <span className="text-sm font-bold">Back to Seat Map</span>
              </button>
            </div>
          )}

          {/* Top header: Title on Left, matching AdminDashboard style */}
          <div className="relative flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 pt-2">

            {/* Left: Page Title */}
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="p-2.5 sm:p-3 md:p-3.5 bg-gradient-to-br from-[#000066] to-[#006600] shadow-md rounded-lg sm:rounded-xl md:rounded-2xl border border-[#006600]/20 flex-shrink-0"
              >
                <Armchair className="text-white h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
              </motion.div>
              <div className="flex flex-col justify-center">
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight"
                >
                  {showHistory && searchResults?.internInfo?.internName
                    ? `Booking History - ${searchResults.internInfo.internName}`
                    : showHistory
                    ? `Booking History - ${searchQuery}`
                    : "Seat Reservations"}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                  className="text-slate-500 mt-0.5 sm:mt-1 text-xs sm:text-sm md:text-base font-medium max-w-xl"
                >
                  {showHistory
                    ? `Trainee ID: ${searchResults?.internInfo?.traineeId || searchQuery} · ${displayBookings.length} total booking${displayBookings.length !== 1 ? "s" : ""} recorded`
                    : "View, monitor, and manage intern seat bookings."}
                </motion.p>
              </div>
            </div>

            {/* Right: Export button when viewing history */}
            {showHistory && (
              <div className="flex w-full xl:w-auto items-center gap-2 sm:gap-3">
                <motion.button
                  onClick={handleExportCSV}
                  disabled={displayBookings.length === 0}
                  className="flex-1 xl:flex-none w-full xl:w-auto flex items-center justify-center space-x-1.5 sm:space-x-2 px-3 sm:px-5 py-2.5 bg-[#50b748] hover:bg-[#43a03c] disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-[#50b748]/20 disabled:shadow-none"
                  whileHover={{ scale: displayBookings.length === 0 ? 1 : 1.05 }}
                  whileTap={{ scale: displayBookings.length === 0 ? 1 : 0.95 }}
                >
                  <FaDownload className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="whitespace-nowrap">Export Bookings ({displayBookings.length})</span>
                </motion.button>
              </div>
            )}
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start space-x-3"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <FaExclamationTriangle className="text-rose-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-rose-800 font-bold">Error</p>
                  <p className="text-sm text-rose-700">{error}</p>
                </div>
                <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 text-xl font-bold">×</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search Bar + Date + Stats Cards Row */}
          <motion.div
            className="bg-white p-4 md:p-5 rounded-3xl border border-slate-200/80 shadow-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
          >
            <div className="flex flex-col xl:flex-row xl:items-center gap-4">
              {/* Search */}
              <div className="flex-1 min-w-0">
                <label htmlFor="search-input" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Search Intern</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                    <input
                      id="search-input"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleSearchBookingHistory()}
                      placeholder="Search by Trainee ID or Name..."
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:outline-none focus:ring-2 focus:ring-[#0056a2]/30 focus:border-[#0056a2] text-slate-900 text-sm shadow-sm transition-all"
                    />
                    {searchQuery && (
                      <button onClick={clearSearch} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-white p-1 rounded-full shadow-sm">
                        <FaTimes className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <motion.button
                    onClick={handleSearchBookingHistory}
                    disabled={!searchQuery.trim() || searchLoading}
                    className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-[#000066] to-[#0056a2] hover:from-[#000055] hover:to-[#00488a] disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 text-white rounded-2xl text-sm font-bold transition-all shadow-md shadow-[#0056a2]/20 disabled:shadow-none disabled:cursor-not-allowed"
                    whileHover={{ scale: searchQuery.trim() && !searchLoading ? 1.03 : 1 }}
                    whileTap={{ scale: searchQuery.trim() && !searchLoading ? 0.97 : 1 }}
                  >
                    {searchLoading ? (
                      <><FaSpinner className="h-4 w-4 animate-spin" /><span>Searching...</span></>
                    ) : (
                      <><FaHistory className="h-4 w-4" /><span className="hidden sm:inline">View History</span><span className="sm:hidden">History</span></>
                    )}
                  </motion.button>
                </div>
              </div>

              {/* Divider */}
              <div className="hidden xl:block w-px h-16 bg-slate-200 flex-shrink-0" />

              {/* Date Picker + Stats Cards */}
              {!showHistory && (
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 flex-shrink-0">
                  {/* Date Picker */}
                  <div
                    onClick={() => {
                      try {
                        dateInputRef.current?.showPicker?.();
                      } catch {
                        dateInputRef.current?.focus();
                      }
                    }}
                    className="relative bg-slate-50 hover:bg-slate-100/80 transition-colors rounded-2xl p-3 flex items-center gap-3 border border-slate-200 min-w-[190px] cursor-pointer select-none"
                    style={{ userSelect: 'none' }}
                  >
                    <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex-shrink-0 pointer-events-none">
                      <FaCalendarAlt className="text-[#0056a2] h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0 pointer-events-none select-none">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5 pointer-events-none select-none">Select Date</label>
                      <div className="text-sm font-bold text-slate-800 pointer-events-none select-none leading-none">
                        {formatDate(selectedDate)}
                      </div>
                    </div>
                    <input
                      ref={dateInputRef}
                      type="date"
                      value={selectedDate}
                      onChange={handleDateChange}
                      className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                  </div>
                  {/* Stats Cards */}
                  <div className="flex gap-2">
                    <div className="text-center px-3 py-2.5 bg-blue-50/60 rounded-2xl border border-blue-100 min-w-[68px]">
                      <div className="text-xl font-black text-[#0056a2] leading-none mb-1">{TOTAL_SEATS}</div>
                      <div className="text-[9px] font-bold text-[#0056a2] uppercase tracking-wider text-center">Total</div>
                    </div>
                    <div className="text-center px-3 py-2.5 bg-slate-50 rounded-2xl border border-slate-200 min-w-[68px]">
                      <div className="text-xl font-black text-slate-600 leading-none mb-1">{loading ? "-" : lockedSeatsCount}</div>
                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider text-center">
                        Locked
                      </div>
                    </div>
                    <div className="text-center px-3 py-2.5 bg-rose-50 rounded-2xl border border-rose-100 min-w-[68px]">
                      <div className="text-xl font-black text-rose-600 leading-none mb-1">{loading ? "-" : stats.occupiedSeats}</div>
                      <div className="text-[9px] font-bold text-rose-500 uppercase tracking-wider">Booked</div>
                    </div>
                    <div className="text-center px-3 py-2.5 bg-emerald-50 rounded-2xl border border-emerald-100 min-w-[68px]">
                      <div className="text-xl font-black text-emerald-600 leading-none mb-1">{loading ? "-" : TOTAL_SEATS - (stats.occupiedSeats + lockedSeatsCount)}</div>
                      <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Available</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Inline Search Message */}
            <AnimatePresence>
              {searchMessage && (
                <motion.div
                  className={`mt-4 p-4 rounded-2xl border ${searchMessage.type === "success" ? "bg-emerald-50 border-emerald-200" : searchMessage.type === "error" ? "bg-rose-50 border-rose-200" : "bg-[#00b4eb]/10 border-[#00b4eb]/30"}`}
                  initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                >
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-bold ${searchMessage.type === "success" ? "text-emerald-800" : searchMessage.type === "error" ? "text-rose-800" : "text-[#0056a2]"}`}>{searchMessage.text}</p>
                    <button onClick={() => setSearchMessage(null)} className={`${searchMessage.type === "success" ? "text-emerald-600 hover:text-emerald-800" : searchMessage.type === "error" ? "text-rose-600 hover:text-rose-800" : "text-[#0056a2] hover:text-[#00b4eb]"}`}><FaTimes className="h-4 w-4" /></button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Map Section */}
          {!showHistory && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col min-h-[600px]">
            {/* Tab Bar */}
            <div className="flex border-b border-slate-100 bg-slate-50/50 p-2.5 pb-4 sm:p-3 sm:pb-4 gap-2.5 shrink-0">
              <button onClick={() => setActiveTab("map")} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm transition-all duration-100 ${activeTab === "map" ? "bg-gradient-to-r from-[#000066] to-[#0056a2] text-white shadow-lg shadow-blue-500/30 ring-1 ring-blue-400/50" : "bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 ring-1 ring-slate-200/50"}`}><MapIcon size={18} /> Seat Map</button>
              <button onClick={() => setActiveTab("bookings")} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm transition-all duration-100 ${activeTab === "bookings" ? "bg-gradient-to-r from-[#15803d] to-[#50b748] text-white shadow-lg shadow-green-500/30 ring-1 ring-green-400/50" : "bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 ring-1 ring-slate-200/50"}`}><List size={18} /> Bookings ({displayBookings.length})</button>
            </div>
            <div className="flex-1 relative bg-white flex-col" style={{ minHeight: 0 }}>
              {/* MAP TAB CONTENT */}
              <div className={`flex flex-col w-full h-full ${activeTab === "map" ? "flex" : "hidden"}`}>
                {/* Seat Layout Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-3 px-5 bg-white border-b border-slate-100 gap-3 shrink-0">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                      <div className="p-1.5 bg-gradient-to-br from-[#000066] to-[#0056a2] rounded-lg">
                        <Armchair size={16} className="text-white" />
                      </div>
                      Seat Layout
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      Click any seat to book for an intern, cancel active booking, or lock/unlock it.
                    </p>
                  </div>
                  {/* Legend */}
                  <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-lg shadow-sm flex items-center justify-center" style={{ background: "#22d3ee" }}>
                        <Armchair size={10} className="text-white" />
                      </div>
                      <span className="text-xs font-bold text-slate-600">Available</span>
                    </div>
                    <div className="w-px h-4 bg-slate-200" />
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-lg shadow-sm flex items-center justify-center" style={{ background: "#f87171" }}>
                        <FaTimes size={9} className="text-white"/>
                      </div>
                      <span className="text-xs font-bold text-slate-600">Booked</span>
                    </div>
                    <div className="w-px h-4 bg-slate-200" />
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-lg shadow-sm flex items-center justify-center" style={{ background: "#9ca3af" }}>
                        <FaLock size={7} className="text-white"/>
                      </div>
                      <span className="text-xs font-bold text-slate-600">Locked</span>
                    </div>
                  </div>
                </div>
                
                
                <div
                  ref={mapViewportRef}
                  className="w-full overflow-hidden bg-white relative flex items-center justify-center pt-1 pb-3"
                  style={{ minHeight: `${Math.round(MAP_HEIGHT * scale)}px` }}
                >
                  <div className={`relative shrink-0 mx-auto transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`} style={{ width: `${MAP_WIDTH * scale}px`, height: `${MAP_HEIGHT * scale}px` }}>
                    <div className="absolute" style={{ width: `${MAP_WIDTH}px`, height: `${MAP_HEIGHT}px`, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
                      <div className="absolute inset-0" style={{ transform: 'translate(150px, 20px)' }}>

                        {/* Section A Card Frame (Left) */}
                        <div
                          className="absolute rounded-[32px] pointer-events-none"
                          style={{
                            left: "-135px",
                            top: "-15px",
                            width: "630px",
                            height: "755px",
                            backgroundColor: "#f8fafc",
                            border: "1.5px solid #cbd5e1",
                            boxShadow: "0 4px 20px -4px rgba(148, 163, 184, 0.15)",
                          }}
                        >
                          {/* Section Title */}
                          <div className="text-center font-bold text-slate-700 text-lg tracking-wide pt-4">
                            Section A &bull; Seats 1–36
                          </div>

                          {/* Entrance Label Inside Section A */}
                          <div
                            className="absolute font-bold text-slate-700 text-lg tracking-wide"
                            style={{ left: "32px", top: "58px" }}
                          >
                            Entrance
                          </div>
                        </div>

                        {/* Section B Card Frame (Right) */}
                        <div
                          className="absolute rounded-[32px] pointer-events-none"
                          style={{
                            left: "575px",
                            top: "-15px",
                            width: "740px",
                            height: "755px",
                            backgroundColor: "#f8fafc",
                            border: "1.5px solid #cbd5e1",
                            boxShadow: "0 4px 20px -4px rgba(148, 163, 184, 0.15)",
                          }}
                        >
                          {/* Section Title */}
                          <div className="text-center font-bold text-slate-700 text-lg tracking-wide pt-4">
                            Section B &bull; Seats 37–88
                          </div>
                        </div>

                        {/* Section A Pillar Circle (centerX=180, centerY=377, radius=68) */}
                        <div
                          className="absolute rounded-full pointer-events-none"
                          style={{
                            left: "112px",
                            top: "309px",
                            width: "136px",
                            height: "136px",
                            backgroundColor: "#8ea1b6",
                            border: "2.5px solid #64748b",
                            boxShadow: "0 4px 14px rgba(100, 116, 139, 0.22), inset 0 2px 4px rgba(255, 255, 255, 0.35)",
                            zIndex: 0,
                          }}
                        />

                        {/* Section B Pillar Circle (centerX=920, centerY=377, radius=68) */}
                        <div
                          className="absolute rounded-full pointer-events-none"
                          style={{
                            left: "852px",
                            top: "309px",
                            width: "136px",
                            height: "136px",
                            backgroundColor: "#8ea1b6",
                            border: "2.5px solid #64748b",
                            boxShadow: "0 4px 14px rgba(100, 116, 139, 0.22), inset 0 2px 4px rgba(255, 255, 255, 0.35)",
                            zIndex: 0,
                          }}
                        />

                        {(() => {
                          const AdminSeat = ({ number, x, y, angle, radius, centerX, centerY }) => {
                            const isLocked = lockedSeats.includes(number);
                            const booking = bookingsBySeat[number];
                            const isBooked = !!booking;
                            let posX = x; let posY = y;
                            if (angle !== undefined && radius !== undefined && centerX !== undefined && centerY !== undefined) {
                              posX = centerX + Math.cos((angle * Math.PI) / 180) * radius;
                              posY = centerY + Math.sin((angle * Math.PI) / 180) * radius;
                            }

                            const lockDetail = lockedSeatDetailsBySeat[number];

                            // Colors matching the uploaded image exactly
                            let bgColor, textColor, shadowColor, iconEl;
                            if (isLocked) {
                              bgColor = "#9ca3af"; // gray-400
                              textColor = "white";
                              shadowColor = "rgba(156,163,175,0.5)";
                              iconEl = <Armchair size={18} className="text-white/80 mb-0.5" />;
                            } else if (isBooked) {
                              bgColor = "#f87171"; // coral red like image
                              textColor = "white";
                              shadowColor = "rgba(248,113,113,0.55)";
                              iconEl = <FaTimes size={14} className="text-white/90 mb-0.5" />;
                            } else {
                              bgColor = "#22d3ee"; // cyan-400 like image teal/cyan
                              textColor = "white";
                              shadowColor = "rgba(34,211,238,0.5)";
                              iconEl = <Armchair size={18} className="text-white mb-0.5" />;
                            }

                            return (
                              <motion.div
                                onClick={() => {
                                  if (lockLoading || seatActionLoading) return;
                                  setSelectedSeatModal({
                                    seatNumber: number,
                                    isLocked,
                                    isBooked,
                                    booking,
                                    lockDetail,
                                  });
                                  if (isLocked) setSeatModalTab("unlock");
                                  else if (isBooked) setSeatModalTab("view");
                                  else setSeatModalTab("book");
                                  setBookingTraineeId("");
                                  setLockTraineeId("");
                                }}
                                className="absolute cursor-pointer group hover:z-20"
                                style={{
                                  left: `${posX - 26}px`,
                                  top: `${posY - 26}px`,
                                  width: "52px",
                                  height: "52px",
                                  borderRadius: "14px",
                                  background: bgColor,
                                  boxShadow: `0 4px 12px ${shadowColor}`,
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: textColor,
                                }}
                                whileHover={{ scale: 1.18, boxShadow: `0 6px 20px ${shadowColor}` }}
                                whileTap={{ scale: 0.93 }}
                                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                              >
                                {/* Default view: icon + number */}
                                <div className="flex flex-col items-center justify-center gap-0.5 group-hover:opacity-0 group-hover:scale-75 transition-all duration-200 absolute inset-0">
                                  {iconEl}
                                  <span style={{ fontSize: "12px", fontWeight: 800, lineHeight: 1 }}>{number}</span>
                                </div>

                                {/* Hover view: intern name or action */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 px-1">
                                  <span style={{ fontSize: "10px", fontWeight: 800, textAlign: "center", lineHeight: 1.15, wordBreak: "break-word" }}>
                                    {isLocked ? (lockDetail?.traineeId ? `ID: ${lockDetail.traineeId}` : "Unlock") : isBooked ? (booking.internName ? booking.internName.split(' ')[0] : (booking.traineeId || "Booked")) : "Book"}
                                  </span>
                                </div>

                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20 flex flex-col items-center whitespace-nowrap">
                                  <div className="bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-700 shadow-2xl flex flex-col items-center">
                                    <span>
                                      {isLocked
                                        ? (lockDetail?.traineeId ? `Locked: ${lockDetail.traineeId}` : "Locked Seat")
                                        : isBooked
                                        ? (booking.internName ? `${booking.internName} (${booking.traineeId || ''})` : (booking.email || "Booked"))
                                        : `Seat #${number} • Available`}
                                    </span>
                                  </div>
                                  <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-slate-900"></div>
                                </div>
                              </motion.div>
                            );
                          };

                          return (
                            <>
                              {leftSection.topRow.map((s) => <AdminSeat key={s.number} number={s.number} x={s.x} y={s.y} />)}
                              {leftSection.pillarSeats.map((s) => <AdminSeat key={s.number} number={s.number} angle={s.angle} radius={s.radius} centerX={180} centerY={377} />)}
                              {leftSection.outerRing1.map((s) => <AdminSeat key={s.number} number={s.number} angle={s.angle} radius={s.radius} centerX={180} centerY={377} />)}
                              {leftSection.outerRing2.map((s) => <AdminSeat key={s.number} number={s.number} angle={s.angle} radius={s.radius} centerX={180} centerY={377} />)}
                              {leftSection.outerRing3.map((s) => <AdminSeat key={s.number} number={s.number} angle={s.angle} radius={s.radius} centerX={180} centerY={377} />)}
                              {rightSection.straightSeats.map((s) => <AdminSeat key={s.number} number={s.number} x={s.x} y={s.y} />)}
                              {rightSection.pillarSeats.map((s) => <AdminSeat key={s.number} number={s.number} angle={s.angle} radius={s.radius} centerX={920} centerY={377} />)}
                              {rightSection.outerRing1.map((s) => <AdminSeat key={s.number} number={s.number} angle={s.angle} radius={s.radius} centerX={920} centerY={377} />)}
                              {rightSection.outerRing2.map((s) => <AdminSeat key={s.number} number={s.number} angle={s.angle} radius={s.radius} centerX={920} centerY={377} />)}
                              {rightSection.outerRing3.map((s) => <AdminSeat key={s.number} number={s.number} angle={s.angle} radius={s.radius} centerX={920} centerY={377} />)}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* end MAP TAB */}

              {/* BOOKINGS TAB CONTENT */}
              <div className={`flex flex-col w-full h-full p-4 sm:p-6 overflow-y-auto custom-scrollbar bg-slate-50/30 ${activeTab === "bookings" ? "flex" : "hidden"}`}>
                <div className="max-w-7xl mx-auto w-full">
                  <div className="w-full">
                    {/* Date Filter and Export for Bookings */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 px-2 gap-4 mt-8">
               <div>
                  <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">
                    {showHistory && searchResults
                      ? `Booking History - ${searchResults.internInfo?.internName || "Intern"}`
                      : `Seat Bookings${selectedDate ? ` - ${formatDate(selectedDate)}` : ""}`}
                  </h3>
               </div>
               <div className="flex w-full md:w-auto items-center gap-2 sm:gap-3">
                  {/* Export Pending Check-ins */}
                  {!showHistory && (
                    <motion.button
                      onClick={handleExportPendingCheckIns}
                      disabled={exportingPendingCheckIns}
                      className="flex-1 md:flex-none w-full md:w-auto flex items-center justify-center space-x-1.5 sm:space-x-2 px-2 sm:px-5 py-2.5 bg-[#ff4444] hover:bg-[#ff1111] disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-[#ff1a1a]/20 disabled:shadow-none"
                      whileHover={{ scale: exportingPendingCheckIns ? 1 : 1.05 }}
                      whileTap={{ scale: exportingPendingCheckIns ? 1 : 0.95 }}
                      title="Export interns who booked a seat but haven't scanned daily attendance"
                    >
                      {exportingPendingCheckIns ? (
                        <FaSpinner className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                      ) : (
                        <FaDownload className="h-3 w-3 sm:h-4 sm:w-4" />
                      )}
                      <span className="whitespace-nowrap">Pending Check-ins</span>
                    </motion.button>
                  )}

                  {/* Export Bookings */}
                  <motion.button
                    onClick={handleExportCSV}
                    disabled={displayBookings.length === 0}
                    className="flex-1 md:flex-none w-full md:w-auto flex items-center justify-center space-x-1.5 sm:space-x-2 px-2 sm:px-5 py-2.5 bg-[#50b748] hover:bg-[#43a03c] disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-[#50b748]/20 disabled:shadow-none"
                    whileHover={{ scale: displayBookings.length === 0 ? 1 : 1.05 }}
                    whileTap={{ scale: displayBookings.length === 0 ? 1 : 0.95 }}
                  >
                    <FaDownload className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="whitespace-nowrap">Export Bookings ({displayBookings.length})</span>
                  </motion.button>
               </div>
            </div>

            {/* Bookings Table matching Daily Logs design */}
            <motion.div
              className="bg-white rounded-xl sm:rounded-[14px] md:rounded-2xl border border-slate-200/80 shadow-md overflow-hidden relative z-10 min-h-[300px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              {/* Table title bar */}
              <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-200/80 flex items-center justify-between bg-white">
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                    Seat Bookings - {" "}
                    <span className="text-[#000066]">
                      {selectedDate ? formatDate(selectedDate) : "Today"}
                    </span>
                  </h2>
                  <p className="text-[10px] sm:text-xs text-slate-500 font-semibold mt-0.5">
                    {loading ? "Loading..." : `${displayBookings.length} booking${displayBookings.length !== 1 ? "s" : ""} total`}
                  </p>
                </div>
              </div>

              {!loading && displayBookings.length === 0 ? (
                <div className="text-center py-14 sm:py-16 px-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 shadow-xs border border-slate-200">
                    <Armchair className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-base font-bold text-slate-700 mb-1">No bookings found</h3>
                  <p className="text-slate-400 text-xs sm:text-sm font-medium max-w-sm mx-auto">
                    {selectedDate
                      ? `No seat bookings found for ${formatDate(selectedDate)}.`
                      : "There are no active seat bookings at the moment."}
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="block xl:hidden divide-y divide-slate-200/60">
                    {displayBookings.map((booking) => (
                      <div key={booking._id} className="p-4 hover:bg-slate-50/80 transition-all hover:-translate-y-px">
                        <div className="flex items-start mb-3 gap-3">
                          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-[#000066]/10 text-[#000066] flex items-center justify-center font-bold text-base flex-shrink-0 overflow-hidden shadow-inner relative border border-slate-200 mt-1">
                            <img
                              src={`${API_BASE_URL}/interns/${booking.traineeId}/profile-picture`}
                              alt={booking.internName || "Intern"}
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                            <div className="w-full h-full flex items-center justify-center hidden bg-gradient-to-br from-[#000066]/20 to-[#0056a2]/20 text-[#000066] font-bold">
                              {(booking.internName || "?")[0].toUpperCase()}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1 flex flex-col items-start">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 rounded-lg bg-[#00b4eb]/10 border border-[#00b4eb]/20 text-xs font-black text-[#0056a2]">
                                #{booking.seatNumber}
                              </span>
                              <span
                                className={`text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider ${
                                  booking.status === "active"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-rose-50 text-rose-600 border-rose-200"
                                }`}
                              >
                                {booking.status}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-slate-900 break-words w-full">
                              {booking.internName || "Unknown Intern"}
                            </p>
                            <p className="text-[10px] sm:text-xs font-medium text-slate-500 truncate w-full">
                              ID: {booking.traineeId}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-1.5 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                          <div className="text-xs font-medium text-slate-600 truncate flex items-center gap-2">
                            <Mail size={12} className="text-slate-400 shrink-0" /> {booking.email}
                          </div>
                          <div className="text-xs font-medium text-slate-600 flex items-center gap-2">
                            <Calendar size={12} className="text-slate-400 shrink-0" /> {formatDate(booking.bookingDate)}
                          </div>
                          <div className="text-xs font-medium text-slate-600 flex items-center gap-2">
                            <Clock size={12} className="text-slate-400 shrink-0" /> {formatDateTime(booking.bookedAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden xl:block overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50/80 border-b border-slate-200/80">
                        <tr>
                          <th className="px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-[9px] sm:text-[10px] md:text-xs text-left">Seat</th>
                          <th className="px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-[9px] sm:text-[10px] md:text-xs text-left">Intern</th>
                          <th className="px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-[9px] sm:text-[10px] md:text-xs text-center">Booking Date</th>
                          <th className="px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-[9px] sm:text-[10px] md:text-xs text-center">Booked At</th>
                          <th className="px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-[9px] sm:text-[10px] md:text-xs text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {displayBookings.map((booking) => (
                          <tr key={booking._id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="px-5 py-4 whitespace-nowrap text-left">
                              <div className="w-10 h-10 rounded-xl bg-[#00b4eb]/10 border border-[#00b4eb]/20 flex items-center justify-center font-extrabold text-[#0056a2] text-sm shadow-xs">
                                #{booking.seatNumber}
                              </div>
                            </td>
                            <td className="px-5 py-4 min-w-[200px] max-w-[280px] text-left">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-[#000066]/10 text-[#000066] flex items-center justify-center font-bold text-base flex-shrink-0 overflow-hidden shadow-inner relative border border-slate-200">
                                  <img
                                    src={`${API_BASE_URL}/interns/${booking.traineeId}/profile-picture`}
                                    alt={booking.internName || "Intern"}
                                    className="absolute inset-0 w-full h-full object-cover"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                  <div className="w-full h-full flex items-center justify-center hidden bg-gradient-to-br from-[#000066]/20 to-[#0056a2]/20 text-[#000066] font-bold">
                                    {(booking.internName || "?")[0].toUpperCase()}
                                  </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#000066] transition-colors break-words">
                                    {booking.internName || "Unknown Intern"}
                                  </p>
                                  <p className="text-[9px] sm:text-[10px] font-semibold text-slate-500 truncate">
                                    ID: {booking.traineeId}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap text-center text-xs sm:text-sm font-medium text-slate-600">
                              {formatDate(booking.bookingDate)}
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap text-center text-xs sm:text-sm font-medium text-slate-500">
                              {formatDateTime(booking.bookedAt)}
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap text-center">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border ${
                                  booking.status === "active"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-rose-50 text-rose-600 border-rose-200"
                                }`}
                              >
                                {booking.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-5 sm:px-6 py-3.5 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-between">
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-500">
                      Showing {displayBookings.length} booking{displayBookings.length !== 1 ? "s" : ""}
                      {selectedDate ? ` for ${formatDate(selectedDate)}` : ""}
                    </p>
                  </div>
                </>
              )}
            </motion.div>
              </div>
            </div>
          </div>
          </div>
          </div>
          )}


          {/* HISTORY VIEW BOOKINGS */}
          {showHistory && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-end px-1">
                <motion.button
                  onClick={handleExportCSV}
                  disabled={displayBookings.length === 0}
                  className="flex items-center justify-center space-x-1.5 sm:space-x-2 px-3 sm:px-5 py-2.5 bg-[#50b748] hover:bg-[#43a03c] disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-[#50b748]/20 disabled:shadow-none"
                  whileHover={{ scale: displayBookings.length === 0 ? 1 : 1.05 }}
                  whileTap={{ scale: displayBookings.length === 0 ? 1 : 0.95 }}
                >
                  <FaDownload className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="whitespace-nowrap">Export Bookings ({displayBookings.length})</span>
                </motion.button>
              </div>

              {/* History Table matching Daily Logs design */}
              <motion.div
                className="bg-white rounded-xl sm:rounded-[14px] md:rounded-2xl border border-slate-200/80 shadow-md overflow-hidden relative z-10 min-h-[300px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
              >
                {/* Table title bar */}
                <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-200/80 flex items-center justify-between bg-white">
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                      Submissions - {" "}
                      <span className="text-[#000066]">
                        {searchResults?.internInfo?.internName || searchQuery}
                      </span>
                    </h2>
                    <p className="text-[10px] sm:text-xs text-slate-500 font-semibold mt-0.5">
                      {loading ? "Loading..." : `${displayBookings.length} booking${displayBookings.length !== 1 ? "s" : ""} found`}
                    </p>
                  </div>
                </div>

                {!loading && displayBookings.length === 0 ? (
                  <div className="text-center py-14 sm:py-16 px-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 shadow-xs border border-slate-200">
                      <Armchair className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-base font-bold text-slate-700 mb-1">No booking history found</h3>
                    <p className="text-slate-400 text-xs sm:text-sm font-medium max-w-sm mx-auto">
                      No seat bookings recorded for this intern.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mobile cards */}
                    <div className="block xl:hidden divide-y divide-slate-200/60">
                      {displayBookings.map((booking) => (
                        <div key={booking._id} className="p-4 hover:bg-slate-50/80 transition-all hover:-translate-y-px">
                          <div className="flex items-start mb-3 gap-3">
                            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-[#000066]/10 text-[#000066] flex items-center justify-center font-bold text-base flex-shrink-0 overflow-hidden shadow-inner relative border border-slate-200 mt-1">
                              <img
                                src={`${API_BASE_URL}/interns/${booking.traineeId}/profile-picture`}
                                alt={booking.internName || "Intern"}
                                className="absolute inset-0 w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                              <div className="w-full h-full flex items-center justify-center hidden bg-gradient-to-br from-[#000066]/20 to-[#0056a2]/20 text-[#000066] font-bold">
                                {(booking.internName || "?")[0].toUpperCase()}
                              </div>
                            </div>
                            <div className="min-w-0 flex-1 flex flex-col items-start">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 rounded-lg bg-[#00b4eb]/10 border border-[#00b4eb]/20 text-xs font-black text-[#0056a2]">
                                  #{booking.seatNumber}
                                </span>
                                <span
                                  className={`text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider ${
                                    booking.status === "active"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-rose-50 text-rose-600 border-rose-200"
                                  }`}
                                >
                                  {booking.status}
                                </span>
                              </div>
                              <p className="text-xs sm:text-sm font-bold text-slate-900 break-words w-full">
                                {booking.internName || "Unknown Intern"}
                              </p>
                              <p className="text-[10px] sm:text-xs font-medium text-slate-500 truncate w-full">
                                ID: {booking.traineeId}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-1.5 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                            <div className="text-xs font-medium text-slate-600 truncate flex items-center gap-2">
                              <Mail size={12} className="text-slate-400 shrink-0" /> {booking.email}
                            </div>
                            <div className="text-xs font-medium text-slate-600 flex items-center gap-2">
                              <Calendar size={12} className="text-slate-400 shrink-0" /> {formatDate(booking.bookingDate)}
                            </div>
                            <div className="text-xs font-medium text-slate-600 flex items-center gap-2">
                              <Clock size={12} className="text-slate-400 shrink-0" /> {formatDateTime(booking.bookedAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden xl:block overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/80 border-b border-slate-200/80">
                          <tr>
                            <th className="px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-[9px] sm:text-[10px] md:text-xs text-left">Seat</th>
                            <th className="px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-[9px] sm:text-[10px] md:text-xs text-left">Intern</th>
                            <th className="px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-[9px] sm:text-[10px] md:text-xs text-center">Booking Date</th>
                            <th className="px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-[9px] sm:text-[10px] md:text-xs text-center">Booked At</th>
                            <th className="px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-[9px] sm:text-[10px] md:text-xs text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {displayBookings.map((booking) => (
                            <tr key={booking._id} className="hover:bg-slate-50/80 transition-colors group">
                              <td className="px-5 py-4 whitespace-nowrap text-left">
                                <div className="w-10 h-10 rounded-xl bg-[#00b4eb]/10 border border-[#00b4eb]/20 flex items-center justify-center font-extrabold text-[#0056a2] text-sm shadow-xs">
                                  #{booking.seatNumber}
                                </div>
                              </td>
                              <td className="px-5 py-4 min-w-[200px] max-w-[280px] text-left">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-[#000066]/10 text-[#000066] flex items-center justify-center font-bold text-base flex-shrink-0 overflow-hidden shadow-inner relative border border-slate-200">
                                    <img
                                      src={`${API_BASE_URL}/interns/${booking.traineeId}/profile-picture`}
                                      alt={booking.internName || "Intern"}
                                      className="absolute inset-0 w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                      }}
                                    />
                                    <div className="w-full h-full flex items-center justify-center hidden bg-gradient-to-br from-[#000066]/20 to-[#0056a2]/20 text-[#000066] font-bold">
                                      {(booking.internName || "?")[0].toUpperCase()}
                                    </div>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#000066] transition-colors break-words">
                                      {booking.internName || "Unknown Intern"}
                                    </p>
                                    <p className="text-[9px] sm:text-[10px] font-semibold text-slate-500 truncate">
                                      ID: {booking.traineeId}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap text-center text-xs sm:text-sm font-medium text-slate-600">
                                {formatDate(booking.bookingDate)}
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap text-center text-xs sm:text-sm font-medium text-slate-500">
                                {formatDateTime(booking.bookedAt)}
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap text-center">
                                <span
                                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border ${
                                    booking.status === "active"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-rose-50 text-rose-600 border-rose-200"
                                  }`}
                                >
                                  {booking.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="px-5 sm:px-6 py-3.5 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-between">
                      <p className="text-[11px] sm:text-xs font-semibold text-slate-500">
                        Showing {displayBookings.length} booking{displayBookings.length !== 1 ? "s" : ""} for {searchResults?.internInfo?.internName || searchQuery}
                      </p>
                    </div>
                  </>
                )}
              </motion.div>
            </div>
          )}
        </main>

        {/* Seat Action & Booking Modal placed outside main but inside relative container to cover everything except navbar/sidebar */}
        <AnimatePresence>
          {selectedSeatModal && (
            <>
              {/* Overlay covering full screen, under navbar/sidebar at z-[25] */}
              <div
                className="fixed inset-0 z-[25] pointer-events-auto bg-slate-900/60 backdrop-blur-md transition-all duration-300"
                onClick={() => {
                  if (!seatActionLoading) {
                    setSelectedSeatModal(null);
                    setBookingTraineeId("");
                    setLockTraineeId("");
                  }
                }}
              />

              {/* Modal container - sticky to center in viewport while respecting content area horizontal bounds */}
              <div className="absolute inset-x-0 top-0 h-full z-50 pointer-events-none">
                <div className="sticky top-[12vh] sm:top-[16vh] w-full flex justify-center px-4 pointer-events-none">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ type: "spring", damping: 26, stiffness: 320 }}
                    className="bg-white rounded-3xl shadow-2xl p-6 sm:p-7 w-full max-w-lg border border-slate-100 overflow-hidden relative pointer-events-auto max-h-[85vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#000066] via-[#0056a2] to-[#22d3ee]"></div>

                    {/* Modal Header */}
                    <div className="flex justify-between items-start mb-5 mt-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${
                            selectedSeatModal.isLocked
                              ? "bg-slate-100 text-slate-600 border border-slate-200"
                              : selectedSeatModal.isBooked
                              ? "bg-rose-50 text-rose-500 border border-rose-100"
                              : "bg-cyan-50 text-[#0056a2] border border-cyan-100"
                          }`}
                        >
                          {selectedSeatModal.isLocked ? (
                            <FaLock size={18} />
                          ) : selectedSeatModal.isBooked ? (
                            <FaTimes size={18} />
                          ) : (
                            <Armchair size={22} className="text-[#0056a2]" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                              Seat #{selectedSeatModal.seatNumber}
                            </h2>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                                selectedSeatModal.isLocked
                                  ? "bg-slate-100 text-slate-700"
                                  : selectedSeatModal.isBooked
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-cyan-100 text-cyan-800"
                              }`}
                            >
                              {selectedSeatModal.isLocked
                                ? "Locked"
                                : selectedSeatModal.isBooked
                                ? "Booked"
                                : "Available"}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <Calendar size={13} className="text-slate-400" />
                            {formatDate(selectedDate)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (!seatActionLoading) {
                            setSelectedSeatModal(null);
                            setBookingTraineeId("");
                            setLockTraineeId("");
                          }
                        }}
                        className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors"
                      >
                        <FaTimes size={16} />
                      </button>
                    </div>

                    {/* Modal Content depending on state */}
                    {selectedSeatModal.isLocked ? (
                      /* LOCKED SEAT VIEW */
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                          <p className="text-sm font-bold text-slate-700">This seat is currently locked.</p>
                          <p className="text-xs text-slate-500 mt-1">
                            Interns cannot book this seat on any date.
                            {selectedSeatModal.lockDetail?.traineeId && (
                              <span className="block mt-1 font-bold text-slate-800">
                                Tagged for Trainee ID: {selectedSeatModal.lockDetail.traineeId}
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="flex gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => setSelectedSeatModal(null)}
                            disabled={seatActionLoading}
                            className="flex-1 px-4 py-3 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all text-sm"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleLock(selectedSeatModal.seatNumber, "unlock")}
                            disabled={seatActionLoading}
                            className="flex-1 px-4 py-3 bg-[#50b748] hover:bg-[#43a03c] text-white font-bold rounded-xl transition-all shadow-lg shadow-[#50b748]/20 flex items-center justify-center gap-2 text-sm"
                          >
                            {seatActionLoading ? <FaSpinner className="animate-spin" /> : <><FaUnlock size={14} /> Unlock Seat</>}
                          </button>
                        </div>
                      </div>
                    ) : selectedSeatModal.isBooked ? (
                      /* BOOKED SEAT VIEW */
                      <div className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                          <div className="flex items-center gap-3 pb-2 border-b border-slate-200/70">
                            <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden shrink-0 border border-slate-300">
                              <img
                                src={`${API_BASE_URL}/interns/${selectedSeatModal.booking?.traineeId}/profile-picture`}
                                alt="Profile"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(selectedSeatModal.booking?.internName || 'Intern') + '&background=random';
                                }}
                              />
                            </div>
                            <div>
                              <div className="text-sm font-extrabold text-slate-900">
                                {selectedSeatModal.booking?.internName || "Booked Intern"}
                              </div>
                              <div className="text-xs font-bold text-slate-500">
                                Trainee ID: {selectedSeatModal.booking?.traineeId || "N/A"}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs font-medium text-slate-600 flex items-center gap-2 pt-1">
                            <Mail size={14} className="text-slate-400 shrink-0" />
                            <span>{selectedSeatModal.booking?.email || "N/A"}</span>
                          </div>
                          <div className="text-xs font-medium text-slate-600 flex items-center gap-2">
                            <Clock size={14} className="text-slate-400 shrink-0" />
                            <span>Booked at: {selectedSeatModal.booking?.bookedAt ? formatDateTime(selectedSeatModal.booking.bookedAt) : "N/A"}</span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => handleAdminCancelBooking(selectedSeatModal.booking?._id, selectedSeatModal.seatNumber)}
                            disabled={seatActionLoading}
                            className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 text-sm"
                          >
                            {seatActionLoading ? <FaSpinner className="animate-spin" /> : <><FaTimes size={14} /> Cancel Booking</>}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleLock(selectedSeatModal.seatNumber, "lock")}
                            disabled={seatActionLoading}
                            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                          >
                            <FaLock size={12} /> Lock Seat
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* AVAILABLE SEAT VIEW: TABS TO BOOK OR LOCK */
                      <div className="space-y-4">
                        {/* Tab switch between Book and Lock */}
                        <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
                          <button
                            type="button"
                            onClick={() => setSeatModalTab("book")}
                            className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all ${
                              seatModalTab === "book"
                                ? "bg-white text-[#0056a2] shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            Book for Intern
                          </button>
                          <button
                            type="button"
                            onClick={() => setSeatModalTab("lock")}
                            className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all ${
                              seatModalTab === "lock"
                                ? "bg-white text-rose-600 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            Lock Seat
                          </button>
                        </div>

                        {seatModalTab === "book" ? (
                          /* BOOK FORM */
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleAdminBookSeat(selectedSeatModal.seatNumber, bookingTraineeId);
                            }}
                            className="space-y-4"
                          >
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Trainee ID <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={bookingTraineeId}
                                onChange={(e) => setBookingTraineeId(e.target.value)}
                                placeholder="e.g. 3425"
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:outline-none focus:ring-2 focus:ring-[#0056a2] focus:border-[#0056a2] transition-all shadow-sm"
                                autoFocus
                              />
                              <p className="text-xs text-slate-400 mt-2 font-medium">
                                Seat will be reserved for this intern on {formatDate(selectedDate)}.
                              </p>
                            </div>

                            <div className="flex gap-3 pt-2">
                              <button
                                type="button"
                                onClick={() => setSelectedSeatModal(null)}
                                disabled={seatActionLoading}
                                className="flex-1 px-4 py-3 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all text-sm"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={!bookingTraineeId.trim() || seatActionLoading}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-[#000066] to-[#0056a2] hover:from-[#000055] hover:to-[#00488a] disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-[#0056a2]/20 flex items-center justify-center gap-2 text-sm"
                              >
                                {seatActionLoading ? (
                                  <FaSpinner className="animate-spin" />
                                ) : (
                                  <><Armchair size={15} /> Confirm Booking</>
                                )}
                              </button>
                            </div>
                          </form>
                        ) : (
                          /* LOCK FORM */
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleToggleLock(selectedSeatModal.seatNumber, "lock", lockTraineeId);
                            }}
                            className="space-y-4"
                          >
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Trainee ID <span className="text-slate-400 font-normal normal-case">(optional)</span>
                              </label>
                              <input
                                type="text"
                                value={lockTraineeId}
                                onChange={(e) => setLockTraineeId(e.target.value)}
                                placeholder="e.g. 3425"
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:outline-none focus:ring-2 focus:ring-[#00b4eb] focus:border-transparent transition-all shadow-sm"
                                autoFocus
                              />
                              <p className="text-xs text-slate-400 mt-2 font-medium">
                                Interns will not be able to book this seat.
                              </p>
                            </div>

                            <div className="flex gap-3 pt-2">
                              <button
                                type="button"
                                onClick={() => setSelectedSeatModal(null)}
                                disabled={seatActionLoading}
                                className="flex-1 px-4 py-3 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all text-sm"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={seatActionLoading}
                                className="flex-1 px-4 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 text-sm"
                              >
                                {seatActionLoading ? (
                                  <FaSpinner className="animate-spin" />
                                ) : (
                                  <><FaLock size={13} /> Confirm Lock</>
                                )}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}
                  </motion.div>
                </div>
              </div>
            </>
          )}
        </AnimatePresence>
      </div>
    </AdminNavigation>
  );
};

export default AdminSeatManagement;
