const { OAuth2Client } = require("google-auth-library");
const UserRepository = require("../repositories/userRepository");
const InternRepository = require("../repositories/internRepository"); // Required for intern login
const GateStaffRepository = require("../repositories/gateStaffRepository");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const dotenv = require("../config/dotenv");
const gateStaffRepository = require("../repositories/gateStaffRepository");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

class AuthService {
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
      { expiresIn: "1h" },
    );

    return { token, message: "User registered successfully!" };
  }

  // Admin Login
  async login(email, password) {
    console.log("Checking user:", email);

    const user = await UserRepository.findByEmail(email);
    if (!user) {
      console.log("User not found");
      return { error: "Invalid email or password" };
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return { error: "Invalid email or password" };
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      dotenv.jwtSecret,
      { expiresIn: "1h" },
    );

    return { token, message: "Login successful!" };
  }

  // Intern Google Login with ID Token
  async googleLogin(idToken) {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email;
    const googlePictureUrl = payload.picture;

    const intern = await InternRepository.findByEmail(email);
    if (!intern) {
      throw new Error("This email is not registered as an intern.");
    }

    if (googlePictureUrl && intern.googlePictureUrl !== googlePictureUrl) {
      intern.googlePictureUrl = googlePictureUrl;
      await intern.save();
    }

    const token = jwt.sign(
      { id: intern._id, email: intern.Trainee_Email },
      dotenv.jwtSecret,
      { expiresIn: "1h" },
    );

    return { token, internId: intern._id, message: "Login successful!" }; // Return internId
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
      { id: intern._id, email: intern.Trainee_Email },
      dotenv.jwtSecret,
      { expiresIn: "1h" },
    );

    return { token, internId: intern._id, message: "Login successful!" };
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
      { expiresIn: "1h" },
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
      { expiresIn: "1h" },
    );

    return {
      token,
      staffId: newStaff._id,
      message: "Gate staff registered successfully!",
    };
  }
}

module.exports = new AuthService();
