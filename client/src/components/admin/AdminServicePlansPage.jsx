import { Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import Context from "../../context";
import ThemeToggleButton from "../ThemeToggleButton";
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
  sanitizeAdminChoiceOptionLabels,
  sanitizeAdminPlanForm,
  validateAdminPlanForm,
} from "../../utils/servicePackageAdminUtils";
import ConfirmActionModal from "./ConfirmActionModal";
import ConfirmReviewList from "./ConfirmReviewList";

const EMPTY_PLAN_FORM = {
  planId: null,
  sectionId: "",
  title: "",
  price: "",
  isActive: false,
  choiceRows: [],
  details: [],
};

const EMPTY_EDITOR_FIELD_ERRORS = {
  title: "",
  price: "",
  details: "",
  choiceRows: "",
};

const EMPTY_CHOICE_ROW_FIELD_ERRORS = Object.freeze({
  message: "",
  source_type: "",
  selection_key: "",
  group_title: "",
  min_select: "",
  max_select: "",
  options_text: "",
});

const EMPTY_CONFIRM_STATE = {
  show: false,
  title: "",
  body: "",
  confirmLabel: "Confirm",
  confirmVariant: "secondary",
  extraActionLabel: "",
  extraActionVariant: "outline-secondary",
  validationMessage: "",
  action: null,
  extraAction: null,
};

const buildEmptyPlanForm = (sectionId = "") => ({
  ...EMPTY_PLAN_FORM,
  sectionId: String(sectionId || ""),
});

const hasEditorValidationErrors = (fieldErrors) => Object.values(fieldErrors || {}).some(Boolean);
const hasChoiceRowValidationErrors = (rowErrors = []) =>
  (Array.isArray(rowErrors) ? rowErrors : []).some((row) => Object.values(row || {}).some(Boolean));

