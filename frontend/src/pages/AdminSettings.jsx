import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  KeyRound, Users, UserPlus, ShieldCheck, Lock, Eye, EyeOff, Edit, Power, PowerOff, AlertTriangle,
  MessageCircle, Smartphone, RefreshCw, CheckCircle2, XCircle, Unplug, ShieldAlert, Key, Link as LinkIcon, Trash, ListChecks, CheckSquare, Settings2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "react-qr-code";
import { API_ENDPOINTS } from "../api/apiConfig";
import { adminApi } from "../api/adminApi";
import { getAdminSession } from "../utils/adminAuth";
import AdminNavigation from "../components/AdminNavigation";

const AVAILABLE_PAGES = [
  "Dashboard", "Daily Logs", "Intern Attendance", "Face Attendance", "QR Management", 
  "Pin Management", "Short Leave", "Extended Leave", "Intern Locations", "Seat Management", 
  "Analytics", "Universities", "Inactive Interns", "Logbook Restrictions", 
  "TalentHub Restrictions", "Announcements", "Holidays", "Settings"
];

const Toast = ({ toast, onDismiss }) => (
  <AnimatePresence>
    {toast && (
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className={`fixed bottom-6 right-6 z-[9999] flex items-center space-x-3 px-5 py-3 rounded-2xl shadow-xl border max-w-sm ${
          toast.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : toast.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-blue-50 border-blue-200 text-blue-800"
        }`}
      >
        {toast.type === "success" ? (
          <CheckCircle2 className="flex-shrink-0 h-5 w-5 text-emerald-500" />
        ) : toast.type === "error" ? (
          <AlertTriangle className="flex-shrink-0 h-5 w-5 text-rose-500" />
        ) : (
          <MessageCircle className="flex-shrink-0 h-5 w-5 text-blue-500" />
        )}
        <p className="text-sm font-bold flex-1">{toast.message}</p>
        <button onClick={onDismiss} className="opacity-60 hover:opacity-100 p-1 cursor-pointer">
          <XCircle className="h-4 w-4" />
        </button>
      </motion.div>
    )}
  </AnimatePresence>
);

