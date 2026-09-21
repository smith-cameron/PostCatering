import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Context from "./context";
import "./App.css";

const THEME_STORAGE_KEY = "post_catering_theme";
const LEGACY_ADMIN_THEME_STORAGE_KEY = "admin_dashboard_theme";
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const AdminLogin = lazy(() => import("./components/admin/AdminLogin"));
const AdminMediaPage = lazy(() => import("./components/admin/AdminMediaPage"));
const AdminMenuItemsPage = lazy(() => import("./components/admin/AdminMenuItemsPage"));
const AdminServicePackagesPage = lazy(() => import("./components/admin/AdminServicePackagesPage"));
const AdminSettingsPage = lazy(() => import("./components/admin/AdminSettingsPage"));
const Wrapper = lazy(() => import("./components/Wrapper"));
const Landing = lazy(() => import("./components/Landing"));
const NotFound = lazy(() => import("./components/NotFound"));
const ServiceMenu = lazy(() => import("./components/ServiceMenu"));
const ShowcaseGallery = lazy(() => import("./components/ShowcaseGallery"));

const getInitialThemeMode = () => {
  if (typeof window === "undefined") return "light";

  const persistedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (persistedTheme === "dark" || persistedTheme === "light") {
    return persistedTheme;
  }

  const legacyTheme = window.localStorage.getItem(LEGACY_ADMIN_THEME_STORAGE_KEY);
  if (legacyTheme === "dark" || legacyTheme === "light") {
    return legacyTheme;
  }

  return "light";
};

const RouteLoadingIndicator = () => (
  <div className="app-route-loading" role="status" aria-live="polite">
    Loading...
  </div>
);

const withRouteLoader = (element) => <Suspense fallback={<RouteLoadingIndicator />}>{element}</Suspense>;

function App() {
  const [inquiryModalState, setInquiryModalState] = useState({
    open: false,
    presetService: "",
  });
  const [themeMode, setThemeMode] = useState(getInitialThemeMode);
  const isDarkTheme = themeMode === "dark";

  const openInquiryModal = (presetService = "") => {
    setInquiryModalState({
      open: true,
      presetService,
    });
  };

  const closeInquiryModal = () => {
    setInquiryModalState((prev) => ({
      ...prev,
      open: false,
    }));
  };

  const toggleTheme = () => {
    setThemeMode((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  };

  useEffect(() => {
    if (typeof document === "undefined") return;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    window.localStorage.setItem(LEGACY_ADMIN_THEME_STORAGE_KEY, themeMode);
    document.documentElement.setAttribute("data-bs-theme", themeMode);
    document.documentElement.style.colorScheme = themeMode;
  }, [themeMode]);

  return (
    <div className={`app app-theme-${themeMode}`}>
      <Context.Provider
        value={{
          inquiryModalOpen: inquiryModalState.open,
          inquiryPresetService: inquiryModalState.presetService,
          openInquiryModal,
          closeInquiryModal,
          themeMode,
          isDarkTheme,
          setThemeMode,
          toggleTheme,
        }}>
        <BrowserRouter>
          <Routes>
            <Route path="/admin/login" element={withRouteLoader(<AdminLogin />)} />
            <Route path="/admin/service-plans" element={<Navigate to="/admin/service-packages" replace />} />
            <Route path="/admin" element={withRouteLoader(<AdminLayout />)}>
              <Route index element={<Navigate to="menu-items" replace />} />
              <Route path="menu-items" element={withRouteLoader(<AdminMenuItemsPage />)} />
              <Route path="service-packages" element={withRouteLoader(<AdminServicePackagesPage />)} />
              <Route path="media" element={withRouteLoader(<AdminMediaPage />)} />
              <Route path="settings" element={withRouteLoader(<AdminSettingsPage />)} />
              <Route path="*" element={<Navigate to="menu-items" replace />} />
            </Route>
            <Route path="/" element={withRouteLoader(<Wrapper />)}>
              <Route index element={withRouteLoader(<Landing />)} />
              <Route path="services/:menuKey" element={withRouteLoader(<ServiceMenu />)} />
              <Route path="showcase" element={withRouteLoader(<ShowcaseGallery />)} />
              <Route path="*" element={withRouteLoader(<NotFound />)} />
            </Route>
          </Routes>
        </BrowserRouter>
      </Context.Provider>
    </div>
  );
}

export default App;
