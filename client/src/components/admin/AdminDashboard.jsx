import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Accordion, Alert, Badge, Button, Card, Col, Form, InputGroup, Nav, Row, Spinner, Table } from "react-bootstrap";
import { Navigate, useNavigate } from "react-router-dom";
import ConfirmActionModal from "./ConfirmActionModal";
import ConfirmReviewList from "./ConfirmReviewList";
import { requestJson, requestWithFormData } from "./adminApi";

const TAB_MENU = "menu";
const TAB_MEDIA = "media";
const TAB_AUDIT = "audit";
const MOBILE_LAYOUT_MAX_WIDTH = 767;
const FORMAL_ID_OFFSET = 1000000;
const FORM_ERROR_CREATE_ITEM = "create_item";
const FORM_ERROR_EDIT_ITEM = "edit_item";
const FORM_ERROR_UPLOAD_MEDIA = "upload_media";
const FORM_ERROR_EDIT_MEDIA = "edit_media";
const MENU_TYPE_OPTIONS = ["regular", "formal"];
const EMPTY_FORM_ERRORS = {
  [FORM_ERROR_CREATE_ITEM]: "",
  [FORM_ERROR_EDIT_ITEM]: "",
  [FORM_ERROR_UPLOAD_MEDIA]: "",
  [FORM_ERROR_EDIT_MEDIA]: "",
};
const EMPTY_CREATE_FIELD_ERRORS = {
  item_name: "",
  menu_type: "",
  group_id: "",
  tray_price_half: "",
  tray_price_full: "",
};
const EMPTY_UPLOAD_FIELD_ERRORS = {
  file: "",
  title: "",
  caption: "",
};
const INITIAL_NEW_ITEM_FORM = {
  item_name: "",
  is_active: true,
  menu_type: "",
  group_id: "",
  tray_price_half: "",
  tray_price_full: "",
};
const INITIAL_UPLOAD_FORM = {
  title: "",
  caption: "",
  is_slide: false,
  is_active: true,
  file: null,
};

const mapCreateValidationErrors = (message) => {
  const normalized = String(message || "").toLowerCase();
  const mapped = {};
  if (!normalized) return mapped;

  if (normalized.includes("item name")) {
    mapped.item_name = String(message || "Invalid item name.");
  }
  if (normalized.includes("menu type")) {
    mapped.menu_type = String(message || "Invalid menu type.");
  }
  if (normalized.includes("group")) {
    mapped.group_id = String(message || "Invalid group.");
  }
  if (normalized.includes("half tray")) {
    mapped.tray_price_half = String(message || "Invalid half tray price.");
  }
  if (normalized.includes("full tray")) {
    mapped.tray_price_full = String(message || "Invalid full tray price.");
  }
  return mapped;
};

const mapUploadValidationErrors = (message) => {
  const normalized = String(message || "").toLowerCase();
  const mapped = {};
  if (!normalized) return mapped;

  if (normalized.includes("file") || normalized.includes("unsupported file type") || normalized.includes("media file")) {
    mapped.file = String(message || "Invalid media file.");
  }
  if (normalized.includes("title")) {
    mapped.title = String(message || "Invalid title.");
  }
  if (normalized.includes("caption")) {
    mapped.caption = String(message || "Invalid caption.");
  }
  return mapped;
};

const formatCurrencyInputFromDigits = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const padded = digits.padStart(3, "0");
  const wholeRaw = padded.slice(0, -2);
  const whole = String(Number.parseInt(wholeRaw, 10));
  const fraction = padded.slice(-2);
  return `${whole}.${fraction}`;
};

const formatCurrencyToCents = (value) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return "";
  return parsed.toFixed(2);
};

const formatCurrencyDisplay = (value) => {
  const normalized = formatCurrencyToCents(value);
  return normalized ? `$${normalized}` : "-";
};

const formatBooleanLabel = (value) => (value ? "Yes" : "No");

const formatMediaSourceFilename = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const noQuery = raw.split("?")[0].split("#")[0];
  const parts = noQuery.split("/").filter(Boolean);
  const filename = parts.length ? parts[parts.length - 1] : noQuery;
  try {
    return decodeURIComponent(filename);
  } catch {
    return filename;
  }
};

const renderMediaTypeIcon = (value) => {
  const type = normalizeFilterText(value);
  if (type === "image") {
    return (
      <span className="admin-media-type-icon" role="img" aria-label="Image" title="Image">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="5.2" cy="6.1" r="1.1" fill="currentColor" />
          <path d="M2.6 11.5 5.5 8.6 7.8 10.9 9.9 8.8 13.4 12.3" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </span>
    );
  }
  if (type === "video") {
    return (
      <span className="admin-media-type-icon" role="img" aria-label="Video" title="Video">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <rect x="1.5" y="3" width="9.8" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M6.1 6.2 8.8 8 6.1 9.8Z" fill="currentColor" />
          <path d="M11.3 6.2 14.5 4.8v6.4l-3.2-1.4Z" fill="currentColor" />
        </svg>
      </span>
    );
  }
  return <span className="text-secondary">-</span>;
};

const toId = (value) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : "";
};

const withDisplayOrder = (rows) =>
  rows.map((row, index) => ({
    ...row,
    display_order: Number.isFinite(Number(row.display_order)) && Number(row.display_order) > 0 ? Number(row.display_order) : index + 1,
  }));

const isFormalGroup = (group) => {
  const marker = `${group?.option_key || ""} ${group?.category || ""} ${group?.title || ""}`.toLowerCase();
  return marker.includes("formal");
};

const buildItemForm = (item) => {
  const hasExplicitMenuTypes = Array.isArray(item?.menu_types);
  const menuTypes = Array.from(
    new Set(
      (hasExplicitMenuTypes ? item.menu_types : [item?.menu_type])
        .map((value) => String(value || "").trim().toLowerCase())
        .filter((value) => value === "regular" || value === "formal")
    )
  );
  return {
    id: item?.id ?? null,
    menu_type: String(item?.menu_type || "").toLowerCase(),
    menu_types: menuTypes,
    item_name: item?.item_name ?? "",
    tray_price_half: formatCurrencyToCents(item?.tray_price_half),
    tray_price_full: formatCurrencyToCents(item?.tray_price_full),
    is_active: Boolean(item?.is_active),
    option_group_assignments: withDisplayOrder(
      (item?.option_group_assignments || []).map((row) => ({
        menu_type: String(row?.menu_type || row?.category || "").toLowerCase(),
        category: String(row?.menu_type || row?.category || "").toLowerCase(),
        group_id: toId(row.group_id),
        display_order: row.display_order,
        is_active: row?.is_active !== false,
      }))
    ),
    section_row_assignments: withDisplayOrder(
      (item?.section_row_assignments || []).map((row) => ({
        section_id: toId(row.section_id),
        value_1: String(row.value_1 ?? ""),
        value_2: String(row.value_2 ?? ""),
        display_order: row.display_order,
        is_active: row?.is_active !== false,
      }))
    ),
    tier_bullet_assignments: withDisplayOrder(
      (item?.tier_bullet_assignments || []).map((row) => ({
        tier_id: toId(row.tier_id),
        display_order: row.display_order,
        is_active: row?.is_active !== false,
      }))
    ),
  };
};

const buildMediaForm = (item) => ({
  id: item?.id ?? null,
  title: item?.title ?? "",
  caption: item?.caption ?? "",
  src: item?.src ?? item?.image_url ?? "",
  display_order: item?.display_order ?? 1,
  is_slide: Boolean(item?.is_slide),
  is_active: Boolean(item?.is_active),
});

const toOptionGroupFromCatalog = (group, menuType) => {
  const sourceGroupId = toId(group?.id);
  if (!sourceGroupId) return null;
  const normalizedType = String(menuType || "").toLowerCase() === "formal" ? "formal" : "regular";
  const encodedId = normalizedType === "formal" ? sourceGroupId + FORMAL_ID_OFFSET : sourceGroupId;
  return {
    id: encodedId,
    option_key: `${normalizedType}_${group?.key || ""}`,
    option_id: `${normalizedType}:${group?.key || sourceGroupId}`,
    category: normalizedType,
    title: group?.name || "Unnamed Group",
    display_order: Number(group?.sort_order) || 0,
    is_active: group?.is_active !== false,
    menu_type: normalizedType,
    group_key: group?.key || "",
    source_group_id: sourceGroupId,
  };
};

const resolveGroupNames = (item) => {
  if (Array.isArray(item?.group_titles) && item.group_titles.length) {
    return item.group_titles.map((value) => String(value || "").trim()).filter(Boolean);
  }
  if (Array.isArray(item?.groups) && item.groups.length) {
    return item.groups
      .map((group) => {
        if (typeof group === "string") return group.trim();
        return String(group?.group_title || group?.title || group?.group_key || "").trim();
      })
      .filter(Boolean);
  }
  const single = String(item?.group_title || item?.group_key || "").trim();
  return single ? [single] : [];
};

const normalizeMenuItemName = (value) => String(value || "").trim().toLowerCase();
const normalizeFilterText = (value) => String(value || "").trim().toLowerCase();

const uniqueMenuTypeList = (values) => {
  const seen = new Set();
  return (values || []).reduce((next, value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return next;
    seen.add(normalized);
    next.push(normalized);
    return next;
  }, []);
};

const uniqueTextList = (values) => {
  const seen = new Set();
  return (values || []).reduce((next, value) => {
    const normalized = String(value || "").trim();
    if (!normalized) return next;
    const dedupeKey = normalized.toLowerCase();
    if (seen.has(dedupeKey)) return next;
    seen.add(dedupeKey);
    next.push(normalized);
    return next;
  }, []);
};

const uniqueBooleanList = (values) => {
  const seen = new Set();
  return (values || []).reduce((next, value) => {
    if (value !== true && value !== false) return next;
    if (seen.has(value)) return next;
    seen.add(value);
    next.push(value);
    return next;
  }, []);
};

const formatMenuTypeLabel = (value) => {
  const normalized = normalizeFilterText(value);
  if (normalized === "formal") return "Formal";
  if (normalized === "regular") return "Regular";
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "-";
};

const orderMenuTypes = (values) => {
  const normalized = uniqueMenuTypeList(values);
  return [
    ...MENU_TYPE_OPTIONS.filter((typeKey) => normalized.includes(typeKey)),
    ...normalized.filter((typeKey) => !MENU_TYPE_OPTIONS.includes(typeKey)),
  ];
};

const decodeRawItemId = (value) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  return parsed > FORMAL_ID_OFFSET ? parsed - FORMAL_ID_OFFSET : parsed;
};

const resolveMenuTypes = (item) =>
  uniqueMenuTypeList([
    ...(Array.isArray(item?.menu_types) ? item.menu_types : []),
    item?.menu_type,
  ]);

const resolveAssignmentMenuType = (assignment) =>
  normalizeFilterText(assignment?.menu_type || assignment?.category);

const getAssignmentGroupIdForType = (assignments, typeKey) => {
  const normalizedType = normalizeFilterText(typeKey);
  if (!normalizedType) return "";
  const match = (assignments || []).find(
    (assignment) => resolveAssignmentMenuType(assignment) === normalizedType && assignment?.is_active !== false
  );
  return toId(match?.group_id);
};

const upsertAssignmentForType = (assignments, typeKey, groupId) => {
  const normalizedType = normalizeFilterText(typeKey);
  if (!normalizedType) return withDisplayOrder(assignments || []);
  const next = (assignments || []).filter((assignment) => resolveAssignmentMenuType(assignment) !== normalizedType);
  next.push({
    menu_type: normalizedType,
    category: normalizedType,
    group_id: toId(groupId),
    is_active: true,
  });
  return withDisplayOrder(next);
};

const removeAssignmentForType = (assignments, typeKey) => {
  const normalizedType = normalizeFilterText(typeKey);
  if (!normalizedType) return withDisplayOrder(assignments || []);
  return withDisplayOrder((assignments || []).filter((assignment) => resolveAssignmentMenuType(assignment) !== normalizedType));
};

