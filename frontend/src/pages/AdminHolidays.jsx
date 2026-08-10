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
  FaCalendarAlt,
  FaSync,
  FaCheckCircle,
  FaExclamationTriangle,
  FaPlus,
  FaTrash,
  FaPen,
  FaSpinner,
  FaTimes,
  FaShieldAlt,
  FaInfoCircle,
} from "react-icons/fa";
import holidayApi from "../api/holidayApi";

// ── Data-quality presentation ────────────────────────────────────────────────
const QUALITY = {
  verified: {
    label: "Verified",
    chip: "bg-emerald-100 text-emerald-700 border-emerald-200",
    blurb: "Checked against the gazette by an admin. Restrictions run normally.",
    safe: true,
  },
  corroborated: {
    label: "Corroborated",
    chip: "bg-sky-100 text-sky-700 border-sky-200",
    blurb:
      "Two independent providers reported the same dates. Restrictions run normally.",
    safe: true,
  },
  "single-source": {
    label: "Single source",
    chip: "bg-amber-100 text-amber-700 border-amber-200",
    blurb:
      "Only one provider answered. Auto-restriction is paused until an admin verifies this year.",
    safe: false,
  },
  bundled: {
    label: "Offline seed data",
    chip: "bg-orange-100 text-orange-700 border-orange-200",
    blurb:
      "Every provider was unreachable, so bundled data is in use. Auto-restriction is paused.",
    safe: false,
  },
  missing: {
    label: "No data",
    chip: "bg-rose-100 text-rose-700 border-rose-200",
    blurb:
      "No holidays stored for this year. Auto-restriction is paused — add them or run a sync.",
    safe: false,
  },
};

const qualityOf = (key) => QUALITY[key] || QUALITY.missing;

const formatDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

