import { Nav } from "react-bootstrap";
import { Link } from "react-router-dom";
import { ADMIN_NAV_ITEMS } from "./adminShared";

const AdminNavTabs = ({ activeTab, canAccessDashboardSettings }) => {
  return (
    <Nav variant="tabs" activeKey={activeTab} className="mb-3" role="tablist">
      {ADMIN_NAV_ITEMS.filter(
        (item) => !item.requiresSettingsAccess || canAccessDashboardSettings
      ).map((item) => (
        <Nav.Item key={item.key}>
          <Nav.Link as={Link} to={item.to} eventKey={item.key} role="tab" aria-label={item.ariaLabel}>
            <span className="admin-tab-label-full">{item.fullLabel}</span>
            <span className="admin-tab-label-short">{item.shortLabel}</span>
          </Nav.Link>
        </Nav.Item>
      ))}
    </Nav>
  );
};

export default AdminNavTabs;
