import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Nav, Row, Spinner, Table } from "react-bootstrap";
import { Navigate, useNavigate } from "react-router-dom";
import ConfirmActionModal from "./ConfirmActionModal";
import { requestJson, requestWithFormData } from "./adminApi";

const TAB_MENU = "menu";
const TAB_MEDIA = "media";
const TAB_AUDIT = "audit";

const toId = (value) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : "";
};

const withDisplayOrder = (rows) =>
  rows.map((row, index) => ({
    ...row,
    display_order: Number.isFinite(Number(row.display_order)) && Number(row.display_order) > 0 ? Number(row.display_order) : index + 1,
  }));

const buildItemForm = (item) => ({
  id: item?.id ?? null,
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

const buildSectionForm = (section) => ({
  id: section?.id ?? null,
  title: section?.title ?? "",
  description: section?.description ?? "",
  price: section?.price ?? "",
  section_type: section?.section_type ?? "",
  category: section?.category ?? "",
  course_type: section?.course_type ?? "",
  display_order: section?.display_order ?? 1,
  is_active: Boolean(section?.is_active),
  include_group_ids: (section?.include_groups || []).filter((row) => row.is_active).map((row) => row.group_id),
  constraints_json: JSON.stringify(
    (section?.constraints || [])
      .filter((row) => row.is_active)
      .map((row) => ({ constraint_key: row.constraint_key, min_select: row.min_select, max_select: row.max_select })),
    null,
    2
  ),
  tiers_json: JSON.stringify(
    (section?.tiers || []).map((tier) => ({
      id: tier.id,
      tier_title: tier.tier_title,
      price: tier.price,
      display_order: tier.display_order,
      is_active: Boolean(tier.is_active),
      constraints: (tier.constraints || [])
        .filter((row) => row.is_active)
        .map((row) => ({ constraint_key: row.constraint_key, min_select: row.min_select, max_select: row.max_select })),
    })),
    null,
    2
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

const emptyOptionGroupRow = (displayOrder) => ({ group_id: "", display_order: displayOrder, is_active: true });
const emptySectionRow = (displayOrder) => ({ section_id: "", value_1: "", value_2: "", display_order: displayOrder, is_active: true });
const emptyTierRow = (displayOrder) => ({ tier_id: "", display_order: displayOrder, is_active: true });

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [adminUser, setAdminUser] = useState(null);

  const [activeTab, setActiveTab] = useState(TAB_MENU);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [referenceData, setReferenceData] = useState({ catalogs: [], option_groups: [], sections: [], tiers: [] });
  const [itemFilters, setItemFilters] = useState({ search: "", is_active: "all" });
  const [menuItems, setMenuItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [itemForm, setItemForm] = useState(null);
  const [newItemForm, setNewItemForm] = useState({ item_name: "", item_key: "", is_active: true });

  const [sectionFilters, setSectionFilters] = useState({ search: "", catalog_key: "", is_active: "all" });
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [sectionForm, setSectionForm] = useState(null);

  const [mediaFilters, setMediaFilters] = useState({ search: "", media_type: "", is_active: "all", is_slide: "all" });
  const [mediaItems, setMediaItems] = useState([]);
  const [selectedMediaId, setSelectedMediaId] = useState(null);
  const [mediaForm, setMediaForm] = useState(null);
  const [uploadForm, setUploadForm] = useState({ title: "", caption: "", alt_text: "", is_slide: false, is_active: true, display_order: "", file: null });
  const [hasLoadedMediaTab, setHasLoadedMediaTab] = useState(false);
  const [hasLoadedAuditTab, setHasLoadedAuditTab] = useState(false);

  const [auditEntries, setAuditEntries] = useState([]);
  const [confirmState, setConfirmState] = useState({ show: false, title: "", body: "", confirmLabel: "Confirm", action: null });
  const [confirmBusy, setConfirmBusy] = useState(false);

  const catalogOptions = useMemo(() => referenceData.catalogs || [], [referenceData.catalogs]);

  const loadReferenceData = useCallback(async () => {
    const payload = await requestJson("/api/admin/menu/reference-data");
    setReferenceData({
      catalogs: payload.catalogs || [],
      option_groups: payload.option_groups || [],
      sections: payload.sections || [],
      tiers: payload.tiers || [],
    });
  }, []);

  const loadMenuItems = useCallback(async () => {
    const params = new URLSearchParams();
    if (itemFilters.search.trim()) params.set("search", itemFilters.search.trim());
    if (itemFilters.is_active !== "all") params.set("is_active", itemFilters.is_active);
    params.set("limit", "500");
    const payload = await requestJson(`/api/admin/menu/items?${params.toString()}`);
    setMenuItems(payload.items || []);
  }, [itemFilters]);

  const loadSections = useCallback(async () => {
    const params = new URLSearchParams();
    if (sectionFilters.search.trim()) params.set("search", sectionFilters.search.trim());
    if (sectionFilters.catalog_key) params.set("catalog_key", sectionFilters.catalog_key);
    if (sectionFilters.is_active !== "all") params.set("is_active", sectionFilters.is_active);
    params.set("limit", "500");
    const payload = await requestJson(`/api/admin/menu/sections?${params.toString()}`);
    setSections(payload.sections || []);
  }, [sectionFilters]);

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

  const loadSectionDetail = useCallback(async (sectionId) => {
    const payload = await requestJson(`/api/admin/menu/sections/${sectionId}`);
    setSectionForm(buildSectionForm(payload.section));
  }, []);

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
        await Promise.all([loadReferenceData(), loadMenuItems(), loadSections()]);
      } catch (error) {
        setErrorMessage(error.message || "Failed to load admin data.");
      } finally {
        setBusy(false);
      }
    };
    loadInitial();
  }, [adminUser, loadReferenceData, loadMenuItems, loadSections]);

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

  const refreshActiveTab = useCallback(async () => {
    try {
      setBusy(true);
      if (activeTab === TAB_MENU) {
        await Promise.all([loadReferenceData(), loadMenuItems(), loadSections()]);
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
  }, [activeTab, loadReferenceData, loadMenuItems, loadSections, loadMedia, loadAudit]);

  const queueConfirm = (title, body, confirmLabel, action) => {
    setConfirmState({ show: true, title, body, confirmLabel, action });
  };

  const runConfirmedAction = async () => {
    if (!confirmState.action) return;
    setConfirmBusy(true);
    try {
      await confirmState.action();
      setConfirmState({ show: false, title: "", body: "", confirmLabel: "Confirm", action: null });
    } catch (error) {
      setErrorMessage(error.message || "Unable to apply change.");
    } finally {
      setConfirmBusy(false);
    }
  };

  const createItem = async () => {
    const payload = await requestJson("/api/admin/menu/items", {
      method: "POST",
      body: JSON.stringify(newItemForm),
    });
    setStatusMessage(`Created menu item: ${payload.item?.item_name || "New Item"}`);
    setNewItemForm({ item_name: "", item_key: "", is_active: true });
    await Promise.all([loadMenuItems(), loadAudit()]);
    if (payload.item?.id) {
      setSelectedItemId(payload.item.id);
      setItemForm(buildItemForm(payload.item));
    }
  };

  const saveItem = async () => {
    if (!itemForm?.id) return;
    const payload = {
      id: itemForm.id,
      item_name: itemForm.item_name,
      item_key: itemForm.item_key,
      is_active: itemForm.is_active,
      option_group_assignments: withDisplayOrder(itemForm.option_group_assignments || [])
        .filter((row) => Number(row.group_id) > 0)
        .map((row) => ({ group_id: Number(row.group_id), display_order: row.display_order, is_active: true })),
      section_row_assignments: withDisplayOrder(itemForm.section_row_assignments || [])
        .filter((row) => Number(row.section_id) > 0)
        .map((row) => ({
          section_id: Number(row.section_id),
          value_1: row.value_1,
          value_2: row.value_2,
          display_order: row.display_order,
          is_active: true,
        })),
      tier_bullet_assignments: withDisplayOrder(itemForm.tier_bullet_assignments || [])
        .filter((row) => Number(row.tier_id) > 0)
        .map((row) => ({ tier_id: Number(row.tier_id), display_order: row.display_order, is_active: true })),
    };

    const response = await requestJson(`/api/admin/menu/items/${itemForm.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    setItemForm(buildItemForm(response.item));
    setStatusMessage(`Saved menu item: ${response.item?.item_name || "Item"}`);
    await Promise.all([loadMenuItems(), loadAudit()]);
  };

  const saveSection = async () => {
    if (!sectionForm?.id) return;
    let constraints;
    let tiers;
    try {
      constraints = JSON.parse(sectionForm.constraints_json || "[]");
      tiers = JSON.parse(sectionForm.tiers_json || "[]");
    } catch {
      throw new Error("Section JSON fields are invalid.");
    }
    const payload = await requestJson(`/api/admin/menu/sections/${sectionForm.id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...sectionForm, constraints, tiers }),
    });
    setSectionForm(buildSectionForm(payload.section));
    setStatusMessage(`Saved section: ${payload.section?.title || "Section"}`);
    await Promise.all([loadSections(), loadReferenceData(), loadAudit()]);
  };

  const uploadMedia = async () => {
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

  const updateAssignmentList = (key, updater) => {
    setItemForm((prev) => {
      if (!prev) return prev;
      const nextRows = updater(prev[key] || []);
      return { ...prev, [key]: withDisplayOrder(nextRows) };
    });
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
    <main className="container-fluid py-4 admin-dashboard">
      <header className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
        <div>
          <h2 className="h4 mb-1">Admin Dashboard</h2>
          <p className="text-secondary mb-0">
            Signed in as <strong>{adminUser?.display_name || adminUser?.username}</strong>
          </p>
        </div>
        <div className="d-flex gap-2">
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
                <Form.Control
                  className="mb-2"
                  placeholder="Item name"
                  value={newItemForm.item_name}
                  onChange={(event) => setNewItemForm((prev) => ({ ...prev, item_name: event.target.value }))}
                />
                <Form.Control
                  className="mb-2"
                  placeholder="Item key (optional)"
                  value={newItemForm.item_key}
                  onChange={(event) => setNewItemForm((prev) => ({ ...prev, item_key: event.target.value }))}
                />
                <Form.Check
                  className="mb-2"
                  type="switch"
                  label="Active"
                  checked={newItemForm.is_active}
                  onChange={(event) => setNewItemForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                />
                <Button
                  className="btn-inquiry-action"
                  variant="secondary"
                  onClick={() => queueConfirm("Create menu item", "Create this menu item?", "Create", createItem)}>
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

            <Card>
              <Card.Body>
                <h3 className="h6">Find Sections</h3>
                <Form.Control
                  className="mb-2"
                  placeholder="Search section"
                  value={sectionFilters.search}
                  onChange={(event) => setSectionFilters((prev) => ({ ...prev, search: event.target.value }))}
                />
                <Form.Select
                  className="mb-2"
                  value={sectionFilters.catalog_key}
                  onChange={(event) => setSectionFilters((prev) => ({ ...prev, catalog_key: event.target.value }))}>
                  <option value="">All catalogs</option>
                  {catalogOptions.map((catalog) => (
                    <option key={catalog.id} value={catalog.catalog_key}>
                      {catalog.catalog_key}
                    </option>
                  ))}
                </Form.Select>
                <Form.Select
                  value={sectionFilters.is_active}
                  onChange={(event) => setSectionFilters((prev) => ({ ...prev, is_active: event.target.value }))}>
                  <option value="all">All</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </Form.Select>
                <Button className="mt-2" variant="outline-secondary" onClick={loadSections}>
                  Apply
                </Button>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={8}>
            <Card className="mb-3">
              <Card.Body className="admin-scroll-card">
                <h3 className="h6">Menu Items</h3>
                <Table hover responsive size="sm">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Active</th>
                      <th>Groups</th>
                      <th>Rows</th>
                      <th>Tiers</th>
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
                        <td>{item.is_active ? "Yes" : "No"}</td>
                        <td>{item.option_group_count}</td>
                        <td>{item.section_row_count}</td>
                        <td>{item.tier_bullet_count}</td>
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
                  <Row className="g-2 mb-2">
                    <Col md={8}>
                      <Form.Label className="small mb-1">Item Name</Form.Label>
                      <Form.Control
                        value={itemForm.item_name}
                        onChange={(event) => setItemForm((prev) => ({ ...prev, item_name: event.target.value }))}
                      />
                    </Col>
                    <Col md={4}>
                      <Form.Label className="small mb-1">Item Key</Form.Label>
                      <Form.Control
                        value={itemForm.item_key}
                        onChange={(event) => setItemForm((prev) => ({ ...prev, item_key: event.target.value }))}
                      />
                    </Col>
                  </Row>
                  <Form.Check
                    className="mb-3"
                    type="switch"
                    label="Active"
                    checked={itemForm.is_active}
                    onChange={(event) => setItemForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                  />

                  <div className="admin-assignment-panel">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h4 className="h6 mb-0">Option Group Assignments</h4>
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() =>
                          updateAssignmentList("option_group_assignments", (rows) => [...rows, emptyOptionGroupRow(rows.length + 1)])
                        }>
                        Add Group
                      </Button>
                    </div>
                    {!itemForm.option_group_assignments.length ? <p className="small text-secondary mb-2">No option groups assigned.</p> : null}
                    {itemForm.option_group_assignments.map((row, index) => (
                      <Row className="g-2 align-items-end mb-2 admin-assignment-row" key={`group-${index}`}>
                        <Col md={7}>
                          <Form.Label className="small mb-1">Group</Form.Label>
                          <Form.Select
                            value={row.group_id || ""}
                            onChange={(event) =>
                              updateAssignmentList("option_group_assignments", (rows) =>
                                rows.map((current, rowIndex) =>
                                  rowIndex === index ? { ...current, group_id: toId(event.target.value) } : current
                                )
                              )
                            }>
                            <option value="">Select option group</option>
                            {referenceData.option_groups.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.title} ({option.option_key})
                              </option>
                            ))}
                          </Form.Select>
                        </Col>
                        <Col md={3}>
                          <Form.Label className="small mb-1">Order</Form.Label>
                          <Form.Control
                            type="number"
                            min={1}
                            value={row.display_order}
                            onChange={(event) =>
                              updateAssignmentList("option_group_assignments", (rows) =>
                                rows.map((current, rowIndex) =>
                                  rowIndex === index ? { ...current, display_order: Number(event.target.value) || 1 } : current
                                )
                              )
                            }
                          />
                        </Col>
                        <Col md={2} className="d-grid">
                          <Button
                            variant="outline-danger"
                            onClick={() =>
                              updateAssignmentList("option_group_assignments", (rows) =>
                                rows.filter((_, rowIndex) => rowIndex !== index)
                              )
                            }>
                            Remove
                          </Button>
                        </Col>
                      </Row>
                    ))}
                  </div>

                  <div className="admin-assignment-panel">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h4 className="h6 mb-0">Section Row Assignments</h4>
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() =>
                          updateAssignmentList("section_row_assignments", (rows) => [...rows, emptySectionRow(rows.length + 1)])
                        }>
                        Add Section Row
                      </Button>
                    </div>
                    <p className="small text-secondary mb-2">
                      For To-Go sections, enter <strong>Half Tray Price</strong> and <strong>Full Tray Price</strong>.
                    </p>
                    {!itemForm.section_row_assignments.length ? <p className="small text-secondary mb-2">No section rows assigned.</p> : null}
                    {itemForm.section_row_assignments.map((row, index) => {
                      const selectedSection = referenceData.sections.find((section) => Number(section.id) === Number(row.section_id));
                      const isTogo = selectedSection?.catalog_key === "togo" || String(selectedSection?.section_key || "").startsWith("togo_");
                      return (
                        <Row className="g-2 align-items-end mb-2 admin-assignment-row" key={`section-row-${index}`}>
                          <Col md={4}>
                            <Form.Label className="small mb-1">Section</Form.Label>
                            <Form.Select
                              value={row.section_id || ""}
                              onChange={(event) =>
                                updateAssignmentList("section_row_assignments", (rows) =>
                                  rows.map((current, rowIndex) =>
                                    rowIndex === index ? { ...current, section_id: toId(event.target.value) } : current
                                  )
                                )
                              }>
                              <option value="">Select section</option>
                              {referenceData.sections.map((section) => (
                                <option key={section.id} value={section.id}>
                                  {section.catalog_key} - {section.title}
                                </option>
                              ))}
                            </Form.Select>
                          </Col>
                          <Col md={2}>
                            <Form.Label className="small mb-1">{isTogo ? "Half Tray Price" : "Value 1"}</Form.Label>
                            <Form.Control
                              value={row.value_1}
                              placeholder={isTogo ? "$45" : "Value 1"}
                              onChange={(event) =>
                                updateAssignmentList("section_row_assignments", (rows) =>
                                  rows.map((current, rowIndex) =>
                                    rowIndex === index ? { ...current, value_1: event.target.value } : current
                                  )
                                )
                              }
                            />
                          </Col>
                          <Col md={2}>
                            <Form.Label className="small mb-1">{isTogo ? "Full Tray Price" : "Value 2"}</Form.Label>
                            <Form.Control
                              value={row.value_2}
                              placeholder={isTogo ? "$85" : "Value 2"}
                              onChange={(event) =>
                                updateAssignmentList("section_row_assignments", (rows) =>
                                  rows.map((current, rowIndex) =>
                                    rowIndex === index ? { ...current, value_2: event.target.value } : current
                                  )
                                )
                              }
                            />
                          </Col>
                          <Col md={2}>
                            <Form.Label className="small mb-1">Order</Form.Label>
                            <Form.Control
                              type="number"
                              min={1}
                              value={row.display_order}
                              onChange={(event) =>
                                updateAssignmentList("section_row_assignments", (rows) =>
                                  rows.map((current, rowIndex) =>
                                    rowIndex === index ? { ...current, display_order: Number(event.target.value) || 1 } : current
                                  )
                                )
                              }
                            />
                          </Col>
                          <Col md={2} className="d-grid">
                            <Button
                              variant="outline-danger"
                              onClick={() =>
                                updateAssignmentList("section_row_assignments", (rows) =>
                                  rows.filter((_, rowIndex) => rowIndex !== index)
                                )
                              }>
                              Remove
                            </Button>
                          </Col>
                        </Row>
                      );
                    })}
                  </div>

                  <div className="admin-assignment-panel">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h4 className="h6 mb-0">Tier Assignments</h4>
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() =>
                          updateAssignmentList("tier_bullet_assignments", (rows) => [...rows, emptyTierRow(rows.length + 1)])
                        }>
                        Add Tier
                      </Button>
                    </div>
                    {!itemForm.tier_bullet_assignments.length ? <p className="small text-secondary mb-2">No tiers assigned.</p> : null}
                    {itemForm.tier_bullet_assignments.map((row, index) => (
                      <Row className="g-2 align-items-end mb-2 admin-assignment-row" key={`tier-row-${index}`}>
                        <Col md={8}>
                          <Form.Label className="small mb-1">Tier</Form.Label>
                          <Form.Select
                            value={row.tier_id || ""}
                            onChange={(event) =>
                              updateAssignmentList("tier_bullet_assignments", (rows) =>
                                rows.map((current, rowIndex) =>
                                  rowIndex === index ? { ...current, tier_id: toId(event.target.value) } : current
                                )
                              )
                            }>
                            <option value="">Select tier</option>
                            {referenceData.tiers.map((tier) => (
                              <option key={tier.id} value={tier.id}>
                                {tier.catalog_key} - {tier.section_title} - {tier.tier_title}
                              </option>
                            ))}
                          </Form.Select>
                        </Col>
                        <Col md={2}>
                          <Form.Label className="small mb-1">Order</Form.Label>
                          <Form.Control
                            type="number"
                            min={1}
                            value={row.display_order}
                            onChange={(event) =>
                              updateAssignmentList("tier_bullet_assignments", (rows) =>
                                rows.map((current, rowIndex) =>
                                  rowIndex === index ? { ...current, display_order: Number(event.target.value) || 1 } : current
                                )
                              )
                            }
                          />
                        </Col>
                        <Col md={2} className="d-grid">
                          <Button
                            variant="outline-danger"
                            onClick={() =>
                              updateAssignmentList("tier_bullet_assignments", (rows) =>
                                rows.filter((_, rowIndex) => rowIndex !== index)
                              )
                            }>
                            Remove
                          </Button>
                        </Col>
                      </Row>
                    ))}
                  </div>

                  <Button
                    className="btn-inquiry-action mt-3"
                    variant="secondary"
                    onClick={() => queueConfirm("Save menu item", "Apply item changes and assignments?", "Save", saveItem)}>
                    Save Item
                  </Button>
                </Card.Body>
              </Card>
            ) : null}

            <Card className="mb-3">
              <Card.Body className="admin-scroll-card">
                <h3 className="h6">Sections</h3>
                <Table hover responsive size="sm">
                  <thead>
                    <tr>
                      <th>Catalog</th>
                      <th>Section</th>
                      <th>Price</th>
                      <th>Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.map((section) => (
                      <tr
                        key={section.id}
                        role="button"
                        onClick={async () => {
                          setSelectedSectionId(section.id);
                          await loadSectionDetail(section.id);
                        }}>
                        <td>{section.catalog_key}</td>
                        <td>
                          {section.title}
                          <div className="small text-secondary">{section.section_key}</div>
                        </td>
                        <td>{section.price || "-"}</td>
                        <td>{section.is_active ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>

            {selectedSectionId && sectionForm ? (
              <Card>
                <Card.Body>
                  <h3 className="h6">Edit Section Metadata & Rules</h3>
                  <Form.Control
                    className="mb-2"
                    placeholder="Title"
                    value={sectionForm.title}
                    onChange={(event) => setSectionForm((prev) => ({ ...prev, title: event.target.value }))}
                  />
                  <Form.Control
                    className="mb-2"
                    placeholder="Description"
                    value={sectionForm.description}
                    onChange={(event) => setSectionForm((prev) => ({ ...prev, description: event.target.value }))}
                  />
                  <Row className="g-2 mb-2">
                    <Col>
                      <Form.Control
                        placeholder="Price"
                        value={sectionForm.price}
                        onChange={(event) => setSectionForm((prev) => ({ ...prev, price: event.target.value }))}
                      />
                    </Col>
                    <Col>
                      <Form.Control
                        type="number"
                        min={1}
                        value={sectionForm.display_order}
                        onChange={(event) =>
                          setSectionForm((prev) => ({ ...prev, display_order: Number(event.target.value) || 1 }))
                        }
                      />
                    </Col>
                  </Row>
                  <Row className="g-2 mb-2">
                    <Col>
                      <Form.Control
                        placeholder="section_type"
                        value={sectionForm.section_type}
                        onChange={(event) => setSectionForm((prev) => ({ ...prev, section_type: event.target.value }))}
                      />
                    </Col>
                    <Col>
                      <Form.Control
                        placeholder="category"
                        value={sectionForm.category}
                        onChange={(event) => setSectionForm((prev) => ({ ...prev, category: event.target.value }))}
                      />
                    </Col>
                    <Col>
                      <Form.Control
                        placeholder="course_type"
                        value={sectionForm.course_type}
                        onChange={(event) => setSectionForm((prev) => ({ ...prev, course_type: event.target.value }))}
                      />
                    </Col>
                  </Row>
                  <Form.Check
                    className="mb-2"
                    type="switch"
                    label="Active"
                    checked={sectionForm.is_active}
                    onChange={(event) => setSectionForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                  />
                  <Form.Label className="small fw-semibold">Include Group IDs (comma separated)</Form.Label>
                  <Form.Control
                    className="mb-2"
                    value={sectionForm.include_group_ids.join(",")}
                    onChange={(event) =>
                      setSectionForm((prev) => ({
                        ...prev,
                        include_group_ids: event.target.value
                          .split(",")
                          .map((value) => Number(value.trim()))
                          .filter((value) => Number.isFinite(value) && value > 0),
                      }))
                    }
                  />
                  <Form.Label className="small fw-semibold">Constraints JSON</Form.Label>
                  <Form.Control
                    className="mb-2"
                    as="textarea"
                    rows={4}
                    value={sectionForm.constraints_json}
                    onChange={(event) => setSectionForm((prev) => ({ ...prev, constraints_json: event.target.value }))}
                  />
                  <Form.Label className="small fw-semibold">Tiers JSON</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    value={sectionForm.tiers_json}
                    onChange={(event) => setSectionForm((prev) => ({ ...prev, tiers_json: event.target.value }))}
                  />
                  <Button
                    className="btn-inquiry-action mt-3"
                    variant="secondary"
                    onClick={() => queueConfirm("Save section", "Apply section pricing and rule updates?", "Save", saveSection)}>
                    Save Section
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
                  onClick={() => queueConfirm("Upload media", "Upload this file?", "Upload", uploadMedia)}>
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
                    onClick={() => queueConfirm("Save media", "Apply media metadata and order changes?", "Save", saveMedia)}>
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
        onCancel={() => setConfirmState((prev) => ({ ...prev, show: false, action: null }))}
        onConfirm={runConfirmedAction}
      />
    </main>
  );
};

export default AdminDashboard;
