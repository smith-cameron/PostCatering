import AdminDashboardSectionPage from "./AdminDashboardSectionPage";
import { ADMIN_TAB_SETTINGS } from "./adminShared";

const AdminSettingsPage = () => {
  return <AdminDashboardSectionPage section={ADMIN_TAB_SETTINGS} requiresSettingsAccess />;
};

export default AdminSettingsPage;
