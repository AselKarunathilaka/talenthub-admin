import React, { useState, useCallback } from "react";
import SeasonalBackground from "../seasonal-backgrounds/SeasonalBackground";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import {
  FaShieldAlt,
} from "react-icons/fa";
import {
  Home,
  ScanLine,
  BookOpen,
  FileText,
  GraduationCap,
  Armchair,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { api } from "../utils/api";
import sltLogo from "../assets/sltlogoOnly.png";
import talentHubLogo from "../assets/talenthubwhitebg.jpeg";
import transzentLogo from "../assets/transzent.jpeg";
import { motion } from "framer-motion";
import { getSessionMessage } from "../utils/sessionUtils";
import WhatsAppSupportButton, {
  WHATSAPP_SUPPORT_LINK,
} from "../components/WhatsAppSupportButton";

/* ─── Nav-link feature items (mirrors Navigation.jsx navLinks) ─── */
const features = [
  {
    icon: <Home className="h-4 w-4" />,
    title: "Dashboard",
    description: "Overview of your internship at a glance",
    color: "#48cef7",
  },
  {
    icon: <ScanLine className="h-4 w-4" />,
    title: "Attendance",
    description: "Mark daily & meeting attendance seamlessly",
    color: "#f9f116",
  },
  {
    icon: <BookOpen className="h-4 w-4" />,
    title: "Log Book",
    description: "Track daily progress, tasks & achievements",
    color: "#68de5f",
  },
  {
    icon: <FileText className="h-4 w-4" />,
    title: "Short Leave",
    description: "Request and manage short leave applications",
    color: "#a486fc",
  },
  {
    icon: <GraduationCap className="h-4 w-4" />,
    title: "Extended Leave",
    description: "Apply for study or extended leave periods",
    color: "#f19e63",
  },
  {
    icon: <Armchair className="h-4 w-4" />,
    title: "Seat Reservation",
    description: "Reserve your preferred workspace seat",
    color: "#ff81c0",
  },
];

const Login = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [sessionMsg] = React.useState(() => getSessionMessage());
  const [error, setError] = useState(null);
  const [seasonActive, setSeasonActive] = useState(false);

  const handleSeasonResolved = useCallback((seasonKey) => {
    setSeasonActive(!!seasonKey);
  }, []);
  const handleGoogleLogin = async (response) => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await api.post("/auth/google-login", {
        code: response.credential,
      });

      if (data.token) {
        localStorage.setItem("internId", data.internId);
        localStorage.setItem("authToken", data.token);
        navigate("/dashboard");
      } else {
        setError(data.message || "Authentication failed. Please try again.");
      }
    } catch (error) {
      console.error("Login failed:", error);
      setError(
        "Login failed. Please ensure you're using the correct Google account.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen text-white overflow-hidden relative"
      style={{
        background: seasonActive
          ? "#02020a"
          : "linear-gradient(135deg, #006600 0%, #000066 100%)",
      }}
    >
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

      {/* ─── Main content ─── */}
      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">
        {/* ─── LEFT PANEL: Login card ─── */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          className="w-full lg:w-[48%] xl:w-[44%] flex items-center justify-center min-h-screen lg:min-h-0 p-6 sm:p-8 lg:p-8 xl:p-10"
        >
          <div className="w-full max-w-sm lg:max-w-md">
            <div className="lg:h-[160px] flex flex-col justify-end pb-2">
            {/* Brand header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex items-center gap-3 mb-4"
            >
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#00b4eb] to-[#50b748] rounded-2xl opacity-40 blur-sm group-hover:opacity-70 transition-opacity duration-500" />
                <img
                  src={sltLogo}
                  alt="SLT Mobitel Logo"
                  className="relative w-12 h-12 object-contain rounded-xl border-2 border-white/20 shadow-lg"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <img
                    src={talentHubLogo}
                    alt="TalentHub"
                    className="h-6 w-auto rounded-md"
                  />
                  <h1 className="text-xl font-extrabold tracking-tight text-white">
                    TalentHub
                  </h1>
                </div>
                <p className="text-sm text-white/50 font-medium mt-0.5">
                  Internship Management Portal
                </p>
              </div>
            </motion.div>

            {/* Welcome text */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
              className="mb-2"
            >
              <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight flex items-center gap-2">
                <span className="text-white">Welcome</span>
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, #00b4eb, #50b748)",
                  }}
                >
                  Back
                </span>
              </h2>
              <p className="text-white/60 mt-2 text-sm leading-relaxed max-w-sm">
                Sign in with your organization Google account to manage
                attendance, tasks, and daily logs.
              </p>
            </motion.div>
            </div>

            {/* ─── Login card ─── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="rounded-2xl overflow-hidden backdrop-blur-xl relative flex flex-col justify-center h-[380px]"
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
                    "linear-gradient(90deg, #00b4eb, #0056a2, #50b748)",
                }}
              />

              <div className="p-5 sm:p-5 flex flex-col h-full">
                {/* Session message */}
                {sessionMsg && (
                  <div className="mb-4 flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-400/20">
                    <svg
                      className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm text-amber-200 font-medium">
                      {sessionMsg}
                    </span>
                  </div>
                )}

                {/* Error message */}
                {error && (
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="mb-4 flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-400/20"
                  >
                    <svg
                      className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm text-red-200 font-medium">
                      {error}
                    </span>
                  </motion.div>
                )}

                {/* Top Section */}
                <div className="text-center mb-1 flex-shrink-0">
                  <div
                    className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-1"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(0,180,235,0.15), rgba(0,86,162,0.15))",
                      border: "1px solid rgba(0,180,235,0.2)",
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 text-[#00b4eb]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-white mb-0.5">
                    Intern Login
                  </h3>
                  <p className="text-white/50 text-sm">
                    Use your registered organization email
                  </p>
                </div>

                {/* Middle Section */}
                <div className="flex-1 flex flex-col justify-center mb-1">
                  {/* Google Login Button */}
                  <div className="flex justify-center scale-[1.14] sm:scale-[1.2] origin-center">
                    {isLoading ? (
                      <div className="inline-flex items-center px-6 py-3 rounded-full bg-white/5 border border-white/10">
                        <div className="w-5 h-5 border-t-2 border-b-2 border-[#00b4eb] rounded-full animate-spin mr-3" />
                        <span className="text-white/80 text-sm font-medium">
                          Authenticating...
                        </span>
                      </div>
                    ) : (
                      <GoogleLogin
                        onSuccess={handleGoogleLogin}
                        onError={() =>
                          setError(
                            "Google authentication failed. Please try again.",
                          )
                        }
                        useOneTap
                        theme="filled_blue"
                        shape="pill"
                        size="large"
                        text="continue_with"
                        locale="en"
                        width="300"
                      />
                    )}
                  </div>
                </div>

                {/* Bottom Section */}
                <div className="mt-auto flex-shrink-0">
                  {/* Divider */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-xs text-white/30 font-medium uppercase tracking-wider">
                      or
                    </span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  {/* Admin Login */}
                  <button
                    onClick={() => navigate("/admin-login")}
                    className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer group"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "rgba(0,86,162,0.15)";
                      e.currentTarget.style.borderColor =
                        "rgba(0,86,162,0.3)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.04)";
                      e.currentTarget.style.borderColor =
                        "rgba(255,255,255,0.08)";
                    }}
                  >
                    <FaShieldAlt className="text-[#00b4eb] group-hover:text-[#00b4eb]" />
                    <span className="text-white/70 group-hover:text-white">
                      Login as Admin
                    </span>
                    <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-white/60 ml-auto transition-transform group-hover:translate-x-0.5" />
                  </button>

                  <p className="text-center text-xs text-white/30 mt-1">
                    For administrators and supervisors only
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.45 }}
              className="mt-4 rounded-2xl border border-[#25D366]/20 bg-[#25D366]/10 p-4 text-center"
            >
              <p className="mb-3 text-sm font-medium text-white/70">
                Having trouble logging in or joining TalentHub?
              </p>
              <WhatsAppSupportButton
                className="w-full"
                variant="solid"
              />
            </motion.div>

            {/* Footer */}
            <div className="lg:min-h-[80px] flex flex-col justify-start pt-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="text-center text-white/30 text-xs"
            >
              <div className="flex flex-col sm:flex-row justify-center items-center gap-2 mb-4">
                <img 
                  src={transzentLogo} 
                  alt="Transzent" 
                  className="h-8 sm:h-10 w-auto rounded opacity-100 shadow-sm" 
                />
              </div>
              <div className="flex justify-center gap-4 mb-2">
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
              <p>
                © {new Date().getFullYear()} SLT Mobitel. All rights reserved.
              </p>
            </motion.div>
            </div>
          </div>
        </motion.div>

        {/* ─── RIGHT PANEL: Feature showcase (hidden on mobile) ─── */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="hidden lg:flex lg:w-[52%] xl:w-[56%] relative items-center justify-center p-6 xl:p-8"
        >
          {/* Glass panel background */}
          <div
            className="absolute inset-4 rounded-[2rem]"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(20px)",
            }}
          />

          <div className="relative z-10 w-full max-w-xl">
            <div className="lg:h-[160px] flex flex-col justify-end pb-2">
            {/* Section header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-center"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-3">
                <Sparkles className="h-4 w-4 text-[#50b748]" />
                <span className="text-xs font-semibold text-white/70 tracking-wider uppercase">
                  Everything you need
                </span>
              </div>
              <h2 className="text-2xl xl:text-3xl font-extrabold text-white leading-tight tracking-tight">
                Your Internship,
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, #00b4eb, #50b748)",
                  }}
                >
                  Simplified
                </span>
              </h2>
              <p className="text-white/50 mt-2 text-xs max-w-sm mx-auto leading-relaxed">
                Comprehensive platform for attendance, tasks, daily progress
                tracking and more.
              </p>
            </motion.div>
            </div>

            {/* Feature grid */}
            <div className="grid grid-cols-2 gap-3 lg:h-[380px]">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.5 + index * 0.08,
                    duration: 0.4,
                  }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="group rounded-xl p-3.5 cursor-default transition-all duration-300 flex flex-col justify-center"
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
                    className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-all duration-300"
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
                  <p className="text-[11px] text-white/45 leading-snug">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Bottom stats */}
            <div className="lg:h-[80px] flex flex-col justify-start pt-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.5 }}
              className="flex items-center justify-center gap-8"
            >
              {[
                { value: "24/7", label: "Access" },
                { value: "Real-time", label: "Tracking" },
                { value: "Secure", label: "Platform" },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div
                    className="text-base font-extrabold bg-clip-text text-transparent"
                    style={{
                      backgroundImage:
                        "linear-gradient(135deg, #00b4eb, #50b748)",
                    }}
                  >
                    {stat.value}
                  </div>
                  <div className="text-xs text-white/35 font-medium mt-0.5">
                    {stat.label}
                  </div>
                </div>
              ))}
            </motion.div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Seasonal background layer (renders behind all content, except specific foreground decorations) */}
      <SeasonalBackground onSeasonResolved={handleSeasonResolved} />

      {/* Hide scrollbar for mobile carousel */}
      <style jsx="true" global="true">{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default Login;
