// import { Link } from "react-router-dom"
import { useState } from "react";
import { Button, Carousel } from "react-bootstrap";
import AboutUsModal from "./modals/AboutUsModal";
import MondayMealModal from "./modals/MondayMealModal";

const slides = [
  {
    src: "/imgs/homeslider3.jpg",
    alt: "First slide",
    title: "First slide label",
    text: "Nulla vitae elit libero, a pharetra augue mollis interdum.",
  },
  {
    src: "/imgs/gratisography-cut-the-cake-800x525.jpg",
    alt: "Second slide",
    title: "Second slide label",
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  },
  {
    src: "/imgs/gettyimages-1283712032-612x612.jpg",
    alt: "Third slide",
    title: "Third slide label",
    text: "Praesent commodo cursus magna, vel scelerisque nisl consectetur.",
  },
  {
    src: "/imgs/cooking-2132874_1280.jpg",
    alt: "Fourth slide",
    title: "Fourth slide label",
    text: "Suscipit architecto veritatis quae sit distinctio corporis beatae?.",
  },
  {
    src: "/imgs/closeup-spaghetti-meatballs-tomato-sauce-260nw-2468747773.jpg",
    alt: "Fifth slide",
    title: "Fifth slide label",
    text:
      "Eos, nisi sit, possimus maiores autem minima error eligendi repudiandae praesentium veritatis nam tempore modi vero maxime dolores perferendis aperiam? Necessitatibus, quas.",
  },
];

const Landing = () => {
  const [showAboutUs, setShowAboutUs] = useState(false);
  const handleCloseAboutUs = () => setShowAboutUs(false);
  const handleShowAboutUs = () => setShowAboutUs(true);

  const [showMMP, setShowMMP] = useState(false);
  const handleCloseMMP = () => setShowMMP(false);
  const handleShowMMP = () => setShowMMP(true);

  return (
    <main className="landing-container text-center">
      {/* <h2
                className="text-center text-md-start"
            >
                Catering & Community Food Programs
            </h2> */}
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
      <Carousel>
        {slides.map((slide) => (
          <Carousel.Item key={slide.src} className="carousel-item">
            <img className="d-block carousel-img" src={slide.src} alt={slide.alt} />
            <Carousel.Caption className="bg-dark bg-opacity-50 text-white p-3">
              <h3>{slide.title}</h3>
              <p>{slide.text}</p>
            </Carousel.Caption>
          </Carousel.Item>
        ))}
      </Carousel>
      <div className="my-4 px-3">
        <Button
          className="fw-semibold"
          variant="secondary"
          onClick={handleShowAboutUs}
        >
          About Us
        </Button>
        <AboutUsModal show={showAboutUs} onHide={handleCloseAboutUs} />
      </div>
      <div className="my-4 px-3">
        <Button className="fw-semibold" variant="secondary" onClick={handleShowMMP}>
          Monday Meal Program
        </Button>
        <MondayMealModal show={showMMP} onHide={handleCloseMMP} />
      </div>
    </main>
  );
};

export default Landing;
