const Groq = require("groq-sdk");

async function listModels() {
  try {
    const groq = new Groq({ apiKey: "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" });
    const models = await groq.models.list();
    console.log(models.data.map(m => m.id));
  } catch (err) {
    console.error("Groq Error:", err.message);
  }
}

listModels();
