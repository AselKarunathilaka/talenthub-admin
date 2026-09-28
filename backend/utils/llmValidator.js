require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");

// ── Model names ───────────────────────────────────────────────────────────────
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const GROQ_MODEL   = process.env.GROQ_MODEL   || "openai/gpt-oss-20b";

const BATCH_FIELD_KEYS = ["tasks", "challenges", "plans"];

// ── Shared prompt ─────────────────────────────────────────────────────────────
const LENIENT_BATCH_PROMPT = (tasks, challenges, plans) => `
You are a very lenient internship logbook validator. Your only job is to detect if a sentence is COMPLETELY UNRELATED to any kind of work or learning activity.

Work-related means: software development, IT, design, project management, research, documentation, meetings, learning a tool, fixing bugs, writing code, testing, deploying, planning, analysis, or any professional task.

Non-work-related means: personal life (eating, sleeping, walking dog), entertainment (movies, games), random facts about the universe, or anything that has nothing to do with an internship.

Evaluate these three fields:

Tasks: ${JSON.stringify(tasks)}
Challenges: ${JSON.stringify(challenges)}
Plans: ${JSON.stringify(plans)}

For each field, return:
- "valid": true if it is at least vaguely work-related (even if grammar is bad or it's short but not empty)
- "valid": false only if it is clearly non-work-related (e.g., "I ate pizza", "Watched Netflix")

Return JSON:
{
  "tasks": { "valid": true/false, "reason": "short reason if false" },
  "challenges": { "valid": true/false, "reason": "..." },
  "plans": { "valid": true/false, "reason": "..." }
}

Do not check grammar, spelling, length (already handled by heuristics), or vagueness. Only check if the content is completely unrelated to work.
Return ONLY valid JSON, no markdown.
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeFieldResult(raw) {
  if (!raw || typeof raw !== "object") {
    console.warn("[LLM VALIDATOR] ⚠️  Malformed field result, defaulting to invalid:", raw);
    return { valid: false, reason: "Could not verify this entry. Please try again." };
  }
  return {
    valid: raw.valid !== false,
    reason: typeof raw.reason === "string" ? raw.reason : "",
  };
}

function emptyFieldPass() {
  return { valid: true, reason: "" };
}

function isQuotaError(error) {
  if (!error) return false;
  if (error.status === 429 || error.status === 503) return true;
  const msg = (error.message || "").toLowerCase();
  return (
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("resource_exhausted") ||
    msg.includes("ratelimitexceeded") ||
    msg.includes("429") ||
    msg.includes("503") ||
    msg.includes("overloaded") ||
    msg.includes("unavailable") ||
    msg.includes("timeout") ||
    msg.includes("fetch")
  );
}

// ── JSON extraction helper (strips markdown fences) ───────────────────────────
function extractJson(text) {
  let clean = text.trim();
  clean = clean.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
  const start = clean.indexOf("{");
  const end   = clean.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end >= start) {
    clean = clean.substring(start, end + 1);
  }
  return clean;
}

// ══════════════════════════════════════════════════════════════════════════════
// GROQ helpers
// ══════════════════════════════════════════════════════════════════════════════

async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  const axios = require("axios");
  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 300,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.choices[0]?.message?.content || "";
}

/**
 * Groq-backed single-text validator (mirrors validateWithGemini signature).
 */
async function validateWithGroq(text) {
  const prompt = `
You are a lenient evaluator for a software engineering and IT internship logbook.
Your only job is to detect if the entry is COMPLETELY UNRELATED to work or learning.

The entry is: ${JSON.stringify(text)}

