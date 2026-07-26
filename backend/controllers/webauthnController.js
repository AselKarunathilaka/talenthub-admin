const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const crypto = require('crypto');
const User = require('../models/User');
const authService = require('../services/authService');

// Derive WebAuthn RP ID and origin from existing env vars.
// In production, ADMIN_PORTAL_URL is "https://talenthub.slt.lk/admin-login"
// so we extract the hostname (talenthub.slt.lk) and origin (https://talenthub.slt.lk).
const deriveWebAuthnDefaults = () => {
  if (process.env.RP_ID) {
    return {
      rpID: process.env.RP_ID,
      origin: process.env.FRONTEND_URL || `https://${process.env.RP_ID}`,
    };
  }

  // Fall back to ADMIN_PORTAL_URL which is already set in production .env
  if (process.env.ADMIN_PORTAL_URL) {
    try {
      const url = new URL(process.env.ADMIN_PORTAL_URL);
      return { rpID: url.hostname, origin: url.origin };
    } catch (_) { /* fall through */ }
  }

  // Local development fallback
  return { rpID: 'localhost', origin: 'http://localhost:5173' };
};

const { rpID: defaultRpID, origin: defaultOrigin } = deriveWebAuthnDefaults();
const rpName = process.env.RP_NAME || 'TalentHub';

console.log('[WebAuthn] Config → rpName:', rpName, '| rpID:', defaultRpID, '| origin:', defaultOrigin);

// Helper: resolve expected origin from request (browser sends Origin header on POST)
const getExpectedOrigin = (req) => req.get('origin') || defaultOrigin;

// Store authentication challenges in memory mapped by a session ID
const challengeStore = new Map();

// ── Registration: Step 1 - Generate Options ──
exports.generateRegistrationOptions = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const userPasskeys = user.passkeys || [];
    const options = await generateRegistrationOptions({
      rpName,
      rpID: defaultRpID,
      userID: new Uint8Array(Buffer.from(user._id.toString())),
      userName: user.email,
      attestationType: 'none',
      excludeCredentials: userPasskeys.map(pk => ({
        id: pk.credentialID,          // already a base64url string
        type: 'public-key',
        transports: pk.transports,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    user.currentChallenge = options.challenge;
    await user.save();

    console.log('[WebAuthn] Registration options generated for:', user.email);
    res.json(options);
  } catch (error) {
    console.error("Error generating registration options:", error);
    res.status(500).json({ error: error.message || "Failed to generate registration options" });
  }
};

// ── Registration: Step 2 - Verify ──
exports.verifyRegistration = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+currentChallenge');
    if (!user || !user.currentChallenge) {
      return res.status(400).json({ error: "User or challenge not found" });
    }

    const expectedChallenge = user.currentChallenge;
    const expectedOrigin = getExpectedOrigin(req);
    
    console.log('[WebAuthn] Verifying registration for:', user.email);
    console.log('[WebAuthn] Expected origin:', expectedOrigin);
    
    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: defaultRpID,
    });

    const { verified, registrationInfo } = verification;
    console.log('[WebAuthn] Registration verified:', verified);

    if (verified && registrationInfo) {
      // v13 API: credential info is under registrationInfo.credential
      const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;
      
      console.log('[WebAuthn] Credential ID:', credential.id);
      console.log('[WebAuthn] Credential counter:', credential.counter);
      
      const newPasskey = {
        credentialID: credential.id,                          // base64url string
        credentialPublicKey: Buffer.from(credential.publicKey), // Uint8Array -> Buffer
        counter: credential.counter,
        credentialDeviceType,
        credentialBackedUp,
        transports: credential.transports || req.body.response?.transports || [],
      };

      if (!user.passkeys) user.passkeys = [];
      user.passkeys.push(newPasskey);
      user.currentChallenge = undefined;
      await user.save();

      console.log('[WebAuthn] Passkey saved! Total passkeys for user:', user.passkeys.length);
      return res.json({ verified: true });
    }

    res.status(400).json({ error: "Registration verification failed" });
  } catch (error) {
    console.error("Error verifying registration:", error);
    res.status(500).json({ error: error.message || "Failed to verify registration" });
  }
};

// ── Authentication: Step 1 - Generate Options ──
exports.generateAuthenticationOptions = async (req, res) => {
  try {
    const options = await generateAuthenticationOptions({
      rpID: defaultRpID,
      userVerification: 'preferred',
    });
    
    const sessionId = crypto.randomUUID();
    challengeStore.set(sessionId, options.challenge);
    
    // Clear challenge after 5 minutes
    setTimeout(() => challengeStore.delete(sessionId), 5 * 60 * 1000);

    console.log('[WebAuthn] Authentication options generated, sessionId:', sessionId);
    res.json({ options, sessionId });
  } catch (error) {
    console.error("Error generating authentication options:", error);
    res.status(500).json({ error: "Failed to generate authentication options" });
  }
};

// ── Authentication: Step 2 - Verify ──
exports.verifyAuthentication = async (req, res) => {
  try {
    const { response, sessionId } = req.body;
    
    if (!sessionId || !challengeStore.has(sessionId)) {
      return res.status(400).json({ error: "Authentication session expired or invalid" });
    }
    
    const expectedChallenge = challengeStore.get(sessionId);
    challengeStore.delete(sessionId);

    console.log('[WebAuthn] Verifying authentication, credential ID from browser:', response.id);

    // Find user by matching the base64url credentialID string
    const usersWithPasskeys = await User.find({ 'passkeys.0': { $exists: true } });
    
    let user = null;
    let passkey = null;
    
    for (const u of usersWithPasskeys) {
      const foundPasskey = u.passkeys.find(p => {
        // credentialID is now stored as a base64url string
        return p.credentialID === response.id;
      });
      if (foundPasskey) {
        user = u;
        passkey = foundPasskey;
        break;
      }
    }
    
    if (!user || !passkey) {
      console.log('[WebAuthn] No matching passkey found in database');
      console.log('[WebAuthn] Users with passkeys:', usersWithPasskeys.length);
      usersWithPasskeys.forEach(u => {
        u.passkeys.forEach(p => {
          console.log('[WebAuthn]   Stored credentialID:', p.credentialID);
        });
      });
      return res.status(404).json({ error: "No user found for this passkey" });
    }

    console.log('[WebAuthn] Found user:', user.email);

    const expectedOrigin = getExpectedOrigin(req);
    
    // v13 API: use `credential` instead of `authenticator`
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: defaultRpID,
      credential: {
        id: passkey.credentialID,                               // base64url string
        publicKey: new Uint8Array(passkey.credentialPublicKey),  // Buffer -> Uint8Array
        counter: passkey.counter,
        transports: passkey.transports,
      },
    });

    const { verified, authenticationInfo } = verification;
    console.log('[WebAuthn] Authentication verified:', verified);

    if (verified) {
      passkey.counter = authenticationInfo.newCounter;
      user.lastLoginAt = new Date();
      await user.save();
      
      const session = authService.createAdminSession(user);
      return res.json({ verified: true, ...session });
    }

    res.status(400).json({ error: "Authentication failed" });
  } catch (error) {
    console.error("Error verifying authentication:", error);
    res.status(500).json({ error: error.message || "Failed to verify authentication" });
  }
};
