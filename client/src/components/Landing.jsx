import { useEffect, useState } from "react";
import { Button, Carousel } from "react-bootstrap";
import { Link } from "react-router-dom";
import AboutUsModal from "./modals/AboutUsModal";
import MondayMealModal from "./modals/MondayMealModal";

const normalizeSortNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeLandingSlides = (slides) => {
  const seen = new Set();
  const seenDisplayOrders = new Set();
  return (Array.isArray(slides) ? slides : [])
    .filter((slide) => {
      const src = String(slide?.src || slide?.image_url || "").trim();
      if (!src) return false;

      const mediaType = String(slide?.media_type || "image").trim().toLowerCase();
      if (mediaType && mediaType !== "image") return false;
      if (slide?.is_slide === false) return false;
      if (slide?.is_active === false) return false;
      return true;
    })
    .sort((left, right) => {
      const leftOrder = normalizeSortNumber(left?.display_order, Number.MAX_SAFE_INTEGER);
      const rightOrder = normalizeSortNumber(right?.display_order, Number.MAX_SAFE_INTEGER);
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      const leftId = normalizeSortNumber(left?.id, Number.MAX_SAFE_INTEGER);
      const rightId = normalizeSortNumber(right?.id, Number.MAX_SAFE_INTEGER);
      return leftId - rightId;
    })
    .reduce((next, slide, index) => {
      const parsedDisplayOrder = Number(slide?.display_order);
      const hasDisplayOrder = Number.isFinite(parsedDisplayOrder);
      const displayOrderKey = hasDisplayOrder ? String(parsedDisplayOrder) : "";
      if (displayOrderKey && seenDisplayOrders.has(displayOrderKey)) return next;

      const src = String(slide?.src || slide?.image_url || "").trim();
      const dedupeKey = `${String(slide?.id ?? "")}|${src}`;
      if (seen.has(dedupeKey)) return next;
      seen.add(dedupeKey);
      if (displayOrderKey) seenDisplayOrders.add(displayOrderKey);

      const title = String(slide?.title || "").trim();
      const caption = String(slide?.text || slide?.caption || "").trim();
      const alt = String(slide?.alt || slide?.alt_text || title || "Landing slide").trim();
      next.push({
        id: slide?.id ?? `slide-${index}`,
        src,
        alt,
        title,
        text: caption,
      });
      return next;
    }, []);
};

const Landing = () => {
  const [activeModal, setActiveModal] = useState(null);
  const handleCloseModal = () => setActiveModal(null);
  const handleShowModal = (modalName) => setActiveModal(modalName);

  const [slides, setSlides] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const loadSlides = async () => {
      try {
        const response = await fetch("/api/slides");
        if (!response.ok) {
          return;
        }

        const body = await response.json();
        if (isMounted) {
          setSlides(normalizeLandingSlides(body.slides));
        }
      } catch {
        // Keep page functional even if slide API is temporarily unavailable.
      }
    };

    loadSlides();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="landing-container text-center">
      <h2>Food prepared with purpose</h2>
      <p>
        American Legion Post 468 Catering combines professional culinary and
        event experience with a mission to serve our community. <br /> Led by a
        hospitality professional with extensive fine-dining, banquet, and
        large-event background, our team delivers everything from casual
        community meals to elegant weddings with precision and care.
        <br />
        <strong>
          Every event supports local veterans through our ongoing meal programs
          and outreach initiatives.
        </strong>
      </p>
      <div className="landing-info-actions my-4 px-3">
        <Button
          className="fw-semibold btn-inquiry-action landing-info-action"
          variant="secondary"
          onClick={() => handleShowModal("aboutUs")}
        >
          About Us
        </Button>
        <Button
          className="fw-semibold btn-inquiry-action landing-info-action"
          variant="secondary"
          onClick={() => handleShowModal("mmp")}
        >
          Monday Meal Program
        </Button>
      </div>
      <AboutUsModal
        show={activeModal === "aboutUs"}
        onHide={handleCloseModal}
      />
      <MondayMealModal show={activeModal === "mmp"} onHide={handleCloseModal} />
      <Carousel>
        {slides.map((slide) => (
          <Carousel.Item key={slide.id ?? slide.src} className="carousel-item">
            <Link
              to={`/showcase?media=${encodeURIComponent(String(slide.id ?? slide.src))}`}
              className="carousel-media-link"
              aria-label={`Open ${slide.title || "slide"} in the showcase`}>
              <img className="d-block carousel-img" src={slide.src} alt={slide.alt} />
            </Link>
            <Carousel.Caption className="bg-dark bg-opacity-50 text-white p-3">
              <h3>{slide.title}</h3>
              <p>{slide.text}</p>
            </Carousel.Caption>
          </Carousel.Item>
        ))}
      </Carousel>
    </main>
  );
};

export default Landing;
