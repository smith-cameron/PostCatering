import { Form } from "react-bootstrap";

const InquiryFieldLabel = ({ children, required = false }) => (
  <Form.Label className="inquiry-field-label">
    <span>{children}</span>
    {required ? (
      <span className="inquiry-field-required-badge" aria-hidden="true">
        Required
      </span>
    ) : null}
  </Form.Label>
);

export default InquiryFieldLabel;
