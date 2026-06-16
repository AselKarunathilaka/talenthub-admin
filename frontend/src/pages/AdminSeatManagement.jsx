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
import { Armchair } from "lucide-react";

import {
  adminSeatApi,
  seatBookingCsvUtils,
  seatNotificationUtils,
} from "../api/adminSeatApi";
import { leftSection, rightSection, useMapScale } from "./useSeatManagement";

const TOTAL_SEATS = 88;

const AdminSeatManagement = () => {
  const navigate = useNavigate();
  const [mapElement, setMapElement] = useState(null);
  const MAP_WIDTH = 1450;
  const MAP_HEIGHT = 910;
  const [showLockManager, setShowLockManager] = useState(true);
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!mapElement) return;

    const updateScale = () => {
      const rect = mapElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      
      const isMobile = window.innerWidth < 768;
      let fitScale;
      if (isMobile) {
        fitScale = (rect.height / MAP_HEIGHT) * 0.98;
      } else {
        const scaleX = (rect.width / MAP_WIDTH) * 0.98;
        const scaleY = (rect.height / MAP_HEIGHT) * 0.98;
        fitScale = Math.min(scaleX, scaleY, 1);
      }
      setScale(fitScale);
      setReady(true);
    };

    updateScale();
    
    const observer = new ResizeObserver(() => updateScale());
    observer.observe(mapElement);
    
    window.addEventListener('resize', updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [mapElement]);
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

  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    <AdminNavigation>
      <div className="min-h-screen bg-slate-50 font-sans text-gray-800 pb-10 flex flex-col">
        <div className="flex-1 w-full lg:mt-4 lg:px-6 xl:px-10">
          <main className="flex-1 p-4 sm:p-6 mx-auto max-w-[1600px] w-full">
            {/* Header Section */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-3xl sm:text-4xl font-extrabold text-gray-900 flex items-center gap-3 tracking-tight"
                >
                  <div className="p-2.5 bg-[#00b4eb]/10 rounded-2xl">
                    <Armchair className="text-[#0056a2] h-8 w-8" />
                  </div>
                  Seat Booking Monitor
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05, duration: 0.2 }}
                  className="text-gray-500 mt-2 text-sm sm:text-base font-medium max-w-xl"
                >
                  View, monitor, and manage intern seat bookings.
                </motion.p>
              </div>

              {/* Stats & Date Filter */}
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.2 }} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-2 sm:p-3 flex flex-wrap sm:flex-nowrap items-center gap-3">
                {!showHistory && (
                  <div className="flex-1 min-w-[200px] bg-slate-50 rounded-2xl p-3 flex items-center gap-3 border border-slate-100">
                    <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100"><FaCalendarAlt className="text-[#00b4eb] h-5 w-5" /></div>
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Select Date</label>
                      <input type="date" value={selectedDate} onChange={handleDateChange} className="bg-transparent text-sm font-bold text-gray-800 w-full focus:outline-none cursor-pointer" />
                    </div>
                  </div>
                )}
                {!showHistory && (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <div className="flex-1 sm:w-28 text-center p-3 bg-gray-50/80 rounded-2xl border border-gray-200">
                      <div className="text-2xl font-black text-gray-600 leading-none mb-1">{lockedSeatsCount}</div>
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Locked</div>
                    </div>
                    <div className="flex-1 sm:w-28 text-center p-3 bg-red-50/80 rounded-2xl border border-red-100">
                      <div className="text-2xl font-black text-rose-600 leading-none mb-1">{stats.occupiedSeats}</div>
                      <div className="text-[10px] font-bold text-rose-500/80 uppercase tracking-wider">Occupied</div>
                    </div>
                    <div className="flex-1 sm:w-28 text-center p-3 bg-green-50/80 rounded-2xl border border-green-100">
                      <div className="text-2xl font-black text-[#50b748] leading-none mb-1">{TOTAL_SEATS - (stats.occupiedSeats + lockedSeatsCount)}</div>
                      <div className="text-[10px] font-bold text-[#50b748]/80 uppercase tracking-wider">Available</div>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  className="mb-6 bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start space-x-3"
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

            {/* Search Bar */}
            <motion.div
              className="bg-white p-4 md:p-6 rounded-3xl border border-gray-100 shadow-sm mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.3 }}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-3 lg:space-y-0 lg:space-x-4">
                <div className="flex-1">
                  <label htmlFor="search-input" className="block text-sm font-bold text-gray-700 mb-2">Search Intern</label>
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input
                        id="search-input"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleSearchBookingHistory()}
                        placeholder="Search by Trainee ID or Name..."
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#00b4eb] focus:border-transparent text-gray-900 text-sm shadow-sm transition-all"
                      />
                      {searchQuery && (
                        <button onClick={clearSearch} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-white p-1 rounded-full shadow-sm">
                          <FaTimes className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <motion.button
                      onClick={handleSearchBookingHistory}
                      disabled={!searchQuery.trim() || searchLoading}
                      className="flex items-center space-x-2 px-5 py-3 bg-[#0056a2] hover:bg-[#00488a] disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-2xl text-sm font-bold transition-all shadow-md shadow-[#0056a2]/20 disabled:shadow-none disabled:cursor-not-allowed"
                      whileHover={{ scale: searchQuery.trim() && !searchLoading ? 1.05 : 1 }}
                      whileTap={{ scale: searchQuery.trim() && !searchLoading ? 0.95 : 1 }}
                    >
                      {searchLoading ? (
                        <><FaSpinner className="h-4 w-4 animate-spin" /><span>Searching...</span></>
                      ) : (
                        <><FaHistory className="h-4 w-4" /><span className="hidden sm:inline">View History</span><span className="sm:hidden">History</span></>
                      )}
                    </motion.button>
                  </div>
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
                      <button onClick={() => setSearchMessage(null)} className={`${searchMessage.type === "success" ? "text-[#15803d] hover:text-[#50b748]" : searchMessage.type === "error" ? "text-rose-600 hover:text-rose-800" : "text-[#0056a2] hover:text-[#00b4eb]"}`}><FaTimes className="h-4 w-4" /></button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Map Section */}
            {!showHistory && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 px-2 gap-3">
                <div>
                  <h3 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                    <div className="p-1.5 bg-blue-50 rounded-lg text-[#0056a2]"><Armchair size={18} /></div>
                    Seat Map Manager
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 font-medium">
                    Click a seat to lock or unlock it. Locked seats cannot be booked by interns.
                  </p>
                </div>
                <div className="flex items-center gap-4 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2"><div className="w-5 h-5 bg-white border-2 border-[#50b748] rounded-lg shadow-sm flex items-center justify-center"></div><span className="text-xs font-bold text-gray-600">Available</span></div>
                  <div className="flex items-center gap-2"><div className="w-5 h-5 bg-rose-500 border-2 border-rose-600 rounded-lg shadow-sm flex items-center justify-center"><FaTimes size={10} className="text-white"/></div><span className="text-xs font-bold text-gray-600">Booked</span></div>
                  <div className="flex items-center gap-2"><div className="w-5 h-5 bg-slate-200 border-2 border-slate-300 rounded-lg shadow-sm opacity-75 flex items-center justify-center"><FaLock size={8} className="text-slate-400"/></div><span className="text-xs font-bold text-gray-600">Locked</span></div>
                </div>
              </div>
              
              <div 
                ref={setMapElement}
                className="w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] rounded-2xl overflow-y-hidden overflow-x-auto flex items-center justify-start sm:justify-center custom-scrollbar border border-gray-100 shadow-inner"
                style={{ height: "75vh", minHeight: "550px", maxHeight: "900px" }}
              >
                <div className={`relative shrink-0 overflow-hidden transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`} style={{ width: `${MAP_WIDTH * scale}px`, height: `${MAP_HEIGHT * scale}px` }}>
                  <div className="absolute" style={{ width: `${MAP_WIDTH}px`, height: `${MAP_HEIGHT}px`, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
                      <div className="absolute inset-0" style={{ transform: 'translate(150px, 60px)' }}>
                        <div className="absolute top-0 h-14 bg-gradient-to-r from-slate-700 to-slate-800 rounded-2xl flex items-center shadow-lg" style={{ left: "-124px", width: "742px" }}>
                          <div className="text-lg font-bold text-white/90 z-10 pl-6 uppercase tracking-[0.2em]">Entrance</div>
                        </div>
                        <div className="absolute h-14 bg-slate-800 rounded-2xl shadow-lg" style={{ left: "485px", top: "-45px", width: "785px", zIndex: 20 }}></div>
                        <div className="absolute top-11 w-33 bg-slate-800 rounded-b-2xl shadow-lg" style={{ left: "486px", height: "750px" }}></div>

                        <div className="absolute bg-slate-100 rounded-3xl border border-slate-200 shadow-inner" style={{ left: "-125px", top: "70px", width: "610px", height: "720px" }}>
                          <div className="absolute bg-white rounded-full shadow-md border-8 border-slate-50" style={{ left: "235px", top: "230px", width: "140px", height: "140px" }}></div>
                        </div>
                        <div className="absolute bg-slate-100 rounded-3xl border border-slate-200 shadow-inner" style={{ left: "620px", top: "20px", width: "650px", height: "770px" }}>
                          <div className="absolute bg-white rounded-full shadow-md border-8 border-slate-50" style={{ left: "230px", top: "280px", width: "140px", height: "140px" }}></div>
                        </div>

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
                            let statusClasses = "";
                            let titleText = "";
                            const baseClasses = "absolute w-12 h-12 rounded-xl flex flex-col items-center justify-center text-xs font-bold transition-all shadow-sm border-2 overflow-hidden cursor-pointer";

                            if (isLocked) {
                              statusClasses = "bg-slate-200 text-slate-500 border-slate-300 opacity-75 hover:border-slate-400 hover:shadow-md";
                              titleText = lockDetail?.traineeId ? `Seat ${number} (Locked for: ${lockDetail.traineeId}) — Click to unlock` : `Seat ${number} (Locked) — Click to unlock`;
                            } else if (isBooked) {
                              statusClasses = "bg-rose-500 text-white border-rose-600 shadow-md shadow-rose-200/50 hover:bg-rose-600";
                              titleText = `Seat ${number} — Booked by: ${booking.traineeId || booking.internName || booking.email || "Unknown"} — Click to lock`;
                            } else {
                              statusClasses = "bg-white text-[#50b748] border-[#50b748] hover:bg-[#50b748] hover:text-white hover:shadow-lg hover:shadow-[#50b748]/30";
                              titleText = `Seat ${number} (Available) — Click to lock`;
                            }

                            return (
                              <motion.div
                                onClick={() => {
                                  if (lockLoading) return;
                                  if (isLocked) setLockConfirm({ seatNumber: number, action: "unlock" });
                                  else setLockConfirm({ seatNumber: number, action: "lock" });
                                }}
                                className={`${baseClasses} ${statusClasses}`}
                                style={{ left: `${posX - 24}px`, top: `${posY - 24}px` }}
                                whileHover={{ scale: 1.15, zIndex: 10 }}
                                whileTap={{ scale: 0.95 }}
                                title={titleText}
                              >
                                <div className="flex flex-col items-center justify-center w-full h-full pointer-events-none">
                                  {isBooked && !isLocked ? (
                                    <FaTimes size={16} className="text-white/90 mb-0.5" />
                                  ) : isLocked ? (
                                    <FaLock size={14} className="mb-1 opacity-60" />
                                  ) : (
                                    <Armchair size={18} strokeWidth={2.5} className="mb-0.5" />
                                  )}
                                  {isLocked && lockDetail?.traineeId ? (
                                    <span className="text-[8px] mt-0.5 truncate w-full text-center px-0.5 leading-none">{lockDetail.traineeId}</span>
                                  ) : isBooked && !isLocked ? (
                                    <span className="text-[8px] mt-0.5 truncate w-full text-center px-0.5 leading-none">{booking.traineeId || number}</span>
                                  ) : (
                                    <span className="text-[10px] mt-0.5 leading-none">{number}</span>
                                  )}
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
            )}

            {/* Lock Confirmation Modal */}
            <AnimatePresence>
              {lockConfirm && (
                <motion.div
                  className="fixed inset-0 backdrop-blur-sm bg-slate-900/40 flex items-center justify-center z-50 p-4"
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
            </AnimatePresence>

            {/* Date Filter and Export for Bookings */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 px-2 gap-4 mt-8">
               <div>
                  <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">
                    {showHistory && searchResults
                      ? `Booking History - ${searchResults.internInfo?.internName || "Intern"}`
                      : `Seat Bookings${selectedDate ? ` - ${formatDate(selectedDate)}` : ""}`}
                  </h3>
               </div>
               <div className="flex items-center gap-3">
                  <motion.button
                    onClick={handleExportCSV}
                    disabled={displayBookings.length === 0}
                    className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-[#50b748] hover:bg-[#43a03c] disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-[#50b748]/20 disabled:shadow-none"
                    whileHover={{ scale: displayBookings.length === 0 ? 1 : 1.05 }}
                    whileTap={{ scale: displayBookings.length === 0 ? 1 : 0.95 }}
                  >
                    <FaDownload className="h-4 w-4" />
                    <span>Export to CSV</span>
                    {displayBookings.length > 0 && (
                      <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{displayBookings.length}</span>
                    )}
                  </motion.button>
               </div>
            </div>

            {/* Bookings Table */}
            <motion.div
              className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              {displayBookings.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 px-4">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100"><FaChair className="h-8 w-8 text-gray-300" /></div>
                  <h3 className="text-lg font-bold text-gray-700 mb-2">No bookings found</h3>
                  <p className="text-gray-500 text-sm font-medium">
                    {showHistory
                      ? "No booking history found for this intern."
                      : selectedDate
                        ? `No seat bookings found for ${formatDate(selectedDate)}.`
                        : "There are no active seat bookings at the moment."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="block lg:hidden">
                    <div className="divide-y divide-gray-100">
                      {displayBookings.map((booking) => (
                        <div key={booking._id} className="p-4 hover:bg-slate-50/50 transition-colors">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                <div className="h-12 w-12 rounded-xl bg-[#00b4eb]/10 flex items-center justify-center shadow-sm border border-[#00b4eb]/20">
                                  <span className="text-sm font-extrabold text-[#0056a2]">#{booking.seatNumber}</span>
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-bold text-gray-900">{booking.internName}</div>
                                <div className="text-xs font-medium text-gray-500 mt-0.5">ID: {booking.traineeId}</div>
                              </div>
                            </div>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${booking.status === "active" ? "bg-[#50b748]/10 text-[#15803d]" : "bg-rose-50 text-rose-600"}`}>
                              {booking.status}
                            </span>
                          </div>
                          <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div className="text-xs font-medium text-gray-600 truncate flex items-center gap-2">
                              <span className="text-gray-400">📧</span> {booking.email}
                            </div>
                            <div className="text-xs font-medium text-gray-600 flex items-center gap-2">
                              <span className="text-gray-400">📅</span> {formatDate(booking.bookingDate)}
                            </div>
                            <div className="text-xs font-medium text-gray-600 flex items-center gap-2">
                              <span className="text-gray-400">⏰</span> {formatDateTime(booking.bookedAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50/80 border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Seat</th>
                          <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Intern Info</th>
                          <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Booking Date</th>
                          <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Booked At</th>
                          <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {displayBookings.map((booking) => (
                          <tr key={booking._id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#00b4eb]/10 flex items-center justify-center shrink-0 border border-[#00b4eb]/20">
                                  <span className="font-extrabold text-[#0056a2] leading-none">{booking.seatNumber}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="font-bold text-gray-900">{booking.internName}</span>
                                <span className="text-xs font-medium text-gray-500 mt-0.5">ID: {booking.traineeId}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-medium text-gray-700">{formatDate(booking.bookingDate)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-xs font-medium text-gray-500">{formatDateTime(booking.bookedAt)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${booking.status === "active" ? "bg-[#50b748]/10 text-[#15803d]" : "bg-rose-50 text-rose-600"}`}>
                                {booking.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-6 py-4 bg-slate-50/80 border-t border-gray-100">
                    <p className="text-sm font-bold text-gray-500 text-center uppercase tracking-wider">
                      Showing {displayBookings.length} booking{displayBookings.length !== 1 ? "s" : ""}
                      {showHistory ? ` for ${searchResults?.internInfo?.internName || "intern"}` : selectedDate ? ` for ${formatDate(selectedDate)}` : ""}
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          </main>
        </div>
      </div>
    </AdminNavigation>
  );
};

export default AdminSeatManagement;
