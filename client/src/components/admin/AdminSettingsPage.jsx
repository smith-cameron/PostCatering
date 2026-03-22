import { Navigate, useOutletContext } from "react-router-dom";
import AdminDashboard from "./AdminDashboard";

const AdminSettingsPage = () => {
  const { adminUser, sessionLoading, onAdminUserChange, canAccessDashboardSettings } = useOutletContext();

  if (!sessionLoading && !canAccessDashboardSettings) {
    return <Navigate to="/admin/menu-items" replace />;
  }

  return (
    <AdminDashboard
      embedded
      forcedTab="audit"
      adminUser={adminUser}
      sessionLoading={sessionLoading}
      onAdminUserChange={onAdminUserChange}
    />
  );
};

export default AdminSettingsPage;
