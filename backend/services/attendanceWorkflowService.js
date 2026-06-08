const axios = require("axios");
const moment = require("moment-timezone");
const mongoose = require("mongoose");
const DailyRecord = require("../models/DailyRecord");
const Intern = require("../models/Intern");
const externalConfig = require("../config/externalSystems");

const DAILY_ATTENDANCE_TYPES = ["daily_qr", "face"];
const MEETING_ATTENDANCE_TYPES = ["qr", "face_meeting", "meeting"];

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

const markDailyAttendance = async ({
  internId,
  sessionId = null,
  method = "daily_qr",
  attendanceDate = null,
  duplicateMessage = "Duplicate daily attendance detected. Please wait before scanning again.",
  syncEndpoint = null,
}) => {
  const intern = await Intern.findById(internId);
  if (!intern) throw new Error("Intern not found");

  const now = getAttendanceMoment(attendanceDate);
  const attendanceTime = now.toDate();
  const todayStart = now.clone().startOf("day");
  const todayEnd = now.clone().endOf("day");
  const today = todayStart.format("YYYY-MM-DD");
  const existingDailyRecord = await DailyRecord.findOne({ internId, date: today });

  const session = await mongoose.startSession();
  let checkedOut = false;
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

        if (method === "face" && currentType === "daily_qr") {
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

          return;
        }

        if (currentDailyEntry.checkOutTime) {
          const err = new Error("You are already out of office, please come tomorrow. Thank you!");
          err.statusCode = 400;
          err.alreadyMarked = true;
          throw err;
        }

        // Treat subsequent scans as check-out
        await DailyRecord.updateOne(
          { internId, date: today },
          { $set: { checkOutTime: attendanceTime } },
          { session }
        );

        await Intern.updateOne(
          { _id: internId },
          { $set: { "attendance.$[record].checkOutTime": attendanceTime } },
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
        return;
      }

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
    });
  } finally {
    await session.endSession();
  }

  await syncExternalAttendance({
    endpoint: syncEndpoint,
    sessionId,
    traineeId: intern.Trainee_ID,
  });

  return {
    success: true,
    intern,
    timeMarked: attendanceTime,
    type: method,
    checkedOut,
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
      });
      dailyAttendanceMarked = true;
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
};
