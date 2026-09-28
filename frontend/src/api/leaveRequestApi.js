import axios from "axios";
import { API_BASE_URL } from "./apiConfig";
import { handleUnauthorized } from "../utils/sessionUtils";


axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const code = error.response?.data?.code || "";
      const msg = code === "TOKEN_EXPIRED"
        ? "Your session has expired. Please log in again."
        : "Your session is invalid. Please log in again.";
      handleUnauthorized(msg);
    }
    return Promise.reject(error);
  }
);



// Get auth token from localStorage
const getAuthToken = () => {
  // Check current path to determine which token to use
  const currentPath = window.location.pathname;

  // If we're on admin pages, use admin token FIRST
  if (currentPath.includes("/admin/") || currentPath.includes("admin-")) {
    const adminInfo = localStorage.getItem("adminInfo");
    if (adminInfo) {
      try {
        const parsed = JSON.parse(adminInfo);
        if (parsed.token) {
          console.log(
            "Leave Request API - Admin page detected, using admin token",
          );
          return parsed.token;
        }
      } catch (e) {
        console.error("Error parsing adminInfo:", e);
      }
    }
  }

  // For all other cases, use intern token first
  const authToken = localStorage.getItem("authToken");
  if (authToken) {
    console.log("Leave Request API - Using intern token");
    return authToken;
  }

  // Fall back to admin token (for edge cases)
  const adminInfo = localStorage.getItem("adminInfo");
  if (adminInfo) {
    try {
      const parsed = JSON.parse(adminInfo);
      if (parsed.token) {
        console.log("Leave Request API - Using admin token as fallback");
        return parsed.token;
      }
    } catch (e) {
      console.error("Error parsing adminInfo:", e);
    }
  }

  console.log("Leave Request API - No token found");
  return null;
};

// Create API headers
const getHeaders = (isFormData = false) => {
  const token = getAuthToken();
  console.log("Leave Request API - Token:", token ? "Found" : "Not found");
  console.log(
    "Leave Request API - Full token:",
    token ? token.substring(0, 20) + "..." : "null",
  );
  const headers = {
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  console.log("Leave Request API - Headers:", headers);
  return headers;
};

// Create a new leave request
export const createLeaveRequest = async (formData) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/leave-requests`,
      formData,
      {
        headers: getHeaders(true), // true for form data
      },
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Get my leave requests (for interns)
export const getMyLeaveRequests = async (params = {}) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/leave-requests/my-requests`,
      {
        params,
        headers: getHeaders(),
      },
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Get leave requests for a specific intern (admin preview mode)
export const getLeaveRequestsByInternId = async (internId, page = 1, limit = 10, type) => {
  try {
    const params = { page, limit };
    if (type) params.type = type;
    const response = await axios.get(
      `${API_BASE_URL}/leave-requests/admin/intern/${internId}`,
      { params, headers: getHeaders() },
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getAllLeaveRequests = async (params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/leave-requests/all`, {
      params,
      headers: getHeaders(),
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Get leave request by ID
export const getLeaveRequestById = async (id) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/leave-requests/${id}`, {
      headers: getHeaders(),
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Update leave request status (admin only)
export const updateLeaveRequestStatus = async (id, statusData) => {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/leave-requests/${id}/status`,
      statusData,
      {
        headers: getHeaders(),
      },
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Bulk update leave request status (admin only)
export const bulkUpdateLeaveRequestStatus = async (requestIds, statusData) => {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/leave-requests/bulk/status`,
      {
        requestIds,
        ...statusData,
      },
      {
        headers: getHeaders(),
      },
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Delete leave request
export const deleteLeaveRequest = async (id) => {
  try {
    const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
    const adminInfo = typeof localStorage !== "undefined" ? localStorage.getItem("adminInfo") : null;
    let isAdmin = false;
    if (adminInfo) {
      try {
        const parsed = JSON.parse(adminInfo);
        if (parsed?.token) isAdmin = true;
      } catch (e) {
        // ignore
      }
    }
    if (currentPath.includes("/admin/") || currentPath.includes("admin-")) {
      isAdmin = true;
    }

    const endpoint = isAdmin
      ? `${API_BASE_URL}/leave-requests/admin/${id}`
      : `${API_BASE_URL}/leave-requests/${id}`;

    const response = await axios.delete(endpoint, {
      headers: getHeaders(),
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 403 || error.response?.status === 401) {
      try {
        const fallbackRes = await axios.delete(`${API_BASE_URL}/leave-requests/${id}`, {
          headers: getHeaders(),
        });
        return fallbackRes.data;
      } catch (fallbackErr) {
        throw fallbackErr.response?.data || fallbackErr;
      }
    }
    throw error.response?.data || error;
  }
};

// Get leave request statistics (admin only)
export const getLeaveRequestStats = async (params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/leave-requests/stats`, {
      params,
      headers: getHeaders(),
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Validate a leave pass by token (no auth required — public endpoint for gate staff)
export const validateLeavePass = async (token) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/leave-requests/pass/validate/${token}`,
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Mark a leave pass as used by token (no auth required — public endpoint for gate staff)
export const markPassAsUsed = async (token) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/leave-requests/pass/mark-used/${token}`,
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
