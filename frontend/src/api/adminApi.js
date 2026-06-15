import { API_BASE_URL } from "./apiConfig";
import { handleUnauthorized } from "../utils/sessionUtils";

const checkAuth = async (res) => {
  if (res.status === 401) {
    let code = "";
    try {
      const b = await res.clone().json();
      code = b.code || "";
    } catch {
      /* ignore */
    }
    const msg =
      code === "TOKEN_EXPIRED"
        ? "Your session has expired. Please log in again."
        : "Your session is invalid. Please log in again.";
    handleUnauthorized(msg);
    throw new Error(msg);
  }
};

// Get auth token from localStorage
const getAuthToken = () => {
  // Try to get admin token first, then fall back to regular user token
  const adminInfo = localStorage.getItem("adminInfo");
  if (adminInfo) {
    const parsed = JSON.parse(adminInfo);
    return parsed.token;
  }

  const userData = localStorage.getItem("userData");
  if (userData) {
    const parsed = JSON.parse(userData);
    return parsed.token;
  }

  return null;
};

// Create API headers
const getHeaders = () => {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

const downloadApprovedLeaveReport = async ({
  date,
  startDate,
  endDate,
} = {}) => {
  const token = getAuthToken();
  const params = new URLSearchParams();

  // If single date parameter is provided, use it
  // Otherwise fall back to startDate/endDate or default to today
  if (date) {
    params.set("date", date);
  } else if (startDate && endDate) {
    params.set("startDate", startDate);
    params.set("endDate", endDate);
  } else {
    // Default to today if no date parameters provided
    params.set("date", new Date().toISOString().split("T")[0]);
  }

  const url = `${API_BASE_URL}/leave-requests/report/approved?${params.toString()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  await checkAuth(response);
  if (!response.ok) {
    throw new Error(
      `Failed to download approved leave report: ${response.status}`,
    );
  }

  return response.blob();
};

// Admin API functions
export const adminApi = {
  // Download on-leave interns Excel
  downloadOnLeaveExcel: async () => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/admin/on-leave/export`, {
      method: "GET",
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    await checkAuth(response);
    if (!response.ok) throw new Error("Failed to download on-leave Excel");
    return response.blob();
  },
  downloadApprovedLeaveReport,
  // Get dashboard statistics
  getDashboardStats: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/dashboard/stats`, {
        method: "GET",
        headers: getHeaders(),
      });

      await checkAuth(response);
      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard stats: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      throw error;
    }
  },

  // Get individual intern details with records
  getInternDetails: async (internId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/intern/${internId}`, {
        method: "GET",
        headers: getHeaders(),
      });

      await checkAuth(response);
      if (!response.ok) {
        throw new Error(`Failed to fetch intern details: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching intern details:", error);
      throw error;
    }
  },

  // Get individual intern's attendance (daily + meeting) separated
  getInternAttendance: async (internId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/intern/${internId}/attendance`,
        {
          method: "GET",
          headers: getHeaders(),
        },
      );

      await checkAuth(response);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch intern attendance: ${response.status}`,
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching intern attendance:", error);
      throw error;
    }
  },

  // Get individual intern's real GitHub commits per TalentTrail project
  getInternGitCommits: async (internId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/intern/${internId}/git-commits`,
        {
          method: "GET",
          headers: getHeaders(),
        },
      );

      await checkAuth(response);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch intern git commits: ${response.status}`,
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching intern git commits:", error);
      throw error;
    }
  },

  // Issue a certificate — generates/reuses a unique verification token
  issueCertificate: async (internId) => {
    try {
      // Normalize: force http:// for localhost (Safari upgrades to https which breaks local dev)
      let origin = window.location.origin;
      origin = origin.replace(
        /^https:\/\/(localhost|127\.0\.0\.1)/,
        "http://$1",
      );

      const response = await fetch(
        `${API_BASE_URL}/admin/intern/${internId}/issue-certificate`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ frontendOrigin: origin }),
        },
      );

      await checkAuth(response);
      if (!response.ok) {
        throw new Error(`Failed to issue certificate: ${response.status}`);
      }

      return await response.json(); // { token, verificationUrl }
    } catch (error) {
      console.error("Error issuing certificate:", error);
      throw error;
    }
  },

  // Search interns by trainee ID or name
  searchInterns: async (query) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/search/interns?q=${encodeURIComponent(query)}`,
        {
          method: "GET",
          headers: getHeaders(),
        },
      );

      await checkAuth(response);
      if (!response.ok) {
        throw new Error(`Failed to search interns: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error searching interns:", error);
      throw error;
    }
  },

  // Get all intern report data (for exports)
  getInternReport: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/report/interns`, {
        method: "GET",
        headers: getHeaders(),
      });

      await checkAuth(response);
      if (!response.ok) {
        throw new Error(`Failed to fetch intern report: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching intern report:", error);
      throw error;
    }
  },

  // Get all daily records
  getAllDailyRecords: async ({
    page = 1,
    limit = 50,
    search = "",
    date = "",
  } = {}) => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search ? { search } : {}),
        ...(date ? { date } : {}),
      });

      const response = await fetch(
        `${API_BASE_URL}/admin/daily-records?${params.toString()}`,
        { method: "GET", headers: getHeaders() },
      );
      await checkAuth(response);

      if (!response.ok) {
        throw new Error(`Failed to fetch daily records: ${response.status}`);
      }

      // Returns { records: [...], pagination: { total, page, limit, totalPages, hasNextPage, hasPrevPage } }
      return await response.json();
    } catch (error) {
      console.error("Error fetching daily records:", error);
      throw error;
    }
  },

  // Get non-submissions within a week from current date (last 5 working days)
  getNonSubmissionsWithinAWeek: async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/non-submissions-within-week`,
        {
          method: "GET",
          headers: getHeaders(),
        },
      );

      await checkAuth(response);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch non-submissions within a week: ${response.status}`,
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching non-submissions within a week:", error);
      throw error;
    }
  },

  // Get weekly non-submissions (Monday to Friday of current week or custom date range)
  getWeeklyNonSubmissions: async (weekType = null) => {
    try {
      let url = `${API_BASE_URL}/admin/weekly-non-submissions`;
      // Accepts either weekType or custom date range
      if (typeof weekType === "object" && weekType !== null) {
        const { startDate, endDate } = weekType;
        if (startDate && endDate) {
          url += `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
        }
      } else if (weekType) {
        url += `?week=${weekType}`;
      }
      const response = await fetch(url, {
        method: "GET",
        headers: getHeaders(),
      });
      await checkAuth(response);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch weekly non-submissions: ${response.status}`,
        );
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching weekly non-submissions:", error);
      throw error;
    }
  },

  // Manually trigger approved short leave email (1:30 PM report)
  triggerApprovedShortLeaveEmail: async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/trigger/approved-short-leave-email`,
        {
          method: "POST",
          headers: getHeaders(),
        },
      );
      await checkAuth(response);

      // Accept both 200 (success) and 202 (accepted/processing)
      if (!response.ok && response.status !== 202) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to trigger email: ${response.status}`,
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Error triggering approved short leave email:", error);
      throw error;
    }
  },

  // Generate QR Code
  generateQRCode: async (type = "meeting", projectName = "") => {
    try {
      let url = `${API_BASE_URL}/qrcode/generate-qrcode?type=${type}`;
      if (type === "meeting" && projectName) {
        url += `&projectName=${encodeURIComponent(projectName)}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate QR code: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error generating QR code:", error);
      throw error;
    }
  },

  getFaceMeetingPin: async (projectName = "", options = {}) => {
    try {
      const query = new URLSearchParams({
        projectName,
        ...(options.rotate ? { rotate: "true" } : {}),
      }).toString();
      const requestOptions = {
        method: "GET",
        headers: getHeaders(),
      };

      let response = await fetch(
        `${API_BASE_URL}/admin/face-attendance/meeting-pin?${query}`,
        requestOptions,
      );

      if (response.status === 404) {
        response = await fetch(
          `${API_BASE_URL}/face-attendance/meeting-pin?${query}`,
          requestOptions,
        );
      }

      await checkAuth(response);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            `Failed to generate face attendance PIN: ${response.status}`,
        );
      }
      return await response.json();
    } catch (error) {
      console.error("Error generating face attendance PIN:", error);
      throw error;
    }
  },

  stopFaceMeetingPin: async (projectName = "") => {
    try {
      const requestOptions = {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ projectName }),
      };

      let response = await fetch(
        `${API_BASE_URL}/admin/face-attendance/meeting-pin/stop`,
        requestOptions,
      );

      if (response.status === 404) {
        response = await fetch(
          `${API_BASE_URL}/face-attendance/meeting-pin/stop`,
          requestOptions,
        );
      }

      await checkAuth(response);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            `Failed to stop face attendance PIN: ${response.status}`,
        );
      }
      return await response.json();
    } catch (error) {
      console.error("Error stopping face attendance PIN:", error);
      throw error;
    }
  },

  getFaceEnrollmentProfiles: async () => {
    const response = await fetch(
      `${API_BASE_URL}/admin/face-attendance/profiles`,
      {
        method: "GET",
        headers: getHeaders(),
      },
    );

    await checkAuth(response);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to load face enrollment profiles: ${response.status}`,
      );
    }

    return response.json();
  },
};

export { downloadApprovedLeaveReport };

// Helper function to format date as YYYY-MM-DD
// Uses = formula prefix to force Excel to treat it as text and preserve the format
const formatDateForExport = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `="${year}-${month}-${day}"`;
};

// CSV export utility functions
export const csvUtils = {
  // Convert intern report data to CSV
  convertToCSV: (data) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return "";
    }

    // Define CSV headers
    const headers = [
      "Trainee ID",
      "Name",
      "Email",
      "Field of Specialization",
      "Start Date",
      "End Date",
      "Total Records",
      "Last Submission",
      "Days Since Last Submission",
      "Status",
      "Export Date",
    ];

    // Get current date for export timestamp
    const exportDate = formatDateForExport(new Date());

    // Convert data to CSV rows
    const csvRows = [
      headers.join(","), // Header row
      ...data.map((intern) => {
        // Determine detailed status
        let status = "Unknown";
        if (intern.isOverdue) {
          status = "Overdue";
        } else if (intern.totalRecords === 0) {
          status = "NotSubmitted";
        } else {
          status = "Submitted";
        }

        return [
          intern.traineeId || "",
          `"${intern.traineeName || ""}"`,
          intern.email || "",
          `"${intern.fieldOfSpecialization || ""}"`,
          intern.trainingStartDate
            ? formatDateForExport(intern.trainingStartDate)
            : '="Not Set"',
          intern.trainingEndDate
            ? formatDateForExport(intern.trainingEndDate)
            : '="Not Set"',
          intern.totalRecords || 0,
          intern.lastSubmission
            ? formatDateForExport(intern.lastSubmission)
            : '="Never"',
          intern.daysSinceLastSubmission !== null &&
          intern.daysSinceLastSubmission !== undefined
            ? intern.daysSinceLastSubmission
            : "N/A",
          status,
          exportDate,
        ].join(",");
      }),
    ];

    return csvRows.join("\n");
  },

  // Convert weekly non-submissions within week data to CSV (for last 5 working days)
  convertWeeklyNonSubmissionsWithinWeekToCSV: (data) => {
    if (
      !data ||
      !data.nonSubmittedInterns ||
      !Array.isArray(data.nonSubmittedInterns) ||
      data.nonSubmittedInterns.length === 0
    ) {
      return "";
    }

    // Define CSV headers
    const headers = [
      "Trainee ID",
      "Name",
      "Email",
      "Field of Specialization",
      "Institute",
      "Start Date",
      "End Date",
      "Week Period",
      "Status",
      "Export Date",
    ];

    // Get current date for export timestamp
    const exportDate = formatDateForExport(new Date());

    // Extract week period from data - this comes from the API response
    const weekPeriod = data.weekPeriod || "Last 5 Working Days";

    // Sort interns by start date in ascending order
    const sortedInterns = [...data.nonSubmittedInterns].sort((a, b) => {
      const dateA = a.trainingStartDate
        ? new Date(a.trainingStartDate)
        : new Date(0);
      const dateB = b.trainingStartDate
        ? new Date(b.trainingStartDate)
        : new Date(0);
      return dateA - dateB;
    });

    // Convert data to CSV rows
    const csvRows = [
      headers.join(","), // Header row
      ...sortedInterns.map((intern) => {
        return [
          intern.traineeId || "",
          `"${intern.traineeName || ""}"`,
          intern.email || "",
          `"${intern.fieldOfSpecialization || ""}"`,
          `"${intern.institute || "Not Specified"}"`,
          intern.trainingStartDate
            ? formatDateForExport(intern.trainingStartDate)
            : '="Not Set"',
          intern.trainingEndDate
            ? formatDateForExport(intern.trainingEndDate)
            : '="Not Set"',
          `"${weekPeriod}"`,
          intern.status || "Not Submitted Within Week",
          exportDate,
        ].join(",");
      }),
    ];

    return csvRows.join("\n");
  },

  // Download CSV file
  downloadCSV: (csvContent, filename = "intern_report.csv") => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  },

  // Convert overdue interns data to CSV (without Status column)
  convertOverdueInternsToCSV: (data) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return "";
    }

    // Define CSV headers (without Status)
    const headers = [
      "Trainee ID",
      "Name",
      "Email",
      "Field of Specialization",
      "Institute",
      "Start Date",
      "End Date",
      "Total Records",
      "Last Submission",
      "Days Since Last Submission",
      "Export Date",
    ];

    // Get current date for export timestamp
    const exportDate = formatDateForExport(new Date());

    // Convert data to CSV rows
    const csvRows = [
      headers.join(","), // Header row
      ...data.map((intern) => {
        // Calculate days since last submission if not already provided
        let daysSinceLastSubmission = intern.daysSinceLastSubmission;
        if (
          daysSinceLastSubmission === undefined ||
          daysSinceLastSubmission === null
        ) {
          if (intern.lastSubmission) {
            daysSinceLastSubmission = Math.floor(
              (new Date() - new Date(intern.lastSubmission)) /
                (1000 * 60 * 60 * 24),
            );
          } else {
            daysSinceLastSubmission = "N/A";
          }
        }

        // Use totalRecords if available, or calculate it from backend data
        const totalRecords =
          intern.totalRecords !== undefined
            ? intern.totalRecords
            : intern.lastSubmission
              ? "At least 1"
              : "0";

        // Ensure the institute field has a default value if empty
        const institute =
          intern.institute && intern.institute.trim()
            ? intern.institute
            : "Not Specified";

        return [
          intern.traineeId || "",
          `"${intern.traineeName || ""}"`,
          intern.email || "",
          `"${intern.fieldOfSpecialization || ""}"`,
          `"${institute}"`,
          intern.trainingStartDate
            ? formatDateForExport(intern.trainingStartDate)
            : '="Not Set"',
          intern.trainingEndDate
            ? formatDateForExport(intern.trainingEndDate)
            : '="Not Set"',
          totalRecords,
          intern.lastSubmission
            ? formatDateForExport(intern.lastSubmission)
            : '="Never"',
          daysSinceLastSubmission,
          exportDate,
        ].join(",");
      }),
    ];

    return csvRows.join("\n");
  },

  // Convert weekly non-submissions data to CSV
  convertWeeklyNonSubmissionsToCSV: (data) => {
    if (
      !data ||
      !data.nonSubmittedInterns ||
      !Array.isArray(data.nonSubmittedInterns) ||
      data.nonSubmittedInterns.length === 0
    ) {
      return "";
    }

    // Define CSV headers
    const headers = [
      "Trainee ID",
      "Name",
      "Email",
      "Field of Specialization",
      "Institute",
      "Start Date",
      "End Date",
      "Week Period",
      "Status",
      "Export Date",
    ];

    // Get current date for export timestamp
    const exportDate = formatDateForExport(new Date());

    // Extract week period from data - this comes from the API response
    const weekPeriod = data.weekPeriod || "Current Week";

    // Convert data to CSV rows
    const csvRows = [
      headers.join(","), // Header row
      ...data.nonSubmittedInterns.map((intern) => {
        return [
          intern.traineeId || "",
          `"${intern.traineeName || ""}"`,
          intern.email || "",
          `"${intern.fieldOfSpecialization || ""}"`,
          `"${intern.institute || "Not Specified"}"`,
          intern.trainingStartDate
            ? formatDateForExport(intern.trainingStartDate)
            : '="Not Set"',
          intern.trainingEndDate
            ? formatDateForExport(intern.trainingEndDate)
            : '="Not Set"',
          `"${weekPeriod}"`,
          intern.status || "Not Submitted This Week",
          exportDate,
        ].join(",");
      }),
    ];

    return csvRows.join("\n");
  },

  // Generate and download intern report CSV
  downloadInternReport: async (data = null, reportType = "intern_report") => {
    try {
      // Use provided data or fetch all intern data
      const reportData = data || (await adminApi.getInternReport());

      // Use specialized CSV conversion based on report type
      let csvContent;
      if (reportType.startsWith("weekly_non_submissions_within_week")) {
        csvContent =
          csvUtils.convertWeeklyNonSubmissionsWithinWeekToCSV(reportData);
      } else if (reportType === "overdue_interns") {
        csvContent = csvUtils.convertOverdueInternsToCSV(reportData);
      } else if (reportType.startsWith("weekly_non_submissions")) {
        csvContent = csvUtils.convertWeeklyNonSubmissionsToCSV(reportData);
      } else {
        csvContent = csvUtils.convertToCSV(reportData);
      }

      const timestamp = new Date().toISOString().split("T")[0];

      // Generate filename based on report type
      let filename;
      switch (reportType) {
        case "overdue_interns":
          filename = `overdue_interns_${timestamp}.csv`;
          break;
        case "submitted_interns":
          filename = `submitted_interns_${timestamp}.csv`;
          break;
        case "search_results":
          filename = `search_results_${timestamp}.csv`;
          break;
        default:
          // Handle special report types with custom filenames
          if (reportType.startsWith("weekly_non_submissions_within_week_")) {
            filename = `${reportType}.csv`;
          } else if (reportType.startsWith("weekly_non_submissions_")) {
            filename = `${reportType}.csv`;
          } else {
            filename = `intern_report_${timestamp}.csv`;
          }
      }

      csvUtils.downloadCSV(csvContent, filename);
      return { success: true, filename };
    } catch (error) {
      console.error("Error generating CSV report:", error);
      throw error;
    }
  },
};

// Notification utilities
export const notificationUtils = {
  // Show success notification
  showSuccess: (message) => {
    // You can integrate with a toast library here
    alert(`Success: ${message}`);
  },

  // Show error notification
  showError: (message) => {
    // You can integrate with a toast library here
    alert(`Error: ${message}`);
  },

  // Show info notification
  showInfo: (message) => {
    // You can integrate with a toast library here
    alert(`Info: ${message}`);
  },
};

// Announcement API
export const announcementApi = {
  // GET /api/admin/announcements
  getAll: async () => {
    const res = await fetch(`${API_BASE_URL}/admin/announcements`, {
      method: "GET",
      headers: getHeaders(),
    });
    await checkAuth(res);
    if (!res.ok)
      throw new Error(`Failed to fetch announcements: ${res.status}`);
    return res.json();
  },

  // POST /api/admin/announcements
  create: async (payload) => {
    const res = await fetch(`${API_BASE_URL}/admin/announcements`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    await checkAuth(res);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.message || `Failed to create announcement: ${res.status}`,
      );
    }
    return res.json();
  },

  // DELETE /api/admin/announcements/:id
  delete: async (id) => {
    const res = await fetch(`${API_BASE_URL}/admin/announcements/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    await checkAuth(res);
    if (!res.ok)
      throw new Error(`Failed to delete announcement: ${res.status}`);
    return res.json();
  },
};

// Feature Tip API (Admin)
export const featureTipAdminApi = {
  getAll: async () => {
    const res = await fetch(`${API_BASE_URL}/admin/feature-tips`, {
      method: "GET",
      headers: getHeaders(),
    });
    await checkAuth(res);
    if (!res.ok) throw new Error(`Failed to fetch feature tips: ${res.status}`);
    return res.json();
  },

  create: async (payload) => {
    const res = await fetch(`${API_BASE_URL}/admin/feature-tips`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    await checkAuth(res);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.message || `Failed to create feature tip: ${res.status}`,
      );
    }
    return res.json();
  },

  toggle: async (id) => {
    const res = await fetch(`${API_BASE_URL}/admin/feature-tips/${id}/toggle`, {
      method: "PATCH",
      headers: getHeaders(),
    });
    await checkAuth(res);
    if (!res.ok) throw new Error(`Failed to toggle feature tip: ${res.status}`);
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_BASE_URL}/admin/feature-tips/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    await checkAuth(res);
    if (!res.ok) throw new Error(`Failed to delete feature tip: ${res.status}`);
    return res.json();
  },
};
