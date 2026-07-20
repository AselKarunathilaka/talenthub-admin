import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  UserPlus, ShieldCheck, RefreshCw, Search, Users, UserCheck,
  UserX, ChevronDown, ChevronUp, Mail, Clock3, SlidersHorizontal, Send,
} from "lucide-react";
import AdminNavigation from "../components/AdminNavigation";
import { API_BASE_URL } from "../api/apiConfig";
import { getAdminSession, hasAdminPermission } from "../utils/adminAuth";

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAdminSession()?.token}`,
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
};

const emptyForm = { name: "", email: "", role: "supervisor" };
const permissionLabels = {
  "dashboard.view": "Dashboard", "interns.view": "View interns",
  "interns.manage": "Manage interns", "daily_logs.view": "Daily logs",
  "attendance.view": "View attendance", "attendance.manage": "Manage attendance",
  "leave.view": "View leave", "leave.manage": "Manage leave",
  "announcements.manage": "Announcements", "seats.manage": "Seat layout",
  "settings.manage": "System settings",
};

export default function AdminUserManagement() {
  const [users, setUsers] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [sendingInvitationId, setSendingInvitationId] = useState(null);
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await request("/admin/users");
      setUsers(data.users);
      setAvailablePermissions(data.availablePermissions || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filteredUsers = useMemo(() => users.filter((user) => {
    const text = `${user.name || ""} ${user.email} ${user.role}`.toLowerCase();
    const matchesSearch = text.includes(search.trim().toLowerCase());
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? user.isActive : !user.isActive);
    return matchesSearch && matchesStatus;
  }), [users, search, statusFilter]);

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((user) => user.isActive).length,
    inactive: users.filter((user) => !user.isActive).length,
  }), [users]);

  if (!hasAdminPermission("users.manage")) return <Navigate to="/admin/dashboard" replace />;

  const createUser = async (event) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice(null);
    try {
      const result = await request("/admin/users", { method: "POST", body: JSON.stringify(form) });
      setNotice(result.invitation?.sent
        ? { type: "success", message: `Account created and invitation email sent to ${form.email}.` }
        : { type: "warning", message: result.invitation?.error || "Account created, but invitation email delivery failed." });
      setForm(emptyForm); await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const resendInvitation = async (user) => {
    setError(""); setNotice(null); setSendingInvitationId(user.id);
    try {
      const result = await request(`/admin/users/${user.id}/resend-invitation`, { method: "POST" });
      setUsers((current) => current.map((item) => item.id === user.id ? result.user : item));
      setNotice({ type: "success", message: `Invitation email sent to ${user.email}.` });
    } catch (e) { setError(e.message); }
    finally { setSendingInvitationId(null); }
  };

  const updateUser = async (id, changes) => {
    setError(""); setUpdatingUserId(id);
    try {
      const { user } = await request(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(changes) });
      setUsers((current) => current.map((item) => item.id === id ? user : item));
    } catch (e) { setError(e.message); }
    finally { setUpdatingUserId(null); }
  };

  const togglePermission = (user, permission) => {
    const current = user.permissions || [];
    updateUser(user.id, { permissions: current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission] });
  };

  return (
    <AdminNavigation>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/60 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100"><ShieldCheck className="h-3.5 w-3.5" />Access Control</div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">User Management</h1>
              <p className="mt-1 text-sm text-slate-500">Invite staff, assign roles, and control admin portal access.</p>
            </div>
            <button onClick={load} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</button>
          </section>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
          {notice && <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{notice.message}</div>}

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: "Total users", value: stats.total, icon: Users, iconClass: "bg-blue-50 text-blue-600" },
              { label: "Active accounts", value: stats.active, icon: UserCheck, iconClass: "bg-emerald-50 text-emerald-600" },
              { label: "Inactive accounts", value: stats.inactive, icon: UserX, iconClass: "bg-amber-50 text-amber-600" },
            ].map(({ label, value, icon, iconClass }) => <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-1 text-3xl font-extrabold text-slate-900">{value}</p></div><div className={`rounded-2xl p-3 ${iconClass}`}>{createElement(icon, { className: "h-6 w-6" })}</div></div></div>)}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-gradient-to-r from-[#000066] to-[#006600] px-5 py-4"><h2 className="flex items-center gap-2 font-bold text-white"><UserPlus className="h-5 w-5" />Invite a new user</h2><p className="mt-1 text-xs text-white/65">Creates Google access and emails professional sign-in instructions.</p></div>
            <form onSubmit={createUser} className="grid items-end gap-4 p-5 md:grid-cols-12">
              <label className="text-sm font-semibold text-slate-700 md:col-span-3">Full name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-normal outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" placeholder="e.g. Nimal Perera" /></label>
              <label className="text-sm font-semibold text-slate-700 md:col-span-4">Google email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-normal outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" placeholder="name@company.com" /></label>
              <label className="text-sm font-semibold text-slate-700 md:col-span-2">Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-normal outline-none"><option value="supervisor">Supervisor</option><option value="admin">Admin</option></select></label>
              <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-50 md:col-span-3"><UserPlus className="h-4 w-4" />{saving ? "Inviting…" : "Invite user"}</button>
            </form>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="font-bold text-slate-900">Portal users</h2><p className="text-xs text-slate-500">{filteredUsers.length} of {users.length} accounts</p></div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 sm:w-64" placeholder="Search name or email" /></div>
                <div className="relative"><SlidersHorizontal className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 py-2 pl-9 pr-8 text-sm outline-none"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
              </div>
            </div>

            {loading ? <div className="p-16 text-center text-sm text-slate-500">Loading users…</div> : filteredUsers.length === 0 ? <div className="p-16 text-center"><Users className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-semibold text-slate-700">No users found</p></div> : <div className="divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const isExpanded = expandedUserId === user.id;
                const isProtected = user.role === "super_admin";
                return <article key={user.id} className="transition hover:bg-slate-50/60">
                  <div className="grid items-center gap-4 p-4 lg:grid-cols-[minmax(230px,1.5fr)_160px_130px_150px_130px]">
                    <div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-emerald-500 text-sm font-bold text-white">{(user.name || user.email).slice(0, 2).toUpperCase()}</div><div className="min-w-0"><p className="truncate font-bold text-slate-900">{user.name || "Unnamed user"}</p><p className="flex items-center gap-1 truncate text-xs text-slate-500"><Mail className="h-3 w-3" />{user.email}</p></div></div>
                    <div>{isProtected ? <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700"><ShieldCheck className="h-3.5 w-3.5" />Super admin</span> : <select value={user.role || "supervisor"} disabled={updatingUserId === user.id} onChange={(e) => updateUser(user.id, { role: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-400"><option value="supervisor">Supervisor</option><option value="admin">Admin</option></select>}</div>
                    <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${user.isActive ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"}`}>{user.isActive ? "Active" : "Inactive"}</span>
                    <p className="flex items-center gap-1.5 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never logged in"}</p>
                    <div className="flex items-center justify-end gap-2">{isProtected ? <span className="text-xs font-medium text-slate-400">Protected</span> : <button disabled={updatingUserId === user.id} onClick={() => updateUser(user.id, { isActive: !user.isActive })} className={`rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${user.isActive ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}>{updatingUserId === user.id ? "Saving…" : user.isActive ? "Deactivate" : "Activate"}</button>}<button onClick={() => setExpandedUserId(isExpanded ? null : user.id)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-blue-600" title="Manage permissions">{isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button></div>
                  </div>
                  {isExpanded && <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-4 lg:pl-[72px]">
                    {!isProtected && user.authProvider === "google" && <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-800">Invitation email</p>
                        <p className={`mt-0.5 text-xs font-medium ${user.invitationEmailStatus === "sent" ? "text-emerald-700" : user.invitationEmailStatus === "failed" ? "text-red-700" : "text-slate-500"}`}>
                          {user.invitationEmailStatus === "sent" && user.invitationEmailSentAt
                            ? `Sent ${new Date(user.invitationEmailSentAt).toLocaleString()}`
                            : user.invitationEmailStatus === "failed"
                              ? "Previous delivery failed"
                              : "No invitation email recorded"}
                        </p>
                      </div>
                      <button type="button" onClick={() => resendInvitation(user)} disabled={sendingInvitationId === user.id || !user.isActive} className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-3.5 w-3.5" />{sendingInvitationId === user.id ? "Sending…" : "Resend invitation"}</button>
                    </div>}
                    <div className="mb-3"><p className="text-sm font-bold text-slate-800">Access permissions</p><p className="text-xs text-slate-500">Choose which areas this user can view or manage.</p></div>
                    {isProtected ? <p className="text-sm font-medium text-violet-700">Super administrators have full system access.</p> : <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">{availablePermissions.filter((permission) => permission !== "users.manage" && !(user.role === "supervisor" && permission === "leave.manage")).map((permission) => <label key={permission} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${(user.permissions || []).includes(permission) ? "border-blue-200 bg-blue-50 font-semibold text-blue-800" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200"}`}><input type="checkbox" className="h-4 w-4 accent-blue-600" checked={(user.permissions || []).includes(permission)} disabled={updatingUserId === user.id} onChange={() => togglePermission(user, permission)} />{permissionLabels[permission] || permission}</label>)}</div>}
                  </div>}
                </article>;
              })}
            </div>}
          </section>
        </div>
      </div>
    </AdminNavigation>
  );
}
