import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaUser, FaDownload, FaSpinner, FaExclamationTriangle, FaShieldAlt, FaBuilding, FaCalendarAlt, FaProjectDiagram, FaCheckCircle, FaCertificate, FaTimes } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { generateCertificatePDF } from '../utils/generateCertificatePDF';
import { adminApi } from '../api/adminApi';
import { API_BASE_URL } from '../api/apiConfig';
import logo from '../assets/sltlogo.jpg';

const getAuthHeaders = () => {
  const adminInfo = JSON.parse(localStorage.getItem('adminInfo') || '{}');
  return { 'Content-Type': 'application/json', ...(adminInfo.token && { Authorization: `Bearer ${adminInfo.token}` }) };
};

const fmt = (d) => {
  if (!d) return 'N/A';
  const dt = new Date(d);
  return isNaN(dt) ? d : dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const dur = (s, e) => {
  if (!s || !e) return 'N/A';
  const m = Math.round((new Date(e) - new Date(s)) / (1000 * 60 * 60 * 24 * 30.44));
  return m < 1 ? `${Math.ceil((new Date(e) - new Date(s)) / 864e5)} days` : `${m} month${m !== 1 ? 's' : ''}`;
};

<<<<<<< HEAD
// Formula: attended meetings ÷ meetings held so far (1 per week, capped at endDate or today)
const calcAttendancePercentage = (startDate, endDate, attendanceCount) => {
  if (!startDate || typeof attendanceCount !== 'number') return null;
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;
  if (isNaN(start)) return null;
  const now = new Date();
  const measureTo = end && end < now ? end : now;
  if (measureTo <= start) return null;
  const weeksHeld = Math.max(1, Math.ceil((measureTo - start) / (1000 * 60 * 60 * 24 * 7)));
  return Math.min(100, Math.round((attendanceCount / weeksHeld) * 100));
};

=======
>>>>>>> talenthub/main
const Toast = ({ toast, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  const c = toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800';
  return (
    <motion.div className={`fixed bottom-6 right-6 z-50 flex items-center space-x-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm ${c}`}
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
      <span className="text-sm font-medium">{toast.text}</span>
      <button onClick={onClose} className="opacity-60 hover:opacity-100"><FaTimes className="h-3 w-3" /></button>
    </motion.div>
  );
};

const AdminInternCertificate = () => {
  const { internId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [certData, setCertData] = useState(null);
  const [logoBase64, setLogoBase64] = useState(null);
<<<<<<< HEAD
  // Local DB meeting attendance count (attended / weeks elapsed formula)
  const [localMeetingPresent, setLocalMeetingPresent] = useState(null);
=======
>>>>>>> talenthub/main

  // Custom manual project state
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProject, setNewProject] = useState({ projectName: '', supervisorName: '', status: 'COMPLETED', commits: '' });

  const handleAddCustomProject = () => {
    if (!newProject.projectName) return;

    const updatedCertData = { ...certData };
    if (!updatedCertData.projects) updatedCertData.projects = [];

    if (newProject.commits) {
      if (!updatedCertData.gitCommitsData) {
        updatedCertData.gitCommitsData = { projectCommits: [] };
      }
      updatedCertData.gitCommitsData.projectCommits.push({
        projectName: newProject.projectName,
        totalCommits: parseInt(newProject.commits) || 0
      });
    }

    updatedCertData.projects.push({
      projectName: newProject.projectName,
      supervisorName: newProject.supervisorName || 'N/A',
      status: newProject.status
    });

    setCertData(updatedCertData);
    setNewProject({ projectName: '', supervisorName: '', status: 'COMPLETED', commits: '' });
    setShowAddProject(false);
  };

  // Convert logo to base64 for PDF
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      setLogoBase64(c.toDataURL('image/png'));
    };
    img.src = logo;
  }, []);

  // Fetch enriched certificate data from backend
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const adminInfo = JSON.parse(localStorage.getItem('adminInfo') || '{}');
        if (!adminInfo.token) { navigate('/admin-login'); return; }

        const res = await fetch(`${API_BASE_URL}/admin/intern/${internId}/certificate-data`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const data = await res.json();

        let gitCommitsData = null;
        try {
          gitCommitsData = await adminApi.getInternGitCommits(internId);
        } catch (err) {
          console.warn("Failed to fetch git commits for certificate:", err);
        }

<<<<<<< HEAD
        // Fetch local DB attendance to get accurate meeting present count
        try {
          const attRes = await fetch(`${API_BASE_URL}/admin/intern/${internId}/attendance`, { headers: getAuthHeaders() });
          if (attRes.ok) {
            const attData = await attRes.json();
            let presentCount = 0;
            if (attData.meetingAttendance && Array.isArray(attData.meetingAttendance)) {
              const weeks = new Set();
              attData.meetingAttendance.forEach(entry => {
                if (entry.status === 'Present' && entry.date) {
                  const d = new Date(entry.date);
                  if (!isNaN(d.getTime())) {
                    const day = d.getDay();
                    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                    const monday = new Date(new Date(d).setDate(diff));
                    weeks.add(`${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`);
                  }
                }
              });
              presentCount = weeks.size;
            } else {
              presentCount = attData?.stats?.present ?? 0;
            }
            setLocalMeetingPresent(presentCount);
          }
        } catch (err) {
          console.warn('Could not fetch local attendance:', err);
        }

=======
>>>>>>> talenthub/main
        setCertData({ ...data, gitCommitsData });
      } catch (err) {
        console.error(err);
        setError('Failed to load certificate data');
        if (err.message?.includes('401') || err.message?.includes('403')) {
          localStorage.removeItem('adminInfo');
          navigate('/admin-login');
        }
      } finally { setLoading(false); }
    })();
  }, [internId, navigate]);

  const handleGeneratePDF = async () => {
    if (!certData?.intern) return;
    setGenerating(true);
    try {
<<<<<<< HEAD
      const { intern, projects, gitCommitsData } = certData;
      // Use local DB present count for accuracy (attended / weeks elapsed formula)
      const effectiveAttendanceCount = localMeetingPresent ?? certData.attendanceCount ?? 0;
=======
      const { intern, projects, attendanceCount, gitCommitsData } = certData;
>>>>>>> talenthub/main

      // Issue a certificate record to get a unique verification URL
      let verificationUrl = null;
      try {
        const issued = await adminApi.issueCertificate(internId);
        verificationUrl = issued.verificationUrl;
      } catch (err) {
        console.warn("Could not issue certificate token, QR will be omitted:", err);
      }

      await generateCertificatePDF({
        intern,
        startDate: intern.trainingStartDate,
        endDate: intern.trainingEndDate,
<<<<<<< HEAD
        attendanceCount: effectiveAttendanceCount,
=======
        attendanceCount: attendanceCount || 0,
>>>>>>> talenthub/main
        projects: projects || [],
        specialization: intern.fieldOfSpecialization,
        logoBase64,
        gitCommitsData,
        verificationUrl,
      });
      setToast({ text: 'Certificate PDF downloaded!', type: 'success' });
    } catch (err) {
      console.error('PDF generation error:', err);
      setToast({ text: `Failed to generate PDF: ${err.message}`, type: 'error' });
    } finally { setGenerating(false); }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 border-t-4 border-b-4 border-blue-500 rounded-full mx-auto mb-6" />
          <p className="text-gray-600 font-medium">Loading certificate data...</p>
        </div>
      </div>
    );
  }

  if (error || !certData?.intern) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <motion.div className="text-center max-w-md p-6 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-lg"
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <FaExclamationTriangle className="text-4xl text-red-500 mb-4 mx-auto" />
          <p className="text-red-600 mb-6">{error || 'Intern not found'}</p>
          <button onClick={() => navigate('/admin/dashboard')}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl">Back to Dashboard</button>
        </motion.div>
      </div>
    );
  }

