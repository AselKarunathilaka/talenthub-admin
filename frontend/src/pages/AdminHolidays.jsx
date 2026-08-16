/**
 * AdminHolidays.jsx
 *
 * Admin page – the source of truth for Sri Lankan public holidays.
 *
 * Holidays decide working days, working days decide the 5-day logbook window,
 * and that window decides who gets restricted on Sunday. So this page is not
 * cosmetic: until a year is Verified (or corroborated by two providers), the
 * restriction cron refuses to restrict anyone and holds them for review here.
 *
 * Route: /admin/holidays
 */

import React, { useState, useEffect, useCallback } from "react";
import AdminNavigation from "../components/AdminNavigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Pencil,
  X,
  ShieldCheck,
  ShieldAlert,
  Info,
  Loader2,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import holidayApi from "../api/holidayApi";

// ── Data-quality presentation ────────────────────────────────────────────────
const QUALITY = {
  verified: {
    label: "Verified",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    blurb: "Checked against the gazette by an admin. Restrictions run normally.",
    safe: true,
  },
  corroborated: {
    label: "Corroborated",
    chip: "bg-sky-50 text-sky-700 border-sky-200",
    dot: "bg-sky-500",
    blurb:
      "Two independent providers reported the same dates. Restrictions run normally.",
    safe: true,
  },
  "single-source": {
    label: "Single source",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    blurb:
      "Only one provider answered. Auto-restriction is paused until an admin verifies this year.",
    safe: false,
  },
  bundled: {
    label: "Offline seed data",
    chip: "bg-orange-50 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
    blurb:
      "Every provider was unreachable, so bundled data is in use. Auto-restriction is paused.",
    safe: false,
  },
  missing: {
    label: "No data",
    chip: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
    blurb:
      "No holidays stored for this year. Auto-restriction is paused — add them or run a sync.",
    safe: false,
  },
};

const qualityOf = (key) => QUALITY[key] || QUALITY.missing;

const formatWhen = (value) =>
  value ? new Date(value).toLocaleString() : "never";

const getDateParts = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return {
    day: d.getDate(),
    month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
  };
};

