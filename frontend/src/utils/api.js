// src/utils/api.js
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

export const api = {
  get: async (endpoint) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`);
    return res.json();
  },

  post: async (endpoint, data) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    
    const jsonResponse = await res.json();
    
    // If response is not ok, throw error with response data
    if (!res.ok) {
      const error = new Error(jsonResponse.message || 'API request failed');
      error.response = { data: jsonResponse };
      throw error;
    }
    
    return jsonResponse;
  },

  put: async (endpoint, data) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  delete: async (endpoint) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "DELETE",
    });
    return res.json();
  },
};
