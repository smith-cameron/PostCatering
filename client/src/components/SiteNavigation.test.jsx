import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Context from "../context";
import Footer from "./Footer";
import Header from "./Header";

describe("Site navigation links", () => {
  it("includes photo showcase in the header services dropdown between contact and inquiry", () => {
    render(
      <MemoryRouter>
        <Header onOpenInquiry={vi.fn()} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /services/i }));
    const contactItem = screen.getByRole("button", { name: /contact us/i });
    const photoShowcaseItem = screen.getByRole("link", { name: "Photo Showcase" });
    const inquiryItem = screen.getByRole("button", { name: /send catering inquiry/i });

    expect(photoShowcaseItem).toHaveAttribute("href", "/showcase");
    expect(screen.queryByRole("link", { name: /^showcase$/i })).not.toBeInTheDocument();
    expect(contactItem.compareDocumentPosition(photoShowcaseItem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(photoShowcaseItem.compareDocumentPosition(inquiryItem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
