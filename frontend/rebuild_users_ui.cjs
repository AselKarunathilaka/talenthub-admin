const fs = require('fs');
const file = 'g:/github/TalentHub/frontend/src/pages/AdminSettings.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add state variables
const stateVars = 
  const [activeStaffTab, setActiveStaffTab] = useState("email");
  const [roleFilter, setRoleFilter] = useState("all");

  const groupedUsers = users.reduce((acc, user) => {
    const isGoogle = !!user.googleSubject;
    const isEmail = !isGoogle;

    if (isEmail) {
      acc.email.all += 1;
      const r = user.role || 'unknown';
      if (!acc.email.roles[r]) acc.email.roles[r] = [];
      acc.email.roles[r].push(user);
    }
    if (isGoogle) {
      acc.google.all += 1;
      const r = user.role || 'unknown';
      if (!acc.google.roles[r]) acc.google.roles[r] = [];
      acc.google.roles[r].push(user);
    }
    return acc;
  }, { email: { all: 0, roles: {} }, google: { all: 0, roles: {} } });

  const filteredUsers = activeStaffTab === "email" 
    ? (roleFilter === 'all' ? Object.values(groupedUsers.email.roles).flat() : groupedUsers.email.roles[roleFilter] || [])
    : (roleFilter === 'all' ? Object.values(groupedUsers.google.roles).flat() : groupedUsers.google.roles[roleFilter] || []);
;

if (!code.includes('activeStaffTab')) {
  code = code.replace(
    'const [activeTab, setActiveTab] = useState("security");',
    'const [activeTab, setActiveTab] = useState("security");\n' + stateVars
  );
}

// 2. Replace the UI block for Staff Management
const uiBlock =                   <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-500"/> Staff Management</h3>
                    <button onClick={() => { setEditingItem(null); setUserForm({name:"", email:"", role:"admin", isActive:true, password:"", confirmPassword:"", visiblePages:[]}); setUserModalOpen(true); }} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-all"><UserPlus className="w-4 h-4"/> Add Staff</button>
                  </div>
                  <div className="p-6 border-b border-slate-100 bg-white">
                    <div className="flex gap-2 mb-4 p-1 bg-slate-100 rounded-xl max-w-md">
                      <button onClick={() => { setActiveStaffTab('email'); setRoleFilter('all'); }} className={\lex-1 py-2 text-sm font-semibold rounded-lg transition-all \\}>Email Login (\)</button>
                      <button onClick={() => { setActiveStaffTab('google'); setRoleFilter('all'); }} className={\lex-1 py-2 text-sm font-semibold rounded-lg transition-all \\}>Google Login (\)</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setRoleFilter('all')} className={\px-4 py-2 rounded-xl text-sm font-semibold transition-all \\}>All (\)</button>
                      {Object.entries(groupedUsers[activeStaffTab].roles).map(([role, list]) => (
                        <button key={role} onClick={() => setRoleFilter(role)} className={\px-4 py-2 rounded-xl text-sm font-semibold transition-all \\}>
                          \ (\)
                        </button>
                      ))}
                    </div>
                  </div>;

const searchBlock = /<div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50\/50">[\s\S]*?Add Staff<\/button>\n\s*<\/div>/;
code = code.replace(searchBlock, uiBlock);

// 3. Update the table to map over filteredUsers
code = code.replace(/{users\.map/g, '{filteredUsers.map');
code = code.replace(/users\.length === 0/g, 'filteredUsers.length === 0');

fs.writeFileSync(file, code);
console.log('Rebuilt UI.');
