/**
 * TalentHubRestrictedModal.jsx
 *
 * Full-screen blocking page shown to interns whose TalentHub access
 * has been restricted due to no project enrollment.
 * Fully responsive – works on every screen size.
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  RefreshCw,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FolderOpen,
  UserCheck,
  ChevronRight,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

/* ── Floating particle ────────────────────────────────────────────────────── */
const Particle = ({ style }) => (
  <motion.div
    className="absolute rounded-full pointer-events-none"
    style={style}
    animate={{ y: [-12, 12, -12], opacity: [0.25, 0.6, 0.25] }}
    transition={{ duration: 4 + Math.random() * 3, repeat: Infinity, ease: "easeInOut" }}
  />
);

/* ── Step item ────────────────────────────────────────────────────────────── */
const Step = ({ icon: Icon, title, desc, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, x: -12 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.4 }}
    className={`flex items-start gap-3 p-3 rounded-2xl border ${color.bg} ${color.border}`}
  >
    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${color.icon}`}>
      <Icon className="w-4 h-4" />
    </div>
    <div className="min-w-0">
      <p className={`text-xs font-bold leading-tight ${color.title}`}>{title}</p>
      <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{desc}</p>
    </div>
  </motion.div>
);

/* ══ Main Component ══════════════════════════════════════════════════════════ */
const TalentHubRestrictedModal = ({ internName, reason, onRecheck }) => {
  const [checking, setChecking] = useState(false);
  const [recheckDone, setRecheckDone] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const navigate = useNavigate();

  /* Network status */
  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("internId");
    localStorage.removeItem("authToken");
    navigate("/");
  };

  const handleCheckStatus = async () => {
    if (checking || !online) return;
    setChecking(true);
    setRecheckDone(false);
    try {
      if (onRecheck) await onRecheck();
      setRecheckDone(true);
    } catch {
      toast.error("Could not re-verify status. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  /* Particles config */
  const particles = [
    { width: 6,  height: 6,  top: "12%", left: "8%",  background: "rgba(239,68,68,0.35)"  },
    { width: 8,  height: 8,  top: "70%", left: "5%",  background: "rgba(0,0,102,0.30)"    },
    { width: 5,  height: 5,  top: "20%", right: "6%", background: "rgba(239,68,68,0.25)"  },
    { width: 10, height: 10, top: "80%", right: "8%", background: "rgba(0,102,0,0.20)"    },
    { width: 4,  height: 4,  top: "45%", left: "3%",  background: "rgba(255,255,255,0.15)"},
    { width: 7,  height: 7,  top: "55%", right: "4%", background: "rgba(245,158,11,0.20)" },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto"
      style={{ background: "linear-gradient(145deg,#03001e 0%,#0a0030 35%,#020c1a 70%,#001800 100%)" }}
    >
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #ef4444, transparent)" }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-15 blur-3xl"
          style={{ background: "radial-gradient(circle, #006600, transparent)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5 blur-3xl"
          style={{ background: "radial-gradient(circle, #0056a2, transparent)" }} />
      </div>

      {/* Floating particles */}
      {particles.map((p, i) => <Particle key={i} style={p} />)}

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md mx-4 my-8 sm:my-auto overflow-hidden rounded-3xl shadow-2xl"
        style={{
          background: "linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
          border: "1px solid rgba(239,68,68,0.25)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Top gradient stripe */}
        <div className="h-1.5 w-full"
          style={{ background: "linear-gradient(90deg, #000066, #ef4444, #006600)" }} />

        {/* Network badge */}
        <div className="absolute top-5 right-5">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border
            ${online
              ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/50"
              : "bg-red-950/60 text-red-400 border-red-800/50"}`}
          >
            {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {online ? "Online" : "Offline"}
          </div>
        </div>

        <div className="px-5 sm:px-8 pt-8 pb-7 space-y-5">

          {/* ── Hero icon + title ── */}
          <div className="flex flex-col items-center text-center">
            {/* Pulsing ring + icon */}
            <div className="relative mb-5">
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 -m-3 rounded-3xl"
                style={{ background: "radial-gradient(circle, rgba(239,68,68,0.4), transparent)" }}
              />
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center shadow-xl"
                style={{ background: "linear-gradient(135deg, #7f1d1d, #ef4444)" }}
              >
                <ShieldAlert className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
              </motion.div>

              {/* Restricted badge */}
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 300 }}
                className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest"
                style={{ background: "linear-gradient(90deg,#7f1d1d,#ef4444)", color: "#fff", border: "2px solid rgba(0,0,0,0.3)" }}
              >
                Restricted
              </motion.span>
            </div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight"
            >
              TalentHub Access Restricted
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-sm text-slate-400 mt-1.5"
            >
              Hello,{" "}
              <span className="font-bold text-white">{internName || "Intern"}</span> 👋
            </motion.p>
          </div>

          {/* ── Reason box ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-2xl p-4 space-y-2.5"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
                Project Enrollment Required
              </span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              You are currently{" "}
              <span className="font-bold text-white">not enrolled in any project</span>{" "}
              and your TalentHub access has been temporarily suspended.
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Once you are enrolled in a project by your supervisor, your access will be{" "}
              <span className="text-emerald-400 font-semibold">automatically restored</span>.
            </p>

            {/* Custom reason note */}
            {reason && reason !== "No project assigned" && (
              <div className="pt-2.5 border-t border-red-900/40">
                <div className="flex items-start gap-2 text-xs text-amber-300/90">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed"><strong>Note:</strong> {reason}</span>
                </div>
              </div>
            )}
          </motion.div>

          {/* ── What to do steps ── */}
          <div className="space-y-2">
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest px-1">
              What to do next
            </p>
            <Step
              icon={UserCheck}
              title="Contact Your Supervisor"
              desc="Ask your supervisor to assign you to an active project."
              color={{ bg:"bg-blue-950/30", border:"border-blue-800/20", icon:"bg-blue-900/60 text-blue-400", title:"text-blue-200" }}
              delay={0.4}
            />
            <Step
              icon={FolderOpen}
              title="Get Project Enrolled"
              desc="Ensure your supervisor enrolls you in TalentTrail under a project."
              color={{ bg:"bg-purple-950/30", border:"border-purple-800/20", icon:"bg-purple-900/60 text-purple-400", title:"text-purple-200" }}
              delay={0.48}
            />
            <Step
              icon={CheckCircle2}
              title="Access Restored Automatically"
              desc="Once enrolled, click 'Check Access Status' below to unlock."
              color={{ bg:"bg-emerald-950/30", border:"border-emerald-800/20", icon:"bg-emerald-900/60 text-emerald-400", title:"text-emerald-200" }}
              delay={0.56}
            />
          </div>

          {/* ── Re-check result ── */}
          <AnimatePresence>
            {recheckDone && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-2xl p-3.5 flex items-center gap-3"
                style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }}
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-400">Status checked!</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Still restricted. Please ensure your supervisor has enrolled you.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Action buttons ── */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            {/* Primary: Check status */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleCheckStatus}
              disabled={checking || !online}
              className="flex-1 flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-2xl font-bold text-sm text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #000066, #0056a2)" }}
            >
              {/* Shimmer */}
              {!checking && (
                <motion.div
                  animate={{ x: [-120, 200] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
                  className="absolute inset-y-0 w-24 pointer-events-none"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)", skewX: "-20deg" }}
                />
              )}
              <RefreshCw className={`w-4 h-4 flex-shrink-0 ${checking ? "animate-spin" : ""}`} />
              <span>{checking ? "Checking Status…" : "Check Access Status"}</span>
              {!checking && <ChevronRight className="w-4 h-4 opacity-60" />}
            </motion.button>

            {/* Secondary: Sign out */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleLogout}
              className="sm:w-auto flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl font-bold text-sm transition-all cursor-pointer"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.6)",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.10)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              Sign Out
            </motion.button>
          </div>

          {/* Footer note */}
          <p className="text-center text-[10px] text-slate-600 leading-relaxed pt-1">
            If you believe this is a mistake, contact your{" "}
            <span className="text-slate-400 font-semibold">TalentHub Administrator</span>.
          </p>
        </div>

        {/* Bottom gradient stripe */}
        <div className="h-1 w-full"
          style={{ background: "linear-gradient(90deg, #006600, #0056a2, #000066)" }} />
      </motion.div>
    </div>
  );
};

export default TalentHubRestrictedModal;
