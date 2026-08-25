const { OAuth2Client } = require("google-auth-library");
const UserRepository = require("../repositories/userRepository");
const InternRepository = require("../repositories/internRepository"); // Required for intern login
const GateStaffRepository = require("../repositories/gateStaffRepository");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const dotenv = require("../config/dotenv");
const gateStaffRepository = require("../repositories/gateStaffRepository");
const { permissionsForRole, permissionsForUser } = require("../config/adminPermissions");
const Supervisor = require("../models/Supervisor");
const User = require("../models/User");
const https = require("https");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

class AuthService {
  createAdminSession(user) {
    const role = user.role || "super_admin";
    const permissions = permissionsForUser(user);
    const token = jwt.sign(
      { id: user._id, email: user.email, role, permissions, accountType: "admin" },
      dotenv.jwtSecret,
      { expiresIn: "24h" },
    );
    return {
      token,
      user: { id: user._id, name: user.name, email: user.email, picture: user.picture, role, permissions },
      message: "Login successful!",
    };
  }
  // Admin Registration
  async register(email, password) {
    console.log("Registering user:", email);

    const existingUser = await UserRepository.findByEmail(email);
    if (existingUser) {
      return { error: "User already exists" };
    }

    const newUser = await UserRepository.createUser(email, password);

    const token = jwt.sign(
      { id: newUser._id, email: newUser.email },
      dotenv.jwtSecret,
      { expiresIn: "24h" },
    );

    return { token, message: "User registered successfully!" };
  }

  // Admin Login
  async login(email, password) {
    const developerEmail = String(process.env.SUPER_ADMIN_EMAIL || "superadmin@slt.lk").trim().toLowerCase();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const isDeveloper = normalizedEmail === developerEmail;

    const user = await UserRepository.findByEmail(normalizedEmail);
    if (!user || !user.password) return { error: "Invalid email or password" };

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return { error: "Invalid email or password" };
    }

