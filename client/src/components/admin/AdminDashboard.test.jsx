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
      if (url === "/api/admin/menu/reference-data") {
        return Promise.resolve(buildResponse({ catalogs: [], option_groups: [], sections: [], tiers: [] }));
      }
      if (String(url).startsWith("/api/admin/menu/items?")) {
        return Promise.resolve(buildResponse({ items: [] }));
      }
      if (String(url).startsWith("/api/admin/menu/sections?")) {
        return Promise.resolve(buildResponse({ sections: [] }));
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

  it("renders structured section controls instead of JSON textareas", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({ user: { id: 1, username: "admin", display_name: "Admin", is_active: true } })
        );
      }
      if (url === "/api/admin/menu/reference-data") {
        return Promise.resolve(
          buildResponse({
            catalogs: [{ id: 1, catalog_key: "community", page_title: "Community", display_order: 1, is_active: true }],
            option_groups: [{ id: 10, option_key: "proteins", title: "Proteins", is_active: true }],
            sections: [{ id: 1, catalog_key: "community", title: "Entrees", is_active: true }],
            tiers: [{ id: 100, section_id: 1, tier_title: "Tier 1", is_active: true }],
          })
        );
      }
      if (String(url).startsWith("/api/admin/menu/items?")) {
        return Promise.resolve(buildResponse({ items: [] }));
      }
      if (String(url).startsWith("/api/admin/menu/sections?")) {
        return Promise.resolve(
          buildResponse({
            sections: [
              {
                id: 1,
                catalog_key: "community",
                section_key: "community_entrees",
                title: "Entrees",
                price: "",
                is_active: true,
              },
            ],
          })
        );
      }
      if (url === "/api/admin/menu/sections/1") {
        return Promise.resolve(
          buildResponse({
            section: {
              id: 1,
              catalog_key: "community",
              section_key: "community_entrees",
              title: "Entrees",
              description: "",
              price: "",
              section_type: "",
              category: "",
              course_type: "",
              display_order: 1,
              is_active: true,
              include_groups: [{ id: 91, group_id: 10, option_key: "proteins", group_title: "Proteins", is_active: true }],
              constraints: [{ id: 77, constraint_key: "proteins", min_select: 1, max_select: 2, is_active: true }],
              tiers: [
                {
                  id: 100,
                  tier_title: "Tier 1",
                  price: "$18",
                  display_order: 1,
                  is_active: true,
                  constraints: [{ id: 88, constraint_key: "proteins", min_select: 1, max_select: 1, is_active: true }],
                },
              ],
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

    await screen.findByText("Sections");
    fireEvent.click(await screen.findByText("Entrees"));

    await screen.findByText("Edit Section Metadata & Rules");
    expect(screen.getByText("Section Constraints")).toBeInTheDocument();
    expect(screen.getByText("Tier Settings")).toBeInTheDocument();
    expect(screen.queryByText("Constraints JSON")).not.toBeInTheDocument();
    expect(screen.queryByText("Tiers JSON")).not.toBeInTheDocument();
  });
});
