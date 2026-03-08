import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import Context from "./context";
import { AdminDashboard, AdminLogin, Wrapper, Landing, NotFound, ServiceMenu, ShowcaseGallery } from "./imports";
import "./App.css";

const THEME_STORAGE_KEY = "post_catering_theme";
const LEGACY_ADMIN_THEME_STORAGE_KEY = "admin_dashboard_theme";

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
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/*" element={<AdminDashboard />} />
            <Route path="/" element={<Wrapper />}>
              <Route index element={<Landing />} />
              <Route path="services/:menuKey" element={<ServiceMenu />} />
              <Route path="showcase" element={<ShowcaseGallery />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </Context.Provider>
    </div>
  );
}

export default App;
