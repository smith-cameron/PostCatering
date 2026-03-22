import { Button, Modal } from "react-bootstrap";

const InfoModal = ({ show, onHide, title, subtitle, children }) => {
  return (
    <Modal show={show} onHide={onHide} className="info-modal inquiry-modal">
      <Modal.Header closeButton>
        {title || subtitle ? (
          <div>
            {title ? <Modal.Title>{title}</Modal.Title> : null}
            {subtitle ? <div className="text-muted small mt-1">{subtitle}</div> : null}
          </div>
        ) : null}
      </Modal.Header>
      <Modal.Body>{children}</Modal.Body>
      <Modal.Footer>
        <Button className="btn-inquiry-action" variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default InfoModal;
