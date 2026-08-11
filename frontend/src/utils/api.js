// src/utils/api.js
import { handleUnauthorized } from "./sessionUtils";

export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

export const getAuthToken = () => {
  // Prefer intern token first — most API calls need intern identity.
  // Admin pages use their own adminApi helper which reads adminInfo directly.
  const authToken = localStorage.getItem("authToken");
  if (authToken) return authToken;

  const adminInfo = localStorage.getItem("adminInfo");
  if (adminInfo) {
    try {
      const parsed = JSON.parse(adminInfo);
      if (parsed.token) return parsed.token;
    } catch (error) {
      console.error("Error parsing adminInfo:", error);
    }
  }

  const userData = localStorage.getItem("userData");
  if (userData) {
    try {
      const parsed = JSON.parse(userData);
      if (parsed.token) return parsed.token;
    } catch (error) {
      console.error("Error parsing userData:", error);
    }
  }

  return null;
};

export const createHeaders = (isJson = true) => {
  const token = getAuthToken();
  return {
    ...(isJson && { "Content-Type": "application/json" }),
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

const checkAuth = async (res, endpoint) => {
  if (res.status === 401) {
    // Don't trigger global logout/reload for authentication endpoints
    if (endpoint && endpoint.includes("/auth/")) {
      return res;
    }

    // Try to read the error code from the response body
    let code = "";
    try {
      const clone = res.clone();
      const body = await clone.json();
      code = body.code || "";
    } catch {
      code = "";
    }

    const message =
      code === "TOKEN_EXPIRED"
        ? "Your session has expired. Please log in again."
        : "Your session is invalid. Please log in again using your organization registered email.";

    handleUnauthorized(message);
    // Throw so the calling code doesn't try to parse the response
    throw new Error(message);
  }
  return res;
};

const handleResponse = async (res) => {
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || errData.error || "Request failed");
  }
  return res.json();
};

export const apiFetch = async (endpoint, options = {}) => {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...createHeaders(!isFormData),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  await checkAuth(res);
  return res;
};

export const api = {
  get: async (endpoint) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: createHeaders(),
    });
    await checkAuth(res, endpoint);
    return handleResponse(res);
  },

  post: async (endpoint, data) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: createHeaders(),
      body: JSON.stringify(data),
    });
    await checkAuth(res, endpoint);
    return handleResponse(res);
  },

  put: async (endpoint, data) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "PUT",
      headers: createHeaders(),
      body: JSON.stringify(data),
    });
    await checkAuth(res, endpoint);
    return handleResponse(res);
  },

  patch: async (endpoint, data) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "PATCH",
      headers: createHeaders(),
      body: JSON.stringify(data),
    });
    await checkAuth(res, endpoint);
    return handleResponse(res);
  },

  delete: async (endpoint) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "DELETE",
      headers: createHeaders(),
    });
    await checkAuth(res, endpoint);
    return handleResponse(res);
  },
};
