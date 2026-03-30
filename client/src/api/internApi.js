import { api, backendUrl, getAuthHeaders } from "./apiConfig";

const INTERN_API_URL = "/interns";
const UPLOAD_API_URL = "/upload";

const handleAuthError = (error) => {
  if (error.response?.status === 401) {
    console.error("Unauthorized Access! Redirecting to login...");
    localStorage.removeItem("token");
    window.location.href = "/login";
    return null;
  }
  console.error("API Error:", error.response?.data?.message || error.message);
  return null;
};

export const fetchInterns = async (date) => {
  try {

    // Append the date query parameter if provided
    const url = date ? `${INTERN_API_URL}?date=${date}` : INTERN_API_URL;
    const response = await api.get(url, getAuthHeaders());
    return response.data;
  } catch (error) {
    return handleAuthError(error);
  }
};

export const fetchAttendanceStats = async (date) => {
  try {
    const url = date
      ? `${INTERN_API_URL}/attendance-stats?date=${date}`
      : `${INTERN_API_URL}/attendance-stats`;
    const response = await api.get(url, getAuthHeaders());
    return response.data;
  } catch (error) {
    return handleAuthError(error);
  }
};

export const fetchInternById = async (internId) => {
  try {
    const response = await api.get(
      `${INTERN_API_URL}/${internId}`,
      getAuthHeaders()
    );
    return response.data;
  } catch (error) {
    return handleAuthError(error);
  }
};

// UPDATED: Mark attendance now uses the new route (/interns/mark-attendance)
// The request body will include internId, status, date, type, and timeMarked.
export const markAttendance = async (internId, status, date, type = 'manual', timeMarked = null) => {
  try {
    const response = await api.post(
      `${INTERN_API_URL}/mark-attendance`,
      { 
        internId, 
        status, 
        date, 
        type, 
        timeMarked: timeMarked || new Date().toISOString() 
      },
      getAuthHeaders()
    );
    return response.data;
  } catch (error) {
    return handleAuthError(error);
  }
};

export const uploadInternsFile = async (file) => {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const authHeaders = getAuthHeaders();
    const response = await api.post(UPLOAD_API_URL, formData, {
      headers: {
        ...authHeaders.headers,
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  } catch (error) {
    return handleAuthError(error);
  }
};

export const deleteIntern = async (internId) => {
  try {
    const response = await api.delete(
      `${INTERN_API_URL}/${internId}`,
      getAuthHeaders()
    );
    return response.data;
  } catch (error) {
    return handleAuthError(error);
  }
};

export const updateIntern = async (internId, internData) => {
  try {
    const response = await api.put(
      `${INTERN_API_URL}/${internId}`,
      internData,
      getAuthHeaders()
    );
    return response.data;
  } catch (error) {
    return handleAuthError(error);
  }
};

export const fetchAttendanceHistory = async (internId) => {
  try {
    const response = await api.get(
      `${INTERN_API_URL}/attendance-history/${internId}`,
      getAuthHeaders()
    );
    return response.data;
  } catch (error) {
    return handleAuthError(error);
  }
};

export const markBulkAttendance = async (attendanceData) => {
  try {
    const response = await api.post(
      `${INTERN_API_URL}/attendance/bulk-mark`,
      attendanceData,
      getAuthHeaders()
    );
    return response.data;
  } catch (error) {
    return handleAuthError(error);
  }
};

export const fetchAttendanceStatsForToday = async () => {
  try {
    const response = await api.get(
      `${INTERN_API_URL}/attendance-stats-today`,
      getAuthHeaders()
    );
    return response.data;
  } catch (error) {
    return handleAuthError(error);
  }
};

export const fetchAttendanceStatsByType = async (type = null) => {
  try {
    const url = type 
      ? `${INTERN_API_URL}/attendance-stats-by-type?type=${type}`
      : `${INTERN_API_URL}/attendance-stats-by-type`;
    const response = await api.get(url, getAuthHeaders());
    return response.data;
  } catch (error) {
    return handleAuthError(error);
  }
};

export const fetchTodayAttendanceByType = async (type = null) => {
  try {
    const url = type 
      ? `${INTERN_API_URL}/today-attendance-by-type?type=${type}`
      : `${INTERN_API_URL}/today-attendance-by-type`;
    const response = await api.get(url, getAuthHeaders());
    return response.data;
  } catch (error) {
    return handleAuthError(error);
  }
};


