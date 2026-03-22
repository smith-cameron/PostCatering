import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ContactUsModal from "./ContactUsModal";

describe("ContactUsModal", () => {
  it("shows public contact details without exposing a direct email", () => {
    render(<ContactUsModal show onHide={vi.fn()} />);

    expect(screen.queryByText("Contact Us")).not.toBeInTheDocument();
    expect(screen.getByText("American Legion Post 468", { selector: ".modal-title" })).toBeInTheDocument();
    expect(screen.getByText("Catering Inquiries")).toBeInTheDocument();
    expect(
      screen.getByText("If you're reaching out about food, menus, events, or anything catering-related, please use the inquiry options provided.")
    ).toBeInTheDocument();
    expect(screen.getByText("Events Coordinator")).toBeInTheDocument();
    expect(screen.getByText("Arianne")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "(760) 765-0126" })).toHaveAttribute("href", "tel:7607650126");
    expect(screen.getByRole("link", { name: "lincolndemingpost468.org" })).toHaveAttribute(
      "href",
      "https://www.lincolndemingpost468.org/"
    );
    expect(screen.getByText("Address")).toBeInTheDocument();
    expect(
      screen.getAllByText((_, element) => {
        const text = element?.textContent || "";
        return (
          text.includes("American Legion Post 468") &&
          text.includes("2503 Washington St") &&
          text.includes("Julian, California 92036")
        );
      }).length
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/^Email$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/owner phone number/i)).not.toBeInTheDocument();
  });
});
