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

    const certificateData = {
      intern: {
        name: ttIntern?.name || localIntern.Trainee_Name || localIntern.traineeName || "N/A",
        traineeId: traineeId || "N/A",
        email: email || "N/A",
        institute: ttIntern?.institute || localIntern.Institute || localIntern.institute || "N/A",
        fieldOfSpecialization:
          ttIntern?.fieldOfSpecialization ||
          localIntern.Field_of_Specialization ||
          localIntern.fieldOfSpecialization ||
          "N/A",
        trainingStartDate:
          ttIntern?.trainingStartDate ||
          localIntern.Training_Start_Date ||
          localIntern.trainingStartDate ||
          null,
        trainingEndDate:
          ttIntern?.trainingEndDate ||
          localIntern.Training_End_Date ||
          localIntern.trainingEndDate ||
          null,
        status: ttIntern?.status || localIntern.status || "N/A",
      },
      projects: ttData.projects.map((p) => ({
        projectName: p.projectName,
        supervisorName: p.supervisorName || "N/A",
        status: p.status || "N/A",
        description: p.description || "",
      })),
      attendanceCount: ttData.attendanceCount,
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
