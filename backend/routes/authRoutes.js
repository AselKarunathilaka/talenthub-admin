const express = require("express");
const router = express.Router();
const { googleLogin, login, register, getGoogleAuthUrl, verifyToken } = require("../controllers/authController");
const authenticateUser = require("../middleware/authMiddleware");

router.post("/google-login", googleLogin); 
router.get("/google-auth-url", getGoogleAuthUrl); 
router.post("/login", login); 
router.post("/register", register); 
router.get("/verify", authenticateUser, verifyToken); 

module.exports = router;