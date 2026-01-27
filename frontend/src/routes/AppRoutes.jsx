import React from "react";
import { Routes, Route } from "react-router-dom";
import Login from "../pages/Login";
import ScanQRCode from "../pages/ScanQRCode";
import Dashboard from "../pages/Dashboard";
import Availability from "../pages/Availability";
import LogBook from "../pages/LogBook"; // Make sure the filename is LogBook.jsx
import DailyRecords from "../pages/DailyRecords";
import MyLeaveRequests from "../pages/MyLeaveRequests";
import SeatReservation from "../pages/SeatReservation";
import AdminLogin from "../pages/AdminLogin";
import AdminDashboard from "../pages/AdminDashboard";
import AdminDailyRecords from "../pages/AdminDailyRecords";
import AdminInternDetails from "../pages/AdminInternDetails";
import AdminInternRecords from "../pages/AdminInternRecords";
import AdminLeaveManagement from "../pages/AdminLeaveManagement";
import AgreementGuard from "../components/AgreementGuard";
import GateStaffLogin from "../pages/GateStaffLogin";
import GateStaffDashboard from "../pages/GateStaffDashboard";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      {/* Protected Intern Routes - Wrapped with AgreementGuard */}
      <Route
        path="/scan-qr"
        element={
          <AgreementGuard>
            <ScanQRCode />
          </AgreementGuard>
        }
      />
      <Route
        path="/dashboard"
        element={
          <AgreementGuard>
            <Dashboard />
          </AgreementGuard>
        }
      />
      <Route
        path="/availability"
        element={
          <AgreementGuard>
            <Availability />
          </AgreementGuard>
        }
      />
      <Route
        path="/log-book"
        element={
          <AgreementGuard>
            <LogBook />
          </AgreementGuard>
        }
      />
      <Route
        path="/DailyRecords"
        element={
          <AgreementGuard>
            <DailyRecords />
          </AgreementGuard>
        }
      />
      <Route
        path="/leave-requests"
        element={
          <AgreementGuard>
            <MyLeaveRequests />
          </AgreementGuard>
        }
      />
      <Route
        path="/seat-reservation"
        element={
          <AgreementGuard>
            <SeatReservation />
          </AgreementGuard>
        }
      />

      {/* Admin Routes */}
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/admin-dashboard" element={<AdminDashboard />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/daily-records" element={<AdminDailyRecords />} />
      <Route path="/admin/intern/:internId" element={<AdminInternDetails />} />
      <Route
        path="/admin/intern/:internId/records"
        element={<AdminInternRecords />}
      />
      <Route path="/admin/leave-requests" element={<AdminLeaveManagement />} />
      <Route path="/gate-staff-login" element={<GateStaffLogin />} />
      <Route path="/gate-staff-dashboard" element={<GateStaffDashboard />} />
    </Routes>
  );
};

export default AppRoutes;
