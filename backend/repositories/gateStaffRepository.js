const GateStaff = require("../models/GateStaff");
const bcrypt = require("bcryptjs");

class GateStaffRepository {
  // Find gate staff by email
  async findByEmail(email) {
    return await GateStaff.findOne({ email });
  }

  // Create new gate staff (for manual registration)
  async createGateStaff(email, password) {
    const gateStaff = new GateStaff({
      email,
      password, // Will be auto-hashed by the pre-save hook
    });
    return await gateStaff.save();
  }
}

module.exports = new GateStaffRepository();
