const jwt = require("jsonwebtoken");
const dotenv = require("../config/dotenv");

const authenticateUser = (req, res, next) => {
  let token = req.header("Authorization");

  if (!token) {
    console.log("No Token Provided");
    return res.status(401).json({ message: "Access Denied. No Token Provided." });
  }

  try {
    console.log("Received Token:", token);

    
    token = token.replace("Bearer ", "").trim(); 

    
    const verified = jwt.verify(token, dotenv.jwtSecret);
    console.log("Token Verified:", verified);

    req.user = verified;
    next();
  } catch (err) {
    console.error("Invalid Token Error:", err.message);
    return res.status(401).json({ message: "Invalid Token" });
  }
};

module.exports = authenticateUser; 

