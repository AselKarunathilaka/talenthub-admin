import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUser,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaShieldAlt,
} from "react-icons/fa";
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
} from "lucide-react";
import { motion } from "framer-motion";
import { API_BASE_URL, API_ENDPOINTS } from "../api/apiConfig";
import { getSessionMessage } from "../utils/sessionUtils";
import sltLogo from "../assets/sltlogoOnly.png";
import talentHubLogo from "../assets/talenthubwhitebg.jpeg";
import transzentLogo from "../assets/transzent.jpeg";

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
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [sessionMsg] = React.useState(() => getSessionMessage());
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.AUTH.ADMIN_LOGIN}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            userType: "admin",
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      const adminInfo = {
        token: data.token,
        user: data.user,
        loginTime: new Date().toISOString(),
      };

      localStorage.setItem("adminInfo", JSON.stringify(adminInfo));
      navigate("/admin/dashboard");
    } catch (error) {
      console.error("Admin login error:", error);
      setError(error.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen text-white overflow-hidden relative"
      style={{
        background: "linear-gradient(135deg, #000066 0%, #006600 100%)",
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

      {/* Glow accents — reversed from intern login */}
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
                  Administration Portal
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
                <span className="text-white">Admin</span>
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, #00b4eb, #50b748)",
                  }}
                >
                  Access
                </span>
              </h2>
              <p className="text-white/60 mt-2 text-sm leading-relaxed max-w-sm">
                Sign in with your administrator credentials to manage
                interns, attendance, and operations.
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
                    "linear-gradient(90deg, #50b748, #00b4eb, #00b4eb)",
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
                        "linear-gradient(135deg, rgba(0,180,235,0.15), rgba(80,183,72,0.15))",
                      border: "1px solid rgba(0,180,235,0.2)",
                    }}
                  >
                    <FaShieldAlt className="h-6 w-6 text-[#00b4eb]" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-0.5">
                    Admin Login
                  </h3>
                  <p className="text-white/50 text-sm">
                    Enter your administrator credentials
                  </p>
                </div>

                {/* Middle Section */}
                <div className="flex-1 flex flex-col justify-center mb-1">
                  {/* Login form */}
                  <form onSubmit={handleSubmit} className="space-y-1.5">
                    {/* Email field */}
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaUser className="h-4 w-4 text-white/40" />
                      </div>
                      <input
                        id="admin-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        className="autofill-fix block w-full pl-10 pr-3 py-2.5 rounded-xl text-sm text-white placeholder-white/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#00b4eb]/50"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                        placeholder="Email"
                        onFocus={(e) => {
                          e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                          e.currentTarget.style.borderColor = "rgba(0,180,235,0.4)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                          e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                        }}
                      />
                    </div>

                    {/* Password field */}
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaLock className="h-4 w-4 text-white/40" />
                      </div>
                      <input
                        id="admin-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={formData.password}
                        onChange={handleInputChange}
                        className="autofill-fix block w-full pl-10 pr-10 py-2.5 rounded-xl text-sm text-white placeholder-white/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#00b4eb]/50"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                        placeholder="Password"
                        onFocus={(e) => {
                          e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                          e.currentTarget.style.borderColor = "rgba(0,180,235,0.4)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                          e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                        }}
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <FaEyeSlash className="h-4 w-4 text-white/40 hover:text-white/70 transition-colors" />
                        ) : (
                          <FaEye className="h-4 w-4 text-white/40 hover:text-white/70 transition-colors" />
                        )}
                      </button>
                    </div>

                    {/* Submit button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                      style={{
                        background: "linear-gradient(135deg, #00b4eb, #50b748)",
                        boxShadow: "0 4px 15px rgba(0,180,235,0.3)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,180,235,0.5)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = "0 4px 15px rgba(0,180,235,0.3)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      {loading ? (
                        <>
                          <div className="w-5 h-5 border-t-2 border-b-2 border-white rounded-full animate-spin" />
                          <span>Authenticating...</span>
                        </>
                      ) : (
                        <>
                          <FaShieldAlt className="h-4 w-4 transition-transform group-hover:scale-110" />
                          <span className="tracking-wider">ACCESS DASHBOARD</span>
                        </>
                      )}
                    </button>
                  </form>
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

                  {/* Intern Login redirect */}
                  <button
                    onClick={() => navigate("/")}
                    className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer group"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "rgba(0,180,235,0.15)";
                      e.currentTarget.style.borderColor =
                        "rgba(0,180,235,0.3)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.04)";
                      e.currentTarget.style.borderColor =
                        "rgba(255,255,255,0.08)";
                    }}
                  >
                    <GraduationCap className="h-4 w-4 text-[#50b748] group-hover:text-[#50b748]" />
                    <span className="text-white/70 group-hover:text-white">
                      Login as Intern
                    </span>
                    <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-white/60 ml-auto transition-transform group-hover:translate-x-0.5" />
                  </button>

                  <p className="text-center text-xs text-white/30 mt-1">
                    For interns and trainees only

                  </p>
                </div>
              </div>
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
                  href="#"
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

        {/* ─── RIGHT PANEL: Admin feature showcase (hidden on mobile) ─── */}
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
                  Full Control Panel
                </span>
              </div>
              <h2 className="text-2xl xl:text-3xl font-extrabold text-white leading-tight tracking-tight">
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
              <p className="text-white/50 mt-2 text-xs max-w-sm mx-auto leading-relaxed">
                Comprehensive tools for managing interns, attendance systems,
                leave requests, and workspace operations.
              </p>
            </motion.div>
            </div>

            {/* Feature grid — showing top items from admin navLinks */}
            <div className="grid grid-cols-2 gap-3 lg:h-[380px] overflow-y-auto hide-scrollbar">
              {features.slice(0, 6).map((feature, index) => (
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
                { value: "13+", label: "Modules" },
                { value: "Real-time", label: "Monitoring" },
                { value: "Secure", label: "Admin Access" },
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

      {/* Hide scrollbar utility */}
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
