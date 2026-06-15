import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaUser, FaDownload, FaSpinner, FaExclamationTriangle, FaShieldAlt, FaBuilding, FaCalendarAlt, FaProjectDiagram, FaCheckCircle, FaCertificate, FaTimes, FaEye, FaLock, FaHourglassHalf } from 'react-icons/fa';
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
  const m = Math.round((new Date(e) - new Date(s)) / (1000*60*60*24*30.44));
  return m < 1 ? `${Math.ceil((new Date(e)-new Date(s))/864e5)} days` : `${m} month${m!==1?'s':''}`;
};

const Toast = ({ toast, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  const c = toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800';
  return (
    <motion.div className={`fixed bottom-6 right-6 z-50 flex items-center space-x-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm ${c}`}
      initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:20 }}>
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
      const { intern, projects, attendanceCount, gitCommitsData } = certData;

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
        attendanceCount: attendanceCount || 0,
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

  const { intern, projects, attendanceCount, source, gitCommitsData } = certData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 text-gray-800 overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div className="absolute w-80 h-80 rounded-full bg-blue-100/40 -top-20 -left-20"
          animate={{ y:[0,-30,0], x:[0,20,0] }} transition={{ duration:15, repeat:Infinity, ease:'easeInOut' }} />
        <motion.div className="absolute w-96 h-96 rounded-full bg-amber-100/20 top-1/3 right-0"
          animate={{ y:[0,20,0] }} transition={{ duration:18, repeat:Infinity, ease:'easeInOut', delay:2 }} />
      </div>

      <AnimatePresence>{toast && <Toast toast={toast} onClose={() => setToast(null)} />}</AnimatePresence>

      {/* Navbar */}
      <motion.header className="bg-white/80 backdrop-blur-md shadow-sm fixed top-0 left-0 right-0 z-30 h-[4.5rem] sm:h-[5.5rem] border-b border-gray-100"
        initial={{ y:-100 }} animate={{ y:0 }} transition={{ type:'spring', stiffness:100 }}>
        <div className="flex items-center justify-between h-full px-4 sm:px-6 lg:px-8">
          <motion.div className="flex items-center space-x-3 cursor-pointer"
            onClick={() => { localStorage.clear(); navigate('/admin-login'); }}
            whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }}>
            <img src={logo} alt="SLT" className="h-8 sm:h-10 w-auto rounded-lg border border-gray-200 shadow-sm" />
            <div className="hidden sm:flex flex-col">
              <span className="text-lg font-semibold text-gray-900">SLT Admin Portal</span>
              <span className="text-sm text-gray-600">Internship Certificate</span>
            </div>
          </motion.div>
          <motion.button whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
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
              initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}>
              <motion.button onClick={() => navigate(`/admin/intern/${internId}`)}
                className="flex items-center px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl border border-gray-200 shadow-sm"
                whileHover={{ x:-3 }}>
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
              <motion.div className="mb-4 flex flex-wrap gap-2" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }}>
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

            {/* Certificate Preview — elegant centered design */}
            <motion.div className="bg-white border border-gray-200 shadow-2xl relative mb-12 overflow-hidden"
              initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}>

              {/* Subtle decorative corners */}
              <div className="absolute top-4 left-4 w-16 h-16 border-t border-l border-gray-200 rounded-tl-sm opacity-50" />
              <div className="absolute top-4 right-4 w-16 h-16 border-t border-r border-gray-200 rounded-tr-sm opacity-50" />
              <div className="absolute bottom-4 left-4 w-16 h-16 border-b border-l border-gray-200 rounded-bl-sm opacity-50" />
              <div className="absolute bottom-4 right-4 w-16 h-16 border-b border-r border-gray-200 rounded-br-sm opacity-50" />
              
              <div className="px-8 sm:px-16 py-12 sm:py-16">
                {/* Logo & Company */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 border-2 border-slate-200 mb-4 shadow-sm">
                    <FaCertificate className="text-2xl text-slate-600" />
                  </div>
                  <p className="text-xs uppercase tracking-[0.25em] font-medium text-slate-400 mt-1">Sri Lanka Telecom PLC</p>
                </div>

                {/* Title */}
                <div className="text-center mb-8">
                  <h3 className="text-2xl sm:text-3xl font-serif font-bold text-[#00204a] tracking-tight">CERTIFICATE OF COMPLETION</h3>
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <div className="h-px w-16 bg-gradient-to-r from-transparent to-amber-300" />
                    <div className="w-2 h-2 rotate-45 bg-amber-400" />
                    <div className="h-px w-16 bg-gradient-to-l from-transparent to-amber-300" />
                  </div>
                </div>

                {/* "This certificate is presented to" */}
                <p className="text-center text-sm text-slate-500 font-medium mb-4 tracking-wide">This certificate is presented to</p>

                {/* Intern Name — large & elegant */}
                <div className="text-center mb-3">
                  <h2 className="text-3xl sm:text-4xl font-serif italic font-bold text-[#00204a]">
                    {intern.name}
                  </h2>
                  <div className="h-0.5 w-48 sm:w-64 bg-gradient-to-r from-transparent via-amber-400 to-transparent mx-auto mt-3" />
                </div>

                {/* Body paragraph */}
                <div className="text-center max-w-xl mx-auto mt-8 mb-10">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    In recognition of outstanding dedication, exceptional performance, and unwavering commitment to excellence during the internship training program in{' '}
                    <span className="font-semibold text-slate-800">{intern.fieldOfSpecialization || 'their designated field'}</span>{' '}
                    from <span className="font-semibold text-slate-800">{fmt(intern.trainingStartDate)}</span> to{' '}
                    <span className="font-semibold text-slate-800">{fmt(intern.trainingEndDate)}</span>{' '}
                    ({dur(intern.trainingStartDate, intern.trainingEndDate)}).{' '}
                    Representing <span className="font-semibold text-slate-800">{intern.institute || 'their university'}</span>, their contributions have made a significant impact, and we deeply appreciate their efforts.
                  </p>
                </div>

                {/* Bottom row: Issue Date | QR Seal | Signature */}
                <div className="flex items-end justify-between max-w-2xl mx-auto mt-12 pt-6">
                  {/* Issue Date */}
                  <div className="text-center min-w-[100px]">
                    <p className="text-sm font-semibold text-slate-800 mb-2">
                      {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </p>
                    <div className="h-px w-24 bg-slate-300 mx-auto mb-1" />
                    <p className="text-xs text-slate-400">Issue date</p>
                  </div>

                  {/* QR / Seal placeholder */}
                  <div className="text-center mx-6">
                    <div className="w-16 h-16 rounded-full border-2 border-amber-300 flex items-center justify-center mx-auto mb-1 bg-amber-50/30">
                      <FaShieldAlt className="text-lg text-amber-400" />
                    </div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Verified</p>
                  </div>

                  {/* Authorized Signature */}
                  <div className="text-center min-w-[100px]">
                    <div className="h-8" /> {/* Space for signature */}
                    <div className="h-px w-28 bg-slate-300 mx-auto mb-1" />
                    <p className="text-xs font-medium text-slate-700">Authorized Signatory</p>
                    <p className="text-[10px] text-slate-400">Training Division</p>
                  </div>
                </div>

                {/* Certificate ID footer */}
                <div className="text-center mt-10 pt-4 border-t border-gray-100">
                  <p className="text-xs text-slate-400">
                    Validate Certificate ID:{' '}
                    <span className="font-semibold text-slate-600">
                      REF/SLT/INTERN/{intern.traineeId || '000'}/{new Date().getFullYear()}
                    </span>
                  </p>
                </div>

                {/* Download / View-Only section */}
                <div className="flex flex-col items-center mt-10 space-y-4">
                  {certData.internshipCompleted ? (
                    <motion.button onClick={handleGeneratePDF} disabled={generating}
                      whileHover={{ scale: generating ? 1 : 1.02, y: generating ? 0 : -2 }}
                      whileTap={{ scale: generating ? 1 : 0.98 }}
                      className="flex items-center space-x-3 px-10 py-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-xl text-sm font-bold uppercase tracking-widest transition-all shadow-md hover:shadow-lg disabled:cursor-not-allowed cursor-pointer">
                      {generating
                        ? <><FaSpinner className="h-5 w-5 animate-spin" /><span>Generating PDF...</span></>
                        : <><FaDownload className="h-5 w-5" /><span>Download Official PDF</span></>
                      }
                    </motion.button>
                  ) : (
                    <>
                      <motion.div
                        className="w-full max-w-lg p-5 bg-amber-50 border border-amber-200 rounded-xl text-center shadow-sm"
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      >
                        <div className="flex items-center justify-center space-x-2 mb-2">
                          <FaHourglassHalf className="text-amber-500 text-lg" />
                          <span className="text-sm font-bold text-amber-800 uppercase tracking-wide">Internship In Progress</span>
                        </div>
                        <p className="text-sm text-amber-700 mb-1">
                          Certificate download will be available after the training period ends.
                        </p>
                        {intern.trainingEndDate && (
                          <p className="text-xs text-amber-600 font-medium">
                            Training ends on: <span className="font-bold">{fmt(intern.trainingEndDate)}</span>
                            {(() => {
                              const daysLeft = Math.ceil((new Date(intern.trainingEndDate) - new Date()) / 864e5);
                              return daysLeft > 0 ? ` (${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining)` : '';
                            })()}
                          </p>
                        )}
                      </motion.div>
                      <motion.div
                        className="flex items-center space-x-2 px-6 py-3 bg-slate-100 text-slate-500 rounded-xl text-sm font-bold uppercase tracking-widest border border-slate-200"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                      >
                        <FaEye className="h-4 w-4" />
                        <span>Preview Only — Download Locked</span>
                        <FaLock className="h-3.5 w-3.5" />
                      </motion.div>
                    </>
                  )}
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
