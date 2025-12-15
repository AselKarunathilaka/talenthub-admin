import axios from 'axios';
import { API_BASE_URL } from './apiConfig';

// Get auth token from localStorage
const getAuthToken = () => {
  // Prefer intern auth token since leave requests are intern-only
  const authToken = localStorage.getItem('authToken');
  if (authToken) {
    console.log('Leave Request API - Using intern token');
    return authToken;
  }

  // Fall back to admin token (if this endpoint is ever used by admins)
  const adminInfo = localStorage.getItem('adminInfo');
  if (adminInfo) {
    try {
      const parsed = JSON.parse(adminInfo);
      if (parsed.token) {
        console.log('Leave Request API - Using admin token fallback');
        return parsed.token;
      }
    } catch (e) {
      console.error('Error parsing adminInfo:', e);
    }
  }
  
  // Fall back to userData
  const userData = localStorage.getItem('userData');
  if (userData) {
    try {
      const parsed = JSON.parse(userData);
      if (parsed.token) {
        console.log('Leave Request API - Using userData token');
        return parsed.token;
      }
    } catch (e) {
      console.error('Error parsing userData:', e);
    }
  }
  
  console.log('Leave Request API - No token found');
  return null;
};

// Create API headers
const getHeaders = (isFormData = false) => {
  const token = getAuthToken();
  console.log('Leave Request API - Token:', token ? 'Found' : 'Not found');
  console.log('Leave Request API - Full token:', token ? token.substring(0, 20) + '...' : 'null');
  const headers = {
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
  
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  
  console.log('Leave Request API - Headers:', headers);
  return headers;
};

// Create a new leave request
export const createLeaveRequest = async (formData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/leave-requests`, formData, {
      headers: getHeaders(true), // true for form data
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Get my leave requests (for interns)
export const getMyLeaveRequests = async (params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/leave-requests/my-requests`, {
      params,
      headers: getHeaders()
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Get all leave requests (for admins)
export const getAllLeaveRequests = async (params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/leave-requests/all`, {
      params,
      headers: getHeaders()
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
      headers: getHeaders()
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Update leave request status (admin only)
export const updateLeaveRequestStatus = async (id, statusData) => {
  try {
    const response = await axios.patch(`${API_BASE_URL}/leave-requests/${id}/status`, statusData, {
      headers: getHeaders()
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Delete leave request
export const deleteLeaveRequest = async (id) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/leave-requests/${id}`, {
      headers: getHeaders()
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Get leave request statistics (admin only)
export const getLeaveRequestStats = async (params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/leave-requests/stats`, {
      params,
      headers: getHeaders()
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
