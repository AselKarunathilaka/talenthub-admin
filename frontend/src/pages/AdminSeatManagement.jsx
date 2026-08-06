import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import AdminNavigation from "../components/AdminNavigation";
import {
  FaChair,
  FaCalendarAlt,
  FaArrowLeft,
  FaSpinner,
  FaExclamationTriangle,
  FaDownload,
  FaSearch,
  FaTimes,
  FaHistory,
  FaLock,
  FaUnlock,
  FaClock,
} from "react-icons/fa";
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";
import { Armchair } from "lucide-react";
import { API_BASE_URL } from "../api/apiConfig";

import {
  adminSeatApi,
  seatBookingCsvUtils,
  seatNotificationUtils,
} from "../api/adminSeatApi";
import { leftSection, rightSection, getLocalISODate } from "./useSeatManagement";

const TOTAL_SEATS = 88;

const AdminSeatManagement = () => {
  const navigate = useNavigate();
  const [mapElement, setMapElement] = useState(null);
  const [activeSeatSection, setActiveSeatSection] = useState("A");
  const slideDir = useRef(1); // 1 = go right (A→B), -1 = go left (B→A)
  const dateInputRef = useRef(null);

  const changeSeatSection = (section) => {
    slideDir.current = section === 'B' ? 1 : -1;
    setActiveSeatSection(section);
  };
  
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!mapElement) return;
    // 630x570 is the exact tightest mathematical bounding box that fits both sections perfectly
    const secW = 630;
    const secH = 570;

    const updateScale = () => {
      const rect = mapElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const scaleX = (rect.width / secW) * 0.88;
      const scaleY = (rect.height / secH) * 0.88;
      setScale(Math.min(scaleX, scaleY));
    };

    updateScale();
    
    const observer = new ResizeObserver(() => updateScale());
    observer.observe(mapElement);
    
    window.addEventListener('resize', updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [mapElement, activeSeatSection]);
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
  const fetchLockedSeats = useCallback(async () => {
    try {
      const data = await adminSeatApi.getLockedSeats();
      setLockedSeats(data.lockedSeats || []);
      setLockedSeatsCount(data.count || 0);
      const detailsMap = {};
      (data.lockedSeatDetails || []).forEach((d) => {
        detailsMap[d.seatNumber] = d;
      });
      setLockedSeatDetailsBySeat(detailsMap);
    } catch (err) {
      console.error("Failed to fetch locked seats:", err);
    }
  }, []);

  // Handle lock/unlock a seat
  const handleToggleLock = async (seatNumber, action) => {
    setLockLoading(true);
    try {
      if (action === "lock") {
        const result = await adminSeatApi.lockSeat(seatNumber, lockTraineeId.trim() || null);
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
      setLockConfirm(null);
      setLockTraineeId(""); // Reset trainee ID input
    }
  };

  // Silent refresh for polling — doesn't trigger loading spinner
  const silentRefresh = useCallback(async () => {
    try {
      if (isWeekendDate(selectedDate)) return;
      const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
      if (!adminInfo.token) return;
      const data = await adminSeatApi.getSeatBookings(selectedDate || null);
      setBookings(data.bookings || []);
      setStats(data.stats);
    } catch (err) {
      console.error("Silent refresh failed:", err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);


  useEffect(() => {
    // Parallel initial fetch — both run at the same time
    Promise.all([fetchBookings(), fetchLockedSeats()]);

    // Auto-refresh every 30 seconds — parallel fetch, no loading spinner
    const pollInterval = setInterval(() => {
      Promise.all([silentRefresh(), fetchLockedSeats()]);
    }, 30000);

    return () => clearInterval(pollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);


  // Memoised seat-number → booking lookup for the floor plan
  const bookingsBySeat = useMemo(() => {
    const map = {};
    bookings.forEach((b) => { if (b.seatNumber) map[b.seatNumber] = b; });
    return map;
  }, [bookings]);


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
      return (
        (booking.traineeId || "").toLowerCase().includes(query) ||
        (booking.internName || "").toLowerCase().includes(query)
      );
    });
    setFilteredBookings(filtered);
  }, [searchQuery, bookings]);

  const isWeekendDate = useCallback((dateString) => {
    if (!dateString) return false;
    const day = new Date(dateString).getDay();
    return day === 0 || day === 6;
  }, []);

  // Keep old name as alias so fetchBookings can still use it
  const isWeekend = isWeekendDate;

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
    } catch (error) {
      console.error("Error exporting pending check-ins:", error);
      seatNotificationUtils.showError(error.message || "Failed to export pending check-ins");
    } finally {
      setExportingPendingCheckIns(false);
    }
  };

  const formatDate = useCallback((dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  }, []);

  const formatDateTime = useCallback((dateString) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }, []);

  const displayBookings = useMemo(
    () => (showHistory && searchResults?.bookings ? searchResults.bookings : filteredBookings),
    [showHistory, searchResults, filteredBookings]
  );

  // Removed blocking loading screen to allow immediate render

  
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  

  

  return (
    <AdminNavigation>
      <div className="seat-root">
        {/* Ambient background */}
        <div className="seat-ambient">
          <div className="seat-ambient__orb seat-ambient__orb--1" />
          <div className="seat-ambient__orb seat-ambient__orb--2" />
        </div>

        <div className="seat-content">
          <main className="seat-main">
            
            {/* Header Section */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-3xl sm:text-4xl font-extrabold text-gray-900 flex items-center gap-3 tracking-tight"
                >
                  <div className="p-2.5 bg-[#00b4eb]/10 rounded-2xl shadow-sm">
                    <Armchair className="text-[#0056a2] h-8 w-8" />
                  </div>
                  Seat Reservations
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05, duration: 0.2 }}
                  className="text-gray-500 mt-2 text-sm sm:text-base font-medium max-w-xl"
                >
                  Monitor booking status and manage intern seat allocations.
                </motion.p>
              </div>
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  className="mb-6 bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start space-x-3"
                  initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
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

            {/* Date Select + Search Bar - FULL WIDTH TOP BAR */}
            {!showHistory && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.2 }}
                className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-col md:flex-row items-center gap-6 w-full"
              >
                {/* Date Picker */}
                <div
                  onClick={() => dateInputRef.current?.showPicker()}
                  className="relative w-full lg:w-[calc(33.333%-8px)] h-[56px] bg-slate-50 rounded-2xl border border-slate-100 shrink-0 flex items-center overflow-hidden cursor-pointer"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center bg-[#00b4eb]/10 border-r border-[#00b4eb]/10">
                    <FaCalendarAlt className="text-[#00b4eb] h-5 w-5" />
                  </div>
                  <div className="pl-16 pr-4 w-full flex flex-col justify-center h-full">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                      Select Date
                    </span>
                    <input
                      ref={dateInputRef}
                      id="date-input"
                      type="date"
                      value={selectedDate}
                      onChange={handleDateChange}
                      className="bg-transparent text-sm font-bold text-gray-800 w-full focus:outline-none cursor-pointer pointer-events-none"
                    />
                  </div>
                </div>

                {/* Search Bar inline */}
                <div className="flex-1 flex items-center gap-3 w-full">
                  <div className="relative flex-1">
                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      id="search-input-top"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleSearchBookingHistory()}
                      placeholder="Search by ID or Name..."
                      className="w-full h-[56px] pl-12 pr-10 bg-slate-50 border border-gray-200 rounded-[14px] focus:ring-2 focus:ring-[#00b4eb] focus:border-transparent text-gray-900 text-sm shadow-sm transition-all"
                    />
                    {searchQuery && (
                      <button onClick={clearSearch} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-white p-1 rounded-full shadow-sm">
                        <FaTimes className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={handleSearchBookingHistory}
                    disabled={!searchQuery.trim() || searchLoading}
                    className="flex items-center justify-center gap-2 px-8 h-[56px] bg-[#0056a2] hover:bg-[#00488a] disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-[14px] text-sm font-bold transition-all shadow-md shadow-[#0056a2]/20 disabled:shadow-none shrink-0"
                  >
                    {searchLoading ? (
                      <><FaSpinner className="h-4 w-4 animate-spin" /><span>Searching...</span></>
                    ) : (
                      <><FaHistory className="h-4 w-4" /><span>History</span></>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Lock Confirmation Modal — rendered in document.body via portal to ensure true viewport centering */}
            {ReactDOM.createPortal(
              <AnimatePresence>
                {lockConfirm && (
                  <motion.div
                    className="fixed inset-0 lg:left-[270px] lg:top-[5.5rem] backdrop-blur-sm bg-slate-900/40 flex items-center justify-center z-[9999] p-4"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  >
                    <motion.div
                      className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md border border-gray-100 overflow-hidden relative"
                      initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 20, opacity: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    >
                      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#00b4eb] via-[#0056a2] to-[#50b748]"></div>
                      <div className="flex justify-between items-center mb-6 mt-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm ${lockConfirm.action === "lock" ? "bg-red-50 text-red-500" : "bg-green-50 text-green-500"}`}>
                            {lockConfirm.action === "lock" ? <FaLock size={20} /> : <FaUnlock size={20} />}
                          </div>
                          <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight">
                            {lockConfirm.action === "lock" ? "Lock Seat" : "Unlock Seat"} {lockConfirm.seatNumber}
                          </h2>
                        </div>
                        <button onClick={() => { setLockConfirm(null); setLockTraineeId(""); }} className="text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 p-2 rounded-full transition-colors">
                          <FaTimes size={16} />
                        </button>
                      </div>

                      <div className="space-y-4">
                        <p className="text-sm text-gray-600 font-medium px-1">
                          {lockConfirm.action === "lock"
                            ? "Interns will no longer be able to book this seat."
                            : "This seat will become available for interns to book."}
                        </p>
                        {lockConfirm.action === "lock" && (
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Trainee ID <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
                            <input type="text" value={lockTraineeId} onChange={(e) => setLockTraineeId(e.target.value)} placeholder="e.g. 3425" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00b4eb] focus:border-transparent transition-all shadow-sm" autoFocus />
                            <p className="text-xs text-gray-400 mt-2 font-medium">Tag this seat for a specific intern.</p>
                          </div>
                        )}
                        <div className="flex gap-3 pt-4">
                          <button onClick={() => { setLockConfirm(null); setLockTraineeId(""); }} disabled={lockLoading} className="flex-1 px-4 py-3 bg-white border-2 border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all focus:outline-none focus:ring-4 focus:ring-gray-100 active:scale-95">Cancel</button>
                          <button onClick={() => handleToggleLock(lockConfirm.seatNumber, lockConfirm.action)} disabled={lockLoading} className={`flex-1 px-4 py-3 text-white font-bold rounded-xl transition-all shadow-lg focus:outline-none focus:ring-4 active:scale-95 flex items-center justify-center gap-2 ${lockConfirm.action === "lock" ? "bg-red-500 hover:bg-red-600 shadow-red-500/30 focus:ring-red-100" : "bg-[#50b748] hover:bg-[#43a03c] shadow-[#50b748]/30 focus:ring-green-100"}`}>
                            {lockLoading ? <FaSpinner className="animate-spin" /> : (lockConfirm.action === "lock" ? <><FaLock size={14}/> Confirm Lock</> : <><FaUnlock size={14}/> Confirm Unlock</>)}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start lg:items-stretch">
              
              {/* LEFT COLUMN: Bookings List and Search */}
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.3 }}
                className={`flex flex-col ${showHistory ? "col-span-12" : "lg:col-span-4 xl:col-span-4"}`}
              >
                {/* Stats Card — Available / Booked / Locked */}
                <div className="bg-white p-3 sm:p-4 rounded-[20px] border border-gray-100 shadow-sm mb-4 w-full shrink-0">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Seat Overview</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center justify-center p-2.5 bg-[#00b4eb]/10 rounded-xl border border-[#00b4eb]/20">
                      <div className="text-2xl font-black text-[#00b4eb] leading-none mb-1">
                        {loading ? <FaSpinner className="h-4 w-4 animate-spin text-[#00b4eb]" /> : TOTAL_SEATS - (stats.occupiedSeats + lockedSeatsCount)}
                      </div>
                      <div className="text-[9px] font-black text-[#00b4eb]/80 uppercase tracking-wider">Available</div>
                    </div>
                    <div className="flex flex-col items-center justify-center p-2.5 bg-rose-50/80 rounded-xl border border-rose-100">
                      <div className="text-2xl font-black text-rose-600 leading-none mb-1">
                        {loading ? <FaSpinner className="h-4 w-4 animate-spin text-rose-500" /> : stats.occupiedSeats}
                      </div>
                      <div className="text-[9px] font-black text-rose-500/80 uppercase tracking-wider">Booked</div>
                    </div>
                    <div className="flex flex-col items-center justify-center p-2.5 bg-gray-50/80 rounded-xl border border-gray-200">
                      <div className="text-2xl font-black text-gray-600 leading-none mb-1">
                        {loading ? <FaSpinner className="h-4 w-4 animate-spin text-gray-400" /> : lockedSeatsCount}
                      </div>
                      <div className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Locked</div>
                    </div>
                  </div>

                  {/* Inline Search Message */}
                  <AnimatePresence>
                    {searchMessage && (
                      <motion.div
                        className={`mt-4 p-4 rounded-2xl border ${searchMessage.type === "success" ? "bg-[#50b748]/10 border-[#50b748]/30" : searchMessage.type === "error" ? "bg-rose-50 border-rose-200" : "bg-[#00b4eb]/10 border-[#00b4eb]/30"}`}
                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      >
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-bold ${searchMessage.type === "success" ? "text-[#15803d]" : searchMessage.type === "error" ? "text-rose-800" : "text-[#0056a2]"}`}>{searchMessage.text}</p>
                          <button onClick={() => { if (showHistory) clearSearch(); else setSearchMessage(null); }} className={`${searchMessage.type === "success" ? "text-[#15803d] hover:text-[#50b748]" : searchMessage.type === "error" ? "text-rose-600 hover:text-rose-800" : "text-[#0056a2] hover:text-[#00b4eb]"}`}><FaTimes className="h-4 w-4" /></button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden min-h-[400px] lg:min-h-0">
                  <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                    <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">
                      {showHistory && searchResults
                        ? `History - ${searchResults.internInfo?.internName || "Intern"}`
                        : "Bookings"}
                    </h3>
                    <div className="flex items-center gap-2">
                       {!showHistory && (
                         <button
                           onClick={handleExportPendingCheckIns}
                           disabled={exportingPendingCheckIns}
                           className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-2 bg-[#ff4444] hover:bg-[#ff1111] disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#ff1a1a]/20"
                           title="Export pending check-ins"
                         >
                           {exportingPendingCheckIns ? <FaSpinner className="h-3 w-3 animate-spin" /> : <FaDownload className="h-3 w-3" />}
                           <span>Not Attend</span>
                         </button>
                       )}
                       {showHistory && (
                         <button
                           onClick={clearSearch}
                           className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl text-xs font-bold transition-all shadow-sm"
                         >
                           <FaArrowLeft className="h-3 w-3" />
                           <span>Back to Map</span>
                         </button>
                       )}
                       <button
                         onClick={handleExportCSV}
                         disabled={displayBookings.length === 0}
                         className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-2 bg-[#50b748] hover:bg-[#43a03c] disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#50b748]/20"
                       >
                         <FaDownload className="h-3 w-3" />
                         <span>Booked</span>
                       </button>
                    </div>
                  </div>
                  
                  <div className={`flex-1 relative flex flex-col ${showHistory ? '' : 'lg:block'} w-full h-full`}>
                    <div className={`flex-1 overflow-y-auto custom-scrollbar p-2 ${showHistory ? '' : 'lg:absolute lg:inset-0 max-h-[650px] lg:max-h-none'}`}>
                      {!loading && displayBookings.length === 0 ? (
                      <div className="text-center py-16 bg-gray-50/50 rounded-2xl mx-2 my-2 border border-gray-100 border-dashed">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                           <FaChair className="h-6 w-6 text-gray-300" />
                        </div>
                        <h3 className="text-base font-bold text-gray-700 mb-1">No bookings</h3>
                        <p className="text-gray-500 text-xs font-medium px-4">
                          {showHistory
                            ? "No booking history found."
                            : selectedDate
                              ? `No seat bookings for ${formatDate(selectedDate)}.`
                              : "No active seat bookings."}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 p-2">
                        {displayBookings.map((booking) => (
                          <div key={booking._id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all flex items-start gap-4 group">
                            {/* Profile Image Column */}
                            <div className="relative shrink-0">
                               <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md bg-slate-50 group-hover:scale-105 transition-transform duration-300">
                                  <img 
                                    src={`${API_BASE_URL}/interns/${booking.internId}/profile-picture`}
                                    alt={booking.internName}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src = "https://ui-avatars.com/api/?name=" + encodeURIComponent(booking.internName || 'Intern') + "&background=00b4eb&color=fff";
                                    }}
                                  />
                               </div>
                            </div>
                            
                            {/* Details Column */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center pt-0.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-extrabold text-gray-900 truncate">{booking.internName}</div>
                                  <div className="text-xs font-bold text-gray-500 mt-0.5 truncate tracking-wide">{booking.traineeId}</div>
                                </div>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shrink-0 ${booking.status === "active" ? "bg-[#50b748]/10 text-[#15803d]" : "bg-rose-50 text-rose-600"}`}>
                                  {booking.status}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2 mt-2.5">
                                 <div className="flex items-center gap-1.5 bg-[#0056a2]/10 px-2 py-1 rounded-lg border border-[#0056a2]/10">
                                    <FaChair className="text-[#0056a2] h-3 w-3 shrink-0" />
                                    <span className="text-[10px] font-black text-[#0056a2]">Seat: {booking.seatNumber}</span>
                                 </div>
                                 <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                    <FaCalendarAlt className="text-[#00b4eb] h-3 w-3 shrink-0" />
                                    <span className="text-[10px] font-bold text-gray-600">{formatDate(booking.bookingDate)}</span>
                                 </div>
                                 <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                    <FaClock className="text-gray-400 h-3 w-3 shrink-0" />
                                    <span className="text-[10px] font-bold text-gray-600">{formatDateTime(booking.bookedAt)}</span>
                                 </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    </div>
                  </div>
                  <div className="px-6 py-3 bg-slate-50/80 border-t border-gray-100 mt-auto">
                    <p className="text-[10px] font-bold text-gray-500 text-center uppercase tracking-wider">
                      Showing {displayBookings.length} booking{displayBookings.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* RIGHT COLUMN: Seat Layout */}
              {!showHistory && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25, duration: 0.3 }}
                  className="lg:col-span-8 xl:col-span-8 flex flex-col bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden h-full"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft') changeSeatSection('A');
                    if (e.key === 'ArrowRight') changeSeatSection('B');
                  }}
                  style={{ outline: 'none' }}
                >
                  {/* Header: Section Tabs + Legend + Arrow Nav */}
                  <div className="px-5 pt-5 pb-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-gray-50">
                    {/* Section Tabs */}
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-2xl border border-slate-100">
                      <button
                        onClick={() => changeSeatSection('A')}
                        className={`relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black border transition-colors duration-200 ${
                          activeSeatSection === 'A'
                            ? 'bg-white text-[#0056a2] shadow-sm border-gray-100'
                            : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        {activeSeatSection === 'A' && <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-4 bg-[#00b4eb] rounded-full"></span>}
                        <span className="pl-1">Section A</span>
                      </button>
                      <button
                        onClick={() => changeSeatSection('B')}
                        className={`relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black border transition-colors duration-200 ${
                          activeSeatSection === 'B'
                            ? 'bg-white text-[#0056a2] shadow-sm border-gray-100'
                            : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        {activeSeatSection === 'B' && <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-4 bg-rose-400 rounded-full"></span>}
                        <span className="pl-1">Section B</span>
                      </button>
                    </div>
                    {/* Section Info Replacing Legend & Arrows */}
                    <div className="flex items-center">
                      <span className="text-sm font-black text-gray-400 uppercase tracking-wider">
                        {activeSeatSection === 'A' ? 'Section A . Seats 1 - 36' : 'Section B . Seats 37 - 88'}
                      </span>
                    </div>
                  </div>

                  {/* Seat Map Canvas */}
                  <div className="flex-1 p-4 sm:p-5 flex flex-col">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeSeatSection}
                        initial={{ opacity: 0, x: slideDir.current * 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: slideDir.current * -30 }}
                        transition={{ duration: 0.22, ease: 'easeInOut' }}
                        ref={setMapElement}
                        className="w-full flex-1 flex items-center justify-center relative overflow-hidden rounded-2xl bg-slate-50/60 border border-slate-100"
                        style={{ aspectRatio: '630 / 570' }}
                      >
                        {(() => {
                          // Tightest possible bounding boxes to completely remove empty bottom space
                          const SEC_A = { W: 630, H: 570, cX: 304, cY: 257, offX: -124, offY: 120 };
                          const SEC_B = { W: 630, H: 570, cX: 290, cY: 322, offX: 630, offY: 55 };
                          const sec = activeSeatSection === 'A' ? SEC_A : SEC_B;

                          const AdminSeat = ({ number, x, y, angle, radius, centerX, centerY }) => {
                            const isLocked = lockedSeats.includes(number);
                            const booking = bookingsBySeat[number];
                            const isBooked = !!booking;
                            let posX, posY;
                            if (angle !== undefined && radius !== undefined) {
                              posX = centerX + Math.cos((angle * Math.PI) / 180) * radius;
                              posY = centerY + Math.sin((angle * Math.PI) / 180) * radius;
                            } else {
                              posX = (x !== undefined ? x : 0) - sec.offX;
                              posY = (y !== undefined ? y : 0) - sec.offY;
                            }

                            const lockDetail = lockedSeatDetailsBySeat[number];
                            let statusClasses = '';
                            const baseClasses = 'absolute w-[50px] h-[50px] rounded-2xl flex flex-col items-center justify-center font-bold transition-all shadow-md overflow-hidden cursor-pointer';
                            let titleText = '';

                            if (isLocked) {
                              statusClasses = 'bg-slate-400 text-white hover:shadow-lg hover:bg-slate-500 border border-slate-500/30';
                              titleText = lockDetail?.traineeId ? `Seat ${number} (Locked for: ${lockDetail.traineeId}) — Click to unlock` : `Seat ${number} (Locked) — Click to unlock`;
                            } else if (isBooked) {
                              statusClasses = 'bg-rose-500 text-white shadow-rose-200/50 hover:bg-rose-600 hover:shadow-lg border border-rose-600/30';
                              titleText = `Seat ${number} — Booked by: ${booking.traineeId || booking.internName || booking.email || 'Unknown'} — Click to lock`;
                            } else {
                              statusClasses = 'bg-[#00b4eb] text-white hover:bg-[#009ac9] hover:shadow-lg hover:shadow-[#00b4eb]/30 border border-[#009ac9]/30';
                              titleText = `Seat ${number} (Available) — Click to lock`;
                            }

                            return (
                              <motion.div
                                onClick={() => {
                                  if (lockLoading) return;
                                  if (isLocked) setLockConfirm({ seatNumber: number, action: 'unlock' });
                                  else setLockConfirm({ seatNumber: number, action: 'lock' });
                                }}
                                className={`${baseClasses} ${statusClasses}`}
                                style={{ left: `${posX - 25}px`, top: `${posY - 25}px` }}
                                whileHover={{ scale: 1.15, zIndex: 10 }}
                                whileTap={{ scale: 0.95 }}
                                title={titleText}
                              >
                                <div className="flex flex-col items-center justify-center w-full h-full pointer-events-none px-1 text-center">
                                  {isBooked && !isLocked ? (
                                    <span className="text-[10px] font-black text-white leading-tight tracking-tight mt-0.5">{booking.traineeId}</span>
                                  ) : isLocked ? (
                                    <>
                                      <FaLock size={12} className="mb-0.5 text-white/90" />
                                      <span className="text-[11px] leading-none text-white font-semibold">{number}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Armchair size={18} strokeWidth={2.5} className="mb-0.5 text-white" />
                                      <span className="text-[11px] leading-none text-white font-semibold">{number}</span>
                                    </>
                                  )}
                                </div>
                              </motion.div>
                            );
                          };

                          return (
                            <div className="relative" style={{ width: `${sec.W * scale}px`, height: `${sec.H * scale}px` }}>
                              <div className="absolute" style={{ width: `${sec.W}px`, height: `${sec.H}px`, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
                                {/* Central Decorative Circle (Pillar/Table) */}
                                <div 
                                  className="absolute rounded-full border-[8px] border-slate-300 bg-slate-100 flex items-center justify-center"
                                  style={{
                                    width: '140px',
                                    height: '140px',
                                    left: `${sec.cX - 70}px`,
                                    top: `${sec.cY - 70}px`,
                                    zIndex: 0
                                  }}
                                >
                                  <div className="w-20 h-20 rounded-full bg-slate-200 border-2 border-slate-300"></div>
                                </div>

                                {activeSeatSection === 'A' ? (
                                  <>
                                    {leftSection.topRow.map((s) => <AdminSeat key={s.number} {...s} />)}
                                    {leftSection.pillarSeats.map((s) => <AdminSeat key={s.number} {...s} centerX={sec.cX} centerY={sec.cY} />)}
                                    {leftSection.outerRing1.map((s) => <AdminSeat key={s.number} {...s} centerX={sec.cX} centerY={sec.cY} />)}
                                    {leftSection.outerRing2.map((s) => <AdminSeat key={s.number} {...s} centerX={sec.cX} centerY={sec.cY} />)}
                                    {leftSection.outerRing3.map((s) => <AdminSeat key={s.number} {...s} centerX={sec.cX} centerY={sec.cY} />)}
                                  </>
                                ) : (
                                  <>
                                    {rightSection.straightSeats.map((s) => <AdminSeat key={s.number} {...s} />)}
                                    {rightSection.pillarSeats.map((s) => <AdminSeat key={s.number} {...s} centerX={sec.cX} centerY={sec.cY} />)}
                                    {rightSection.outerRing1.map((s) => <AdminSeat key={s.number} {...s} centerX={sec.cX} centerY={sec.cY} />)}
                                    {rightSection.outerRing2.map((s) => <AdminSeat key={s.number} {...s} centerX={sec.cX} centerY={sec.cY} />)}
                                    {rightSection.outerRing3.map((s) => <AdminSeat key={s.number} {...s} centerX={sec.cX} centerY={sec.cY} />)}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

            </div>
          </main>
        </div>
      </div>

      <style>{`
        /* ── Root ── */
        .seat-root {
          min-height: 100vh;
          background: #f0f4f8;
          position: relative;
          font-family: 'Segoe UI', system-ui, sans-serif;
        }

        /* ── Ambient ── */
        .seat-ambient { position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
        .seat-ambient__orb {
          position: absolute; border-radius: 50%;
          filter: blur(80px); opacity: 0.06;
        }
        .seat-ambient__orb--1 {
          width: 500px; height: 500px;
          background: #0056a2; top: -100px; right: -100px;
        }
        .seat-ambient__orb--2 {
          width: 400px; height: 400px;
          background: #50b748; bottom: -80px; left: -80px;
        }

        /* ── Layout ── */
        .seat-content { position: relative; z-index: 1; padding-top: 8px; }
        .seat-main { max-width: 1200px; margin: 0 auto; padding: 24px 24px 60px; }
      `}</style>
    </AdminNavigation>
  );
};

export default AdminSeatManagement;
