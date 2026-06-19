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
  const MAP_WIDTH = 1450;
  const MAP_HEIGHT = 910;

  const { scale, ready } = useMapScale(MAP_WIDTH, MAP_HEIGHT, mapViewportRef);

  const renderTabContent = () => {
    if (activeTab === "map") {
      return (
        <div className="flex flex-col w-full h-full">
          {/* Legend + Controls */}
          <div className="flex justify-between items-center py-3 px-4 bg-white border-b border-gray-100 flex-wrap gap-2 shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2"><div className="w-5 h-5 bg-white border-2 border-[#50b748] rounded-lg shadow-sm flex items-center justify-center"><Armchair size={10} className="text-[#50b748]" /></div><span className="text-xs font-bold text-gray-600">Available</span></div>
              <div className="flex items-center gap-2"><div className="w-5 h-5 bg-rose-500 border-2 border-rose-600 rounded-lg shadow-sm flex items-center justify-center"><X size={11} strokeWidth={3} className="text-white" /></div><span className="text-xs font-bold text-gray-600">Booked</span></div>
              <div className="flex items-center gap-2"><div className="w-5 h-5 bg-slate-200 border-2 border-slate-300 rounded-lg shadow-sm flex items-center justify-center opacity-75"><Armchair size={10} className="text-slate-400" /></div><span className="text-xs font-bold text-gray-600">Locked</span></div>
            </div>
          </div>

          {/* Map Viewport - ensure it takes all available space */}
          <div
            ref={mapViewportRef}
            className="flex-1 overflow-y-hidden overflow-x-auto bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] relative flex items-center justify-start sm:justify-center"
            style={{ minHeight: 0 }}
          >
            {/* Map content - only show after initial transform is ready to avoid flicker */}
            {ready && (
              <div
                className="relative shrink-0 overflow-hidden"
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
                  <div className="absolute inset-0" style={{ transform: 'translate(150px, 60px)' }}>
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
                <h3 className="text-xl font-extrabold text-gray-800 tracking-tight">Your Bookings for {formatDisplayDate(selectedDate)}</h3>
                <p className="text-sm text-gray-500 mt-1 font-medium">Manage your seat reservations for this date.</p>
              </div>
            </div>
            {Object.keys(dailyBookings).length > 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50/80 border-b border-gray-100">
                      <tr>
                        <th className="px-4 sm:px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Seat Number</th>
                        <th className="px-4 sm:px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs hidden sm:table-cell">Booking Date</th>
                        <th className="px-4 sm:px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {Object.entries(dailyBookings).sort(([a], [b]) => Number(a) - Number(b)).map(([seatNum]) => (
                        <tr key={seatNum} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-4 sm:px-6 py-4 sm:py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-[#00b4eb]/10 flex items-center justify-center shrink-0"><Armchair size={18} className="text-[#0056a2]" /></div>
                              <div><span className="block text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Seat</span><span className="font-extrabold text-gray-900 text-sm sm:text-base leading-none">{seatNum}</span></div>
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 sm:py-5 hidden sm:table-cell"><div className="font-medium text-gray-700 whitespace-nowrap">{formatDisplayDate(selectedDate)}</div></td>
                          <td className="px-4 sm:px-6 py-4 sm:py-5 text-right">
                            <button onClick={() => handleCancelBooking(seatNum)} className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-white border border-rose-200 text-rose-600 rounded-xl hover:bg-rose-50 hover:border-rose-300 transition-all text-xs sm:text-sm font-bold shadow-sm whitespace-nowrap">
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

  const todayStr = getLocalISODate();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = getLocalISODate(tomorrowDate);

  const isToday = selectedDate === todayStr;
  const isTomorrow = selectedDate === tomorrowStr;

  return (
    <SeatContext.Provider value={{ getSeatStatus, allBookings, dailyBookings, handleSeatClick, lockedSeatDetails }}>
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 font-sans">
        <Navigation />
        <div className="flex-1 w-full lg:mt-20 lg:px-6 xl:px-10 pb-10">
          <main className="flex-1 p-4 sm:p-6 mx-auto max-w-[1600px] w-full">
            <SectionTip sectionKey="seat" />
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="text-3xl sm:text-4xl font-extrabold text-gray-900 flex items-center gap-3 tracking-tight">
                  <div className="p-2.5 bg-[#00b4eb]/10 rounded-2xl"><Armchair className="text-[#0056a2] h-8 w-8" /></div> Seat Reservation
                </motion.h1>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05, duration: 0.2 }} className="text-gray-500 mt-2 text-sm sm:text-base font-medium max-w-xl">
                  Select a date and reserve your preferred spot.
                </motion.p>
              </div>

              {(isToday || isTomorrow) && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  className={`flex flex-1 md:flex-none mx-auto md:mx-0 items-center justify-center px-8 py-3 rounded-2xl border-2 font-black tracking-[0.2em] uppercase text-lg shadow-sm ${
                    isToday 
                      ? "bg-[#00b4eb]/10 border-[#00b4eb]/30 text-[#0056a2]" 
                      : "bg-[#50b748]/10 border-[#50b748]/30 text-[#15803d]"
                  }`}
                >
                  {isToday ? "TODAY" : "TOMORROW"}
                </motion.div>
              )}

              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.2 }} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-2 sm:p-3 flex flex-wrap sm:flex-nowrap items-center gap-3">
                <div className="flex-1 min-w-[200px] bg-slate-50 rounded-2xl p-3 flex items-center gap-3 border border-slate-100">
                  <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100"><Calendar className="text-[#00b4eb] h-5 w-5" /></div>
                  <div className="flex-1"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Select Date</label><input type="date" value={selectedDate} onChange={(e) => handleDateChange(e.target.value)} min={minBookingDate} max={maxBookingDate} className="bg-transparent text-sm font-bold text-gray-800 w-full focus:outline-none cursor-pointer" /></div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <div className="flex-1 sm:w-28 text-center p-3 bg-red-50/80 rounded-2xl border border-red-100"><div className="text-2xl font-black text-rose-600 leading-none mb-1">{totalUnavailableCount}</div><div className="text-[10px] font-bold text-rose-500/80 uppercase tracking-wider">Unavailable</div></div>
                  <div className="flex-1 sm:w-28 text-center p-3 bg-green-50/80 rounded-2xl border border-green-100"><div className="text-2xl font-black text-[#50b748] leading-none mb-1">{totalAvailableCount}</div><div className="text-[10px] font-bold text-[#50b748]/80 uppercase tracking-wider">Available</div></div>
                </div>
              </motion.div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col" style={{ minHeight: "850px", height: "calc(100vh - 160px)" }}>
              <div className="flex border-b border-gray-100 bg-slate-50/50 p-2 gap-2">
                <button onClick={() => setActiveTab("map")} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm transition-all duration-100 ${activeTab === "map" ? "bg-gradient-to-r from-[#0056a2] to-[#00b4eb] text-white shadow-lg shadow-blue-500/30 ring-1 ring-blue-400/50" : "bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 ring-1 ring-gray-200/50"}`}><MapIcon size={18} /> Seat Map</button>
                <button onClick={() => setActiveTab("bookings")} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm transition-all duration-100 ${activeTab === "bookings" ? "bg-gradient-to-r from-[#15803d] to-[#50b748] text-white shadow-lg shadow-green-500/30 ring-1 ring-green-400/50" : "bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 ring-1 ring-gray-200/50"}`}><List size={18} /> My Bookings{Object.keys(dailyBookings).length > 0 && <span className={`ml-1.5 px-2 py-0.5 rounded-full font-black text-[10px] ${activeTab === "bookings" ? "bg-white text-[#15803d]" : "bg-[#50b748] text-white"}`}>{Object.keys(dailyBookings).length}</span>}</button>
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