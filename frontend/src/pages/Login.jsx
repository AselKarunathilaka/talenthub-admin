import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { motion, AnimatePresence } from "framer-motion";
import SeasonalBackground from "../seasonal-backgrounds/SeasonalBackground";
import { api } from "../utils/api";
import { getSessionMessage } from "../utils/sessionUtils";
import { WHATSAPP_SUPPORT_LINK } from "../components/WhatsAppSupportButton";

// Icons
import {
  Shield, Zap, Users, Lock, Headphones, ShieldCheck, Maximize2, Minimize2, MessageCircle, UserCheck, AlertCircle, Info
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

// Assets
import sltLogo from "../assets/sltlogoOnly.png";
import talentHubLogo from "../assets/talenthubwhitebg.jpeg";
import transzentLogo from "../assets/transzent.jpeg";
import mainLogo from "../assets/talenthub.png";

const Login = () => {
  const navigate = useNavigate();

  // Loading states
  const [loading, setLoading] = useState(false);
  const [sessionMsg] = React.useState(() => getSessionMessage());
  const [error, setError] = useState(null);
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

  const handleUnifiedGoogleLogin = async (tokenResponse) => {
    try {
      setLoading(true);
      setError(null);

      const data = await api.post("/auth/unified-google-login", {
        accessToken: tokenResponse.access_token,
      });

      if (!data.roles || data.roles.length === 0) {
        throw new Error("No roles found for this account. Please log in using your organization registered email.");
      }

      // Store roles
      localStorage.setItem("availableRoles", JSON.stringify(data.roles));

      // Store respective credentials
      if (data.intern) {
        localStorage.setItem("internId", data.intern.internId);
        localStorage.setItem("authToken", data.intern.token);
      }

      if (data.admin) {
        localStorage.setItem("adminInfo", JSON.stringify({
          token: data.admin.token,
          user: data.admin.user,
          loginTime: new Date().toISOString()
        }));
      }

      // Routing logic
      if (data.roles.includes("intern") && data.roles.includes("admin")) {
        localStorage.setItem("currentRole", "intern");
        navigate("/dashboard");
      } else if (data.roles.includes("intern")) {
        localStorage.setItem("currentRole", "intern");
        navigate("/dashboard");
      } else if (data.roles.includes("admin")) {
        localStorage.setItem("currentRole", "admin");
        navigate("/admin/dashboard");
      }

    } catch (err) {
      console.error("Login failed:", err);
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: handleUnifiedGoogleLogin,
    onError: () => setError("Google authentication failed. Please try again."),
    flow: "implicit",
  });

  const features = [
    {
      icon: <Shield className="w-5 h-5" />,
      title: "Secure & Private",
      description: "Enterprise-grade security to protect your data.",
      color: "#22c55e"
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Unified Access",
      description: "One login for all your tools and resources.",
      color: "#3b82f6"
    },
    {
      icon: <Users className="w-5 h-5" />,
      title: "Built for Interns",
      description: "Streamlined to help you focus and grow.",
      color: "#8b5cf6"
    }
  ];

  return (
    <div
      className="min-h-[100dvh] text-white relative flex flex-col font-sans overflow-x-hidden transition-colors duration-700 select-none cursor-default"
      style={{
        background: seasonActive ? "#02020a" : "linear-gradient(135deg, #000066 0%, #006600 100%)",
      }}
    >
      {/* Immersive View Toggle Button */}
      {seasonActive && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-6 right-6 z-40"
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
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Glow accents */}
      <div
        className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full pointer-events-none transition-opacity duration-700 opacity-20"
        style={{ background: "radial-gradient(circle, rgba(0,180,235,0.4) 0%, transparent 70%)" }}
      />
      <div
        className="fixed bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full pointer-events-none transition-opacity duration-700 opacity-20"
        style={{ background: "radial-gradient(circle, rgba(80,183,72,0.4) 0%, transparent 70%)" }}
      />

      {/* ─── Header ─── */}
      <header className={`relative z-20 flex items-center justify-between px-4 sm:px-6 py-4 lg:px-12 lg:py-6 transition-opacity duration-500 ${isImmersive ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        <div className="flex items-center gap-3">
          {mainLogo ? (
            <img
              src={mainLogo}
              alt="TalentHub Logo"
              className="h-8 sm:h-10 w-auto object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] transition-transform hover:scale-105"
            />
          ) : (
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md bg-gradient-to-br from-[#00b4eb] to-[#50b748]" />
          )}
          <span className="text-xl sm:text-2xl font-bold tracking-tight">TalentHub</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <span className="text-xs sm:text-sm text-white/70 hidden md:block">Need help?</span>
          <a
            href={WHATSAPP_SUPPORT_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-[#25D366] text-white hover:bg-[#20bd5a] transition-all duration-300 text-xs sm:text-sm font-medium shadow-lg"
          >
            <FaWhatsapp className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            <span className="hidden sm:inline">Contact Support</span>
            <span className="inline sm:hidden">Support</span>
          </a>
        </div>
      </header>

      {/* ─── Main content ─── */}
      <main
        className={`relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 transition-all duration-500 ease-in-out ${isImmersive ? "opacity-0 scale-95 pointer-events-none invisible" : "opacity-100 scale-100 visible"
          }`}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="w-full flex flex-col items-center justify-center"
        >
          <div className="w-full max-w-lg flex flex-col gap-4">

            {/* Main Login Card */}
            <div className="relative rounded-3xl sm:rounded-[2rem] p-[2px] overflow-hidden group">
              {/* Glowing gradient border */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#00b4eb] via-[#50b748] to-[#000066] opacity-80 group-hover:opacity-100 transition-opacity duration-500" />

              <div
                className="relative rounded-3xl sm:rounded-[2rem] backdrop-blur-xl p-6 sm:p-10 md:p-12 flex flex-col items-center text-center w-full"
                style={{
                  background: seasonActive ? "rgba(2, 2, 10, 0.6)" : "linear-gradient(135deg, rgba(0, 0, 102, 0.7) 0%, rgba(0, 102, 0, 0.7) 100%)",
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                }}
              >
                <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-1 sm:mb-2 tracking-tight leading-tight">TalentHub</h1>
                <p className="text-xs xs:text-sm sm:text-base md:text-lg text-white/70 mb-4 sm:mb-6 font-medium px-2">Internship Management Portal</p>

                {/* Auto Role Detection Text */}
                <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-5 sm:mb-8 bg-white/5 border border-white/10 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full shadow-inner max-w-sm mx-auto">
                  <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00b4eb] flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs text-white/80 font-medium tracking-wide text-center leading-snug">
                    Your role is auto detected
                  </span>
                </div>

                {/* Small Logos */}
                <div className="flex items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-10">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-lg sm:rounded-xl p-1.5 flex items-center justify-center border border-white/60 shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-transform hover:scale-105">
                    <img src={talentHubLogo} alt="TalentHub" className="w-full h-full object-contain rounded-sm" />
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-lg sm:rounded-xl p-1.5 flex items-center justify-center border border-white/60 shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-transform hover:scale-105">
                    <img src={sltLogo} alt="SLT" className="w-full h-full object-contain" />
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-lg sm:rounded-xl p-1.5 flex items-center justify-center border border-white/60 shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-transform hover:scale-105">
                    <img src={transzentLogo} alt="Transzent" className="w-full h-full object-contain" />
                  </div>
                </div>

                {/* Error / Session Msgs */}
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.2 }}
                      className="w-full mb-6 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl p-3.5 text-left"
                    >
                      {error}
                    </motion.div>
                  )}
                  {sessionMsg && !error && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.2 }}
                      className="w-full mb-6 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl p-3.5 text-left"
                    >
                      {sessionMsg}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Login Button */}
                <button
                  type="button"
                  onClick={() => { setError(null); googleLogin(); }}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 sm:gap-3 px-2 py-3 sm:px-4 sm:py-4 rounded-lg sm:rounded-xl text-xs sm:text-base font-bold transition-all duration-300 disabled:opacity-70 bg-white text-slate-900 hover:bg-slate-50 hover:-translate-y-1 shadow-[0_0_15px_rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                >
                  {loading ? (
                    <div className="w-4 h-4 sm:w-6 sm:h-6 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin flex-shrink-0" />
                  ) : (
                    <svg className="h-4 w-4 sm:h-6 sm:w-6 flex-shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                  )}
                  <span>Continue with Google</span>
                </button>

                <div className="flex items-center justify-center gap-1.5 md:gap-2 mt-4 sm:mt-8 text-white/60 text-[10px] sm:text-xs font-medium text-center px-2">
                  <ShieldCheck className="hidden md:block w-4 h-4 text-[#50b748] flex-shrink-0" />
                  <span>Secure, private, and protected by industry standard encryption.</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* ─── Footer ─── */}
      <footer className={`relative z-20 py-6 text-center transition-opacity duration-500 ${isImmersive ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        <div className="flex items-center justify-center gap-4 text-xs text-white/40 mb-3">
          <a href="#" className="hover:text-white/80 transition-colors">Privacy Policy</a>
          <span>·</span>
          <a href="#" className="hover:text-white/80 transition-colors">Terms of Service</a>
          <span>·</span>
          <a href={WHATSAPP_SUPPORT_LINK} target="_blank" rel="noopener noreferrer" className="hover:text-white/80 transition-colors">Help Center</a>
        </div>
        <p className="text-[11px] text-white/30">© 2026 TalentHub. All rights reserved.</p>
      </footer>

      <SeasonalBackground onSeasonResolved={handleSeasonResolved} />
    </div>
  );
};

export default Login;
