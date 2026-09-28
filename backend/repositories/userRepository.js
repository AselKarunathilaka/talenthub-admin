const User = require("../models/User");
const { encrypt } = require("../utils/dbEncryption");

class UserRepository {
  async findByEmail(email) {
    return await User.findOne({ email: encrypt(String(email).trim().toLowerCase()) }).select("+password");
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
