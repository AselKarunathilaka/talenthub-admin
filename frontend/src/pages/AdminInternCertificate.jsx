import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaUser, FaDownload, FaSpinner, FaExclamationTriangle, FaShieldAlt, FaBuilding, FaCalendarAlt, FaProjectDiagram, FaCheckCircle, FaCertificate, FaTimes } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL } from '../api/apiConfig';
import { generateCertificatePDF } from '../utils/generateCertificatePDF';
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
        setCertData(await res.json());
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

  const handleGeneratePDF = () => {
    if (!certData?.intern) return;
    setGenerating(true);
    try {
      const { intern, projects, attendanceCount } = certData;
      generateCertificatePDF({
        intern,
        startDate: intern.trainingStartDate,
        endDate: intern.trainingEndDate,
        attendanceCount: attendanceCount || 0,
        projects: projects || [],
        specialization: intern.fieldOfSpecialization,
        logoBase64,
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

  const { intern, projects, attendanceCount, source } = certData;

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
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-600 to-yellow-500">
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

            {/* Certificate Preview */}
            <motion.div className="bg-white rounded-2xl border-2 border-amber-200/60 shadow-xl overflow-hidden"
              initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}>

              {/* Gold top bar */}
              <div className="h-2 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />

              <div className="p-6 sm:p-8">
                {/* Certificate header */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-100 to-yellow-100 border-2 border-amber-200 mb-4">
                    <FaCertificate className="text-3xl text-amber-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">Internship Completion Certificate</h3>
                  <p className="text-gray-500 text-sm mt-1">Sri Lanka Telecom PLC — TalentHub</p>
                </div>

                {/* Intern details grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                  {[
                    { icon: FaUser, label: 'Intern Name', value: intern.name, color: 'blue' },
                    { icon: FaBuilding, label: 'University / Institute', value: intern.institute || 'Not specified', color: 'purple' },
                    { icon: FaCalendarAlt, label: 'Training Period', value: `${fmt(intern.trainingStartDate)} – ${fmt(intern.trainingEndDate)}`, sub: dur(intern.trainingStartDate, intern.trainingEndDate), color: 'green' },
                    { icon: FaCheckCircle, label: 'Meeting Attendance', value: `${attendanceCount} day${attendanceCount !== 1 ? 's' : ''}`, color: 'amber' },
                  ].map((item, i) => (
                    <motion.div key={i} className={`flex items-center p-4 bg-${item.color}-50/50 rounded-xl border border-${item.color}-100`}
                      initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay: 0.3 + i*0.1 }}>
                      <div className={`w-10 h-10 rounded-full bg-${item.color}-100 flex items-center justify-center mr-3 flex-shrink-0`}>
                        <item.icon className={`text-${item.color}-600`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">{item.label}</p>
                        <p className="text-sm font-semibold text-gray-900 truncate">{item.value}</p>
                        {item.sub && <p className="text-xs text-gray-400">{item.sub}</p>}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Extra info row */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-center">
                    <p className="text-xs text-gray-500">Trainee ID</p>
                    <p className="text-sm font-bold text-gray-800">{intern.traineeId || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-center">
                    <p className="text-xs text-gray-500">Specialization</p>
                    <p className="text-sm font-bold text-gray-800 truncate">{intern.fieldOfSpecialization || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-center col-span-2 md:col-span-1">
                    <p className="text-xs text-gray-500">Status</p>
                    <p className="text-sm font-bold text-gray-800">{intern.status || 'N/A'}</p>
                  </div>
                </div>

                {/* Projects */}
                {projects.length > 0 && (
                  <motion.div className="mb-6" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.5 }}>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                      <FaProjectDiagram className="mr-2 text-cyan-500" />Projects ({projects.length})
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {projects.map((p, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors">
                          <div className="flex items-center min-w-0">
                            <span className="w-6 h-6 rounded-full bg-cyan-100 text-cyan-700 text-xs font-bold flex items-center justify-center mr-3 flex-shrink-0">{i+1}</span>
                            <div className="min-w-0">
                              <span className="text-sm text-gray-800 font-medium block truncate">{p.projectName}</span>
                              <span className="text-xs text-gray-500">{p.supervisorName}</span>
                            </div>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2 ${
                            p.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                            p.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}>{p.status}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {projects.length === 0 && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
                    <p className="text-sm text-gray-500">
                      {source?.talentTrailConnected
                        ? 'No project assignments found'
                        : 'No project assignments found in local records'}
                    </p>
                  </div>
                )}

                {/* Subtle offline note — shown only when TalentTrail is unreachable */}
                {source && !source.talentTrailConnected && (
                  <motion.p
                    className="text-xs text-gray-400 text-center mt-2 mb-2"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                  >
                    ℹ Data sourced from local TalentHub records
                  </motion.p>
                )}

                {/* Download button */}
                <div className="flex justify-center pt-4">
                  <motion.button onClick={handleGeneratePDF} disabled={generating}
                    whileHover={{ scale: generating ? 1 : 1.05, y: generating ? 0 : -2 }}
                    whileTap={{ scale: generating ? 1 : 0.95 }}
                    className="flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-2xl text-base font-semibold transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed cursor-pointer">
                    {generating
                      ? <><FaSpinner className="h-5 w-5 animate-spin" /><span>Generating PDF...</span></>
                      : <><FaDownload className="h-5 w-5" /><span>Download Certificate PDF</span></>
                    }
                  </motion.button>
                </div>
              </div>

              {/* Gold bottom bar */}
              <div className="h-2 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminInternCertificate;
