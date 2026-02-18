import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import Context from "./context";
import { Wrapper, Landing, NotFound, ServiceMenu, Inquiry } from "./imports";
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
            <Route path="/" element={<Wrapper />}>git
              <Route index element={<Landing />} />
              <Route path="services/:menuKey" element={<ServiceMenu />} />
              <Route path="inquiry" element={<Inquiry />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </Context.Provider>
    </div>
  );
}

export default App;
