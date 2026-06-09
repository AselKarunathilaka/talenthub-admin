import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiUser,
  FiCalendar,
  FiFileText,
  FiAlertCircle,
  FiShield,
  FiHash,
  FiInfo,
  FiTag,
  FiArrowLeft
} from "react-icons/fi";
import { validateLeavePass } from "../api/leaveRequestApi";
import { motion, AnimatePresence } from "framer-motion";

const ShortLeavePass = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [passData, setPassData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isExpired, setIsExpired] = useState(false);
  const [isUsed, setIsUsed] = useState(false);
  const animationRef = useRef(0);

  // Live clock update
  useEffect(() => {
    const timer = setInterval(() => {
      const sriLankaTime = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Colombo",
      });
      const now = new Date(sriLankaTime);
      setCurrentTime(now);

      // Check if expired (after 4:30 PM)
      const hour = now.getHours();
      const minute = now.getMinutes();
      const isPastExpiry = hour > 16 || (hour === 16 && minute >= 30);
      setIsExpired(isPastExpiry);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Validate pass every 5 seconds
  useEffect(() => {
    const validatePass = async () => {
      try {
        const result = await validateLeavePass(token);

        if (!result.success || !result.data.valid) {
          setPassData(null);
          setIsUsed(result.data.reason === "Pass already used");
        } else {
          setPassData(result.data.leaveRequest);
        }
      } catch (error) {
        console.error("Error validating pass:", error);
        // Only toast on initial load error to prevent spamming
        if (loading) toast.error("Failed to validate pass");
      } finally {
        setLoading(false);
      }
    };

    validatePass();
    const interval = setInterval(validatePass, 5000);

    return () => clearInterval(interval);
  }, [token, loading]);

  // Animation loop for watermark
  useEffect(() => {
    const animate = () => {
      animationRef.current = (animationRef.current + 1) % 360;
      requestAnimationFrame(animate);
    };
    const animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-slate-200 border-t-[#0056a2] mb-4"></div>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">Validating pass...</p>
        </div>
      </div>
    );
  }

  const isValid = passData && !isExpired && !isUsed;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 py-8 relative overflow-hidden font-sans">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#00b4eb] opacity-[0.03] blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#0056a2] opacity-[0.03] blur-[120px] pointer-events-none"></div>

      <div className="max-w-[420px] mx-auto relative z-10">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate("/leave-requests")}
          className="mb-6 flex items-center gap-2 text-gray-500 hover:text-gray-900 font-bold text-sm bg-white/50 px-4 py-2 rounded-full backdrop-blur-md border border-white/50 shadow-sm"
        >
          <FiArrowLeft /> Back to Requests
        </motion.button>

        <AnimatePresence>
          {/* Live Status Banner */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-5 rounded-3xl shadow-xl border relative overflow-hidden ${
              isValid
                ? "bg-gradient-to-r from-[#15803d] to-[#50b748] border-green-400/50"
                : "bg-gradient-to-r from-rose-600 to-red-500 border-rose-400/50"
            }`}
          >
            {/* Shimmer effect for valid pass */}
            {isValid && (
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
                animate={{ x: ['-200%', '200%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
              />
            )}
            
            <div className="relative z-10 flex items-center justify-between text-white">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-sm">
                  {isValid ? <FiCheckCircle size={28} /> : <FiXCircle size={28} />}
                </div>
                <div>
                  <h3 className="font-extrabold text-xl tracking-tight leading-none mb-1">
                    {isValid ? "VALID PASS" : isUsed ? "PASS USED" : "EXPIRED"}
                  </h3>
                  <p className="text-xs font-medium text-white/80 uppercase tracking-widest">
                    {isValid ? "Active Permission" : isUsed ? "Already scanned" : "No longer valid"}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Live Clock Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-sm p-5 mb-6 border border-white"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <div className="bg-blue-50 p-1.5 rounded-lg">
                  <FiClock className="text-[#0056a2] animate-pulse" size={16} />
                </div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Live Status
                </span>
              </div>
              <div className="flex gap-1.5 pl-1">
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                    className={`w-2 h-2 rounded-full ${isValid ? "bg-[#50b748]" : "bg-rose-400"}`}
                  />
                ))}
              </div>
            </div>

            <div className="text-right bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
              <div className="font-black text-gray-900 font-mono tracking-tight text-2xl mb-0.5">
                {formatTime(currentTime)}
              </div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                {currentTime.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric"
                })}
              </div>
            </div>
          </div>
        </motion.div>

        {/* The Pass Card */}
        {passData && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/90 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-white overflow-hidden mb-6 relative group"
          >
            {/* Header */}
            <div className="bg-gradient-to-br from-[#0056a2] via-[#006bd6] to-[#00b4eb] p-6 text-white relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, #ffffff 10px, #ffffff 20px)`,
                }}
              ></div>
              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <p className="text-blue-200 text-[10px] font-black uppercase tracking-[0.25em] mb-1 opacity-90">
                    Sri Lanka Telecom PLC
                  </p>
                  <h2 className="text-2xl font-black tracking-tight leading-none shadow-sm">Short Leave Pass</h2>
                </div>
                <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl px-3 py-2 text-center shadow-inner">
                  <p className="text-[9px] font-black text-blue-100 uppercase tracking-widest mb-0.5">Expires</p>
                  <p className="text-sm font-black text-white">4:30 PM</p>
                </div>
              </div>
            </div>

            {/* Cutout details mimicking a ticket */}
            <div className="absolute top-[88px] -left-4 w-8 h-8 bg-[#f8fafc] rounded-full border-r border-white shadow-inner z-20"></div>
            <div className="absolute top-[88px] -right-4 w-8 h-8 bg-[#f8fafc] rounded-full border-l border-white shadow-inner z-20"></div>
            <div className="w-full border-b-[2px] border-dashed border-gray-200/60 relative z-10"></div>

            {/* Body */}
            <div className="p-6 space-y-5">
              
              {/* Intern Identity */}
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Intern Identity</p>
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100/50 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-xl shadow-sm"><FiUser className="text-[#0056a2]" size={16} /></div>
                    <div className="flex-1 flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-500">Name</span>
                      <span className="font-extrabold text-gray-900 text-sm">{passData.internName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-xl shadow-sm"><FiHash className="text-[#0056a2]" size={16} /></div>
                    <div className="flex-1 flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-500">Trainee ID</span>
                      <span className="font-bold font-mono text-gray-800 text-sm bg-slate-200/50 px-2 py-0.5 rounded-md">{passData.traineeId || "N/A"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-xl shadow-sm"><FiFileText className="text-[#0056a2]" size={16} /></div>
                    <div className="flex-1 flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-500">NIC</span>
                      <span className="font-bold font-mono text-gray-800 text-sm bg-slate-200/50 px-2 py-0.5 rounded-md">{passData.nationalId}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Leave Details */}
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Leave Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#00b4eb]/5 rounded-2xl p-4 border border-[#00b4eb]/10">
                    <FiCalendar className="text-[#00b4eb] mb-2" size={18} />
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Date</p>
                    <p className="font-extrabold text-gray-900 text-sm leading-tight">{formatDate(passData.leaveDate)}</p>
                  </div>
                  <div className="bg-[#0056a2]/5 rounded-2xl p-4 border border-[#0056a2]/10">
                    <FiClock className="text-[#0056a2] mb-2" size={18} />
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Time Slot</p>
                    <p className="font-extrabold text-gray-900 text-sm leading-tight">{passData.leaveTime}</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100/50 flex gap-3">
                <FiTag className="text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Purpose & Reason</p>
                  <p className="text-sm font-bold text-gray-900 mb-1">{passData.purpose}</p>
                  <p className="text-xs font-medium text-gray-600 leading-relaxed">{passData.reason}</p>
                </div>
              </div>

              {/* Approval Info */}
              {passData.reviewedBy && (
                <div className="bg-[#50b748]/5 rounded-2xl p-4 border border-[#50b748]/20 flex items-start gap-3">
                  <div className="bg-white p-2 rounded-xl shadow-sm shrink-0">
                    <FiShield className="text-[#50b748]" size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-[#50b748] uppercase tracking-widest mb-0.5">Authorized By</p>
                    <p className="font-extrabold text-gray-900 text-sm">{passData.reviewedBy.name || passData.reviewedBy.email}</p>
                    <p className="text-[10px] font-bold text-gray-500 uppercase mt-1 tracking-wider">
                      {new Date(passData.reviewedAt).toLocaleString("en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Expiry Footer */}
            <div className="bg-amber-50/80 px-6 py-4 border-t border-amber-100/50 flex items-center gap-3">
              <FiAlertCircle className="text-amber-600 shrink-0" size={18} />
              <p className="text-[11px] font-bold text-amber-800 leading-tight">
                This pass is valid ONLY for today and expires exactly at <span className="font-black text-amber-900 bg-amber-200/50 px-1 rounded">4:30 PM</span>.
              </p>
            </div>
          </motion.div>
        )}

        {/* Security Notice */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white/40 backdrop-blur-md rounded-2xl p-4 border border-white/50 shadow-sm flex gap-3 text-gray-500"
        >
          <FiInfo className="shrink-0 mt-0.5" size={16} />
          <p className="text-[10px] font-bold leading-relaxed tracking-wide">
            DO NOT take screenshots. Show this live pass to the gate staff. The animated indicators verify authenticity.
          </p>
        </motion.div>

      </div>
    </div>
  );
};

export default ShortLeavePass;