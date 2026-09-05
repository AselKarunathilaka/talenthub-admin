import React, { useState, useEffect } from 'react';
import { ShieldAlert, X, Loader } from 'lucide-react';

const SecurityPinModal = ({ isOpen, onClose, onSubmit, loading }) => {
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (isOpen) setPin('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(pin);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 text-red-600">
            <ShieldAlert className="h-5 w-5" />
            <h3 className="font-bold">Security Verification</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5">
          <p className="mb-4 text-sm text-slate-600 leading-relaxed">
            Disabling location tracking compromises the security of the attendance system. Please enter the Master Security PIN to proceed.
          </p>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter PIN"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-center tracking-[0.3em] font-mono text-lg outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
            autoFocus
            maxLength={10}
            required
          />
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !pin}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-70 transition-colors"
            >
              {loading ? <Loader className="h-4 w-4 animate-spin" /> : 'Verify & Disable'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SecurityPinModal;
