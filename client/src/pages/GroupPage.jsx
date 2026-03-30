import React, { useState, useEffect } from 'react';
import { api, getAuthHeaders } from "../api/apiConfig";
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Loader2, Search, X, ChevronDown } from 'lucide-react';
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ChevronDoubleDownIcon } from '@heroicons/react/outline';

const GroupPage = () => {
  const [interns, setInterns] = useState([]);
  const [selectedInterns, setSelectedInterns] = useState([]);
  const [teamName, setTeamName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [fieldOfSpecialization, setFieldOfSpecialization] = useState('');
  const [loading, setLoading] = useState(true); // Initially loading is true
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  // Fetching interns
  useEffect(() => {
    const fetchInterns = async () => {
      try {
        const response = await api.get("/interns", getAuthHeaders());
        setInterns(response.data);
      } catch (error) {
        console.error("Error fetching interns:", error);
        toast.error("Failed to load interns. Please refresh and try again.");
      } finally {
        setLoading(false); // Data is fetched, loading is false
      }
    };

    fetchInterns();
  }, []);

  // Handling search term change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handling specialization filter change
  const handleFilterChange = (e) => {
    setFieldOfSpecialization(e.target.value);
  };

  // Handling intern selection and removal
  const handleAddRemoveIntern = (internId) => {
    if (selectedInterns.includes(internId)) {
      setSelectedInterns(selectedInterns.filter(id => id !== internId));
    } else {
      setSelectedInterns([...selectedInterns, internId]);
    }
  };

  // Handling team creation
  const handleTeamCreation = async () => {
    if (!teamName.trim()) {
      toast.error("Please provide a team name.");
      return;
    }

    if (selectedInterns.length === 0) {
      toast.error("Please select at least one intern for the team.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post(
        "/interns/assign-to-team",
        { teamName, internIds: selectedInterns },
        getAuthHeaders()
      );

      if (response.status === 200 || response.status === 201) {
        toast.success("Team successfully created and interns assigned!");
        setTeamName("");
        setSelectedInterns([]);
        const updatedInterns = await api.get("/interns", getAuthHeaders());
        setInterns(updatedInterns.data);
      } else {
        toast.error("Unexpected response from server. Please try again.");
      }
    } catch (error) {
      console.error("Error creating team:", error);
      toast.error("Error creating team and assigning interns.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filtering interns based on search and specialization
  const filteredInterns = interns.filter(intern =>
    intern.traineeId?.includes(searchTerm) ||
    intern.traineeName?.toLowerCase().includes(searchTerm.toLowerCase())
  ).filter(intern =>
    !fieldOfSpecialization ||
    intern.fieldOfSpecialization === fieldOfSpecialization
  );

  // Sorting specializations for the filter dropdown
  const specializations = Array.from(
    new Set(interns.filter(i => i.fieldOfSpecialization).map(i => i.fieldOfSpecialization))
  ).sort();

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <div className="flex-1 overflow-x-hidden">
        <Navbar />

        <div className="max-w-6xl  px-4 sm:px-6 py-8 mt-16 sm:mt-24">
          <div className="bg-white rounded-xl p-10 sm:p-8">
            <div className="flex items-center space-x-3 mb-6">
              <Users className="h-12 w-auto text-green-600" />
              <div>
                <h1 className="text-2xl sm:text-4xl font-bold text-gray-800">Create Team</h1>
                <p className="text-lg text-gray-600 mt-1">Assign interns to a new project team</p>
              </div>
            </div>

            <div className="space-y-8">


              {/* Team Name Input */}
              <div className="max-w-2xl">
                <label className="block text-lg font-medium text-gray-700 mb-2">Team Name</label>
                <input
                  type="text"
                  placeholder="Enter a descriptive team name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 outline-none"
                />
              </div>

              

              {/* Selected Interns Section */}
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 md:p-6">
                <h3 className="text-lg font-medium text-gray-700 mb-3 flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  Selected Team Members ({selectedInterns.length})
                </h3>

                {selectedInterns.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No team members selected yet</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {interns
                      .filter(i => selectedInterns.includes(i._id))
                      .map(intern => (
                        <div key={intern._id}
                          className="flex items-center border border-green-400 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-sm "
                        >
                          <span className="max-w-[150px] truncate">{intern.traineeName}</span>
                          <button
                            onClick={() => handleAddRemoveIntern(intern._id)}
                            className="ml-2 text-green-500 hover:text-green-700 transition-colors"
                            aria-label={`Remove ${intern.traineeName}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Search and Filter Section */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by ID or name"
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="pl-10 w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 outline-none"
                  />
                </div>

                <div className="relative">
                  <select
                    value={fieldOfSpecialization}
                    onChange={handleFilterChange}
                    className="px-4 py-3 rounded-lg border border-gray-300 text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 outline-none appearance-none min-w-[200px] pr-10" // Added pr-10 for icon spacing
                  >
                    <option value="">All Specializations</option>
                    {specializations.map((spec, idx) => (
                      <option key={idx} value={spec}>{spec}</option>
                    ))}
                  </select>
                  {/* MoveDownIcon placed outside the select element */}
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <ChevronDown className="h-5 w-5" />
                  </div>
                </div>
              </div>

              {/* Available Interns Section */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                  <h3 className="text-sm font-medium text-gray-700 flex items-center">
                    <span>Available Interns</span>
                    {filteredInterns.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full">
                        {filteredInterns.length}
                      </span>
                    )}
                  </h3>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 text-green-500 animate-spin mb-3" />
                      <p className="text-sm text-gray-500">Loading interns...</p>
                    </div>
                  ) : filteredInterns.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">
                      <Search className="h-8 w-8 mx-auto text-gray-300 mb-3" />
                      <p>No interns match your search criteria</p>
                    </div>
                  ) : (
                    filteredInterns.map((intern) => (
                      <div
                        key={intern._id}
                        className="flex items-center p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-800 truncate">{intern.traineeName}</h4>
                          <div className="flex flex-wrap items-center mt-1 text-sm text-gray-500">
                            <span className="mr-2 truncate">ID: {intern.traineeId}</span>
                            {intern.fieldOfSpecialization && (
                              <>
                                <span className="hidden sm:inline mx-2 text-gray-300">•</span>
                                <span className="truncate">{intern.fieldOfSpecialization}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddRemoveIntern(intern._id)}
                          className={`flex items-center justify-center h-9 w-9 rounded-full ml-4 transition-all duration-200 ${
                            selectedInterns.includes(intern._id)
                              ? 'bg-red-100 text-red-600 hover:bg-red-200'
                              : 'bg-green-100 text-green-600 hover:bg-green-200'
                          }`}
                          aria-label={selectedInterns.includes(intern._id) ?
                            `Remove ${intern.traineeName}` :
                            `Add ${intern.traineeName}`}
                        >
                          <Plus className={`h-5 w-5 ${selectedInterns.includes(intern._id) ? 'rotate-45' : ''} transition-transform`} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Create Team Button (Fixed Position) */}
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={handleTeamCreation}
            disabled={!teamName.trim() || selectedInterns.length === 0 || submitting}
            className={`px-6 py-3 rounded-lg flex items-center space-x-2 font-medium shadow-lg hover:shadow-xl transition-all duration-200 ${
              !teamName.trim() || selectedInterns.length === 0 || submitting
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-700 hover:bg-blue-800 active:bg-blue-800 text-white'
            } relative overflow-hidden`}
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <span>Create Team</span>
                <Plus className="h-5 w-5" />
              </>
            )}
          </button>
        </div>

        <ToastContainer
          position="bottom-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnHover
          theme="light"
        />
      </div>
    </div>
  );
};

export default GroupPage;
