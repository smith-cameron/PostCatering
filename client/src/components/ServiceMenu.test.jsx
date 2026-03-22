import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Context from "../context";
import useMenuConfig from "../hooks/useMenuConfig";
import ServiceMenu from "./ServiceMenu";

vi.mock("../hooks/useMenuConfig", () => ({
  default: vi.fn(),
}));

const renderServiceMenu = (initialPath = "/services/catering") =>
  render(
    <Context.Provider value={{ openInquiryModal: vi.fn() }}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/services/:menuKey" element={<ServiceMenu />} />
        </Routes>
      </MemoryRouter>
    </Context.Provider>
  );

describe("ServiceMenu", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps package and menu accordions independent while preserving the menu separator", () => {
    useMenuConfig.mockReturnValue({
      loading: false,
      error: "",
      formalPlanOptions: [],
      menuOptions: {
        entree: {
          title: "Entrees",
          items: ["Jerk Chicken", "Braised Short Rib"],
        },
      },
      menu: {
        catering: {
          pageTitle: "Community & Crew Catering (Per Person)",
          subtitle: "Drop-off or buffet setup",
          sections: [
            {
              sectionId: "catering_packages",
              type: "packages",
              title: "Event Catering - Buffet Style",
              packages: [
                {
                  planId: "catering:homestyle",
                  title: "Hearty Homestyle Packages",
                  price: "$20-$28 per person",
                  constraints: {
                    entree_signature_protein: { min: 1, max: 1 },
                    sides_salads: { min: 2, max: 2 },
                  },
                  details: ["Bread"],
                  isActive: true,
                },
              ],
            },
            {
              sectionId: "catering_menu_options",
              type: "includeMenu",
              title: "Menu Options",
              includeKeys: ["entree"],
            },
          ],
        },
        formal: { sections: [] },
      },
    });

    const { container } = renderServiceMenu();
    const packageButton = screen.getByRole("button", { name: "Hearty Homestyle Packages" });
    const menuButton = screen.getByRole("button", { name: "Entrees" });

    expect(container.querySelectorAll(".menu-sections-accordion")).toHaveLength(2);
    expect(screen.getByText("Menu Selections")).toBeInTheDocument();
    expect(screen.queryByText("Event/Crew Catering - Buffet Style")).not.toBeInTheDocument();

    fireEvent.click(packageButton);
    expect(packageButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Bread")).toBeInTheDocument();

    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(packageButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Jerk Chicken")).toBeInTheDocument();
  });
});
