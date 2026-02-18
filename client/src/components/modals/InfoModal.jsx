import { Button, Modal } from "react-bootstrap";

const InfoModal = ({ show, onHide, title, subtitle, children }) => {
  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <div>
          <Modal.Title>{title}</Modal.Title>
          {subtitle ? <div className="text-muted small mt-1">{subtitle}</div> : null}
        </div>
      </Modal.Header>
      <Modal.Body>{children}</Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default InfoModal;
