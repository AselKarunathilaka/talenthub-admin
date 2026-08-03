import React, { useEffect, useMemo, useState } from "react";
import { GitBranch, Flame, Loader2 } from "lucide-react";

// ── Config ─────────────────────────────────────────────────────────────────
const FALLBACK_WEEKS = 26;
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Commit count per day → intensity level 0-4
function scoreCommits(count) {
  if (!count || count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
}

const LEVEL_STYLES = [
  "bg-gray-100 border-gray-200",        // 0 — no commits
  "bg-[#c9e8f8] border-[#a8d8f0]",     // 1
  "bg-[#72c4f0] border-[#55b5ea]",     // 2
  "bg-[#00b4eb] border-[#009fd4]",     // 3
  "bg-[#0056a2] border-[#004a8a]",     // 4 — most active
];

function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function buildGrid(commitsByDate, rangeStart, rangeEnd) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const periodStart = new Date(rangeStart);
  periodStart.setHours(0, 0, 0, 0);

  const periodEnd = new Date(Math.min(rangeEnd.getTime(), today.getTime()));
  periodEnd.setHours(0, 0, 0, 0);

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
        count: commitsByDate.get(key) || 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/**
 * Recursively collects ALL commit arrays from the API response.
 *
 * The TalentTrail API can return commits at multiple nesting levels:
 *   • top-level:  data.projectCommits[].commits[]          (project-wise)
 *   • nested:     data.projectCommits[].modules[].commits[] (module-wise)
 *
 * We walk the entire tree so nothing is missed regardless of structure.
 */
function collectAllCommits(data) {
  const all = [];
  if (!data) return all;

  // Handle both { projectCommits: [...] } and flat array responses
  const projects = Array.isArray(data) ? data : (data.projectCommits || []);

  function walk(node) {
    if (!node) return;
    // Direct commits array on this node
    if (Array.isArray(node.commits)) {
      all.push(...node.commits);
    }
    // Module-wise sub-projects
    if (Array.isArray(node.modules)) {
      node.modules.forEach(walk);
    }
    // Some responses nest under 'children' or 'subProjects'
    if (Array.isArray(node.children)) {
      node.children.forEach(walk);
    }
    if (Array.isArray(node.subProjects)) {
      node.subProjects.forEach(walk);
    }
  }

  projects.forEach(walk);
  return all;
}

const CommitHeatmap = ({ startDate, endDate, internId }) => {
  const [commitData, setCommitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hovered, setHovered] = useState(null);

  // ── Resolve date range ────────────────────────────────────────────────────
  const { rangeStart, rangeEnd, usingFallback } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const parsedStart = startDate ? new Date(startDate) : null;
    if (parsedStart && !Number.isNaN(parsedStart.getTime())) {
      const parsedEnd =
        endDate && !Number.isNaN(new Date(endDate).getTime())
          ? new Date(endDate)
          : today;
      return { rangeStart: parsedStart, rangeEnd: parsedEnd, usingFallback: false };
    }
    const fallbackStart = new Date(today);
    fallbackStart.setDate(fallbackStart.getDate() - (FALLBACK_WEEKS * 7 - 1));
    return { rangeStart: fallbackStart, rangeEnd: today, usingFallback: true };
  }, [startDate, endDate]);

  // ── Fetch commits from intern-facing endpoint ─────────────────────────────
  useEffect(() => {
    if (!internId) return;
    let cancelled = false;

    const fetchCommits = async () => {
      try {
        setLoading(true);
        setError(null);

        const authToken = localStorage.getItem("authToken") || (() => {
          try { return JSON.parse(localStorage.getItem("studentInfo") || "{}").token; }
          catch { return null; }
        })();

        if (!authToken) {
          if (!cancelled) { setError("Authentication required."); setLoading(false); }
          return;
        }

        const { API_BASE_URL } = await import("../api/apiConfig");
        // Use the intern-facing endpoint (authenticateUser only, no requireAdmin)
        const response = await fetch(
          `${API_BASE_URL}/interns/${internId}/git-commits`,
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
            setCommitData(data);
            setError(null);
          } else {
            setError(data.error || data.message || "Failed to fetch commits");
          }
        }
      } catch (err) {
        if (!cancelled) setError("Failed to fetch commit data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCommits();
    return () => { cancelled = true; };
  }, [internId]);

  // ── Build date → count map from ALL commits (project + module wise) ───────
  const commitsByDate = useMemo(() => {
    const map = new Map();
    const allCommits = collectAllCommits(commitData);
    allCommits.forEach((commit) => {
      const raw = commit.date || commit.committedAt || commit.createdAt;
      if (!raw) return;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return;
      const key = toDateKey(d);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [commitData]);

  const weeks = useMemo(
    () => buildGrid(commitsByDate, rangeStart, rangeEnd),
    [commitsByDate, rangeStart, rangeEnd],
  );

  const spansMultipleYears = rangeStart.getFullYear() !== rangeEnd.getFullYear();

  const monthMarkers = useMemo(() => {
    const markers = [];
    let lastMonth = null;
    let lastYear = null;
    weeks.forEach((week, wi) => {
      const firstRealDay = week[0];
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
    const totalCommits = commitData?.totalCommits ??
      collectAllCommits(commitData).length;

    const projects = Array.isArray(commitData)
      ? commitData
      : (commitData?.projectCommits || []);
    const projectCount = projects.length;

    let currentStreak = 0;
    let longestStreak = 0;
    let running = 0;

    const sortedDays = weeks.flat().filter((d) => !d.isFuture && !d.isOutOfRange);
    sortedDays.forEach((day) => {
      if (day.count > 0) { running += 1; longestStreak = Math.max(longestStreak, running); }
      else running = 0;
    });
    for (let i = sortedDays.length - 1; i >= 0; i--) {
      if (sortedDays[i].count > 0) currentStreak += 1;
      else break;
    }

    return { totalCommits, projectCount, currentStreak, longestStreak };
  }, [weeks, commitData]);

  const formatTooltipDate = (date) =>
    date.toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
    });

  const hasNoProjects =
    !loading && !error && commitData &&
    (!commitData.projectCommits || commitData.projectCommits.length === 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mb-8 bg-white rounded-3xl overflow-hidden shadow-[0_0_15px_rgba(0,180,235,0.12)] border border-[#00b4eb]/20 hover:shadow-[0_0_25px_rgba(0,180,235,0.25)] transition-all duration-500">
      <div className="p-6 sm:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-inner"
              style={{ background: "linear-gradient(135deg, #00b4eb 0%, #0056a2 100%)" }}
            >
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Commit Activity</h3>
              <p className="text-xs font-medium text-gray-500">
                {usingFallback
                  ? `GitHub commits, last ${FALLBACK_WEEKS} weeks`
                  : `GitHub commits — ${rangeStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} to ${rangeEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
              </p>
            </div>
          </div>

          {!loading && !error && !hasNoProjects && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00b4eb]/10 text-[#0056a2] text-xs font-semibold">
                {stats.totalCommits} commit{stats.totalCommits !== 1 ? "s" : ""}
              </span>
              {stats.projectCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                  {stats.projectCount} project{stats.projectCount !== 1 ? "s" : ""}
                </span>
              )}
              {stats.currentStreak > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 text-orange-600 text-xs font-semibold">
                  <Flame className="w-3.5 h-3.5" />
                  {stats.currentStreak}-day streak
                </span>
              )}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#00b4eb]" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-8">
            <p className="text-sm font-medium text-gray-500">{error}</p>
          </div>
        )}

        {/* No projects */}
        {hasNoProjects && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <GitBranch className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-gray-600 mb-1">No GitHub projects linked</p>
            <p className="text-xs text-gray-400 max-w-xs">
              Your commits will appear here once a project with a GitHub repository is assigned.
            </p>
          </div>
        )}

        {/* Heatmap grid */}
        {!loading && !error && !hasNoProjects && (
          <>
            <div className="overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full">
              <div className="inline-flex flex-col gap-1 min-w-full">
                {/* Month labels */}
                <div className="flex pl-8 gap-[3px]">
                  {weeks.map((_, wi) => {
                    const marker = monthMarkers.find((m) => m.index === wi);
                    return (
                      <div key={wi} className="w-[13px] text-[10px] font-semibold text-gray-400 shrink-0">
                        {marker ? marker.label : ""}
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-[3px]">
                  {/* Day-of-week labels */}
                  <div className="flex flex-col gap-[3px] pr-1 shrink-0">
                    {DAY_LABELS.map((label, i) => (
                      <div key={i} className="h-[13px] w-7 text-[9px] font-semibold text-gray-400 flex items-center">
                        {label}
                      </div>
                    ))}
                  </div>

                  {/* Grid squares */}
                  {weeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-[3px] shrink-0">
                      {week.map((day) => {
                        if (day.isFuture || day.isOutOfRange) {
                          return <div key={day.key} className="w-[13px] h-[13px] rounded-[3px] bg-transparent" />;
                        }
                        const level = scoreCommits(day.count);
                        return (
                          <div
                            key={day.key}
                            onMouseEnter={() => setHovered(day)}
                            onMouseLeave={() =>
                              setHovered((cur) => cur?.key === day.key ? null : cur)
                            }
                            title={
                              day.count > 0
                                ? `${formatTooltipDate(day.date)} — ${day.count} commit${day.count !== 1 ? "s" : ""}`
                                : `${formatTooltipDate(day.date)} — No commits`
                            }
                            className={`w-[13px] h-[13px] rounded-[3px] border cursor-pointer transition-transform duration-150 hover:scale-125 hover:ring-2 hover:ring-[#00b4eb]/40 ${LEVEL_STYLES[level]}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Legend + hover detail */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-5 pt-4 border-t border-gray-50">
              <div className="min-h-[18px] text-xs font-medium text-gray-500">
                {hovered ? (
                  <span>
                    <span className="font-bold text-gray-800">{formatTooltipDate(hovered.date)}:</span>{" "}
                    {hovered.count > 0
                      ? `${hovered.count} commit${hovered.count !== 1 ? "s" : ""}`
                      : "No commits"}
                  </span>
                ) : (
                  <span className="text-gray-400">Hover a square to see that day's commits</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 shrink-0">
                <span>Less</span>
                {LEVEL_STYLES.map((style, i) => (
                  <div key={i} className={`w-[11px] h-[11px] rounded-[3px] border ${style}`} />
                ))}
                <span>More</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CommitHeatmap;
