import { Container, Nav } from "react-bootstrap";
import { useContext, useState } from "react";
import { Link } from "react-router-dom";
import Context from "../context";
import ContactUsModal from "./modals/ContactUsModal";
import ThemeToggleButton from "./ThemeToggleButton";

const Footer = () => {
  const { openInquiryModal, isDarkTheme, toggleTheme } = useContext(Context);
  const [showContactModal, setShowContactModal] = useState(false);

  return (
    <footer className="site-footer bg-body-secondary border-top">
      <Container
        fluid
        className="py-3 d-flex flex-column flex-md-row align-items-center justify-content-between gap-2">
        <ThemeToggleButton isDarkTheme={isDarkTheme} onToggle={() => toggleTheme?.()} />

        <Nav as="ul" className="site-footer-nav align-items-center">
          <Nav.Item as="li">
            <Nav.Link as={Link} to="/" className="px-2 py-0">
              Home
            </Nav.Link>
          </Nav.Item>
          <Nav.Item as="li">
            <Nav.Link as={Link} to="/services/togo" className="px-2 py-0">
              Services
            </Nav.Link>
          </Nav.Item>
          <Nav.Item as="li">
            <Nav.Link as={Link} to="/showcase" className="px-2 py-0">
              Photos
            </Nav.Link>
          </Nav.Item>
          <Nav.Item as="li">
            <Nav.Link
              as="button"
              type="button"
              className="px-2 py-0"
              onClick={() => openInquiryModal?.()}>
              Inquiry
            </Nav.Link>
          </Nav.Item>
          <Nav.Item as="li">
            <Nav.Link
              as="button"
              type="button"
              className="px-2 py-0"
              onClick={() => setShowContactModal(true)}>
              Contact Us
            </Nav.Link>
          </Nav.Item>
        </Nav>
      </Container>
      <ContactUsModal show={showContactModal} onHide={() => setShowContactModal(false)} />
    </footer>
  );
};

export default Footer;
