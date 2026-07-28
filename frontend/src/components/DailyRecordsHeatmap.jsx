import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, Flame, Loader2 } from "lucide-react";

// ── Config ─────────────────────────────────────────────────────────────────
const FALLBACK_WEEKS = 26; // used only if no training dates are available yet
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""]; // sparse labels like GitHub
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Score a day's submission so richer / longer entries read as "more active"
// than a one-line placeholder — while leave days get their own track entirely.
function scoreEntry(record) {
  if (!record) return 0;
  if (record.status === "leave" || record.status === "study_leave") return -1; // leave marker
  const length =
    (record.task?.length || 0) +
    (record.progress?.length || 0) +
    (record.blockers?.length || 0);
  if (length === 0) return 0;
  if (length < 80) return 1;
  if (length < 200) return 2;
  if (length < 400) return 3;
  return 4;
}

const LEVEL_STYLES = [
  "bg-gray-100 border-gray-200", // 0 — nothing submitted
  "bg-[#c8ecc6] border-[#b3e0b0]", // 1
  "bg-[#8ed489] border-[#7bc976]", // 2
  "bg-[#50b748] border-[#469f3f]", // 3
  "bg-[#2e7d32] border-[#256829]", // 4 — richest entry
];
const LEAVE_STYLE = "bg-[#00b4eb]/70 border-[#0056a2]/40";

function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