Respond strictly in JSON format without Markdown formatting or markdown backticks:
{
  "isWorkRelated": true/false,
  "reason": "If false, a short, friendly explanation. If true, leave empty."
}
`;
  const raw = await callGroq(prompt);
  const parsed = JSON.parse(extractJson(raw));
  return {
    isWorkRelated: !!parsed.isWorkRelated,
    reason: parsed.reason || "",
  };
}

/**
 * Groq-backed batch validator (mirrors validateBatchWithGemini signature).
 */
async function validateBatchWithGroq(tasks, challenges, plans) {
  const prompt = LENIENT_BATCH_PROMPT(tasks, challenges, plans);
  const raw = await callGroq(prompt);
  const parsed = JSON.parse(extractJson(raw));

  const values = { tasks, challenges, plans };
  const result = {
    tasks: emptyFieldPass(),
    challenges: emptyFieldPass(),
    plans: emptyFieldPass(),
  };
  for (const key of BATCH_FIELD_KEYS) {
    if (!values[key] || !values[key].trim()) {
      result[key] = emptyFieldPass();
    } else {
      result[key] = normalizeFieldResult(parsed[key]);
    }
  }
  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// GEMINI helper
// ══════════════════════════════════════════════════════════════════════════════

function buildGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  const requestOptions = {};
  if (process.env.GEMINI_BASE_URL) {
    requestOptions.baseUrl = process.env.GEMINI_BASE_URL;
  }
  return genAI.getGenerativeModel({ model: GEMINI_MODEL }, requestOptions);
}

// ══════════════════════════════════════════════════════════════════════════════
// Public API — Gemini first, auto-fallback to Groq on quota errors
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Validates whether a logbook entry is genuinely work-related.
 * Uses Gemini; falls back to Groq automatically if Gemini quota is exhausted.
 *
 * @param {string} text - The logbook entry text to evaluate
 * @returns {Promise<{ isWorkRelated: boolean, reason: string }>}
 */
async function validateWithGemini(text) {
  // ── Try Gemini first ──────────────────────────────────────────────────────
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (geminiApiKey) {
    try {
      console.log("\n[LLM VALIDATOR] Using Gemini to evaluate entry...");
      console.log(
        `[LLM VALIDATOR] Text: "${text.substring(0, 50)}${text.length > 50 ? "..." : ""}"`
      );

      const model = buildGeminiModel();
      const prompt = `
You are a lenient evaluator for a software engineering and IT internship logbook.
Your only job is to detect if the entry is COMPLETELY UNRELATED to work or learning.

The entry is: ${JSON.stringify(text)}

