import { API_BASE_URL } from './apiConfig';

// Get auth token from localStorage
const getAuthToken = () => {
  // Try to get admin token first, then fall back to regular user token
  const adminInfo = localStorage.getItem('adminInfo');
  if (adminInfo) {
    const parsed = JSON.parse(adminInfo);
    return parsed.token;
  }
  
  const userData = localStorage.getItem('userData');
  if (userData) {
    const parsed = JSON.parse(userData);
    return parsed.token;
  }
  
  return null;
};

// Create API headers
const getHeaders = () => {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

// Admin API functions
export const adminApi = {
  // Download on-leave interns Excel
  downloadOnLeaveExcel: async () => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/admin/on-leave/export`, {
      method: 'GET',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    });
    if (!response.ok) throw new Error('Failed to download on-leave Excel');
    return response.blob();
  },
  // Get dashboard statistics
  getDashboardStats: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/dashboard/stats`, {
        method: 'GET',
        headers: getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard stats: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  },

  // Get intern report for CSV export
  getInternReport: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/report/interns`, {
        method: 'GET',
        headers: getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch intern report: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching intern report:', error);
      throw error;
    }
  },

  // Send notifications to overdue interns
  sendOverdueNotifications: async (overdueInterns) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/notifications/overdue`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ overdueInterns })
      });

      if (!response.ok) {
        throw new Error(`Failed to send notifications: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending notifications:', error);
      throw error;
    }
  },

  // Get individual intern details
  getInternDetails: async (internId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/intern/${internId}`, {
        method: 'GET',
        headers: getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch intern details: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching intern details:', error);
      throw error;
    }
  },

  // Get individual intern details with records
  getInternDetails: async (internId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/intern/${internId}`, {
        method: 'GET',
        headers: getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch intern details: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching intern details:', error);
      throw error;
    }
  },

  // Search interns by trainee ID or name
  searchInterns: async (query) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/search/interns?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to search interns: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error searching interns:', error);
      throw error;
    }
  },

  // Get all intern report data (for exports)
  getInternReport: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/report/interns`, {
        method: 'GET',
        headers: getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch intern report: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching intern report:', error);
      throw error;
    }
  },

  // Get all daily records
  getAllDailyRecords: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/daily-records`, {
        method: 'GET',
        headers: getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch daily records: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching daily records:', error);
      throw error;
    }
  },

  // Get previous day submissions
  getPreviousDaySubmissions: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/previous-day-submissions`, {
        method: 'GET',
        headers: getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch previous day submissions: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching previous day submissions:', error);
      throw error;
    }
  }
};

