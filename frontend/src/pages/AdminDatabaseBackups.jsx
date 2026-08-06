import { createElement, useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Archive, CalendarClock, CheckCircle2, Cloud, Clock3, Database,
  HardDrive, LoaderCircle, LockKeyhole, Play, RefreshCw, Server,
  ShieldCheck, TriangleAlert,
} from "lucide-react";
import AdminNavigation from "../components/AdminNavigation";
import { API_BASE_URL } from "../api/apiConfig";
import { getAdminSession } from "../utils/adminAuth";

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAdminSession()?.token}`,
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
};

const formatBytes = (bytes = 0) => {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
};

const formatDate = (value) => {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Colombo",
  }).format(date);
};

export default function AdminDatabaseBackups() {
  const session = getAdminSession();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const result = await request("/admin/backups/status");
      setData(result);
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (data?.operation?.status !== "running") return undefined;
    const timer = window.setInterval(() => load({ quiet: true }), 4000);
    return () => window.clearInterval(timer);
  }, [data?.operation?.status, load]);

  if (session?.user?.role !== "super_admin") return <Navigate to="/admin/dashboard" replace />;

  const startBackup = async () => {
    setActionLoading(true); setError(""); setNotice("");
    try {
      const result = await request("/admin/backups/run", { method: "POST", body: "{}" });
      setNotice(result.message); await load({ quiet: true });
    } catch (actionError) { setError(actionError.message); }
    finally { setActionLoading(false); }
  };

  const configuration = data?.configuration;
  const operation = data?.operation;
  const snapshots = data?.snapshots || [];
  const isRunning = operation?.status === "running";
  const reportedProgress = Number(operation?.progress);
  const operationProgress = Number.isFinite(reportedProgress)
    ? Math.min(100, Math.max(0, reportedProgress))
    : operation?.status === "success" ? 100 : null;
  const lastSnapshot = snapshots[0];
  const totalProtectedBytes = snapshots.reduce(
    (total, snapshot) => total + (Number(snapshot.sizeBytes) || 0),
    0,
  );
  const isHealthy = Boolean(configuration?.ready && !data?.snapshotError);

  const summaryCards = [
    {
      label: "Backup health",
      value: loading ? "Checking…" : isHealthy ? "Healthy" : "Needs attention",
      detail: isHealthy ? "Backup cluster is reachable" : "Review configuration or connection",
      icon: ShieldCheck,
      color: isHealthy ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600",
    },
    {
      label: "Latest snapshot",
      value: lastSnapshot ? formatDate(lastSnapshot.createdAt) : "No backup yet",
      detail: lastSnapshot?.database || "Run the first full backup",
      icon: Clock3,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Protected storage",
      value: formatBytes(totalProtectedBytes),
      detail: `${snapshots.length} full ${snapshots.length === 1 ? "snapshot" : "snapshots"} available`,
      icon: HardDrive,
      color: "bg-cyan-50 text-cyan-600",
    },
    {
      label: "Retention policy",
      value: `${configuration?.retentionCount || 5} latest copies`,
      detail: "Older managed snapshots are removed",
      icon: Archive,
      color: "bg-violet-50 text-violet-600",
    },
  ];

  return (
    <AdminNavigation>
      <div className="min-h-screen bg-[#f4f7fb] px-4 py-5 md:px-8 md:py-8">
        <div className="mx-auto max-w-[1440px] space-y-5">
          <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-blue-950 to-emerald-950 p-6 text-white shadow-xl shadow-slate-900/10 md:p-8">
            <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
            <div className="relative grid gap-7 xl:grid-cols-[1fr_360px] xl:items-end">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-cyan-100 backdrop-blur">
                  <span className={`h-2 w-2 rounded-full ${isHealthy ? "bg-emerald-400 shadow-[0_0_12px_#34d399]" : "bg-amber-400"}`} />
                  {loading ? "Checking protection status" : isHealthy ? "Protection active" : "Protection needs attention"}
                </div>
                <h1 className="max-w-2xl text-3xl font-black tracking-tight md:text-4xl">Backup control center</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">Create and monitor complete TalentHub database snapshots stored safely outside the live MongoDB cluster.</p>
                <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-slate-200">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2"><Database className="h-3.5 w-3.5 text-cyan-300" />{configuration?.sourceDatabase || "Source database"}</span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2"><Cloud className="h-3.5 w-3.5 text-emerald-300" />Separate backup cluster</span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2"><LockKeyhole className="h-3.5 w-3.5 text-violet-300" />Super Admin only</span>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-cyan-400/15 p-3 text-cyan-300"><CalendarClock className="h-5 w-5" /></div>
                  <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Automatic schedule</p><p className="mt-1 text-lg font-extrabold">Daily at 12:00 PM</p><p className="text-xs text-slate-400">Asia/Colombo timezone</p></div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/15 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</button>
                  <button onClick={startBackup} disabled={actionLoading || isRunning || !configuration?.ready} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/30 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50">{isRunning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}{isRunning ? "Running…" : "Backup now"}</button>
                </div>
              </div>
            </div>
          </section>

          {error && <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm font-semibold text-red-700"><TriangleAlert className="mt-0.5 h-5 w-5 flex-none" /><span>{error}</span></div>}
          {notice && <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm font-semibold text-emerald-700"><CheckCircle2 className="mt-0.5 h-5 w-5 flex-none" /><span>{notice}</span></div>}
          {!configuration?.ready && !loading && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex gap-3"><TriangleAlert className="h-6 w-6 flex-none text-amber-600" /><div><h2 className="font-bold text-amber-950">Backup storage needs configuration</h2><p className="mt-1 text-sm leading-6 text-amber-800">{configuration?.message} Add the separate cluster URL to the protected backend environment. Credentials are never displayed here.</p></div></div></div>}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map(({ label, value, detail, icon, color }) => <article key={label} className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="mt-2 truncate text-lg font-black text-slate-900" title={String(value)}>{value}</p><p className="mt-1 truncate text-xs font-medium text-slate-500" title={detail}>{detail}</p></div><div className={`rounded-xl p-3 ${color}`}>{createElement(icon, { className: "h-5 w-5" })}</div></div></article>)}
          </section>

          {operation && operation.status !== "idle" && (
            <section className={`overflow-hidden rounded-2xl border p-5 shadow-sm ${operation.status === "failed" ? "border-red-200 bg-red-50" : operation.status === "success" ? "border-emerald-200 bg-emerald-50" : "border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50"}`}>
              <div className="flex items-start gap-3">
                <div className={`rounded-xl p-2.5 ${operation.status === "failed" ? "bg-red-100 text-red-600" : operation.status === "success" ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"}`}>
                  {operation.status === "running" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : operation.status === "success" ? <CheckCircle2 className="h-5 w-5" /> : <TriangleAlert className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-black capitalize text-slate-900">{operation.type} {operation.status}</h2>
                      <p className="mt-0.5 text-sm font-semibold text-slate-600">{operation.phase || (isRunning ? "Backup in progress" : "Operation finished")}</p>
                    </div>
                    <span className={`text-2xl font-black tabular-nums ${operation.status === "failed" ? "text-red-600" : operation.status === "success" ? "text-emerald-600" : "text-blue-700"}`}>{operationProgress === null ? "Waiting…" : `${operationProgress}%`}</span>
                  </div>

                  <div
                    className="mt-4 h-3 overflow-hidden rounded-full bg-white/80 ring-1 ring-slate-900/5"
                    role="progressbar"
                    aria-label="Database backup progress"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={operationProgress ?? undefined}
                  >
                    <div
                      className={`relative h-full rounded-full transition-[width] duration-700 ease-out ${operationProgress === null ? "animate-pulse" : ""} ${operation.status === "failed" ? "bg-red-500" : operation.status === "success" ? "bg-emerald-500" : "bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-400"}`}
                      style={{ width: operationProgress === null ? "35%" : `${operationProgress}%` }}
                    >
                      {isRunning && <span className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/35 to-transparent" />}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col gap-1 text-xs font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                    <span>Started {formatDate(operation.startedAt)}</span>
                    <span>{operation.completedAt ? `Completed ${formatDate(operation.completedAt)}` : "The backup continues safely on the server."}</span>
                  </div>
                  {operation.warning && <p className="mt-3 text-sm font-semibold text-amber-700">Retention warning: {operation.warning}</p>}
                  {operation.error && <p className="mt-3 text-sm font-semibold text-red-700">{operation.error}</p>}
                </div>
              </div>
            </section>
          )}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><HardDrive className="h-5 w-5 text-blue-600" />Snapshot history</h2><p className="mt-1 text-xs font-medium text-slate-500">Complete copies of every collection, including logbooks and attendance.</p></div><span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{snapshots.length} of {configuration?.retentionCount || 5} retained</span></div>
              {loading ? <div className="p-16 text-center text-sm font-medium text-slate-500"><LoaderCircle className="mx-auto mb-3 h-7 w-7 animate-spin text-blue-600" />Loading backup storage…</div> : data?.snapshotError ? <div className="p-12 text-center text-sm font-semibold text-red-600">{data.snapshotError}</div> : snapshots.length === 0 ? <div className="p-16 text-center"><div className="mx-auto w-fit rounded-2xl bg-slate-100 p-4"><Archive className="h-8 w-8 text-slate-400" /></div><p className="mt-4 font-bold text-slate-800">No snapshots available</p><p className="mt-1 text-sm text-slate-500">Run a backup now or wait for the scheduled job.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead className="bg-slate-50/80 text-[11px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-3.5">Snapshot database</th><th className="px-5 py-3.5">Created</th><th className="px-5 py-3.5">Size</th><th className="px-5 py-3.5">Integrity</th></tr></thead><tbody className="divide-y divide-slate-100">{snapshots.map((snapshot, index) => <tr key={snapshot.database} className="transition hover:bg-blue-50/30"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><Database className="h-4 w-4" /></div><div><p className="font-mono text-sm font-bold text-slate-800">{snapshot.database}</p>{index === 0 && <span className="mt-0.5 inline-block text-xs font-bold text-emerald-600">Latest snapshot</span>}</div></div></td><td className="px-5 py-4 text-sm font-medium text-slate-600">{formatDate(snapshot.createdAt)}</td><td className="px-5 py-4 text-sm font-bold text-slate-700">{formatBytes(snapshot.sizeBytes)}</td><td className="px-5 py-4"><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Available</span></td></tr>)}</tbody></table></div>}
            </section>

            <aside className="space-y-5">
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <h2 className="text-base font-black text-slate-900">Storage policy</h2>
                <div className="mt-4 space-y-4">
                  {[{ icon: Server, label: "Destination", value: configuration?.targetHost || "Not configured", tone: "text-emerald-600 bg-emerald-50" }, { icon: CalendarClock, label: "Schedule", value: "Daily · 12:00 PM", tone: "text-blue-600 bg-blue-50" }, { icon: Archive, label: "Retention", value: `${configuration?.retentionCount || 5} latest snapshots`, tone: "text-violet-600 bg-violet-50" }].map(({ icon, label, value, tone }) => <div key={label} className="flex items-center gap-3"><div className={`rounded-lg p-2 ${tone}`}>{createElement(icon, { className: "h-4 w-4" })}</div><div className="min-w-0"><p className="text-xs font-semibold text-slate-400">{label}</p><p className="truncate text-sm font-bold text-slate-700" title={value}>{value}</p></div></div>)}
                </div>
              </section>
              <section className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white"><ShieldCheck className="h-5 w-5" /></div>
                <h2 className="mt-4 font-black text-blue-950">Backup-only safety mode</h2>
                <p className="mt-2 text-sm leading-6 text-blue-800">This portal creates and monitors full backups. Live restoration remains disabled until a tested recovery procedure is approved.</p>
              </section>
            </aside>
          </div>
        </div>
      </div>

    </AdminNavigation>
  );
}
