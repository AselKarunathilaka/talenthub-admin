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
} from "react-icons/fi";

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
        const response = await fetch(
          `http://localhost:5000/api/leave-requests/pass/validate/${token}`,
        );
        const result = await response.json();

        if (!result.success || !result.data.valid) {
          setPassData(null);
          setIsUsed(result.data.reason === "Pass already used");
        } else {
          setPassData(result.data.leaveRequest);
        }
      } catch (error) {
        console.error("Error validating pass:", error);
        toast.error("Failed to validate pass");
      } finally {
        setLoading(false);
      }
    };

    validatePass();
    const interval = setInterval(validatePass, 5000);

    return () => clearInterval(interval);
  }, [token]);

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-4"></div>
          <p className="text-gray-600 text-lg">Validating leave pass...</p>
        </div>
      </div>
    );
  }

  const isValid = passData && !isExpired && !isUsed;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 py-8">
      <div className="max-w-md mx-auto">
        {/* Live Status Banner */}
        <div
          className={`mb-5 p-4 rounded-2xl shadow-lg transform transition-all duration-500 ${
            isValid
              ? "bg-gradient-to-r from-green-500 to-emerald-600 animate-pulse"
              : "bg-gradient-to-r from-red-500 to-rose-600"
          }`}
        >
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-4">
              {isValid ? <FiCheckCircle size={28} /> : <FiXCircle size={28} />}
              <div>
                <h3 className="font-bold text-lg">
                  {isValid ? "VALID PASS" : isUsed ? "PASS USED" : "EXPIRED"}
                </h3>
                <p className="text-sm opacity-90">
                  {isValid
                    ? "Active Leave Permission"
                    : isUsed
                      ? "Already marked as used"
                      : "No longer valid"}
                </p>
              </div>
            </div>
            {isValid && (
              <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
            )}
          </div>
        </div>

        {/* Live Clock — compact */}
        <div className="bg-white rounded-2xl shadow-md p-4 mb-5 border border-blue-100 relative overflow-hidden">
          <div className="relative z-10 flex items-center justify-between gap-2">
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2 text-gray-500">
                <FiClock
                  className="animate-spin flex-shrink-0"
                  style={{ animationDuration: "4s" }}
                  size={15}
                />
                <span className="text-xs font-medium whitespace-nowrap">
                  Current Time (Sri Lanka)
                </span>
              </div>
              {/* Live dot indicators */}
              <div className="flex flex-row gap-1 pl-0.5">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${isValid ? "bg-green-500" : "bg-red-400"}`}
                    style={{ animation: `bounce 1s infinite ${i * 0.15}s` }}
                  ></div>
                ))}
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <div
                className="font-bold text-gray-900 font-mono tracking-wider whitespace-nowrap"
                style={{ fontSize: "clamp(0.85rem, 3.5vw, 1.25rem)" }}
              >
                {formatTime(currentTime)}
              </div>
              <div className="text-xs text-gray-400 whitespace-nowrap">
                {currentTime.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Pass Details */}
        {passData && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-blue-100 mb-5">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.15) 10px, rgba(255,255,255,.15) 20px)`,
                  animation: "slide 20s linear infinite",
                }}
              ></div>
              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <p className="text-blue-200 text-xs font-medium uppercase tracking-widest mb-0.5">
                    Sri Lanka Telecom PLC
                  </p>
                  <h2 className="text-xl font-bold">Short Leave Pass</h2>
                </div>
                <div className="bg-white/20 rounded-xl px-3 py-1.5 text-center">
                  <p className="text-xs text-blue-100">Expires</p>
                  <p className="text-sm font-bold">4:30 PM</p>
                </div>
              </div>
            </div>

            {/* Primary Info — full-width highlight cards */}
            <div className="p-5 space-y-3">
              {/* Intern Identity Block */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-2">
                  Intern Identity
                </p>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <FiUser className="text-blue-500 flex-shrink-0" size={16} />
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-xs text-gray-500">Full Name</span>
                      <span className="font-semibold text-gray-900 text-sm">
                        {passData.internName}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <FiHash className="text-blue-500 flex-shrink-0" size={16} />
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-xs text-gray-500">Trainee ID</span>
                      <span className="font-semibold text-gray-900 text-sm font-mono">
                        {passData.traineeId || "N/A"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <FiFileText
                      className="text-blue-500 flex-shrink-0"
                      size={16}
                    />
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-xs text-gray-500">National ID</span>
                      <span className="font-semibold text-gray-900 text-sm font-mono">
                        {passData.nationalId}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Leave Details Block */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-2">
                  Leave Details
                </p>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <FiCalendar
                      className="text-indigo-500 flex-shrink-0"
                      size={16}
                    />
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-xs text-gray-500">Leave Date</span>
                      <span className="font-semibold text-gray-900 text-sm">
                        {formatDate(passData.leaveDate)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <FiClock
                      className="text-indigo-500 flex-shrink-0"
                      size={16}
                    />
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-xs text-gray-500">Time Slot</span>
                      <span className="font-semibold text-gray-900 text-sm">
                        {passData.leaveTime}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <FiTag
                      className="text-indigo-500 flex-shrink-0"
                      size={16}
                    />
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-xs text-gray-500">Purpose</span>
                      <span className="font-semibold text-gray-900 text-sm">
                        {passData.purpose}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reason Block */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <FiInfo
                    className="text-gray-500 flex-shrink-0 mt-0.5"
                    size={16}
                  />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Stated Reason
                    </p>
                    <p className="text-sm text-gray-800 font-medium leading-relaxed">
                      {passData.reason}
                    </p>
                  </div>
                </div>
              </div>

              {/* Approval Block */}
              {passData.reviewedBy && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <FiShield
                      className="text-green-600 flex-shrink-0 mt-0.5"
                      size={16}
                    />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">
                        Approved By
                      </p>
                      <p className="font-semibold text-gray-900 text-sm">
                        {passData.reviewedBy.name || passData.reviewedBy.email}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(passData.reviewedAt).toLocaleString("en-US", {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Expiry Notice */}
            <div className="bg-amber-50 px-5 py-3 border-t border-amber-100">
              <div className="flex items-center gap-2 text-sm">
                <FiAlertCircle
                  className="text-amber-600 flex-shrink-0"
                  size={15}
                />
                <span className="text-amber-800 text-xs">
                  This pass is valid only for today and expires at{" "}
                  <strong>4:30 PM</strong>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Security Notice */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-4">
          <div className="flex gap-3">
            <FiAlertCircle
              className="text-blue-600 flex-shrink-0 mt-0.5"
              size={18}
            />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">Security Notice</p>
              <p className="text-blue-800 text-xs leading-relaxed">
                This pass cannot be edited, reused, or shared. Screenshots are
                strictly invalid. Please present this pass to the gate staff for
                verification before leaving the premises.
              </p>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <button
          onClick={() => navigate("/leave-requests")}
          className="w-full bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 px-6 rounded-xl shadow-md border-2 border-gray-200 transition-all"
        >
          Back to Leave Requests
        </button>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes slide {
          0% { transform: translateX(0); }
          100% { transform: translateX(50px); }
        }
      `}</style>
    </div>
  );
};

export default ShortLeavePass;
