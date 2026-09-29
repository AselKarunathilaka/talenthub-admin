const User = require("../models/User");
const { encrypt, buildEmailQuery } = require("../utils/dbEncryption");

class UserRepository {
  async findByEmail(email) {
    if (!email) return null;
    return await User.findOne(buildEmailQuery(String(email).trim().toLowerCase())).select("+password");
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
