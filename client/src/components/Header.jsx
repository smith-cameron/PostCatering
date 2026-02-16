import { Navbar, Container, Nav, NavDropdown, NavbarText } from "react-bootstrap";
import { Link } from "react-router-dom";

const Header = () => {
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
              <NavDropdown title="Services" id="basic-nav-dropdown">
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

                <NavDropdown.Item as={Link} to="/inquiry">
                  Send Catering Inquiry
                </NavDropdown.Item>

                <NavDropdown.Item as={Link} to="/contact">
                  Contact Us
                </NavDropdown.Item>
              </NavDropdown>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
  );
};

export default Header;
