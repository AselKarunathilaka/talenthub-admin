const { validateBatchWithGemini } = require("./utils/llmValidator.js");

async function testBatch() {
  try {
    const result = await validateBatchWithGemini(
      "Intern LogBook AI Validation Issue and Login Issue Fix",
      "Intern LogBook AI Validation Issue and Login Issue Fix",
      "Intern LogBook AI Validation Issue and Login Issue Fix"
    );
    console.log("Validation Result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Batch Validation Error:", err.message);
  }
}

testBatch();
