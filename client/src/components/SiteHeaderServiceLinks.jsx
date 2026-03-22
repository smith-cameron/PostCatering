import { Nav, NavDropdown } from "react-bootstrap";
import { Link } from "react-router-dom";
import { SITE_SERVICE_LINKS } from "./siteNavigationConfig";

const SiteHeaderServiceLinks = ({ isMobile }) => {
  if (isMobile) {
    return SITE_SERVICE_LINKS.map((serviceLink) => (
      <Nav.Link
        key={serviceLink.key}
        as={Link}
        to={serviceLink.to}
        className="site-header-action-link site-header-service-item">
        {serviceLink.navLabel}
      </Nav.Link>
    ));
  }

  return (
    <NavDropdown
      title={<span className="fw-semibold">Services</span>}
      id="basic-nav-dropdown"
      align="end">
      {SITE_SERVICE_LINKS.map((serviceLink) => (
        <NavDropdown.Item
          key={serviceLink.key}
          as={Link}
          to={serviceLink.to}
          className="site-header-service-item">
          {serviceLink.navLabel}
        </NavDropdown.Item>
      ))}
    </NavDropdown>
  );
};

export default SiteHeaderServiceLinks;
