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

  const colors = {
    1: { bar: "bg-red-500",    barInactive: "bg-red-100",    text: "text-red-700",    bg: "bg-red-50",    border: "border-red-200"    },
    2: { bar: "bg-yellow-500", barInactive: "bg-yellow-100", text: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200" },
    3: { bar: "bg-green-500",  barInactive: "bg-green-100",  text: "text-green-700",  bg: "bg-green-50",  border: "border-green-200"  },
  };

  const c = colors[level] || colors[3];

  return (
    <div
      className={`mt-2 flex items-start gap-3 px-3 py-2.5 rounded-xl ${c.bg} border ${c.border} transition-all duration-300 animate-fade-in`}
    >
      <div className="flex items-end gap-[3px] pt-0.5 flex-shrink-0" aria-label={`Quality: ${label}`}>
        <div
          className={`w-[5px] rounded-sm transition-colors duration-300 ${
            level >= 1 ? c.bar : c.barInactive
          }`}
          style={{ height: "10px" }}
        />
        <div
          className={`w-[5px] rounded-sm transition-colors duration-300 ${
            level >= 2 ? c.bar : c.barInactive
          }`}
          style={{ height: "15px" }}
        />
        <div
          className={`w-[5px] rounded-sm transition-colors duration-300 ${
            level >= 3 ? c.bar : c.barInactive
          }`}
          style={{ height: "20px" }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <span className={`text-xs font-semibold ${c.text}`}>{label}</span>
        <p className={`text-xs ${c.text} mt-0.5 leading-relaxed opacity-90`}>
          {feedback}
        </p>
      </div>
    </div>
  );
};

export default EntryFeedbackIndicator;
