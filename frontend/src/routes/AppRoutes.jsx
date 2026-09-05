import React, { useEffect, Suspense, lazy } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
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
import TalentHubRestrictions from "../pages/TalentHubRestrictions";
import AdminHolidays from "../pages/AdminHolidays";
import AdminUserManagement from "../pages/AdminUserManagement";
import UniversityLogin from "../pages/UniversityLogin";
import UniversityDashboard from "../pages/UniversityDashboard";
import UniversityStudentDetails from "../pages/UniversityStudentDetails";
import AdminUniversityManagement from "../pages/AdminUniversityManagement";
import AdminAnalytics from "../pages/AdminAnalytics";
// Lazy-loaded — splits AdminInternPerformance into its own JS chunk
const AdminInternPerformance = lazy(() => import("../pages/AdminInternPerformance"));
import AdminRoute from "../components/AdminRoute";

const ScrollbarThemer = () => {
  const location = useLocation();
  
  useEffect(() => {
    if (location.pathname.startsWith('/admin')) {
      document.documentElement.classList.add('admin-theme');
      document.body.classList.add('admin-theme');
    } else {
      document.documentElement.classList.remove('admin-theme');
      document.body.classList.remove('admin-theme');
    }
  }, [location.pathname]);

  return null;
};

const AppRoutes = () => {
  return (
    <>
      <ScrollbarThemer />
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

      {/* University Routes */}
      <Route path="/university-login" element={<UniversityLogin />} />
      <Route path="/university/dashboard" element={<UniversityDashboard />} />
      <Route path="/university-dashboard" element={<UniversityDashboard />} />
      <Route path="/university/student/:internId" element={<UniversityStudentDetails />} />
      <Route path="/university/intern/:internId" element={<UniversityStudentDetails />} />
      <Route path="/university-student/:internId" element={<UniversityStudentDetails />} />

      {/* Admin Routes */}
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/gate-staff-login" element={<GateStaffLogin />} />
      <Route path="/gate-staff-dashboard" element={<GateStaffDashboard />} />
      <Route path="/verify/certificate/:token" element={<CertificateVerify />} />
      <Route element={<AdminRoute />}>
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

      <Route
        path="/admin/inactive-interns"
        element={<AdminInactiveInterns />}
      />
      <Route path="/admin/face-attendance" element={<AdminFaceAttendance />} />

      <Route
        path="/admin/logbook-restrictions"
        element={<LogbookRestrictions />}
      />
      <Route
        path="/admin/talenthub-restrictions"
        element={<TalentHubRestrictions />}
      />
      <Route path="/admin/holidays" element={<AdminHolidays />} />
      <Route path="/admin/users" element={<AdminUserManagement />} />
      <Route path="/admin/university-requests" element={<AdminUniversityManagement />} />
      <Route path="/admin/university-management" element={<AdminUniversityManagement />} />
      <Route path="/admin/analytics" element={<AdminAnalytics />} />
      <Route
        path="/admin/intern-performance"
        element={
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-[#000066]/30 border-t-[#000066] rounded-full animate-spin" /></div>}>
            <AdminInternPerformance />
          </Suspense>
        }
      />
      </Route>
      </Routes>
    </>
  );
};

export default AppRoutes;