const AdminSettings = () => {
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: "", message: "", type: "confirm", value: "", onConfirm: null });
  const openConfirmDialog = (title, message, onConfirm) => setConfirmDialog({ isOpen: true, title, message, type: "confirm", value: "", onConfirm });
  const showPrompt = (title, message, onConfirm) => setConfirmDialog({ isOpen: true, title, message, type: "prompt", value: "", onConfirm });

  const showToast = (message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const [activeTab, setActiveTab] = useState("security");
  const [activeRoleTab, setActiveRoleTab] = useState("all");
  const adminSession = getAdminSession();
  const isSuperAdmin = adminSession?.user?.role === "super_admin";
  const isPM = adminSession?.user?.role === "PM";
  const canManageUsers = isSuperAdmin || isPM || adminSession?.user?.permissions?.includes("users.manage");

  // State: Security Verification Popup
  const [isVerified, setIsVerified] = useState(adminSession?.user?.requireSecurityCheck === false);
  const [verifyPassword, setVerifyPassword] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [showVerifyPassword, setShowVerifyPassword] = useState(false);

  // Tabs states
  const [loading, setLoading] = useState(false);
  const [togglePrompt, setTogglePrompt] = useState({ isOpen: false, key: null, password: "" });

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
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Forms
  const [userForm, setUserForm] = useState({ name: "", email: "", role: "admin", isActive: true, password: "", confirmPassword: "", visiblePages: [], requireSecurityCheck: true });
  const [alertForm, setAlertForm] = useState({ name: "", role: "", subRole: "", email: "", phoneNumber: "" });
  const [specForm, setSpecForm] = useState({ name: "", isNonCoding: false });
  const [apiForm, setApiForm] = useState({ name: "", accessiblePages: [], expiresInDays: "never" });

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
    if (isVerified) {
      loadInitialData();
    }
  }, []);

  useEffect(() => {
    let pollInterval;
    if (isVerified && activeTab === "alerts") {
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
    if (newPassword !== confirmPassword) return showToast("Passwords do not match.", "error");
    if (newPassword.length < 6) return showToast("Must be at least 6 characters.", "error");
    setPasswordLoading(true);
    try {
      await adminApi.put(API_ENDPOINTS.ADMIN.SETTINGS.SECURITY_PASSWORD, { currentPassword, newPassword });
      showToast("Password changed successfully.", "success");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (e) { showToast(e.response?.data?.message || "Failed to change password.", "error"); } finally { setPasswordLoading(false); }
  };

  const executeToggleActual = async (key) => {
    setLoading(true);
    try {
      const newToggles = { ...toggles, [key]: !toggles[key] };
      await adminApi.put(API_ENDPOINTS.ADMIN.SETTINGS.TOGGLES, newToggles);
      setToggles(newToggles);
      const statusText = newToggles[key] ? 'ON' : 'OFF';
      showToast(`Notification for ${key} turned ${statusText}.`, "success");
    } catch (e) {
      showToast("Failed to change toggle.", "error");
    } finally {
      setLoading(false);
    }
  };

  const requestToggleChange = (key) => {
    const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
    if (adminInfo?.user?.requireSecurityCheck === false) {
      executeToggleActual(key);
      return;
    }
    setTogglePrompt({ isOpen: true, key, password: "" });
  };

  const handleToggleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const statusText = toggles[togglePrompt.key] ? 'OFF' : 'ON';
      await adminApi.post(API_ENDPOINTS.ADMIN.SETTINGS.VERIFY_SECURITY, {
        securityPin: togglePrompt.password,
        action: `Turned ${statusText} WhatsApp Notification for ${togglePrompt.key}`,
      });
      
      const newToggles = { ...toggles, [togglePrompt.key]: !toggles[togglePrompt.key] };
      await adminApi.put(API_ENDPOINTS.ADMIN.SETTINGS.TOGGLES, newToggles);
      setToggles(newToggles);
      showToast(`Notification for ${togglePrompt.key} turned ${statusText}.`, "success");
      setTogglePrompt({ isOpen: false, key: null, password: "" });
    } catch (e) {
      showToast(e.response?.data?.message || "Invalid Security Password", "error");
    } finally {
      setLoading(false);
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
      showToast("Failed to start linking.", "error");
      setIsLinking(false); fetchWhatsAppStatus();
    }
  };

  const handleWhatsAppDisconnect = async () => {
    setWaDisconnecting(true);
    try {
      await adminApi.post(API_ENDPOINTS.ADMIN.SETTINGS.WHATSAPP_DISCONNECT);
      fetchWhatsAppStatus();
    } catch (e) { showToast("Failed to disconnect.", "error"); } finally { setWaDisconnecting(false); }
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
        showToast("User updated.", "success");
      } else {
        if (userForm.password !== userForm.confirmPassword) { setLoading(false); return showToast("Passwords mismatch.", "error"); }
        await adminApi.post(API_ENDPOINTS.ADMIN.SETTINGS.USERS, userForm);
        showToast("User created.", "success");
      }
      setUserModalOpen(false); fetchUsers();
    } catch (e) { showToast(e.response?.data?.message || "Failed to save user.", "error"); } finally { setLoading(false); }
  };
  
  const deleteUser = async (id) => {
    openConfirmDialog("Delete User", "Are you sure you want to delete this user?", async () => {
      try { await adminApi.delete(`${API_ENDPOINTS.ADMIN.SETTINGS.USERS}/${id}`); fetchUsers(); showToast("User deleted.", "success"); } catch(e) { showToast(e.response?.data?.message || "Failed to delete.", "error"); }
    });
  };

  const toggleUserSecurityCheck = async (user) => {
    // Optimistic UI update for immediate response
    const newVal = user.requireSecurityCheck === false ? true : false;
    setUsers(prevUsers => prevUsers.map(u => u._id === user._id ? { ...u, requireSecurityCheck: newVal } : u));
    
    try {
      await adminApi.put(`${API_ENDPOINTS.ADMIN.SETTINGS.USERS}/${user._id}`, { ...user, requireSecurityCheck: newVal });
      showToast(`Security check for ${user.name} turned ${newVal ? 'ON' : 'OFF'}`, "success");

      if (adminSession?.user?._id === user._id || adminSession?.user?.id === user._id) {
        const updatedSession = { ...adminSession, user: { ...adminSession.user, requireSecurityCheck: newVal } };
        localStorage.setItem("adminInfo", JSON.stringify(updatedSession));
      }
    } catch(e) {
      // Revert on error
      setUsers(prevUsers => prevUsers.map(u => u._id === user._id ? { ...u, requireSecurityCheck: user.requireSecurityCheck } : u));
      showToast("Failed to update security check", "error");
    }
  };

  // -- Alert CRUD --
  const handleAlertSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingItem) await adminApi.put(`${API_ENDPOINTS.ADMIN.SETTINGS.SECURITY_ALERTS}/${editingItem._id}`, alertForm);
      else await adminApi.post(API_ENDPOINTS.ADMIN.SETTINGS.SECURITY_ALERTS, alertForm);
      setAlertModalOpen(false); fetchAlerts(); showToast("Alert updated.", "success");
    } catch (e) { showToast("Failed to save alert.", "error"); } finally { setLoading(false); }
  };
  const deleteAlert = async (id) => {
    openConfirmDialog("Delete Alert Contact", "Are you sure you want to delete this alert contact?", async () => {
      try { await adminApi.delete(`${API_ENDPOINTS.ADMIN.SETTINGS.SECURITY_ALERTS}/${id}`); fetchAlerts(); showToast("Deleted.", "success"); } catch(e) {}
    });
  };

  // -- Specialization CRUD --
  const handleSpecSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingItem) await adminApi.put(`${API_ENDPOINTS.ADMIN.SETTINGS.SPECIALIZATIONS}/${editingItem._id}`, specForm);
      else await adminApi.post(API_ENDPOINTS.ADMIN.SETTINGS.SPECIALIZATIONS, specForm);
      setSpecModalOpen(false); fetchSpecs(); showToast("Specialization updated.", "success");
    } catch (e) { showToast("Failed to save.", "error"); } finally { setLoading(false); }
  };
  const deleteSpec = async (id) => {
    openConfirmDialog("Delete Specialization", "Are you sure you want to delete this specialization?", async () => {
      try { await adminApi.delete(`${API_ENDPOINTS.ADMIN.SETTINGS.SPECIALIZATIONS}/${id}`); fetchSpecs(); showToast("Deleted.", "success"); } catch(e) {}
    });
  };

  // -- API Key CRUD --
  const handleApiSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminApi.post(API_ENDPOINTS.ADMIN.SETTINGS.API_KEYS, apiForm);
      setApiKeyModalOpen(false);
      fetchApiKeys();
      showToast("Key generated.", "success");
    } catch(e) {
      showToast("Failed to generate API Key.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleApiVisiblePageToggle = (page) => {
    if (apiForm.accessiblePages.includes(page)) {
      setApiForm({ ...apiForm, accessiblePages: apiForm.accessiblePages.filter(p => p !== page) });
    } else {
      setApiForm({ ...apiForm, accessiblePages: [...apiForm.accessiblePages, page] });
    }
  };
  const deleteApiKey = async (id) => {
    openConfirmDialog("Revoke API Key", "Are you sure you want to revoke this API Key?", async () => {
      try { await adminApi.delete(`${API_ENDPOINTS.ADMIN.SETTINGS.API_KEYS}/${id}`); fetchApiKeys(); showToast("Revoked.", "success"); } catch(e) {}
    });
  };

  const handleVisiblePageToggle = (page) => {
    if (userForm.visiblePages.includes(page)) {
      setUserForm({ ...userForm, visiblePages: userForm.visiblePages.filter(p => p !== page) });
    } else {
      setUserForm({ ...userForm, visiblePages: [...userForm.visiblePages, page] });
    }
  };

  // --- UI Render ---
  const standardRoles = ["super_admin", "PM", "admin", "supervisor", "developer"];
  const extraRoles = [...new Set(users.map(u => u.role))].filter(r => r && !standardRoles.includes(r));
  const roleGroups = [
    { key: "super_admin", label: "Super Admins", color: "text-purple-700 bg-purple-50 ring-purple-600/20", iconColor: "text-purple-500" },
    { key: "PM", label: "Project Managers", color: "text-amber-700 bg-amber-50 ring-amber-600/20", iconColor: "text-amber-500" },
    { key: "admin", label: "Administrators", color: "text-indigo-700 bg-indigo-50 ring-indigo-600/20", iconColor: "text-indigo-500" },
    { key: "supervisor", label: "Supervisors", color: "text-sky-700 bg-sky-50 ring-sky-600/20", iconColor: "text-sky-500" },
    { key: "developer", label: "Developers", color: "text-emerald-700 bg-emerald-50 ring-emerald-600/20", iconColor: "text-emerald-500" },
    ...extraRoles.map(r => ({
      key: r, label: (r.charAt(0).toUpperCase() + r.slice(1)).replace(/_/g, ' ') + " (Legacy)", color: "text-slate-700 bg-slate-50 ring-slate-600/20", iconColor: "text-slate-500"
    }))
  ];

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
            <TabButton active={activeTab === "users"} onClick={() => setActiveTab("users")} icon={Users} label="Staff & Login Management" color="indigo" />
            <TabButton active={activeTab === "alerts"} onClick={() => setActiveTab("alerts")} icon={ShieldAlert} label="Security Alerts" color="rose" />
            <TabButton active={activeTab === "apikeys"} onClick={() => setActiveTab("apikeys")} icon={Key} label="API Keys" color="slate" />
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden min-h-[500px]">
            {activeTab === "security" && (
              <div className="p-8 flex justify-center">
                <div className="max-w-md w-full">
                  <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center justify-center gap-2"><KeyRound className="w-5 h-5 text-blue-500"/> Change Security Password</h3>
                  <p className="text-sm text-slate-500 mb-8 text-center">This password is required for sensitive administrative actions.</p>
                  
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
              <div className="p-0 flex flex-col min-h-[500px]">
                  <div className="p-6 border-b border-slate-100 flex flex-col gap-6 bg-slate-50/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-500"/> Staff & Login Management</h3>
                        <p className="text-sm text-slate-500 mt-1">Manage platform access, roles, and credentials</p>
                      </div>
                      <button onClick={() => { setEditingItem(null); setUserForm({name:"", email:"", role:"admin", isActive:true, password:"", confirmPassword:"", visiblePages:[], authProvider: "developer_password"}); setUserModalOpen(true); }} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-all"><UserPlus className="w-4 h-4"/> Add Staff</button>
                    </div>

                    {/* Role Filter Toggles */}
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: "all", label: "Email and password login" },
                        { id: "super_admin", label: "Super Admins" },
                        { id: "admin", label: "Admins" },
                        { id: "supervisor", label: "Supervisors" },
                        { id: "developer", label: "Developers" },
                        { id: "PM", label: "Project Managers" }
                      ].map((tab) => {
                        const count = users.filter(u => {
                          if (tab.id === "all" && (u.authProvider === "google" || u.googleSubject)) return false;
                          if (tab.id === "all") return true;
                          return u.role === tab.id;
                        }).length;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveRoleTab(tab.id)}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                              activeRoleTab === tab.id
                                ? "bg-indigo-600 text-white border border-transparent shadow-md shadow-indigo-500/20"
                                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                            }`}
                          >
                          {tab.label} ({count})
                        </button>
                      )})}
                    </div>
                  </div>
                  
                  <div className="p-6 space-y-8 bg-slate-50/30 flex-1">
                    {(() => {
                      const filteredUsers = users.filter(u => {
                        if (activeRoleTab !== "all" && u.role !== activeRoleTab) return false;
                        if (activeRoleTab === "all" && (u.authProvider === "google" || u.googleSubject)) return false;
                        return true;
                      });
                      
                      if (filteredUsers.length === 0) {
                        return (
                          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed">
                            <Users className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                            <h4 className="text-sm font-semibold text-slate-600">No staff found</h4>
                            <p className="text-xs text-slate-400 mt-1">Add staff members to grant them admin access.</p>
                          </div>
                        );
                      }
                      
                      return (
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                              <thead className="text-slate-400 font-medium border-b border-slate-100 bg-white">
                                <tr>
                                  <th className="px-5 py-3">Name</th>
                                  <th className="px-5 py-3">Email</th>
                                  <th className="px-5 py-3 text-center">Password</th>
                                  <th className="px-5 py-3 text-center w-1/6">Status</th>
                                  <th className="px-5 py-3 text-center w-1/6">Visible Pages</th>
                                  <th className="px-5 py-3 text-center w-1/6">Security Check</th>
                                  <th className="px-5 py-3 text-center">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {filteredUsers.map(user => {
                                  const iconColor = user.role === 'super_admin' ? 'text-purple-500 bg-purple-100' :
                                                    user.role === 'PM' ? 'text-amber-500 bg-amber-100' :
                                                    user.role === 'admin' ? 'text-indigo-500 bg-indigo-100' :
                                                    user.role === 'supervisor' ? 'text-sky-500 bg-sky-100' :
                                                    user.role === 'developer' ? 'text-emerald-500 bg-emerald-100' :
                                                    'text-slate-500 bg-slate-100';
                                  
                                  const authMethod = (user.authProvider === 'google' || user.googleSubject) ? 'Google SSO' : '••••••••';
                                  
                                  return (
                                  <tr key={user._id} className="hover:bg-slate-50/50 transition-colors group/row">
                                    <td className="px-5 py-3.5">
                                      <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${iconColor}`}>
                                          {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-medium text-slate-700">{user.name}</span>
                                      </div>
                                    </td>
                                    <td className="px-5 py-3.5 text-slate-500 font-medium">{user.email}</td>
                                    <td className="px-5 py-3.5 text-center text-slate-400 font-mono tracking-widest">{authMethod}</td>
                                    <td className="px-5 py-3.5 text-center">
                                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${user.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' : 'bg-slate-100 text-slate-500 border border-slate-200/50'}`}>
                                        {user.isActive ? 'Active' : 'Disabled'}
                                      </span>
                                    </td>
                                    <td className="px-5 py-3.5 text-center">
                                      {['super_admin', 'PM'].includes(user.role) ? (
                                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full border border-indigo-100">
                                          All
                                        </span>
                                      ) : user.visiblePages && user.visiblePages.length > 0 ? (
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full border border-slate-200">
                                          {user.visiblePages.length} Pages
                                        </span>
                                      ) : (
                                        <span className="text-xs text-slate-400">-</span>
                                      )}
                                    </td>
                                    <td className="px-5 py-3.5 text-center">
                                      <div className="flex items-center justify-center">
                                        <div className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors cursor-pointer ${user.requireSecurityCheck !== false ? 'bg-indigo-500' : 'bg-slate-300'}`} onClick={() => toggleUserSecurityCheck(user)}>
                                          <div className={`inline-block w-4 h-4 bg-white rounded-full transition-transform ${user.requireSecurityCheck !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-5 py-3.5 text-center">
                                      <div className="flex items-center justify-center gap-3">
                                        <div className="flex items-center gap-1 transition-opacity">
                                          <button onClick={() => { setEditingItem(user); setUserForm({name:user.name, email:user.email, role:user.role, isActive:user.isActive, visiblePages: user.visiblePages || [], password:"", confirmPassword:"", authProvider: user.authProvider || (user.googleSubject ? "google" : "developer_password"), requireSecurityCheck: user.requireSecurityCheck !== false}); setUserModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit Staff">
                                            <Edit className="w-4 h-4"/>
                                          </button>
                                          <button onClick={() => deleteUser(user._id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete Staff">
                                            <Trash className="w-4 h-4"/>
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )})}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
              </div>
            )}
            {activeTab === "alerts" && (
              <div className="p-0">
                {/* WhatsApp Linking Panel */}
                <div>
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-emerald-500" />
                    <h3 className="text-base font-bold text-slate-800">WhatsApp Link</h3>
                    {waStatus?.status === 'CONNECTED' && (
                      <span className="ml-auto px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Connected
                      </span>
                    )}
                  </div>
                  <div className="p-6">
                    {(waLoading && !waStatus) || waStatus?.status === 'INITIALIZING' || isLinking ? (
                      <div className="flex items-center gap-3 text-slate-500">
                        <div className="w-5 h-5 border-2 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
                        <span className="text-sm font-medium">Establishing connection...</span>
                      </div>
                    ) : waStatus?.status === 'WAITING_FOR_SCAN' ? (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                        <div className="bg-white p-3 rounded-2xl shadow border border-slate-100 flex-shrink-0">
                          {waStatus?.qrCode ? <QRCode value={waStatus.qrCode} size={150} level="H" /> : <div className="w-[150px] h-[150px] bg-slate-50 animate-pulse rounded-xl" />}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 mb-1">Scan QR Code</p>
                          <p className="text-sm text-slate-500">Open WhatsApp → Linked Devices → Link a Device, then scan this code.</p>
                          <p className="text-emerald-600 font-medium animate-pulse text-xs mt-3">Waiting for scan...</p>
                        </div>
                      </div>
                    ) : waStatus?.status === 'CONNECTED' ? (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">WhatsApp Linked</p>
                            <p className="text-xs text-slate-500">Account: <strong>{waStatus?.connectedNumber}</strong></p>
                          </div>
                        </div>
                        <button onClick={handleWhatsAppDisconnect} disabled={waDisconnecting} className="ml-auto px-4 py-2 bg-rose-50 text-rose-600 text-sm font-semibold rounded-xl hover:bg-rose-100 transition-colors border border-rose-200 inline-flex items-center gap-2 flex-shrink-0">
                          <Unplug className="w-4 h-4" /> Disconnect
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                          <MessageCircle className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">Not Connected</p>
                          <p className="text-xs text-slate-500">Link your WhatsApp to enable automated alert messages.</p>
                        </div>
                        <button onClick={handleWhatsAppLink} className="ml-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl shadow-sm transition-all inline-flex items-center gap-2 flex-shrink-0">
                          <Smartphone className="w-4 h-4" /> Generate QR
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Security Alerts Contacts Panel */}
                <div className="border-t border-slate-100">
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
              </div>
            )}

            {activeTab === "apikeys" && (
              <div className="p-0">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Key className="w-5 h-5 text-slate-600"/> API Keys</h3>
                  <button onClick={() => { setApiForm({ name: "", accessiblePages: [], expiresInDays: "never" }); setApiKeyModalOpen(true); }} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-all"><Key className="w-4 h-4"/> Generate Key</button>
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
                  <p className="text-sm text-slate-500 mb-6">Select which events trigger WhatsApp notifications.</p>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {AVAILABLE_PAGES.map(page => (
                      <ToggleOption 
                        key={page} 
                        label={page} 
                        description={`Alerts for activities in ${page}.`} 
                        enabled={toggles[page] || false} 
                        onChange={() => requestToggleChange(page)} 
                      />
                    ))}
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
        <>
          <div className="fixed inset-0 z-[20] pointer-events-auto bg-slate-900/50 backdrop-blur-sm" />
          <div className="fixed left-0 lg:left-[260px] right-0 bottom-[80px] lg:bottom-[40px] top-[64px] z-[60] pointer-events-none flex items-center justify-center p-4 overflow-hidden">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] pointer-events-auto">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">{editingItem ? "Edit Staff Member" : "Add Staff Member"}</h3>
              <button onClick={() => setUserModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6"/></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleUserSubmit} className="space-y-4">
                
                {!editingItem && (
                  <div className="flex gap-2 mb-4 p-1 bg-slate-100 rounded-xl">
                    <button type="button" onClick={() => setUserForm({...userForm, authProvider: 'developer_password'})} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${userForm.authProvider === 'developer_password' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Email & Password</button>
                    <button type="button" onClick={() => setUserForm({...userForm, authProvider: 'google'})} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${userForm.authProvider === 'google' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Google Login</button>
                  </div>
                )}

                <div><label className="block text-sm font-semibold text-slate-700 mb-1">Name</label><input required className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none text-sm" value={userForm.name} onChange={e=>setUserForm({...userForm, name: e.target.value})} /></div>
                <div><label className="block text-sm font-semibold text-slate-700 mb-1">{userForm.authProvider === 'google' ? 'Gmail Address' : 'Email'}</label><input type="email" required disabled={!!editingItem} className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none text-sm disabled:opacity-50" value={userForm.email} onChange={e=>setUserForm({...userForm, email: e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-semibold text-slate-700 mb-1">Role</label><select className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none text-sm" value={userForm.role} onChange={e=>{
                      const newRole = e.target.value;
                      let newVisiblePages = userForm.visiblePages;
                      if (newRole === 'admin' || newRole === 'developer') {
                        newVisiblePages = AVAILABLE_PAGES.filter(p => p !== 'Settings');
                      } else if (newRole === 'supervisor' || newRole === 'super_admin' || newRole === 'PM') {
                        newVisiblePages = [];
                      }
                      setUserForm({...userForm, role: newRole, visiblePages: newVisiblePages});
                    }}><option value="super_admin">Super Admin</option><option value="admin">Admin</option><option value="PM">PM</option><option value="supervisor">Supervisor</option><option value="developer">Developer</option></select></div>
                    <div><label className="block text-sm font-semibold text-slate-700 mb-1">Status</label><select className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none text-sm" value={userForm.isActive.toString()} onChange={e=>setUserForm({...userForm, isActive: e.target.value === 'true'})}><option value="true">Active</option><option value="false">Inactive</option></select></div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <input type="checkbox" id="requireSecurityCheck" checked={userForm.requireSecurityCheck !== false} onChange={e=>setUserForm({...userForm, requireSecurityCheck: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    <label htmlFor="requireSecurityCheck" className="text-sm font-semibold text-slate-700 cursor-pointer">Require Global Security Check (Popup)</label>
                  </div>
                
                {/* Visible Pages Multi-Select */}
                <div className="pt-2">
                  {!['super_admin', 'PM'].includes(userForm.role) && (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-semibold text-slate-700">Visible Pages</label>
                        <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100">{userForm.visiblePages.length} Selected</span>
                      </div>
                      <div className={`grid grid-cols-2 gap-2 border border-slate-200 rounded-xl p-3 bg-slate-50 max-h-40 overflow-y-auto`}>
                        {AVAILABLE_PAGES.map(page => (
                          <label key={page} className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 hover:text-slate-900">
                            <input type="checkbox" checked={userForm.visiblePages.includes(page)} onChange={() => handleVisiblePageToggle(page)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            {page}
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {(!editingItem && userForm.authProvider === 'developer_password') && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div><label className="block text-sm font-semibold text-slate-700 mb-1">Password</label><input type="password" required className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none text-sm" value={userForm.password} onChange={e=>setUserForm({...userForm, password: e.target.value})} /></div>
                    <div><label className="block text-sm font-semibold text-slate-700 mb-1">Confirm Password</label><input type="password" required className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none text-sm" value={userForm.confirmPassword} onChange={e=>setUserForm({...userForm, confirmPassword: e.target.value})} /></div>
                  </div>
                )}
                {(editingItem && userForm.authProvider === 'developer_password') && (
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
        </>
      )}

      {/* Security Alert Modal */}
      {alertModalOpen && (
        <>
          <div className="fixed inset-0 z-[20] pointer-events-auto bg-slate-900/50 backdrop-blur-sm" />
          <div className="fixed left-0 lg:left-[260px] right-0 bottom-[80px] lg:bottom-[40px] top-[64px] z-[60] pointer-events-none flex items-center justify-center p-4 overflow-hidden">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] pointer-events-auto">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">{editingItem ? "Edit Contact" : "Add Alert Contact"}</h3>
              <button onClick={() => setAlertModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6"/></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleAlertSubmit} className="space-y-4">
                <div><label className="block text-sm font-semibold text-slate-700 mb-1">Name</label><input required className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 outline-none text-sm focus:border-rose-500" value={alertForm.name} onChange={e=>setAlertForm({...alertForm, name:e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Role</label>
                    <select required className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 outline-none text-sm focus:border-rose-500" value={alertForm.role} onChange={e=>setAlertForm({...alertForm, role:e.target.value})}>
                      <option value="">Select Role</option>
                      <option value="Super Admin">Super Admin</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Sub Role</label>
                    <select required className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 outline-none text-sm focus:border-rose-500" value={alertForm.subRole} onChange={e=>setAlertForm({...alertForm, subRole:e.target.value})}>
                      <option value="">Select Sub Role</option>
                      <option value="Project Manager">Project Manager</option>
                      <option value="Supervisor">Supervisor</option>
                      <option value="Developer">Developer</option>
                    </select>
                  </div>
                </div>
                <div><label className="block text-sm font-semibold text-slate-700 mb-1">Email</label><input type="email" required className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 outline-none text-sm focus:border-rose-500" value={alertForm.email} onChange={e=>setAlertForm({...alertForm, email:e.target.value})} /></div>
                <div><label className="block text-sm font-semibold text-slate-700 mb-1">WhatsApp Phone (with Country Code)</label><input type="text" placeholder="e.g. 94701234567" required className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 outline-none text-sm focus:border-rose-500" value={alertForm.phoneNumber} onChange={e=>setAlertForm({...alertForm, phoneNumber:e.target.value})} /></div>
                <div className="pt-2"><button disabled={loading} type="submit" className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-md">{loading ? "Saving..." : "Save Contact"}</button></div>
              </form>
            </div>
          </div>
        </div>
        </>
      )}

      {/* Specialization Modal */}
      {specModalOpen && (
        <>
          <div className="fixed inset-0 z-[20] pointer-events-auto bg-slate-900/50 backdrop-blur-sm" />
          <div className="fixed left-0 lg:left-[260px] right-0 bottom-[80px] lg:bottom-[40px] top-[64px] z-[60] pointer-events-none flex items-center justify-center p-4 overflow-hidden">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] pointer-events-auto">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">{editingItem ? "Edit Specialization" : "Add Specialization"}</h3>
              <button onClick={() => setSpecModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6"/></button>
            </div>
            <div className="p-6 overflow-y-auto">
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
        </>
      )}

      {/* API Key Modal */}
      {apiKeyModalOpen && (
        <>
          <div className="fixed inset-0 z-[20] pointer-events-auto bg-slate-900/50 backdrop-blur-sm" />
          <div className="fixed left-0 lg:left-[260px] right-0 bottom-[80px] lg:bottom-[40px] top-[64px] z-[60] pointer-events-none flex items-center justify-center p-4 overflow-hidden">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] pointer-events-auto">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Generate API Key</h3>
              <button onClick={() => setApiKeyModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6"/></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleApiSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Key Name</label>
                    <input required className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 outline-none text-sm focus:border-slate-500" placeholder="e.g., Mobile App Integration" value={apiForm.name} onChange={e=>setApiForm({...apiForm, name:e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Expiration</label>
                    <select required className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 outline-none text-sm focus:border-slate-500" value={apiForm.expiresInDays} onChange={e=>setApiForm({...apiForm, expiresInDays:e.target.value})}>
                      <option value="never">Never Expire</option>
                      <option value="7">7 Days</option>
                      <option value="30">30 Days</option>
                      <option value="90">90 Days</option>
                      <option value="365">1 Year</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-semibold text-slate-700">Accessible Pages</label>
                    <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">{apiForm.accessiblePages.length} Selected</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {AVAILABLE_PAGES.filter(p => p !== 'Settings').map(page => (
                      <label key={page} className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl p-3 bg-slate-50 transition-colors">
                        <input type="checkbox" checked={apiForm.accessiblePages.includes(page)} onChange={() => handleApiVisiblePageToggle(page)} className="w-4 h-4 rounded border-slate-300 text-slate-600 focus:ring-slate-500" />
                        <span className="truncate" title={page}>{page}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <button disabled={loading} type="submit" className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold shadow-md">
                    {loading ? "Generating..." : "Generate Key"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        </>
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
                  className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-full max-w-sm pointer-events-auto"
                >
                  <div className="flex justify-between items-start mb-3 sm:mb-4">
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-800">Security Check</h3>
                      <p className="text-xs text-slate-500 mt-1">Enter global security password to access settings.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 border bg-blue-50 border-blue-100 rounded-xl p-3 mb-4">
                    <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14 }}>
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">Access System Settings</p>
                      <p className="text-xs text-slate-500 truncate">Authentication Required</p>
                    </div>
                  </div>
                  
                  <form onSubmit={handleVerify}>
                    <div className="mb-3 sm:mb-5 relative">
                      <input
                        type={showVerifyPassword ? "text" : "password"}
                        value={verifyPassword}
                        onChange={(e) => { setVerifyPassword(e.target.value); setVerifyError(""); }}
                        className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 outline-none transition-all"
                        placeholder="Enter password..."
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowVerifyPassword(!showVerifyPassword)}
                        className="absolute right-3 top-[10px] text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                      >
                        {showVerifyPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      {verifyError && <p className="text-xs font-semibold text-rose-500 mt-2">{verifyError}</p>}
                    </div>
                    
                    <button
                      type="submit"
                      disabled={verifyLoading || !verifyPassword}
                      className="w-full flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {verifyLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Verify Access"}
                    </button>
                  </form>
                </motion.div>
              </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm/Prompt Dialog */}
      {confirmDialog.isOpen && (
        <>
          <div className="fixed inset-0 z-[20] pointer-events-auto bg-slate-900/50 backdrop-blur-sm" />
          <div className="fixed left-0 lg:left-[260px] right-0 bottom-[80px] lg:bottom-[40px] top-[64px] z-[60] pointer-events-none flex items-center justify-center p-4 overflow-hidden">
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 pointer-events-auto">
            <h3 className="text-lg font-bold text-slate-800 mb-2">{confirmDialog.title}</h3>
            <p className="text-sm text-slate-500 mb-4">{confirmDialog.message}</p>
            {confirmDialog.type === "prompt" && (
              <input type="text" autoFocus className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 outline-none text-sm mb-4 focus:border-indigo-500" value={confirmDialog.value} onChange={e => setConfirmDialog({...confirmDialog, value: e.target.value})} />
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDialog({...confirmDialog, isOpen: false})} className="px-4 py-2 text-slate-500 hover:text-slate-700 font-semibold text-sm">Cancel</button>
              <button onClick={() => { setConfirmDialog({...confirmDialog, isOpen: false}); confirmDialog.onConfirm(confirmDialog.value); }} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md">Confirm</button>
            </div>
          </div>
        </div>
        </>
      )}

      {/* Toggle Security Prompt Modal */}
      {togglePrompt.isOpen && (
        <AnimatePresence>
          <motion.div key="toggle-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[20] pointer-events-auto bg-slate-900/60 backdrop-blur-md" />
          <motion.div key="toggle-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[22] pointer-events-none">
            <div className="fixed left-0 lg:left-[260px] right-0 bottom-[80px] lg:bottom-[40px] top-[64px] z-[50] pointer-events-none flex flex-col items-center justify-center px-4 pt-6 pb-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: "spring", damping: 26, stiffness: 320 }}
                className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-full max-w-sm pointer-events-auto"
              >
                <div className="flex justify-between items-start mb-3 sm:mb-4">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-800">Security Check</h3>
                    <p className="text-xs text-slate-500 mt-1">Enter password to change notification toggle.</p>
                  </div>
                  <button type="button" onClick={() => setTogglePrompt({ isOpen: false, key: null, password: "" })} className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors cursor-pointer">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
                
                <form onSubmit={handleToggleSubmit}>
                  <div className="mb-3 sm:mb-5 relative">
                    <input type="password" required className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 outline-none transition-all" placeholder="Enter password..." value={togglePrompt.password} onChange={e => setTogglePrompt({...togglePrompt, password: e.target.value})} />
                  </div>
                  
                  <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 mt-4">
                    <button type="button" onClick={() => setTogglePrompt({ isOpen: false, key: null, password: "" })} className="flex-1 px-4 py-2 sm:py-2.5 bg-white border-2 border-slate-300 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm cursor-pointer">Cancel</button>
                    <button type="submit" disabled={loading || !togglePrompt.password} className="flex-1 flex items-center justify-center px-4 py-2 sm:py-2.5 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-bold disabled:opacity-50 transition-colors shadow-sm cursor-pointer">{loading ? "Verifying..." : "Confirm"}</button>
                  </div>
                </form>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </AdminNavigation>
  );
};

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
