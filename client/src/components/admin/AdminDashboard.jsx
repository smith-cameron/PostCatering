import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Accordion, Alert, Badge, Button, Card, Col, Form, InputGroup, Nav, Row, Spinner, Table } from "react-bootstrap";
import { Navigate, useNavigate } from "react-router-dom";
import ConfirmActionModal from "./ConfirmActionModal";
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
const INITIAL_NEW_ITEM_FORM = {
  item_name: "",
  is_active: true,
  menu_type: "",
  group_id: "",
  tray_price_half: "",
  tray_price_full: "",
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
  alt_text: item?.alt_text ?? "",
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
  const [uploadForm, setUploadForm] = useState({ title: "", caption: "", alt_text: "", is_slide: false, is_active: true, display_order: "", file: null });
  const [hasLoadedMediaTab, setHasLoadedMediaTab] = useState(false);
  const [hasLoadedAuditTab, setHasLoadedAuditTab] = useState(false);

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
    return window.localStorage.getItem("admin_dashboard_theme") === "dark";
  });
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= MOBILE_LAYOUT_MAX_WIDTH : false
  );
  const editCardRef = useRef(null);

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

    return (
      <div>
        <p className="mb-2">Create this menu item with the following details?</p>
        <div className="admin-confirm-review">
          <div>
            <strong>Item Name:</strong> {itemName || "-"}
          </div>
          <div>
            <strong>Active:</strong> {hasMenuType ? (newItemForm.is_active ? "Yes" : "No") : "No (auto-inactive until assigned)"}
          </div>
          <div>
            <strong>Menu Type:</strong> {hasMenuType ? formatMenuTypeLabel(menuType) : "None"}
          </div>
          <div>
            <strong>Group:</strong> {hasMenuType ? selectedGroup?.title || "None selected" : "None"}
          </div>
          <div>
            <strong>Half Tray Price:</strong> {isRegular ? halfPrice : "N/A"}
          </div>
          <div>
            <strong>Full Tray Price:</strong> {isRegular ? fullPrice : "N/A"}
          </div>
        </div>
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
    const currentActive = currentTypes.length ? (itemForm.is_active ? "Yes" : "No") : "No";
    const originalActive = originalTypes.length ? (itemFormOriginal.is_active ? "Yes" : "No") : "No";
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

    return (
      <div className="admin-confirm-review">
        {changes.length ? (
          changes.map((change) => (
            <div key={change.label}>
              <strong>{change.label}:</strong> {change.value}
            </div>
          ))
        ) : (
          <div>No field changes detected.</div>
        )}
      </div>
    );
  }, [itemForm, itemFormOriginal, getGroupOptionsForType]);

  const buildUpdateConfirmTitle = useCallback(() => {
    const itemName = String(itemForm?.item_name || "").trim();
    return itemName ? `Update ${itemName}?` : "Update item?";
  }, [itemForm?.item_name]);

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
    setFormErrors((prev) => ({ ...prev, [FORM_ERROR_UPLOAD_MEDIA]: "" }));
    if (!uploadForm.file) throw new Error("Choose a file before uploading.");
    const formData = new FormData();
    formData.set("file", uploadForm.file);
    formData.set("title", uploadForm.title);
    formData.set("caption", uploadForm.caption);
    formData.set("alt_text", uploadForm.alt_text);
    formData.set("is_slide", String(uploadForm.is_slide));
    formData.set("is_active", String(uploadForm.is_active));
    if (String(uploadForm.display_order || "").trim()) {
      formData.set("display_order", String(uploadForm.display_order).trim());
    }
    const payload = await requestWithFormData("/api/admin/media/upload", formData);
    setUploadForm({ title: "", caption: "", alt_text: "", is_slide: false, is_active: true, display_order: "", file: null });
    await Promise.all([loadMedia(), loadAudit()]);
  };

  const saveMedia = async () => {
    if (!mediaForm?.id) return;
    setFormErrors((prev) => ({ ...prev, [FORM_ERROR_EDIT_MEDIA]: "" }));
    const payload = await requestJson(`/api/admin/media/${mediaForm.id}`, {
      method: "PATCH",
      body: JSON.stringify(mediaForm),
    });
    setMediaForm(buildMediaForm(payload.media));
    await Promise.all([loadMedia(), loadAudit()]);
  };

  const logout = async () => {
    await requestJson("/api/admin/auth/logout", { method: "POST" });
    navigate("/admin/login", { replace: true });
  };

  const shouldRenderEditCardAboveList = Boolean(
    selectedItemId && itemForm && isMobileLayout && editCardPlacement === "above_list"
  );
  const shouldRenderEditCardBelowTable = Boolean(selectedItemId && itemForm && !shouldRenderEditCardAboveList);
  const editMenuItemCard = selectedItemId && itemForm ? (
    <div ref={editCardRef}>
      <Card
        data-testid="edit-menu-item-card"
        className={`mb-3 ${showCreatedItemHighlight ? "admin-edit-card-created" : ""}`}>
        <Card.Body>
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
                <InputGroup>
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
                <InputGroup>
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
              onClick={() =>
                queueConfirm(buildUpdateConfirmTitle(), buildUpdateConfirmBody(), "Update", saveItem, FORM_ERROR_EDIT_ITEM)
              }>
              Update Item
            </Button>
            <Button
              className="ms-auto"
              variant="danger"
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
    <main className={`container-fluid py-4 admin-dashboard ${isDarkMode ? "admin-dashboard-dark" : ""}`}>
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
                <h3 className="h6">Create Menu Item</h3>
                <Form.Check
                  className="mb-2"
                  type="switch"
                  label="Active"
                  checked={newItemForm.is_active}
                  onChange={(event) => setNewItemForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                />
                <Form.Label className="small mb-1" htmlFor="admin-create-item-name">
                  Item Name
                </Form.Label>
                <Form.Control
                  id="admin-create-item-name"
                  className="mb-2"
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
                <Form.Label className="small mb-1" htmlFor="admin-create-menu-type">
                  Menu Type
                </Form.Label>
                <Form.Select
                  id="admin-create-menu-type"
                  className="mb-2"
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
                    <Form.Label className="small mb-1" htmlFor="admin-create-group">
                      Group
                    </Form.Label>
                    <Form.Select
                      id="admin-create-group"
                      className="mb-2"
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
                      <InputGroup>
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
                      <InputGroup>
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
	                <div className="d-flex justify-content-between align-items-end mt-2">
	                  <Button
	                    className="btn-inquiry-action"
	                    variant="secondary"
	                    disabled={createValidationLocked}
	                    onClick={() =>
	                      queueConfirm("Create menu item", buildCreateConfirmBody(), "Create", createItem, FORM_ERROR_CREATE_ITEM)
	                    }>
	                    Create Item
	                  </Button>
	                  <Button variant="outline-secondary" onClick={resetCreateItemForm}>
	                    Clear
	                  </Button>
	                </div>
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
              <Card.Header className="admin-card-header">Menu Items</Card.Header>
              <Card.Body className="admin-scroll-card p-0">
                <Table hover size="sm" className="admin-sticky-table mb-0">
	                  <thead>
	                    <tr>
	                      <th>Item</th>
	                      <th>Active</th>
	                      <th>Menu Type</th>
	                      <th>Group</th>
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
	                      filteredMenuItemRows.map((item) => (
	                        <tr
	                          key={item.row_key}
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
	                            {item.active_statuses.length ? (
	                              item.active_statuses.map((status, statusIndex) => (
	                                <div key={`${item.row_key}-active-status-${statusIndex}`} className="admin-table-stack-line admin-status-line">
	                                  <span
	                                    className={`admin-status-dot ${status ? "admin-status-dot-active" : "admin-status-dot-inactive"}`}
	                                    role="img"
	                                    aria-label={status ? "Active" : "Inactive"}
	                                    title={status ? "Active" : "Inactive"}
	                                  />
	                                </div>
	                              ))
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
	                      ))
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
                <h3 className="h6">Upload Media</h3>
                {formErrors[FORM_ERROR_UPLOAD_MEDIA] ? <Alert variant="danger">{formErrors[FORM_ERROR_UPLOAD_MEDIA]}</Alert> : null}
                <Form.Control
                  className="mb-2"
                  type="file"
                  accept="image/*,video/*"
                  onChange={(event) => setUploadForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }))}
                />
                <Form.Control
                  className="mb-2"
                  placeholder="Title"
                  value={uploadForm.title}
                  onChange={(event) => setUploadForm((prev) => ({ ...prev, title: event.target.value }))}
                />
                <Form.Control
                  className="mb-2"
                  placeholder="Caption"
                  value={uploadForm.caption}
                  onChange={(event) => setUploadForm((prev) => ({ ...prev, caption: event.target.value }))}
                />
                <Form.Control
                  className="mb-2"
                  placeholder="Alt text"
                  value={uploadForm.alt_text}
                  onChange={(event) => setUploadForm((prev) => ({ ...prev, alt_text: event.target.value }))}
                />
                <Form.Control
                  className="mb-2"
                  placeholder="Display order (optional)"
                  value={uploadForm.display_order}
                  onChange={(event) => setUploadForm((prev) => ({ ...prev, display_order: event.target.value }))}
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
                <Button
                  className="btn-inquiry-action"
                  variant="secondary"
                  onClick={() => queueConfirm("Upload media", "Upload this file?", "Upload", uploadMedia, FORM_ERROR_UPLOAD_MEDIA)}>
                  Upload
                </Button>
              </Card.Body>
            </Card>
            <Card>
              <Card.Body>
                <h3 className="h6">Find Media</h3>
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
              </Card.Body>
            </Card>
          </Col>
          <Col lg={8}>
            <Card className="mb-3">
              <Card.Body className="admin-scroll-card">
                <Table hover responsive size="sm">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Type</th>
                      <th>Flags</th>
                      <th>Order</th>
                    </tr>
                  </thead>
	                  <tbody>
	                    {mediaTableError ? (
	                      <tr>
	                        <td colSpan={4} className="text-center text-danger py-3">
	                          {mediaTableError}
	                        </td>
	                      </tr>
	                    ) : mediaItems.length ? (
	                      mediaItems.map((item) => (
	                        <tr
	                          key={item.id}
	                          role="button"
	                          onClick={() => {
	                            setSelectedMediaId(item.id);
	                            setMediaForm(buildMediaForm(item));
	                          }}>
	                          <td>
	                            {item.title || "Untitled"}
	                            <div className="small text-secondary">{item.src}</div>
	                          </td>
	                          <td>{item.media_type}</td>
	                          <td>
	                            {item.is_slide ? (
	                              <Badge bg="info" text="dark" className="me-1">
	                                Homepage Slide
	                              </Badge>
	                            ) : null}
	                            {item.is_active ? <Badge bg="success">Active</Badge> : <Badge bg="secondary">Inactive</Badge>}
	                          </td>
	                          <td>{item.display_order}</td>
	                        </tr>
	                      ))
	                    ) : (
	                      <tr>
	                        <td colSpan={4} className="text-center text-secondary py-3">
	                          No media items match the current filters.
	                        </td>
	                      </tr>
	                    )}
	                  </tbody>
                </Table>
              </Card.Body>
            </Card>
            {selectedMediaId && mediaForm ? (
              <Card>
                <Card.Body>
                  <h3 className="h6">Edit Media</h3>
                  {formErrors[FORM_ERROR_EDIT_MEDIA] ? <Alert variant="danger">{formErrors[FORM_ERROR_EDIT_MEDIA]}</Alert> : null}
                  <Form.Control
                    className="mb-2"
                    value={mediaForm.title}
                    onChange={(event) => setMediaForm((prev) => ({ ...prev, title: event.target.value }))}
                  />
                  <Form.Control
                    className="mb-2"
                    value={mediaForm.caption}
                    onChange={(event) => setMediaForm((prev) => ({ ...prev, caption: event.target.value }))}
                  />
                  <Form.Control
                    className="mb-2"
                    value={mediaForm.alt_text}
                    onChange={(event) => setMediaForm((prev) => ({ ...prev, alt_text: event.target.value }))}
                  />
                  <Form.Control
                    className="mb-2"
                    type="number"
                    min={1}
                    value={mediaForm.display_order}
                    onChange={(event) => setMediaForm((prev) => ({ ...prev, display_order: Number(event.target.value) || 1 }))}
                  />
                  <Form.Check
                    className="mb-2"
                    type="switch"
                    label="Homepage Slide"
                    checked={mediaForm.is_slide}
                    onChange={(event) => setMediaForm((prev) => ({ ...prev, is_slide: event.target.checked }))}
                  />
                  <Form.Check
                    className="mb-2"
                    type="switch"
                    label="Active"
                    checked={mediaForm.is_active}
                    onChange={(event) => setMediaForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                  />
                  <Button
                    className="btn-inquiry-action mt-2"
                    variant="secondary"
                    onClick={() => queueConfirm("Save media", "Apply media metadata and order changes?", "Save", saveMedia, FORM_ERROR_EDIT_MEDIA)}>
                    Save Media
                  </Button>
                </Card.Body>
              </Card>
            ) : null}
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
        confirmDisabled={confirmState.errorTarget === FORM_ERROR_CREATE_ITEM && createValidationLocked}
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
