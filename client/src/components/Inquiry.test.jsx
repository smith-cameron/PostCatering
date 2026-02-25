import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Inquiry from "./Inquiry";

const MENU_RESPONSE = {
  menu_options: {
    entrees: {
      id: "entrees",
      category: "entree",
      title: "Entrees",
      items: ["Jerk Chicken", "Braised Short Rib"],
    },
    sides_salads: {
      id: "sides_salads",
      category: "sides_salads",
      title: "Sides & Salads",
      items: ["Green Beans", "House Salad", "Potato Salad"],
    },
  },
  formal_plan_options: [],
  menu: {
    togo: {
      page_title: "To-Go Catering",
      sections: [
        {
          section_id: "togo_entrees",
          type: "includeMenu",
          title: "Entrees",
          include_keys: ["entrees"],
        },
      ],
    },
    community: {
      page_title: "Community Catering",
      sections: [
        {
          section_id: "community_homestyle",
          type: "package",
          title: "Hearty Homestyle Packages",
          description: "Choose 1 protein + 2 side/salad + bread",
        },
        {
          section_id: "community_entrees",
          type: "includeMenu",
          title: "Entrees",
          include_keys: ["entrees"],
        },
        {
          section_id: "community_sides_salads",
          type: "includeMenu",
          title: "Sides & Salads",
          include_keys: ["sides_salads"],
        },
      ],
    },
  },
};

const buildFutureDate = (daysOut = 14) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOut);
  return date.toISOString().slice(0, 10);
};

