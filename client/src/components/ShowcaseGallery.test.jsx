import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ShowcaseGallery from "./ShowcaseGallery";

const renderShowcase = (initialPath = "/showcase") =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/showcase" element={<ShowcaseGallery />} />
      </Routes>
    </MemoryRouter>
  );

describe("ShowcaseGallery", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.fetch;
  });

  it("loads gallery media and opens modal navigation", async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        media: [
          {
            id: 11,
            title: "Community Dinner",
            caption: "Seasonal favorites",
            alt: "Community dinner service line",
            src: "/api/assets/slides/20231114_152614.jpg",
            media_type: "image",
            is_slide: true,
          },
          {
            id: 12,
            title: "Event Reel",
            caption: "",
            alt: "Event reel",
            src: "/api/assets/slides/event-reel.mp4",
            media_type: "video",
            is_slide: false,
          },
        ],
      }),
    });

    renderShowcase();

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/gallery");
    expect(await screen.findByRole("button", { name: /community dinner/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /community dinner/i }));
    await waitFor(() => {
      const modalImage = document.body.querySelector("img.showcase-modal-media");
      expect(modalImage).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => {
      const modalVideo = document.body.querySelector("video.showcase-modal-media");
      expect(modalVideo).toBeInTheDocument();
      expect(modalVideo).toHaveAttribute("controls");
    });
  });

  it("opens a media item from query parameter", async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        media: [
          {
            id: 11,
            title: "Community Dinner",
            caption: "Seasonal favorites",
            alt: "Community dinner service line",
            src: "/api/assets/slides/20231114_152614.jpg",
            media_type: "image",
            is_slide: true,
          },
          {
            id: 12,
            title: "Event Reel",
            caption: "",
            alt: "Event reel",
            src: "/api/assets/slides/event-reel.mp4",
            media_type: "video",
            is_slide: false,
          },
        ],
      }),
    });

    renderShowcase("/showcase?media=12");

    await waitFor(() => {
      const modalVideo = document.body.querySelector("video.showcase-modal-media");
      expect(modalVideo).toBeInTheDocument();
    });
  });
});
