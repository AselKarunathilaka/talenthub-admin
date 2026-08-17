import re

with open(r"g:\github\TalentHub\frontend\src\pages\Dashboard.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Define the new content
new_content = """
  const meetingAttendanceRate = useMemo(() => {
    if (!internData?.Training_StartDate) return 0;
    const start = new Date(internData.Training_StartDate);
    const end = internData.Training_EndDate ? new Date(internData.Training_EndDate) : new Date();
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
    const attendedWeeks = new Set(
      meetingAttendance
        .filter((record) => record.status === "Present")
        .map((record) => {
          const date = new Date(record.date);
          return `${date.getFullYear()}-${Math.floor(date.getTime() / (1000 * 60 * 60 * 24 * 7))}`;
        })
    ).size;
    return Math.round((attendedWeeks / totalWeeks) * 100) || 0;
  }, [internData, meetingAttendance]);

  const dailyAttendanceRate = useMemo(() => {
    if (!internData?.Training_StartDate) return 0;
    const start = new Date(internData.Training_StartDate);
    const end = internData.Training_EndDate ? new Date(internData.Training_EndDate) : new Date();
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const workingDays = Math.max(1, Math.floor(totalDays * (5 / 7))); // Approx working days
    const attendedDays = new Set(
      dailyRecords
        .filter((record) => record.status === "Present")
        .map((record) => record.date)
    ).size;
    return Math.min(100, Math.round((attendedDays / workingDays) * 100)) || 0;
  }, [internData, dailyRecords]);

  // Handle accordion
  const [expandedGroups, setExpandedGroups] = useState({});
  const toggleGroup = (dateKey) => {
    setExpandedGroups(prev => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="w-full flex flex-col items-center justify-center mt-12">
          <Loader2 className="h-10 w-10 animate-spin mb-4" style={{ color: "#00b4eb" }} />
          <p className="text-gray-500 font-medium">Loading your dashboard...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-white rounded-3xl p-8 max-w-lg mx-auto mt-12 text-center border border-red-100 shadow-sm">
          {isNetworkError ? (
            <>
              <XCircle className="mx-auto h-12 w-12 text-red-500 mb-4 opacity-90" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Connection Error</h3>
              <p className="text-gray-500 mb-6">Unable to connect to the server. Please check your internet connection and try again.</p>
            </>
          ) : (
            <p className="text-gray-500 mb-6">Error: {error}</p>
          )}
          <button onClick={() => window.location.reload()} className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition">
            Retry Connection
          </button>
        </div>
      );
    }

    const lastSeenDate = internData?.updatedAt ? new Date(internData.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

    return (
      <div className="bento-container">
        <InternshipEndNotification
          notification={endDateNotification}
          onDismiss={() => {
            setEndDateNotification(null);
            localStorage.setItem("internshipEndDismissedDate", new Date().toISOString());
          }}
        />
        
        {/* Hero Section */}
        <motion.div className="bento-hero" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }}>
          <div className="bento-hero-bg"></div>
          <div className="bento-hero-glow"></div>
          <div className="bento-hero-content">
            <div className="bento-avatar">
              {internData.name ? internData.name.charAt(0).toUpperCase() : "I"}
            </div>
            <div className="bento-hero-text">
              <h1 className="bento-greeting">Welcome back, {internData.name?.split(" ")[0]}!</h1>
              <p className="bento-subgreeting">Here's your training and performance overview.</p>
              <div className="bento-hero-badges">
                <span className="bento-badge">
                  <User size={14} /> ID: {internData.internId}
                </span>
                {internData.Training_Status === "Ended" && (
                  <span className="bento-badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5' }}>
                    Training Ended
                  </span>
                )}
                {lastSeenDate && (
                  <span className="bento-badge">
                    <Clock size={14} /> Last Seen: {lastSeenDate}
                  </span>
                )}
              </div>
            </div>
            
            <div style={{ marginLeft: 'auto', zIndex: 10 }}>
                <WhatsAppSupportButton />
            </div>
          </div>
        </motion.div>

        {/* Bento Grid */}
        <div className="bento-grid">
          
          {/* Tile 1: Overview (Large) */}
          <div className="bento-card bento-card--large">
            <div className="bento-card-header">
              <h2 className="bento-card-title">
                <div className="bento-card-icon bento-card-icon--emerald"><Calendar size={20} /></div>
                Training & Projects
              </h2>
            </div>
            <div className="bento-card-body bento-overview-split">
              <div className="bento-overview-left">
                <div className="bento-info-list">
                  <div className="bento-info-item">
                    <span className="bento-info-label">Duration</span>
                    <span className="bento-info-value">
                      {internData.Training_StartDate ? formatDate(internData.Training_StartDate) : "N/A"} - {internData.Training_EndDate ? formatDate(internData.Training_EndDate) : "N/A"}
                    </span>
                  </div>
                  {internData.Training_StartDate && internData.Training_EndDate && (() => {
                    const end = new Date(internData.Training_EndDate);
                    const daysLeft = Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24));
                    return (
                      <div className="bento-info-item" style={{ marginTop: 8 }}>
                        <span className="bento-info-label">Status</span>
                        <span className="bento-info-value" style={{ color: daysLeft > 0 ? "#10b981" : "#ef4444", fontSize: 18 }}>
                          {daysLeft > 0 ? `${daysLeft} Days Remaining` : "Training Completed"}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="bento-overview-right">
                <h3 className="bento-info-label" style={{ marginBottom: 12 }}>Assigned Projects</h3>
                {internProjects && internProjects.length > 0 ? (
                  <div className="bento-projects">
                    {internProjects.map((proj, pi) => (
                      <div key={pi} className="bento-project-item">
                        <Folder size={16} className="bento-project-icon" />
                        <div>
                          <p className="bento-project-name">{proj.projectName}</p>
                          <p className="bento-project-status">{proj.status || "In Progress"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyItems: 'center', color: '#64748b', fontSize: 13 }}>
                     <Folder size={16} style={{ marginRight: 6 }}/> No projects assigned
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tile 2: Daily Attendance (Tall) */}
          <div className="bento-card bento-card--tall">
            <div className="bento-card-header" style={{ marginBottom: 16 }}>
              <h2 className="bento-card-title">
                <div className="bento-card-icon bento-card-icon--blue"><Building size={20} /></div>
                Daily Attendance
              </h2>
            </div>
            <div className="bento-card-body" style={{ alignItems: 'center' }}>
              <div className="bento-ring-wrap" style={{ '--ring-color': '#3b82f6' }}>
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle cx="50" cy="50" r="44" className="bento-ring-bg" />
                  <circle cx="50" cy="50" r="44" className="bento-ring-progress" style={{ strokeDasharray: 276.46, strokeDashoffset: 276.46 - (276.46 * dailyAttendanceRate) / 100 }} />
                </svg>
                <div className="bento-ring-content">
                  <span className="bento-ring-pct">{dailyAttendanceRate}%</span>
                  <span className="bento-ring-label">Rate</span>
                </div>
              </div>
              <div className="bento-mini-stats w-full">
                <div className="bento-mini-stat">
                  <div className="bento-mini-stat-val text-blue-600">{dailyAttendanceStats.present}</div>
                  <div className="bento-mini-stat-lbl">Present</div>
                </div>
                <div className="bento-mini-stat">
                  <div className="bento-mini-stat-val text-slate-500">{dailyAttendanceStats.absent}</div>
                  <div className="bento-mini-stat-lbl">Absent</div>
                </div>
              </div>
            </div>
          </div>

          {/* Tile 3: Recent Activity (Wide) */}
          <div className="bento-card bento-card--wide">
            <div className="bento-card-header">
              <h2 className="bento-card-title">
                <div className="bento-card-icon bento-card-icon--purple"><Activity size={20} /></div>
                Recent Activity
              </h2>
            </div>
            <div className="bento-card-body">
              {filteredAttendance && filteredAttendance.length > 0 ? (
                <div className="bento-activity-list">
                  {filteredAttendance.slice(0, 3).map((entry, index) => {
                    const isPresent = entry.status === "Present";
                    const entryDate = new Date(entry.date);
                    return (
                      <div key={index} className="bento-activity-item">
                        <div className="bento-activity-left">
                          <div className="bento-activity-date">
                            <span>{entryDate.toLocaleString('en-US', { month: 'short' })}</span>
                            <span>{entryDate.getDate()}</span>
                          </div>
                          <div className="bento-activity-info">
                            <h4>Logbook Entry</h4>
                            <p><Clock size={12} /> {entry.checkInTime || entry.time || "N/A"}</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-md text-xs font-bold ${isPresent ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{entry.status}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                  No recent activity
                </div>
              )}
            </div>
          </div>

          {/* Tile 4: Meeting Overview (Square) */}
          <div className="bento-card bento-card--square">
            <div className="bento-card-header" style={{ marginBottom: 12 }}>
              <h2 className="bento-card-title">
                <div className="bento-card-icon bento-card-icon--indigo"><Users size={20} /></div>
                Meetings
              </h2>
            </div>
            <div className="bento-card-body" style={{ justifyContent: 'center' }}>
               <div className="text-center mb-6">
                 <div className="text-4xl font-black text-indigo-600 mb-1">{meetingAttendanceRate}%</div>
                 <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Attendance Rate</div>
               </div>
               <div className="bento-mini-stats w-full">
                <div className="bento-mini-stat">
                  <div className="bento-mini-stat-val text-indigo-600">{attendanceStats.present}</div>
                  <div className="bento-mini-stat-lbl">Joined</div>
                </div>
                <div className="bento-mini-stat">
                  <div className="bento-mini-stat-val text-slate-500">{attendanceStats.absent}</div>
                  <div className="bento-mini-stat-lbl">Missed</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Tab Nav */}
        <div className="bento-deep-nav">
          <div className="bento-nav-glass">
             <button onClick={() => setActiveTab("daily")} className={`bento-nav-btn ${activeTab === "daily" ? "bento-nav-btn--active" : ""}`}>
               <Building size={16} /> Daily Logbook
             </button>
             <button onClick={() => setActiveTab("meeting")} className={`bento-nav-btn ${activeTab === "meeting" ? "bento-nav-btn--active" : ""}`}>
               <Users size={16} /> Meeting Attendance
             </button>
             <button onClick={() => setActiveTab("heatmap")} className={`bento-nav-btn ${activeTab === "heatmap" ? "bento-nav-btn--active" : ""}`}>
               <Activity size={16} /> Activity Heatmap
             </button>
          </div>
        </div>

        {/* Deep Dive Views */}
        <div className="bento-deep-content">
          <AnimatePresence mode="wait">
            
            {activeTab === "daily" && (
              <motion.div key="daily" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Daily Logbook History</h3>
                <p className="text-sm text-gray-500 mb-6">Your detailed daily attendance records</p>
                {filteredAttendance && filteredAttendance.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {filteredAttendance.map((entry, index) => {
                      const entryDate = new Date(entry.date);
                      return (
                        <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #0f172a, #334155)' }}>
                              <span className="text-[10px] font-bold uppercase">{entryDate.toLocaleString('en-US', { weekday: 'short' })}</span>
                              <span className="text-lg font-black leading-none">{entryDate.getDate()}</span>
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-900">{entryDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="flex items-center gap-1 text-xs font-semibold text-gray-500"><Clock size={12} /> {entry.checkInTime || entry.time || "N/A"}</span>
                              </div>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-lg text-xs font-bold ${entry.status === "Present" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {entry.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-500">No daily attendance records found</div>
                )}
              </motion.div>
            )}

            {activeTab === "meeting" && (
              <motion.div key="meeting" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                 <h3 className="text-2xl font-bold text-gray-900 mb-2">Meeting History</h3>
                 <p className="text-sm text-gray-500 mb-6">Your detailed meeting attendance records</p>
                 {filteredMeetingAttendance && filteredMeetingAttendance.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {filteredMeetingAttendance.map((group, groupIndex) => {
                      const isExpanded = expandedGroups[group.dateKey] || false;
                      const presentCount = group.meetings.filter((m) => m.status === "Present").length;
                      return (
                        <div key={group.dateKey} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                          <button onClick={() => toggleGroup(group.dateKey)} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition">
                            <div className="flex items-center gap-4 text-left">
                              <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
                                <span className="text-[10px] font-bold uppercase">{group.dayName}</span>
                                <span className="text-lg font-black leading-none">{group.dateNumber}</span>
                              </div>
                              <div>
                                <h4 className="font-bold text-gray-900">{group.formattedDate}</h4>
                                <p className="text-xs text-gray-500 font-medium">{group.meetings.length} meeting{group.meetings.length !== 1 ? "s" : ""}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-bold"><CheckCircle size={11} />{presentCount} Present</span>
                              <div className={`w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}><ChevronDown size={16} /></div>
                            </div>
                          </button>
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-gray-100 bg-gray-50 p-2 pb-4 px-4">
                                <div className="flex flex-col gap-2 mt-2">
                                  {group.meetings.map((entry, index) => {
                                    return (
                                      <div key={`${group.dateKey}-${index}`} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 shadow-sm">
                                        <div className="flex flex-col">
                                          <span className="font-bold text-gray-900 text-sm">{entry.meetingName || entry.type || "Meeting"}</span>
                                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 font-medium">
                                            <span className="flex items-center gap-1"><Clock size={11} />{entry.checkInTime || entry.time || "N/A"}</span>
                                          </div>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${entry.status === "Present" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{entry.status}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-500">No meeting attendance records found</div>
                )}
              </motion.div>
            )}

            {activeTab === "heatmap" && (
              <motion.div key="heatmap" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Activity Heatmap</h3>
                <p className="text-sm text-gray-500 mb-6">Visualize your performance over time</p>
                <div className="flex justify-center mb-6">
                  <div className="flex bg-gray-100 p-1 rounded-xl relative w-full max-w-sm">
                    <button onClick={() => setHeatmapView("logbook")} className={`flex-1 py-2 text-sm font-bold z-10 transition-colors ${heatmapView === "logbook" ? "text-white" : "text-gray-500"}`}>Logbook</button>
                    <button onClick={() => setHeatmapView("commits")} className={`flex-1 py-2 text-sm font-bold z-10 transition-colors ${heatmapView === "commits" ? "text-white" : "text-gray-500"}`}>Commits</button>
                    <div className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg shadow-sm transition-transform duration-300" style={{ left: 4, background: heatmapView === "logbook" ? "linear-gradient(135deg,#50b748,#2e7d32)" : "linear-gradient(135deg,#00b4eb,#0056a2)", transform: heatmapView === "logbook" ? "translateX(0)" : "translateX(100%)" }} />
                  </div>
                </div>
                
                {heatmapView === "logbook" ? (
                  <DailyRecordsHeatmap startDate={internData?.Training_StartDate} endDate={internData?.Training_EndDate} />
                ) : (
                  <CommitHeatmap startDate={internData?.Training_StartDate} endDate={internData?.Training_EndDate} internId={localStorage.getItem("internId")} />
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    );
  };

  return (
    <div className="bento-page-bg">
      <Navigation onLogout={handleLogout} />
      <AnnouncementPopup />
      {showFaceModal && (
        <FaceRegistrationModal
          isOpen={showFaceModal}
          onClose={closeFaceRegistration}
          onEnrollmentComplete={closeFaceRegistration}
        />
      )}
      {showNoProjectPopup && (
        <NoProjectNotification onDismiss={() => setShowNoProjectPopup(false)} />
      )}
      {showTour && (
        <OnboardingTour
          internData={internData}
          internId={localStorage.getItem("internId")}
          isNewIntern={isNewIntern}
        />
      )}
      {showCricketPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4 py-6">
          <div className="relative w-full max-w-md sm:max-w-lg rounded-2xl bg-white shadow-2xl">
            <button
              onClick={() => {
                localStorage.setItem("cricketFiestaDismissed", "2025-12-31");
                setShowCricketPopup(false);
              }}
              className="absolute right-3 top-3 text-gray-500 hover:text-gray-800"
              aria-label="Close cricket fiesta announcement"
            >
              ?
            </button>
            <div className="h-full rounded-2xl bg-white p-6 text-center">
              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-2">
                <img
                  src={cricketPosterUrl}
                  alt="Cricket Fiesta poster"
                  className="w-full max-h-[32rem] rounded-lg object-contain"
                />
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-500 mt-1">
                  Register before December 31st to secure your spot.
                </p>
              </div>
              <div className="mt-6 flex flex-col gap-3">
                <a
                  href={cricketRegistrationLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
                >
                  Open Registration Links
                </a>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem("cricketFiestaDismissed", "2025-12-31");
                    setShowCricketPopup(false);
                  }}
                  className="text-sm font-medium text-gray-600 underline"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={{ flex: 1, width: '100%', paddingBottom: 40, overflowY: 'auto' }}>
        {renderContent()}
      </div>
      <FeatureTipModal />
    </div>
  );
};
"""

# Find const renderContent = () => {
match1 = re.search(r"  const renderContent = \(\) => \{", content)
if not match1:
    print("Could not find start")
    exit(1)

# Find the end of the file which is export default Dashboard;
match2 = re.search(r"export default Dashboard;", content)
if not match2:
    print("Could not find end")
    exit(1)

# We want everything before match1, then new_content, then export default Dashboard;\n
before_content = content[:match1.start()]
final_content = before_content + new_content + "\nexport default Dashboard;\n"

with open(r"g:\github\TalentHub\frontend\src\pages\Dashboard.jsx", "w", encoding="utf-8") as f:
    f.write(final_content)

print("Success")
