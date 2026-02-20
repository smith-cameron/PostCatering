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

  it("supports swipe navigation for image modal media", async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        media: [
          {
            id: 31,
            title: "First Image",
            caption: "",
            alt: "First showcase image",
            src: "/api/assets/slides/first.jpg",
            media_type: "image",
            is_slide: true,
          },
          {
            id: 32,
            title: "Second Image",
            caption: "",
            alt: "Second showcase image",
            src: "/api/assets/slides/second.jpg",
            media_type: "image",
            is_slide: true,
          },
        ],
      }),
    });

    renderShowcase();

    fireEvent.click(await screen.findByRole("button", { name: /first image/i }));
    await waitFor(() => {
      const modalImage = document.body.querySelector("img.showcase-modal-media");
      expect(modalImage).toHaveAttribute("alt", "First showcase image");
    });

    const modalFrame = document.body.querySelector(".showcase-modal-frame");
    expect(modalFrame).toBeInTheDocument();

    fireEvent.touchStart(modalFrame, {
      changedTouches: [{ clientX: 220, clientY: 200 }],
    });
    fireEvent.touchEnd(modalFrame, {
      changedTouches: [{ clientX: 80, clientY: 200 }],
    });

    await waitFor(() => {
      const modalImage = document.body.querySelector("img.showcase-modal-media");
      expect(modalImage).toHaveAttribute("alt", "Second showcase image");
    });

    fireEvent.touchStart(modalFrame, {
      changedTouches: [{ clientX: 80, clientY: 200 }],
    });
    fireEvent.touchEnd(modalFrame, {
      changedTouches: [{ clientX: 220, clientY: 200 }],
    });

    await waitFor(() => {
      const modalImage = document.body.querySelector("img.showcase-modal-media");
      expect(modalImage).toHaveAttribute("alt", "First showcase image");
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

  it("does not display filename when media label is missing", async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        media: [
          {
            id: 21,
            title: "",
            caption: "",
            alt: "Unlabeled showcase media",
            filename: "2026-private-file.jpg",
            src: "/api/assets/slides/2026-private-file.jpg",
            media_type: "image",
            is_slide: false,
          },
        ],
      }),
    });

    renderShowcase();

    expect(await screen.findByAltText("Unlabeled showcase media")).toBeInTheDocument();
    expect(screen.queryByText("2026-private-file.jpg")).not.toBeInTheDocument();
    expect(screen.getByText("placeholder title")).toBeInTheDocument();
  });
});
