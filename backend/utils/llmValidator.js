require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { GoogleGenerativeAI } = require("@google/generative-ai");

const MODEL_NAME = "gemini-3.1-flash-lite";
const BATCH_FIELD_KEYS = ["tasks", "challenges", "plans"];

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

function normalizeFieldResult(raw) {
  if (!raw || typeof raw !== "object") {
    // If Gemini didn't return a proper result for this field,
    // default to INVALID (fail-closed) rather than silently passing.
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

/**
 * Validates whether a logbook entry is genuinely work-related using Gemini 3.1 Flash Lite.
 *
 * @param {string} text - The logbook entry text to evaluate
 * @returns {Promise<{ isWorkRelated: boolean, reason: string }>}
 */
async function validateWithGemini(text) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn(
        "[LLM VALIDATOR] GEMINI_API_KEY is not set. Falling back to acceptance.",
      );
      return { isWorkRelated: true, reason: "" };
    }

    console.log(
      "\n[LLM VALIDATOR] Using Gemini 3.1 Flash Lite to evaluate entry...",
    );
    console.log(
      `[LLM VALIDATOR] Text to evaluate: "${text.substring(0, 50)}${text.length > 50 ? "..." : ""}"`,
    );

    const genAI = new GoogleGenerativeAI(apiKey);
  const requestOptions = {};
  if (process.env.GEMINI_BASE_URL) {
    requestOptions.baseUrl = process.env.GEMINI_BASE_URL;
  }
  const model = genAI.getGenerativeModel({ model: MODEL_NAME }, requestOptions);

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
    const cleanJson = responseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "");

    const parsed = JSON.parse(cleanJson);

    console.log(
      `[LLM VALIDATOR] Result: isWorkRelated=${parsed.isWorkRelated}\n`,
    );

    return {
      isWorkRelated: !!parsed.isWorkRelated,
      reason: parsed.reason || "",
    };
  } catch (error) {
    console.error("[LLM VALIDATOR] ❌ Error evaluating entry:");
    console.error(`[LLM VALIDATOR]   Type: ${error.constructor.name}`);
    console.error(`[LLM VALIDATOR]   Message: ${error.message}`);
    if (error.status) console.error(`[LLM VALIDATOR]   HTTP Status: ${error.status}`);
    if (error.errorDetails) console.error(`[LLM VALIDATOR]   Details:`, JSON.stringify(error.errorDetails));
    return { isWorkRelated: true, reason: "" };
  }
}

/**
 * Lenient batch validation — per-field work-related check only.
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  console.log("\n[LLM VALIDATOR] ── Batch Validation Start ──");
  console.log(`[LLM VALIDATOR] Fields to check: ${fieldsNeedingLlm.join(", ")}`);
  console.log(`[LLM VALIDATOR] API key: ${apiKey.substring(0, 10)}...`);
  console.log(`[LLM VALIDATOR] Model: ${MODEL_NAME}`);

  const genAI = new GoogleGenerativeAI(apiKey);
  
  const requestOptions = {};
  if (process.env.GEMINI_BASE_URL) {
    requestOptions.baseUrl = process.env.GEMINI_BASE_URL;
  }
  const model = genAI.getGenerativeModel({ model: MODEL_NAME }, requestOptions);

  const prompt = LENIENT_BATCH_PROMPT(tasks, challenges, plans);

  console.log(`[LLM VALIDATOR] Sending request to Gemini...`);
  const startTime = Date.now();

  // Race against a 20-second timeout so we fail fast when API is unreachable
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Gemini batch validation timed out after 20 seconds")), 20000),
  );

  let response;
  try {
    const responsePromise = model.generateContent(prompt);
    response = await Promise.race([responsePromise, timeoutPromise]);
  } catch (apiError) {
    const elapsed = Date.now() - startTime;
    console.error(`[LLM VALIDATOR] ❌ Gemini API call failed after ${elapsed}ms`);
    console.error(`[LLM VALIDATOR]   Error type: ${apiError.constructor.name}`);
    console.error(`[LLM VALIDATOR]   Message: ${apiError.message}`);
    if (apiError.status) console.error(`[LLM VALIDATOR]   HTTP Status: ${apiError.status}`);
    throw apiError; // Re-throw so the controller returns 503
  }

  const elapsed = Date.now() - startTime;
  console.log(`[LLM VALIDATOR] ✅ Gemini responded in ${elapsed}ms`);

  const responseText = response.response.text().trim();
  console.log(`[LLM VALIDATOR] Raw response: ${responseText.substring(0, 300)}`);

  let cleanJson = responseText;
  const startIndex = cleanJson.indexOf('{');
  const endIndex = cleanJson.lastIndexOf('}');
  
  if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
    cleanJson = cleanJson.substring(startIndex, endIndex + 1);
  }

  let parsed;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (parseError) {
    console.error(`[LLM VALIDATOR] ❌ Failed to parse Gemini response as JSON`);
    console.error(`[LLM VALIDATOR]   Clean text: ${cleanJson}`);
    throw new Error(`Gemini returned unparseable response: ${cleanJson.substring(0, 100)}`);
  }

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
    const genAI = new GoogleGenerativeAI(apiKey);
    const requestOptions = {};
    if (process.env.GEMINI_BASE_URL) {
      requestOptions.baseUrl = process.env.GEMINI_BASE_URL;
    }
    const model = genAI.getGenerativeModel({ model: MODEL_NAME }, requestOptions);

    // Race against a 15-second timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Connection timed out after 15 seconds — the server may not be able to reach generativelanguage.googleapis.com")), 15000),
    );

    const resultPromise = model.generateContent("Reply with exactly one word: OK");
    const result = await Promise.race([resultPromise, timeoutPromise]);
    const text = result.response.text().trim();

    return { ok: true, model: MODEL_NAME, detail: `Model responded: "${text}"` };
  } catch (error) {
    return {
      ok: false,
      model: MODEL_NAME,
      detail: `${error.constructor.name}: ${error.message}`,
      status: error.status || undefined,
    };
  }
}

// ── Startup probe (non-blocking) ─────────────────────────────────────────────
(async () => {
  const keyPresent = !!process.env.GEMINI_API_KEY;
  console.log(`\n[LLM VALIDATOR] ── Startup Diagnostics ──`);
  console.log(`[LLM VALIDATOR] GEMINI_API_KEY set: ${keyPresent}${keyPresent ? ` (${process.env.GEMINI_API_KEY.substring(0, 10)}...)` : ""}`);
  console.log(`[LLM VALIDATOR] Model: ${MODEL_NAME}`);

  if (!keyPresent) {
    console.error("[LLM VALIDATOR] ❌ No API key — AI validation will be SKIPPED for all submissions.");
    return;
  }

  console.log("[LLM VALIDATOR] Testing Gemini API connection...");
  const probe = await testGeminiConnection();

  if (probe.ok) {
    console.log(`[LLM VALIDATOR] ✅ Gemini is reachable. ${probe.detail}`);
  } else {
    console.error(`[LLM VALIDATOR] ❌ Gemini connection FAILED: ${probe.detail}`);
    if (probe.status) console.error(`[LLM VALIDATOR]   HTTP Status: ${probe.status}`);
    console.error("[LLM VALIDATOR] ⚠️  AI validation will fail-open (submissions will still be allowed but not AI-checked).");
  }
  console.log(`[LLM VALIDATOR] ── End Diagnostics ──\n`);
})();

module.exports = {
  validateWithGemini,
  validateBatchWithGemini,
  testGeminiConnection,
};
