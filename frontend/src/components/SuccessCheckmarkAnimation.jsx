import React, { useEffect } from "react";

/**
 * Lightweight success overlay — animated checkmark, then onComplete.
 */
const SuccessCheckmarkAnimation = ({ onComplete, duration = 800 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, duration);
    return () => clearTimeout(timer);
  }, [onComplete, duration]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/30 z-50 pointer-events-none"
      aria-live="polite"
      aria-label="Validation successful"
    >
      <div className="bg-white rounded-full p-4 shadow-xl">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <circle
            cx="32"
            cy="32"
            r="28"
            stroke="#10B981"
            strokeWidth="3"
            strokeDasharray="176"
            strokeDashoffset="176"
            className="animate-draw-circle"
          />
          <path
            d="M20 32 L28 40 L44 24"
            stroke="#10B981"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="36"
            strokeDashoffset="36"
            className="animate-draw-check"
          />
        </svg>
      </div>
    </div>
  );
};

export default SuccessCheckmarkAnimation;