const resolveActiveStatuses = (item) => {
  const statuses = [];
  if (Array.isArray(item?.active_statuses)) {
    item.active_statuses.forEach((status) => {
      if (status === true || status === false) statuses.push(status);
    });
  }
  if (Array.isArray(item?.groups)) {
    item.groups.forEach((group) => {
      if (group && typeof group === "object" && (group.is_active === true || group.is_active === false)) {
        statuses.push(group.is_active);
      }
    });
  }
  if (Array.isArray(item?.option_group_assignments)) {
    item.option_group_assignments.forEach((assignment) => {
      if (assignment && typeof assignment === "object" && (assignment.is_active === true || assignment.is_active === false)) {
        statuses.push(assignment.is_active);
      }
    });
  }
  if (item?.is_active === true || item?.is_active === false) {
    statuses.push(item.is_active);
  } else if (item?.is_active !== undefined && item?.is_active !== null) {
    statuses.push(Boolean(item.is_active));
  }
  return uniqueBooleanList(statuses);
};

const toMenuItemRowKey = (item, index) => {
  const itemKey = normalizeFilterText(item?.item_key);
  if (itemKey) return `key:${itemKey}`;
  const rawItemId = decodeRawItemId(item?.id);
  if (rawItemId) return `id:${rawItemId}`;
  const nameToken = normalizeMenuItemName(item?.item_name) || "item";
  return `name:${nameToken}:${index}`;
};

const buildMenuItemTableRows = (items) => {
  const rowsByKey = new Map();
  (items || []).forEach((item, index) => {
    const rowKey = toMenuItemRowKey(item, index);
    const menuTypes = resolveMenuTypes(item);
    const groupNames = resolveGroupNames(item);
    const activeStatuses = resolveActiveStatuses(item);
    const rowIsActive =
      item?.is_active === true || item?.is_active === false
        ? item.is_active
        : activeStatuses.includes(false)
          ? false
          : activeStatuses.includes(true);
    const menuType = normalizeFilterText(item?.menu_type);
    const encodedId = toId(item?.id);
    const trayPriceHalf = formatCurrencyToCents(item?.tray_price_half);
    const trayPriceFull = formatCurrencyToCents(item?.tray_price_full);
    const existing = rowsByKey.get(rowKey);

    if (!existing) {
      rowsByKey.set(rowKey, {
        row_key: rowKey,
        id: encodedId || "",
        item_name: String(item?.item_name || "").trim(),
        item_key: String(item?.item_key || "").trim(),
        is_active: rowIsActive,
        menu_types: menuTypes,
        group_names: groupNames,
        active_statuses: activeStatuses,
        tray_price_half: trayPriceHalf,
        tray_price_full: trayPriceFull,
      });
      return;
    }

    existing.menu_types = uniqueMenuTypeList([...existing.menu_types, ...menuTypes]);
    existing.group_names = uniqueTextList([...existing.group_names, ...groupNames]);
    existing.active_statuses = uniqueBooleanList([...existing.active_statuses, ...activeStatuses]);
    if (item?.is_active === true || item?.is_active === false) {
      existing.is_active = item.is_active;
    }
    if (!existing.tray_price_half && trayPriceHalf) {
      existing.tray_price_half = trayPriceHalf;
    }
    if (!existing.tray_price_full && trayPriceFull) {
      existing.tray_price_full = trayPriceFull;
    }
    if (menuType === "regular" && encodedId) {
      existing.id = encodedId;
    } else if (!existing.id && encodedId) {
      existing.id = encodedId;
    }
  });

  return Array.from(rowsByKey.values());
};

