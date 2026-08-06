import { createElement, useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Archive, CheckCircle2, Clock3, Database, HardDrive, LoaderCircle,
  Play, RefreshCw, Server, ShieldCheck, TriangleAlert,
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

const formatDate = (value) => value
  ? new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" }).format(new Date(value))
  : "Unknown time";

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

  return (
    <AdminNavigation>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/50 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-100"><ShieldCheck className="h-3.5 w-3.5" />Super Admin Security</div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Database Backups</h1>
              <p className="mt-1 text-sm text-slate-500">Full TalentHub snapshots stored on a separate MongoDB cluster.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:text-blue-700 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</button>
              <button onClick={startBackup} disabled={actionLoading || isRunning || !configuration?.ready} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{isRunning && operation?.type === "backup" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Backup now</button>
            </div>
          </header>

          {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"><TriangleAlert className="mt-0.5 h-4 w-4 flex-none" />{error}</div>}
          {notice && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />{notice}</div>}
          {!configuration?.ready && !loading && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex gap-3"><TriangleAlert className="h-6 w-6 flex-none text-amber-600" /><div><h2 className="font-bold text-amber-900">Backup storage needs configuration</h2><p className="mt-1 text-sm text-amber-800">{configuration?.message} Add the separate cluster URL to the protected backend environment. Credentials are never displayed in this portal.</p></div></div></div>}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Backup status", value: configuration?.ready ? "Connected" : "Not configured", detail: configuration?.targetHost || "Separate cluster required", icon: Server, color: configuration?.ready ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600" },
              { label: "Automatic schedule", value: "Daily at 12:00 PM", detail: "Asia/Colombo timezone", icon: Clock3, color: "bg-blue-50 text-blue-600" },
              { label: "Retention", value: `${configuration?.retentionCount || 5} latest backups`, detail: "Older managed snapshots deleted", icon: Archive, color: "bg-violet-50 text-violet-600" },
              { label: "Available snapshots", value: snapshots.length, detail: "Full database copies", icon: Database, color: "bg-cyan-50 text-cyan-600" },
            ].map(({ label, value, detail, icon, color }) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-1 text-xl font-extrabold text-slate-900">{value}</p><p className="mt-1 truncate text-xs text-slate-400">{detail}</p></div><div className={`rounded-xl p-3 ${color}`}>{createElement(icon, { className: "h-5 w-5" })}</div></div></article>)}
          </section>

          {operation?.status !== "idle" && <section className={`rounded-2xl border p-5 ${operation.status === "failed" ? "border-red-200 bg-red-50" : operation.status === "success" ? "border-emerald-200 bg-emerald-50" : "border-blue-200 bg-blue-50"}`}><div className="flex items-start gap-3">{operation.status === "running" ? <LoaderCircle className="h-6 w-6 animate-spin text-blue-600" /> : operation.status === "success" ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <TriangleAlert className="h-6 w-6 text-red-600" />}<div><h2 className="font-bold capitalize text-slate-900">{operation.type} {operation.status}</h2><p className="mt-1 text-sm text-slate-600">Started {formatDate(operation.startedAt)}{operation.completedAt ? ` · Completed ${formatDate(operation.completedAt)}` : ""}</p>{operation.warning && <p className="mt-2 text-sm font-semibold text-amber-700">Retention warning: {operation.warning}</p>}{operation.error && <p className="mt-2 text-sm font-semibold text-red-700">{operation.error}</p>}</div></div></section>}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="flex items-center gap-2 font-bold text-slate-900"><HardDrive className="h-5 w-5 text-blue-600" />Managed snapshots</h2><p className="mt-1 text-xs text-slate-500">Each snapshot contains every collection, including logbooks and attendance.</p></div></div>
            {loading ? <div className="p-16 text-center text-sm text-slate-500"><LoaderCircle className="mx-auto mb-3 h-7 w-7 animate-spin" />Loading backup storage…</div> : data?.snapshotError ? <div className="p-12 text-center text-sm font-semibold text-red-600">{data.snapshotError}</div> : snapshots.length === 0 ? <div className="p-16 text-center"><Archive className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-bold text-slate-700">No managed backup snapshots yet</p><p className="mt-1 text-sm text-slate-500">Use Backup now or wait for the next scheduled run.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Snapshot database</th><th className="px-5 py-3">Created</th><th className="px-5 py-3">Size</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{snapshots.map((snapshot, index) => <tr key={snapshot.database} className="hover:bg-slate-50/60"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="rounded-lg bg-blue-50 p-2 text-blue-600"><Database className="h-4 w-4" /></div><div><p className="font-mono text-sm font-bold text-slate-800">{snapshot.database}</p>{index === 0 && <span className="text-xs font-bold text-emerald-600">Latest backup</span>}</div></div></td><td className="px-5 py-4 text-sm text-slate-600">{formatDate(snapshot.createdAt)}</td><td className="px-5 py-4 text-sm font-semibold text-slate-700">{formatBytes(snapshot.sizeBytes)}</td><td className="px-5 py-4"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Available</span></td></tr>)}</tbody></table></div>}
          </section>

          <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5"><h2 className="flex items-center gap-2 font-bold text-blue-900"><ShieldCheck className="h-5 w-5" />Backup-only rollout</h2><p className="mt-2 text-sm leading-6 text-blue-800">This portal currently creates and monitors full backups only. Restoration is intentionally unavailable until the team approves and tests a formal recovery procedure.</p></section>
        </div>
      </div>

    </AdminNavigation>
  );
}
