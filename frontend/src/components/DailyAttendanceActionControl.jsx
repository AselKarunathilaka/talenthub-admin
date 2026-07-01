import React, { useEffect, useState } from "react";
import { LogIn, LogOut } from "lucide-react";

const formatTime = (value) =>
  value
    ? new Date(value).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

const DailyAttendanceActionControl = ({
  action,
  onActionChange,
  status,
  loading,
}) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const checkoutAvailableAt = status.checkoutAvailableAt
    ? new Date(status.checkoutAvailableAt).getTime()
    : 0;
  const checkoutWaiting =
    status.state === "checked_in" && checkoutAvailableAt > now;
  const completed = status.state === "checked_out";
  const checkInDisabled =
    loading || status.state === "checked_in" || completed;
  const checkOutDisabled =
    loading ||
    status.state === "not_checked_in" ||
    checkoutWaiting ||
    completed;

  const statusText = loading
    ? "Loading today's status..."
    : status.state === "checked_in"
      ? checkoutWaiting
        ? `Checked in ${formatTime(status.checkInTime)} - checkout from ${formatTime(status.checkoutAvailableAt)}`
        : `Checked in ${formatTime(status.checkInTime)}`
      : completed
        ? `Completed ${formatTime(status.checkInTime)} - ${formatTime(status.checkOutTime)}`
        : "Not checked in";

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onActionChange("check_in")}
          disabled={checkInDisabled}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
            action === "check_in"
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          <LogIn className="h-4 w-4" />
          Check In
        </button>
        <button
          type="button"
          onClick={() => onActionChange("check_out")}
          disabled={checkOutDisabled}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
            action === "check_out"
              ? "border-amber-500 bg-amber-500 text-white"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          <LogOut className="h-4 w-4" />
          Check Out
        </button>
      </div>
      <p className="mt-2 text-center text-xs font-medium text-slate-500">
        {statusText}
      </p>
    </div>
  );
};

export default DailyAttendanceActionControl;
