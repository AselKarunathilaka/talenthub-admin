const fs = require('fs');
const path = 'g:/github/TalentHub/frontend/src/pages/InternSeatReservation.jsx';
let code = fs.readFileSync(path, 'utf8');

const searchStr = `                <div className="flex-1 min-w-[160px] bg-slate-50 rounded-xl p-2 flex items-center gap-2 border border-slate-100">
                  <div className="bg-white p-1.5 rounded-lg shadow-sm border border-slate-100"><Calendar className="text-[#00b4eb] h-4 w-4" /></div>
        {showModal && <BookingModal`;

const replacement = `                <div className="flex-1 min-w-[160px] bg-slate-50 rounded-xl p-2 flex items-center gap-2 border border-slate-100">
                  <div className="bg-white p-1.5 rounded-lg shadow-sm border border-slate-100"><Calendar className="text-[#00b4eb] h-4 w-4" /></div>
                  <div className="flex-1"><label className="text-[clamp(8px,2vw,9px)] font-bold text-gray-400 uppercase tracking-wider block">Select Date</label><input type="date" value={selectedDate} onChange={(e) => handleDateChange(e.target.value)} min={minBookingDate} max={maxBookingDate} className="bg-transparent text-[clamp(10px,2vw,12px)] font-bold text-gray-800 w-full focus:outline-none cursor-pointer" /></div>
                </div>
              </motion.div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden h-[calc(100vh-140px)] min-h-[600px] lg:h-auto">
              <div className="flex flex-wrap sm:flex-nowrap border-b border-gray-100 bg-slate-50/50 p-2 gap-2">
                <button 
                  onClick={() => setActiveTab("map")} 
                  className={\`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-6 py-2 sm:py-3.5 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-[13px] md:text-[14px] whitespace-nowrap transition-all duration-100 \${
                    activeTab === "map" 
                      ? "bg-gradient-to-r from-[#0056a2] to-[#00b4eb] text-white shadow-md shadow-blue-500/30 ring-1 ring-blue-400/50" 
                      : "bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 ring-1 ring-gray-200/50"
                  }\`}
                >
                  <MapIcon className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]" /> Seat Map
                </button>

                <button 
                  onClick={() => setActiveTab("bookings")} 
                  className={\`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-6 py-2 sm:py-3.5 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-[13px] md:text-[14px] whitespace-nowrap transition-all duration-100 \${
                    activeTab === "bookings" 
                      ? "bg-gradient-to-r from-[#15803d] to-[#50b748] text-white shadow-md shadow-green-500/30 ring-1 ring-green-400/50" 
                      : "bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 ring-1 ring-gray-200/50"
                  }\`}
                >
                  <List className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]" /> My Bookings
                  {Object.keys(dailyBookings).length > 0 && (
                    <span className={\`ml-0.5 sm:ml-1.5 px-1.5 sm:px-2 py-0.5 rounded-full font-black text-[9px] sm:text-[10px] \${
                      activeTab === "bookings" ? "bg-white text-[#15803d]" : "bg-[#50b748] text-white"
                    }\`}>
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
        {showModal && <BookingModal`;

code = code.replace(searchStr, replacement);
fs.writeFileSync(path, code);
console.log('Fixed file');
