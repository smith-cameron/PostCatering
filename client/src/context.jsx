import { createContext } from "react";

const Context = createContext({
  inquiryModalOpen: false,
  inquiryPresetService: "",
  openInquiryModal: () => {},
  closeInquiryModal: () => {},
});

export default Context;
