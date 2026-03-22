import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Context from "../../context";
import AdminLayout from "./AdminLayout";

const buildResponse = (body, ok = true) => ({
  ok,
  json: async () => body,
});

describe("AdminLayout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders routed admin tabs inside the shared dashboard shell", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({
            user: {
              id: 1,
              username: "admin",
              display_name: "Admin",
              access_tier: 1,
              can_manage_admin_users: true,
              is_active: true,
            },
          })
        );
      }
      return Promise.resolve(buildResponse({ error: `Unexpected URL: ${url}` }, false));
    });

    render(
      <Context.Provider value={{ isDarkTheme: false, setThemeMode: vi.fn() }}>
        <MemoryRouter initialEntries={["/admin/service-packages"]}>
          <Routes>
            <Route path="/admin" element={<AdminLayout />}>
              <Route path="menu-items" element={<div>Menu Page</div>} />
              <Route path="service-packages" element={<div>Packages Page</div>} />
              <Route path="media" element={<div>Media Page</div>} />
              <Route path="settings" element={<div>Settings Page</div>} />
            </Route>
            <Route path="/admin/login" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </Context.Provider>
    );

    expect(await screen.findByText("Packages Page")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Service Packages" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Media Manager" }));
    expect(await screen.findByText("Media Page")).toBeInTheDocument();
  });
});
