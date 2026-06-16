const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const MODEL_NAME = "gemini-3.1-flash-lite";

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

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No API key");
    return;
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  
  const tasks = "I walked my dog in the evening then took a shower";
  const challenges = "I walked my dog in the evening then took a shower";
  const plans = "I walked my dog in the evening then took a shower";
  
  const prompt = LENIENT_BATCH_PROMPT(tasks, challenges, plans);
  console.log("Sending prompt...");
  try {
    const response = await model.generateContent(prompt);
    console.log("Response received.");
    const text = response.response.text();
    console.log("Raw text:", text);
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
