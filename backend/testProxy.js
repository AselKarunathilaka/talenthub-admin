const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config({ path: ".env" });

const MODEL_NAME = "gemini-3.1-flash-lite";

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No API key");
    return;
  }
  
  const baseUrl = process.env.GEMINI_BASE_URL;
  console.log("Using proxy:", baseUrl);
  
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const requestOptions = {};
  if (baseUrl) {
    requestOptions.baseUrl = baseUrl;
  }
  
  const model = genAI.getGenerativeModel({ model: MODEL_NAME }, requestOptions);
  
  console.log("Sending prompt via proxy...");
  try {
    const response = await model.generateContent("Say 'OK'");
    console.log("Response received.");
    const text = response.response.text();
    console.log("Raw text:", text);
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
