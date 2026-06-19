/**
 * featureTipController.js
 *
 * Handles admin CRUD for FeatureTip documents and the intern-facing
 * endpoints that return unseen tips and mark tips as seen.
 */

const FeatureTip = require("../models/FeatureTip");
const Intern = require("../models/Intern");

// ─── Admin endpoints ─────────────────────────────────────────────────────────

/**
 * GET /api/admin/feature-tips
 * Returns all tips (active + inactive), newest first.
 */
const getAllFeatureTips = async (req, res) => {
  try {
    const tips = await FeatureTip.find().sort({ createdAt: -1 });
    res.json(tips);
  } catch (err) {
    console.error("[FeatureTip] getAllFeatureTips error:", err);
    res.status(500).json({ message: "Failed to fetch feature tips." });
  }
};

/**
 * POST /api/admin/feature-tips
 * Body: { title, description, section?, emoji?, color? }
 */
const createFeatureTip = async (req, res) => {
  try {
    const { title, description, section, emoji, color } = req.body;
    if (!title?.trim() || !description?.trim()) {
      return res
        .status(400)
        .json({ message: "Title and description are required." });
    }

    const tip = await FeatureTip.create({
      title: title.trim(),
      description: description.trim(),
      section: section?.trim() || "",
      emoji: emoji?.trim() || "✨",
      color: color || "#0ea5e9",
      isActive: true,
    });

    res.status(201).json(tip);
  } catch (err) {
    console.error("[FeatureTip] createFeatureTip error:", err);
    res.status(500).json({ message: "Failed to create feature tip." });
  }
};

/**
 * PATCH /api/admin/feature-tips/:id/toggle
 * Toggles isActive on a tip.
 */
const toggleFeatureTip = async (req, res) => {
  try {
    const tip = await FeatureTip.findById(req.params.id);
    if (!tip)
      return res.status(404).json({ message: "Feature tip not found." });

    tip.isActive = !tip.isActive;
    await tip.save();

    res.json(tip);
  } catch (err) {
    console.error("[FeatureTip] toggleFeatureTip error:", err);
    res.status(500).json({ message: "Failed to toggle feature tip." });
  }
};

/**
 * DELETE /api/admin/feature-tips/:id
 */
const deleteFeatureTip = async (req, res) => {
  try {
    const tip = await FeatureTip.findByIdAndDelete(req.params.id);
    if (!tip)
      return res.status(404).json({ message: "Feature tip not found." });

    res.json({ message: "Feature tip deleted.", id: req.params.id });
  } catch (err) {
    console.error("[FeatureTip] deleteFeatureTip error:", err);
    res.status(500).json({ message: "Failed to delete feature tip." });
  }
};

// ─── Intern-facing endpoints ──────────────────────────────────────────────────

/**
 * GET /api/feature-tips/unseen
 * Returns active tips the calling intern has NOT yet dismissed.
 * The intern JWT is validated by authMiddleware; req.internId is set.
 */
const getUnseenFeatureTips = async (req, res) => {
  try {
    const internId = req.user?._id || req.user?.id;
    const intern = await Intern.findById(internId).select("seenFeatureTipIds");
    if (!intern) return res.status(404).json({ message: "Intern not found." });

    const seen = intern.seenFeatureTipIds || [];

    const tips = await FeatureTip.find({
      isActive: true,
      _id: { $nin: seen },
    }).sort({ createdAt: -1 });

    res.json(tips);
  } catch (err) {
    console.error("[FeatureTip] getUnseenFeatureTips error:", err);
    res.status(500).json({ message: "Failed to fetch unseen tips." });
  }
};

/**
 * POST /api/feature-tips/mark-seen
 * Body: { tipId }
 * Appends tipId to intern.seenFeatureTipIds so it won't be shown again.
 */
const markFeatureTipSeen = async (req, res) => {
  try {
    const internId = req.user?._id || req.user?.id;
    const { tipId } = req.body;
    if (!tipId) return res.status(400).json({ message: "tipId is required." });

    await Intern.findByIdAndUpdate(
      internId,
      { $addToSet: { seenFeatureTipIds: String(tipId) } },
      { new: true },
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("[FeatureTip] markFeatureTipSeen error:", err);
    res.status(500).json({ message: "Failed to mark tip as seen." });
  }
};

module.exports = {
  // Admin
  getAllFeatureTips,
  createFeatureTip,
  toggleFeatureTip,
  deleteFeatureTip,
  // Intern
  getUnseenFeatureTips,
  markFeatureTipSeen,
};
