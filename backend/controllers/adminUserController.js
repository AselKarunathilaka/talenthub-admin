const User = require("../models/User");
const { ALL_PERMISSIONS, permissionsForRole, permissionsForUser } = require("../config/adminPermissions");
const { sendAdminInvitationEmail } = require("../services/adminInvitationEmailService");

const RESEND_COOLDOWN_MS = 60 * 1000;

const sanitizePermissions = (role, permissions) => {
  const selected = (Array.isArray(permissions) ? permissions : permissionsForRole(role))
    .filter((item) => ALL_PERMISSIONS.includes(item));
  if (role === "admin" && !selected.includes("users.manage")) selected.push("users.manage");
  return role === "supervisor"
    ? selected.filter((item) => !["users.manage", "leave.manage"].includes(item))
    : selected;
};

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  picture: user.picture,
  authProvider: user.authProvider,
  role: user.role || "supervisor",
  permissions: user.permissions || [],
  isActive: user.isActive !== false,
  invitedAt: user.invitedAt,
  invitationEmailStatus: user.invitationEmailStatus,
  invitationEmailSentAt: user.invitationEmailSentAt,
  invitationEmailLastAttemptAt: user.invitationEmailLastAttemptAt,
  invitationEmailAttempts: user.invitationEmailAttempts || 0,
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
    const normalizedName = String(name).trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || !["admin", "supervisor"].includes(role)) {
      return res.status(400).json({ message: "A full name, valid Google email, and role are required." });
    }
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ message: "A user with this email already exists." });
    }
    const allowed = sanitizePermissions(role, permissions);
    const now = new Date();
    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      role,
      permissions: allowed,
      authProvider: "google",
      createdBy: req.admin._id,
      invitedAt: now,
      invitationEmailStatus: "pending",
      invitationEmailLastAttemptAt: now,
      invitationEmailAttempts: 1,
    });

    let invitation = { sent: false };
    try {
      const delivery = await sendAdminInvitationEmail({ user, inviter: req.admin });
      user.invitationEmailStatus = "sent";
      user.invitationEmailSentAt = new Date();
      user.invitationEmailError = undefined;
      invitation = { sent: true, messageId: delivery.messageId };
    } catch (emailError) {
      user.invitationEmailStatus = "failed";
      user.invitationEmailError = String(emailError.message || "Email delivery failed").slice(0, 500);
      invitation = { sent: false, error: "Account created, but the invitation email could not be delivered." };
      console.error(`Admin invitation email failed for ${normalizedEmail}:`, emailError.message);
    }
    await user.save();
    res.status(201).json({ user: publicUser(user), invitation });
  } catch (error) { next(error); }
};

exports.resendInvitation = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("+invitationEmailError");
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.role === "super_admin" || user.authProvider !== "google") {
      return res.status(400).json({ message: "Invitations are only available for Google Admin and Supervisor accounts." });
    }
    if (!user.isActive) return res.status(400).json({ message: "Activate this account before resending its invitation." });

    const lastAttempt = user.invitationEmailLastAttemptAt?.getTime() || 0;
    if (Date.now() - lastAttempt < RESEND_COOLDOWN_MS) {
      return res.status(429).json({ message: "Please wait one minute before resending this invitation." });
    }

    user.invitationEmailStatus = "pending";
    user.invitedAt = user.invitedAt || new Date();
    user.invitationEmailLastAttemptAt = new Date();
    user.invitationEmailAttempts = (user.invitationEmailAttempts || 0) + 1;
    await user.save();

    try {
      const delivery = await sendAdminInvitationEmail({ user, inviter: req.admin });
      user.invitationEmailStatus = "sent";
      user.invitationEmailSentAt = new Date();
      user.invitationEmailError = undefined;
      await user.save();
      return res.json({ user: publicUser(user), invitation: { sent: true, messageId: delivery.messageId } });
    } catch (emailError) {
      user.invitationEmailStatus = "failed";
      user.invitationEmailError = String(emailError.message || "Email delivery failed").slice(0, 500);
      await user.save();
      console.error(`Admin invitation resend failed for ${user.email}:`, emailError.message);
      return res.status(502).json({
        message: "The account is active, but the invitation email could not be delivered.",
        user: publicUser(user),
      });
    }
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
      if (permissions === undefined) updates.permissions = permissionsForRole(role);
    }
    if (permissions !== undefined) {
      if (!Array.isArray(permissions)) return res.status(400).json({ message: "Permissions must be an array." });
      updates.permissions = sanitizePermissions(role || user.role || "supervisor", permissions);
    }
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    // Normalize historical accounts while updating them. Atomic updates avoid
    // re-validating unrelated legacy fields such as old password records.
    if (!user.role) updates.role = updates.role || "supervisor";
    if (!user.permissions) updates.permissions = updates.permissions || permissionsForRole(updates.role || "supervisor");
    updates.permissions = permissionsForUser(
      { email: user.email, role: updates.role || user.role, permissions: updates.permissions || user.permissions },
    );
    const updatedUser = await User.findByIdAndUpdate(user._id, { $set: updates }, { new: true, runValidators: true });
    res.json({ user: publicUser(updatedUser) });
  } catch (error) { next(error); }
};