Respond strictly in JSON format without Markdown formatting or markdown backticks:
{
  "isWorkRelated": true/false,
  "reason": "If false, a short, friendly explanation. If true, leave empty."
}
`;
      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();
      const parsed = JSON.parse(extractJson(responseText));

      console.log(`[LLM VALIDATOR] ✅ Gemini result: isWorkRelated=${parsed.isWorkRelated}\n`);
      return {
        isWorkRelated: !!parsed.isWorkRelated,
        reason: parsed.reason || "",
      };
    } catch (geminiError) {
      if (isQuotaError(geminiError)) {
        console.warn(
          `[LLM VALIDATOR] ⚠️  Gemini quota exhausted (${geminiError.message}). Falling back to Groq...`
        );
        // Fall through to Groq
      } else {
        console.error("[LLM VALIDATOR] ❌ Gemini error (non-quota):", geminiError.message);
        // Non-quota errors: fail-open so users aren't blocked
        return { isWorkRelated: true, reason: "" };
      }
    }
  } else {
    console.warn("[LLM VALIDATOR] GEMINI_API_KEY not set. Trying Groq...");
  }

  // ── Groq fallback ─────────────────────────────────────────────────────────
  if (process.env.GROQ_API_KEY) {
    try {
      console.log("[LLM VALIDATOR] Using Groq as fallback...");
      const result = await validateWithGroq(text);
      console.log(`[LLM VALIDATOR] ✅ Groq result: isWorkRelated=${result.isWorkRelated}\n`);
      return result;
    } catch (groqError) {
      console.error("[LLM VALIDATOR] ❌ Groq fallback also failed:", groqError.message);
    }
  } else {
    console.warn("[LLM VALIDATOR] GROQ_API_KEY not set. No fallback available.");
  }

  // ── Both failed: fail-open so users aren't blocked ────────────────────────
  console.warn("[LLM VALIDATOR] ⚠️  All AI providers failed. Failing open.");
  return { isWorkRelated: true, reason: "" };
}

/**
 * Lenient batch validation — per-field work-related check only.
 * Uses Gemini; auto-falls back to Groq on quota errors.
 *
 * @returns {Promise<{ tasks: {valid, reason}, challenges: {valid, reason}, plans: {valid, reason} }>}
 */
async function validateBatchWithGemini(tasks, challenges, plans) {
  const values = { tasks, challenges, plans };
  const result = {
    tasks: emptyFieldPass(),
    challenges: emptyFieldPass(),
    plans: emptyFieldPass(),
  };

  const fieldsNeedingLlm = BATCH_FIELD_KEYS.filter(
    (key) => values[key] && values[key].trim().length > 0,
  );

  if (fieldsNeedingLlm.length === 0) {
    return result;
  }

  // ── Try Gemini first ──────────────────────────────────────────────────────
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (geminiApiKey) {
    console.log("\n[LLM VALIDATOR] ── Batch Validation Start (Gemini) ──");
    console.log(`[LLM VALIDATOR] Fields to check: ${fieldsNeedingLlm.join(", ")}`);
    console.log(`[LLM VALIDATOR] Model: ${GEMINI_MODEL}`);

    const model = buildGeminiModel();
    const prompt = LENIENT_BATCH_PROMPT(tasks, challenges, plans);

    console.log(`[LLM VALIDATOR] Sending request to Gemini...`);
    const startTime = Date.now();

    // Race against a 20-second timeout so we fail fast when API is unreachable
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Gemini batch validation timed out after 20 seconds")),
        20000,
      ),
    );

    try {
      const responsePromise = model.generateContent(prompt);
      const response = await Promise.race([responsePromise, timeoutPromise]);
      const elapsed = Date.now() - startTime;
      console.log(`[LLM VALIDATOR] ✅ Gemini responded in ${elapsed}ms`);

      const responseText = response.response.text().trim();
      console.log(`[LLM VALIDATOR] Raw response: ${responseText.substring(0, 300)}`);

      const parsed = JSON.parse(extractJson(responseText));
      console.log(`[LLM VALIDATOR] Parsed result:`, JSON.stringify(parsed));

      for (const key of BATCH_FIELD_KEYS) {
        if (!values[key] || !values[key].trim()) {
          result[key] = emptyFieldPass();
        } else {
          result[key] = normalizeFieldResult(parsed[key]);
        }
      }

      console.log(`[LLM VALIDATOR] Final batch result:`, JSON.stringify(result));
      console.log(`[LLM VALIDATOR] ── Batch Validation End ──\n`);
      return result;
    } catch (geminiError) {
      const elapsed = Date.now() - startTime;
      if (isQuotaError(geminiError)) {
        console.warn(
          `[LLM VALIDATOR] ⚠️  Gemini quota exhausted after ${elapsed}ms (${geminiError.message}). Falling back to Groq...`
        );
        // Fall through to Groq below
      } else {
        console.error(
          `[LLM VALIDATOR] ❌ Gemini batch failed after ${elapsed}ms:`,
          geminiError.message,
        );
        // Non-quota error — re-throw so the controller returns 503
        throw geminiError;
      }
    }
  } else {
    console.warn(
      "[LLM VALIDATOR] GEMINI_API_KEY not set. Trying Groq for batch validation...",
    );
  }

  // ── Groq fallback ─────────────────────────────────────────────────────────
  if (process.env.GROQ_API_KEY) {
    console.log("[LLM VALIDATOR] ── Batch Validation Fallback (Groq) ──");
    console.log(`[LLM VALIDATOR] Fields to check: ${fieldsNeedingLlm.join(", ")}`);
    console.log(`[LLM VALIDATOR] Model: ${GROQ_MODEL}`);

    const startTime = Date.now();
    try {
      const groqResult = await validateBatchWithGroq(tasks, challenges, plans);
      const elapsed = Date.now() - startTime;
      console.log(`[LLM VALIDATOR] ✅ Groq responded in ${elapsed}ms`);
      console.log(`[LLM VALIDATOR] Final batch result:`, JSON.stringify(groqResult));
      console.log(`[LLM VALIDATOR] ── Batch Validation End ──\n`);
      return groqResult;
    } catch (groqError) {
      console.error(
        `[LLM VALIDATOR] ❌ Groq batch fallback also failed:`,
        groqError.message,
      );
      throw groqError; // Let the controller handle it (503)
    }
  }

  // ── Neither key set ───────────────────────────────────────────────────────
  throw new Error("No AI provider available: GEMINI_API_KEY and GROQ_API_KEY are both unset.");
}

/**
 * Diagnostic: tests whether the Gemini API is reachable and the model responds.
 * Used by the /validate-health endpoint and the startup probe.
 */
async function testGeminiConnection() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, detail: "GEMINI_API_KEY is not set in environment" };
  }

  try {
    const model = buildGeminiModel();

    // Race against a 15-second timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Connection timed out after 15 seconds — the server may not be able to reach generativelanguage.googleapis.com",
            ),
          ),
        15000,
      ),
    );

    const resultPromise = model.generateContent("Reply with exactly one word: OK");
    const result = await Promise.race([resultPromise, timeoutPromise]);
    const text = result.response.text().trim();

    return { ok: true, model: GEMINI_MODEL, detail: `Model responded: "${text}"` };
  } catch (error) {
    return {
      ok: false,
      model: GEMINI_MODEL,
      detail: `${error.constructor.name}: ${error.message}`,
      status: error.status || undefined,
    };
  }
}

// ── Startup probe (non-blocking) ──────────────────────────────────────────────
(async () => {
  const geminiKeyPresent = !!process.env.GEMINI_API_KEY;
  const groqKeyPresent   = !!process.env.GROQ_API_KEY;

  console.log(`\n[LLM VALIDATOR] ── Startup Diagnostics ──`);
  console.log(
    `[LLM VALIDATOR] GEMINI_API_KEY set: ${geminiKeyPresent}${
      geminiKeyPresent ? ` (${process.env.GEMINI_API_KEY.substring(0, 10)}...)` : ""
    }`,
  );
  console.log(
    `[LLM VALIDATOR] GROQ_API_KEY set:   ${groqKeyPresent}${
      groqKeyPresent ? ` (${process.env.GROQ_API_KEY.substring(0, 10)}...)` : ""
    }`,
  );
  console.log(`[LLM VALIDATOR] Primary model:  ${GEMINI_MODEL}`);
  console.log(`[LLM VALIDATOR] Fallback model: ${GROQ_MODEL}`);

  if (!geminiKeyPresent && !groqKeyPresent) {
    console.error(
      "[LLM VALIDATOR] ❌ Neither GEMINI_API_KEY nor GROQ_API_KEY is set — AI validation will FAIL for all submissions.",
    );
    console.log(`[LLM VALIDATOR] ── End Diagnostics ──\n`);
    return;
  }

  if (geminiKeyPresent) {
    console.log("[LLM VALIDATOR] Testing Gemini API connection...");
    const probe = await testGeminiConnection();
    if (probe.ok) {
      console.log(`[LLM VALIDATOR] ✅ Gemini is reachable. ${probe.detail}`);
    } else {
      console.error(`[LLM VALIDATOR] ❌ Gemini connection FAILED: ${probe.detail}`);
      if (probe.status) console.error(`[LLM VALIDATOR]   HTTP Status: ${probe.status}`);
      if (groqKeyPresent) {
        console.log("[LLM VALIDATOR] ℹ️  Groq is configured and will be used as fallback.");
      } else {
        console.error(
          "[LLM VALIDATOR] ⚠️  No Groq fallback configured. AI validation may fail.",
        );
      }
    }
  } else {
    console.warn(
      "[LLM VALIDATOR] ⚠️  No Gemini key — all validation will go directly to Groq.",
    );
  }

  if (groqKeyPresent) {
    console.log(
      `[LLM VALIDATOR] ℹ️  Groq fallback ready (model: ${GROQ_MODEL}).`,
    );
  }

  console.log(`[LLM VALIDATOR] ── End Diagnostics ──\n`);
})();

module.exports = {
  validateWithGemini,
  validateBatchWithGemini,
  testGeminiConnection,
};
