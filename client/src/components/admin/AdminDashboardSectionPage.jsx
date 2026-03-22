import { Navigate, useOutletContext } from "react-router-dom";
import AdminDashboard from "./AdminDashboard";

const AdminDashboardSectionPage = ({
  section,
  requiresSettingsAccess = false,
}) => {
  const {
    adminUser,
    sessionLoading,
    onAdminUserChange,
    canAccessDashboardSettings,
    canManageAdminUsers,
  } = useOutletContext();

  if (requiresSettingsAccess && !sessionLoading && !canAccessDashboardSettings) {
    return <Navigate to="/admin/menu-items" replace />;
  }

  return (
    <AdminDashboard
      section={section}
      adminUser={adminUser}
      sessionLoading={sessionLoading}
      canAccessDashboardSettings={canAccessDashboardSettings}
      canManageAdminUsers={canManageAdminUsers}
      onAdminUserChange={onAdminUserChange}
    />
  );
};

export default AdminDashboardSectionPage;
