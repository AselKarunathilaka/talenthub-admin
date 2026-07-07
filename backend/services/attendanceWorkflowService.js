const axios = require("axios");
const moment = require("moment-timezone");
const mongoose = require("mongoose");
const DailyRecord = require("../models/DailyRecord");
const FaceAttendanceLog = require("../models/FaceAttendanceLog");
const Intern = require("../models/Intern");
const externalConfig = require("../config/externalSystems");
const { selectCanonicalDailyEntry } = require("../utils/attendanceHistory");
const {
  evaluateDailyAttendanceAction,
  findExplicitAuditCheckout,
  normalizeAttendanceAction,
} = require("../utils/attendancePolicy");

const DAILY_ATTENDANCE_TYPES = ["daily_qr", "face"];
const MEETING_ATTENDANCE_TYPES = ["qr", "face_meeting", "meeting"];
const MINIMUM_CHECKOUT_MINUTES = Math.max(
  1,
  Number.parseInt(process.env.ATTENDANCE_MIN_CHECKOUT_MINUTES || "15", 10) || 15,
);

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getProjectKey = (value) => String(value || "").trim().replace(/\s+/g, " ");

const getExactProjectRegex = (value) => new RegExp(`^${escapeRegExp(String(value || "").trim().replace(/\s+/g, " "))}$`);

const getAttendanceMoment = (attendanceDate = null) =>
  attendanceDate ? moment.tz(attendanceDate, "Asia/Colombo") : moment.tz("Asia/Colombo");

