import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Dashboard from "../pages/Dashboard";
import InternsPage from "../pages/InternsPage";
import UploadCSV from "../pages/UploadCSV";
import Login from "../pages/Login";
import Register from "../pages/Register";
import AttendanceOverviewPage from "../pages/AttendanceOverviewPage";
import GroupPage from "../pages/GroupPage";
import AddIntern from "../pages/AddIntern";
import GroupOverview from "../pages/GroupOverview";
import WeekOverview from "../pages/WeekOverview";
import ProjectCreationPage from "../pages/ProjectCreationPage";
import ProjectManagementPage from "../pages/ProjectManagementPage";
import ProjectOverviewPage from "../pages/ProjectOverviewPage";
import QRGeneratorPage from "../pages/QRGeneratorPage";
import OnlineAttendancePage from "../pages/OnlineAttendancePage";
import InstructionGuide from "../pages/InstructionGuide";
import FileUpload from "../pages/FileUpload";
import AvailbleIntern from "../pages/AvailbleIntern";
import AttendanceSummaryPage from "../pages/AttendanceSummaryPage ";
import InternsHisPage from "../pages/InternsPageV2";
import DailyAttendanceQR from "../pages/DailyAttendanceQR";

const AppRoutes = () => {
  return (
      <Routes>
        <Route
          path="/"
          element={<Navigate to="/internshipattendance" replace />}
        />
        <Route path="/internshipattendance" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/interns" element={<InternsPage />} />
        <Route path="/interns-history" element={<InternsHisPage />} />
        <Route path="/upload" element={<UploadCSV />} />
        <Route path="/attendance/:id" element={<AttendanceOverviewPage />} />
        <Route path="/groups" element={<GroupPage />} />
        <Route path="/add-intern" element={<AddIntern />} />
        <Route path="/teams" element={<GroupOverview />} />
        <Route path="/week-overview" element={<WeekOverview />} />
        <Route path="/projects/create" element={<ProjectCreationPage />} />
        <Route path="/projects" element={<ProjectManagementPage />} />
        <Route
          path="/projects/:projectId/overview"
          element={<ProjectOverviewPage />}
        />
        <Route path="/qr-generator" element={<QRGeneratorPage />} />
        <Route path="/online-attendance" element={<OnlineAttendancePage />} />
        <Route path="/help" element={<InstructionGuide />} />
        <Route path="/upload-txt" element={<FileUpload />} />
        <Route path="/availbleintern" element={<AvailbleIntern />} />
        <Route path="/attendancesummary" element={<AttendanceSummaryPage />} />
        <Route path="/daily-attendance-qr" element={<DailyAttendanceQR />} />
      </Routes>
  );
};

export default AppRoutes;
