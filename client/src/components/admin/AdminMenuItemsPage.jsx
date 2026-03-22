import { useOutletContext } from "react-router-dom";
import AdminDashboard from "./AdminDashboard";

const AdminMenuItemsPage = () => {
  const { adminUser, sessionLoading, onAdminUserChange } = useOutletContext();

  return (
    <AdminDashboard
      embedded
      forcedTab="menu"
      adminUser={adminUser}
      sessionLoading={sessionLoading}
      onAdminUserChange={onAdminUserChange}
    />
  );
};

export default AdminMenuItemsPage;
