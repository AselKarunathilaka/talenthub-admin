import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import AdminNavigation from '../components/AdminNavigation';
import { QrCode, CheckCircle, XCircle, Clock, AlertTriangle, Minimize } from "lucide-react";
import { FaArrowLeft, FaQrcode, FaCalendarDay, FaUsers, FaDownload, FaExpand, FaSpinner, FaCopy, FaComments, FaChevronDown, FaTimes, FaEye, FaEyeSlash } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { adminApi } from '../api/adminApi';
import { API_BASE_URL } from '../api/apiConfig';

const AdminQRManagement = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('daily'); // 'meeting' or 'daily'
  const [meetingName, setMeetingName] = useState('General Meeting');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [limitAttendance, setLimitAttendance] = useState(false);
  const [attendanceLimit, setAttendanceLimit] = useState(10);
  
  const [loading, setLoading] = useState(false);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const [sessionData, setSessionData] = useState(null);
  const pollingInterval = useRef(null);
  const rotationInterval = useRef(null);
  const [rotationCounter, setRotationCounter] = useState(0);

  // Security Verification States
  const [showPasswordPopup, setShowPasswordPopup] = useState(false);
  const [securityPassword, setSecurityPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);

  const handleGenerateClick = () => { const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}"); if (adminInfo?.user?.requireSecurityCheck === false) { handleGenerate(); return; }
    setShowPasswordPopup(true);
    setSecurityPassword("");
    setPasswordError("");
  };

  const handlePasswordVerify = async () => {
    setSettingsSaving(true);
    setPasswordError("");
    try {
      const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
      const actionString = activeTab === 'meeting' ? "meeting qr code generation" : "daily qr code generation";
      
      const res = await fetch(`${API_BASE_URL}/admin/attendance/verify-security`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminInfo.token && { Authorization: `Bearer ${adminInfo.token}` }),
        },
        body: JSON.stringify({ securityPin: securityPassword, action: actionString }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invalid password");
      
      setShowPasswordPopup(false);
      toast.success("Security verification successful", { id: "sec-verify" });
      handleGenerate();
    } catch (err) {
      setPasswordError(err.message || "Invalid password");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setQrCodeData(null);
      setSessionData(null);
      setRotationCounter(0);
      
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
    setRotationCounter(0);
  };

  const handleExpireQR = async () => {
    if (!qrCodeData?.sessionId) return;
    try {
      await adminApi.expireQrSession(qrCodeData.sessionId);
      toast.success("QR Session Ended");
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

  // Status Polling interval
  useEffect(() => {
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

  // QR Rotation interval (Security)
  useEffect(() => {
    if (qrCodeData?.sessionId && (!sessionData || sessionData.status === "Active")) {
      if (!rotationInterval.current) {
        rotationInterval.current = setInterval(async () => {
          try {
            const response = await adminApi.rotateQrSession(qrCodeData.sessionId);
            setQrCodeData(prev => ({
              ...prev,
              qrCode: response.qrCode,
            }));
            setRotationCounter(prev => prev + 1);
          } catch (err) {
            console.error("Failed to rotate QR", err);
          }
        }, 4000); // 4 Seconds Rotation
      }
    } else {
      if (rotationInterval.current) {
        clearInterval(rotationInterval.current);
        rotationInterval.current = null;
      }
    }

    return () => {
      if (rotationInterval.current) {
        clearInterval(rotationInterval.current);
        rotationInterval.current = null;
      }
    };
  }, [qrCodeData?.sessionId, sessionData?.status]);

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

  // Position generation logic based on counter
  const getDynamicPosition = () => {
    return { top: "0px", left: "0px" };
  };

  const dynamicPos = getDynamicPosition();

  return (
    <AdminNavigation>
      <div className="min-h-full relative font-sans text-slate-800 flex flex-col select-none">
        
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
              <div className="h-16 sm:h-20 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-3 sm:px-8 shrink-0 gap-2 sm:gap-4">
                <div className="flex items-center min-w-0 flex-1 h-full pt-1">
                  <h1 className="text-lg sm:text-3xl font-extrabold text-white tracking-tight truncate pb-1">
                    {activeTab === 'meeting' ? meetingName : 'Daily Attendance'}
                  </h1>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                  {status === "Active" && (
                    <button 
                      onClick={async () => { await handleExpireQR(); exitFullscreen(); }}
                      className="px-2.5 sm:px-5 py-1.5 sm:py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg sm:rounded-xl font-bold transition-all flex items-center gap-1.5 sm:gap-2 text-xs sm:text-base"
                    >
                      <XCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                      <span className="sm:hidden">End</span>
                      <span className="hidden sm:inline">End Session</span>
                    </button>
                  )}
                  <button 
                    onClick={exitFullscreen}
                    className="px-2.5 sm:px-4 py-1.5 sm:py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg sm:rounded-xl font-bold transition-colors flex items-center gap-2"
                    title="Exit Full Screen"
                  >
                    <Minimize className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
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
                  <div className="bg-white p-6 sm:p-10 rounded-[3rem] shadow-2xl relative w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] lg:w-[500px] lg:h-[500px] flex items-center justify-center overflow-hidden">
                    <div className="absolute transition-all duration-700 ease-in-out flex items-center justify-center w-full h-full" style={{ top: `calc(50% + ${dynamicPos.top})`, left: `calc(50% + ${dynamicPos.left})`, transform: 'translate(-50%, -50%)' }}>
                       <img src={qrCodeData.qrCode} alt="Generated QR" className="w-full h-full object-contain" style={{ transform: 'scale(1)' }} />
                    </div>
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

        <main className="relative flex-1 p-3 sm:p-6 sm:px-8 mx-auto max-w-[1400px] w-full flex flex-col gap-5 sm:gap-6 min-w-0">
          {/* Page header exactly matching AdminDashboard */}
          <div className="relative z-30 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 pt-2 mb-2">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="p-2.5 sm:p-3 md:p-3.5 bg-gradient-to-br from-[#000066] to-[#006600] shadow-md rounded-lg sm:rounded-xl md:rounded-2xl border border-[#006600]/20 flex-shrink-0"
              >
                <QrCode className="text-white h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
              </motion.div>
              <div className="flex flex-col justify-center">
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight"
                >
                  QR Management
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                  className="text-slate-500 mt-0.5 sm:mt-1 text-xs sm:text-sm md:text-base font-medium max-w-xl"
                >
                  Generate, present, and track live QR codes for sessions
                </motion.p>
              </div>
            </div>
          </div>

          {/* Main Layout matches Dashboard's card style */}
          <div className="flex flex-col lg:flex-row gap-5 sm:gap-6 items-stretch w-full z-10 relative mt-2">
            
            {/* LEFT: Configuration */}
            <div className="w-full lg:w-[420px] xl:w-[460px] shrink-0 bg-white p-5 sm:p-6 rounded-xl sm:rounded-[14px] md:rounded-2xl border border-slate-200/80 shadow-md flex flex-col transition-all duration-300">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <span className="text-sm sm:text-base font-extrabold text-slate-800 tracking-wide uppercase">Configuration</span>
              </div>
              
              <div className="flex flex-col flex-1 justify-between h-full space-y-6">
                {/* Switcher matching dropdown visually with real icons (not emojis) */}
                <div className="relative flex p-1.5 bg-slate-100/80 rounded-2xl mb-8">
                  <button
                    onClick={() => { setActiveTab("daily"); setQrCodeData(null); }}
                    className={`relative z-10 flex-1 flex items-center justify-center gap-2.5 py-3 text-sm font-extrabold transition-all duration-300 rounded-xl ${
                      activeTab === "daily" ? "text-white" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <FaCalendarDay className={activeTab === "daily" ? "text-white/90 text-lg" : "text-slate-400 text-lg"} />
                    Daily QR
                  </button>
                  <button
                    onClick={() => { setActiveTab("meeting"); setQrCodeData(null); }}
                    className={`relative z-10 flex-1 flex items-center justify-center gap-2.5 py-3 text-sm font-extrabold transition-all duration-300 rounded-xl ${
                      activeTab === "meeting" ? "text-white" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <FaUsers className={activeTab === "meeting" ? "text-white/90 text-lg" : "text-slate-400 text-lg"} />
                    Meeting QR
                  </button>
                  
                  <motion.div
                    className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl shadow-md z-0"
                    animate={{
                      background: activeTab === "daily"
                        ? "linear-gradient(135deg, #006600 0%, #2e7d32 100%)"
                        : "linear-gradient(135deg, #000066 0%, #0056a2 100%)",
                      left: activeTab === "daily" ? "6px" : "calc(50%)"
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                </div>

                <div className="relative flex flex-col flex-1">
                  <AnimatePresence mode="wait">
                    {activeTab === 'meeting' && (
                      <motion.div key="meeting-form" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="flex flex-col space-y-5 w-full">
                        
                        <div className="block relative z-20">
                          <span className="block text-xs sm:text-sm font-bold text-slate-700 mb-2">Meeting Name</span>
                          <button
                            type="button"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-[#000066] transition-all font-semibold text-slate-800 outline-none text-sm sm:text-base cursor-pointer flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              {meetingName === "General Meeting" ? <FaUsers className="text-[#000066]" /> : <FaComments className="text-[#000066]" />}
                              <span>{meetingName}</span>
                            </div>
                            <FaChevronDown className={`text-slate-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                          </button>
                          
                          <AnimatePresence>
                            {isDropdownOpen && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                                <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  transition={{ duration: 0.2 }}
                                  className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden"
                                >
                                  <button
                                    type="button"
                                    onClick={() => { setMeetingName("General Meeting"); setIsDropdownOpen(false); setQrCodeData(null); setSessionData(null); }}
                                    className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors"
                                  >
                                    <FaUsers className="text-[#000066] text-lg" />
                                    <span className="font-semibold text-slate-700">General Meeting</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setMeetingName("Discussion"); setIsDropdownOpen(false); setQrCodeData(null); setSessionData(null); }}
                                    className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors border-t border-slate-100"
                                  >
                                    <FaComments className="text-[#000066] text-lg" />
                                    <span className="font-semibold text-slate-700">Discussion</span>
                                  </button>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>

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
                              <div className="w-10 h-5.5 bg-slate-300 rounded-full peer-checked:bg-[#000066] transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:after:translate-x-4.5 peer-checked:after:border-white"></div>
                            </div>
                            <span className="font-bold text-xs sm:text-sm text-slate-700">Limit Attendance Count</span>
                          </label>

                          <AnimatePresence>
                            {limitAttendance && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <label className="block mt-4">
                                  <span className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Maximum Attendees</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={attendanceLimit}
                                    onChange={(e) => setAttendanceLimit(Number(e.target.value))}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#000066]/20 focus:border-[#000066] transition-all font-semibold text-slate-800 outline-none text-sm"
                                  />
                                </label>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className="p-3.5 bg-blue-50/80 text-[#000066] rounded-xl text-xs sm:text-sm font-semibold border border-blue-100/80 shadow-sm flex items-start gap-3 mt-auto">
                          <FaUsers className="w-5 h-5 flex-shrink-0 opacity-80" />
                          <p>QR automatically expires after 5 minutes.</p>
                        </div>
                      </motion.div>
                    )}
                    {activeTab === 'daily' && (
                      <motion.div key="daily-form" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="flex flex-col w-full h-full">
                        <div className="p-4 bg-[#006600]/5 text-[#006600] rounded-xl text-xs sm:text-sm font-semibold border border-[#006600]/10 leading-relaxed shadow-sm mt-2">
                          <div className="flex items-start gap-3">
                            <FaCalendarDay className="w-6 h-6 flex-shrink-0 opacity-80 mt-0.5" />
                            <p>Generates the standard daily check in code. Ensure interns are within the geofence perimeter to successfully scan.</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateClick}
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-xl sm:rounded-2xl transition-all duration-300 ease-out whitespace-nowrap bg-gradient-to-r from-[#000066] to-[#006600] text-white hover:opacity-95 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] shadow-md w-full py-3.5 sm:py-4 text-sm sm:text-base font-bold tracking-wide mt-auto disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-md disabled:active:scale-100"
                >
                  {loading ? (
                    <><FaSpinner className="animate-spin text-lg mr-2.5" /><span>Generating...</span></>
                  ) : (
                    <><FaQrcode className="text-lg mr-2.5" /><span>Generate QR Code</span></>
                  )}
                </button>

              </div>
            </div>

            {/* RIGHT: detail panel without double backgrounds */}
            <div className="flex-1 flex flex-col min-w-0 w-full bg-white p-5 sm:p-6 lg:p-8 rounded-xl sm:rounded-[14px] md:rounded-2xl border border-slate-200/80 shadow-md transition-all duration-300 relative">
              <AnimatePresence mode="wait">
                {!qrCodeData ? (
                  <motion.div key="empty" className="flex flex-col items-center justify-center text-center flex-1 h-full w-full" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}>
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-50 border border-slate-200 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner">
                      <FaQrcode className="w-8 h-8 sm:w-10 sm:h-10 text-slate-300" />
                    </div>
                    <h3 className="text-lg sm:text-xl md:text-2xl font-extrabold text-slate-800 mb-2">No QR Code</h3>
                    <p className="text-xs sm:text-sm md:text-base text-slate-500 max-w-xs leading-relaxed">Configure settings and generate a QR code to display it here.</p>
                  </motion.div>
                ) : (
                  <motion.div key="generated" className="flex flex-col flex-1 h-full w-full" initial={{ opacity: 0, scale: 0.98, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: -10 }} transition={{ duration: 0.4 }}>
                    <div className="flex flex-col items-center justify-center flex-1 gap-6 sm:gap-8 lg:gap-10">

                      {/* Side-by-side: QR left | Buttons right */}
                      <div className="flex flex-col lg:flex-row items-center justify-center gap-6 sm:gap-8 lg:gap-12 w-full max-w-[800px] mx-auto">

                        {/* Left – QR image with dynamic safe rotation */}
                        <div className="relative flex-shrink-0 group">
                          {status === "Active" && (
                            <div className="absolute -inset-1 bg-gradient-to-r from-[#000066] to-[#006600] rounded-[2.2rem] blur-md opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200 animate-pulse z-0"></div>
                          )}
                          <div className="bg-white p-3 sm:p-5 lg:p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-200/80 relative hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 z-10 w-[240px] h-[240px] sm:w-[300px] sm:h-[300px] lg:w-[340px] lg:h-[340px] overflow-hidden flex items-center justify-center">
                            {status !== "Active" && (
                              <div className="absolute inset-0 z-20 bg-slate-900/40 backdrop-blur-[4px] flex flex-col items-center justify-center rounded-[2rem]">
                                <div className="bg-white/20 p-3 rounded-full mb-3 backdrop-blur-md">
                                  <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-white drop-shadow-md" />
                                </div>
                                <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide drop-shadow-md">Session {status}</h2>
                              </div>
                            )}
                            {/* Inner container to hold QR and allow it to shift */}
                            <div className="absolute transition-all duration-700 ease-in-out flex items-center justify-center z-10 w-full h-full" style={{ top: `calc(50% + ${dynamicPos.top})`, left: `calc(50% + ${dynamicPos.left})`, transform: 'translate(-50%, -50%)' }}>
                              <img src={qrCodeData.qrCode} alt="Generated QR" className="w-full h-full object-contain mix-blend-multiply" style={{ transform: 'scale(1)' }} />
                            </div>
                          </div>
                        </div>

                        {/* Right – Actions list */}
                        <div className="flex flex-col gap-3 sm:gap-4 w-full lg:w-[220px]">
                          <button onClick={enterFullscreen} className="group relative flex items-center justify-center lg:justify-start gap-3 w-full p-3.5 sm:p-4 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 overflow-hidden">
                            <FaExpand className="text-lg relative z-10" />
                            <span className="relative z-10 text-sm sm:text-base">Present Fullscreen</span>
                          </button>

                          <button onClick={downloadQR} className="group relative flex items-center justify-center lg:justify-start gap-3 w-full p-3.5 sm:p-4 bg-gradient-to-r from-[#006600]/80 to-[#006600] text-white rounded-xl font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 overflow-hidden">
                            <FaDownload className="text-lg relative z-10" />
                            <span className="relative z-10 text-sm sm:text-base">Download PNG</span>
                          </button>

                          <button onClick={copyToClipboard} className="group relative flex items-center justify-center lg:justify-start gap-3 w-full p-3.5 sm:p-4 bg-white border border-slate-300 text-slate-700 rounded-xl font-semibold shadow-sm hover:shadow-md hover:border-slate-400 hover:bg-slate-50 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200">
                            <FaCopy className="text-slate-500 text-lg group-hover:text-slate-700 transition-colors" />
                            <span className="text-sm sm:text-base">Copy Token Data</span>
                          </button>

                          <button
                            onClick={status === "Active" ? handleDashboardEndSession : undefined}
                            disabled={status !== "Active"}
                            className={`group relative flex items-center justify-center lg:justify-start gap-3 w-full p-3.5 sm:p-4 rounded-xl font-semibold transition-all duration-200 active:scale-[0.98] ${
                              status === "Active" 
                                ? "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-500 hover:text-white hover:shadow-lg hover:shadow-rose-500/20 hover:-translate-y-0.5" 
                                : "bg-slate-50 text-slate-400 border border-slate-100 cursor-not-allowed"
                            }`}
                          >
                            <XCircle className={`text-lg transition-colors ${status === "Active" ? "group-hover:text-white" : ""}`} />
                            <span className="text-sm sm:text-base">End Session</span>
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
        
        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        `}</style>
      </div>
      
      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordPopup && (
          <>
            <div 
              className="fixed inset-0 z-[60] pointer-events-auto bg-slate-900/60 backdrop-blur-md transition-all duration-300" 
              onClick={() => setShowPasswordPopup(false)}
            />
            <div className="absolute inset-x-0 top-0 h-full z-[70] pointer-events-none">
              <div className="sticky top-[30vh] w-full flex justify-center px-4 pointer-events-none">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-full max-w-sm pointer-events-auto"
                >
                  <div className="flex justify-between items-start mb-3 sm:mb-4">
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-800">Security Check</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Enter password to generate {activeTab === 'meeting' ? 'meeting' : 'daily'} QR code
                      </p>
                    </div>
                    <button 
                      onClick={() => setShowPasswordPopup(false)}
                      className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
                    >
                      <FaTimes className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mb-3 sm:mb-5 relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={securityPassword}
                      onChange={(e) => setSecurityPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handlePasswordVerify()}
                      placeholder="Enter password..."
                      autoFocus
                      className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-[10px] text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                    >
                      {showPassword ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                    </button>
                    {passwordError && (
                      <p className="text-xs font-semibold text-red-500 mt-2">{passwordError}</p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowPasswordPopup(false)}
                      className="flex-1 px-2.5 py-1 sm:px-3 sm:py-1.5 sm:px-4 sm:py-2 bg-white border-2 border-slate-300 text-slate-700 rounded-xl text-xs sm:text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePasswordVerify}
                      disabled={settingsSaving || !securityPassword}
                      className="flex-1 flex items-center justify-center px-2.5 py-1 sm:px-3 sm:py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      {settingsSaving ? <FaSpinner className="w-4 h-4 animate-spin" /> : "Verify"}
                    </button>
                  </div>
                </motion.div>
              </div>
            </div>
          </>
        )}
      </AnimatePresence>
    </AdminNavigation>
  );
};

export default AdminQRManagement;
