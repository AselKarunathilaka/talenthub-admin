const talentTrailService = require("../services/talentTrailService");
const InternRepository = require("../repositories/internRepository");

/**
 * GET /api/admin/intern/:internId/certificate-data
 * Returns enriched certificate data by combining TalentHub + TalentTrail data.
 */
const getCertificateData = async (req, res) => {
  try {
    const { internId } = req.params;

    // 1. Get intern from local TalentHub DB
    const localIntern = await InternRepository.getInternById(internId);
    if (!localIntern) {
      return res.status(404).json({ error: "Intern not found in TalentHub" });
    }

    const traineeId = localIntern.Trainee_ID || localIntern.traineeId;
    const email = localIntern.Trainee_Email || localIntern.email;

    // 2. Fetch enriched data from TalentTrail API
    let ttData = { talentTrailIntern: null, projects: [], attendanceCount: 0 };
    try {
      ttData = await talentTrailService.getCertificateData(traineeId, email);
    } catch (err) {
      console.warn("TalentTrail fetch failed (continuing with local data):", err.message);
    }

    // 3. Merge data — prefer TalentTrail data where available
    const ttIntern = ttData.talentTrailIntern;

    // Count meeting attendance from local DB (attendance array with status "Present")
    const localAttendanceCount = Array.isArray(localIntern.attendance)
      ? localIntern.attendance.filter((a) => a.status === "Present").length
      : 0;

    const certificateData = {
      intern: {
        name: ttIntern?.name || localIntern.Trainee_Name || "N/A",
        traineeId: traineeId || "N/A",
        email: email || "N/A",
        institute: ttIntern?.institute || localIntern.Institute || "N/A",
        fieldOfSpecialization:
          ttIntern?.fieldOfSpecialization ||
          localIntern.field_of_spec_name ||
          "N/A",
        trainingStartDate:
          ttIntern?.trainingStartDate ||
          localIntern.Training_StartDate ||
          null,
        trainingEndDate:
          ttIntern?.trainingEndDate ||
          localIntern.Training_EndDate ||
          null,
        status: ttIntern?.status || localIntern.status || "N/A",
      },
      projects: ttData.projects.map((p) => ({
        projectName: p.projectName,
        supervisorName: p.supervisorName || "N/A",
        status: p.status || "N/A",
        description: p.description || "",
      })),
      attendanceCount: ttData.attendanceCount || localAttendanceCount,
      source: {
        talentTrailConnected: !!ttIntern,
        projectsFromTalentTrail: ttData.projects.length > 0,
      },
    };

    return res.status(200).json(certificateData);
  } catch (err) {
    console.error("getCertificateData error:", err);
    return res.status(500).json({ error: "Failed to fetch certificate data" });
  }
};

module.exports = { getCertificateData };