// CSV export utility functions
export const csvUtils = {
  // Convert intern report data to CSV
  convertToCSV: (data) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return '';
    }

    // Define CSV headers
    const headers = [
      'Trainee ID',
      'Name',
      'Email',
      'Field of Specialization',
      'Start Date',
      'End Date',
      'Total Records',
      'Last Submission',
      'Days Since Last Submission',
      'Status',
      'Export Date'
    ];

    // Get current date for export timestamp
    const exportDate = new Date().toLocaleDateString();

    // Convert data to CSV rows
    const csvRows = [
      headers.join(','), // Header row
      ...data.map(intern => {
        // Determine detailed status
        let status = 'Unknown';
        if (intern.isOverdue) {
          status = 'Overdue';
        } else if (intern.totalRecords === 0) {
          status = 'NotSubmitted';
        } else {
          status = 'Submitted';
        }

        return [
          intern.traineeId || '',
          `"${intern.traineeName || ''}"`,
          intern.email || '',
          `"${intern.fieldOfSpecialization || ''}"`,
          intern.trainingStartDate ? new Date(intern.trainingStartDate).toLocaleDateString() : 'Not Set',
          intern.trainingEndDate ? new Date(intern.trainingEndDate).toLocaleDateString() : 'Not Set',
          intern.totalRecords || 0,
          intern.lastSubmission ? new Date(intern.lastSubmission).toLocaleDateString() : 'Never',
          intern.daysSinceLastSubmission !== null && intern.daysSinceLastSubmission !== undefined ? intern.daysSinceLastSubmission : 'N/A',
          status,
          exportDate
        ].join(',');
      })
    ];

    return csvRows.join('\n');
  },

  // Convert previous day submissions data to CSV (without Total Records field)
  convertPreviousDayToCSV: (data) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return '';
    }

    // Define CSV headers (without Total Records)
    const headers = [
      'Trainee ID',
      'Name',
      'Email',
      'Field of Specialization',
      'Start Date',
      'End Date',
      'Last Submission',
      'Days Since Last Submission',
      'Status',
      'Export Date'
    ];

    // Get current date for export timestamp
    const exportDate = new Date().toLocaleDateString();

    // Convert data to CSV rows
    const csvRows = [
      headers.join(','), // Header row
      ...data.map(intern => {
        // Determine detailed status
        let status = 'Unknown';
        if (intern.isOverdue) {
          status = 'Overdue';
        } else if (intern.totalRecords === 0) {
          status = 'NotSubmitted';
        } else {
          status = 'Submitted';
        }

        return [
          intern.traineeId || '',
          `"${intern.traineeName || ''}"`,
          intern.email || '',
          `"${intern.fieldOfSpecialization || ''}"`,
          intern.trainingStartDate ? new Date(intern.trainingStartDate).toLocaleDateString() : 'Not Set',
          intern.trainingEndDate ? new Date(intern.trainingEndDate).toLocaleDateString() : 'Not Set',
          intern.lastSubmission ? new Date(intern.lastSubmission).toLocaleDateString() : 'Never',
          intern.daysSinceLastSubmission !== null && intern.daysSinceLastSubmission !== undefined ? intern.daysSinceLastSubmission : 'N/A',
          status,
          exportDate
        ].join(',');
      })
    ];

    return csvRows.join('\n');
  },

  // Download CSV file
  downloadCSV: (csvContent, filename = 'intern_report.csv') => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  },

  // Convert overdue interns data to CSV (without Status column)
  convertOverdueInternsToCSV: (data) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return '';
    }

    // Define CSV headers (without Status)
    const headers = [
      'Trainee ID',
      'Name',
      'Email',
      'Field of Specialization',
      'Start Date',
      'End Date',
      'Total Records',
      'Last Submission',
      'Days Since Last Submission',
      'Export Date'
    ];

    // Get current date for export timestamp
    const exportDate = new Date().toLocaleDateString();

    // Convert data to CSV rows
    const csvRows = [
      headers.join(','), // Header row
      ...data.map(intern => {
        // Calculate days since last submission if not already provided
        let daysSinceLastSubmission = intern.daysSinceLastSubmission;
        if (daysSinceLastSubmission === undefined || daysSinceLastSubmission === null) {
          if (intern.lastSubmission) {
            daysSinceLastSubmission = Math.floor(
              (new Date() - new Date(intern.lastSubmission)) / (1000 * 60 * 60 * 24)
            );
          } else {
            daysSinceLastSubmission = "N/A";
          }
        }

        // Use totalRecords if available, or calculate it from backend data
        // For overdueList from dashboard stats, there's no totalRecords property
        // but we can check if the intern is in the overdue list which indicates they 
        // haven't submitted recently
        const totalRecords = intern.totalRecords !== undefined ? intern.totalRecords : 
                            (intern.lastSubmission ? "At least 1" : "0");

        return [
          intern.traineeId || '',
          `"${intern.traineeName || ''}"`,
          intern.email || '',
          `"${intern.fieldOfSpecialization || ''}"`,
          intern.trainingStartDate ? new Date(intern.trainingStartDate).toLocaleDateString() : 'Not Set',
          intern.trainingEndDate ? new Date(intern.trainingEndDate).toLocaleDateString() : 'Not Set',
          totalRecords,
          intern.lastSubmission ? new Date(intern.lastSubmission).toLocaleDateString() : 'Never',
          daysSinceLastSubmission,
          exportDate
        ].join(',');
      })
    ];

    return csvRows.join('\n');
  },

  // Generate and download intern report CSV
  downloadInternReport: async (data = null, reportType = 'intern_report') => {
    try {
      // Use provided data or fetch all intern data
      const reportData = data || await adminApi.getInternReport();
      
      // Use specialized CSV conversion based on report type
      let csvContent;
      if (reportType.startsWith('previous_day_submissions')) {
        csvContent = csvUtils.convertPreviousDayToCSV(reportData);
      } else if (reportType === 'overdue_interns') {
        csvContent = csvUtils.convertOverdueInternsToCSV(reportData);
      } else {
        csvContent = csvUtils.convertToCSV(reportData);
      }
        
      const timestamp = new Date().toISOString().split('T')[0];
      
      // Generate filename based on report type
      let filename;
      switch (reportType) {
        case 'overdue_interns':
          filename = `overdue_interns_${timestamp}.csv`;
          break;
        case 'submitted_interns':
          filename = `submitted_interns_${timestamp}.csv`;
          break;
        case 'search_results':
          filename = `search_results_${timestamp}.csv`;
          break;
        default:
          // Handle previous day submissions with custom filename
          if (reportType.startsWith('previous_day_submissions_')) {
            filename = `${reportType}.csv`;
          } else {
            filename = `intern_report_${timestamp}.csv`;
          }
      }
      
      csvUtils.downloadCSV(csvContent, filename);
      return { success: true, filename };
    } catch (error) {
      console.error('Error generating CSV report:', error);
      throw error;
    }
  }
};

// Notification utilities
export const notificationUtils = {
  // Show success notification
  showSuccess: (message) => {
    // You can integrate with a toast library here
    alert(`Success: ${message}`);
  },

  // Show error notification
  showError: (message) => {
    // You can integrate with a toast library here
    alert(`Error: ${message}`);
  },

  // Show info notification
  showInfo: (message) => {
    // You can integrate with a toast library here
    alert(`Info: ${message}`);
  }
};
