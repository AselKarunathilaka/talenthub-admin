import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import AdminNavigation from '../components/AdminNavigation';
import { QrCode, CheckCircle, XCircle, Clock, AlertTriangle, Minimize } from "lucide-react";
import { FaArrowLeft, FaQrcode, FaCalendarDay, FaUsers, FaDownload, FaExpand, FaSpinner, FaCopy } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { adminApi } from '../api/adminApi';
import { API_BASE_URL } from '../api/apiConfig';
import logo from '../assets/sltlogo.jpg';

const AdminQRManagement = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('meeting'); // 'meeting' or 'daily'
  const [meetingName, setMeetingName] = useState('General Meeting');
  const [limitAttendance, setLimitAttendance] = useState(false);
  const [attendanceLimit, setAttendanceLimit] = useState(10);
  
  const [loading, setLoading] = useState(false);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const [sessionData, setSessionData] = useState(null);
  const pollingInterval = useRef(null);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setQrCodeData(null);
      setSessionData(null);
      
      const limit = (activeTab === 'meeting' && limitAttendance) ? attendanceLimit : null;
      const projName = activeTab === 'meeting' ? meetingName : '';
      
      const response = await adminApi.generateQRCode(activeTab, projName, limit);
      setQrCodeData(response);
      toast.success(`${activeTab === 'meeting' ? 'Meeting' : 'Daily'} QR Code generated successfully`);
    } catch (error) {
      toast.error('Failed to generate QR Code');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setIsFullScreen(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch((err) => console.log(err));
    }
    setQrCodeData(null);
    setSessionData(null);
  };

  const handleExpireQR = async () => {
    if (!qrCodeData?.sessionId) return;
    try {
      await adminApi.expireQrSession(qrCodeData.sessionId);
    } catch (error) {
      toast.error('Failed to end QR session');
    }
  };

  const handleDashboardEndSession = async () => {
    await handleExpireQR();
    handleCreateNew();
  };

  const downloadQR = () => {
    if (!qrCodeData?.qrCode) return;
    const a = document.createElement('a');
    a.href = qrCodeData.qrCode;
    a.download = `${activeTab}_qr_code_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('QR Code downloaded');
  };

  const copyToClipboard = () => {
    if (!qrCodeData?.sessionId) return;
    navigator.clipboard.writeText(qrCodeData.sessionId);
    toast.success('QR Code content copied to clipboard');
  };

  const fetchSessionStatus = async () => {
    if (!qrCodeData?.sessionId) return;
    try {
      const data = await adminApi.getQrSessionStatus(qrCodeData.sessionId);
      setSessionData(data);
      if (data.status === "Ended" || data.status === "Expired") {
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
        }
        toast.success("QR Session Ended");
        handleCreateNew();
      }
    } catch (error) {
      // If session not found (404 after backend restart), the DB-based fallback won't work.
      // Show a non-blocking warning — session data is just unavailable.
      console.warn("Session polling error (backend may have restarted):", error.message);
    }
  };

  const enterFullscreen = () => {
    setIsFullScreen(true);
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch((err) => console.log(err));
    }
  };

  const exitFullscreen = () => {
    setIsFullScreen(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch((err) => console.log(err));
    }
  };

  useEffect(() => {
    // Always poll once a QR is generated (not just in full screen)
    if (qrCodeData?.sessionId) {
      fetchSessionStatus();
      if (!pollingInterval.current) {
        pollingInterval.current = setInterval(fetchSessionStatus, 2000);
      }
    } else {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
    }
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
    };
  }, [qrCodeData]);

  // Derived state for presentation
  const attendees = sessionData?.attendees ? [...sessionData.attendees].reverse() : [];
  const status = sessionData?.status || "Active";
  const totalCount = attendees.length;
  const hasLimit = typeof sessionData?.limit === 'number';
  const limit = sessionData?.limit;
  const isFull = hasLimit && totalCount >= limit;
  const remaining = hasLimit ? Math.max(0, limit - totalCount) : '∞';

  const getStatusColor = (s) => {
    if (s === "Active") return "text-emerald-600 bg-emerald-100 border-emerald-200";
    if (s === "Ended") return "text-rose-600 bg-rose-100 border-rose-200";
    if (s === "Expired") return "text-amber-600 bg-amber-100 border-amber-200";
    return "text-gray-600 bg-gray-100 border-gray-200";
  };

  return (
    <AdminNavigation>
      <div className="bg-slate-50 font-sans text-gray-800">
        
        {/* Full Screen Mode */}
        <AnimatePresence>
          {isFullScreen && qrCodeData && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="h-16 sm:h-20 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 sm:px-8 shrink-0">
                <div className="flex items-center gap-3 h-full pt-1">
                  <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight truncate max-w-[200px] sm:max-w-none pb-1">
                    {activeTab === 'meeting' ? meetingName : 'Daily Attendance'}
                  </h1>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                  {status === "Active" && (
                    <button 
                      onClick={async () => { await handleExpireQR(); exitFullscreen(); }}
                      className="px-3 sm:px-5 py-2 sm:py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl font-bold transition-all flex items-center gap-2 text-sm sm:text-base"
                    >
                      <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span>End Session</span>
                    </button>
                  )}
                  <button 
                    onClick={exitFullscreen}
                    className="px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-colors flex items-center gap-2"
                    title="Exit Full Screen"
                  >
                    <Minimize className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">Exit Fullscreen</span>
                  </button>
                </div>
              </div>

              {/* Main Split Content */}
              <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Left Side: QR Code */}
                <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 lg:border-r border-slate-700 relative">
                  
                  {status !== "Active" && (
                    <div className="absolute inset-0 z-10 bg-slate-900/70 backdrop-blur-sm flex flex-col items-center justify-center">
                      <AlertTriangle className="w-16 h-16 sm:w-24 sm:h-24 text-amber-500 mb-4 sm:mb-6" />
                      <h2 className="text-2xl sm:text-4xl font-bold text-white mb-2">Session {status}</h2>
                      <p className="text-lg sm:text-xl text-slate-300">This QR code is no longer accepting scans.</p>
                    </div>
                  )}

                  <div className="text-center mb-4 sm:mb-8 mt-4 sm:mt-0">
                    <p className="text-lg sm:text-2xl text-slate-300 font-medium">Please scan using your TalentHub App</p>
                  </div>
                  <div className="bg-white p-4 sm:p-8 rounded-3xl shadow-2xl max-w-full">
                    <img src={qrCodeData.qrCode} alt="Generated QR" className="w-[280px] h-[280px] sm:w-[350px] sm:h-[350px] lg:w-[450px] lg:h-[450px] object-contain" />
                  </div>
                </div>

                {/* Right Side: Real-time Panel */}
                <div className="w-full lg:w-[450px] xl:w-[500px] bg-slate-800 flex flex-col shrink-0 border-t lg:border-t-0 border-slate-700">
                  {/* Stats Bar */}
                  <div className={`p-4 sm:p-6 bg-slate-800 border-b border-slate-700 grid ${hasLimit ? 'grid-cols-2' : 'grid-cols-1'} gap-4 shrink-0`}>
                    <div className="bg-slate-700/50 rounded-2xl p-4 flex flex-col items-center justify-center border border-slate-600">
                      <span className="text-slate-400 text-xs sm:text-sm font-semibold uppercase tracking-wider mb-1 text-center">Total Scans</span>
                      <span className="text-3xl sm:text-4xl font-black text-white">{totalCount}</span>
                    </div>
                    {hasLimit && (
                      <div className="bg-slate-700/50 rounded-2xl p-4 flex flex-col items-center justify-center border border-slate-600">
                        <span className="text-slate-400 text-xs sm:text-sm font-semibold uppercase tracking-wider mb-1 text-center">Remaining Slots</span>
                        <span className={`text-3xl sm:text-4xl font-black ${isFull ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {remaining}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Attendees List */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                        <FaUsers className="text-slate-400" />
                        Live Attendees
                      </h3>
                      {status === "Active" && (
                        <span className="text-sm font-medium text-slate-400">
                          Auto-updating...
                        </span>
                      )}
                    </div>

                    <AnimatePresence>
                      {attendees.length === 0 ? (
                        <motion.div 
                          initial={{ opacity: 0 }} 
                          animate={{ opacity: 1 }} 
                          className="flex flex-col items-center justify-center h-40 text-slate-500"
                        >
                          <Clock className="w-10 h-10 mb-3 opacity-20" />
                          <p>Waiting for attendees to scan...</p>
                        </motion.div>
                      ) : (
                        attendees.map((attendee) => (
                          <motion.div
                            key={attendee.internId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                            className="bg-slate-700/40 border border-slate-600 rounded-2xl p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="relative w-12 h-12 flex-shrink-0">
                                  <div className="absolute inset-0 rounded-full bg-[#00b4eb]/20 text-[#00b4eb] flex items-center justify-center font-bold text-xl border-2 border-slate-600/50">
                                    {attendee.traineeName ? attendee.traineeName.charAt(0).toUpperCase() : '?'}
                                  </div>
                                  <img 
                                    src={`${API_BASE_URL}/interns/${attendee.internId}/profile-picture`} 
                                    alt={attendee.traineeName} 
                                    className="absolute inset-0 w-12 h-12 rounded-full object-cover border-2 border-slate-600/50"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-white font-bold text-base leading-tight truncate">{attendee.traineeName || 'Unknown'}</h4>
                                  <p className="text-[#00b4eb] text-sm font-mono font-bold mt-1 tracking-wide">{attendee.traineeId || '—'}</p>
                                </div>
                              </div>
                              {/* Scan time */}
                              <div className="flex flex-col items-end flex-shrink-0">
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Scanned</span>
                                <span className="text-sm text-slate-200 font-semibold tabular-nums">
                                  {new Date(attendee.timeMarked).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-slate-50 relative font-sans">
          {/* Ambient background */}
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <div className="absolute rounded-full blur-[80px] opacity-[0.06] w-[500px] h-[500px] bg-[#0056a2] -top-24 -right-24" />
            <div className="absolute rounded-full blur-[80px] opacity-[0.06] w-[400px] h-[400px] bg-[#50b748] -bottom-20 -left-20" />
          </div>

          <div className="relative z-10 pt-2">
            <main className="max-w-[1200px] mx-auto px-6 py-6 pb-6">
              {/* Page header */}
              <div className="mb-8">
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-3xl sm:text-4xl font-extrabold text-gray-900 flex items-center gap-3 tracking-tight"
                >
                  <div className="p-2.5 bg-[#00b4eb]/10 rounded-2xl">
                    <QrCode className="text-[#0056a2] h-8 w-8" />
                  </div>
                  QR Management
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05, duration: 0.2 }}
                  className="text-gray-500 mt-2 text-sm sm:text-base font-medium max-w-xl"
                >
                  Generate, present, and track live QR codes for sessions
                </motion.p>
              </div>



              {/* Two-column layout */}
              <div className="flex flex-col lg:flex-row gap-6 items-stretch w-full">
                {/* LEFT: Configuration */}
                <div className="w-full lg:w-[420px] shrink-0 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col transition-all">
                  <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                    <span className="text-sm font-extrabold text-slate-800 tracking-wide uppercase">Configuration</span>
                  </div>
                  <div className="p-5 flex flex-col flex-1 justify-between h-full">
                    
                    {/* Switcher */}
                    <div className="flex mb-5 bg-gray-50 p-1.5 rounded-xl border border-gray-200/60 w-full relative">
                      <button
                        onClick={() => { setActiveTab("meeting"); setQrCodeData(null); }}
                        className={`relative z-10 flex-1 py-2.5 px-3 text-sm font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 `+`${
                          activeTab === "meeting" ? "text-white" : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        <FaUsers className={activeTab === "meeting" ? "text-white/90 text-lg" : "text-lg"} />
                        <span>Meeting</span>
                      </button>
                      <button
                        onClick={() => { setActiveTab("daily"); setQrCodeData(null); }}
                        className={`relative z-10 flex-1 py-2.5 px-3 text-sm font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${
                          activeTab === "daily" ? "text-white" : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        <FaCalendarDay className={activeTab === "daily" ? "text-white/90 text-lg" : "text-lg"} />
                        <span>Daily</span>
                      </button>

                      <div
                        className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-lg transition-all duration-300 ease-out shadow-sm"
                        style={{
                          background:
                            activeTab === "meeting"
                              ? "linear-gradient(135deg, #00b4eb 0%, #0056a2 100%)"
                              : "linear-gradient(135deg, #50b748 0%, #2e7d32 100%)",
                          left: activeTab === "meeting" ? "6px" : "calc(50%)",
                        }}
                      />
                    </div>

                    <div className="relative flex flex-col mb-6">
                      <AnimatePresence mode="wait">
                        {activeTab === 'meeting' && (
                          <motion.div key="meeting-form" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="flex flex-col space-y-5 w-full">
                            
                            <label className="block">
                              <span className="block text-xs font-bold text-gray-700 mb-1.5">Meeting Name</span>
                              <select
                                value={meetingName}
                                onChange={(e) => setMeetingName(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-[#00b4eb] transition-all font-semibold text-gray-800 outline-none text-sm cursor-pointer appearance-none"
                              >
                                <option value="General Meeting">General Meeting</option>
                                <option value="Discussion">Discussion</option>
                              </select>
                            </label>

                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                              <label className="flex items-center space-x-3 cursor-pointer mb-1">
                                <div className="relative flex items-center">
                                  <input 
                                    type="checkbox" 
                                    className="peer sr-only"
                                    checked={limitAttendance}
                                    onChange={(e) => {
                                      setLimitAttendance(e.target.checked);
                                      if (!e.target.checked) setAttendanceLimit(10);
                                      setQrCodeData(null); 
                                      setSessionData(null);
                                    }}
                                  />
                                  <div className="w-9 h-5 bg-slate-300 rounded-full peer-checked:bg-[#00b4eb] transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:border-white"></div>
                                </div>
                                <span className="font-bold text-xs text-gray-700">Limit Attendance Count</span>
                              </label>

                              <AnimatePresence>
                                {limitAttendance && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <label className="block mt-2">
                                      <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Maximum Attendees</span>
                                      <input
                                        type="number"
                                        min="1"
                                        value={attendanceLimit}
                                        onChange={(e) => setAttendanceLimit(Number(e.target.value))}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-[#00b4eb] transition-all font-semibold text-gray-800 outline-none"
                                      />
                                    </label>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            <div className="p-3 bg-blue-50/60 text-[#0056a2] rounded-xl text-xs font-semibold border border-blue-100/60 shadow-sm flex items-start gap-2.5 mt-auto">
                              <FaUsers className="w-4.5 h-4.5 flex-shrink-0 mt-0.5 opacity-80" />
                              <p>QR automatically expires after 5 minutes.</p>
                            </div>
                          </motion.div>
                        )}
                        {activeTab === 'daily' && (
                          <motion.div key="daily-form" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="flex flex-col justify-center w-full h-full">
                            <div className="p-4 bg-cyan-50/60 text-cyan-800 rounded-xl text-xs font-semibold border border-cyan-100/60 leading-relaxed shadow-sm">
                              <div className="flex items-start gap-3">
                                <FaCalendarDay className="w-6 h-6 flex-shrink-0 opacity-80" />
                                <p className="text-xs">Generates the standard daily check-in code. Ensure interns are within 2km of SLT premises to successfully scan.</p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={loading}
                      className="inline-flex items-center justify-center rounded-2xl transition-all duration-300 ease-out whitespace-nowrap bg-gradient-to-br from-[#00b4eb] to-[#0056a2] text-white hover:-translate-y-1 hover:shadow-xl hover:shadow-[#00b4eb]/30 active:translate-y-0 shadow-md w-full py-4 text-base sm:text-lg font-extrabold tracking-wide mt-auto disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-md"
                    >
                      {loading ? (
                        <><FaSpinner className="animate-spin text-xl mr-2.5" /><span>Generating...</span></>
                      ) : (
                        <><FaQrcode className="text-xl mr-2.5" /><span>Generate QR Code</span></>
                      )}
                    </button>

                  </div>
                </div>

                {/* RIGHT: detail panel */}
                <div className="flex-1 flex flex-col min-w-0 w-full">
                  <AnimatePresence mode="wait">
                    {!qrCodeData ? (
                      <motion.div key="empty" className="bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center p-10 text-center flex-1 h-full w-full" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}>
                        <div className="w-24 h-24 bg-slate-50 border border-slate-200 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner">
                          <FaQrcode className="w-10 h-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-extrabold text-slate-800 mb-2">No QR Code</h3>
                        <p className="text-sm text-slate-500 max-w-xs leading-relaxed">Configure settings and generate a QR code to display it here.</p>
                      </motion.div>
                    ) : (
                      <motion.div key="generated" className="bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col flex-1 h-full w-full overflow-hidden" initial={{ opacity: 0, scale: 0.98, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: -10 }} transition={{ duration: 0.4 }}>
                        <div className="flex flex-col items-center justify-center flex-1 p-6 sm:p-8 gap-5">

                          {/* Side-by-side: QR left | Buttons right */}
                          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 w-full max-w-[600px] mx-auto">

                            {/* Left – QR image */}
                            <div className="relative flex-shrink-0 group">
                              {status === "Active" && (
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#00b4eb] to-[#0056a2] rounded-[2.2rem] blur-md opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
                              )}
                              <div className="bg-white p-4 sm:p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/60 relative hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 z-10">
                              {status !== "Active" && (
                                <div className="absolute inset-0 z-10 bg-slate-900/40 backdrop-blur-[4px] flex flex-col items-center justify-center rounded-[2rem]">
                                  <div className="bg-white/20 p-3 rounded-full mb-3 backdrop-blur-md">
                                    <AlertTriangle className="w-8 h-8 text-white drop-shadow-md" />
                                  </div>
                                  <h2 className="text-base font-extrabold text-white tracking-wide drop-shadow-md">Session {status}</h2>
                                </div>
                              )}
                              <div className="rounded-2xl overflow-hidden bg-slate-50/50 border border-slate-100/50 p-2">
                                <img src={qrCodeData.qrCode} alt="Generated QR" className="w-52 h-52 sm:w-64 sm:h-64 object-contain mix-blend-multiply" />
                              </div>
                              </div>
                            </div>

                            {/* Right – Actions list */}
                            <div className="flex flex-col gap-3.5 w-full sm:w-[200px]">
                              <button onClick={enterFullscreen} className="group relative flex items-center justify-center sm:justify-start gap-3 w-full p-3.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl font-semibold shadow-md hover:shadow-xl hover:shadow-indigo-500/20 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
                                <FaExpand className="text-lg relative z-10" />
                                <span className="relative z-10 text-sm">Present</span>
                              </button>

                              <button onClick={downloadQR} className="group relative flex items-center justify-center sm:justify-start gap-3 w-full p-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold shadow-md hover:shadow-xl hover:shadow-emerald-500/20 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
                                <FaDownload className="text-lg relative z-10" />
                                <span className="relative z-10 text-sm">Download</span>
                              </button>

                              <button onClick={copyToClipboard} className="group relative flex items-center justify-center sm:justify-start gap-3 w-full p-3.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold shadow-sm hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
                                <FaCopy className="text-slate-400 text-lg group-hover:text-slate-600 transition-colors" />
                                <span className="text-sm">Copy Code</span>
                              </button>

                              <button
                                onClick={status === "Active" ? handleDashboardEndSession : undefined}
                                disabled={status !== "Active"}
                                className={`group relative flex items-center justify-center sm:justify-start gap-3 w-full p-3.5 rounded-xl font-semibold transition-all duration-200 ${
                                  status === "Active" 
                                    ? "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-500 hover:text-white hover:shadow-lg hover:shadow-rose-500/20 hover:-translate-y-0.5" 
                                    : "bg-slate-50 text-slate-400 border border-slate-100 cursor-not-allowed"
                                }`}
                              >
                                <XCircle className={`text-lg transition-colors ${status === "Active" ? "group-hover:text-white" : ""}`} />
                                <span className="text-sm">End Session</span>
                              </button>
                            </div>

                          </div>

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </main>
          </div>
          
          <style>{`
            .custom-scrollbar::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          `}</style>
        </div>
      </div>
    </AdminNavigation>
  );
};

export default AdminQRManagement;
