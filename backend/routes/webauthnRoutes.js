const express = require('express');
const router = express.Router();
const webauthnController = require('../controllers/webauthnController');
const { requireAdmin } = require('../middleware/adminAuth');
const authenticateUser = require('../middleware/authMiddleware');

// Passkey Registration (requires active admin session)
router.get('/generate-registration-options', authenticateUser, requireAdmin, webauthnController.generateRegistrationOptions);
router.post('/verify-registration', authenticateUser, requireAdmin, webauthnController.verifyRegistration);

// Passkey Authentication (unauthenticated)
router.post('/generate-authentication-options', webauthnController.generateAuthenticationOptions);
router.post('/verify-authentication', webauthnController.verifyAuthentication);

module.exports = router;
