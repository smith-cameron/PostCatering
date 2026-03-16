import { Fragment, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import Context from "../../context";
import {
  createAdminServicePlan,
  deleteAdminServicePlan,
  getAdminSession,
  listAdminServicePlanSections,
  logoutAdminSession,
  reorderAdminServicePlans,
  updateAdminServicePlan,
} from "./adminApi";
import {
  filterGeneratedPackageDetails,
  getPackageConstraintOptions,
} from "../../utils/servicePackageUtils";
import {
  buildAdminChoicePayload,
  buildAdminChoiceRows,
  buildEmptyAdminChoiceRow,
} from "../../utils/servicePackageAdminUtils";
import ConfirmActionModal from "./ConfirmActionModal";
import ConfirmReviewList from "./ConfirmReviewList";

const EMPTY_PLAN_FORM = {
  planId: null,
  sectionId: "",
  title: "",
  price: "",
  isActive: true,
  choiceRows: [],
  details: [],
};

const EMPTY_EDITOR_FIELD_ERRORS = {
  title: "",
  price: "",
  details: "",
  choiceRows: "",
};

const EMPTY_CONFIRM_STATE = {
  show: false,
  title: "",
  body: "",
  confirmLabel: "Confirm",
  confirmVariant: "secondary",
  validationMessage: "",
  action: null,
};

const buildEmptyPlanForm = (sectionId = "") => ({
  ...EMPTY_PLAN_FORM,
  sectionId: String(sectionId || ""),
});

const hasEditorValidationErrors = (fieldErrors) => Object.values(fieldErrors || {}).some(Boolean);

const mapPlanValidationErrors = (message) => {
  const normalized = String(message || "").toLowerCase();
  const mapped = {};
  if (!normalized) return mapped;

  if (normalized.includes("title")) {
    mapped.title = String(message || "Invalid package title.");
  }
  if (normalized.includes("price")) {
    mapped.price = String(message || "Invalid package price.");
  }
  if (
    normalized.includes("included item") ||
    normalized.includes("included items") ||
    normalized.includes("fixed inclusions")
  ) {
    mapped.details = String(message || "Invalid included items.");
  }
  if (
    normalized.includes("customer choice") ||
    normalized.includes("customer choices") ||
    normalized.includes("customer chooses")
  ) {
    mapped.choiceRows = String(message || "Invalid customer choices.");
  }
  return mapped;
};

const toReviewValue = (value) => {
  const normalized = String(value || "").trim();
  return normalized || "-";
};

const toChoiceCountLabel = (row) => {
  const min = String(row?.min_select ?? "").trim();
  const max = String(row?.max_select ?? "").trim();
  if (min && max && min === max) return `Choose ${min}`;
  if (min && max) return `Choose ${min}-${max}`;
  if (min) return `Choose at least ${min}`;
  if (max) return `Choose up to ${max}`;
  return "Optional";
};

const buildChoiceValidationErrors = (choiceRows = []) => {
  const rows = Array.isArray(choiceRows) ? choiceRows : [];
  if (
    rows.some(
      (row) =>
        String(row?.source_type || "") === "custom_options" && !String(row?.group_title || "").trim()
    )
  ) {
    return "Each custom customer choice needs a label.";
  }
  if (
    rows.some(
      (row) =>
        String(row?.source_type || "") === "custom_options" && !String(row?.options_text || "").trim()
    )
  ) {
    return "Each custom customer choice needs at least one option.";
  }
  if (
    rows.some(
      (row) =>
        String(row?.source_type || "menu_group") !== "custom_options" &&
        !String(row?.selection_key || "").trim()
    )
  ) {
    return "Select a menu family for each menu-based customer choice.";
  }
  return "";
};

const sortSections = (sections = []) =>
  [...sections].sort((left, right) => {
    const leftSort = Number(left?.sort_order ?? left?.sortOrder ?? 0);
    const rightSort = Number(right?.sort_order ?? right?.sortOrder ?? 0);
    if (leftSort !== rightSort) return leftSort - rightSort;
    return String(left?.title || "").localeCompare(String(right?.title || ""));
  });

const sortPlans = (plans = []) =>
  [...plans].sort((left, right) => {
    const leftSort = Number(left?.sort_order ?? left?.sortOrder ?? 0);
    const rightSort = Number(right?.sort_order ?? right?.sortOrder ?? 0);
    if (leftSort !== rightSort) return leftSort - rightSort;
    return Number(left?.id || 0) - Number(right?.id || 0);
  });

const toPositiveId = (value) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const toPlanForm = (plan, fallbackSectionId = "") => {
  const catalogKey = plan?.catalog_key || "";
  const selectionMode = plan?.selection_mode || plan?.selectionMode || "menu_groups";
  return {
    planId: plan?.id || null,
    sectionId: String(plan?.section_id || fallbackSectionId || ""),
    title: String(plan?.title || ""),
    price: String(plan?.price || ""),
    isActive: plan?.is_active !== false,
    choiceRows: buildAdminChoiceRows(plan, catalogKey),
    details: filterGeneratedPackageDetails(
      Array.isArray(plan?.details) ? plan.details.map((row) => String(row?.detail_text || row || "")) : [],
      { catalogKey, selectionMode }
    ),
  };
};

const normalizeDetailPayload = (details) =>
  (details || []).map((detail) => String(detail || "").trim()).filter(Boolean);

const buildSubmitPayload = (form, catalogKey = "") => {
  const choicePayload = buildAdminChoicePayload(form.choiceRows, catalogKey);
  return {
    section_id: Number(form.sectionId),
    title: form.title.trim(),
    price: form.price.trim(),
    is_active: Boolean(form.isActive),
    constraints: choicePayload.constraints,
    selection_groups: choicePayload.selection_groups,
    selection_mode: choicePayload.selection_mode,
    details: normalizeDetailPayload(form.details),
  };
};

const AdminServicePlansPage = ({
  embedded = false,
  adminUser: externalAdminUser = null,
  sessionLoading: externalSessionLoading,
}) => {
  const { isDarkTheme, setThemeMode } = useContext(Context);
  const navigate = useNavigate();
  const location = useLocation();
  const hasExternalSession = typeof externalSessionLoading === "boolean";
  const [internalSessionLoading, setInternalSessionLoading] = useState(hasExternalSession ? externalSessionLoading : true);
  const [internalAdminUser, setInternalAdminUser] = useState(null);
  const [catalogKey, setCatalogKey] = useState("catering");
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editorError, setEditorError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyPlanId, setBusyPlanId] = useState(null);
  const [draggingPlanId, setDraggingPlanId] = useState(null);
  const [draggingSectionId, setDraggingSectionId] = useState(null);
  const [dragOverPlanId, setDragOverPlanId] = useState(null);
  const [orderingSectionId, setOrderingSectionId] = useState(null);
  const [planForm, setPlanForm] = useState(() => buildEmptyPlanForm());
  const [planFormOriginal, setPlanFormOriginal] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorFieldErrors, setEditorFieldErrors] = useState(EMPTY_EDITOR_FIELD_ERRORS);
  const [editorValidationLocked, setEditorValidationLocked] = useState(false);
  const [confirmState, setConfirmState] = useState(EMPTY_CONFIRM_STATE);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const adminUser = externalAdminUser || internalAdminUser;
  const sessionLoading = hasExternalSession ? externalSessionLoading : internalSessionLoading;

  const editableSections = useMemo(
    () => sortSections(sections).filter((section) => section?.section_type !== "include_menu"),
    [sections]
  );
  const selectedSection = useMemo(
    () => editableSections.find((section) => Number(section?.id) === Number(planForm.sectionId)) || null,
    [editableSections, planForm.sectionId]
  );
  const constraintOptions = useMemo(
    () => getPackageConstraintOptions(selectedSection?.catalog_key || catalogKey),
    [catalogKey, selectedSection]
  );

  const loadSections = useCallback(async (nextCatalogKey = catalogKey) => {
    setLoading(true);
    try {
      const payload = await listAdminServicePlanSections({
        catalogKey: nextCatalogKey,
        includeInactive: true,
      });
      setSections(payload.sections || []);
      setError("");
    } catch (loadError) {
      setSections([]);
      setError(loadError.message || "Failed to load service packages.");
    } finally {
      setLoading(false);
    }
  }, [catalogKey]);

  useEffect(() => {
    if (hasExternalSession) return undefined;
    let mounted = true;

    const hydrate = async () => {
      try {
        const payload = await getAdminSession();
        if (!mounted) return;
        setInternalAdminUser(payload.user || null);
      } catch {
        if (!mounted) return;
        setInternalAdminUser(null);
      } finally {
        if (mounted) {
          setInternalSessionLoading(false);
        }
      }
    };

    hydrate();
    return () => {
      mounted = false;
    };
  }, [hasExternalSession]);

  useEffect(() => {
    if (sessionLoading || !adminUser) return;
    void loadSections(catalogKey);
  }, [adminUser, catalogKey, loadSections, sessionLoading]);

  useEffect(() => {
    setIsEditorOpen(false);
    setEditorError("");
    setEditorFieldErrors(EMPTY_EDITOR_FIELD_ERRORS);
    setEditorValidationLocked(false);
    setConfirmState(EMPTY_CONFIRM_STATE);
    setPlanFormOriginal(null);
  }, [catalogKey]);

  const clearEditorValidation = useCallback((fields = []) => {
    const nextFields = Array.isArray(fields) ? fields.filter(Boolean) : [];
    setEditorError("");
    if (!nextFields.length) {
      setEditorFieldErrors(EMPTY_EDITOR_FIELD_ERRORS);
      setEditorValidationLocked(false);
      return;
    }
    setEditorFieldErrors((prev) => {
      const next = { ...prev };
      nextFields.forEach((field) => {
        next[field] = "";
      });
      return next;
    });
    setEditorValidationLocked(false);
  }, []);

  const queueConfirm = useCallback((title, body, confirmLabel, action) => {
    setEditorError("");
    setConfirmState({
      show: true,
      title,
      body,
      confirmLabel,
      confirmVariant: "secondary",
      validationMessage: "",
      action,
    });
  }, []);

  const closeConfirm = useCallback(() => {
    if (confirmBusy) return;
    setConfirmState(EMPTY_CONFIRM_STATE);
  }, [confirmBusy]);

  useEffect(() => {
    if (!editableSections.length) return;
    const hasCurrentSection = editableSections.some(
      (section) => Number(section?.id) === Number(planForm.sectionId)
    );
    if (hasCurrentSection) return;
    setPlanForm((prev) => buildEmptyPlanForm(editableSections[0]?.id || prev.sectionId));
  }, [editableSections, planForm.sectionId]);

  const openCreateEditor = (section) => {
    const nextForm = buildEmptyPlanForm(section?.id || selectedSection?.id || editableSections[0]?.id || "");
    setEditorError("");
    setEditorFieldErrors(EMPTY_EDITOR_FIELD_ERRORS);
    setEditorValidationLocked(false);
    setConfirmState(EMPTY_CONFIRM_STATE);
    setPlanForm(nextForm);
    setPlanFormOriginal(null);
    setIsEditorOpen(true);
  };

  const openEditEditor = (plan) => {
    const nextForm = toPlanForm(plan);
    setEditorError("");
    setEditorFieldErrors(EMPTY_EDITOR_FIELD_ERRORS);
    setEditorValidationLocked(false);
    setConfirmState(EMPTY_CONFIRM_STATE);
    setPlanForm(nextForm);
    setPlanFormOriginal(nextForm);
    setIsEditorOpen(true);
  };

  const clearEditor = () => {
    const nextForm = buildEmptyPlanForm(selectedSection?.id || editableSections[0]?.id || "");
    setEditorError("");
    setEditorFieldErrors(EMPTY_EDITOR_FIELD_ERRORS);
    setEditorValidationLocked(false);
    setConfirmState(EMPTY_CONFIRM_STATE);
    setPlanForm(nextForm);
    setPlanFormOriginal(null);
  };

  const resetEditor = () => {
    setEditorError("");
    setEditorFieldErrors(EMPTY_EDITOR_FIELD_ERRORS);
    setEditorValidationLocked(false);
    setConfirmState(EMPTY_CONFIRM_STATE);
    setPlanForm(buildEmptyPlanForm(selectedSection?.id || editableSections[0]?.id || ""));
    setPlanFormOriginal(null);
    setIsEditorOpen(false);
  };

  const updateChoiceRow = (index, field, value) => {
    clearEditorValidation(["choiceRows"]);
    setPlanForm((prev) => ({
      ...prev,
      choiceRows: prev.choiceRows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: value,
            }
          : row
      ),
    }));
  };

  const updateDetailRow = (index, value) => {
    clearEditorValidation(["details"]);
    setPlanForm((prev) => ({
      ...prev,
      details: prev.details.map((detail, detailIndex) => (detailIndex === index ? value : detail)),
    }));
  };

  const summarizeChoiceRow = useCallback(
    (row) => {
      if (String(row?.source_type || "menu_group") === "custom_options") {
        const groupTitle = String(row?.group_title || "").trim() || "Custom choice";
        const options = String(row?.options_text || "")
          .split(/\r?\n|,/)
          .map((option) => option.trim())
          .filter(Boolean)
          .join(", ");
        return `${groupTitle} (${toChoiceCountLabel(row)}): ${options || "-"}`;
      }
      const label =
        constraintOptions.find((option) => option.value === row?.selection_key)?.label ||
        String(row?.selection_key || "").replace(/_/g, " ");
      return `${label || "Menu options"} (${toChoiceCountLabel(row)})`;
    },
    [constraintOptions]
  );

  const validatePlanEditor = useCallback(() => {
    const nextFieldErrors = { ...EMPTY_EDITOR_FIELD_ERRORS };
    if (!String(planForm.title || "").trim()) {
      nextFieldErrors.title = "Package title is required.";
    }
    const choiceRowError = buildChoiceValidationErrors(planForm.choiceRows);
    if (choiceRowError) {
      nextFieldErrors.choiceRows = choiceRowError;
    }
    return nextFieldErrors;
  }, [planForm.choiceRows, planForm.title]);

  const buildCreateConfirmBody = useCallback(() => {
    const rows = [
      { label: "Section", value: selectedSection?.title || "No section selected" },
      { label: "Title", value: toReviewValue(planForm.title) },
      { label: "Price Display", value: toReviewValue(planForm.price) },
      {
        label: "Included Items",
        value: (planForm.details || []).map((detail) => String(detail || "").trim()).filter(Boolean).join(" | ") || "-",
      },
      {
        label: "Customer Chooses",
        value: (planForm.choiceRows || []).map((row) => summarizeChoiceRow(row)).filter(Boolean).join(" | ") || "-",
      },
      { label: "Active", value: planForm.isActive ? "Yes" : "No" },
    ];

    return (
      <div>
        <p className="mb-2">Create this package with the following details?</p>
        <ConfirmReviewList rows={rows} />
      </div>
    );
  }, [planForm, selectedSection?.title, summarizeChoiceRow]);

  const buildUpdateConfirmBody = useCallback(() => {
    if (!planFormOriginal) return "Save package changes?";

    const currentIncludedItems =
      (planForm.details || []).map((detail) => String(detail || "").trim()).filter(Boolean).join(" | ") || "-";
    const originalIncludedItems =
      (planFormOriginal.details || []).map((detail) => String(detail || "").trim()).filter(Boolean).join(" | ") || "-";
    const currentChoiceRows =
      (planForm.choiceRows || []).map((row) => summarizeChoiceRow(row)).filter(Boolean).join(" | ") || "-";
    const originalChoiceRows =
      (planFormOriginal.choiceRows || []).map((row) => summarizeChoiceRow(row)).filter(Boolean).join(" | ") || "-";

    const changes = [];
    if (String(planForm.title || "").trim() !== String(planFormOriginal.title || "").trim()) {
      changes.push({ label: "Title", value: toReviewValue(planForm.title) });
    }
    if (String(planForm.price || "").trim() !== String(planFormOriginal.price || "").trim()) {
      changes.push({ label: "Price Display", value: toReviewValue(planForm.price) });
    }
    if (currentIncludedItems !== originalIncludedItems) {
      changes.push({ label: "Included Items", value: currentIncludedItems });
    }
    if (currentChoiceRows !== originalChoiceRows) {
      changes.push({ label: "Customer Chooses", value: currentChoiceRows });
    }
    if (Boolean(planForm.isActive) !== Boolean(planFormOriginal.isActive)) {
      changes.push({ label: "Active", value: planForm.isActive ? "Yes" : "No" });
    }

    return <ConfirmReviewList rows={changes} emptyMessage="No field changes detected." />;
  }, [planForm, planFormOriginal, summarizeChoiceRow]);

  const buildUpdateConfirmTitle = useCallback(() => {
    const packageTitle = String(planForm.title || planFormOriginal?.title || "").trim();
    return packageTitle ? `Update ${packageTitle}?` : "Update package?";
  }, [planForm.title, planFormOriginal?.title]);

  const persistPlan = useCallback(async () => {
    setEditorError("");
    setEditorFieldErrors(EMPTY_EDITOR_FIELD_ERRORS);

    const nextFieldErrors = validatePlanEditor();
    if (hasEditorValidationErrors(nextFieldErrors)) {
      setEditorFieldErrors(nextFieldErrors);
      setEditorValidationLocked(true);
      throw new Error(Object.values(nextFieldErrors).filter(Boolean).join("\n"));
    }

    const normalizedCatalogKey = selectedSection?.catalog_key || catalogKey;
    const payload = buildSubmitPayload(planForm, normalizedCatalogKey);
    if (!payload.section_id) {
      throw new Error("Select a destination section.");
    }

    setSaving(true);
    try {
      if (planForm.planId) {
        await updateAdminServicePlan(planForm.planId, payload);
      } else {
        await createAdminServicePlan(payload);
      }
      await loadSections(catalogKey);
      setPlanForm(buildEmptyPlanForm(selectedSection?.id || editableSections[0]?.id || ""));
      setPlanFormOriginal(null);
      setEditorFieldErrors(EMPTY_EDITOR_FIELD_ERRORS);
      setEditorValidationLocked(false);
      setIsEditorOpen(false);
    } catch (saveError) {
      const message = saveError.message || "Failed to save service package.";
      const mappedFieldErrors = mapPlanValidationErrors(message);
      if (hasEditorValidationErrors(mappedFieldErrors)) {
        setEditorFieldErrors((prev) => ({ ...prev, ...mappedFieldErrors }));
        setEditorValidationLocked(true);
      } else {
        setEditorError(message);
      }
      throw new Error(message);
    } finally {
      setSaving(false);
    }
  }, [
    catalogKey,
    editableSections,
    loadSections,
    planForm,
    selectedSection,
    validatePlanEditor,
  ]);

  const runConfirmedAction = useCallback(async () => {
    if (!confirmState.action) return;
    setConfirmBusy(true);
    try {
      await confirmState.action();
      setConfirmState(EMPTY_CONFIRM_STATE);
    } catch (error) {
      setConfirmState((prev) => ({
        ...prev,
        validationMessage: error.message || "Unable to apply change.",
      }));
    } finally {
      setConfirmBusy(false);
    }
  }, [confirmState]);

  const handlePlanSubmit = (event) => {
    event.preventDefault();
    if (editorValidationLocked) return;
    if (planForm.planId) {
      queueConfirm(buildUpdateConfirmTitle(), buildUpdateConfirmBody(), "Update", persistPlan);
      return;
    }
    queueConfirm("Create package", buildCreateConfirmBody(), "Create", persistPlan);
  };

  const handleDeletePlan = async (plan) => {
    if (!plan?.id) return;
    const confirmed = window.confirm(`Delete "${plan.title}"? This will deactivate it from the public catalog.`);
    if (!confirmed) return;

    setBusyPlanId(plan.id);
    try {
      await deleteAdminServicePlan(plan.id);
      await loadSections(catalogKey);
      if (Number(planForm.planId) === Number(plan.id)) {
        resetEditor();
      }
    } catch (deleteError) {
      setError(deleteError.message || "Failed to delete service package.");
    } finally {
      setBusyPlanId(null);
    }
  };

  const reorderPlansFromTable = async (section, draggedId, targetId) => {
    const sectionId = toPositiveId(section?.id);
    const sourceId = toPositiveId(draggedId);
    const destinationId = toPositiveId(targetId);
    if (!sectionId || !sourceId || !destinationId || sourceId === destinationId || orderingSectionId) {
      return;
    }

    const orderedPlanIds = sortPlans(section?.plans || [])
      .map((plan) => toPositiveId(plan?.id))
      .filter(Boolean);
    const sourceIndex = orderedPlanIds.findIndex((planId) => Number(planId) === Number(sourceId));
    const destinationIndex = orderedPlanIds.findIndex((planId) => Number(planId) === Number(destinationId));
    if (sourceIndex < 0 || destinationIndex < 0) {
      return;
    }

    const reorderedIds = [...orderedPlanIds];
    const [movedId] = reorderedIds.splice(sourceIndex, 1);
    reorderedIds.splice(destinationIndex, 0, movedId);
    if (reorderedIds.every((planId, index) => Number(planId) === Number(orderedPlanIds[index]))) {
      return;
    }

    setOrderingSectionId(sectionId);
    setError("");
    try {
      await reorderAdminServicePlans({
        section_id: sectionId,
        catalog_key: catalogKey,
        ordered_plan_ids: reorderedIds,
      });
      await loadSections(catalogKey);
    } catch (reorderError) {
      setError(reorderError.message || "Failed to reorder service packages.");
    } finally {
      setOrderingSectionId(null);
      setDraggingPlanId(null);
      setDraggingSectionId(null);
      setDragOverPlanId(null);
    }
  };

  const logout = async () => {
    try {
      await logoutAdminSession();
    } finally {
      navigate("/admin/login", { replace: true });
    }
  };

  if (sessionLoading) {
    return (
      <main className="container py-5 d-flex justify-content-center">
        <Spinner animation="border" role="status" />
      </main>
    );
  }

  if (!adminUser) {
    return embedded ? null : <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  const Shell = embedded ? Fragment : "main";
  const shellProps = embedded
    ? {}
    : {
        className: `container-fluid py-4 admin-dashboard ${isDarkTheme ? "admin-dashboard-dark" : ""}`,
        "data-bs-theme": isDarkTheme ? "dark" : "light",
      };

  return (
    <Shell {...shellProps}>
      {!embedded ? (
        <header className="admin-header mb-3">
          <div className="admin-header-main">
            <h2 className="h4 mb-1">Service Packages</h2>
            <p className="text-secondary mb-0">
              Signed in as <strong>{adminUser?.display_name || adminUser?.username}</strong>
            </p>
            <Form.Check
              className="admin-theme-toggle mt-2"
              type="switch"
              id="admin-service-plans-dark-mode-toggle"
              label="Dark Mode"
              checked={isDarkTheme}
              onChange={(event) => setThemeMode?.(event.target.checked ? "dark" : "light")}
            />
          </div>
          <div className="admin-header-actions d-flex gap-2">
            <Button variant="outline-secondary" onClick={() => navigate("/admin/menu-items")}>
              Back to Dashboard
            </Button>
            <Button variant="outline-danger" onClick={logout}>
              Sign Out
            </Button>
          </div>
        </header>
      ) : null}

      <div className="d-flex flex-wrap gap-2 mb-3">
        <Button
          variant={catalogKey === "catering" ? "secondary" : "outline-secondary"}
          onClick={() => setCatalogKey("catering")}>
          Catering Packages
        </Button>
        <Button
          variant={catalogKey === "formal" ? "secondary" : "outline-secondary"}
          onClick={() => setCatalogKey("formal")}>
          Formal Packages
        </Button>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <Row className="g-3">
        <Col xl={isEditorOpen ? 7 : 12}>
          {loading ? (
            <Card>
              <Card.Body className="d-flex align-items-center gap-2">
                <Spinner animation="border" size="sm" role="status" />
                <span>Loading service package sections...</span>
              </Card.Body>
            </Card>
          ) : (
            editableSections.map((section) => {
              const plans = sortPlans(section?.plans || []);
              const sectionId = toPositiveId(section?.id);
              const canReorderPlans = plans.length > 1 && !orderingSectionId && !busyPlanId && !saving;
              const isDraggingSameSection =
                draggingSectionId === null || Number(draggingSectionId) === Number(sectionId);

              return (
                <Card className="mb-3" key={section.id}>
                  <Card.Body>
                    <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
                      <div>
                        <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                          <h3 className="h6 mb-0">{section.title}</h3>
                          <Badge bg={section.is_active ? "success" : "secondary"}>
                            {section.section_type}
                          </Badge>
                        </div>
                        {section.note ? <div className="small text-secondary">{section.note}</div> : null}
                      </div>
                      <Button variant="outline-secondary" size="sm" onClick={() => openCreateEditor(section)}>
                        Add Package
                      </Button>
                    </div>

                    {plans.length ? (
                      <Table responsive hover className="admin-sticky-table admin-service-packages-table align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Price</th>
                            <th className="text-center">Status</th>
                            <th className="admin-order-cell text-center">Order</th>
                            <th className="text-end">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plans.map((plan) => {
                            const planId = toPositiveId(plan?.id);
                            const isSelectedPlanRow =
                              Boolean(isEditorOpen && planForm.planId) && Number(planForm.planId) === Number(planId);
                            const isDropTarget =
                              canReorderPlans &&
                              draggingPlanId &&
                              isDraggingSameSection &&
                              Number(draggingPlanId) !== Number(planId) &&
                              Number(dragOverPlanId) === Number(planId);
                            const isBeingDragged = Number(draggingPlanId) === Number(planId);
                            const displayOrder = Number(plan?.sort_order ?? plan?.sortOrder);

                            return (
                              <tr
                              key={plan.id}
                              className={`${canReorderPlans ? "admin-table-row-draggable" : ""} ${
                                isDropTarget ? "admin-table-row-drop-target" : ""
                              } ${isBeingDragged ? "admin-table-row-dragging" : ""} ${
                                isSelectedPlanRow ? "admin-table-row-selected" : ""
                              }`.trim()}
                              draggable={canReorderPlans}
                              role={plan.id ? "button" : undefined}
                              tabIndex={plan.id ? 0 : undefined}
                              onDragStart={(event) => {
                                if (!canReorderPlans || !planId || !sectionId) return;
                                setDraggingPlanId(planId);
                                setDraggingSectionId(sectionId);
                                event.dataTransfer.effectAllowed = "move";
                                try {
                                  event.dataTransfer.setData("text/plain", String(planId));
                                } catch {
                                  // Some browsers restrict dataTransfer in tests.
                                }
                              }}
                              onDragOver={(event) => {
                                if (!canReorderPlans || !draggingPlanId || !isDraggingSameSection) return;
                                if (Number(draggingPlanId) === Number(planId)) return;
                                event.preventDefault();
                                setDragOverPlanId(planId);
                              }}
                              onDragLeave={() => {
                                if (Number(dragOverPlanId) === Number(planId)) {
                                  setDragOverPlanId(null);
                                }
                              }}
                              onDrop={(event) => {
                                if (!canReorderPlans || !draggingPlanId || !isDraggingSameSection || !planId) return;
                                if (Number(draggingPlanId) === Number(planId)) return;
                                event.preventDefault();
                                event.stopPropagation();
                                void reorderPlansFromTable(section, draggingPlanId, planId);
                              }}
                              onDragEnd={() => {
                                setDraggingPlanId(null);
                                setDraggingSectionId(null);
                                setDragOverPlanId(null);
                              }}
                              onClick={() => {
                                if (!plan?.id) return;
                                openEditEditor(plan);
                              }}
                              onKeyDown={(event) => {
                                if (!plan?.id) return;
                                if (event.key !== "Enter" && event.key !== " ") return;
                                event.preventDefault();
                                openEditEditor(plan);
                              }}>
                              <td>
                                <div className="fw-semibold">{plan.title}</div>
                              </td>
                              <td>{plan.price || "—"}</td>
                              <td className="text-center align-middle">
                                <div className="admin-status-line">
                                  <span
                                    className={`admin-status-dot ${
                                      plan.is_active !== false ? "admin-status-dot-active" : "admin-status-dot-inactive"
                                    }`}
                                    role="img"
                                    aria-label={plan.is_active !== false ? "Active" : "Archived"}
                                    title={plan.is_active !== false ? "Active" : "Archived"}
                                  />
                                </div>
                              </td>
                              <td className="admin-order-cell">
                                {Number.isFinite(displayOrder) ? (
                                  <span className="admin-order-chip" title="Drag to reorder packages">
                                    {displayOrder}
                                  </span>
                                ) : null}
                              </td>
                              <td className="text-end">
                                <div className="d-inline-flex flex-wrap justify-content-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline-danger"
                                    disabled={busyPlanId === plan.id}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleDeletePlan(plan);
                                    }}>
                                    Delete
                                  </Button>
                                </div>
                              </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    ) : (
                      <div className="small text-secondary mb-0">No packages in this section yet.</div>
                    )}
                  </Card.Body>
                </Card>
              );
            })
          )}
        </Col>

        {isEditorOpen ? (
          <Col xl={5}>
            <Card>
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h3 className="h6 mb-0">{planForm.planId ? "Edit Package" : "Create Package"}</h3>
                  <Button variant="outline-secondary" size="sm" onClick={clearEditor}>
                    Clear
                  </Button>
                </div>

                {editorError ? <Alert variant="danger">{editorError}</Alert> : null}

                <Form onSubmit={handlePlanSubmit}>
                  <div className="mb-3">
                    <div className="form-label mb-1">Section</div>
                    <div className="form-control-plaintext fw-semibold py-0">
                      {selectedSection?.title || "No section selected"}
                    </div>
                    <div className="small text-secondary mt-1">
                      New packages are created in the section you opened from the package list.
                    </div>
                  </div>

                  <Form.Group className="mb-3" controlId="service-package-title">
                    <Form.Label className={editorFieldErrors.title ? "admin-field-label-invalid" : ""}>Title</Form.Label>
                    <Form.Control
                      isInvalid={Boolean(editorFieldErrors.title)}
                      value={planForm.title}
                      onChange={(event) => {
                        clearEditorValidation(["title"]);
                        setPlanForm((prev) => ({ ...prev, title: event.target.value }));
                      }}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3" controlId="service-package-price">
                    <Form.Label className={editorFieldErrors.price ? "admin-field-label-invalid" : ""}>
                      Price Display
                    </Form.Label>
                    <Form.Control
                      isInvalid={Boolean(editorFieldErrors.price)}
                      value={planForm.price}
                      onChange={(event) => {
                        clearEditorValidation(["price"]);
                        setPlanForm((prev) => ({ ...prev, price: event.target.value }));
                      }}
                      placeholder="$30-$40 per person"
                    />
                  </Form.Group>

                  <div className="mb-3">
                    <div className={`fw-semibold mb-2 ${editorFieldErrors.details ? "admin-field-label-invalid" : ""}`}>
                      Included Items
                    </div>
                    <div
                      className={`small mb-2 ${
                        editorFieldErrors.details ? "admin-form-requirement-text admin-form-requirement-text-invalid" : "text-secondary"
                      }`}>
                      Fixed inclusions only. Do not repeat anything the customer is choosing below.
                    </div>
                    {(planForm.details || []).map((detail, index) => (
                      <div className="d-flex gap-2 mb-2" key={`detail-row-${index}`}>
                        <Form.Control
                          isInvalid={Boolean(editorFieldErrors.details)}
                          value={detail}
                          onChange={(event) => updateDetailRow(index, event.target.value)}
                          placeholder="Bread"
                        />
                        <Button
                          type="button"
                          variant="outline-danger"
                          onClick={() => {
                            clearEditorValidation(["details"]);
                            setPlanForm((prev) => ({
                              ...prev,
                              details: prev.details.filter((_, detailIndex) => detailIndex !== index),
                            }));
                          }}>
                          &times;
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => {
                        clearEditorValidation(["details"]);
                        setPlanForm((prev) => ({
                          ...prev,
                          details: [...prev.details, ""],
                        }));
                      }}>
                      Add Included Item
                    </Button>
                  </div>

                  <div className="mb-3">
                    <div className={`fw-semibold mb-2 ${editorFieldErrors.choiceRows ? "admin-field-label-invalid" : ""}`}>
                      Customer Chooses
                    </div>
                    <div
                      className={`small mb-2 ${
                        editorFieldErrors.choiceRows
                          ? "admin-form-requirement-text admin-form-requirement-text-invalid"
                          : "text-secondary"
                      }`}>
                      Use one row per thing the customer picks. Menu options pull from shared package families; custom
                      options cover package-specific choices like Taco Bar proteins.
                    </div>
                    {(planForm.choiceRows || []).map((row, index) => (
                      <div className="border rounded p-2 mb-2" key={`choice-row-${index}`}>
                        <Row className="g-2 align-items-start">
                          <Col md={4}>
                            <Form.Select
                              aria-label={`Choice source ${index + 1}`}
                              isInvalid={Boolean(editorFieldErrors.choiceRows)}
                              value={row.source_type}
                              onChange={(event) => updateChoiceRow(index, "source_type", event.target.value)}>
                              <option value="menu_group">Menu options</option>
                              {catalogKey === "catering" ? <option value="custom_options">Custom options</option> : null}
                            </Form.Select>
                          </Col>
                          <Col md={4}>
                            {row.source_type === "custom_options" ? (
                              <Form.Control
                                isInvalid={Boolean(editorFieldErrors.choiceRows)}
                                value={row.group_title}
                                onChange={(event) => updateChoiceRow(index, "group_title", event.target.value)}
                                placeholder="Choice label"
                              />
                            ) : (
                              <Form.Select
                                isInvalid={Boolean(editorFieldErrors.choiceRows)}
                                value={row.selection_key}
                                onChange={(event) => updateChoiceRow(index, "selection_key", event.target.value)}>
                                <option value="">Select menu family</option>
                                {constraintOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </Form.Select>
                            )}
                          </Col>
                          <Col md={2}>
                            <Form.Control
                              isInvalid={Boolean(editorFieldErrors.choiceRows)}
                              value={row.min_select}
                              onChange={(event) => updateChoiceRow(index, "min_select", event.target.value)}
                              placeholder="Min"
                              inputMode="numeric"
                            />
                          </Col>
                          <Col md={2}>
                            <Form.Control
                              isInvalid={Boolean(editorFieldErrors.choiceRows)}
                              value={row.max_select}
                              onChange={(event) => updateChoiceRow(index, "max_select", event.target.value)}
                              placeholder="Max"
                              inputMode="numeric"
                            />
                          </Col>
                          {row.source_type === "custom_options" ? (
                            <Col xs={12}>
                              <Form.Control
                                as="textarea"
                                rows={2}
                                isInvalid={Boolean(editorFieldErrors.choiceRows)}
                                value={row.options_text}
                                onChange={(event) => updateChoiceRow(index, "options_text", event.target.value)}
                                placeholder="Carne Asada, Chicken, Marinated Pork"
                              />
                              <div className="small text-secondary mt-1">
                                Separate custom options with commas or new lines.
                              </div>
                            </Col>
                          ) : null}
                          <Col xs={12} className="d-flex justify-content-end">
                            <Button
                              type="button"
                              variant="outline-danger"
                              onClick={() => {
                                clearEditorValidation(["choiceRows"]);
                                setPlanForm((prev) => ({
                                  ...prev,
                                  choiceRows: prev.choiceRows.filter((_, rowIndex) => rowIndex !== index),
                                }));
                              }}>
                              &times;
                            </Button>
                          </Col>
                        </Row>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => {
                        clearEditorValidation(["choiceRows"]);
                        setPlanForm((prev) => ({
                          ...prev,
                          choiceRows: [...prev.choiceRows, buildEmptyAdminChoiceRow()],
                        }));
                      }}>
                      Add Customer Choice
                    </Button>
                  </div>

                  <div className="d-flex flex-column gap-2 mb-3">
                    <Form.Check
                      type="switch"
                      label="Active"
                      checked={planForm.isActive}
                      onChange={(event) => setPlanForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                    />
                  </div>

                  <div className="small text-secondary mb-3">
                    {selectedSection
                      ? `${planForm.isActive ? "Saving into" : "Archiving in"} ${selectedSection.title}. Inactive packages are hidden from the public catalog and inquiry form.`
                      : "Select a section before saving."}
                  </div>

                  <div className="d-flex gap-2">
                    <Button
                      type="submit"
                      className="btn-inquiry-action"
                      variant="secondary"
                      disabled={saving || editorValidationLocked}>
                      {saving ? "Saving..." : planForm.planId ? "Save Changes" : "Create Package"}
                    </Button>
                    <Button type="button" variant="outline-secondary" onClick={resetEditor} disabled={saving}>
                      Cancel
                    </Button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        ) : null}
      </Row>
      <ConfirmActionModal
        show={confirmState.show}
        title={confirmState.title}
        body={confirmState.body}
        confirmLabel={confirmState.confirmLabel}
        confirmVariant={confirmState.confirmVariant}
        validationMessage={confirmState.validationMessage}
        confirmDisabled={editorValidationLocked}
        darkMode={isDarkTheme}
        busy={confirmBusy}
        onCancel={closeConfirm}
        onConfirm={runConfirmedAction}
      />
    </Shell>
  );
};

export default AdminServicePlansPage;
