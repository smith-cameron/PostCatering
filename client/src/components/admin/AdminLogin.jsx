import { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import PasswordField from "./PasswordField";
import { getAdminSession, requestJson } from "./adminApi";

const AdminLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const hydrateSession = async () => {
      try {
        await getAdminSession();
        if (mounted) {
          navigate("/admin", { replace: true });
        }
      } catch {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    hydrateSession();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await requestJson("/api/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
        }),
      });
      const redirectPath = location.state?.from?.pathname || "/admin";
      navigate(redirectPath, { replace: true });
    } catch (submitError) {
      setError(submitError.message || "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="container py-5 d-flex justify-content-center">
        <Spinner animation="border" role="status" />
      </main>
    );
  }

  return (
    <main className="container py-5 admin-login-page">
      <Card className="mx-auto admin-login-card">
        <Card.Body className="p-4">
          <h2 className="h4 mb-3">Admin Dashboard Login</h2>
          <p className="text-secondary mb-4">Sign in to manage menu and media content.</p>

          {error ? <Alert variant="danger">{error}</Alert> : null}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="adminUsername">
              <Form.Label>Username</Form.Label>
              <Form.Control
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </Form.Group>

            <PasswordField
              controlId="adminPassword"
              className="mb-4"
              label="Password"
              value={password}
              visible={passwordVisible}
              disabled={submitting}
              onChange={(event) => setPassword(event.target.value)}
              onToggle={() => setPasswordVisible((prev) => !prev)}
            />

            <Button className="btn-inquiry-action w-100" variant="secondary" type="submit" disabled={submitting}>
              {submitting ? "Signing In..." : "Sign In"}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </main>
  );
};

export default AdminLogin;
