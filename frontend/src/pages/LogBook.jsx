import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiBook, FiAlertTriangle, FiTarget, 
  FiInfo, FiCalendar, FiCheckCircle, FiAlertCircle,
  FiLoader, FiArrowRight, FiMonitor, FiServer, FiClipboard, FiLayers, FiCloud, FiWifi,
  FiSmartphone, FiUmbrella, FiClock // Added umbrella icon for leave status and clock for time
} from 'react-icons/fi';
import Navigation from "../components/Navigation";

// Utility function to check if current time is after 10 AM (Sri Lankan time)
const checkLeaveTimeRestriction = () => {
  try {
    // Get current time and convert to Sri Lankan timezone
    const now = new Date();
    
    // Calculate offset for Sri Lankan Time (UTC +5:30)
    const sriLankanOffset = 5.5 * 60; // 330 minutes
    const localOffset = now.getTimezoneOffset(); // minutes behind UTC
    const sriLankanTime = new Date(now.getTime() + (localOffset + sriLankanOffset) * 60000);
    
    // Create 10 AM today in Sri Lankan time
    const tenAM = new Date(sriLankanTime);
    tenAM.setHours(10, 0, 0, 0);
    
    const currentTime = sriLankanTime.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    
    const isAfter10AM = sriLankanTime > tenAM;
    
    return {
      isAfter10AM,
      currentTime: currentTime + ' (Sri Lankan Time)',
      message: isAfter10AM ? 
        `Leave applications are not allowed after 10:00 AM. Current time: ${currentTime} (Sri Lankan Time)` :
        'Leave application is allowed'
    };
  } catch (error) {
    console.error('Error checking time restriction:', error);
    // Default to allowing if there's an error
    return {
      isAfter10AM: false,
      currentTime: new Date().toLocaleTimeString(),
      message: 'Leave application is allowed'
    };
  }
};

