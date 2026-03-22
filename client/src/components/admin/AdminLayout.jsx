import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Modal, Nav, Spinner } from "react-bootstrap";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import Context from "../../context";
import ThemeToggleButton from "../ThemeToggleButton";
import PasswordVisibilityButton from "./PasswordVisibilityButton";
import { getAdminSession, logoutAdminSession, updateAdminProfile } from "./adminApi";

const TAB_MENU = "menu";
const TAB_PACKAGES = "packages";
const TAB_MEDIA = "media";
const TAB_SETTINGS = "settings";
const ACCESS_TIER_OWNER = 0;
const ACCESS_TIER_MANAGER = 1;
const ACCESS_TIER_OPERATOR = 2;
const EMPTY_PROFILE_FIELD_ERRORS = {
  username: "",
  display_name: "",
  current_password: "",
  new_password: "",
  confirm_password: "",
};
const INITIAL_PROFILE_FORM = {
  username: "",
  display_name: "",
  current_password: "",
  new_password: "",
  confirm_password: "",
};
const INITIAL_PROFILE_PASSWORD_VISIBILITY = {
  current: false,
  next: false,
  confirm: false,
};

const toAccessTier = (value, fallback = ACCESS_TIER_MANAGER) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if ([ACCESS_TIER_OWNER, ACCESS_TIER_MANAGER, ACCESS_TIER_OPERATOR].includes(parsed)) return parsed;
  return fallback;
};

const mapProfileValidationErrors = (message) => {
  const normalized = String(message || "").toLowerCase();
  const mapped = {};
  if (!normalized) return mapped;

  if (normalized.includes("username")) {
    mapped.username = String(message || "Invalid username.");
  }
  if (normalized.includes("display name")) {
    mapped.display_name = String(message || "Invalid display name.");
  }
  if (normalized.includes("current password")) {
    mapped.current_password = String(message || "Invalid current password.");
  }
  if (normalized.includes("new password")) {
    mapped.new_password = String(message || "Invalid new password.");
  }
  if (normalized.includes("confirm password") || normalized.includes("must match")) {
    mapped.confirm_password = String(message || "Confirm password does not match.");
  }
  return mapped;
};

const resolveActiveTab = (pathname) => {
  if (pathname.startsWith("/admin/service-packages")) return TAB_PACKAGES;
  if (pathname.startsWith("/admin/media")) return TAB_MEDIA;
  if (pathname.startsWith("/admin/settings")) return TAB_SETTINGS;
  return TAB_MENU;
};