<<<<<<< HEAD
  const { intern, projects, source, gitCommitsData } = certData;
  // Use local DB present count (attended / weeks elapsed); fallback to TalentTrail count
  const attendanceCount = localMeetingPresent ?? certData.attendanceCount ?? 0;
=======
  const { intern, projects, attendanceCount, source, gitCommitsData } = certData;
>>>>>>> talenthub/main

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 text-gray-800 overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div className="absolute w-80 h-80 rounded-full bg-blue-100/40 -top-20 -left-20"
          animate={{ y: [0, -30, 0], x: [0, 20, 0] }} transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.div className="absolute w-96 h-96 rounded-full bg-amber-100/20 top-1/3 right-0"
          animate={{ y: [0, 20, 0] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 2 }} />
      </div>

      <AnimatePresence>{toast && <Toast toast={toast} onClose={() => setToast(null)} />}</AnimatePresence>

      {/* Navbar */}
      <motion.header className="bg-white/80 backdrop-blur-md shadow-sm fixed top-0 left-0 right-0 z-30 h-[4.5rem] sm:h-[5.5rem] border-b border-gray-100"
        initial={{ y: -100 }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 100 }}>
        <div className="flex items-center justify-between h-full px-4 sm:px-6 lg:px-8">
          <motion.div className="flex items-center space-x-3 cursor-pointer"
            onClick={() => { localStorage.clear(); navigate('/admin-login'); }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <img src={logo} alt="SLT" className="h-8 sm:h-10 w-auto rounded-lg border border-gray-200 shadow-sm" />
            <div className="hidden sm:flex flex-col">
              <span className="text-lg font-semibold text-gray-900">SLT Admin Portal</span>
              <span className="text-sm text-gray-600">Internship Certificate</span>
            </div>
          </motion.div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => { localStorage.removeItem('adminInfo'); navigate('/admin-login'); }}
            className="flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:text-white hover:bg-red-500 rounded-xl border border-red-200 hover:border-red-500 transition-all shadow-sm">
            <FaShieldAlt className="h-4 w-4" /><span className="hidden sm:inline">Logout</span>
          </motion.button>
        </div>
      </motion.header>

      {/* Content */}
      <div className="pt-[4.5rem] sm:pt-[5.5rem]">
        <main className="p-3 sm:p-4 lg:p-6">
          <div className="max-w-4xl mx-auto">

            {/* Header */}
            <motion.div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <motion.button onClick={() => navigate(`/admin/intern/${internId}`)}
                className="flex items-center px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl border border-gray-200 shadow-sm"
                whileHover={{ x: -3 }}>
                <FaArrowLeft className="mr-2" />Back to Profile
              </motion.button>
              <div>
                <h2 className="text-2xl lg:text-3xl font-bold">
                  <span className="text-slate-900">
                    Completion Certificate
                  </span>
                </h2>
                <p className="text-sm text-gray-600">Preview and download the internship completion certificate</p>
              </div>
            </motion.div>

            {/* Data source indicator — only show green badge when TalentTrail is connected */}
            {source?.talentTrailConnected && (
              <motion.div className="mb-4 flex flex-wrap gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                  ✓ TalentTrail Connected
                </span>
                {source.projectsFromTalentTrail && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    ✓ Projects loaded from TalentTrail
                  </span>
                )}
              </motion.div>
            )}

            {/* Certificate Preview */}
            <motion.div className="bg-white border border-gray-200 shadow-2xl relative mb-12"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>

              {/* Minimalist Top Accent */}
              <div className="h-1.5 bg-slate-900 w-full" />

              <div className="p-8 sm:p-12">
                {/* Certificate header */}
                <div className="text-center mb-10">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-50 border border-slate-200 mb-5 shadow-sm">
                    <FaCertificate className="text-2xl text-slate-700" />
                  </div>
                  <h3 className="text-3xl font-bold text-slate-900 tracking-tight uppercase">Internship Completion Certificate</h3>
                  <div className="h-px w-24 bg-slate-200 mx-auto my-4" />
                  <p className="text-slate-500 font-medium tracking-wide uppercase text-sm">Sri Lanka Telecom PLC — TalentHub</p>
                </div>

                {/* Formal Intern Details */}
                <div className="mb-10 max-w-2xl mx-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                    <div className="border-b border-gray-100 pb-3">
                      <p className="text-[11px] uppercase tracking-widest font-semibold text-slate-400 mb-1">Intern Name</p>
                      <p className="text-base font-semibold text-slate-900">{intern.name}</p>
                    </div>
                    <div className="border-b border-gray-100 pb-3">
                      <p className="text-[11px] uppercase tracking-widest font-semibold text-slate-400 mb-1">Trainee ID</p>
                      <p className="text-base font-semibold text-slate-900">{intern.traineeId || 'N/A'}</p>
                    </div>
                    <div className="border-b border-gray-100 pb-3">
                      <p className="text-[11px] uppercase tracking-widest font-semibold text-slate-400 mb-1">University / Institute</p>
                      <p className="text-base font-semibold text-slate-900">{intern.institute || 'Not specified'}</p>
                    </div>
                    <div className="border-b border-gray-100 pb-3">
                      <p className="text-[11px] uppercase tracking-widest font-semibold text-slate-400 mb-1">Specialization</p>
                      <p className="text-base font-semibold text-slate-900">{intern.fieldOfSpecialization || 'N/A'}</p>
                    </div>
                    <div className="border-b border-gray-100 pb-3">
                      <p className="text-[11px] uppercase tracking-widest font-semibold text-slate-400 mb-1">Training Period</p>
                      <p className="text-base font-semibold text-slate-900">{fmt(intern.trainingStartDate)} – {fmt(intern.trainingEndDate)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{dur(intern.trainingStartDate, intern.trainingEndDate)}</p>
                    </div>
                    <div className="border-b border-gray-100 pb-3">
                      <p className="text-[11px] uppercase tracking-widest font-semibold text-slate-400 mb-1">Meeting Attendance</p>
<<<<<<< HEAD
                      <p className="text-base font-semibold text-slate-900">
                        {attendanceCount} meeting{attendanceCount !== 1 ? 's' : ''}
                        {calcAttendancePercentage(intern.trainingStartDate, intern.trainingEndDate, attendanceCount) !== null && (
                          <span className="text-slate-500 text-sm ml-1 font-medium">({calcAttendancePercentage(intern.trainingStartDate, intern.trainingEndDate, attendanceCount)}%)</span>
                        )}
                      </p>
=======
                      <p className="text-base font-semibold text-slate-900">{attendanceCount} day{attendanceCount !== 1 ? 's' : ''}</p>
>>>>>>> talenthub/main
                    </div>
                  </div>
                </div>

                {/* Projects Section */}
                <motion.div className="mb-10 max-w-2xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                  <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-slate-900">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-slate-900">
                      Project Assignments ({projects?.length || 0})
                    </h4>
                    <button
                      onClick={() => setShowAddProject(!showAddProject)}
                      className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded font-medium hover:bg-slate-200 transition-colors"
                    >
                      + Add Custom
                    </button>
                  </div>

                  {showAddProject && (
                    <div className="mb-4 p-5 bg-slate-50 border border-slate-200 rounded-lg shadow-inner">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-4">Add Custom Project Record</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <input type="text" placeholder="Project Name" value={newProject.projectName} onChange={e => setNewProject({ ...newProject, projectName: e.target.value })} className="text-sm px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500" />
                        <input type="text" placeholder="Supervisor Name" value={newProject.supervisorName} onChange={e => setNewProject({ ...newProject, supervisorName: e.target.value })} className="text-sm px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500" />
                        <input type="number" placeholder="Total Commits (Optional)" value={newProject.commits} onChange={e => setNewProject({ ...newProject, commits: e.target.value })} className="text-sm px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500" />
                        <select value={newProject.status} onChange={e => setNewProject({ ...newProject, status: e.target.value })} className="text-sm px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 bg-white">
                          <option value="COMPLETED">COMPLETED</option>
                          <option value="IN_PROGRESS">IN_PROGRESS</option>
                          <option value="PLANNING">PLANNING</option>
                        </select>
                      </div>
                      <div className="flex justify-end space-x-3">
                        <button onClick={() => setShowAddProject(false)} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
                        <button onClick={handleAddCustomProject} disabled={!newProject.projectName} className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-slate-900 text-white hover:bg-slate-800 rounded-md disabled:opacity-50 transition-colors">Add Project</button>
                      </div>
                    </div>
                  )}

                  {projects?.length > 0 ? (
                    <div className="space-y-3">
                      {projects.map((p, i) => {
                        let commitsCount = null;
                        if (gitCommitsData && gitCommitsData.projectCommits) {
                          const match = gitCommitsData.projectCommits.find(
                            (gc) => gc.projectName === (p.projectName || p.name)
                          );
                          if (match && match.totalCommits !== undefined) {
                            commitsCount = match.totalCommits;
                          }
                        }

                        return (
                          <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                            <div className="min-w-0 flex-1 mb-2 sm:mb-0 pr-4">
                              <span className="text-sm font-semibold text-slate-900 block truncate">{p.projectName}</span>
                              <span className="text-xs text-slate-500 block">Supervisor: {p.supervisorName}</span>
                            </div>
                            <div className="flex items-center space-x-3 flex-shrink-0">
                              {commitsCount !== null && (
                                <span className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                                  {commitsCount} Commits
                                </span>
                              )}
                              <span className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded font-semibold border ${p.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                p.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-700 border-slate-200'
                                }`}>{p.status}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center border border-dashed border-slate-300 rounded-lg">
                      <p className="text-sm text-slate-500">
                        {source?.talentTrailConnected
                          ? 'No project assignments found in TalentTrail.'
                          : 'No project assignments found in local records.'}
                      </p>
                    </div>
                  )}
                </motion.div>

                {/* Subtle offline note */}
                {source && !source.talentTrailConnected && (
                  <motion.p
                    className="text-xs text-slate-400 text-center mb-6"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                  >
                    Data sourced from local TalentHub records
                  </motion.p>
                )}

                {/* Download button */}
                <div className="flex justify-center mt-12">
                  <motion.button onClick={handleGeneratePDF} disabled={generating}
                    whileHover={{ scale: generating ? 1 : 1.02, y: generating ? 0 : -2 }}
                    whileTap={{ scale: generating ? 1 : 0.98 }}
                    className="flex items-center space-x-3 px-10 py-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-xl text-sm font-bold uppercase tracking-widest transition-all shadow-md hover:shadow-lg disabled:cursor-not-allowed cursor-pointer">
                    {generating
                      ? <><FaSpinner className="h-5 w-5 animate-spin" /><span>Generating PDF...</span></>
                      : <><FaDownload className="h-5 w-5" /><span>Download Official PDF</span></>
                    }
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminInternCertificate;
