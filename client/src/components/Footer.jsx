import { Container, Nav } from "react-bootstrap";
import { Link } from "react-router-dom";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer bg-body-secondary border-top">
      <Container
        fluid
        className="py-3 d-flex flex-column flex-md-row align-items-center justify-content-between gap-2">
        <p className="mb-0 small text-secondary">
          &copy; {currentYear} American Legion Post 468
        </p>

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
            <Nav.Link as={Link} to="/inquiry" className="px-2 py-0">
              Inquiry
            </Nav.Link>
          </Nav.Item>
        </Nav>
      </Container>
    </footer>
  );
};

export default Footer;
