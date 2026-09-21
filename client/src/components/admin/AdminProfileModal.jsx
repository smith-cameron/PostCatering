import { useEffect, useState } from "react";
import { Alert, Button, Form, Modal } from "react-bootstrap";
import { updateAdminProfile } from "./adminApi";
import PasswordField from "./PasswordField";

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

const buildProfilePayload = (profileForm) => ({
  username: String(profileForm.username || "").trim().toLowerCase(),
  display_name: String(profileForm.display_name || "").trim(),
  current_password: String(profileForm.current_password || ""),
  new_password: String(profileForm.new_password || ""),
  confirm_password: String(profileForm.confirm_password || ""),
});

const validateProfilePayload = (payload) => {
  const nextErrors = { ...EMPTY_PROFILE_FIELD_ERRORS };
  const wantsPasswordChange = Boolean(
    payload.current_password || payload.new_password || payload.confirm_password
  );

  if (!payload.username) {
    nextErrors.username = "Username is required.";
  } else if (payload.username.length < 3) {
    nextErrors.username = "Username must be at least 3 characters.";
  } else if (payload.username.length > 120) {
    nextErrors.username = "Username must be 120 characters or fewer.";
  } else if (!/^[a-z0-9._-]+$/.test(payload.username)) {
    nextErrors.username = "Use lowercase letters, numbers, periods, underscores, or hyphens.";
  }

  if (payload.display_name.length > 150) {
    nextErrors.display_name = "Display name must be 150 characters or fewer.";
  }

  if (wantsPasswordChange) {
    if (!payload.current_password) {
      nextErrors.current_password = "Current password is required.";
    }
    if (!payload.new_password) {
      nextErrors.new_password = "New password is required.";
    } else if (payload.new_password.length < 10) {
      nextErrors.new_password = "New password must be at least 10 characters.";
    }
    if (!payload.confirm_password) {
      nextErrors.confirm_password = "Confirm password is required.";
    } else if (payload.new_password && payload.confirm_password !== payload.new_password) {
      nextErrors.confirm_password = "New password and confirm password must match.";
    }
    if (
      payload.current_password &&
      payload.new_password &&
      payload.current_password === payload.new_password
    ) {
      nextErrors.new_password = "New password must be different from current password.";
    }
  }

  return nextErrors;
};

const AdminProfileModal = ({
  show,
  onHide,
  adminUser = null,
  onAdminUserChange,
  darkMode = false,
}) => {
  const [profileForm, setProfileForm] = useState(INITIAL_PROFILE_FORM);
  const [profileFieldErrors, setProfileFieldErrors] = useState(EMPTY_PROFILE_FIELD_ERRORS);
  const [profileError, setProfileError] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profilePasswordVisibility, setProfilePasswordVisibility] = useState(
    INITIAL_PROFILE_PASSWORD_VISIBILITY
  );

  useEffect(() => {
    if (!show) {
      setProfileForm(INITIAL_PROFILE_FORM);
      setProfileFieldErrors(EMPTY_PROFILE_FIELD_ERRORS);
      setProfileError("");
      setProfilePasswordVisibility(INITIAL_PROFILE_PASSWORD_VISIBILITY);
      return;
    }
    if (!adminUser) return;

    setProfileForm({
      ...INITIAL_PROFILE_FORM,
      username: String(adminUser.username || ""),
      display_name: String(adminUser.display_name || ""),
    });
    setProfileFieldErrors(EMPTY_PROFILE_FIELD_ERRORS);
    setProfileError("");
    setProfilePasswordVisibility(INITIAL_PROFILE_PASSWORD_VISIBILITY);
  }, [adminUser, show]);

  const handleClose = () => {
    if (profileBusy) return;
    onHide?.();
  };

  const updateProfileField = (field, value) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
    setProfileFieldErrors((prev) => {
      if (!prev[field]) return prev;
      return { ...prev, [field]: "" };
    });
  };

  const togglePasswordVisibility = (field) => {
    setProfilePasswordVisibility((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = buildProfilePayload(profileForm);
    const nextErrors = validateProfilePayload(payload);
    if (Object.values(nextErrors).some(Boolean)) {
      setProfileFieldErrors(nextErrors);
      setProfileError("");
      return;
    }

    setProfileBusy(true);
    setProfileError("");
    setProfileFieldErrors(EMPTY_PROFILE_FIELD_ERRORS);
    try {
      const response = await updateAdminProfile(payload);
      if (response?.user) {
        onAdminUserChange?.(response.user);
      }
      onHide?.();
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

  return (
    <Modal
      show={show}
      onHide={handleClose}
      centered
      className={`admin-profile-modal ${darkMode ? "admin-confirm-modal-dark" : ""}`.trim()}>
      <Modal.Header closeButton>
        <Modal.Title>Edit Admin Profile</Modal.Title>
      </Modal.Header>
      <Form noValidate onSubmit={handleSubmit}>
        <Modal.Body>
          {profileError ? <Alert variant="danger">{profileError}</Alert> : null}

          <Form.Group className="mb-3" controlId="admin-profile-username">
            <Form.Label>Username</Form.Label>
            <Form.Control
              autoComplete="username"
              value={profileForm.username}
              isInvalid={Boolean(profileFieldErrors.username)}
              onChange={(event) => updateProfileField("username", event.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="admin-profile-display-name">
            <Form.Label>Display Name</Form.Label>
            <Form.Control
              value={profileForm.display_name}
              isInvalid={Boolean(profileFieldErrors.display_name)}
              onChange={(event) => updateProfileField("display_name", event.target.value)}
            />
          </Form.Group>

          <Form.Text className="text-secondary d-block mb-3">
            Leave password fields blank to keep your current password.
          </Form.Text>

          <PasswordField
            controlId="admin-profile-current-password"
            label="Current Password"
            ariaLabel="Current Password"
            autoComplete="current-password"
            value={profileForm.current_password}
            visible={profilePasswordVisibility.current}
            isInvalid={Boolean(profileFieldErrors.current_password)}
            disabled={profileBusy}
            onChange={(event) => updateProfileField("current_password", event.target.value)}
            onToggle={() => togglePasswordVisibility("current")}
            showToggleLabel="Show current password"
            hideToggleLabel="Hide current password"
          />

          <PasswordField
            controlId="admin-profile-new-password"
            label="New Password"
            ariaLabel="New Password"
            autoComplete="new-password"
            value={profileForm.new_password}
            visible={profilePasswordVisibility.next}
            isInvalid={Boolean(profileFieldErrors.new_password)}
            disabled={profileBusy}
            onChange={(event) => updateProfileField("new_password", event.target.value)}
            onToggle={() => togglePasswordVisibility("next")}
            showToggleLabel="Show new password"
            hideToggleLabel="Hide new password"
          />

          <PasswordField
            controlId="admin-profile-confirm-password"
            className="mb-0"
            label="Confirm New Password"
            ariaLabel="Confirm New Password"
            autoComplete="new-password"
            value={profileForm.confirm_password}
            visible={profilePasswordVisibility.confirm}
            isInvalid={Boolean(profileFieldErrors.confirm_password)}
            disabled={profileBusy}
            onChange={(event) => updateProfileField("confirm_password", event.target.value)}
            onToggle={() => togglePasswordVisibility("confirm")}
            showToggleLabel="Show confirm password"
            hideToggleLabel="Hide confirm password"
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={handleClose} disabled={profileBusy}>
            Cancel
          </Button>
          <Button type="submit" variant="secondary" disabled={profileBusy}>
            {profileBusy ? "Saving..." : "Save Profile"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default AdminProfileModal;
