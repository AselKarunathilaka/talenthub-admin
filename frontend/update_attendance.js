const fs = require('fs');
const file = '/Users/nimdinuweerathunga/Documents/GitHub/TalentHub/frontend/src/pages/AdminInternDetails.jsx';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

const newBlock = `
                        {/* ════════ ATTENDANCE CALENDAR ════════ */}
                        {!attendanceLoading && !attendanceError && (
                          <div>
                            {/* Month navigation + stats strip */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                              <div className="flex items-center space-x-3">
                                <button
                                  onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                                >
                                  <FaChevronLeft className="h-3 w-3" />
                                </button>
                                <span className="text-sm font-semibold text-gray-800 min-w-[130px] text-center">{monthLabel}</span>
                                <button
                                  onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                                >
                                  <FaChevronRight className="h-3 w-3" />
                                </button>
                              </div>
                              {/* Stats pills */}
                              <div className="flex flex-wrap gap-2 text-xs">
                                <span className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full border border-green-200">
                                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> Present: {mPresent}
                                </span>
                                {attendanceSubTab === 'daily' && (
                                  <span className="flex items-center gap-1 px-2 py-1 bg-yellow-50 text-yellow-700 rounded-full border border-yellow-200">
                                    <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span> Late: {mLate}
                                  </span>
                                )}
                                <span className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded-full border border-red-200">
                                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span> Absent: {mAbsent}
                                </span>
                              </div>
                            </div>

                            {/* Calendar grid */}
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse">
                                <thead>
                                  <tr>
                                    {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                                      <th key={d} className="text-center pb-2 text-xs font-semibold text-gray-500 w-[14.28%]">{d}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {Array.from({ length: Math.ceil(calDays.length / 7) }, (_, w) => (
                                    <tr key={w}>
                                      {calDays.slice(w * 7, w * 7 + 7).map((day, di) => {
                                        const meta = getDayMeta(activeMap, day);
                                        const isToday = day && day.toDateString() === new Date().toDateString();
                                        return (
                                          <td key={di} className="py-1 text-center">
                                            {day ? (
                                              <div className="flex flex-col items-center gap-0.5 group relative">
                                                <span className={\`text-[10px] font-medium \${
                                                  isToday ? 'text-blue-600 font-bold' : 'text-gray-500'
                                                }\`}>{day.getDate()}</span>
                                                <div
                                                  className={\`w-4 h-4 sm:w-5 sm:h-5 rounded-full cursor-pointer transition-transform hover:scale-125 \${
                                                    isToday ? 'ring-2 ring-blue-400 ring-offset-1' : ''
                                                  }\`}
                                                  style={{ backgroundColor: meta?.color ?? '#e5e7eb' }}
                                                  onMouseEnter={e => {
                                                    const r = e.target.getBoundingClientRect();
                                                    setTooltip({ x: r.left, y: r.top, label: meta?.label ?? 'No Record', date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
                                                  }}
                                                  onMouseLeave={() => setTooltip(null)}
                                                />
                                              </div>
                                            ) : <div className="h-10" /> }
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Legend */}
                            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-3 text-xs text-gray-600">
                              {[
                                { color: '#22c55e', label: 'Present' },
                                ...(attendanceSubTab === 'daily' ? [{ color: '#eab308', label: 'Late' }] : []),
                                { color: '#ef4444', label: 'Absent' },
                                { color: '#d1d5db', label: 'No Record' },
                              ].map(({ color, label }) => (
                                <span key={label} className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: color }}></span>
                                  {label}
                                </span>
                              ))}
                            </div>

                            {/* All-time summary cards */}
                            {activeData.length > 0 && (
                              <div className="mt-5 grid grid-cols-3 gap-3">
                                {(() => {
                                  const allKeys = Object.values(activeMap);
                                  const totalPresent = allKeys.filter(e => (e.status||'').toLowerCase() === 'present').length;
                                  const totalLate    = allKeys.filter(e => (e.status||'').toLowerCase() === 'late').length;
                                  const totalAbsent  = allKeys.filter(e => {
                                    const st = (e.status||'').toLowerCase();
                                    return st !== 'present' && st !== 'late';
                                  }).length;
                                  
                                  const cards = [
                                    { label: 'Total Present',  value: totalPresent, color: 'from-green-400 to-emerald-500' }
                                  ];
                                  if (attendanceSubTab === 'daily') {
                                    cards.push({ label: 'Late Arrivals',  value: totalLate,    color: 'from-yellow-400 to-amber-500' });
                                  }
                                  cards.push({ label: 'Absent Days',    value: totalAbsent,  color: 'from-red-400 to-rose-500' });

                                  return cards.map(({ label, value, color }) => (
                                    <div key={label} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm text-center">
                                      <div className={\`text-2xl font-bold bg-gradient-to-r \${color} bg-clip-text text-transparent\`}>{value}</div>
                                      <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
                                    </div>
                                  ));
                                })()}
                              </div>
                            )}

                            {activeData.length === 0 && (
                              <div className="mt-6 text-center py-10 text-gray-400 text-sm">No {attendanceSubTab} attendance records found.</div>
                            )}
                          </div>
                        )}`;

const startIdx = 1103; // 0-indexed line number for 1104
const endIdx = 1326;   // 0-indexed line number for 1327

lines.splice(startIdx, endIdx - startIdx, newBlock);
fs.writeFileSync(file, lines.join('\n'));
console.log("File updated successfully.");
