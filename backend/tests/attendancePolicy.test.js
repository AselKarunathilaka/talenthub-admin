const assert = require("node:assert/strict");
const test = require("node:test");
const {
  evaluateDailyAttendanceAction,
  findExplicitAuditCheckout,
} = require("../utils/attendancePolicy");

const checkInTime = "2026-07-01T03:14:00.000Z";

test("allows morning and afternoon check-ins when no session exists", () => {
  assert.equal(
    evaluateDailyAttendanceAction({
      action: "check_in",
      currentEntry: null,
      attendanceTime: "2026-07-01T03:00:00.000Z",
    }).operation,
    "check_in",
  );
  assert.equal(
    evaluateDailyAttendanceAction({
      action: "check_in",
      currentEntry: null,
      attendanceTime: "2026-07-01T07:00:00.000Z",
    }).operation,
    "check_in",
  );
});

test("rejects checkout when the intern has not checked in", () => {
  const result = evaluateDailyAttendanceAction({
    action: "check_out",
    currentEntry: null,
    attendanceTime: "2026-07-01T07:00:00.000Z",
  });
  assert.equal(result.operation, "reject");
  assert.equal(result.code, "NOT_CHECKED_IN");
});

test("rejects a repeated check-in instead of treating it as checkout", () => {
  const result = evaluateDailyAttendanceAction({
    action: "check_in",
    currentEntry: { timeMarked: checkInTime },
    attendanceTime: "2026-07-01T03:17:00.000Z",
  });
  assert.equal(result.operation, "reject");
  assert.equal(result.code, "ALREADY_CHECKED_IN");
});

test("blocks accidental checkout during the minimum interval", () => {
  const result = evaluateDailyAttendanceAction({
    action: "check_out",
    currentEntry: { timeMarked: checkInTime },
    attendanceTime: "2026-07-01T03:17:00.000Z",
    minimumCheckoutMinutes: 15,
  });
  assert.equal(result.operation, "reject");
  assert.equal(result.code, "CHECKOUT_TOO_SOON");
  assert.equal(result.retryAfterMinutes, 12);
});

test("allows checkout after the guard interval regardless of arrival time", () => {
  const result = evaluateDailyAttendanceAction({
    action: "check_out",
    currentEntry: { timeMarked: checkInTime },
    attendanceTime: "2026-07-01T03:30:00.000Z",
    minimumCheckoutMinutes: 15,
  });
  assert.equal(result.operation, "check_out");
});

test("recovers the first explicit checkout and ignores later scans", () => {
  const checkout = findExplicitAuditCheckout(
    [
      {
        attendanceTime: "2026-07-01T04:00:00.000Z",
        metadata: { attendanceAction: "check_out" },
      },
      {
        attendanceTime: "2026-07-01T05:00:00.000Z",
        metadata: { attendanceAction: "check_out" },
      },
    ],
    checkInTime,
    15,
  );
  assert.equal(checkout, "2026-07-01T04:00:00.000Z");
});
