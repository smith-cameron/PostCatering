import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Context from "../context";
import Footer from "./Footer";
import Header from "./Header";

describe("Site navigation links", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("toggles the shared site theme from the footer", () => {
    const toggleTheme = vi.fn();

    render(
      <Context.Provider
        value={{ openInquiryModal: vi.fn(), isDarkTheme: false, toggleTheme }}>
        <MemoryRouter>
          <Footer />
        </MemoryRouter>
      </Context.Provider>
    );

    fireEvent.click(screen.getByRole("button", { name: /switch to dark mode/i }));
    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });

  it("places inquiry directly after the menu links and before the divider items in the header services dropdown", () => {
    render(
      <MemoryRouter>
        <Header onOpenInquiry={vi.fn()} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /services/i }));
    const aboutItem = screen.getByRole("button", { name: "About Us" });
    const mondayMealItem = screen.getByRole("button", { name: "Monday Meal Program" });
    const photoShowcaseItem = screen.getByRole("link", { name: "Photos" });
    const inquiryItem = screen.getByRole("button", { name: /send catering inquiry/i });
    const contactItem = screen.getByRole("button", { name: /contact us/i });
    const toGoItem = screen.getByRole("link", { name: /to-go & take-and-bake trays/i });
    const communityItem = screen.getByRole("link", { name: /community & crew catering/i });
    const formalItem = screen.getByRole("link", { name: /formal events catering/i });

    expect(photoShowcaseItem).toHaveAttribute("href", "/showcase");
    expect(communityItem).toHaveAttribute("href", "/services/catering");
    expect(screen.queryByRole("link", { name: /^showcase$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(toGoItem).toHaveClass("site-header-service-item");
    expect(communityItem).toHaveClass("site-header-service-item");
    expect(formalItem).toHaveClass("site-header-service-item");
    expect(inquiryItem).toHaveClass("site-header-inquiry-item");
    expect(inquiryItem.compareDocumentPosition(aboutItem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(aboutItem.compareDocumentPosition(mondayMealItem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mondayMealItem.compareDocumentPosition(photoShowcaseItem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(photoShowcaseItem.compareDocumentPosition(contactItem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("uses Photos in the footer navigation", () => {
    render(
      <Context.Provider value={{ openInquiryModal: vi.fn() }}>
        <MemoryRouter>
          <Footer />
        </MemoryRouter>
      </Context.Provider>
    );

    expect(screen.getByRole("link", { name: "Photos" })).toHaveAttribute("href", "/showcase");
    expect(screen.queryByRole("link", { name: /^showcase$/i })).not.toBeInTheDocument();
  });

  it("uses Photos in the mobile navigation", () => {
    const originalInnerWidth = window.innerWidth;
    const originalMatchMedia = window.matchMedia;

    try {
      window.innerWidth = 390;
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query.includes("max-width"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      render(
        <MemoryRouter>
          <Header onOpenInquiry={vi.fn()} />
        </MemoryRouter>
      );

      expect(screen.getByRole("link", { name: "Photos" })).toHaveAttribute("href", "/showcase");
      expect(screen.queryByRole("link", { name: /^showcase$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    } finally {
      window.innerWidth = originalInnerWidth;
      window.matchMedia = originalMatchMedia;
    }
  });
});
