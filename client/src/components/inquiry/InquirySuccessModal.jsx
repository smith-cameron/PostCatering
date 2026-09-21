import { Alert } from "react-bootstrap";
import InfoModal from "../modals/InfoModal";

const InquirySuccessModal = ({ show, onHide }) => (
  <InfoModal show={show} onHide={onHide} title="Inquiry Sent" centered>
    <Alert variant="success" className="mb-0">
      Your inquiry was sent successfully.
    </Alert>
  </InfoModal>
);

export default InquirySuccessModal;
