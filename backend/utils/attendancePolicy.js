const VALID_ATTENDANCE_ACTIONS = new Set(["auto", "check_in", "check_out"]);

const normalizeAttendanceAction = (value) => {
  const action = String(value || "auto").toLowerCase();
  return VALID_ATTENDANCE_ACTIONS.has(action) ? action : "auto";
};

const evaluateDailyAttendanceAction = ({
  action,
  currentEntry,
  attendanceTime,
  allowCheckout = true,
  minimumCheckoutMinutes = 15,
}) => {
  const normalizedAction = normalizeAttendanceAction(action);

  if (!currentEntry) {
    if (normalizedAction === "check_out") {
      return {
        operation: "reject",
        code: "NOT_CHECKED_IN",
        message: "Please check in before checking out.",
      };
    }
    return { operation: "check_in" };
  }

  if (currentEntry.checkOutTime) {
    return {
      operation: "reject",
      code: "ALREADY_CHECKED_OUT",
      message: "You have already checked out today.",
      alreadyMarked: true,
    };
  }

  if (!allowCheckout) return { operation: "noop" };

  if (normalizedAction === "check_in") {
    return {
      operation: "reject",
      code: "ALREADY_CHECKED_IN",
      message: "You are already checked in. Select Check Out when leaving.",
      alreadyMarked: true,
    };
  }

  const checkInTime = new Date(currentEntry.timeMarked || currentEntry.date);
  const checkoutTime = new Date(attendanceTime);
  const elapsedMinutes = (checkoutTime - checkInTime) / 60000;
  if (elapsedMinutes < minimumCheckoutMinutes) {
    const retryAfterMinutes = Math.max(
      1,
      Math.ceil(minimumCheckoutMinutes - elapsedMinutes),
    );
    return {
      operation: "reject",
      code: "CHECKOUT_TOO_SOON",
      message: `Checkout is available in ${retryAfterMinutes} minute${retryAfterMinutes === 1 ? "" : "s"}.`,
      retryAfterMinutes,
    };
  }

  return { operation: "check_out" };
};

const findExplicitAuditCheckout = (
  auditLogs,
  checkInTime,
  minimumCheckoutMinutes = 15,
) => {
  const earliestCheckoutMs =
    new Date(checkInTime).getTime() + minimumCheckoutMinutes * 60000;

  return (auditLogs || [])
    .filter(
      (log) =>
        log.metadata?.attendanceAction === "check_out" &&
        new Date(log.attendanceTime).getTime() >= earliestCheckoutMs,
    )
    .sort(
      (a, b) =>
        new Date(a.attendanceTime).getTime() -
        new Date(b.attendanceTime).getTime(),
    )[0]?.attendanceTime || null;
};

module.exports = {
  evaluateDailyAttendanceAction,
  findExplicitAuditCheckout,
  normalizeAttendanceAction,
};
