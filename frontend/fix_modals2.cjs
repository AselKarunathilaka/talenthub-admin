const fs = require('fs');
const path = 'g:/github/TalentHub/frontend/src/pages/AdminSettings.jsx';
let content = fs.readFileSync(path, 'utf8');

const marker = `                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-xs text-slate-400 mb-2">Leave blank to keep current password</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div><input type="password" placeholder="New Password" className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none text-sm" value={userForm.password} onChange={e=>setUserForm({...userForm, password: e.target.value})} /></div>
                      <div><input type="password" placeholder="Confirm Password" className="w-full border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none text-sm" value={userForm.confirmPassword} onChange={e=>setUserForm({...userForm, confirmPassword: e.target.value})} /></div>
                    </div>
                  </div>`;

const chunkToInsert = `
                )}
                <div className="pt-4"><button disabled={loading} type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md disabled:opacity-70">{loading ? "Saving..." : "Save Staff Member"}</button></div>
              </form>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Security Alert Modal */}
      {alertModalOpen && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">{editingItem ? "Edit Contact" : "Add Alert Contact"}</h3>
              <button onClick={() => setAlertModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6"/></button>
            </div>
            <div className="p-6 overflow-y-auto">
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
      , document.body)}

      {/* Specialization Modal */}
      {specModalOpen && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
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
      , document.body)}

      {/* Security Check Backdrop & Modal */}
      <AnimatePresence>
        {!isVerified && createPortal(
          <motion.div
            key="security-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[20] pointer-events-auto bg-slate-900/60 backdrop-blur-md"
          />
        , document.body)}
      </AnimatePresence>

      <AnimatePresence>
        {!isVerified && createPortal(
          <motion.div key="security-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[22] pointer-events-none">
            <div className="fixed inset-0 z-[50] pointer-events-none flex flex-col items-center justify-center px-4 pt-6 pb-8">
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
        , document.body)}
      </AnimatePresence>

      {/* Confirm/Prompt Dialog */}
      {confirmDialog.isOpen && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6">
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
      , document.body)}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </AdminNavigation>
  );
};
`;

const index = content.indexOf(marker);
if (index === -1) {
  console.log('Marker not found!');
  process.exit(1);
}

const endOfMarker = index + marker.length;

// Ensure we don't accidentally append it multiple times
if (content.substring(endOfMarker).includes('Save Staff Member')) {
  console.log('Chunk already present, doing nothing to avoid duplication.');
  process.exit(0);
}

const newContent = content.substring(0, endOfMarker) + chunkToInsert + '\n\n' + content.substring(endOfMarker);

fs.writeFileSync(path, newContent, 'utf8');
console.log('Successfully injected missing chunk.');
