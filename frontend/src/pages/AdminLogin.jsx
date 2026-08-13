import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import SeasonalBackground from "../seasonal-backgrounds/SeasonalBackground";
import {
  Home,
  BookOpen,
  ScanLine,
  ScanFace,
  Bike,
  GraduationCap,
  MapPin,
  Armchair,
  QrCode,
  KeyRound,
  UserX,
  Lock,
  Lightbulb,
  ArrowRight,
  Sparkles,
  Maximize2,
  Minimize2,
  Shield,
} from "lucide-react";
import { motion } from "framer-motion";
import { API_BASE_URL, API_ENDPOINTS } from "../api/apiConfig";
import { getSessionMessage } from "../utils/sessionUtils";
import sltLogo from "../assets/sltlogoOnly.png";
import talentHubLogo from "../assets/talenthubwhitebg.jpeg";
import transzentLogo from "../assets/transzent.jpeg";
import WhatsAppSupportButton, {
  WHATSAPP_SUPPORT_LINK,
} from "../components/WhatsAppSupportButton";

/* ─── Admin nav-link feature items (mirrors AdminNavigation.jsx navLinks) ─── */
const features = [
  {
    icon: <Home className="h-4 w-4" />,
    title: "Dashboard",
    description: "Overview of all intern activity & stats",
    color: "#48cef7",
  },
  {
    icon: <BookOpen className="h-4 w-4" />,
    title: "Daily Logs",
    description: "Review and manage intern daily records",
    color: "#68de5f",
  },
  {
    icon: <ScanLine className="h-4 w-4" />,
    title: "Attendance",
    description: "Track and verify intern attendance data",
    color: "#f9f116",
  },
  {
    icon: <ScanFace className="h-4 w-4" />,
    title: "Face ID",
    description: "Facial recognition attendance system",
    color: "#a486fc",
  },
  {
    icon: <QrCode className="h-4 w-4" />,
    title: "QR Management",
    description: "Generate and manage QR check-in codes",
    color: "#f19e63",
  },
  {
    icon: <KeyRound className="h-4 w-4" />,
    title: "PIN Management",
    description: "Administer secure PIN-based access",
    color: "#ff81c0",
  },
  {
    icon: <Bike className="h-4 w-4" />,
    title: "Short Leave",
    description: "Approve or reject short leave requests",
    color: "#00d4aa",
  },
  {
    icon: <GraduationCap className="h-4 w-4" />,
    title: "Extended Leave",
    description: "Manage study & extended leave periods",
    color: "#ffa94d",
  },
  {
    icon: <MapPin className="h-4 w-4" />,
    title: "Locations",
    description: "View intern deployment locations",
    color: "#74c0fc",
  },
  {
    icon: <Armchair className="h-4 w-4" />,
    title: "Seat Layout",
    description: "Manage workspace seating arrangements",
    color: "#e599f7",
  },
  {
    icon: <UserX className="h-4 w-4" />,
    title: "Terminated",
    description: "Handle inactive intern records",
    color: "#ff6b6b",
  },
  {
    icon: <Lock className="h-4 w-4" />,
    title: "Log Restrictions",
    description: "Set logbook access rules & deadlines",
    color: "#ffd43b",
  },
  {
    icon: <Lightbulb className="h-4 w-4" />,
    title: "Broadcast New",
    description: "Send feature tips & announcements",
    color: "#69db7c",
  },
];