const MENU_ITEM_FILTERS = [
  {
    key: "search",
    shouldApply: (value) => Boolean(String(value || "").trim()),
    apply: (row, value) => {
      const normalized = normalizeFilterText(value);
      if (!normalized) return true;
      const haystack = [
        row.item_name,
        row.item_key,
        row.menu_types.join(" "),
        row.group_names.join(" "),
        row.active_statuses.map((status) => (status ? "active" : "inactive")).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    },
  },
  {
    key: "is_active",
    shouldApply: (value) => String(value || "all") !== "all",
    apply: (row, value) => {
      const target = String(value || "all");
      if (target === "all") return true;
      if (target === "true") return row.active_statuses.some((status) => status === true);
      if (target === "false") return row.active_statuses.some((status) => status === false);
      return true;
    },
  },
  {
    key: "menu_type",
    shouldApply: (value) => String(value || "all") !== "all",
    apply: (row, value) => {
      const normalized = normalizeFilterText(value);
      if (!normalized || normalized === "all") return true;
      return row.menu_types.includes(normalized);
    },
  },
  {
    key: "group_name",
    shouldApply: (value) => String(value || "all") !== "all",
    apply: (row, value) => {
      const normalized = normalizeFilterText(value);
      if (!normalized || normalized === "all") return true;
      return row.group_names.some((groupName) => normalizeFilterText(groupName) === normalized);
    },
  },
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [adminUser, setAdminUser] = useState(null);

  const [activeTab, setActiveTab] = useState(TAB_MENU);
  const [formErrors, setFormErrors] = useState(EMPTY_FORM_ERRORS);
  const [, setBusy] = useState(false);
  const [menuTableError, setMenuTableError] = useState("");
  const [mediaTableError, setMediaTableError] = useState("");

  const [referenceData, setReferenceData] = useState({ catalogs: [], option_groups: [], sections: [], tiers: [] });
  const [itemFilters, setItemFilters] = useState({ search: "", is_active: "all", menu_type: "all", group_name: "all" });
  const [menuItems, setMenuItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [itemForm, setItemForm] = useState(null);
  const [itemFormOriginal, setItemFormOriginal] = useState(null);
  const [editCardPlacement, setEditCardPlacement] = useState("below_table");
  const [shouldScrollToEditCard, setShouldScrollToEditCard] = useState(false);
  const [showCreatedItemHighlight, setShowCreatedItemHighlight] = useState(false);
  const [newItemForm, setNewItemForm] = useState(INITIAL_NEW_ITEM_FORM);
  const [createFieldErrors, setCreateFieldErrors] = useState(EMPTY_CREATE_FIELD_ERRORS);
  const [createValidationLocked, setCreateValidationLocked] = useState(false);

  const [mediaFilters, setMediaFilters] = useState({ search: "", media_type: "", is_active: "all", is_slide: "all" });
  const [mediaItems, setMediaItems] = useState([]);
  const [selectedMediaId, setSelectedMediaId] = useState(null);
  const [mediaForm, setMediaForm] = useState(null);
  const [mediaFormOriginal, setMediaFormOriginal] = useState(null);
  const [mediaEditCardPlacement, setMediaEditCardPlacement] = useState("below_table");
  const [shouldScrollToMediaEditCard, setShouldScrollToMediaEditCard] = useState(false);
  const [showCreatedMediaHighlight, setShowCreatedMediaHighlight] = useState(false);
  const [uploadForm, setUploadForm] = useState(INITIAL_UPLOAD_FORM);
  const [uploadFieldErrors, setUploadFieldErrors] = useState(EMPTY_UPLOAD_FIELD_ERRORS);
  const [uploadValidationLocked, setUploadValidationLocked] = useState(false);
  const [hasLoadedMediaTab, setHasLoadedMediaTab] = useState(false);
  const [hasLoadedAuditTab, setHasLoadedAuditTab] = useState(false);
  const [statusToggleBusy, setStatusToggleBusy] = useState({});
  const [draggingMediaId, setDraggingMediaId] = useState(null);
  const [draggingMediaIsSlide, setDraggingMediaIsSlide] = useState(null);
  const [dragOverMediaId, setDragOverMediaId] = useState(null);
  const [mediaOrderSaving, setMediaOrderSaving] = useState(false);

  const [auditEntries, setAuditEntries] = useState([]);
  const [confirmState, setConfirmState] = useState({
    show: false,
    title: "",
    body: "",
    confirmLabel: "Confirm",
    confirmVariant: "secondary",
    validationMessage: "",
    action: null,
    errorTarget: null,
  });
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    const persistedTheme = window.localStorage.getItem("admin_dashboard_theme");
    if (persistedTheme === "dark") return true;
    if (persistedTheme === "light") return false;
    if (typeof window.matchMedia === "function") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= MOBILE_LAYOUT_MAX_WIDTH : false
  );
  const editCardRef = useRef(null);
  const mediaEditCardRef = useRef(null);
  const uploadFileInputRef = useRef(null);

  const activeGroupOptions = useMemo(
    () =>
      (referenceData.option_groups || [])
        .filter((group) => group?.is_active)
        .sort((left, right) => String(left?.title || "").localeCompare(String(right?.title || ""))),
    [referenceData.option_groups]
  );
  const selectedCreateMenuType = String(newItemForm.menu_type || "").toLowerCase();
  const applicableGroupOptions = useMemo(() => {
    if (!selectedCreateMenuType) return [];
    const formalGroups = activeGroupOptions.filter((group) => isFormalGroup(group));
    if (selectedCreateMenuType === "formal") {
      return formalGroups.length ? formalGroups : activeGroupOptions;
    }
    const regularGroups = activeGroupOptions.filter((group) => !isFormalGroup(group));
    return regularGroups.length ? regularGroups : activeGroupOptions;
  }, [activeGroupOptions, selectedCreateMenuType]);
  const groupOptionsByType = useMemo(() => {
    const formalGroups = activeGroupOptions.filter((group) => isFormalGroup(group));
    const regularGroups = activeGroupOptions.filter((group) => !isFormalGroup(group));
    return {
      regular: regularGroups.length ? regularGroups : activeGroupOptions,
      formal: formalGroups.length ? formalGroups : activeGroupOptions,
    };
  }, [activeGroupOptions]);
  const selectedEditMenuTypes = useMemo(() => uniqueMenuTypeList(itemForm?.menu_types || []), [itemForm?.menu_types]);
  const editUsesRegular = selectedEditMenuTypes.includes("regular");
  const getGroupOptionsForType = useCallback(
    (menuType) => {
      const normalized = normalizeFilterText(menuType);
      if (normalized === "formal") return groupOptionsByType.formal;
      if (normalized === "regular") return groupOptionsByType.regular;
      return [];
    },
    [groupOptionsByType]
  );
  const menuItemRows = useMemo(() => buildMenuItemTableRows(menuItems), [menuItems]);
  const menuItemTypeFilterOptions = useMemo(
    () => uniqueMenuTypeList(menuItemRows.flatMap((row) => row.menu_types)),
    [menuItemRows]
  );
  const menuItemGroupFilterOptions = useMemo(
    () =>
      uniqueTextList(menuItemRows.flatMap((row) => row.group_names)).sort((left, right) => left.localeCompare(right)),
    [menuItemRows]
  );
  const filteredMenuItemRows = useMemo(
    () =>
      MENU_ITEM_FILTERS.reduce((rows, filterDefinition) => {
        const filterValue = itemFilters[filterDefinition.key];
        if (!filterDefinition.shouldApply(filterValue)) return rows;
        return rows.filter((row) => filterDefinition.apply(row, filterValue));
      }, menuItemRows),
    [itemFilters, menuItemRows]
  );
  const hasCreateFormChanges = useMemo(
    () =>
      newItemForm.is_active !== INITIAL_NEW_ITEM_FORM.is_active ||
      Boolean(String(newItemForm.item_name || "").trim()) ||
      Boolean(String(newItemForm.menu_type || "").trim()) ||
      Boolean(String(newItemForm.group_id || "").trim()) ||
      Boolean(String(newItemForm.tray_price_half || "").trim()) ||
      Boolean(String(newItemForm.tray_price_full || "").trim()),
    [newItemForm]
  );
  const hasUploadFormChanges = useMemo(
    () =>
      uploadForm.is_slide !== INITIAL_UPLOAD_FORM.is_slide ||
      uploadForm.is_active !== INITIAL_UPLOAD_FORM.is_active ||
      Boolean(uploadForm.file) ||
      Boolean(String(uploadForm.title || "").trim()) ||
      Boolean(String(uploadForm.caption || "").trim()),
    [uploadForm]
  );

  const loadReferenceData = useCallback(async () => {
    const [generalPayload, formalPayload] = await Promise.all([
      requestJson("/api/menu/general/groups"),
      requestJson("/api/menu/formal/groups"),
    ]);
    const optionGroups = [
      ...((generalPayload.groups || []).map((group) => toOptionGroupFromCatalog(group, "regular")).filter(Boolean)),
      ...((formalPayload.groups || []).map((group) => toOptionGroupFromCatalog(group, "formal")).filter(Boolean)),
    ];
    setReferenceData({
      catalogs: [
        { id: 1, catalog_key: "regular", page_title: "Regular Menu", display_order: 1, is_active: true },
        { id: 2, catalog_key: "formal", page_title: "Formal Menu", display_order: 2, is_active: true },
      ],
      option_groups: optionGroups,
      sections: [],
      tiers: [],
    });
  }, []);

  const loadMenuItems = useCallback(async () => {
    try {
      const payload = await requestJson("/api/admin/menu/catalog-items?limit=500");
      setMenuItems(payload.items || []);
      setMenuTableError("");
    } catch (error) {
      setMenuTableError(error.message || "Failed to load menu items.");
      throw error;
    }
  }, []);

  const loadMedia = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (mediaFilters.search.trim()) params.set("search", mediaFilters.search.trim());
      if (mediaFilters.media_type) params.set("media_type", mediaFilters.media_type);
      if (mediaFilters.is_active !== "all") params.set("is_active", mediaFilters.is_active);
      if (mediaFilters.is_slide !== "all") params.set("is_slide", mediaFilters.is_slide);
      params.set("limit", "800");
      const payload = await requestJson(`/api/admin/media?${params.toString()}`);
      setMediaItems(payload.media || []);
      setMediaTableError("");
    } catch (error) {
      setMediaTableError(error.message || "Failed to load media items.");
      throw error;
    }
  }, [mediaFilters]);

  const loadAudit = useCallback(async () => {
    const payload = await requestJson("/api/admin/audit?limit=200");
    setAuditEntries(payload.entries || []);
  }, []);

  const loadItemDetail = useCallback(async (itemId) => {
    const payload = await requestJson(`/api/admin/menu/items/${itemId}`);
    const nextForm = buildItemForm(payload.item);
    setItemForm(nextForm);
    setItemFormOriginal(nextForm);
  }, []);

  const hasMenuItemNameConflict = useCallback(
    (itemName, menuTypes, excludeId = null) => {
      const normalizedName = normalizeMenuItemName(itemName);
      const normalizedTypes = uniqueMenuTypeList(Array.isArray(menuTypes) ? menuTypes : [menuTypes]);
      if (!normalizedName || !normalizedTypes.length) return false;
      const excludedRawId = excludeId === null ? null : decodeRawItemId(excludeId);
      return menuItems.some((item) => {
        const currentRawId = decodeRawItemId(item?.id);
        if (excludedRawId !== null && Number(currentRawId) === Number(excludedRawId)) return false;
        const currentType = String(item?.menu_type || "").trim().toLowerCase();
        const currentName = normalizeMenuItemName(item?.item_name);
        return normalizedTypes.includes(currentType) && currentName === normalizedName;
      });
    },
    [menuItems]
  );

  useEffect(() => {
    let mounted = true;
    const hydrateSession = async () => {
      try {
        const payload = await requestJson("/api/admin/auth/me");
        if (!mounted) return;
        setAdminUser(payload.user || null);
      } catch {
        if (!mounted) return;
        setAuthError("unauthorized");
      } finally {
        if (mounted) setSessionLoading(false);
      }
    };
    hydrateSession();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!adminUser) return;
    const loadInitial = async () => {
      try {
        setBusy(true);
        await Promise.all([loadReferenceData(), loadMenuItems()]);
      } catch (error) {
        setMenuTableError((prev) => prev || error.message || "Failed to load admin data.");
      } finally {
        setBusy(false);
      }
    };
    loadInitial();
  }, [adminUser, loadReferenceData, loadMenuItems]);

  useEffect(() => {
    if (!adminUser) return;
    const needsMediaLoad = activeTab === TAB_MEDIA && !hasLoadedMediaTab;
    const needsAuditLoad = activeTab === TAB_AUDIT && !hasLoadedAuditTab;
    if (!needsMediaLoad && !needsAuditLoad) return;

    let mounted = true;
    const loadTabData = async () => {
      try {
        setBusy(true);
        if (needsMediaLoad) {
          await loadMedia();
          if (mounted) setHasLoadedMediaTab(true);
        } else if (needsAuditLoad) {
          await loadAudit();
          if (mounted) setHasLoadedAuditTab(true);
        }
      } catch (error) {
        if (mounted) {
          if (needsMediaLoad) {
            setMediaTableError((prev) => prev || error.message || "Failed to load media data.");
          }
        }
      } finally {
        if (mounted) setBusy(false);
      }
    };

    loadTabData();
    return () => {
      mounted = false;
    };
  }, [activeTab, adminUser, hasLoadedAuditTab, hasLoadedMediaTab, loadAudit, loadMedia]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("admin_dashboard_theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const updateLayoutMode = () => {
      setIsMobileLayout(window.innerWidth <= MOBILE_LAYOUT_MAX_WIDTH);
    };
    updateLayoutMode();
    window.addEventListener("resize", updateLayoutMode);
    return () => window.removeEventListener("resize", updateLayoutMode);
  }, []);

  useEffect(() => {
    if (!shouldScrollToEditCard || !selectedItemId || !itemForm) return;
    if (!editCardRef.current) return;
    if (typeof editCardRef.current.scrollIntoView === "function") {
      editCardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setShouldScrollToEditCard(false);
  }, [shouldScrollToEditCard, selectedItemId, itemForm, editCardPlacement, isMobileLayout]);

  useEffect(() => {
    if (!shouldScrollToMediaEditCard || !selectedMediaId || !mediaForm) return;
    if (!mediaEditCardRef.current) return;
    if (typeof mediaEditCardRef.current.scrollIntoView === "function") {
      mediaEditCardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setShouldScrollToMediaEditCard(false);
  }, [shouldScrollToMediaEditCard, selectedMediaId, mediaForm, mediaEditCardPlacement, isMobileLayout]);

  const queueConfirm = (title, body, confirmLabel, action, errorTarget = null, confirmVariant = "secondary") => {
    if (errorTarget) {
      setFormErrors((prev) => ({ ...prev, [errorTarget]: "" }));
    }
    setConfirmState({ show: true, title, body, confirmLabel, confirmVariant, validationMessage: "", action, errorTarget });
  };

  const resetCreateItemForm = useCallback(() => {
    setNewItemForm(INITIAL_NEW_ITEM_FORM);
    setCreateFieldErrors(EMPTY_CREATE_FIELD_ERRORS);
    setCreateValidationLocked(false);
    setFormErrors((prev) => ({ ...prev, [FORM_ERROR_CREATE_ITEM]: "" }));
  }, []);

  const resetUploadMediaForm = useCallback(() => {
    setUploadForm(INITIAL_UPLOAD_FORM);
    setUploadFieldErrors(EMPTY_UPLOAD_FIELD_ERRORS);
    setUploadValidationLocked(false);
    setFormErrors((prev) => ({ ...prev, [FORM_ERROR_UPLOAD_MEDIA]: "" }));
    if (uploadFileInputRef.current) {
      uploadFileInputRef.current.value = "";
    }
  }, []);

  const runConfirmedAction = async () => {
    if (!confirmState.action) return;
    setConfirmBusy(true);
    try {
      await confirmState.action();
      setConfirmState({
        show: false,
        title: "",
        body: "",
        confirmLabel: "Confirm",
        confirmVariant: "secondary",
        validationMessage: "",
        action: null,
        errorTarget: null,
      });
    } catch (error) {
      const message = error.message || "Unable to apply change.";
      setConfirmState((prev) => ({ ...prev, validationMessage: message }));
      if (confirmState.errorTarget === FORM_ERROR_CREATE_ITEM) {
        const mappedCreateFieldErrors = mapCreateValidationErrors(message);
        if (Object.keys(mappedCreateFieldErrors).length) {
          setCreateFieldErrors((prev) => ({ ...prev, ...mappedCreateFieldErrors }));
        }
        setCreateValidationLocked(true);
      } else if (confirmState.errorTarget === FORM_ERROR_UPLOAD_MEDIA) {
        const mappedUploadFieldErrors = mapUploadValidationErrors(message);
        if (Object.keys(mappedUploadFieldErrors).length) {
          setUploadFieldErrors((prev) => ({ ...prev, ...mappedUploadFieldErrors }));
          setUploadValidationLocked(true);
        } else if (confirmState.errorTarget) {
          setFormErrors((prev) => ({ ...prev, [confirmState.errorTarget]: message }));
        }
      } else if (confirmState.errorTarget) {
        setFormErrors((prev) => ({ ...prev, [confirmState.errorTarget]: message }));
      }
    } finally {
      setConfirmBusy(false);
    }
  };

  const createItem = async () => {
    setCreateFieldErrors(EMPTY_CREATE_FIELD_ERRORS);
    const itemName = String(newItemForm.item_name || "").trim();
    const menuType = String(newItemForm.menu_type || "").toLowerCase();
    const hasMenuType = ["regular", "formal"].includes(menuType);
    const nextFieldErrors = { ...EMPTY_CREATE_FIELD_ERRORS };
    if (!itemName) {
      nextFieldErrors.item_name = "Item name is required.";
    } else if (hasMenuType && hasMenuItemNameConflict(itemName, menuType)) {
      nextFieldErrors.item_name = "Item name must be unique within this menu type.";
    }
    const groupId = Number(newItemForm.group_id);
    if (hasMenuType) {
      if (!Number.isFinite(groupId) || groupId <= 0) nextFieldErrors.group_id = "Please select a group.";
      if (!applicableGroupOptions.some((group) => Number(group.id) === groupId)) {
        nextFieldErrors.group_id = "Please select a group for the chosen menu type.";
      }
    }

    const isRegular = menuType === "regular";
    const trayHalfRaw = formatCurrencyToCents(newItemForm.tray_price_half);
    const trayFullRaw = formatCurrencyToCents(newItemForm.tray_price_full);
    const trayHalf = Number.parseFloat(trayHalfRaw);
    const trayFull = Number.parseFloat(trayFullRaw);
    if (isRegular && (!Number.isFinite(trayHalf) || trayHalf < 0)) {
      nextFieldErrors.tray_price_half = "Half tray price is required for regular menu items.";
    }
    if (isRegular && (!Number.isFinite(trayFull) || trayFull < 0)) {
      nextFieldErrors.tray_price_full = "Full tray price is required for regular menu items.";
    }

    const validationMessages = Object.values(nextFieldErrors).filter(Boolean);
    if (validationMessages.length) {
      setCreateFieldErrors(nextFieldErrors);
      throw new Error(validationMessages.join(" "));
    }

    const nonFormalSections = (referenceData.sections || []).filter(
      (section) => section?.is_active && String(section?.catalog_key || "").toLowerCase() !== "formal"
    );
    const nonFormalTiers = (referenceData.tiers || []).filter(
      (tier) => tier?.is_active && String(tier?.catalog_key || "").toLowerCase() !== "formal"
    );

    const sectionRowAssignments = isRegular
      ? nonFormalSections.map((section, index) => {
          const isToGoSection =
            String(section?.catalog_key || "").toLowerCase() === "togo" ||
            String(section?.section_key || "").toLowerCase().startsWith("togo_");
          return {
            section_id: Number(section.id),
            value_1: isToGoSection ? trayHalfRaw : "",
            value_2: isToGoSection ? trayFullRaw : "",
            display_order: index + 1,
            is_active: true,
          };
        })
      : [];

    const tierBulletAssignments = isRegular
      ? nonFormalTiers.map((tier, index) => ({
          tier_id: Number(tier.id),
          display_order: index + 1,
          is_active: true,
        }))
      : [];

    const payload = await requestJson("/api/admin/menu/items", {
      method: "POST",
      body: JSON.stringify({
        item_name: itemName,
        is_active: hasMenuType ? Boolean(newItemForm.is_active) : false,
        menu_type: hasMenuType ? menuType : [],
        group_id: hasMenuType ? groupId : null,
        tray_price_half: isRegular ? trayHalfRaw : null,
        tray_price_full: isRegular ? trayFullRaw : null,
        option_group_assignments: hasMenuType ? [{ group_id: groupId, display_order: 1, is_active: true }] : [],
        section_row_assignments: sectionRowAssignments,
        tier_bullet_assignments: tierBulletAssignments,
      }),
    });
    resetCreateItemForm();
    await Promise.all([loadMenuItems(), loadAudit()]);
    if (payload.item?.id) {
      const nextForm = buildItemForm(payload.item);
      setSelectedItemId(payload.item.id);
      setItemForm(nextForm);
      setItemFormOriginal(nextForm);
      setEditCardPlacement(isMobileLayout ? "above_list" : "below_table");
      setShouldScrollToEditCard(false);
      setShowCreatedItemHighlight(true);
    }
  };

  const buildCreateConfirmBody = useCallback(() => {
    const itemName = String(newItemForm.item_name || "").trim();
    const menuType = String(newItemForm.menu_type || "").toLowerCase();
    const hasMenuType = ["regular", "formal"].includes(menuType);
    const selectedGroupId = Number(newItemForm.group_id);
    const groupOptions = hasMenuType ? getGroupOptionsForType(menuType) : [];
    const selectedGroup = groupOptions.find((group) => Number(group.id) === selectedGroupId);
    const halfPrice = formatCurrencyDisplay(newItemForm.tray_price_half);
    const fullPrice = formatCurrencyDisplay(newItemForm.tray_price_full);
    const isRegular = menuType === "regular";
    const rows = [
      { label: "Item Name", value: itemName || "-" },
      {
        label: "Active",
        value: hasMenuType ? formatBooleanLabel(newItemForm.is_active) : "No (auto-inactive until assigned)",
      },
      { label: "Menu Type", value: hasMenuType ? formatMenuTypeLabel(menuType) : "None" },
      { label: "Group", value: hasMenuType ? selectedGroup?.title || "None selected" : "None" },
      { label: "Half Tray Price", value: isRegular ? halfPrice : "N/A" },
      { label: "Full Tray Price", value: isRegular ? fullPrice : "N/A" },
    ];

    return (
      <div>
        <p className="mb-2">Create this menu item with the following details?</p>
        <ConfirmReviewList rows={rows} />
      </div>
    );
  }, [newItemForm, getGroupOptionsForType]);

  const buildUpdateConfirmBody = useCallback(() => {
    if (!itemForm || !itemFormOriginal) return "Update this menu item?";

    const currentTypes = orderMenuTypes(itemForm.menu_types || []);
    const originalTypes = orderMenuTypes(itemFormOriginal.menu_types || []);
    const currentUsesRegular = currentTypes.includes("regular");
    const originalUsesRegular = originalTypes.includes("regular");

    const summarizeGroups = (form, types) => {
      if (!types.length) return "None";
      return types
        .map((typeKey) => {
          const groupId = getAssignmentGroupIdForType(form.option_group_assignments, typeKey);
          const option = getGroupOptionsForType(typeKey).find((group) => Number(group.id) === Number(groupId));
          return `${formatMenuTypeLabel(typeKey)}: ${option?.title || "None selected"}`;
        })
        .join(" | ");
    };

    const currentMenuTypeSummary = currentTypes.length ? currentTypes.map((typeKey) => formatMenuTypeLabel(typeKey)).join(", ") : "None";
    const originalMenuTypeSummary = originalTypes.length ? originalTypes.map((typeKey) => formatMenuTypeLabel(typeKey)).join(", ") : "None";
    const currentGroupSummary = summarizeGroups(itemForm, currentTypes);
    const originalGroupSummary = summarizeGroups(itemFormOriginal, originalTypes);
    const currentActive = currentTypes.length ? formatBooleanLabel(itemForm.is_active) : "No";
    const originalActive = originalTypes.length ? formatBooleanLabel(itemFormOriginal.is_active) : "No";
    const currentHalf = currentUsesRegular ? formatCurrencyDisplay(itemForm.tray_price_half) : "N/A";
    const originalHalf = originalUsesRegular ? formatCurrencyDisplay(itemFormOriginal.tray_price_half) : "N/A";
    const currentFull = currentUsesRegular ? formatCurrencyDisplay(itemForm.tray_price_full) : "N/A";
    const originalFull = originalUsesRegular ? formatCurrencyDisplay(itemFormOriginal.tray_price_full) : "N/A";

    const changes = [];
    if (String(itemForm.item_name || "").trim() !== String(itemFormOriginal.item_name || "").trim()) {
      changes.push({ label: "Item Name", value: String(itemForm.item_name || "").trim() || "-" });
    }
    if (currentActive !== originalActive) {
      changes.push({ label: "Active", value: currentActive });
    }
    if (currentMenuTypeSummary !== originalMenuTypeSummary) {
      changes.push({ label: "Menu Type", value: currentMenuTypeSummary });
    }
    if (currentGroupSummary !== originalGroupSummary) {
      changes.push({ label: "Group(s)", value: currentGroupSummary });
    }
    if (currentHalf !== originalHalf) {
      changes.push({ label: "Half Tray Price", value: currentHalf });
    }
    if (currentFull !== originalFull) {
      changes.push({ label: "Full Tray Price", value: currentFull });
    }

    return <ConfirmReviewList rows={changes} emptyMessage="No field changes detected." />;
  }, [itemForm, itemFormOriginal, getGroupOptionsForType]);

  const buildUpdateConfirmTitle = useCallback(() => {
    const itemName = String(itemForm?.item_name || "").trim();
    return itemName ? `Update ${itemName}?` : "Update item?";
  }, [itemForm?.item_name]);

  const buildUploadMediaConfirmBody = useCallback(() => {
    const rows = [
      { label: "File", value: uploadForm.file?.name || "No file selected" },
      { label: "Title", value: String(uploadForm.title || "").trim() || "-" },
      { label: "Caption", value: String(uploadForm.caption || "").trim() || "-" },
      { label: "Landing Slide", value: formatBooleanLabel(uploadForm.is_slide) },
      { label: "Active", value: formatBooleanLabel(uploadForm.is_active) },
    ];
    return (
      <div>
        <p className="mb-2">Upload this media item with the following details?</p>
        <ConfirmReviewList rows={rows} />
      </div>
    );
  }, [uploadForm]);

  const buildMediaUpdateConfirmBody = useCallback(() => {
    if (!mediaForm || !mediaFormOriginal) return "Save media changes?";

    const nextTitle = String(mediaForm.title || "").trim();
    const originalTitle = String(mediaFormOriginal.title || "").trim();
    const nextCaption = String(mediaForm.caption || "").trim();
    const originalCaption = String(mediaFormOriginal.caption || "").trim();
    const changes = [];

    if (nextTitle !== originalTitle) {
      changes.push({ label: "Title", value: nextTitle || "-" });
    }
    if (nextCaption !== originalCaption) {
      changes.push({ label: "Caption", value: nextCaption || "-" });
    }
    if (Boolean(mediaForm.is_slide) !== Boolean(mediaFormOriginal.is_slide)) {
      changes.push({ label: "Landing Slide", value: formatBooleanLabel(Boolean(mediaForm.is_slide)) });
    }
    if (Boolean(mediaForm.is_active) !== Boolean(mediaFormOriginal.is_active)) {
      changes.push({ label: "Active", value: formatBooleanLabel(Boolean(mediaForm.is_active)) });
    }

    return <ConfirmReviewList rows={changes} emptyMessage="No field changes detected." />;
  }, [mediaForm, mediaFormOriginal]);

  const buildMediaUpdateConfirmTitle = useCallback(() => {
    const title = String(mediaForm?.title || "").trim();
    if (title) return `Update ${title}?`;
    const sourceFilename = formatMediaSourceFilename(mediaForm?.src);
    return sourceFilename ? `Update ${sourceFilename}?` : "Update media?";
  }, [mediaForm]);

  const saveItem = async () => {
    if (!itemForm?.id) return;
    setFormErrors((prev) => ({ ...prev, [FORM_ERROR_EDIT_ITEM]: "" }));
    const itemName = String(itemForm.item_name || "").trim();
    if (!itemName) throw new Error("Item name is required.");
    const selectedTypes = uniqueMenuTypeList(itemForm.menu_types || []);
    const hasSelectedTypes = selectedTypes.length > 0;
    if (hasSelectedTypes && hasMenuItemNameConflict(itemName, selectedTypes, itemForm.id)) {
      throw new Error("Item name must be unique within this menu type.");
    }
    const optionGroupAssignments = hasSelectedTypes
      ? selectedTypes.map((typeKey, index) => {
          const selectedGroupId = getAssignmentGroupIdForType(itemForm.option_group_assignments, typeKey);
          if (!selectedGroupId) {
            throw new Error(`Select a group for ${formatMenuTypeLabel(typeKey)} menu type.`);
          }
          const allowedGroups = getGroupOptionsForType(typeKey);
          if (!allowedGroups.some((group) => Number(group.id) === Number(selectedGroupId))) {
            throw new Error(`Group assignment is not valid for ${formatMenuTypeLabel(typeKey)} menu type.`);
          }
          return {
            menu_type: typeKey,
            category: typeKey,
            group_id: Number(selectedGroupId),
            display_order: index + 1,
            is_active: true,
          };
        })
      : [];

    const usesRegular = selectedTypes.includes("regular");
    const trayHalfRaw = formatCurrencyToCents(itemForm.tray_price_half);
    const trayFullRaw = formatCurrencyToCents(itemForm.tray_price_full);
    const trayHalf = Number.parseFloat(trayHalfRaw);
    const trayFull = Number.parseFloat(trayFullRaw);
    if (usesRegular && (!Number.isFinite(trayHalf) || trayHalf < 0)) {
      throw new Error("Half tray price is required for regular menu items.");
    }
    if (usesRegular && (!Number.isFinite(trayFull) || trayFull < 0)) {
      throw new Error("Full tray price is required for regular menu items.");
    }

    const payload = {
      id: itemForm.id,
      item_name: itemName,
      is_active: hasSelectedTypes ? itemForm.is_active : false,
    };
    if (hasSelectedTypes) {
      payload.menu_type = selectedTypes;
      payload.tray_price_half = usesRegular ? trayHalfRaw : null;
      payload.tray_price_full = usesRegular ? trayFullRaw : null;
      payload.option_group_assignments = optionGroupAssignments;
    } else {
      payload.menu_type = [];
      payload.option_group_assignments = [];
    }

    const response = await requestJson(`/api/admin/menu/items/${itemForm.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const nextForm = buildItemForm(response.item);
    setItemForm(nextForm);
    setItemFormOriginal(nextForm);
    setShowCreatedItemHighlight(true);
    await Promise.all([loadMenuItems(), loadAudit()]);
  };

  const deleteItem = async () => {
    if (!itemForm?.id) return;
    setFormErrors((prev) => ({ ...prev, [FORM_ERROR_EDIT_ITEM]: "" }));

    const response = await requestJson(`/api/admin/menu/items/${itemForm.id}`, {
      method: "DELETE",
    });
    setSelectedItemId(null);
    setItemForm(null);
    setItemFormOriginal(null);
    setEditCardPlacement("below_table");
    setShouldScrollToEditCard(false);
    setShowCreatedItemHighlight(false);
    await Promise.all([loadMenuItems(), loadAudit()]);
  };

  const uploadMedia = async () => {
    const nextUploadFieldErrors = { ...EMPTY_UPLOAD_FIELD_ERRORS };
    setFormErrors((prev) => ({ ...prev, [FORM_ERROR_UPLOAD_MEDIA]: "" }));
    const normalizedTitle = String(uploadForm.title || "").trim();
    const normalizedCaption = String(uploadForm.caption || "").trim();

    if (!uploadForm.file) {
      nextUploadFieldErrors.file = "Choose a file before uploading.";
    }
    if (!normalizedTitle) {
      nextUploadFieldErrors.title = "Title is required.";
    }
    if (!normalizedCaption) {
      nextUploadFieldErrors.caption = "Caption is required.";
    }

    const validationMessages = Object.values(nextUploadFieldErrors).filter(Boolean);
    if (validationMessages.length) {
      setUploadFieldErrors(nextUploadFieldErrors);
      throw new Error(validationMessages.join(" "));
    }

    setUploadFieldErrors(EMPTY_UPLOAD_FIELD_ERRORS);
    const formData = new FormData();
    formData.set("file", uploadForm.file);
    formData.set("title", normalizedTitle);
    formData.set("caption", normalizedCaption);
    formData.set("is_slide", String(uploadForm.is_slide));
    formData.set("is_active", String(uploadForm.is_active));
    const payload = await requestWithFormData("/api/admin/media/upload", formData);
    if (payload?.media?.id) {
      const nextForm = buildMediaForm(payload.media);
      setSelectedMediaId(payload.media.id);
      setMediaForm(nextForm);
      setMediaFormOriginal(nextForm);
      setMediaEditCardPlacement(isMobileLayout ? "above_list" : "below_table");
      setShouldScrollToMediaEditCard(false);
      setShowCreatedMediaHighlight(true);
    }
    resetUploadMediaForm();
    await Promise.all([loadMedia(), loadAudit()]);
  };

  const saveMedia = async () => {
    if (!mediaForm?.id) return;
    setFormErrors((prev) => ({ ...prev, [FORM_ERROR_EDIT_MEDIA]: "" }));
    const payload = await requestJson(`/api/admin/media/${mediaForm.id}`, {
      method: "PATCH",
      body: JSON.stringify(mediaForm),
    });
    const nextForm = buildMediaForm(payload.media);
    setMediaForm(nextForm);
    setMediaFormOriginal(nextForm);
    await Promise.all([loadMedia(), loadAudit()]);
  };

  const deleteMedia = async () => {
    if (!mediaForm?.id) return;
    setFormErrors((prev) => ({ ...prev, [FORM_ERROR_EDIT_MEDIA]: "" }));
    await requestJson(`/api/admin/media/${mediaForm.id}`, {
      method: "DELETE",
    });
    setSelectedMediaId(null);
    setMediaForm(null);
    setMediaFormOriginal(null);
    setMediaEditCardPlacement("below_table");
    setShouldScrollToMediaEditCard(false);
    setShowCreatedMediaHighlight(false);
    await Promise.all([loadMedia(), loadAudit()]);
  };

  const handleMenuCreateSubmit = useCallback(
    (event) => {
      event.preventDefault();
      if (createValidationLocked) return;
      queueConfirm("Create menu item", buildCreateConfirmBody(), "Create", createItem, FORM_ERROR_CREATE_ITEM);
    },
    [createValidationLocked, buildCreateConfirmBody, createItem]
  );

  const handleMenuEditSubmit = useCallback(
    (event) => {
      event.preventDefault();
      queueConfirm(buildUpdateConfirmTitle(), buildUpdateConfirmBody(), "Update", saveItem, FORM_ERROR_EDIT_ITEM);
    },
    [buildUpdateConfirmTitle, buildUpdateConfirmBody, saveItem]
  );

  const handleMediaUploadSubmit = useCallback(
    (event) => {
      event.preventDefault();
      if (uploadValidationLocked) return;
      queueConfirm("Upload media", buildUploadMediaConfirmBody(), "Upload", uploadMedia, FORM_ERROR_UPLOAD_MEDIA);
    },
    [uploadValidationLocked, buildUploadMediaConfirmBody, uploadMedia]
  );

  const handleMediaEditSubmit = useCallback(
    (event) => {
      event.preventDefault();
      queueConfirm(
        buildMediaUpdateConfirmTitle(),
        buildMediaUpdateConfirmBody(),
        "Save",
        saveMedia,
        FORM_ERROR_EDIT_MEDIA
      );
    },
    [buildMediaUpdateConfirmTitle, buildMediaUpdateConfirmBody, saveMedia]
  );

  const toggleMenuItemStatusFromTable = async (item) => {
    const itemId = toId(item?.id);
    if (!itemId) return;
    const busyKey = `menu:${itemId}`;
    if (statusToggleBusy[busyKey]) return;

    setStatusToggleBusy((prev) => ({ ...prev, [busyKey]: true }));
    setMenuTableError("");
    try {
      const menuTypes = uniqueMenuTypeList(item?.menu_types || []);
      const response = await requestJson(`/api/admin/menu/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({
          is_active: !Boolean(item?.is_active),
          menu_type: menuTypes,
        }),
      });
      if (Number(selectedItemId) === Number(itemId) && response?.item) {
        const nextForm = buildItemForm(response.item);
        setItemForm(nextForm);
        setItemFormOriginal(nextForm);
      }
      await Promise.all([loadMenuItems(), loadAudit()]);
    } catch (error) {
      setMenuTableError(error.message || "Failed to update menu item status.");
    } finally {
      setStatusToggleBusy((prev) => {
        const next = { ...prev };
        delete next[busyKey];
        return next;
      });
    }
  };

  const toggleMediaStatusFromTable = async (item) => {
    const mediaId = toId(item?.id);
    if (!mediaId) return;
    const busyKey = `media:${mediaId}`;
    if (statusToggleBusy[busyKey]) return;

    setStatusToggleBusy((prev) => ({ ...prev, [busyKey]: true }));
    setMediaTableError("");
    try {
      const payload = await requestJson(`/api/admin/media/${mediaId}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !Boolean(item?.is_active) }),
      });
      if (Number(selectedMediaId) === Number(mediaId) && payload?.media) {
        const nextForm = buildMediaForm(payload.media);
        setMediaForm(nextForm);
        setMediaFormOriginal(nextForm);
      }
      await Promise.all([loadMedia(), loadAudit()]);
    } catch (error) {
      setMediaTableError(error.message || "Failed to update media status.");
    } finally {
      setStatusToggleBusy((prev) => {
        const next = { ...prev };
        delete next[busyKey];
        return next;
      });
    }
  };

  const reorderMediaItemsFromTable = async (draggedId, targetId, isSlideGroup) => {
    const sourceId = toId(draggedId);
    const destinationId = toId(targetId);
    if (!sourceId || !destinationId || sourceId === destinationId || mediaOrderSaving) return;

    const currentGroupIds = (mediaItems || [])
      .filter((item) => Boolean(item?.is_slide) === Boolean(isSlideGroup))
      .map((item) => toId(item?.id))
      .filter(Boolean);
    const sourceIndex = currentGroupIds.findIndex((id) => Number(id) === Number(sourceId));
    const destinationIndex = currentGroupIds.findIndex((id) => Number(id) === Number(destinationId));
    if (sourceIndex < 0 || destinationIndex < 0) return;

    const reorderedIds = [...currentGroupIds];
    const [movedId] = reorderedIds.splice(sourceIndex, 1);
    reorderedIds.splice(destinationIndex, 0, movedId);
    if (reorderedIds.every((value, index) => Number(value) === Number(currentGroupIds[index]))) return;

    setMediaOrderSaving(true);
    setMediaTableError("");
    try {
      await requestJson("/api/admin/media/reorder", {
        method: "PATCH",
        body: JSON.stringify({
          ordered_ids: reorderedIds,
          is_slide: Boolean(isSlideGroup),
        }),
      });
      if (selectedMediaId) {
        const selectedIndex = reorderedIds.findIndex((value) => Number(value) === Number(selectedMediaId));
        if (selectedIndex >= 0) {
          setMediaForm((prev) => (prev ? { ...prev, display_order: selectedIndex + 1 } : prev));
          setMediaFormOriginal((prev) => (prev ? { ...prev, display_order: selectedIndex + 1 } : prev));
        }
      }
      await Promise.all([loadMedia(), loadAudit()]);
    } catch (error) {
      setMediaTableError(error.message || "Failed to reorder media.");
    } finally {
      setMediaOrderSaving(false);
      setDraggingMediaId(null);
      setDraggingMediaIsSlide(null);
      setDragOverMediaId(null);
    }
  };

  const logout = async () => {
    await requestJson("/api/admin/auth/logout", { method: "POST" });
    navigate("/admin/login", { replace: true });
  };

  const shouldRenderEditCardAboveList = Boolean(
    selectedItemId && itemForm && isMobileLayout && editCardPlacement === "above_list"
  );
  const shouldRenderEditCardBelowTable = Boolean(selectedItemId && itemForm && !shouldRenderEditCardAboveList);
  const shouldRenderMediaEditCardAboveList = Boolean(
    selectedMediaId && mediaForm && isMobileLayout && mediaEditCardPlacement === "above_list"
  );
  const shouldRenderMediaEditCardBelowTable = Boolean(selectedMediaId && mediaForm && !shouldRenderMediaEditCardAboveList);
  const editMenuItemCard = selectedItemId && itemForm ? (
	    <div ref={editCardRef}>
	      <Card
	        data-testid="edit-menu-item-card"
	        className={`mb-3 ${showCreatedItemHighlight ? "admin-edit-card-created" : ""}`}>
	        <Card.Body>
            <Form onSubmit={handleMenuEditSubmit}>
	          <div className="d-flex justify-content-between align-items-center mb-2">
	            <h3 className="h6 mb-0">Edit Menu Item</h3>
	            <button
	              type="button"
              className="btn-close admin-edit-card-close"
              aria-label="Close edit menu item"
              onClick={() => {
                setSelectedItemId(null);
                setItemForm(null);
                setItemFormOriginal(null);
                setEditCardPlacement("below_table");
                setShouldScrollToEditCard(false);
                setShowCreatedItemHighlight(false);
              }}
            />
          </div>
          {formErrors[FORM_ERROR_EDIT_ITEM] ? <Alert variant="danger">{formErrors[FORM_ERROR_EDIT_ITEM]}</Alert> : null}
          <Form.Check
            className="mb-3"
            type="switch"
            label="Active"
            checked={itemForm.is_active}
            onChange={(event) => {
              setShowCreatedItemHighlight(false);
              setItemForm((prev) => ({ ...prev, is_active: event.target.checked }));
            }}
          />
          <Row className="g-2 mb-2">
            <Col md={12}>
              <Form.Label className="small mb-1" htmlFor="admin-edit-item-name">
                Item Name
              </Form.Label>
              <Form.Control
                id="admin-edit-item-name"
                value={itemForm.item_name}
                onChange={(event) => {
                  setShowCreatedItemHighlight(false);
                  setItemForm((prev) => ({ ...prev, item_name: event.target.value }));
                }}
              />
            </Col>
          </Row>

          <div className="admin-assignment-panel mb-3">
            <h4 className="h6 mb-2">Menu Type</h4>
            <div className="d-flex gap-3 flex-wrap">
              {MENU_TYPE_OPTIONS.map((typeKey) => {
                const normalizedType = normalizeFilterText(typeKey);
                const checked = selectedEditMenuTypes.includes(normalizedType);
                return (
                  <Form.Check
                    key={`edit-menu-type-${normalizedType}`}
                    inline
                    type="checkbox"
                    id={`edit-menu-type-${normalizedType}`}
                    label={formatMenuTypeLabel(normalizedType)}
                    checked={checked}
                    onChange={(event) => {
                      const wantsEnabled = event.target.checked;
                      setShowCreatedItemHighlight(false);
                      setItemForm((prev) => {
                        if (!prev) return prev;
                        const currentTypes = uniqueMenuTypeList(prev.menu_types || []);
                        const nextTypes = wantsEnabled
                          ? uniqueMenuTypeList([...currentTypes, normalizedType])
                          : currentTypes.filter((value) => value !== normalizedType);
                        const options = getGroupOptionsForType(normalizedType);
                        const fallbackGroupId = getAssignmentGroupIdForType(prev.option_group_assignments, normalizedType) || toId(options[0]?.id);
                        const nextAssignments = wantsEnabled
                          ? upsertAssignmentForType(prev.option_group_assignments, normalizedType, fallbackGroupId)
                          : removeAssignmentForType(prev.option_group_assignments, normalizedType);
                        return {
                          ...prev,
                          menu_types: nextTypes,
                          option_group_assignments: nextAssignments,
                        };
                      });
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div className="admin-assignment-panel">
            <h4 className="h6 mb-2">Group(s)</h4>
            {selectedEditMenuTypes.length ? (
              selectedEditMenuTypes.map((typeKey) => {
                const options = getGroupOptionsForType(typeKey);
                const groupSelectId = `admin-edit-group-${typeKey}`;
                return (
                  <div key={`edit-group-${typeKey}`} className="mb-2">
                    <Form.Label className="small mb-1" htmlFor={groupSelectId}>{`${formatMenuTypeLabel(typeKey)} Group`}</Form.Label>
                    <Form.Select
                      id={groupSelectId}
                      value={getAssignmentGroupIdForType(itemForm.option_group_assignments, typeKey)}
                      onChange={(event) => {
                        const nextGroupId = toId(event.target.value);
                        setShowCreatedItemHighlight(false);
                        setItemForm((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            option_group_assignments: upsertAssignmentForType(prev.option_group_assignments, typeKey, nextGroupId),
                          };
                        });
                      }}>
                      <option value="">Select group</option>
                      {options.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.title}
                        </option>
                      ))}
                    </Form.Select>
                  </div>
                );
              })
            ) : (
              <div className="small text-secondary">Select at least one menu type to configure group assignments.</div>
            )}
          </div>

          {editUsesRegular ? (
            <Row className="g-2 mt-2">
              <Col md={6}>
                <Form.Label className="small mb-1" htmlFor="admin-edit-half-tray-price">
                  Half Tray Price
                </Form.Label>
	                <InputGroup hasValidation>
	                  <InputGroup.Text>$</InputGroup.Text>
	                  <Form.Control
                    id="admin-edit-half-tray-price"
                    type="text"
                    inputMode="decimal"
                    value={itemForm.tray_price_half}
                    onChange={(event) => {
                      setShowCreatedItemHighlight(false);
                      setItemForm((prev) => ({
                        ...prev,
                        tray_price_half: formatCurrencyInputFromDigits(event.target.value),
                      }));
                    }}
                    onBlur={() =>
                      setItemForm((prev) => ({
                        ...prev,
                        tray_price_half: formatCurrencyToCents(prev.tray_price_half),
                      }))
                    }
                  />
                </InputGroup>
              </Col>
              <Col md={6}>
                <Form.Label className="small mb-1" htmlFor="admin-edit-full-tray-price">
                  Full Tray Price
                </Form.Label>
	                <InputGroup hasValidation>
	                  <InputGroup.Text>$</InputGroup.Text>
	                  <Form.Control
                    id="admin-edit-full-tray-price"
                    type="text"
                    inputMode="decimal"
                    value={itemForm.tray_price_full}
                    onChange={(event) => {
                      setShowCreatedItemHighlight(false);
                      setItemForm((prev) => ({
                        ...prev,
                        tray_price_full: formatCurrencyInputFromDigits(event.target.value),
                      }));
                    }}
                    onBlur={() =>
                      setItemForm((prev) => ({
                        ...prev,
                        tray_price_full: formatCurrencyToCents(prev.tray_price_full),
                      }))
                    }
                  />
                </InputGroup>
              </Col>
            </Row>
          ) : null}

	          <div className="d-flex gap-2 mt-3 align-items-center">
	            <Button
	              className="btn-inquiry-action"
	              variant="secondary"
                type="submit">
	              Update Item
	            </Button>
	            <Button
	              className="ms-auto"
	              variant="danger"
                type="button"
	              onClick={() =>
	                queueConfirm(
	                  "Delete Menu Item?",
	                  <div className="text-center py-1">{itemForm?.item_name || "Item"}</div>,
                  "Delete",
                  deleteItem,
                  FORM_ERROR_EDIT_ITEM,
                  "danger"
                )
              }>
	              Delete Item
	            </Button>
	          </div>
            </Form>
	        </Card.Body>
	      </Card>
	    </div>
	  ) : null;
  const editMediaCard = selectedMediaId && mediaForm ? (
    <div ref={mediaEditCardRef}>
      <Card className={`mb-3 ${showCreatedMediaHighlight ? "admin-edit-card-created" : ""}`} data-testid="edit-media-card">
        <Card.Body>
          <Form onSubmit={handleMediaEditSubmit}>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="d-flex align-items-center gap-2 min-w-0">
                <h3 className="h6 mb-0">Edit Media</h3>
                {formatMediaSourceFilename(mediaForm.src) ? (
                  <div className="small text-secondary text-truncate">{formatMediaSourceFilename(mediaForm.src)}</div>
                ) : null}
              </div>
              <button
                type="button"
                className="btn-close admin-edit-card-close"
                aria-label="Close edit media"
                onClick={() => {
                  setSelectedMediaId(null);
                  setMediaForm(null);
                  setMediaFormOriginal(null);
                  setMediaEditCardPlacement("below_table");
                  setShouldScrollToMediaEditCard(false);
                  setShowCreatedMediaHighlight(false);
                  setFormErrors((prev) => ({ ...prev, [FORM_ERROR_EDIT_MEDIA]: "" }));
                }}
              />
            </div>
            {formErrors[FORM_ERROR_EDIT_MEDIA] ? <Alert variant="danger">{formErrors[FORM_ERROR_EDIT_MEDIA]}</Alert> : null}
            <Form.Label className="small mb-1" htmlFor="admin-edit-media-title">
              Title
            </Form.Label>
            <Form.Control
              id="admin-edit-media-title"
              className="mb-2"
              value={mediaForm.title}
              onChange={(event) => {
                setShowCreatedMediaHighlight(false);
                setMediaForm((prev) => ({ ...prev, title: event.target.value }));
              }}
            />
            <Form.Label className="small mb-1" htmlFor="admin-edit-media-caption">
              Caption
            </Form.Label>
            <Form.Control
              id="admin-edit-media-caption"
              className="mb-2"
              value={mediaForm.caption}
              onChange={(event) => {
                setShowCreatedMediaHighlight(false);
                setMediaForm((prev) => ({ ...prev, caption: event.target.value }));
              }}
            />
            <Form.Check
              className="mb-2"
              type="switch"
              label="Homepage Slide"
              checked={mediaForm.is_slide}
              onChange={(event) => {
                setShowCreatedMediaHighlight(false);
                setMediaForm((prev) => ({ ...prev, is_slide: event.target.checked }));
              }}
            />
            <Form.Check
              className="mb-2"
              type="switch"
              label="Active"
              checked={mediaForm.is_active}
              onChange={(event) => {
                setShowCreatedMediaHighlight(false);
                setMediaForm((prev) => ({ ...prev, is_active: event.target.checked }));
              }}
            />
            <div className="d-flex gap-2 mt-2 align-items-center">
              <Button className="btn-inquiry-action" variant="secondary" type="submit">
                Save Media
              </Button>
              <Button
                className="ms-auto"
                variant="danger"
                type="button"
                onClick={() =>
                  queueConfirm(
                    "Delete Media Item?",
                    <div className="text-center py-1">{mediaForm?.title?.trim() || "Media Item"}</div>,
                    "Delete",
                    deleteMedia,
                    FORM_ERROR_EDIT_MEDIA,
                    "danger"
                  )
                }>
                Delete Media
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  ) : null;

  if (sessionLoading) {
    return (
      <main className="container py-5 d-flex justify-content-center">
        <Spinner animation="border" role="status" />
      </main>
    );
  }

  if (authError) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <main
      className={`container-fluid py-4 admin-dashboard ${isDarkMode ? "admin-dashboard-dark" : ""}`}
      data-bs-theme={isDarkMode ? "dark" : "light"}>
      <header className="admin-header mb-3">
        <div className="admin-header-main">
          <h2 className="h4 mb-1">Admin Dashboard</h2>
          <p className="text-secondary mb-0">
            Signed in as <strong>{adminUser?.display_name || adminUser?.username}</strong>
          </p>
          <Form.Check
            className="admin-theme-toggle mt-2"
            type="switch"
            id="admin-dark-mode-toggle"
            label="Dark Mode"
            checked={isDarkMode}
            onChange={(event) => setIsDarkMode(event.target.checked)}
          />
        </div>
        <div className="admin-header-actions">
          <Button variant="outline-danger" onClick={logout}>
            Sign Out
          </Button>
        </div>
      </header>

      <Nav variant="tabs" activeKey={activeTab} onSelect={(key) => setActiveTab(key || TAB_MENU)} className="mb-3" role="tablist">
        <Nav.Item>
          <Nav.Link eventKey={TAB_MENU} role="tab" aria-label="Menu Operations" aria-selected={activeTab === TAB_MENU}>
            <span className="admin-tab-label-full">Menu Operations</span>
            <span className="admin-tab-label-short">Menu</span>
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey={TAB_MEDIA} role="tab" aria-label="Media Manager" aria-selected={activeTab === TAB_MEDIA}>
            <span className="admin-tab-label-full">Media Manager</span>
            <span className="admin-tab-label-short">Media</span>
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey={TAB_AUDIT} role="tab" aria-label="Audit History" aria-selected={activeTab === TAB_AUDIT}>
            <span className="admin-tab-label-full">Audit History</span>
            <span className="admin-tab-label-short">Logs</span>
          </Nav.Link>
        </Nav.Item>
      </Nav>

      {activeTab === TAB_MENU ? (
	        <Row className="g-3">
	          <Col lg={4}>
	            <Card className="mb-3">
	              <Card.Body>
                  <Form onSubmit={handleMenuCreateSubmit}>
	                <h3 className="h6">Create Menu Item</h3>
	                <Form.Check
	                  className="mb-2"
                  type="switch"
                  label="Active"
                  checked={newItemForm.is_active}
                  onChange={(event) => setNewItemForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                />
	                <Form.Control
	                  id="admin-create-item-name"
	                  className="mb-2"
	                  aria-label="Item Name"
	                  placeholder="Item name"
	                  isInvalid={Boolean(createFieldErrors.item_name)}
	                  value={newItemForm.item_name}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    const hadFieldError = Boolean(createFieldErrors.item_name);
                    setNewItemForm((prev) => ({ ...prev, item_name: nextValue }));
                    setCreateFieldErrors((prev) => ({ ...prev, item_name: "" }));
                    if (hadFieldError) {
                      setCreateValidationLocked(false);
                    }
                  }}
                />
	                <Form.Select
	                  id="admin-create-menu-type"
	                  className={`mb-2 ${newItemForm.menu_type ? "" : "admin-select-placeholder"}`.trim()}
	                  aria-label="Menu Type"
	                  isInvalid={Boolean(createFieldErrors.menu_type)}
	                  value={newItemForm.menu_type}
	                  onChange={(event) => {
                    const hadFieldError = Boolean(
                      createFieldErrors.menu_type ||
                        createFieldErrors.group_id ||
                        createFieldErrors.tray_price_half ||
                        createFieldErrors.tray_price_full
                    );
                    setCreateFieldErrors((prev) => ({
                      ...prev,
                      menu_type: "",
                      group_id: "",
                      tray_price_half: "",
                      tray_price_full: "",
                    }));
                    if (hadFieldError) {
                      setCreateValidationLocked(false);
                    }
                    setNewItemForm((prev) => ({
                      ...prev,
                      menu_type: event.target.value,
                      group_id: "",
                      tray_price_half: "",
                      tray_price_full: "",
                    }))
                  }}>
                  <option value="">Select menu type</option>
                  <option value="regular">Regular</option>
                  <option value="formal">Formal</option>
                </Form.Select>
	                {selectedCreateMenuType ? (
	                  <>
	                    <Form.Select
	                      id="admin-create-group"
	                      className={`mb-2 ${newItemForm.group_id ? "" : "admin-select-placeholder"}`.trim()}
	                      aria-label="Group"
	                      isInvalid={Boolean(createFieldErrors.group_id)}
	                      value={newItemForm.group_id}
	                      onChange={(event) => {
                        const hadFieldError = Boolean(createFieldErrors.group_id);
                        setCreateFieldErrors((prev) => ({ ...prev, group_id: "" }));
                        if (hadFieldError) {
                          setCreateValidationLocked(false);
                        }
                        setNewItemForm((prev) => ({ ...prev, group_id: event.target.value }));
                      }}>
                      <option value="">Select group</option>
                      {applicableGroupOptions.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.title}
                        </option>
                      ))}
                    </Form.Select>
                  </>
                ) : null}
                {selectedCreateMenuType === "regular" ? (
                  <Row className="g-2 mb-2">
                    <Col>
                      <Form.Label className="small mb-1" htmlFor="admin-create-half-tray-price">
                        Half Tray Price
                      </Form.Label>
	                      <InputGroup hasValidation>
	                        <InputGroup.Text>$</InputGroup.Text>
	                        <Form.Control
                          id="admin-create-half-tray-price"
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          isInvalid={Boolean(createFieldErrors.tray_price_half)}
                          value={newItemForm.tray_price_half}
                          onChange={(event) => {
                            const hadFieldError = Boolean(createFieldErrors.tray_price_half);
                            setCreateFieldErrors((prev) => ({ ...prev, tray_price_half: "" }));
                            if (hadFieldError) {
                              setCreateValidationLocked(false);
                            }
                            setNewItemForm((prev) => ({
                              ...prev,
                              tray_price_half: formatCurrencyInputFromDigits(event.target.value),
                            }));
                          }}
                          onBlur={() =>
                            setNewItemForm((prev) => ({
                              ...prev,
                              tray_price_half: formatCurrencyToCents(prev.tray_price_half),
                            }))
                          }
                        />
                      </InputGroup>
                    </Col>
                    <Col>
                      <Form.Label className="small mb-1" htmlFor="admin-create-full-tray-price">
                        Full Tray Price
                      </Form.Label>
	                      <InputGroup hasValidation>
	                        <InputGroup.Text>$</InputGroup.Text>
	                        <Form.Control
                          id="admin-create-full-tray-price"
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          isInvalid={Boolean(createFieldErrors.tray_price_full)}
                          value={newItemForm.tray_price_full}
                          onChange={(event) => {
                            const hadFieldError = Boolean(createFieldErrors.tray_price_full);
                            setCreateFieldErrors((prev) => ({ ...prev, tray_price_full: "" }));
                            if (hadFieldError) {
                              setCreateValidationLocked(false);
                            }
                            setNewItemForm((prev) => ({
                              ...prev,
                              tray_price_full: formatCurrencyInputFromDigits(event.target.value),
                            }));
                          }}
                          onBlur={() =>
                            setNewItemForm((prev) => ({
                              ...prev,
                              tray_price_full: formatCurrencyToCents(prev.tray_price_full),
                            }))
                          }
                        />
                      </InputGroup>
                    </Col>
                  </Row>
                ) : null}
			                <div className="d-flex align-items-end mt-2">
			                  <Button
			                    className="btn-inquiry-action"
			                    variant="secondary"
			                    disabled={createValidationLocked}
			                    type="submit">
			                    Create Item
			                  </Button>
			                  {hasCreateFormChanges ? (
			                    <Button className="ms-auto" variant="outline-secondary" type="button" onClick={resetCreateItemForm}>
			                      Clear
			                    </Button>
			                  ) : null}
			                </div>
                  </Form>
	              </Card.Body>
		            </Card>

	            {shouldRenderEditCardAboveList ? editMenuItemCard : null}

	            <Accordion className="mb-3 admin-filter-accordion">
	              <Accordion.Item eventKey="0">
	                <Accordion.Header>Find Menu Items</Accordion.Header>
	                <Accordion.Body>
	                  <Form.Label className="small mb-1" htmlFor="admin-item-filter-search">
	                    Search
	                  </Form.Label>
	                  <Form.Control
	                    id="admin-item-filter-search"
	                    className="mb-2"
	                    placeholder="Search name or key"
	                    value={itemFilters.search}
	                    onChange={(event) => setItemFilters((prev) => ({ ...prev, search: event.target.value }))}
	                  />
	                  <Form.Label className="small mb-1" htmlFor="admin-item-filter-status">
	                    Item Status
	                  </Form.Label>
	                  <Form.Select
	                    id="admin-item-filter-status"
	                    className="mb-2"
	                    value={itemFilters.is_active}
	                    onChange={(event) => setItemFilters((prev) => ({ ...prev, is_active: event.target.value }))}>
	                    <option value="all">All status</option>
	                    <option value="true">Active</option>
	                    <option value="false">Inactive</option>
	                  </Form.Select>
	                  <Form.Label className="small mb-1" htmlFor="admin-item-filter-menu-type">
	                    Filter Menu Type
	                  </Form.Label>
	                  <Form.Select
	                    id="admin-item-filter-menu-type"
	                    className="mb-2"
	                    value={itemFilters.menu_type}
	                    onChange={(event) => setItemFilters((prev) => ({ ...prev, menu_type: event.target.value }))}>
	                    <option value="all">All menu types</option>
	                    {menuItemTypeFilterOptions.map((menuType) => (
	                      <option key={`item-filter-menu-type-${menuType}`} value={menuType}>
	                        {formatMenuTypeLabel(menuType)}
	                      </option>
	                    ))}
	                  </Form.Select>
	                  <Form.Label className="small mb-1" htmlFor="admin-item-filter-group">
	                    Filter Group
	                  </Form.Label>
	                  <Form.Select
	                    id="admin-item-filter-group"
	                    className="mb-2"
	                    value={itemFilters.group_name}
	                    onChange={(event) => setItemFilters((prev) => ({ ...prev, group_name: event.target.value }))}>
	                    <option value="all">All groups</option>
	                    {menuItemGroupFilterOptions.map((groupName) => (
	                      <option key={`item-filter-group-${groupName}`} value={groupName}>
	                        {groupName}
	                      </option>
	                    ))}
	                  </Form.Select>
	                  <Button
	                    className="mt-2 me-2"
	                    variant="outline-secondary"
	                    onClick={() =>
	                      setItemFilters({
	                        search: "",
	                        is_active: "all",
	                        menu_type: "all",
	                        group_name: "all",
	                      })
	                    }>
	                    Reset Filters
	                  </Button>
	                  <Button className="mt-2" variant="outline-secondary" onClick={loadMenuItems}>
	                    Refresh Items
	                  </Button>
	                </Accordion.Body>
	              </Accordion.Item>
	            </Accordion>

          </Col>
	          <Col lg={8}>
	            <Card className="mb-3">
	              <Card.Body className="admin-scroll-card p-0">
		                <Table hover size="sm" className="admin-sticky-table admin-menu-items-table mb-0">
	                  <thead>
	                    <tr>
	                      <th>Item</th>
	                      <th>Active</th>
	                      <th>Menu(s)</th>
	                      <th>Group(s)</th>
	                      <th className="admin-tray-prices-col">Tray Prices</th>
	                    </tr>
	                  </thead>
	                  <tbody>
	                    {menuTableError ? (
	                      <tr>
	                        <td colSpan={5} className="text-center text-danger py-3">
	                          {menuTableError}
	                        </td>
	                      </tr>
	                    ) : filteredMenuItemRows.length ? (
		                      filteredMenuItemRows.map((item) => {
                          const itemId = toId(item?.id);
                          const isSelectedMenuRow = itemId ? Number(selectedItemId) === Number(itemId) : false;
                          const toggleBusyKey = itemId ? `menu:${itemId}` : "";
                          const isStatusBusy = toggleBusyKey ? Boolean(statusToggleBusy[toggleBusyKey]) : false;
                          return (
                          <tr
		                          key={item.row_key}
                              className={isSelectedMenuRow ? "admin-table-row-selected" : ""}
	                          role={item.id ? "button" : undefined}
	                          onClick={async () => {
		                            if (!item.id) return;
	                            setShowCreatedItemHighlight(false);
                            setEditCardPlacement("below_table");
                            setShouldScrollToEditCard(true);
                            setSelectedItemId(item.id);
                            await loadItemDetail(item.id);
                          }}>
	                          <td className="align-middle">
	                            {item.item_name || "Untitled Item"}
	                          </td>
	                          <td className="text-center align-middle">
	                            {itemId ? (
                                <button
                                  type="button"
                                  className="admin-status-toggle"
                                  disabled={isStatusBusy}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void toggleMenuItemStatusFromTable(item);
                                  }}
                                  aria-label={item.is_active ? "Set inactive" : "Set active"}
                                  title={item.is_active ? "Set inactive" : "Set active"}
                                >
                                  <span
                                    className={`admin-status-dot ${item.is_active ? "admin-status-dot-active" : "admin-status-dot-inactive"}`}
                                    role="img"
                                    aria-label={item.is_active ? "Active" : "Inactive"}
                                  />
                                </button>
	                            ) : (
	                              <span>-</span>
	                            )}
	                          </td>
	                          <td>
	                            {item.menu_types.length ? (
	                              item.menu_types.map((menuType, menuTypeIndex) => (
	                                <div key={`${item.row_key}-menu-type-${menuTypeIndex}`} className="admin-table-stack-line">
	                                  {menuType === "formal" ? (
	                                    <Badge bg="warning" text="dark">
	                                      {formatMenuTypeLabel(menuType)}
	                                    </Badge>
	                                  ) : (
	                                    <Badge bg="info" text="dark">
	                                      {formatMenuTypeLabel(menuType)}
	                                    </Badge>
	                                  )}
	                                </div>
	                              ))
	                            ) : (
	                              <Badge bg="secondary">None</Badge>
	                            )}
	                          </td>
	                          <td>
	                            {item.group_names.length ? (
	                              item.group_names.map((groupName, groupIndex) => (
	                                <div key={`${item.row_key}-group-${groupIndex}`} className="admin-group-line admin-table-stack-line">
	                                  {groupName}
	                                </div>
	                              ))
	                            ) : (
	                              <span>-</span>
	                            )}
	                          </td>
	                          <td className="admin-tray-prices-cell">
	                            {item.tray_price_half ? (
	                              <div className="admin-table-stack-line">
	                                <span className="admin-price-label">H:</span> ${item.tray_price_half}
	                              </div>
	                            ) : null}
	                            {item.tray_price_full ? (
	                              <div className="admin-table-stack-line">
	                                <span className="admin-price-label">F:</span> ${item.tray_price_full}
	                              </div>
	                            ) : null}
	                          </td>
	                        </tr>
	                        );
                        })
	                    ) : (
	                      <tr>
	                        <td colSpan={5} className="text-center text-secondary py-3">
	                          No menu items match the current filters.
	                        </td>
	                      </tr>
	                    )}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>

	            {shouldRenderEditCardBelowTable ? editMenuItemCard : null}

          </Col>
        </Row>
      ) : null}

	      {activeTab === TAB_MEDIA ? (
	        <Row className="g-3">
	          <Col lg={4}>
	            <Card className="mb-3">
	              <Card.Body>
                  <Form onSubmit={handleMediaUploadSubmit}>
	                <h3 className="h6">Upload Media</h3>
		                <Form.Control
	                  className="mb-2"
	                  type="file"
	                  accept="image/*,video/*"
                    isInvalid={Boolean(uploadFieldErrors.file)}
	                  ref={uploadFileInputRef}
	                  onChange={(event) => {
                      const hadFieldError = Boolean(uploadFieldErrors.file);
                      setUploadForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }));
                      if (hadFieldError) {
                        setUploadFieldErrors((prev) => ({ ...prev, file: "" }));
                        setUploadValidationLocked(false);
                      }
                    }}
	                />
                <Form.Control
                  className="mb-2"
                  placeholder="Title"
                  isInvalid={Boolean(uploadFieldErrors.title)}
                  value={uploadForm.title}
                  onChange={(event) => {
                    const hadFieldError = Boolean(uploadFieldErrors.title);
                    setUploadForm((prev) => ({ ...prev, title: event.target.value }));
                    if (hadFieldError) {
                      setUploadFieldErrors((prev) => ({ ...prev, title: "" }));
                      setUploadValidationLocked(false);
                    }
                  }}
                />
                <Form.Control
                  className="mb-2"
                  placeholder="Caption"
                  isInvalid={Boolean(uploadFieldErrors.caption)}
                  value={uploadForm.caption}
                  onChange={(event) => {
                    const hadFieldError = Boolean(uploadFieldErrors.caption);
                    setUploadForm((prev) => ({ ...prev, caption: event.target.value }));
                    if (hadFieldError) {
                      setUploadFieldErrors((prev) => ({ ...prev, caption: "" }));
                      setUploadValidationLocked(false);
                    }
                  }}
                />
	                <Form.Check
	                  className="mb-2"
	                  type="switch"
	                  label="Homepage Slide"
	                  checked={uploadForm.is_slide}
	                  onChange={(event) => setUploadForm((prev) => ({ ...prev, is_slide: event.target.checked }))}
	                />
                <Form.Check
                  className="mb-2"
                  type="switch"
                  label="Active"
                  checked={uploadForm.is_active}
                  onChange={(event) => setUploadForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                />
		                <div className="d-flex align-items-end mt-2">
		                  <Button
		                    className="btn-inquiry-action"
		                    variant="secondary"
                      disabled={uploadValidationLocked}
                        type="submit">
		                    Upload
		                  </Button>
		                  {hasUploadFormChanges ? (
		                    <Button className="ms-auto" variant="outline-secondary" type="button" onClick={resetUploadMediaForm}>
		                      Clear
		                    </Button>
		                  ) : null}
		                </div>
                  </Form>
	              </Card.Body>
	            </Card>

              {shouldRenderMediaEditCardAboveList ? editMediaCard : null}
	            <Accordion className="mb-3 admin-filter-accordion">
	              <Accordion.Item eventKey="0">
	                <Accordion.Header>Find Media</Accordion.Header>
	                <Accordion.Body>
	                  <Form.Control
	                    className="mb-2"
	                    placeholder="Search media"
	                    value={mediaFilters.search}
	                    onChange={(event) => setMediaFilters((prev) => ({ ...prev, search: event.target.value }))}
	                  />
	                  <Form.Select
	                    className="mb-2"
	                    value={mediaFilters.media_type}
	                    onChange={(event) => setMediaFilters((prev) => ({ ...prev, media_type: event.target.value }))}>
	                    <option value="">All media types</option>
	                    <option value="image">Image</option>
	                    <option value="video">Video</option>
	                  </Form.Select>
	                  <Form.Select
	                    className="mb-2"
	                    value={mediaFilters.is_active}
	                    onChange={(event) => setMediaFilters((prev) => ({ ...prev, is_active: event.target.value }))}>
	                    <option value="all">All status</option>
	                    <option value="true">Active</option>
	                    <option value="false">Inactive</option>
	                  </Form.Select>
	                  <Form.Select
	                    value={mediaFilters.is_slide}
	                    onChange={(event) => setMediaFilters((prev) => ({ ...prev, is_slide: event.target.value }))}>
	                    <option value="all">All slide flags</option>
	                    <option value="true">Homepage Slide</option>
	                    <option value="false">Gallery Only</option>
	                  </Form.Select>
	                  <Button className="mt-2" variant="outline-secondary" onClick={loadMedia}>
	                    Apply
	                  </Button>
	                </Accordion.Body>
	              </Accordion.Item>
	            </Accordion>
          </Col>
	          <Col lg={8}>
	            <Card className="mb-3">
	              <Card.Body className="admin-scroll-card p-0">
	                <Table hover size="sm" className="admin-sticky-table mb-0">
	                  <thead>
	                    <tr>
	                      <th className="admin-media-type-col">
	                        <span className="visually-hidden">Type</span>
	                      </th>
	                      <th className="admin-media-thumb-col">
	                        <span className="visually-hidden">Preview</span>
	                      </th>
	                      <th>Title</th>
	                      <th className="text-center">Active</th>
	                      <th>Order</th>
	                    </tr>
	                  </thead>
	                  <tbody>
	                    {mediaTableError ? (
	                      <tr>
	                        <td colSpan={5} className="text-center text-danger py-3">
	                          {mediaTableError}
	                        </td>
	                      </tr>
			                    ) : mediaItems.length ? (
			                      mediaItems.map((item, index) => {
			                        const sourceFilename = formatMediaSourceFilename(item.src);
                            const mediaId = toId(item?.id);
                            const toggleBusyKey = mediaId ? `media:${mediaId}` : "";
                            const isStatusBusy = toggleBusyKey ? Boolean(statusToggleBusy[toggleBusyKey]) : false;
                            const isSlideRow = Boolean(item?.is_slide);
                            const startsGallerySection =
                              index > 0 && Boolean(mediaItems[index - 1]?.is_slide) && !isSlideRow;
                            const isDraggingSameGroup = draggingMediaIsSlide === null || Boolean(draggingMediaIsSlide) === isSlideRow;
                            const canReorderItem = !mediaOrderSaving;
                            const isDropTarget =
                              canReorderItem &&
                              draggingMediaId &&
                              isDraggingSameGroup &&
                              Number(draggingMediaId) !== Number(mediaId) &&
                              Number(dragOverMediaId) === Number(mediaId);
                            const isBeingDragged = Number(draggingMediaId) === Number(mediaId);
                            const isSelectedMediaRow = mediaId ? Number(selectedMediaId) === Number(mediaId) : false;
			                        return (
                              <Fragment key={`media-row-${item.id}`}>
                                {startsGallerySection ? (
                                  <tr className="admin-media-section-break">
                                    <td colSpan={5}>Gallery Items</td>
                                  </tr>
                                ) : null}
			                          <tr
			                          key={item.id}
	                                className={`${canReorderItem ? "admin-media-row-draggable" : ""} ${
                                  isDropTarget ? "admin-media-row-drop-target" : ""
                                } ${isBeingDragged ? "admin-media-row-dragging" : ""} ${
                                  isSlideRow ? "admin-media-row-slide" : "admin-media-row-gallery"
                                } ${isSelectedMediaRow ? "admin-table-row-selected" : ""}`.trim()}
	                                draggable={canReorderItem}
	                                onDragStart={(event) => {
	                                  if (!canReorderItem) return;
	                                  setDraggingMediaId(mediaId);
	                                  setDraggingMediaIsSlide(isSlideRow);
                                  event.dataTransfer.effectAllowed = "move";
                                  try {
                                    event.dataTransfer.setData("text/plain", String(mediaId));
                                  } catch {
                                    // Some browsers restrict dataTransfer in tests.
                                  }
                                }}
                                onDragOver={(event) => {
                                  if (!canReorderItem || !draggingMediaId || !isDraggingSameGroup) return;
                                  if (Number(draggingMediaId) === Number(mediaId)) return;
                                  event.preventDefault();
                                  setDragOverMediaId(mediaId);
                                }}
                                onDragLeave={() => {
                                  if (Number(dragOverMediaId) === Number(mediaId)) {
                                    setDragOverMediaId(null);
                                  }
                                }}
                                onDrop={(event) => {
                                  if (!canReorderItem || !draggingMediaId || !isDraggingSameGroup) return;
                                  if (Number(draggingMediaId) === Number(mediaId)) return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void reorderMediaItemsFromTable(draggingMediaId, mediaId, isSlideRow);
                                }}
                                onDragEnd={() => {
                                  setDraggingMediaId(null);
                                  setDraggingMediaIsSlide(null);
                                  setDragOverMediaId(null);
                                }}
				                          role="button"
				                          onClick={() => {
                                  setShowCreatedMediaHighlight(false);
                                  setMediaEditCardPlacement("below_table");
                                  setShouldScrollToMediaEditCard(true);
				                            setSelectedMediaId(item.id);
			                            const nextForm = buildMediaForm(item);
			                            setMediaForm(nextForm);
			                            setMediaFormOriginal(nextForm);
			                          }}>
	                          <td className="admin-media-type-cell">{renderMediaTypeIcon(item.media_type)}</td>
	                          <td className="admin-media-thumb-cell">
	                            {normalizeFilterText(item.media_type) === "video" ? (
	                              <video
	                                className="admin-media-thumb"
	                                muted
	                                playsInline
	                                preload="metadata"
	                                aria-label={String(item.title || "Video preview")}
	                              >
	                                <source src={item.src} />
	                              </video>
	                            ) : (
	                              <img
	                                className="admin-media-thumb"
	                                src={item.thumbnail_src || item.src}
	                                alt={String(item.alt_text || item.alt || item.title || "Image preview")}
	                                loading="lazy"
	                              />
	                            )}
	                          </td>
	                          <td>
                              <div className="d-flex align-items-center gap-2">
                                <span
                                  className={`admin-media-kind-chip ${
                                    isSlideRow ? "admin-media-kind-slide" : "admin-media-kind-gallery"
                                  }`}>
                                  {isSlideRow ? "Landing" : "Gallery"}
                                </span>
	                            <span>{item.title || "Untitled"}</span>
                              </div>
	                            {sourceFilename ? (
	                              <div className="small text-secondary">{sourceFilename}</div>
	                            ) : null}
	                          </td>
	                          <td className="text-center align-middle">
	                            <div className="admin-status-line">
                                <button
                                  type="button"
                                  className="admin-status-toggle"
                                  disabled={isStatusBusy}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void toggleMediaStatusFromTable(item);
                                  }}
                                  aria-label={item.is_active ? "Set inactive" : "Set active"}
                                  title={item.is_active ? "Set inactive" : "Set active"}
                                >
                                  <span
                                    className={`admin-status-dot ${item.is_active ? "admin-status-dot-active" : "admin-status-dot-inactive"}`}
                                    role="img"
                                    aria-label={item.is_active ? "Active" : "Inactive"}
	                                  />
	                                </button>
		                            </div>
	                          </td>
			                          <td className="admin-media-order-cell">
                                {Number.isFinite(Number(item.display_order)) ? (
	                                  <span
	                                    className="admin-media-order-chip"
	                                    title={item.is_slide ? "Drag to reorder slides" : "Drag to reorder gallery items"}
                                  >
                                    {item.display_order}
                                  </span>
	                                ) : null}
	                              </td>
			                        </tr>
                              </Fragment>
			                        );
			                      })
		                    ) : (
		                      <tr>
		                        <td colSpan={5} className="text-center text-secondary py-3">
		                          No media items match the current filters.
		                        </td>
		                      </tr>
		                    )}
	                  </tbody>
                </Table>
              </Card.Body>
            </Card>
            {shouldRenderMediaEditCardBelowTable ? editMediaCard : null}
          </Col>
        </Row>
      ) : null}

      {activeTab === TAB_AUDIT ? (
        <Card>
          <Card.Body className="admin-scroll-card">
            <Table striped responsive size="sm">
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {auditEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.created_at ? new Date(entry.created_at).toLocaleString() : "-"}</td>
                    <td>{entry.admin_display_name || entry.admin_username}</td>
                    <td>{entry.action}</td>
                    <td>
                      {entry.entity_type} #{entry.entity_id || "-"}
                    </td>
                    <td>{entry.change_summary || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      ) : null}

      <ConfirmActionModal
        show={confirmState.show}
        title={confirmState.title}
        body={confirmState.body}
        confirmLabel={confirmState.confirmLabel}
        confirmVariant={confirmState.confirmVariant}
        validationMessage={confirmState.validationMessage}
        confirmDisabled={
          (confirmState.errorTarget === FORM_ERROR_CREATE_ITEM && createValidationLocked) ||
          (confirmState.errorTarget === FORM_ERROR_UPLOAD_MEDIA && uploadValidationLocked)
        }
        darkMode={isDarkMode}
        busy={confirmBusy}
        onCancel={() =>
          setConfirmState((prev) => ({
            ...prev,
            show: false,
            confirmVariant: "secondary",
            validationMessage: "",
            action: null,
            errorTarget: null,
          }))
        }
        onConfirm={runConfirmedAction}
      />
    </main>
  );
};

export default AdminDashboard;
