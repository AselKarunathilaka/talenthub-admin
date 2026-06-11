import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, ChevronRight, ChevronLeft } from "lucide-react";
import { api } from "../utils/api";

const FeatureTipModal = () => {
  const [tips, setTips] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTips = async () => {
      try {
        const res = await api.get("/feature-tips/unseen");
        if (res && res.length > 0) {
          setTips(res);
          setIsOpen(true);
        }
      } catch (err) {
        console.error("Failed to fetch feature tips", err);
      }
    };

    // Small delay to let dashboard load smoothly first
    const timer = setTimeout(fetchTips, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = async () => {
    if (!tips[currentIndex]) return;
    const currentTip = tips[currentIndex];

    setLoading(true);
    try {
      await api.post("/feature-tips/mark-seen", { tipId: currentTip._id });
      
      // Move to next tip or close
      if (currentIndex < tips.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setIsOpen(false);
      }
    } catch (err) {
      console.error("Failed to mark tip as seen", err);
      // Close anyway so we don't block the user
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSkipAll = async () => {
    setLoading(true);
    try {
      // Mark all remaining tips as seen
      for (let i = currentIndex; i < tips.length; i++) {
        await api.post("/feature-tips/mark-seen", { tipId: tips[i]._id });
      }
    } catch (err) {
      console.error("Failed to skip all tips", err);
    } finally {
      setIsOpen(false);
      setLoading(false);
    }
  };

  if (!isOpen || tips.length === 0) return null;

  const currentTip = tips[currentIndex];
  const color = currentTip.color || "#0ea5e9"; // Default blue
  const emoji = currentTip.emoji || "✨";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            key={currentTip._id}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header Banner */}
            <div 
              className="px-6 py-8 text-center text-white relative overflow-hidden"
              style={{ backgroundColor: color }}
            >
              {/* Decorative background shapes */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl -mr-10 -mt-10"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-black opacity-10 rounded-full blur-xl -ml-10 -mb-10"></div>
              
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-lg border border-white/30">
                  {emoji}
                </div>
                {currentTip.section && (
                  <span className="px-3 py-1 bg-black/20 rounded-full text-xs font-semibold tracking-wide uppercase mb-2">
                    {currentTip.section}
                  </span>
                )}
                <h3 className="text-xl sm:text-2xl font-bold leading-tight">
                  {currentTip.title}
                </h3>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6 bg-white">
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                {currentTip.description}
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-2 flex flex-col gap-3">
              <button
                onClick={handleDismiss}
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-white shadow-lg shadow-blue-500/30 transition-transform active:scale-95 flex justify-center items-center gap-2"
                style={{ backgroundColor: color }}
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    {currentIndex < tips.length - 1 ? "Next Tip" : "Got it!"}
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>

              {tips.length > 1 && currentIndex < tips.length - 1 && (
                <button
                  onClick={handleSkipAll}
                  disabled={loading}
                  className="w-full py-2 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Skip all tips
                </button>
              )}
            </div>

            {/* Progress Indicators */}
            {tips.length > 1 && (
              <div className="absolute top-4 left-0 w-full flex justify-center gap-1.5 z-20">
                {tips.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === currentIndex ? "w-6 bg-white" : "w-1.5 bg-white/40"
                    }`}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default FeatureTipModal;
