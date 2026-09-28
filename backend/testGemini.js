require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testGemini() {
  try {
    const genAI = new GoogleGenerativeAI("AIzaSyDp9D95NxACtYnS4BnZTbjPjEcpLETWonY");
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.5-flash-lite", 
    }, { baseUrl: "https://blunt-pony-67.kavindu-rakn.deno.net" });
    
    console.log("Calling Gemini...");
    const result = await model.generateContent("Reply with exactly one word: OK");
    console.log("Gemini Success:", result.response.text());
  } catch (err) {
    console.error("Gemini Error:", err.message);
    if (err.status) console.error("Status:", err.status);
    console.error("Stack:", err.stack);
  }
}

testGemini();
