const { OAuth2Client } = require("google-auth-library");
const UserRepository = require("../repositories/userRepository");
const InternRepository = require("../repositories/internRepository"); // Required for intern login
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const dotenv = require("../config/dotenv");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

class AuthService {
  // Admin Registration
  async register(email, password) {
    const existingUser = await UserRepository.findByEmail(email);
    if (existingUser) {
      return { error: "User already exists" };
    }

    const newUser = await UserRepository.createUser(email, password);

    const token = jwt.sign(
      { id: newUser._id, email: newUser.email },
      dotenv.jwtSecret,
      { expiresIn: "1h" }
    );

    return { token, message: "User registered successfully!" };
  }

  // Admin Login
  async login(email, password) {
    const user = await UserRepository.findByEmail(email);
    if (!user) {
      return { error: "Invalid email or password" };
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return { error: "Invalid email or password" };
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      dotenv.jwtSecret,
      { expiresIn: "1h" }
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
  
    const intern = await InternRepository.findByEmail(email);
    if (!intern) {
      throw new Error("This email is not registered as an intern.");
    }
  
    const token = jwt.sign(
      { id: intern._id, email: intern.email },
      dotenv.jwtSecret,
      { expiresIn: "1h" }
    );
  
    return { token, internId: intern._id, message: "Login successful!" };  // Return internId
  }
  
}

module.exports = new AuthService();
