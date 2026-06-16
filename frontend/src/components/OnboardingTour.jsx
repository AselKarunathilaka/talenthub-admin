import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  ScanLine,
  BookOpen,
  FileText,
  GraduationCap,
  Armchair,
  Megaphone,
  Rocket,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { api } from "../utils/api";

// ─────────────────────────────────────────────────────────────────────────────
// TOUR VERSION — bump this string whenever you ship a new feature.
// All interns whose `tourSeenVersion` does not match will see the tour again
// (only the slides marked `isNew: true`).
// ─────────────────────────────────────────────────────────────────────────────
export const TOUR_VERSION = "v1.0-initial";

// ─────────────────────────────────────────────────────────────────────────────
// TOUR STEPS
// isNew: true  → shown for both new interns AND returning interns on feature updates
// isNew: false → shown only for brand-new interns (full onboarding)
// ─────────────────────────────────────────────────────────────────────────────
const ALL_STEPS = [
  {
    id: "welcome",
    isNew: false,
    icon: <Sparkles className="w-10 h-10" />,
    iconBg: "from-violet-500 to-purple-600",
    title: "Welcome to TalentHub! 🎉",
    description:
      "This portal is your one-stop for attendance, logbook, leave requests, seat reservation, and announcements. Let us give you a quick tour!",
    color: "#7c3aed",
  },
  {
    id: "dashboard",
    isNew: false,
    icon: <Home className="w-10 h-10" />,
    iconBg: "from-cyan-500 to-blue-600",
    title: "Dashboard",
    description:
      "Your home base. See your profile details, training period, assigned projects, and a full overview of your attendance at a glance.",
    color: "#0ea5e9",
    section: "Dashboard",
  },
  {
    id: "attendance",
    isNew: false,
    icon: <ScanLine className="w-10 h-10" />,
    iconBg: "from-yellow-400 to-orange-500",
    title: "Attendance",
    description:
      "Mark your daily attendance by scanning a QR code or using face recognition. You can also check your attendance history and stats here.",
    color: "#f59e0b",
    section: "Attendance",
  },
  {
    id: "logbook",
    isNew: false,
    icon: <BookOpen className="w-10 h-10" />,
    iconBg: "from-emerald-500 to-green-600",
    title: "Log Book",
    description:
      "Write your daily tasks, learnings, and progress notes. Your supervisors review your logbook regularly — keep it detailed and up to date!",
    color: "#10b981",
    section: "Log Book",
  },
  {
    id: "shortleave",
    isNew: false,
    icon: <FileText className="w-10 h-10" />,
    iconBg: "from-purple-500 to-violet-600",
    title: "Short Leave",
    description:
      "Need to leave early or arrive late? Submit a short leave pass here with your reason and time. Your request goes straight to the supervisor.",
    color: "#8b5cf6",
    section: "Short Leave",
  },
  {
    id: "extendedleave",
    isNew: false,
    icon: <GraduationCap className="w-10 h-10" />,
    iconBg: "from-orange-400 to-red-500",
    title: "Extended Leave",
    description:
      "For medical leave, study leave, or any extended absence, submit your request here and upload the required supporting documents.",
    color: "#f97316",
    section: "Extended Leave",
  },
  {
    id: "seat",
    isNew: false,
    icon: <Armchair className="w-10 h-10" />,
    iconBg: "from-pink-500 to-rose-600",
    title: "Seat Reservation",
    description:
      "Reserve your seat in advance so you always have a spot when you come in. Check seat availability and manage your reservations easily.",
    color: "#ec4899",
    section: "Seat Reservation",
  },
  {
    id: "announcements",
    isNew: false,
    icon: <Megaphone className="w-10 h-10" />,
    iconBg: "from-red-500 to-rose-600",
    title: "Announcements",
    description:
      "Stay updated with important notices from your supervisors and management. A badge on the bell icon will alert you when new announcements arrive.",
    color: "#ef4444",
    section: "Announcements",
  },
  {
    id: "done",
    isNew: false,
    icon: <Rocket className="w-10 h-10" />,
    iconBg: "from-green-400 to-emerald-600",
    title: "You're all set! 🚀",
    description:
      "Your TalentHub profile is ready. Explore every section and make the most of your internship. Good luck and have a great journey!",
    color: "#22c55e",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Confetti particle (used on the final slide for new interns)
// ─────────────────────────────────────────────────────────────────────────────
const Confetti = () => {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: 1.5 + Math.random() * 1.5,
    color: ["#7c3aed", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#ef4444"][
      Math.floor(Math.random() * 6)
    ],
    size: 6 + Math.random() * 8,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            top: "-10px",
            width: p.size,
            height: p.size,
            background: p.color,
          }}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{ y: 400, opacity: 0, rotate: 360 }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: "easeIn",
          }}
        />
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
const OnboardingTour = ({ internData, internId, isNewIntern }) => {
  const [visible, setVisible] = useState(false);
  const [steps, setSteps] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward

  // Determine which slides to show
  useEffect(() => {
    if (!internData || !internId) return;

    const seenVersion = internData.tourSeenVersion ?? null;

    let stepsToShow = [];

    if (seenVersion === null) {
      // Brand-new intern — show all slides
      stepsToShow = ALL_STEPS;
    } else if (seenVersion !== TOUR_VERSION) {
      // Existing intern seeing a new feature — show only new slides
      stepsToShow = ALL_STEPS.filter((s) => s.isNew);
    }

    if (stepsToShow.length > 0) {
      setSteps(stepsToShow);
      setVisible(true);
    }
  }, [internData, internId]);

  const markSeen = useCallback(async () => {
    if (!internId) return;
    try {
      await api.patch(`/interns/${internId}/tour-seen`, { version: TOUR_VERSION });
    } catch (e) {
      // Non-critical — silently ignore
    }
  }, [internId]);

  const close = useCallback(async () => {
    setVisible(false);
    await markSeen();
  }, [markSeen]);

  const goNext = () => {
    if (currentIndex < steps.length - 1) {
      setDirection(1);
      setCurrentIndex((i) => i + 1);
    } else {
      close();
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex((i) => i - 1);
    }
  };

  if (!visible || steps.length === 0) return null;

  const step = steps[currentIndex];
  const isLast = currentIndex === steps.length - 1;
  const isFirst = currentIndex === 0;

  const slideVariants = {
    enter: (dir) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <AnimatePresence>
      {visible && (
        // Backdrop
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
        >
          {/* Modal card */}
          <motion.div
            className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 30 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            {/* Animated gradient background that matches each step */}
            <motion.div
              className="absolute inset-0"
              animate={{ background: `linear-gradient(135deg, ${step.color}18 0%, #111827 60%)` }}
              transition={{ duration: 0.5 }}
            />

            {/* Confetti on final slide (new interns only) */}
            {isLast && isNewIntern && <Confetti />}

            {/* Content */}
            <div className="relative z-10 bg-gray-900/90 backdrop-blur-xl border border-white/10 rounded-3xl p-7">

              {/* Top row: step label + skip */}
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-semibold text-white/40 uppercase tracking-widest">
                  {isNewIntern && steps.length === ALL_STEPS.length
                    ? `Getting started • ${currentIndex + 1} / ${steps.length}`
                    : `What's new • ${currentIndex + 1} / ${steps.length}`}
                </span>
                <button
                  onClick={close}
                  className="p-1.5 rounded-full text-white/30 hover:text-white hover:bg-white/10 transition-all"
                  aria-label="Skip tour"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Slide content */}
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step.id}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.28, ease: "easeInOut" }}
                >
                  {/* Icon */}
                  <div className="flex justify-center mb-6">
                    <motion.div
                      className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.iconBg} flex items-center justify-center text-white shadow-xl`}
                      initial={{ scale: 0.7, rotate: -10 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.05 }}
                    >
                      {step.icon}
                    </motion.div>
                  </div>

                  {/* Text */}
                  <h2 className="text-2xl font-extrabold text-white text-center mb-3 leading-tight">
                    {step.title}
                  </h2>
                  <p className="text-white/60 text-center text-sm leading-relaxed">
                    {step.description}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Progress dots */}
              <div className="flex justify-center gap-2 mt-7 mb-6">
                {steps.map((_, i) => (
                  <motion.button
                    key={i}
                    onClick={() => {
                      setDirection(i > currentIndex ? 1 : -1);
                      setCurrentIndex(i);
                    }}
                    className="rounded-full transition-all focus:outline-none"
                    animate={{
                      width: i === currentIndex ? 24 : 8,
                      background: i === currentIndex ? step.color : "rgba(255,255,255,0.2)",
                    }}
                    style={{ height: 8 }}
                    transition={{ duration: 0.3 }}
                    aria-label={`Go to step ${i + 1}`}
                  />
                ))}
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center gap-3">
                {/* Prev */}
                <button
                  onClick={goPrev}
                  disabled={isFirst}
                  className="flex-shrink-0 p-3 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/30 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Next / Finish */}
                <motion.button
                  onClick={goNext}
                  className="flex-1 py-3 px-6 rounded-xl font-bold text-white text-sm shadow-lg transition-all"
                  style={{ background: `linear-gradient(135deg, ${step.color}, ${step.color}cc)` }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {isLast ? "Got it! Let's go 🚀" : (
                    <span className="flex items-center justify-center gap-1">
                      Next <ChevronRight className="w-4 h-4" />
                    </span>
                  )}
                </motion.button>
              </div>

              {/* Skip link */}
              {!isLast && (
                <div className="mt-4 text-center">
                  <button
                    onClick={close}
                    className="text-xs text-white/30 hover:text-white/60 transition-colors"
                  >
                    Skip tour
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OnboardingTour;
