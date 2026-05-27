require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { GoogleGenerativeAI } = require("@google/generative-ai");

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
    return { valid: true, reason: "" };
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
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

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
    console.error("[LLM VALIDATOR] Error evaluating entry:", error);
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

  console.log("\n[LLM VALIDATOR] Lenient batch validation with Gemini...");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

  const prompt = LENIENT_BATCH_PROMPT(tasks, challenges, plans);
  const response = await model.generateContent(prompt);
  const responseText = response.response.text().trim();
  const cleanJson = responseText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "");

  const parsed = JSON.parse(cleanJson);

  for (const key of BATCH_FIELD_KEYS) {
    if (!values[key] || !values[key].trim()) {
      result[key] = emptyFieldPass();
    } else {
      result[key] = normalizeFieldResult(parsed[key]);
    }
  }

  return result;
}

module.exports = {
  validateWithGemini,
  validateBatchWithGemini,
};
