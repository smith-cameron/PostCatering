import { Alert, Button, Modal } from "react-bootstrap";

const InquirySuccessModal = ({ show, onHide }) => (
  <Modal show={show} onHide={onHide} centered>
    <Modal.Header closeButton>
      <Modal.Title>Inquiry Sent</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <Alert variant="success" className="mb-0">
        Your inquiry was sent successfully.
      </Alert>
    </Modal.Body>
    <Modal.Footer>
      <Button variant="secondary" onClick={onHide}>
        Close
      </Button>
    </Modal.Footer>
  </Modal>
);

export default InquirySuccessModal;
