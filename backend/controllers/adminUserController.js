const User = require("../models/User");
const { ALL_PERMISSIONS, permissionsForRole } = require("../config/adminPermissions");

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  picture: user.picture,
  role: user.role || "supervisor",
  permissions: user.permissions || [],
  isActive: user.isActive !== false,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
});

exports.listUsers = async (_req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ users: users.map(publicUser), availablePermissions: ALL_PERMISSIONS });
  } catch (error) { next(error); }
};

exports.createUser = async (req, res, next) => {
  try {
    const { name = "", email, role, permissions } = req.body;
    if (!email || !["admin", "supervisor"].includes(role)) {
      return res.status(400).json({ message: "A valid email and role are required." });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ message: "A user with this email already exists." });
    }
    const allowed = Array.isArray(permissions)
      ? permissions.filter((item) => ALL_PERMISSIONS.includes(item) && item !== "users.manage")
      : permissionsForRole(role);
    const user = await User.create({ name, email: normalizedEmail, role, permissions: allowed, createdBy: req.admin._id });
    res.status(201).json({ user: publicUser(user) });
  } catch (error) { next(error); }
};

exports.updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.role === "super_admin") return res.status(403).json({ message: "Super-admin accounts cannot be changed here." });
    if (String(user._id) === String(req.admin._id)) return res.status(400).json({ message: "You cannot change your own access." });

    const { name, role, permissions, isActive } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (role !== undefined) {
      if (!["admin", "supervisor"].includes(role)) return res.status(400).json({ message: "Invalid role." });
      updates.role = role;
    }
    if (permissions !== undefined) {
      if (!Array.isArray(permissions)) return res.status(400).json({ message: "Permissions must be an array." });
      updates.permissions = permissions.filter((item) => ALL_PERMISSIONS.includes(item) && item !== "users.manage");
    }
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    // Normalize historical accounts while updating them. Atomic updates avoid
    // re-validating unrelated legacy fields such as old password records.
    if (!user.role) updates.role = updates.role || "supervisor";
    if (!user.permissions) updates.permissions = updates.permissions || permissionsForRole(updates.role || "supervisor");
    const updatedUser = await User.findByIdAndUpdate(user._id, { $set: updates }, { new: true, runValidators: true });
    res.json({ user: publicUser(updatedUser) });
  } catch (error) { next(error); }
};
