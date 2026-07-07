const Announcement = require("../models/Announcement");

// POST /api/admin/announcements
const createAnnouncement = async (req, res) => {
  try {
<<<<<<< HEAD
    const { title, message, priority, showAsPopup } = req.body;
=======
    const { title, message, priority } = req.body;
>>>>>>> talenthub/main

    if (!title || !message) {
      return res
        .status(400)
        .json({ message: "Title and message are required." });
    }

    const createdBy =
      req.user?.email ||
      req.user?.name ||
      req.user?.username ||
      req.user?.adminName ||
      "Admin";

    const announcement = await Announcement.create({
      title,
      message,
      priority: priority || "normal",
<<<<<<< HEAD
      showAsPopup: Boolean(showAsPopup),
=======
>>>>>>> talenthub/main
      createdBy,
    });

    return res.status(201).json(announcement);
  } catch (error) {
    console.error("Error creating announcement:", error);
    return res.status(500).json({ message: "Failed to create announcement." });
  }
};

// GET /api/admin/announcements — admin list, newest first
const getAllAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json(announcements);
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return res.status(500).json({ message: "Failed to fetch announcements." });
  }
};

// GET /api/announcements/active — intern-facing, returns all announcements
const getActiveAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json(announcements);
  } catch (error) {
    console.error("Error fetching active announcements:", error);
    return res.status(500).json({ message: "Failed to fetch announcements." });
  }
};

// DELETE /api/admin/announcements/:id
const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findByIdAndDelete(id);

    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found." });
    }

    return res
      .status(200)
      .json({ message: "Announcement deleted successfully." });
  } catch (error) {
    console.error("Error deleting announcement:", error);
    return res.status(500).json({ message: "Failed to delete announcement." });
  }
};

module.exports = {
  createAnnouncement,
  getAllAnnouncements,
  getActiveAnnouncements,
  deleteAnnouncement,
};
