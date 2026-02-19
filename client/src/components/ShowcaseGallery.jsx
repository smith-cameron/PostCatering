import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Modal, Spinner } from "react-bootstrap";
import { useSearchParams } from "react-router-dom";

const MEDIA_PARAM_KEY = "media";
const KNOWN_MEDIA_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".mp4", ".webm", ".mov", ".m4v", ".ogv"];

const getFilenameFromMedia = (item) => {
  if (item?.filename) return String(item.filename);
  const source = String(item?.src || "");
  const parts = source.split("/");
  return decodeURIComponent(parts[parts.length - 1] || "");
};

const isFilenameLikeLabel = (label, item) => {
  const normalizedLabel = String(label || "").trim().toLowerCase();
  if (!normalizedLabel) return false;
  const filename = getFilenameFromMedia(item).toLowerCase();
  const stem = filename.includes(".") ? filename.slice(0, filename.lastIndexOf(".")) : filename;
  if (normalizedLabel === filename || normalizedLabel === stem) return true;
  return KNOWN_MEDIA_EXTENSIONS.some((ext) => normalizedLabel.endsWith(ext));
};

const getMediaDisplayLabel = (item, index) => {
  const directLabel = String(item?.title || "").trim();
  if (directLabel && !isFilenameLikeLabel(directLabel, item)) {
    return directLabel;
  }
  const mediaPrefix = item?.media_type === "video" ? "Video" : "Photo";
  return `${mediaPrefix} ${index + 1}`;
};

const ShowcaseGallery = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mediaItems, setMediaItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadGallery = async () => {
      try {
        const response = await fetch("/api/gallery");
        if (!response.ok) {
          throw new Error("Gallery data is unavailable.");
        }

        const body = await response.json();
        const nextItems = Array.isArray(body.media) ? body.media : [];
        if (isMounted) {
          setMediaItems(nextItems);
          setError("");
        }
      } catch {
        if (isMounted) {
          setError("Unable to load showcase media right now.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadGallery();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeMediaId = searchParams.get(MEDIA_PARAM_KEY);

  const activeIndex = useMemo(() => {
    if (!activeMediaId) return -1;
    return mediaItems.findIndex((item) => String(item.id) === String(activeMediaId));
  }, [activeMediaId, mediaItems]);

  const activeMedia = activeIndex >= 0 ? mediaItems[activeIndex] : null;
  const activeMediaLabel = activeMedia ? getMediaDisplayLabel(activeMedia, activeIndex) : "Showcase Media";

  const openMedia = useCallback((item) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set(MEDIA_PARAM_KEY, String(item.id));
    setSearchParams(nextSearchParams);
  }, [searchParams, setSearchParams]);

  const closeMedia = useCallback(() => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete(MEDIA_PARAM_KEY);
    setSearchParams(nextSearchParams);
  }, [searchParams, setSearchParams]);

  const moveMedia = useCallback((direction) => {
    if (!mediaItems.length || activeIndex < 0) return;
    const nextIndex = (activeIndex + direction + mediaItems.length) % mediaItems.length;
    openMedia(mediaItems[nextIndex]);
  }, [activeIndex, mediaItems, openMedia]);

  useEffect(() => {
    if (!activeMedia) return undefined;

    const handleKeydown = (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveMedia(1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveMedia(-1);
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [activeMedia, moveMedia]);

  return (
    <main className="showcase-page container-fluid py-4">
      <header className="text-center mb-4">
        <h2>Post 468 Catering</h2>
        <p className="text-secondary mb-0">
          Photos and videos from events, service, and community programs.
        </p>
      </header>

      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <Spinner animation="border" role="status" />
        </div>
      ) : null}

      {!loading && error ? <Alert variant="danger">{error}</Alert> : null}

      {!loading && !error && !mediaItems.length ? (
        <Alert variant="secondary">No showcase media is available yet.</Alert>
      ) : null}

      {!loading && !error && mediaItems.length ? (
        <section className="showcase-grid" aria-label="Showcase gallery">
          {mediaItems.map((item, index) => (
            <button
              key={`${item.id}-${item.filename ?? index}`}
              type="button"
              className="showcase-tile"
              onClick={() => openMedia(item)}>
              <div className="showcase-media-frame">
                {item.media_type === "video" ? (
                  <video
                    className="showcase-grid-media"
                    muted
                    playsInline
                    preload="metadata"
                    aria-label={getMediaDisplayLabel(item, index)}>
                    <source src={item.src} />
                  </video>
                ) : (
                  <img
                    className="showcase-grid-media"
                    src={item.thumbnail_src || item.src}
                    alt={item.alt || getMediaDisplayLabel(item, index)}
                    loading="lazy"
                  />
                )}
              </div>

              <div className="showcase-tile-meta">
                <span className="showcase-tile-title">{getMediaDisplayLabel(item, index)}</span>
                {item.is_slide ? <span className="badge text-bg-secondary">Homepage Slide</span> : null}
              </div>
            </button>
          ))}
        </section>
      ) : null}

      <Modal
        show={Boolean(activeMedia)}
        onHide={closeMedia}
        centered
        size="xl"
        animation={false}
        dialogClassName="showcase-modal-dialog">
        <Modal.Header closeButton>
          <Modal.Title>{activeMediaLabel}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="showcase-modal-body">
          {activeMedia ? (
            <div className="showcase-modal-frame">
              {activeMedia.media_type === "video" ? (
                <video
                  key={String(activeMedia.id)}
                  className="showcase-modal-media"
                  controls
                  playsInline
                  preload="metadata">
                  <source src={activeMedia.src} />
                </video>
              ) : (
                <img
                  className="showcase-modal-media"
                  src={activeMedia.src}
                  alt={activeMedia.alt || activeMedia.title || "Showcase media"}
                />
              )}
            </div>
          ) : null}
          {activeMedia?.caption ? <p className="mt-3 mb-0 text-secondary">{activeMedia.caption}</p> : null}
        </Modal.Body>
        <Modal.Footer className="justify-content-between">
          <Button variant="outline-secondary" onClick={() => moveMedia(-1)} disabled={mediaItems.length < 2}>
            Previous
          </Button>
          <Button variant="outline-secondary" onClick={() => moveMedia(1)} disabled={mediaItems.length < 2}>
            Next
          </Button>
        </Modal.Footer>
      </Modal>
    </main>
  );
};

export default ShowcaseGallery;
