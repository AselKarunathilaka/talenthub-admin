import React, { useState, useEffect } from "react";
import { 
  KeyRound, Users, UserPlus, ShieldCheck, Lock, Eye, EyeOff, Edit, Power, PowerOff, AlertTriangle,
  MessageCircle, Smartphone, RefreshCw, CheckCircle2, XCircle, Unplug, ShieldAlert, Key, Link as LinkIcon, Trash, ListChecks, CheckSquare, Settings2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "react-qr-code";
import { API_ENDPOINTS } from "../api/apiConfig";
import { adminApi, notificationUtils } from "../api/adminApi";
import { getAdminSession } from "../utils/adminAuth";
import AdminNavigation from "../components/AdminNavigation";

const AVAILABLE_PAGES = [
  "Announcements", "Face Attendance", "Inactive Interns", "Intern Attendance", "Leave Management",
  "Logbook Restrictions", "Pin Management", "QR Management", "Seat Management", "TalentHub Restrictions",
  "Universities", "Intern Locations"
];

const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState("security");
  const adminSession = getAdminSession();
  const isSuperAdmin = adminSession?.user?.role === "super_admin";
  const isPM = adminSession?.user?.role === "PM";
  const canManageUsers = isSuperAdmin || isPM || adminSession?.user?.permissions?.includes("users.manage");

  // State: Security Verification Popup
  const [isVerified, setIsVerified] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [showVerifyPassword, setShowVerifyPassword] = useState(false);

  // Tabs states
  const [loading, setLoading] = useState(false);

  // Security Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // WhatsApp Toggles State
  const [toggles, setToggles] = useState({
    location: true,
    attendance: true,
    logbook: true,
    holiday: true,
    lift: true
  });
  const [togglesLoading, setTogglesLoading] = useState(false);

  // WhatsApp Linking State
  const [waStatus, setWaStatus] = useState(null);
  const [waLoading, setWaLoading] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [waDisconnecting, setWaDisconnecting] = useState(false);

  // Data Arrays
  const [users, setUsers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);

  // Modals
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [specModalOpen, setSpecModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Forms
  const [userForm, setUserForm] = useState({ name: "", email: "", role: "admin", isActive: true, password: "", confirmPassword: "", visiblePages: [] });
  const [alertForm, setAlertForm] = useState({ name: "", role: "", subRole: "", email: "", phoneNumber: "" });
  const [specForm, setSpecForm] = useState({ name: "", isNonCoding: false });

  // Security Verify Function
  const handleVerify = async (e) => {
    e.preventDefault();
    if (!verifyPassword) {
      setVerifyError("Security Password is required");
      return;
    }
    setVerifyLoading(true);
    try {
      await adminApi.post(API_ENDPOINTS.ADMIN.SETTINGS.VERIFY_SECURITY, {
        securityPin: verifyPassword,
        action: "Get access to settings page in admin side",
      });
      setIsVerified(true);
      setVerifyError("");
      loadInitialData(); // Load all initial data once verified
    } catch (error) {
      setVerifyError(error.response?.data?.message || "Invalid Security Password");
    } finally {
      setVerifyLoading(false);
    }
  };

  const loadInitialData = () => {
    if (canManageUsers) {
      fetchUsers();
      fetchAlerts();
      fetchSpecs();
      fetchApiKeys();
      fetchToggles();
      fetchWhatsAppStatus();
    }
  };

  useEffect(() => {
    let pollInterval;
    if (isVerified && activeTab === "whatsapp") {
      fetchWhatsAppStatus();
      pollInterval = setInterval(() => {
        fetchWhatsAppStatus(true);
      }, 3000);
    }
    return () => { if (pollInterval) clearInterval(pollInterval); };
  }, [activeTab, isVerified]);

  // -- Data Fetchers --
  const fetchUsers = async () => { try { const res = await adminApi.get(API_ENDPOINTS.ADMIN.SETTINGS.USERS); setUsers(res); } catch (e) { console.error(e); } };
  const fetchAlerts = async () => { try { const res = await adminApi.get(API_ENDPOINTS.ADMIN.SETTINGS.SECURITY_ALERTS); setAlerts(res); } catch (e) { console.error(e); } };
  const fetchSpecs = async () => { try { const res = await adminApi.get(API_ENDPOINTS.ADMIN.SETTINGS.SPECIALIZATIONS); setSpecs(res); } catch (e) { console.error(e); } };
  const fetchApiKeys = async () => { try { const res = await adminApi.get(API_ENDPOINTS.ADMIN.SETTINGS.API_KEYS); setApiKeys(res); } catch (e) { console.error(e); } };
  const fetchToggles = async () => { try { const res = await adminApi.get(API_ENDPOINTS.ADMIN.SETTINGS.TOGGLES); setToggles(res); } catch (e) { console.error(e); } };

  const fetchWhatsAppStatus = async (silent = false) => {
    if (!silent) setWaLoading(true);
    try {
      const data = await adminApi.get(API_ENDPOINTS.ADMIN.SETTINGS.WHATSAPP_STATUS);
      setWaStatus(data);
      if (data?.status === 'WAITING_FOR_SCAN' || data?.status === 'CONNECTED') setIsLinking(false);
    } catch (e) { console.error(e); } finally { if (!silent) setWaLoading(false); }
  };

  // -- Handlers --
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return notificationUtils.showError("Passwords do not match.");
    if (newPassword.length < 6) return notificationUtils.showError("Must be at least 6 characters.");
    setPasswordLoading(true);
    try {
      await adminApi.put(API_ENDPOINTS.ADMIN.SETTINGS.SECURITY_PASSWORD, { currentPassword, newPassword });
      notificationUtils.showSuccess("Password changed successfully.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (e) { notificationUtils.showError(e.response?.data?.message || "Failed to change password."); } finally { setPasswordLoading(false); }
  };

  const handleToggleChange = async (key) => {
    const newToggles = { ...toggles, [key]: !toggles[key] };
    setToggles(newToggles);
    try {
      await adminApi.put(API_ENDPOINTS.ADMIN.SETTINGS.TOGGLES, newToggles);
      notificationUtils.showSuccess("Toggle updated successfully.");
    } catch (e) {
      setToggles(toggles); // revert
      notificationUtils.showError("Failed to update toggle.");
    }
  };

  const handleWhatsAppLink = async () => {
    setIsLinking(true);
    setWaLoading(true);
    try {
      await adminApi.post(API_ENDPOINTS.ADMIN.SETTINGS.WHATSAPP_LINK);
      const poll = setInterval(async () => {
        try {
          const res = await adminApi.get(API_ENDPOINTS.ADMIN.SETTINGS.WHATSAPP_STATUS);
          if (['WAITING_FOR_SCAN', 'CONNECTED', 'ERROR'].includes(res?.status)) {
            clearInterval(poll); setWaStatus(res); setIsLinking(false); setWaLoading(false);
          }
        } catch (e) { clearInterval(poll); }
      }, 1000);
    } catch (e) {
      notificationUtils.showError("Failed to start linking.");
      setIsLinking(false); fetchWhatsAppStatus();
    }
  };

  const handleWhatsAppDisconnect = async () => {
    setWaDisconnecting(true);
    try {
      await adminApi.post(API_ENDPOINTS.ADMIN.SETTINGS.WHATSAPP_DISCONNECT);
      fetchWhatsAppStatus();
    } catch (e) { notificationUtils.showError("Failed to disconnect."); } finally { setWaDisconnecting(false); }
  };

  // -- User CRUD --
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingItem) {
        const payload = { ...userForm };
        if (!payload.password) delete payload.password;
        await adminApi.put(`${API_ENDPOINTS.ADMIN.SETTINGS.USERS}/${editingItem._id}`, payload);
        notificationUtils.showSuccess("User updated.");
      } else {
        if (userForm.password !== userForm.confirmPassword) { setLoading(false); return notificationUtils.showError("Passwords mismatch."); }
        await adminApi.post(API_ENDPOINTS.ADMIN.SETTINGS.USERS, userForm);
        notificationUtils.showSuccess("User created.");
      }
      setUserModalOpen(false); fetchUsers();
    } catch (e) { notificationUtils.showError(e.response?.data?.message || "Failed to save user."); } finally { setLoading(false); }
  };
  
  const deleteUser = async (id) => {
    if (!window.confirm("Delete this user?")) return;
    try { await adminApi.delete(`${API_ENDPOINTS.ADMIN.SETTINGS.USERS}/${id}`); fetchUsers(); notificationUtils.showSuccess("User deleted."); } catch(e) { notificationUtils.showError(e.response?.data?.message || "Failed to delete."); }
  };

  // -- Alert CRUD --
  const handleAlertSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingItem) await adminApi.put(`${API_ENDPOINTS.ADMIN.SETTINGS.SECURITY_ALERTS}/${editingItem._id}`, alertForm);
      else await adminApi.post(API_ENDPOINTS.ADMIN.SETTINGS.SECURITY_ALERTS, alertForm);
      setAlertModalOpen(false); fetchAlerts(); notificationUtils.showSuccess("Alert updated.");
    } catch (e) { notificationUtils.showError("Failed to save alert."); } finally { setLoading(false); }
  };
  const deleteAlert = async (id) => {
    if (!window.confirm("Delete alert?")) return;
    try { await adminApi.delete(`${API_ENDPOINTS.ADMIN.SETTINGS.SECURITY_ALERTS}/${id}`); fetchAlerts(); notificationUtils.showSuccess("Deleted."); } catch(e) {}
  };

  // -- Specialization CRUD --
  const handleSpecSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingItem) await adminApi.put(`${API_ENDPOINTS.ADMIN.SETTINGS.SPECIALIZATIONS}/${editingItem._id}`, specForm);
      else await adminApi.post(API_ENDPOINTS.ADMIN.SETTINGS.SPECIALIZATIONS, specForm);
      setSpecModalOpen(false); fetchSpecs(); notificationUtils.showSuccess("Specialization updated.");
    } catch (e) { notificationUtils.showError("Failed to save."); } finally { setLoading(false); }
  };
  const deleteSpec = async (id) => {
    if (!window.confirm("Delete Specialization?")) return;
    try { await adminApi.delete(`${API_ENDPOINTS.ADMIN.SETTINGS.SPECIALIZATIONS}/${id}`); fetchSpecs(); notificationUtils.showSuccess("Deleted."); } catch(e) {}
  };

  // -- API Key CRUD --
  const generateApiKey = async () => {
    const name = window.prompt("Enter a name for this API Key:");
    if (!name) return;
    try {
      await adminApi.post(API_ENDPOINTS.ADMIN.SETTINGS.API_KEYS, { name });
      fetchApiKeys(); notificationUtils.showSuccess("Key generated.");
    } catch(e) { notificationUtils.showError("Failed to generate."); }
  };
  const deleteApiKey = async (id) => {
    if (!window.confirm("Revoke this API Key?")) return;
    try { await adminApi.delete(`${API_ENDPOINTS.ADMIN.SETTINGS.API_KEYS}/${id}`); fetchApiKeys(); notificationUtils.showSuccess("Revoked."); } catch(e) {}
  };

  const handleVisiblePageToggle = (page) => {
    if (userForm.visiblePages.includes(page)) {
      setUserForm({ ...userForm, visiblePages: userForm.visiblePages.filter(p => p !== page) });
    } else {
      setUserForm({ ...userForm, visiblePages: [...userForm.visiblePages, page] });
    }
  };

  // --- UI Render ---

  return (
    <AdminNavigation>
      <div className="min-h-screen bg-slate-50/50 p-4 md:p-6 lg:p-8 animate-fade-in pb-24">
        <div className="max-w-7xl mx-auto space-y-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="relative flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6 pt-2">
              <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="p-2.5 sm:p-3 md:p-3.5 bg-gradient-to-br from-[#000066] to-[#006600] shadow-md rounded-lg sm:rounded-xl md:rounded-2xl border border-[#006600]/20 flex-shrink-0"
                >
                  <Settings2 className="text-white h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
                </motion.div>
                <div className="flex flex-col justify-center">
                  <motion.h1
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight"
                  >
                    System Settings
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1, duration: 0.3 }}
                    className="text-slate-500 mt-0.5 sm:mt-1 text-xs sm:text-sm md:text-base font-medium max-w-xl"
                  >
                    Global configurations and integrations.
                  </motion.p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex overflow-x-auto space-x-2 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200/60 hide-scrollbar">
            <TabButton active={activeTab === "security"} onClick={() => setActiveTab("security")} icon={ShieldCheck} label="Password" color="blue" />
            <TabButton active={activeTab === "users"} onClick={() => setActiveTab("users")} icon={Users} label="Staff Management" color="indigo" />
            <TabButton active={activeTab === "alerts"} onClick={() => setActiveTab("alerts")} icon={ShieldAlert} label="Security Alerts" color="rose" />
            <TabButton active={activeTab === "whatsapp"} onClick={() => setActiveTab("whatsapp")} icon={MessageCircle} label="WhatsApp" color="emerald" />
            <TabButton active={activeTab === "specializations"} onClick={() => setActiveTab("specializations")} icon={ListChecks} label="Specializations" color="amber" />
            <TabButton active={activeTab === "apikeys"} onClick={() => setActiveTab("apikeys")} icon={Key} label="API Keys" color="slate" />
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden min-h-[500px]">
            {activeTab === "security" && (
              <div className="p-8">
                <div className="max-w-md">
                  <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2"><KeyRound className="w-5 h-5 text-blue-500"/> Change Security Password</h3>
                  <p className="text-sm text-slate-500 mb-8">This password is required for sensitive administrative actions.</p>
                  
                  <form onSubmit={handlePasswordChange} className="space-y-5">
                    <PasswordField label="Current Password" value={currentPassword} onChange={setCurrentPassword} show={showCurrent} setShow={setShowCurrent} />
                    <PasswordField label="New Password" value={newPassword} onChange={setNewPassword} show={showNew} setShow={setShowNew} />
                    <PasswordField label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} show={showConfirm} setShow={setShowConfirm} />
                    <button type="submit" disabled={passwordLoading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20">
                      {passwordLoading ? "Updating..." : "Update Password"}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {activeTab === "users" && (
              <div className="p-0">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-500"/> Staff Management</h3>
                  <button onClick={() => { setEditingItem(null); setUserForm({name:"", email:"", role:"admin", isActive:true, password:"", confirmPassword:"", visiblePages:[]}); setUserModalOpen(true); }} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-all"><UserPlus className="w-4 h-4"/> Add Staff</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50/50 text-slate-500 font-semibold border-b border-slate-100">
                      <tr><th className="px-6 py-4">Name</th><th className="px-6 py-4">Email</th><th className="px-6 py-4">Role</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/60">
                      {users.map(user => (
                        <tr key={user._id} className="hover:bg-slate-50/30 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-800">{user.name}</td>
                          <td className="px-6 py-4 text-slate-500">{user.email}</td>
                          <td className="px-6 py-4"><span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold">{user.role.toUpperCase()}</span></td>
                          <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{user.isActive ? 'Active' : 'Inactive'}</span></td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => { setEditingItem(user); setUserForm({name:user.name, email:user.email, role:user.role, isActive:user.isActive, visiblePages: user.visiblePages || [], password:"", confirmPassword:""}); setUserModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors mx-1"><Edit className="w-4 h-4"/></button>
                            <button onClick={() => deleteUser(user._id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors mx-1"><Trash className="w-4 h-4"/></button>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && <tr><td colSpan="5" className="text-center py-8 text-slate-400">No staff found</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "alerts" && (
              <div className="p-0">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-rose-500"/> Security Alerts Contacts</h3>
                  <button onClick={() => { setEditingItem(null); setAlertForm({name:"", role:"", subRole:"", email:"", phoneNumber:""}); setAlertModalOpen(true); }} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-all"><UserPlus className="w-4 h-4"/> Add Contact</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50/50 text-slate-500 font-semibold border-b border-slate-100">
                      <tr><th className="px-6 py-4">Name</th><th className="px-6 py-4">Role/Sub</th><th className="px-6 py-4">Email</th><th className="px-6 py-4">Phone</th><th className="px-6 py-4 text-right">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/60">
                      {alerts.map(a => (
                        <tr key={a._id} className="hover:bg-slate-50/30 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-800">{a.name}</td>
                          <td className="px-6 py-4 text-slate-500">{a.role} <span className="text-xs text-slate-400">({a.subRole})</span></td>
                          <td className="px-6 py-4 text-slate-500">{a.email}</td>
                          <td className="px-6 py-4 text-slate-500">{a.phoneNumber}</td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => { setEditingItem(a); setAlertForm({name:a.name, role:a.role, subRole:a.subRole, email:a.email, phoneNumber:a.phoneNumber}); setAlertModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors mx-1"><Edit className="w-4 h-4"/></button>
                            <button onClick={() => deleteAlert(a._id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors mx-1"><Trash className="w-4 h-4"/></button>
                          </td>
                        </tr>
                      ))}
                      {alerts.length === 0 && <tr><td colSpan="5" className="text-center py-8 text-slate-400">No alert contacts found</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "specializations" && (
              <div className="p-0">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><ListChecks className="w-5 h-5 text-amber-500"/> Talent Trail Specializations</h3>
                  <button onClick={() => { setEditingItem(null); setSpecForm({name:"", isNonCoding:false}); setSpecModalOpen(true); }} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-all"><UserPlus className="w-4 h-4"/> Add Specialization</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50/50 text-slate-500 font-semibold border-b border-slate-100">
                      <tr><th className="px-6 py-4">Specialization Name</th><th className="px-6 py-4">Category Type</th><th className="px-6 py-4 text-right">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/60">
                      {specs.map(s => (
                        <tr key={s._id} className="hover:bg-slate-50/30 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-800">{s.name}</td>
                          <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${s.isNonCoding ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{s.isNonCoding ? 'Non-Coding Role' : 'Coding Role'}</span></td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => { setEditingItem(s); setSpecForm({name:s.name, isNonCoding:s.isNonCoding}); setSpecModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors mx-1"><Edit className="w-4 h-4"/></button>
                            <button onClick={() => deleteSpec(s._id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors mx-1"><Trash className="w-4 h-4"/></button>
                          </td>
                        </tr>
                      ))}
                      {specs.length === 0 && <tr><td colSpan="3" className="text-center py-8 text-slate-400">No specializations defined</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "apikeys" && (
              <div className="p-0">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Key className="w-5 h-5 text-slate-600"/> API Keys</h3>
                  <button onClick={generateApiKey} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-all"><Key className="w-4 h-4"/> Generate Key</button>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {apiKeys.map(k => (
                      <div key={k._id} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-center justify-between group hover:border-slate-300 transition-all">
                        <div>
                          <p className="font-semibold text-slate-800 mb-1">{k.name}</p>
                          <p className="font-mono text-xs text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded inline-block">{k.key}</p>
                          <p className="text-xs text-slate-400 mt-2">Created: {new Date(k.createdAt).toLocaleDateString()}</p>
                        </div>
                        <button onClick={() => deleteApiKey(k._id)} className="w-10 h-10 bg-white border border-slate-200 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-50 hover:border-rose-200 transition-all shadow-sm"><Trash className="w-4 h-4"/></button>
                      </div>
                    ))}
                    {apiKeys.length === 0 && <div className="col-span-full text-center py-8 text-slate-400">No API Keys generated</div>}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "whatsapp" && (
              <div className="flex flex-col md:flex-row h-full">
                {/* Left side: Toggles */}
                <div className="w-full md:w-1/3 border-r border-slate-100 bg-slate-50/50 p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><Settings2 className="w-5 h-5 text-emerald-600"/> Notification Toggles</h3>
                  <p className="text-sm text-slate-500 mb-6">Select which events trigger WhatsApp and Email notifications.</p>
                  <div className="space-y-4">
                    <ToggleOption label="Location Verification" description="Alert when geofencing is enabled or disabled." enabled={toggles.location} onChange={() => handleToggleChange("location")} />
                    <ToggleOption label="Daily Attendance" description="Alerts for face or QR attendance configurations." enabled={toggles.attendance} onChange={() => handleToggleChange("attendance")} />
                    <ToggleOption label="Logbook Entries" description="Alerts for logbook restrictions and updates." enabled={toggles.logbook} onChange={() => handleToggleChange("logbook")} />
                    <ToggleOption label="Holiday Setup" description="Alerts when system holidays are managed." enabled={toggles.holiday} onChange={() => handleToggleChange("holiday")} />
                    <ToggleOption label="Access Restrictions" description="Alerts for system restrictions lift or revoke." enabled={toggles.lift} onChange={() => handleToggleChange("lift")} />
                  </div>
                </div>
                
                {/* Right side: WhatsApp Linking */}
                <div className="w-full md:w-2/3 p-6 md:p-12 flex flex-col items-center justify-center relative overflow-hidden bg-white">
                  {isLinking || (waLoading && !waStatus) || waStatus?.status === 'INITIALIZING' ? (
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin mb-4" />
                      <p className="text-slate-500 font-medium">Establishing connection...</p>
                    </div>
                  ) : waStatus?.status === 'WAITING_FOR_SCAN' ? (
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-slate-800 mb-2">Link Device</h3>
                      <p className="text-sm text-slate-500 mb-8 max-w-xs mx-auto">Open WhatsApp on your phone, go to Linked Devices, and scan this code.</p>
                      <div className="bg-white p-4 rounded-3xl shadow-lg border border-slate-100 mb-6 inline-block">
                        {waStatus?.qrCode ? <QRCode value={waStatus.qrCode} size={220} level="H" /> : <div className="w-[220px] h-[220px] bg-slate-50 animate-pulse rounded-2xl" />}
                      </div>
                      <p className="text-emerald-600 font-medium animate-pulse text-sm">Waiting for scan...</p>
                    </div>
                  ) : waStatus?.status === 'CONNECTED' ? (
                    <div className="text-center">
                      <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-500 shadow-inner border border-emerald-100">
                        <CheckCircle2 className="w-12 h-12" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-2">WhatsApp Linked</h3>
                      <p className="text-sm text-slate-500 mb-8">Active Account: <strong>{waStatus?.connectedNumber}</strong></p>
                      <button onClick={handleWhatsAppDisconnect} disabled={waDisconnecting} className="px-8 py-3 bg-rose-50 text-rose-600 font-semibold rounded-xl hover:bg-rose-100 transition-colors border border-rose-200 inline-flex items-center gap-2">
                        <Unplug className="w-4 h-4"/> Disconnect Device
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400 border border-slate-100">
                        <MessageCircle className="w-12 h-12" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-2">Not Connected</h3>
                      <p className="text-sm text-slate-500 mb-8 max-w-xs mx-auto">Link your WhatsApp account to enable automated messages.</p>
                      <button onClick={handleWhatsAppLink} className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 transition-all inline-flex items-center gap-2">
                        <Smartphone className="w-4 h-4"/> Generate QR Code
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- Modals --- */}
      {/* Staff Modal */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">{editingItem ? "Edit Staff Member" : "Add Staff Member"}</h3>
              <button onClick={() => setUserModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6"/></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleUserSubmit} className="space-y-4">
                <div><label className="block text-sm font-semibold text-slate-700 mb-1">Name</label><input required className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none text-sm" value={userForm.name} onChange={e=>setUserForm({...userForm, name: e.target.value})} /></div>
                <div><label className="block text-sm font-semibold text-slate-700 mb-1">Email</label><input type="email" required disabled={!!editingItem} className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none text-sm disabled:opacity-50" value={userForm.email} onChange={e=>setUserForm({...userForm, email: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-semibold text-slate-700 mb-1">Role</label><select className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none text-sm" value={userForm.role} onChange={e=>setUserForm({...userForm, role: e.target.value})}><option value="super_admin">Super Admin</option><option value="admin">Admin</option><option value="PM">PM</option><option value="supervisor">Supervisor</option><option value="developer">Developer</option></select></div>
                  <div><label className="block text-sm font-semibold text-slate-700 mb-1">Status</label><select className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none text-sm" value={userForm.isActive.toString()} onChange={e=>setUserForm({...userForm, isActive: e.target.value === 'true'})}><option value="true">Active</option><option value="false">Inactive</option></select></div>
                </div>
                
                {/* Visible Pages Multi-Select */}
                <div className="pt-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Visible Pages <span className="text-xs font-normal text-slate-400">(N/A for Super Admin/PM)</span></label>
                  <div className={`grid grid-cols-2 gap-2 border border-slate-200 rounded-xl p-3 bg-slate-50 max-h-40 overflow-y-auto ${['super_admin', 'PM'].includes(userForm.role) ? 'opacity-50 pointer-events-none' : ''}`}>
                    {AVAILABLE_PAGES.map(page => (
                      <label key={page} className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 hover:text-slate-900">
                        <input type="checkbox" checked={userForm.visiblePages.includes(page)} onChange={() => handleVisiblePageToggle(page)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        {page}
                      </label>
                    ))}
                  </div>
                </div>

                {!editingItem && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div><label className="block text-sm font-semibold text-slate-700 mb-1">Password</label><input type="password" required className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none text-sm" value={userForm.password} onChange={e=>setUserForm({...userForm, password: e.target.value})} /></div>
                    <div><label className="block text-sm font-semibold text-slate-700 mb-1">Confirm Password</label><input type="password" required className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none text-sm" value={userForm.confirmPassword} onChange={e=>setUserForm({...userForm, confirmPassword: e.target.value})} /></div>
                  </div>
                )}
                {editingItem && (
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-xs text-slate-400 mb-2">Leave blank to keep current password</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div><input type="password" placeholder="New Password" className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none text-sm" value={userForm.password} onChange={e=>setUserForm({...userForm, password: e.target.value})} /></div>
                      <div><input type="password" placeholder="Confirm Password" className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none text-sm" value={userForm.confirmPassword} onChange={e=>setUserForm({...userForm, confirmPassword: e.target.value})} /></div>
                    </div>
                  </div>
                )}
                <div className="pt-4"><button disabled={loading} type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md disabled:opacity-70">{loading ? "Saving..." : "Save Staff Member"}</button></div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Security Alert Modal */}
      {alertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">{editingItem ? "Edit Contact" : "Add Alert Contact"}</h3>
              <button onClick={() => setAlertModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6"/></button>
            </div>
            <div className="p-6">
              <form onSubmit={handleAlertSubmit} className="space-y-4">
                <div><label className="block text-sm font-semibold text-slate-700 mb-1">Name</label><input required className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 outline-none text-sm focus:border-rose-500" value={alertForm.name} onChange={e=>setAlertForm({...alertForm, name:e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-semibold text-slate-700 mb-1">Role</label><input required className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 outline-none text-sm focus:border-rose-500" value={alertForm.role} onChange={e=>setAlertForm({...alertForm, role:e.target.value})} /></div>
                  <div><label className="block text-sm font-semibold text-slate-700 mb-1">Sub Role</label><input required className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 outline-none text-sm focus:border-rose-500" value={alertForm.subRole} onChange={e=>setAlertForm({...alertForm, subRole:e.target.value})} /></div>
                </div>
                <div><label className="block text-sm font-semibold text-slate-700 mb-1">Email</label><input type="email" required className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 outline-none text-sm focus:border-rose-500" value={alertForm.email} onChange={e=>setAlertForm({...alertForm, email:e.target.value})} /></div>
                <div><label className="block text-sm font-semibold text-slate-700 mb-1">WhatsApp Phone (with Country Code)</label><input type="text" placeholder="e.g. 94701234567" required className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 outline-none text-sm focus:border-rose-500" value={alertForm.phoneNumber} onChange={e=>setAlertForm({...alertForm, phoneNumber:e.target.value})} /></div>
                <div className="pt-2"><button disabled={loading} type="submit" className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-md">{loading ? "Saving..." : "Save Contact"}</button></div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Specialization Modal */}
      {specModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">{editingItem ? "Edit Specialization" : "Add Specialization"}</h3>
              <button onClick={() => setSpecModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6"/></button>
            </div>
            <div className="p-6">
              <form onSubmit={handleSpecSubmit} className="space-y-4">
                <div><label className="block text-sm font-semibold text-slate-700 mb-1">Specialization Name</label><input required className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 outline-none text-sm focus:border-amber-500" value={specForm.name} onChange={e=>setSpecForm({...specForm, name:e.target.value})} /></div>
                <div className="flex items-center gap-3 pt-2">
                  <input type="checkbox" id="noncoding" checked={specForm.isNonCoding} onChange={e=>setSpecForm({...specForm, isNonCoding:e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
                  <label htmlFor="noncoding" className="text-sm font-semibold text-slate-700 cursor-pointer">Mark as Non-Coding Role (e.g. BA, QA, DevOps)</label>
                </div>
                <div className="pt-4"><button disabled={loading} type="submit" className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold shadow-md">{loading ? "Saving..." : "Save Specialization"}</button></div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Security Check Backdrop & Modal */}
      <AnimatePresence>
        {!isVerified && (
          <motion.div
            key="security-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[20] pointer-events-auto bg-slate-900/60 backdrop-blur-md"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isVerified && (
          <motion.div key="security-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[22] pointer-events-none">
            <div className="fixed left-0 lg:left-[260px] right-0 bottom-[80px] lg:bottom-[40px] top-[64px] z-[50] pointer-events-none flex flex-col items-center justify-center px-4 pt-6 pb-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: "spring", damping: 26, stiffness: 320 }}
                className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-8 w-full max-w-md pointer-events-auto relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600" />
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
                    <ShieldCheck className="w-8 h-8 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Security Check</h2>
                  <p className="text-sm text-slate-500 mt-2">Enter the global security password to access system settings.</p>
                </div>
                
                <form onSubmit={handleVerify} className="space-y-6">
                  <div>
                    <div className="relative group">
                      <input
                        type={showVerifyPassword ? "text" : "password"}
                        value={verifyPassword}
                        onChange={(e) => { setVerifyPassword(e.target.value); setVerifyError(""); }}
                        className="w-full px-4 py-3 pl-11 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700"
                        placeholder="Enter security password"
                      />
                      <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-500 transition-colors" />
                      <button 
                        type="button" 
                        onClick={() => setShowVerifyPassword(!showVerifyPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                      >
                        {showVerifyPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {verifyError && <p className="text-rose-500 text-sm mt-2 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4"/> {verifyError}</p>}
                  </div>
                  
                  <button
                    type="submit"
                    disabled={verifyLoading || !verifyPassword}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 transition-all flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {verifyLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Verify Access"}
                  </button>
                </form>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </AdminNavigation>
  );
};

// --- Subcomponents ---

const TabButton = ({ active, onClick, icon: Icon, label, color }) => {
  const colorMap = {
    blue: "text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100",
    indigo: "text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100",
    rose: "text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100",
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
    amber: "text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100",
    slate: "text-slate-700 bg-slate-100 border-slate-300 hover:bg-slate-200",
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border shrink-0 ${
        active ? colorMap[color] + " shadow-sm ring-1 ring-slate-900/5" : "text-slate-500 bg-transparent border-transparent hover:bg-slate-50 hover:text-slate-700"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
};

const PasswordField = ({ label, value, onChange, show, setShow }) => (
  <div>
    <label className="text-sm font-semibold text-slate-700 block mb-1.5">{label}</label>
    <div className="relative group">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700"
      />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
        {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  </div>
);

const ToggleOption = ({ label, description, enabled, onChange }) => (
  <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:border-emerald-200 transition-colors cursor-pointer" onClick={onChange}>
    <div>
      <p className="font-semibold text-slate-800">{label}</p>
      <p className="text-xs text-slate-500 mt-0.5">{description}</p>
    </div>
    <div className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
    </div>
  </div>
);

export default AdminSettings;