describe("Inquiry", () => {
  const getField = (selector) => {
    const field = document.querySelector(selector);
    if (!field) {
      throw new Error(`Missing form field for selector: ${selector}`);
    }
    return field;
  };

  beforeEach(() => {
    globalThis.fetch = vi.fn((url) => {
      if (url === "/api/menus") {
        return Promise.resolve({
          ok: true,
          json: async () => MENU_RESPONSE,
        });
      }

      return Promise.reject(new Error(`Unexpected URL in test: ${url}`));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.fetch;
  });

  it("blocks submit when no desired menu items are selected", async () => {
    render(
      <MemoryRouter>
        <Inquiry forceOpen onRequestClose={() => {}} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(document.querySelector('input[name="full_name"]')).toBeInTheDocument();
    });
    fireEvent.change(getField('input[name="full_name"]'), {
      target: { value: "Taylor Client" },
    });
    fireEvent.change(getField('input[name="email"]'), {
      target: { value: "taylor@example.com" },
    });
    fireEvent.change(getField('input[name="phone"]'), {
      target: { value: "(212) 555-1212" },
    });
    fireEvent.change(getField('input[name="event_date"]'), {
      target: { value: buildFutureDate() },
    });
    fireEvent.change(getField('input[name="guest_count"]'), {
      target: { value: "25" },
    });
    fireEvent.change(getField('select[name="service_interest"]'), {
      target: { value: "togo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit inquiry/i }));

    const desiredItemsField = document.querySelector('.border-danger[aria-invalid="true"]');
    expect(desiredItemsField).toBeTruthy();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenNthCalledWith(1, "/api/menus");
  });

  it("marks all invalid required fields at once on submit", async () => {
    render(
      <MemoryRouter>
        <Inquiry forceOpen onRequestClose={() => {}} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(document.querySelector('input[name="full_name"]')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /submit inquiry/i }));

    expect(getField('input[name="full_name"]')).toHaveClass("is-invalid");
    expect(getField('input[name="email"]')).toHaveClass("is-invalid");
    expect(getField('input[name="phone"]')).toHaveClass("is-invalid");
    expect(getField('input[name="event_date"]')).toHaveClass("is-invalid");
    expect(getField('input[name="guest_count"]')).toHaveClass("is-invalid");
    expect(getField('select[name="service_interest"]')).toHaveClass("is-invalid");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("submits a valid inquiry and shows success state", async () => {
    let submittedPayload = null;
    globalThis.fetch = vi.fn((url, options) => {
      if (url === "/api/menus") {
        return Promise.resolve({
          ok: true,
          json: async () => MENU_RESPONSE,
        });
      }

      if (url === "/api/inquiries") {
        submittedPayload = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({ inquiry_id: 42, email_sent: true }),
        });
      }

      return Promise.reject(new Error(`Unexpected URL in test: ${url}`));
    });

    render(
      <MemoryRouter>
        <Inquiry forceOpen onRequestClose={() => {}} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(document.querySelector('input[name="full_name"]')).toBeInTheDocument();
    });

    fireEvent.change(getField('input[name="full_name"]'), {
      target: { value: " Taylor Client " },
    });
    fireEvent.change(getField('input[name="email"]'), {
      target: { value: " taylor@example.com " },
    });
    fireEvent.change(getField('input[name="phone"]'), {
      target: { value: "(212) 555-1212" },
    });
    fireEvent.change(getField('input[name="event_date"]'), {
      target: { value: buildFutureDate() },
    });
    fireEvent.change(getField('input[name="guest_count"]'), {
      target: { value: "50" },
    });
    fireEvent.change(getField('input[name="budget"]'), {
      target: { value: "$2,500-$5,000" },
    });
    fireEvent.change(getField('select[name="service_interest"]'), {
      target: { value: "togo" },
    });

    fireEvent.click(await screen.findByLabelText("Jerk Chicken"));
    fireEvent.change(getField('textarea[name="message"]'), {
      target: { value: "  Please include setup. " },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit inquiry/i }));

    await waitFor(() => {
      expect(submittedPayload).not.toBeNull();
    });
    expect(await screen.findByText("Inquiry Sent")).toBeInTheDocument();

    expect(submittedPayload.full_name).toBe("Taylor Client");
    expect(submittedPayload.email).toBe("taylor@example.com");
    expect(submittedPayload.service_interest).toBe("To-Go Catering");
    expect(submittedPayload.budget).toBe("$2,500-$5,000");
    expect(submittedPayload.message).toBe("Please include setup.");
    expect(submittedPayload.desired_menu_items).toEqual([
      {
        item_id: null,
        name: "Jerk Chicken",
        category: "entree",
        tray_size: "Half",
        tray_price: null,
      },
    ]);
  });

  it("sanitizes budget input and adds thousands separators", async () => {
    render(
      <MemoryRouter>
        <Inquiry forceOpen onRequestClose={() => {}} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(document.querySelector('input[name="budget"]')).toBeInTheDocument();
    });

    const budgetField = getField('input[name="budget"]');

    fireEvent.change(budgetField, {
      target: { value: "cheap2500usd" },
    });
    expect(budgetField.value).toBe("2,500");

    fireEvent.change(budgetField, {
      target: { value: "$2500-5000abc" },
    });
    expect(budgetField.value).toBe("$2,500-$5,000");
  });

  it("blocks selecting more than two total side/salad items for hearty homestyle", async () => {
    globalThis.fetch = vi.fn((url) => {
      if (url === "/api/menus") {
        return Promise.resolve({
          ok: true,
          json: async () => MENU_RESPONSE,
        });
      }
      if (url === "/api/inquiries") {
        return Promise.resolve({
          ok: false,
          json: async () => ({ errors: ["email is invalid."] }),
        });
      }
      return Promise.reject(new Error(`Unexpected URL in test: ${url}`));
    });

    render(
      <MemoryRouter>
        <Inquiry forceOpen onRequestClose={() => {}} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(document.querySelector('select[name="service_interest"]')).toBeInTheDocument();
    });

    fireEvent.change(getField('select[name="service_interest"]'), {
      target: { value: "community" },
    });

    const homestyleOption = screen.getByRole("option", { name: "Hearty Homestyle Packages" });
    const packageSelect = homestyleOption.closest("select");
    if (!packageSelect) {
      throw new Error("Package selection control is missing.");
    }
    fireEvent.change(packageSelect, {
      target: { value: "package:Hearty Homestyle Packages" },
    });

    const sideItem = await screen.findByLabelText("Green Beans");
    const saladOne = screen.getByLabelText("House Salad");
    const saladTwo = screen.getByLabelText("Potato Salad");

    fireEvent.click(sideItem);
    fireEvent.click(saladOne);
    expect(sideItem).toBeChecked();
    expect(saladOne).toBeChecked();

    fireEvent.click(saladTwo);

    expect(saladTwo).not.toBeChecked();
    const sideSaladDetail = await screen.findByText("2 Side/Salad");
    expect(sideSaladDetail).toHaveClass("text-danger");
    expect(screen.queryByText("Select exactly 2 total Side/Salad items.")).not.toBeInTheDocument();

    fireEvent.change(getField('input[name="full_name"]'), {
      target: { value: "Taylor Client" },
    });
    fireEvent.change(getField('input[name="email"]'), {
      target: { value: "taylor@example.com" },
    });
    fireEvent.change(getField('input[name="phone"]'), {
      target: { value: "(212) 555-1212" },
    });
    fireEvent.change(getField('input[name="event_date"]'), {
      target: { value: buildFutureDate() },
    });
    fireEvent.change(getField('input[name="guest_count"]'), {
      target: { value: "25" },
    });
    fireEvent.click(screen.getByLabelText("Jerk Chicken"));

    fireEvent.click(screen.getByRole("button", { name: /submit inquiry/i }));

    const emailInput = getField('input[name="email"]');
    await waitFor(() => {
      expect(emailInput).toHaveClass("is-invalid");
    });
    fireEvent.change(emailInput, { target: { value: "valid@example.com" } });
    expect(emailInput).not.toHaveClass("is-invalid");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("2 Side/Salad")).not.toHaveClass("text-danger");
    expect(screen.queryByText("Select exactly 2 total Side/Salad items.")).not.toBeInTheDocument();
  });

  it("submits after an over-select warning when current side/salad selection is valid", async () => {
    let submittedPayload = null;
    globalThis.fetch = vi.fn((url, options) => {
      if (url === "/api/menus") {
        return Promise.resolve({
          ok: true,
          json: async () => MENU_RESPONSE,
        });
      }

      if (url === "/api/inquiries") {
        submittedPayload = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({ inquiry_id: 99, email_sent: true }),
        });
      }

      return Promise.reject(new Error(`Unexpected URL in test: ${url}`));
    });

    render(
      <MemoryRouter>
        <Inquiry forceOpen onRequestClose={() => {}} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(document.querySelector('input[name="full_name"]')).toBeInTheDocument();
    });

    fireEvent.change(getField('input[name="full_name"]'), {
      target: { value: "Taylor Client" },
    });
    fireEvent.change(getField('input[name="email"]'), {
      target: { value: "taylor@example.com" },
    });
    fireEvent.change(getField('input[name="phone"]'), {
      target: { value: "(212) 555-1212" },
    });
    fireEvent.change(getField('input[name="event_date"]'), {
      target: { value: buildFutureDate() },
    });
    fireEvent.change(getField('input[name="guest_count"]'), {
      target: { value: "25" },
    });
    fireEvent.change(getField('select[name="service_interest"]'), {
      target: { value: "community" },
    });

    const homestyleOption = screen.getByRole("option", { name: "Hearty Homestyle Packages" });
    const packageSelect = homestyleOption.closest("select");
    if (!packageSelect) {
      throw new Error("Package selection control is missing.");
    }
    fireEvent.change(packageSelect, {
      target: { value: "package:Hearty Homestyle Packages" },
    });

    fireEvent.click(await screen.findByLabelText("Jerk Chicken"));
    fireEvent.click(screen.getByLabelText("Green Beans"));
    fireEvent.click(screen.getByLabelText("House Salad"));
    fireEvent.click(screen.getByLabelText("Potato Salad"));

    fireEvent.click(screen.getByRole("button", { name: /submit inquiry/i }));

    await waitFor(() => {
      expect(submittedPayload).not.toBeNull();
    });
    expect(await screen.findByText("Inquiry Sent")).toBeInTheDocument();
    expect(submittedPayload.desired_menu_items).toHaveLength(3);
  });
});
