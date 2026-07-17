const User = require("../models/User");

class UserRepository {
  async findByEmail(email) {
    return await User.findOne({ email: String(email).trim().toLowerCase() }).select("+password");
  }

  async findById(id) {
    return User.findById(id);
  }

  async hasSuperAdmin() {
    return Boolean(await User.exists({ role: "super_admin" }));
  }

  async createUser(email, hashedPassword) {
    const user = new User({ email, password: hashedPassword });
    return await user.save();
  }
}

module.exports = new UserRepository();
