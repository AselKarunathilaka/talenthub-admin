const UniversityUser = require("../models/UniversityUser");
const Intern = require("../models/Intern");
const { 
  getUniversityStudents,
  getUniversityStudentDetails,
  getUniversityStudentGitCommits,
  addStudentFeedback,
  updateStudentFeedback,
  deleteStudentFeedback 
} = require("./universityController");
const {
  sendUniversityApprovalEmail,
  sendUniversityRejectionEmail,
} = require("../utils/emailSender");

/**
 * Get all university users and requests with intern counts
 */
exports.getAllUniversities = async (req, res) => {
  try {
    const universities = await UniversityUser.find().sort({ createdAt: -1 }).lean();
    
    // Aggregate intern counts per university
    const interns = await Intern.find({}, "Institute institute").lean();
    
    const universityCounts = {};
    interns.forEach(intern => {
      const inst = String(intern.Institute || intern.institute || "").trim().toLowerCase();
      if (inst) {
        if (!universityCounts[inst]) universityCounts[inst] = 0;
        universityCounts[inst]++;
      }
    });

    // Match up counts using a naive includes/startsWith check (since data might be messy)
    const enriched = universities.map(u => {
      const nameLower = u.universityName.toLowerCase();
      const firstWord = nameLower.split(" ")[0];
      
      let count = 0;
      for (const [inst, c] of Object.entries(universityCounts)) {
        if (inst.includes(nameLower) || nameLower.includes(inst) || inst.includes(firstWord)) {
          count += c;
        }
      }
      return { ...u, studentCount: count };
    });

    res.status(200).json(enriched);
  } catch (error) {
    console.error("Error fetching universities:", error);
    res.status(500).json({ error: "Failed to fetch universities" });
  }
};

/**
 * Approve a university access request
 */
exports.approveUniversityRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const adminEmail = req.user.email; // assuming admin email is in req.user

    const university = await UniversityUser.findById(id);
    if (!university) {
      return res.status(404).json({ error: "University request not found" });
    }

    university.status = "approved";
    university.approvedAt = new Date();
    university.approvedBy = adminEmail;
    await university.save();

    // Send email
    await sendUniversityApprovalEmail({
      to: university.email,
      supervisorName: university.supervisorName,
      universityName: university.universityName,
    });

    res.status(200).json({ message: "University request approved successfully", university });
  } catch (error) {
    console.error("Error approving university request:", error);
    res.status(500).json({ error: "Failed to approve request" });
  }
};

/**
 * Reject a university access request
 */
exports.rejectUniversityRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const adminEmail = req.user.email;

    const university = await UniversityUser.findById(id);
    if (!university) {
      return res.status(404).json({ error: "University request not found" });
    }

    university.status = "rejected";
    university.rejectedAt = new Date();
    university.rejectedBy = adminEmail;
    university.rejectionReason = rejectionReason || "No specific reason provided.";
    await university.save();

    // Send email
    await sendUniversityRejectionEmail({
      to: university.email,
      supervisorName: university.supervisorName,
      universityName: university.universityName,
      rejectionReason: university.rejectionReason,
    });

    res.status(200).json({ message: "University request rejected successfully", university });
  } catch (error) {
    console.error("Error rejecting university request:", error);
    res.status(500).json({ error: "Failed to reject request" });
  }
};

/**
 * Delete a university request/user
 */
exports.deleteUniversityRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const university = await UniversityUser.findByIdAndDelete(id);
    
    if (!university) {
      return res.status(404).json({ error: "University request not found" });
    }

    res.status(200).json({ message: "University record deleted successfully" });
  } catch (error) {
    console.error("Error deleting university request:", error);
    res.status(500).json({ error: "Failed to delete request" });
  }
};

/**
 * Get university students for admin (bypasses university auth)
 */
exports.getUniversityStudentsForAdmin = async (req, res) => {
  try {
    const { universityName } = req.params;

    // We emulate a university supervisor object so the existing logic works seamlessly
    req.universityUser = {
      universityName: universityName,
    };
    req.universitySupervisor = {
      universityName: universityName,
      supervisorName: "Admin Dashboard",
    };

    return getUniversityStudents(req, res);
  } catch (error) {
    console.error("[AdminUniversityController] Error getting students:", error);
    res.status(500).json({ message: "Failed to fetch university students" });
  }
};

const emulateSupervisor = (req) => {
  if (!req.universitySupervisor) {
    req.universitySupervisor = {
      _id: req.user?._id || "000000000000000000000000",
      supervisorName: req.user?.name || "Admin",
      universityName: req.params.universityName || "Admin Dashboard",
    };
  }
};

exports.getUniversityStudentDetailsForAdmin = async (req, res) => {
  emulateSupervisor(req);
  return getUniversityStudentDetails(req, res);
};

exports.getUniversityStudentGitCommitsForAdmin = async (req, res) => {
  emulateSupervisor(req);
  return getUniversityStudentGitCommits(req, res);
};

exports.addStudentFeedbackForAdmin = async (req, res) => {
  emulateSupervisor(req);
  return addStudentFeedback(req, res);
};

exports.updateStudentFeedbackForAdmin = async (req, res) => {
  emulateSupervisor(req);
  return updateStudentFeedback(req, res);
};

exports.deleteStudentFeedbackForAdmin = async (req, res) => {
  emulateSupervisor(req);
  return deleteStudentFeedback(req, res);
};
