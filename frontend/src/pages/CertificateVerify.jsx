import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaShieldAlt,
  FaUser,
  FaCalendarAlt,
  FaBuilding,
  FaIdCard,
  FaEnvelope,
  FaCertificate,
  FaExclamationTriangle,
} from "react-icons/fa";
import { API_BASE_URL } from "../api/apiConfig";
import logo from "../assets/sltlogo.jpg";

const fmt = (d) => {
  if (!d) return "N/A";
  const dt = new Date(d);
  return isNaN(dt)
    ? d
    : dt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
};

const dur = (s, e) => {
  if (!s || !e) return "N/A";
  const m = Math.round((new Date(e) - new Date(s)) / (1000 * 60 * 60 * 24 * 30.44));
  return m < 1 ? `${Math.ceil((new Date(e) - new Date(s)) / 864e5)} days` : `${m} month${m !== 1 ? "s" : ""}`;
};

const DetailRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
      <Icon className="text-slate-500 text-sm" />
    </div>
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-800 break-words">{value || "N/A"}</p>
    </div>
  </div>
);

const CertificateVerify = () => {
  const { token } = useParams();
  const [status, setStatus] = useState("loading"); // loading | valid | invalid | error
  const [certificate, setCertificate] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Dev fix: Safari sometimes upgrades localhost to https which has no SSL cert.
    // Redirect back to http:// so the page loads correctly.
    const { protocol, hostname, port, pathname, search } = window.location;
    if (protocol === "https:" && (hostname === "localhost" || hostname === "127.0.0.1")) {
      const httpUrl = `http://${hostname}${port ? `:${port}` : ""}${pathname}${search}`;
      window.location.replace(httpUrl);
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/verify/certificate/${token}`);
        const data = await res.json();

        if (res.status === 404 || !data.valid) {
          setStatus("invalid");
          setMessage(data.message || "Certificate not found");
        } else if (data.valid) {
          setStatus("valid");
          setCertificate(data.certificate);
        } else {
          setStatus("invalid");
          setMessage(data.message || "Invalid certificate");
        }
      } catch (err) {
        console.error("Verify error:", err);
        setStatus("error");
        setMessage("Could not connect to the verification server.");
      }
    };

    if (token) verify();
  }, [token]);


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex flex-col">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-96 h-96 rounded-full bg-blue-100/30 -top-24 -left-24"
          animate={{ y: [0, -20, 0], x: [0, 15, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-80 h-80 rounded-full bg-emerald-100/25 bottom-0 right-0"
          animate={{ y: [0, 20, 0], x: [0, -15, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <img
            src={logo}
            alt="SLT Logo"
            className="h-9 w-auto rounded-lg border border-gray-200 shadow-sm"
          />
          <div>
            <p className="text-sm font-semibold text-slate-800">Sri Lanka Telecom PLC</p>
            <p className="text-xs text-slate-500">TalentHub — Certificate Verification</p>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-full px-3 py-1.5">
            <FaShieldAlt className="text-slate-400" />
            Secure Verification
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            {/* ── LOADING ── */}
            {status === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 border-t-4 border-b-4 border-slate-800 rounded-full mx-auto mb-6"
                />
                <p className="text-slate-600 font-medium text-lg">Verifying certificate…</p>
                <p className="text-slate-400 text-sm mt-1">Checking with SLT TalentHub servers</p>
              </motion.div>
            )}

            {/* ── VALID ── */}
            {status === "valid" && certificate && (
              <motion.div
                key="valid"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                {/* Status banner */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                  className="flex flex-col items-center mb-6"
                >
                  <div className="relative mb-4">
                    <div className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-200 flex items-center justify-center shadow-lg">
                      <FaCheckCircle className="text-emerald-500 text-4xl" />
                    </div>
                    <motion.div
                      className="absolute inset-0 rounded-full border-4 border-emerald-300"
                      animate={{ scale: [1, 1.4, 1], opacity: [1, 0, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                    />
                  </div>
                  <h1 className="text-2xl font-bold text-emerald-700 tracking-tight">
                    Certificate Valid
                  </h1>
                  <p className="text-slate-500 text-sm mt-1 text-center">
                    This certificate is authentic and issued by Sri Lanka Telecom PLC
                  </p>
                </motion.div>

                {/* Certificate card */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden"
                >
                  {/* Card header */}
                  <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-500" />
                  <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                      <FaCertificate className="text-slate-600 text-lg" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider font-bold text-slate-400">
                        Internship Completion Certificate
                      </p>
                      <p className="text-sm font-semibold text-slate-800">Sri Lanka Telecom PLC</p>
                    </div>
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✓ Verified
                    </span>
                  </div>

                  {/* Details */}
                  <div className="px-6 py-4">
                    <DetailRow
                      icon={FaUser}
                      label="Intern Name"
                      value={certificate.traineeName}
                    />
                    <DetailRow
                      icon={FaIdCard}
                      label="Trainee ID"
                      value={certificate.traineeId}
                    />
                    <DetailRow
                      icon={FaEnvelope}
                      label="Email"
                      value={certificate.email}
                    />
                    <DetailRow
                      icon={FaBuilding}
                      label="University / Institute"
                      value={certificate.institute}
                    />
                    <DetailRow
                      icon={FaBuilding}
                      label="Field of Specialization"
                      value={certificate.fieldOfSpecialization}
                    />
                    <DetailRow
                      icon={FaCalendarAlt}
                      label="Training Period"
                      value={`${fmt(certificate.trainingStartDate)} – ${fmt(certificate.trainingEndDate)} (${dur(certificate.trainingStartDate, certificate.trainingEndDate)})`}
                    />
                    <DetailRow
                      icon={FaCalendarAlt}
                      label="Certificate Issued"
                      value={fmt(certificate.issuedAt)}
                    />
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
                    <p className="text-xs text-slate-400 text-center">
                      Verified via TalentHub — SLT Intern Management System
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* ── INVALID ── */}
            {(status === "invalid" || status === "error") && (
              <motion.div
                key="invalid"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                  className="flex flex-col items-center mb-6"
                >
                  <div className="w-20 h-20 rounded-full bg-red-50 border-4 border-red-200 flex items-center justify-center shadow-lg mb-4">
                    {status === "error" ? (
                      <FaExclamationTriangle className="text-red-400 text-3xl" />
                    ) : (
                      <FaTimesCircle className="text-red-500 text-4xl" />
                    )}
                  </div>
                  <h1 className="text-2xl font-bold text-red-600 tracking-tight">
                    {status === "error" ? "Verification Error" : "Certificate Invalid"}
                  </h1>
                  <p className="text-slate-500 text-sm mt-2 max-w-sm text-center">
                    {message ||
                      "This certificate could not be verified. It may be invalid, revoked, or the token may be incorrect."}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white rounded-2xl border border-red-100 shadow-lg p-6"
                >
                  <div className="flex items-center gap-3 text-left mb-4">
                    <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                      <FaShieldAlt className="text-red-400 text-sm" />
                    </div>
                    <p className="text-sm text-slate-600">
                      {status === "error"
                        ? "Unable to reach the verification server. Please check your internet connection and try again."
                        : "If you believe this certificate should be valid, please contact the issuing organization directly."}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-xs text-slate-500 text-center font-mono break-all">
                      Token: {token}
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-5 px-4">
        <p className="text-xs text-slate-400">
          © {new Date().getFullYear()} Sri Lanka Telecom PLC — TalentHub Internship Management System
        </p>
      </footer>
    </div>
  );
};

export default CertificateVerify;
