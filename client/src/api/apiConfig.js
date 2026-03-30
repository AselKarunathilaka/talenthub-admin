import axios from "axios";

export const backendUrl = import.meta.env.VITE_BACKEND_URL;

const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const { exp } = JSON.parse(atob(token.split('.')[1])); 
    return exp * 1000 < Date.now();
  } catch (error) {
    console.error("Invalid token format:", error);
    return true;
  }
};

const redirectToLogin = () => {
  console.warn("⚠ Token expired or missing. Redirecting to login.");
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
