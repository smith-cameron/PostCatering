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
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Menu Options" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Create Package" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Edit Package" })).not.toBeInTheDocument();
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

    expect(screen.getByRole("heading", { name: "Edit Package" })).toBeInTheDocument();
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

    expect(screen.getByRole("heading", { name: "Edit Package" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Custom options")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Taco Bar Proteins")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Carne Asada, Chicken, Marinated Pork")).toBeInTheDocument();
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
    expect(screen.queryByRole("heading", { name: "Create Package" })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Add Package" })[1]);
    expect(screen.getByRole("heading", { name: "Create Package" })).toBeInTheDocument();
    expect(screen.getAllByText("Interactive Stations").length).toBeGreaterThan(0);
    expect(screen.queryByText("Select section")).not.toBeInTheDocument();

    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "Omelette Bar" },
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
    fireEvent.change(screen.getByPlaceholderText("Carne Asada, Chicken, Marinated Pork"), {
      target: { value: "Cheese, Spinach, Bacon" },
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
    expect(screen.getByRole("heading", { name: "Create Package" })).toBeInTheDocument();

    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "Dessert Table" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.getByRole("heading", { name: "Create Package" })).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")[0]).toHaveValue("");
  });

  it("locks the submit button after confirm validation fails until the form changes", async () => {
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
    fireEvent.click(await screen.findByRole("button", { name: "Create" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Package title is required.");
    expect(within(dialog).getByRole("button", { name: "Create" })).toBeDisabled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Fix" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(submitButton).toBeDisabled();
    expect(screen.getByLabelText("Title")).toHaveClass("is-invalid");

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Dessert Table" },
    });

    expect(submitButton).not.toBeDisabled();
    expect(screen.getByLabelText("Title")).toHaveValue("Dessert Table");
  });
});
