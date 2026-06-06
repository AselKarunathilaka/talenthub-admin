import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Armchair, Calendar, Trash2, Map as MapIcon, List, Info, CheckCircle2 } from "lucide-react";
import Navigation from "../components/Navigation";
import { useSeatManagement } from "./useSeatManagement";

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

  const baseClasses = "absolute w-12 h-12 rounded-xl flex flex-col items-center justify-center text-xs font-bold transition-all shadow-sm border-2 overflow-hidden";

  let statusClasses = "";
  if (status === "locked") {
    statusClasses = "bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed opacity-75";
  } else if (status === "booked") {
    statusClasses = "bg-rose-500 text-white border-rose-600 cursor-not-allowed shadow-md shadow-rose-200/50";
  } else {
    statusClasses = "bg-white text-[#50b748] border-[#50b748] hover:bg-[#50b748] hover:text-white hover:shadow-lg hover:shadow-[#50b748]/30 cursor-pointer";
  }

  return (
    <motion.div
      onClick={() => handleSeatClick(number)}
      className={`${baseClasses} ${statusClasses}`}
      style={{ left: `${posX - 24}px`, top: `${posY - 24}px` }}
      whileHover={status === "available" ? { scale: 1.15, zIndex: 10 } : {}}
      whileTap={status === "available" ? { scale: 0.95 } : {}}
      title={
        status === "locked" ? (lockedSeatDetails?.[number]?.traineeId ? `Seat ${number} — Reserved for Trainee ID: ${lockedSeatDetails[number].traineeId}` : `Seat ${number} (Locked)`)
        : status === "booked" && bookingInfo?.traineeId ? `Seat ${number} - Trainee ID: ${bookingInfo.traineeId}`
        : status === "booked" && bookingInfo?.email ? `Seat ${number} - Booked by: ${bookingInfo.email}`
        : status === "booked" ? `Seat ${number} (Already Booked)`
        : `Seat ${number} (Available)`
      }
    >
      <div className="flex flex-col items-center justify-center w-full h-full pointer-events-none">
        {status === "booked" ? (
          <X size={18} strokeWidth={3} className="text-white/90" />
        ) : status === "locked" ? (
          <Armchair size={18} strokeWidth={2.5} className="mb-0.5 opacity-60" />
        ) : (
          <Armchair size={18} strokeWidth={2.5} className="mb-0.5" />
        )}
        <span className="text-[10px] mt-0.5 leading-none">{number}</span>
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
              <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight">Seat {currentSeat}</h2>
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
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Booking Date</p>
                  <p className="text-lg text-gray-900 font-bold mt-0.5">{formatDisplayDate(selectedDate)}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-blue-100/50 flex items-start gap-3">
                <Info className="text-[#0056a2] mt-0.5 shrink-0" size={16} />
                <p className="text-xs text-gray-600 font-medium leading-relaxed">Your intern account will be used automatically for this reservation.</p>
              </div>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100/50 flex items-start gap-3">
              <span className="text-lg leading-none shrink-0 mt-0.5">⚠</span>
              <span className="text-sm text-amber-800 font-medium leading-tight">One seat per intern per day is allowed. Make sure this is the seat you want!</span>
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



const InternSeatManagement = () => {
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
  const mapViewportRef = useRef(null);
  const mobileScrollRef = useRef(null);
  const [mapScale, setMapScale] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const MAP_WIDTH = 1450;
  const MAP_HEIGHT = 850;

  // Detect mobile viewport
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Auto-fit map to viewport on mount and resize (desktop only)
  useEffect(() => {
    if (isMobile) return;
    const el = mapViewportRef.current;
    if (!el) return;
    const fit = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const scale = Math.min(rect.width / MAP_WIDTH, rect.height / MAP_HEIGHT) * 0.95;
      setMapScale(scale);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    fit();
    return () => observer.disconnect();
  }, [isMobile]);

  // Map content shared between desktop and mobile
  const renderMapContent = () => (
    <div className="absolute inset-0">
      {/* Legend inside map */}
      <div className="absolute flex items-center gap-4 bg-white/90 backdrop-blur-sm px-4 py-2.5 rounded-xl shadow-sm border border-slate-200" style={{ left: "-124px", top: "-55px", zIndex: 30 }}>
        <div className="flex items-center gap-1.5"><div className="w-5 h-5 bg-white border-2 border-[#50b748] rounded-md flex items-center justify-center"><Armchair size={10} className="text-[#50b748]" /></div><span className="text-xs font-bold text-gray-600">Available</span></div>
        <div className="flex items-center gap-1.5"><div className="w-5 h-5 bg-rose-500 border-2 border-rose-600 rounded-md flex items-center justify-center"><X size={11} strokeWidth={3} className="text-white" /></div><span className="text-xs font-bold text-gray-600">Booked</span></div>
        <div className="flex items-center gap-1.5"><div className="w-5 h-5 bg-slate-200 border-2 border-slate-300 rounded-md flex items-center justify-center opacity-75"><Armchair size={10} className="text-slate-400" /></div><span className="text-xs font-bold text-gray-600">Locked</span></div>
      </div>

      {/* Entrance and structure graphics */}
      <div className="absolute top-0 h-14 bg-gradient-to-r from-slate-700 to-slate-800 rounded-2xl flex items-center shadow-lg" style={{ left: "-124px", width: "742px" }}>
        <div className="text-lg font-bold text-white/90 z-10 pl-6 uppercase tracking-[0.2em]">Entrance</div>
      </div>
      <div className="absolute h-14 bg-slate-800 rounded-2xl shadow-lg" style={{ left: "485px", top: "-45px", width: "785px", zIndex: 20 }}></div>
      <div className="absolute top-11 w-33 bg-slate-800 rounded-b-2xl shadow-lg" style={{ left: "486px", height: "750px" }}></div>

      {/* Main room blocks */}
      <div className="absolute bg-slate-100 rounded-3xl border border-slate-200 shadow-inner" style={{ left: "-125px", top: "70px", width: "610px", height: "720px" }}>
        <div className="absolute bg-white rounded-full shadow-md border-8 border-slate-50" style={{ left: "235px", top: "230px", width: "140px", height: "140px" }}></div>
      </div>
      <div className="absolute bg-slate-100 rounded-3xl border border-slate-200 shadow-inner" style={{ left: "620px", top: "20px", width: "650px", height: "770px" }}>
        <div className="absolute bg-white rounded-full shadow-md border-8 border-slate-50" style={{ left: "230px", top: "280px", width: "140px", height: "140px" }}></div>
      </div>

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
  );

  const renderTabContent = () => {
    if (activeTab === "map") {
      // Mobile: horizontally scrollable map with snap
      if (isMobile) {
        const mobileScale = 0.65;
        const scaledWidth = MAP_WIDTH * mobileScale;
        const scaledHeight = MAP_HEIGHT * mobileScale;
        return (
          <div
            ref={mobileScrollRef}
            className="w-full h-full overflow-x-auto overflow-y-hidden bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]"
            style={{
              WebkitOverflowScrolling: 'touch',
              scrollSnapType: 'x mandatory',
              minHeight: 0,
            }}
          >
            <div
              style={{
                width: `${scaledWidth + 80}px`,
                height: `${scaledHeight + 40}px`,
                minHeight: '100%',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {/* Left room snap point */}
              <div style={{ scrollSnapAlign: 'start', width: '1px', height: '1px', position: 'absolute', left: '0px' }} />
              {/* Right room snap point */}
              <div style={{ scrollSnapAlign: 'start', width: '1px', height: '1px', position: 'absolute', left: `${scaledWidth * 0.4}px` }} />
              <div
                style={{
                  width: `${MAP_WIDTH}px`,
                  height: `${MAP_HEIGHT}px`,
                  transform: `scale(${mobileScale})`,
                  transformOrigin: '0 0',
                  position: 'relative',
                  marginLeft: '20px',
                  marginTop: '20px',
                  flexShrink: 0,
                }}
              >
                {renderMapContent()}
              </div>
            </div>
          </div>
        );
      }

      // Desktop: centered and scaled
      return (
        <div
          ref={mapViewportRef}
          className="w-full h-full flex items-center justify-center overflow-hidden bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]"
          style={{ minHeight: 0, paddingLeft: '10%', paddingTop: '5%' }}
        >
          <div
            style={{
              width: `${MAP_WIDTH}px`,
              height: `${MAP_HEIGHT}px`,
              transform: `scale(${mapScale})`,
              transformOrigin: 'center center',
              position: 'relative',
            }}
          >
            {renderMapContent()}
          </div>
        </div>
      );
    } else {
      return (
        <div className="p-6 overflow-auto bg-slate-50/30 h-full">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-4">
              <div>
                <h3 className="text-xl font-extrabold text-gray-800 tracking-tight">Your Bookings for {formatDisplayDate(selectedDate)}</h3>
                <p className="text-sm text-gray-500 mt-1 font-medium">Manage your seat reservations for this date.</p>
              </div>
            </div>
            {Object.keys(dailyBookings).length > 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/80 border-b border-gray-100">
                    <tr><th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Seat Number</th><th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Booking Date</th><th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs text-right">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {Object.entries(dailyBookings).sort(([a],[b]) => Number(a)-Number(b)).map(([seatNum]) => (
                      <tr key={seatNum} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-5"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-[#00b4eb]/10 flex items-center justify-center"><Armchair size={18} className="text-[#0056a2]" /></div><div><span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Seat</span><span className="font-extrabold text-gray-900 text-base leading-none">{seatNum}</span></div></div></td>
                        <td className="px-6 py-5"><div className="font-medium text-gray-700">{formatDisplayDate(selectedDate)}</div></td>
                        <td className="px-6 py-5 text-right"><button onClick={() => handleCancelBooking(seatNum)} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-rose-200 text-rose-600 rounded-xl hover:bg-rose-50 hover:border-rose-300 transition-all text-sm font-bold shadow-sm"><Trash2 size={16} /> Cancel</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4"><Calendar className="h-8 w-8 text-slate-300" /></div>
                <h4 className="text-lg font-bold text-gray-700">No seats booked yet</h4>
                <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">You haven't booked any seats for {formatDisplayDate(selectedDate)}. Switch to the Seat Map to make a reservation.</p>
                <button onClick={() => setActiveTab("map")} className="mt-6 px-6 py-2.5 bg-[#0056a2] text-white font-bold rounded-xl shadow-md shadow-[#0056a2]/20 hover:bg-[#00488a] transition-all">Browse Seat Map</button>
              </div>
            )}
          </div>
        </div>
      );
    }
  };

  return (
    <SeatContext.Provider value={{ getSeatStatus, allBookings, dailyBookings, handleSeatClick, lockedSeatDetails }}>
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 font-sans">
        <Navigation />
        <div className="flex-1 w-full lg:mt-20 lg:px-6 xl:px-10 pb-10">
          <main className="flex-1 p-4 sm:p-6 mx-auto max-w-[1600px] w-full">


            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col" style={{ minHeight: isMobile ? 'auto' : '850px', height: isMobile ? 'calc(100vh - 80px)' : 'calc(100vh - 160px)' }}>
              <div className="flex flex-wrap md:flex-nowrap items-center justify-between border-b border-gray-100 bg-slate-50/50 p-2 gap-2 w-full">
                {/* Left: Tab switcher */}
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setActiveTab("map")} className={`flex items-center justify-center gap-1.5 px-3 py-2 md:px-5 md:py-2.5 rounded-2xl font-bold text-xs md:text-sm transition-all duration-100 ${activeTab === "map" ? "bg-gradient-to-r from-[#0056a2] to-[#00b4eb] text-white shadow-lg shadow-blue-500/30 ring-1 ring-blue-400/50" : "bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 ring-1 ring-gray-200/50"}`}><MapIcon size={14} /> <span className="hidden sm:inline">Seat Map</span><span className="sm:hidden">Map</span></button>
                  <button onClick={() => setActiveTab("bookings")} className={`flex items-center justify-center gap-1.5 px-3 py-2 md:px-5 md:py-2.5 rounded-2xl font-bold text-xs md:text-sm transition-all duration-100 ${activeTab === "bookings" ? "bg-gradient-to-r from-[#15803d] to-[#50b748] text-white shadow-lg shadow-green-500/30 ring-1 ring-green-400/50" : "bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 ring-1 ring-gray-200/50"}`}><List size={14} /> <span className="hidden sm:inline">My Bookings</span><span className="sm:hidden">Bookings</span>{Object.keys(dailyBookings).length > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded-full font-black text-[10px] ${activeTab === "bookings" ? "bg-white text-[#15803d]" : "bg-[#50b748] text-white"}`}>{Object.keys(dailyBookings).length}</span>}</button>
                </div>

                {/* Right: Date selector + counts */}
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <div className="flex items-center gap-1.5 bg-red-50/80 rounded-xl px-2.5 py-1.5 border border-red-100">
                    <span className="text-sm font-black text-rose-600 leading-none">{totalUnavailableCount}</span>
                    <span className="text-[9px] font-bold text-rose-500/80 uppercase tracking-wider hidden sm:inline">Booked</span>
                    <span className="text-[9px] font-bold text-rose-500/80 uppercase tracking-wider sm:hidden">Booked</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-green-50/80 rounded-xl px-2.5 py-1.5 border border-green-100">
                    <span className="text-sm font-black text-[#50b748] leading-none">{totalAvailableCount}</span>
                    <span className="text-[9px] font-bold text-[#50b748]/80 uppercase tracking-wider hidden sm:inline">Available</span>
                    <span className="text-[9px] font-bold text-[#50b748]/80 uppercase tracking-wider sm:hidden">Available</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white rounded-xl px-2.5 py-1.5 border border-slate-200 shadow-sm">
                    <Calendar className="text-[#00b4eb] h-4 w-4 shrink-0" />
                    <input type="date" value={selectedDate} onChange={(e) => handleDateChange(e.target.value)} min={minBookingDate} max={maxBookingDate} className="bg-transparent text-xs font-bold text-gray-800 focus:outline-none cursor-pointer w-[110px]" />
                  </div>
                </div>
              </div>
              <div className="flex-1 relative bg-white" style={{ minHeight: 0 }}>
                {renderTabContent()}
              </div>
            </div>
          </main>
        </div>
        {showModal && <BookingModal currentSeat={currentSeat} formatDisplayDate={formatDisplayDate} selectedDate={selectedDate} handleModalClose={handleModalClose} handleDateBookingConfirm={handleDateBookingConfirm} />}
      </div>
    </SeatContext.Provider>
  );
};

export default InternSeatManagement;