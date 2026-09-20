// API Configuration
export const API_BASE_URL = (
  import.meta.env.VITE_BACKEND_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

// API endpoints
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    GOOGLE_LOGIN: "/auth/google-login",
    ADMIN_LOGIN: "/auth/login",
    ADMIN_GOOGLE_LOGIN: "/auth/admin-google-login",
    INTERN_LOGIN: "/auth/intern-login",
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
    SETTINGS: {
      SECURITY_PASSWORD: "/admin/settings/security-password",
      USERS: "/admin/settings/users",
      WHATSAPP_STATUS: "/admin/settings/whatsapp-status",
      WHATSAPP_DISCONNECT: "/admin/settings/whatsapp-disconnect",
      WHATSAPP_LINK: "/admin/settings/whatsapp-link",
      TOGGLES: "/admin/settings/toggles",
      SECURITY_ALERTS: "/admin/settings/security-alerts",
      SPECIALIZATIONS: "/admin/settings/specializations",
      API_KEYS: "/admin/settings/api-keys",
      VERIFY_SECURITY: "/admin/attendance/verify-security",
    },
  },
};

// Request configuration
export const API_CONFIG = {
  timeout: 30000, // 30 seconds
  headers: {
    "Content-Type": "application/json",
  },
};
