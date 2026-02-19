import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Landing from "./Landing";

describe("Landing", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.fetch;
  });

  it("loads and renders active slides from the API", async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        slides: [
          {
            id: 11,
            src: "/api/assets/slides/20231114_152614.jpg",
            alt: "Service line",
            title: "Community Dinner",
            text: "Seasonal favorites",
          },
        ],
      }),
    });

    render(<Landing />);

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/slides");
    expect(await screen.findByText("Community Dinner")).toBeInTheDocument();
    expect(screen.getByAltText("Service line")).toHaveAttribute(
      "src",
      "/api/assets/slides/20231114_152614.jpg"
    );
  });

  it("keeps the page usable when slide loading fails", async () => {
    globalThis.fetch.mockRejectedValueOnce(new Error("network"));

    render(<Landing />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole("button", { name: "About Us" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Monday Meal Program" })).toBeInTheDocument();
  });
});
