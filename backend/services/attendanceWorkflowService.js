const axios = require("axios");
const moment = require("moment-timezone");
const mongoose = require("mongoose");
const DailyRecord = require("../models/DailyRecord");
const Intern = require("../models/Intern");
const externalConfig = require("../config/externalSystems");

const DAILY_ATTENDANCE_TYPES = ["daily_qr", "face"];
const MEETING_ATTENDANCE_TYPES = ["qr", "face_meeting", "meeting"];

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

  if (existingDailyRecord?.attendance === "present") {
    throwDailyAlreadyMarked();
  }

  const session = await mongoose.startSession();
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

      const duplicateCheck = await Intern.findOne({
        _id: internId,
        attendance: {
          $elemMatch: {
            type: { $in: DAILY_ATTENDANCE_TYPES },
            status: "Present",
            date: { $gte: todayStart.toDate(), $lte: todayEnd.toDate() },
          },
        },
      }).session(session);

      if (duplicateCheck) {
        throwDailyAlreadyMarked();
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
  };
};

const markMeetingAttendance = async ({
  internId,
  meetingTitle,
  sessionId = null,
  method = "qr",
  meetingSessionId = null,
  attendanceDate = null,
  duplicateMessage = "Duplicate meeting attendance detected. Please wait before scanning again.",
  syncEndpoint = null,
  dailySyncEndpoint = null,
  autoMarkDaily = true,
  dailyMethod = "daily_qr",
}) => {
  const intern = await Intern.findById(internId);
  if (!intern) throw new Error("Intern not found");

  const normalizedMeetingTitle = String(meetingTitle || "").trim();
  if (!normalizedMeetingTitle) {
    throw new Error("Meeting title is required.");
  }

  const now = getAttendanceMoment(attendanceDate);
  const attendanceTime = now.toDate();
  const todayStart = now.clone().startOf("day");
  const todayEnd = now.clone().endOf("day");
  const today = todayStart.format("YYYY-MM-DD");
  const oneMinuteAgo = now.clone().subtract(60, "seconds").toDate();
  let dailyRecord = await DailyRecord.findOne({ internId, date: today });

  if (dailyRecord) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const hasDuplicate = await DailyRecord.findOne({
          _id: dailyRecord._id,
          meetingAttendance: {
            $elemMatch: {
              meetingTitle: normalizedMeetingTitle,
              attendanceStatus: "present",
              attendanceTime: { $gte: oneMinuteAgo },
            },
          },
        }).session(session);

        if (hasDuplicate) {
          throw new Error(duplicateMessage);
        }

        await DailyRecord.updateOne(
          { _id: dailyRecord._id },
          {
            $set: {
              attendance: "present",
              attendanceTime,
            },
            $pull: { meetingAttendance: { meetingTitle: normalizedMeetingTitle } },
          },
          { session },
        );

        await DailyRecord.updateOne(
          { _id: dailyRecord._id },
          {
            $push: {
              meetingAttendance: {
                meetingTitle: normalizedMeetingTitle,
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
                meetingName: normalizedMeetingTitle,
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
                meetingName: normalizedMeetingTitle,
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
                meetingName: normalizedMeetingTitle,
                date: { $gte: todayStart.toDate(), $lte: todayEnd.toDate() },
                timeMarked: { $gte: oneMinuteAgo },
              },
            },
          },
        ],
      },
      {
        $pull: {
          attendance: {
            type: { $in: MEETING_ATTENDANCE_TYPES },
            meetingName: normalizedMeetingTitle,
            date: { $gte: todayStart.toDate(), $lte: todayEnd.toDate() },
          },
        },
      },
      { new: true },
    );

    if (!updatedIntern) {
      throw new Error(duplicateMessage);
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
            meetingName: normalizedMeetingTitle,
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
      title: normalizedMeetingTitle,
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