// Builds the full grid from `rangeStart` to `rangeEnd` (inclusive), padded
// out to whole weeks (Sun–Sat) so the calendar columns line up cleanly.
function buildGrid(recordsByDate, rangeStart, rangeEnd) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const periodStart = new Date(rangeStart);
  periodStart.setHours(0, 0, 0, 0);

  // Never render future weeks past today, even if Training_EndDate is ahead.
  const periodEnd = new Date(Math.min(rangeEnd.getTime(), today.getTime()));
  periodEnd.setHours(0, 0, 0, 0);

  // Snap start back to the preceding Sunday, end forward to the following Saturday.
  const start = new Date(periodStart);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(periodEnd);
  end.setDate(end.getDate() + (6 - end.getDay()));

  const weeks = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const key = toDateKey(cursor);
      const isFuture = cursor > today;
      const isOutOfRange = cursor < periodStart || cursor > periodEnd;
      week.push({
        date: new Date(cursor),
        key,
        isFuture,
        isOutOfRange,
        record: recordsByDate.get(key) || null,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

const DailyRecordsHeatmap = ({ startDate, endDate }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hovered, setHovered] = useState(null);

  // Resolve the range to render: the intern's actual training period when
  // it's available, otherwise fall back to a trailing window so the widget
  // still renders something useful before Training_StartDate has loaded.
  const { rangeStart, rangeEnd, usingFallback } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parsedStart = startDate ? new Date(startDate) : null;
    if (parsedStart && !Number.isNaN(parsedStart.getTime())) {
      const parsedEnd =
        endDate && !Number.isNaN(new Date(endDate).getTime())
          ? new Date(endDate)
          : today;
      return {
        rangeStart: parsedStart,
        rangeEnd: parsedEnd,
        usingFallback: false,
      };
    }

    const fallbackStart = new Date(today);
    fallbackStart.setDate(fallbackStart.getDate() - (FALLBACK_WEEKS * 7 - 1));
    return { rangeStart: fallbackStart, rangeEnd: today, usingFallback: true };
  }, [startDate, endDate]);

  useEffect(() => {
    let cancelled = false;

    const fetchRecords = async () => {
      try {
        setLoading(true);
        const authToken =
          localStorage.getItem("authToken") ||
          JSON.parse(localStorage.getItem("studentInfo") || "{}").token;

        if (!authToken) {
          if (!cancelled) {
            setError("Authentication required.");
            setLoading(false);
          }
          return;
        }

        const { API_BASE_URL, API_ENDPOINTS } =
          await import("../api/apiConfig");
        const response = await fetch(
          `${API_BASE_URL}${API_ENDPOINTS.RECORDS.LIST}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
          },
        );

        const data = await response.json();
        if (!cancelled) {
          if (response.ok) {
            setRecords(Array.isArray(data) ? data : []);
            setError(null);
          } else {
            setError(data.error || "Failed to fetch daily records");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError("Failed to fetch daily records.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRecords();
    return () => {
      cancelled = true;
    };
  }, []);

  const recordsByDate = useMemo(() => {
    const map = new Map();
    records.forEach((record) => {
      const raw = record.date || record.createdAt;
      if (!raw) return;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return;
      map.set(toDateKey(d), record);
    });
    return map;
  }, [records]);

  const weeks = useMemo(
    () => buildGrid(recordsByDate, rangeStart, rangeEnd),
    [recordsByDate, rangeStart, rangeEnd],
  );

  // Spans a year boundary (common for internships running Dec–Jun etc.) →
  // disambiguate month labels with a trailing year, e.g. "Jan '27".
  const spansMultipleYears =
    rangeStart.getFullYear() !== rangeEnd.getFullYear();

  const monthMarkers = useMemo(() => {
    const markers = [];
    let lastMonth = null;
    let lastYear = null;
    weeks.forEach((week, wi) => {
      const firstRealDay = week.find((d) => d) || week[0];
      const month = firstRealDay.date.getMonth();
      const year = firstRealDay.date.getFullYear();
      if (month !== lastMonth || year !== lastYear) {
        const label = spansMultipleYears
          ? `${MONTH_LABELS[month]} '${String(year).slice(-2)}`
          : MONTH_LABELS[month];
        markers.push({ index: wi, label });
        lastMonth = month;
        lastYear = year;
      }
    });
    return markers;
  }, [weeks, spansMultipleYears]);

  const stats = useMemo(() => {
    let submitted = 0;
    let leaveDays = 0;
    let currentStreak = 0;
    let longestStreak = 0;
    let running = 0;

    const sortedKeys = weeks
      .flat()
      .filter((d) => !d.isFuture && !d.isOutOfRange);
    sortedKeys.forEach((day) => {
      const score = scoreEntry(day.record);
      if (score === -1) {
        leaveDays += 1;
        running = 0; // leave breaks an activity streak
      } else if (score > 0) {
        submitted += 1;
        running += 1;
        longestStreak = Math.max(longestStreak, running);
      } else {
        running = 0;
      }
    });

    // current streak = consecutive submitted days counting back from today
    for (let i = sortedKeys.length - 1; i >= 0; i--) {
      const score = scoreEntry(sortedKeys[i].record);
      if (score > 0) currentStreak += 1;
      else break;
    }

    return { submitted, leaveDays, currentStreak, longestStreak };
  }, [weeks]);

  const formatTooltipDate = (date) =>
    date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="mb-8 bg-white rounded-3xl overflow-hidden shadow-[0_0_15px_rgba(80,183,72,0.12)] border border-[#50b748]/20 hover:shadow-[0_0_25px_rgba(80,183,72,0.25)] transition-all duration-500">
      <div className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-inner"
              style={{
                background: "linear-gradient(135deg, #50b748 0%, #2e7d32 100%)",
              }}
            >
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Logbook Activity
              </h3>
              <p className="text-xs font-medium text-gray-500">
                {usingFallback
                  ? `Daily record submissions, last ${FALLBACK_WEEKS} weeks`
                  : `Daily record submissions — ${rangeStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} to ${rangeEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
              </p>
            </div>
          </div>

          {!loading && !error && (
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#50b748]/10 text-[#2e7d32]">
                {stats.submitted} submitted
              </span>
              {stats.currentStreak > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 text-orange-600">
                  <Flame className="w-3.5 h-3.5" />
                  {stats.currentStreak}-day streak
                </span>
              )}
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#50b748]" />
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-8">
            <p className="text-sm font-medium text-gray-500">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full">
              <div className="inline-flex flex-col gap-1 min-w-full">
                {/* Month labels */}
                <div className="flex pl-8 gap-[3px]">
                  {weeks.map((_, wi) => {
                    const marker = monthMarkers.find((m) => m.index === wi);
                    return (
                      <div
                        key={wi}
                        className="w-[13px] text-[10px] font-semibold text-gray-400 shrink-0"
                      >
                        {marker ? marker.label : ""}
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-[3px]">
                  {/* Day-of-week labels */}
                  <div className="flex flex-col gap-[3px] pr-1 shrink-0">
                    {DAY_LABELS.map((label, i) => (
                      <div
                        key={i}
                        className="h-[13px] w-7 text-[9px] font-semibold text-gray-400 flex items-center"
                      >
                        {label}
                      </div>
                    ))}
                  </div>

                  {/* Grid */}
                  {weeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-[3px] shrink-0">
                      {week.map((day) => {
                        if (day.isFuture || day.isOutOfRange) {
                          return (
                            <div
                              key={day.key}
                              className="w-[13px] h-[13px] rounded-[3px] bg-transparent"
                            />
                          );
                        }
                        const score = scoreEntry(day.record);
                        const style =
                          score === -1
                            ? LEAVE_STYLE
                            : LEVEL_STYLES[score] || LEVEL_STYLES[0];
                        return (
                          <div
                            key={day.key}
                            onMouseEnter={() => setHovered(day)}
                            onMouseLeave={() =>
                              setHovered((cur) =>
                                cur?.key === day.key ? null : cur,
                              )
                            }
                            title={
                              score === -1
                                ? `${formatTooltipDate(day.date)} — On leave`
                                : score > 0
                                  ? `${formatTooltipDate(day.date)} — Logbook submitted`
                                  : `${formatTooltipDate(day.date)} — No submission`
                            }
                            className={`w-[13px] h-[13px] rounded-[3px] border cursor-pointer transition-transform duration-150 hover:scale-125 hover:ring-2 hover:ring-[#50b748]/40 ${style}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Legend + hovered day detail */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-5 pt-4 border-t border-gray-50">
              <div className="min-h-[18px] text-xs font-medium text-gray-500">
                {hovered ? (
                  <span>
                    <span className="font-bold text-gray-800">
                      {formatTooltipDate(hovered.date)}:
                    </span>{" "}
                    {scoreEntry(hovered.record) === -1
                      ? "On leave"
                      : scoreEntry(hovered.record) > 0
                        ? (hovered.record.task || "Logbook submitted").slice(
                            0,
                            80,
                          ) + (hovered.record.task?.length > 80 ? "…" : "")
                        : "No logbook entry"}
                  </span>
                ) : (
                  <span className="text-gray-400">
                    Hover a square to see that day's entry
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 shrink-0">
                <span>Less</span>
                {LEVEL_STYLES.map((style, i) => (
                  <div
                    key={i}
                    className={`w-[11px] h-[11px] rounded-[3px] border ${style}`}
                  />
                ))}
                <span>More</span>
                <span
                  className={`ml-2 w-[11px] h-[11px] rounded-[3px] border ${LEAVE_STYLE}`}
                />
                <span>Leave</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DailyRecordsHeatmap;
