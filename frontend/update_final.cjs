const fs = require('fs');
const file = 'g:/github/TalentHub/frontend/src/pages/AdminSeatManagement.jsx';
let content = fs.readFileSync(file, 'utf-8');

// Fix imports
content = content.replace(
  /import \{[\s\S]*?\} from "react-icons\/fa";/,
  `import {
  FaChair,
  FaCalendarAlt,
  FaSpinner,
  FaExclamationTriangle,
  FaDownload,
  FaSearch,
  FaTimes,
  FaHistory,
  FaLock,
  FaUnlock,
} from "react-icons/fa";`
);

if (!content.includes('API_BASE_URL')) {
  content = content.replace(
    'import { Armchair } from "lucide-react";',
    'import { Armchair } from "lucide-react";\nimport { API_BASE_URL } from "../api/apiConfig";'
  );
}

// Ensure motion doesn't trigger lint error
content = content.replace('import { motion, AnimatePresence } from "framer-motion";', '// eslint-disable-next-line no-unused-vars\nimport { motion, AnimatePresence } from "framer-motion";');

// Remove activeSection
content = content.replace('const [activeSection, setActiveSection] = useState("A");', '');
content = content.replace("const [activeSection, setActiveSection] = useState('A');", '');

const splitPoint = 'const isTomorrow = selectedDate === tomorrowStr;';
if (!content.includes(splitPoint)) {
  console.log('Split point not found');
  process.exit(1);
}

const beforeReturn = content.split(splitPoint)[0] + splitPoint + '\n\n';

