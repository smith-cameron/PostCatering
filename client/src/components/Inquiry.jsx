import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { useSearchParams } from "react-router-dom";
import useMenuConfig from "../hooks/useMenuConfig";

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

const COMMUNITY_TACO_BAR_OPTIONS = ["Carne Asada", "Chicken", "Carnitas"];

const toIdPart = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-");

const isPricedValue = (value) => /\$/.test(String(value || ""));
const getMinEventDateISO = () => {
  const now = new Date();
  now.setDate(now.getDate() + 7);
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
};

const buildCommunitySelectionRules = (plan) => {
  if (!plan) return null;
  if (plan.constraints && typeof plan.constraints === "object") {
    return Object.entries(plan.constraints).reduce((acc, [key, value]) => {
      if (typeof value === "number") {
        acc[key] = { max: value };
      } else if (value && typeof value === "object") {
        acc[key] = value;
      }
      return acc;
    }, {});
  }
  if (plan.level === "package") {
    const normalizedTitle = String(plan.title || "").toLowerCase();
    if (normalizedTitle.includes("taco bar")) {
      return {
        entree: { min: 1, max: 1 },
      };
    }
    if (normalizedTitle.includes("hearty homestyle")) {
      return {
        entree: { min: 1, max: 1 },
        sides_salads: { min: 2, max: 2 },
      };
    }
  }
  return null;
};

const toTitleCase = (value) =>
  String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

const getReadableCategoryLabel = (key) => {
  const map = {
    entree: "Entrees",
    sides_salads: "Sides/Salads",
    starter: "Starters",
    passed: "Passed Appetizers",
    sides: "Sides",
  };
  return map[key] || toTitleCase(String(key || "").replace(/_/g, " "));
};

const parseCommunityPackageDetails = (details) => {
  const joined = (details || []).join(" ").trim();
  if (!joined) return [];

  const cleaned = joined.replace(/^includes\s*/i, "");
  if (cleaned.includes("+")) {
    return cleaned
      .split("+")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const lower = part.toLowerCase();
        if (/^\d+\s+/.test(lower)) return `Choose ${toTitleCase(part)}`;
        return toTitleCase(part);
      });
  }
  if (cleaned.includes(",")) {
    return cleaned
      .split(",")
      .map((part) => toTitleCase(part.trim()))
      .filter(Boolean);
  }
  return [toTitleCase(cleaned)];
};

const getCommunityPackageDetails = (plan) => {
  if (!plan) return [];
  const normalizedTitle = String(plan.title || "").toLowerCase();
  if (normalizedTitle.includes("hearty homestyle")) {
    return ["Choose 1 Entree/Protein", "Choose 2 Sides/Salads", "Bread"];
  }
  return parseCommunityPackageDetails(plan.details);
};

const getSelectedCountForGroup = (selectedItems, desiredItemGroups, groupKey) => {
  const groups = desiredItemGroups.filter((group) => group.groupKey === groupKey);
  return groups
    .flatMap((group) => group.items || [])
    .filter((groupItem) => selectedItems.includes(groupItem.name)).length;
};

const getDisplayPlanDetails = (serviceKey, plan, communityLimits) => {
  if (!plan) return [];
  if (serviceKey === "formal" && plan.level === "package") {
    if (plan.id === "formal:3-course") {
      return ["2 Passed Appetizers", "1 Starter", "1 Entree and 1 Side or 2 Entrees"];
    }
    if (plan.id === "formal:2-course") {
      return ["1 Starter", "1 Entree and 1 Side or 2 Entrees"];
    }
  }
  if (serviceKey === "community" && plan.level === "package") {
    return getCommunityPackageDetails(plan);
  }
  if (serviceKey !== "community" || plan.level !== "tier") return plan.details || [];

  const details = [];
  if (communityLimits?.entree?.max) {
    const exactEntreeCount =
      communityLimits?.entree?.min && communityLimits?.entree?.min === communityLimits?.entree?.max;
    details.push(
      exactEntreeCount
        ? `Choose ${communityLimits.entree.max} Entrees/Proteins`
        : `Choose up to ${communityLimits.entree.max} Entrees/Proteins`
    );
  }
  if (communityLimits?.sides_salads?.max) {
    const exactSidesCount =
      communityLimits?.sides_salads?.min &&
      communityLimits?.sides_salads?.min === communityLimits?.sides_salads?.max;
    details.push(
      exactSidesCount
        ? `Choose ${communityLimits.sides_salads.max} Sides/Salads`
        : `Choose up to ${communityLimits.sides_salads.max} Sides/Salads`
    );
  }
  return details.length ? details : plan.details || [];
};

