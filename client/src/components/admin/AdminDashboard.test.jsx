import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      expect(screen.getByLabelText("Group")).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Formal Entrees" })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "Proteins" })).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText("Half Tray Price")).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText("Full Tray Price")).not.toBeInTheDocument();
    });
  });
});
