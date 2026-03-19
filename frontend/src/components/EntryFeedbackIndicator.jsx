import React, { useState, useEffect, useRef } from "react";
import { assessEntryQuality, evaluateLocalHeuristicsSync } from "../utils/entryHeuristics";

/**
 * EntryFeedbackIndicator
 *
 * A real-time visual quality indicator for logbook textarea fields.
 * Shows 1–3 colored bars (signal-strength style) with actionable feedback
 * based on Formative Feedback Theory by Hattie & Timperley.
 *
 * Props:
 *   text  — current value of the textarea
 */
const EntryFeedbackIndicator = ({ text }) => {
  const [assessment, setAssessment] = useState({ level: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const debounceLocalRef = useRef(null);
  const debounceLLMRef = useRef(null);

  useEffect(() => {
    if (debounceLocalRef.current) clearTimeout(debounceLocalRef.current);
    if (debounceLLMRef.current) clearTimeout(debounceLLMRef.current);

    if (!text || text.trim().length === 0) {
      setAssessment({ level: 0 });
      setIsLoading(false);
      return;
    }

    // 1. Fast local check (0.5s debounce)
    debounceLocalRef.current = setTimeout(() => {
      const localResult = evaluateLocalHeuristicsSync(text);
      if (localResult) {
        // It failed local checks (RED)
        setAssessment(localResult);
        setIsLoading(false);
        // Clear the LLM timer so we don't call the API for RED entries
        if (debounceLLMRef.current) clearTimeout(debounceLLMRef.current);
      } else {
        // Passed local checks. Show loader while waiting for LLM check
        setIsLoading(true);
      }
    }, 500);

    // 2. Slow LLM check (2.5s debounce for YELLOW/GREEN via API)
    debounceLLMRef.current = setTimeout(async () => {
      try {
        const result = await assessEntryQuality(text);
        setAssessment(result);
      } catch (err) {
        console.error("Assessment error", err);
      } finally {
        setIsLoading(false);
      }
    }, 2500);

    return () => {
      clearTimeout(debounceLocalRef.current);
      clearTimeout(debounceLLMRef.current);
    };
  }, [text]);

  if (!text || text.trim().length === 0) return null;

  if (isLoading) {
    return (
      <div className="mt-2 flex items-start gap-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 animate-pulse">
        <div className="flex items-end gap-[3px] pt-0.5 flex-shrink-0">
          <div className="w-[5px] rounded-sm bg-gray-300" style={{ height: "10px" }} />
          <div className="w-[5px] rounded-sm bg-gray-200" style={{ height: "15px" }} />
          <div className="w-[5px] rounded-sm bg-gray-100" style={{ height: "20px" }} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-gray-500">Evaluating...</span>
          <p className="text-xs text-gray-400 mt-0.5">Checking entry quality with AI...</p>
        </div>
      </div>
    );
  }

  if (assessment.level === 0) return null;

  const { level, label, feedback } = assessment;

  // Color mapping
  const colors = {
    1: { bar: "bg-red-500",    barInactive: "bg-red-100",    text: "text-red-700",    bg: "bg-red-50",    border: "border-red-200",    icon: "text-red-500"    },
    2: { bar: "bg-yellow-500", barInactive: "bg-yellow-100", text: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200", icon: "text-yellow-500" },
    3: { bar: "bg-green-500",  barInactive: "bg-green-100",  text: "text-green-700",  bg: "bg-green-50",  border: "border-green-200",  icon: "text-green-500"  },
  };

  const c = colors[level];

  return (
    <div
      className={`mt-2 flex items-start gap-3 px-3 py-2.5 rounded-xl ${c.bg} border ${c.border} transition-all duration-300 animate-fade-in`}
    >
      {/* Signal bars */}
      <div className="flex items-end gap-[3px] pt-0.5 flex-shrink-0" aria-label={`Quality: ${label}`}>
        {/* Bar 1 — always colored at level ≥ 1 */}
        <div
          className={`w-[5px] rounded-sm transition-colors duration-300 ${
            level >= 1 ? c.bar : c.barInactive
          }`}
          style={{ height: "10px" }}
        />
        {/* Bar 2 — colored at level ≥ 2 */}
        <div
          className={`w-[5px] rounded-sm transition-colors duration-300 ${
            level >= 2 ? c.bar : c.barInactive
          }`}
          style={{ height: "15px" }}
        />
        {/* Bar 3 — colored at level ≥ 3 */}
        <div
          className={`w-[5px] rounded-sm transition-colors duration-300 ${
            level >= 3 ? c.bar : c.barInactive
          }`}
          style={{ height: "20px" }}
        />
      </div>

      {/* Feedback text */}
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
