import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import Context from "./context";
import { AdminDashboard, AdminLogin, Wrapper, Landing, NotFound, ServiceMenu, ShowcaseGallery } from "./imports";
import "./App.css";

function App() {
  const [inquiryModalState, setInquiryModalState] = useState({
    open: false,
    presetService: "",
  });

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

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-bs-theme", "light");
    document.documentElement.style.colorScheme = "light";
  }, []);

  return (
    <div className="app">
      <Context.Provider
        value={{
          inquiryModalOpen: inquiryModalState.open,
          inquiryPresetService: inquiryModalState.presetService,
          openInquiryModal,
          closeInquiryModal,
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