const AdminHolidays = () => {
  const thisYear = new Date().getFullYear();

  const [year, setYear] = useState(thisYear);
  const [overview, setOverview] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // "sync" | "verify" | "save"
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const [editing, setEditing] = useState(null); // holiday being edited
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ date: "", name: "" });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showConflicts, setShowConflicts] = useState(false);

  const notify = (message, kind = "success") => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 4000);
  };

  const loadYear = useCallback(async (targetYear) => {
    setLoading(true);
    setError(null);
    try {
      const [yearData, overviewData] = await Promise.all([
        holidayApi.getYear(targetYear),
        holidayApi.getOverview(),
      ]);
      setHolidays(yearData.holidays || []);
      setMeta(yearData.meta || null);
      setOverview(overviewData.years || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadYear(year);
  }, [year, loadYear]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const runSync = async () => {
    setBusy("sync");
    try {
      const result = await holidayApi.sync(year);
      notify(
        `Synced ${year}: ${result.holidayCount} holidays (${qualityOf(result.dataQuality).label})`,
      );
      await loadYear(year);
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(null);
    }
  };

  const toggleVerify = async () => {
    setBusy("verify");
    try {
      if (meta?.dataQuality === "verified") {
        await holidayApi.unverify(year);
        notify(`${year} is no longer marked verified`);
      } else {
        await holidayApi.verify(year);
        notify(`${year} verified — restrictions will run normally`);
      }
      await loadYear(year);
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(null);
    }
  };

  const saveHoliday = async (event) => {
    event.preventDefault();
    setBusy("save");
    try {
      if (editing) {
        await holidayApi.update(editing._id, { name: form.name });
        notify(`Updated ${editing.date}`);
      } else {
        await holidayApi.create({ date: form.date, name: form.name });
        notify(`Added ${form.date}`);
      }
      setEditing(null);
      setShowAdd(false);
      setForm({ date: "", name: "" });
      await loadYear(year);
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(null);
    }
  };

  const deleteHoliday = async () => {
    const target = confirmDelete;
    setConfirmDelete(null);
    try {
      await holidayApi.remove(target._id);
      notify(`Removed ${target.date} (${target.name})`);
      await loadYear(year);
    } catch (err) {
      notify(err.message, "error");
    }
  };

  const quality = qualityOf(meta?.dataQuality);
  const conflicts = meta?.conflicts || [];

  return (
    <AdminNavigation>
      <div className="min-h-[calc(100dvh-4rem)] lg:min-h-[100dvh] bg-slate-50 pb-10">
        <div className="flex-1 w-full lg:px-6 xl:px-10">
          <main className="flex-1 p-4 sm:p-6 mx-auto max-w-[1400px] w-full">

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 pt-2">
              {/* Left: Title & Subtitle */}
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-3xl sm:text-4xl font-extrabold text-gray-900 flex items-center gap-3 tracking-tight"
                >
                  <div className="p-2.5 bg-[#00b4eb]/10 rounded-2xl">
                    <CalendarDays className="text-[#0056a2] h-7 w-7 sm:h-8 sm:w-8" />
                  </div>
                  Public Holidays
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05, duration: 0.2 }}
                  className="text-gray-500 mt-2 text-sm sm:text-base font-medium max-w-xl"
                >
                  Working days, logbook windows and Sunday restrictions all read from this list.
                </motion.p>
              </div>

              {/* Right: Controls Pill */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.2 }}
                className="bg-white rounded-3xl shadow-sm border border-gray-100 p-2 sm:p-3 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3"
              >
                {/* Year selector */}
                <div className="relative">
                  <select
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="appearance-none pl-3 pr-8 py-2.5 text-sm font-bold bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 cursor-pointer hover:border-slate-300 transition-colors focus:ring-2 focus:ring-[#00b4eb]/30 focus:outline-none"
                  >
                    {[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                </div>

                {/* Sync button */}
                <button
                  onClick={runSync}
                  disabled={busy === "sync"}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white transition-all bg-[#0056a2] rounded-2xl hover:bg-[#00488a] disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shadow-blue-500/20"
                >
                  {busy === "sync" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Sync providers</span>
                  <span className="sm:hidden">Sync</span>
                </button>

                {/* Add button */}
                <button
                  onClick={() => {
                    setForm({ date: `${year}-01-01`, name: "" });
                    setShowAdd(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-[#0056a2] transition-all bg-[#00b4eb]/10 rounded-2xl hover:bg-[#00b4eb]/20 shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add holiday</span>
                  <span className="sm:hidden">Add</span>
                </button>
              </motion.div>
            </div>

            {/* ── Year overview — compact pill tabs ───────────────────────── */}
            {overview.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.25 }}
                className="flex flex-wrap gap-2 sm:gap-3 mb-8"
              >
                {overview.map((y) => {
                  const q = qualityOf(y.dataQuality);
                  const active = y.year === year;
                  return (
                    <button
                      key={y.year}
                      onClick={() => setYear(y.year)}
                      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border text-sm font-bold transition-all duration-200 ${
                        active
                          ? "bg-white border-[#00b4eb]/30 shadow-sm ring-2 ring-[#00b4eb]/20 text-slate-900"
                          : "bg-white/60 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300 hover:shadow-sm"
                      }`}
                    >
                      <span>{y.year}</span>
                      <span className={`inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${q.chip}`}>
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${q.dot}`} />
                        {q.label}
                      </span>
                      <span className="text-xs font-medium text-slate-400">
                        {y.holidayCount}
                      </span>
                      {y.enforcementReady ? (
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                      )}
                    </button>
                  );
                })}
              </motion.div>
            )}

            {/* ── Enforcement status card ──────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className={`mb-8 rounded-3xl border p-5 sm:p-6 ${
                quality.safe
                  ? "border-emerald-200/60 bg-emerald-50/50"
                  : "border-amber-200/60 bg-amber-50/50"
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                {/* Icon badge */}
                <div className={`shrink-0 p-3 rounded-2xl ${
                  quality.safe ? "bg-emerald-100" : "bg-amber-100"
                }`}>
                  {quality.safe ? (
                    <ShieldCheck className="h-6 w-6 text-emerald-600" />
                  ) : (
                    <ShieldAlert className="h-6 w-6 text-amber-600" />
                  )}
                </div>

                {/* Text content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-base font-bold ${
                    quality.safe ? "text-emerald-800" : "text-amber-800"
                  }`}>
                    {quality.safe
                      ? `Logbook restrictions are active for ${year}`
                      : `Logbook restrictions are PAUSED for ${year}`}
                  </p>
                  <p className={`mt-1 text-sm ${
                    quality.safe ? "text-emerald-700/80" : "text-amber-700/80"
                  }`}>
                    {quality.blurb}
                  </p>

                  {/* Meta info */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
                    <span className="text-xs font-medium text-slate-500">
                      Last sync: {formatWhen(meta?.lastSyncedAt)}
                    </span>
                    {meta?.verifiedBy && (
                      <span className="text-xs font-medium text-slate-500">
                        Verified by {meta.verifiedBy}
                      </span>
                    )}
                  </div>

                  {/* Provider chips */}
                  {meta?.sources?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {meta.sources.map((s) => (
                        <span
                          key={s.name}
                          className={`inline-flex items-center gap-1 rounded-xl border px-2 py-0.5 text-[11px] font-bold ${
                            s.ok
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-rose-200 bg-rose-50 text-rose-700"
                          }`}
                          title={s.error || ""}
                        >
                          {s.ok ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          {s.name}: {s.ok ? `${s.count}` : s.error}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Verify button */}
                <button
                  onClick={toggleVerify}
                  disabled={busy === "verify" || holidays.length === 0}
                  className={`w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${
                    meta?.dataQuality === "verified"
                      ? "bg-slate-500 hover:bg-slate-600"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {busy === "verify" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : meta?.dataQuality === "verified" ? (
                    <>
                      <ShieldAlert className="h-4 w-4" />
                      Un-verify
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      Mark verified
                    </>
                  )}
                </button>
              </div>

              {/* Conflicts section — expandable */}
              {conflicts.length > 0 && meta?.dataQuality !== "verified" && (
                <div className="mt-4 pt-4 border-t border-orange-200/50">
                  <button
                    onClick={() => setShowConflicts(!showConflicts)}
                    className="flex items-center gap-2 text-sm font-bold text-orange-700 hover:text-orange-800 transition-colors"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    {conflicts.length} date{conflicts.length === 1 ? "" : "s"} need a second look
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showConflicts ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {showConflicts && (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-3 space-y-1.5 overflow-hidden"
                      >
                        {conflicts.map((c, i) => (
                          <li key={`${c.date}-${i}`} className="text-sm text-orange-700 pl-6">
                            <span className="font-bold">{c.date}</span> — {c.name}
                            <span className="text-orange-600/80"> · {c.detail}</span>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>

            {/* ── Holiday list card ────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.3 }}
              className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* Card header */}
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    {year} Calendar
                  </h2>
                  <span className={`inline-flex items-center gap-1 rounded-xl border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${quality.chip}`}>
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${quality.dot}`} />
                    {quality.label}
                  </span>
                </div>
                <span className="text-sm font-medium text-slate-400">
                  {holidays.length} holiday{holidays.length === 1 ? "" : "s"}
                </span>
              </div>

              {/* List body */}
              {loading ? (
                <div className="flex items-center justify-center gap-3 py-20 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm font-medium">Loading holidays…</span>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <AlertTriangle className="h-8 w-8 text-rose-400" />
                  <p className="text-sm font-semibold text-rose-600">{error}</p>
                </div>
              ) : holidays.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="p-4 bg-slate-100 rounded-3xl">
                    <CalendarDays className="h-10 w-10 text-slate-300" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-slate-600">No holidays for {year}</p>
                    <p className="text-sm text-slate-400 mt-1">Run a sync to fetch from providers, or add them manually.</p>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={runSync}
                      disabled={busy === "sync"}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-[#0056a2] rounded-2xl hover:bg-[#00488a] transition-colors shadow-sm disabled:opacity-60"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Sync now
                    </button>
                    <button
                      onClick={() => {
                        setForm({ date: `${year}-01-01`, name: "" });
                        setShowAdd(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-700 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Add manually
                    </button>
                  </div>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100/80">
                  {holidays.map((h) => {
                    const dp = getDateParts(h.date);
                    return (
                      <li
                        key={h._id}
                        className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3.5 hover:bg-slate-50/80 transition-colors group"
                      >
                        {/* Calendar date badge */}
                        <div className="shrink-0 w-14 h-14 sm:w-16 sm:h-16 flex flex-col items-center justify-center bg-blue-50/80 border border-blue-100/50 rounded-2xl">
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#0056a2]/60 leading-none">
                            {dp.month}
                          </span>
                          <span className="text-xl sm:text-2xl font-black text-[#0056a2] leading-none mt-0.5">
                            {dp.day}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 leading-none mt-0.5">
                            {dp.weekday}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm sm:text-base font-bold text-slate-800 truncate">
                            {h.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {(h.type || []).map((t) => (
                              <span
                                key={t}
                                className="inline-block rounded-lg bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide"
                              >
                                {t}
                              </span>
                            ))}
                            {h.sources?.length > 0 && (
                              <span className="text-[11px] text-slate-400 font-medium">
                                via {h.sources.join(", ")}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Badges & actions */}
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                          {h.isManual && (
                            <span className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-indigo-700">
                              <Sparkles className="h-3 w-3" />
                              Manual
                            </span>
                          )}
                          <button
                            onClick={() => {
                              setEditing(h);
                              setForm({ date: h.date, name: h.name });
                            }}
                            className="p-2 rounded-xl text-slate-300 hover:bg-slate-100 hover:text-slate-700 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Rename"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(h)}
                            className="p-2 rounded-xl text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </motion.div>

            {/* ── Footer note ─────────────────────────────────────────────── */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.3 }}
              className="mt-5 flex items-start gap-2 text-xs text-slate-400 max-w-2xl"
            >
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Providers publish roughly a year ahead, so a future year staying empty
              is normal — it is gazetted later. Editing any date clears the year's
              verification, so re-verify after making changes.
            </motion.p>
          </main>
        </div>

        {/* ── Add / edit modal ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {(showAdd || editing) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
              onClick={() => {
                setShowAdd(false);
                setEditing(null);
              }}
            >
              <motion.form
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                onSubmit={saveHoliday}
                className="w-full max-w-md bg-white shadow-2xl rounded-3xl p-6 sm:p-7"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#00b4eb]/10 rounded-xl">
                      <CalendarDays className="h-5 w-5 text-[#0056a2]" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {editing ? "Rename holiday" : "Add holiday"}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdd(false);
                      setEditing(null);
                    }}
                    className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <label className="block mb-4">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">
                    Date
                  </span>
                  <input
                    type="date"
                    required
                    disabled={Boolean(editing)}
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-4 py-3 text-sm font-semibold bg-slate-50 border border-slate-200 rounded-2xl text-gray-700 transition-all focus:ring-2 focus:ring-[#00b4eb]/30 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                  />
                </label>

                <label className="block mb-5">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">
                    Name
                  </span>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Special Bank Holiday"
                    className="w-full px-4 py-3 text-sm font-semibold bg-slate-50 border border-slate-200 rounded-2xl text-gray-700 transition-all focus:ring-2 focus:ring-[#00b4eb]/30 focus:outline-none placeholder:text-slate-300"
                  />
                </label>

                <p className="mb-5 flex items-start gap-2 text-xs text-slate-400">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Manually added or edited holidays are never overwritten by a provider sync.
                </p>

                <button
                  type="submit"
                  disabled={busy === "save"}
                  className="w-full py-3 text-sm font-bold text-white transition-all bg-[#0056a2] rounded-2xl hover:bg-[#00488a] disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  {busy === "save" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : editing ? (
                    "Save changes"
                  ) : (
                    "Add holiday"
                  )}
                </button>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Delete confirmation ──────────────────────────────────────────── */}
        <AnimatePresence>
          {confirmDelete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
              onClick={() => setConfirmDelete(null)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm bg-white shadow-2xl rounded-3xl p-6 sm:p-7"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-rose-100 rounded-xl">
                    <Trash2 className="h-5 w-5 text-rose-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Remove this holiday?
                  </h3>
                </div>

                {/* Date badge preview */}
                {(() => {
                  const dp = getDateParts(confirmDelete.date);
                  return (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl mb-4">
                      <div className="w-12 h-12 flex flex-col items-center justify-center bg-rose-50 border border-rose-100 rounded-xl">
                        <span className="text-[9px] font-black uppercase tracking-widest text-rose-400 leading-none">
                          {dp.month}
                        </span>
                        <span className="text-lg font-black text-rose-600 leading-none mt-0.5">
                          {dp.day}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{confirmDelete.name}</p>
                        <p className="text-xs text-slate-500">{dp.weekday}, {dp.month} {dp.day}</p>
                      </div>
                    </div>
                  );
                })()}

                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3 mb-5">
                  <AlertTriangle className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                  It becomes a normal working day, so it will count toward every
                  intern's logbook requirement.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="flex-1 py-3 text-sm font-bold rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteHoliday}
                    className="flex-1 py-3 text-sm font-bold text-white bg-rose-600 rounded-2xl hover:bg-rose-700 transition-colors shadow-sm"
                  >
                    Remove
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Toast ────────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm font-bold shadow-xl border max-w-sm ${
                toast.kind === "error"
                  ? "bg-rose-50 border-rose-200 text-rose-800"
                  : "bg-emerald-50 border-emerald-200 text-emerald-800"
              }`}
            >
              {toast.kind === "error" ? (
                <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              )}
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminNavigation>
  );
};

export default AdminHolidays;
