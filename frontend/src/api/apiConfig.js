// API Configuration
export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

// API endpoints
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    GOOGLE_LOGIN: "/auth/google-login",
    ADMIN_LOGIN: "/auth/login",
    GateStaff_LOGIN: "/auth/gate-staff-login",
    LOGOUT: "/auth/logout",
  },

  // Intern endpoints
  INTERNS: {
    LIST: "/interns",
    SEARCH: "/interns/search",
    DETAILS: "/interns",
  },

  // Daily records endpoints
  RECORDS: {
    LIST: "/records",
    CREATE: "/records",
    UPDATE: "/records",
    DELETE: "/records",
    EXPORT_PDF: "/records/export/pdf",
    EXPORT_TEMPLATES: "/records/export/templates",
    VALIDATE: "/records/validate-entry",
    VALIDATE_BATCH: "/records/validate-batch",
  },

  // Admin endpoints
  ADMIN: {
    DASHBOARD_STATS: "/admin/dashboard/stats",
    INTERN_REPORT: "/admin/report/interns",
    SEND_NOTIFICATIONS: "/admin/notifications/overdue",
    INTERN_DETAILS: "/admin/intern",
  },
};

// Request configuration
export const API_CONFIG = {
  timeout: 30000, // 30 seconds
  headers: {
    "Content-Type": "application/json",
  },
};
