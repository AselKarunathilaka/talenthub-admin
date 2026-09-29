const User = require("../models/User");
const { encrypt } = require("../utils/dbEncryption");

class UserRepository {
  async findByEmail(email) {
    if (!email) return null;
    const cleanEmail = String(email).trim().toLowerCase();
    const encryptedEmail = encrypt(cleanEmail);

    let user = await User.findOne({
      $or: [
        { email: encryptedEmail },
        { email: cleanEmail },
        { email: { $regex: `^${cleanEmail}$`, $options: "i" } },
      ],
    }).select("+password");

    // Fallback: check deprecated 'users' collection where manual admin creation scripts inserted
    if (!user) {
      try {
        const mongoose = require("mongoose");
        const rawUser = await mongoose.connection.db?.collection("users")?.findOne({
          $or: [
            { email: encryptedEmail },
            { email: cleanEmail },
            { email: { $regex: `^${cleanEmail}$`, $options: "i" } },
          ],
        });

        if (rawUser) {
          // Wrap in User model
          user = new User({
            _id: rawUser._id,
            name: rawUser.name || "Admin",
            email: cleanEmail,
            password: rawUser.password,
            role: rawUser.role || "super_admin",
            isActive: rawUser.isActive !== false,
            authProvider: rawUser.authProvider || "developer_password",
          });
        }
      } catch (err) {
        console.warn("Error checking deprecated users collection:", err.message);
      }
    }

    return user;
  }

  async findById(id) {
    return User.findById(id);
  }

  async createUser(email, hashedPassword) {
    const user = new User({ email, password: hashedPassword });
    return await user.save();
  }
}

module.exports = new UserRepository();
