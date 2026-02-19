import { Navbar, Container, Nav, NavDropdown, NavbarText } from "react-bootstrap";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ContactUsModal from "./modals/ContactUsModal";

const Header = ({ onOpenInquiry }) => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 992 : false
  );
  const [showContactModal, setShowContactModal] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 991.98px)");
    const handleChange = (event) => setIsMobile(event.matches);

    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const serviceItems = (
    <>
      <NavDropdown.Item as={Link} to="/services/togo">
        To-Go & Take-and-Bake Trays
      </NavDropdown.Item>

      <NavDropdown.Item as={Link} to="/services/community">
        Community & Crew Catering
      </NavDropdown.Item>

      <NavDropdown.Item as={Link} to="/services/formal">
        Formal Events Catering
      </NavDropdown.Item>

      <NavDropdown.Divider />

      <NavDropdown.Item
        as="button"
        type="button"
        onClick={() => setShowContactModal(true)}>
        Contact Us
      </NavDropdown.Item>

      <NavDropdown.Item as={Link} to="/showcase">
        Photo Showcase
      </NavDropdown.Item>

      <NavDropdown.Item
        as="button"
        type="button"
        onClick={() => onOpenInquiry?.()}>
        Send Catering Inquiry
      </NavDropdown.Item>
    </>
  );

  return (
    <Navbar expand="lg" className="bg-body-secondary">
      <Container fluid>
        <Navbar.Brand as={Link} to="/">AMERICAN LEGION POST 468</Navbar.Brand>
        <NavbarText className="fs-5 fw-medium text-secondary opacity-75">
          Catering & Community Food Programs
        </NavbarText>

        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            {isMobile ? (
              <>
                <Nav.Link as={Link} to="/services/togo">
                  To-Go & Take-and-Bake Trays
                </Nav.Link>

                <Nav.Link as={Link} to="/services/community">
                  Community & Crew Catering
                </Nav.Link>

                <Nav.Link as={Link} to="/services/formal">
                  Formal Events Catering
                </Nav.Link>

                <Nav.Link as={Link} to="/showcase">
                  Showcase
                </Nav.Link>

                <Nav.Link
                  as="button"
                  type="button"
                  className="nav-link btn btn-link text-start p-0"
                  onClick={() => onOpenInquiry?.()}>
                  Send Catering Inquiry
                </Nav.Link>

                <Nav.Link
                  as="button"
                  type="button"
                  className="nav-link btn btn-link text-start p-0"
                  onClick={() => setShowContactModal(true)}>
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
      <ContactUsModal show={showContactModal} onHide={() => setShowContactModal(false)} />
    </Navbar>
  );
};

export default Header;
