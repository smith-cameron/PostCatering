import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminLogin from "./AdminLogin";

const buildResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

describe("AdminLogin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects to /admin when session already exists", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(buildResponse({ user: { id: 1, username: "admin" } }));

    render(
      <MemoryRouter initialEntries={["/admin/login"]}>
        <Routes>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<div>Admin Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Admin Home")).toBeInTheDocument();
  });

  it("shows an error for invalid credentials", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(buildResponse({ error: "Unauthorized" }, false, 401))
      .mockResolvedValueOnce(buildResponse({ error: "Invalid username or password." }, false, 401));

    render(
      <MemoryRouter initialEntries={["/admin/login"]}>
        <Routes>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<div>Admin Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("button", { name: "Sign In" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() =>
      expect(screen.getByText("Invalid username or password.")).toBeInTheDocument()
    );
  });
});
