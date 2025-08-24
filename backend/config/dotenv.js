require("dotenv").config(); 
module.exports = {
  mongoURI: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET, 
  port: process.env.PORT || 5000,
};
