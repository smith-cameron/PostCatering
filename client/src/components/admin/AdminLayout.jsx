import { useContext, useEffect, useMemo, useState } from "react";
import { Spinner } from "react-bootstrap";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import Context from "../../context";
import { logoutAdminSession } from "./adminApi";
import AdminHeader from "./AdminHeader";
import AdminNavTabs from "./AdminNavTabs";
import AdminProfileModal from "./AdminProfileModal";
import { resolveActiveAdminTab } from "./adminShared";
import useAdminSession from "./useAdminSession";

const AdminLayout = () => {
  const { isDarkTheme, setThemeMode } = useContext(Context);
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const {
    adminUser,
    authError,
    sessionLoading,
    setAdminUser,
    canAccessDashboardSettings,
    canManageAdminUsers,
  } = useAdminSession();

  const activeTab = useMemo(() => resolveActiveAdminTab(location.pathname), [location.pathname]);
  const outletContext = useMemo(
    () => ({
      adminUser,
      sessionLoading,
      canAccessDashboardSettings,
      canManageAdminUsers,
      setAdminUser,
      onAdminUserChange: setAdminUser,
    }),
    [
      adminUser,
      sessionLoading,
      canAccessDashboardSettings,
      canManageAdminUsers,
      setAdminUser,
    ]
  );

  useEffect(() => {
    if (sessionLoading || canAccessDashboardSettings || !location.pathname.startsWith("/admin/settings")) {
      return;
    }
    navigate("/admin/menu-items", { replace: true });
  }, [canAccessDashboardSettings, location.pathname, navigate, sessionLoading]);

  const handleLogout = async () => {
    try {
      await logoutAdminSession();
    } finally {
      navigate("/admin/login", { replace: true });
    }
  };

  if (sessionLoading) {
    return (
      <main className="container py-5 d-flex justify-content-center">
        <Spinner animation="border" role="status" />
      </main>
    );
  }

  if (authError || !adminUser) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return (
    <main
      className={`container-fluid py-4 admin-dashboard ${isDarkTheme ? "admin-dashboard-dark" : ""}`}
      data-bs-theme={isDarkTheme ? "dark" : "light"}>
      <AdminHeader
        adminUser={adminUser}
        isDarkTheme={isDarkTheme}
        onOpenProfile={() => setShowProfileModal(true)}
        onToggleTheme={() => setThemeMode?.(isDarkTheme ? "light" : "dark")}
        onLogout={handleLogout}
      />

      <AdminNavTabs
        activeTab={activeTab}
        canAccessDashboardSettings={canAccessDashboardSettings}
      />

      <Outlet context={outletContext} />

      <AdminProfileModal
        show={showProfileModal}
        onHide={() => setShowProfileModal(false)}
        adminUser={adminUser}
        onAdminUserChange={setAdminUser}
        darkMode={isDarkTheme}
      />
    </main>
  );
};

export default AdminLayout;
