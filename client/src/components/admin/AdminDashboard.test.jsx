import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminDashboard from "./AdminDashboard";

const buildResponse = (body, ok = true) => ({
  ok,
  json: async () => body,
});

describe("AdminDashboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("auto-loads media and audit data when switching tabs", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({ user: { id: 1, username: "admin", display_name: "Admin", is_active: true } })
        );
      }
      if (url === "/api/menu/general/groups") {
        return Promise.resolve(buildResponse({ groups: [] }));
      }
      if (url === "/api/menu/formal/groups") {
        return Promise.resolve(buildResponse({ groups: [] }));
      }
      if (String(url).startsWith("/api/admin/menu/catalog-items?")) {
        return Promise.resolve(buildResponse({ items: [] }));
      }
      if (String(url).startsWith("/api/admin/media?")) {
        return Promise.resolve(buildResponse({ media: [] }));
      }
      if (url === "/api/admin/audit?limit=200") {
        return Promise.resolve(buildResponse({ entries: [] }));
      }
      return Promise.resolve(buildResponse({}, false));
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="/admin/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Menu Operations");
    fireEvent.click(screen.getByRole("tab", { name: "Media Manager" }));

    await waitFor(() => {
      const requests = globalThis.fetch.mock.calls.map((call) => String(call[0]));
      expect(requests.some((requestUrl) => requestUrl.startsWith("/api/admin/media?"))).toBe(true);
    });

    fireEvent.click(screen.getByRole("tab", { name: "Audit History" }));
    await waitFor(() => {
      const requests = globalThis.fetch.mock.calls.map((call) => String(call[0]));
      expect(requests).toContain("/api/admin/audit?limit=200");
    });
  });

  it("loads simplified menu endpoints instead of legacy reference/section endpoints", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({ user: { id: 1, username: "admin", display_name: "Admin", is_active: true } })
        );
      }
      if (url === "/api/menu/general/groups") {
        return Promise.resolve(buildResponse({ groups: [{ id: 10, key: "entree", name: "Entree", is_active: true }] }));
      }
      if (url === "/api/menu/formal/groups") {
        return Promise.resolve(buildResponse({ groups: [{ id: 11, key: "entrees", name: "Entrees", is_active: true }] }));
      }
      if (String(url).startsWith("/api/admin/menu/catalog-items?")) {
        return Promise.resolve(buildResponse({ items: [] }));
      }
      return Promise.resolve(buildResponse({}, false));
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="/admin/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Create Menu Item");
    const requests = globalThis.fetch.mock.calls.map((call) => String(call[0]));
    expect(requests).toContain("/api/menu/general/groups");
    expect(requests).toContain("/api/menu/formal/groups");
    expect(requests.some((requestUrl) => requestUrl.startsWith("/api/admin/menu/catalog-items?"))).toBe(true);
    expect(requests.some((requestUrl) => requestUrl.startsWith("/api/admin/menu/reference-data"))).toBe(false);
    expect(requests.some((requestUrl) => requestUrl.startsWith("/api/admin/menu/sections?"))).toBe(false);
  });

  it("creates regular items from one form with group + tray prices and auto-assignments", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url, options) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({ user: { id: 1, username: "admin", display_name: "Admin", is_active: true } })
        );
      }
      if (url === "/api/menu/general/groups") {
        return Promise.resolve(
          buildResponse({
            groups: [{ id: 10, key: "signature_proteins", name: "Proteins", sort_order: 1, is_active: true }],
          })
        );
      }
      if (url === "/api/menu/formal/groups") {
        return Promise.resolve(
          buildResponse({
            groups: [{ id: 11, key: "entrees", name: "Formal Entrees", sort_order: 1, is_active: true }],
          })
        );
      }
      if (String(url).startsWith("/api/admin/menu/catalog-items?")) {
        return Promise.resolve(buildResponse({ items: [] }));
      }
      if (url === "/api/admin/audit?limit=200") {
        return Promise.resolve(buildResponse({ entries: [] }));
      }
      if (url === "/api/admin/menu/items" && options?.method === "POST") {
        return Promise.resolve(
          buildResponse({
            item: {
              id: 55,
              item_name: "Jerk Chicken",
              item_key: "jerk_chicken",
              is_active: true,
              option_group_assignments: [],
              section_row_assignments: [],
              tier_bullet_assignments: [],
            },
          })
        );
      }
      return Promise.resolve(buildResponse({}, false));
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="/admin/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Create Menu Item");
    expect(screen.queryByLabelText("Group")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Half Tray Price")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Full Tray Price")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Item Name"), { target: { value: "Jerk Chicken" } });
    fireEvent.change(screen.getByLabelText("Menu Type"), { target: { value: "regular" } });
    expect(screen.getByLabelText("Group")).toBeInTheDocument();
    expect(screen.getByLabelText("Half Tray Price")).toBeInTheDocument();
    expect(screen.getByLabelText("Full Tray Price")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Proteins" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Formal Entrees" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Group"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Half Tray Price"), { target: { value: "7500" } });
    fireEvent.change(screen.getByLabelText("Full Tray Price"), { target: { value: "14000" } });

    fireEvent.click(screen.getByRole("button", { name: "Create Item" }));
    const confirmDialog = await screen.findByRole("dialog");
    expect(within(confirmDialog).getByText("Create this menu item with the following details?")).toBeInTheDocument();
    expect(within(confirmDialog).getByText("Jerk Chicken")).toBeInTheDocument();
    expect(within(confirmDialog).getByText("Regular")).toBeInTheDocument();
    expect(within(confirmDialog).getByText("Proteins")).toBeInTheDocument();
    expect(within(confirmDialog).getByText("$75.00")).toBeInTheDocument();
    expect(within(confirmDialog).getByText("$140.00")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Create" }));

    await waitFor(() => {
      const createCall = globalThis.fetch.mock.calls.find(
        (call) => call[0] === "/api/admin/menu/items" && call[1]?.method === "POST"
      );
      expect(createCall).toBeTruthy();
      const payload = JSON.parse(createCall[1].body);
      expect(payload.item_name).toBe("Jerk Chicken");
      expect(payload.menu_type).toBe("regular");
      expect(payload.group_id).toBe(10);
      expect(payload.tray_price_half).toBe("75.00");
      expect(payload.tray_price_full).toBe("140.00");
      expect(payload.item_key).toBeUndefined();
      expect(payload.option_group_assignments).toHaveLength(1);
      expect(payload.section_row_assignments).toHaveLength(0);
      expect(payload.tier_bullet_assignments).toHaveLength(0);
    });

    fireEvent.change(screen.getByLabelText("Menu Type"), { target: { value: "formal" } });
    await waitFor(() => {
      const createGroupSelect = screen.getByLabelText("Group");
      expect(createGroupSelect).toBeInTheDocument();
      expect(within(createGroupSelect).getByRole("option", { name: "Formal Entrees" })).toBeInTheDocument();
      expect(within(createGroupSelect).queryByRole("option", { name: "Proteins" })).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Half Tray Price")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Full Tray Price")).not.toBeInTheDocument();
    });
  });

  it("creates item without menu type as inactive and unassigned", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url, options) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({ user: { id: 1, username: "admin", display_name: "Admin", is_active: true } })
        );
      }
      if (url === "/api/menu/general/groups") {
        return Promise.resolve(
          buildResponse({
            groups: [{ id: 10, key: "signature_proteins", name: "Proteins", sort_order: 1, is_active: true }],
          })
        );
      }
      if (url === "/api/menu/formal/groups") {
        return Promise.resolve(
          buildResponse({
            groups: [{ id: 11, key: "entrees", name: "Formal Entrees", sort_order: 1, is_active: true }],
          })
        );
      }
      if (String(url).startsWith("/api/admin/menu/catalog-items?")) {
        return Promise.resolve(buildResponse({ items: [] }));
      }
      if (url === "/api/admin/audit?limit=200") {
        return Promise.resolve(buildResponse({ entries: [] }));
      }
      if (url === "/api/admin/menu/items" && options?.method === "POST") {
        return Promise.resolve(
          buildResponse({
            item: {
              id: 77,
              menu_type: "regular",
              menu_types: [],
              item_name: "No Type Item",
              item_key: "no_type_item",
              tray_price_half: null,
              tray_price_full: null,
              is_active: false,
              option_group_assignments: [],
              section_row_assignments: [],
              tier_bullet_assignments: [],
            },
          })
        );
      }
      return Promise.resolve(buildResponse({}, false));
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="/admin/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Create Menu Item");
    fireEvent.change(screen.getByLabelText("Item Name"), { target: { value: "No Type Item" } });

    fireEvent.click(screen.getByRole("button", { name: "Create Item" }));
    fireEvent.click(await screen.findByRole("button", { name: "Create" }));

    await waitFor(() => {
      const createCall = globalThis.fetch.mock.calls.find(
        (call) => call[0] === "/api/admin/menu/items" && call[1]?.method === "POST"
      );
      expect(createCall).toBeTruthy();
      const payload = JSON.parse(createCall[1].body);
      expect(payload.menu_type).toEqual([]);
      expect(payload.group_id).toBeNull();
      expect(payload.is_active).toBe(false);
      expect(payload.option_group_assignments).toEqual([]);
      expect(payload.tray_price_half).toBeNull();
      expect(payload.tray_price_full).toBeNull();
    });
    const editCard = await screen.findByTestId("edit-menu-item-card");
    expect(editCard).toHaveClass("admin-edit-card-created");
    fireEvent.change(screen.getByLabelText("Item Name", { selector: "#admin-edit-item-name" }), {
      target: { value: "No Type Item Updated" },
    });
    expect(editCard).not.toHaveClass("admin-edit-card-created");
  });

  it("shows create validation text in modal and keeps invalid field red until changed", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({ user: { id: 1, username: "admin", display_name: "Admin", is_active: true } })
        );
      }
      if (url === "/api/menu/general/groups") {
        return Promise.resolve(
          buildResponse({
            groups: [{ id: 10, key: "signature_proteins", name: "Proteins", sort_order: 1, is_active: true }],
          })
        );
      }
      if (url === "/api/menu/formal/groups") {
        return Promise.resolve(
          buildResponse({
            groups: [{ id: 11, key: "entrees", name: "Formal Entrees", sort_order: 1, is_active: true }],
          })
        );
      }
      if (String(url).startsWith("/api/admin/menu/catalog-items?")) {
        return Promise.resolve(buildResponse({ items: [] }));
      }
      if (url === "/api/admin/audit?limit=200") {
        return Promise.resolve(buildResponse({ entries: [] }));
      }
      return Promise.resolve(buildResponse({}, false));
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="/admin/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Create Menu Item");
    fireEvent.change(screen.getByLabelText("Item Name"), { target: { value: "Validation Item" } });
    fireEvent.change(screen.getByLabelText("Menu Type"), { target: { value: "regular" } });

    const groupSelect = screen.getByLabelText("Group");
    expect(groupSelect).toBeInTheDocument();
    expect(groupSelect).not.toHaveClass("is-invalid");

    fireEvent.click(screen.getByRole("button", { name: "Create Item" }));
    fireEvent.click(await screen.findByRole("button", { name: "Create" }));

    await waitFor(() => {
      const confirmDialog = screen.getByRole("dialog");
      expect(within(confirmDialog).getByRole("alert")).toHaveTextContent("Please select a group");
      expect(groupSelect).toHaveClass("is-invalid");
      expect(within(confirmDialog).getByRole("button", { name: "Create" })).toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Fix" }));
    await waitFor(() => {
      expect(screen.queryByText("Create this menu item?")).not.toBeInTheDocument();
    });
    expect(groupSelect).toHaveClass("is-invalid");
    expect(screen.getByRole("button", { name: "Create Item" })).toBeDisabled();

    fireEvent.change(groupSelect, { target: { value: "10" } });
    expect(groupSelect).not.toHaveClass("is-invalid");
    expect(screen.getByRole("button", { name: "Create Item" })).not.toBeDisabled();

    const postCall = globalThis.fetch.mock.calls.find(
      (call) => call[0] === "/api/admin/menu/items" && call[1]?.method === "POST"
    );
    expect(postCall).toBeFalsy();
  });

  it("clears create form values and resets create validation state", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({ user: { id: 1, username: "admin", display_name: "Admin", is_active: true } })
        );
      }
      if (url === "/api/menu/general/groups") {
        return Promise.resolve(
          buildResponse({
            groups: [{ id: 10, key: "signature_proteins", name: "Proteins", sort_order: 1, is_active: true }],
          })
        );
      }
      if (url === "/api/menu/formal/groups") {
        return Promise.resolve(
          buildResponse({
            groups: [{ id: 11, key: "entrees", name: "Formal Entrees", sort_order: 1, is_active: true }],
          })
        );
      }
      if (String(url).startsWith("/api/admin/menu/catalog-items?")) {
        return Promise.resolve(buildResponse({ items: [] }));
      }
      if (url === "/api/admin/audit?limit=200") {
        return Promise.resolve(buildResponse({ entries: [] }));
      }
      return Promise.resolve(buildResponse({}, false));
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="/admin/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Create Menu Item");
    const createCard = screen.getByText("Create Menu Item").closest(".card");
    expect(createCard).toBeTruthy();
    const activeToggle = within(createCard).getByRole("checkbox");
    const itemNameInput = screen.getByLabelText("Item Name");
    const menuTypeSelect = screen.getByLabelText("Menu Type");
    const createButton = screen.getByRole("button", { name: "Create Item" });
    expect(within(createCard).queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();

    fireEvent.click(activeToggle);
    fireEvent.change(itemNameInput, { target: { value: "Validation Item" } });
    fireEvent.change(menuTypeSelect, { target: { value: "regular" } });
    fireEvent.change(screen.getByLabelText("Half Tray Price"), { target: { value: "7500" } });
    fireEvent.change(screen.getByLabelText("Full Tray Price"), { target: { value: "14000" } });
    const clearButton = within(createCard).getByRole("button", { name: "Clear" });

    fireEvent.click(createButton);
    fireEvent.click(await screen.findByRole("button", { name: "Create" }));
    await waitFor(() => {
      expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent("Please select a group");
      expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Create" })).toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Fix" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(createButton).toBeDisabled();

    fireEvent.click(clearButton);

    expect(within(createCard).getByRole("checkbox")).toBeChecked();
    expect(screen.getByLabelText("Item Name")).toHaveValue("");
    expect(screen.getByLabelText("Menu Type")).toHaveValue("");
    expect(screen.queryByLabelText("Group")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Half Tray Price")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Full Tray Price")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Item" })).not.toBeDisabled();
    expect(within(createCard).queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
  });

  it("shows media upload clear button only when upload form has changes", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({ user: { id: 1, username: "admin", display_name: "Admin", is_active: true } })
        );
      }
      if (url === "/api/menu/general/groups") {
        return Promise.resolve(buildResponse({ groups: [] }));
      }
      if (url === "/api/menu/formal/groups") {
        return Promise.resolve(buildResponse({ groups: [] }));
      }
      if (String(url).startsWith("/api/admin/menu/catalog-items?")) {
        return Promise.resolve(buildResponse({ items: [] }));
      }
      if (String(url).startsWith("/api/admin/media?")) {
        return Promise.resolve(buildResponse({ media: [] }));
      }
      if (url === "/api/admin/audit?limit=200") {
        return Promise.resolve(buildResponse({ entries: [] }));
      }
      return Promise.resolve(buildResponse({}, false));
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="/admin/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Menu Operations");
    fireEvent.click(screen.getByRole("tab", { name: "Media Manager" }));
    await screen.findByText("Upload Media");

    const uploadCard = screen.getByText("Upload Media").closest(".card");
    expect(uploadCard).toBeTruthy();
    expect(within(uploadCard).queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();

    const titleInput = within(uploadCard).getByPlaceholderText("Title");
    const uploadSwitches = within(uploadCard).getAllByRole("checkbox");
    expect(uploadSwitches).toHaveLength(2);
    const [slideSwitch, activeSwitch] = uploadSwitches;

    fireEvent.change(titleInput, { target: { value: "New Hero Image" } });
    const clearButton = within(uploadCard).getByRole("button", { name: "Clear" });
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);
    expect(within(uploadCard).getByPlaceholderText("Title")).toHaveValue("");
    expect(within(uploadCard).getByPlaceholderText("Caption")).toHaveValue("");
    expect(activeSwitch).toBeChecked();
    expect(slideSwitch).not.toBeChecked();
    expect(within(uploadCard).queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
  });

  it("reorders homepage slides from the media table via drag and drop", async () => {
    let mediaRows = [
      {
        id: 11,
        title: "Hero 1",
        caption: "First",
        src: "/api/assets/slides/hero-1.jpg",
        media_type: "image",
        is_active: true,
        is_slide: true,
        display_order: 1,
      },
      {
        id: 12,
        title: "Hero 2",
        caption: "Second",
        src: "/api/assets/slides/hero-2.jpg",
        media_type: "image",
        is_active: true,
        is_slide: true,
        display_order: 2,
      },
      {
        id: 20,
        title: "Gallery Item",
        caption: "Gallery",
        src: "/api/assets/slides/gallery-1.jpg",
        media_type: "image",
        is_active: true,
        is_slide: false,
        display_order: 1,
      },
    ];

    vi.spyOn(globalThis, "fetch").mockImplementation((url, options) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({ user: { id: 1, username: "admin", display_name: "Admin", is_active: true } })
        );
      }
      if (url === "/api/menu/general/groups") {
        return Promise.resolve(buildResponse({ groups: [] }));
      }
      if (url === "/api/menu/formal/groups") {
        return Promise.resolve(buildResponse({ groups: [] }));
      }
      if (String(url).startsWith("/api/admin/menu/catalog-items?")) {
        return Promise.resolve(buildResponse({ items: [] }));
      }
      if (String(url).startsWith("/api/admin/media?")) {
        return Promise.resolve(buildResponse({ media: mediaRows }));
      }
      if (url === "/api/admin/media/reorder" && options?.method === "PATCH") {
        const payload = JSON.parse(options.body || "{}");
        const isSlideGroup = payload.is_slide === true;
        const orderedIds = Array.isArray(payload.ordered_ids) ? payload.ordered_ids.map((value) => Number(value)) : [];
        const groupRows = mediaRows.filter((item) => Boolean(item.is_slide) === isSlideGroup);
        const groupMap = new Map(groupRows.map((item) => [item.id, { ...item }]));
        const reorderedGroup = orderedIds.map((id) => groupMap.get(id)).filter(Boolean);
        const remainingGroup = groupRows.filter((item) => !orderedIds.includes(item.id));
        const finalGroup = [...reorderedGroup, ...remainingGroup].map((item, index) => ({
          ...item,
          display_order: index + 1,
        }));
        const otherGroup = mediaRows.filter((item) => Boolean(item.is_slide) !== isSlideGroup);
        mediaRows = isSlideGroup ? [...finalGroup, ...otherGroup] : [...otherGroup, ...finalGroup];
        return Promise.resolve(buildResponse({ media: finalGroup, is_slide: isSlideGroup }));
      }
      if (url === "/api/admin/audit?limit=200") {
        return Promise.resolve(buildResponse({ entries: [] }));
      }
      return Promise.resolve(buildResponse({}, false));
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="/admin/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Menu Operations");
    fireEvent.click(screen.getByRole("tab", { name: "Media Manager" }));
    await screen.findByText("Hero 1");
    await screen.findByText("Hero 2");

    const heroOneRow = screen.getByText("Hero 1").closest("tr");
    const heroTwoRow = screen.getByText("Hero 2").closest("tr");
    expect(heroOneRow).toBeTruthy();
    expect(heroTwoRow).toBeTruthy();

    const dataTransfer = {
      data: {},
      setData: vi.fn((key, value) => {
        dataTransfer.data[key] = value;
      }),
      getData: vi.fn((key) => dataTransfer.data[key]),
      effectAllowed: "",
      dropEffect: "",
    };

    fireEvent.dragStart(heroTwoRow, { dataTransfer });
    fireEvent.dragOver(heroOneRow, { dataTransfer });
    fireEvent.drop(heroOneRow, { dataTransfer });
    fireEvent.dragEnd(heroTwoRow, { dataTransfer });

    await waitFor(() => {
      const reorderCall = globalThis.fetch.mock.calls.find(
        (call) => call[0] === "/api/admin/media/reorder" && call[1]?.method === "PATCH"
      );
      expect(reorderCall).toBeTruthy();
      const reorderPayload = JSON.parse(reorderCall[1].body);
      expect(reorderPayload.ordered_ids).toEqual([12, 11]);
      expect(reorderPayload.is_slide).toBe(true);
    });
  });

  it("reorders gallery rows separately from homepage slides", async () => {
    let mediaRows = [
      {
        id: 11,
        title: "Hero 1",
        caption: "First",
        src: "/api/assets/slides/hero-1.jpg",
        media_type: "image",
        is_active: true,
        is_slide: true,
        display_order: 1,
      },
      {
        id: 21,
        title: "Gallery A",
        caption: "A",
        src: "/api/assets/slides/gallery-a.jpg",
        media_type: "image",
        is_active: true,
        is_slide: false,
        display_order: 1,
      },
      {
        id: 22,
        title: "Gallery B",
        caption: "B",
        src: "/api/assets/slides/gallery-b.jpg",
        media_type: "image",
        is_active: true,
        is_slide: false,
        display_order: 2,
      },
    ];

    vi.spyOn(globalThis, "fetch").mockImplementation((url, options) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({ user: { id: 1, username: "admin", display_name: "Admin", is_active: true } })
        );
      }
      if (url === "/api/menu/general/groups") return Promise.resolve(buildResponse({ groups: [] }));
      if (url === "/api/menu/formal/groups") return Promise.resolve(buildResponse({ groups: [] }));
      if (String(url).startsWith("/api/admin/menu/catalog-items?")) return Promise.resolve(buildResponse({ items: [] }));
      if (String(url).startsWith("/api/admin/media?")) return Promise.resolve(buildResponse({ media: mediaRows }));
      if (url === "/api/admin/media/reorder" && options?.method === "PATCH") {
        const payload = JSON.parse(options.body || "{}");
        const isSlideGroup = payload.is_slide === true;
        const orderedIds = Array.isArray(payload.ordered_ids) ? payload.ordered_ids.map((value) => Number(value)) : [];
        const groupRows = mediaRows.filter((item) => Boolean(item.is_slide) === isSlideGroup);
        const groupMap = new Map(groupRows.map((item) => [item.id, { ...item }]));
        const reorderedGroup = orderedIds.map((id) => groupMap.get(id)).filter(Boolean);
        const remainingGroup = groupRows.filter((item) => !orderedIds.includes(item.id));
        const finalGroup = [...reorderedGroup, ...remainingGroup].map((item, index) => ({
          ...item,
          display_order: index + 1,
        }));
        const otherGroup = mediaRows.filter((item) => Boolean(item.is_slide) !== isSlideGroup);
        mediaRows = isSlideGroup ? [...finalGroup, ...otherGroup] : [...otherGroup, ...finalGroup];
        return Promise.resolve(buildResponse({ media: finalGroup, is_slide: isSlideGroup }));
      }
      if (url === "/api/admin/audit?limit=200") return Promise.resolve(buildResponse({ entries: [] }));
      return Promise.resolve(buildResponse({}, false));
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="/admin/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Menu Operations");
    fireEvent.click(screen.getByRole("tab", { name: "Media Manager" }));
    await screen.findByText("Gallery A");
    await screen.findByText("Gallery B");

    const galleryARow = screen.getByText("Gallery A").closest("tr");
    const galleryBRow = screen.getByText("Gallery B").closest("tr");
    expect(galleryARow).toBeTruthy();
    expect(galleryBRow).toBeTruthy();

    const dataTransfer = {
      data: {},
      setData: vi.fn((key, value) => {
        dataTransfer.data[key] = value;
      }),
      getData: vi.fn((key) => dataTransfer.data[key]),
      effectAllowed: "",
      dropEffect: "",
    };

    fireEvent.dragStart(galleryBRow, { dataTransfer });
    fireEvent.dragOver(galleryARow, { dataTransfer });
    fireEvent.drop(galleryARow, { dataTransfer });
    fireEvent.dragEnd(galleryBRow, { dataTransfer });

    await waitFor(() => {
      const reorderCall = globalThis.fetch.mock.calls.find(
        (call) => call[0] === "/api/admin/media/reorder" && call[1]?.method === "PATCH"
      );
      expect(reorderCall).toBeTruthy();
      const reorderPayload = JSON.parse(reorderCall[1].body);
      expect(reorderPayload.ordered_ids).toEqual([22, 21]);
      expect(reorderPayload.is_slide).toBe(false);
    });
  });

  it("maps create API validation message to item name invalid border until value changes", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url, options) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({ user: { id: 1, username: "admin", display_name: "Admin", is_active: true } })
        );
      }
      if (url === "/api/menu/general/groups") {
        return Promise.resolve(
          buildResponse({
            groups: [{ id: 10, key: "signature_proteins", name: "Proteins", sort_order: 1, is_active: true }],
          })
        );
      }
      if (url === "/api/menu/formal/groups") {
        return Promise.resolve(
          buildResponse({
            groups: [{ id: 11, key: "entrees", name: "Formal Entrees", sort_order: 1, is_active: true }],
          })
        );
      }
      if (String(url).startsWith("/api/admin/menu/catalog-items?")) {
        return Promise.resolve(buildResponse({ items: [] }));
      }
      if (url === "/api/admin/audit?limit=200") {
        return Promise.resolve(buildResponse({ entries: [] }));
      }
      if (url === "/api/admin/menu/items" && options?.method === "POST") {
        return Promise.resolve(buildResponse({ error: "Item name must be unique." }, false));
      }
      return Promise.resolve(buildResponse({}, false));
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="/admin/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Create Menu Item");
    const itemNameInput = screen.getByLabelText("Item Name");
    fireEvent.change(itemNameInput, { target: { value: "Dup Name" } });
    fireEvent.change(screen.getByLabelText("Menu Type"), { target: { value: "regular" } });
    fireEvent.change(screen.getByLabelText("Group"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Half Tray Price"), { target: { value: "7500" } });
    fireEvent.change(screen.getByLabelText("Full Tray Price"), { target: { value: "14000" } });

    fireEvent.click(screen.getByRole("button", { name: "Create Item" }));
    const confirmDialog = await screen.findByRole("dialog");
    expect(within(confirmDialog).getByText("Create this menu item with the following details?")).toBeInTheDocument();
    expect(within(confirmDialog).getByText("Dup Name")).toBeInTheDocument();
    expect(within(confirmDialog).getByText("Regular")).toBeInTheDocument();
    expect(within(confirmDialog).getByText("Proteins")).toBeInTheDocument();
    expect(within(confirmDialog).getByText("$75.00")).toBeInTheDocument();
    expect(within(confirmDialog).getByText("$140.00")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Create" }));

    await waitFor(() => {
      const confirmDialog = screen.getByRole("dialog");
      expect(within(confirmDialog).getByRole("alert")).toHaveTextContent("Item name must be unique.");
      expect(itemNameInput).toHaveClass("is-invalid");
      expect(within(confirmDialog).getByRole("button", { name: "Create" })).toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Fix" }));
    await waitFor(() => {
      expect(screen.queryByText("Create this menu item?")).not.toBeInTheDocument();
    });
    expect(itemNameInput).toHaveClass("is-invalid");
    expect(screen.getByRole("button", { name: "Create Item" })).toBeDisabled();

    fireEvent.change(itemNameInput, { target: { value: "New Unique Name" } });
    expect(itemNameInput).not.toHaveClass("is-invalid");
    expect(screen.getByRole("button", { name: "Create Item" })).not.toBeDisabled();
  });

  it("edits menu item fields with menu type + group associations from the unified model", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url, options) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({ user: { id: 1, username: "admin", display_name: "Admin", is_active: true } })
        );
      }
      if (url === "/api/menu/general/groups") {
        return Promise.resolve(
          buildResponse({
            groups: [{ id: 10, key: "signature_proteins", name: "Proteins", sort_order: 1, is_active: true }],
          })
        );
      }
      if (url === "/api/menu/formal/groups") {
        return Promise.resolve(
          buildResponse({
            groups: [{ id: 11, key: "entrees", name: "Formal Entrees", sort_order: 1, is_active: true }],
          })
        );
      }
      if (String(url).startsWith("/api/admin/menu/catalog-items?")) {
        return Promise.resolve(
          buildResponse({
            items: [
              {
                id: 5,
                item_name: "Jerk Chicken",
                item_key: "jerk_chicken",
                menu_type: "regular",
                is_active: true,
                group_title: "Proteins",
              },
              {
                id: 1000005,
                item_name: "Jerk Chicken",
                item_key: "jerk_chicken",
                menu_type: "formal",
                is_active: true,
                group_title: "Formal Entrees",
              },
            ],
          })
        );
      }
      if (url === "/api/admin/menu/items/5" && (!options?.method || options.method === "GET")) {
        return Promise.resolve(
          buildResponse({
            item: {
              id: 5,
              menu_type: "regular",
              menu_types: ["regular", "formal"],
              item_name: "Jerk Chicken",
              item_key: "jerk_chicken",
              tray_price_half: "75",
              tray_price_full: "140",
              is_active: true,
              option_group_assignments: [
                { menu_type: "regular", group_id: 10, display_order: 1, is_active: true },
                { menu_type: "formal", group_id: 1000011, display_order: 2, is_active: true },
              ],
              section_row_assignments: [],
              tier_bullet_assignments: [],
            },
          })
        );
      }
      if (url === "/api/admin/menu/items/5" && options?.method === "PATCH") {
        return Promise.resolve(
          buildResponse({
            item: {
              id: 5,
              menu_type: "regular",
              menu_types: ["regular", "formal"],
              item_name: "Jerk Chicken",
              item_key: "jerk_chicken_signature",
              tray_price_half: "80",
              tray_price_full: "145",
              is_active: true,
              option_group_assignments: [
                { menu_type: "regular", group_id: 10, display_order: 1, is_active: true },
                { menu_type: "formal", group_id: 1000011, display_order: 2, is_active: true },
              ],
              section_row_assignments: [],
              tier_bullet_assignments: [],
            },
          })
        );
      }
      if (url === "/api/admin/audit?limit=200") {
        return Promise.resolve(buildResponse({ entries: [] }));
      }
      return Promise.resolve(buildResponse({}, false));
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="/admin/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Jerk Chicken");
    fireEvent.click(screen.getByText("Jerk Chicken"));
    await screen.findByText("Edit Menu Item");

    expect(screen.getByLabelText("Regular")).toBeChecked();
    expect(screen.getByLabelText("Formal")).toBeChecked();

    fireEvent.change(screen.getByLabelText("Half Tray Price"), { target: { value: "8000" } });
    fireEvent.change(screen.getByLabelText("Full Tray Price"), { target: { value: "14500" } });

    fireEvent.click(screen.getByRole("button", { name: "Update Item" }));
    const confirmDialog = await screen.findByRole("dialog");
    expect(within(confirmDialog).queryByText("Apply item changes and assignments?")).not.toBeInTheDocument();
    expect(within(confirmDialog).getByText("$80.00")).toBeInTheDocument();
    expect(within(confirmDialog).getByText("$145.00")).toBeInTheDocument();
    expect(within(confirmDialog).queryByText(/Menu Type:/i)).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Update" }));

    await waitFor(() => {
      const updateCall = globalThis.fetch.mock.calls.find(
        (call) => call[0] === "/api/admin/menu/items/5" && call[1]?.method === "PATCH"
      );
      expect(updateCall).toBeTruthy();
      const payload = JSON.parse(updateCall[1].body);
      expect(payload.item_key).toBeUndefined();
      expect(payload.item_type).toBeUndefined();
      expect(payload.item_category).toBeUndefined();
      expect(payload.menu_type).toEqual(["regular", "formal"]);
      expect(payload.tray_price_half).toBe("80.00");
      expect(payload.tray_price_full).toBe("145.00");
      expect(payload.option_group_assignments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ menu_type: "regular", group_id: 10 }),
          expect.objectContaining({ menu_type: "formal", group_id: 1000011 }),
        ])
      );
    });
    expect(screen.getByTestId("edit-menu-item-card")).toHaveClass("admin-edit-card-created");
    expect(screen.queryByText("Saved menu item: Jerk Chicken")).not.toBeInTheDocument();
  });

  it("allows unselecting all menu types and saves item as inactive", async () => {
    let itemWasDeactivated = false;
    vi.spyOn(globalThis, "fetch").mockImplementation((url, options) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({ user: { id: 1, username: "admin", display_name: "Admin", is_active: true } })
        );
      }
      if (url === "/api/menu/general/groups") {
        return Promise.resolve(
          buildResponse({
            groups: [{ id: 10, key: "signature_proteins", name: "Proteins", sort_order: 1, is_active: true }],
          })
        );
      }
      if (url === "/api/menu/formal/groups") {
        return Promise.resolve(
          buildResponse({
            groups: [{ id: 11, key: "entrees", name: "Formal Entrees", sort_order: 1, is_active: true }],
          })
        );
      }
      if (String(url).startsWith("/api/admin/menu/catalog-items?")) {
        if (itemWasDeactivated) {
          return Promise.resolve(
            buildResponse({
              items: [
                {
                  id: 5,
                  item_name: "Jerk Chicken",
                  item_key: "jerk_chicken",
                  menu_type: null,
                  menu_types: [],
                  is_active: false,
                  group_title: null,
                },
              ],
            })
          );
        }
        return Promise.resolve(
          buildResponse({
            items: [
              {
                id: 5,
                item_name: "Jerk Chicken",
                item_key: "jerk_chicken",
                menu_type: "regular",
                is_active: true,
                group_title: "Proteins",
              },
            ],
          })
        );
      }
      if (url === "/api/admin/menu/items/5" && (!options?.method || options.method === "GET")) {
        return Promise.resolve(
          buildResponse({
            item: {
              id: 5,
              menu_type: "regular",
              menu_types: ["regular"],
              item_name: "Jerk Chicken",
              item_key: "jerk_chicken",
              tray_price_half: "75",
              tray_price_full: "140",
              is_active: true,
              option_group_assignments: [{ menu_type: "regular", group_id: 10, display_order: 1, is_active: true }],
              section_row_assignments: [],
              tier_bullet_assignments: [],
            },
          })
        );
      }
      if (url === "/api/admin/menu/items/5" && options?.method === "PATCH") {
        itemWasDeactivated = true;
        return Promise.resolve(
          buildResponse({
            item: {
              id: 5,
              menu_type: "regular",
              menu_types: [],
              item_name: "Jerk Chicken",
              item_key: "jerk_chicken",
              tray_price_half: "75",
              tray_price_full: "140",
              is_active: false,
              option_group_assignments: [],
              section_row_assignments: [],
              tier_bullet_assignments: [],
            },
          })
        );
      }
      if (url === "/api/admin/audit?limit=200") {
        return Promise.resolve(buildResponse({ entries: [] }));
      }
      return Promise.resolve(buildResponse({}, false));
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="/admin/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Jerk Chicken");
    fireEvent.click(screen.getByText("Jerk Chicken"));
    await screen.findByText("Edit Menu Item");

    const regularCheckbox = screen.getByLabelText("Regular");
    expect(regularCheckbox).toBeChecked();
    fireEvent.click(regularCheckbox);
    expect(regularCheckbox).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Update Item" }));
    fireEvent.click(await screen.findByRole("button", { name: "Update" }));

    await waitFor(() => {
      const updateCall = globalThis.fetch.mock.calls.find(
        (call) => call[0] === "/api/admin/menu/items/5" && call[1]?.method === "PATCH"
      );
      expect(updateCall).toBeTruthy();
      const payload = JSON.parse(updateCall[1].body);
      expect(payload.is_active).toBe(false);
      expect(payload.menu_type).toEqual([]);
      expect(payload.option_group_assignments).toEqual([]);
    });
    await waitFor(() => {
      expect(screen.getByText("None")).toBeInTheDocument();
    });
  });

  it("deletes menu item from the edit form after confirmation", async () => {
    let itemDeleted = false;
    vi.spyOn(globalThis, "fetch").mockImplementation((url, options) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({ user: { id: 1, username: "admin", display_name: "Admin", is_active: true } })
        );
      }
      if (url === "/api/menu/general/groups") {
        return Promise.resolve(
          buildResponse({
            groups: [{ id: 10, key: "signature_proteins", name: "Proteins", sort_order: 1, is_active: true }],
          })
        );
      }
      if (url === "/api/menu/formal/groups") {
        return Promise.resolve(
          buildResponse({
            groups: [{ id: 11, key: "entrees", name: "Formal Entrees", sort_order: 1, is_active: true }],
          })
        );
      }
      if (String(url).startsWith("/api/admin/menu/catalog-items?")) {
        if (itemDeleted) {
          return Promise.resolve(buildResponse({ items: [] }));
        }
        return Promise.resolve(
          buildResponse({
            items: [
              {
                id: 5,
                item_name: "Jerk Chicken",
                item_key: "jerk_chicken",
                menu_type: "regular",
                is_active: true,
                group_title: "Proteins",
              },
            ],
          })
        );
      }
      if (url === "/api/admin/menu/items/5" && (!options?.method || options.method === "GET")) {
        return Promise.resolve(
          buildResponse({
            item: {
              id: 5,
              menu_type: "regular",
              menu_types: ["regular"],
              item_name: "Jerk Chicken",
              item_key: "jerk_chicken",
              tray_price_half: "75",
              tray_price_full: "140",
              is_active: true,
              option_group_assignments: [{ menu_type: "regular", group_id: 10, display_order: 1, is_active: true }],
              section_row_assignments: [],
              tier_bullet_assignments: [],
            },
          })
        );
      }
      if (url === "/api/admin/menu/items/5" && options?.method === "DELETE") {
        itemDeleted = true;
        return Promise.resolve(buildResponse({ ok: true, deleted_item_id: 5, item_name: "Jerk Chicken" }));
      }
      if (url === "/api/admin/audit?limit=200") {
        return Promise.resolve(buildResponse({ entries: [] }));
      }
      return Promise.resolve(buildResponse({}, false));
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="/admin/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Jerk Chicken");
    fireEvent.click(screen.getByText("Jerk Chicken"));
    await screen.findByText("Edit Menu Item");

    fireEvent.click(screen.getByRole("button", { name: "Delete Item" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => {
      const deleteCall = globalThis.fetch.mock.calls.find(
        (call) => call[0] === "/api/admin/menu/items/5" && call[1]?.method === "DELETE"
      );
      expect(deleteCall).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.queryByText("Edit Menu Item")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Deleted menu item: Jerk Chicken")).not.toBeInTheDocument();
  });

  it("stacks grouped menu type/group/status rows and applies local menu item filters", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({ user: { id: 1, username: "admin", display_name: "Admin", is_active: true } })
        );
      }
      if (url === "/api/menu/general/groups") {
        return Promise.resolve(buildResponse({ groups: [] }));
      }
      if (url === "/api/menu/formal/groups") {
        return Promise.resolve(buildResponse({ groups: [] }));
      }
      if (String(url).startsWith("/api/admin/menu/catalog-items?")) {
        return Promise.resolve(
          buildResponse({
            items: [
              {
                id: 1,
                item_name: "Jerk Chicken",
                item_key: "jerk_chicken",
                menu_type: "regular",
                is_active: true,
                group_title: "Proteins",
              },
              {
                id: 1000001,
                item_name: "Jerk Chicken",
                item_key: "jerk_chicken",
                menu_type: "formal",
                is_active: false,
                group_title: "Formal Entrees",
              },
              {
                id: 2,
                item_name: "Rice",
                item_key: "rice",
                menu_type: "regular",
                is_active: true,
                group_title: "Sides",
              },
            ],
          })
        );
      }
      return Promise.resolve(buildResponse({}, false));
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="/admin/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Jerk Chicken");
    expect(screen.getAllByText("Jerk Chicken")).toHaveLength(1);

    const jerkItemName = screen.getByText("Jerk Chicken");
    const jerkRow = jerkItemName.closest("tr");
    expect(jerkRow).toBeTruthy();

    const rowScope = within(jerkRow);
    expect(rowScope.getByText("Regular")).toBeInTheDocument();
    expect(rowScope.getByText("Formal")).toBeInTheDocument();
    expect(rowScope.getByRole("button", { name: "Set active" })).toBeInTheDocument();
    expect(rowScope.getByRole("img", { name: "Inactive" })).toBeInTheDocument();
    expect(rowScope.getByText("Proteins")).toBeInTheDocument();
    expect(rowScope.getByText("Formal Entrees")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Find Menu Items" }));

    fireEvent.change(screen.getByLabelText("Filter Menu Type"), { target: { value: "formal" } });
    expect(screen.getByText("Jerk Chicken")).toBeInTheDocument();
    expect(screen.queryByText("Rice")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter Group"), { target: { value: "Formal Entrees" } });
    expect(screen.getByText("Jerk Chicken")).toBeInTheDocument();
    expect(screen.queryByText("Rice")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Item Status"), { target: { value: "false" } });
    expect(screen.getByText("Jerk Chicken")).toBeInTheDocument();
    expect(screen.queryByText("Rice")).not.toBeInTheDocument();
  });
});


