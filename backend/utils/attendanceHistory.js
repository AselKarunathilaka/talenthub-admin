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

const DAILY_TYPE_PRIORITY = {
  face: 4,
  daily_qr: 3,
  manual_daily: 2,
  daily: 1,
};

const getDailyTypePriority = (type) =>
  DAILY_TYPE_PRIORITY[String(type || "").toLowerCase()] || 0;

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

    const currentPriority = getDailyTypePriority(current.entry.type);
    const entryPriority = getDailyTypePriority(type);

    let chosen = current;
    if (entryPriority > currentPriority) {
      chosen = {
        entry,
        markedAt,
        markedAtMs,
        checkOutTime: entry.checkOutTime || current.checkOutTime || null,
      };
    } else if (entryPriority === currentPriority) {
      // For same priority, keep the earlier check-in time unless current was missing markedAt
      if (markedAtMs < current.markedAtMs) {
        chosen = {
          entry,
          markedAt,
          markedAtMs,
          checkOutTime: entry.checkOutTime || current.checkOutTime || null,
        };
      }
    }

    const latestCheckout = [current.checkOutTime, entry.checkOutTime]
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

    entriesByDate.set(dateKey, {
      ...chosen,
      checkOutTime: latestCheckout || chosen.checkOutTime || null,
    });
  });

  return entriesByDate;
};

const addAuditCheckoutTimes = (
  entriesByDate,
  auditLogs,
  minimumCheckoutMinutes = 15,
  legacyMinimumCheckoutMinutes = 60,
) => {
  (auditLogs || []).forEach((log) => {
    const dateKey = getColomboDateKey(log.attendanceDate || log.attendanceTime);
    const attendance = entriesByDate.get(dateKey);
    if (!attendance || attendance.checkOutTime) return;

    const checkInMs = new Date(attendance.markedAt).getTime();
    const auditTimeMs = new Date(log.attendanceTime).getTime();
    const isExplicitCheckout =
      log.metadata?.attendanceAction === "check_out";
    const requiredMinutes = isExplicitCheckout
      ? minimumCheckoutMinutes
      : legacyMinimumCheckoutMinutes;
    if (
      Number.isNaN(checkInMs) ||
      Number.isNaN(auditTimeMs) ||
      auditTimeMs < checkInMs + requiredMinutes * 60000
    ) {
      return;
    }

    const candidateField = isExplicitCheckout
      ? "explicitAuditCheckOutTime"
      : "legacyAuditCheckOutTime";
    const currentCheckoutMs = attendance[candidateField]
      ? new Date(attendance[candidateField]).getTime()
      : 0;
    const shouldUseCandidate =
      currentCheckoutMs === 0 || auditTimeMs < currentCheckoutMs;
    if (shouldUseCandidate) {
      attendance[candidateField] = log.attendanceTime;
    }
  });

  entriesByDate.forEach((attendance) => {
    const recoveredCheckout =
      attendance.explicitAuditCheckOutTime ||
      attendance.legacyAuditCheckOutTime;
    if (!attendance.checkOutTime && recoveredCheckout) {
      attendance.checkOutTime = recoveredCheckout;
    }
    delete attendance.explicitAuditCheckOutTime;
    delete attendance.legacyAuditCheckOutTime;
  });

  return entriesByDate;
};

const selectCanonicalDailyEntry = (entries, preferredMethod) => {
  if (!entries?.length) return null;

  const sortedEntries = [...entries].sort((a, b) => {
    const pA = getDailyTypePriority(a.type);
    const pB = getDailyTypePriority(b.type);
    if (pA !== pB) return pB - pA; // Higher priority first
    return (
      new Date(a.timeMarked || a.date).getTime() -
      new Date(b.timeMarked || b.date).getTime()
    );
  });

  const localEntries = sortedEntries.filter(
    (entry) => entry.markedBy !== "external_system",
  );
  const canonical =
    (preferredMethod && localEntries.find((entry) => entry.type === preferredMethod)) ||
    localEntries[0] ||
    sortedEntries[0];
  const checkOutTime = sortedEntries
    .map((entry) => entry.checkOutTime)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  return {
    canonical,
    canonicalType:
      preferredMethod === "face" && canonical.type === "face" ? "face" : canonical.type,
    checkOutTime: checkOutTime || canonical.checkOutTime || null,
    duplicates: sortedEntries.filter(
      (entry) => String(entry._id) !== String(canonical._id),
    ),
  };
};

module.exports = {
  addAuditCheckoutTimes,
  buildDailyAttendanceByDate,
  getColomboDateKey,
  getDailyTypePriority,
  selectCanonicalDailyEntry,
};
