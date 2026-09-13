import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Armchair, Calendar, Trash2, Map as MapIcon, List, Info, CheckCircle2, ZoomIn, ZoomOut, Maximize, Move } from "lucide-react";
import Navigation from "../components/Navigation";
import SectionTip from "../components/SectionTip";
import { useSeatManagement, useMapScale, getLocalISODate } from "./useSeatManagement";

const SeatContext = React.createContext();

const Seat = ({ number, x, y, angle, radius, centerX, centerY }) => {
  const { getSeatStatus, allBookings, dailyBookings, handleSeatClick, lockedSeatDetails } = React.useContext(SeatContext);
  const status = getSeatStatus(number);
  const bookingInfo = allBookings[number];

  let posX = x;
  let posY = y;

  if (angle !== undefined && radius !== undefined && centerX !== undefined && centerY !== undefined) {
    posX = centerX + Math.cos((angle * Math.PI) / 180) * radius;
    posY = centerY + Math.sin((angle * Math.PI) / 180) * radius;
  }

  const baseClasses = "absolute w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[14px] font-bold transition-colors shadow-sm border-2 cursor-pointer group";

  let statusClasses = "";
  if (status === "locked") {
    statusClasses = "bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed opacity-75 hover:border-slate-400 hover:shadow-md";
  } else if (status === "booked") {
    statusClasses = "bg-rose-500 text-white border-rose-600 cursor-not-allowed shadow-md shadow-rose-200/50 hover:bg-rose-600";
  } else {
    statusClasses = "bg-white text-[#50b748] border-[#50b748] hover:bg-[#50b748] hover:text-white hover:shadow-lg hover:shadow-[#50b748]/30";
  }

  return (
    <motion.div
      onClick={() => handleSeatClick(number)}
      className={`${baseClasses} ${statusClasses} seat-hover-wrapper`}
      style={{ left: `${posX - 24}px`, top: `${posY - 24}px` }}
      whileHover={{ scale: 1.15 }}
      whileTap={status === "available" ? { scale: 0.95 } : {}}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <div className="flex flex-col items-center justify-center w-full h-full pointer-events-none relative">
        <div className="absolute inset-0 flex flex-col items-center justify-center group-hover:opacity-0 group-hover:scale-75 transition-all duration-300">
          {status === "booked" ? (
            <X size={18} strokeWidth={3} className="text-white/90 mb-0.5" />
          ) : status === "locked" ? (
            <Armchair size={18} strokeWidth={2.5} className="mb-1 opacity-60" />
          ) : (
            <Armchair size={18} strokeWidth={2.5} className="mb-0.5" />
          )}
          
          <div className="relative w-full flex items-center justify-center h-4 mt-0.5">
            <span className="text-[clamp(10px,2vw,12px)] font-extrabold leading-none">{number}</span>
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all duration-300">
           <span className="text-[26px] font-extrabold leading-none drop-shadow-sm">{number}</span>
        </div>
      </div>
      
      <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[100] flex flex-col items-center whitespace-nowrap drop-shadow-lg">
        <div className="bg-slate-800 text-white px-3 py-1.5 rounded-xl flex flex-col items-center gap-0.5 border border-slate-700">
           {status === "locked" ? (
              <span className="font-bold text-slate-200 text-[clamp(10px,2vw,12px)]">Locked Seat</span>
           ) : status === "booked" ? (
              <span className="font-bold text-white text-[clamp(10px,2vw,12px)]">{bookingInfo?.internName || "Reserved"}</span>
           ) : (
              <span className="font-bold text-[#50b748] text-[clamp(10px,2vw,12px)]">Available</span>
           )}
        </div>
        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-800"></div>
      </div>
    </motion.div>
  );
};

