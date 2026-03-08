import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Context from "../context";
import Footer from "./Footer";
import Header from "./Header";

describe("Site navigation links", () => {
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
    const photoShowcaseItem = screen.getByRole("link", { name: "Photo Showcase" });
    const inquiryItem = screen.getByRole("button", { name: /send catering inquiry/i });
    const contactItem = screen.getByRole("button", { name: /contact us/i });

    expect(photoShowcaseItem).toHaveAttribute("href", "/showcase");
    expect(screen.queryByRole("link", { name: /^showcase$/i })).not.toBeInTheDocument();
    expect(inquiryItem).toHaveClass("site-header-inquiry-item");
    expect(inquiryItem.compareDocumentPosition(aboutItem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(aboutItem.compareDocumentPosition(mondayMealItem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mondayMealItem.compareDocumentPosition(photoShowcaseItem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(photoShowcaseItem.compareDocumentPosition(contactItem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("includes showcase in the footer navigation", () => {
    render(
      <Context.Provider value={{ openInquiryModal: vi.fn() }}>
        <MemoryRouter>
          <Footer />
        </MemoryRouter>
      </Context.Provider>
    );

    expect(screen.getByRole("link", { name: /showcase/i })).toHaveAttribute("href", "/showcase");
  });
});
