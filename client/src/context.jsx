import { createContext } from "react";

const Context = createContext({
  inquiryModalOpen: false,
  inquiryPresetService: "",
  openInquiryModal: () => {},
  closeInquiryModal: () => {},
  themeMode: "light",
  isDarkTheme: false,
  setThemeMode: () => {},
  toggleTheme: () => {},
});

export default Context;