    if (!user.isActive) return { error: "Account is inactive. Please contact a super admin." };
    user.role = isDeveloper ? "super_admin" : (user.role || "admin");
    user.authProvider = "developer_password";
    user.permissions = isDeveloper
      ? permissionsForRole("super_admin")
      : permissionsForUser(
        user,
        user.permissions?.length
          ? user.permissions
          : permissionsForRole(user.role).filter((permission) => permission !== "users.manage"),
      );
    user.lastLoginAt = new Date();
    await user.save();
    return this.createAdminSession(user);
  }

  /**
   * Admin Google Login
   *
   * Accepts either:
   *   - { credential }  — Google One Tap / GSI ID token
   *   - { accessToken } — useGoogleLogin implicit flow access token
   *
   * In both cases, the authenticated email is checked against the
   * `supervisors` allowlist before a session is issued.
   */
  async adminGoogleLogin(credentialOrCode) {
    let payload;

    if (credentialOrCode && credentialOrCode.startsWith("ya29.")) {
      // ── Access token flow (useGoogleLogin implicit) ──────────────────────
      // Verify by fetching Google userinfo
      const googlePayload = await this._fetchGoogleUserInfo(credentialOrCode);
      if (!googlePayload || !googlePayload.email) {
        throw new Error("Failed to verify Google identity. Please try again.");
      }
      payload = {
        email: googlePayload.email,
        email_verified: googlePayload.email_verified,
        name: googlePayload.name,
        picture: googlePayload.picture,
        sub: googlePayload.sub,
      };
    } else {
      // ── ID token flow (Google One Tap / credential) ───────────────────────
      const ticket = await client.verifyIdToken({
        idToken: credentialOrCode,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    }

    if (!payload.email_verified) {
      throw new Error("Google email is not verified. Please verify your Google account and try again.");
    }

    const normalizedEmail = payload.email.toLowerCase().trim();

    // 2. Check allowlist — supervisors collection (case-insensitive)
    const supervisor = await Supervisor.findOne({ email: normalizedEmail });
    if (!supervisor) {
      throw new Error(
        "Access denied. Your Google account is not registered as an authorized supervisor. " +
        "Please contact the system administrator."
      );
    }

    // 3. Find or create the User record
    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // First-time sign-in: auto-provision the admin User from supervisor record
      const roleMap = { Supervisor: "supervisor", Developer: "admin" };
      const userRole = roleMap[supervisor.role] || "supervisor";
      user = new User({
        name: payload.name || supervisor.name,
        email: normalizedEmail,
        authProvider: "google",
        role: userRole,
        picture: payload.picture || "",
        googleSubject: payload.sub,
        isActive: true,
        permissions: permissionsForRole(userRole),
      });
      await user.save();
    } else {
      // Subsequent sign-ins: refresh name/picture
      user.name = user.name || payload.name || supervisor.name;
      user.picture = payload.picture || user.picture;
      user.googleSubject = payload.sub;
      user.lastLoginAt = new Date();
      if (!user.permissions?.length) {
        user.permissions = permissionsForRole(user.role || "supervisor");
      }
      if (!user.isActive) {
        throw new Error("Your account has been deactivated. Please contact the system administrator.");
      }
      await user.save();
    }

    return this.createAdminSession(user);
  }

  /** Fetches Google userinfo via the v3 endpoint using an access token */
  _fetchGoogleUserInfo(accessToken) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "www.googleapis.com",
        path: "/oauth2/v3/userinfo",
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      };
      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) return reject(new Error(parsed.error.message || "Google userinfo error"));
            resolve(parsed);
          } catch (e) {
            reject(new Error("Failed to parse Google userinfo response"));
          }
        });
      });
      req.on("error", reject);
      req.end();
    });
  }

  // Intern Google Login — supports access token (implicit flow)
  async googleLogin(accessToken) {
    const googlePayload = await this._fetchGoogleUserInfo(accessToken);
    if (!googlePayload || !googlePayload.email) {
      throw new Error("Failed to verify Google identity. Please try again.");
    }

    const email = googlePayload.email;
    const googlePictureUrl = googlePayload.picture;

    const intern = await InternRepository.findByEmail(email);
    if (!intern) {
      throw new Error("This email is not registered as an intern.");
    }

    if (googlePictureUrl && intern.googlePictureUrl !== googlePictureUrl) {
      intern.googlePictureUrl = googlePictureUrl;
      await intern.save();
    }

    const token = jwt.sign(
      { id: intern._id, email: intern.Trainee_Email, role: "intern", accountType: "intern" },
      dotenv.jwtSecret,
      { expiresIn: "24h" },
    );

    const talentHubRestrictionService = require("./talentHubRestrictionService");
    const access = await talentHubRestrictionService.evaluateInternAccess(intern);

    return {
      token,
      internId: intern._id,
      talentHubRestricted: access.restricted,
      talentHubRestrictionReason: access.reason,
      talentHubOverride: access.isOverride,
      talentHubOverrideExpiresAt: access.overrideExpiresAt,
      daysRemaining: access.daysRemaining,
      agreementAccepted: intern.agreementAccepted,
      digitalAgreement: intern.digitalAgreement,
      message: "Login successful!",
    };
  }

  async internLogin(email, password) {
    const intern = await InternRepository.findByEmail(email);
    if (!intern) {
      return { error: "Invalid email or password" };
    }

    if (!intern.isTestAccount) {
      return {
        error: "Email/password login is only available for test accounts.",
      };
    }

    if (!intern.password) {
      return { error: "No password set for this account." };
    }

    const isMatch = await bcrypt.compare(password, intern.password);
    if (!isMatch) {
      return { error: "Invalid email or password" };
    }

    const token = jwt.sign(
      { id: intern._id, email: intern.Trainee_Email, role: "intern", accountType: "intern" },
      dotenv.jwtSecret,
      { expiresIn: "24h" },
    );

    const talentHubRestrictionService = require("./talentHubRestrictionService");
    const access = await talentHubRestrictionService.evaluateInternAccess(intern);

    return {
      token,
      internId: intern._id,
      talentHubRestricted: access.restricted,
      talentHubRestrictionReason: access.reason,
      talentHubOverride: access.isOverride,
      talentHubOverrideExpiresAt: access.overrideExpiresAt,
      daysRemaining: access.daysRemaining,
      agreementAccepted: intern.agreementAccepted,
      digitalAgreement: intern.digitalAgreement,
      message: "Login successful!",
    };
  }

  // Gate Staff Login
  async gateStaffLogin(email, password) {
    console.log("Gate staff login attempt:", email);

    const gateStaff = await GateStaffRepository.findByEmail(email);
    if (!gateStaff) {
      console.log("Gate staff not found");
      return { error: "Invalid email or password" };
    }

    // Check if gate staff is active
    if (!gateStaff.isActive) {
      return { error: "Account is inactive. Please contact administrator." };
    }

    const isMatch = await bcrypt.compare(password, gateStaff.password);
    if (!isMatch) {
      return { error: "Invalid email or password" };
    }

    const token = jwt.sign(
      { id: gateStaff._id, email: gateStaff.email, role: "gatestaff" },
      dotenv.jwtSecret,
      { expiresIn: "24h" },
    );

    return {
      token,
      user: {
        id: gateStaff._id,
        email: gateStaff.email,
      },
      role: "gatestaff",
      message: "Gate staff login successful!",
    };
  }

  // Gate Staff Registration (for manual database entry)
  async registerGateStaff(email, password) {
    console.log("Registering gate staff:", email);

    const existingStaff = await GateStaffRepository.findByEmail(email);
    if (existingStaff) {
      return { error: "Gate staff already exists" };
    }

    const newStaff = await GateStaffRepository.createGateStaff(email, password);

    const token = jwt.sign(
      { id: newStaff._id, email: newStaff.email, role: "gatestaff" },
      dotenv.jwtSecret,
      { expiresIn: "24h" },
    );

    return {
      token,
      staffId: newStaff._id,
      message: "Gate staff registered successfully!",
    };
  }
}

module.exports = new AuthService();
