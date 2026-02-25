import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
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

    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/slides");
    expect(await screen.findByText("Community Dinner")).toBeInTheDocument();
    expect(screen.getByAltText("Service line")).toHaveAttribute(
      "src",
      "/api/assets/slides/20231114_152614.jpg"
    );
    expect(
      screen.getByRole("link", { name: /open community dinner in the showcase/i })
    ).toHaveAttribute("href", "/showcase?media=11");
  });

  it("keeps the page usable when slide loading fails", async () => {
    globalThis.fetch.mockRejectedValueOnce(new Error("network"));

    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole("button", { name: "About Us" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Monday Meal Program" })).toBeInTheDocument();
  });

  it("renders only image slides that are active and marked for landing", async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        slides: [
          {
            id: 21,
            src: "/api/assets/slides/event-video.mp4",
            media_type: "video",
            is_slide: true,
            is_active: true,
            title: "Event Reel",
          },
          {
            id: 22,
            src: "/api/assets/slides/inactive.jpg",
            media_type: "image",
            is_slide: true,
            is_active: false,
            title: "Inactive Slide",
          },
          {
            id: 23,
            src: "/api/assets/slides/gallery-only.jpg",
            media_type: "image",
            is_slide: false,
            is_active: true,
            title: "Gallery Only",
          },
          {
            id: 24,
            src: "/api/assets/slides/hero.jpg",
            media_type: "image",
            is_slide: true,
            is_active: true,
            display_order: 1,
            title: "Hero Slide",
            caption: "Featured event",
            alt_text: "Hero image",
          },
          {
            id: 30,
            src: "/api/assets/slides/hero-duplicate.jpg",
            media_type: "image",
            is_slide: true,
            is_active: true,
            display_order: 1,
            title: "Hero Slide Duplicate",
            alt_text: "Hero duplicate image",
          },
        ],
      }),
    });

    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );

    expect(await screen.findByText("Hero Slide")).toBeInTheDocument();
    expect(screen.getByAltText("Hero image")).toHaveAttribute("src", "/api/assets/slides/hero.jpg");
    expect(screen.queryByText("Hero Slide Duplicate")).not.toBeInTheDocument();
    expect(screen.queryByText("Event Reel")).not.toBeInTheDocument();
    expect(screen.queryByText("Inactive Slide")).not.toBeInTheDocument();
    expect(screen.queryByText("Gallery Only")).not.toBeInTheDocument();
  });
});