const mapPlanValidationErrors = (message, apiFieldErrors = null) => {
  const mapped = { ...EMPTY_EDITOR_FIELD_ERRORS };
  const normalizedApiFieldErrors =
    apiFieldErrors && typeof apiFieldErrors === "object" ? apiFieldErrors : {};

  if (normalizedApiFieldErrors.title) {
    mapped.title = String(normalizedApiFieldErrors.title || "").trim();
  }
  if (normalizedApiFieldErrors.price) {
    mapped.price = String(normalizedApiFieldErrors.price || "").trim();
  }
  if (normalizedApiFieldErrors.details) {
    mapped.details = String(normalizedApiFieldErrors.details || "").trim();
  }
  if (normalizedApiFieldErrors.choice_rows) {
    mapped.choiceRows = String(normalizedApiFieldErrors.choice_rows || "").trim();
  }
  if (hasEditorValidationErrors(mapped)) {
    return mapped;
  }

  const normalized = String(message || "").toLowerCase();
  const fallbackMapped = {};
  if (!normalized) return mapped;

  if (normalized.includes("title")) {
    fallbackMapped.title = String(message || "Invalid package title.");
  }
  if (normalized.includes("price")) {
    fallbackMapped.price = String(message || "Invalid package price.");
  }
  if (
    normalized.includes("included item") ||
    normalized.includes("included items") ||
    normalized.includes("fixed inclusions")
  ) {
    fallbackMapped.details = String(message || "Invalid included items.");
  }
  if (
    normalized.includes("customer choice") ||
    normalized.includes("customer choices") ||
    normalized.includes("customer chooses")
  ) {
    fallbackMapped.choiceRows = String(message || "Invalid customer choices.");
  }
  return { ...mapped, ...fallbackMapped };
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

const getCatalogLabel = (catalogKey = "") => {
  if (catalogKey === "formal") return "Formal";
  return "Catering";
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
  const [statusToggleBusy, setStatusToggleBusy] = useState({});
  const [draggingPlanId, setDraggingPlanId] = useState(null);
  const [draggingSectionId, setDraggingSectionId] = useState(null);
  const [dragOverPlanId, setDragOverPlanId] = useState(null);
  const [orderingSectionId, setOrderingSectionId] = useState(null);
  const [planForm, setPlanForm] = useState(() => buildEmptyPlanForm());
  const [planFormOriginal, setPlanFormOriginal] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorFieldErrors, setEditorFieldErrors] = useState(EMPTY_EDITOR_FIELD_ERRORS);
  const [editorChoiceRowErrors, setEditorChoiceRowErrors] = useState([]);
  const [editorValidationLocked, setEditorValidationLocked] = useState(false);
  const [confirmState, setConfirmState] = useState(EMPTY_CONFIRM_STATE);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const editorFormRef = useRef(null);
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
  const activeCatalogLabel = useMemo(
    () => getCatalogLabel(selectedSection?.catalog_key || catalogKey),
    [catalogKey, selectedSection]
  );
  const constraintOptions = useMemo(
    () => getPackageConstraintOptions(selectedSection?.catalog_key || catalogKey),
    [catalogKey, selectedSection]
  );
  const hasCustomChoiceRows = useMemo(
    () => (Array.isArray(planForm.choiceRows) ? planForm.choiceRows : []).some((row) => row?.source_type === "custom_options"),
    [planForm.choiceRows]
  );
  const selectedPlanTitle = useMemo(
    () => String(planFormOriginal?.title || planForm.title || "").trim(),
    [planForm.title, planFormOriginal]
  );
  const editorHeading = useMemo(() => {
    if (planForm.planId) {
      return `Edit ${selectedPlanTitle || "Package"}`;
    }
    return `Create New ${activeCatalogLabel} Package`;
  }, [activeCatalogLabel, planForm.planId, selectedPlanTitle]);

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
    setEditorChoiceRowErrors([]);
    setEditorValidationLocked(false);
    setConfirmState(EMPTY_CONFIRM_STATE);
    setPlanFormOriginal(null);
  }, [catalogKey]);

  const clearEditorValidation = useCallback((fields = []) => {
    const nextFields = Array.isArray(fields) ? fields.filter(Boolean) : [];
    setEditorError("");
    if (!nextFields.length) {
      setEditorFieldErrors(EMPTY_EDITOR_FIELD_ERRORS);
      setEditorChoiceRowErrors([]);
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
    if (nextFields.includes("choiceRows")) {
      setEditorChoiceRowErrors([]);
    }
    setEditorValidationLocked(false);
  }, []);

  const focusFirstInvalidField = useCallback(() => {
    window.setTimeout(() => {
      const invalidField = editorFormRef.current?.querySelector(".is-invalid");
      if (invalidField && typeof invalidField.focus === "function") {
        invalidField.focus();
      }
    }, 0);
  }, []);

  const resolveSectionForForm = useCallback(
    (formDraft) =>
      editableSections.find((section) => Number(section?.id) === Number(formDraft?.sectionId)) || null,
    [editableSections]
  );

  const queueConfirm = useCallback((title, body, confirmLabel, action, options = {}) => {
    setEditorError("");
    setConfirmState({
      ...EMPTY_CONFIRM_STATE,
      show: true,
      title,
      body,
      confirmLabel,
      confirmVariant: "secondary",
      validationMessage: "",
      action,
      ...options,
    });
  }, []);

  const closeConfirm = useCallback(() => {
    if (confirmBusy) return;
    setConfirmState(EMPTY_CONFIRM_STATE);
  }, [confirmBusy]);

  useEffect(() => {
    if (!editableSections.length) return;
    setPlanForm((prev) => {
      const hasCurrentSection = editableSections.some(
        (section) => Number(section?.id) === Number(prev.sectionId)
      );
      if (hasCurrentSection) return prev;
      return buildEmptyPlanForm(editableSections[0]?.id || prev.sectionId);
    });
  }, [editableSections]);

  const openCreateEditor = (section) => {
    const nextForm = buildEmptyPlanForm(section?.id || selectedSection?.id || editableSections[0]?.id || "");
    setEditorError("");
    setEditorFieldErrors(EMPTY_EDITOR_FIELD_ERRORS);
    setEditorChoiceRowErrors([]);
    setEditorValidationLocked(false);
    setConfirmState(EMPTY_CONFIRM_STATE);
    setPlanForm(nextForm);
    setPlanFormOriginal(null);
    setIsEditorOpen(true);
  };

  const openEditEditor = (plan, fallbackSection = null) => {
    const normalizedPlan = fallbackSection
      ? {
          ...plan,
          section_id: plan?.section_id || fallbackSection?.id,
          catalog_key: plan?.catalog_key || fallbackSection?.catalog_key,
        }
      : plan;
    const nextForm = toPlanForm(normalizedPlan, fallbackSection?.id || "");
    setEditorError("");
    setEditorFieldErrors(EMPTY_EDITOR_FIELD_ERRORS);
    setEditorChoiceRowErrors([]);
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
    setEditorChoiceRowErrors([]);
    setEditorValidationLocked(false);
    setConfirmState(EMPTY_CONFIRM_STATE);
    setPlanForm(nextForm);
    setPlanFormOriginal(null);
  };

  const resetEditor = () => {
    setEditorError("");
    setEditorFieldErrors(EMPTY_EDITOR_FIELD_ERRORS);
    setEditorChoiceRowErrors([]);
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
        const options = sanitizeAdminChoiceOptionLabels(row?.options_text).join(" / ");
        return `${groupTitle} (${toChoiceCountLabel(row)}): ${options || "-"}`;
      }
      const label =
        constraintOptions.find((option) => option.value === row?.selection_key)?.label ||
        String(row?.selection_key || "").replace(/_/g, " ");
      return `${label || "Menu options"} (${toChoiceCountLabel(row)})`;
    },
    [constraintOptions]
  );

  const validatePlanEditor = useCallback(
    (candidateForm = planForm) =>
      validateAdminPlanForm(candidateForm, resolveSectionForForm(candidateForm)?.catalog_key || catalogKey),
    [catalogKey, planForm, resolveSectionForForm]
  );

  const buildCreateConfirmBody = useCallback(
    (formDraft, sectionTitle = selectedSection?.title) => {
      const rows = [
        { label: "Section", value: sectionTitle || "No section selected" },
        { label: "Title", value: toReviewValue(formDraft.title) },
        { label: "Price Display", value: toReviewValue(formDraft.price) },
        {
          label: "Included Items",
          value:
            (formDraft.details || [])
              .map((detail) => String(detail || "").trim())
              .filter(Boolean)
              .join(" | ") || "-",
        },
        {
          label: "Customer Chooses",
          value:
            (formDraft.choiceRows || [])
              .map((row) => summarizeChoiceRow(row))
              .filter(Boolean)
              .join(" | ") || "-",
        },
        { label: "Active", value: formDraft.isActive ? "Yes" : "No" },
      ];

      return (
        <div>
          <p className="mb-2">Create this package with the following details?</p>
          {!formDraft.isActive ? (
            <p className="small text-secondary mb-2">
              New packages start inactive by default. Use Make Active below if this one is ready to publish now.
            </p>
          ) : null}
          <ConfirmReviewList rows={rows} />
        </div>
      );
    },
    [selectedSection?.title, summarizeChoiceRow]
  );

  const buildUpdateConfirmBody = useCallback((formDraft, originalForm = planFormOriginal) => {
    if (!originalForm) return "Save package changes?";

    const currentIncludedItems =
      (formDraft.details || []).map((detail) => String(detail || "").trim()).filter(Boolean).join(" | ") || "-";
    const originalIncludedItems =
      (originalForm.details || []).map((detail) => String(detail || "").trim()).filter(Boolean).join(" | ") || "-";
    const currentChoiceRows =
      (formDraft.choiceRows || []).map((row) => summarizeChoiceRow(row)).filter(Boolean).join(" | ") || "-";
    const originalChoiceRows =
      (originalForm.choiceRows || []).map((row) => summarizeChoiceRow(row)).filter(Boolean).join(" | ") || "-";

    const changes = [];
    if (String(formDraft.title || "").trim() !== String(originalForm.title || "").trim()) {
      changes.push({ label: "Title", value: toReviewValue(formDraft.title) });
    }
    if (String(formDraft.price || "").trim() !== String(originalForm.price || "").trim()) {
      changes.push({ label: "Price Display", value: toReviewValue(formDraft.price) });
    }
    if (currentIncludedItems !== originalIncludedItems) {
      changes.push({ label: "Included Items", value: currentIncludedItems });
    }
    if (currentChoiceRows !== originalChoiceRows) {
      changes.push({ label: "Customer Chooses", value: currentChoiceRows });
    }
    if (Boolean(formDraft.isActive) !== Boolean(originalForm.isActive)) {
      changes.push({ label: "Active", value: formDraft.isActive ? "Yes" : "No" });
    }

    return <ConfirmReviewList rows={changes} emptyMessage="No field changes detected." />;
  }, [planFormOriginal, summarizeChoiceRow]);

  const buildUpdateConfirmTitle = useCallback((formDraft, originalForm = planFormOriginal) => {
    const packageTitle = String(formDraft?.title || originalForm?.title || "").trim();
    return packageTitle ? `Update ${packageTitle}?` : "Update package?";
  }, [planFormOriginal]);

  const persistPlan = useCallback(async (formDraft = planForm) => {
    setEditorError("");
    setEditorFieldErrors(EMPTY_EDITOR_FIELD_ERRORS);
    setEditorChoiceRowErrors([]);
    const draftSection = resolveSectionForForm(formDraft);
    const normalizedCatalogKey = draftSection?.catalog_key || catalogKey;
    const payload = buildSubmitPayload(formDraft, normalizedCatalogKey);
    if (!payload.section_id) {
      throw new Error("Select a destination section.");
    }

    setSaving(true);
    try {
      if (formDraft.planId) {
        await updateAdminServicePlan(formDraft.planId, payload);
      } else {
        await createAdminServicePlan(payload);
      }
      await loadSections(catalogKey);
      setPlanForm(buildEmptyPlanForm(draftSection?.id || editableSections[0]?.id || ""));
      setPlanFormOriginal(null);
      setEditorFieldErrors(EMPTY_EDITOR_FIELD_ERRORS);
      setEditorChoiceRowErrors([]);
      setEditorValidationLocked(false);
      setIsEditorOpen(false);
    } catch (saveError) {
      const message = saveError.message || "Failed to save service package.";
      const mappedFieldErrors = mapPlanValidationErrors(message, saveError.fieldErrors);
      const sectionError =
        saveError?.fieldErrors && typeof saveError.fieldErrors === "object"
          ? String(saveError.fieldErrors.section_id || "").trim()
          : "";
      if (hasEditorValidationErrors(mappedFieldErrors)) {
        setEditorFieldErrors(mappedFieldErrors);
        setEditorChoiceRowErrors([]);
        setEditorValidationLocked(false);
        setConfirmState(EMPTY_CONFIRM_STATE);
        setEditorError(sectionError);
        focusFirstInvalidField();
        return;
      }
      if (sectionError) {
        setConfirmState(EMPTY_CONFIRM_STATE);
        setEditorError(sectionError);
        return;
      }
      setEditorError(message);
      throw new Error(message);
    } finally {
      setSaving(false);
    }
  }, [
    catalogKey,
    editableSections,
    focusFirstInvalidField,
    loadSections,
    planForm,
    resolveSectionForForm,
  ]);

  const buildCreateConfirmState = useCallback(
    function buildCreateConfirmState(formDraft, draftSection) {
      const normalizedDraft = {
        ...formDraft,
        isActive: Boolean(formDraft?.isActive),
      };
      const nextIsActive = !normalizedDraft.isActive;
      return {
        ...EMPTY_CONFIRM_STATE,
        show: true,
        title: "Create package",
        body: buildCreateConfirmBody(normalizedDraft, draftSection?.title),
        confirmLabel: "Create",
        confirmVariant: "secondary",
        action: () => persistPlan(normalizedDraft),
        extraActionLabel: normalizedDraft.isActive ? "Keep Inactive" : "Make Active",
        extraActionVariant: "outline-secondary",
        extraAction: () => {
          const toggledDraft = {
            ...normalizedDraft,
            isActive: nextIsActive,
          };
          setPlanForm(toggledDraft);
          setConfirmState(buildCreateConfirmState(toggledDraft, draftSection));
        },
      };
    },
    [buildCreateConfirmBody, persistPlan]
  );

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
    const { sanitizedForm, fieldErrors, choiceRowErrors } = validatePlanEditor(planForm);
    const normalizedForm = sanitizeAdminPlanForm(
      sanitizedForm,
      resolveSectionForForm(sanitizedForm)?.catalog_key || catalogKey
    );
    const draftSection = resolveSectionForForm(normalizedForm);

    setPlanForm(normalizedForm);
    setEditorError("");
    setEditorFieldErrors(fieldErrors);
    setEditorChoiceRowErrors(choiceRowErrors);
    setEditorValidationLocked(false);

    if (hasEditorValidationErrors(fieldErrors) || hasChoiceRowValidationErrors(choiceRowErrors)) {
      focusFirstInvalidField();
      return;
    }

    if (!draftSection) {
      setEditorError("Select a destination section.");
      return;
    }

    if (normalizedForm.planId) {
      queueConfirm(
        buildUpdateConfirmTitle(normalizedForm, planFormOriginal),
        buildUpdateConfirmBody(normalizedForm, planFormOriginal),
        "Update",
        () => persistPlan(normalizedForm)
      );
      return;
    }
    setConfirmState(buildCreateConfirmState(normalizedForm, draftSection));
  };

  const handleDeletePlan = async (plan) => {
    if (!plan?.id) return;
    const packageTitle = String(plan.title || "this package").trim() || "this package";
    queueConfirm(
      `Delete ${packageTitle}?`,
      "This permanently removes the package from both the admin table and the public catalog.",
      "Delete",
      async () => {
        setBusyPlanId(plan.id);
        try {
          await deleteAdminServicePlan(plan.id, { hardDelete: true });
          await loadSections(catalogKey);
          if (Number(planForm.planId) === Number(plan.id)) {
            resetEditor();
          }
        } catch (deleteError) {
          setError(deleteError.message || "Failed to delete service package.");
          throw new Error(deleteError.message || "Failed to delete service package.");
        } finally {
          setBusyPlanId(null);
        }
      },
      {
        confirmVariant: "danger",
      }
    );
  };

  const togglePlanStatusFromTable = async (plan) => {
    const planId = toPositiveId(plan?.id);
    if (!planId) return;
    const busyKey = `plan:${planId}`;
    if (statusToggleBusy[busyKey]) return;

    setStatusToggleBusy((prev) => ({ ...prev, [busyKey]: true }));
    setError("");
    try {
      const response = await updateAdminServicePlan(planId, {
        is_active: plan?.is_active === false,
      });
      if (Number(planForm.planId) === Number(planId) && response?.plan) {
        const nextForm = toPlanForm(response.plan, response.plan?.section_id || planForm.sectionId);
        setPlanForm(nextForm);
        setPlanFormOriginal(nextForm);
      }
      await loadSections(catalogKey);
    } catch (toggleError) {
      setError(toggleError.message || "Failed to update service package status.");
    } finally {
      setStatusToggleBusy((prev) => {
        const next = { ...prev };
        delete next[busyKey];
        return next;
      });
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
            <ThemeToggleButton
              isDarkTheme={isDarkTheme}
              onToggle={() => setThemeMode?.(isDarkTheme ? "light" : "dark")}
              className="mt-2"
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
                        <h3 className="h6 mb-0">{section.title}</h3>
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
                            <th className="text-center">Active</th>
                            <th className="admin-order-cell text-center">Order</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plans.map((plan) => {
                            const planId = toPositiveId(plan?.id);
                            const statusBusyKey = `plan:${planId}`;
                            const isStatusBusy = Boolean(statusToggleBusy[statusBusyKey]);
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
                                openEditEditor(plan, section);
                              }}
                              onKeyDown={(event) => {
                                if (!plan?.id) return;
                                if (event.key !== "Enter" && event.key !== " ") return;
                                event.preventDefault();
                                openEditEditor(plan, section);
                              }}>
                              <td>
                                <div className="fw-semibold">{plan.title}</div>
                              </td>
                              <td>{plan.price || "—"}</td>
                              <td className="text-center align-middle">
                                <button
                                  type="button"
                                  className="admin-status-toggle"
                                  disabled={isStatusBusy}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void togglePlanStatusFromTable(plan);
                                  }}
                                  aria-label={plan.is_active !== false ? "Set inactive" : "Set active"}
                                  title={plan.is_active !== false ? "Set inactive" : "Set active"}>
                                  <span
                                    className={`admin-status-dot ${
                                      plan.is_active !== false ? "admin-status-dot-active" : "admin-status-dot-inactive"
                                    }`}
                                    role="img"
                                    aria-label={plan.is_active !== false ? "Active" : "Inactive"}
                                  />
                                </button>
                              </td>
                              <td className="admin-order-cell">
                                {Number.isFinite(displayOrder) ? (
                                  <span className="admin-order-chip" title="Drag to reorder packages">
                                    {displayOrder}
                                  </span>
                                ) : null}
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
                  <h3 className="h6 mb-0">{editorHeading}</h3>
                  <Button variant="outline-secondary" size="sm" onClick={clearEditor}>
                    Clear
                  </Button>
                </div>

                {editorError ? <Alert variant="danger">{editorError}</Alert> : null}

                <Form ref={editorFormRef} noValidate onSubmit={handlePlanSubmit}>
                  {planForm.planId ? (
                    <div className="mb-3">
                      <div className="form-label mb-1">Section</div>
                      <div className="form-control-plaintext fw-semibold py-0">
                        {selectedSection?.title || "No section selected"}
                      </div>
                    </div>
                  ) : null}

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
                    <Form.Control.Feedback type="invalid">{editorFieldErrors.title}</Form.Control.Feedback>
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
                      placeholder="45-89"
                    />
                    <div className="small text-secondary mt-1">
                      <ul className="list-unstyled mb-0">
                        <li>Enter a price or price range.</li>
                        <li>
                          <code>$ signs</code> and <code>per person</code> are added automatically later.
                        </li>
                        <li>
                          Example input: <code>45-89</code>
                        </li>
                      </ul>
                    </div>
                    <Form.Control.Feedback type="invalid">{editorFieldErrors.price}</Form.Control.Feedback>
                  </Form.Group>

                  <div className="mb-3">
                    <div className={`fw-semibold mb-2 ${editorFieldErrors.details ? "admin-field-label-invalid" : ""}`}>
                      Included Items
                    </div>
                    <div
                      className={`small mb-2 ${
                        editorFieldErrors.details ? "admin-form-requirement-text admin-form-requirement-text-invalid" : "text-secondary"
                      }`}>
                      {editorFieldErrors.details ? (
                        editorFieldErrors.details
                      ) : (
                        <ul className="list-unstyled mb-0">
                          <li>Fixed inclusions only.</li>
                          <li>Do not repeat anything the customer is choosing below.</li>
                        </ul>
                      )}
                    </div>
                    {(planForm.details || []).map((detail, index) => (
                      <div className="admin-package-remove-row mb-2" key={`detail-row-${index}`}>
                        <Form.Control
                          isInvalid={Boolean(editorFieldErrors.details)}
                          value={detail}
                          onChange={(event) => updateDetailRow(index, event.target.value)}
                          placeholder="Add item"
                        />
                        <Button
                          type="button"
                          variant="outline-danger"
                          className="admin-package-remove-btn"
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
                    <div
                      className={`fw-semibold mb-2 ${
                        editorFieldErrors.choiceRows || hasChoiceRowValidationErrors(editorChoiceRowErrors)
                          ? "admin-field-label-invalid"
                          : ""
                      }`}>
                      Customer Chooses
                    </div>
                    <div
                      className={`small mb-2 ${
                        editorFieldErrors.choiceRows || hasChoiceRowValidationErrors(editorChoiceRowErrors)
                          ? "admin-form-requirement-text admin-form-requirement-text-invalid"
                          : "text-secondary"
                      }`}>
                      {editorFieldErrors.choiceRows ? (
                        editorFieldErrors.choiceRows
                      ) : (
                        <ul className="list-unstyled mb-0">
                          <li>Use one row per thing the customer picks.</li>
                          <li>Menu options pull from shared package families and require Min and Max.</li>
                          {hasCustomChoiceRows ? (
                            <>
                              <li>Custom options cover package-specific choices like Taco Bar proteins.</li>
                              <li>Min/Max can stay blank when there is no fixed selection count.</li>
                            </>
                          ) : null}
                        </ul>
                      )}
                    </div>
                    {(planForm.choiceRows || []).map((row, index) => {
                      const rowErrors = editorChoiceRowErrors[index] || EMPTY_CHOICE_ROW_FIELD_ERRORS;
                      const rowHasError = hasEditorValidationErrors(rowErrors);
                      return (
                      <div
                        className={`border rounded p-2 mb-2 ${rowHasError ? "border-danger" : ""}`}
                        key={`choice-row-${index}`}>
                        <Row className="g-2 align-items-start">
                          <Col md={3}>
                            <Form.Select
                              aria-label={`Choice source ${index + 1}`}
                              isInvalid={Boolean(rowErrors.source_type)}
                              value={row.source_type}
                              onChange={(event) => updateChoiceRow(index, "source_type", event.target.value)}>
                              <option value="menu_group">Menu options</option>
                              {catalogKey === "catering" ? <option value="custom_options">Custom options</option> : null}
                            </Form.Select>
                          </Col>
                          <Col md={4}>
                            {row.source_type === "custom_options" ? (
                              <Form.Control
                                isInvalid={Boolean(rowErrors.group_title)}
                                value={row.group_title}
                                onChange={(event) => updateChoiceRow(index, "group_title", event.target.value)}
                                placeholder="Choice label"
                              />
                            ) : (
                              <Form.Select
                                isInvalid={Boolean(rowErrors.selection_key)}
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
                          <Col xs={12} md={5}>
                            <div className="admin-package-remove-row">
                              <Form.Control
                                isInvalid={Boolean(rowErrors.min_select)}
                                value={row.min_select}
                                onChange={(event) => updateChoiceRow(index, "min_select", event.target.value)}
                                placeholder="Min"
                                inputMode="numeric"
                              />
                              <Form.Control
                                isInvalid={Boolean(rowErrors.max_select)}
                                value={row.max_select}
                                onChange={(event) => updateChoiceRow(index, "max_select", event.target.value)}
                                placeholder="Max"
                                inputMode="numeric"
                              />
                              <Button
                                type="button"
                                variant="outline-danger"
                                className="admin-package-remove-btn"
                                onClick={() => {
                                  clearEditorValidation(["choiceRows"]);
                                  setPlanForm((prev) => ({
                                    ...prev,
                                    choiceRows: prev.choiceRows.filter((_, rowIndex) => rowIndex !== index),
                                  }));
                                }}>
                                &times;
                              </Button>
                            </div>
                          </Col>
                          {row.source_type === "custom_options" ? (
                            <Col xs={12}>
                              <Form.Control
                                as="textarea"
                                rows={2}
                                isInvalid={Boolean(rowErrors.options_text)}
                                value={row.options_text}
                                onChange={(event) => updateChoiceRow(index, "options_text", event.target.value)}
                                placeholder="Add one option per line"
                              />
                              <div className="small text-secondary mt-1">
                                <ul className="list-unstyled mb-0">
                                  <li>Add one custom option per line.</li>
                                  <li>Bullets or numbering are okay, and commas stay part of the option text.</li>
                                </ul>
                              </div>
                            </Col>
                          ) : null}
                          {rowHasError && rowErrors.message ? (
                            <Col xs={12}>
                              <div className="small admin-form-requirement-text admin-form-requirement-text-invalid mt-1">
                                {rowErrors.message}
                              </div>
                            </Col>
                          ) : null}
                        </Row>
                      </div>
                    )})}
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
                    {selectedSection ? "Inactive packages are hidden from the public catalog and inquiry form." : "Select a section before saving."}
                  </div>

                  <div className="d-flex gap-2 align-items-center">
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
                    {planForm.planId ? (
                      <Button
                        type="button"
                        className="ms-auto"
                        variant="danger"
                        disabled={saving || busyPlanId === planForm.planId}
                        onClick={() =>
                          void handleDeletePlan({
                            id: planForm.planId,
                            title: planFormOriginal?.title || planForm.title,
                          })
                        }>
                        Delete Package
                      </Button>
                    ) : null}
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
        extraActionLabel={confirmState.extraActionLabel}
        extraActionVariant={confirmState.extraActionVariant}
        validationMessage={confirmState.validationMessage}
        confirmDisabled={editorValidationLocked}
        darkMode={isDarkTheme}
        busy={confirmBusy}
        onCancel={closeConfirm}
        onExtraAction={confirmState.extraAction}
        onConfirm={runConfirmedAction}
      />
    </Shell>
  );
};

export default AdminServicePlansPage;
