const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function test() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Test 1: With baseUrl
    console.log("Test 1: With baseUrl and gemini-1.5-flash");
    try {
      const model1 = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { baseUrl: process.env.GEMINI_BASE_URL });
      const res1 = await model1.generateContent("hello");
      console.log("Success 1:", res1.response.text());
    } catch (e) {
      console.error("Error 1:", e.status, e.statusText, e.message);
    }

    // Test 2: With baseUrl and gemini-1.5-flash-8b
    console.log("Test 2: With baseUrl and gemini-1.5-flash-8b");
    try {
      const model2 = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" }, { baseUrl: process.env.GEMINI_BASE_URL });
      const res2 = await model2.generateContent("hello");
      console.log("Success 2:", res2.response.text());
    } catch (e) {
      console.error("Error 2:", e.status, e.statusText, e.message);
    }
    
    // Test 3: Without baseUrl (Direct)
    console.log("Test 3: Without baseUrl and gemini-1.5-flash");
    try {
      const model3 = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const res3 = await model3.generateContent("hello");
      console.log("Success 3:", res3.response.text());
    } catch (e) {
      console.error("Error 3:", e.status, e.statusText, e.message);
    }

    // Test 4: With gemini-1.5-flash-latest
    console.log("Test 4: Without baseUrl and gemini-1.5-flash-latest");
    try {
      const model4 = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      const res4 = await model4.generateContent("hello");
      console.log("Success 4:", res4.response.text());
    } catch (e) {
      console.error("Error 4:", e.status, e.statusText, e.message);
    }

  } catch (err) {
    console.error("Fatal:", err);
  }
}

test();
