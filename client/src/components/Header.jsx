import { Navbar, Container, Nav, NavDropdown, NavbarText } from "react-bootstrap";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AboutUsModal from "./modals/AboutUsModal";
import ContactUsModal from "./modals/ContactUsModal";
import MondayMealModal from "./modals/MondayMealModal";

const Header = ({ onOpenInquiry }) => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 992 : false
  );
  const [activeModal, setActiveModal] = useState(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 991.98px)");
    const handleChange = (event) => setIsMobile(event.matches);

    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const closeModal = () => setActiveModal(null);

  const serviceItems = (
    <>
      <NavDropdown.Item as={Link} to="/services/togo" className="site-header-service-item">
        To-Go & Take-and-Bake Trays
      </NavDropdown.Item>

      <NavDropdown.Item as={Link} to="/services/community" className="site-header-service-item">
        Community & Crew Catering
      </NavDropdown.Item>

      <NavDropdown.Item as={Link} to="/services/formal" className="site-header-service-item">
        Formal Events Catering
      </NavDropdown.Item>

      <NavDropdown.Item
        as="button"
        className="site-header-inquiry-item"
        type="button"
        onClick={() => onOpenInquiry?.()}>
        Send Catering Inquiry
      </NavDropdown.Item>

      <NavDropdown.Divider />

      <NavDropdown.Item
        as="button"
        type="button"
        onClick={() => setActiveModal("aboutUs")}>
        About Us
      </NavDropdown.Item>

      <NavDropdown.Item
        as="button"
        type="button"
        onClick={() => setActiveModal("mondayMeal")}>
        Monday Meal Program
      </NavDropdown.Item>

      <NavDropdown.Item as={Link} to="/showcase">
        Photos
      </NavDropdown.Item>

      <NavDropdown.Item
        as="button"
        type="button"
        onClick={() => setActiveModal("contact")}>
        Contact Us
      </NavDropdown.Item>
    </>
  );

  return (
    <Navbar expand="lg" className="bg-body-secondary site-header-navbar">
      <Container fluid>
        <Navbar.Brand as={Link} to="/">AMERICAN LEGION POST 468</Navbar.Brand>
        <NavbarText className="fs-5 fw-medium text-secondary opacity-75">
          Catering & Community Food Programs
        </NavbarText>
        <Navbar.Toggle className="site-header-toggle" aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
          <Nav className="ms-lg-auto site-header-nav">
            {isMobile ? (
              <>
                <Nav.Link as={Link} to="/services/togo" className="site-header-action-link site-header-service-item">
                  To-Go & Take-and-Bake Trays
                </Nav.Link>

                <Nav.Link
                  as={Link}
                  to="/services/community"
                  className="site-header-action-link site-header-service-item">
                  Community & Crew Catering
                </Nav.Link>

                <Nav.Link
                  as={Link}
                  to="/services/formal"
                  className="site-header-action-link site-header-service-item">
                  Formal Events Catering
                </Nav.Link>

                <Nav.Link
                  as="button"
                  type="button"
                  className="nav-link btn btn-link text-end site-header-action-link site-header-inquiry-item"
                  onClick={() => onOpenInquiry?.()}>
                  Send Catering Inquiry
                </Nav.Link>

                <div className="dropdown-divider my-1" role="separator" />

                <Nav.Link
                  as="button"
                  type="button"
                  className="nav-link btn btn-link text-end site-header-action-link"
                  onClick={() => setActiveModal("aboutUs")}>
                  About Us
                </Nav.Link>

                <Nav.Link
                  as="button"
                  type="button"
                  className="nav-link btn btn-link text-end site-header-action-link"
                  onClick={() => setActiveModal("mondayMeal")}>
                  Monday Meal Program
                </Nav.Link>

                <Nav.Link as={Link} to="/showcase">
                  Showcase
                </Nav.Link>

                <Nav.Link
                  as="button"
                  type="button"
                  className="nav-link btn btn-link text-end site-header-action-link"
                  onClick={() => setActiveModal("contact")}>
                  Contact Us
                </Nav.Link>
              </>
            ) : (
              <NavDropdown
                title={<span className="fw-semibold">Services</span>}
                id="basic-nav-dropdown"
                align="end">
                {serviceItems}
              </NavDropdown>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
      <AboutUsModal show={activeModal === "aboutUs"} onHide={closeModal} />
      <MondayMealModal show={activeModal === "mondayMeal"} onHide={closeModal} />
      <ContactUsModal show={activeModal === "contact"} onHide={closeModal} />
    </Navbar>
  );
};

export default Header;
