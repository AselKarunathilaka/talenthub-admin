import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getAdminSession } from "../utils/adminAuth";

const AdminRoute = () => {
  const location = useLocation();
  const session = getAdminSession();
  if (!session?.token || !session?.user?.role) {
    return <Navigate to="/admin-login" replace state={{ from: location }} />;
  }
  return <Outlet />;
};

export default AdminRoute;
