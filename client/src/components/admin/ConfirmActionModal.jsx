import { Alert, Button, Modal } from "react-bootstrap";

const ConfirmActionModal = ({
  show,
  title = "Confirm change",
  body = "Are you sure you want to apply this change?",
  confirmLabel = "Confirm",
  confirmVariant = "secondary",
  validationMessage = "",
  confirmDisabled = false,
  darkMode = false,
  onCancel,
  onConfirm,
  busy = false,
}) => (
  <Modal
    show={show}
    onHide={onCancel}
    centered
    dialogClassName={darkMode ? "admin-confirm-modal admin-confirm-modal-dark" : "admin-confirm-modal"}>
    <Modal.Header closeButton>
      <Modal.Title>{title}</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <div>{body}</div>
      {validationMessage ? (
        <Alert variant="danger" className="mt-2 mb-0 py-2 small">
          {validationMessage}
        </Alert>
      ) : null}
    </Modal.Body>
    <Modal.Footer>
      <Button variant="outline-secondary" onClick={onCancel} disabled={busy}>
        {validationMessage ? "Fix" : "Cancel"}
      </Button>
      <Button
        className={confirmVariant === "secondary" ? "btn-inquiry-action" : undefined}
        variant={confirmVariant}
        onClick={onConfirm}
        disabled={busy || confirmDisabled}>
        {confirmLabel}
      </Button>
    </Modal.Footer>
  </Modal>
);

export default ConfirmActionModal;
