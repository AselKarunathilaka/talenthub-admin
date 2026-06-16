const { validateBatchWithGemini } = require("./utils/llmValidator");
require("dotenv").config({ path: ".env" });

async function run() {
  const tasks = "I walked my dog in the evening then took a shower";
  const challenges = "I walked my dog in the evening then took a shower";
  const plans = "I walked my dog in the evening then took a shower";
  
  try {
    const result = await validateBatchWithGemini(tasks, challenges, plans);
    console.log("Result:", result);
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
