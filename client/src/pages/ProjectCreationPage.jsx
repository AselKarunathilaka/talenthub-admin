import React, { useState, useEffect } from 'react';
import { api, getAuthHeaders } from "../api/apiConfig";
import { useNavigate } from 'react-router-dom';
import { 
  Users, Plus, Loader2, Search, X, Folder, FileText, 
  Layers, ChevronDown, CheckCircle2, AlertCircle 
} from 'lucide-react';
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ProjectManagementPage = () => {
  const [interns, setInterns] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedInterns, setSelectedInterns] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true); 
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('interns');

  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [internResponse, groupResponse] = await Promise.all([
          api.get("/interns", getAuthHeaders()),
          api.get("/interns/teams/all", getAuthHeaders())
        ]);
        setInterns(internResponse.data);
        setGroups(groupResponse.data);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load interns or groups. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Existing handler methods remain the same...
  const handleAddRemoveIntern = (internId) => {
    if (selectedInterns.includes(internId)) {
      setSelectedInterns(selectedInterns.filter(id => id !== internId));
    } else {
      setSelectedInterns([...selectedInterns, internId]);
    }
  };

  const handleAddRemoveGroup = (groupName) => {
    if (selectedGroups.includes(groupName)) {
      setSelectedGroups(selectedGroups.filter(name => name !== groupName));
    } else {
      setSelectedGroups([...selectedGroups, groupName]);
    }
  };

  const handleProjectCreation = async () => {
    if (!projectName.trim()) {
      toast.error("Please provide a project name.");
      return;
    }

    if (selectedInterns.length === 0 && selectedGroups.length === 0) {
      toast.error("Please select at least one intern or group for the project.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post(
        "/projects/create",
        { 
          projectName, 
          description, 
          internIds: selectedInterns, 
          groupNames: selectedGroups 
        },
        getAuthHeaders()
      );

      if (response.status === 200 || response.status === 201) {
        toast.success("Project successfully created!");
        setProjectName("");
        setDescription("");
        setSelectedInterns([]);
        setSelectedGroups([]);
      } else {
        toast.error("Unexpected response from server. Please try again.");
      }
    } catch (error) {
      console.error("Error creating project:", error);
      toast.error("Error creating project.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInterns = interns.filter(intern =>
    intern.traineeId?.includes(searchTerm) ||
    intern.traineeName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredGroups = groups.filter(group =>
    group.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-x-hidden">
        <Navbar />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 mt-16 sm:mt-24">
          <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
            {/* Header Section */}
            <div className="p-6 sm:p-8 border-b">
              <div className="flex items-center space-x-4">
                <Folder className="h-12 w-12 text-gray-700" />
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Create New Project</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Assign interns or groups to collaborate on a new project
                  </p>
                </div>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid md:grid-cols-2 gap-6 p-6 sm:p-8">
              {/* Project Details Column */}
              <div className="space-y-6">
                <div className="bg-gray-100 rounded-xl p-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Enter a descriptive project name"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="w-full px-4 py-3 pr-10 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                    {projectName && (
                      <CheckCircle2 className="absolute right-3 top-3.5 text-green-500 h-5 w-5" />
                    )}
                  </div>
                </div>

                <div className="bg-gray-100 rounded-xl p-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Description
                  </label>
                  <textarea
                    placeholder="Describe the project goals and scope"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                  />
                </div>

                {/* Selected Members Section */}
                <div className="bg-gray-100 rounded-xl p-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      Selected Members
                    </h3>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">
                        Interns: {selectedInterns.length}
                      </span>
                      <span className="text-xs text-gray-500">
                        Groups: {selectedGroups.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[...selectedInterns, ...selectedGroups].map(item => (
                      <div 
                        key={item} 
                        className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs flex items-center"
                      >
                        {interns.find(i => i._id === item)?.traineeName || 
                         groups.find(g => g.name === item)?.name}
                        <X 
                          className="ml-2 h-4 w-4 hover:text-red-500 cursor-pointer" 
                          onClick={() => 
                            typeof item === 'string' 
                              ? handleAddRemoveGroup(item) 
                              : handleAddRemoveIntern(item)
                          } 
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Members Selection Column */}
              <div className="space-y-6">
                {/* Search and Tabs */}
                <div className="sticky top-0 z-10 bg-white rounded-xl shadow-sm">
                  <div className="relative">
                    <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search interns or groups..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex border-t">
                    <button
                      onClick={() => setActiveTab('interns')}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'interns' 
                          ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-500' 
                          : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      Interns
                    </button>
                    <button
                      onClick={() => setActiveTab('groups')}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'groups' 
                          ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-500' 
                          : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      Groups
                    </button>
                  </div>
                </div>

                {/* Members List */}
                <div className="bg-white rounded-xl border overflow-hidden">
                  {activeTab === 'interns' ? (
                    <div className="max-h-[500px] overflow-y-auto">
                      {filteredInterns.map((intern) => (
                        <div
                          key={intern._id}
                          className="flex items-center p-4 border-b hover:bg-blue-50 transition-colors"
                        >
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-800">
                              {intern.traineeName}
                            </h4>
                            <p className="text-xs text-gray-500">
                              {intern.traineeId}
                            </p>
                          </div>
                          <button
                            onClick={() => handleAddRemoveIntern(intern._id)}
                            className={`rounded-full p-2 transition-colors ${
                              selectedInterns.includes(intern._id)
                                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                : 'bg-green-100 text-green-600 hover:bg-green-200'
                            }`}
                          >
                            {selectedInterns.includes(intern._id) ? <X /> : <Plus />}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="max-h-[500px] overflow-y-auto">
                      {filteredGroups.map((group) => (
                        <div
                          key={group.name}
                          className="flex items-center p-4 border-b hover:bg-blue-50 transition-colors"
                        >
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-800">
                              {group.name}
                            </h4>
                            <p className="text-xs text-gray-500">
                              {group.members?.length || 0} members
                            </p>
                          </div>
                          <button
                            onClick={() => handleAddRemoveGroup(group.name)}
                            className={`rounded-full p-2 transition-colors ${
                              selectedGroups.includes(group.name)
                                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                : 'bg-green-100 text-green-600 hover:bg-green-200'
                            }`}
                          >
                            {selectedGroups.includes(group.name) ? <X /> : <Plus />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Create Project Button */}
            <div className="bg-gray-100 p-6 sm:p-8 flex justify-end">
              <button
                onClick={handleProjectCreation}
                disabled={!projectName.trim() || (selectedInterns.length === 0 && selectedGroups.length === 0) || submitting}
                className={`px-6 py-3 rounded-lg flex items-center space-x-2 font-medium shadow-md transition-all duration-200 ${
                  !projectName.trim() || (selectedInterns.length === 0 && selectedGroups.length === 0) || submitting
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    <span>Creating Project...</span>
                  </>
                ) : (
                  <>
                    <Folder className="h-5 w-5 mr-2" />
                    <span>Create Project</span>
                  </>
                )}
              </button>
            </div>
          </div>
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

export default ProjectManagementPage;