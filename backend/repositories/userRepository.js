const User = require("../models/User");

class UserRepository {
  async findByEmail(email) {
    return await User.findOne({ email: { $regex: new RegExp(`^${email}$`, "i") } }); // Case insensitive search
  }

  async createUser(email, hashedPassword) {
    const user = new User({ email, password: hashedPassword });
    return await user.save();
  }
}

module.exports = new UserRepository();
