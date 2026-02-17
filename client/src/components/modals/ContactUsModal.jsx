import { Modal } from "react-bootstrap";

const ContactUsModal = ({ show, onHide }) => {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Contact Us</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-3">
          <strong>Owner Phone Number:</strong> ____________________
        </p>
        <p className="mb-3">
          <strong>Email:</strong> ____________________
        </p>
        <p className="mb-0">
          <strong>Mailing Address:</strong> ____________________
        </p>
      </Modal.Body>
    </Modal>
  );
};

export default ContactUsModal;
