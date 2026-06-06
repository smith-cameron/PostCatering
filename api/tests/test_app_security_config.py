import sys
import unittest
from pathlib import Path
from unittest.mock import patch

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from flask_api import _build_runtime_security_config  # noqa: E402


class AppSecurityConfigTests(unittest.TestCase):
    def test_local_development_defaults_remain_available(self):
        with patch.dict("os.environ", {}, clear=True):
            config = _build_runtime_security_config()

        self.assertEqual(config["secret_key"], "dev-only-secret-key")
        self.assertEqual(config["session_cookie_samesite"], "Lax")
        self.assertFalse(config["session_cookie_secure"])
        self.assertEqual(config["cors_allow_origin"], "http://localhost:5173")

    def test_production_requires_explicit_security_environment_variables(self):
        with patch.dict("os.environ", {"FLASK_ENV": "production"}, clear=True):
            with self.assertRaises(RuntimeError) as context:
                _build_runtime_security_config()

        error_message = str(context.exception)
        self.assertIn("FLASK_SECRET_KEY", error_message)
        self.assertIn("SESSION_COOKIE_SAMESITE", error_message)
        self.assertIn("SESSION_COOKIE_SECURE", error_message)
        self.assertIn("CORS_ALLOW_ORIGIN", error_message)

    def test_production_requires_secure_cookie_and_non_development_secret(self):
        with patch.dict(
            "os.environ",
            {
                "FLASK_ENV": "production",
                "FLASK_SECRET_KEY": "dev-only-secret-key",
                "SESSION_COOKIE_SAMESITE": "Lax",
                "SESSION_COOKIE_SECURE": "false",
                "CORS_ALLOW_ORIGIN": "https://post468.example",
            },
            clear=True,
        ):
            with self.assertRaises(RuntimeError) as context:
                _build_runtime_security_config()

        self.assertIn("non-development FLASK_SECRET_KEY", str(context.exception))

    def test_production_requires_secure_cookie_true(self):
        with patch.dict(
            "os.environ",
            {
                "FLASK_ENV": "production",
                "FLASK_SECRET_KEY": "prod-secret-value",
                "SESSION_COOKIE_SAMESITE": "Lax",
                "SESSION_COOKIE_SECURE": "false",
                "CORS_ALLOW_ORIGIN": "https://post468.example",
            },
            clear=True,
        ):
            with self.assertRaises(RuntimeError) as context:
                _build_runtime_security_config()

        self.assertIn("SESSION_COOKIE_SECURE=true", str(context.exception))

    def test_production_rejects_loopback_cors_origin(self):
        with patch.dict(
            "os.environ",
            {
                "FLASK_ENV": "production",
                "FLASK_SECRET_KEY": "prod-secret-value",
                "SESSION_COOKIE_SAMESITE": "strict",
                "SESSION_COOKIE_SECURE": "true",
                "CORS_ALLOW_ORIGIN": "http://localhost:5173",
            },
            clear=True,
        ):
            with self.assertRaises(RuntimeError) as context:
                _build_runtime_security_config()

        self.assertIn("non-loopback frontend origin", str(context.exception))

    def test_production_accepts_valid_explicit_security_settings(self):
        with patch.dict(
            "os.environ",
            {
                "APP_ENV": "production",
                "FLASK_SECRET_KEY": "prod-secret-value",
                "SESSION_COOKIE_SAMESITE": "strict",
                "SESSION_COOKIE_SECURE": "true",
                "CORS_ALLOW_ORIGIN": "https://post468.example",
            },
            clear=True,
        ):
            config = _build_runtime_security_config()

        self.assertEqual(config["secret_key"], "prod-secret-value")
        self.assertEqual(config["session_cookie_samesite"], "Strict")
        self.assertTrue(config["session_cookie_secure"])
        self.assertEqual(config["cors_allow_origin"], "https://post468.example")


if __name__ == "__main__":
    unittest.main()
