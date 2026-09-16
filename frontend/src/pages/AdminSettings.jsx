import React, { useState, useEffect } from "react";
import { 
  KeyRound, 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Lock, 
  Eye, 
  EyeOff, 
  Edit, 
  Power, 
  PowerOff,
  AlertTriangle,
  MessageCircle,
  Smartphone,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Unplug
} from "lucide-react";
import QRCode from "react-qr-code";
import { API_ENDPOINTS } from "../api/apiConfig";
import { adminApi, notificationUtils } from "../api/adminApi";
import { getAdminSession } from "../utils/adminAuth";

import AdminNavigation from "../components/AdminNavigation";

const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState("security");
  const adminSession = getAdminSession();
  const isSuperAdmin = adminSession?.user?.role === "super_admin";
  const canManageUsers = isSuperAdmin || adminSession?.user?.permissions?.includes("users.manage");

  // Security Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [isLinking, setIsLinking] = useState(false);

  // User Management State
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // User Form State
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmUserPassword: "",
    role: "admin",
    isActive: true
  });
  const [formLoading, setFormLoading] = useState(false);

  // WhatsApp State
  const [waStatus, setWaStatus] = useState(null);
  const [waLoading, setWaLoading] = useState(false);
  const [waDisconnecting, setWaDisconnecting] = useState(false);
  const [waDisconnectModal, setWaDisconnectModal] = useState(false);

  useEffect(() => {
    if (activeTab === "users" && canManageUsers) {
      fetchUsers();
    }
  }, [activeTab, canManageUsers]);

  const fetchWhatsAppStatus = async (silent = false) => {
    if (!silent) setWaLoading(true);
    try {
      const data = await adminApi.get(API_ENDPOINTS.ADMIN.SETTINGS.WHATSAPP_STATUS);
      setWaStatus(data);
      if (data?.status === 'WAITING_FOR_SCAN' || data?.status === 'CONNECTED') {
        setIsLinking(false);
      }
    } catch (error) {
      console.error("Failed to fetch WhatsApp status", error);
      if (!silent) notificationUtils.showError("Failed to fetch WhatsApp connection status.");
    } finally {
      if (!silent) setWaLoading(false);
    }
  };

  useEffect(() => {
    let pollInterval;
    if (activeTab === "whatsapp") {
      fetchWhatsAppStatus();
      // Poll every 3 seconds if waiting for scan or linking
      pollInterval = setInterval(() => {
        if (activeTab === "whatsapp") {
          fetchWhatsAppStatus(true);
        }
      }, 3000);
    }
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [activeTab]);

  const handleDisconnectWhatsApp = async () => {
    try {
      setWaDisconnecting(true);
      await adminApi.post(API_ENDPOINTS.ADMIN.SETTINGS.WHATSAPP_DISCONNECT);
      setWaDisconnectModal(false);
      fetchWhatsAppStatus();
    } catch (error) {
      console.error("WhatsApp disconnect error:", error);
      notificationUtils.showError(error.response?.data?.message || "Failed to disconnect WhatsApp.");
    } finally {
      setWaDisconnecting(false);
    }
  };

  const handleLinkWhatsApp = async () => {
    try {
      setIsLinking(true);
      setWaStatus(null); // Clear status to show loader
      setWaLoading(true);
      await adminApi.post(API_ENDPOINTS.ADMIN.SETTINGS.WHATSAPP_LINK);
      
      // Fast polling for rapid QR display
      const fastPoll = setInterval(async () => {
        try {
          const data = await adminApi.get(API_ENDPOINTS.ADMIN.SETTINGS.WHATSAPP_STATUS);
          if (data?.status === 'WAITING_FOR_SCAN' || data?.status === 'CONNECTED' || data?.status === 'ERROR') {
            clearInterval(fastPoll);
            setWaStatus(data);
            setIsLinking(false);
            setWaLoading(false);
          }
        } catch (e) {
          clearInterval(fastPoll);
        }
      }, 1000);
    } catch (error) {
      console.error("WhatsApp link error:", error);
      notificationUtils.showError(error.response?.data?.message || "Failed to start WhatsApp link process.");
      setIsLinking(false);
      fetchWhatsAppStatus(); // restore status
    }
  };

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const data = await adminApi.get(API_ENDPOINTS.ADMIN.SETTINGS.USERS);
      setUsers(data);
    } catch (error) {
      console.error("Failed to fetch users", error);
      notificationUtils.showError("Failed to fetch administrative users.");
    } finally {
      setUsersLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      notificationUtils.showError("All password fields are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      notificationUtils.showError("New password and confirm password do not match.");
      return;
    }
    if (newPassword.length < 6) {
      notificationUtils.showError("New password must be at least 6 characters long.");
      return;
    }

    try {
      setPasswordLoading(true);
      await adminApi.put(API_ENDPOINTS.ADMIN.SETTINGS.SECURITY_PASSWORD, {
        currentPassword,
        newPassword
      });
      notificationUtils.showSuccess("Security password successfully changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Password change error:", error);
      notificationUtils.showError(error.response?.data?.message || "Failed to change security password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const openUserModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setUserForm({
        name: user.name || "",
        email: user.email || "",
        password: "",
        confirmUserPassword: "",
        role: user.role || "admin",
        isActive: user.isActive
      });
    } else {
      setEditingUser(null);
      setUserForm({
        name: "",
        email: "",
        password: "",
        confirmUserPassword: "",
        role: "admin",
        isActive: true
      });
    }
    setIsUserModalOpen(true);
  };

  const closeUserModal = () => {
    setIsUserModalOpen(false);
    setEditingUser(null);
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (!userForm.name || !userForm.email || !userForm.role) {
      notificationUtils.showError("Name, Email, and Role are required.");
      return;
    }
    
    if (!editingUser) {
      if (!userForm.password || !userForm.confirmUserPassword) {
        notificationUtils.showError("Passwords are required for new users.");
        return;
      }
      if (userForm.password !== userForm.confirmUserPassword) {
        notificationUtils.showError("Passwords do not match.");
        return;
      }
    } else if (userForm.password && userForm.password !== userForm.confirmUserPassword) {
      notificationUtils.showError("Passwords do not match.");
      return;
    }

    try {
      setFormLoading(true);
      if (editingUser) {
        // Only send password if it's being updated
        const payload = {
          name: userForm.name,
          role: userForm.role,
          isActive: userForm.isActive
        };
        if (userForm.password) payload.password = userForm.password;

        await adminApi.put(`${API_ENDPOINTS.ADMIN.SETTINGS.USERS}/${editingUser._id}`, payload);
        notificationUtils.showSuccess("User updated successfully.");
      } else {
        await adminApi.post(API_ENDPOINTS.ADMIN.SETTINGS.USERS, {
          name: userForm.name,
          email: userForm.email,
          password: userForm.password,
          role: userForm.role,
          isActive: userForm.isActive
        });
        notificationUtils.showSuccess("User created successfully.");
      }
      closeUserModal();
      fetchUsers();
    } catch (error) {
      console.error("User save error:", error);
      notificationUtils.showError(error.response?.data?.message || "Failed to save user.");
    } finally {
      setFormLoading(false);
    }
  };

  const toggleUserStatus = async (user) => {
    if (user.role === "super_admin" && !isSuperAdmin) {
      notificationUtils.showError("Only Super Admins can manage other Super Admins.");
      return;
    }
    if (user._id === adminSession?.user?.id && user.isActive) {
      notificationUtils.showError("You cannot disable your own active account from here.");
      return;
    }
    
    if (window.confirm(`Are you sure you want to ${user.isActive ? 'disable' : 'enable'} this account?`)) {
      try {
        await adminApi.put(`${API_ENDPOINTS.ADMIN.SETTINGS.USERS}/${user._id}`, {
          isActive: !user.isActive
        });
        notificationUtils.showSuccess(`User account ${user.isActive ? 'disabled' : 'enabled'}.`);
        fetchUsers();
      } catch (error) {
        notificationUtils.showError(error.response?.data?.message || "Failed to change user status.");
      }
    }
  };

  const formatRoleLabel = (role) => {
    switch (role) {
      case "super_admin": return "Super Admin";
      case "admin": return "Admin";
      case "developer": return "Developer";
      case "supervisor": return "Supervisor";
      default: return role;
    }
  };

  return (
    <AdminNavigation>
      <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 animate-fade-in">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <Lock className="w-8 h-8 text-blue-600" />
            System Settings
          </h1>
          <p className="text-slate-500 mt-2">Manage security and administrative users.</p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl w-full md:w-max">
          <button
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === "security" 
                ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-900/5" 
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Security Password
          </button>
          
          {canManageUsers && (
            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "users" 
                  ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-900/5" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <Users className="w-4 h-4" />
              User Management
            </button>
          )}
          
          {canManageUsers && (
            <button
              onClick={() => setActiveTab("whatsapp")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "whatsapp" 
                  ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-900/5" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp Integration
            </button>
          )}
        </div>

        {/* Content */}
        <div className="mt-6">
          {/* Security Password Section */}
          {activeTab === "security" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50/50 p-6">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-blue-500" />
                  Change Security Password
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Update the global security password used for sensitive system actions like turning off location tracking.
                </p>
              </div>
              
              <div className="p-6 md:p-8">
                <form onSubmit={handlePasswordChange} className="max-w-md space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Current Security Password</label>
                    <div className="relative">
                      <input
                        type={showCurrent ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                        placeholder="Enter current password"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowCurrent(!showCurrent)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">New Security Password</label>
                    <div className="relative">
                      <input
                        type={showNew ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                        placeholder="Enter new password (min 6 chars)"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                        placeholder="Confirm new password"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={passwordLoading}
                      className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {passwordLoading ? (
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                      Change Password
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* User Management Section */}
          {activeTab === "users" && canManageUsers && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50/50 p-4 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-500" />
                    Admin Users
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">Manage system administrators and their roles.</p>
                </div>
                <button
                  onClick={() => openUserModal()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <UserPlus className="w-4 h-4" />
                  Add User
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usersLoading ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                            <p className="text-sm">Loading users...</p>
                          </div>
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                          No users found.
                        </td>
                      </tr>
                    ) : (
                      users.map(user => (
                        <tr key={user._id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-medium text-slate-800">{user.name || "N/A"}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-slate-600">{user.email}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                              user.role === 'super_admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                              user.role === 'developer' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                              user.role === 'supervisor' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {formatRoleLabel(user.role)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                              user.isActive ? 'text-emerald-600' : 'text-slate-400'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                              {user.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openUserModal(user)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                title="Edit user"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => toggleUserStatus(user)}
                                className={`p-1.5 rounded-md transition-colors ${
                                  user.isActive 
                                    ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' 
                                    : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                }`}
                                title={user.isActive ? "Disable user" : "Enable user"}
                                disabled={user._id === adminSession?.user?.id && user.isActive}
                              >
                                {user.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* WhatsApp Integration Section */}
          {activeTab === "whatsapp" && canManageUsers && (
            <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden relative">
              {/* Background gradient decorative element */}
              <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent z-0" />
              
              <div className="relative z-10 p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100/60 bg-white/50 backdrop-blur-sm">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3 tracking-tight">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    WhatsApp Integration
                  </h2>
                  <p className="text-sm text-slate-500 mt-2 font-medium">Link your WhatsApp account for instant security alerts and system messaging.</p>
                </div>
                {/* Removed manual refresh button as polling handles it */}
              </div>

              <div className="relative z-10 p-6 md:p-12 flex flex-col items-center justify-center min-h-[400px]">
                {isLinking || (waLoading && !waStatus) || waStatus?.status === 'INITIALIZING' ? (
                  <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-emerald-100 rounded-full" />
                      <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
                      <div className="absolute inset-0 flex items-center justify-center text-emerald-500">
                        <MessageCircle className="w-6 h-6 animate-pulse" />
                      </div>
                    </div>
                    <p className="text-slate-500 font-medium text-sm mt-6">Establishing secure connection...</p>
                  </div>
                ) : waStatus?.status === 'WAITING_FOR_SCAN' ? (
                  <div className="max-w-md w-full bg-white rounded-3xl border border-slate-100 p-8 flex flex-col items-center text-center shadow-xl shadow-slate-200/40 relative overflow-hidden animate-fade-in">
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
                    
                    <div className="w-20 h-20 bg-amber-50 rounded-2xl flex items-center justify-center mb-6 ring-8 ring-amber-50/50">
                      <Smartphone className="w-10 h-10 text-amber-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight">Link Device</h3>
                    <p className="text-sm text-slate-500 mb-8 max-w-[280px] leading-relaxed">
                      Open WhatsApp on your phone, go to <strong className="text-slate-700">Linked Devices</strong>, and scan this code.
                    </p>
                    
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-8 relative group hover:border-amber-200 transition-colors">
                      {waStatus?.qrCode ? (
                         <div className="relative">
                           <QRCode value={waStatus.qrCode} size={240} level="H" />
                           {/* Decorative scanning line */}
                           <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/20 to-transparent h-4 w-full animate-[scan_2s_ease-in-out_infinite]" />
                         </div>
                      ) : (
                        <div className="w-[240px] h-[240px] bg-slate-50 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200">
                          <div className="w-8 h-8 border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin mb-3" />
                          <span className="text-xs text-slate-400 font-medium">Generating Code...</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2.5 text-amber-700 bg-amber-50 px-5 py-2.5 rounded-full text-sm font-semibold border border-amber-200/60 shadow-sm">
                      <div className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                      </div>
                      Waiting for scan...
                    </div>
                  </div>
                ) : waStatus?.status === 'CONNECTED' ? (
                  <div className="max-w-md w-full bg-white rounded-3xl border border-slate-100 p-8 flex flex-col items-center text-center shadow-xl shadow-emerald-900/5 relative overflow-hidden animate-fade-in">
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
                    
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-20" />
                      <div className="w-24 h-24 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-full flex items-center justify-center ring-8 ring-emerald-50 border border-emerald-100 relative z-10">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500 drop-shadow-sm" />
                      </div>
                    </div>
                    
                    <h3 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">System Linked</h3>
                    <p className="text-sm text-slate-500 mb-8 max-w-[280px] leading-relaxed">
                      WhatsApp is actively sending automated messages and security alerts.
                    </p>
                    
                    <div className="w-full bg-slate-50/50 rounded-2xl border border-slate-100 p-5 mb-8 space-y-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium">Status</span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/50">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" /> Active
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium">Account</span>
                        <span className="text-slate-800 font-semibold bg-white px-2.5 py-1 rounded-md shadow-sm border border-slate-200">{waStatus?.connectedNumber || "Active Number"}</span>
                      </div>
                      {waStatus?.connectionTime && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 font-medium">Linked On</span>
                          <span className="text-slate-700 font-medium">
                            {new Date(waStatus.connectionTime).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={handleDisconnectWhatsApp}
                      disabled={waDisconnecting}
                      className="w-full py-3.5 bg-white border-2 border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200 text-sm font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 group disabled:opacity-70"
                    >
                      {waDisconnecting ? (
                         <div className="w-4 h-4 border-2 border-red-600/20 border-t-red-600 rounded-full animate-spin" />
                      ) : (
                         <Unplug className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                      )}
                      {waDisconnecting ? "Disconnecting..." : "Disconnect Account"}
                    </button>
                  </div>
                ) : (
                  <div className="max-w-md w-full bg-white rounded-3xl border border-slate-100 p-8 flex flex-col items-center text-center shadow-xl shadow-slate-200/40 relative overflow-hidden animate-fade-in">
                     <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-slate-300 to-slate-400" />
                     
                     <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 ring-8 ring-slate-50 border border-slate-100">
                      <MessageCircle className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight">Not Connected</h3>
                    <p className="text-sm text-slate-500 mb-8 max-w-[280px] leading-relaxed">
                      Link your WhatsApp account to enable automated messages and critical system notifications.
                    </p>
                    
                    <div className="w-full">
                      <button
                        onClick={handleLinkWhatsApp}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 transition-all flex items-center justify-center gap-2"
                      >
                        <Smartphone className="w-4 h-4" />
                        Link WhatsApp Account
                      </button>
                      <p className="text-xs text-slate-400 mt-4 font-medium">Clicking this will generate a new secure QR code.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={closeUserModal} />
          
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                {editingUser ? <Edit className="w-5 h-5 text-indigo-500" /> : <UserPlus className="w-5 h-5 text-indigo-500" />}
                {editingUser ? "Edit User" : "Add New User"}
              </h3>
              <button onClick={closeUserModal} className="text-slate-400 hover:text-slate-600">
                <PowerOff className="w-5 h-5 rotate-45" /> {/* Use as close X */}
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form id="userForm" onSubmit={handleUserSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Full Name</label>
                  <input
                    type="text"
                    required
                    value={userForm.name}
                    onChange={(e) => setUserForm({...userForm, name: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Email Address</label>
                  <input
                    type="email"
                    required
                    disabled={!!editingUser}
                    value={userForm.email}
                    onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm ${
                      editingUser ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Role</label>
                    <select
                      value={userForm.role}
                      onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                    >
                      <option value="admin">Admin</option>
                      <option value="developer">Developer</option>
                      <option value="supervisor">Supervisor</option>
                      {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                    </select>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Account Status</label>
                    <select
                      value={userForm.isActive.toString()}
                      onChange={(e) => setUserForm({...userForm, isActive: e.target.value === 'true'})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>

                {!editingUser && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Password</label>
                      <input
                        type="password"
                        required
                        value={userForm.password}
                        onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Confirm Password</label>
                      <input
                        type="password"
                        required
                        value={userForm.confirmUserPassword}
                        onChange={(e) => setUserForm({...userForm, confirmUserPassword: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                      />
                    </div>
                  </>
                )}
                
                {editingUser && (
                  <div className="pt-2 border-t border-slate-100 mt-4">
                    <p className="text-xs text-slate-500 mb-3 flex items-start gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                      Leave password fields blank if you do not wish to change the user's password.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-600">New Password</label>
                        <input
                          type="password"
                          value={userForm.password}
                          onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-600">Confirm Password</label>
                        <input
                          type="password"
                          value={userForm.confirmUserPassword}
                          onChange={(e) => setUserForm({...userForm, confirmUserPassword: e.target.value})}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeUserModal}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="userForm"
                disabled={formLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-70 flex items-center gap-2"
              >
                {formLoading ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  editingUser ? "Save Changes" : "Create User"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </AdminNavigation>
  );
};

export default AdminSettings;
