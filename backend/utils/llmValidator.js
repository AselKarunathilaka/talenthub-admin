const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Validates whether a logbook entry is genuinely work-related using Gemini 2.5 Flash.
 * 
 * @param {string} text - The logbook entry text to evaluate
 * @returns {Promise<{ isWorkRelated: boolean, reason: string }>}
 */
async function validateWithGemini(text) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("[LLM VALIDATOR] GEMINI_API_KEY is not set. Falling back to acceptance.");
      return { isWorkRelated: true, reason: "" };
    }

    // Required console output to clearly see the LLM is being used
    console.log("\n[LLM VALIDATOR] Using Gemini 2.5 Flash to evaluate entry...");
    console.log(`[LLM VALIDATOR] Text to evaluate: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
You are a strict evaluator for a software engineering and IT internship logbook.
Your job is to determine if a submitted daily activity log is genuinely work-related or non-work-related.

Examples of GOOD, work-related entries:
- "Implemented JWT authentication middleware for the Express API"
- "Debugged CORS issues on the staging server"
- "Attended the sprint planning meeting and picked up two backend tickets"
- "Researched how to optimize the database query using indexing"
- "Designed Figma mockups for the new dashboard"
- "Fixed production bug #402 where user login failed"

Examples of BAD, non-work-related entries (Type 5):
- "I walked my dog in the evening and took a shower"
- "I ate a hotdog and drank tea in the morning"
- "All planets in the solar system orbits the sun"
- "Watched a movie on Netflix"
- "Went grocery shopping"

The entry is: "${text}"

Determine if this entry is work-related or related to professional internship activities (IT, engineering, design, project management).
Respond strictly in JSON format without Markdown formatting or markdown backticks:
{
  "isWorkRelated": true/false,
  "reason": "If false, a short, polite explanation of why it is not work-related. If true, leave empty."
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    // Clean potential markdown blocks from response just in case
    const cleanJson = responseText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
    
    const parsed = JSON.parse(cleanJson);

    console.log(`[LLM VALIDATOR] Result: isWorkRelated=${parsed.isWorkRelated}\n`);

    return {
      isWorkRelated: !!parsed.isWorkRelated,
      reason: parsed.reason || ""
    };
  } catch (error) {
    console.error("[LLM VALIDATOR] Error evaluating entry:", error);
    // In case of API failure, fail open so we don't block users if Gemini is down
    return { isWorkRelated: true, reason: "" };
  }
}

module.exports = {
  validateWithGemini
};
