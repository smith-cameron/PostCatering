import { Nav, NavDropdown } from "react-bootstrap";
import { Link } from "react-router-dom";
import { SITE_AUXILIARY_ITEMS } from "./siteNavigationConfig";

const SiteHeaderAuxiliaryLinks = ({
  isMobile,
  onOpenInquiry,
  onOpenModal,
}) => {
  if (isMobile) {
    return SITE_AUXILIARY_ITEMS.map((item) => {
      if (item.type === "action") {
        return (
          <Nav.Link
            key={item.key}
            as="button"
            type="button"
            className="nav-link btn btn-link text-end site-header-action-link site-header-inquiry-item"
            onClick={() => onOpenInquiry?.()}>
            {item.label}
          </Nav.Link>
        );
      }
      if (item.type === "link") {
        return (
          <Nav.Link key={item.key} as={Link} to={item.to}>
            {item.label}
          </Nav.Link>
        );
      }
      return (
        <Nav.Link
          key={item.key}
          as="button"
          type="button"
          className="nav-link btn btn-link text-end site-header-action-link"
          onClick={() => onOpenModal?.(item.key)}>
          {item.label}
        </Nav.Link>
      );
    });
  }

  return SITE_AUXILIARY_ITEMS.map((item) => {
    if (item.type === "action") {
      return (
        <NavDropdown.Item
          key={item.key}
          as="button"
          className="site-header-inquiry-item"
          type="button"
          onClick={() => onOpenInquiry?.()}>
          {item.label}
        </NavDropdown.Item>
      );
    }
    if (item.type === "link") {
      return (
        <NavDropdown.Item key={item.key} as={Link} to={item.to}>
          {item.label}
        </NavDropdown.Item>
      );
    }
    return (
      <NavDropdown.Item
        key={item.key}
        as="button"
        type="button"
        onClick={() => onOpenModal?.(item.key)}>
        {item.label}
      </NavDropdown.Item>
    );
  });
};

export default SiteHeaderAuxiliaryLinks;
