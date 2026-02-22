import { API_BASE_URL } from "./apiConfig";

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

      if (!response.ok) {
        throw new Error(`Failed to fetch intern details: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching intern details:", error);
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

  // Send notifications to overdue interns
  sendOverdueNotifications: async (overdueInterns) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/notifications/overdue`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ overdueInterns }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to send notifications: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error sending notifications:", error);
      throw error;
    }
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
