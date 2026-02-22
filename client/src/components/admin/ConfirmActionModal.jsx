import { Button, Modal } from "react-bootstrap";

const ConfirmActionModal = ({
  show,
  title = "Confirm change",
  body = "Are you sure you want to apply this change?",
  confirmLabel = "Confirm",
  onCancel,
  onConfirm,
  busy = false,
}) => (
  <Modal show={show} onHide={onCancel} centered>
    <Modal.Header closeButton>
      <Modal.Title>{title}</Modal.Title>
    </Modal.Header>
    <Modal.Body>{body}</Modal.Body>
    <Modal.Footer>
      <Button variant="outline-secondary" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
      <Button className="btn-inquiry-action" variant="secondary" onClick={onConfirm} disabled={busy}>
        {confirmLabel}
      </Button>
    </Modal.Footer>
  </Modal>
);

export default ConfirmActionModal;
