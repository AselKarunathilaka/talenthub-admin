const express = require("express");
const router = express.Router();
const {
  googleLogin,
  login,
  register,
  getGoogleAuthUrl,
  gateStaffLogin,
  registerGateStaff,
  internLogin,
} = require("../controllers/authController");
const {
  federatedLogin,
  validateToken,
} = require("../controllers/federationController");
const federationAuth = require("../middleware/federationAuth");

router.post("/google-login", googleLogin);
router.post("/intern-login", internLogin); //email, password login for intern
router.get("/google-auth-url", getGoogleAuthUrl);
router.post("/login", login);
router.post("/gate-staff-login", gateStaffLogin);
router.post("/gate-staff-register", registerGateStaff);
router.post("/register", register);

router.post("/federated-login", federationAuth, federatedLogin);
router.get("/validate", validateToken);

module.exports = router;
