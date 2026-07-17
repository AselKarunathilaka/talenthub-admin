import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { UserPlus, ShieldCheck, RefreshCw } from "lucide-react";
import AdminNavigation from "../components/AdminNavigation";
import { API_BASE_URL } from "../api/apiConfig";
import { getAdminSession, hasAdminPermission } from "../utils/adminAuth";

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAdminSession()?.token}`, ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
};

const emptyForm = { name: "", email: "", role: "supervisor" };

export default function AdminUserManagement() {
  const [users, setUsers] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await request("/admin/users");
      setUsers(data.users);
      setAvailablePermissions(data.availablePermissions || []);
    }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!hasAdminPermission("users.manage")) return <Navigate to="/admin/dashboard" replace />;

  const createUser = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await request("/admin/users", { method: "POST", body: JSON.stringify(form) });
      setForm(emptyForm); await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const updateUser = async (id, changes) => {
    setError("");
    try {
      const { user } = await request(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(changes) });
      setUsers((current) => current.map((item) => item.id === id ? user : item));
    } catch (e) { setError(e.message); }
  };

  const togglePermission = (user, permission) => {
    const current = user.permissions || [];
    const permissions = current.includes(permission)
      ? current.filter((item) => item !== permission)
      : [...current, permission];
    updateUser(user.id, { permissions });
  };

  return (
    <AdminNavigation>
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div><h1 className="text-2xl font-bold text-slate-900">User Management</h1><p className="text-slate-500">Invite Google accounts and control admin-side access.</p></div>
            <button onClick={load} className="p-2 rounded-lg border bg-white text-slate-600" aria-label="Refresh"><RefreshCw className="h-5 w-5" /></button>
          </div>
          {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-red-700">{error}</div>}

          <form onSubmit={createUser} className="bg-white rounded-2xl border shadow-sm p-5 grid md:grid-cols-4 gap-3 items-end">
            <label className="text-sm font-medium text-slate-700">Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5" placeholder="Full name" /></label>
            <label className="text-sm font-medium text-slate-700 md:col-span-2">Google email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5" placeholder="name@company.com" /></label>
            <label className="text-sm font-medium text-slate-700">Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5"><option value="supervisor">Supervisor</option><option value="admin">Admin</option></select></label>
            <button disabled={saving} className="md:col-start-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white p-2.5 flex justify-center items-center gap-2 disabled:opacity-50"><UserPlus className="h-4 w-4" />{saving ? "Adding..." : "Add user"}</button>
          </form>

          <div className="bg-white rounded-2xl border shadow-sm overflow-x-auto">
            {loading ? <div className="p-10 text-center text-slate-500">Loading users…</div> : <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-4">User</th><th className="p-4">Role</th><th className="p-4 min-w-[320px]">Access</th><th className="p-4">Status</th><th className="p-4">Last login</th></tr></thead>
              <tbody>{users.map((user) => <tr key={user.id} className="border-t">
                <td className="p-4"><div className="font-semibold text-slate-900 flex gap-2 items-center"><ShieldCheck className="h-4 w-4 text-blue-600" />{user.name || "Unnamed user"}</div><div className="text-slate-500">{user.email}</div></td>
                <td className="p-4">{user.role === "super_admin" ? <span className="font-semibold">Super admin</span> : <select value={user.role} onChange={(e) => updateUser(user.id, { role: e.target.value })} className="rounded-lg border p-2"><option value="supervisor">Supervisor</option><option value="admin">Admin</option></select>}</td>
                <td className="p-4">{user.role === "super_admin" ? <span className="text-slate-500">All permissions</span> : <div className="grid grid-cols-2 gap-1.5">{availablePermissions.filter((permission) => permission !== "users.manage").map((permission) => <label key={permission} className="flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={(user.permissions || []).includes(permission)} onChange={() => togglePermission(user, permission)} />{permission.replaceAll("_", " ")}</label>)}</div>}</td>
                <td className="p-4">{user.role === "super_admin" ? <span className="text-emerald-700">Active</span> : <button onClick={() => updateUser(user.id, { isActive: !user.isActive })} className={`rounded-full px-3 py-1 font-medium ${user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{user.isActive ? "Active" : "Inactive"}</button>}</td>
                <td className="p-4 text-slate-500">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}</td>
              </tr>)}</tbody>
            </table>}
          </div>
        </div>
      </div>
    </AdminNavigation>
  );
}
