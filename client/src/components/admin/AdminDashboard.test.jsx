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
    expect(screen.queryByPlaceholderText("Half Tray Price")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Full Tray Price")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Item Name"), { target: { value: "Jerk Chicken" } });
    fireEvent.change(screen.getByLabelText("Menu Type"), { target: { value: "regular" } });
    expect(screen.getByLabelText("Group")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Half Tray Price")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Full Tray Price")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Proteins" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Formal Entrees" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Group"), { target: { value: "10" } });
    fireEvent.change(screen.getByPlaceholderText("Half Tray Price"), { target: { value: "75" } });
    fireEvent.change(screen.getByPlaceholderText("Full Tray Price"), { target: { value: "140" } });

    fireEvent.click(screen.getByRole("button", { name: "Create Item" }));
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
      expect(payload.tray_price_half).toBe("75");
      expect(payload.tray_price_full).toBe("140");
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
      expect(screen.queryByPlaceholderText("Half Tray Price")).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText("Full Tray Price")).not.toBeInTheDocument();
    });
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

    fireEvent.change(screen.getByLabelText("Half Tray Price"), { target: { value: "80" } });
    fireEvent.change(screen.getByLabelText("Full Tray Price"), { target: { value: "145" } });

    fireEvent.click(screen.getByRole("button", { name: "Save Item" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

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
      expect(payload.tray_price_half).toBe("80");
      expect(payload.tray_price_full).toBe("145");
      expect(payload.option_group_assignments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ menu_type: "regular", group_id: 10 }),
          expect.objectContaining({ menu_type: "formal", group_id: 1000011 }),
        ])
      );
    });
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

    fireEvent.click(screen.getByRole("button", { name: "Save Item" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

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

    await screen.findByText("Menu Items");
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
    expect(screen.getByText("Deleted menu item: Jerk Chicken")).toBeInTheDocument();
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

    await screen.findByText("Menu Items");

    expect(screen.getAllByText("Jerk Chicken")).toHaveLength(1);

    const jerkKey = screen.getByText("jerk_chicken");
    const jerkRow = jerkKey.closest("tr");
    expect(jerkRow).toBeTruthy();

    const rowScope = within(jerkRow);
    expect(rowScope.getByText("Regular")).toBeInTheDocument();
    expect(rowScope.getByText("Formal")).toBeInTheDocument();
    expect(rowScope.getByText("Active")).toBeInTheDocument();
    expect(rowScope.getByText("Inactive")).toBeInTheDocument();
    expect(rowScope.getByText("Proteins")).toBeInTheDocument();
    expect(rowScope.getByText("Formal Entrees")).toBeInTheDocument();

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
