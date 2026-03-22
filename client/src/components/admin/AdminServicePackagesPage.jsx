import { useOutletContext } from "react-router-dom";
import AdminServicePlansPage from "./AdminServicePlansPage";

const AdminServicePackagesPage = () => {
  const { adminUser, sessionLoading } = useOutletContext();

  return <AdminServicePlansPage embedded adminUser={adminUser} sessionLoading={sessionLoading} />;
};

export default AdminServicePackagesPage;