const Logbook = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    stack: '',
    tasks: '',
    challenges: '',
    plans: '',
    status: 'working'  // Default status: working, leave, or wfh (Work From Home)
  });

  const [statusMessage, setStatusMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeRestriction, setTimeRestriction] = useState(checkLeaveTimeRestriction());

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);

    const authToken = localStorage.getItem('authToken');
    
    if (!authToken) {
      setStatusMessage({ type: 'error', text: 'Authentication required. Please log in again.' });
      setIsSubmitting(false);
      navigate('/');
      return;
    }

    // Adjust the payload based on status
    const isOnLeave = formData.status === 'leave';
    const isWorkFromHome = formData.status === 'wfh';
    
    const payload = {
      date: new Date().toISOString().split('T')[0],
      stack: isOnLeave ? 'On Leave' : (isWorkFromHome ? formData.stack : formData.stack),
      task: isOnLeave ? 'On Leave' : (isWorkFromHome ? formData.tasks.trim() : formData.tasks.trim()),
      progress: isOnLeave ? 'On Leave' : (formData.challenges.trim() || 'No challenges faced'),
      blockers: isOnLeave ? 'On Leave' : (formData.plans.trim() || 'No specific plans'),
      status: formData.status  // Include status in the payload
    };

    // Check time restriction for leave status
    if (formData.status === 'leave') {
      const currentTimeCheck = checkLeaveTimeRestriction();
      if (currentTimeCheck.isAfter10AM) {
        setStatusMessage({ type: 'error', text: currentTimeCheck.message });
        setIsSubmitting(false);
        return;
      }
    }

    // Validation differs based on status
    if ((formData.status === 'working' || formData.status === 'wfh') && (!payload.stack || !payload.task)) {
      setStatusMessage({ type: 'error', text: 'Please select a task stack and fill in all required fields.' });
      setIsSubmitting(false);
      return;
    }

    try {
      const { API_BASE_URL, API_ENDPOINTS } = await import('../api/apiConfig');
      const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.RECORDS.LIST}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Log submitted successfully!' });
        setFormData({
          stack: '',
          tasks: '',
          challenges: '',
          plans: '',
          status: 'working'  // Reset to default
        });
      } else {
        // Handle time restriction error specifically
        if (data.timeRestriction) {
          setStatusMessage({ 
            type: 'error', 
            text: data.error || 'Leave applications are not allowed after 10:00 AM.'
          });
          // Update the time restriction state
          setTimeRestriction(checkLeaveTimeRestriction());
        } else {
          setStatusMessage({ type: 'error', text: data.error || 'Submission failed.' });
        }
      }
    } catch (error) {
      console.error('Submit error:', error);
      setStatusMessage({ type: 'error', text: 'Failed to submit log. Check your connection.' });
    }

    setIsSubmitting(false);
  };

  useEffect(() => {
    let timer;
    if (statusMessage?.type === 'success') {
      timer = setTimeout(() => {
        setStatusMessage(null);
        navigate('/DailyRecords');
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [statusMessage, navigate]);

  // Update time restriction every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRestriction(checkLeaveTimeRestriction());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Handle time restriction changes - reset status if leave is selected but no longer allowed
  useEffect(() => {
    if (formData.status === 'leave' && timeRestriction.isAfter10AM) {
      setFormData(prev => ({ ...prev, status: 'working' }));
      setStatusMessage({
        type: 'error',
        text: 'Leave option is no longer available after 10:00 AM. Status changed to Working.'
      });
    }
  }, [timeRestriction.isAfter10AM, formData.status]);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setStatusMessage(null);
  };

  const stackOptions = [
  { value: "Front-end Development", label: "Front-end Development", icon: <FiMonitor className="mr-2" /> },
  { value: "Back-end Development", label: "Back-end Development", icon: <FiServer className="mr-2" /> },
  { value: "Full-stack Development", label: "Full-stack Development", icon: <FiServer className="mr-2" /> },
  { value: "Project Management", label: "Project Management", icon: <FiClipboard className="mr-2" /> },
  { value: "QA", label: "Quality Assurance", icon: <FiCheckCircle className="mr-2" /> },
  { value: "Documentation", label: "Documentation", icon: <FiBook className="mr-2" /> },
  { value: "UI-UX", label: "UI/UX Design", icon: <FiLayers className="mr-2" /> },
  { value: "Cloud", label: "Cloud Services", icon: <FiCloud className="mr-2" /> },
  { value: "IOT", label: "Internet of Things (IoT)", icon: <FiWifi className="mr-2" /> },
  { value: "Mobile", label: "Mobile Application Development", icon: <FiSmartphone className="mr-2" /> },
  { value: "AI/ML", label: "Artificial Intelligence and Machine Learning", icon: <FiMonitor className="mr-2" /> },
  { value: "DataScience", label: "Data Science", icon: <FiServer className="mr-2" /> }
  ];
    

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-50">
      <Navigation />

      <div className="flex-1 w-full lg:mt-20 lg:px-10">
        <main className="mx-auto px-4 py-6 md:py-8 lg:py-10 max-w-7xl">
          {/* Enhanced Page Header */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                  <FiBook className="mr-3 text-blue-600" />
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Daily Logbook
                  </span>
                </h1>
                <p className="text-gray-500 mt-2 text-base">
                  Track your daily progress and achievements
                </p>
              </div>
              <button
                onClick={() => navigate('/DailyRecords')}
                className="inline-flex items-center px-5 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 group"
              >
                <FiBook className="mr-2 text-blue-600 group-hover:text-blue-700" />
                View Records
                <FiArrowRight className="ml-2 text-gray-400 group-hover:text-blue-600 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
            {/* Form Section */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-blue-200">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg mr-3">
                      <FiBook className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-800">Daily Activity Log</h2>
                      <p className="text-blue-600 text-sm mt-1">Complete your daily work summary</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Status Selection - New Field */}
                    <div className="space-y-4">
                      <label className="flex items-center text-sm font-medium text-gray-700">
                        <FiUmbrella className="mr-2 text-blue-500" />
                        Status <span className="text-red-500 ml-1">*</span>
                      </label>
                      <div className="flex flex-wrap gap-6">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="status"
                            value="working"
                            checked={formData.status === 'working'}
                            onChange={handleChange}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                          />
                          <span className="ml-2 text-gray-700">Working</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="status"
                            value="wfh"
                            checked={formData.status === 'wfh'}
                            onChange={handleChange}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                          />
                          <span className="ml-2 text-gray-700">Work From Home</span>
                        </label>
                        <label className={`flex items-center ${timeRestriction.isAfter10AM ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="radio"
                            name="status"
                            value="leave"
                            checked={formData.status === 'leave'}
                            onChange={handleChange}
                            disabled={timeRestriction.isAfter10AM}
                            className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 ${timeRestriction.isAfter10AM ? 'cursor-not-allowed' : ''}`}
                          />
                          <span className="ml-2 text-gray-700 flex items-center">
                            On Leave
                            {timeRestriction.isAfter10AM && (
                              <FiClock className="ml-1 text-red-500" title="Not available after 10:00 AM" />
                            )}
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Time restriction notification */}
                    {timeRestriction.isAfter10AM && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                        <div className="flex items-start">
                          <FiClock className="text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                          <div className="text-sm">
                            <p className="text-red-800 font-medium mb-1">Leave Applications Closed</p>
                            <p className="text-red-700">
                              Leave applications are not available after 10:00 AM.
                              Current time: {timeRestriction.currentTime}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Conditional rendering based on status */}
                    {formData.status === 'working' || formData.status === 'wfh' ? (
                      <>
                        {/* Task Stack Selection */}
                        <div className="space-y-2">
                          <label className="flex items-center text-sm font-medium text-gray-700">
                            <FiMonitor className="mr-2 text-blue-500" />
                            Task Stack <span className="text-red-500 ml-1">*</span>
                          </label>
                          <select
                            name="stack"
                            value={formData.stack}
                            onChange={handleChange}
                            required={formData.status === 'working'}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 bg-white"
                          >
                            <option value="" disabled>Select your stack...</option>
                            {stackOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* Tasks Completed */}
                        <div className="space-y-2">
                          <label className="flex items-center text-sm font-medium text-gray-700">
                            <FiCheckCircle className="mr-2 text-blue-500" />
                            Tasks Completed <span className="text-red-500 ml-1">*</span>
                          </label>
                          <textarea
                            name="tasks"
                            value={formData.tasks}
                            onChange={handleChange}
                            required={formData.status === 'working'}
                            rows={4}
                            placeholder="What did you accomplish today? Be specific..."
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                          />
                        </div>

                        {/* Challenges Faced */}
                        <div className="space-y-2">
                          <label className="flex items-center text-sm font-medium text-gray-700">
                            <FiAlertTriangle className="mr-2 text-blue-500" />
                            Challenges Faced
                          </label>
                          <textarea
                            name="challenges"
                            value={formData.challenges}
                            onChange={handleChange}
                            rows={3}
                            placeholder="Any obstacles or difficulties you encountered..."
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                          />
                        </div>

                        {/* Plans for Tomorrow */}
                        <div className="space-y-2">
                          <label className="flex items-center text-sm font-medium text-gray-700">
                            <FiTarget className="mr-2 text-blue-500" />
                            Plans for Tomorrow
                          </label>
                          <textarea
                            name="plans"
                            value={formData.plans}
                            onChange={handleChange}
                            rows={3}
                            placeholder="What will you focus on tomorrow?"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                        <p className="text-blue-700 flex items-center">
                          <FiInfo className="mr-2" />
                          No further details needed for leave days.
                        </p>
                      </div>
                    )}

                    {/* Status message */}
                    {statusMessage && (
                      <div
                        className={`flex items-start gap-3 p-4 rounded-xl border-l-4 ${
                          statusMessage.type === 'error'
                            ? 'bg-red-50 border-red-500 text-red-800'
                            : 'bg-green-50 border-green-500 text-green-800'
                        }`}
                      >
                        {statusMessage.type === 'success' ? (
                          <FiCheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                        ) : (
                          <FiAlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                        )}
                        <div>
                          <span className="font-medium">{statusMessage.text}</span>
                          {statusMessage.type === 'success' && (
                            <div className="text-green-700 text-xs mt-1">
                              Redirecting to records...
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Submit Button */}
                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`w-full flex justify-center items-center px-6 py-3.5 rounded-xl text-base font-medium text-white transition-all duration-300 ${
                          isSubmitting
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-md hover:shadow-lg'
                        }`}
                      >
                        {isSubmitting ? (
                          <>
                            <FiLoader className="animate-spin h-5 w-5 mr-2" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <FiCalendar className="h-5 w-5 mr-2" />
                            Submit Logbook
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            {/* Enhanced Info Sidebar */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg mr-3">
                    <FiInfo className="h-5 w-5 text-blue-600" />
                  </div>
                  
                  Tips for Better Logging
                </h3>
                <ul className="space-y-3 text-sm text-gray-600">
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    Be specific about tasks completed
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    Include time spent on each major task
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    Document any challenges for future reference
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    Plan ahead for tomorrow's priorities
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    Mark "On Leave" when taking time off
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    Use "Work From Home" when working remotely
                  </li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-6">
                <h3 className="text-lg font-semibold text-blue-800 mb-2 flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg mr-3">
                    <FiCalendar className="h-5 w-5 text-blue-600" />
                  </div>
                  Today's Summary
                </h3>
                <div className="space-y-2 text-blue-700">
                  <p className="flex items-center">
                    <span className="font-medium mr-2">Date:</span>
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="flex items-center">
                    <span className="font-medium mr-2">Week:</span>
                    Week {Math.ceil(new Date().getDate() / 7)} of {new Date().toLocaleString('default', { month: 'long' })}
                  </p>
                  <p className="flex items-center">
                    <span className="font-medium mr-2">Status:</span>
                    {formData.status === 'working' ? (
                      <span className="text-green-600">Working</span>
                    ) : formData.status === 'wfh' ? (
                      <span className="text-purple-600">Work From Home</span>
                    ) : (
                      <span className="text-blue-600">On Leave</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Logbook;