import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  Building2,
  Shield,
  ArrowRight,
  Sparkles,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  UserPlus,
  Send,
  HelpCircle,
  X,
  Search,
  BookOpen,
  ScanLine,
  Activity,
  Award,
  ChevronDown,
} from "lucide-react";
import SeasonalBackground from "../seasonal-backgrounds/SeasonalBackground";
import { API_BASE_URL } from "../api/apiConfig";
import sltLogo from "../assets/sltlogoOnly.png";
import talentHubLogo from "../assets/talenthubwhitebg.jpeg";
import transzentLogo from "../assets/transzent.jpeg";
import WhatsAppSupportButton from "../components/WhatsAppSupportButton";
import UniversityLogosShowcase, {
  SRI_LANKAN_UNIVERSITIES,
} from "../components/UniversityLogosShowcase";

const supervisorFeatures = [
  {
    icon: <BookOpen className="h-4 w-4" />,
    title: "Logbook Auditing",
    description: "Monitor daily student progress, tasks & challenges",
    color: "#48cef7",
  },
  {
    icon: <ScanLine className="h-4 w-4" />,
    title: "Live Attendance",
    description: "Inspect check-in punctuality, Face ID & QR records",
    color: "#68de5f",
  },
  {
    icon: <Activity className="h-4 w-4" />,
    title: "Quality & Working Rate",
    description: "Real-time evaluation scores & consistency grades",
    color: "#facc15",
  },
  {
    icon: <Award className="h-4 w-4" />,
    title: "Academic Guidance",
    description: "Provide direct feedback and supervisor ratings",
    color: "#ec4899",
  },
];

