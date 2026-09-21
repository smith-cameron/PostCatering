import { Navbar, Container, Nav, NavDropdown, NavbarText } from "react-bootstrap";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AboutUsModal from "./modals/AboutUsModal";
import ContactUsModal from "./modals/ContactUsModal";
import MondayMealModal from "./modals/MondayMealModal";
import SiteHeaderAuxiliaryLinks from "./SiteHeaderAuxiliaryLinks";
import SiteHeaderServiceLinks from "./SiteHeaderServiceLinks";

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
                <SiteHeaderServiceLinks isMobile />
                <SiteHeaderAuxiliaryLinks
                  isMobile
                  onOpenInquiry={onOpenInquiry}
                  onOpenModal={setActiveModal}
                />
              </>
            ) : (
              <NavDropdown
                title={<span className="fw-semibold">Services</span>}
                id="basic-nav-dropdown"
                align="end">
                <SiteHeaderServiceLinks isMobile={false} />
                <SiteHeaderAuxiliaryLinks
                  isMobile={false}
                  onOpenInquiry={onOpenInquiry}
                  onOpenModal={setActiveModal}
                />
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
