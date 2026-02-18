import { useContext } from "react";
import { Outlet } from "react-router-dom";
import { Header, Footer, Inquiry } from "../imports";
import Context from "../context";

const Wrapper = () => {
  const { inquiryModalOpen, inquiryPresetService, openInquiryModal, closeInquiryModal } = useContext(Context);

  return (
    <>
      <Header onOpenInquiry={() => openInquiryModal()} />
      <Inquiry
        forceOpen={inquiryModalOpen}
        onRequestClose={closeInquiryModal}
        presetService={inquiryPresetService}
      />
      <Outlet />
      <Footer />
    </>
  );
};

export default Wrapper;
