import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Context from "../../context";
import AdminServicePlansPage from "./AdminServicePlansPage";

const buildResponse = (body, ok = true) => ({
  ok,
  json: async () => body,
});

describe("AdminServicePlansPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads authenticated service-plan sections", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({
            user: {
              id: 1,
              username: "admin",
              display_name: "Admin",
              is_active: true,
            },
          })
        );
      }

      if (url === "/api/admin/service-plans?catalog_key=catering&include_inactive=true") {
        return Promise.resolve(
          buildResponse({
            sections: [
              {
                id: 1,
                section_type: "packages",
                title: "Catering Packages",
                is_active: true,
                plans: [
                  {
                    id: 10,
                    title: "Taco Bar",
                    price: "$18-$25 per person",
                    is_active: true,
                  },
                ],
              },
              {
                id: 2,
                section_type: "include_menu",
                title: "Menu Options",
                is_active: true,
                include_keys: ["entree", "side"],
                plans: [],
              },
            ],
          })
        );
      }

      return Promise.resolve(buildResponse({ error: `Unexpected URL: ${url}` }, false));
    });

    render(
      <Context.Provider value={{ isDarkTheme: false, setThemeMode: vi.fn() }}>
        <MemoryRouter initialEntries={["/admin/service-packages"]}>
          <Routes>
            <Route path="/admin/service-packages" element={<AdminServicePlansPage />} />
            <Route path="/admin/login" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </Context.Provider>
    );

    expect(await screen.findByText("Service Packages")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Catering Packages" })).toBeInTheDocument();
    expect(await screen.findByText("Taco Bar")).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "Active" })).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Menu Options" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Create New Catering Package" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Edit Taco Bar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Up" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Down" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Publicly visible")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Selectable in inquiry flow")).not.toBeInTheDocument();
    expect(screen.queryByText("Select section")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/admin/auth/me", expect.anything());
    });
  });

  it("toggles package active status from the display table", async () => {
    let listRequestCount = 0;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
      const method = String(options?.method || "GET").toUpperCase();

      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({
            user: {
              id: 1,
              username: "admin",
              display_name: "Admin",
              is_active: true,
            },
          })
        );
      }

      if (url === "/api/admin/service-plans?catalog_key=catering&include_inactive=true" && method === "GET") {
        listRequestCount += 1;
        const isActive = listRequestCount > 1;
        return Promise.resolve(
          buildResponse({
            sections: [
              {
                id: 1,
                section_type: "packages",
                title: "Catering Packages",
                is_active: true,
                plans: [
                  {
                    id: 10,
                    title: "Taco Bar",
                    price: "$18-$25 per person",
                    is_active: isActive,
                  },
                ],
              },
            ],
          })
        );
      }

      if (url === "/api/admin/service-plans/10" && method === "PATCH") {
        return Promise.resolve(
          buildResponse({
            plan: {
              id: 10,
              section_id: 1,
              title: "Taco Bar",
              price: "$18-$25 per person",
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
            <Route path="/admin/service-packages" element={<AdminServicePlansPage />} />
            <Route path="/admin/login" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </Context.Provider>
    );

    await screen.findByText("Taco Bar");
    fireEvent.click(screen.getByRole("button", { name: "Set active" }));

    await waitFor(() => {
      const updateRequest = fetchSpy.mock.calls.find(
        ([requestUrl, requestOptions]) =>
          requestUrl === "/api/admin/service-plans/10" &&
          String(requestOptions?.method || "").toUpperCase() === "PATCH"
      );
      expect(updateRequest).toBeTruthy();
      expect(JSON.parse(updateRequest[1].body)).toEqual({
        is_active: true,
      });
    });

    await screen.findByRole("button", { name: "Set inactive" });
    expect(screen.getByRole("img", { name: "Active" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Edit Taco Bar" })).not.toBeInTheDocument();
  });

  it("deletes a selected package from the edit form with the shared confirm modal", async () => {
    let listRequestCount = 0;
    const confirmSpy = vi.spyOn(window, "confirm");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
      const method = String(options?.method || "GET").toUpperCase();

      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({
            user: {
              id: 1,
              username: "admin",
              display_name: "Admin",
              is_active: true,
            },
          })
        );
      }

      if (url === "/api/admin/service-plans?catalog_key=catering&include_inactive=true" && method === "GET") {
        listRequestCount += 1;
        return Promise.resolve(
          buildResponse({
            sections: [
              {
                id: 1,
                section_type: "packages",
                title: "Catering Packages",
                is_active: true,
                plans:
                  listRequestCount === 1
                    ? [
                        {
                          id: 10,
                          title: "Taco Bar",
                          price: "$18-$25 per person",
                          is_active: true,
                        },
                      ]
                    : [],
              },
            ],
          })
        );
      }

      if (url === "/api/admin/service-plans/10?hard_delete=true" && method === "DELETE") {
        return Promise.resolve(buildResponse({ ok: true, deleted_plan_id: 10 }));
      }

      return Promise.resolve(buildResponse({ error: `Unexpected URL: ${url}` }, false));
    });

    render(
      <Context.Provider value={{ isDarkTheme: false, setThemeMode: vi.fn() }}>
        <MemoryRouter initialEntries={["/admin/service-packages"]}>
          <Routes>
            <Route path="/admin/service-packages" element={<AdminServicePlansPage />} />
            <Route path="/admin/login" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </Context.Provider>
    );

    await screen.findByText("Taco Bar");
    expect(screen.queryByRole("button", { name: "Delete Package" })).not.toBeInTheDocument();

    const packageRow = screen.getByText("Taco Bar").closest("tr");
    expect(packageRow).toBeTruthy();
    fireEvent.click(packageRow);
    await screen.findByRole("heading", { name: "Edit Taco Bar" });

    fireEvent.click(screen.getByRole("button", { name: "Delete Package" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("This permanently removes the package from both the admin table and the public catalog.")).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      const deleteRequest = fetchSpy.mock.calls.find(
        ([requestUrl, requestOptions]) =>
          requestUrl === "/api/admin/service-plans/10?hard_delete=true" &&
          String(requestOptions?.method || "").toUpperCase() === "DELETE"
      );
      expect(deleteRequest).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.queryByText("Taco Bar")).not.toBeInTheDocument();
    });
    expect(screen.getByText("No packages in this section yet.")).toBeInTheDocument();
  });

  it("reorders service packages by drag and drop", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
      const method = String(options?.method || "GET").toUpperCase();

      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({
            user: {
              id: 1,
              username: "admin",
              display_name: "Admin",
              is_active: true,
            },
          })
        );
      }

      if (url === "/api/admin/service-plans?catalog_key=catering&include_inactive=true" && method === "GET") {
        return Promise.resolve(
          buildResponse({
            sections: [
              {
                id: 1,
                section_type: "packages",
                title: "Catering Packages",
                is_active: true,
                plans: [
                  {
                    id: 10,
                    title: "Taco Bar",
                    price: "$18-$25 per person",
                    sort_order: 1,
                    is_active: true,
                  },
                  {
                    id: 11,
                    title: "Hearty Homestyle Packages",
                    price: "$20-$28 per person",
                    sort_order: 2,
                    is_active: true,
                  },
                ],
              },
            ],
          })
        );
      }

      if (url === "/api/admin/service-plans/reorder" && method === "PATCH") {
        return Promise.resolve(buildResponse({ ok: true }));
      }

      return Promise.resolve(buildResponse({ error: `Unexpected URL: ${url}` }, false));
    });

    render(
      <Context.Provider value={{ isDarkTheme: false, setThemeMode: vi.fn() }}>
        <MemoryRouter initialEntries={["/admin/service-packages"]}>
          <Routes>
            <Route path="/admin/service-packages" element={<AdminServicePlansPage />} />
            <Route path="/admin/login" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </Context.Provider>
    );

    await screen.findByText("Taco Bar");
    const draggedRow = screen.getByText("Taco Bar").closest("tr");
    const targetRow = screen.getByText("Hearty Homestyle Packages").closest("tr");
    expect(draggedRow).toBeTruthy();
    expect(targetRow).toBeTruthy();

    const dataTransfer = {
      effectAllowed: "move",
      setData: vi.fn(),
    };

    fireEvent.dragStart(draggedRow, { dataTransfer });
    fireEvent.dragOver(targetRow, { dataTransfer });
    fireEvent.drop(targetRow, { dataTransfer });

    await waitFor(() => {
      const reorderRequest = fetchSpy.mock.calls.find(
        ([requestUrl, requestOptions]) =>
          requestUrl === "/api/admin/service-plans/reorder" &&
          String(requestOptions?.method || "").toUpperCase() === "PATCH"
      );
      expect(reorderRequest).toBeTruthy();
      expect(JSON.parse(reorderRequest[1].body)).toEqual({
        section_id: 1,
        catalog_key: "catering",
        ordered_plan_ids: [11, 10],
      });
    });
  });

  it("supports specific catering choice families when editing a package", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({
            user: {
              id: 1,
              username: "admin",
              display_name: "Admin",
              is_active: true,
            },
          })
        );
      }

      if (url === "/api/admin/service-plans?catalog_key=catering&include_inactive=true") {
        return Promise.resolve(
          buildResponse({
            sections: [
              {
                id: 1,
                catalog_key: "catering",
                section_type: "packages",
                title: "Catering Packages",
                is_active: true,
                plans: [
                  {
                    id: 11,
                    section_id: 1,
                    catalog_key: "catering",
                    title: "Entree and Salad Lunch",
                    price: "$30-$40 per person",
                    is_active: true,
                    constraints: [
                      { selection_key: "entree", min_select: 1, max_select: 1 },
                      { selection_key: "salads", min_select: 1, max_select: 1 },
                    ],
                    details: ["Bread"],
                  },
                ],
              },
            ],
          })
        );
      }

      return Promise.resolve(buildResponse({ error: `Unexpected URL: ${url}` }, false));
    });

    render(
      <Context.Provider value={{ isDarkTheme: false, setThemeMode: vi.fn() }}>
        <MemoryRouter initialEntries={["/admin/service-packages"]}>
          <Routes>
            <Route path="/admin/service-packages" element={<AdminServicePlansPage />} />
            <Route path="/admin/login" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </Context.Provider>
    );

    await screen.findByText("Entree and Salad Lunch");
    fireEvent.click(screen.getByText("Entree and Salad Lunch").closest("tr"));

    expect(screen.getByRole("heading", { name: "Edit Entree and Salad Lunch" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Entrees Only")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Salads Only")).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("Min")).toHaveLength(2);
    expect(screen.getAllByPlaceholderText("Max")).toHaveLength(2);
    expect(screen.getByDisplayValue("Bread")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Sides / Salads")).not.toBeInTheDocument();
  });

  it("surfaces custom customer choices when editing a package like taco bar", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({
            user: {
              id: 1,
              username: "admin",
              display_name: "Admin",
              is_active: true,
            },
          })
        );
      }

      if (url === "/api/admin/service-plans?catalog_key=catering&include_inactive=true") {
        return Promise.resolve(
          buildResponse({
            sections: [
              {
                id: 1,
                catalog_key: "catering",
                section_type: "packages",
                title: "Catering Packages",
                is_active: true,
                plans: [
                  {
                    id: 10,
                    section_id: 1,
                    catalog_key: "catering",
                    title: "Taco Bar",
                    price: "$18-$25 per person",
                    is_active: true,
                    constraints: [{ selection_key: "signature_protein", min_select: 1, max_select: 1 }],
                    details: ["Spanish rice", "Refried beans", "Tortillas", "Toppings"],
                    selection_groups: [
                      {
                        group_key: "signature_protein",
                        group_title: "Taco Bar Proteins",
                        min_select: 1,
                        max_select: 1,
                        options: [
                          { option_key: "carne_asada", option_label: "Carne Asada" },
                          { option_key: "chicken", option_label: "Chicken" },
                          { option_key: "marinated_pork", option_label: "Marinated Pork" },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          })
        );
      }

      return Promise.resolve(buildResponse({ error: `Unexpected URL: ${url}` }, false));
    });

    render(
      <Context.Provider value={{ isDarkTheme: false, setThemeMode: vi.fn() }}>
        <MemoryRouter initialEntries={["/admin/service-packages"]}>
          <Routes>
            <Route path="/admin/service-packages" element={<AdminServicePlansPage />} />
            <Route path="/admin/login" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </Context.Provider>
    );

    await screen.findByText("Taco Bar");
    fireEvent.click(screen.getByText("Taco Bar").closest("tr"));

    expect(screen.getByRole("heading", { name: "Edit Taco Bar" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Custom options")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Taco Bar Proteins")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Add one option per line")).toHaveValue("Carne Asada\nChicken\nMarinated Pork");
    expect(screen.queryByDisplayValue("Entrees / Signature Proteins")).not.toBeInTheDocument();
  });

  it("creates a package in the section opened from the package list", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
      const method = String(options?.method || "GET").toUpperCase();

      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({
            user: {
              id: 1,
              username: "admin",
              display_name: "Admin",
              is_active: true,
            },
          })
        );
      }

      if (url === "/api/admin/service-plans?catalog_key=catering&include_inactive=true" && method === "GET") {
        return Promise.resolve(
          buildResponse({
            sections: [
              {
                id: 1,
                catalog_key: "catering",
                section_type: "packages",
                title: "Catering Packages",
                is_active: true,
                plans: [],
              },
              {
                id: 2,
                catalog_key: "catering",
                section_type: "packages",
                title: "Interactive Stations",
                is_active: true,
                plans: [],
              },
            ],
          })
        );
      }

      if (url === "/api/admin/service-plans" && method === "POST") {
        return Promise.resolve(
          buildResponse({
            plan: {
              id: 20,
              section_id: 2,
              title: "Omelette Bar",
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
            <Route path="/admin/service-packages" element={<AdminServicePlansPage />} />
            <Route path="/admin/login" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </Context.Provider>
    );

    expect(await screen.findByRole("heading", { name: "Interactive Stations" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Create New Catering Package" })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Add Package" })[1]);
    expect(screen.getByRole("heading", { name: "Create New Catering Package" })).toBeInTheDocument();
    expect(screen.getAllByText("Interactive Stations").length).toBeGreaterThan(0);
    expect(screen.queryByText("New packages are created in the section you opened from the package list.")).not.toBeInTheDocument();
    expect(screen.queryByText("Select section")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByPlaceholderText("45-89")).toBeInTheDocument();
    expect(screen.getByText(/Dollar signs and/i)).toBeInTheDocument();

    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "Omelette Bar" },
    });
    fireEvent.change(screen.getByLabelText("Price Display"), {
      target: { value: "45-89" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Package" }));
    fireEvent.click(await screen.findByRole("button", { name: "Create" }));

    await waitFor(() => {
      const createRequest = fetchSpy.mock.calls.find(
        ([requestUrl, requestOptions]) =>
          requestUrl === "/api/admin/service-plans" &&
          String(requestOptions?.method || "").toUpperCase() === "POST"
      );
      expect(createRequest).toBeTruthy();
      expect(JSON.parse(createRequest[1].body)).toMatchObject({
        section_id: 2,
        title: "Omelette Bar",
        price: "$45-$89 per person",
        is_active: false,
      });
    });
  });

  it("can make a reviewed package active from the confirm modal", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
      const method = String(options?.method || "GET").toUpperCase();

      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({
            user: {
              id: 1,
              username: "admin",
              display_name: "Admin",
              is_active: true,
            },
          })
        );
      }

      if (url === "/api/admin/service-plans?catalog_key=catering&include_inactive=true" && method === "GET") {
        return Promise.resolve(
          buildResponse({
            sections: [
              {
                id: 1,
                catalog_key: "catering",
                section_type: "packages",
                title: "Catering Packages",
                is_active: true,
                plans: [],
              },
            ],
          })
        );
      }

      if (url === "/api/admin/service-plans" && method === "POST") {
        return Promise.resolve(
          buildResponse({
            plan: {
              id: 22,
              section_id: 1,
              title: "Dessert Table",
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
            <Route path="/admin/service-packages" element={<AdminServicePlansPage />} />
            <Route path="/admin/login" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </Context.Provider>
    );

    await screen.findByRole("heading", { name: "Catering Packages" });
    fireEvent.click(screen.getByRole("button", { name: "Add Package" }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Dessert Table" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Package" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("No")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Create" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Make Active" }));

    await waitFor(() => {
      expect(screen.getByRole("checkbox")).toBeChecked();
      expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Create" })).toBeInTheDocument();
    });

    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const createRequest = fetchSpy.mock.calls.find(
        ([requestUrl, requestOptions]) =>
          requestUrl === "/api/admin/service-plans" &&
          String(requestOptions?.method || "").toUpperCase() === "POST"
      );
      expect(createRequest).toBeTruthy();
      expect(JSON.parse(createRequest[1].body)).toMatchObject({
        section_id: 1,
        title: "Dessert Table",
        is_active: true,
      });
    });
  });

  it("saves customer choice rows into derived constraints and custom options", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
      const method = String(options?.method || "GET").toUpperCase();

      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({
            user: {
              id: 1,
              username: "admin",
              display_name: "Admin",
              is_active: true,
            },
          })
        );
      }

      if (url === "/api/admin/service-plans?catalog_key=catering&include_inactive=true" && method === "GET") {
        return Promise.resolve(
          buildResponse({
            sections: [
              {
                id: 1,
                catalog_key: "catering",
                section_type: "packages",
                title: "Catering Packages",
                is_active: true,
                plans: [],
              },
            ],
          })
        );
      }

      if (url === "/api/admin/service-plans" && method === "POST") {
        return Promise.resolve(
          buildResponse({
            plan: {
              id: 20,
              section_id: 1,
              title: "Omelette Bar",
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
            <Route path="/admin/service-packages" element={<AdminServicePlansPage />} />
            <Route path="/admin/login" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </Context.Provider>
    );

    await screen.findByRole("heading", { name: "Catering Packages" });
    fireEvent.click(screen.getByRole("button", { name: "Add Package" }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Omelette Bar" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Customer Choice" }));
    fireEvent.change(screen.getByLabelText("Choice source 1"), {
      target: { value: "custom_options" },
    });
    fireEvent.change(screen.getByPlaceholderText("Choice label"), {
      target: { value: "Omelette Fillings" },
    });
    fireEvent.change(screen.getByPlaceholderText("Min"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByPlaceholderText("Max"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByPlaceholderText("Add one option per line"), {
      target: { value: "Cheese\nSpinach\nBacon" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Package" }));
    fireEvent.click(await screen.findByRole("button", { name: "Create" }));

    await waitFor(() => {
      const createRequest = fetchSpy.mock.calls.find(
        ([requestUrl, requestOptions]) =>
          requestUrl === "/api/admin/service-plans" &&
          String(requestOptions?.method || "").toUpperCase() === "POST"
      );
      expect(createRequest).toBeTruthy();
      expect(JSON.parse(createRequest[1].body)).toMatchObject({
        section_id: 1,
        title: "Omelette Bar",
        selection_mode: "custom_options",
        constraints: [{ selection_key: "omelette_fillings", min: 2, max: 3 }],
        selection_groups: [
          {
            group_key: "omelette_fillings",
            group_title: "Omelette Fillings",
            source_type: "custom_options",
            min_select: 2,
            max_select: 3,
            options: [
              { option_key: "cheese", option_label: "Cheese", sort_order: 1 },
              { option_key: "spinach", option_label: "Spinach", sort_order: 2 },
              { option_key: "bacon", option_label: "Bacon", sort_order: 3 },
            ],
          },
        ],
      });
    });
  });

  it("shows the custom-options note only while a custom customer choice is selected", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
      const method = String(options?.method || "GET").toUpperCase();

      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({
            user: {
              id: 1,
              username: "admin",
              display_name: "Admin",
              is_active: true,
            },
          })
        );
      }

      if (url === "/api/admin/service-plans?catalog_key=catering&include_inactive=true" && method === "GET") {
        return Promise.resolve(
          buildResponse({
            sections: [
              {
                id: 1,
                catalog_key: "catering",
                section_type: "packages",
                title: "Catering Packages",
                is_active: true,
                plans: [],
              },
            ],
          })
        );
      }

      if (url === "/api/admin/service-plans" && method === "POST") {
        return Promise.resolve(
          buildResponse({
            plan: {
              id: 23,
              section_id: 1,
              title: "Taco Bar",
              is_active: false,
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
            <Route path="/admin/service-packages" element={<AdminServicePlansPage />} />
            <Route path="/admin/login" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </Context.Provider>
    );

    await screen.findByRole("heading", { name: "Catering Packages" });
    fireEvent.click(screen.getByRole("button", { name: "Add Package" }));

    expect(
      screen.getByText(
        "Use one row per thing the customer picks. Menu options pull from shared package families and require Min and Max."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Custom options cover package-specific choices like Taco Bar proteins. Min/Max can stay blank when there is no fixed selection count."
      )
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Taco Bar" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Customer Choice" }));
    fireEvent.change(screen.getByLabelText("Choice source 1"), {
      target: { value: "custom_options" },
    });

    expect(
      screen.getByText(
        "Custom options cover package-specific choices like Taco Bar proteins. Min/Max can stay blank when there is no fixed selection count."
      )
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Choice source 1"), {
      target: { value: "menu_group" },
    });

    expect(
      screen.queryByText(
        "Custom options cover package-specific choices like Taco Bar proteins. Min/Max can stay blank when there is no fixed selection count."
      )
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Choice source 1"), {
      target: { value: "custom_options" },
    });
    fireEvent.change(screen.getByPlaceholderText("Choice label"), {
      target: { value: "Taco Bar Proteins" },
    });
    fireEvent.change(screen.getByPlaceholderText("Add one option per line"), {
      target: { value: "Carne Asada\nChicken\nMarinated Pork" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Package" }));
    fireEvent.click(await screen.findByRole("button", { name: "Create" }));

    await waitFor(() => {
      const createRequest = fetchSpy.mock.calls.find(
        ([requestUrl, requestOptions]) =>
          requestUrl === "/api/admin/service-plans" &&
          String(requestOptions?.method || "").toUpperCase() === "POST"
      );
      expect(createRequest).toBeTruthy();
      expect(JSON.parse(createRequest[1].body)).toMatchObject({
        section_id: 1,
        title: "Taco Bar",
        selection_mode: "custom_options",
        constraints: [],
        selection_groups: [
          {
            group_key: "taco_bar_proteins",
            group_title: "Taco Bar Proteins",
            source_type: "custom_options",
            min_select: null,
            max_select: null,
            options: [
              { option_key: "carne_asada", option_label: "Carne Asada", sort_order: 1 },
              { option_key: "chicken", option_label: "Chicken", sort_order: 2 },
              { option_key: "marinated_pork", option_label: "Marinated Pork", sort_order: 3 },
            ],
          },
        ],
      });
    });
  });

  it("shows the formal create heading when opening a formal package form", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({
            user: {
              id: 1,
              username: "admin",
              display_name: "Admin",
              is_active: true,
            },
          })
        );
      }

      if (url === "/api/admin/service-plans?catalog_key=catering&include_inactive=true") {
        return Promise.resolve(
          buildResponse({
            sections: [
              {
                id: 1,
                catalog_key: "catering",
                section_type: "packages",
                title: "Catering Packages",
                is_active: true,
                plans: [],
              },
            ],
          })
        );
      }

      if (url === "/api/admin/service-plans?catalog_key=formal&include_inactive=true") {
        return Promise.resolve(
          buildResponse({
            sections: [
              {
                id: 2,
                catalog_key: "formal",
                section_type: "packages",
                title: "Plated Dinners",
                is_active: true,
                plans: [],
              },
            ],
          })
        );
      }

      return Promise.resolve(buildResponse({ error: `Unexpected URL: ${url}` }, false));
    });

    render(
      <Context.Provider value={{ isDarkTheme: false, setThemeMode: vi.fn() }}>
        <MemoryRouter initialEntries={["/admin/service-packages"]}>
          <Routes>
            <Route path="/admin/service-packages" element={<AdminServicePlansPage />} />
            <Route path="/admin/login" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </Context.Provider>
    );

    await screen.findByRole("heading", { name: "Catering Packages" });

    fireEvent.click(screen.getByRole("button", { name: "Formal Packages" }));

    await screen.findByRole("heading", { name: "Plated Dinners" });
    fireEvent.click(screen.getByRole("button", { name: "Add Package" }));

    expect(screen.getByRole("heading", { name: "Create New Formal Package" })).toBeInTheDocument();
    expect(screen.queryByText("New packages are created in the section you opened from the package list.")).not.toBeInTheDocument();
  });

  it("saves specific menu-backed catering choices without forcing combined families", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
      const method = String(options?.method || "GET").toUpperCase();

      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({
            user: {
              id: 1,
              username: "admin",
              display_name: "Admin",
              is_active: true,
            },
          })
        );
      }

      if (url === "/api/admin/service-plans?catalog_key=catering&include_inactive=true" && method === "GET") {
        return Promise.resolve(
          buildResponse({
            sections: [
              {
                id: 1,
                catalog_key: "catering",
                section_type: "packages",
                title: "Catering Packages",
                is_active: true,
                plans: [],
              },
            ],
          })
        );
      }

      if (url === "/api/admin/service-plans" && method === "POST") {
        return Promise.resolve(
          buildResponse({
            plan: {
              id: 21,
              section_id: 1,
              title: "Entree and Salad Lunch",
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
            <Route path="/admin/service-packages" element={<AdminServicePlansPage />} />
            <Route path="/admin/login" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </Context.Provider>
    );

    await screen.findByRole("heading", { name: "Catering Packages" });
    fireEvent.click(screen.getByRole("button", { name: "Add Package" }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Entree and Salad Lunch" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Customer Choice" }));
    fireEvent.change(screen.getByLabelText("Choice source 1"), {
      target: { value: "menu_group" },
    });
    let menuFamilySelects = screen
      .getAllByRole("combobox")
      .filter((element) => !String(element.getAttribute("aria-label") || "").startsWith("Choice source"));
    fireEvent.change(menuFamilySelects[0], {
      target: { value: "entree" },
    });
    fireEvent.change(screen.getByPlaceholderText("Min"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByPlaceholderText("Max"), {
      target: { value: "1" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add Customer Choice" }));
    const choiceSourceInputs = screen.getAllByLabelText(/Choice source/i);
    fireEvent.change(choiceSourceInputs[1], {
      target: { value: "menu_group" },
    });
    menuFamilySelects = screen
      .getAllByRole("combobox")
      .filter((element) => !String(element.getAttribute("aria-label") || "").startsWith("Choice source"));
    fireEvent.change(menuFamilySelects[1], {
      target: { value: "salads" },
    });
    fireEvent.change(screen.getAllByPlaceholderText("Min")[1], {
      target: { value: "1" },
    });
    fireEvent.change(screen.getAllByPlaceholderText("Max")[1], {
      target: { value: "1" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Package" }));
    fireEvent.click(await screen.findByRole("button", { name: "Create" }));

    await waitFor(() => {
      const createRequest = fetchSpy.mock.calls.find(
        ([requestUrl, requestOptions]) =>
          requestUrl === "/api/admin/service-plans" &&
          String(requestOptions?.method || "").toUpperCase() === "POST"
      );
      expect(createRequest).toBeTruthy();
      expect(JSON.parse(createRequest[1].body)).toMatchObject({
        section_id: 1,
        title: "Entree and Salad Lunch",
        selection_mode: "menu_groups",
        constraints: [
          { selection_key: "entree", min: 1, max: 1 },
          { selection_key: "salads", min: 1, max: 1 },
        ],
      });
    });
  });

  it("clears the open editor without closing it", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({
            user: {
              id: 1,
              username: "admin",
              display_name: "Admin",
              is_active: true,
            },
          })
        );
      }

      if (url === "/api/admin/service-plans?catalog_key=catering&include_inactive=true") {
        return Promise.resolve(
          buildResponse({
            sections: [
              {
                id: 1,
                catalog_key: "catering",
                section_type: "packages",
                title: "Catering Packages",
                is_active: true,
                plans: [],
              },
            ],
          })
        );
      }

      return Promise.resolve(buildResponse({ error: `Unexpected URL: ${url}` }, false));
    });

    render(
      <Context.Provider value={{ isDarkTheme: false, setThemeMode: vi.fn() }}>
        <MemoryRouter initialEntries={["/admin/service-packages"]}>
          <Routes>
            <Route path="/admin/service-packages" element={<AdminServicePlansPage />} />
            <Route path="/admin/login" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </Context.Provider>
    );

    await screen.findByRole("heading", { name: "Catering Packages" });

    fireEvent.click(screen.getByRole("button", { name: "Add Package" }));
    expect(screen.getByRole("heading", { name: "Create New Catering Package" })).toBeInTheDocument();

    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "Dessert Table" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.getByRole("heading", { name: "Create New Catering Package" })).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")[0]).toHaveValue("");
  });

  it("shows inline title validation before opening confirm", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({
            user: {
              id: 1,
              username: "admin",
              display_name: "Admin",
              is_active: true,
            },
          })
        );
      }

      if (url === "/api/admin/service-plans?catalog_key=catering&include_inactive=true") {
        return Promise.resolve(
          buildResponse({
            sections: [
              {
                id: 1,
                catalog_key: "catering",
                section_type: "packages",
                title: "Catering Packages",
                is_active: true,
                plans: [],
              },
            ],
          })
        );
      }

      return Promise.resolve(buildResponse({ error: `Unexpected URL: ${url}` }, false));
    });

    render(
      <Context.Provider value={{ isDarkTheme: false, setThemeMode: vi.fn() }}>
        <MemoryRouter initialEntries={["/admin/service-packages"]}>
          <Routes>
            <Route path="/admin/service-packages" element={<AdminServicePlansPage />} />
            <Route path="/admin/login" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </Context.Provider>
    );

    await screen.findByRole("heading", { name: "Catering Packages" });
    fireEvent.click(screen.getByRole("button", { name: "Add Package" }));

    const submitButton = screen.getByRole("button", { name: "Create Package" });
    fireEvent.click(submitButton);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveClass("is-invalid");
    expect(screen.getByText("Package title is required.")).toBeInTheDocument();
    expect(submitButton).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Dessert Table" },
    });

    expect(submitButton).not.toBeDisabled();
    expect(screen.getByLabelText("Title")).toHaveValue("Dessert Table");
  });

  it("blocks confirm when price display is not parseable", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({
            user: {
              id: 1,
              username: "admin",
              display_name: "Admin",
              is_active: true,
            },
          })
        );
      }

      if (url === "/api/admin/service-plans?catalog_key=catering&include_inactive=true") {
        return Promise.resolve(
          buildResponse({
            sections: [
              {
                id: 1,
                catalog_key: "catering",
                section_type: "packages",
                title: "Catering Packages",
                is_active: true,
                plans: [],
              },
            ],
          })
        );
      }

      return Promise.resolve(buildResponse({ error: `Unexpected URL: ${url}` }, false));
    });

    render(
      <Context.Provider value={{ isDarkTheme: false, setThemeMode: vi.fn() }}>
        <MemoryRouter initialEntries={["/admin/service-packages"]}>
          <Routes>
            <Route path="/admin/service-packages" element={<AdminServicePlansPage />} />
            <Route path="/admin/login" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </Context.Provider>
    );

    await screen.findByRole("heading", { name: "Catering Packages" });
    fireEvent.click(screen.getByRole("button", { name: "Add Package" }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Dessert Table" },
    });
    fireEvent.change(screen.getByLabelText("Price Display"), {
      target: { value: "market price" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Package" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Price Display")).toHaveClass("is-invalid");
    expect(screen.getByText("Price display must include at least one numeric amount.")).toBeInTheDocument();
  });

  it("blocks confirm when included items contain a blank row", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({
            user: {
              id: 1,
              username: "admin",
              display_name: "Admin",
              is_active: true,
            },
          })
        );
      }

      if (url === "/api/admin/service-plans?catalog_key=catering&include_inactive=true") {
        return Promise.resolve(
          buildResponse({
            sections: [
              {
                id: 1,
                catalog_key: "catering",
                section_type: "packages",
                title: "Catering Packages",
                is_active: true,
                plans: [],
              },
            ],
          })
        );
      }

      return Promise.resolve(buildResponse({ error: `Unexpected URL: ${url}` }, false));
    });

    render(
      <Context.Provider value={{ isDarkTheme: false, setThemeMode: vi.fn() }}>
        <MemoryRouter initialEntries={["/admin/service-packages"]}>
          <Routes>
            <Route path="/admin/service-packages" element={<AdminServicePlansPage />} />
            <Route path="/admin/login" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </Context.Provider>
    );

    await screen.findByRole("heading", { name: "Catering Packages" });
    fireEvent.click(screen.getByRole("button", { name: "Add Package" }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Dessert Table" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Included Item" }));

    fireEvent.click(screen.getByRole("button", { name: "Create Package" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Included items cannot be blank.")).toBeInTheDocument();
  });

  it("blocks confirm when a custom customer choice has fewer than two unique options", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({
            user: {
              id: 1,
              username: "admin",
              display_name: "Admin",
              is_active: true,
            },
          })
        );
      }

      if (url === "/api/admin/service-plans?catalog_key=catering&include_inactive=true") {
        return Promise.resolve(
          buildResponse({
            sections: [
              {
                id: 1,
                catalog_key: "catering",
                section_type: "packages",
                title: "Catering Packages",
                is_active: true,
                plans: [],
              },
            ],
          })
        );
      }

      return Promise.resolve(buildResponse({ error: `Unexpected URL: ${url}` }, false));
    });

    render(
      <Context.Provider value={{ isDarkTheme: false, setThemeMode: vi.fn() }}>
        <MemoryRouter initialEntries={["/admin/service-packages"]}>
          <Routes>
            <Route path="/admin/service-packages" element={<AdminServicePlansPage />} />
            <Route path="/admin/login" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </Context.Provider>
    );

    await screen.findByRole("heading", { name: "Catering Packages" });
    fireEvent.click(screen.getByRole("button", { name: "Add Package" }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Taco Bar" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Customer Choice" }));
    fireEvent.change(screen.getByLabelText("Choice source 1"), {
      target: { value: "custom_options" },
    });
    fireEvent.change(screen.getByPlaceholderText("Choice label"), {
      target: { value: "Taco Bar Proteins" },
    });
    fireEvent.change(screen.getByPlaceholderText("Min"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByPlaceholderText("Max"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByPlaceholderText("Add one option per line"), {
      target: { value: "Chicken" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Package" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Customer choice 1: Each custom customer choice needs at least 2 unique options.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Add one option per line")).toHaveClass("is-invalid");
    expect(screen.getByPlaceholderText("Choice label")).not.toHaveClass("is-invalid");
    expect(screen.getByPlaceholderText("Min")).not.toHaveClass("is-invalid");
    expect(screen.getByPlaceholderText("Max")).not.toHaveClass("is-invalid");
  });

  it("maps API field_errors back to inline errors and closes confirm", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
      const method = String(options?.method || "GET").toUpperCase();

      if (url === "/api/admin/auth/me") {
        return Promise.resolve(
          buildResponse({
            user: {
              id: 1,
              username: "admin",
              display_name: "Admin",
              is_active: true,
            },
          })
        );
      }

      if (url === "/api/admin/service-plans?catalog_key=catering&include_inactive=true") {
        return Promise.resolve(
          buildResponse({
            sections: [
              {
                id: 1,
                catalog_key: "catering",
                section_type: "packages",
                title: "Catering Packages",
                is_active: true,
                plans: [],
              },
            ],
          })
        );
      }

      if (url === "/api/admin/service-plans" && method === "POST") {
        return Promise.resolve(
          buildResponse(
            {
              error: "Package title must stay unique within this catalog.",
              field_errors: {
                title: "Package title must stay unique within this catalog.",
              },
            },
            false
          )
        );
      }

      return Promise.resolve(buildResponse({ error: `Unexpected URL: ${url}` }, false));
    });

    render(
      <Context.Provider value={{ isDarkTheme: false, setThemeMode: vi.fn() }}>
        <MemoryRouter initialEntries={["/admin/service-packages"]}>
          <Routes>
            <Route path="/admin/service-packages" element={<AdminServicePlansPage />} />
            <Route path="/admin/login" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </Context.Provider>
    );

    await screen.findByRole("heading", { name: "Catering Packages" });
    fireEvent.click(screen.getByRole("button", { name: "Add Package" }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Dessert Table" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Package" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText("Title")).toHaveClass("is-invalid");
    expect(screen.getByText("Package title must stay unique within this catalog.")).toBeInTheDocument();
  });
});
