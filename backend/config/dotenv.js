require("dotenv").config(); 
module.exports = {
  mongoURI: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET, 
  port: process.env.PORT || 5000,
  traineesApi: {
    baseUrl: process.env.TRAINEES_API_BASE_URL || "https://prohub.slt.com.lk/ProhubTrainees/api/MainApi/AllActiveTrainees",
    secretKey: process.env.TRAINEES_API_SECRET_KEY || "",
    timeoutMs: Number(process.env.TRAINEES_API_TIMEOUT_MS || 15000),
    mode: (process.env.TRAINEES_API_MODE || "db").toLowerCase() // 'external' or 'db'
  }
};
