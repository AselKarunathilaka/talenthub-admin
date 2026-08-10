import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from '@react-oauth/google';
import { startRegistration, startAuthentication, browserSupportsWebAuthnAutofill } from '@simplewebauthn/browser';
import SeasonalBackground from "../seasonal-backgrounds/SeasonalBackground";
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
  Fingerprint,
  Maximize2,
  Minimize2,
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);
  const [authDataForPasskeySetup, setAuthDataForPasskeySetup] = useState(null);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyError, setPasskeyError] = useState("");
  const [seasonActive, setSeasonActive] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);

  const handleSeasonResolved = useCallback((seasonKey) => {
    setSeasonActive(!!seasonKey);
  }, []);

  // ── Google Sign-In ──────────────────────────────────────────────────────
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      setError("");
      try {
        // Exchange the access token for a user info to get the ID token
        // We use the access_token to call userinfo endpoint and then pass
        // it to our backend. Since useGoogleLogin returns access_token,
        // we fetch the id_token via tokeninfo endpoint.
        const tokenInfoRes = await fetch(
          `https://www.googleapis.com/oauth2/v3/userinfo`,
          { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
        );
        if (!tokenInfoRes.ok) throw new Error("Failed to fetch Google user info.");

        // We need the ID token — use credential flow instead
        // This path is reached only if implicit flow returns access_token.
        // Fall back: send access_token to backend for verification.
        const userInfo = await tokenInfoRes.json();

        // Call our backend with the access token — backend verifies via Google
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isImmersive) {
        setIsImmersive(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isImmersive]);

  useEffect(() => {
    const setupAutofill = async () => {
      try {
        const isAutofillSupported = await browserSupportsWebAuthnAutofill();
        if (!isAutofillSupported) return;

        const resp = await fetch(`${API_BASE_URL}/auth/webauthn/generate-authentication-options`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        
        const data = await resp.json();
        if (data.error) throw new Error(data.error);

        const asseResp = await startAuthentication({ 
          optionsJSON: data.options,
          useBrowserAutofill: true 
        });

        const verificationResp = await fetch(`${API_BASE_URL}/auth/webauthn/verify-authentication`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ response: asseResp, sessionId: data.sessionId })
        });

        const verificationJSON = await verificationResp.json();
        if (verificationJSON.verified) {
          const adminInfo = {
            token: verificationJSON.token,
            user: verificationJSON.user,
            loginTime: new Date().toISOString(),
          };
          localStorage.setItem("adminInfo", JSON.stringify(adminInfo));
          navigate("/admin/dashboard");
        }
      } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
          return;
        }
        console.error("Autofill passkey error:", err);
      }
    };

    setupAutofill();
  }, [navigate]);

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
        throw new Error(data.message || data.error || "Login failed");
      }

      const adminInfo = {
        token: data.token,
        user: data.user,
        loginTime: new Date().toISOString(),
      };

      localStorage.setItem("adminInfo", JSON.stringify(adminInfo));
      setAuthDataForPasskeySetup(adminInfo);
      setShowPasskeyPrompt(true);
    } catch (error) {
      console.error("Admin login error:", error);
      setError(error.message || "Login failed. Please try again.");
      setLoading(false);
    }
  };

  const handlePasskeyRegistration = async () => {
    setPasskeyLoading(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/auth/webauthn/generate-registration-options`, {
        headers: {
          'Authorization': `Bearer ${authDataForPasskeySetup.token}`
        }
      });
      const options = await resp.json();
      
      if (options.error) throw new Error(options.error);

      const attResp = await startRegistration({ optionsJSON: options });

      const verificationResp = await fetch(`${API_BASE_URL}/auth/webauthn/verify-registration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authDataForPasskeySetup.token}`
        },
        body: JSON.stringify(attResp)
      });
      
      const verificationJSON = await verificationResp.json();
      if (verificationJSON.verified) {
        navigate("/admin/dashboard");
      } else {
        throw new Error(verificationJSON.error || "Registration verification failed");
      }
    } catch (err) {
      console.error("Passkey registration error:", err);
      let errMsg = err.message || "Passkey registration failed.";
      if (errMsg.includes("The operation either timed out or was not allowed")) {
        errMsg = "The operation timed out or was cancelled. Please try again.";
      } else if (errMsg.includes("RP ID")) {
        errMsg = "Passkey setup is not configured correctly for this domain. Please use password login.";
      }
      setPasskeyError(errMsg);
      // Don't navigate away if it failed, let them try again or skip manually
    } finally {
      setPasskeyLoading(false);
    }
  };

  const skipPasskeyRegistration = () => {
    setShowPasskeyPrompt(false);
    setPasskeyError("");
    navigate("/admin/dashboard");
  };

  const handlePasskeyLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(`${API_BASE_URL}/auth/webauthn/generate-authentication-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const data = await resp.json();
      if (data.error) throw new Error(data.error);

      const asseResp = await startAuthentication({ optionsJSON: data.options });

      const verificationResp = await fetch(`${API_BASE_URL}/auth/webauthn/verify-authentication`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: asseResp, sessionId: data.sessionId })
      });

      const verificationJSON = await verificationResp.json();
      if (verificationJSON.verified) {
        const adminInfo = {
          token: verificationJSON.token,
          user: verificationJSON.user,
          loginTime: new Date().toISOString(),
        };
        localStorage.setItem("adminInfo", JSON.stringify(adminInfo));
        navigate("/admin/dashboard");
      } else {
        throw new Error(verificationJSON.error || "Authentication verification failed");
      }
    } catch (err) {
      console.error(err);
      let errMsg = err.message || "Failed to authenticate with passkey.";
      if (errMsg.includes("The operation either timed out or was not allowed")) {
        errMsg = "The operation timed out or was cancelled. Please try again.";
      } else if (errMsg.includes("RP ID")) {
        errMsg = "Passkey login is not configured correctly for this domain. Please use password login.";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

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

      {/* ─── Passkey Setup Modal ─── */}
      {showPasskeyPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#00b4eb]/20 to-[#50b748]/20 rounded-full flex items-center justify-center mb-4 border border-[#00b4eb]/30">
                <Fingerprint className="h-8 w-8 text-[#00b4eb]" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Enable Passkey</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Log in faster and more securely using your device's fingerprint, face scan, or PIN.
              </p>
            </div>
            
            {passkeyError && (
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
                  {passkeyError}
                </span>
              </motion.div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={handlePasskeyRegistration}
                disabled={passkeyLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-300"
                style={{
                  background: "linear-gradient(135deg, #00b4eb, #50b748)",
                  boxShadow: "0 4px 15px rgba(0,180,235,0.3)",
                }}
              >
                {passkeyLoading ? (
                  <>
                    <div className="w-5 h-5 border-t-2 border-b-2 border-white rounded-full animate-spin" />
                    <span>Registering...</span>
                  </>
                ) : (
                  <>
                    <Fingerprint className="h-5 w-5" />
                    <span>Enable Passkey Setup</span>
                  </>
                )}
              </button>
              
              <button
                onClick={skipPasskeyRegistration}
                disabled={passkeyLoading}
                className="w-full flex items-center justify-center px-4 py-3 rounded-xl text-sm font-semibold text-white/60 hover:text-white transition-all bg-white/5 hover:bg-white/10"
              >
                Skip for now
              </button>
            </div>
          </motion.div>
        </div>
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
          className="w-full lg:w-[48%] xl:w-[46%] flex items-center justify-center min-h-screen lg:min-h-0 py-6 px-4 sm:p-6 lg:py-6 xl:py-8 lg:px-8"
        >
          <div className="w-full max-w-sm lg:max-w-md py-2">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
              className="mb-1 text-center"
            >
              <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight flex items-center justify-center gap-2">
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
              <p className="text-white/60 mt-1 text-xs sm:text-sm leading-relaxed max-w-sm mx-auto">
                Sign in with your administrator credentials to manage
                interns.
              </p>
            </motion.div>

            {/* ─── Login card ─── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="rounded-2xl overflow-hidden backdrop-blur-xl relative flex flex-col"
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

              <div className="p-5 sm:p-6 flex flex-col gap-4">
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

                {/* Top Section */}
                <div className="text-center flex-shrink-0">
                  <div
                    className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-xl flex items-center justify-center mb-2"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(0,180,235,0.15), rgba(80,183,72,0.15))",
                      border: "1px solid rgba(0,180,235,0.2)",
                    }}
                  >
                    <FaShieldAlt className="h-5 w-5 text-[#00b4eb]" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white mb-1">
                    Admin Login
                  </h3>
                  <p className="text-white/50 text-xs">
                    Enter your administrator credentials
                  </p>
                </div>

                {/* Middle Section */}
                <div className="flex flex-col">
                  {/* Login form */}
                  <form onSubmit={handleSubmit} className="space-y-2.5">
                    {/* Email field */}
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaUser className="h-3.5 w-3.5 text-white/40" />
                      </div>
                      <input
                        id="admin-email"
                        name="email"
                        type="email"
                        autoComplete="username webauthn"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        className="autofill-fix block w-full pl-9 pr-3 py-2.5 rounded-xl text-xs sm:text-sm text-white placeholder-white/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#00b4eb]/50"
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
                        <FaLock className="h-3.5 w-3.5 text-white/40" />
                      </div>
                      <input
                        id="admin-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={formData.password}
                        onChange={handleInputChange}
                        className="autofill-fix block w-full pl-9 pr-9 py-2.5 rounded-xl text-xs sm:text-sm text-white placeholder-white/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#00b4eb]/50"
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
                          <FaEyeSlash className="h-3.5 w-3.5 text-white/40 hover:text-white/70 transition-colors" />
                        ) : (
                          <FaEye className="h-3.5 w-3.5 text-white/40 hover:text-white/70 transition-colors" />
                        )}
                      </button>
                    </div>

                    {/* Submit button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
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
                          <div className="w-4 h-4 border-t-2 border-b-2 border-white rounded-full animate-spin" />
                          <span>Authenticating...</span>
                        </>
                      ) : (
                        <>
                          <FaShieldAlt className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
                          <span className="tracking-wider">ACCESS DASHBOARD</span>
                        </>
                      )}
                    </button>
                    
                    {/* Passkey Login Button */}
                    <button
                      type="button"
                      onClick={handlePasskeyLogin}
                      disabled={loading || googleLoading}
                      className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white transition-all duration-300 cursor-pointer disabled:opacity-50 group border border-[#00b4eb]/30 hover:border-[#00b4eb] bg-transparent"
                    >
                      <Fingerprint className="h-3.5 w-3.5 text-[#00b4eb]" />
                      <span>SIGN IN WITH PASSKEY</span>
                    </button>

                    {/* Google Sign-In Button */}
                    <button
                      type="button"
                      onClick={() => { setError(""); googleLogin(); }}
                      disabled={loading || googleLoading}
                      className="w-full flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 cursor-pointer disabled:opacity-50 group"
                      style={{
                        background: "rgba(255,255,255,0.92)",
                        color: "#3c3c3c",
                        border: "1px solid rgba(255,255,255,0.3)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(255,255,255,1)";
                        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.3)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.92)";
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      {googleLoading ? (
                        <>
                          <div className="w-4 h-4 border-t-2 border-b-2 border-[#4285f4] rounded-full animate-spin flex-shrink-0" />
                          <span style={{ color: "#3c3c3c" }}>Signing in...</span>
                        </>
                      ) : (
                        <>
                          {/* Google G logo SVG */}
                          <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          <span style={{ color: "#3c3c3c" }}>SIGN IN WITH GOOGLE</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Bottom Section */}
                <div className="flex-shrink-0 pt-1">
                  {/* Divider */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-[10px] sm:text-xs text-white/30 font-medium uppercase tracking-wider">
                      or
                    </span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  {/* Intern Login redirect */}
                  <button
                    onClick={() => navigate("/")}
                    className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 cursor-pointer group"
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
                    <GraduationCap className="h-3.5 w-3.5 text-[#50b748] group-hover:text-[#50b748]" />
                    <span className="text-white/70 group-hover:text-white">
                      Login as Intern
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-white/30 group-hover:text-white/60 ml-auto transition-transform group-hover:translate-x-0.5" />
                  </button>

                  <p className="text-center text-[11px] text-white/30 mt-1">
                    For interns and trainees only
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Footer */}
            <div className="lg:h-[70px] flex flex-col justify-start pt-3 sm:pt-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="text-center text-white/30 text-[11px] sm:text-xs"
            >

              <div className="flex flex-wrap justify-center items-center gap-x-3 sm:gap-x-4 gap-y-1 mt-1">
                <a href="#" className="hover:text-[#00b4eb] transition-colors">Privacy</a>
                <a href="#" className="hover:text-[#00b4eb] transition-colors">Terms</a>
                <a href="#" className="hover:text-[#00b4eb] transition-colors">Help</a>
                <span className="hidden sm:inline text-white/20">|</span>
                <p>© 2026 SLT Mobitel. All rights reserved.</p>
              </div>
            </motion.div>
            </div>
          </div>
        </motion.div>

        {/* ─── RIGHT PANEL: Admin feature showcase (hidden on mobile) ─── */}
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
              className="text-center mb-4"
            >
              <div className="flex items-center justify-center gap-4 mb-3">
                <div className="flex items-center justify-center gap-2 relative group shrink-0">
                  <img src={talentHubLogo} alt="TalentHub" className="relative w-10 h-10 xl:w-12 xl:h-12 object-contain rounded-xl border-2 border-white/20 shadow-lg" />
                  <img src={sltLogo} alt="SLT Mobitel Logo" className="relative w-10 h-10 xl:w-12 xl:h-12 object-contain rounded-xl border-2 border-white/20 shadow-lg bg-white" />
                  <img src={transzentLogo} alt="Transzent" className="relative w-10 h-10 xl:w-12 xl:h-12 object-contain rounded-xl border-2 border-white/20 shadow-lg bg-white" />
                </div>
                <div className="text-left">
                  <h2 className="text-xl xl:text-2xl font-extrabold text-white leading-tight tracking-tight mb-0.5">
                    TalentHub
                  </h2>
                  <p className="text-white/80 font-medium text-xs xl:text-sm">
                    Administration Portal
                  </p>
                </div>
              </div>
              <p className="text-white/50 text-[11px] xl:text-xs max-w-sm mx-auto leading-relaxed">
                Comprehensive tools for managing interns, attendance systems,
                leave requests, and workspace operations.
              </p>
            </motion.div>

            {/* Feature grid — showing top items from admin navLinks */}
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
                  whileHover={{ y: -3, scale: 1.01 }}
                  className="group rounded-xl p-3 cursor-default transition-all duration-300 flex flex-col justify-center"
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
                { value: "13+", label: "Modules" },
                { value: "Real-time", label: "Monitoring" },
                { value: "Secure", label: "Admin Access" },
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
