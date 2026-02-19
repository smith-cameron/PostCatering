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

    expect(await screen.findByText("Please select at least one desired menu item.")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenNthCalledWith(1, "/api/menus");
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
        name: "Jerk Chicken",
        category: "entree",
        tray_size: "Half",
        tray_price: null,
      },
    ]);
  });
});
