/**
 * leaveValidation.js — Validation utilities for leave requests
 */

function validateLeaveReason(reason) {
  if (!reason || typeof reason !== "string") {
    return {
      isValid: false,
      error: "Reason is required",
    };
  }

  const trimmed = reason.trim();
  if (trimmed.length < 10) {
    return {
      isValid: false,
      error: "Reason must be at least 10 characters long",
    };
  }

  // 1. Check for 3 or more consecutive identical characters (e.g., "aaaa", "1111", "....")
  if (/(.)\1{2,}/i.test(trimmed)) {
    return {
      isValid: false,
      error: "Reason cannot contain repeated single characters (e.g., 'aaaaaaaaaa')",
    };
  }

  // 2. Check for single character frequency dominance or lack of character variety
  const cleaned = trimmed.replace(/[\s\W_]/g, "").toLowerCase();
  if (cleaned.length >= 6) {
    const freq = {};
    for (const ch of cleaned) {
      freq[ch] = (freq[ch] || 0) + 1;
    }
    const maxFreq = Math.max(...Object.values(freq));
    if (maxFreq / cleaned.length > 0.5) {
      return {
        isValid: false,
        error: "Reason contains excessively repeated characters",
      };
    }

    if (cleaned.length >= 10 && new Set(cleaned).size < 3) {
      return {
        isValid: false,
        error: "Reason contains repetitive characters and lacks valid detail",
      };
    }
  }

  // 3. Check for repeating substring patterns (e.g., "abcabcabc", "asdfasdfasdf")
  if (cleaned.length >= 6) {
    for (let len = 2; len <= Math.min(10, Math.floor(cleaned.length / 2)); len++) {
      const pattern = cleaned.slice(0, len);
      let count = 0;
      let idx = 0;
      while (idx <= cleaned.length - len) {
        if (cleaned.slice(idx, idx + len) === pattern) {
          count++;
          idx += len;
        } else {
          idx++;
        }
      }
      if (count >= 3 && (count * len) / cleaned.length >= 0.7) {
        return {
          isValid: false,
          error: "Reason cannot contain repeating text patterns",
        };
      }
    }
  }

  // 4. Must contain meaningful alphabetic characters
  if (!/[a-zA-Z]/.test(trimmed)) {
    return {
      isValid: false,
      error: "Reason must contain valid descriptive text",
    };
  }

  return { isValid: true, error: "" };
}

module.exports = {
  validateLeaveReason,
};