const BookingModal = ({ currentSeat, formatDisplayDate, selectedDate, handleModalClose, handleDateBookingConfirm }) => {
  const handleSubmit = async () => {
    const success = await handleDateBookingConfirm();
    if (success) handleModalClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 backdrop-blur-sm bg-slate-900/40 flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 20, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md border border-gray-100 overflow-hidden relative"
        >
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#00b4eb] via-[#0056a2] to-[#50b748]"></div>
          <div className="flex justify-between items-center mb-6 mt-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-[#0056a2] shadow-sm">
                <Armchair size={24} />
              </div>
              <h2 className="text-[clamp(18px,4.5vw,24px)] font-extrabold text-gray-800 tracking-tight">Seat {currentSeat}</h2>
            </div>
            <button onClick={handleModalClose} className="text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 p-2 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-br from-blue-50/50 to-cyan-50/50 rounded-2xl border border-blue-100/60">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 bg-white p-1.5 rounded-lg shadow-sm"><Calendar className="text-[#00b4eb]" size={18} /></div>
                <div>
                  <p className="text-[clamp(10px,2vw,12px)] text-gray-500 font-semibold uppercase tracking-wider">Booking Date</p>
                  <p className="text-[clamp(14px,3.5vw,18px)] text-gray-900 font-bold mt-0.5">{formatDisplayDate(selectedDate)}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-blue-100/50 flex items-start gap-3">
                <Info className="text-[#0056a2] mt-0.5 shrink-0" size={16} />
                <p className="text-[clamp(10px,2vw,12px)] text-gray-600 font-medium leading-relaxed">Your intern account will be used automatically for this reservation.</p>
              </div>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100/50 flex items-start gap-3">
              <span className="text-[clamp(14px,3.5vw,18px)] leading-none shrink-0 mt-0.5">âš </span>
              <span className="text-[clamp(11px,2.5vw,14px)] text-amber-800 font-medium leading-tight">One seat per intern per day is allowed. Make sure this is the seat you want!</span>
            </div>
            <div className="flex gap-3 pt-5">
              <button onClick={handleModalClose} className="flex-1 px-4 py-3 bg-white border-2 border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all focus:outline-none focus:ring-4 focus:ring-gray-100 active:scale-95">Cancel</button>
              <button onClick={handleSubmit} className="flex-1 px-4 py-3 bg-[#0056a2] hover:bg-[#00488a] text-white font-bold rounded-xl transition-all shadow-lg shadow-[#0056a2]/30 focus:outline-none focus:ring-4 focus:ring-blue-100 active:scale-95 flex items-center justify-center gap-2">
                <CheckCircle2 size={18} /> Confirm
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};



const InternSeatReservation = () => {
  const {
    showModal,
    currentSeat,
    selectedDate,
    dailyBookings,
    minBookingDate,
    maxBookingDate,
    leftSection,
    rightSection,
    totalUnavailableCount,
    totalAvailableCount,
    totalBookedCount,
    allBookings,
    formatDisplayDate,
    handleDateChange,
    handleSeatClick,
    handleModalClose,
    handleDateBookingConfirm,
    handleCancelBooking,
    getSeatStatus,
    lockedSeatDetails,
  } = useSeatManagement();

  const [activeTab, setActiveTab] = useState("map");
  const [currentSection, setCurrentSection] = useState("A");
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

      const isDesktop = window.innerWidth >= 1024;
      let fitScale;

      if (isDesktop) {
        // Desktop: Fit inside card container with no scroll
        fitScale = Math.min((rect.width / MAP_WIDTH) * 0.985, 1.05);
      } else if (window.innerWidth >= 768) {
        // Tablet: comfortable touch scale
        fitScale = 0.62;
      } else {
        // Mobile: Section A displayed directly, comfortable touch size
        fitScale = Math.min(0.52, Math.max((rect.width - 8) / 630, 0.42));
      }

      const roundedScale = Math.round(fitScale * 1000) / 1000;
      setScale((prev) => (Math.abs(prev - roundedScale) > 0.005 ? roundedScale : prev));
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
  }, []);

  
  
  const scrollToSection = (sec) => {
    if (!mapViewportRef.current) return;
    if (sec === "A") {
      mapViewportRef.current.scrollTo({ left: 0, behavior: "smooth" });
      setCurrentSection("A");
    } else {
      const scrollPos = Math.round(710 * scale);
      mapViewportRef.current.scrollTo({ left: scrollPos, behavior: "smooth" });
      setCurrentSection("B");
    }
  };

  const handleMapScroll = (e) => {
    if (window.innerWidth >= 1024) return;
    const scrollLeft = e.target.scrollLeft;
    const threshold = Math.round(320 * scale);
    if (scrollLeft > threshold) {
      setCurrentSection((prev) => (prev !== "B" ? "B" : prev));
    } else {
      setCurrentSection((prev) => (prev !== "A" ? "A" : prev));
    }
  };

  useEffect(() => {
    if (activeTab === "map" && mapViewportRef.current && window.innerWidth < 1024) {
      mapViewportRef.current.scrollLeft = 0;
      setCurrentSection("A");
    }
  }, [activeTab, selectedDate]);
  
  const renderTabContent = () => {
    if (activeTab === "map") {
      return (
        <div className="flex flex-col w-full h-full">
          {/* Legend + Controls */}
          <div className="flex justify-end items-center py-3 px-4 bg-white border-b border-gray-100 flex-wrap gap-2 shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2"><div className="w-5 h-5 bg-white border-2 border-[#50b748] rounded-lg shadow-sm flex items-center justify-center"><Armchair size={10} className="text-[#50b748]" /></div><span className="text-[clamp(10px,2vw,12px)] font-bold text-gray-600">Available</span></div>
              <div className="flex items-center gap-2"><div className="w-5 h-5 bg-rose-500 border-2 border-rose-600 rounded-lg shadow-sm flex items-center justify-center"><X size={11} strokeWidth={3} className="text-white" /></div><span className="text-[clamp(10px,2vw,12px)] font-bold text-gray-600">Booked</span></div>
              <div className="flex items-center gap-2"><div className="w-5 h-5 bg-slate-200 border-2 border-slate-300 rounded-lg shadow-sm flex items-center justify-center opacity-75"><Armchair size={10} className="text-slate-400" /></div><span className="text-[clamp(10px,2vw,12px)] font-bold text-gray-600">Locked</span></div>
            </div>
          </div>

          {/* Map Viewport - ensure it takes all available space */}
          
          {/* Small screens section switcher & swipe hint under buttons (visible on < 1024px) */}
          <div className="lg:hidden flex flex-col items-center justify-center px-3 py-2 bg-slate-50/90 border-b border-slate-100 gap-1 sm:gap-1.5 select-none shrink-0">
            {/* Selection buttons with reduced & responsive font size */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => scrollToSection("A")}
                className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentSection === "A"
                    ? "bg-gradient-to-r from-[#000066] to-[#0056a2] text-white shadow-sm shadow-[#0056a2]/30"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 shadow-xs"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${currentSection === "A" ? "bg-white" : "bg-slate-300"}`} />
                <span>Section A (1–36)</span>
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("B")}
                className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentSection === "B"
                    ? "bg-gradient-to-r from-[#000066] to-[#0056a2] text-white shadow-sm shadow-[#0056a2]/30"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 shadow-xs"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${currentSection === "B" ? "bg-white" : "bg-slate-300"}`} />
                <span>Section B (37–88)</span>
              </button>
            </div>

            {/* Swipe hint displayed directly under the selection buttons */}
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 text-center tracking-tight">
              ← Swipe horizontally to scroll →
            </span>
          </div>

          {/* Map Viewport - ensure it takes all available space */}
          <div
            ref={mapViewportRef}
            onScroll={handleMapScroll}
            className="w-full overflow-x-auto lg:overflow-x-hidden overflow-y-hidden bg-white relative flex items-center justify-start lg:justify-center pt-1 pb-3 custom-scrollbar touch-pan-x select-none"
            style={{ minHeight: `${Math.round(MAP_HEIGHT * scale)}px` }}
          >
            {/* Map content - only show after initial transform is ready to avoid flicker */}
            {ready && (
              <div
                className="relative shrink-0"
                style={{
                  width: `${MAP_WIDTH * scale}px`,
                  height: `${MAP_HEIGHT * scale}px`,
                }}
              >
                <div
                  className="absolute"
                  style={{
                    width: `${MAP_WIDTH}px`,
                    height: `${MAP_HEIGHT}px`,
                    transform: `scale(${scale})`,
                    transformOrigin: '0 0',
                  }}
                >
                  
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
      backgroundColor: "#f1f5f9",
      border: "2px solid #cbd5e1",
      boxShadow: "inset 0 2px 4px rgba(255, 255, 255, 0.5)",
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
      backgroundColor: "#f1f5f9",
      border: "2px solid #cbd5e1",
      boxShadow: "inset 0 2px 4px rgba(255, 255, 255, 0.5)",
      zIndex: 0,
    }}
  />



  {/* Left section seats */}
                  {leftSection.topRow.map(seat => <Seat key={seat.number} {...seat} />)}
                  {leftSection.pillarSeats.map(seat => <Seat key={seat.number} {...seat} centerX={180} centerY={377} />)}
                  {leftSection.outerRing1.map(seat => <Seat key={seat.number} {...seat} centerX={180} centerY={377} />)}
                  {leftSection.outerRing2.map(seat => <Seat key={seat.number} {...seat} centerX={180} centerY={377} />)}
                  {leftSection.outerRing3.map(seat => <Seat key={seat.number} {...seat} centerX={180} centerY={377} />)}

                  {/* Right section seats */}
                  {rightSection.straightSeats.map(seat => <Seat key={seat.number} {...seat} />)}
                  {rightSection.pillarSeats.map(seat => <Seat key={seat.number} {...seat} centerX={920} centerY={377} />)}
                  {rightSection.outerRing1.map(seat => <Seat key={seat.number} {...seat} centerX={920} centerY={377} />)}
                  {rightSection.outerRing2.map(seat => <Seat key={seat.number} {...seat} centerX={920} centerY={377} />)}
                  {rightSection.outerRing3.map(seat => <Seat key={seat.number} {...seat} centerX={920} centerY={377} />)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    } else {
      return (
        <div className="p-6 overflow-auto bg-slate-50/30 h-full">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-4">
              <div>
                <h3 className="text-[clamp(16px,4vw,20px)] font-extrabold text-gray-800 tracking-tight">Your Bookings for {formatDisplayDate(selectedDate)}</h3>
                <p className="text-[clamp(11px,2.5vw,14px)] text-gray-500 mt-1 font-medium">Manage your seat reservations for this date.</p>
              </div>
            </div>
            {Object.keys(dailyBookings).length > 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[clamp(11px,2.5vw,14px)]">
                    <thead className="bg-slate-50/80 border-b border-gray-100">
                      <tr>
                        <th className="px-4 sm:px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-[clamp(10px,2vw,12px)]">Seat Number</th>
                        <th className="px-4 sm:px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-[clamp(10px,2vw,12px)] hidden sm:table-cell">Booking Date</th>
                        <th className="px-4 sm:px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-[clamp(10px,2vw,12px)] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {Object.entries(dailyBookings).sort(([a], [b]) => Number(a) - Number(b)).map(([seatNum]) => (
                        <tr key={seatNum} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-4 sm:px-6 py-4 sm:py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-[#00b4eb]/10 flex items-center justify-center shrink-0"><Armchair size={18} className="text-[#0056a2]" /></div>
                              <div><span className="block text-[clamp(9px,2vw,10px)] sm:text-[clamp(10px,2vw,12px)] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Seat</span><span className="font-extrabold text-gray-900 text-[clamp(11px,2.5vw,14px)] sm:text-[clamp(13px,3vw,16px)] leading-none">{seatNum}</span></div>
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 sm:py-5 hidden sm:table-cell"><div className="font-medium text-gray-700 whitespace-nowrap">{formatDisplayDate(selectedDate)}</div></td>
                          <td className="px-4 sm:px-6 py-4 sm:py-5 text-right">
                            <button onClick={() => handleCancelBooking(seatNum)} className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-white border border-rose-200 text-rose-600 rounded-xl hover:bg-rose-50 hover:border-rose-300 transition-all text-[clamp(10px,2vw,12px)] sm:text-[clamp(11px,2.5vw,14px)] font-bold shadow-sm whitespace-nowrap">
                              <Trash2 size={16} /> Cancel
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4"><Calendar className="h-8 w-8 text-slate-300" /></div>
                <h4 className="text-[clamp(14px,3.5vw,18px)] font-bold text-gray-700">No seats booked yet</h4>
                <p className="text-gray-500 text-[clamp(11px,2.5vw,14px)] mt-1 max-w-sm mx-auto">You haven't booked any seats for {formatDisplayDate(selectedDate)}. Switch to the Seat Map to make a reservation.</p>
                <button onClick={() => setActiveTab("map")} className="mt-6 px-6 py-2.5 bg-[#0056a2] text-white font-bold rounded-xl shadow-md shadow-[#0056a2]/20 hover:bg-[#00488a] transition-all">Browse Seat Map</button>
              </div>
            )}
          </div>
        </div>
      );
    }
  };

  const todayStr = getLocalISODate();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = getLocalISODate(tomorrowDate);

  const isToday = selectedDate === todayStr;
  const isTomorrow = selectedDate === tomorrowStr;

  return (
    <SeatContext.Provider value={{ getSeatStatus, allBookings, dailyBookings, handleSeatClick, lockedSeatDetails }}>
      <Navigation>
        <div className="flex-1 w-full lg:px-6 xl:px-10 pb-10">
          <main className="flex-1 p-4 sm:p-6 mx-auto max-w-[1600px] w-full">
            <div className="mb-[clamp(16px,4vw,24px)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[clamp(12px,3vw,16px)] logbook-fade-in w-full">
              <div className="flex items-center gap-[clamp(10px,2.5vw,16px)]">
                <div className="w-[clamp(40px,10vw,56px)] h-[clamp(40px,10vw,56px)] rounded-[clamp(12px,3vw,16px)] bg-gradient-to-r from-[#000066] to-[#006600] flex items-center justify-center shrink-0 border border-slate-700 shadow-md">
                  <Armchair className="text-white w-[clamp(20px,5vw,28px)] h-[clamp(20px,5vw,28px)]" />
                </div>
                <div className="flex flex-col justify-center">
                  <h1 className="text-[clamp(20px,5vw,28px)] font-[800] text-[#1a1a2e] leading-tight tracking-tight">
                    Smart Seat Reservation
                  </h1>
                  <p className="text-[#6b7280] mt-[2px] text-[clamp(11px,2.5vw,14px)] font-medium">
                    Select a date and reserve your preferred spot seamlessly.
                  </p>
                </div>
              </div>

              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.2 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 sm:p-2 flex flex-wrap sm:flex-nowrap items-center gap-2">
                <div className="flex gap-2 w-full sm:w-auto">
                  <div className="flex-1 sm:w-24 text-center p-2 bg-green-50/80 rounded-xl border border-green-100"><div className="text-[clamp(16px,4vw,20px)] font-black text-[#50b748] leading-none mb-0.5">{totalAvailableCount}</div><div className="text-[clamp(8px,2vw,9px)] font-bold text-[#50b748]/80 uppercase tracking-wider">Available</div></div>
                  <div className="flex-1 sm:w-24 text-center p-2 bg-red-50/80 rounded-xl border border-red-100"><div className="text-[clamp(16px,4vw,20px)] font-black text-rose-600 leading-none mb-0.5">{totalBookedCount}</div><div className="text-[clamp(8px,2vw,9px)] font-bold text-rose-500/80 uppercase tracking-wider">Reserved</div></div>
                  <div className="flex-1 sm:w-24 text-center p-2 bg-slate-100/80 rounded-xl border border-slate-200"><div className="text-[clamp(16px,4vw,20px)] font-black text-slate-500 leading-none mb-0.5">{Object.keys(lockedSeatDetails || {}).length}</div><div className="text-[clamp(8px,2vw,9px)] font-bold text-slate-400 uppercase tracking-wider">Locked</div></div>
                </div>
                                <div className="flex-1 min-w-[160px] bg-slate-50 rounded-xl p-2 flex items-center gap-2 border border-slate-100">
                  <div className="bg-white p-1.5 rounded-lg shadow-sm border border-slate-100"><Calendar className="text-[#00b4eb] h-4 w-4" /></div>
                  <div className="flex-1"><label className="text-[clamp(8px,2vw,9px)] font-bold text-gray-400 uppercase tracking-wider block">Select Date</label><input type="date" value={selectedDate} onChange={(e) => handleDateChange(e.target.value)} min={minBookingDate} max={maxBookingDate} className="bg-transparent text-[clamp(10px,2vw,12px)] font-bold text-gray-800 w-full focus:outline-none cursor-pointer" /></div>
                </div>
              </motion.div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden h-[calc(100vh-140px)] min-h-[600px] lg:h-auto">
              <div className="flex flex-wrap sm:flex-nowrap border-b border-gray-100 bg-slate-50/50 p-2 gap-2">
                <button 
                  onClick={() => setActiveTab("map")} 
                  className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-6 py-2 sm:py-3.5 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-[13px] md:text-[14px] whitespace-nowrap transition-all duration-100 ${
                    activeTab === "map" 
                      ? "bg-gradient-to-r from-[#0056a2] to-[#00b4eb] text-white shadow-md shadow-blue-500/30 ring-1 ring-blue-400/50" 
                      : "bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 ring-1 ring-gray-200/50"
                  }`}
                >
                  <MapIcon className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]" /> Seat Map
                </button>

                <button 
                  onClick={() => setActiveTab("bookings")} 
                  className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-6 py-2 sm:py-3.5 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-[13px] md:text-[14px] whitespace-nowrap transition-all duration-100 ${
                    activeTab === "bookings" 
                      ? "bg-gradient-to-r from-[#15803d] to-[#50b748] text-white shadow-md shadow-green-500/30 ring-1 ring-green-400/50" 
                      : "bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 ring-1 ring-gray-200/50"
                  }`}
                >
                  <List className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]" /> My Bookings
                  {Object.keys(dailyBookings).length > 0 && (
                    <span className={`ml-0.5 sm:ml-1.5 px-1.5 sm:px-2 py-0.5 rounded-full font-black text-[9px] sm:text-[10px] ${
                      activeTab === "bookings" ? "bg-white text-[#15803d]" : "bg-[#50b748] text-white"
                    }`}>
                      {Object.keys(dailyBookings).length}
                    </span>
                  )}
                </button>

                <button 
                  onClick={() => { handleDateChange(tomorrowStr); setActiveTab("map"); }} 
                  className="flex-none sm:flex-1 w-full sm:w-auto flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-6 py-2 sm:py-3.5 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-[13px] md:text-[14px] transition-all duration-100 bg-amber-50 text-amber-600 hover:bg-amber-100 ring-1 ring-amber-200/50"
                >
                  <Calendar className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]" /> Tomorrow
                </button>
              </div>
              <div className="flex-1 relative bg-white" style={{ minHeight: 0 }}>
                {renderTabContent()}
              </div>
            </div>
          </main>
        </div>
        {showModal && <BookingModal currentSeat={currentSeat} formatDisplayDate={formatDisplayDate} selectedDate={selectedDate} handleModalClose={handleModalClose} handleDateBookingConfirm={handleDateBookingConfirm} />}
      </Navigation>
    </SeatContext.Provider>
  );
};

export default InternSeatReservation;
