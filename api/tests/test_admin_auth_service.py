import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from werkzeug.security import generate_password_hash

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from flask_api.services.admin_auth_service import AdminAuthService  # noqa: E402


class AdminAuthServiceTests(unittest.TestCase):
    def test_update_profile_requires_current_password_when_changing_password(self):
        with patch.object(
            AdminAuthService,
            "get_user_with_password_by_id",
            return_value={
                "id": 1,
                "username": "admin",
                "password_hash": generate_password_hash("old-password-123"),
                "display_name": "Admin",
                "is_active": 1,
            },
        ):
            body, status_code = AdminAuthService.update_user_profile(
                1,
                {
                    "username": "admin",
                    "display_name": "Admin",
                    "new_password": "new-password-123",
                    "confirm_password": "new-password-123",
                },
            )

        self.assertEqual(status_code, 400)
        self.assertIn("Current password is required to change password.", body["errors"])

    def test_update_profile_rejects_incorrect_current_password(self):
        with patch.object(
            AdminAuthService,
            "get_user_with_password_by_id",
            return_value={
                "id": 1,
                "username": "admin",
                "password_hash": generate_password_hash("old-password-123"),
                "display_name": "Admin",
                "is_active": 1,
            },
        ):
            body, status_code = AdminAuthService.update_user_profile(
                1,
                {
                    "username": "admin",
                    "display_name": "Admin",
                    "current_password": "wrong-password",
                    "new_password": "new-password-123",
                    "confirm_password": "new-password-123",
                },
            )

        self.assertEqual(status_code, 400)
        self.assertIn("Current password is incorrect.", body["errors"])

    def test_update_profile_rejects_duplicate_username(self):
        with patch.object(
            AdminAuthService,
            "get_user_with_password_by_id",
            return_value={
                "id": 1,
                "username": "admin",
                "password_hash": generate_password_hash("old-password-123"),
                "display_name": "Admin",
                "is_active": 1,
            },
        ), patch.object(
            AdminAuthService,
            "get_user_by_username",
            return_value={"id": 2, "username": "admin2"},
        ):
            body, status_code = AdminAuthService.update_user_profile(
                1,
                {
                    "username": "admin2",
                    "display_name": "Admin",
                },
            )

        self.assertEqual(status_code, 400)
        self.assertIn("Username is already in use.", body["errors"])

    @patch("flask_api.services.admin_auth_service.query_db")
    def test_update_profile_updates_password_and_returns_public_user(self, mock_query_db):
        with patch.object(
            AdminAuthService,
            "get_user_with_password_by_id",
            return_value={
                "id": 1,
                "username": "admin",
                "password_hash": generate_password_hash("old-password-123"),
                "display_name": "Admin",
                "is_active": 1,
            },
        ), patch.object(
            AdminAuthService,
            "get_user_by_username",
            return_value=None,
        ), patch.object(
            AdminAuthService,
            "get_user_by_id",
            return_value={
                "id": 1,
                "username": "admin2",
                "display_name": "Admin Two",
                "is_active": 1,
                "last_login_at": None,
            },
        ):
            body, status_code = AdminAuthService.update_user_profile(
                1,
                {
                    "username": "admin2",
                    "display_name": "Admin Two",
                    "current_password": "old-password-123",
                    "new_password": "new-password-123",
                    "confirm_password": "new-password-123",
                },
            )

        self.assertEqual(status_code, 200)
        self.assertEqual(body["user"]["username"], "admin2")
        self.assertEqual(body["user"]["display_name"], "Admin Two")
        self.assertEqual(mock_query_db.call_count, 1)
        update_params = mock_query_db.call_args.args[1]
        self.assertIn("password_hash", update_params)
        self.assertNotEqual(update_params["password_hash"], "new-password-123")


if __name__ == "__main__":
    unittest.main()