const AdminLogin = () => {
  const navigate = useNavigate();
  const [sessionMsg] = React.useState(() => getSessionMessage());
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [seasonActive, setSeasonActive] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);

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

  // ── Google Sign-In ──────────────────────────────────────────────────────
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      setError("");
      try {
        const tokenInfoRes = await fetch(
          `https://www.googleapis.com/oauth2/v3/userinfo`,
          { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
        );
        if (!tokenInfoRes.ok) throw new Error("Failed to fetch Google user info.");

        const userInfo = await tokenInfoRes.json();

        const response = await fetch(
          `${API_BASE_URL}${API_ENDPOINTS.AUTH.ADMIN_GOOGLE_LOGIN}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken: tokenResponse.access_token, userInfo }),
          }
        );

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Access denied.");
        }

        const adminInfo = {
          token: data.token,
          user: data.user,
          loginTime: new Date().toISOString(),
        };
        localStorage.setItem("adminInfo", JSON.stringify(adminInfo));
        navigate("/admin/dashboard");
      } catch (err) {
        console.error("Google sign-in error:", err);
        setError(err.message || "Google sign-in failed. Please try again.");
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: (err) => {
      console.error("Google OAuth error:", err);
      if (err.error !== "access_denied" && err.error !== "popup_closed_by_user") {
        setError("Google sign-in was cancelled or failed. Please try again.");
      }
    },
    flow: "implicit",
  });

  return (
    <div
      className="min-h-screen lg:h-screen text-white relative overflow-x-hidden overflow-y-auto lg:overflow-hidden flex flex-col justify-center"
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
          transition={{ duration: 0.3 }}
          className="fixed top-4 right-4 z-40"
        >
          {!isImmersive ? (
            <button
              onClick={() => setIsImmersive(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold text-white/90 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer group"
              title="View full-screen seasonal experience without UI components"
            >
              <span>Immersive</span>
              <Maximize2 className="h-3.5 w-3.5 text-white/70 group-hover:text-white transition-colors" />
            </button>
          ) : (
            <button
              onClick={() => setIsImmersive(false)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold text-white/90 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer group"
              title="Exit full-screen seasonal experience (Esc)"
            >
              <span>Immersive</span>
              <Minimize2 className="h-3.5 w-3.5 text-white/70 group-hover:text-white transition-colors" />
            </button>
          )}
        </motion.div>
      )}

      {/* Subtle animated grain / mesh overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Glow accents */}
      <div
        className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full pointer-events-none opacity-20"
        style={{
          background:
            "radial-gradient(circle, rgba(0,86,162,0.4) 0%, transparent 70%)",
        }}
      />
      <div
        className="fixed bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full pointer-events-none opacity-20"
        style={{
          background:
            "radial-gradient(circle, rgba(80,183,72,0.4) 0%, transparent 70%)",
        }}
      />

      {/* ─── Main content ─── */}
      <div
        className={`relative z-10 min-h-screen lg:h-screen flex flex-col lg:flex-row items-center justify-center transition-all duration-500 ease-in-out ${
          isImmersive
            ? "opacity-0 scale-95 pointer-events-none invisible"
            : "opacity-100 scale-100 visible"
        }`}
      >
        {/* ─── LEFT PANEL: Login card ─── */}
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
              className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6"
            >
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#00b4eb] to-[#50b748] rounded-2xl opacity-40 blur-sm group-hover:opacity-70 transition-opacity duration-500" />
                <img
                  src={sltLogo}
                  alt="SLT Mobitel Logo"
                  className="relative w-12 h-12 sm:w-14 sm:h-14 object-contain rounded-xl border-2 border-white/20 shadow-lg"
                />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2.5">
                  <img
                    src={talentHubLogo}
                    alt="TalentHub"
                    className="h-6 sm:h-8 w-auto rounded-md"
                  />
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                    TalentHub
                  </h1>
                </div>
                <p className="text-xs sm:text-sm text-white/50 font-medium mt-0.5">
                  Administration Portal
                </p>
              </div>
            </motion.div>

            {/* ─── Login card ─── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="rounded-2xl overflow-hidden backdrop-blur-xl relative flex flex-col justify-center py-3 sm:py-4"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow:
                  "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
            >
              {/* Card accent bar */}
              <div
                className="absolute top-0 left-0 right-0 h-1.5"
                style={{
                  background:
                    "linear-gradient(90deg, #50b748, #00b4eb, #0056a2)",
                }}
              />

              <div className="px-4 py-3 sm:px-5 sm:py-3 flex flex-col h-full justify-between gap-3">
                {/* Session message */}
                {sessionMsg && (
                  <div className="mb-2 flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/20">
                    <svg
                      className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-xs text-amber-200 font-medium">
                      {sessionMsg}
                    </span>
                  </div>
                )}

                {/* Error message */}
                {error && (
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="mb-2 flex items-start gap-2.5 p-2.5 rounded-xl bg-red-500/10 border border-red-400/20"
                  >
                    <svg
                      className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-xs text-red-200 font-medium">
                      {error}
                    </span>
                  </motion.div>
                )}

                {/* Welcome text inside card */}
                <div className="text-center flex-shrink-0">
                  <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight flex items-center justify-center gap-2">
                    <Shield className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                    <span className="text-white">Welcome Back</span>
                    <span
                      className="bg-clip-text text-transparent"
                      style={{
                        backgroundImage:
                          "linear-gradient(135deg, #00b4eb, #50b748)",
                      }}
                    >
                      Admin
                    </span>
                  </h2>
                  <p className="text-white/60 mt-1.5 text-[11px] sm:text-[13px] leading-relaxed max-w-[280px] sm:max-w-xs mx-auto">
                    Sign in with your organization's admin account
                  </p>
                </div>

                {/* Google Login Button */}
                <div className="flex-1 flex flex-col justify-center my-1">
                  <div className="flex justify-center w-full">
                    <button
                      type="button"
                      onClick={() => googleLogin()}
                      disabled={googleLoading}
                      className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer disabled:opacity-50"
                      style={{
                        background: "#ffffff",
                        color: "#3c3c3c",
                        border: "1px solid rgba(255,255,255,0.8)",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = "0 4px 15px rgba(0,0,0,0.2)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.15)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      {googleLoading ? (
                        <>
                          <div className="w-4 h-4 border-t-2 border-b-2 border-[#4285f4] rounded-full animate-spin" />
                          <span className="tracking-wider">SIGNING IN...</span>
                        </>
                      ) : (
                        <>
                          {/* Google G logo SVG */}
                          <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          <span className="tracking-wider text-[#3c3c3c]">SIGN IN WITH GOOGLE</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Bottom Section */}
                <div className="flex-shrink-0">
                  {/* Divider */}
                  <div className="flex items-center gap-3 mb-1.5">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-[10px] sm:text-xs text-white/30 font-medium uppercase tracking-wider">
                      or
                    </span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  {/* Intern Login */}
                  <button
                    onClick={() => navigate("/")}
                    className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 cursor-pointer group"
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
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.45 }}
              className="mt-2.5 sm:mt-3 rounded-xl sm:rounded-2xl border border-[#25D366]/20 bg-[#25D366]/10 p-2.5 sm:p-3 text-center"
            >
              <p className="mb-2 text-xs sm:text-sm font-medium text-white/70">
                Having trouble logging in or joining TalentHub?
              </p>
              <WhatsAppSupportButton
                className="w-full"
                variant="solid"
              />
            </motion.div>

            {/* Footer */}
            <div className="lg:h-[70px] flex flex-col justify-start pt-3 sm:pt-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="text-center text-white/30 text-[11px] sm:text-xs"
            >
              <p className="mb-1.5">
                © {new Date().getFullYear()} SLT Mobitel. All rights reserved.
              </p>
              <div className="flex justify-center gap-4 mb-2 sm:mb-3">
                <a
                  href="#"
                  className="hover:text-[#00b4eb] transition-colors"
                >
                  Privacy
                </a>
                <a
                  href="#"
                  className="hover:text-[#00b4eb] transition-colors"
                >
                  Terms
                </a>
                <a
                  href={WHATSAPP_SUPPORT_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#00b4eb] transition-colors"
                >
                  Help
                </a>
              </div>
              <div className="flex justify-center items-center">
                <img
                  src={transzentLogo}
                  alt="Transzent"
                  className="h-6 sm:h-8 w-auto rounded opacity-100 shadow-sm"
                />
              </div>
            </motion.div>
            </div>
          </div>
        </motion.div>

        {/* ─── RIGHT PANEL: Feature showcase (hidden on mobile) ─── */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="hidden lg:flex lg:w-[52%] xl:w-[56%] items-center justify-center p-4 xl:p-6"
        >
          {/* Glass panel container */}
          <div
            className="relative z-10 w-full max-w-xl rounded-[2rem] p-5 xl:p-6 flex flex-col justify-between"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(20px)",
            }}
          >
            {/* Section header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-center mb-3"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-[#50b748]" />
                <span className="text-[11px] font-semibold text-white/70 tracking-wider uppercase">
                  Full Control Panel
                </span>
              </div>
              <h2 className="text-xl xl:text-2xl font-extrabold text-white leading-tight tracking-tight">
                Administration,
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, #00b4eb, #50b748)",
                  }}
                >
                  Empowered
                </span>
              </h2>
              <p className="text-white/50 mt-1 text-[11px] xl:text-xs max-w-sm mx-auto leading-relaxed">
                Comprehensive tools for managing interns, attendance systems,
                leave requests, and workspace operations.
              </p>
            </motion.div>

            {/* Feature grid */}
            <div className="grid grid-cols-2 gap-2.5 my-2 max-h-[360px] overflow-y-auto hide-scrollbar">
              {features.slice(0, 6).map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.5 + index * 0.08,
                    duration: 0.4,
                  }}
                  className="group rounded-xl p-3 cursor-default transition-all duration-500 ease-out flex flex-col justify-center"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `rgba(255,255,255,0.07)`;
                    e.currentTarget.style.borderColor = `${feature.color}30`;
                    e.currentTarget.style.boxShadow = `0 8px 30px ${feature.color}15`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      "rgba(255,255,255,0.04)";
                    e.currentTarget.style.borderColor =
                      "rgba(255,255,255,0.06)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 transition-all duration-300"
                    style={{
                      background: `${feature.color}15`,
                      color: feature.color,
                    }}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="text-xs font-bold text-white mb-0.5 tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-[10px] xl:text-[11px] text-white/45 leading-snug">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Bottom stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.5 }}
              className="flex items-center justify-center gap-8 pt-3 border-t border-white/5"
            >
              {[
                { value: "24/7", label: "Access" },
                { value: "Real-time", label: "Tracking" },
                { value: "Secure", label: "Platform" },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div
                    className="text-sm sm:text-base font-extrabold bg-clip-text text-transparent"
                    style={{
                      backgroundImage:
                        "linear-gradient(135deg, #00b4eb, #50b748)",
                    }}
                  >
                    {stat.value}
                  </div>
                  <div className="text-[11px] text-white/35 font-medium mt-0.5">
                    {stat.label}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Seasonal background layer */}
      <SeasonalBackground onSeasonResolved={handleSeasonResolved} />

      {/* Hide scrollbar */}
      <style jsx="true" global="true">{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default AdminLogin;
