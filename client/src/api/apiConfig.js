import axios from "axios";

const rawBackendUrl =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5001/api";

export const backendUrl = rawBackendUrl.replace(/\/+$/, "");

const isTokenExpired = (token) => {
  if (!token) return true;

  try {
    const { exp } = JSON.parse(atob(token.split(".")[1]));
    return exp * 1000 < Date.now();
  } catch (error) {
    console.error("Invalid token format:", error);
    return true;
  }
};

const redirectToLogin = () => {
  console.warn("Token expired or missing. Redirecting to login.");
  localStorage.removeItem("token");
  window.location.href = "/login";
};

export const api = axios.create({
  baseURL: backendUrl,
});

export const getAuthHeaders = () => {
  const token = localStorage.getItem("token");

  if (!token || isTokenExpired(token)) {
    redirectToLogin();
    return {};
  }

  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};