const jwt = require("jsonwebtoken");
const InternRepository = require("../repositories/internRepository");
const UserRepository = require("../repositories/userRepository");
const dotenv = require("../config/dotenv");

/**
 * POST /api/auth/federated-login
 * Called by talenthub-mobile to get a TalentHub JWT for a user.
 * Protected by X-Service-Token header (federationAuth middleware).
 */
const federatedLogin = async (req, res) => {
  const { email, source, timestamp } = req.body;

  // Validate source
  if (source !== "talenthub-mobile") {
    return res.status(400).json({
      error: "INVALID_SOURCE",
      message: "Only 'talenthub-mobile' source is supported",
    });
  }

  // Validate email
  if (!email) {
    return res.status(400).json({
      error: "MISSING_EMAIL",
      message: "Email is required",
    });
  }

  // Optional: replay attack prevention (5-minute window)
  if (timestamp) {
    const age = Date.now() - timestamp;
    if (age > 5 * 60 * 1000) {
      return res.status(401).json({
        error: "TOKEN_EXPIRED",
        message: "Request timestamp is too old",
      });
    }
  }

  try {
    // Try intern first, then admin
    let userPayload = null;
    let role = null;

    const intern = await InternRepository.findByEmail(email);
    if (intern) {
      userPayload = {
        id: intern._id,
        email: intern.Trainee_Email,
        name: intern.Trainee_Name,
        traineeId: intern.Trainee_ID || null,
      };
      role = "INTERN";
    } else {
      const admin = await UserRepository.findByEmail(email);
      if (admin) {
        userPayload = {
          id: admin._id,
          email: admin.email,
          name: admin.email, // admins may not have a name field
          traineeId: null,
        };
        role = "ADMIN";
      }
    }

    if (!userPayload) {
      return res.status(404).json({
        error: "USER_NOT_FOUND",
        message:
          "User not found in TalentHub system. User must be registered first.",
        email,
      });
    }

    const token = jwt.sign(
      { id: userPayload.id, email: userPayload.email, role },
      dotenv.jwtSecret,
      { expiresIn: "24h" },
    );

    return res.status(200).json({
      token,
      user: {
        id: userPayload.id,
        email: userPayload.email,
        name: userPayload.name,
        role,
        traineeId: userPayload.traineeId,
        lastLoginAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Federated login error:", error);
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/auth/validate
 * Validates a TalentHub JWT token — usable by mobile app to check token health.
 */
const validateToken = async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "MISSING_TOKEN", message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, dotenv.jwtSecret);
    return res.status(200).json({
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    });
  } catch (err) {
    return res
      .status(401)
      .json({ error: "INVALID_TOKEN", message: "Token is invalid or expired" });
  }
};

module.exports = { federatedLogin, validateToken };
