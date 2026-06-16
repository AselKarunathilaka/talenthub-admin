const mongoose = require("mongoose");

/**
 * FeatureTip
 * Stores admin-created "what's new" tips that are shown once to every intern
 * (both existing and newly-joined) the first time they log in after the tip
 * was created.
 *
 * Workflow:
 *  1. Admin creates a FeatureTip from the admin panel.
 *  2. When any intern opens the Dashboard, the frontend calls
 *     GET /api/feature-tips/unseen to fetch active tips not yet seen by
 *     that intern.
 *  3. The modal is shown. On dismiss, the frontend calls
 *     POST /api/feature-tips/mark-seen  { tipId }.
 *  4. The tipId is appended to intern.seenFeatureTipIds so the tip is never
 *     shown again to that intern.
 */
const featureTipSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [120, "Title must be 120 characters or less"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [1000, "Description must be 1000 characters or less"],
    },
    // Optional: which section this tip relates to (shown as a badge)
    section: {
      type: String,
      trim: true,
      default: "",
    },
    // Emoji or short icon label displayed in the modal header
    emoji: {
      type: String,
      default: "✨",
    },
    // Accent color for the modal (hex)
    color: {
      type: String,
      default: "#0ea5e9",
    },
    // Admin can deactivate a tip so it stops being shown to new users
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: String,
      default: "Admin",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("FeatureTip", featureTipSchema);
