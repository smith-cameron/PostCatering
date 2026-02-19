import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Context from "../context";
import Footer from "./Footer";
import Header from "./Header";

describe("Site navigation links", () => {
  it("includes showcase in the header services dropdown", () => {
    render(
      <MemoryRouter>
        <Header onOpenInquiry={vi.fn()} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /services/i }));
    expect(screen.getByRole("link", { name: /showcase/i })).toHaveAttribute("href", "/showcase");
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
