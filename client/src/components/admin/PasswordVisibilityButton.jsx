import { Button } from "react-bootstrap";

const PasswordVisibilityButton = ({ visible, label, onToggle, disabled = false }) => (
  <Button
    type="button"
    variant="outline-secondary"
    className="admin-password-visibility-toggle"
    aria-label={label}
    title={label}
    onClick={onToggle}
    disabled={disabled}>
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8Z" />
      <circle cx="8" cy="8" r="2.2" />
      {visible ? <path d="M2 2l12 12" /> : null}
    </svg>
  </Button>
);

export default PasswordVisibilityButton;