const AdminLayout = () => {
  const { isDarkTheme, setThemeMode } = useContext(Context);
  const navigate = useNavigate();
  const location = useLocation();
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [adminUser, setAdminUser] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState(INITIAL_PROFILE_FORM);
  const [profileFieldErrors, setProfileFieldErrors] = useState(EMPTY_PROFILE_FIELD_ERRORS);
  const [profileError, setProfileError] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profilePasswordVisibility, setProfilePasswordVisibility] = useState(INITIAL_PROFILE_PASSWORD_VISIBILITY);

  const adminAccessTier = toAccessTier(adminUser?.access_tier, ACCESS_TIER_MANAGER);
  const isOwnerSession = adminAccessTier === ACCESS_TIER_OWNER;
  const canAccessDashboardSettings = isOwnerSession || adminAccessTier === ACCESS_TIER_MANAGER;
  const canManageAdminUsers =
    isOwnerSession || (adminAccessTier === ACCESS_TIER_MANAGER && Boolean(adminUser?.can_manage_admin_users));
  const activeTab = useMemo(() => resolveActiveTab(location.pathname), [location.pathname]);

  useEffect(() => {
    let mounted = true;

    const hydrateSession = async () => {
      try {
        const payload = await getAdminSession();
        if (!mounted) return;
        setAdminUser(payload.user || null);
      } catch {
        if (!mounted) return;
        setAuthError("unauthorized");
      } finally {
        if (mounted) {
          setSessionLoading(false);
        }
      }
    };

    hydrateSession();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (sessionLoading || canAccessDashboardSettings || !location.pathname.startsWith("/admin/settings")) {
      return;
    }
    navigate("/admin/menu-items", { replace: true });
  }, [canAccessDashboardSettings, location.pathname, navigate, sessionLoading]);

  const openProfileEditor = useCallback(() => {
    if (!adminUser) return;
    setProfileForm({
      ...INITIAL_PROFILE_FORM,
      username: String(adminUser.username || ""),
      display_name: String(adminUser.display_name || ""),
    });
    setProfileFieldErrors(EMPTY_PROFILE_FIELD_ERRORS);
    setProfileError("");
    setProfilePasswordVisibility(INITIAL_PROFILE_PASSWORD_VISIBILITY);
    setShowProfileModal(true);
  }, [adminUser]);

  const closeProfileEditor = useCallback(() => {
    if (profileBusy) return;
    setShowProfileModal(false);
    setProfileFieldErrors(EMPTY_PROFILE_FIELD_ERRORS);
    setProfileError("");
    setProfileForm(INITIAL_PROFILE_FORM);
    setProfilePasswordVisibility(INITIAL_PROFILE_PASSWORD_VISIBILITY);
  }, [profileBusy]);

  const handleProfileSubmit = async (event) => {
    event.preventDefault();

    const normalizedUsername = String(profileForm.username || "").trim().toLowerCase();
    const normalizedDisplayName = String(profileForm.display_name || "").trim();
    const currentPassword = String(profileForm.current_password || "");
    const newPassword = String(profileForm.new_password || "");
    const confirmPassword = String(profileForm.confirm_password || "");
    const wantsPasswordChange = Boolean(currentPassword || newPassword || confirmPassword);

    const nextErrors = { ...EMPTY_PROFILE_FIELD_ERRORS };
    if (!normalizedUsername) {
      nextErrors.username = "Username is required.";
    } else if (normalizedUsername.length < 3) {
      nextErrors.username = "Username must be at least 3 characters.";
    } else if (normalizedUsername.length > 120) {
      nextErrors.username = "Username must be 120 characters or fewer.";
    } else if (!/^[a-z0-9._-]+$/.test(normalizedUsername)) {
      nextErrors.username = "Use lowercase letters, numbers, periods, underscores, or hyphens.";
    }

    if (normalizedDisplayName.length > 150) {
      nextErrors.display_name = "Display name must be 150 characters or fewer.";
    }

    if (wantsPasswordChange) {
      if (!currentPassword) {
        nextErrors.current_password = "Current password is required.";
      }
      if (!newPassword) {
        nextErrors.new_password = "New password is required.";
      } else if (newPassword.length < 10) {
        nextErrors.new_password = "New password must be at least 10 characters.";
      }
      if (!confirmPassword) {
        nextErrors.confirm_password = "Confirm password is required.";
      } else if (newPassword && confirmPassword !== newPassword) {
        nextErrors.confirm_password = "New password and confirm password must match.";
      }
      if (currentPassword && newPassword && currentPassword === newPassword) {
        nextErrors.new_password = "New password must be different from current password.";
      }
    }

    if (Object.values(nextErrors).some(Boolean)) {
      setProfileFieldErrors(nextErrors);
      setProfileError("");
      return;
    }

    setProfileBusy(true);
    setProfileError("");
    setProfileFieldErrors(EMPTY_PROFILE_FIELD_ERRORS);
    try {
      const payload = await updateAdminProfile({
        username: normalizedUsername,
        display_name: normalizedDisplayName,
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      if (payload?.user) {
        setAdminUser(payload.user);
      }
      setShowProfileModal(false);
      setProfileForm(INITIAL_PROFILE_FORM);
      setProfilePasswordVisibility(INITIAL_PROFILE_PASSWORD_VISIBILITY);
    } catch (error) {
      const message = error.message || "Failed to update profile.";
      const mappedErrors = mapProfileValidationErrors(message);
      if (Object.keys(mappedErrors).length) {
        setProfileFieldErrors((prev) => ({ ...prev, ...mappedErrors }));
      } else {
        setProfileError(message);
      }
    } finally {
      setProfileBusy(false);
    }
  };

  const handleLogout = useCallback(async () => {
    try {
      await logoutAdminSession();
    } finally {
      navigate("/admin/login", { replace: true });
    }
  }, [navigate]);

  if (sessionLoading) {
    return (
      <main className="container py-5 d-flex justify-content-center">
        <Spinner animation="border" role="status" />
      </main>
    );
  }

  if (authError) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return (
    <main
      className={`container-fluid py-4 admin-dashboard ${isDarkTheme ? "admin-dashboard-dark" : ""}`}
      data-bs-theme={isDarkTheme ? "dark" : "light"}>
      <header className="admin-header mb-3">
        <div className="admin-header-main">
          <h2 className="h4 mb-1">Admin Dashboard</h2>
          <p className="text-secondary mb-0">
            Signed in as{" "}
            <strong>{adminUser?.display_name || adminUser?.username}</strong>
            <button
              type="button"
              className="admin-profile-edit-btn ms-2"
              aria-label="Edit admin profile"
              title="Edit profile"
              onClick={openProfileEditor}>
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
            onToggle={() => setThemeMode?.(isDarkTheme ? "light" : "dark")}
            className="mt-2"
          />
        </div>
        <div className="admin-header-actions">
          <Button variant="outline-danger" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>
      </header>

      <Nav variant="tabs" activeKey={activeTab} className="mb-3" role="tablist">
        <Nav.Item>
          <Nav.Link as={Link} to="/admin/menu-items" eventKey={TAB_MENU} role="tab" aria-label="Menu Operations">
            <span className="admin-tab-label-full">Menu Operations</span>
            <span className="admin-tab-label-short">Menu</span>
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link
            as={Link}
            to="/admin/service-packages"
            eventKey={TAB_PACKAGES}
            role="tab"
            aria-label="Service Packages">
            <span className="admin-tab-label-full">Service Packages</span>
            <span className="admin-tab-label-short">Packages</span>
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link as={Link} to="/admin/media" eventKey={TAB_MEDIA} role="tab" aria-label="Media Manager">
            <span className="admin-tab-label-full">Media Manager</span>
            <span className="admin-tab-label-short">Media</span>
          </Nav.Link>
        </Nav.Item>
        {canAccessDashboardSettings ? (
          <Nav.Item>
            <Nav.Link
              as={Link}
              to="/admin/settings"
              eventKey={TAB_SETTINGS}
              role="tab"
              aria-label="Dashboard Settings">
              <span className="admin-tab-label-full">Dashboard Settings</span>
              <span className="admin-tab-label-short">Settings</span>
            </Nav.Link>
          </Nav.Item>
        ) : null}
      </Nav>

      <Outlet
        context={{
          adminUser,
          sessionLoading,
          canAccessDashboardSettings,
          canManageAdminUsers,
          onAdminUserChange: setAdminUser,
        }}
      />

      <Modal
        show={showProfileModal}
        onHide={closeProfileEditor}
        centered
        className={`admin-profile-modal ${isDarkTheme ? "admin-confirm-modal-dark" : ""}`.trim()}>
        <Modal.Header closeButton>
          <Modal.Title>Edit Admin Profile</Modal.Title>
        </Modal.Header>
        <Form noValidate onSubmit={handleProfileSubmit}>
          <Modal.Body>
            {profileError ? <Alert variant="danger">{profileError}</Alert> : null}
            <Form.Group className="mb-3" controlId="admin-profile-username">
              <Form.Label>Username</Form.Label>
              <Form.Control
                autoComplete="username"
                value={profileForm.username}
                isInvalid={Boolean(profileFieldErrors.username)}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setProfileForm((prev) => ({ ...prev, username: nextValue }));
                  setProfileFieldErrors((prev) => ({ ...prev, username: "" }));
                }}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="admin-profile-display-name">
              <Form.Label>Display Name</Form.Label>
              <Form.Control
                value={profileForm.display_name}
                isInvalid={Boolean(profileFieldErrors.display_name)}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setProfileForm((prev) => ({ ...prev, display_name: nextValue }));
                  setProfileFieldErrors((prev) => ({ ...prev, display_name: "" }));
                }}
              />
            </Form.Group>
            <Form.Text className="text-secondary d-block mb-3">
              Leave password fields blank to keep your current password.
            </Form.Text>
            <Form.Group className="mb-3" controlId="admin-profile-current-password">
              <Form.Label>Current Password</Form.Label>
              <div className="input-group has-validation">
                <Form.Control
                  type={profilePasswordVisibility.current ? "text" : "password"}
                  autoComplete="current-password"
                  value={profileForm.current_password}
                  isInvalid={Boolean(profileFieldErrors.current_password)}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setProfileForm((prev) => ({ ...prev, current_password: nextValue }));
                    setProfileFieldErrors((prev) => ({ ...prev, current_password: "" }));
                  }}
                />
                <PasswordVisibilityButton
                  visible={profilePasswordVisibility.current}
                  label={profilePasswordVisibility.current ? "Hide current password" : "Show current password"}
                  onToggle={() =>
                    setProfilePasswordVisibility((prev) => ({
                      ...prev,
                      current: !prev.current,
                    }))
                  }
                  disabled={profileBusy}
                />
              </div>
            </Form.Group>
            <Form.Group className="mb-3" controlId="admin-profile-new-password">
              <Form.Label>New Password</Form.Label>
              <div className="input-group has-validation">
                <Form.Control
                  type={profilePasswordVisibility.next ? "text" : "password"}
                  autoComplete="new-password"
                  value={profileForm.new_password}
                  isInvalid={Boolean(profileFieldErrors.new_password)}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setProfileForm((prev) => ({ ...prev, new_password: nextValue }));
                    setProfileFieldErrors((prev) => ({ ...prev, new_password: "" }));
                  }}
                />
                <PasswordVisibilityButton
                  visible={profilePasswordVisibility.next}
                  label={profilePasswordVisibility.next ? "Hide new password" : "Show new password"}
                  onToggle={() =>
                    setProfilePasswordVisibility((prev) => ({
                      ...prev,
                      next: !prev.next,
                    }))
                  }
                  disabled={profileBusy}
                />
              </div>
            </Form.Group>
            <Form.Group className="mb-0" controlId="admin-profile-confirm-password">
              <Form.Label>Confirm New Password</Form.Label>
              <div className="input-group has-validation">
                <Form.Control
                  type={profilePasswordVisibility.confirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={profileForm.confirm_password}
                  isInvalid={Boolean(profileFieldErrors.confirm_password)}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setProfileForm((prev) => ({ ...prev, confirm_password: nextValue }));
                    setProfileFieldErrors((prev) => ({ ...prev, confirm_password: "" }));
                  }}
                />
                <PasswordVisibilityButton
                  visible={profilePasswordVisibility.confirm}
                  label={profilePasswordVisibility.confirm ? "Hide confirm password" : "Show confirm password"}
                  onToggle={() =>
                    setProfilePasswordVisibility((prev) => ({
                      ...prev,
                      confirm: !prev.confirm,
                    }))
                  }
                  disabled={profileBusy}
                />
              </div>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={closeProfileEditor} disabled={profileBusy}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" disabled={profileBusy}>
              {profileBusy ? "Saving..." : "Save Profile"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </main>
  );
};

export default AdminLayout;
