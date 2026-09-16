const User = require("../models/User");
const SecuritySetting = require("../models/SecuritySetting");
const bcrypt = require("bcryptjs");

// ─── SECURITY PASSWORD MANAGEMENT ───

exports.changeSecurityPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new passwords are required." });
    }

    let securityConfig = await SecuritySetting.findOne({ functionName: "Location on/off" });
    
    if (!securityConfig) {
      // If none exists, we create it (fallback)
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("TalentHub@2026", salt);
      securityConfig = await SecuritySetting.create({
        functionName: "Location on/off",
        password: hashedPassword,
        history: [],
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, securityConfig.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect current security password." });
    }

    const salt = await bcrypt.genSalt(10);
    const newHashedPassword = await bcrypt.hash(newPassword, salt);

    securityConfig.password = newHashedPassword;
    
    // Log the change in history
    securityConfig.history.push({
      activity: "password changed",
      userName: req.user?.name || "Unknown Admin",
      userMail: req.user?.email || "unknown@domain.com",
      date: new Date().toLocaleDateString("en-CA").replace(/-/g, "/"),
      time: new Date().toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' }),
    });

    await securityConfig.save();

    res.status(200).json({ message: "Security password successfully changed." });
  } catch (error) {
    console.error("[Settings] Change security password error:", error);
    res.status(500).json({ message: "Failed to change security password." });
  }
};

// ─── USER MANAGEMENT ───

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, "-password -passkeys -currentChallenge").sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (error) {
    console.error("[Settings] Get all users error:", error);
    res.status(500).json({ message: "Failed to fetch users." });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, isActive } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Only Super Admins can create other Super Admins." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User with this email already exists." });
    }

    const newUser = new User({
      name,
      email,
      password, // Password hashed automatically by pre-save hook in User model
      role,
      isActive: isActive !== undefined ? isActive : true,
      authProvider: "developer_password",
      createdBy: req.user.id,
    });

    await newUser.save();

    // Do not return the password
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({ message: "User created successfully", user: userResponse });
  } catch (error) {
    console.error("[Settings] Create user error:", error);
    res.status(500).json({ message: "Failed to create user." });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, isActive, password } = req.body;

    const userToUpdate = await User.findById(id);
    if (!userToUpdate) {
      return res.status(404).json({ message: "User not found." });
    }

    // Super Admin protections
    if (userToUpdate.role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Only Super Admins can modify other Super Admins." });
    }
    
    if (role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Only Super Admins can promote users to Super Admin." });
    }

    // Prevent demoting yourself if you are the only active super_admin
    if (userToUpdate._id.toString() === req.user.id && (role && role !== "super_admin" || isActive === false)) {
       const activeSuperAdminsCount = await User.countDocuments({ role: "super_admin", isActive: true });
       if (activeSuperAdminsCount <= 1) {
         return res.status(400).json({ message: "Cannot demote or disable the last active Super Admin account." });
       }
    }

    if (name) userToUpdate.name = name;
    if (role) userToUpdate.role = role;
    if (isActive !== undefined) userToUpdate.isActive = isActive;
    if (password) userToUpdate.password = password; // Will be hashed by pre-save hook

    await userToUpdate.save();

    const userResponse = userToUpdate.toObject();
    delete userResponse.password;

    res.status(200).json({ message: "User updated successfully", user: userResponse });
  } catch (error) {
    console.error("[Settings] Update user error:", error);
    res.status(500).json({ message: "Failed to update user." });
  }
};

// ─── WHATSAPP INTEGRATION ───

exports.getWhatsAppStatus = async (req, res) => {
  try {
    const { getWhatsAppStatus } = require("../utils/whatsappSender");
    const status = getWhatsAppStatus();
    res.status(200).json(status);
  } catch (error) {
    console.error("[Settings] Get WhatsApp status error:", error);
    res.status(500).json({ message: "Failed to fetch WhatsApp status." });
  }
};

exports.disconnectWhatsApp = async (req, res) => {
  try {
    const { disconnectWhatsApp } = require("../utils/whatsappSender");
    const result = await disconnectWhatsApp();
    if (result.success) {
      res.status(200).json({ message: "WhatsApp disconnected successfully." });
    } else {
      res.status(500).json({ message: "Failed to disconnect WhatsApp.", error: result.error });
    }
  } catch (error) {
    console.error("[Settings] Disconnect WhatsApp error:", error);
    res.status(500).json({ message: "An error occurred while disconnecting WhatsApp." });
  }
};

exports.linkWhatsApp = async (req, res) => {
  try {
    const { linkWhatsApp } = require("../utils/whatsappSender");
    const result = await linkWhatsApp();
    if (result.success) {
      res.status(200).json({ message: "WhatsApp linking started." });
    } else {
      res.status(500).json({ message: "Failed to link WhatsApp.", error: result.error });
    }
  } catch (error) {
    console.error("[Settings] Link WhatsApp error:", error);
    res.status(500).json({ message: "An error occurred while linking WhatsApp." });
  }
};
