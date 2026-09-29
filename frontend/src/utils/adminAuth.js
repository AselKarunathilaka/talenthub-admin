export const getAdminSession = () => {
  try { return JSON.parse(localStorage.getItem("adminInfo") || "null"); }
  catch { return null; }
};

export const hasAdminPermission = (permission) => {
  const user = getAdminSession()?.user;
  if (!user) return false;
  const role = user?.role;
  if (role === "super_admin" || role === "super_admin_plus" || role === "PM" || role === "pm") return true;
  if (user?.permissions?.includes(permission)) return true;
  if ((permission === "settings.manage" || permission === "users.manage") && user?.visiblePages?.includes("Settings")) return true;
  // Fallback for admin, developer, BA, QA roles if permissions array is missing in session
  if (["admin", "developer", "BA", "QA", "ba", "qa"].includes(role)) {
    if (permission === "settings.manage" || permission === "users.manage") {
      return user?.visiblePages?.includes("Settings") || false;
    }
    return true;
  }
  return false;
};

export const formatRole = (role) => {
  if (!role || typeof role !== "string") return "";

  const trimmed = role.trim();
  const normalized = trimmed.toLowerCase().replace(/_/g, " ");

  const roleMap = {
    "pm": "Project Manager",
    "project manager": "Project Manager",
    "ba": "Business Analyst",
    "business analyst": "Business Analyst",
    "qa": "Quality Assurance",
    "quality assurance": "Quality Assurance",
    "super admin plus": "Super Admin Plus",
    "super admin": "Super Admin",
    "admin": "Admin",
    "developer": "Developer",
    "supervisor": "Supervisor",
    "gatestaff": "Gate Staff",
    "gate staff": "Gate Staff",
    "intern": "Intern",
  };

  if (roleMap[normalized]) {
    return roleMap[normalized];
  }

  // Fallback: replace all underscores with spaces and capitalize words properly
  return trimmed
    .replace(/_/g, " ")
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (roleMap[lower]) return roleMap[lower];
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
};
