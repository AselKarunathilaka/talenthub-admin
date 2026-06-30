const assert = require("node:assert/strict");
const test = require("node:test");
const {
  addAuditCheckoutTimes,
  buildDailyAttendanceByDate,
  getColomboDateKey,
} = require("../utils/attendanceHistory");

const DAILY_TYPES = new Set(["daily_qr", "face"]);

test("matches stored attendance dates by the Colombo calendar day", () => {
  assert.equal(getColomboDateKey("2026-06-25"), "2026-06-25");
  assert.equal(
    getColomboDateKey("2026-06-24T18:30:00.000Z"),
    "2026-06-25",
  );
});

test("keeps checkout data when the latest same-day entry lacks it", () => {
  const attendance = buildDailyAttendanceByDate(
    [
      {
        date: "2026-06-24T18:30:00.000Z",
        timeMarked: "2026-06-25T01:36:00.000Z",
        checkOutTime: "2026-06-25T11:30:00.000Z",
        type: "daily_qr",
      },
      {
        date: "2026-06-24T18:30:00.000Z",
        timeMarked: "2026-06-25T02:00:00.000Z",
        type: "face",
      },
    ],
    DAILY_TYPES,
  );

  const june25 = attendance.get("2026-06-25");
  assert.equal(june25.entry.type, "face");
  assert.equal(june25.checkOutTime, "2026-06-25T11:30:00.000Z");
});

test("recovers a missing checkout from the latest later audit scan", () => {
  const attendance = buildDailyAttendanceByDate(
    [
      {
        date: "2026-06-24T18:30:00.000Z",
        timeMarked: "2026-06-25T01:36:49.543Z",
        type: "face",
      },
    ],
    DAILY_TYPES,
  );

  addAuditCheckoutTimes(attendance, [
    {
      attendanceDate: "2026-06-25",
      attendanceTime: "2026-06-25T01:36:49.543Z",
    },
    {
      attendanceDate: "2026-06-25",
      attendanceTime: "2026-06-25T01:56:51.230Z",
    },
    {
      attendanceDate: "2026-06-25",
      attendanceTime: "2026-06-25T10:43:11.964Z",
    },
  ]);

  assert.equal(
    attendance.get("2026-06-25").checkOutTime,
    "2026-06-25T10:43:11.964Z",
  );
});

test("does not replace a checkout already stored in attendance", () => {
  const attendance = buildDailyAttendanceByDate(
    [
      {
        date: "2026-06-24T18:30:00.000Z",
        timeMarked: "2026-06-25T01:36:49.543Z",
        checkOutTime: "2026-06-25T09:30:00.000Z",
        type: "face",
      },
    ],
    DAILY_TYPES,
  );

  addAuditCheckoutTimes(attendance, [
    {
      attendanceDate: "2026-06-25",
      attendanceTime: "2026-06-25T10:43:11.964Z",
    },
  ]);

  assert.equal(
    attendance.get("2026-06-25").checkOutTime,
    "2026-06-25T09:30:00.000Z",
  );
});
