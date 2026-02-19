import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { useSearchParams } from "react-router-dom";
import useMenuConfig from "../hooks/useMenuConfig";
import InquiryDesiredItemsSection from "./inquiry/InquiryDesiredItemsSection";
import InquiryServicePlanSection from "./inquiry/InquiryServicePlanSection";
import InquirySuccessModal from "./inquiry/InquirySuccessModal";
import {
  EMPTY_FORM,
  formatBudgetInput,
  getMinEventDateISO,
  getSelectionCategoryKeyFromText,
} from "./inquiry/inquiryUtils";
import useInquirySelections from "./inquiry/useInquirySelections";

const Inquiry = ({ forceOpen = false, onRequestClose = null, presetService = "" }) => {
  const minEventDateISO = useMemo(() => getMinEventDateISO(), []);
  const { menu, menuOptions, formalPlanOptions, loading: menuLoading, error: menuError } = useMenuConfig();
  const [searchParams] = useSearchParams();
  const presetServiceKey = presetService || searchParams.get("service") || "";

  const [showModal, setShowModal] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [highlightedDetailKeys, setHighlightedDetailKeys] = useState([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [desiredItems, setDesiredItems] = useState([]);
  const [traySizes, setTraySizes] = useState({});
  const [servicePlanId, setServicePlanId] = useState("");

  const {
    serviceOptions,
    servicePlans,
    selectedServicePlan,
    communitySelectionRules,
    displayedPlanDetails,
    shouldRequirePlanSelection,
    canShowDesiredItems,
    desiredItemGroups,
    itemSizeOptions,
  } = useInquirySelections({
    formServiceInterest: form.service_interest,
    servicePlanId,
    menu,
    menuOptions,
    formalPlanOptions,
  });

  const isValidPreset = useMemo(() => {
    const match = serviceOptions.find((service) => service.key === presetServiceKey);
    return Boolean(match);
  }, [presetServiceKey, serviceOptions]);

  const isControlledModal = typeof onRequestClose === "function";
  const modalOpen = isControlledModal ? forceOpen : showModal;

  const handleCloseModal = () => {
    if (isControlledModal) {
      onRequestClose();
      return;
    }
    setShowModal(false);
  };

  useEffect(() => {
    if (isValidPreset) {
      setForm((prev) => ({ ...prev, service_interest: presetServiceKey }));
    }
  }, [isValidPreset, presetServiceKey]);

  useEffect(() => {
    setDesiredItems([]);
    setTraySizes({});
    setServicePlanId("");
    setHighlightedDetailKeys([]);
  }, [form.service_interest]);

  useEffect(() => {
    if (!form.service_interest) return;

    const allowedItems = new Set(desiredItemGroups.flatMap((group) => group.items.map((item) => item.name)));
    setDesiredItems((prev) => prev.filter((item) => allowedItems.has(item)));
    setTraySizes((prev) => {
      const next = {};
      Object.entries(prev).forEach(([item, size]) => {
        if (allowedItems.has(item)) next[item] = size;
      });
      return next;
    });
  }, [form.service_interest, servicePlanId, selectedServicePlan, desiredItemGroups]);

  const onChange = (event) => {
    const { name, value } = event.target;
    if (name === "phone") {
      const sanitizedPhone = value.replace(/[^0-9+()\-\s.]/g, "");
      setForm((prev) => ({ ...prev, [name]: sanitizedPhone }));
      return;
    }
    if (name === "budget") {
      const sanitizedBudget = formatBudgetInput(value);
      setForm((prev) => ({ ...prev, [name]: sanitizedBudget }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onChangeServicePlan = (event) => {
    const nextPlanId = event.target.value;
    setServicePlanId(nextPlanId);
    setDesiredItems([]);
    setTraySizes({});
    setErrors([]);
    setHighlightedDetailKeys([]);
  };

  const onToggleDesiredItem = (item) => {
    setDesiredItems((prev) => {
      const isSelected = prev.includes(item);

      if (!isSelected && form.service_interest === "formal") {
        const limits = selectedServicePlan?.constraints || {};
        const itemGroup = desiredItemGroups.find((group) => group.items.some((groupItem) => groupItem.name === item));
        const groupKey = itemGroup?.groupKey || "other";
        const groupLimit = limits[groupKey] || null;

        if (groupLimit?.max) {
          const selectedInGroup = prev.filter((selectedItem) =>
            itemGroup?.items.some((groupItem) => groupItem.name === selectedItem)
          ).length;
          if (selectedInGroup >= groupLimit.max) {
            setHighlightedDetailKeys([groupKey]);
            setErrors([]);
            return prev;
          }
        }
      }

      if (!isSelected && form.service_interest === "community" && communitySelectionRules) {
        const itemGroup = desiredItemGroups.find((group) => group.items.some((groupItem) => groupItem.name === item));
        const category = itemGroup?.groupKey || "other";
        const categoryRule = communitySelectionRules[category];

        if (categoryRule?.max) {
          const selectedInCategory = prev.filter((selectedItem) => {
            const selectedGroup = desiredItemGroups.find((group) =>
              group.items.some((groupItem) => groupItem.name === selectedItem)
            );
            return (selectedGroup?.groupKey || "other") === category;
          }).length;

          if (selectedInCategory >= categoryRule.max) {
            setHighlightedDetailKeys([category]);
            setErrors([]);
            return prev;
          }
        }
      }

      const next = isSelected ? prev.filter((existingItem) => existingItem !== item) : [...prev, item];
      setErrors([]);
      setHighlightedDetailKeys([]);

      setTraySizes((prevSizes) => {
        const nextSizes = { ...prevSizes };
        if (isSelected) {
          delete nextSizes[item];
        } else {
          const options = itemSizeOptions[item] || [];
          if (options.length && !nextSizes[item]) {
            nextSizes[item] = options[0].value;
          }
        }
        return nextSizes;
      });

      return next;
    });
  };

  const onChangeTraySize = (item, traySize) => {
    setTraySizes((prev) => ({ ...prev, [item]: traySize }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrors([]);
    setHighlightedDetailKeys([]);
    setShowSuccessModal(false);

    try {
      if (menuLoading) {
        setErrors(["Menu configuration is still loading. Please wait."]);
        setLoading(false);
        return;
      }
      if (menuError) {
        setErrors(["Menu configuration failed to load. Please refresh and try again."]);
        setLoading(false);
        return;
      }

      const normalizedForm = {
        ...form,
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        event_date: form.event_date.trim(),
        service_interest: form.service_interest.trim(),
        company_website: form.company_website.trim(),
        budget: form.budget.trim(),
        message: form.message.trim(),
      };

      if (!normalizedForm.full_name) {
        setErrors(["full_name is required."]);
        setLoading(false);
        return;
      }
      if (!normalizedForm.email) {
        setErrors(["email is required."]);
        setLoading(false);
        return;
      }
      if (!normalizedForm.phone) {
        setErrors(["phone is required."]);
        setLoading(false);
        return;
      }
      if (!normalizedForm.event_date) {
        setErrors(["event_date is required."]);
        setLoading(false);
        return;
      }
      if (!normalizedForm.service_interest) {
        setErrors(["service_interest is required."]);
        setLoading(false);
        return;
      }
      if (!form.guest_count) {
        setErrors(["guest_count is required."]);
        setLoading(false);
        return;
      }
      if (shouldRequirePlanSelection && !servicePlanId) {
        setErrors(["Please select a package or tier option."]);
        setLoading(false);
        return;
      }

      if (form.service_interest === "formal") {
        const limits = selectedServicePlan?.constraints || {};
        for (const [groupKey, rule] of Object.entries(limits)) {
          const groups = desiredItemGroups.filter((group) => group.groupKey === groupKey);
          const selectedInGroup = groups
            .flatMap((group) => group.items || [])
            .filter((groupItem) => desiredItems.includes(groupItem.name)).length;
          if (rule.min && selectedInGroup < rule.min) {
            setHighlightedDetailKeys([groupKey]);
            setLoading(false);
            return;
          }
        }
      }

      if (form.service_interest === "community" && communitySelectionRules) {
        const categoryCounts = desiredItems.reduce((acc, selectedItem) => {
          const selectedGroup = desiredItemGroups.find((group) =>
            group.items.some((groupItem) => groupItem.name === selectedItem)
          );
          const category = selectedGroup?.groupKey || "other";
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        }, {});

        for (const [category, rule] of Object.entries(communitySelectionRules)) {
          const selectedCount = categoryCounts[category] || 0;
          if (rule.min && selectedCount < rule.min) {
            setHighlightedDetailKeys([category]);
            setLoading(false);
            return;
          }
          if (rule.max && selectedCount > rule.max) {
            setHighlightedDetailKeys([category]);
            setLoading(false);
            return;
          }
        }
      }

      const selectedService = serviceOptions.find((service) => service.key === form.service_interest);
      const selectedItems = desiredItems.map((item) => {
        const options = itemSizeOptions[item] || [];
        const selectedSize = options.find((option) => option.value === traySizes[item]);
        const selectedGroup = desiredItemGroups.find((group) => group.items.some((groupItem) => groupItem.name === item));
        return {
          name: item,
          category: selectedGroup?.groupKey || "other",
          tray_size: traySizes[item] || null,
          tray_price: selectedSize?.price || null,
        };
      });

      if (!selectedItems.length) {
        setErrors(["Please select at least one desired menu item."]);
        setLoading(false);
        return;
      }

      const payload = {
        ...normalizedForm,
        service_interest: selectedService ? selectedService.label : "",
        service_selection: selectedServicePlan,
        desired_menu_items: selectedItems,
        message: normalizedForm.message,
      };

      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();

      if (!response.ok) {
        const responseErrors = Array.isArray(body.errors) ? body.errors : ["Unable to submit inquiry."];
        const selectionKeys = [...new Set(responseErrors.map(getSelectionCategoryKeyFromText).filter(Boolean))];
        if (selectionKeys.length) {
          setHighlightedDetailKeys(selectionKeys);
          const nonSelectionErrors = responseErrors.filter((error) => !getSelectionCategoryKeyFromText(error));
          setErrors(nonSelectionErrors);
        } else {
          setErrors(responseErrors);
        }
        return;
      }

      if (body.warning) {
        console.warn("Inquiry saved but email send failed:", body.warning);
      }

      setForm({
        ...EMPTY_FORM,
        service_interest: isValidPreset ? presetServiceKey : "",
      });
      setDesiredItems([]);
      setTraySizes({});
      setServicePlanId("");
      setHighlightedDetailKeys([]);
      handleCloseModal();
      setShowSuccessModal(true);
    } catch {
      setErrors(["Network error. Please try again."]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal show={modalOpen} onHide={handleCloseModal} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Send Catering Inquiry</Modal.Title>
        </Modal.Header>

        <Form onSubmit={onSubmit}>
          <Modal.Body>
            <p className="mb-2 text-danger fw-semibold">* indicates a required field.</p>
            {menuLoading ? <Alert variant="info">Loading menu configuration...</Alert> : null}
            {menuError ? <Alert variant="danger">Menu configuration unavailable: {menuError}</Alert> : null}
            {errors.length ? (
              <Alert variant="danger">
                {errors.map((error) => (
                  <div key={error}>{error}</div>
                ))}
              </Alert>
            ) : null}

            <Form.Group className="mb-3">
              <Form.Label>
                Full Name <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control name="full_name" value={form.full_name} onChange={onChange} required />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                Email <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control type="email" name="email" value={form.email} onChange={onChange} required />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                Phone <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="tel"
                inputMode="tel"
                name="phone"
                value={form.phone}
                onChange={onChange}
                placeholder="(555) 123-4567"
                pattern="^(\+?1[\s.-]?)?(\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}$"
                title="Enter a valid US phone number, e.g. (555) 123-4567"
                required
              />
              <Form.Text className="text-muted">Use a valid US number (10 digits; optional +1 and separators).</Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Event Type</Form.Label>
              <Form.Control name="event_type" value={form.event_type} onChange={onChange} />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                Event Date <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="date"
                min={minEventDateISO}
                name="event_date"
                value={form.event_date}
                onChange={onChange}
                required
              />
              <Form.Text className="text-muted">Event date must be at least one week in the future.</Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                Guest Count <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control type="number" min="1" name="guest_count" value={form.guest_count} onChange={onChange} required />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Budget ($)</Form.Label>
              <Form.Control
                name="budget"
                inputMode="numeric"
                value={form.budget}
                onChange={onChange}
                placeholder="e.g. $2,500-$5,000"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                Service Interest <span className="text-danger">*</span>
              </Form.Label>
              <Form.Select name="service_interest" value={form.service_interest} onChange={onChange} required>
                <option value="">Select a service</option>
                {serviceOptions.map((service) => (
                  <option key={service.key} value={service.key}>
                    {service.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <InquiryServicePlanSection
              serviceInterest={form.service_interest}
              shouldRequirePlanSelection={shouldRequirePlanSelection}
              servicePlanId={servicePlanId}
              onChangeServicePlan={onChangeServicePlan}
              servicePlans={servicePlans}
              selectedServicePlan={selectedServicePlan}
              displayedPlanDetails={displayedPlanDetails}
              highlightedDetailKeys={highlightedDetailKeys}
            />

            <InquiryDesiredItemsSection
              serviceInterest={form.service_interest}
              shouldRequirePlanSelection={shouldRequirePlanSelection}
              canShowDesiredItems={canShowDesiredItems}
              desiredItemGroups={desiredItemGroups}
              desiredItems={desiredItems}
              traySizes={traySizes}
              onToggleDesiredItem={onToggleDesiredItem}
              onChangeTraySize={onChangeTraySize}
            />

            <Form.Group>
              <Form.Label>Message</Form.Label>
              <Form.Control as="textarea" rows={4} name="message" value={form.message} onChange={onChange} />
              <Form.Text className="text-muted">
                Message is for special chef requests, dietary notes, service details, or anything not captured above.
              </Form.Text>
            </Form.Group>

            <Form.Control
              type="text"
              name="company_website"
              value={form.company_website}
              onChange={onChange}
              autoComplete="off"
              tabIndex={-1}
              className="d-none"
              aria-hidden="true"
            />
          </Modal.Body>

          <Modal.Footer>
            <Button className="btn-inquiry-action" variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button className="btn-inquiry-action" variant="secondary" type="submit" disabled={loading}>
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

      <InquirySuccessModal show={showSuccessModal} onHide={() => setShowSuccessModal(false)} />
    </>
  );
};

export default Inquiry;
