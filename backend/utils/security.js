const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("../config/dotenv");

const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

const verifyPassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

const generateToken = (user) => {
  return jwt.sign({ id: user._id, email: user.email }, dotenv.jwtSecret, {
    expiresIn: "1h",
  });
};

module.exports = { hashPassword, verifyPassword, generateToken };
