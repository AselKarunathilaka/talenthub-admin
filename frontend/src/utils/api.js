// src/utils/api.js
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

const getAuthToken = () => {
  const adminInfo = localStorage.getItem('adminInfo');
  if (adminInfo) {
    try {
      const parsed = JSON.parse(adminInfo);
      if (parsed.token) {
        return parsed.token;
      }
    } catch (error) {
      console.error('Error parsing adminInfo:', error);
    }
  }

  const authToken = localStorage.getItem('authToken');
  if (authToken) return authToken;

  const userData = localStorage.getItem('userData');
  if (userData) {
    try {
      const parsed = JSON.parse(userData);
      if (parsed.token) return parsed.token;
    } catch (error) {
      console.error('Error parsing userData:', error);
    }
  }

  return null;
};

const createHeaders = (isJson = true) => {
  const token = getAuthToken();
  const headers = {
    ...(isJson && { 'Content-Type': 'application/json' }),
    ...(token && { Authorization: `Bearer ${token}` }),
  };
  return headers;
};

export const api = {
  get: async (endpoint) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: createHeaders(),
    });
    return res.json();
  },

  post: async (endpoint, data) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  put: async (endpoint, data) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: createHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  delete: async (endpoint) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: createHeaders(),
    });
    return res.json();
  },
};
