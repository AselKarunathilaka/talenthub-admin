const Announcement = require("../models/Announcement");
const Intern = require("../models/Intern");
const { sendEmail } = require("../utils/emailSender");
const { sendWhatsAppMessage } = require("../utils/whatsappSender");
const { getActiveInternsQuery } = require("../utils/workingDays");

// POST /api/admin/announcements
const createAnnouncement = async (req, res) => {
  try {
    const { title, message, priority, showAsPopup, alwaysDisplay } = req.body;

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
      showAsPopup: Boolean(showAsPopup),
      alwaysDisplay: Boolean(alwaysDisplay),
      createdBy,
    });

    
    // Asynchronously send to all active interns
    Intern.find(getActiveInternsQuery())
      .select("Trainee_Email Trainee_Phone")
      .lean()
      .then(async (interns) => {
        console.log(`[Announcements] Sending mass announcement to ${interns.length} interns...`);
        for (const intern of interns) {
          if (intern.Trainee_Email) {
            await sendEmail({
              to: intern.Trainee_Email,
              subject: `TalentHub Announcement: ${title}`,
              text: message,
              html: `<h2>${title}</h2><p>${message.replace(/\n/g, '<br/>')}</p>`
            }).catch(() => {});
          }
          if (intern.Trainee_Phone) {
            await sendWhatsAppMessage(intern.Trainee_Phone, `📢 *TalentHub Announcement*\n\n*${title}*\n\n${message}`).catch(() => {});
          }
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay to prevent rate limits
        }
        console.log(`[Announcements] Finished sending mass announcement to ${interns.length} interns.`);
      })
      .catch(err => console.error("Error fetching interns for mass announcement:", err));

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

// GET /api/announcements/active — intern-facing, returns all active unread announcements
const getActiveAnnouncements = async (req, res) => {
  try {
    const intern = await Intern.findById(req.user.id).lean();
    const readIds = intern?.readAnnouncements || [];
    const announcements = await Announcement.find({ _id: { $nin: readIds } })
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json(announcements);
  } catch (error) {
    console.error("Error fetching active announcements:", error);
    return res.status(500).json({ message: "Failed to fetch announcements." });
  }
};

// POST /api/announcements/:id/read
const markAnnouncementAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const intern = await Intern.findById(req.user.id);
    
    if (!intern) {
      return res.status(404).json({ message: "Intern not found." });
    }
    
    if (!intern.readAnnouncements.includes(id)) {
      intern.readAnnouncements.push(id);
      await intern.save();
    }
    
    return res.status(200).json({ message: "Announcement marked as read." });
  } catch (error) {
    console.error("Error marking announcement as read:", error);
    return res.status(500).json({ message: "Failed to mark announcement as read." });
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
  markAnnouncementAsRead,
  deleteAnnouncement,
};
