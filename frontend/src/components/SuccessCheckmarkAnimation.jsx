import React, { useEffect } from "react";

/**
 * Lightweight success overlay — animated checkmark, then onComplete.
 * Styled with inline styles to match LogBook.jsx design language.
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
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        pointerEvents: "none",
        background:
          "radial-gradient(ellipse at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.15) 100%)",
      }}
      aria-live="polite"
      aria-label="Validation successful"
    >
      {/* Expanding radial pulse ring */}
      <div
        className="logbook-expand-ring"
        style={{
          position: "absolute",
          width: 120,
          height: 120,
          borderRadius: "50%",
          border: "3px solid rgba(80, 183, 72, 0.3)",
        }}
      />

      {/* Main checkmark container */}
      <div
        className="logbook-scale-in"
        style={{
          borderRadius: "50%",
          padding: 18,
          background: "linear-gradient(135deg, #ffffff 0%, #f0fdf0 100%)",
          boxShadow:
            "0 8px 32px rgba(80, 183, 72, 0.2), 0 0 0 1px rgba(80, 183, 72, 0.08)",
        }}
      >
        <svg
          width="80"
          height="80"
          viewBox="0 0 80 80"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="40"
            cy="40"
            r="35"
            stroke="#50b748"
            strokeWidth="3"
            strokeDasharray="220"
            strokeDashoffset="220"
            className="animate-draw-circle"
          />
          <path
            d="M24 40 L34 50 L56 28"
            stroke="#50b748"
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="48"
            strokeDashoffset="48"
            className="animate-draw-check"
          />
        </svg>
      </div>
    </div>
  );
};

export default SuccessCheckmarkAnimation;
