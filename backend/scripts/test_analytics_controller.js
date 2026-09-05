const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const { getAdminAnalytics } = require("../controllers/adminAnalyticsController");

async function testEndpoint() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const req = {
    query: {
      refresh: "true"
    }
  };

  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      const intern3336 = data.find(i => i.traineeId === "3336" || i.email === "tanjaleef@gmail.com");
      console.log("\n=== CONTROLLER OUTPUT FOR 3336 ===");
      console.log(JSON.stringify(intern3336, null, 2));
      process.exit(0);
    }
  };

  await getAdminAnalytics(req, res);
}

testEndpoint().catch(console.error);
