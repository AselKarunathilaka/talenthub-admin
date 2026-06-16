/**
 * SectionTip.jsx
 *
 * A dismissable, animated tip banner that appears at the top of each section
 * page the first time an intern visits it. Each tip has its own localStorage
 * key so dismissing one section doesn't affect others.
 *
 * Usage:
 *   <SectionTip sectionKey="logbook" />
 *
 * To show the tip again for a new feature, bump the TIPS object version number:
 *   sectionKey: { version: 2, ... }
 * The tip will re-appear for users who saw version 1.
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lightbulb, ChevronDown } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Tip definitions — one per section.
// Bump `version` when you update a tip so existing interns see it again.
// ─────────────────────────────────────────────────────────────────────────────
export const TIPS = {
  dashboard: {
    version: 1,
    color: "#0ea5e9",
    gradient: "linear-gradient(135deg, #0ea5e9, #0056a2)",
    title: "Welcome to your Dashboard 👋",
    bullets: [
      "View your full profile, training period, and assigned projects at a glance.",
      "Switch between Meeting Attendance and Daily Attendance using the tab above.",
      "Check how many days remain in your internship using the countdown badge.",
    ],
  },
  attendance: {
    version: 2,
    color: "#f59e0b",
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    title: "How to mark your Attendance 📍",
    bullets: [
      "Scan the QR code displayed by your supervisor to mark daily or meeting attendance.",
      "Use Face Recognition for hands-free attendance if you've enrolled your face.",
      "Check your attendance history and rate on the Dashboard.",
    ],
  },
  logbook: {
    version: 1,
    color: "#10b981",
    gradient: "linear-gradient(135deg, #10b981, #059669)",
    title: "How to use the Log Book 📓",
    bullets: [
      "Select your status (Working / WFH / On Leave) to begin your daily entry.",
      "Pick your tech stack and fill in Tasks, Challenges, and Plans for the day.",
      "Submit before the end of the day — supervisors review your entries regularly!",
    ],
  },
  shortleave: {
    version: 1,
    color: "#8b5cf6",
    gradient: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
    title: "Requesting a Short Leave ⏱️",
    bullets: [
      "Submit a short leave request with your reason and the time you need.",
      "Your supervisor will review and approve or reject the request.",
      "You will receive a leave pass link via email if approved.",
    ],
  },
  extendedleave: {
    version: 1,
    color: "#f97316",
    gradient: "linear-gradient(135deg, #f97316, #ea580c)",
    title: "Extended & Study Leave 🎓",
    bullets: [
      "Use this for medical, personal, or study-related extended absences.",
      "Upload supporting documents (medical certificate, exam slip, etc.) with your request.",
      "Approved leave will reflect in your daily attendance record as 'Leave'.",
    ],
  },
  seat: {
    version: 1,
    color: "#ec4899",
    gradient: "linear-gradient(135deg, #ec4899, #be185d)",
    title: "Reserving your Seat 🪑",
    bullets: [
      "Browse available seats on the floor map and click to reserve one for the day.",
      "Reservations are for the current day only — reserve each morning.",
      "Your seat will be released automatically at 5:30 PM if unused.",
    ],
  },
  announcements: {
    version: 1,
    color: "#ef4444",
    gradient: "linear-gradient(135deg, #ef4444, #dc2626)",
    title: "Stay updated with Announcements 📢",
    bullets: [
      "All important notices from supervisors and management appear here.",
      "A red badge on the bell icon tells you how many unread announcements you have.",
      "Click any announcement card to read the full details.",
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const storageKey = (sectionKey, version) =>
  `sectionTipDismissed_${sectionKey}_v${version}`;

const isDismissed = (sectionKey, version) =>
  localStorage.getItem(storageKey(sectionKey, version)) === "true";

const markDismissed = (sectionKey, version) =>
  localStorage.setItem(storageKey(sectionKey, version), "true");

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
const SectionTip = ({ sectionKey }) => {
  const tip = TIPS[sectionKey];
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!tip) return;
    if (!isDismissed(sectionKey, tip.version)) {
      // Slight delay so the page content loads first
      const t = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(t);
    }
  }, [sectionKey, tip]);

  const dismiss = () => {
    if (tip) markDismissed(sectionKey, tip.version);
    setVisible(false);
  };

  if (!tip || !visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className="mb-6 relative"
        >
          {/* Pointer arrow at top-left */}
          <div
            className="absolute -top-2.5 left-8 w-5 h-5 rotate-45 rounded-sm"
            style={{ background: tip.color, opacity: 0.9 }}
          />

          <div
            className="rounded-2xl overflow-hidden shadow-lg"
            style={{
              border: `1.5px solid ${tip.color}40`,
              background: `${tip.color}08`,
            }}
          >
            {/* Header bar */}
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{ background: tip.gradient }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Lightbulb className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-white text-sm tracking-wide">
                  💡 {tip.title}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {/* Expand / collapse toggle on mobile */}
                <button
                  onClick={() => setExpanded((e) => !e)}
                  className="sm:hidden p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
                  aria-label="Expand tip"
                >
                  <motion.div
                    animate={{ rotate: expanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </motion.div>
                </button>

                {/* Dismiss */}
                <button
                  onClick={dismiss}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/25 text-white transition-all"
                  aria-label="Dismiss tip"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bullet list — always visible on sm+, toggle on mobile */}
            <motion.div
              className={`px-5 py-4 ${expanded ? "block" : "hidden sm:block"}`}
            >
              <ul className="space-y-2.5">
                {tip.bullets.map((bullet, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i + 0.15 }}
                    className="flex items-start gap-3 text-sm"
                  >
                    {/* Colored bullet dot */}
                    <span
                      className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: tip.color }}
                    />
                    <span className="text-gray-700 leading-relaxed">{bullet}</span>
                  </motion.li>
                ))}
              </ul>

              <button
                onClick={dismiss}
                className="mt-4 text-xs font-semibold transition-colors"
                style={{ color: tip.color }}
              >
                Got it, don't show again →
              </button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SectionTip;
