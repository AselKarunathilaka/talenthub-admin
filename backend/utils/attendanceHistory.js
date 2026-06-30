const COLOMBO_TIME_ZONE = "Asia/Colombo";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const colomboDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: COLOMBO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const getColomboDateKey = (value) => {
  if (typeof value === "string" && DATE_ONLY_PATTERN.test(value)) {
    return value;
  }

  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return String(value || "");

  const parts = Object.fromEntries(
    colomboDateFormatter
      .formatToParts(date)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value: partValue }) => [type, partValue]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
};

const buildDailyAttendanceByDate = (attendance, dailyTypes) => {
  const entriesByDate = new Map();

  (attendance || []).forEach((entry) => {
    const type = String(entry.type || "").toLowerCase();
    if (!dailyTypes.has(type)) return;

    const dateKey = getColomboDateKey(entry.date);
    if (!dateKey) return;

    const markedAt = entry.timeMarked || entry.date;
    const markedAtMs = new Date(markedAt).getTime();
    const current = entriesByDate.get(dateKey);

    if (!current) {
      entriesByDate.set(dateKey, {
        entry,
        markedAt,
        markedAtMs,
        checkOutTime: entry.checkOutTime || null,
      });
      return;
    }

    const latest = markedAtMs > current.markedAtMs
      ? {
          entry,
          markedAt,
          markedAtMs,
          checkOutTime: entry.checkOutTime || null,
        }
      : current;
    const latestCheckout = [current.checkOutTime, entry.checkOutTime]
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

    entriesByDate.set(dateKey, {
      ...latest,
      checkOutTime: latestCheckout || latest.checkOutTime,
    });
  });

  return entriesByDate;
};

const addAuditCheckoutTimes = (entriesByDate, auditLogs) => {
  (auditLogs || []).forEach((log) => {
    const dateKey = getColomboDateKey(log.attendanceDate || log.attendanceTime);
    const attendance = entriesByDate.get(dateKey);
    if (!attendance || attendance.checkOutTime) return;

    const checkInMs = new Date(attendance.markedAt).getTime();
    const auditTimeMs = new Date(log.attendanceTime).getTime();
    if (
      Number.isNaN(checkInMs) ||
      Number.isNaN(auditTimeMs) ||
      auditTimeMs <= checkInMs
    ) {
      return;
    }

    const currentCheckoutMs = attendance.auditCheckOutTime
      ? new Date(attendance.auditCheckOutTime).getTime()
      : 0;
    if (auditTimeMs > currentCheckoutMs) {
      attendance.auditCheckOutTime = log.attendanceTime;
    }
  });

  entriesByDate.forEach((attendance) => {
    if (!attendance.checkOutTime && attendance.auditCheckOutTime) {
      attendance.checkOutTime = attendance.auditCheckOutTime;
    }
    delete attendance.auditCheckOutTime;
  });

  return entriesByDate;
};

module.exports = {
  addAuditCheckoutTimes,
  buildDailyAttendanceByDate,
  getColomboDateKey,
};