const formatWhen = (value) =>
  value ? new Date(value).toLocaleString() : "never";

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
    <div className="min-h-screen bg-gray-50">
      <AdminNavigation />

      <div className="max-w-6xl px-4 py-6 mx-auto md:px-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <FaCalendarAlt className="text-blue-600" />
              Public Holidays
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Working days, logbook windows and Sunday restrictions all read from
              this list.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2 text-sm font-semibold bg-white border rounded-xl border-slate-200 text-slate-700"
            >
              {[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <button
              onClick={runSync}
              disabled={busy === "sync"}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white transition bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-60"
            >
              {busy === "sync" ? (
                <FaSpinner className="animate-spin" />
              ) : (
                <FaSync />
              )}
              Sync providers
            </button>
          </div>
        </div>

        {/* ── Year overview strip ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
          {overview.map((y) => {
            const q = qualityOf(y.dataQuality);
            const active = y.year === year;
            return (
              <button
                key={y.year}
                onClick={() => setYear(y.year)}
                className={`rounded-xl border p-3 text-left transition ${
                  active
                    ? "border-blue-400 bg-white shadow-sm ring-2 ring-blue-100"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-slate-900">
                    {y.year}
                  </span>
                  {y.enforcementReady ? (
                    <FaShieldAlt className="text-emerald-500" title="Restrictions enabled" />
                  ) : (
                    <FaExclamationTriangle
                      className="text-amber-500"
                      title="Restrictions paused"
                    />
                  )}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {y.holidayCount} holiday{y.holidayCount === 1 ? "" : "s"}
                </div>
                <span
                  className={`mt-2 inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${q.chip}`}
                >
                  {q.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Enforcement banner ─────────────────────────────────────────── */}
        <div
          className={`mb-6 rounded-xl border p-4 ${
            quality.safe
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="flex items-start gap-3">
            {quality.safe ? (
              <FaCheckCircle className="mt-0.5 shrink-0 text-emerald-600" />
            ) : (
              <FaExclamationTriangle className="mt-0.5 shrink-0 text-amber-600" />
            )}
            <div className="flex-1">
              <p
                className={`text-sm font-bold ${
                  quality.safe ? "text-emerald-800" : "text-amber-800"
                }`}
              >
                {quality.safe
                  ? `Logbook restrictions are active for ${year}`
                  : `Logbook restrictions are PAUSED for ${year}`}
              </p>
              <p
                className={`mt-1 text-sm ${
                  quality.safe ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {quality.blurb}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Last provider sync: {formatWhen(meta?.lastSyncedAt)}
                {meta?.verifiedBy ? ` · Verified by ${meta.verifiedBy}` : ""}
              </p>
            </div>

            <button
              onClick={toggleVerify}
              disabled={busy === "verify" || holidays.length === 0}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${
                meta?.dataQuality === "verified"
                  ? "bg-slate-500 hover:bg-slate-600"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {busy === "verify" ? (
                <FaSpinner className="animate-spin" />
              ) : meta?.dataQuality === "verified" ? (
                "Un-verify"
              ) : (
                "Mark verified"
              )}
            </button>
          </div>
        </div>

        {/* ── Provider results ───────────────────────────────────────────── */}
        {meta?.sources?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {meta.sources.map((s) => (
              <span
                key={s.name}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                  s.ok
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
                title={s.error || ""}
              >
                {s.name}: {s.ok ? `${s.count} holidays` : s.error}
              </span>
            ))}
          </div>
        )}

        {/* ── Conflicts ──────────────────────────────────────────────────── */}
        {conflicts.length > 0 && (
          <div className="p-4 mb-6 border border-orange-200 rounded-xl bg-orange-50">
            <p className="flex items-center gap-2 text-sm font-bold text-orange-800">
              <FaInfoCircle />
              {conflicts.length} date{conflicts.length === 1 ? "" : "s"} need a
              second look
            </p>
            <ul className="mt-2 space-y-1 text-sm text-orange-700">
              {conflicts.map((c, i) => (
                <li key={`${c.date}-${i}`}>
                  <span className="font-semibold">{c.date}</span> — {c.name}
                  <span className="text-orange-600"> · {c.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Holiday list ───────────────────────────────────────────────── */}
        <div className="bg-white border shadow-sm border-slate-200 rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <h2 className="text-sm font-bold tracking-wide uppercase text-slate-600">
              {holidays.length} holiday{holidays.length === 1 ? "" : "s"} in {year}
            </h2>
            <button
              onClick={() => {
                setForm({ date: `${year}-01-01`, name: "" });
                setShowAdd(true);
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-blue-700 transition rounded-lg bg-blue-50 hover:bg-blue-100"
            >
              <FaPlus className="text-xs" /> Add holiday
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
              <FaSpinner className="animate-spin" /> Loading…
            </div>
          ) : error ? (
            <div className="py-16 text-sm text-center text-rose-600">{error}</div>
          ) : holidays.length === 0 ? (
            <div className="py-16 text-sm text-center text-slate-500">
              No holidays stored for {year}. Run a sync, or add them by hand.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {holidays.map((h) => (
                <li
                  key={h._id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50"
                >
                  <div className="w-32 shrink-0">
                    <p className="text-sm font-bold text-slate-900">{h.date}</p>
                    <p className="text-xs text-slate-500">{formatDate(h.date)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-slate-800">
                      {h.name}
                    </p>
                    <p className="text-xs truncate text-slate-500">
                      {(h.type || []).join(", ")}
                      {h.sources?.length ? ` · ${h.sources.join(", ")}` : ""}
                    </p>
                  </div>
                  {h.isManual && (
                    <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-700">
                      Manual
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setEditing(h);
                      setForm({ date: h.date, name: h.name });
                    }}
                    className="p-2 transition rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title="Rename"
                  >
                    <FaPen className="text-xs" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(h)}
                    className="p-2 transition rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    title="Remove"
                  >
                    <FaTrash className="text-xs" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Providers publish roughly a year ahead, so a future year staying empty
          is normal — it is gazetted later. Editing any date clears the year's
          verification, so re-verify after making changes.
        </p>
      </div>

      {/* ── Add / edit modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {(showAdd || editing) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
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
              className="w-full max-w-md p-5 bg-white shadow-xl rounded-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">
                  {editing ? "Rename holiday" : "Add holiday"}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdd(false);
                    setEditing(null);
                  }}
                  className="p-2 rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <FaTimes />
                </button>
              </div>

              <label className="block mb-3">
                <span className="text-xs font-bold tracking-wide uppercase text-slate-500">
                  Date
                </span>
                <input
                  type="date"
                  required
                  disabled={Boolean(editing)}
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3 py-2 mt-1 text-sm border rounded-xl border-slate-200 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </label>

              <label className="block mb-5">
                <span className="text-xs font-bold tracking-wide uppercase text-slate-500">
                  Name
                </span>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Special Bank Holiday"
                  className="w-full px-3 py-2 mt-1 text-sm border rounded-xl border-slate-200"
                />
              </label>

              <p className="mb-4 text-xs text-slate-500">
                Manually added or edited holidays are never overwritten by a
                provider sync.
              </p>

              <button
                type="submit"
                disabled={busy === "save"}
                className="w-full py-2.5 text-sm font-semibold text-white transition bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-60"
              >
                {busy === "save" ? "Saving…" : editing ? "Save changes" : "Add holiday"}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete confirmation ────────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm p-5 bg-white shadow-xl rounded-2xl"
            >
              <h3 className="text-lg font-bold text-slate-900">
                Remove this holiday?
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                <span className="font-semibold">{confirmDelete.date}</span> —{" "}
                {confirmDelete.name}
              </p>
              <p className="mt-3 text-sm text-amber-700">
                It becomes a normal working day, so it will count toward every
                intern's logbook requirement.
              </p>
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2 text-sm font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteHoliday}
                  className="flex-1 py-2 text-sm font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700"
                >
                  Remove
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${
              toast.kind === "error" ? "bg-rose-600" : "bg-emerald-600"
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminHolidays;
