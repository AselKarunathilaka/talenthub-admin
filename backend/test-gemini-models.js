require("dotenv").config();
const https = require("https");

async function listModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
  
  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log("Available models:");
        if (json.models) {
          json.models.forEach(m => console.log(m.name, "-", m.supportedGenerationMethods.join(',')));
        } else {
          console.log(json);
        }
      } catch(e) {
        console.error("Error parsing response:", e);
      }
    });
  }).on('error', (e) => {
    console.error("Request error:", e);
  });
}

listModels();