const normalizeSizeOption = (option) => {
  if (typeof option === "string") {
    return {
      value: option,
      label: `${option} Tray`,
      price: null,
    };
  }
  return {
    value: option?.value || "",
    label: option?.label || `${option?.value || ""} Tray`,
    price: option?.price || null,
  };
};

const getDisplayGroupTitle = (serviceKey, group) => {
  if (serviceKey !== "formal") return group.title;
  const map = {
    passed: "Passed Appetizers",
    starter: "Starters",
    entree: "Entrees",
    sides: "Sides",
  };
  return map[group.groupKey] || group.title;
};

const getApprovedFormalPlans = (plans) => (plans || []).filter((plan) => plan.id !== "formal:2-course");

const buildServicePlanOptions = (serviceKey, menu, formalPlanOptions) => {
  if (serviceKey === "formal") {
    return getApprovedFormalPlans(formalPlanOptions);
  }

  const serviceMenu = menu[serviceKey];
  if (!serviceMenu?.sections) return [];

  const plans = [];

  serviceMenu.sections.forEach((section) => {
    if (section.type === "package" && section.title) {
      plans.push({
        id: `package:${section.title}`,
        level: "package",
        title: section.title,
        price: section.price || "",
        details: section.description ? [section.description] : [],
      });
      return;
    }

    if (section.type === "tiers" && Array.isArray(section.tiers)) {
      section.tiers.forEach((tier) => {
        plans.push({
          id: `tier:${section.title}:${tier.tierTitle}`,
          level: "tier",
          sectionId: section.sectionId || null,
          courseType: section.courseType || null,
          sectionTitle: section.title,
          title: tier.tierTitle,
          price: tier.price || "",
          details: tier.bullets || [],
          constraints: tier.constraints || null,
        });
      });
    }
  });

  return plans;
};

const buildServiceItemGroups = (serviceKey, menu, menuOptions) => {
  const serviceData = menu[serviceKey];
  if (!serviceData?.sections) return [];

  const groups = [];
  const addGroup = (title, items, groupKey = "other") => {
    const seen = new Set();
    const uniqueItems = items.filter((item) => {
      if (!item?.name) return false;
      if (seen.has(item.name)) return false;
      seen.add(item.name);
      return true;
    });
    if (!uniqueItems.length) return;
    groups.push({
      title: title || "Menu Items",
      groupKey,
      items: uniqueItems,
    });
  };

  serviceData.sections.forEach((section) => {
    if (!section.type && Array.isArray(section.rows)) {
      const sectionItems = section.rows
        .map((row) => {
          if (!Array.isArray(row) || !row[0]) return null;

          const sizeOptions = [];
          if (Array.isArray(section.columns)) {
            section.columns.forEach((column, columnIndex) => {
              if (columnIndex === 0) return;

              const columnLabel = String(column || "").toLowerCase();
              if (!columnLabel.includes("half") && !columnLabel.includes("full")) return;

              const priceValue = row[columnIndex];
              if (!isPricedValue(priceValue)) return;

              if (columnLabel.includes("half")) {
                sizeOptions.push({
                  value: "Half",
                  label: `Half Tray (${priceValue})`,
                  price: priceValue,
                });
              }
              if (columnLabel.includes("full")) {
                sizeOptions.push({
                  value: "Full",
                  label: `Full Tray (${priceValue})`,
                  price: priceValue,
                });
              }
            });
          }

          return {
            name: row[0],
            sizeOptions,
          };
        })
        .filter(Boolean);

      const sectionGroupKey = section.category || section.courseType || "other";
      addGroup(section.title, sectionItems, sectionGroupKey);
      return;
    }

    if (section.type === "includeMenu" && Array.isArray(section.includeKeys)) {
      section.includeKeys.forEach((includeKey) => {
        const block = menuOptions[includeKey];
        if (!block?.items?.length) return;

        addGroup(
          block.title,
          block.items.map((item) => ({
              name: item,
              sizeOptions: serviceKey === "togo" ? ["Half", "Full"].map(normalizeSizeOption) : [],
            })),
          block.category || "other"
        );
      });
      return;
    }

    if (section.type === "tiers" && Array.isArray(section.tiers)) {
      if (serviceKey === "community") return;

      const sectionItems = [];
      section.tiers.forEach((tier) => {
        tier?.bullets?.forEach((item) => sectionItems.push({ name: item, sizeOptions: [] }));
      });
      const sectionGroupKey = section.courseType || "other";
      addGroup(section.title, sectionItems, sectionGroupKey);
      return;
    }

    if (section.type === "package" && section.title) {
      if (serviceKey === "community") return;
      if (section.title === "Three-Course Dinner Pricing") return;
      addGroup("Packages", [{ name: section.title, sizeOptions: [] }], "package");
    }
  });

  return groups;
};

