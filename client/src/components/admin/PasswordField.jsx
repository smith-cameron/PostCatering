import { Form, InputGroup } from "react-bootstrap";
import PasswordVisibilityButton from "./PasswordVisibilityButton";

const PasswordField = ({
  controlId,
  label,
  value,
  onChange,
  visible,
  onToggle,
  disabled = false,
  isInvalid = false,
  autoComplete = "current-password",
  className = "mb-3",
  labelClassName = "",
  helperText = "",
  helperTextClassName = "",
  required = false,
  ariaLabel = "",
  showToggleLabel = "",
  hideToggleLabel = "",
}) => {
  const resolvedFieldName = String(ariaLabel || label || "password").trim().toLowerCase();
  const resolvedShowToggleLabel = showToggleLabel || `Show ${resolvedFieldName}`;
  const resolvedHideToggleLabel = hideToggleLabel || `Hide ${resolvedFieldName}`;
  const resolvedLabelClassName = helperText ? ["mb-0", labelClassName].filter(Boolean).join(" ") : labelClassName;

  return (
    <Form.Group className={className} controlId={controlId}>
      {label ? (
        helperText ? (
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <Form.Label className={resolvedLabelClassName}>
              {label}
              {required ? (
                <span className="text-danger ms-1" aria-hidden="true">
                  *
                </span>
              ) : null}
            </Form.Label>
            <span className={helperTextClassName}>{helperText}</span>
          </div>
        ) : (
          <Form.Label>
            {label}
            {required ? (
              <span className="text-danger ms-1" aria-hidden="true">
                *
              </span>
            ) : null}
          </Form.Label>
        )
      ) : null}

      <InputGroup hasValidation>
        <Form.Control
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          aria-label={ariaLabel || label}
          value={value}
          isInvalid={isInvalid}
          onChange={onChange}
        />
        <PasswordVisibilityButton
          visible={visible}
          label={visible ? resolvedHideToggleLabel : resolvedShowToggleLabel}
          onToggle={onToggle}
          disabled={disabled}
        />
      </InputGroup>
    </Form.Group>
  );
};

export default PasswordField;
