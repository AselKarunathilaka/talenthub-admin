import { useCallback, useEffect, useState } from "react";
import { Camera, CheckCircle2, ExternalLink, Loader, LocateFixed, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import { requestFaceCameraStream } from "../utils/cameraAccess";
import { requestFreshLocation } from "../utils/attendanceEvidence";

const initialState = { camera: "checking", location: "checking" };

const queryPermission = async (name) => {
  if (!navigator.permissions?.query) return "unknown";
  try {
    const result = await navigator.permissions.query({ name });
    return result.state;
  } catch {
    return "unknown";
  }
};

const PermissionRow = ({ icon: Icon, title, description, status, onEnable }) => {
  const ready = status === "granted";
  const busy = status === "checking" || status === "requesting";
  const denied = status === "denied";
  return (
    <div className={`rounded-2xl border p-4 transition ${ready ? "border-emerald-200 bg-emerald-50/70" : denied ? "border-red-200 bg-red-50/70" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className={`rounded-xl p-2.5 ${ready ? "bg-emerald-100 text-emerald-700" : denied ? "bg-red-100 text-red-700" : "bg-blue-50 text-blue-700"}`}><Icon className="h-5 w-5" /></div>
          <div><div className="flex items-center gap-2"><h3 className="font-bold text-slate-900">{title}</h3>{ready && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}</div><p className="mt-1 text-sm text-slate-500">{description}</p>{denied && <p className="mt-2 text-xs font-semibold text-red-700">Permission is blocked. Open the browser site settings, change it to Allow, then check again.</p>}</div>
        </div>
        {ready ? <span className="inline-flex w-fit rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">Ready</span> : <button type="button" onClick={onEnable} disabled={busy} className="inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60">{busy ? <Loader className="h-4 w-4 animate-spin" /> : denied ? <RefreshCw className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}{busy ? "Checking…" : denied ? "Check again" : "Enable"}</button>}
      </div>
    </div>
  );
};

export default function AttendancePermissionGate({ locationRequired = true }) {
  const [status, setStatus] = useState(initialState);
  const [error, setError] = useState("");

  const checkPermissions = useCallback(async () => {
    const [camera, location] = await Promise.all([
      queryPermission("camera"),
      locationRequired ? queryPermission("geolocation") : Promise.resolve("granted"),
    ]);
    setStatus({ camera, location });
  }, [locationRequired]);

  useEffect(() => { checkPermissions(); }, [checkPermissions]);

  const enableCamera = async () => {
    setError(""); setStatus((current) => ({ ...current, camera: "requesting" }));
    try {
      const stream = await requestFaceCameraStream();
      stream.getTracks().forEach((track) => track.stop());
      setStatus((current) => ({ ...current, camera: "granted" }));
    } catch (requestError) {
      setStatus((current) => ({ ...current, camera: requestError?.name === "NotAllowedError" ? "denied" : "unknown" }));
      setError(requestError?.message || "Camera permission could not be enabled.");
    }
  };

  const enableLocation = async () => {
    setError(""); setStatus((current) => ({ ...current, location: "requesting" }));
    try {
      await requestFreshLocation();
      setStatus((current) => ({ ...current, location: "granted" }));
    } catch (requestError) {
      const permission = await queryPermission("geolocation");
      setStatus((current) => ({ ...current, location: permission === "denied" ? "denied" : "unknown" }));
      setError(requestError?.message || "Location permission could not be enabled.");
    }
  };

  const ready = status.camera === "granted" && (!locationRequired || status.location === "granted");
  if (ready) return null;

  const secure = window.isSecureContext || window.location.hostname === "localhost";
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-md">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/20 bg-slate-50 shadow-2xl">
        <div className="bg-gradient-to-r from-[#000066] via-[#0056a2] to-[#006600] px-6 py-6 text-white"><div className="flex items-center gap-3"><div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/20"><LockKeyhole className="h-6 w-6" /></div><div><h2 className="text-xl font-extrabold">Set up attendance access</h2><p className="mt-1 text-sm text-white/70">Allow these permissions once to use secure attendance.</p></div></div></div>
        <div className="space-y-4 p-5 sm:p-6">
          {!secure && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">Camera and location require an HTTPS website. Open the secure TalentHub link.</div>}
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <PermissionRow icon={Camera} title="Camera access" description="Used only while scanning your face or a QR code." status={status.camera} onEnable={enableCamera} />
          {locationRequired && <PermissionRow icon={LocateFixed} title="Location access" description="Confirms that attendance is marked from an approved location." status={status.location} onEnable={enableLocation} />}
          {(status.camera === "denied" || status.location === "denied") && <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900"><p className="font-bold">How to unblock permission</p><p className="mt-1 text-blue-800">Tap the lock/settings icon beside the website address → Site settings → set Camera and Location to Allow → reload the page.</p><div className="mt-2 flex items-center gap-1 text-xs font-semibold text-blue-700"><ExternalLink className="h-3.5 w-3.5" />On iPhone: Settings → Safari → Camera/Location, or use Website Settings in Safari.</div></div>}
          <button type="button" onClick={checkPermissions} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700"><RefreshCw className="h-4 w-4" />Recheck permissions</button>
          <p className="text-center text-xs text-slate-400">Browsers require you to press Allow. TalentHub cannot enable device permissions automatically.</p>
        </div>
      </div>
    </div>
  );
}