const isCommunityTacoBarPlan = (plan) =>
  Boolean(plan && plan.level === "package" && String(plan.title || "").toLowerCase().includes("taco bar"));

const getPlanDisplayTitle = (serviceKey, plan) => {
  const title = String(plan?.title || "");
  if (serviceKey === "community") {
    return title.replace(/\s*\([^)]*\)\s*/g, "").trim();
  }
  return title;
};

const Inquiry = () => {
  const minEventDateISO = useMemo(() => getMinEventDateISO(), []);
  const { menu, menuOptions, formalPlanOptions, loading: menuLoading, error: menuError } = useMenuConfig();
  const [searchParams] = useSearchParams();
  const presetServiceKey = searchParams.get("service") || "";

  const serviceOptions = useMemo(
    () =>
      Object.entries(menu).map(([key, value]) => ({
        key,
        label: value.pageTitle,
      })),
    [menu]
  );

  const isValidPreset = useMemo(() => {
    const match = serviceOptions.find((service) => service.key === presetServiceKey);
    return Boolean(match);
  }, [presetServiceKey, serviceOptions]);

  const [showModal, setShowModal] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [warning, setWarning] = useState("");
  const [submittedId, setSubmittedId] = useState(null);
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    service_interest: isValidPreset ? presetServiceKey : "",
  });
  const [desiredItems, setDesiredItems] = useState([]);
  const [traySizes, setTraySizes] = useState({});
  const [servicePlanId, setServicePlanId] = useState("");

  useEffect(() => {
    if (isValidPreset) {
      setForm((prev) => ({ ...prev, service_interest: presetServiceKey }));
    }
  }, [isValidPreset, presetServiceKey]);

  useEffect(() => {
    setDesiredItems([]);
    setTraySizes({});
    setServicePlanId("");
  }, [form.service_interest]);

  const servicePlans = useMemo(
    () => buildServicePlanOptions(form.service_interest, menu, formalPlanOptions),
    [form.service_interest, menu, formalPlanOptions]
  );
  const selectedServicePlan = useMemo(
    () => servicePlans.find((plan) => plan.id === servicePlanId) || null,
    [servicePlanId, servicePlans]
  );
  const communitySelectionRules = useMemo(() => {
    if (form.service_interest !== "community") return null;
    return buildCommunitySelectionRules(selectedServicePlan);
  }, [form.service_interest, selectedServicePlan]);
  const displayedPlanDetails = useMemo(
    () => getDisplayPlanDetails(form.service_interest, selectedServicePlan, communitySelectionRules),
    [form.service_interest, selectedServicePlan, communitySelectionRules]
  );
  const shouldRequirePlanSelection =
    form.service_interest === "community" || form.service_interest === "formal";
  const canShowDesiredItems =
    Boolean(form.service_interest) && (!shouldRequirePlanSelection || Boolean(selectedServicePlan));
  const desiredItemGroups = useMemo(() => {
    const groups = buildServiceItemGroups(form.service_interest, menu, menuOptions);
    if (form.service_interest === "community" && isCommunityTacoBarPlan(selectedServicePlan)) {
      return [
        {
          title: "Taco Bar Proteins",
          groupKey: "entree",
          items: COMMUNITY_TACO_BAR_OPTIONS.map((item) => ({ name: item, sizeOptions: [] })),
        },
      ];
    }
    if (form.service_interest !== "formal") return groups;

    if (servicePlanId === "formal:2-course") {
      return groups.filter((group) => group.groupKey !== "passed");
    }
    return groups;
  }, [form.service_interest, servicePlanId, selectedServicePlan, menu, menuOptions]);
  const itemSizeOptions = useMemo(() => {
    const map = {};
    desiredItemGroups.forEach((group) => {
      group.items.forEach((item) => {
        map[item.name] = (item.sizeOptions || []).map(normalizeSizeOption);
      });
    });
    return map;
  }, [desiredItemGroups]);

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
      const sanitizedBudget = value.replace(/[A-Za-z]/g, "");
      setForm((prev) => ({ ...prev, [name]: sanitizedBudget }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onToggleDesiredItem = (item) => {
    setDesiredItems((prev) => {
      const isSelected = prev.includes(item);

      if (!isSelected && form.service_interest === "formal") {
        const limits = selectedServicePlan?.constraints || {};
        const itemGroup = desiredItemGroups.find((group) => group.items.some((groupItem) => groupItem.name === item));
        const groupKey = itemGroup?.groupKey || "other";
        const groupTitle = itemGroup?.title || groupKey;
        const groupLimit = limits[groupKey] || null;

        if (groupLimit?.max) {
          const selectedInGroup = prev.filter((selectedItem) =>
            itemGroup?.items.some((groupItem) => groupItem.name === selectedItem)
          ).length;
          if (selectedInGroup >= groupLimit.max) {
            setErrors([`You can only select up to ${groupLimit.max} item(s) in "${groupTitle}".`]);
            return prev;
          }
        }

        if (selectedServicePlan?.id === "formal:3-course") {
          const entreeCount = getSelectedCountForGroup(prev, desiredItemGroups, "entree");
          const sideCount = getSelectedCountForGroup(prev, desiredItemGroups, "sides");

          if (groupKey === "sides" && sideCount >= 1) {
            setErrors(["Three-course dinner allows at most 1 side."]);
            return prev;
          }
          if (groupKey === "sides" && entreeCount >= 2) {
            setErrors(["For three-course dinner, choose either 2 entrees or 1 entree and 1 side."]);
            return prev;
          }
          if (groupKey === "entree" && sideCount >= 1 && entreeCount >= 1) {
            setErrors(["For three-course dinner, choose either 2 entrees or 1 entree and 1 side."]);
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
            setErrors([
              `For this selection, you can choose up to ${categoryRule.max} ${getReadableCategoryLabel(category)}.`,
            ]);
            return prev;
          }
        }
      }

      const next = isSelected ? prev.filter((existingItem) => existingItem !== item) : [...prev, item];
      if (!isSelected) setErrors([]);

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
    setWarning("");
    setSubmittedId(null);

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

      if (shouldRequirePlanSelection && !servicePlanId) {
        setErrors(["Please select a package or tier option."]);
        setLoading(false);
        return;
      }

      if (form.service_interest === "formal") {
        const limits = selectedServicePlan?.constraints || {};
        for (const [groupKey, rule] of Object.entries(limits)) {
          const groups = desiredItemGroups.filter((g) => g.groupKey === groupKey);
          const selectedInGroup = groups
            .flatMap((group) => group.items || [])
            .filter((groupItem) => desiredItems.includes(groupItem.name)).length;
          if (rule.min && selectedInGroup < rule.min) {
            setErrors([`Please select at least ${rule.min} item(s) in the ${getReadableCategoryLabel(groupKey)} section.`]);
            setLoading(false);
            return;
          }
        }

        if (selectedServicePlan?.id === "formal:3-course") {
          const entreeCount = getSelectedCountForGroup(desiredItems, desiredItemGroups, "entree");
          const sideCount = getSelectedCountForGroup(desiredItems, desiredItemGroups, "sides");
          const isValidCombo = (entreeCount === 2 && sideCount === 0) || (entreeCount === 1 && sideCount === 1);

          if (!isValidCombo) {
            setErrors(["Three-course dinner requires either 2 entrees or 1 entree and 1 side."]);
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
            setErrors([`Please select at least ${rule.min} ${getReadableCategoryLabel(category)}.`]);
            setLoading(false);
            return;
          }
          if (rule.max && selectedCount > rule.max) {
            setErrors([`For this selection, you can choose up to ${rule.max} ${getReadableCategoryLabel(category)}.`]);
            setLoading(false);
            return;
          }
        }
      }

      const selectedService = serviceOptions.find((service) => service.key === form.service_interest);
      const selectedItems = desiredItems.map((item) => {
        const options = itemSizeOptions[item] || [];
        const selectedSize = options.find((option) => option.value === traySizes[item]);
        return {
          name: item,
          tray_size: traySizes[item] || null,
          tray_price: selectedSize?.price || null,
        };
      });
      if (!selectedItems.length) {
        setErrors(["Please select at least one desired menu item."]);
        setLoading(false);
        return;
      }
      const planText = selectedServicePlan
        ? `${selectedServicePlan.level === "package" ? "Selected Package" : "Selected Tier"}: ${getPlanDisplayTitle(
            form.service_interest,
            selectedServicePlan
          )}${selectedServicePlan.price ? ` (${selectedServicePlan.price})` : ""}\n${
            selectedServicePlan.level === "package" ? "Includes" : "Details"
          }:\n${displayedPlanDetails.map((detail) => `- ${detail}`).join("\n")}`
        : "";
      const desiredItemsText = selectedItems.length
        ? `Desired Menu Items:\n${selectedItems
            .map(
              (item) =>
                `- ${item.name}${
                  item.tray_size ? ` (Tray: ${item.tray_size}${item.tray_price ? ` - ${item.tray_price}` : ""})` : ""
                }`
            )
            .join("\n")}`
        : "";

      const payload = {
        ...normalizedForm,
        service_interest: selectedService ? selectedService.label : "",
        service_selection: selectedServicePlan,
        desired_menu_items: selectedItems,
        message: [normalizedForm.message, planText, desiredItemsText].filter(Boolean).join("\n\n"),
      };

      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
        service_interest: isValidPreset ? presetServiceKey : "",
      });
      setDesiredItems([]);
      setTraySizes({});
      setServicePlanId("");
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
            <p className="mb-2 text-danger fw-semibold">* indicates a required field.</p>
            {menuLoading ? <Alert variant="info">Loading menu configuration...</Alert> : null}
            {menuError ? <Alert variant="danger">Menu configuration unavailable: {menuError}</Alert> : null}
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
              <Form.Label>Guest Count</Form.Label>
              <Form.Control type="number" min="1" name="guest_count" value={form.guest_count} onChange={onChange} />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Budget</Form.Label>
              <Form.Control name="budget" value={form.budget} onChange={onChange} />
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

            {form.service_interest && shouldRequirePlanSelection ? (
              <Form.Group className="mb-3">
                <Form.Label>
                  {form.service_interest === "community" ? "Package / Tier " : "Formal Dinner Package "}
                  <span className="text-danger">*</span>
                </Form.Label>
                <Form.Select value={servicePlanId} onChange={(event) => setServicePlanId(event.target.value)} required>
                  <option value="">Select an option</option>
                  <optgroup label={form.service_interest === "formal" ? "Dinner Packages" : "Packages"}>
                    {servicePlans
                      .filter((plan) => plan.level === "package")
                      .map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {getPlanDisplayTitle(form.service_interest, plan)}
                          {plan.price ? ` (${plan.price})` : ""}
                        </option>
                      ))}
                  </optgroup>
                  {form.service_interest !== "formal"
                    ? Array.from(
                        new Set(servicePlans.filter((plan) => plan.level === "tier").map((plan) => plan.sectionTitle))
                      ).map((sectionTitle) => (
                        <optgroup key={sectionTitle} label={sectionTitle}>
                          {servicePlans
                            .filter((plan) => plan.level === "tier" && plan.sectionTitle === sectionTitle)
                            .map((plan) => (
                              <option key={plan.id} value={plan.id}>
                                {getPlanDisplayTitle(form.service_interest, plan)}
                                {plan.price ? ` (${plan.price})` : ""}
                              </option>
                            ))}
                        </optgroup>
                      ))
                    : null}
                </Form.Select>
                {selectedServicePlan ? (
                  <div className="small text-muted mt-2">
                    <div className="fw-semibold mb-1">
                      {selectedServicePlan.level === "package" ? "Package Includes" : "Tier Details"}
                    </div>
                    <ul className="mb-0">
                      {displayedPlanDetails.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                    {form.service_interest === "community" && selectedServicePlan.level === "tier" ? (
                      <div className="mt-2">Special chef requests can be added in the Message field.</div>
                    ) : null}
                  </div>
                ) : null}
              </Form.Group>
            ) : null}

            <Form.Group className="mb-3">
              <Form.Label>
                Desired Menu Items <span className="text-danger">*</span>
              </Form.Label>
              {canShowDesiredItems ? (
                desiredItemGroups.length ? (
                  <div className="border rounded p-2" style={{ maxHeight: "220px", overflowY: "auto" }}>
                    {desiredItemGroups.map((group) => (
                      <div key={group.title} className="mb-3">
                        <div className="fw-semibold small text-uppercase mb-1">
                          {getDisplayGroupTitle(form.service_interest, group)}
                        </div>
                        {group.items.map((item, index) => {
                          const isSelected = desiredItems.includes(item.name);
                          const sizeOptions = (item.sizeOptions || []).map(normalizeSizeOption);
                          return (
                            <div key={`${group.title}-${item.name}`} className="mb-2">
                              <Form.Check
                                id={`desired-item-${toIdPart(group.title)}-${index}`}
                                type="checkbox"
                                className="mb-1"
                                label={item.name}
                                checked={isSelected}
                                onChange={() => onToggleDesiredItem(item.name)}
                              />
                              {isSelected && sizeOptions.length ? (
                                <Form.Select
                                  size="sm"
                                  className="ms-4"
                                  style={{ maxWidth: "200px" }}
                                  value={traySizes[item.name] || sizeOptions[0].value}
                                  onChange={(event) => onChangeTraySize(item.name, event.target.value)}>
                                  {sizeOptions.map((sizeOption) => (
                                    <option key={`${item.name}-${sizeOption.value}`} value={sizeOption.value}>
                                      {sizeOption.label}
                                    </option>
                                  ))}
                                </Form.Select>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted small">No items available for this service yet.</div>
                )
              ) : form.service_interest && shouldRequirePlanSelection ? (
                <div className="text-muted small">Select a package/tier first to choose desired menu items.</div>
              ) : (
                <div className="text-muted small">Select a service first to choose desired items.</div>
              )}
            </Form.Group>

            <Form.Group>
              <Form.Label>Message</Form.Label>
              <Form.Control as="textarea" rows={4} name="message" value={form.message} onChange={onChange} />
              <Form.Text className="text-muted">
                Message is for special chef requests, dietary notes, service details, or anything not captured above.
              </Form.Text>
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
