import { useCallback, useEffect, useRef } from "react";
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
}) => {
  const validationMessages = (Array.isArray(validationMessage) ? validationMessage : String(validationMessage || "").split("\n"))
    .map((message) => String(message || "").trim())
    .filter(Boolean);
  const hasValidation = validationMessages.length > 0;
  const canConfirm = !busy && !confirmDisabled;
  const canFix = !busy;
  const formRef = useRef(null);

  const runPrimaryAction = useCallback(() => {
    if (hasValidation) {
      if (!canFix) return;
      onCancel?.();
      return;
    }
    if (!canConfirm) return;
    onConfirm?.();
  }, [hasValidation, canFix, onCancel, canConfirm, onConfirm]);

  const handleSubmit = (event) => {
    event.preventDefault();
    runPrimaryAction();
  };

  const handleKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    const targetTag = String(event.target?.tagName || "").toUpperCase();
    if (targetTag === "TEXTAREA") return;
    event.preventDefault();
    runPrimaryAction();
  };

  useEffect(() => {
    if (!show) return undefined;

    const handleDocumentKeyDown = (event) => {
      if (event.defaultPrevented) return;
      if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
      const targetTag = String(event.target?.tagName || "").toUpperCase();
      if (targetTag === "TEXTAREA") return;
      const activeModal = document.querySelector(".modal.show");
      if (!activeModal || !formRef.current || !activeModal.contains(formRef.current)) return;

      event.preventDefault();
      runPrimaryAction();
    };

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => document.removeEventListener("keydown", handleDocumentKeyDown);
  }, [show, runPrimaryAction]);

  return (
    <Modal
      show={show}
      onHide={onCancel}
      centered
      dialogClassName={darkMode ? "admin-confirm-modal admin-confirm-modal-dark" : "admin-confirm-modal"}>
      <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
        <Modal.Header closeButton>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div>{body}</div>
          {hasValidation ? (
            <Alert variant="danger" className="mt-2 mb-0 py-2 small">
              {validationMessages.length === 1 ? (
                validationMessages[0]
              ) : (
                <ul className="mb-0 ps-3">
                  {validationMessages.map((message, index) => (
                    <li key={`${index}-${message}`}>{message}</li>
                  ))}
                </ul>
              )}
            </Alert>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button
            type="button"
            className={hasValidation ? "btn-inquiry-action" : undefined}
            variant={hasValidation ? "secondary" : "outline-secondary"}
            autoFocus={hasValidation}
            onClick={onCancel}
            disabled={busy}>
            {hasValidation ? "Fix" : "Cancel"}
          </Button>
          <Button
            type="submit"
            className={hasValidation ? undefined : confirmVariant === "secondary" ? "btn-inquiry-action" : undefined}
            variant={hasValidation ? "outline-secondary" : confirmVariant}
            autoFocus={!hasValidation}
            disabled={!canConfirm}>
            {confirmLabel}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
};

export default ConfirmActionModal;
