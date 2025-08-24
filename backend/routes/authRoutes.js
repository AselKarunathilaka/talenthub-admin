const express = require("express");
const router = express.Router();
const { googleLogin, login, register, getGoogleAuthUrl } = require("../controllers/authController");

router.post("/google-login", googleLogin); 
router.get("/google-auth-url", getGoogleAuthUrl); 
router.post("/login", login); 
router.post("/register", register); 

module.exports = router;
