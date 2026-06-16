import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  evaluateLocalHeuristicsSync,
  validationResultToAssessment,
} from "../utils/entryHeuristics";

/**
 * EntryFeedbackIndicator
 *
 * Priority: local RED → forcedResult (level 2/3 from submit) → nothing
 *
 * Props:
 *   text          — current textarea value
 *   forcedResult  — { level, label, feedback, color } from batch validation
 */
const EntryFeedbackIndicator = ({ text, forcedResult = null }) => {
  const [localAssessment, setLocalAssessment] = useState({ level: 0 });
  const debounceLocalRef = useRef(null);

  useEffect(() => {
    if (debounceLocalRef.current) clearTimeout(debounceLocalRef.current);

    if (!text || text.trim().length === 0) {
      setLocalAssessment({ level: 0 });
      return;
    }

    debounceLocalRef.current = setTimeout(() => {
      const localResult = evaluateLocalHeuristicsSync(text);
      setLocalAssessment(localResult || { level: 0 });
    }, 500);

    return () => {
      clearTimeout(debounceLocalRef.current);
    };
  }, [text]);

  const displayAssessment = useMemo(() => {
    if (!text || text.trim().length === 0) return null;

    if (localAssessment.level === 1) {
      return localAssessment;
    }

    if (forcedResult) {
      if (typeof forcedResult.level === "number") {
        return forcedResult;
      }
      return validationResultToAssessment(forcedResult);
    }

    return null;
  }, [text, localAssessment, forcedResult]);

  if (!displayAssessment || displayAssessment.level === 0) return null;

  const { level, label, feedback } = displayAssessment;

  /* ── Color palettes matching LogBook's inline-style approach ────────── */
  const palettes = {
    1: {
      primary: "#c0392b",
      light: "#e74c3c",
      bg: "rgba(231, 76, 60, 0.06)",
      border: "rgba(231, 76, 60, 0.25)",
      barActive: "linear-gradient(to top, #c0392b, #e74c3c)",
      barInactive: "#fdecea",
      textColor: "#991b1b",
      iconBg: "#fdecea",
    },
    2: {
      primary: "#b45309",
      light: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.06)",
      border: "rgba(245, 158, 11, 0.25)",
      barActive: "linear-gradient(to top, #d97706, #f59e0b)",
      barInactive: "#fef3c7",
      textColor: "#92400e",
      iconBg: "#fffbeb",
    },
    3: {
      primary: "#2d8a3e",
      light: "#50b748",
      bg: "rgba(80, 183, 72, 0.06)",
      border: "rgba(80, 183, 72, 0.25)",
      barActive: "linear-gradient(to top, #2d8a3e, #50b748)",
      barInactive: "#edf7ec",
      textColor: "#166534",
      iconBg: "#f0fdf4",
    },
  };

  const p = palettes[level] || palettes[3];

  const bars = [
    { minLevel: 1, height: 12 },
    { minLevel: 2, height: 17 },
    { minLevel: 3, height: 22 },
  ];

  return (
    <div
      className="logbook-fade-in"
      style={{
        marginTop: 8,
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 14,
        background: p.bg,
        border: `1px solid ${p.border}`,
        transition: "all 0.3s ease",
      }}
    >
      {/* Capsule pill signal bars */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 3,
          paddingTop: 2,
          flexShrink: 0,
        }}
        aria-label={`Quality: ${label}`}
      >
        {bars.map((barDef, i) => {
          const isActive = level >= barDef.minLevel;
          return (
            <div
              key={i}
              style={{
                width: 5,
                height: barDef.height,
                borderRadius: 999,
                background: isActive ? p.barActive : p.barInactive,
                boxShadow: isActive ? `0 0 6px ${p.border}` : "none",
                transition: "all 0.4s ease",
              }}
            />
          );
        })}
      </div>

      {/* Text content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: p.textColor,
            letterSpacing: 0.2,
          }}
        >
          {label}
        </span>
        <p
          style={{
            fontSize: 12,
            color: p.textColor,
            marginTop: 2,
            lineHeight: 1.5,
            opacity: 0.85,
            margin: "2px 0 0 0",
          }}
        >
          {feedback}
        </p>
      </div>
    </div>
  );
};

export default EntryFeedbackIndicator;
