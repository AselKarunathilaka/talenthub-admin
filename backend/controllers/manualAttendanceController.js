const Intern = require("../models/Intern");
const moment = require("moment-timezone");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const TZ = "Asia/Colombo";

// ---------------------------------------------------------------------------
// GET /admin/manual-attendance/search?q=<query>
// Searches interns by Trainee_ID, Trainee_Name, or Trainee_Email.
// Returns up to 10 matches.
// ---------------------------------------------------------------------------
exports.searchInternForAttendance = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const regex = new RegExp(q, "i");

    const interns = await Intern.find({
      $or: [
        { Trainee_ID: regex },
        { Trainee_Name: regex },
        { Trainee_Email: regex },
      ],
    })
      .select(
        "_id Trainee_ID Trainee_Name Trainee_Email Institute field_of_spec_name team Training_StartDate Training_EndDate",
      )
      .limit(10)
      .lean();

    return res.json({ interns });
  } catch (err) {
    console.error("searchInternForAttendance error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// POST /admin/manual-attendance/mark
//
// Body:
//   {
//     internId    : string   (Mongo _id)
//     date        : string   (YYYY-MM-DD — local Sri Lanka date chosen by admin)
//     status      : "Present" | "Absent"
//     mode        : "daily" | "meeting"
//     meetingName : string   (required when mode === "meeting")
//   }
//
// Attendance types written to DB:
//   mode === "daily"   → type = "manual_daily"
//   mode === "meeting" → type = "manual_meeting"
//
// The date stored is the start-of-day in Asia/Colombo so it is consistent
// with how other attendance records are stored (midnight LKT → UTC).
// ---------------------------------------------------------------------------
exports.markManualAttendance = async (req, res) => {
  try {
    const { internId, date, status, mode, meetingName } = req.body;

    // ── Validate required fields ──────────────────────────────────────────
    if (!internId)
      return res.status(400).json({ error: "internId is required" });
    if (!date) return res.status(400).json({ error: "date is required" });
    if (!["Present", "Absent"].includes(status)) {
      return res
        .status(400)
        .json({ error: "status must be 'Present' or 'Absent'" });
    }
    if (!["daily", "meeting"].includes(mode)) {
      return res
        .status(400)
        .json({ error: "mode must be 'daily' or 'meeting'" });
    }
    if (mode === "meeting" && (!meetingName || !meetingName.trim())) {
      return res
        .status(400)
        .json({ error: "meetingName is required for meeting attendance" });
    }

    // ── Find intern ────────────────────────────────────────────────────────
    const intern = await Intern.findById(internId);
    if (!intern) return res.status(404).json({ error: "Intern not found" });

    // ── Build the attendance record ────────────────────────────────────────
    // Store the chosen date as midnight in Asia/Colombo time.
    const attendanceDate = moment
      .tz(date, "YYYY-MM-DD", TZ)
      .startOf("day")
      .toDate();
    const now = new Date();

    const type = mode === "daily" ? "manual_daily" : "manual_meeting";

    const record = {
      date: attendanceDate,
      status,
      type,
      timeMarked: now,
      ...(mode === "meeting" && { meetingName: meetingName.trim() }),
    };

    // ── Duplicate guard ───────────────────────────────────────────────────
    // Prevent marking the exact same type + date combination more than once
    // per admin action (allow re-marking if status changes).
    const duplicate = intern.attendance.find((a) => {
      const aDate = moment(a.date).tz(TZ).format("YYYY-MM-DD");
      const sameDate = aDate === date;
      const sameType = a.type === type;
      const sameMeeting =
        mode !== "meeting" ||
        (a.meetingName || "").toLowerCase() ===
          (meetingName || "").trim().toLowerCase();
      return sameDate && sameType && sameMeeting;
    });

    if (duplicate) {
      // Update existing record instead of inserting a duplicate
      duplicate.status = status;
      duplicate.timeMarked = now;
    } else {
      intern.attendance.push(record);
    }

    await intern.save();

    return res.json({
      success: true,
      message: `${status} marked as ${type} for ${intern.Trainee_Name}`,
      record: duplicate || record,
      intern: {
        _id: intern._id,
        Trainee_ID: intern.Trainee_ID,
        Trainee_Name: intern.Trainee_Name,
      },
    });
  } catch (err) {
    console.error("markManualAttendance error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// POST /admin/manual-attendance/bulk-mark
//
// Body:
//   {
//     internIds   : string[]  (Array of Trainee_IDs to search for)
//     date        : string    (YYYY-MM-DD)
//     status      : "Present" | "Absent"
//     mode        : "daily" | "meeting"
//     meetingName : string    (required when mode === "meeting")
//   }
//
// Returns:
//   {
//     results: [
//       { internId: "...", internName: "...", success: true },
//       { internId: "...", success: false, error: "Intern not found" }
//     ]
//   }
// ---------------------------------------------------------------------------
exports.bulkMarkAttendance = async (req, res) => {
  try {
    const { internIds, date, status, mode, meetingName } = req.body;

    // ── Validate required fields ──────────────────────────────────────────
    if (!Array.isArray(internIds) || internIds.length === 0) {
      return res
        .status(400)
        .json({ error: "internIds must be a non-empty array" });
    }
    if (!date) return res.status(400).json({ error: "date is required" });
    if (!["Present", "Absent"].includes(status)) {
      return res
        .status(400)
        .json({ error: "status must be 'Present' or 'Absent'" });
    }
    if (!["daily", "meeting"].includes(mode)) {
      return res
        .status(400)
        .json({ error: "mode must be 'daily' or 'meeting'" });
    }
    if (mode === "meeting" && (!meetingName || !meetingName.trim())) {
      return res
        .status(400)
        .json({ error: "meetingName is required for meeting attendance" });
    }

    const attendanceDate = moment
      .tz(date, "YYYY-MM-DD", TZ)
      .startOf("day")
      .toDate();
    const now = new Date();
    const type = mode === "daily" ? "manual_daily" : "manual_meeting";
    const results = [];

    // ── Process each intern ID ─────────────────────────────────────────────
    for (const internId of internIds) {
      try {
        // Find by Trainee_ID (the user-facing ID, not MongoDB _id)
        const intern = await Intern.findOne({ Trainee_ID: internId });

        if (!intern) {
          results.push({
            internId,
            success: false,
            error: "Intern not found",
          });
          continue;
        }

        // Build attendance record
        const record = {
          date: attendanceDate,
          status,
          type,
          timeMarked: now,
          ...(mode === "meeting" && { meetingName: meetingName.trim() }),
        };

        // Check for duplicate
        const duplicate = intern.attendance.find((a) => {
          const aDate = moment(a.date).tz(TZ).format("YYYY-MM-DD");
          const sameDate = aDate === date;
          const sameType = a.type === type;
          const sameMeeting =
            mode !== "meeting" ||
            (a.meetingName || "").toLowerCase() ===
              (meetingName || "").trim().toLowerCase();
          return sameDate && sameType && sameMeeting;
        });

        if (duplicate) {
          duplicate.status = status;
          duplicate.timeMarked = now;
        } else {
          intern.attendance.push(record);
        }

        await intern.save();

        results.push({
          internId: intern.Trainee_ID,
          internName: intern.Trainee_Name,
          success: true,
        });
      } catch (error) {
        results.push({
          internId,
          success: false,
          error: error.message || "Error marking attendance",
        });
      }
    }

    return res.json({
      success: true,
      results,
    });
  } catch (err) {
    console.error("bulkMarkAttendance error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
// ---------------------------------------------------------------------------
// POST /admin/manual-attendance/upload-txt
// Upload TXT file containing Intern IDs
// ---------------------------------------------------------------------------

exports.uploadAttendancePdf = async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({
        error: "PDF file is required"
      });
    }


    const text = req.file.buffer.toString("utf-8");


    const internIds = [
      ...new Set(
        text
          .split(/[\n,\r]+/)
          .map(id => id.trim())
          .filter(Boolean)
      )
    ];


    if (internIds.length === 0) {
      return res.status(400).json({
        error: "No Intern IDs found in PDF file"
      });
    }


    // Reuse existing bulk attendance logic
    req.body.internIds = internIds;


    return exports.bulkMarkAttendance(req, res);


  } catch (error) {

    console.error(
      "uploadAttendancePdf error:",
      error
    );


    return res.status(500).json({
      error: "Failed to process PDF file"
    });

  }
};

// ---------------------------------------------------------------------------
// POST /admin/manual-attendance/extract-ids-from-images
// Upload image files containing attendance sheets, uses Gemini to extract IDs
// ---------------------------------------------------------------------------
exports.extractIdsFromImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No images provided" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API_KEY is not configured on the server." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const requestOptions = {};
    if (process.env.GEMINI_BASE_URL) {
      requestOptions.baseUrl = process.env.GEMINI_BASE_URL;
    }
    
    // Use gemini-3.1-flash-lite to match the logbook API
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" }, requestOptions);

    const prompt = `Please extract all 4-digit numeric Intern IDs from this attendance sheet. Look for numbers between 3000 and 9999. Return ONLY a comma-separated list of the extracted numbers. Do not include any other text or explanation. Ignore dates, times, page numbers, or other non-ID text.`;
    
    const allFoundIds = [];

    // Process each image separately for maximum accuracy
    await Promise.all(
      req.files.map(async (file) => {
        try {
          const imagePart = {
            inlineData: {
              data: file.buffer.toString("base64"),
              mimeType: file.mimetype,
            },
          };

          const result = await model.generateContent([prompt, imagePart]);
          const responseText = result.response.text();

          const words = responseText.split(/[\s,]+/);
          words.forEach((word) => {
            const cleanWord = word.replace(/[^0-9]/g, "");
            if (/^\d{4}$/.test(cleanWord)) {
              const id = Number(cleanWord);
              if (id >= 3000 && id <= 9999) {
                allFoundIds.push(cleanWord);
              }
            }
          });
        } catch (err) {
          console.error("Vision processing error for one file:", err);
        }
      })
    );

    const uniqueIds = [...new Set(allFoundIds)];
    
    return res.json({ success: true, ids: uniqueIds });

  } catch (error) {
    console.error("extractIdsFromImages error:", error);
    return res.status(500).json({ error: "Failed to extract IDs" });
  }
};
