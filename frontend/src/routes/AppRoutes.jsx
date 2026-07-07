import React from "react";
import { Routes, Route } from "react-router-dom";
import Login from "../pages/Login";
import Attendance from "../pages/Attendance";
import FaceAttendance from "../pages/FaceAttendance";
import ScanQRCode from "../pages/ScanQRCode";
import Dashboard from "../pages/Dashboard";
import Availability from "../pages/Availability";
import LogBook from "../pages/LogBook"; // Make sure the filename is LogBook.jsx
import DailyRecords from "../pages/DailyRecords";
import MyLeaveRequests from "../pages/MyLeaveRequests";
import ShortLeavePass from "../pages/ShortLeavePass";
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
import AdminSeatManagement from "../pages/AdminSeatManagement";
import AdminInternLocations from "../pages/AdminInternLocations";
import AdminAnnouncements from "../pages/AdminAnnouncements";
import AdminInternAttendance from "../pages/Admininternattendance";
import InternAnnouncements from "../pages/InternAnnouncements";
import AdminQRManagement from "../pages/AdminQRManagement";
import AdminPinManagement from "../pages/AdminPinManagement";
import AdminInternCertificate from "../pages/AdminInternCertificate";
import AdminManualAttendance from "../pages/AdminManualAttendanceMarking";
import AdminInactiveInterns from "../pages/AdminInactiveInterns";
import CertificateVerify from "../pages/CertificateVerify";
import AdminFaceAttendance from "../pages/AdminFaceAttendance";
import AdminFeatureTips from "../pages/AdminFeatureTips";
import LogbookRestrictions from "../pages/LogbookRestrictions";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      {/* Protected Intern Routes - Wrapped with AgreementGuard */}
      <Route
        path="/attendance"
        element={
          <AgreementGuard>
            <Attendance />
          </AgreementGuard>
        }
      />
      <Route
        path="/face-attendance"
        element={
          <AgreementGuard>
            <FaceAttendance />
          </AgreementGuard>
        }
      />
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
        path="/announcements"
        element={
          <AgreementGuard>
            <InternAnnouncements />
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
            <MyLeaveRequests requestType="short_leave" />
          </AgreementGuard>
        }
      />
      <Route
        path="/study-leave-requests"
        element={
          <AgreementGuard>
            <MyLeaveRequests requestType="study_leave" />
          </AgreementGuard>
        }
      />
      <Route
        path="/leave-pass/:token"
        element={
          <AgreementGuard>
            <ShortLeavePass />
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
      <Route
        path="/admin/leave-requests"
        element={<AdminLeaveManagement requestType="short_leave" />}
      />
      <Route
        path="/admin/study-leave-requests"
        element={<AdminLeaveManagement requestType="study_leave" />}
      />
      <Route path="/gate-staff-login" element={<GateStaffLogin />} />
      <Route path="/gate-staff-dashboard" element={<GateStaffDashboard />} />
      <Route path="/admin/announcements" element={<AdminAnnouncements />} />
      <Route path="/admin/feature-tips" element={<AdminFeatureTips />} />
      <Route path="/admin/seat-management" element={<AdminSeatManagement />} />
      <Route
        path="/admin/intern-locations"
        element={<AdminInternLocations />}
      />
      <Route
        path="/admin/intern-attendance"
        element={<AdminInternAttendance />}
      />
      <Route path="/admin/qr-management" element={<AdminQRManagement />} />
      <Route path="/admin/pin-management" element={<AdminPinManagement />} />
      <Route
        path="/admin/intern/:internId/certificate"
        element={<AdminInternCertificate />}
      />
      <Route
        path="/admin/manual-attendance"
        element={<AdminManualAttendance />}
      />
<<<<<<< HEAD

=======
>>>>>>> talenthub/main
      <Route
        path="/admin/inactive-interns"
        element={<AdminInactiveInterns />}
      />
      <Route path="/admin/face-attendance" element={<AdminFaceAttendance />} />

      {/* Public Certificate Verification — no auth required */}
      <Route
        path="/verify/certificate/:token"
        element={<CertificateVerify />}
      />

      <Route
        path="/admin/logbook-restrictions"
        element={<LogbookRestrictions />}
      />
    </Routes>
  );
};

export default AppRoutes;
