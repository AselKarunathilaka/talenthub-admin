import { api, getAuthHeaders } from "./apiConfig";

// Define the base URL for the project API
const PROJECT_API_URL = "/projects"; 

// Handle errors
const handleApiError = (error) => {
  if (error.response?.status === 401) {
    console.error("Unauthorized Access! Redirecting to login...");
    localStorage.removeItem("token");
    window.location.href = "/login";
    return null;
  }
  console.error("API Error:", error.response?.data?.message || error.message);
  return null;
};

// Fetch project details by project ID
const fetchProjectDetails = async (projectId) => {
  try {
    const response = await api.get(`${PROJECT_API_URL}/${projectId}`, getAuthHeaders());
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

// Update project start and end dates
const updateProjectDates = async (projectId, startDate, endDate) => {
  try {
    const response = await api.put(`${PROJECT_API_URL}/${projectId}/update-dates`, 
      { startDate, endDate },
      getAuthHeaders());
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

// Add a task to the project
const addTaskToProject = async (projectId, taskData) => {
  try {
    const response = await api.post(`${PROJECT_API_URL}/${projectId}/add-task`, taskData, getAuthHeaders());
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

// Update task progress
const updateTaskProgress = async (projectId, taskId, status) => {
  try {
    const response = await api.put(`${PROJECT_API_URL}/${projectId}/update-task`, 
      { taskId, status },
      getAuthHeaders());
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

// Add milestone to the project
const addMilestoneToProject = async (projectId, milestoneData) => {
  try {
    const response = await api.post(`${PROJECT_API_URL}/${projectId}/add-milestone`, milestoneData, getAuthHeaders());
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

// Update milestone status
const updateMilestoneStatus = async (projectId, milestoneId, status) => {
  try {
    const response = await api.put(`${PROJECT_API_URL}/${projectId}/update-milestone`, 
      { milestoneId, status },
      getAuthHeaders());
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

// Add feedback to the project
const addFeedbackToProject = async (projectId, feedbackData) => {
  try {
    const response = await api.post(`${PROJECT_API_URL}/${projectId}/add-feedback`, feedbackData, getAuthHeaders());
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

// Add note to the project
const addNoteToProject = async (projectId, noteData) => {
  try {
    const response = await api.post(`${PROJECT_API_URL}/${projectId}/add-note`, noteData, getAuthHeaders());
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

// Export all functions collectively, ensuring no duplication
export {
  fetchProjectDetails,
  updateProjectDates,
  addTaskToProject,
  updateTaskProgress,
  addMilestoneToProject,
  updateMilestoneStatus,
  addFeedbackToProject,
  addNoteToProject
};
