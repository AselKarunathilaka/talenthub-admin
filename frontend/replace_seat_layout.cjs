const fs = require('fs');
let c = fs.readFileSync('src/pages/AdminSeatManagement.jsx', 'utf-8');

// 1. Add activeSeatSection state after lockedSeats state
c = c.replace(
  'const [lockedSeats, setLockedSeats] = useState([]);',
  'const [activeSeatSection, setActiveSeatSection] = useState("A");\n  const [lockedSeats, setLockedSeats] = useState([]);'
);

// 2. Replace entire right column from "RIGHT COLUMN" comment to closing )}
const startMarker = '\n              {/* RIGHT COLUMN: Seat Layout */}';
const endMarker = '\n              )}\n\n            </div>';

const newRightColumn = `
              {/* RIGHT COLUMN: Seat Layout */}
              {!showHistory && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25, duration: 0.3 }}
                  className="lg:col-span-8 xl:col-span-8 flex flex-col bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft') setActiveSeatSection('A');
                    if (e.key === 'ArrowRight') setActiveSeatSection('B');
                  }}
                  style={{ outline: 'none' }}
                >
                  {/* Header: Section Tabs + Legend + Arrow Nav */}
                  <div className="px-5 pt-5 pb-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-gray-50">
                    {/* Section Tabs */}
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-2xl border border-slate-100">
                      <button
                        onClick={() => setActiveSeatSection('A')}
                        className={\`relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all duration-200 \${
                          activeSeatSection === 'A'
                            ? 'bg-white text-[#0056a2] shadow-sm border border-gray-100'
                            : 'text-gray-400 hover:text-gray-600'
                        }\`}
                      >
                        {activeSeatSection === 'A' && <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-4 bg-[#00b4eb] rounded-full"></span>}
                        <span className="pl-1">Section A</span>
                      </button>
                      <button
                        onClick={() => setActiveSeatSection('B')}
                        className={\`relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all duration-200 \${
                          activeSeatSection === 'B'
                            ? 'bg-white text-[#0056a2] shadow-sm border border-gray-100'
                            : 'text-gray-400 hover:text-gray-600'
                        }\`}
                      >
                        {activeSeatSection === 'B' && <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-4 bg-rose-400 rounded-full"></span>}
                        <span className="pl-1">Section B</span>
                      </button>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 sm:gap-5">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-[#00b4eb] rounded-md shadow-sm border border-[#009ac9]/30"></div>
                        <span className="text-xs font-bold text-gray-500">Available</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-rose-500 rounded-md shadow-sm border border-rose-600/30"></div>
                        <span className="text-xs font-bold text-gray-500">Booked</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-slate-400 rounded-md shadow-sm border border-slate-500/30"></div>
                        <span className="text-xs font-bold text-gray-500">Locked</span>
                      </div>
                    </div>

                    {/* Arrow Nav */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveSeatSection('A')}
                        disabled={activeSeatSection === 'A'}
                        className="w-9 h-9 rounded-xl flex items-center justify-center border border-gray-200 bg-white text-gray-400 hover:text-[#0056a2] hover:border-[#00b4eb]/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                        title="Section A"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15,18 9,12 15,6"/></svg>
                      </button>
                      <span className="text-xs font-black text-gray-400 uppercase tracking-widest min-w-[24px] text-center">
                        {activeSeatSection === 'A' ? '1/2' : '2/2'}
                      </span>
                      <button
                        onClick={() => setActiveSeatSection('B')}
                        disabled={activeSeatSection === 'B'}
                        className="w-9 h-9 rounded-xl flex items-center justify-center border border-gray-200 bg-white text-gray-400 hover:text-[#0056a2] hover:border-[#00b4eb]/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                        title="Section B"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9,18 15,12 9,6"/></svg>
                      </button>
                    </div>
                  </div>

                  {/* Seat Map Canvas */}
                  <div className="flex-1 p-4 sm:p-5 flex flex-col min-h-[560px] xl:min-h-[680px]">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeSeatSection}
                        initial={{ opacity: 0, x: activeSeatSection === 'A' ? -30 : 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: activeSeatSection === 'A' ? 30 : -30 }}
                        transition={{ duration: 0.22, ease: 'easeInOut' }}
                        ref={setMapElement}
                        className="w-full flex-1 flex items-center justify-center relative overflow-hidden rounded-2xl bg-slate-50/60 border border-slate-100"
                      >
                        {/* Section watermark label */}
                        <div className="absolute top-4 left-5 flex items-center gap-2 opacity-40 pointer-events-none select-none">
                          <div className={\`w-2 h-2 rounded-full \${activeSeatSection === 'A' ? 'bg-[#00b4eb]' : 'bg-rose-400'}\`}></div>
                          <span className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">
                            Section {activeSeatSection} — {activeSeatSection === 'A' ? 'Seats 1–36' : 'Seats 37–88'}
                          </span>
                        </div>

                        {(() => {
                          // Section A: natural coordinates, canvas 460×720 centered at (180,377)
                          // Section B: x offset 620 so the 920-center maps to 300, canvas 560×720
                          const SEC_A = { W: 460, H: 720, cX: 180, cY: 377, offX: 0 };
                          const SEC_B = { W: 560, H: 720, cX: 300, cY: 377, offX: 620 };
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
                              posY = y !== undefined ? y : 0;
                            }

                            const lockDetail = lockedSeatDetailsBySeat[number];
                            let statusClasses = '';
                            const baseClasses = 'absolute w-[50px] h-[50px] rounded-2xl flex flex-col items-center justify-center font-bold transition-all shadow-md overflow-hidden cursor-pointer';
                            let titleText = '';

                            if (isLocked) {
                              statusClasses = 'bg-slate-400 text-white hover:shadow-lg hover:bg-slate-500 border border-slate-500/30';
                              titleText = lockDetail?.traineeId ? \`Seat \${number} (Locked for: \${lockDetail.traineeId}) — Click to unlock\` : \`Seat \${number} (Locked) — Click to unlock\`;
                            } else if (isBooked) {
                              statusClasses = 'bg-rose-500 text-white shadow-rose-200/50 hover:bg-rose-600 hover:shadow-lg border border-rose-600/30';
                              titleText = \`Seat \${number} — Booked by: \${booking.traineeId || booking.internName || booking.email || 'Unknown'} — Click to lock\`;
                            } else {
                              statusClasses = 'bg-[#00b4eb] text-white hover:bg-[#009ac9] hover:shadow-lg hover:shadow-[#00b4eb]/30 border border-[#009ac9]/30';
                              titleText = \`Seat \${number} (Available) — Click to lock\`;
                            }

                            return (
                              <motion.div
                                onClick={() => {
                                  if (lockLoading) return;
                                  if (isLocked) setLockConfirm({ seatNumber: number, action: 'unlock' });
                                  else setLockConfirm({ seatNumber: number, action: 'lock' });
                                }}
                                className={\`\${baseClasses} \${statusClasses}\`}
                                style={{ left: \`\${posX * scale - 25}px\`, top: \`\${posY * scale - 25}px\` }}
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
                            <div className="relative" style={{ width: \`\${sec.W * scale}px\`, height: \`\${sec.H * scale}px\` }}>
                              <div className="absolute" style={{ width: \`\${sec.W}px\`, height: \`\${sec.H}px\`, transform: \`scale(\${scale})\`, transformOrigin: '0 0' }}>
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

            </div>`;

const startIdx = c.indexOf(startMarker);
const endIdx = c.indexOf(endMarker, startIdx);

if (startIdx === -1) { console.error('Start marker not found'); process.exit(1); }
if (endIdx === -1) { console.error('End marker not found'); process.exit(1); }

c = c.slice(0, startIdx) + newRightColumn + c.slice(endIdx + endMarker.length);

fs.writeFileSync('src/pages/AdminSeatManagement.jsx', c);
console.log('Done. File length:', c.length);
