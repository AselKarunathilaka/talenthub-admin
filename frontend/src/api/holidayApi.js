import { API_BASE_URL } from "./apiConfig";
import { handleUnauthorized } from "../utils/sessionUtils";

const BASE = `${API_BASE_URL}/admin/holidays`;

const getAuthToken = () => {
  const adminInfo = localStorage.getItem("adminInfo");
  if (adminInfo) return JSON.parse(adminInfo).token;
  const userData = localStorage.getItem("userData");
  if (userData) return JSON.parse(userData).token;
  return null;
};

const request = async (path, { method = "GET", body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAuthToken()}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) {
    handleUnauthorized("Your session has expired. Please log in again.");
    throw new Error("Session expired");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || `Request failed (${res.status})`);
  }
  return data;
};

export const holidayApi = {
  getOverview: () => request("/overview"),
  getYear: (year) => request(`/${year}`),
  create: (holiday) => request("", { method: "POST", body: holiday }),
  update: (id, changes) => request(`/${id}`, { method: "PUT", body: changes }),
  remove: (id) => request(`/${id}`, { method: "DELETE" }),
  sync: (year) => request(`/${year}/sync`, { method: "POST" }),
  verify: (year) => request(`/${year}/verify`, { method: "POST" }),
  unverify: (year) => request(`/${year}/verify`, { method: "DELETE" }),
};

export default holidayApi;