const newJSX = `  return (
    <AdminNavigation>
      <div className="inactive-root relative z-10 min-h-screen bg-slate-50 font-sans text-gray-800 pb-10 flex flex-col">
        {/* Ambient background */}
        <div className="inactive-ambient absolute inset-0 overflow-hidden pointer-events-none">
          <div className="inactive-ambient__orb inactive-ambient__orb--1 absolute" />
          <div className="inactive-ambient__orb inactive-ambient__orb--2 absolute" />
        </div>

        <div className="inactive-content relative z-10 flex-1 w-full lg:mt-4 lg:px-6 xl:px-10">
          <main className="inactive-main flex-1 p-4 sm:p-6 mx-auto max-w-[1600px] w-full">
            
            {/* Header Section */}
            <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-6">
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
                  View, monitor, and manage intern seat bookings.
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

            {/* Date Select and Stats Card - FULL WIDTH */}
            {!showHistory && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.2 }}
                className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-col md:flex-row items-center gap-4 w-full"
              >
                <div className="flex-1 w-full md:w-auto bg-slate-50 rounded-2xl p-4 flex items-center gap-4 border border-slate-100">
                  <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                    <FaCalendarAlt className="text-[#00b4eb] h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      Select Date
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={handleDateChange}
                      className="bg-transparent text-base font-bold text-gray-800 w-full focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                  <div className="flex-1 md:w-32 text-center p-4 bg-[#00b4eb]/10 rounded-2xl border border-[#00b4eb]/20">
                    <div className="text-3xl font-black text-[#00b4eb] leading-none mb-1">
                      {loading ? "-" : TOTAL_SEATS - (stats.occupiedSeats + lockedSeatsCount)}
                    </div>
                    <div className="text-xs font-bold text-[#00b4eb]/80 uppercase tracking-wider">Available</div>
                  </div>
                  <div className="flex-1 md:w-32 text-center p-4 bg-rose-50/80 rounded-2xl border border-rose-100">
                    <div className="text-3xl font-black text-rose-600 leading-none mb-1">
                      {loading ? "-" : stats.occupiedSeats}
                    </div>
                    <div className="text-xs font-bold text-rose-500/80 uppercase tracking-wider">Booked</div>
                  </div>
                  <div className="flex-1 md:w-32 text-center p-4 bg-gray-50/80 rounded-2xl border border-gray-200">
                    <div className="text-3xl font-black text-gray-600 leading-none mb-1">
                      {loading ? "-" : lockedSeatsCount}
                    </div>
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Locked</div>
                  </div>
                </div>
              </motion.div>
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
                        <div className={\`w-12 h-12 rounded-full flex items-center justify-center shadow-sm \${lockConfirm.action === "lock" ? "bg-red-50 text-red-500" : "bg-green-50 text-green-500"}\`}>
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
                        <button onClick={() => handleToggleLock(lockConfirm.seatNumber, lockConfirm.action)} disabled={lockLoading} className={\`flex-1 px-4 py-3 text-white font-bold rounded-xl transition-all shadow-lg focus:outline-none focus:ring-4 active:scale-95 flex items-center justify-center gap-2 \${lockConfirm.action === "lock" ? "bg-red-500 hover:bg-red-600 shadow-red-500/30 focus:ring-red-100" : "bg-[#50b748] hover:bg-[#43a03c] shadow-[#50b748]/30 focus:ring-green-100"}\`}>
                          {lockLoading ? <FaSpinner className="animate-spin" /> : (lockConfirm.action === "lock" ? <><FaLock size={14}/> Confirm Lock</> : <><FaUnlock size={14}/> Confirm Unlock</>)}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* LEFT COLUMN: Bookings List and Search */}
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.3 }}
                className={\`flex flex-col \${showHistory ? "col-span-12" : "lg:col-span-4 xl:col-span-4"}\`}
              >
                {/* Search Bar */}
                <div className="bg-white p-4 sm:p-6 rounded-3xl border border-gray-100 shadow-sm mb-6 w-full">
                  <div className="flex flex-col w-full space-y-3">
                    <label htmlFor="search-input" className="block text-sm font-bold text-gray-700">Search Intern Bookings</label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-2">
                      <div className="relative flex-1">
                        <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <input
                          id="search-input"
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyPress={(e) => e.key === "Enter" && handleSearchBookingHistory()}
                          placeholder="Search ID or Name..."
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#00b4eb] focus:border-transparent text-gray-900 text-sm shadow-sm transition-all"
                        />
                        {searchQuery && (
                          <button onClick={clearSearch} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-white p-1 rounded-full shadow-sm">
                            <FaTimes className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <button
                        onClick={handleSearchBookingHistory}
                        disabled={!searchQuery.trim() || searchLoading}
                        className="flex items-center justify-center space-x-2 px-5 py-3 bg-[#0056a2] hover:bg-[#00488a] disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-2xl text-sm font-bold transition-all shadow-md shadow-[#0056a2]/20 disabled:shadow-none"
                      >
                        {searchLoading ? (
                          <><FaSpinner className="h-4 w-4 animate-spin" /><span>Searching...</span></>
                        ) : (
                          <><FaHistory className="h-4 w-4" /><span>History</span></>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Inline Search Message */}
                  <AnimatePresence>
                    {searchMessage && (
                      <motion.div
                        className={\`mt-4 p-4 rounded-2xl border \${searchMessage.type === "success" ? "bg-[#50b748]/10 border-[#50b748]/30" : searchMessage.type === "error" ? "bg-rose-50 border-rose-200" : "bg-[#00b4eb]/10 border-[#00b4eb]/30"}\`}
                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      >
                        <div className="flex items-center justify-between">
                          <p className={\`text-sm font-bold \${searchMessage.type === "success" ? "text-[#15803d]" : searchMessage.type === "error" ? "text-rose-800" : "text-[#0056a2]"}\`}>{searchMessage.text}</p>
                          <button onClick={() => setSearchMessage(null)} className={\`\${searchMessage.type === "success" ? "text-[#15803d] hover:text-[#50b748]" : searchMessage.type === "error" ? "text-rose-600 hover:text-rose-800" : "text-[#0056a2] hover:text-[#00b4eb]"}\`}><FaTimes className="h-4 w-4" /></button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden min-h-[400px]">
                  <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">
                      {showHistory && searchResults
                        ? \`History - \${searchResults.internInfo?.internName || "Intern"}\`
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
                           <span>Pending</span>
                         </button>
                       )}
                       <button
                         onClick={handleExportCSV}
                         disabled={displayBookings.length === 0}
                         className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-2 bg-[#50b748] hover:bg-[#43a03c] disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#50b748]/20"
                       >
                         <FaDownload className="h-3 w-3" />
                         <span>Export</span>
                       </button>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2" style={{ maxHeight: showHistory ? 'auto' : '650px' }}>
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
                              ? \`No seat bookings for \${formatDate(selectedDate)}.\`
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
                                    src={\`\${API_BASE_URL}/interns/\${booking.internId}/profile-picture\`}
                                    alt={booking.internName}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src = "https://ui-avatars.com/api/?name=" + encodeURIComponent(booking.internName || 'Intern') + "&background=00b4eb&color=fff";
                                    }}
                                  />
                               </div>
                               <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-[#00b4eb] text-white flex items-center justify-center text-[10px] font-black border-2 border-white shadow-sm z-10">
                                 {booking.seatNumber}
                               </div>
                            </div>
                            
                            {/* Details Column */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center pt-0.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-extrabold text-gray-900 truncate">{booking.internName}</div>
                                  <div className="text-xs font-bold text-gray-500 mt-0.5 truncate tracking-wide">{booking.traineeId}</div>
                                </div>
                                <span className={\`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shrink-0 \${booking.status === "active" ? "bg-[#50b748]/10 text-[#15803d]" : "bg-rose-50 text-rose-600"}\`}>
                                  {booking.status}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2 mt-2.5">
                                 <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                    <span className="text-gray-400 text-[10px]">📅</span>
                                    <span className="text-[10px] font-bold text-gray-600">{formatDate(booking.bookingDate)}</span>
                                 </div>
                                 <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                    <span className="text-gray-400 text-[10px]">⏰</span>
                                    <span className="text-[10px] font-bold text-gray-600">{formatDateTime(booking.bookedAt)}</span>
                                 </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
                  className="lg:col-span-8 xl:col-span-8 flex flex-col bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  <div className="p-4 sm:p-6 flex flex-col h-full min-h-[600px] xl:min-h-[750px]">
                    <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4 relative z-10 w-full">
                      {/* Legend */}
                      <div className="flex items-center gap-4 sm:gap-6 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 w-full justify-center">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-[#00b4eb] rounded-lg shadow-sm border border-[#009ac9]/30"></div>
                          <span className="text-xs font-bold text-gray-600">Available</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-rose-500 rounded-lg shadow-sm border border-rose-600/30"></div>
                          <span className="text-xs font-bold text-gray-600">Booked</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-slate-400 rounded-lg shadow-sm border border-slate-500/30"></div>
                          <span className="text-xs font-bold text-gray-600">Locked</span>
                        </div>
                      </div>
                    </div>

                    <div 
                      ref={setMapElement}
                      className="w-full flex-1 flex items-center justify-center relative overflow-hidden custom-scrollbar"
                    >
                      <div className={\`relative shrink-0 transition-opacity duration-500 \${ready ? 'opacity-100' : 'opacity-0'}\`} style={{ width: \`\${MAP_WIDTH * scale}px\`, height: \`\${MAP_HEIGHT * scale}px\` }}>
                        <div className="absolute" style={{ width: \`\${MAP_WIDTH}px\`, height: \`\${MAP_HEIGHT}px\`, transform: \`scale(\${scale})\`, transformOrigin: '0 0' }}>
                           <div className="absolute inset-0">
                             
                             {/* Clean Text Label for Entrance (No Rectangles) */}
                             <div className="absolute top-10 left-10 flex items-center gap-3 opacity-60">
                               <div className="text-lg font-black text-slate-400 uppercase tracking-[0.25em]">Entrance Area</div>
                             </div>

                             {/* Render Seats */}
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
                                  const baseClasses = "absolute w-[50px] h-[50px] rounded-2xl flex flex-col items-center justify-center font-bold transition-all shadow-md overflow-hidden cursor-pointer backdrop-blur-sm";

                                  if (isLocked) {
                                    statusClasses = "bg-slate-400 text-white hover:shadow-lg hover:bg-slate-500 border border-slate-500/30";
                                    titleText = lockDetail?.traineeId ? \`Seat \${number} (Locked for: \${lockDetail.traineeId}) — Click to unlock\` : \`Seat \${number} (Locked) — Click to unlock\`;
                                  } else if (isBooked) {
                                    statusClasses = "bg-rose-500 text-white shadow-rose-200/50 hover:bg-rose-600 hover:shadow-lg border border-rose-600/30";
                                    titleText = \`Seat \${number} — Booked by: \${booking.traineeId || booking.internName || booking.email || "Unknown"} — Click to lock\`;
                                  } else {
                                    statusClasses = "bg-[#00b4eb] text-white hover:bg-[#009ac9] hover:shadow-lg hover:shadow-[#00b4eb]/30 border border-[#009ac9]/30";
                                    titleText = \`Seat \${number} (Available) — Click to lock\`;
                                  }

                                  return (
                                    <motion.div
                                      onClick={() => {
                                        if (lockLoading) return;
                                        if (isLocked) setLockConfirm({ seatNumber: number, action: "unlock" });
                                        else setLockConfirm({ seatNumber: number, action: "lock" });
                                      }}
                                      className={\`\${baseClasses} \${statusClasses}\`}
                                      style={{ left: \`\${posX - 25}px\`, top: \`\${posY - 25}px\` }}
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
                                            <span className="text-[11px] leading-none text-white font-extrabold">{number}</span>
                                          </>
                                        ) : (
                                          <>
                                            <Armchair size={18} strokeWidth={2.5} className="mb-0.5 text-white" />
                                            <span className="text-[11px] leading-none text-white font-extrabold">{number}</span>
                                          </>
                                        )}
                                      </div>
                                    </motion.div>
                                  );
                                };

                                return (
                                  <>
                                    {/* Section A Seats */}
                                    {leftSection.topRow.map((s) => <AdminSeat key={s.number} {...s} />)}
                                    {leftSection.pillarSeats.map((s) => <AdminSeat key={s.number} {...s} centerX={180} centerY={377} />)}
                                    {leftSection.outerRing1.map((s) => <AdminSeat key={s.number} {...s} centerX={180} centerY={377} />)}
                                    {leftSection.outerRing2.map((s) => <AdminSeat key={s.number} {...s} centerX={180} centerY={377} />)}
                                    {leftSection.outerRing3.map((s) => <AdminSeat key={s.number} {...s} centerX={180} centerY={377} />)}
                                    
                                    {/* Section B Seats */}
                                    {rightSection.straightSeats.map((s) => <AdminSeat key={s.number} {...s} />)}
                                    {rightSection.pillarSeats.map((s) => <AdminSeat key={s.number} {...s} centerX={920} centerY={377} />)}
                                    {rightSection.outerRing1.map((s) => <AdminSeat key={s.number} {...s} centerX={920} centerY={377} />)}
                                    {rightSection.outerRing2.map((s) => <AdminSeat key={s.number} {...s} centerX={920} centerY={377} />)}
                                    {rightSection.outerRing3.map((s) => <AdminSeat key={s.number} {...s} centerX={920} centerY={377} />)}
                                  </>
                                );
                             })()}

                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

            </div>
          </main>
        </div>
      </div>
    </AdminNavigation>
  );
};

export default AdminSeatManagement;
`;

fs.writeFileSync(file, beforeReturn + newJSX);
console.log('Update complete');
