import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Context from "../context";
import Footer from "./Footer";
import Header from "./Header";

describe("Site navigation links", () => {
  it("orders photo showcase, inquiry, then contact in the header services dropdown", () => {
    render(
      <MemoryRouter>
        <Header onOpenInquiry={vi.fn()} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /services/i }));
    const photoShowcaseItem = screen.getByRole("link", { name: "Photo Showcase" });
    const inquiryItem = screen.getByRole("button", { name: /send catering inquiry/i });
    const contactItem = screen.getByRole("button", { name: /contact us/i });

    expect(photoShowcaseItem).toHaveAttribute("href", "/showcase");
    expect(screen.queryByRole("link", { name: /^showcase$/i })).not.toBeInTheDocument();
    expect(photoShowcaseItem.compareDocumentPosition(inquiryItem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(inquiryItem.compareDocumentPosition(contactItem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
