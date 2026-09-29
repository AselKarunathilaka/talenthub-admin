const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const dns = require("dns");

// Fix for Node.js / Windows bug where c-ares defaults to 127.0.0.1,
// causing querySrv ECONNREFUSED for mongodb+srv URIs.
try {
  const current = dns.getServers();
  if (!current || current.length === 0 || current.includes("127.0.0.1")) {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  }
} catch (e) {
  // Ignore if not permitted
}

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};

module.exports = connectDB;