const syncExternalAttendance = async ({ endpoint, sessionId, traineeId }) => {
  if (!externalConfig.attendanceSystem.enabled || !endpoint || !sessionId || !traineeId) {
    return;
  }

  try {
    await axios.post(
      `${externalConfig.attendanceSystem.baseUrl}${endpoint}`,
      {
        qrSessionId: sessionId,
        traineeId,
      },
      {
        timeout: externalConfig.attendanceSystem.timeout,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    // Attendance is saved locally even when the external system is unavailable.
  }
};

const reconcileDailyAttendanceDuplicates = async ({
  internId,
  todayStart,
  todayEnd,
  preferredMethod,
}) => {
  const intern = await Intern.findById(internId).select("attendance").lean();
  if (!intern) return;

  const dailyEntries = (intern.attendance || []).filter((entry) => {
    const entryDate = new Date(entry.date);
    return (
      DAILY_ATTENDANCE_TYPES.includes(String(entry.type || "")) &&
      entry.status === "Present" &&
      entryDate >= todayStart.toDate() &&
      entryDate <= todayEnd.toDate()
    );
  });
  if (dailyEntries.length < 2) return;

  const reconciliation = selectCanonicalDailyEntry(
    dailyEntries,
    preferredMethod,
  );
  if (!reconciliation?.duplicates.length) return;

  const setFields = {
    "attendance.$[record].type": reconciliation.canonicalType,
  };
  if (reconciliation.checkOutTime) {
    setFields["attendance.$[record].checkOutTime"] =
      reconciliation.checkOutTime;
  }

  await Intern.updateOne(
    { _id: internId },
    {
      $set: setFields,
      ...(reconciliation.canonicalType === "face"
        ? { $unset: { "attendance.$[record].qrCode": "" } }
        : {}),
    },
    {
      arrayFilters: [
        { "record._id": reconciliation.canonical._id },
      ],
    },
  );

  await Intern.updateOne(
    { _id: internId },
    {
      $pull: {
        attendance: {
          _id: {
            $in: reconciliation.duplicates.map((entry) => entry._id),
          },
        },
      },
    },
  );
};

const throwDailyAlreadyMarked = () => {
  const error = new Error("Daily attendance already marked today.");
  error.statusCode = 400;
  throw error;
};

const throwAttendanceError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const throwPolicyError = (policy) => {
  const error = new Error(policy.message);
  error.statusCode = 400;
  error.code = policy.code;
  error.alreadyMarked = Boolean(policy.alreadyMarked);
  error.retryAfterMinutes = policy.retryAfterMinutes;
  throw error;
};

const markDailyAttendance = async ({
  internId,
  sessionId = null,
  method = "daily_qr",
  attendanceDate = null,
  duplicateMessage = "Duplicate daily attendance detected. Please wait before scanning again.",
  syncEndpoint = null,
  allowCheckout = true,
  attendanceAction = "auto",
}) => {
  const intern = await Intern.findById(internId);
  if (!intern) throw new Error("Intern not found");

  const now = getAttendanceMoment(attendanceDate);
  const attendanceTime = now.toDate();
  const todayStart = now.clone().startOf("day");
  const todayEnd = now.clone().endOf("day");
  const today = todayStart.format("YYYY-MM-DD");
  const existingDailyRecord = await DailyRecord.findOne({ internId, date: today });
  const normalizedAttendanceAction = normalizeAttendanceAction(attendanceAction);
  const explicitCheckoutLogs = await FaceAttendanceLog.find({
    internId,
    attendanceDate: today,
    status: "present",
    "metadata.attendanceType": "daily",
    "metadata.attendanceAction": "check_out",
  })
    .select("attendanceTime metadata.attendanceAction")
    .lean();

  const session = await mongoose.startSession();
  let checkedOut = false;
  let dailyAttendanceMarked = false;
  try {
    await session.withTransaction(async () => {
      if (existingDailyRecord) {
        await DailyRecord.updateOne(
          {
            internId,
            date: today,
            $or: [
              { attendance: { $ne: "present" } },
              { attendanceTime: null },
            ],
          },
          {
            $set: {
              attendance: "present",
              attendanceTime,
            },
          },
          { session },
        );
      }

      const currentDailyAttendance = await Intern.findOne({
        _id: internId,
        attendance: {
          $elemMatch: {
            type: { $in: DAILY_ATTENDANCE_TYPES },
            status: "Present",
            date: { $gte: todayStart.toDate(), $lte: todayEnd.toDate() },
          },
        },
      })
        .session(session)
        .select("attendance");

      const currentDailyEntry = (currentDailyAttendance?.attendance || []).find((record) => {
        const recordDate = moment(record.date).tz("Asia/Colombo");
        return (
          String(record.status || "") === "Present" &&
          DAILY_ATTENDANCE_TYPES.includes(String(record.type || "")) &&
          recordDate.isSameOrAfter(todayStart) &&
          recordDate.isSameOrBefore(todayEnd)
        );
      });

      if (currentDailyEntry) {
        const currentType = String(currentDailyEntry.type || "");
        const recoveredCheckout = findExplicitAuditCheckout(
          explicitCheckoutLogs,
          currentDailyEntry.timeMarked || currentDailyEntry.date,
          MINIMUM_CHECKOUT_MINUTES,
        );
        if (!currentDailyEntry.checkOutTime && recoveredCheckout) {
          await Intern.updateOne(
            { _id: internId },
            { $set: { "attendance.$[record].checkOutTime": recoveredCheckout } },
            {
              session,
              arrayFilters: [
                {
                  "record.type": { $in: DAILY_ATTENDANCE_TYPES },
                  "record.status": "Present",
                  "record.date": {
                    $gte: todayStart.toDate(),
                    $lte: todayEnd.toDate(),
                  },
                },
              ],
            },
          );
          currentDailyEntry.checkOutTime = recoveredCheckout;
        }

        if (!allowCheckout && method === "face" && currentType === "daily_qr") {
          await Intern.updateOne(
            {
              _id: internId,
              "attendance.type": "daily_qr",
              "attendance.status": "Present",
              "attendance.date": { $gte: todayStart.toDate(), $lte: todayEnd.toDate() },
            },
            {
              $set: {
                "attendance.$[record].type": "face",
                "attendance.$[record].timeMarked": attendanceTime,
              },
              $unset: {
                "attendance.$[record].qrCode": "",
              },
            },
            {
              session,
              arrayFilters: [
                {
                  "record.type": "daily_qr",
                  "record.status": "Present",
                  "record.date": { $gte: todayStart.toDate(), $lte: todayEnd.toDate() },
                },
              ],
            },
          );

          dailyAttendanceMarked = true;
          return;
        }

        const policy = evaluateDailyAttendanceAction({
          action: normalizedAttendanceAction,
          currentEntry: currentDailyEntry,
          attendanceTime,
          allowCheckout,
          minimumCheckoutMinutes: MINIMUM_CHECKOUT_MINUTES,
        });
        if (policy.operation === "reject") throwPolicyError(policy);
        if (policy.operation === "noop") return;

        // Checkout is explicit at public Face/QR entry points. Meeting scans
        // pass allowCheckout=false so their automatic daily mark stays a no-op.
        await DailyRecord.updateOne(
          { internId, date: today },
          { $set: { checkOutTime: attendanceTime } },
          { session }
        );

        await Intern.updateOne(
          { _id: internId },
          {
            $set: {
              "attendance.$[record].checkOutTime": attendanceTime,
              ...(method === "face" && currentType === "daily_qr"
                ? { "attendance.$[record].type": "face" }
                : {}),
            },
            ...(method === "face" && currentType === "daily_qr"
              ? { $unset: { "attendance.$[record].qrCode": "" } }
              : {}),
          },
          {
            session,
            arrayFilters: [
              {
                "record.type": { $in: DAILY_ATTENDANCE_TYPES },
                "record.status": "Present",
                "record.date": { $gte: todayStart.toDate(), $lte: todayEnd.toDate() },
              },
            ],
          }
        );

        checkedOut = true;
        dailyAttendanceMarked = true;
        return;
      }

      const policy = evaluateDailyAttendanceAction({
        action: normalizedAttendanceAction,
        currentEntry: null,
        attendanceTime,
        allowCheckout,
        minimumCheckoutMinutes: MINIMUM_CHECKOUT_MINUTES,
      });
      if (policy.operation === "reject") throwPolicyError(policy);

      await Intern.updateOne(
        { _id: internId },
        {
          $push: {
            attendance: {
              date: todayStart.toDate(),
              status: "Present",
              type: method,
              timeMarked: attendanceTime,
              qrCode: method === "daily_qr" ? sessionId : undefined,
              meetingSessionId: method === "face" ? sessionId : undefined,
            },
          },
        },
        { session },
      );
      dailyAttendanceMarked = true;
    });
  } finally {
    await session.endSession();
  }

  if (dailyAttendanceMarked) {
    await syncExternalAttendance({
      endpoint: syncEndpoint,
      sessionId,
      traineeId: intern.Trainee_ID,
    });

    try {
      await reconcileDailyAttendanceDuplicates({
        internId,
        todayStart,
        todayEnd,
        preferredMethod: method,
      });
    } catch (error) {
      console.warn(
        "Failed to reconcile duplicate daily attendance:",
        error.message,
      );
    }
  }

  return {
    success: true,
    intern,
    timeMarked: attendanceTime,
    type: method,
    checkedOut,
    dailyAttendanceMarked,
  };
};

const getDailyAttendanceStatus = async (internId, attendanceDate = null) => {
  const now = getAttendanceMoment(attendanceDate);
  const todayStart = now.clone().startOf("day");
  const todayEnd = now.clone().endOf("day");
  const intern = await Intern.findById(internId).select("attendance").lean();
  if (!intern) throwAttendanceError("Intern not found", 404);

  const entries = (intern.attendance || []).filter((entry) => {
    const entryDate = new Date(entry.date);
    return (
      DAILY_ATTENDANCE_TYPES.includes(String(entry.type || "")) &&
      entry.status === "Present" &&
      entryDate >= todayStart.toDate() &&
      entryDate <= todayEnd.toDate()
    );
  });
  const reconciliation = selectCanonicalDailyEntry(entries, "face");
  const entry = reconciliation?.canonical || null;
  const explicitCheckoutLogs = entry
    ? await FaceAttendanceLog.find({
        internId,
        attendanceDate: todayStart.format("YYYY-MM-DD"),
        status: "present",
        "metadata.attendanceType": "daily",
        "metadata.attendanceAction": "check_out",
      })
        .select("attendanceTime metadata.attendanceAction")
        .lean()
    : [];
  const recoveredCheckout = entry
    ? findExplicitAuditCheckout(
        explicitCheckoutLogs,
        entry.timeMarked || entry.date,
        MINIMUM_CHECKOUT_MINUTES,
      )
    : null;
  const checkOutTime =
    reconciliation?.checkOutTime || recoveredCheckout || null;
  const state = !entry
    ? "not_checked_in"
    : checkOutTime
      ? "checked_out"
      : "checked_in";
  const checkInTime = entry?.timeMarked || entry?.date || null;
  const checkoutAvailableAt = checkInTime
    ? new Date(
        new Date(checkInTime).getTime() + MINIMUM_CHECKOUT_MINUTES * 60000,
      )
    : null;

  return {
    state,
    checkInTime,
    checkOutTime,
    checkoutAvailableAt,
    minimumCheckoutMinutes: MINIMUM_CHECKOUT_MINUTES,
  };
};

const markMeetingAttendance = async ({
  internId,
  projectName,
  meetingTitle,
  sessionId = null,
  method = "qr",
  meetingSessionId = null,
  attendanceDate = null,
  duplicateMessage = "Attendance for this project is already marked today.",
  syncEndpoint = null,
  dailySyncEndpoint = null,
  autoMarkDaily = true,
  dailyMethod = "daily_qr",
}) => {
  const intern = await Intern.findById(internId);
  if (!intern) throw new Error("Intern not found");

  const normalizedProjectName = String(projectName || meetingTitle || "").trim().replace(/\s+/g, " ");
  if (!normalizedProjectName) {
    const error = new Error("Project name is required.");
    error.statusCode = 400;
    throw error;
  }
  const projectKey = getProjectKey(normalizedProjectName);
  const projectRegex = getExactProjectRegex(normalizedProjectName);

  const now = getAttendanceMoment(attendanceDate);
  const attendanceTime = now.toDate();
  const todayStart = now.clone().startOf("day");
  const todayEnd = now.clone().endOf("day");
  const today = todayStart.format("YYYY-MM-DD");
  let dailyRecord = await DailyRecord.findOne({ internId, date: today });

  if (dailyRecord) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const hasDuplicate = await DailyRecord.findOne({
          _id: dailyRecord._id,
          meetingAttendance: {
            $elemMatch: {
              attendanceStatus: "present",
              $or: [
                { projectKey },
                { projectName: projectRegex },
                { meetingTitle: projectRegex },
              ],
            },
          },
        }).session(session);

        if (hasDuplicate) {
          throwAttendanceError(duplicateMessage);
        }

        await DailyRecord.updateOne(
          { _id: dailyRecord._id },
          {
            $set: {
              attendance: "present",
              attendanceTime,
            },
            $pull: {
              meetingAttendance: {
                $or: [
                  { projectKey },
                  { projectName: projectRegex },
                  { meetingTitle: projectRegex },
                ],
              },
            },
          },
          { session },
        );

        await DailyRecord.updateOne(
          { _id: dailyRecord._id },
          {
            $push: {
              meetingAttendance: {
                projectName: normalizedProjectName,
                projectKey,
                meetingTitle: normalizedProjectName,
                meetingSessionId: meetingSessionId || sessionId,
                method,
                attendanceStatus: "present",
                attendanceTime,
              },
            },
          },
          { session },
        );

        await Intern.updateOne(
          { _id: internId },
          {
            $pull: {
              attendance: {
                type: { $in: MEETING_ATTENDANCE_TYPES },
                meetingName: normalizedProjectName,
                date: { $gte: todayStart.toDate(), $lte: todayEnd.toDate() },
              },
            },
          },
          { session },
        );

        await Intern.updateOne(
          { _id: internId },
          {
            $push: {
              attendance: {
                date: attendanceTime,
                status: "Present",
                type: method,
                timeMarked: attendanceTime,
                meetingName: normalizedProjectName,
                projectName: normalizedProjectName,
                projectKey,
                qrCode: method === "qr" ? sessionId : undefined,
                meetingSessionId: method === "face_meeting" ? meetingSessionId || sessionId : undefined,
              },
            },
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    dailyRecord = await DailyRecord.findById(dailyRecord._id);
  } else {
    const updatedIntern = await Intern.findOneAndUpdate(
      {
        _id: internId,
        $nor: [
          {
            attendance: {
              $elemMatch: {
                type: { $in: MEETING_ATTENDANCE_TYPES },
                status: "Present",
                $or: [
                  { projectKey },
                  { projectName: projectRegex },
                  { meetingName: projectRegex },
                ],
                date: { $gte: todayStart.toDate(), $lte: todayEnd.toDate() },
              },
            },
          },
        ],
      },
      {
        $pull: {
          attendance: {
            type: { $in: MEETING_ATTENDANCE_TYPES },
            $or: [
              { projectKey },
              { projectName: projectRegex },
              { meetingName: projectRegex },
            ],
            date: { $gte: todayStart.toDate(), $lte: todayEnd.toDate() },
          },
        },
      },
      { new: true },
    );

    if (!updatedIntern) {
      throwAttendanceError(duplicateMessage);
    }

    await Intern.updateOne(
      { _id: internId },
      {
        $push: {
          attendance: {
            date: attendanceTime,
            status: "Present",
            type: method,
            timeMarked: attendanceTime,
            meetingName: normalizedProjectName,
            projectName: normalizedProjectName,
            projectKey,
            qrCode: method === "qr" ? sessionId : undefined,
            meetingSessionId: method === "face_meeting" ? meetingSessionId || sessionId : undefined,
          },
        },
      },
    );
  }

  await syncExternalAttendance({
    endpoint: syncEndpoint,
    sessionId: sessionId || meetingSessionId,
    traineeId: intern.Trainee_ID,
  });

  let dailyAttendanceMarked = false;
  if (autoMarkDaily) {
    try {
      await markDailyAttendance({
        internId,
        sessionId: sessionId || meetingSessionId,
        method: dailyMethod,
        attendanceDate: attendanceTime,
        syncEndpoint: dailySyncEndpoint,
        allowCheckout: false,
      });
      dailyAttendanceMarked = Boolean(result.dailyAttendanceMarked);
    } catch (error) {
      // Meeting attendance stays successful if daily attendance is already marked.
    }
  }

  return {
    intern,
    meeting: {
      title: normalizedProjectName,
      projectName: normalizedProjectName,
      status: "present",
      time: attendanceTime,
    },
    dailyAttendanceMarked,
    dailyRecord,
  };
};

module.exports = {
  markDailyAttendance,
  markMeetingAttendance,
  reconcileDailyAttendanceDuplicates,
  getDailyAttendanceStatus,
};
