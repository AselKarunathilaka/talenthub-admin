export const getAdminSession = () => {
  try { return JSON.parse(localStorage.getItem("adminInfo") || "null"); }
  catch { return null; }
};

export const hasAdminPermission = (permission) => {
  const user = getAdminSession()?.user;
  return user?.role === "super_admin" || user?.role === "PM" || user?.role === "pm" || user?.permissions?.includes(permission);
};
