import React, { useState, useEffect, useCallback } from 'react';
import { api, getAuthHeaders } from "../api/apiConfig";
import {
  Users,
  Plus,
  Loader2,
  Search,
  X,
  Trash2,
  UserPlus,
  ChevronDown,
  Edit2
} from 'lucide-react';
import { UserGroupIcon } from "@heroicons/react/outline";
import { Toaster, toast } from "react-hot-toast";
import Layout from "../components/Layout";
import { motion, AnimatePresence } from "framer-motion"; 

// Animation variants for list items
const listVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.3,
      ease: "easeOut"
    }
  })
};

// Fade in animation for components
const fadeIn = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.4 }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.2 }
  }
};

const TeamCard = ({ team, onAddMember, onRemoveMember, onDeleteTeam, onUpdateTeamName }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newTeamName, setNewTeamName] = useState(team.name);

  const handleUpdate = async () => {
    if (newTeamName.trim() && newTeamName !== team.name) {
      await onUpdateTeamName(team.name, newTeamName);
    }
    setIsEditing(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
      className="bg-white rounded-2xl border border-blue-500 shadow-sm hover:shadow-lg transition-all duration-300"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.div 
              whileHover={{ rotate: 15 }}
              className="w-10 h-10 bg-[#001845]/10 rounded-full flex items-center justify-center"
            >
              <Users className="h-5 w-5 text-[#001845]" />
            </motion.div>
            {/* Editable Team Name */}
            {isEditing ? (
              <motion.input
                initial={{ width: "100%" }}
                animate={{ width: "100%" }}
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="border border-gray-300 px-2 py-1 rounded-lg"
                onBlur={handleUpdate}
                onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                autoFocus
              />
            ) : (
              <h3 className="text-lg font-semibold text-[#060B27]">{team.name}</h3>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Edit Team Name Button */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center justify-center p-2 hover:bg-[#060B27]/5 rounded-xl text-[#060B27] transition-colors"
            >
              <Edit2 className="h-5 w-5" />
            </motion.button>
            {/* Add Member Button */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onAddMember(team.name)}
              className="inline-flex items-center justify-center p-2 hover:bg-[#060B27]/5 rounded-xl text-[#060B27] transition-colors"
            >
              <UserPlus className="h-5 w-5" />
            </motion.button>
            {/* Delete Team Button */}
            <motion.button
              whileHover={{ scale: 1.1, backgroundColor: "rgba(254, 226, 226, 1)" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onDeleteTeam(team.name)}
              className="inline-flex items-center justify-center p-2 hover:bg-red-50 rounded-xl text-red-500 transition-colors"
            >
              <Trash2 className="h-5 w-5" />
            </motion.button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">
              Members ({team.members?.length || 0})
            </span>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-500 hover:text-[#060B27] transition-colors"
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronDown className="h-5 w-5" />
              </motion.div>
            </motion.button>
          </div>

          <AnimatePresence>
            <motion.div 
              animate={{ 
                height: isExpanded ? "auto" : "12rem",
                opacity: 1
              }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="space-y-3 overflow-hidden"
            >
              {team.members?.map((member, index) => (
                <motion.div 
                  key={member._id}
                  custom={index}
                  variants={listVariants}
                  initial="hidden"
                  animate="visible"
                  className="group p-4 rounded-xl bg-gray-50 hover:bg-[#060B27]/5 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-[#060B27]">{member.traineeName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-gray-500">{member.traineeId}</span>
                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                        <span className="text-sm text-gray-500">{member.fieldOfSpecialization}</span>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1, backgroundColor: "rgba(252, 165, 165, 1)" }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onRemoveMember(team.name, member._id)}
                      className="opacity-100 p-2 bg-red-200 text-sm text-red-700 hover:bg-red-400 rounded-full transition-all duration-200"
                    >
                      <X className="h-4 w-4" />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

// AddMemberModal Component for adding interns to a team
const AddMemberModal = ({ isOpen, onClose, teamName, availableInterns, onAddIntern }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredInterns = availableInterns.filter(intern =>
    intern.traineeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    intern.traineeId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Modal animation
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { 
        type: "spring", 
        damping: 25, 
        stiffness: 300 
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.8,
      transition: { duration: 0.2 }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center"
        >
          <motion.div 
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="bg-white border rounded-2xl w-full max-w-lg mx-4 shadow-xl overflow-hidden"
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-[#060B27]">Add Members to {teamName}</h3>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="inline-flex items-center justify-center p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>
            </div>

            <div className="p-6">
              <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                  type="text"
                  placeholder="Search members..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[#060B27] focus:ring focus:ring-[#060B27]/20 transition-all"
                />
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                <AnimatePresence>
                  {filteredInterns.map((intern, index) => (
                    <motion.div 
                      key={intern._id}
                      custom={index}
                      variants={listVariants}
                      initial="hidden"
                      animate="visible"
                      layout
                      className="p-4 rounded-xl bg-gray-50 hover:bg-[#060B27]/5 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-[#060B27]">{intern.traineeName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-500">{intern.traineeId}</span>
                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                            <span className="text-sm text-gray-500">{intern.fieldOfSpecialization}</span>
                          </div>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.1, backgroundColor: "rgba(134, 239, 172, 1)" }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => onAddIntern(intern._id)}
                          className="p-3 rounded-full bg-green-100 hover:bg-green-300 text-green-700 font-medium transition-colors"
                        >
                          <Plus className="h-5 w-5" />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Custom toast with animation
const customToast = (message, type) => {
  toast.custom((t) => (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`${
        type === 'success' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700'
      } px-6 py-4 shadow-md rounded-xl border flex items-center`}
    >
      <span>{message}</span>
    </motion.div>
  ));
};

// Main GroupOverview Component
const GroupOverview = () => {
  const [teams, setTeams] = useState([]);
  const [interns, setInterns] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch teams and interns
  const fetchData = useCallback(async () => {
    try {
      const [teamResponse, internResponse] = await Promise.all([
        api.get("/interns/teams/all", getAuthHeaders()),
        api.get("/interns", getAuthHeaders())
      ]);
      setTeams(Array.isArray(teamResponse.data) ? teamResponse.data : []);
      setInterns(Array.isArray(internResponse.data) ? internResponse.data : []);
    } catch (error) {
      console.error("Error fetching data:", error);
      customToast("Failed to load teams or interns.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handler for opening AddMemberModal
  const handleAddMember = (teamName) => {
    setSelectedTeam(teamName);
    setModalOpen(true);
  };

  // Handler for adding an intern to a team
  const handleAddIntern = async (internId) => {
    try {
      const encodedTeamName = encodeURIComponent(selectedTeam); // URL encode the team name
      const response = await api.put(
        `/interns/teams/${encodedTeamName}/assign-single`,
        { internId },
        getAuthHeaders()
      );
      if (response.status === 200) {
        customToast("Intern added to the team!", "success");
        fetchData(); // Refresh data
      }
    } catch (error) {
      customToast("Error adding intern.", "error");
    } finally {
      setModalOpen(false);
    }
  };

  // Handler for removing an intern from a team
  const handleRemoveMember = async (teamName, internId) => {
    try {
      const encodedTeamName = encodeURIComponent(teamName); // URL encode the team name
      const response = await api.put(
        `/interns/teams/${encodedTeamName}/remove`,
        { internId },
        getAuthHeaders()
      );
      if (response.status === 200) {
        customToast("Intern removed from the team!", "success");
        fetchData(); // Refresh data
      }
    } catch (error) {
      customToast("Error removing intern.", "error");
    }
  };

  // Handler for deleting a team
  const handleDeleteTeam = async (teamName) => {
    try {
      const encodedTeamName = encodeURIComponent(teamName); // URL encode the team name
      const response = await api.delete(`/interns/teams/${encodedTeamName}`, getAuthHeaders());
      if (response.status === 200) {
        customToast("Team deleted successfully!", "success");
        fetchData(); // Refresh data
      }
    } catch (error) {
      customToast("Error deleting team.", "error");
    }
  };

  // Handler for updating a team's name
  const handleUpdateTeamName = async (oldTeamName, newTeamName) => {
    try {
      const encodedOldTeamName = encodeURIComponent(oldTeamName); // URL encode the old team name
      const response = await api.put(
        `/interns/teams/${encodedOldTeamName}`,
        { newTeamName },
        getAuthHeaders()
      );
      if (response.status === 200) {
        customToast("Team name updated successfully!", "success");
        fetchData(); // Refresh data
      }
    } catch (error) {
      customToast("Error updating team name.", "error");
    }
  };

  // Filter teams by search term
  const filteredTeams = teams.filter((team) =>
    team.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout className="bg-[#f8fafc]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 md:mb-8 gap-4"
        >
          {/* Title Section */}
          <div className="flex items-center gap-4">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ 
                  type: "spring",
                  stiffness: 260,
                  damping: 20,
                  delay: 0.2
                }}
                className="p-4 rounded-2xl"
              >
                <UserGroupIcon className="h-10 w-auto text-4xl text-green-600" />
              </motion.div>
              <div>
                <motion.h1 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="text-3xl font-bold text-[#060B27]"
                >
                  Team Management
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="text-gray-500"
                >
                  Organize and manage your teams effectively
                </motion.p>
              </div>
            </div>
            {/* Search Input */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="relative w-full sm:w-64"
            >
              <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
              <motion.input
                whileFocus={{ scale: 1.02, boxShadow: "0 0 0 3px rgba(34, 197, 94, 0.2)" }}
                transition={{ duration: 0.2 }}
                type="text"
                placeholder="Search teams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-300 focus:border-green-500 focus:ring focus:ring-green-200 transition-all shadow-sm"
              />
            </motion.div>
          </motion.div>

          {loading ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center h-64"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 1.5, 
                  ease: "linear" 
                }}
              >
                <Loader2 className="h-8 w-8 text-green-500" />
              </motion.div>
            </motion.div>
          ) : (
            <motion.div 
              initial="hidden"
              animate="visible"
              variants={fadeIn}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
            >
              <AnimatePresence>
                {filteredTeams.map((team, index) => (
                  <motion.div
                    key={team.name}
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ 
                      opacity: 1, 
                      y: 0,
                      transition: { delay: index * 0.1, duration: 0.4 }
                    }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    layout
                  >
                    <TeamCard
                      team={team}
                      onAddMember={handleAddMember}
                      onRemoveMember={handleRemoveMember}
                      onDeleteTeam={handleDeleteTeam}
                      onUpdateTeamName={handleUpdateTeamName}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}

        <AddMemberModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          teamName={selectedTeam}
          availableInterns={interns}
          onAddIntern={handleAddIntern}
        />

        {/* React Hot Toast Toaster */}
        <Toaster position="bottom-right" />
      </motion.div>
    </Layout>
  );
};

export default GroupOverview;