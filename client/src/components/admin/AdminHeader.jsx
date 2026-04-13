import { Button } from "react-bootstrap";
import ThemeToggleButton from "../ThemeToggleButton";

const AdminHeader = ({
  adminUser,
  isDarkTheme,
  onOpenProfile,
  onToggleTheme,
  onLogout,
}) => {
  return (
    <header className="admin-header mb-3">
      <div className="admin-header-main">
        <h2 className="h4 mb-1">Admin Dashboard</h2>
        <p className="text-secondary mb-0">
          Signed in as <strong>{adminUser?.display_name || adminUser?.username}</strong>
          <button
            type="button"
            className="admin-profile-edit-btn ms-2"
            aria-label="Edit admin profile"
            title="Edit profile"
            onClick={onOpenProfile}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="m11.01 1.927 3.063 3.063-8.93 8.93-3.673.61.61-3.673 8.93-8.93Zm1.06-1.06a1.5 1.5 0 0 1 2.122 0l1.941 1.94a1.5 1.5 0 0 1 0 2.122l-.53.53-3.063-3.063.53-.53Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </p>
        <ThemeToggleButton
          isDarkTheme={isDarkTheme}
          onToggle={onToggleTheme}
          className="mt-2"
        />
      </div>
      <div className="admin-header-actions">
        <Button variant="outline-danger" onClick={onLogout}>
          Sign Out
        </Button>
      </div>
    </header>
  );
};

export default AdminHeader;
