import React from "react";
import { Routes, Route } from "react-router-dom";
import Login from "../pages/Login";
import ScanQRCode from "../pages/ScanQRCode";
import Dashboard from "../pages/Dashboard";
import Availability from "../pages/Availability";
import LogBook from "../pages/LogBook"; // Make sure the filename is LogBook.jsx
import DailyRecords from "../pages/DailyRecords";
import AdminLogin from "../pages/AdminLogin";
import AdminDashboard from "../pages/AdminDashboard";
import AdminDailyRecords from "../pages/AdminDailyRecords";
import AdminInternDetails from "../pages/AdminInternDetails";
import AdminInternRecords from "../pages/AdminInternRecords";
import AgreementGuard from "../components/AgreementGuard";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      
      {/* Protected Intern Routes - Wrapped with AgreementGuard */}
      <Route path="/scan-qr" element={<AgreementGuard><ScanQRCode /></AgreementGuard>} />
      <Route path="/dashboard" element={<AgreementGuard><Dashboard /></AgreementGuard>} />
      <Route path="/availability" element={<AgreementGuard><Availability /></AgreementGuard>} />
      <Route path="/log-book" element={<AgreementGuard><LogBook /></AgreementGuard>} />
      <Route path="/DailyRecords" element={<AgreementGuard><DailyRecords /></AgreementGuard>} />
      
      {/* Admin Routes */}
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/admin-dashboard" element={<AdminDashboard />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/daily-records" element={<AdminDailyRecords />} />
      <Route path="/admin/intern/:internId" element={<AdminInternDetails />} />
      <Route path="/admin/intern/:internId/records" element={<AdminInternRecords />} />
      
  </Routes>
  );
};

export default AppRoutes;
