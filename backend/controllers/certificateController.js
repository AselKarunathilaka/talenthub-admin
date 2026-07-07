const { v4: uuidv4 } = require("uuid");
const talentTrailService = require("../services/talentTrailService");
const InternRepository = require("../repositories/internRepository");
const InternTalentTrailSync = require("../models/InternTalentTrailSync");
const CertificateRecord = require("../models/CertificateRecord");

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
    let ttIntern = ttData.talentTrailIntern;
    let fallbackProjects = ttData.projects;

    // Fallback to local sync data if live TalentTrail fetch failed or returned no projects
    if (!ttIntern || fallbackProjects.length === 0) {
      try {
        const syncData = await InternTalentTrailSync.findOne({
          $or: [{ email: email }, { internRef: localIntern._id }],
        });

        if (syncData) {
          if (!ttIntern) {
            ttIntern = {
              name: syncData.name,
              email: syncData.email,
              internCode: syncData.internCode,
            };
          }
          if (fallbackProjects.length === 0 && syncData.projects && syncData.projects.length > 0) {
            fallbackProjects = syncData.projects;
          }
        }
      } catch (err) {
        console.warn("Failed to fetch local sync fallback data:", err.message);
      }
    }

    // Count meeting attendance from local DB (attendance array with status "Present")
    const localAttendanceCount = Array.isArray(localIntern.attendance)
      ? localIntern.attendance.filter((a) => a.status === "Present").length
      : 0;

<<<<<<< HEAD
    // Fetch approved extended leaves (study_leave)
    const LeaveRequest = require("../models/LeaveRequest");
    const extendedLeaves = await LeaveRequest.find({
      intern: localIntern._id,
      requestType: "study_leave",
      status: "Approved"
    }).select("leaveDate studyEndDate reason").lean();

=======
>>>>>>> talenthub/main
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
      projects: fallbackProjects.map((p) => ({
        projectName: p.projectName,
        supervisorName: p.supervisorName || "N/A",
        status: p.status || "N/A",
        description: p.description || "",
      })),
<<<<<<< HEAD
      extendedLeaves: extendedLeaves || [],
=======
>>>>>>> talenthub/main
      attendanceCount: ttData.attendanceCount || localAttendanceCount,
      source: {
        talentTrailConnected: !!ttIntern,
        projectsFromTalentTrail: fallbackProjects.length > 0,
      },
    };

    return res.status(200).json(certificateData);
  } catch (err) {
    console.error("getCertificateData error:", err);
    return res.status(500).json({ error: "Failed to fetch certificate data" });
  }
};

/**
 * POST /api/admin/intern/:internId/issue-certificate
 * Generates a unique verification token, saves a CertificateRecord, returns the token + verify URL.
 */
const issueCertificate = async (req, res) => {
  try {
    const { internId } = req.params;
    let { frontendOrigin } = req.body; // caller passes window.location.origin

    const localIntern = await InternRepository.getInternById(internId);
    if (!localIntern) {
      return res.status(404).json({ error: "Intern not found" });
    }

    const traineeId = localIntern.Trainee_ID || localIntern.traineeId;
    const email = localIntern.Trainee_Email || localIntern.email;

    // Normalize origin: always use http:// for localhost so Safari doesn't
    // silently upgrade to https:// and fail due to missing SSL cert.
    if (frontendOrigin) {
      frontendOrigin = frontendOrigin.replace(/^https:\/\/(localhost|127\.0\.0\.1)/, "http://$1");
    } else {
      frontendOrigin = "http://localhost:3000";
    }

    // Re-use existing valid token for this intern (so re-downloads keep same QR)
    let existingRecord = await CertificateRecord.findOne({
      internId: localIntern._id,
      isValid: true,
    });

    let token;
    if (existingRecord) {
      token = existingRecord.verificationToken;
      // Update issuedAt to now for the new download
      existingRecord.issuedAt = new Date();
      await existingRecord.save();
    } else {
      token = uuidv4();
      await CertificateRecord.create({
        verificationToken: token,
        internId: localIntern._id,
        traineeId: traineeId || "N/A",
        traineeName: localIntern.Trainee_Name || "N/A",
        email: email || "",
        institute: localIntern.Institute || "",
        fieldOfSpecialization: localIntern.field_of_spec_name || "",
        trainingStartDate: localIntern.Training_StartDate || null,
        trainingEndDate: localIntern.Training_EndDate || null,
        issuedAt: new Date(),
        isValid: true,
      });
    }

    const verificationUrl = `${frontendOrigin}/verify/certificate/${token}`;

    return res.status(200).json({ token, verificationUrl });
  } catch (err) {
    console.error("issueCertificate error:", err);
    return res.status(500).json({ error: "Failed to issue certificate" });
  }
};

/**
 * GET /api/verify/certificate/:token
 * PUBLIC — no auth required. Verifies a certificate token.
 */
const verifyCertificate = async (req, res) => {
  try {
    const { token } = req.params;

    const record = await CertificateRecord.findOne({ verificationToken: token });

    if (!record) {
      return res.status(404).json({ valid: false, message: "Certificate not found" });
    }

    if (!record.isValid) {
      return res.status(200).json({ valid: false, message: "Certificate has been revoked" });
    }

    return res.status(200).json({
      valid: true,
      certificate: {
        traineeName: record.traineeName,
        traineeId: record.traineeId,
        email: record.email,
        institute: record.institute,
        fieldOfSpecialization: record.fieldOfSpecialization,
        trainingStartDate: record.trainingStartDate,
        trainingEndDate: record.trainingEndDate,
        issuedAt: record.issuedAt,
      },
    });
  } catch (err) {
    console.error("verifyCertificate error:", err);
    return res.status(500).json({ valid: false, message: "Verification failed" });
  }
};

module.exports = { getCertificateData, issueCertificate, verifyCertificate };
