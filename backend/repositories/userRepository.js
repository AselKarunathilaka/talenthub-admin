const User = require("../models/User");
const { buildEmailQuery } = require("../utils/dbEncryption");

class UserRepository {
  async findByEmail(email) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    let user = await User.findOne(buildEmailQuery(normalizedEmail)).select("+password");
    if (!user) {
      const allUsers = await User.find({}).select("+password");
      user = allUsers.find(
        (u) => (u.email || "").toString().toLowerCase().trim() === normalizedEmail
      );
    }
    return user || null;
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
