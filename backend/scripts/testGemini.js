require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { GoogleGenerativeAI } = require("@google/generative-ai");
(async () => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return console.error("GEMINI_API_KEY missing");
    const gen = new GoogleGenerativeAI(apiKey);
    const requestOptions = {};
    if (process.env.GEMINI_BASE_URL) {
      requestOptions.baseUrl = process.env.GEMINI_BASE_URL;
    }
    const model = gen.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite" }, requestOptions);
    const r = await model.generateContent('Is "fixed a bug" work-related?');
    console.log((await r.response.text()).slice(0, 400));
  } catch (e) {
    console.error("LLM test failed:", e);
  }
})();