const UniversityLogin = () => {
  const navigate = useNavigate();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusInfo, setStatusInfo] = useState(null);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [submittingReg, setSubmittingReg] = useState(false);
  const [seasonActive, setSeasonActive] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    universityName: "",
    supervisorTitle: "Mr.",
    supervisorName: "",
    email: "",
    department: "",
    designation: "University Internship Coordinator",
    contactNumber: "",
    notes: "",
  });

  const handleSeasonResolved = useCallback((seasonKey) => {
    setSeasonActive(!!seasonKey);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isImmersive) {
        setIsImmersive(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isImmersive]);

  // Check if university supervisor is already logged in
  useEffect(() => {
    const token = localStorage.getItem("universityToken");
    if (token) {
      navigate("/university/dashboard");
    }
  }, [navigate]);

  // Google Login Handler
  const handleGoogleLogin = async (tokenResponse) => {
    setGoogleLoading(true);
    setError(null);
    setStatusInfo(null);

    try {
      const response = await fetch(`${API_BASE_URL}/university/google-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: tokenResponse.access_token }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        // Success
        localStorage.setItem("universityToken", data.token);
        localStorage.setItem("universityUser", JSON.stringify(data.user));
        navigate("/university/dashboard");
      } else if (response.status === 404) {
        // Not registered
        setError(
          data.message ||
            "This email is not registered as a university supervisor. Please register your university access request."
        );
        // Pre-fill form
        if (data.email) {
          setFormData((prev) => ({
            ...prev,
            email: data.email,
            supervisorName: data.name || prev.supervisorName,
          }));
        }
        setIsRegisterOpen(true);
      } else if (response.status === 403) {
        // Registered but pending, rejected, or revoked
        setStatusInfo({
          status: data.status,
          message: data.message,
          rejectionReason: data.rejectionReason,
          supervisor: data.supervisor,
        });
      } else {
        setError(data.message || "University login failed. Please try again.");
      }
    } catch (err) {
      console.error("University login error:", err);
      setError("Network or authentication error. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: handleGoogleLogin,
    onError: () => setError("Google sign-in was cancelled or failed."),
    flow: "implicit",
  });

  // Submit Registration Request
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!formData.universityName || !formData.supervisorName || !formData.email) {
      setError("Please fill all required fields.");
      return;
    }

    // Combine title and name before sending
    const finalName = formData.supervisorTitle
      ? `${formData.supervisorTitle} ${formData.supervisorName}`.trim()
      : formData.supervisorName;

    const payload = {
      ...formData,
      supervisorName: finalName,
    };

    setSubmittingReg(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/university/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setRegisterSuccess(true);
        setStatusInfo({
          status: "pending",
          message: data.message,
          supervisor: {
            name: formData.supervisorName,
            universityName: formData.universityName,
            email: formData.email,
          },
        });
        setTimeout(() => {
          setIsRegisterOpen(false);
          setRegisterSuccess(false);
        }, 2000);
      } else {
        setError(data.message || "Registration failed. Please try again.");
      }
    } catch (err) {
      console.error("Registration error:", err);
      setError("Failed to connect to server. Please try again.");
    } finally {
      setSubmittingReg(false);
    }
  };

  return (
    <div
      className="min-h-screen lg:h-screen text-white relative overflow-x-hidden overflow-y-auto lg:overflow-hidden flex flex-col justify-center select-none cursor-default"
      style={{
        background: seasonActive
          ? "#02020a"
          : "linear-gradient(135deg, #000066 0%, #006600 100%)",
      }}
    >
      {/* Immersive View Toggle Button */}
      {seasonActive && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed top-4 right-4 z-40"
        >
          <button
            onClick={() => setIsImmersive(!isImmersive)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold text-white/90 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md shadow-lg transition-all hover:scale-105"
          >
            <span>Immersive</span>
            {isImmersive ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </motion.div>
      )}

      {/* Glow accents */}
      <div
        className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full pointer-events-none opacity-20"
        style={{
          background:
            "radial-gradient(circle, rgba(0,180,235,0.4) 0%, transparent 70%)",
        }}
      />
      <div
        className="fixed bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full pointer-events-none opacity-20"
        style={{
          background:
            "radial-gradient(circle, rgba(80,183,72,0.4) 0%, transparent 70%)",
        }}
      />

      {/* ─── Main Content ─── */}
      <div
        className={`relative z-10 min-h-screen lg:h-screen flex flex-col lg:flex-row items-center justify-center transition-all duration-500 ${
          isImmersive
            ? "opacity-0 scale-95 pointer-events-none invisible"
            : "opacity-100 scale-100 visible"
        }`}
      >
        {/* ─── LEFT PANEL: Login & Registration ─── */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          className="w-full lg:w-[48%] xl:w-[50%] flex items-center justify-center min-h-screen lg:min-h-0 py-4 px-4 sm:p-6 lg:py-4 xl:py-6 lg:px-8"
        >
          <div className="w-full max-w-sm lg:max-w-md py-2">
            {/* Brand header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex items-center gap-4 sm:gap-5 mb-5 sm:mb-7"
            >
              {/* Logos Group */}
              <div className="flex items-center gap-2.5">
                <div className="relative bg-white p-1.5 rounded-[0.8rem] shadow-lg flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 border border-white/10 shrink-0">
                  <img
                    src={sltLogo}
                    alt="SLT Mobitel Logo"
                    className="w-full h-full object-contain drop-shadow-sm"
                  />
                </div>
                <div className="relative bg-white p-1.5 rounded-[0.8rem] shadow-lg flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 border border-white/10 shrink-0">
                  <img
                    src={talentHubLogo}
                    alt="TalentHub Logo"
                    className="w-full h-full object-contain drop-shadow-sm rounded"
                  />
                </div>
              </div>

              <div className="w-[1px] h-10 bg-white/20 hidden sm:block mx-1"></div>

              {/* Text Group */}
              <div className="text-left flex flex-col justify-center">
                <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white leading-none drop-shadow-sm mb-1">
                  TalentHub
                </h1>
                <p className="text-[10px] sm:text-xs text-white/70 font-bold tracking-widest uppercase opacity-90">
                  University Access Portal
                </p>
              </div>
            </motion.div>

            {/* ─── University Login Card ─── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="rounded-2xl overflow-hidden backdrop-blur-xl relative flex flex-col justify-center py-4 px-4 sm:px-6"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow:
                  "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
            >
              {/* Accent bar */}
              <div
                className="absolute top-0 left-0 right-0 h-1.5"
                style={{
                  background:
                    "linear-gradient(90deg, #50b748, #00b4eb, #f59e0b)",
                }}
              />

              {/* Status Alert Banners */}
              {statusInfo && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`mb-3 p-3.5 rounded-xl border flex items-start gap-3 ${
                    statusInfo.status === "pending"
                      ? "bg-amber-500/15 border-amber-400/30 text-amber-200"
                      : statusInfo.status === "rejected"
                      ? "bg-rose-500/15 border-rose-400/30 text-rose-200"
                      : "bg-slate-500/15 border-slate-400/30 text-slate-200"
                  }`}
                >
                  {statusInfo.status === "pending" && (
                    <Clock className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5 animate-spin" />
                  )}
                  {statusInfo.status === "rejected" && (
                    <XCircle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  )}
                  {statusInfo.status === "revoked" && (
                    <AlertCircle className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs leading-relaxed">
                    <p className="font-bold text-white mb-0.5">
                      {statusInfo.status === "pending"
                        ? "Registration Request Pending"
                        : statusInfo.status === "rejected"
                        ? "Request Not Approved"
                        : "Access Revoked"}
                    </p>
                    <p>{statusInfo.message}</p>
                    {statusInfo.rejectionReason && (
                      <p className="mt-1 font-semibold text-rose-300">
                        Reason: {statusInfo.rejectionReason}
                      </p>
                    )}
                    {statusInfo.status === "rejected" && (
                      <button
                        onClick={() => setIsRegisterOpen(true)}
                        className="mt-2 text-[11px] font-bold text-white bg-rose-500/40 hover:bg-rose-500/60 px-2.5 py-1 rounded-lg border border-rose-300/40"
                      >
                        Re-Submit Application
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Error Message */}
              {error && !statusInfo && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-3 p-3 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-200 text-xs flex items-start gap-2.5"
                >
                  <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{error}</span>
                  </div>
                </motion.div>
              )}

              {/* Card Title */}
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#50b748]/20 to-[#00b4eb]/20 border border-white/10 mb-2 shadow-inner">
                  <GraduationCap className="h-6 w-6 text-[#50b748]" />
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                  University Supervisor
                </h2>
                <p className="text-white/60 text-xs mt-1">
                  Access student logbooks, attendance & academic evaluations
                </p>
              </div>

              {/* Google Sign In Button */}
              <div className="my-2">
                <button
                  type="button"
                  onClick={() => googleLogin()}
                  disabled={googleLoading}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer disabled:opacity-50"
                  style={{
                    background: "#ffffff",
                    color: "#2d3748",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow =
                      "0 6px 20px rgba(0,0,0,0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 14px rgba(0,0,0,0.2)";
                  }}
                >
                  {googleLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <span className="tracking-wider">VERIFYING SUPERVISOR...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                      <span className="tracking-wider">SIGN IN WITH GOOGLE</span>
                    </>
                  )}
                </button>
              </div>

              {/* Registration Prompt */}
              <div className="mt-4 text-center">
                <p className="text-white/60 text-xs">
                  Not a registered university supervisor?{" "}
                  <button
                    onClick={() => setIsRegisterOpen(true)}
                    className="text-[#00b4eb] hover:text-[#50b748] font-bold underline transition-colors"
                  >
                    Register for access
                  </button>
                </p>
              </div>
              {/* Divider */}
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] sm:text-xs text-white/30 font-medium uppercase tracking-wider">
                  or
                </span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Login as Intern */}
              <button
                onClick={() => navigate("/")}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-3 sm:py-3.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 cursor-pointer group mb-2"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(80,183,72,0.15)";
                  e.currentTarget.style.borderColor = "rgba(80,183,72,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                }}
              >
                <GraduationCap className="h-4 w-4 text-[#50b748] group-hover:text-[#50b748]" />
                <span className="text-white/70 group-hover:text-white">
                  Login as Intern
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-white/30 group-hover:text-white/60 ml-auto transition-transform group-hover:translate-x-0.5" />
              </button>

              {/* Login as Admin */}
              <button
                onClick={() => navigate("/admin-login")}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-3 sm:py-3.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 cursor-pointer group"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(0,86,162,0.15)";
                  e.currentTarget.style.borderColor = "rgba(0,86,162,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                }}
              >
                <Shield className="h-4 w-4 text-[#00b4eb] group-hover:text-[#00b4eb]" />
                <span className="text-white/70 group-hover:text-white">
                  Login as Admin
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-white/30 group-hover:text-white/60 ml-auto transition-transform group-hover:translate-x-0.5" />
              </button>
            </motion.div>

            {/* Support section */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.45 }}
              className="mt-3 rounded-xl border border-[#25D366]/20 bg-[#25D366]/10 p-2.5 text-center"
            >
              <p className="mb-2 text-xs font-medium text-white/70">
                Need assistance with university verification?
              </p>
              <WhatsAppSupportButton className="w-full" variant="solid" />
            </motion.div>
            {/* Footer Copyright */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="mt-4 text-center"
            >
              <p className="text-[10px] sm:text-xs text-white/40 font-medium tracking-wide">
                &copy; 2026 SLT Mobitel. All rights reserved.
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* ─── RIGHT PANEL: Sri Lankan Universities Showcase ─── */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="hidden lg:flex lg:w-[52%] xl:w-[50%] items-center justify-center p-4 xl:p-6"
        >
          <div
            className="relative z-10 w-full max-w-xl rounded-[2rem] p-5 xl:p-6 flex flex-col justify-between"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(24px)",
            }}
          >
            {/* Header */}
            <div className="text-center mb-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-[#50b748]" />
                <span className="text-[11px] font-semibold text-white/80 tracking-wider uppercase">
                  Higher Education Collaboration Network
                </span>
              </div>
              <h2 className="text-xl xl:text-2xl font-extrabold text-white leading-tight">
                Sri Lankan University Partners
              </h2>
              <p className="text-white/50 text-xs max-w-md mx-auto mt-1 leading-relaxed">
                Connect and supervise your students undergoing industrial internship
                training at SLT
              </p>
            </div>

            {/* University Text List Showcase */}
            <div className="my-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {[...SRI_LANKAN_UNIVERSITIES]
                .sort((a, b) => {
                  const getRank = (u) => {
                    if (u.id === "nsbm" || u.shortName === "NSBM") return 1;
                    if (u.type.includes("State University") || u.type.includes("Defence")) return 2;
                    return 3;
                  };

                  // Absolute primary sort: push long names (>30 chars) to the absolute bottom
                  const isLongA = a.name.length > 30;
                  const isLongB = b.name.length > 30;
                  if (isLongA !== isLongB) return isLongA ? 1 : -1;

                  // Secondary sort: categorize
                  const rankA = getRank(a);
                  const rankB = getRank(b);
                  if (rankA !== rankB) return rankA - rankB;

                  // Tertiary sort: exact length
                  return a.name.length - b.name.length;
                })
                .map((uni) => (
                  <div 
                    key={uni.id}
                    className="group p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-start gap-2.5 h-full"
                  >
                    <Building2 className="h-4 w-4 text-[#50b748] shrink-0 mt-0.5" />
                    <span className="text-xs text-white/90 group-hover:text-[#00b4eb] font-medium leading-tight transition-colors">
                      {uni.name}
                    </span>
                  </div>
              ))}
            </div>

            {/* Feature Badges */}
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/10">
              {supervisorFeatures.map((feat, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                >
                  <div
                    className="p-1.5 rounded-lg flex-shrink-0"
                    style={{
                      background: `${feat.color}20`,
                      color: feat.color,
                    }}
                  >
                    {feat.icon}
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="text-[11px] font-bold text-white truncate">
                      {feat.title}
                    </h4>
                    <p className="text-[9px] text-white/40 truncate">
                      {feat.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ─── Registration Modal ─── */}
      <AnimatePresence>
        {isRegisterOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl text-slate-800 overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsRegisterOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-[#50b748]/10 text-[#50b748] border border-[#50b748]/20">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Register University Access
                  </h3>
                  <p className="text-xs text-slate-500">
                    Submit your official details for administrative approval
                  </p>
                </div>
              </div>

              {registerSuccess ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3 animate-bounce" />
                  <h4 className="text-base font-bold text-slate-900">
                    Request Submitted Successfully!
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Your request is now pending admin approval. You will be
                    notified by email once your access is activated.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  {/* University Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      University / Institute Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={formData.universityName || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, universityName: e.target.value })
                        }
                        className="w-full px-3 pr-8 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-[#00b4eb] focus:ring-2 focus:ring-[#00b4eb]/20 transition-all cursor-pointer appearance-none"
                        required
                      >
                        <option value="" disabled>
                          Select University
                        </option>
                        {SRI_LANKAN_UNIVERSITIES.map((u) => (
                          <option
                            key={u.id}
                            value={u.name}
                          >
                            {u.name}
                          </option>
                        ))}
                        <option value="Other">
                          Other University / Institute
                        </option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                    {formData.universityName === "Other" && (
                      <input
                        type="text"
                        placeholder="Type university name..."
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            universityName: e.target.value,
                          })
                        }
                        className="mt-2 w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-[#00b4eb] focus:ring-1 focus:ring-[#00b4eb]/20"
                        required
                      />
                    )}
                  </div>

                  {/* Supervisor Name with Title Dropdown */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Supervisor / Coordinator Full Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="relative shrink-0">
                        <select
                          value={formData.supervisorTitle || "Mr."}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              supervisorTitle: e.target.value,
                            })
                          }
                          className="w-20 sm:w-24 px-2 pr-7 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-[#00b4eb] focus:ring-2 focus:ring-[#00b4eb]/20 transition-all cursor-pointer text-left appearance-none"
                        >
                          <option value="Mr.">Mr.</option>
                          <option value="Ms.">Ms.</option>
                          <option value="Mrs.">Mrs.</option>
                          <option value="Miss.">Miss.</option>
                          <option value="Dr.">Dr.</option>
                          <option value="Prof.">Prof.</option>
                          <option value="Rev.">Rev.</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                      </div>
                      <input
                        type="text"
                        placeholder="Full Name"
                        value={formData.supervisorName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            supervisorName: e.target.value,
                          })
                        }
                        className="flex-1 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-[#00b4eb] focus:ring-2 focus:ring-[#00b4eb]/20 transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Official Gmail Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      placeholder="supervisor@gmail.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-[#00b4eb] focus:ring-1 focus:ring-[#00b4eb]/20"
                      required
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Note: You must use this Gmail to sign in.
                    </p>
                  </div>

                  {/* Department & Designation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Faculty / Department
                      </label>
                      <input
                        type="text"
                        placeholder="Faculty of Computing"
                        value={formData.department}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            department: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-[#00b4eb] focus:ring-1 focus:ring-[#00b4eb]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Designation / Role
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Senior Lecturer / Head"
                        value={formData.designation}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            designation: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-[#00b4eb] focus:ring-1 focus:ring-[#00b4eb]/20"
                      />
                    </div>
                  </div>

                  {/* Contact Number */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Contact Number (Mobile / Office)
                    </label>
                    <input
                      type="text"
                      placeholder="077 123 4567"
                      value={formData.contactNumber}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contactNumber: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-[#00b4eb] focus:ring-1 focus:ring-[#00b4eb]/20"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submittingReg}
                      className="w-full py-3 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-[#50b748] to-[#00b4eb] text-white shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {submittingReg ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Submitting Request...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          <span>Submit Access Request</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Seasonal background layer */}
      <SeasonalBackground onSeasonResolved={handleSeasonResolved} />
    </div>
  );
};

export default UniversityLogin;
