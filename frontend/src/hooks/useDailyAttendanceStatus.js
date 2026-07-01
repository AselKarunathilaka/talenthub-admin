import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../utils/api";

const INITIAL_STATUS = {
  state: "unknown",
  checkInTime: null,
  checkOutTime: null,
  checkoutAvailableAt: null,
  minimumCheckoutMinutes: 15,
};

export const useDailyAttendanceStatus = () => {
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [attendanceAction, setAttendanceAction] = useState("check_in");
  const [statusLoading, setStatusLoading] = useState(true);

  const refreshDailyStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const response = await apiFetch("/face-attendance/daily-status");
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      setStatus(result);
      setAttendanceAction(
        result.state === "checked_in" || result.state === "checked_out"
          ? "check_out"
          : "check_in",
      );
    } catch (error) {
      console.error("Failed to load daily attendance status:", error);
      setStatus(INITIAL_STATUS);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshDailyStatus();
  }, [refreshDailyStatus]);

  return {
    attendanceAction,
    setAttendanceAction,
    status,
    statusLoading,
    refreshDailyStatus,
  };
};
