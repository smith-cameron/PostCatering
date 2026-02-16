import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { useSearchParams } from "react-router-dom";
import { MENU } from "../static/menuData";

const EMPTY_FORM = {
  full_name: "",
  email: "",
  phone: "",
  event_type: "",
  event_date: "",
  guest_count: "",
  budget: "",
  service_interest: "",
  message: "",
};

const Inquiry = () => {
  const [searchParams] = useSearchParams();
  const presetServiceKey = searchParams.get("service");

  const serviceOptions = useMemo(
    () =>
      Object.entries(MENU).map(([key, value]) => ({
        key,
        label: value.pageTitle,
      })),
    []
  );

  const presetServiceLabel = useMemo(() => {
    const match = serviceOptions.find((service) => service.key === presetServiceKey);
    return match ? match.label : "";
  }, [presetServiceKey, serviceOptions]);

  const [showModal, setShowModal] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [warning, setWarning] = useState("");
  const [submittedId, setSubmittedId] = useState(null);
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    service_interest: presetServiceLabel,
  });

  useEffect(() => {
    if (presetServiceLabel) {
      setForm((prev) => ({ ...prev, service_interest: presetServiceLabel }));
    }
  }, [presetServiceLabel]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrors([]);
    setWarning("");
    setSubmittedId(null);

    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json();

      if (!response.ok) {
        setErrors(body.errors || ["Unable to submit inquiry."]);
        return;
      }

      setSubmittedId(body.inquiry_id || null);
      if (body.warning) {
        setWarning(body.warning);
      }
      setForm({
        ...EMPTY_FORM,
        service_interest: presetServiceLabel || "",
      });
    } catch {
      setErrors(["Network error. Please try again."]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container my-4">
      <h2 className="mb-2">Catering Inquiry</h2>
      <p className="mb-3">Tell us about your event and menu needs. We will follow up shortly.</p>

      <Button variant="secondary" onClick={() => setShowModal(true)}>
        Open Inquiry Form
      </Button>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Send Catering Inquiry</Modal.Title>
        </Modal.Header>

        <Form onSubmit={onSubmit}>
          <Modal.Body>
            {submittedId ? <Alert variant="success">Inquiry submitted. ID: {submittedId}</Alert> : null}
            {warning ? <Alert variant="warning">{warning}</Alert> : null}
            {errors.length ? (
              <Alert variant="danger">
                {errors.map((error) => (
                  <div key={error}>{error}</div>
                ))}
              </Alert>
            ) : null}

            <Form.Group className="mb-3">
              <Form.Label>Full Name *</Form.Label>
              <Form.Control name="full_name" value={form.full_name} onChange={onChange} required />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Email *</Form.Label>
              <Form.Control type="email" name="email" value={form.email} onChange={onChange} required />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Phone</Form.Label>
              <Form.Control name="phone" value={form.phone} onChange={onChange} />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Event Type</Form.Label>
              <Form.Control name="event_type" value={form.event_type} onChange={onChange} />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Event Date</Form.Label>
              <Form.Control type="date" name="event_date" value={form.event_date} onChange={onChange} />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Guest Count</Form.Label>
              <Form.Control type="number" min="0" name="guest_count" value={form.guest_count} onChange={onChange} />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Budget</Form.Label>
              <Form.Control name="budget" value={form.budget} onChange={onChange} />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Service Interest</Form.Label>
              <Form.Select name="service_interest" value={form.service_interest} onChange={onChange}>
                <option value="">Select a service</option>
                {serviceOptions.map((service) => (
                  <option key={service.key} value={service.label}>
                    {service.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group>
              <Form.Label>Message *</Form.Label>
              <Form.Control as="textarea" rows={4} name="message" value={form.message} onChange={onChange} required />
            </Form.Group>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="secondary" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Spinner size="sm" className="me-2" />
                  Sending...
                </>
              ) : (
                "Submit Inquiry"
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </main>
  );
};

export default Inquiry;
