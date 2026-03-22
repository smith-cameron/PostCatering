import { useOutletContext } from "react-router-dom";
import AdminDashboard from "./AdminDashboard";

const AdminMediaPage = () => {
  const { adminUser, sessionLoading, onAdminUserChange } = useOutletContext();

  return (
    <AdminDashboard
      embedded
      forcedTab="media"
      adminUser={adminUser}
      sessionLoading={sessionLoading}
      onAdminUserChange={onAdminUserChange}
    />
  );
};

export default AdminMediaPage;
