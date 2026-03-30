import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, getAuthHeaders } from '../api/apiConfig';
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Plus, 
  FileText, 
  Edit, 
  Calendar, 
  Clock, 
  BookOpen, 
  MessageCircle, 
  Paperclip 
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const StatusBadge = ({ status }) => {
  const statusColors = {
    'Active': 'bg-green-100 text-green-800',
    'Completed': 'bg-blue-100 text-blue-800',
    'On Hold': 'bg-yellow-100 text-yellow-800'
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
};

const ProjectOverviewPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('');
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDeadline, setMilestoneDeadline] = useState('');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [noteContent, setNoteContent] = useState('');

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const loadProjectDetails = async () => {
      try {
        const response = await api.get(`/projects/${projectId}/overview`, getAuthHeaders());
        const data = response.data;
        setProject(data);
        setStartDate(formatDate(data.startDate));
        setEndDate(formatDate(data.endDate));
        setStatus(data.status);
      } catch (error) {
        console.error('Error fetching project details:', error);
        toast.error('Failed to load project details');
      } finally {
        setLoading(false);
      }
    };

    loadProjectDetails();
  }, [projectId]);

  const handleProjectUpdate = async (e) => {
    e.preventDefault();
    try {
      const updatedData = { startDate, endDate, status };
      const response = await api.put(`/projects/${projectId}/update`, updatedData, getAuthHeaders());
      setProject(response.data);
      setIsEditing(false);
      toast.success('Project details updated successfully');
    } catch (error) {
      toast.error('Error updating project details');
    }
  };

  const handleAddMilestone = async (e) => {
    e.preventDefault();
    try {
      const milestoneData = { title: milestoneTitle, deadline: milestoneDeadline };
      const response = await api.post(`/projects/${projectId}/milestones`, { milestoneData }, getAuthHeaders());
      setProject(prevProject => ({
        ...prevProject,
        milestones: [...prevProject.milestones, response.data]
      }));
      toast.success('Milestone added successfully');
      setMilestoneTitle('');
      setMilestoneDeadline('');
    } catch (error) {
      toast.error('Error adding milestone');
    }
  };

  const handleUpdateMilestoneStatus = async (milestoneId, newStatus) => {
    try {
      await api.put(`/projects/${projectId}/milestones/${milestoneId}/status`, { status: newStatus }, getAuthHeaders());
      
      const updatedProject = { 
        ...project, 
        milestones: project.milestones.map(milestone => 
          milestone._id === milestoneId ? { ...milestone, status: newStatus } : milestone
        )
      };
      
      setProject(updatedProject);
      toast.success('Milestone status updated');
    } catch (error) {
      toast.error('Error updating milestone status');
    }
  };

  const handleAddFeedback = async (e) => {
    e.preventDefault();
    try {
      const feedbackData = { comment: feedbackComment };
      const response = await api.post(`/projects/${projectId}/feedback`, { feedbackData }, getAuthHeaders());
      setProject(prevProject => ({
        ...prevProject,
        feedback: [...prevProject.feedback, response.data]
      }));
      toast.success('Feedback added successfully');
      setFeedbackComment('');
    } catch (error) {
      toast.error('Error adding feedback');
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    try {
      const noteData = { content: noteContent };
      const response = await api.post(`/projects/${projectId}/notes`, { noteData }, getAuthHeaders());
      setProject(prevProject => ({
        ...prevProject,
        notes: [...prevProject.notes, response.data]
      }));
      toast.success('Note added successfully');
      setNoteContent('');
    } catch (error) {
      toast.error('Error adding note');
    }
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex flex-col justify-center items-center bg-gray-50">
        <Loader2 className="h-16 w-16 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-700 text-xl font-semibold">Loading project details...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="w-full h-screen flex justify-center items-center bg-gray-50">
        <p className="text-red-600 text-2xl font-bold">Project not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <div className="h-24"></div> 
        <main className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Project Details */}
            <div className="lg:col-span-2 bg-white shadow-xl rounded-2xl p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-gray-800 mb-2">{project.projectName}</h1>
                  <p className="text-gray-600">{project.description}</p>
                </div>
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <Edit size={20} />
                  {isEditing ? 'Cancel' : 'Edit'}
                </button>
              </div>

              {isEditing ? (
                <form onSubmit={handleProjectUpdate} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="Active">Active</option>
                        <option value="Completed">Completed</option>
                        <option value="On Hold">On Hold</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button 
                      type="submit" 
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="text-blue-600" size={24} />
                    <div>
                      <p className="text-sm text-gray-500">Start Date</p>
                      <p className="font-medium">{new Date(project.startDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="text-green-600" size={24} />
                    <div>
                      <p className="text-sm text-gray-500">End Date</p>
                      <p className="font-medium">{project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <BookOpen className="text-purple-600" size={24} />
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <StatusBadge status={project.status} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="bg-white shadow-xl rounded-2xl p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Project Overview</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Users className="text-blue-600" size={20} />
                    <span>Team Members</span>
                  </div>
                  <span className="font-medium">{project.teamMembers?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="text-green-600" size={20} />
                    <span>Completed Milestones</span>
                  </div>
                  <span className="font-medium">
                    {project.milestones?.filter(m => m.status === 'Completed').length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <XCircle className="text-red-600" size={20} />
                    <span>Pending Milestones</span>
                  </div>
                  <span className="font-medium">
                    {project.milestones?.filter(m => m.status !== 'Completed').length || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Milestones, Feedback, and Notes Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
            {/* Milestones */}
            <div className="bg-white shadow-xl rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Milestones</h3>
                <Paperclip className="text-gray-500" size={20} />
              </div>
              {project.milestones.length === 0 ? (
                <p className="text-gray-600 text-center">No milestones added yet.</p>
              ) : (
                <div className="space-y-3">
                  {project.milestones.map((milestone) => (
                    <div key={milestone._id} className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="font-medium">{milestone.title}</p>
                        <p className="text-sm text-gray-500">
                          Due: {new Date(milestone.deadline).toLocaleDateString()}
                        </p>
                      </div>
                      <select
                        value={milestone.status}
                        onChange={(e) => handleUpdateMilestoneStatus(milestone._id, e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={handleAddMilestone} className="mt-4 space-y-2">
                <input
                  type="text"
                  placeholder="Milestone Title"
                  value={milestoneTitle}
                  onChange={(e) => setMilestoneTitle(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  required
                />
                <input
                  type="date"
                  value={milestoneDeadline}
                  onChange={(e) => setMilestoneDeadline(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  required
                />
                <button 
                  type="submit" 
                  className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Add Milestone
                </button>
              </form>
            </div>

            {/* Feedback */}
            <div className="bg-white shadow-xl rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Feedback</h3>
                <MessageCircle className="text-gray-500" size={20} />
              </div>
              {project.feedback.length === 0 ? (
                <p className="text-gray-600 text-center">No feedback added yet.</p>
              ) : (
                <div className="space-y-3">
                  {project.feedback.map((feedback) => (
                    <div key={feedback._id} className="bg-gray-50 p-4 rounded-lg">
                      <p>{feedback.comment}</p>
                      <p className="text-sm text-gray-500 mt-2">By Intern {feedback.internId}</p>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={handleAddFeedback} className="mt-4 space-y-2">
                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="Add your feedback..."
                  className="w-full p-3 border border-gray-300 rounded-lg min-h-[100px]"
                  required
                />
                <button 
                  type="submit" 
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Submit Feedback
                </button>
              </form>
            </div>

            {/* Notes */}
            <div className="bg-white shadow-xl rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Notes</h3>
                <FileText className="text-gray-500" size={20} />
              </div>
              {project.notes.length === 0 ? (
                <p className="text-gray-600 text-center">No notes added yet.</p>
              ) : (
                <div className="space-y-3">
                  {project.notes.map((note) => (
                    <div key={note._id} className="bg-gray-50 p-4 rounded-lg">
                      <p>{note.content}</p>
                      <p className="text-sm text-gray-500 mt-2">By {note.author}</p>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={handleAddNote} className="mt-4 space-y-2">
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Add a note..."
                  className="w-full p-3 border border-gray-300 rounded-lg min-h-[100px]"
                  required
                />
                <button 
                  type="submit" 
                  className="w-full py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  Add Note
                </button>
              </form>
            </div>
          </div>
        </main>
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
  );
};

export default ProjectOverviewPage;