const express = require("express");
const router = express.Router();
const {
  googleLogin,
  adminGoogleLogin,
  login,
  register,
  getGoogleAuthUrl,
  gateStaffLogin,
  registerGateStaff,
  internLogin,
  unifiedGoogleLogin,
} = require("../controllers/authController");
const {
  federatedLogin,
  validateToken,
} = require("../controllers/federationController");
const federationAuth = require("../middleware/federationAuth");

router.post("/google-login", googleLogin);
router.post("/admin-google-login", adminGoogleLogin);
router.post("/unified-google-login", unifiedGoogleLogin);
router.post("/intern-login", internLogin); //email, password login for intern
router.get("/google-auth-url", getGoogleAuthUrl);
router.post("/login", login);
router.post("/gate-staff-login", gateStaffLogin);
// Account creation is handled by authenticated user-management APIs.

router.post("/federated-login", federationAuth, federatedLogin);
router.get("/validate", validateToken);

module.exports = router;
