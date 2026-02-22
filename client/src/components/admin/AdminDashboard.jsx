import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Nav, Row, Spinner, Table } from "react-bootstrap";
import { Navigate, useNavigate } from "react-router-dom";
import ConfirmActionModal from "./ConfirmActionModal";
import { requestJson, requestWithFormData } from "./adminApi";

const TAB_MENU = "menu";
const TAB_MEDIA = "media";
const TAB_AUDIT = "audit";
const FORMAL_ID_OFFSET = 1000000;
const FORM_ERROR_CREATE_ITEM = "create_item";
const FORM_ERROR_EDIT_ITEM = "edit_item";
const FORM_ERROR_UPLOAD_MEDIA = "upload_media";
const FORM_ERROR_EDIT_MEDIA = "edit_media";
const EMPTY_FORM_ERRORS = {
  [FORM_ERROR_CREATE_ITEM]: "",
  [FORM_ERROR_EDIT_ITEM]: "",
  [FORM_ERROR_UPLOAD_MEDIA]: "",
  [FORM_ERROR_EDIT_MEDIA]: "",
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

const buildItemForm = (item) => ({
  id: item?.id ?? null,
  menu_type: String(item?.menu_type || "").toLowerCase(),
  item_name: item?.item_name ?? "",
  item_key: item?.item_key ?? "",
  is_active: Boolean(item?.is_active),
  option_group_assignments: withDisplayOrder(
    (item?.option_group_assignments || []).map((row) => ({
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
});

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

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [adminUser, setAdminUser] = useState(null);

  const [activeTab, setActiveTab] = useState(TAB_MENU);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [formErrors, setFormErrors] = useState(EMPTY_FORM_ERRORS);
  const [busy, setBusy] = useState(false);

  const [referenceData, setReferenceData] = useState({ catalogs: [], option_groups: [], sections: [], tiers: [] });
  const [itemFilters, setItemFilters] = useState({ search: "", is_active: "all" });
  const [menuItems, setMenuItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [itemForm, setItemForm] = useState(null);
  const [newItemForm, setNewItemForm] = useState({
    item_name: "",
    is_active: true,
    menu_type: "",
    group_id: "",
    tray_price_half: "",
    tray_price_full: "",
  });

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
    action: null,
    errorTarget: null,
  });
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("admin_dashboard_theme") === "dark";
  });

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
  const selectedEditMenuType = String(itemForm?.menu_type || "").toLowerCase();
  const applicableEditGroupOptions = useMemo(() => {
    if (!selectedEditMenuType) return activeGroupOptions;
    const formalGroups = activeGroupOptions.filter((group) => isFormalGroup(group));
    if (selectedEditMenuType === "formal") {
      return formalGroups.length ? formalGroups : activeGroupOptions;
    }
    const regularGroups = activeGroupOptions.filter((group) => !isFormalGroup(group));
    return regularGroups.length ? regularGroups : activeGroupOptions;
  }, [activeGroupOptions, selectedEditMenuType]);

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
    const params = new URLSearchParams();
    if (itemFilters.search.trim()) params.set("search", itemFilters.search.trim());
    if (itemFilters.is_active !== "all") params.set("is_active", itemFilters.is_active);
    params.set("limit", "500");
    const payload = await requestJson(`/api/admin/menu/catalog-items?${params.toString()}`);
    setMenuItems(payload.items || []);
  }, [itemFilters]);

  const loadMedia = useCallback(async () => {
    const params = new URLSearchParams();
    if (mediaFilters.search.trim()) params.set("search", mediaFilters.search.trim());
    if (mediaFilters.media_type) params.set("media_type", mediaFilters.media_type);
    if (mediaFilters.is_active !== "all") params.set("is_active", mediaFilters.is_active);
    if (mediaFilters.is_slide !== "all") params.set("is_slide", mediaFilters.is_slide);
    params.set("limit", "800");
    const payload = await requestJson(`/api/admin/media?${params.toString()}`);
    setMediaItems(payload.media || []);
  }, [mediaFilters]);

  const loadAudit = useCallback(async () => {
    const payload = await requestJson("/api/admin/audit?limit=200");
    setAuditEntries(payload.entries || []);
  }, []);

  const loadItemDetail = useCallback(async (itemId) => {
    const payload = await requestJson(`/api/admin/menu/items/${itemId}`);
    setItemForm(buildItemForm(payload.item));
  }, []);

  const validateCreateItemForm = useCallback(() => {
    const itemName = String(newItemForm.item_name || "").trim();
    if (!itemName) {
      setFormErrors((prev) => ({ ...prev, [FORM_ERROR_CREATE_ITEM]: "Item name is required." }));
      return false;
    }
    return true;
  }, [newItemForm.item_name]);

  const hasMenuItemNameConflict = useCallback(
    (itemName, menuType, excludeId = null) => {
      const normalizedName = normalizeMenuItemName(itemName);
      const normalizedType = String(menuType || "").trim().toLowerCase();
      if (!normalizedName || !normalizedType) return false;
      return menuItems.some((item) => {
        if (excludeId !== null && Number(item?.id) === Number(excludeId)) return false;
        const currentType = String(item?.menu_type || "").trim().toLowerCase();
        const currentName = normalizeMenuItemName(item?.item_name);
        return currentType === normalizedType && currentName === normalizedName;
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
        setErrorMessage(error.message || "Failed to load admin data.");
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
          setErrorMessage(error.message || "Failed to load admin data.");
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

  const refreshActiveTab = useCallback(async () => {
    try {
      setBusy(true);
      if (activeTab === TAB_MENU) {
        await Promise.all([loadReferenceData(), loadMenuItems()]);
      } else if (activeTab === TAB_MEDIA) {
        await loadMedia();
      } else {
        await loadAudit();
      }
    } catch (error) {
      setErrorMessage(error.message || "Refresh failed.");
    } finally {
      setBusy(false);
    }
  }, [activeTab, loadReferenceData, loadMenuItems, loadMedia, loadAudit]);

  const queueConfirm = (title, body, confirmLabel, action, errorTarget = null) => {
    if (errorTarget) {
      setFormErrors((prev) => ({ ...prev, [errorTarget]: "" }));
    }
    setErrorMessage("");
    setConfirmState({ show: true, title, body, confirmLabel, action, errorTarget });
  };

  const runConfirmedAction = async () => {
    if (!confirmState.action) return;
    setConfirmBusy(true);
    try {
      await confirmState.action();
      setConfirmState({ show: false, title: "", body: "", confirmLabel: "Confirm", action: null, errorTarget: null });
    } catch (error) {
      const message = error.message || "Unable to apply change.";
      if (confirmState.errorTarget) {
        setFormErrors((prev) => ({ ...prev, [confirmState.errorTarget]: message }));
      } else {
        setErrorMessage(message);
      }
    } finally {
      setConfirmBusy(false);
    }
  };

  const createItem = async () => {
    setFormErrors((prev) => ({ ...prev, [FORM_ERROR_CREATE_ITEM]: "" }));
    const itemName = String(newItemForm.item_name || "").trim();
    if (!itemName) throw new Error("Item name is required.");
    const menuType = String(newItemForm.menu_type || "").toLowerCase();
    if (!["regular", "formal"].includes(menuType)) throw new Error("Please select a menu type.");
    if (hasMenuItemNameConflict(itemName, menuType)) {
      throw new Error("Item name must be unique within this menu type.");
    }

    const groupId = Number(newItemForm.group_id);
    if (!Number.isFinite(groupId) || groupId <= 0) throw new Error("Please select a group.");
    if (!applicableGroupOptions.some((group) => Number(group.id) === groupId)) {
      throw new Error("Please select a group for the chosen menu type.");
    }

    const isRegular = menuType === "regular";
    const trayHalfRaw = String(newItemForm.tray_price_half || "").trim();
    const trayFullRaw = String(newItemForm.tray_price_full || "").trim();
    const trayHalf = Number.parseFloat(trayHalfRaw);
    const trayFull = Number.parseFloat(trayFullRaw);
    if (isRegular && (!Number.isFinite(trayHalf) || trayHalf < 0)) {
      throw new Error("Half tray price is required for regular menu items.");
    }
    if (isRegular && (!Number.isFinite(trayFull) || trayFull < 0)) {
      throw new Error("Full tray price is required for regular menu items.");
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
        is_active: Boolean(newItemForm.is_active),
        menu_type: menuType,
        group_id: groupId,
        tray_price_half: isRegular ? trayHalfRaw : null,
        tray_price_full: isRegular ? trayFullRaw : null,
        option_group_assignments: [{ group_id: groupId, display_order: 1, is_active: true }],
        section_row_assignments: sectionRowAssignments,
        tier_bullet_assignments: tierBulletAssignments,
      }),
    });
    setStatusMessage(`Created menu item: ${payload.item?.item_name || "New Item"}`);
    setNewItemForm({
      item_name: "",
      is_active: true,
      menu_type: "",
      group_id: "",
      tray_price_half: "",
      tray_price_full: "",
    });
    await Promise.all([loadMenuItems(), loadAudit()]);
    if (payload.item?.id) {
      setSelectedItemId(payload.item.id);
      setItemForm(buildItemForm(payload.item));
    }
  };

  const saveItem = async () => {
    if (!itemForm?.id) return;
    setFormErrors((prev) => ({ ...prev, [FORM_ERROR_EDIT_ITEM]: "" }));
    const itemName = String(itemForm.item_name || "").trim();
    if (!itemName) throw new Error("Item name is required.");
    const menuType = String(itemForm.menu_type || "").toLowerCase();
    if (hasMenuItemNameConflict(itemName, menuType, itemForm.id)) {
      throw new Error("Item name must be unique within this menu type.");
    }
    const selectedGroupId = toId(itemForm.option_group_assignments?.[0]?.group_id);
    if (!selectedGroupId) throw new Error("Please select a group.");
    const payload = {
      id: itemForm.id,
      item_name: itemName,
      is_active: itemForm.is_active,
      option_group_assignments: [{ group_id: Number(selectedGroupId), display_order: 1, is_active: true }],
    };

    const response = await requestJson(`/api/admin/menu/items/${itemForm.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    setItemForm(buildItemForm(response.item));
    setStatusMessage(`Saved menu item: ${response.item?.item_name || "Item"}`);
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
    setStatusMessage(`Uploaded media: ${payload.media?.title || "New asset"}`);
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
    setStatusMessage(`Saved media: ${payload.media?.title || "Media item"}`);
    await Promise.all([loadMedia(), loadAudit()]);
  };

  const logout = async () => {
    await requestJson("/api/admin/auth/logout", { method: "POST" });
    navigate("/admin/login", { replace: true });
  };

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
      <header className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
        <div>
          <h2 className="h4 mb-1">Admin Dashboard</h2>
          <p className="text-secondary mb-0">
            Signed in as <strong>{adminUser?.display_name || adminUser?.username}</strong>
          </p>
        </div>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          <Form.Check
            className="admin-theme-toggle"
            type="switch"
            id="admin-dark-mode-toggle"
            label="Dark Mode"
            checked={isDarkMode}
            onChange={(event) => setIsDarkMode(event.target.checked)}
          />
          <Button variant="outline-secondary" onClick={refreshActiveTab} disabled={busy}>
            Refresh
          </Button>
          <Button variant="outline-danger" onClick={logout}>
            Sign Out
          </Button>
        </div>
      </header>

      {statusMessage ? <Alert variant="success">{statusMessage}</Alert> : null}
      {errorMessage ? <Alert variant="danger">{errorMessage}</Alert> : null}

      <Nav variant="tabs" activeKey={activeTab} onSelect={(key) => setActiveTab(key || TAB_MENU)} className="mb-3">
        <Nav.Item>
          <Nav.Link eventKey={TAB_MENU}>Menu Operations</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey={TAB_MEDIA}>Media Manager</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey={TAB_AUDIT}>Audit History</Nav.Link>
        </Nav.Item>
      </Nav>

      {activeTab === TAB_MENU ? (
        <Row className="g-3">
          <Col lg={4}>
            <Card className="mb-3">
              <Card.Body>
                <h3 className="h6">Create Menu Item</h3>
                {formErrors[FORM_ERROR_CREATE_ITEM] ? <Alert variant="danger">{formErrors[FORM_ERROR_CREATE_ITEM]}</Alert> : null}
                <Form.Check
                  className="mb-2"
                  type="switch"
                  label="Active"
                  checked={newItemForm.is_active}
                  onChange={(event) => setNewItemForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                />
                <Form.Label className="small mb-1">Item Name</Form.Label>
                <Form.Control
                  className="mb-2"
                  placeholder="Item name"
                  value={newItemForm.item_name}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setNewItemForm((prev) => ({ ...prev, item_name: nextValue }));
                    if (String(nextValue || "").trim()) {
                      setFormErrors((prev) => ({ ...prev, [FORM_ERROR_CREATE_ITEM]: "" }));
                    }
                  }}
                />
                <Form.Label className="small mb-1">Menu Type</Form.Label>
                <Form.Select
                  className="mb-2"
                  value={newItemForm.menu_type}
                  onChange={(event) =>
                    setNewItemForm((prev) => ({
                      ...prev,
                      menu_type: event.target.value,
                      group_id: "",
                      tray_price_half: "",
                      tray_price_full: "",
                    }))
                  }>
                  <option value="">Select menu type</option>
                  <option value="regular">Regular</option>
                  <option value="formal">Formal</option>
                </Form.Select>
                {selectedCreateMenuType ? (
                  <>
                    <Form.Label className="small mb-1">Group</Form.Label>
                    <Form.Select
                      className="mb-2"
                      value={newItemForm.group_id}
                      onChange={(event) => setNewItemForm((prev) => ({ ...prev, group_id: event.target.value }))}>
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
                      <Form.Control
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Half Tray Price"
                        value={newItemForm.tray_price_half}
                        onChange={(event) => setNewItemForm((prev) => ({ ...prev, tray_price_half: event.target.value }))}
                      />
                    </Col>
                    <Col>
                      <Form.Control
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Full Tray Price"
                        value={newItemForm.tray_price_full}
                        onChange={(event) => setNewItemForm((prev) => ({ ...prev, tray_price_full: event.target.value }))}
                      />
                    </Col>
                  </Row>
                ) : null}
                <Button
                  className="btn-inquiry-action"
                  variant="secondary"
                  onClick={() => {
                    if (!validateCreateItemForm()) return;
                    queueConfirm("Create menu item", "Create this menu item?", "Create", createItem, FORM_ERROR_CREATE_ITEM);
                  }}>
                  Create Item
                </Button>
              </Card.Body>
            </Card>

            <Card className="mb-3">
              <Card.Body>
                <h3 className="h6">Find Menu Items</h3>
                <Form.Control
                  className="mb-2"
                  placeholder="Search name or key"
                  value={itemFilters.search}
                  onChange={(event) => setItemFilters((prev) => ({ ...prev, search: event.target.value }))}
                />
                <Form.Select
                  value={itemFilters.is_active}
                  onChange={(event) => setItemFilters((prev) => ({ ...prev, is_active: event.target.value }))}>
                  <option value="all">All</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </Form.Select>
                <Button className="mt-2" variant="outline-secondary" onClick={loadMenuItems}>
                  Apply
                </Button>
              </Card.Body>
            </Card>

          </Col>
          <Col lg={8}>
            <Card className="mb-3">
              <Card.Header className="admin-card-header">Menu Items</Card.Header>
              <Card.Body className="admin-scroll-card p-0">
                <Table hover size="sm" className="admin-sticky-table mb-0">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Menu Type</th>
                      <th>Active</th>
                      <th>Group</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menuItems.map((item) => (
                      <tr
                        key={item.id}
                        role="button"
                        onClick={async () => {
                          setSelectedItemId(item.id);
                          await loadItemDetail(item.id);
                        }}>
                        <td>
                          {item.item_name}
                          <div className="small text-secondary">{item.item_key}</div>
                        </td>
                        <td>
                          {String(item.menu_type || "").toLowerCase() === "formal" ? (
                            <Badge bg="warning" text="dark">
                              Formal
                            </Badge>
                          ) : (
                            <Badge bg="info" text="dark">
                              General
                            </Badge>
                          )}
                        </td>
                        <td>
                          <span
                            className={`admin-status-dot ${item.is_active ? "admin-status-dot-active" : "admin-status-dot-inactive"}`}
                            role="img"
                            aria-label={item.is_active ? "Active" : "Inactive"}
                            title={item.is_active ? "Active" : "Inactive"}
                          />
                        </td>
                        <td>
                          {resolveGroupNames(item).length ? (
                            resolveGroupNames(item).map((groupName, groupIndex) => (
                              <div key={`${item.id}-group-${groupIndex}`} className="admin-group-line">
                                {groupName}
                              </div>
                            ))
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>

            {selectedItemId && itemForm ? (
              <Card className="mb-3">
                <Card.Body>
                  <h3 className="h6">Edit Menu Item</h3>
                  {formErrors[FORM_ERROR_EDIT_ITEM] ? <Alert variant="danger">{formErrors[FORM_ERROR_EDIT_ITEM]}</Alert> : null}
                  <Form.Check
                    className="mb-3"
                    type="switch"
                    label="Active"
                    checked={itemForm.is_active}
                    onChange={(event) => setItemForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                  />
                  <Row className="g-2 mb-2">
                    <Col md={12}>
                      <Form.Label className="small mb-1">Item Name</Form.Label>
                      <Form.Control
                        value={itemForm.item_name}
                        onChange={(event) => setItemForm((prev) => ({ ...prev, item_name: event.target.value }))}
                      />
                    </Col>
                  </Row>

                  <div className="admin-assignment-panel">
                    <h4 className="h6 mb-2">Option Group Assignment</h4>
                    <Form.Label className="small mb-1">Group</Form.Label>
                    <Form.Select
                      value={itemForm.option_group_assignments?.[0]?.group_id || ""}
                      onChange={(event) => {
                        const nextGroupId = toId(event.target.value);
                        setItemForm((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            option_group_assignments: nextGroupId
                              ? [{ group_id: nextGroupId, display_order: 1, is_active: true }]
                              : [],
                          };
                        });
                      }}>
                      <option value="">Select group</option>
                      {applicableEditGroupOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.title}
                        </option>
                      ))}
                    </Form.Select>
                  </div>

                  <Button
                    className="btn-inquiry-action mt-3"
                    variant="secondary"
                    onClick={() =>
                      queueConfirm("Save menu item", "Apply item changes and assignments?", "Save", saveItem, FORM_ERROR_EDIT_ITEM)
                    }>
                    Save Item
                  </Button>
                </Card.Body>
              </Card>
            ) : null}

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
                    {mediaItems.map((item) => (
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
                    ))}
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
        busy={confirmBusy}
        onCancel={() => setConfirmState((prev) => ({ ...prev, show: false, action: null, errorTarget: null }))}
        onConfirm={runConfirmedAction}
      />
    </main>
  );
};

export default AdminDashboard;
