const Groq = require("groq-sdk");

async function testGroq() {
  try {
    const groq = new Groq({ apiKey: "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" });
    console.log("Calling Groq with openai/gpt-oss-20b...");
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "user", content: "Say hello!" }],
      temperature: 0,
      max_tokens: 300,
    });
    console.log("Groq Success:", completion.choices[0]?.message?.content);
  } catch (err) {
    console.error("Groq Error:", err.message);
  }
}

testGroq();
