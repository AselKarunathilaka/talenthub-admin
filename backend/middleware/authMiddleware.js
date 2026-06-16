const jwt = require("jsonwebtoken");
const dotenv = require("../config/dotenv");

const authenticateUser = (req, res, next) => {
  let token = req.header("Authorization");

  if (!token) {
    return res.status(401).json({
      message: "Access Denied. No Token Provided.",
      code: "NO_TOKEN",
    });
  }

  try {
    token = token.replace("Bearer ", "").trim();
    const verified = jwt.verify(token, dotenv.jwtSecret);
    req.user = verified;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Session expired. Please log in again.",
        code: "TOKEN_EXPIRED",
      });
    }
    return res.status(401).json({
      message: "Invalid Token.",
      code: "INVALID_TOKEN",
    });
  }
};

module.exports = authenticateUser;