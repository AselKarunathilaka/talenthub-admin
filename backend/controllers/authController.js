const authService = require("../services/authService");

// Google Login
const googleLogin = async (req, res) => {
  const { code } = req.body;

  try {
    const result = await authService.googleLogin(code);
    res.status(200).json(result); 
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};


// Admin Login
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await authService.login(email, password);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

// Admin Registration
const register = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await authService.register(email, password);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ message: "Registration failed", error: error.message });
  }
};

// Get Google OAuth URL
const getGoogleAuthUrl = (req, res) => {
  const authUrl = authService.getAuthUrl();
  res.status(200).json({ authUrl });
};

module.exports = { googleLogin, login, register, getGoogleAuthUrl };
