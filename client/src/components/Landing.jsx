import { useEffect, useState } from "react";
import { Button, Carousel } from "react-bootstrap";
import AboutUsModal from "./modals/AboutUsModal";
import MondayMealModal from "./modals/MondayMealModal";

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
        if (isMounted && Array.isArray(body.slides)) {
          setSlides(body.slides);
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
      <div className="my-4 px-3">
        <Button
          className="fw-semibold"
          variant="secondary"
          onClick={() => handleShowModal("aboutUs")}
        >
          About Us
        </Button>
        <AboutUsModal
          show={activeModal === "aboutUs"}
          onHide={handleCloseModal}
        />
      </div>
      <div className="my-4 px-3">
        <Button
          className="fw-semibold"
          variant="secondary"
          onClick={() => handleShowModal("mmp")}
        >
          Monday Meal Program
        </Button>
        <MondayMealModal show={activeModal === "mmp"} onHide={handleCloseModal} />
      </div>
      <Carousel>
        {slides.map((slide) => (
          <Carousel.Item key={slide.id ?? slide.src} className="carousel-item">
            <img className="d-block carousel-img" src={slide.src} alt={slide.alt} />
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
